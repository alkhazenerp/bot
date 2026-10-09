// الوحدات وذكاؤها: دبابات، مدرعات، شاحنات، أفراد، مروحيات، طائرات، مسيّرات، منشآت
import * as THREE from 'three';
import { UNITS } from '../data/defs.js';
import { createModel, getMat } from '../engine/models.js';
import { animateFlag } from '../engine/props.js';
import { clamp, rand, chance, damp, dampAngle, angleWrap, samplePolyline, pick } from '../core/util.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

let wreckMat = null;
function getWreckMat() {
  if (!wreckMat) {
    wreckMat = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 1, metalness: 0.2, emissive: 0x120400 });
    wreckMat.userData.heat = 0.8;
  }
  return wreckMat;
}

// اختبار تقاطع قطعة مستقيمة مع صندوق محلي (طريقة الشرائح)
export function segBox(p0, p1, min, max) {
  let t0 = 0, t1 = 1;
  const d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z];
  const o = [p0.x, p0.y, p0.z];
  let axis = -1, sgn = 0;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
    } else {
      let ta = (min[i] - o[i]) / d[i], tb = (max[i] - o[i]) / d[i];
      let s = -1;
      if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
      if (ta > t0) { t0 = ta; axis = i; sgn = s; }
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
  }
  return { t: t0, axis, sgn };
}

export class Entity {
  constructor(world, type, opts = {}) {
    this.world = world;
    this.type = type;
    this.def = UNITS[type];
    this.id = world.nextId++;
    this.cls = this.def.cls;
    this.team = this.def.friendly ? 'friend' : 'enemy';
    const m = createModel(this.def.model);
    this.model = m;
    this.root = m.root;
    this.root.userData.entity = this;
    this.turret = this.root.getObjectByName('turret');
    this.gun = this.root.getObjectByName('gun');
    this.muzzle = this.root.getObjectByName('muzzle');
    this.rotor = this.root.getObjectByName('rotor');
    this.tailRotor = this.root.getObjectByName('tailRotor');
    this.exhaust = this.root.getObjectByName('exhaust');
    this.flags = [];
    this.root.traverse((o) => { if (o.userData.flag) this.flags.push(o); });
    this.tracks = [];
    this.root.traverse((o) => { if (o.isMesh && o.userData.matKey === 'track') this.tracks.push(o.material.map); });
    const diff = world.diff;
    this.maxHp = this.def.hp * (this.team === 'enemy' ? (diff.id === 'legend' ? 1.15 : 1) : 1);
    this.hp = this.maxHp;
    this.alive = true;
    this.tag = opts.tag || null;
    this.hitboxes = m.hitboxes.map((h) => ({ name: h.name, min: h.min, max: h.max }));
    this.radius = Math.max(m.length, m.width) * 0.6;
    this.height = m.height;
    this.fireCd = rand(3, 8) / diff.enemyRate;
    this.alerted = false;
    this.spotted = this.team === 'friend';
    this.speed = 0;
    this.vel = new THREE.Vector3();
    this.turretYaw = 0;
    this.gunPitch = 0;
    this.burnT = 0;
    this.wrecked = false;
    this.spawnT = world.time;
    world.add(this.root);
    world.recorder?.register(this.id, this.root, this);
    if (this.turret) world.recorder?.register(`${this.id}:t`, this.turret, null);
  }

  get pos() { return this.root.position; }

  center(out = new THREE.Vector3()) {
    return out.set(0, this.height * 0.45, 0).applyMatrix4(this.root.matrixWorld);
  }

  muzzlePos(out = new THREE.Vector3()) {
    if (!this.muzzle) return this.center(out);
    this.muzzle.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.muzzle.matrixWorld);
  }

  muzzleDir(out = new THREE.Vector3()) {
    if (!this.muzzle) return out.set(0, 0, 1).applyQuaternion(this.root.quaternion);
    this.muzzle.getWorldQuaternion(_q);
    return out.set(0, 0, 1).applyQuaternion(_q);
  }

  // اختبار إصابة القطعة p0→p1 مع صناديق الوحدة
  hitTest(p0, p1) {
    if (this.escaped || !this.root.parent || !this.root.visible || (!this.alive && (this.cls === 'infantry' || this.cls === 'drone'))) return null;
    _m.copy(this.root.matrixWorld).invert();
    const a = p0.clone().applyMatrix4(_m), b = p1.clone().applyMatrix4(_m);
    let best = null;
    for (const h of this.hitboxes) {
      const r = segBox(a, b, h.min, h.max);
      if (r && (!best || r.t < best.t)) best = { ...r, part: h.name };
    }
    if (!best) return null;
    const lp = a.clone().lerp(b, best.t);
    let side = 'side';
    if (best.axis === 1) side = best.sgn > 0 ? 'top' : 'bottom';
    else if (best.axis === 2) side = best.sgn < 0 ? 'rear' : 'front';
    // تحويل النتيجة لاتجاه الهيكل عند ضرب البرج
    const point = p0.clone().lerp(p1, best.t);
    return { t: best.t, point, part: best.part, side, local: lp };
  }

  takeDamage(amount, info = {}) {
    if (!this.alive) return false;
    const armor = this.def.armor || {};
    const mult = armor[info.side] ?? 1;
    const dmg = amount * mult;
    this.hp -= dmg;
    this.lastHit = info;
    if (this.team === 'enemy') { this.alerted = true; this.spotted = true; }
    if (this.hp <= 0) {
      this.kill(info);
      return true;
    }
    if (info.source !== 'mg' && dmg > 20) this.world.fx.burn(this.center(_v), { dt: 0.4, power: 0.6, key: `h${this.id}` });
    return false;
  }

  kill(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.killInfo = info;
    this.onDeath(info);
    this.world.onEntityKilled(this, info);
  }

  onDeath() {}

  setWrecked(on) {
    if (on === this.wrecked) return;
    this.wrecked = on;
    const roots = [this.root];
    if (this.turret) {
      let p = this.turret.parent;
      while (p && p !== this.root) p = p.parent;
      if (!p) roots.push(this.turret);
    }
    for (const rt of roots) rt.traverse((o) => {
      if (!o.isMesh || o.userData.matKey === 'exhaust' || o.userData.matKey === 'rotor') {
        if (o.userData.matKey === 'rotor') o.visible = !on;
        return;
      }
      if (on) {
        if (!o.userData.origMat) o.userData.origMat = (this.world.vision.orig.get(o)) || o.material;
        o.material = getWreckMat();
        o.userData.wreckHeat = 0.85;
      } else if (o.userData.origMat) {
        o.material = o.userData.origMat;
        o.userData.wreckHeat = null;
      }
    });
    const ab = this.root.getObjectByName('afterburner');
    if (ab) ab.visible = !on;
    for (const rt of roots) this.world.vision.refresh(rt);
  }

  // تحديد هدف لإطلاق النار: اللاعب أو أقرب وحدة صديقة
  pickTarget() {
    const w = this.world;
    const p = w.player;
    const range = this.engageRange || 2600;
    const dPlayer = this.pos.distanceTo(p.pos);
    const canSeePlayer = this.alerted && dPlayer < range * (0.6 + p.exposure * 0.6);
    let best = null, bd = Infinity;
    for (const e of w.entities) {
      if (!e.alive || e.team === this.team) continue;
      if (e.cls === 'jet' || e.cls === 'drone') continue;
      const d = e.pos.distanceTo(this.pos);
      if (d < range && d < bd) { bd = d; best = e; }
    }
    if (this.team === 'friend') return best;
    if (canSeePlayer && (!best || Math.random() < 0.65 || dPlayer < bd)) return p;
    return best;
  }

  aimAt(target, dt, rate = 0.8) {
    if (!this.turret || !target) return 0;
    const tp = target.isPlayer ? target.pos : target.center(_v2);
    _v.copy(tp);
    this.root.worldToLocal(_v);
    const want = Math.atan2(_v.x, _v.z);
    this.turretYaw = dampAngle(this.turretYaw, want, rate * 3, dt);
    const dy = angleWrap(want - this.turretYaw);
    this.turret.rotation.y = this.turretYaw;
    if (this.gun) {
      const hd = Math.hypot(_v.x, _v.z);
      const wantP = clamp(Math.atan2(_v.y - 2, hd), -0.15, this.cls === 'aa' ? 1.4 : 0.35);
      this.gunPitch = damp(this.gunPitch, wantP, 3, dt);
      this.gun.rotation.x = -this.gunPitch + (this.gun.userData.baseX || 0);
    }
    return Math.abs(dy);
  }

  // إطلاق نار على هدف مع احتمال إصابة محسوب
  fireWeapon(target) {
    const w = this.world;
    const wpn = this.def.weapon;
    if (!wpn || !target) return;
    const from = this.muzzlePos(new THREE.Vector3());
    const dir = this.muzzleDir(new THREE.Vector3());
    const isPlayer = !!target.isPlayer;
    const tpos = isPlayer ? target.pos.clone() : target.center(new THREE.Vector3());
    const dist = from.distanceTo(tpos);
    const diff = w.diff;
    const baseAcc = { cannon: 0.42, gun73: 0.3, autocannon: 0.22, dshk: 0.12, pkm: 0.1, zu23: 0.14, rifle: 0.06, rpg: 0.3, atgm: 0.7 }[wpn] ?? 0.2;
    let p = baseAcc * (this.team === 'enemy' ? diff.enemyAcc : 1);
    p *= clamp(1.6 - dist / 2000, 0.25, 1.3);
    if (isPlayer) {
      p *= 0.35 + target.exposure * 0.85;
      if (target.inCover) p *= 0.06;
    }
    const hit = Math.random() < p;
    const miss = () => {
      const off = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(rand(4, 30) * (dist / 1200 + 0.5));
      const m = tpos.clone().add(off);
      // اجعل الإخفاق أمام اللاعب غالباً ليُرى
      if (isPlayer && off.z > 0) m.z = tpos.z - Math.abs(off.z);
      m.y = w.terrain.heightAt(m.x, m.z);
      return m;
    };
    const aimPoint = hit ? (isPlayer ? tpos.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 0.8, rand(-0.5, 0.5))) : tpos) : miss();
    if (wpn === 'cannon' || wpn === 'gun73') {
      w.fx.muzzleFlash(from, dir, { size: wpn === 'cannon' ? 1.6 : 0.9, sound: 'cannon' });
      if (wpn === 'cannon') for (let i = 0; i < 6; i++) w.fx.dustTrail(this.pos, { size: 1.6 });
      w.spawnEnemyProjectile({ kind: 'shell', from, to: aimPoint, speed: wpn === 'cannon' ? 1100 : 700, hit, target, damage: wpn === 'cannon' ? 32 : 16, source: this });
      this.recoil = 1;
    } else if (wpn === 'autocannon' || wpn === 'zu23') {
      const n = wpn === 'zu23' ? 10 : 5;
      for (let i = 0; i < n; i++) {
        w.after(i * (wpn === 'zu23' ? 0.07 : 0.14), () => {
          if (!this.alive) return;
          const f = this.muzzlePos(new THREE.Vector3());
          w.fx.muzzleFlash(f, dir, { size: 0.45, sound: 'rifle', quiet: i % 2 === 1 });
          const am = aimPoint.clone().add(new THREE.Vector3(rand(-3, 3), rand(-1, 2), rand(-3, 3)).multiplyScalar(hit ? 0.3 : 1));
          w.spawnEnemyProjectile({ kind: 'bullet', from: f, to: am, speed: 950, hit: hit && i % 3 === 0, target, damage: wpn === 'zu23' ? 4 : 5, source: this, tracer: [1.4, 6, 1.4] });
        });
      }
    } else if (wpn === 'dshk' || wpn === 'pkm' || wpn === 'rifle') {
      const n = wpn === 'rifle' ? 3 : 7;
      for (let i = 0; i < n; i++) {
        w.after(i * (wpn === 'dshk' ? 0.11 : 0.09), () => {
          if (!this.alive) return;
          const f = this.muzzlePos(new THREE.Vector3());
          w.fx.muzzleFlash(f, dir, { size: 0.3, sound: 'rifle', quiet: i % 2 === 1 });
          const am = aimPoint.clone().add(new THREE.Vector3(rand(-2, 2), rand(-0.5, 1.5), rand(-2, 2)).multiplyScalar(hit ? 0.25 : 1.2));
          w.spawnEnemyProjectile({ kind: 'bullet', from: f, to: am, speed: 850, hit: hit && i % 2 === 0, target, damage: wpn === 'dshk' ? 3 : 1.5, source: this, tracer: this.team === 'friend' ? [7, 2.2, 0.8] : [1.5, 6, 1.2], tracerEvery: wpn === 'rifle' ? 3 : 2, idx: i });
        });
      }
    } else if (wpn === 'rpg') {
      if (dist > 700) return;
      w.fx.muzzleFlash(from, dir, { size: 0.6, sound: 'rifle' });
      w.spawnEnemyProjectile({ kind: 'rpg', from, to: aimPoint, speed: 140, hit, target, damage: 20, source: this });
    } else if (wpn === 'atgm') {
      w.fx.muzzleFlash(from, dir, { size: 0.7, sound: 'rifle' });
      w.spawnEnemyProjectile({ kind: 'atgm', from, to: isPlayer ? tpos.clone().add(new THREE.Vector3(0, 0.8, 0)) : aimPoint, speed: 190, hit: true, target, damage: 45, source: this, guided: true });
      if (isPlayer) w.warn('atgm', from);
    }
  }

  updateFlags(t) { for (const f of this.flags) animateFlag(f, t + this.id); }

  update(dt) {}
}

// ===================== آليات أرضية =====================
export class GroundVehicle extends Entity {
  constructor(world, type, opts = {}) {
    super(world, type, opts);
    this.lane = opts.lane || null;
    this.d = opts.startD || 0;
    this.maxSpeed = (opts.speed || this.def.speed || 8) * rand(0.9, 1.1);
    this.stopAt = opts.stopAt ?? null;
    this.behavior = opts.behavior || 'pass';
    this.offset = opts.offset || 0;
    this.offsetT = this.offset;
    this.engageRange = this.cls === 'tank' ? 2800 : this.cls === 'ifv' ? 2200 : this.cls === 'technical' ? 1600 : 2000;
    this.stopFire = 0;
    this.blockedT = 0;
    this.recoil = 0;
    this.pitchS = 0; this.rollS = 0;
    this.turretToss = null;
    this.arrived = false;
    if (opts.pos) {
      this.root.position.copy(opts.pos);
      this.root.rotation.y = opts.heading || 0;
      this.heading = opts.heading || 0;
      this._settle(true);
    } else if (this.lane) this._placeOnLane(true);
    if (this.gun) this.gun.userData.baseX = this.gun.rotation.x;
    this.sink = opts.hullDown ? 0.65 : 0;
    if (this.sink) this.root.position.y -= this.sink;
    this.engine = null;
  }

  _placeOnLane(snap) {
    const L = this.lane;
    const s = samplePolyline(L.pts, L.cum, this.d);
    const nx = -s.dz, nz = s.dx;
    const x = s.x + nx * this.offsetT, z = s.z + nz * this.offsetT;
    this.root.position.x = x;
    this.root.position.z = z;
    const h = Math.atan2(s.dx, s.dz);
    this.heading = snap ? h : dampAngle(this.heading, h, 4, 1 / 60);
    this._settle(snap);
  }

  _settle(snap) {
    const t = this.world.terrain;
    const x = this.root.position.x, z = this.root.position.z;
    const L = this.model.length * 0.45, W = this.model.width * 0.45;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const hf = t.groundAt(x + fx * L, z + fz * L), hb = t.groundAt(x - fx * L, z - fz * L);
    const hr = t.groundAt(x + fz * W, z - fx * W), hl = t.groundAt(x - fz * W, z + fx * W);
    const y = (hf + hb + hr + hl) / 4;
    const pitch = Math.atan2(hf - hb, 2 * L), roll = Math.atan2(hr - hl, 2 * W);
    this.pitchS = snap ? pitch : damp(this.pitchS, pitch, 6, 1 / 60);
    this.rollS = snap ? roll : damp(this.rollS, roll, 6, 1 / 60);
    this.root.position.y = y - (this.sink || 0);
    this.root.rotation.set(-this.pitchS + this.recoil * 0.03, this.heading, this.rollS, 'YXZ');
  }

  onDeath(info) {
    const w = this.world;
    const c = this.center(new THREE.Vector3());
    this.setWrecked(true);
    this.engine?.stop();
    if (this.cls === 'tank') {
      w.fx.tankKill(c);
      const tossChance = (this.def.turretToss ?? 0.5) + (info.part === 'turret' ? 0.25 : 0) + (info.source === 'drone' ? 0.15 : 0);
      if (this.turret && Math.random() < tossChance) {
        // قذف البرج — "علبة المفاجآت"
        const t = this.turret;
        w.scene.attach(t);
        this.turretToss = {
          v: new THREE.Vector3(rand(-4, 4), rand(14, 24), rand(-4, 4)),
          w: new THREE.Vector3(rand(-3, 3), rand(-5, 5), rand(-3, 3)),
          ground: false,
        };
        info.turretToss = true;
      }
      this.burnT = rand(40, 70);
      this.cookoff = rand(1.5, 3);
    } else if (this.def.explosive) {
      w.fx.explosion(c, { size: this.type === 'depot' ? 3 : 2, kind: 'ammo' });
      this.chain = this.type === 'depot' ? 8 : 3;
      this.chainT = 0.3;
      this.burnT = rand(30, 50);
    } else {
      w.fx.explosion(c, { size: this.cls === 'technical' ? 1.1 : this.cls === 'static' ? 1.4 : 1.3, kind: 'he' });
      this.burnT = rand(20, 40);
    }
  }

  update(dt) {
    const w = this.world;
    const t = w.time;
    if (this.flags.length) this.updateFlags(t);
    if (!this.alive) {
      // حريق الهيكل والبرج الطائر
      if (this.burnT > 0) {
        this.burnT -= dt;
        const p = clamp(this.burnT / 30, 0.3, 1.3) * (this.cls === 'technical' ? 0.7 : 1);
        w.fx.burn(this.center(_v), { dt, power: p, key: `b${this.id}`, radius: this.model.width * 0.35 });
      }
      if (this.cookoff > 0) {
        this.cookoff -= dt;
        if (Math.random() < dt * 2.5) w.fx.torch(this.center(_v).setY(this.pos.y + 2.2), { power: 0.6 });
      }
      if (this.chain > 0) {
        this.chainT -= dt;
        if (this.chainT <= 0) {
          this.chain--;
          this.chainT = rand(0.25, 0.8);
          const p = this.center(new THREE.Vector3()).add(new THREE.Vector3(rand(-6, 6), rand(0, 3), rand(-6, 6)));
          w.fx.explosion(p, { size: rand(0.8, 1.8), kind: 'ammo' });
          w.damageArea(p, 15, 40, { source: 'chain' });
        }
      }
      if (this.turretToss && !this.turretToss.ground) {
        const tt = this.turretToss, tr = this.turret;
        tt.v.y -= 9.8 * dt;
        tr.position.addScaledVector(tt.v, dt);
        tr.rotation.x += tt.w.x * dt; tr.rotation.y += tt.w.y * dt; tr.rotation.z += tt.w.z * dt;
        if (Math.random() < 0.8) w.fx.burn(tr.position, { dt, power: 0.5, key: `tt${this.id}`, radius: 0.5 });
        const gy = w.terrain.heightAt(tr.position.x, tr.position.z);
        if (tr.position.y < gy + 0.5) {
          tr.position.y = gy + 0.5;
          if (tt.v.y < -6) { tt.v.y *= -0.25; tt.v.x *= 0.4; tt.v.z *= 0.4; tt.w.multiplyScalar(0.3); w.fx.impact(tr.position, { size: 2 }); }
          else { tt.ground = true; tr.rotation.x = Math.round(tr.rotation.x / Math.PI) * Math.PI + rand(-0.3, 0.3); tr.rotation.z = rand(-0.3, 0.3); }
        }
      }
      return;
    }

    // الحركة على المسار
    let target = null;
    if (this.lane) {
      let want = this.maxSpeed;
      if (this.stopAt != null && this.d >= this.stopAt) want = 0;
      if (this.stopFire > 0) { this.stopFire -= dt; want = 0; }
      // تجنب الحطام والآليات أمامها
      const ahead = this._blocker();
      if (ahead) {
        if (!ahead.alive) {
          this.blockedT += dt;
          if (this.blockedT > 1.2) this.offset = this.offset > 0 ? -7 : 7;
          want = Math.min(want, 3);
        } else want = Math.min(want, ahead.speed * 0.9);
      } else if (this.blockedT > 0) {
        this.blockedT -= dt;
        if (this.blockedT <= 0) this.offset = 0;
      }
      this.speed = damp(this.speed, want, 1.2, dt);
      this.d += this.speed * dt;
      this.offsetT = damp(this.offsetT, this.offset, 0.8, dt);
      const prev = _v2.copy(this.root.position);
      this._placeOnLane(false);
      this.vel.copy(this.root.position).sub(prev).divideScalar(Math.max(dt, 1e-4));
      if (this.d >= (this.arriveAt ?? this.lane.total - 2)) {
        if (this.behavior === 'pass' || this.team === 'friend') {
          this.arrived = true;
          w.onEntityEscaped(this);
          return;
        }
      }
      for (const tex of this.tracks) tex.offset.y -= this.speed * dt * 0.5;
      if (this.speed > 2 && Math.random() < dt * 4 * (this.speed / 10)) w.fx.dustTrail(_v.set(this.pos.x, this.pos.y, this.pos.z).addScaledVector(this.vel, -0.25), { size: this.cls === 'tank' ? 1.3 : 0.9 });
    } else {
      this.speed = 0;
      if (this.recoil > 0) this._settle(false);
    }
    this.recoil = Math.max(0, this.recoil - dt * 3);
    if (this.exhaust && Math.random() < dt * 6) w.fx.smokePuff(this.exhaust.getWorldPosition(_v), { size: 0.4, gray: 0.3 });

    // القتال
    const d2p = this.pos.distanceTo(w.player.pos);
    if (this.team === 'enemy' && !this.alerted) {
      const detectR = (900 + w.player.exposure * 2400) * (w.diff.id === 'easy' ? 0.8 : 1);
      if (d2p < detectR && w.player.exposure > 0.15) this.alerted = true;
      if (w.mission && w.mission.alertAll) this.alerted = true;
    }
    if (this.def.weapon && (this.alerted || this.team === 'friend')) {
      if (!this.tgt || !this.tgtValid(this.tgt) || Math.random() < dt * 0.15) this.tgt = this.pickTarget();
      if (this.tgt) {
        const err = this.aimAt(this.tgt, dt, this.cls === 'tank' ? 0.55 : 1.2);
        this.fireCd -= dt * (this.team === 'enemy' ? w.diff.enemyRate : 0.7);
        if (this.fireCd <= 0 && err < 0.06) {
          const wp = this.def.weapon;
          if (wp === 'grad') {
            this.fireCd = rand(38, 55);
            w.gradBarrage(this);
          } else if (wp === 'sam') {
            this.fireCd = rand(20, 35);
            w.samLaunch(this);
          } else {
            this.fireCd = { cannon: rand(7, 11), gun73: rand(6, 9), autocannon: rand(4, 6), dshk: rand(3, 5), pkm: rand(3, 5), zu23: rand(3.5, 5) }[wp] ?? 5;
            if (this.cls === 'tank' && this.lane && chance(0.5)) this.stopFire = rand(1.5, 3);
            this.fireWeapon(this.tgt);
            if (this.def.atgm && chance(0.25) && this.tgt.isPlayer && d2p < 3000) {
              w.after(1.5, () => { if (this.alive) this._fireAtgm(); });
            }
          }
        }
      } else if (this.turret && !this.def.static) {
        this.turretYaw = dampAngle(this.turretYaw, Math.sin(t * 0.2 + this.id) * 0.6, 0.5, dt);
        this.turret.rotation.y = this.turretYaw;
      }
    }
  }

  _fireAtgm() {
    const w = this.world;
    const from = this.center(new THREE.Vector3()).add(new THREE.Vector3(0, 1.4, 0));
    w.spawnEnemyProjectile({ kind: 'atgm', from, to: w.player.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), speed: 180, hit: true, target: w.player, damage: 40, source: this, guided: true });
    w.warn('atgm', from);
  }

  tgtValid(t) { return t.isPlayer ? true : t.alive; }

  _blocker() {
    const w = this.world;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    for (const e of w.entities) {
      if (e === this || e.escaped || !(e instanceof GroundVehicle) || e.cls === 'static') continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const fwd = dx * fx + dz * fz;
      if (fwd < 0.5 || fwd > 22) continue;
      const lat = Math.abs(dx * fz - dz * fx);
      if (lat < 4) return e;
    }
    return null;
  }
}

// منشأة ثابتة
export class StaticTarget extends GroundVehicle {
  constructor(world, type, opts) {
    super(world, type, { ...opts, lane: null });
    this.engageRange = 2200;
    if (type === 'buk' || type === 'atgm') this.engageRange = 3200;
  }
}

// ===================== المشاة =====================
export class Infantry extends Entity {
  constructor(world, type, opts = {}) {
    super(world, type, opts);
    this.home = opts.pos.clone();
    this.root.position.copy(opts.pos);
    this.root.position.y = world.terrain.heightAt(opts.pos.x, opts.pos.z);
    this.goal = null;
    this.walk = 0;
    this.legL = this.root.getObjectByName('legL');
    this.legR = this.root.getObjectByName('legR');
    this.fall = 0;
    this.fireCd = rand(2, 7);
    this.engageRange = this.def.weapon === 'rpg' ? 700 : 1500;
    this.heading = rand(0, 6.28);
    this.lane = opts.lane || null;
    this.d = opts.startD || 0;
  }

  onDeath(info) {
    if (info.source === 'tow' || info.source === 'drone' || info.source === 'rockets' || info.source === 'splash') {
      this.world.fx.impact(this.center(_v), { size: 1.4 });
    }
  }

  update(dt) {
    const w = this.world;
    if (!this.alive) {
      if (this.fall < 1) {
        this.fall = Math.min(1, this.fall + dt * 2.5);
        this.root.rotation.x = -this.fall * Math.PI / 2 * 0.95;
        this.root.position.y = w.terrain.heightAt(this.pos.x, this.pos.z) + this.fall * 0.15;
      }
      return;
    }
    // تحرك بين نقاط تغطية
    if (!this.goal || this.pos.distanceTo(this.goal) < 1.5) {
      if (this.lane) {
        this.d += 30;
        const s = samplePolyline(this.lane.pts, this.lane.cum, this.d);
        this.goal = new THREE.Vector3(s.x + rand(-6, 6), 0, s.z + rand(-6, 6));
      } else {
        this.goal = this.home.clone().add(new THREE.Vector3(rand(-25, 25), 0, rand(-25, 25)));
      }
      this.pause = rand(1, 5);
    }
    let moving = false;
    if (this.pause > 0) this.pause -= dt;
    else {
      const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) {
        const sp = (this.alerted ? 3.2 : 1.4) * (this.def.speed / 2.2);
        this.root.position.x += (dx / d) * sp * dt;
        this.root.position.z += (dz / d) * sp * dt;
        this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 6, dt);
        moving = true;
      }
    }
    this.root.position.y = w.terrain.heightAt(this.pos.x, this.pos.z);
    this.walk += dt * (moving ? 9 : 0);
    const sw = moving ? Math.sin(this.walk) * 0.6 : 0;
    if (this.legL) this.legL.rotation.x = sw;
    if (this.legR) this.legR.rotation.x = -sw;
    // القتال
    const d2p = this.pos.distanceTo(w.player.pos);
    if (!this.alerted && d2p < 600 + w.player.exposure * 1400 && w.player.exposure > 0.2) this.alerted = true;
    if (this.alerted || this.team === 'friend') {
      const tgt = this.pickTarget();
      if (tgt) {
        const tp = tgt.isPlayer ? tgt.pos : tgt.pos;
        if (!moving) this.heading = dampAngle(this.heading, Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z), 5, dt);
        this.fireCd -= dt * (this.team === 'enemy' ? w.diff.enemyRate : 0.6);
        if (this.fireCd <= 0 && !moving) {
          this.fireCd = this.def.weapon === 'rpg' ? rand(9, 14) : rand(3, 6);
          this.fireWeapon(tgt);
        }
      }
    }
    this.root.rotation.set(0, this.heading, 0);
  }
}

// ===================== مروحيات =====================
export class Helicopter extends Entity {
  constructor(world, type, opts = {}) {
    super(world, type, opts);
    const a = opts.angle ?? rand(-0.9, 0.9);
    const dist = opts.dist ?? 4800;
    this.root.position.set(Math.sin(a) * dist, 160, -Math.cos(a) * dist - 300);
    this.hover = new THREE.Vector3(Math.sin(a + rand(-0.4, 0.4)) * rand(1100, 1800), 0, -Math.cos(a) * rand(1100, 1800));
    this.hover.y = world.terrain.heightAt(this.hover.x, this.hover.z) + rand(55, 110);
    this.state = 'ingress';
    this.salvos = 0;
    this.maxSalvos = rand(3, 5) | 0;
    this.vel.set(0, 0, 0);
    this.heading = Math.atan2(-this.pos.x, -this.pos.z);
    this.fireCd = rand(5, 9);
    this.spin = 0;
    this.engine = world.audio.loop('heli', this.pos);
    this.alerted = true;
    this.spotted = true;
    world.warn('heli');
  }

  onDeath(info) {
    const w = this.world;
    this.state = 'dying';
    this.spin = rand(2, 4) * (Math.random() < 0.5 ? -1 : 1);
    w.fx.airBurst(this.center(_v), { size: 1.1 });
    this.burnT = 40;
  }

  update(dt) {
    if (this.escaped) return;
    const w = this.world;
    const t = w.time;
    const p = this.pos;
    if (this.rotor) this.rotor.rotation.y += dt * (this.state === 'dying' ? 18 : 26);
    if (this.tailRotor) this.tailRotor.rotation.x += dt * 70;
    this.engine?.update(p, this.vel);
    if (this.state === 'dying') {
      this.vel.y -= 9.8 * dt * 0.7;
      this.vel.x *= 0.99; this.vel.z *= 0.99;
      p.addScaledVector(this.vel, dt);
      this.heading += this.spin * dt;
      this.spin *= 1 + dt * 0.4;
      this.root.rotation.set(0.3, this.heading, 0.4, 'YXZ');
      w.fx.burn(this.center(_v), { dt, power: 1.2, key: `hd${this.id}`, radius: 1.2 });
      const gy = w.terrain.heightAt(p.x, p.z);
      if (p.y < gy + 1) {
        p.y = gy + 0.5;
        this.state = 'wreck';
        this.engine?.stop();
        w.fx.explosion(p.clone(), { size: 2.2, kind: 'he' });
        w.damageArea(p, 20, 60, { source: 'crash' });
        this.root.rotation.set(0.2, this.heading, 1.3, 'YXZ');
      }
      return;
    }
    if (this.state === 'wreck') {
      if (this.burnT > 0) { this.burnT -= dt; w.fx.burn(this.center(_v), { dt, power: 1, key: `hw${this.id}`, radius: 2 }); }
      return;
    }
    let target = this.hover;
    if (this.state === 'egress') target = _v2.set(p.x * 3, 220, p.z * 3 - 3000);
    const to = _v.copy(target).sub(p);
    const dist = to.length();
    const maxSp = this.state === 'attack' ? 6 : this.def.speed;
    const desired = to.normalize().multiplyScalar(Math.min(maxSp, dist * 0.5));
    if (this.state === 'attack') {
      desired.x += Math.sin(t * 0.35 + this.id) * 6;
      desired.y += Math.sin(t * 0.8 + this.id) * 1.5;
    }
    this.vel.lerp(desired, 1 - Math.exp(-0.9 * dt));
    p.addScaledVector(this.vel, dt);
    const gy = w.terrain.heightAt(p.x, p.z);
    if (p.y < gy + 30) p.y = damp(p.y, gy + 30, 2, dt);
    // التوجه نحو اللاعب عند الهجوم
    const toP = Math.atan2(w.player.pos.x - p.x, w.player.pos.z - p.z);
    const velH = Math.atan2(this.vel.x, this.vel.z);
    const wantH = this.state === 'attack' ? toP : (this.vel.lengthSq() > 4 ? velH : this.heading);
    this.heading = dampAngle(this.heading, wantH, 1.2, dt);
    const sp = this.vel.length();
    const pitch = clamp(sp / 80, 0, 0.3) * (this.state === 'attack' ? 0.3 : 1);
    this.root.rotation.set(pitch, this.heading, Math.sin(t * 0.7) * 0.04, 'YXZ');
    if (this.state === 'ingress' && dist < 40) this.state = 'attack';
    if (this.state === 'attack') {
      this.fireCd -= dt * w.diff.enemyRate;
      const aligned = Math.abs(angleWrap(toP - this.heading)) < 0.15;
      if (this.fireCd <= 0 && aligned) {
        this.fireCd = rand(8, 13);
        this.salvos++;
        w.rocketSalvo(this);
        if (this.salvos >= this.maxSalvos) w.after(4, () => { if (this.alive) this.state = 'egress'; });
      }
      if (this.hp < this.maxHp * 0.4) this.state = 'egress';
    }
    if (this.state === 'egress' && p.length() > 6500) {
      this.engine?.stop();
      w.onEntityEscaped(this, true);
    }
  }
}

// ===================== المقاتلات =====================
export class Jet extends Entity {
  constructor(world, type, opts = {}) {
    super(world, type, opts);
    const a = opts.angle ?? rand(-1.2, 1.2);
    this.target = opts.target || world.player.pos.clone();
    const R = 7500;
    this.dir = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)); // من الأمام نحو اللاعب
    this.root.position.set(this.target.x - this.dir.x * R, 1400, this.target.z - this.dir.z * R);
    this.speedJ = this.def.speed;
    this.vel.copy(this.dir).multiplyScalar(this.speedJ);
    this.state = 'approach';
    this.bombs = type === 'su34' ? 4 : 3;
    this.flared = 0;
    this.engine = world.audio.loop('jet', this.pos);
    this.alerted = true;
    this.spotted = true;
    this.aimOffset = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(rand(8, 60) / world.diff.enemyAcc);
    world.warn('jet');
  }

  onDeath() {
    const w = this.world;
    this.state = 'dying';
    w.fx.airBurst(this.center(_v), { size: 1.8 });
    this.root.traverse((o) => { if (o.name === 'afterburner') o.visible = false; });
  }

  deployFlares() {
    if (this.flared > 2) return false;
    this.flared++;
    this.world.fx.flares(this.center(_v), this.vel);
    return true;
  }

  update(dt) {
    if (this.escaped) return;
    const w = this.world;
    const p = this.pos;
    this.engine?.update(p, this.vel);
    if (this.state === 'dying') {
      this.vel.y -= 9.8 * dt;
      p.addScaledVector(this.vel, dt);
      this.root.rotation.z += dt * 2.5;
      w.fx.burn(this.center(_v), { dt: dt * 2, power: 1.4, key: `jd${this.id}`, radius: 2 });
      const gy = w.terrain.heightAt(p.x, p.z);
      if (p.y < gy + 2) {
        this.state = 'wreck';
        this.engine?.stop();
        p.y = gy;
        w.fx.explosion(p.clone(), { size: 3, kind: 'he' });
        this.root.visible = false;
        this.root.userData.hiddenByGame = true;
      }
      return;
    }
    if (this.state === 'wreck') return;
    const tgt = _v2.copy(this.target).add(this.aimOffset);
    const horiz = Math.hypot(tgt.x - p.x, tgt.z - p.z);
    if (this.state === 'approach') {
      // انقضاض إلى ارتفاع القصف
      const wantY = 650;
      this.vel.y = damp(this.vel.y, (wantY - p.y) * 0.25, 1, dt);
      const fall = Math.sqrt((2 * Math.max(50, p.y - tgt.y)) / 9.8);
      const lead = this.speedJ * fall;
      if (horiz < lead + 40) {
        this.state = 'release';
        this.relT = 0;
      }
    }
    if (this.state === 'release') {
      this.relT -= dt;
      if (this.relT <= 0 && this.bombs > 0) {
        this.bombs--;
        this.relT = 0.22;
        w.dropBomb(this);
      }
      if (this.bombs <= 0) this.state = 'climb';
    }
    if (this.state === 'climb') {
      this.vel.y = damp(this.vel.y, 90, 0.8, dt);
      if (p.length() > 11000) {
        this.engine?.stop();
        w.onEntityEscaped(this, true);
        return;
      }
    }
    p.addScaledVector(this.vel, dt);
    const h = Math.atan2(this.vel.x, this.vel.z);
    const pitch = Math.atan2(this.vel.y, this.speedJ);
    this.root.rotation.set(-pitch, h, Math.sin(w.time * 0.6 + this.id) * 0.15, 'YXZ');
    if (Math.random() < dt * 30) w.fx.smokePuff(this.exhaust.getWorldPosition(_v), { size: 1.2, gray: 0.85 });
  }
}

// ===================== المسيّرات الإيرانية =====================
export class Drone extends Entity {
  constructor(world, type, opts = {}) {
    super(world, type, opts);
    const a = opts.angle ?? rand(-0.8, 0.8);
    this.root.position.set(Math.sin(a) * 4200, type === 'kamikaze' ? 180 : 420, -Math.cos(a) * 4200);
    this.state = 'cruise';
    this.orbitA = a;
    this.engine = world.audio.loop('moped', this.pos);
    this.alerted = true;
    this.spotted = type !== 'kamikaze' || world.diff.markers;
    if (type === 'kamikaze') world.warn('drone');
  }

  onDeath() {
    this.engine?.stop();
    this.world.fx.airBurst(this.center(_v), { size: this.type === 'kamikaze' ? 1.2 : 0.7 });
    this.falling = true;
  }

  update(dt) {
    const w = this.world;
    const p = this.pos;
    if (this.rotor) this.rotor.rotation.z += dt * 60;
    if (!this.alive) {
      if (this.falling) {
        this.vel.y -= 9.8 * dt;
        p.addScaledVector(this.vel, dt);
        this.root.rotation.x += dt * 2;
        if (p.y < w.terrain.heightAt(p.x, p.z)) { this.falling = false; this.root.visible = false; this.root.userData.hiddenByGame = true; }
      }
      return;
    }
    this.engine?.update(p, this.vel);
    const pp = w.player.pos;
    if (this.type === 'recon') {
      // تحليق دائري فوق الموقع وكشفه
      this.orbitA += dt * 0.06;
      const tgt = _v2.set(Math.sin(this.orbitA) * 700, 420, -Math.cos(this.orbitA) * 700 - 200);
      const to = tgt.sub(p);
      this.vel.lerp(to.normalize().multiplyScalar(this.def.speed), 1 - Math.exp(-0.5 * dt));
      if (p.distanceTo(pp) < 1500) w.player.exposure = Math.min(1, w.player.exposure + dt * 0.08);
    } else {
      const to = _v2.copy(pp).add(_v.set(0, 1, 0)).sub(p);
      const d = to.length();
      const sp = this.def.speed * (d < 900 ? 1.25 : 1);
      if (d > 600 && p.y < pp.y + 120) to.y += 60;
      this.vel.lerp(to.normalize().multiplyScalar(sp), 1 - Math.exp(-1.2 * dt));
      if (d < 4) {
        const hitPlayer = !w.player.inCover || Math.random() < 0.35;
        w.fx.explosion(p.clone(), { size: 1.2 });
        if (hitPlayer) w.player.damage(42, p, 'drone');
        else w.player.damage(8, p, 'drone');
        this.alive = false;
        this.engine?.stop();
        this.root.visible = false;
        this.root.userData.hiddenByGame = true;
        w.onEntityEscaped(this, true);
        return;
      }
    }
    p.addScaledVector(this.vel, dt);
    const h = Math.atan2(this.vel.x, this.vel.z);
    this.root.rotation.set(-Math.atan2(this.vel.y, Math.hypot(this.vel.x, this.vel.z)), h, 0.1, 'YXZ');
  }
}

export function createEntity(world, type, opts) {
  const cls = UNITS[type].cls;
  if (cls === 'infantry') return new Infantry(world, type, opts);
  if (cls === 'heli') return new Helicopter(world, type, opts);
  if (cls === 'jet') return new Jet(world, type, opts);
  if (cls === 'drone') return new Drone(world, type, opts);
  if (cls === 'static') return new StaticTarget(world, type, opts);
  return new GroundVehicle(world, type, opts);
}
