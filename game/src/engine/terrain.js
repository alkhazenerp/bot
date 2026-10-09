// تضاريس إجرائية: شبكة كثيفة قرب اللاعب، طرق مسطّحة، أنهار، وحقول مرسومة
import * as THREE from 'three';
import { makeNoise2D, fbm, ridged } from '../core/noise.js';
import { clamp, lerp, smoothstep, mulberry32, resamplePolyline, cumulative, distToPolyline2 } from '../core/util.js';
import { makeCanvas, groundDetail } from './textures.js';

const BOUNDS = { minX: -3600, maxX: 3600, minZ: -5600, maxZ: 1600 };

function buildAxis(lo, hi, segs, smin, smax, R) {
  // توزيع غير منتظم: كثافة أعلى قرب الصفر
  const spacing = (c) => smin + (smax - smin) * smoothstep(0, R, Math.abs(c));
  const M = 4000;
  const xs = new Float64Array(M + 1), acc = new Float64Array(M + 1);
  for (let k = 0; k <= M; k++) xs[k] = lo + (hi - lo) * (k / M);
  for (let k = 1; k <= M; k++) acc[k] = acc[k - 1] + ((xs[k] - xs[k - 1]) / spacing((xs[k] + xs[k - 1]) / 2));
  const total = acc[M];
  const out = new Float32Array(segs + 1);
  let k = 0;
  for (let i = 0; i <= segs; i++) {
    const target = (i / segs) * total;
    while (k < M - 1 && acc[k + 1] < target) k++;
    const f = (target - acc[k]) / ((acc[k + 1] - acc[k]) || 1);
    out[i] = xs[k] + (xs[k + 1] - xs[k]) * clamp(f, 0, 1);
  }
  out[0] = lo; out[segs] = hi;
  return out;
}

function findCell(axis, v) {
  let lo = 0, hi = axis.length - 1;
  if (v <= axis[0]) return [0, 0];
  if (v >= axis[hi]) return [hi - 1, 1];
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (axis[m] <= v) lo = m; else hi = m;
  }
  return [lo, (v - axis[lo]) / (axis[lo + 1] - axis[lo])];
}

const SOILS = {
  red: { base: [154, 92, 62], base2: [176, 120, 82], green: [104, 122, 58], green2: [86, 108, 50], dry: [184, 160, 104], rock: [140, 130, 118], plough: [128, 72, 48] },
  pale: { base: [178, 160, 128], base2: [160, 142, 110], green: [118, 132, 70], green2: [96, 116, 58], dry: [196, 176, 128], rock: [150, 146, 136], plough: [140, 118, 90] },
};

export class Terrain {
  constructor(layout, { quality = 'medium', night = false } = {}) {
    this.layout = layout;
    this.def = layout.terrain;
    this.quality = quality;
    this.night = night;
    this.bounds = BOUNDS;
    this.noise = makeNoise2D(this.def.seed || 1);
    this.noise2 = makeNoise2D((this.def.seed || 1) + 101);
    this.soil = SOILS[this.def.soil] || SOILS.red;
    const segs = quality === 'low' ? 160 : quality === 'high' ? 300 : 230;
    this.axisX = buildAxis(BOUNDS.minX, BOUNDS.maxX, segs, 4.5, 48, 2600);
    this.axisZ = buildAxis(BOUNDS.minZ, BOUNDS.maxZ, Math.round(segs * 1.05), 4.5, 48, 3200);
    this.nx = this.axisX.length; this.nz = this.axisZ.length;
    this.heights = new Float32Array(this.nx * this.nz);
    this.river = this.def.river || null;
    if (this.river) this.river.res = resamplePolyline(this.river.pts, 25);
    this.roads = (layout.roads || []).map((r) => {
      const pts = resamplePolyline(r.pts, 12);
      return { ...r, pts, cum: cumulative(pts) };
    });
    this.playerH = 0;
    this._genHeights();
    this._buildMesh();
    this._buildWater();
    this._buildHorizon();
  }

  baseHeight(x, z) {
    const d = this.def;
    const amp = d.amp ?? 10, f = d.freq ?? 1 / 1000;
    let h = amp * fbm(this.noise, x * f, z * f, 5) * 1.4;
    h += amp * 0.35 * (ridged(this.noise2, x * f * 2.2, z * f * 2.2, 3) - 0.5) * (d.rock ?? 0.3);
    for (const m of d.mountains || []) {
      const el = m.elong || 1;
      const dx = (x - m.x) / el, dz = z - m.z;
      const dd = Math.sqrt(dx * dx + dz * dz) / m.r;
      let bump = m.h * Math.exp(-dd * dd * 2.4);
      if (m.ridge) bump *= 0.72 + 0.45 * ridged(this.noise2, x / 380, z / 380, 4);
      else bump *= 0.85 + 0.25 * fbm(this.noise2, x / 300, z / 300, 3);
      if (m.plateau) bump = Math.min(bump, m.h * m.plateau + (bump - m.h * m.plateau) * 0.15);
      h += bump;
    }
    // وادي النهر وقناته
    if (this.river) {
      const r = this.river;
      const dist = this.riverDist(x, z);
      if (dist < 360) {
        const valleyH = r.level + 1.5 + Math.max(0, dist) * 0.04;
        h = lerp(h, valleyH, 1 - smoothstep(0, 360, dist));
        h = lerp(h, r.level - 3.5, smoothstep(4, -8, dist));
      }
    }
    // حواف العالم تنخفض نحو الأفق
    const ex = Math.min(x - BOUNDS.minX, BOUNDS.maxX - x), ez = Math.min(z - BOUNDS.minZ, BOUNDS.maxZ - z);
    const edge = smoothstep(0, 500, Math.min(ex, ez));
    h = lerp(-6, h, edge);
    return h;
  }

  riverDist(x, z) {
    if (!this.river) return Infinity;
    let d = distToPolyline2(x, z, this.river.res).d - this.river.width / 2;
    if (this.river.lake) d = Math.min(d, Math.hypot(x - this.river.lake.x, z - this.river.lake.z) - this.river.lake.r);
    return d;
  }

  _genHeights() {
    const { axisX, axisZ, nx, nz, heights } = this;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights[j * nx + i] = this.baseHeight(axisX[i], axisZ[j]);

    // الطرق: ملف ارتفاع ناعم ثم تسطيح
    for (const road of this.roads) {
      const prof = road.pts.map((p) => this.baseHeight(p[0], p[1]));
      for (let pass = 0; pass < 6; pass++) {
        for (let k = 1; k < prof.length - 1; k++) prof[k] = (prof[k - 1] + prof[k] * 2 + prof[k + 1]) / 4;
      }
      road.bridgeIdx = [];
      if (this.river) {
        for (let k = 0; k < road.pts.length; k++) {
          const rd = this.riverDist(road.pts[k][0], road.pts[k][1]);
          if (rd < 45) road.bridgeIdx.push(k);
        }
        if (road.bridgeIdx.length) {
          const deck = this.river.level + 7;
          const a = road.bridgeIdx[0], b = road.bridgeIdx[road.bridgeIdx.length - 1];
          for (let k = Math.max(0, a - 6); k <= Math.min(prof.length - 1, b + 6); k++) {
            const t = k < a ? (k - (a - 6)) / 6 : k > b ? ((b + 6) - k) / 6 : 1;
            prof[k] = lerp(prof[k], Math.max(prof[k], deck), clamp(t, 0, 1));
          }
          road.deck = deck; road.bridgeA = a; road.bridgeB = b;
          road.bridgePts = road.pts.slice(Math.max(0, a - 2), b + 3);
        }
      }
      road.prof = prof;
      const half = road.w / 2 + 2, blend = 14;
      for (let k = 0; k < road.pts.length - 1; k++) {
        const [ax, az] = road.pts[k], [bx, bz] = road.pts[k + 1];
        if (road.bridgeIdx.includes(k) && this.riverDist(ax, az) < 20) continue;
        const minx = Math.min(ax, bx) - half - blend, maxx = Math.max(ax, bx) + half + blend;
        const minz = Math.min(az, bz) - half - blend, maxz = Math.max(az, bz) + half + blend;
        const [i0] = findCell(axisX, minx), [i1] = findCell(axisX, maxx);
        const [j0] = findCell(axisZ, minz), [j1] = findCell(axisZ, maxz);
        const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        for (let j = j0; j <= j1 + 1 && j < nz; j++) for (let i = i0; i <= i1 + 1 && i < nx; i++) {
          const x = axisX[i], z = axisZ[j];
          let t = ((x - ax) * dx + (z - az) * dz) / l2;
          t = clamp(t, 0, 1);
          const cx = ax + dx * t - x, cz = az + dz * t - z;
          const d = Math.sqrt(cx * cx + cz * cz);
          if (d > half + blend) continue;
          if (this.riverDist(x, z) < 6) continue;
          const target = lerp(prof[k], prof[k + 1], t) - 0.15;
          const f = 1 - smoothstep(half, half + blend, d);
          const idx = j * nx + i;
          heights[idx] = lerp(heights[idx], target, f);
        }
      }
    }

    // ساتر ترابي مرتفع لموقع اللاعب
    const ph = (this.layout.player && this.layout.player.h) || 5;
    const base0 = this._sampleGrid(0, 0);
    const top = base0 + ph;
    this.playerH = top;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = axisX[i], z = axisZ[j];
      const d = Math.hypot(x, z * 1.25);
      if (d > 140) continue;
      const idx = j * nx + i;
      const f = 1 - smoothstep(16, 120, d);
      const lip = Math.exp(-Math.pow((d - 15) / 4, 2)) * 1.3; // حافة الساتر
      heights[idx] = lerp(heights[idx], top, f * f * (3 - 2 * f)) + lip * (z < 0 ? 1 : 0.4);
    }
  }

  _sampleGrid(x, z) {
    const [i, tx] = findCell(this.axisX, x);
    const [j, tz] = findCell(this.axisZ, z);
    const nx = this.nx, h = this.heights;
    const a = h[j * nx + i], b = h[j * nx + i + 1], c = h[(j + 1) * nx + i], d = h[(j + 1) * nx + i + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  heightAt(x, z) {
    // مطابقة لمثلثات الشبكة
    const [i, tx] = findCell(this.axisX, x);
    const [j, tz] = findCell(this.axisZ, z);
    const nx = this.nx, h = this.heights;
    const a = h[j * nx + i], b = h[j * nx + i + 1], c = h[(j + 1) * nx + i], d = h[(j + 1) * nx + i + 1];
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  groundAt(x, z) {
    // أعلى من الأرض والماء والجسور
    let h = this.heightAt(x, z);
    if (this.river && this.riverDist(x, z) < 2) h = Math.max(h, this.river.level);
    for (const r of this.roads) {
      if (r.deck == null) continue;
      const { d } = distToPolyline2(x, z, r.bridgePts);
      if (d < r.w / 2 + 1) h = Math.max(h, r.deck + 0.6);
    }
    return h;
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 2.5;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  isOnRoad(x, z, margin = 0) {
    for (const r of this.roads) if (distToPolyline2(x, z, r.pts).d < r.w / 2 + margin) return true;
    return false;
  }

  _buildMesh() {
    const { axisX, axisZ, nx, nz, heights } = this;
    const pos = new Float32Array(nx * nz * 3);
    const uv = new Float32Array(nx * nz * 2);
    const SX = BOUNDS.maxX - BOUNDS.minX, SZ = BOUNDS.maxZ - BOUNDS.minZ;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      pos[k * 3] = axisX[i]; pos[k * 3 + 1] = heights[k]; pos[k * 3 + 2] = axisZ[j];
      uv[k * 2] = (axisX[i] - BOUNDS.minX) / SX;
      uv[k * 2 + 1] = 1 - (axisZ[j] - BOUNDS.minZ) / SZ;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let p = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    this.canvas = this._paint();
    const map = new THREE.CanvasTexture(this.canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    this.map = map;

    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.96, metalness: 0 });
    const detail = groundDetail();
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.detailMap = { value: detail };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nvarying vec3 vWPos;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float dA = texture2D(detailMap, vWPos.xz * 0.11).r;
          float dB = texture2D(detailMap, vWPos.xz * 0.013 + 0.37).r;
          float dC = texture2D(detailMap, vWPos.xz * 0.6).r;
          float camD = length(vWPos - cameraPosition);
          float near = 1.0 - smoothstep(30.0, 160.0, camD);
          diffuseColor.rgb *= mix(1.0, dA * 1.25, 0.55) * mix(0.85, 1.15, dB) * mix(1.0, dC * 1.3, near * 0.5);`);
    };
    mat.customProgramCacheKey = () => 'terrain-detail';
    this.material = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.userData.heat = 0.18;
    this.mesh.userData.thermalMap = true;
    this.mesh.name = 'terrain';
  }

  // رسم خريطة الألوان: تربة، حقول، بساتين، طرق، أنهار، حفر
  _paint() {
    const T = this.quality === 'high' ? 4096 : this.quality === 'low' ? 1024 : 2048;
    const c = makeCanvas(T);
    const g = c.getContext('2d');
    const SX = BOUNDS.maxX - BOUNDS.minX, SZ = BOUNDS.maxZ - BOUNDS.minZ;
    const toPx = (x) => ((x - BOUNDS.minX) / SX) * T;
    const toPy = (z) => ((z - BOUNDS.minZ) / SZ) * T;
    const mPx = T / SX; // بكسل لكل متر
    const S = this.soil;
    const rnd = mulberry32((this.def.seed || 1) * 7 + 3);
    const col = (a, k = 1) => `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${k})`;
    const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

    // 1) طبقة أساس منخفضة الدقة
    const L = 320;
    const lc = makeCanvas(L);
    const lg = lc.getContext('2d');
    const img = lg.createImageData(L, L);
    const n3 = makeNoise2D((this.def.seed || 1) + 55);
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      const wx = BOUNDS.minX + (x + 0.5) / L * SX, wz = BOUNDS.minZ + (y + 0.5) / L * SZ;
      const h = this._sampleGrid(wx, wz);
      const hx = this._sampleGrid(wx + 20, wz) - h, hz = this._sampleGrid(wx, wz + 20) - h;
      const slope = Math.sqrt(hx * hx + hz * hz) / 20;
      const nn = fbm(n3, wx / 700, wz / 700, 4);
      let cc = mix(S.base, S.base2, clamp(0.5 + nn, 0, 1));
      cc = mix(cc, S.green2, clamp(0.25 + fbm(n3, wx / 1500 + 9, wz / 1500, 3), 0, 0.6));
      const rockT = clamp(slope * 2.2 + (h - 40) / 160, 0, 1) * (0.4 + (this.def.rock ?? 0.3));
      cc = mix(cc, S.rock, clamp(rockT, 0, 0.92));
      const p = (y * L + x) * 4;
      img.data[p] = cc[0]; img.data[p + 1] = cc[1]; img.data[p + 2] = cc[2]; img.data[p + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(lc, 0, 0, T, T);

    const villages = this.layout.villages || [];
    const inVillage = (x, z, pad = 0) => villages.some((v) => Math.hypot(x - v.x, z - v.z) < v.r + pad);
    const steep = (x, z) => {
      const h = this._sampleGrid(x, z);
      const s = Math.abs(this._sampleGrid(x + 30, z) - h) + Math.abs(this._sampleGrid(x, z + 30) - h);
      return s > 9 || h > 70;
    };

    // 2) الحقول الزراعية
    const crops = [S.green, S.green2, S.plough, S.dry, S.base2, S.green, S.plough];
    const zone = 650;
    for (let zx = BOUNDS.minX; zx < BOUNDS.maxX; zx += zone) for (let zz = BOUNDS.minZ; zz < BOUNDS.maxZ; zz += zone) {
      const ang = (rnd() - 0.5) * 0.9;
      const cx = zx + zone / 2, cz = zz + zone / 2;
      g.save();
      g.translate(toPx(cx), toPy(cz));
      g.rotate(ang);
      let y = -zone * 0.62;
      while (y < zone * 0.62) {
        const depth = 40 + rnd() * 120;
        let x = -zone * 0.62;
        while (x < zone * 0.62) {
          const w = 25 + rnd() * 70;
          const wx = cx + Math.cos(ang) * (x + w / 2) - Math.sin(ang) * (y + depth / 2);
          const wz = cz + Math.sin(ang) * (x + w / 2) + Math.cos(ang) * (y + depth / 2);
          if (!inVillage(wx, wz, 40) && !steep(wx, wz) && this.riverDist(wx, wz) > 40) {
            const cr = crops[Math.floor(rnd() * crops.length)];
            const shade = 0.88 + rnd() * 0.22;
            g.fillStyle = col([cr[0] * shade, cr[1] * shade, cr[2] * shade], 0.55 + rnd() * 0.35);
            g.fillRect(x * mPx, y * mPx, w * mPx, depth * mPx);
            // خطوط الحراثة
            if (T >= 2048 && rnd() < 0.7) {
              g.fillStyle = 'rgba(0,0,0,0.07)';
              const step = Math.max(1.5, 4 * mPx);
              for (let k = 0; k < w * mPx; k += step) g.fillRect(x * mPx + k, y * mPx, Math.max(0.6, mPx * 0.8), depth * mPx);
            }
            g.strokeStyle = 'rgba(60,55,35,0.22)';
            g.lineWidth = Math.max(0.6, 1.2 * mPx);
            g.strokeRect(x * mPx, y * mPx, w * mPx, depth * mPx);
          }
          x += w;
        }
        y += depth;
      }
      g.restore();
    }

    // 3) بساتين الزيتون
    this.groveTrees = [];
    const groves = [...(this.layout.groves || [])];
    for (let k = 0; k < 10; k++) {
      const x = (rnd() - 0.5) * 6000, z = -300 - rnd() * 4400;
      if (!inVillage(x, z, 80) && !steep(x, z) && this.riverDist(x, z) > 80 && !(Math.abs(x) < 300 && z > -500)) groves.push({ x, z, w: 200 + rnd() * 300, d: 150 + rnd() * 200, rot: rnd() - 0.5 });
    }
    for (const gr of groves) {
      g.save();
      g.translate(toPx(gr.x), toPy(gr.z));
      g.rotate(gr.rot || 0);
      g.fillStyle = col(mix(S.base, S.plough, 0.5), 0.85);
      g.fillRect(-gr.w / 2 * mPx, -gr.d / 2 * mPx, gr.w * mPx, gr.d * mPx);
      const sp = 8;
      for (let a = -gr.w / 2 + sp / 2; a < gr.w / 2; a += sp) for (let b = -gr.d / 2 + sp / 2; b < gr.d / 2; b += sp) {
        const jx = a + (rnd() - 0.5) * 2, jz = b + (rnd() - 0.5) * 2;
        g.fillStyle = 'rgba(52,64,34,0.85)';
        g.beginPath(); g.arc(jx * mPx, jz * mPx, Math.max(0.8, 2.6 * mPx), 0, Math.PI * 2); g.fill();
        const cs = Math.cos(gr.rot || 0), sn = Math.sin(gr.rot || 0);
        const wx = gr.x + jx * cs - jz * sn, wz = gr.z + jx * sn + jz * cs;
        if (!this.isOnRoad(wx, wz, 4)) this.groveTrees.push([wx, wz]);
      }
      g.restore();
    }

    // 4) القرى: بقع غبار
    for (const v of villages) {
      const gr = g.createRadialGradient(toPx(v.x), toPy(v.z), 0, toPx(v.x), toPy(v.z), v.r * 1.15 * mPx);
      const dust = v.style === 'city' || v.style === 'industrial' ? [150, 145, 138] : mix(S.dry, [200, 190, 170], 0.5);
      gr.addColorStop(0, col(dust, 0.85));
      gr.addColorStop(0.75, col(dust, 0.55));
      gr.addColorStop(1, col(dust, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(toPx(v.x), toPy(v.z), v.r * 1.15 * mPx, 0, Math.PI * 2); g.fill();
    }

    // 5) النهر
    if (this.river) {
      const r = this.river;
      const strokePath = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(toPx(p[0]), toPy(p[1])) : g.moveTo(toPx(p[0]), toPy(p[1])))); g.stroke(); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(58,76,38,0.9)'; g.lineWidth = (r.width + 50) * mPx; strokePath(r.res);
      g.strokeStyle = 'rgba(40,60,58,1)'; g.lineWidth = (r.width + 8) * mPx; strokePath(r.res);
      if (r.lake) {
        g.fillStyle = 'rgba(58,76,38,0.9)'; g.beginPath(); g.arc(toPx(r.lake.x), toPy(r.lake.z), (r.lake.r + 25) * mPx, 0, 7); g.fill();
        g.fillStyle = 'rgba(40,60,58,1)'; g.beginPath(); g.arc(toPx(r.lake.x), toPy(r.lake.z), (r.lake.r + 4) * mPx, 0, 7); g.fill();
      }
    }

    // 6) الطرق
    g.lineCap = 'round'; g.lineJoin = 'round';
    const path = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(toPx(p[0]), toPy(p[1])) : g.moveTo(toPx(p[0]), toPy(p[1])))); };
    for (const r of this.roads) {
      path(r.pts);
      if (r.type === 'track') {
        g.strokeStyle = col(mix(S.dry, [210, 195, 160], 0.4), 0.85); g.lineWidth = (r.w + 3) * mPx; g.stroke();
        continue;
      }
      g.strokeStyle = 'rgba(190,176,148,0.75)'; g.lineWidth = (r.w + 10) * mPx; g.stroke();
      g.strokeStyle = r.type === 'highway' ? '#3e3c3a' : '#56534e'; g.lineWidth = r.w * mPx; g.stroke();
      if (r.type === 'highway') {
        g.strokeStyle = 'rgba(120,108,80,0.95)'; g.lineWidth = Math.max(1, 2.4 * mPx); g.stroke();
        if (T >= 2048) {
          g.setLineDash([6 * mPx, 9 * mPx]);
          g.strokeStyle = 'rgba(230,230,220,0.5)'; g.lineWidth = Math.max(0.5, 0.3 * mPx);
          for (const off of [-r.w / 4, r.w / 4]) {
            g.beginPath();
            r.pts.forEach((p, i) => {
              const q = r.pts[Math.min(i + 1, r.pts.length - 1)], o = r.pts[Math.max(i - 1, 0)];
              const dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1;
              const x = p[0] - dz / l * off, z = p[1] + dx / l * off;
              if (i) g.lineTo(toPx(x), toPy(z)); else g.moveTo(toPx(x), toPy(z));
            });
            g.stroke();
          }
          g.setLineDash([]);
        }
      }
    }

    // 7) آثار الحرب: حفر وحرائق
    for (let k = 0; k < 220; k++) {
      const x = (rnd() - 0.5) * 6400, z = -150 - rnd() * 4800;
      const rr = (2 + rnd() * 6) * mPx;
      const gr = g.createRadialGradient(toPx(x), toPy(z), 0, toPx(x), toPy(z), rr * 2.2);
      gr.addColorStop(0, 'rgba(25,20,16,0.75)');
      gr.addColorStop(0.45, 'rgba(45,38,30,0.45)');
      gr.addColorStop(0.7, 'rgba(190,175,150,0.3)');
      gr.addColorStop(1, 'rgba(190,175,150,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(toPx(x), toPy(z), rr * 2.2, 0, 7); g.fill();
    }
    for (let k = 0; k < 30; k++) {
      const x = (rnd() - 0.5) * 6000, z = -300 - rnd() * 4400;
      const rr = (20 + rnd() * 50) * mPx;
      const gr = g.createRadialGradient(toPx(x), toPy(z), 0, toPx(x), toPy(z), rr);
      gr.addColorStop(0, 'rgba(30,26,22,0.45)');
      gr.addColorStop(1, 'rgba(30,26,22,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(toPx(x), toPy(z), rr, 0, 7); g.fill();
    }

    // 8) أرض موقع اللاعب (تراب محفور)
    const pg = g.createRadialGradient(toPx(0), toPy(0), 0, toPx(0), toPy(0), 60 * mPx);
    pg.addColorStop(0, col(mix(S.base, [120, 100, 80], 0.5), 0.95));
    pg.addColorStop(1, col(S.base, 0));
    g.fillStyle = pg; g.beginPath(); g.arc(toPx(0), toPy(0), 60 * mPx, 0, 7); g.fill();

    return c;
  }

  thermalTexture() {
    if (this._thermalTex) return this._thermalTex;
    const src = this.canvas;
    const T = 1024;
    const c = makeCanvas(T);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, T, T);
    const img = g.getImageData(0, 0, T, T);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const lum = (r * 0.3 + gg * 0.55 + b * 0.15) / 255;
      const isRoad = Math.abs(r - gg) < 8 && Math.abs(gg - b) < 10 && lum < 0.3;
      const isWater = b > r && b > gg - 6 && lum < 0.3;
      let v = this.night ? 0.16 + (1 - lum) * 0.16 : 0.14 + lum * 0.32;
      if (isRoad) v = this.night ? 0.42 : 0.36;
      if (isWater) v = 0.06;
      d[i] = d[i + 1] = d[i + 2] = Math.min(255, v * 255);
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this._thermalTex = t;
    return t;
  }

  _buildWater() {
    this.water = null;
    if (!this.river) return;
    const r = this.river;
    const pts = r.res;
    const w = r.width / 2 + 10;
    const pos = [], idx = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[Math.min(k + 1, pts.length - 1)], o = pts[Math.max(k - 1, 0)];
      const dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l, nz = dx / l;
      pos.push(p[0] + nx * w, r.level, p[1] + nz * w, p[0] - nx * w, r.level, p[1] - nz * w);
      if (k < pts.length - 1) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c4848, roughness: 0.08, metalness: 0.35, envMapIntensity: 1.2 });
    mat.side = THREE.DoubleSide;
    const group = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    m.userData.heat = 0.06;
    m.receiveShadow = true;
    group.add(m);
    if (r.lake) {
      const lk = new THREE.Mesh(new THREE.CircleGeometry(r.lake.r + 20, 48), mat);
      lk.rotation.x = -Math.PI / 2;
      lk.position.set(r.lake.x, r.level, r.lake.z);
      lk.userData.heat = 0.06;
      group.add(lk);
    }
    this.water = group;
    this.waterMat = mat;
  }

  _buildHorizon() {
    // أرض بعيدة تمتد إلى الأفق مع جبال
    const group = new THREE.Group();
    const avg = this.soil.base2;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3000, 40000, 64, 1),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(`rgb(${avg[0] - 20},${avg[1] - 15},${avg[2] - 10})`) }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, -6.5, -1800);
    ring.userData.heat = 0.15;
    group.add(ring);
    // سلاسل جبلية بعيدة
    const rnd = mulberry32((this.def.seed || 1) + 999);
    const mtnMat = new THREE.MeshLambertMaterial({ color: 0x7d7b74, flatShading: true });
    const n = makeNoise2D((this.def.seed || 1) + 4);
    const segs = 180;
    const pos = [], idx = [];
    const R1 = 9000, R2 = 12500;
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      const facing = Math.cos(a - Math.PI) * 0.5 + 0.5; // أعلى في الأمام
      const hh = (180 + 520 * Math.max(0, fbm(n, a * 3, 1.3, 4) + 0.25)) * (0.45 + facing * 0.8) * (0.7 + rnd() * 0.3);
      const x1 = Math.sin(a) * R1, z1 = -Math.cos(a) * R1 - 1800;
      const x2 = Math.sin(a) * R2, z2 = -Math.cos(a) * R2 - 1800;
      pos.push(x1, -10, z1, (x1 + x2) / 2, hh, (z1 + z2) / 2, x2, hh * 0.5, z2);
      if (k < segs) {
        const b = k * 3;
        idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mtn = new THREE.Mesh(geo, mtnMat);
    mtn.userData.heat = 0.1;
    group.add(mtn);
    this.horizon = group;
  }

  // تقاطع قطعة مستقيمة مع الأرض — يعيد نقطة أو null
  segmentHit(p0, p1, out = new THREE.Vector3()) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.max(1, Math.ceil(len / 2));
    let prevT = 0, prevD = p0.y - this.groundAt(p0.x, p0.z);
    if (prevD < 0) return out.copy(p0);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = p0.x + dx * t, y = p0.y + dy * t, z = p0.z + dz * t;
      const d = y - this.groundAt(x, z);
      if (d <= 0) {
        const f = prevD / (prevD - d);
        const tt = prevT + (t - prevT) * f;
        return out.set(p0.x + dx * tt, p0.y + dy * tt, p0.z + dz * tt);
      }
      prevT = t; prevD = d;
    }
    return null;
  }

  // تقاطع شعاع طويل (لمقياس المدى)
  rayHit(origin, dir, maxDist = 6000, out = new THREE.Vector3()) {
    let t = 0, step = 1.5;
    let prev = origin.y - this.groundAt(origin.x, origin.z);
    while (t < maxDist) {
      const nt = t + step;
      const x = origin.x + dir.x * nt, y = origin.y + dir.y * nt, z = origin.z + dir.z * nt;
      const d = y - this.groundAt(x, z);
      if (d <= 0) {
        const f = prev / (prev - d);
        const tt = t + step * f;
        out.set(origin.x + dir.x * tt, origin.y + dir.y * tt, origin.z + dir.z * tt);
        return { point: out, dist: tt };
      }
      prev = d; t = nt;
      step = Math.min(12, 1.5 + t * 0.01);
    }
    return null;
  }
}
