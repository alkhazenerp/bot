// المؤثرات: انفجارات، دخان، شرر، شظايا، ومضات، آثار حروق، اهتزاز الكاميرا
import * as THREE from 'three';
import { Particles } from './particles.js';
import { scorchTexture } from './textures.js';
import { rand, clamp } from '../core/util.js';

const RECORDED = ['explosion', 'tankKill', 'missileTrail', 'launchBlast', 'muzzleFlash', 'tracer', 'impact', 'burn', 'flares', 'splash', 'rocketTrail', 'dustTrail', 'airBurst', 'torch', 'smokePuff', 'sparks'];

function ser(a) {
  if (a && a.isVector3) return { __v: [a.x, a.y, a.z] };
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const o = {};
    for (const k in a) o[k] = ser(a[k]);
    return o;
  }
  return a;
}
function deser(a) {
  if (a && a.__v) return new THREE.Vector3(a.__v[0], a.__v[1], a.__v[2]);
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const o = {};
    for (const k in a) o[k] = deser(a[k]);
    return o;
  }
  return a;
}

export class FX {
  constructor(scene, { terrain, audio, quality = 'medium' } = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.audio = audio;
    this.quality = quality;
    const cap = quality === 'low' ? 1800 : quality === 'high' ? 6000 : 3800;
    this.smoke = new Particles(cap, { additive: false });
    this.glow = new Particles(Math.floor(cap * 0.8), { additive: true });
    scene.add(this.smoke.mesh, this.glow.mesh);
    this.mult = quality === 'low' ? 0.55 : quality === 'high' ? 1.25 : 1;
    this.trauma = 0;
    this.listener = new THREE.Vector3();
    this.recorder = null;
    this.replaying = false;
    this._acc = new Map();

    // أضواء الومضات
    this.lights = [];
    const nL = quality === 'low' ? 1 : quality === 'high' ? 4 : 2;
    for (let i = 0; i < nL; i++) {
      const l = new THREE.PointLight(0xffa860, 0, 0, 2);
      l.userData.t = 0; l.userData.max = 0; l.userData.dur = 0.3;
      scene.add(l);
      this.lights.push(l);
    }
    // شظايا
    this.debris = [];
    const dGeos = [new THREE.BoxGeometry(0.5, 0.2, 0.7), new THREE.TetrahedronGeometry(0.4), new THREE.BoxGeometry(0.9, 0.12, 0.4), new THREE.DodecahedronGeometry(0.3)];
    const dMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.8, metalness: 0.4 });
    dMat.userData.heat = 0.8;
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(dGeos[i % dGeos.length], dMat);
      m.visible = false;
      m.castShadow = true;
      m.userData.heat = 0.8;
      m.userData.d = { v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, trail: false, ground: false };
      scene.add(m);
      this.debris.push(m);
    }
    this._di = 0;
    // آثار حروق
    this.decals = [];
    const dm = new THREE.MeshBasicMaterial({ map: scorchTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    dm.userData.heat = 0.35;
    for (let i = 0; i < 30; i++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), dm);
      d.visible = false;
      d.userData.heat = 0.35;
      d.renderOrder = 1;
      scene.add(d);
      this.decals.push(d);
    }
    this._dci = 0;
    // موجات صدمة
    this.rings = [];
    const rg = new THREE.RingGeometry(0.85, 1, 48);
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xfff2dc, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      r.visible = false;
      r.userData.t = 1; r.userData.size = 10;
      r.userData.noThermalSwap = true;
      scene.add(r);
      this.rings.push(r);
    }
    this._ri = 0;

    // تغليف الدوال المسجلة لإعادة اللقطة
    for (const name of RECORDED) {
      const orig = this[name].bind(this);
      this[name] = (...args) => {
        if (this.recorder && !this.replaying) this.recorder.event(name, args.map(ser));
        return orig(...args);
      };
    }
  }

  playEvent(name, args) {
    if (this[name]) this[name](...args.map(deser));
  }

  setThermal(on) {
    this.smoke.uniforms.uThermal.value = on ? 1 : 0;
    this.glow.uniforms.uThermal.value = on ? 1 : 0;
  }

  setEnv({ fogColor, fogDensity, light, wind }) {
    for (const s of [this.smoke, this.glow]) {
      if (fogColor) s.uniforms.uFogColor.value.copy(fogColor);
      if (fogDensity != null) s.uniforms.uFogDensity.value = fogDensity;
    }
    if (light) this.smoke.uniforms.uLight.value.copy(light);
    if (wind) { this.smoke.wind.copy(wind); this.glow.wind.copy(wind); }
  }

  _dist(p) { return p.distanceTo(this.listener); }

  shake(amount) { this.trauma = clamp(this.trauma + amount, 0, 1); }

  flash(pos, intensity, dur = 0.25, color = 0xffa860) {
    let best = this.lights[0];
    for (const l of this.lights) if (l.userData.t >= l.userData.dur) { best = l; break; }
    if (!best) return;
    best.position.copy(pos);
    best.color.set(color);
    best.userData.t = 0; best.userData.max = intensity; best.userData.dur = dur;
    best.intensity = intensity;
  }

  _ring(pos, size, dur = 0.4) {
    const r = this.rings[this._ri++ % this.rings.length];
    r.position.copy(pos);
    r.position.y += 0.5;
    r.rotation.set(-Math.PI / 2, 0, 0);
    r.visible = true;
    r.userData.t = 0; r.userData.size = size; r.userData.dur = dur;
  }

  decal(pos, size) {
    if (!this.terrain) return;
    const d = this.decals[this._dci++ % this.decals.length];
    const y = this.terrain.heightAt(pos.x, pos.z);
    if (Math.abs(pos.y - y) > 3) return;
    const n = this.terrain.normalAt(pos.x, pos.z);
    d.position.set(pos.x, y + 0.12, pos.z);
    d.lookAt(pos.x + n.x, y + 0.12 + n.y, pos.z + n.z);
    d.rotateZ(Math.random() * 6.28);
    d.scale.setScalar(size);
    d.visible = true;
  }

  _debris(pos, n, speed, trailChance = 0.3, scale = 1) {
    for (let i = 0; i < n; i++) {
      const m = this.debris[this._di++ % this.debris.length];
      const d = m.userData.d;
      m.position.copy(pos);
      m.position.y += 0.5;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const sp = speed * (0.4 + Math.random() * 0.8);
      d.v.set(Math.cos(a) * sp * (1 - up * 0.5), sp * up, Math.sin(a) * sp * (1 - up * 0.5));
      d.w.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
      d.life = 4 + Math.random() * 6;
      d.trail = Math.random() < trailChance;
      d.ground = false;
      m.scale.setScalar(scale * (0.6 + Math.random() * 1.2));
      m.visible = true;
    }
  }

  // ===== المؤثرات المسجلة =====
  explosion(pos, opts = {}) {
    const s = opts.size ?? 1;
    const kind = opts.kind || 'he';
    const M = this.mult;
    const ground = kind !== 'air';
    // ومضة
    this.flash(pos.clone().setY(pos.y + 2 * s), 4000 * s * s, 0.22 + 0.1 * s);
    this.glow.spawn({ x: pos.x, y: pos.y + 1.2 * s, z: pos.z, life: 0.16 + 0.05 * s, size: 12 * s, size1: 16 * s, color: [7, 4.5, 2.6, 1], color1: [3, 1.2, 0.3, 0], frame: 3, rotV: 0 });
    // كرة النار
    const nf = Math.ceil(16 * s * M);
    for (let i = 0; i < nf; i++) {
      const a = Math.random() * 6.28, e = Math.random() * (ground ? 1.2 : 3.14) - (ground ? 0 : 1.57);
      const sp = rand(5, 16) * s;
      this.glow.spawn({
        x: pos.x + rand(-1, 1) * s, y: pos.y + rand(0.3, 1.8) * s, z: pos.z + rand(-1, 1) * s,
        vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.abs(Math.sin(e)) * sp * (ground ? 1.2 : 1) + 2, vz: Math.sin(a) * Math.cos(e) * sp,
        life: rand(0.45, 1.1) * (0.8 + s * 0.2), size: rand(2.2, 3.8) * s, size1: rand(6, 9) * s,
        color: [6, 3.2, 1.2, 1], color1: [1.6, 0.35, 0.06, 0], frame: 2, drag: 2.6, grav: -3,
      });
    }
    // الدخان
    const ns = Math.ceil(20 * s * M);
    for (let i = 0; i < ns; i++) {
      const a = Math.random() * 6.28;
      const sp = rand(1.5, 7) * s;
      const g = rand(0.1, 0.22);
      this.smoke.spawn({
        x: pos.x + rand(-1.5, 1.5) * s, y: pos.y + rand(0.5, 3) * s, z: pos.z + rand(-1.5, 1.5) * s,
        vx: Math.cos(a) * sp, vy: rand(3, 9) * s * (ground ? 1 : 0.4), vz: Math.sin(a) * sp,
        life: rand(3, 7) * (0.7 + s * 0.3), size: rand(3, 5) * s, size1: rand(12, 20) * s,
        color: [g, g * 0.95, g * 0.9, 0.9], color1: [0.38, 0.36, 0.34, 0], frame: i % 2, drag: 1.1, grav: -0.6, fadeIn: 0.04,
      });
    }
    if (ground) {
      // غبار أرضي متمدد
      const nd = Math.ceil(14 * s * M);
      for (let i = 0; i < nd; i++) {
        const a = (i / nd) * 6.28 + Math.random() * 0.4;
        const sp = rand(10, 22) * s;
        this.smoke.spawn({
          x: pos.x, y: pos.y + 0.6 * s, z: pos.z, vx: Math.cos(a) * sp, vy: rand(0.5, 2.5), vz: Math.sin(a) * sp,
          life: rand(1.6, 3.4), size: 2.5 * s, size1: rand(8, 12) * s, color: [0.6, 0.53, 0.43, 0.75], color1: [0.68, 0.62, 0.53, 0], frame: 1, drag: 3.2, grav: 0.4,
        });
      }
      // نافورة تراب
      for (let i = 0; i < Math.ceil(10 * s * M); i++) {
        this.smoke.spawn({
          x: pos.x + rand(-1, 1), y: pos.y, z: pos.z + rand(-1, 1), vx: rand(-4, 4) * s, vy: rand(14, 30) * s, vz: rand(-4, 4) * s,
          life: rand(1.2, 2.2), size: rand(1, 2) * s, size1: rand(4, 7) * s, color: [0.42, 0.35, 0.27, 0.9], color1: [0.5, 0.45, 0.38, 0], frame: 1, drag: 1.4, grav: 9,
        });
      }
      this._ring(pos, 22 * s, 0.35 + 0.1 * s);
      this.decal(pos, 6 * s);
    }
    // شرر
    this.sparks(pos.clone().setY(pos.y + 1), Math.ceil(26 * s * M), 45 * Math.sqrt(s));
    this._debris(pos, Math.ceil(5 * s), 16 * Math.sqrt(s), 0.35, Math.sqrt(s));
    // اهتزاز وصوت
    const d = this._dist(pos);
    this.shake(clamp((s * 60) / (d + 20), 0, 0.9));
    if (this.audio) this.audio.explosion(pos, s, kind);
  }

  tankKill(pos, opts = {}) {
    // انفجار ذخيرة الدبابة مع لهب عمودي
    this.explosion(pos, { size: 1.8, kind: 'tank' });
    this.torch(pos.clone().setY(pos.y + 2.2), { dur: 1.6, power: 1.3 });
    this.flash(pos.clone().setY(pos.y + 4), 9000, 0.6);
  }

  torch(pos, opts = {}) {
    // نافورة لهب من فتحات الدبابة (تُستدعى عدة مرات عبر burn)
    const p = opts.power ?? 1;
    for (let i = 0; i < 24 * this.mult * p; i++) {
      this.glow.spawn({
        x: pos.x + rand(-0.4, 0.4), y: pos.y + rand(0, 1), z: pos.z + rand(-0.4, 0.4),
        vx: rand(-2, 2), vy: rand(12, 26) * p, vz: rand(-2, 2), life: rand(0.4, 0.9), size: rand(1.2, 2.2), size1: rand(3, 5),
        color: [7, 3.6, 1.2, 1], color1: [2, 0.4, 0.05, 0], frame: 2, drag: 1.5, grav: -2,
      });
    }
  }

  airBurst(pos, opts = {}) {
    this.explosion(pos, { size: opts.size ?? 1.4, kind: 'air' });
  }

  sparks(pos, n = 20, speed = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.4;
      const sp = rand(0.3, 1) * speed;
      this.glow.spawn({
        x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp, vz: Math.sin(a) * Math.cos(e) * sp,
        life: rand(0.3, 1.1), size: rand(0.12, 0.3), color: [7, 4, 1.6, 1], color1: [3, 0.7, 0.1, 0], frame: 3, grav: 9.8, drag: 0.6, stretch: 0.035,
      });
    }
  }

  missileTrail(p0, p1, opts = {}) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const step = opts.step ?? 1.4;
    const n = Math.min(60, Math.ceil(len / step));
    const big = opts.big ?? 1;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      this.smoke.spawn({
        x: p0.x + dx * t + rand(-0.1, 0.1), y: p0.y + dy * t + rand(-0.1, 0.1), z: p0.z + dz * t + rand(-0.1, 0.1),
        vx: rand(-0.4, 0.4), vy: rand(0.1, 0.6), vz: rand(-0.4, 0.4),
        life: rand(1.6, 3.2) * big, size: 0.35 * big, size1: rand(2.2, 3.4) * big, color: [0.92, 0.9, 0.86, 0.55], color1: [0.85, 0.84, 0.82, 0], frame: i % 2, drag: 0.8, grav: -0.15, fadeIn: 0.02,
      });
    }
    // وهج المحرك
    this.glow.spawn({ x: p1.x, y: p1.y, z: p1.z, life: 0.05, size: 0.9 * big, color: [8, 5, 2.5, 1], color1: [6, 2, 0.6, 0.3], frame: 3 });
  }

  rocketTrail(p0, p1, opts = {}) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const n = Math.min(30, Math.ceil(len / 2.2));
    const g = opts.dark ? 0.35 : 0.8;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      this.smoke.spawn({
        x: p0.x + dx * t, y: p0.y + dy * t, z: p0.z + dz * t, vx: rand(-0.6, 0.6), vy: rand(0, 0.6), vz: rand(-0.6, 0.6),
        life: rand(1.2, 2.6), size: 0.6, size1: rand(2.5, 4), color: [g, g * 0.97, g * 0.94, 0.5], color1: [g, g, g, 0], frame: i % 2, drag: 0.9,
      });
    }
    this.glow.spawn({ x: p1.x, y: p1.y, z: p1.z, life: 0.06, size: 1.2, color: [8, 4, 1.4, 1], color1: [4, 1.2, 0.2, 0], frame: 3 });
  }

  launchBlast(pos, dir) {
    // نفخة الإطلاق الخلفية للتاو + غبار
    this.flash(pos, 900, 0.15, 0xfff0d0);
    this.glow.spawn({ x: pos.x + dir.x * 0.6, y: pos.y + dir.y * 0.6, z: pos.z + dir.z * 0.6, life: 0.09, size: 2.2, color: [6, 5, 4, 1], color1: [4, 2, 1, 0], frame: 3 });
    for (let i = 0; i < 26 * this.mult; i++) {
      const sp = rand(4, 16);
      const s = rand(-0.8, 0.8);
      this.smoke.spawn({
        x: pos.x - dir.x * 1.3, y: pos.y - dir.y * 1.3, z: pos.z - dir.z * 1.3,
        vx: -dir.x * sp + rand(-3, 3) + s * dir.z * 5, vy: rand(0.5, 3), vz: -dir.z * sp + rand(-3, 3) - s * dir.x * 5,
        life: rand(1.8, 3.6), size: 0.8, size1: rand(4, 7), color: [0.85, 0.82, 0.77, 0.7], color1: [0.7, 0.66, 0.6, 0], frame: i % 2, drag: 2.2, grav: -0.3,
      });
    }
    for (let i = 0; i < 10 * this.mult; i++) {
      const sp = rand(2, 8);
      this.smoke.spawn({
        x: pos.x + dir.x, y: pos.y + dir.y, z: pos.z + dir.z, vx: dir.x * sp + rand(-1, 1), vy: rand(0, 1.5), vz: dir.z * sp + rand(-1, 1),
        life: rand(1.2, 2.2), size: 0.5, size1: rand(2, 3), color: [0.9, 0.88, 0.84, 0.6], color1: [0.8, 0.78, 0.74, 0], frame: 1, drag: 2,
      });
    }
    this.shake(0.25);
    if (this.audio) this.audio.towLaunch();
  }

  muzzleFlash(pos, dir, opts = {}) {
    const s = opts.size ?? 1;
    const q = opts.quiet;
    this.glow.spawn({ x: pos.x + dir.x * 0.6 * s, y: pos.y + dir.y * 0.6 * s, z: pos.z + dir.z * 0.6 * s, life: 0.06 + 0.03 * s, size: 1.8 * s, size1: 2.6 * s, color: [8, 5.5, 2.6, 1], color1: [5, 2, 0.5, 0], frame: 3 });
    for (let i = 0; i < 6; i++) {
      const sp = rand(10, 30) * s;
      this.glow.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * sp + rand(-2, 2) * s, vy: dir.y * sp + rand(-2, 2) * s, vz: dir.z * sp + rand(-2, 2) * s, life: rand(0.05, 0.12), size: 0.8 * s, size1: 1.6 * s, color: [7, 3.4, 1.1, 1], color1: [3, 0.6, 0.1, 0], frame: 2, drag: 8 });
    }
    if (s > 0.8) {
      this.flash(pos, 600 * s * s, 0.12);
      for (let i = 0; i < 12 * this.mult; i++) {
        const sp = rand(2, 9) * s;
        this.smoke.spawn({ x: pos.x + dir.x * 1.5 * s, y: pos.y + dir.y, z: pos.z + dir.z * 1.5 * s, vx: dir.x * sp + rand(-2, 2), vy: rand(0, 2), vz: dir.z * sp + rand(-2, 2), life: rand(1.5, 3), size: 0.8 * s, size1: rand(3, 5) * s, color: [0.7, 0.68, 0.64, 0.6], color1: [0.6, 0.58, 0.55, 0], frame: i % 2, drag: 2.4 });
      }
    }
    if (this.audio && !q) this.audio.gunshot(pos, opts.sound || 'cannon');
  }

  tracer(pos, vel, opts = {}) {
    const c = opts.color || [7, 2.2, 0.8];
    const life = opts.life ?? 1.2;
    this.glow.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, life, size: opts.size ?? 0.18, color: [...c, 1], color1: [...c, 0.85], frame: 3, stretch: opts.stretch ?? 0.014, grav: opts.grav ?? 0, wind: 0 });
  }

  impact(pos, opts = {}) {
    const s = opts.size ?? 1;
    if (opts.metal) this.sparks(pos, 8, 18);
    for (let i = 0; i < 5 * this.mult * s; i++) {
      this.smoke.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-2, 2) * s, vy: rand(2, 7) * s, vz: rand(-2, 2) * s, life: rand(0.6, 1.4), size: 0.4 * s, size1: rand(1.4, 2.4) * s, color: [0.55, 0.48, 0.38, 0.75], color1: [0.62, 0.56, 0.47, 0], frame: 1, drag: 2, grav: 3 });
    }
  }

  smokePuff(pos, opts = {}) {
    const s = opts.size ?? 1;
    const g = opts.gray ?? 0.75;
    this.smoke.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-1, 1), vy: rand(0.5, 2), vz: rand(-1, 1), life: rand(1.5, 3), size: s, size1: s * 3, color: [g, g, g, 0.5], color1: [g, g, g, 0], frame: 0, drag: 1 });
  }

  dustTrail(pos, opts = {}) {
    const s = opts.size ?? 1;
    this.smoke.spawn({ x: pos.x + rand(-1, 1), y: pos.y + 0.4, z: pos.z + rand(-1, 1), vx: rand(-1, 1), vy: rand(0.3, 1.2), vz: rand(-1, 1), life: rand(2, 4), size: 1.2 * s, size1: rand(4, 7) * s, color: [0.7, 0.62, 0.5, 0.35], color1: [0.72, 0.66, 0.56, 0], frame: 1, drag: 1, fadeIn: 0.15 });
  }

  // حريق مستمر (هياكل محترقة) — يُستدعى كل إطار مع dt
  burn(pos, opts = {}) {
    const dt = opts.dt ?? 0.016;
    const p = opts.power ?? 1;
    const key = opts.key ?? 'g';
    let acc = (this._acc.get(key) || 0) + dt * 30 * p * this.mult;
    const n = Math.floor(acc);
    acc -= n;
    this._acc.set(key, acc);
    const r = opts.radius ?? 1.4;
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.55) {
        this.glow.spawn({ x: pos.x + rand(-r, r), y: pos.y + rand(0, 0.6), z: pos.z + rand(-r, r), vx: rand(-0.6, 0.6), vy: rand(2, 5) * p, vz: rand(-0.6, 0.6), life: rand(0.5, 1.1), size: rand(0.8, 1.6) * Math.sqrt(p), size1: rand(1.8, 3) * Math.sqrt(p), color: [5, 2.2, 0.7, 0.9], color1: [1.5, 0.3, 0.05, 0], frame: 2, drag: 1, grav: -1.5 });
      }
      if (Math.random() < 0.6) {
        const g = rand(0.06, 0.13);
        this.smoke.spawn({ x: pos.x + rand(-r, r), y: pos.y + 1 + rand(0, 1), z: pos.z + rand(-r, r), vx: rand(-0.8, 0.8), vy: rand(3, 6) * Math.sqrt(p), vz: rand(-0.8, 0.8), life: rand(4, 9), size: rand(1.5, 2.5) * Math.sqrt(p), size1: rand(8, 14) * Math.sqrt(p), color: [g, g, g * 0.95, 0.85], color1: [0.3, 0.29, 0.28, 0], frame: i % 2, drag: 0.6, grav: -0.25, fadeIn: 0.05 });
      }
    }
  }

  flares(pos, vel) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.glow.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: vel.x * 0.4 + Math.cos(a) * 25, vy: vel.y * 0.4 - 8 + Math.sin(a) * 10, vz: vel.z * 0.4 + Math.sin(a) * 25, life: 2.6, size: 1.6, size1: 0.8, color: [9, 7, 4, 1], color1: [6, 3, 1, 0.2], frame: 3, drag: 0.8, grav: 6 });
      for (let k = 0; k < 6; k++) {
        this.smoke.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: vel.x * 0.3 + Math.cos(a) * 20 * (k / 6), vy: -k, vz: vel.z * 0.3 + Math.sin(a) * 20 * (k / 6), life: rand(2, 3.5), size: 1, size1: 4, color: [0.9, 0.9, 0.9, 0.5], color1: [0.9, 0.9, 0.9, 0], frame: 0, drag: 1.2 });
      }
    }
    this.flash(pos, 3000, 0.6, 0xfff0c0);
  }

  splash(pos, opts = {}) {
    const s = opts.size ?? 1;
    for (let i = 0; i < 30 * this.mult * s; i++) {
      this.smoke.spawn({ x: pos.x + rand(-1, 1) * s, y: pos.y, z: pos.z + rand(-1, 1) * s, vx: rand(-3, 3) * s, vy: rand(10, 26) * s, vz: rand(-3, 3) * s, life: rand(1.2, 2.4), size: 0.8 * s, size1: rand(3, 5) * s, color: [0.95, 0.97, 1, 0.7], color1: [0.9, 0.92, 0.95, 0], frame: 0, drag: 1, grav: 12 });
    }
    if (this.audio) this.audio.explosion(pos, s * 0.6, 'water');
  }

  update(dt, camera) {
    this.listener.copy(camera.position);
    this.smoke.update(dt, camera);
    this.glow.update(dt, camera);
    for (const l of this.lights) {
      const u = l.userData;
      if (u.t < u.dur) {
        u.t += dt;
        const k = Math.max(0, 1 - u.t / u.dur);
        l.intensity = u.max * k * k;
      } else l.intensity = 0;
    }
    for (const m of this.debris) {
      if (!m.visible) continue;
      const d = m.userData.d;
      d.life -= dt;
      if (d.life <= 0) { m.visible = false; continue; }
      if (!d.ground) {
        d.v.y -= 9.8 * dt;
        m.position.addScaledVector(d.v, dt);
        m.rotation.x += d.w.x * dt; m.rotation.y += d.w.y * dt; m.rotation.z += d.w.z * dt;
        if (d.trail && Math.random() < 0.7) {
          this.smoke.spawn({ x: m.position.x, y: m.position.y, z: m.position.z, life: rand(0.8, 1.6), size: 0.4, size1: 1.8, color: [0.15, 0.14, 0.13, 0.6], color1: [0.3, 0.3, 0.3, 0], frame: 0, drag: 1 });
          if (Math.random() < 0.5) this.glow.spawn({ x: m.position.x, y: m.position.y, z: m.position.z, life: 0.25, size: 0.5, color: [5, 2, 0.5, 1], color1: [2, 0.4, 0, 0], frame: 2 });
        }
        const gy = this.terrain ? this.terrain.heightAt(m.position.x, m.position.z) : 0;
        if (m.position.y < gy + 0.1) {
          m.position.y = gy + 0.1;
          if (Math.abs(d.v.y) > 3) { d.v.y = -d.v.y * 0.3; d.v.x *= 0.5; d.v.z *= 0.5; d.w.multiplyScalar(0.5); }
          else d.ground = true;
        }
      }
      if (d.life < 1) m.position.y -= dt * 0.3;
    }
    for (const r of this.rings) {
      if (!r.visible) continue;
      const u = r.userData;
      u.t += dt / u.dur;
      if (u.t >= 1) { r.visible = false; continue; }
      const s = u.size * (1 - Math.pow(1 - u.t, 3));
      r.scale.setScalar(s);
      r.material.opacity = 0.45 * (1 - u.t);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.3);
  }

  clear() {
    this.smoke.clear();
    this.glow.clear();
    for (const m of this.debris) m.visible = false;
    for (const r of this.rings) r.visible = false;
    for (const l of this.lights) { l.intensity = 0; l.userData.t = l.userData.dur; }
    this._acc.clear();
  }
}
