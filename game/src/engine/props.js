// المباني والأشجار والمعالم — هندسة مدمجة لتقليل نداءات الرسم
import * as THREE from 'three';
import { mulberry32, lerp, clamp } from '../core/util.js';
import { facadeTexture, ablaqTexture, runwayTexture, grassTexture, flagTexture } from './textures.js';

const ROOF_UV = [0.125, 0.875];

// هل النقطة تحجب خط الرؤية بين اللاعب (0,0) وأحد مواقع الأهداف؟
export function blocksSight(x, z, anchors, width = 30) {
  if (!anchors) return false;
  for (const a of anchors) {
    const ax = a[0], az = a[1];
    const l2 = ax * ax + az * az || 1;
    const t = (x * ax + z * az) / l2;
    if (t < 0.05 || t > 1.02) continue;
    const dx = x - ax * t, dz = z - az * t;
    if (dx * dx + dz * dz < width * width) return true;
  }
  return false;
}
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

// باني هندسة مدمجة بألوان الرؤوس وإحداثيات UV بالمتر
export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }

  _push(p, n, u, c) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u[0], u[1]);
    this.col.push(c.r, c.g, c.b);
  }

  // صندوق مدوّر حول Y مع UV للواجهات (tile = 12م لكل تكرار)
  box(cx, cy, cz, w, h, d, rotY, color, facade = true) {
    const col = color instanceof THREE.Color ? color : _c.set(color).clone();
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    const hw = w / 2, hd = d / 2;
    const P = (lx, ly, lz) => new THREE.Vector3(cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs);
    const N = (nx, ny, nz) => new THREE.Vector3(nx * cs + nz * sn, ny, -nx * sn + nz * cs);
    const faces = [
      // [corners (ccw from outside), normal, uLen, isWall]
      [[[-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd]], [0, 0, 1], w, true],
      [[[hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd]], [0, 0, -1], w, true],
      [[[hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd]], [1, 0, 0], d, true],
      [[[-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd]], [-1, 0, 0], d, true],
      [[[-hw, h, hd], [hw, h, hd], [hw, h, -hd], [-hw, h, -hd]], [0, 1, 0], 0, false],
    ];
    for (const [cr, nn, ulen, wall] of faces) {
      const n = N(...nn);
      const pts = cr.map((c) => P(...c));
      let uvs;
      if (wall && facade) {
        const u1 = ulen / 12, v1 = h / 12;
        uvs = [[0, 0], [u1, 0], [u1, v1], [0, v1]];
      } else uvs = [ROOF_UV, ROOF_UV, ROOF_UV, ROOF_UV];
      const shade = wall ? 1 : 0.92;
      const cc = col.clone().multiplyScalar(shade);
      for (const k of [0, 1, 2, 0, 2, 3]) this._push(pts[k], n, uvs[k], cc);
    }
  }

  // إضافة أي هندسة Three مع مصفوفة تحويل ولون
  geom(geo, matrix, color, uvMode = 'roof') {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const col = color instanceof THREE.Color ? color : new THREE.Color(color);
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      nn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      const u = uvMode === 'uv' && uv ? [uv.getX(i), uv.getY(i)] : ROOF_UV;
      this._push(v, nn, u, col);
    }
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    return geo;
  }

  get empty() { return this.pos.length === 0; }
}

function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _q.setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

const HOUSE_COLORS = ['#d8ccb4', '#cfc3aa', '#bfb7a6', '#e3dccb', '#c9b89a', '#a9a196', '#ece8df', '#d4c7a8', '#b8ad98'];

let _buildingMat = null;
export function buildingMaterial() {
  if (!_buildingMat) {
    _buildingMat = new THREE.MeshStandardMaterial({ map: facadeTexture(), vertexColors: true, roughness: 0.92, metalness: 0 });
  }
  return _buildingMat;
}

// منزل سوري نموذجي: سطح مستوٍ، درابزين، خزانات مياه، أعمدة حديد غير مكتملة
function addHouse(B, x, y, z, w, d, floors, rot, rnd, style, damaged) {
  const colr = new THREE.Color(HOUSE_COLORS[Math.floor(rnd() * HOUSE_COLORS.length)]);
  colr.multiplyScalar(0.92 + rnd() * 0.12);
  const fh = 3;
  let H = floors * fh + 0.4;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const L = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  if (damaged) {
    // مبنى منهار جزئياً
    const keep = Math.max(1, floors - 1 - Math.floor(rnd() * 2));
    H = keep * fh;
    B.box(x, y - 1, z, w, H + 1, d, rot, colr);
    // كتلة مائلة من السقف المنهار
    const [ax, az] = L(w * 0.15, d * 0.1);
    B.geom(new THREE.BoxGeometry(w * 0.7, 0.35, d * 0.6), mat4(ax, y + H + 0.4, az, rot + 0.2, 1, 1, 1, 0.35, 0.2), colr.clone().multiplyScalar(0.8));
    // أنقاض
    for (let k = 0; k < 6; k++) {
      const [rx, rz] = L((rnd() - 0.5) * w * 1.4, d / 2 + rnd() * 4);
      const s = 0.8 + rnd() * 2;
      B.geom(new THREE.BoxGeometry(s, s * 0.6, s * 0.8), mat4(rx, y + s * 0.15, rz, rnd() * 3, 1, 1, 1, rnd(), rnd()), colr.clone().multiplyScalar(0.7 + rnd() * 0.2));
    }
    // أعمدة حديد مكشوفة
    for (let k = 0; k < 4; k++) {
      const [rx, rz] = L((k % 2 ? 1 : -1) * (w / 2 - 0.3), (k < 2 ? 1 : -1) * (d / 2 - 0.3));
      B.geom(new THREE.BoxGeometry(0.06, 1.6, 0.06), mat4(rx, y + H + 0.8, rz, 0, 1, 1, 1, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4), '#3a2d22');
    }
    return H;
  }
  B.box(x, y - 1, z, w, H + 1, d, rot, colr);
  // بلكون بارز
  if (floors > 1 && rnd() < 0.5) {
    const [bx, bz] = L(0, d / 2 + 0.6);
    for (let f = 1; f < floors; f++) B.box(bx, y + f * fh - 0.1, bz, w * 0.6, 0.18, 1.2, rot, colr, false);
  }
  // درابزين السطح
  const ph = 0.9, pt = 0.2;
  const top = y + H;
  if (rnd() < 0.8) {
    const [p1x, p1z] = L(0, d / 2 - pt / 2); B.box(p1x, top, p1z, w, ph, pt, rot, colr, false);
    const [p2x, p2z] = L(0, -d / 2 + pt / 2); B.box(p2x, top, p2z, w, ph, pt, rot, colr, false);
    const [p3x, p3z] = L(w / 2 - pt / 2, 0); B.box(p3x, top, p3z, pt, ph, d, rot, colr, false);
    const [p4x, p4z] = L(-w / 2 + pt / 2, 0); B.box(p4x, top, p4z, pt, ph, d, rot, colr, false);
  }
  // غرفة الدرج
  if (rnd() < 0.6) {
    const [sx, sz] = L(w / 2 - 2, -d / 2 + 2);
    B.box(sx, top, sz, 3, 2.6, 3, rot, colr);
  }
  // خزانات مياه
  const tanks = Math.floor(rnd() * 3);
  for (let k = 0; k < tanks; k++) {
    const [tx, tz] = L((rnd() - 0.5) * (w - 3), (rnd() - 0.5) * (d - 3));
    const white = rnd() < 0.5;
    B.geom(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 10), mat4(tx, top + 0.65, tz), white ? '#e8e8e2' : '#202020');
  }
  // صحن لاقط
  if (rnd() < 0.4) {
    const [dx, dz] = L((rnd() - 0.5) * (w - 2), d / 2 - 1);
    B.geom(new THREE.CylinderGeometry(0.5, 0.15, 0.15, 12), mat4(dx, top + 1.1, dz, rnd() * 6, 1, 1, 1, 1.0, 0), '#d9d9d4');
  }
  // أعمدة حديد لطابق غير مكتمل (سمة العمارة الشعبية)
  if (style !== 'city' && rnd() < 0.45) {
    for (let k = 0; k < 4; k++) {
      const [rx, rz] = L((k % 2 ? 1 : -1) * (w / 2 - 0.4), (k < 2 ? 1 : -1) * (d / 2 - 0.4));
      B.geom(new THREE.BoxGeometry(0.35, 1.2, 0.35), mat4(rx, top + 0.6, rz, rot), '#a39d92');
      B.geom(new THREE.BoxGeometry(0.05, 1.4, 0.05), mat4(rx, top + 1.8, rz, rot), '#4a3326');
    }
  }
  return H;
}

function addMosque(B, x, y, z, rot, rnd, scale = 1) {
  const s = scale;
  const wall = new THREE.Color('#e7e0cf');
  B.box(x, y - 1, z, 18 * s, 8 * s, 14 * s, rot, wall);
  const domeCol = rnd() < 0.5 ? '#3f8f5a' : '#b9bcc0';
  B.geom(new THREE.CylinderGeometry(4.2 * s, 4.2 * s, 1.5 * s, 16), mat4(x, y + 7.75 * s, z, rot), wall);
  B.geom(new THREE.SphereGeometry(4.5 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat4(x, y + 8.4 * s, z, rot), domeCol);
  B.geom(new THREE.ConeGeometry(0.15 * s, 2 * s, 6), mat4(x, y + 13.6 * s, z, rot), '#c8a447');
  // المئذنة
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const mx = x + 9 * s * cs + 5 * s * sn, mz = z - 9 * s * sn + 5 * s * cs;
  B.geom(new THREE.CylinderGeometry(1.4 * s, 1.6 * s, 26 * s, 8), mat4(mx, y + 12 * s, mz), wall);
  B.geom(new THREE.CylinderGeometry(2.2 * s, 1.6 * s, 1.2 * s, 8), mat4(mx, y + 22 * s, mz), wall);
  B.geom(new THREE.CylinderGeometry(1.1 * s, 1.1 * s, 4 * s, 8), mat4(mx, y + 25.5 * s, mz), wall);
  B.geom(new THREE.ConeGeometry(1.3 * s, 4 * s, 8), mat4(mx, y + 29.5 * s, mz), domeCol);
  B.geom(new THREE.SphereGeometry(0.35 * s, 8, 6), mat4(mx, y + 31.8 * s, mz), '#c8a447');
}

// بناء قرية/بلدة/مدينة
export function buildSettlement(terrain, v, seed, anchors = null) {
  const rnd = mulberry32(seed);
  const B = new GeoBuilder();
  const colliders = [];
  const rooftops = [];
  const style = v.style || 'village';
  const ang = rnd() * Math.PI;
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const lot = style === 'city' ? 26 : style === 'industrial' ? 44 : style === 'town' ? 22 : 20;
  const N = Math.ceil((v.r * 2) / lot);
  let count = 0;
  const limit = v.n || 30;
  const cells = [];
  const hN = Math.floor(N / 2);
  for (let a = -hN; a <= hN; a++) for (let b = -hN; b <= hN; b++) cells.push([a, b]);
  // الأقرب للمركز أولاً
  cells.sort((p, q) => (p[0] * p[0] + p[1] * p[1]) - (q[0] * q[0] + q[1] * q[1]) + (rnd() - 0.5) * 6);
  if (v.mosque) {
    const gy = terrain.heightAt(v.x, v.z);
    addMosque(B, v.x, gy, v.z, ang, rnd, style === 'city' ? 1.4 : 1);
    colliders.push(new THREE.Box3(new THREE.Vector3(v.x - 14, gy - 2, v.z - 14), new THREE.Vector3(v.x + 14, gy + 30, v.z + 14)));
  }
  for (const [a, b] of cells) {
    if (count >= limit) break;
    if ((Math.abs(a) % 4 === 3) || (Math.abs(b) % 5 === 4)) continue; // شوارع
    const lx = a * lot + (rnd() - 0.5) * 4, lz = b * lot + (rnd() - 0.5) * 4;
    const x = v.x + lx * cs + lz * sn, z = v.z - lx * sn + lz * cs;
    const dist = Math.hypot(x - v.x, z - v.z);
    if (dist > v.r * (0.75 + rnd() * 0.35)) continue;
    if (v.mosque && dist < 18) continue;
    if (terrain.isOnRoad(x, z, lot * 0.45)) continue;
    if (terrain.riverDist(x, z) < 20) continue;
    if (Math.hypot(x, z) < 160) continue;
    if (anchors && anchors.some((a) => Math.hypot(x - a[0], z - a[1]) < 34)) continue;
    if (blocksSight(x, z, anchors, 16)) continue;
    let w, d, floors;
    if (style === 'city') {
      const core = 1 - dist / v.r;
      w = 13 + rnd() * 9; d = 12 + rnd() * 9;
      floors = 2 + Math.floor(rnd() * 3 + core * 5);
    } else if (style === 'industrial') {
      w = 22 + rnd() * 18; d = 16 + rnd() * 18; floors = 1;
    } else if (style === 'town') {
      w = 10 + rnd() * 6; d = 10 + rnd() * 6; floors = 1 + Math.floor(rnd() * 3.3);
    } else {
      w = 8 + rnd() * 6; d = 8 + rnd() * 6; floors = 1 + Math.floor(rnd() * 2.2);
    }
    const rot = ang + (rnd() - 0.5) * 0.08;
    const hs = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([px, pz]) => terrain.heightAt(x + px * Math.cos(rot) + pz * Math.sin(rot), z - px * Math.sin(rot) + pz * Math.cos(rot)));
    const y = Math.min(...hs);
    if (Math.max(...hs) - y > 6) continue;
    const damaged = rnd() < (v.damage || 0) * 0.6;
    let H;
    if (style === 'industrial') {
      const colr = new THREE.Color(rnd() < 0.5 ? '#9a9890' : '#b3aa96');
      H = 6 + rnd() * 3;
      B.box(x, y - 1, z, w, H + 1, d, rot, colr, false);
      B.geom(new THREE.CylinderGeometry(d / 2, d / 2, w, 12, 1, false, 0, Math.PI), mat4(x, y + H, z, rot, 0.25, 1, 1, 0, Math.PI / 2), '#8a8d8f');
      if (rnd() < 0.3) B.geom(new THREE.CylinderGeometry(0.8, 1, 18, 8), mat4(x + w / 2, y + 9, z), '#7a6e62');
    } else {
      H = addHouse(B, x, y, z, w, d, floors, rot, rnd, style, damaged);
    }
    const r = Math.max(w, d) * 0.72;
    colliders.push(new THREE.Box3(new THREE.Vector3(x - r, y - 2, z - r), new THREE.Vector3(x + r, y + H + 1, z + r)));
    rooftops.push([x, y + H, z]);
    count++;
  }
  const mesh = new THREE.Mesh(B.build(), buildingMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.heat = 0.3;
  return { mesh, colliders, rooftops };
}

// ===== الأشجار =====
function olvCanopyGeo() {
  const parts = [];
  const rnd = mulberry32(7);
  for (let k = 0; k < 4; k++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f = 0.8 + rnd() * 0.4;
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.8, p.getZ(i) * f);
    }
    g.translate((rnd() - 0.5) * 1.1, (rnd() - 0.3) * 0.6, (rnd() - 0.5) * 1.1);
    parts.push(g);
  }
  const B = new GeoBuilder();
  for (const g of parts) B.geom(g, new THREE.Matrix4(), '#ffffff');
  const geo = B.build();
  geo.deleteAttribute('color');
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  return geo;
}

export function buildTrees(terrain, layout, quality, seed) {
  const rnd = mulberry32(seed);
  const maxOlive = quality === 'low' ? 900 : quality === 'high' ? 4200 : 2400;
  const anchors = Object.values(layout.anchors || {});
  const clear = (x, z, w = 28) => !blocksSight(x, z, anchors, w) && !anchors.some((a) => Math.hypot(x - a[0], z - a[1]) < 30);
  // مخروط أمامي مفتوح نسبياً لرؤية الطرق
  const frontCone = (x, z) => z < -150 && Math.abs(Math.atan2(x, -z)) < 0.45;
  const pts = [];
  for (const [x, z] of terrain.groveTrees || []) {
    if (!clear(x, z)) continue;
    const d = Math.hypot(x, z);
    const keep = d < 900 ? 1 : d < 2000 ? 0.35 : 0.12;
    if (rnd() < keep && d > 40) pts.push([x, z, 'o']);
  }
  // أشجار متفرقة
  for (let k = 0; k < 500; k++) {
    const x = (rnd() - 0.5) * 6400, z = 600 - rnd() * 5800;
    if (Math.hypot(x, z) < 60 || terrain.isOnRoad(x, z, 6) || terrain.riverDist(x, z) < 6) continue;
    if (!clear(x, z) || (frontCone(x, z) && rnd() < 0.7)) continue;
    pts.push([x, z, rnd() < 0.7 ? 'o' : 'c']);
  }
  // صفوف أشجار على الطرق
  for (const r of terrain.roads) {
    if (r.type === 'track') continue;
    const side = r.w / 2 + 9;
    for (let i = 2; i < r.pts.length - 2; i += 2) {
      if (rnd() < 0.35) continue;
      const p = r.pts[i], q = r.pts[i + 1];
      const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
      for (const sgn of [-1, 1]) {
        const x = p[0] - dz / l * side * sgn, z = p[1] + dx / l * side * sgn;
        if (Math.hypot(x, z) < 80 || terrain.riverDist(x, z) < 6) continue;
        if (!clear(x, z, 40) || (frontCone(x, z) && rnd() < 0.75)) continue;
        pts.push([x, z, 'e']);
      }
    }
  }
  // أشجار حور على ضفاف النهر
  if (terrain.river) {
    const res = terrain.river.res;
    for (let i = 0; i < res.length; i += 1) {
      if (rnd() < 0.4) continue;
      const p = res[i], q = res[Math.min(i + 1, res.length - 1)];
      const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
      const off = terrain.river.width / 2 + 8 + rnd() * 14;
      const sgn = rnd() < 0.5 ? -1 : 1;
      pts.push([p[0] - dz / l * off * sgn, p[1] + dx / l * off * sgn, 'p']);
    }
  }
  // ترتيب حسب القرب من اللاعب ثم القص
  pts.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  const olives = [], cones = [], tall = [];
  for (const p of pts) {
    if (p[2] === 'o') { if (olives.length < maxOlive) olives.push(p); }
    else if (p[2] === 'c' || p[2] === 'p') { if (cones.length < maxOlive / 3) cones.push(p); }
    else if (tall.length < maxOlive / 3) tall.push(p);
  }

  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3d30, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: false });
  const canopy = olvCanopyGeo();
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.CylinderGeometry(0.15, 1, 1, 7);
  coneGeo.translate(0, 0.5, 0);
  const tallGeo = new THREE.IcosahedronGeometry(1, 1);

  const mk = (geo, mat, n) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    im.castShadow = true; im.receiveShadow = true;
    im.count = n;
    return im;
  };
  const olvC = mk(canopy, leafMat, olives.length);
  const olvT = mk(trunkGeo, trunkMat, olives.length + tall.length);
  const cone = mk(coneGeo, leafMat, cones.length);
  const tallC = mk(tallGeo, leafMat, tall.length);
  olvC.userData.heat = 0.24; cone.userData.heat = 0.22; tallC.userData.heat = 0.22; olvT.userData.heat = 0.26;
  const colliders = [];
  olives.forEach(([x, z], i) => {
    const y = terrain.heightAt(x, z);
    const s = 1.6 + rnd() * 1.2;
    const ry = rnd() * 6.28;
    _q.setFromAxisAngle(_v.set(0, 1, 0), ry);
    _m.compose(_v.set(x, y + 1.3 + s * 0.6, z), _q, _s.set(s, s * 0.9, s));
    olvC.setMatrixAt(i, _m);
    olvC.setColorAt(i, _c.setHSL(0.2 + rnd() * 0.04, 0.22 + rnd() * 0.1, 0.22 + rnd() * 0.08));
    _m.compose(_v.set(x, y, z), _q, _s.set(1 + s * 0.3, 1.6 + s * 0.3, 1 + s * 0.3));
    olvT.setMatrixAt(i, _m);
    if (Math.hypot(x, z) < 2600) colliders.push([x, y, z, s * 1.1, y + 2.5 + s * 1.4]);
  });
  cones.forEach(([x, z, k], i) => {
    const y = terrain.heightAt(x, z);
    const h = k === 'p' ? 14 + rnd() * 8 : 9 + rnd() * 6;
    const r = k === 'p' ? 2.2 : 1.6;
    _q.identity();
    _m.compose(_v.set(x, y, z), _q, _s.set(r, h, r));
    cone.setMatrixAt(i, _m);
    cone.setColorAt(i, _c.setHSL(0.27 + rnd() * 0.04, 0.3, k === 'p' ? 0.26 : 0.15));
  });
  tall.forEach(([x, z], i) => {
    const y = terrain.heightAt(x, z);
    const h = 10 + rnd() * 7, s = 2.6 + rnd() * 1.8;
    _q.setFromAxisAngle(_v.set(0, 1, 0), rnd() * 6);
    _m.compose(_v.set(x, y + h, z), _q, _s.set(s, s * 1.4, s));
    tallC.setMatrixAt(i, _m);
    tallC.setColorAt(i, _c.setHSL(0.18 + rnd() * 0.05, 0.16, 0.3 + rnd() * 0.06));
    _m.compose(_v.set(x, y, z), _q, _s.set(1.2, h, 1.2));
    olvT.setMatrixAt(olives.length + i, _m);
  });
  for (const im of [olvC, olvT, cone, tallC]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
  group.add(olvC, olvT, cone, tallC);
  return { group, colliders };
}

// ===== عشب وقمح قريب يتمايل مع الريح =====
export function buildGrass(terrain, quality, timeUniform) {
  const count = quality === 'low' ? 0 : quality === 'high' ? 9000 : 4500;
  if (!count) return null;
  const geo = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI / 2;
    const cx = Math.cos(a) * 0.6, cz = Math.sin(a) * 0.6;
    const b = k * 4;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // اجعل النورمال للأعلى لإضاءة أنعم
  const nrm = geo.attributes.normal;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  const mat = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        float sway = sin(uTime * 1.7 + ip.x * 0.13 + ip.z * 0.09) * 0.5 + sin(uTime * 3.1 + ip.x * 0.4) * 0.2;
        transformed.x += sway * uv.y * uv.y * 0.35;
        transformed.z += sway * uv.y * uv.y * 0.18;`);
  };
  mat.customProgramCacheKey = () => 'grass-wind';
  const im = new THREE.InstancedMesh(geo, mat, count);
  const rnd = mulberry32(99);
  let n = 0;
  for (let k = 0; k < count * 3 && n < count; k++) {
    const ang = (rnd() - 0.5) * Math.PI * 1.4;
    const r = 4 + Math.pow(rnd(), 0.8) * 110;
    const x = Math.sin(ang) * r, z = -Math.cos(ang) * r;
    if (Math.hypot(x, z * 1.25) < 17) continue;
    if (terrain.isOnRoad(x, z, 2) || terrain.riverDist(x, z) < 2) continue;
    const y = terrain.heightAt(x, z);
    const s = 0.6 + rnd() * 0.9;
    _q.setFromAxisAngle(_v.set(0, 1, 0), rnd() * 6.28);
    _m.compose(_v.set(x, y - 0.05, z), _q, _s.set(s, s * (0.7 + rnd() * 0.8), s));
    im.setMatrixAt(n, _m);
    im.setColorAt(n, _c.setRGB(0.85 + rnd() * 0.2, 0.85 + rnd() * 0.2, 0.8 + rnd() * 0.15));
    n++;
  }
  im.count = n;
  im.receiveShadow = true;
  im.userData.heat = 0.2;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

// ===== موقع اللاعب: أكياس رمل وصناديق ذخيرة =====
export function buildPlayerPosition(terrain) {
  const B = new GeoBuilder();
  const y0 = terrain.heightAt(0, 0);
  const rnd = mulberry32(3);
  const bag = new THREE.CapsuleGeometry(0.16, 0.4, 4, 10);
  bag.rotateZ(Math.PI / 2);
  bag.scale(1, 0.62, 1.2);
  for (let row = 0; row < 3; row++) {
    const R = 2.9;
    const n = 26;
    for (let k = 0; k < n; k++) {
      const a = -1.25 + (k + (row % 2) * 0.5) / n * 2.5;
      const x = Math.sin(a) * R, z = -Math.cos(a) * R;
      const y = terrain.heightAt(x, z) + 0.1 + row * 0.2;
      const c = new THREE.Color().setHSL(0.09 + rnd() * 0.04, 0.18 + rnd() * 0.12, 0.28 + rnd() * 0.12);
      B.geom(bag, mat4(x, y, z, -a + Math.PI / 2 + (rnd() - 0.5) * 0.2), c);
    }
  }
  // صناديق صواريخ تاو احتياطية
  for (let k = 0; k < 4; k++) {
    const x = 2.6 + (k % 2) * 0.45, z = 1.2 + Math.floor(k / 2) * 0.05;
    B.geom(new THREE.CylinderGeometry(0.15, 0.15, 1.5, 10), mat4(x, terrain.heightAt(x, z) + 0.15 + Math.floor(k / 2) * 0.3, z, 0, 1, 1, 1, Math.PI / 2, 0), '#5d6248');
  }
  B.geom(new THREE.BoxGeometry(0.6, 0.35, 0.4), mat4(-2.2, y0 + 0.18, 1.4, 0.3), '#4c5138');
  B.geom(new THREE.BoxGeometry(0.4, 0.25, 0.3), mat4(-2.2, y0 + 0.48, 1.4, 0.1), '#3b3f2c');
  const mesh = new THREE.Mesh(B.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.heat = 0.32;
  return mesh;
}

// ===== المعالم =====
export function buildLandmark(terrain, lm, ctx) {
  const B = new GeoBuilder();
  const colliders = [];
  const extras = [];
  const H = (x, z) => terrain.heightAt(x, z);
  const rnd = mulberry32(Math.floor(lm.x * 7 + lm.z * 3) >>> 0);
  let animated = null;

  if (lm.type === 'base') {
    // قاعدة عسكرية: سواتر، هنغارات، ثكنات، أبراج
    const w = lm.w, d = lm.d;
    const berm = (x, z, len, rot) => {
      const shape = new THREE.Shape([new THREE.Vector2(-4, 0), new THREE.Vector2(4, 0), new THREE.Vector2(1.2, 3.2), new THREE.Vector2(-1.2, 3.2)]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
      g.translate(0, 0, -len / 2);
      B.geom(g, mat4(x, H(x, z) - 0.6, z, rot), '#8c6f52');
    };
    // الساتر الأمامي مخترق (جهة المهاجمين) — نبقي جزأين جانبيين قصيرين
    berm(lm.x - w * 0.38, lm.z + d / 2, w * 0.24, Math.PI / 2);
    berm(lm.x + w * 0.38, lm.z + d / 2, w * 0.24, Math.PI / 2);
    berm(lm.x, lm.z - d / 2, w, Math.PI / 2);
    berm(lm.x - w / 2, lm.z, d, 0);
    berm(lm.x + w / 2, lm.z, d, 0);
    for (let k = 0; k < 3; k++) {
      const x = lm.x - w / 3 + k * w / 3, z = lm.z - d / 4;
      const y = H(x, z);
      B.geom(new THREE.CylinderGeometry(11, 11, 34, 16, 1, false, 0, Math.PI), mat4(x, y, z, Math.PI / 2, 1, 1, 1, 0, Math.PI / 2), '#7e8384');
      colliders.push(new THREE.Box3(new THREE.Vector3(x - 12, y - 1, z - 17), new THREE.Vector3(x + 12, y + 11, z + 17)));
    }
    for (let k = 0; k < 4; k++) {
      const x = lm.x - w / 3 + k * w / 5, z = lm.z + d / 6;
      const y = H(x, z);
      B.box(x, y - 0.5, z, 40, 4.5, 10, 0.02, new THREE.Color('#c2b498'));
      colliders.push(new THREE.Box3(new THREE.Vector3(x - 21, y - 1, z - 6), new THREE.Vector3(x + 21, y + 4.5, z + 6)));
    }
    for (const [ox, oz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
      const x = lm.x + ox, z = lm.z + oz, y = H(x, z);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.geom(new THREE.BoxGeometry(0.25, 9, 0.25), mat4(x + lx, y + 4.5, z + lz), '#555');
      B.box(x, y + 9, z, 3.4, 2.6, 3.4, 0, new THREE.Color('#8d8b80'), false);
      B.geom(new THREE.ConeGeometry(2.8, 1.4, 4), mat4(x, y + 12.3, z, Math.PI / 4), '#5c5a52');
    }
    // خزانات وقود
    for (let k = 0; k < 3; k++) {
      const x = lm.x + w / 3 + k * 14, z = lm.z + d / 3, y = H(x, z);
      B.geom(new THREE.CylinderGeometry(5, 5, 8, 16), mat4(x, y + 4, z), '#bdbdb5');
    }
    // سارية علم النظام
    const fx = lm.x, fz = lm.z + d / 2 - 10;
    extras.push(makeFlag(fx, H(fx, fz), fz, 'regime'));
  }

  if (lm.type === 'interchange') {
    // جسر علوي فوق عقدة الطرق
    const y = H(lm.x, lm.z) + 7;
    B.box(lm.x, y, lm.z, 120, 1.2, 16, 0.7, new THREE.Color('#a7a196'), false);
    for (let k = -2; k <= 2; k++) {
      const x = lm.x + Math.cos(0.7) * k * 25, z = lm.z - Math.sin(0.7) * k * 25;
      B.geom(new THREE.BoxGeometry(2, 8, 10), mat4(x, H(x, z) + 3.5, z, 0.7), '#8f8a80');
    }
  }

  if (lm.type === 'citadel') {
    // قلعة حلب: تلة مكسوة بالحجر وأسوار وأبراج وبوابة
    const y = H(lm.x, lm.z);
    const stone = '#b9a581';
    B.geom(new THREE.CylinderGeometry(150, 230, 50, 40, 1), mat4(lm.x, y + 24, lm.z, 0, 1, 1, 0.78), '#a8936f');
    const top = y + 49;
    const ring = 40;
    for (let k = 0; k < ring; k++) {
      const a = (k / ring) * Math.PI * 2;
      const x = lm.x + Math.cos(a) * 146, z = lm.z + Math.sin(a) * 146 * 0.78;
      B.box(x, top, z, 25, 9, 3, -a + Math.PI / 2, new THREE.Color(stone), false);
      if (k % 5 === 0) B.geom(new THREE.BoxGeometry(11, 15, 11), mat4(x, top + 7, z, -a), stone);
    }
    // الكتلة الداخلية والمسجد
    B.box(lm.x - 30, top, lm.z + 10, 60, 10, 40, 0.1, new THREE.Color('#c6b48f'), false);
    B.geom(new THREE.CylinderGeometry(2, 2.4, 22, 8), mat4(lm.x + 30, top + 11, lm.z - 30), '#d2c3a2');
    // البوابة والجسر
    const gx = lm.x, gz = lm.z + 182;
    B.box(gx, y, gz + 60, 12, 8, 120, 0, new THREE.Color('#a8956f'), false);
    B.geom(new THREE.BoxGeometry(32, 34, 24), mat4(gx, y + 30, gz - 10), '#c0ab85');
    B.geom(new THREE.BoxGeometry(14, 22, 14), mat4(gx, y + 11, gz + 40), '#b8a37d');
    colliders.push(new THREE.Box3(new THREE.Vector3(lm.x - 230, y - 2, lm.z - 180), new THREE.Vector3(lm.x + 230, top + 20, lm.z + 200)));
  }

  if (lm.type === 'airport') {
    const y = H(lm.x, lm.z);
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(45, 2600), new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.9 }));
    rw.material.map.repeat.set(1, 6);
    rw.rotation.x = -Math.PI / 2;
    rw.rotation.z = Math.PI / 2 + (lm.rot || 0);
    rw.position.set(lm.x, y + 0.25, lm.z);
    rw.receiveShadow = true;
    rw.userData.heat = 0.4;
    extras.push(rw);
    for (let k = 0; k < 6; k++) {
      const x = lm.x - 600 + k * 130, z = lm.z - 160;
      const yy = H(x, z);
      B.geom(new THREE.CylinderGeometry(14, 14, 30, 16, 1, false, 0, Math.PI), mat4(x, yy, z, Math.PI / 2, 0.75, 1, 1, 0, Math.PI / 2), '#8b8f86');
      colliders.push(new THREE.Box3(new THREE.Vector3(x - 15, yy - 1, z - 16), new THREE.Vector3(x + 15, yy + 11, z + 16)));
    }
    const tx = lm.x + 300, tz = lm.z - 200, ty = H(tx, tz);
    B.box(tx, ty, tz, 6, 26, 6, 0, new THREE.Color('#d6cfbf'), true);
    B.geom(new THREE.CylinderGeometry(6, 5, 4, 8), mat4(tx, ty + 28, tz), '#2b3a44');
    colliders.push(new THREE.Box3(new THREE.Vector3(tx - 6, ty, tz - 6), new THREE.Vector3(tx + 6, ty + 30, tz + 6)));
  }

  if (lm.type === 'shrine') {
    const y = H(lm.x, lm.z);
    B.box(lm.x, y - 1, lm.z, 12, 6, 12, 0.3, new THREE.Color('#ddd5c2'));
    B.geom(new THREE.SphereGeometry(4.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat4(lm.x, y + 5, lm.z), '#3d8a55');
    for (let k = 0; k < 2; k++) {
      const x = lm.x + 20 + k * 12, z = lm.z - 10;
      B.geom(new THREE.CylinderGeometry(0.3, 0.6, 40, 4), mat4(x, H(x, z) + 20, z), '#9a9a9a');
    }
  }

  if (lm.type === 'noria') {
    // ناعورة حماة
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.95 });
    const R = 11;
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 6, 40), wood);
    const rim2 = rim.clone(); rim2.position.z = 1.4;
    wheel.add(rim, rim2);
    for (let k = 0; k < 16; k++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.25, R * 2, 0.25), wood);
      sp.rotation.z = (k / 16) * Math.PI;
      sp.position.z = 0.7;
      wheel.add(sp);
    }
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.6), wood);
      b.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.7);
      b.rotation.z = a;
      wheel.add(b);
    }
    const y = terrain.river ? terrain.river.level : H(lm.x, lm.z);
    wheel.position.set(0, R - 2.5, 0);
    g.add(wheel);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8a483, roughness: 1 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(3, R + 6, 4), wallMat);
    pier.position.set(-0.5, (R + 6) / 2 - 3, -2.5);
    const aq = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 40), wallMat);
    aq.position.set(0, R * 2 - 3, -20);
    g.add(pier, aq);
    g.position.set(lm.x, y, lm.z);
    g.rotation.y = 0.4;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.heat = 0.25; } });
    extras.push(g);
    animated = (dt) => { wheel.rotation.z -= dt * 0.25; };
  }

  if (lm.type === 'dam') {
    const y = terrain.river ? terrain.river.level : H(lm.x, lm.z);
    B.box(lm.x, y - 6, lm.z, 30, 22, 620, 0.05, new THREE.Color('#a8a499'), false);
    for (let k = -5; k <= 5; k++) B.geom(new THREE.BoxGeometry(32, 3, 3), mat4(lm.x, y + 16.5, lm.z + k * 55), '#8b877d');
  }

  if (lm.type === 'silos') {
    // صوامع الحبوب
    const y = H(lm.x, lm.z);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 4; b++) {
      const x = lm.x + b * 11 - 16, z = lm.z + a * 11 - 5;
      B.geom(new THREE.CylinderGeometry(5.2, 5.2, 42, 20), mat4(x, y + 20, z), '#d9d2c3');
      B.geom(new THREE.ConeGeometry(5.2, 2.5, 20), mat4(x, y + 42.2, z), '#c7c0b0');
    }
    B.box(lm.x + 30, y - 1, lm.z, 12, 58, 12, 0, new THREE.Color('#cfc7b6'), true);
    B.box(lm.x + 5, y + 43, lm.z, 50, 4, 6, 0, new THREE.Color('#bfb7a6'), false);
    colliders.push(new THREE.Box3(new THREE.Vector3(lm.x - 22, y, lm.z - 11), new THREE.Vector3(lm.x + 37, y + 58, lm.z + 17)));
  }

  if (lm.type === 'khalidMosque') {
    // جامع خالد بن الوليد بحجره الأبلق وقبابه التسع ومئذنتيه
    const y = H(lm.x, lm.z);
    const g = new THREE.Group();
    const ab = ablaqTexture();
    const abMat = new THREE.MeshStandardMaterial({ map: ab, roughness: 0.8 });
    const hall = new THREE.Mesh(new THREE.BoxGeometry(56, 16, 34), abMat);
    const uvs = hall.geometry.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 6, uvs.getY(i) * 2);
    hall.position.y = 8;
    g.add(hall);
    const lead = new THREE.MeshStandardMaterial({ color: 0x9fa4a8, roughness: 0.45, metalness: 0.6 });
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const big = a === 0 && b === 0;
      const r = big ? 9 : 5.2;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, big ? 4 : 2, 16), abMat);
      drum.position.set(a * 17, 16 + (big ? 2 : 1), b * 10);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lead);
      dome.position.set(a * 17, 16 + (big ? 4 : 2), b * 10);
      g.add(drum, dome);
    }
    for (const sx of [-1, 1]) {
      const mz = -19;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2, 44, 10), abMat);
      const su = shaft.geometry.attributes.uv;
      for (let i = 0; i < su.count; i++) su.setXY(i, su.getX(i) * 2, su.getY(i) * 6);
      shaft.position.set(sx * 29, 22, mz);
      const bal = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2, 1.5, 10), lead);
      bal.position.set(sx * 29, 40, mz);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(1.7, 9, 10), lead);
      tip.position.set(sx * 29, 48.5, mz);
      g.add(shaft, bal, tip);
    }
    g.position.set(lm.x, y - 0.5, lm.z);
    g.rotation.y = 0.15;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.heat = 0.3; } });
    extras.push(g);
    colliders.push(new THREE.Box3(new THREE.Vector3(lm.x - 33, y, lm.z - 22), new THREE.Vector3(lm.x + 33, y + 52, lm.z + 20)));
  }

  if (lm.type === 'clockTower') {
    const y = H(lm.x, lm.z);
    B.geom(new THREE.CylinderGeometry(18, 18, 0.6, 24), mat4(lm.x, y + 0.3, lm.z), '#7c8a5a');
    B.box(lm.x, y, lm.z, 4.5, 24, 4.5, 0, new THREE.Color('#e2dccd'), false);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      B.geom(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 20), mat4(lm.x + Math.sin(a) * 2.3, y + 20.5, lm.z + Math.cos(a) * 2.3, a, 1, 1, 1, Math.PI / 2, 0), '#f6f3ea');
    }
    B.geom(new THREE.ConeGeometry(3.6, 5, 4), mat4(lm.x, y + 26.5, lm.z, Math.PI / 4), '#6a6d70');
  }

  if (lm.type === 'qasioun') {
    // أبراج البث على قمة قاسيون
    for (let k = 0; k < 3; k++) {
      const x = lm.x - 300 + k * 260, z = lm.z + 80 - k * 40;
      const y = H(x, z);
      B.geom(new THREE.CylinderGeometry(0.6, 2.5, 70, 4), mat4(x, y + 35, z), '#b9b9b9');
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      lamp.position.set(x, y + 71, z);
      lamp.userData.heat = 0.9;
      lamp.userData.blink = true;
      extras.push(lamp);
    }
  }

  if (lm.type === 'cityLights') {
    // أضواء مدينة بعيدة (حمص/دمشق)
    const n = 2600;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = lm.x + (rnd() - 0.5) * lm.w * (0.4 + rnd() * 0.6);
      const z0 = lm.z + (rnd() - 0.5) * 900 * rnd();
      const z = lm.on === 'mountain' ? z0 - 800 * rnd() : z0;
      let y = lm.on === 'mountain' ? H(x, z) + 3 : 2 + rnd() * 20;
      if (lm.on !== 'mountain' && z < terrain.bounds.minZ + 50) y = 6 + rnd() * 30;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const warm = rnd();
      col[i * 3] = 1; col[i * 3 + 1] = 0.65 + warm * 0.3; col[i * 3 + 2] = 0.35 + warm * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pts.userData.nightOnly = true;
    pts.userData.heat = 0.6;
    extras.push(pts);
  }

  let mesh = null;
  if (!B.empty) {
    mesh = new THREE.Mesh(B.build(), buildingMaterial());
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.heat = 0.3;
  }
  return { mesh, extras, colliders, animated };
}

export function makeFlag(x, y, z, kind = 'revolution', height = 9) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, height, 6), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.7, roughness: 0.4 }));
  pole.position.y = height / 2;
  const geo = new THREE.PlaneGeometry(2.4, 1.6, 12, 4);
  geo.translate(1.2, 0, 0);
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTexture(kind), side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.position.y = height - 0.9;
  cloth.userData.flag = true;
  cloth.userData.base = geo.attributes.position.array.slice();
  g.add(pole, cloth);
  g.position.set(x, y, z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.heat = 0.28; } });
  return g;
}

export function animateFlag(cloth, t) {
  const p = cloth.geometry.attributes.position;
  const b = cloth.userData.base;
  for (let i = 0; i < p.count; i++) {
    const x = b[i * 3];
    const w = Math.sin(t * 6 + x * 2.2) * 0.12 * (x / 2.4) + Math.sin(t * 3.7 + x * 1.3 + b[i * 3 + 1]) * 0.06 * (x / 2.4);
    p.setZ(i, b[i * 3 + 2] + w);
  }
  p.needsUpdate = true;
}

// جسور الطرق فوق الأنهار
export function buildBridges(terrain) {
  const B = new GeoBuilder();
  for (const r of terrain.roads) {
    if (r.deck == null) continue;
    const a = Math.max(0, r.bridgeA - 3), b = Math.min(r.pts.length - 1, r.bridgeB + 3);
    for (let k = a; k < b; k++) {
      const p = r.pts[k], q = r.pts[k + 1];
      const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const rot = Math.atan2(q[0] - p[0], q[1] - p[1]);
      B.box(mx, r.deck - 0.6, mz, r.w + 2, 1.2, len + 0.5, rot, new THREE.Color('#9d978b'), false);
      for (const sd of [-1, 1]) {
        const o = sd * (r.w / 2 + 0.8);
        B.box(mx + Math.cos(rot) * o, r.deck + 0.6, mz - Math.sin(rot) * o, 0.4, 1, len + 0.5, rot, new THREE.Color('#bdb6a8'), false);
      }
      if (k % 2 === 0) {
        const ground = terrain.heightAt(mx, mz);
        B.geom(new THREE.BoxGeometry(3, r.deck - ground + 2, 3), mat4(mx, (r.deck + ground) / 2 - 1, mz, rot), '#8a857b');
      }
    }
  }
  if (B.empty) return null;
  const mesh = new THREE.Mesh(B.build(), buildingMaterial());
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.heat = 0.32;
  return mesh;
}

// أعمدة كهرباء وهياكل سيارات محترقة على جوانب الطرق
export function buildRoadside(terrain, seed) {
  const B = new GeoBuilder();
  const rnd = mulberry32(seed);
  for (const r of terrain.roads) {
    if (r.type === 'track') continue;
    const side = r.w / 2 + 5;
    for (let i = 3; i < r.pts.length - 3; i += 4) {
      const p = r.pts[i], q = r.pts[i + 1];
      const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
      const x = p[0] + dz / l * side, z = p[1] - dx / l * side;
      if (Math.hypot(x, z) < 60) continue;
      const y = terrain.heightAt(x, z);
      B.geom(new THREE.CylinderGeometry(0.12, 0.2, 9, 5), mat4(x, y + 4.5, z), '#8f8b83');
      B.geom(new THREE.BoxGeometry(2, 0.15, 0.15), mat4(x, y + 8.6, z, Math.atan2(dx, dz) + Math.PI / 2), '#5e5a54');
      if (rnd() < 0.08) {
        // هيكل سيارة محترقة
        const cx = p[0] + dz / l * (side - 2.5), cz = p[1] - dx / l * (side - 2.5);
        const cy = terrain.heightAt(cx, cz);
        const rot = Math.atan2(dx, dz) + (rnd() - 0.5) * 0.8;
        B.box(cx, cy + 0.3, cz, 1.8, 0.8, 4.4, rot, new THREE.Color('#2b2522'), false);
        B.box(cx, cy + 1.1, cz, 1.6, 0.6, 2.2, rot, new THREE.Color('#3a2e26'), false);
      }
    }
  }
  if (B.empty) return null;
  const mesh = new THREE.Mesh(B.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  mesh.castShadow = true;
  mesh.userData.heat = 0.25;
  return mesh;
}
