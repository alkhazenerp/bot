// المقذوفات: تاو موجّه سلكياً، رصاص الرشاش، إيغلا، مسيّرة شاهين، رشقات الراجمة، ومقذوفات العدو
import * as THREE from 'three';
import { towMissileModel, rocketModel, bombModel, shellModel, fpvDroneModel } from '../engine/models.js';
import { clamp, rand, chance, damp, distToSegment2 } from '../core/util.js';

const Z = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
let pid = 1;

function orient(obj, dir) {
  obj.quaternion.setFromUnitVectors(Z, _v3.copy(dir).normalize());
}

// ضرر رصاص 14.5 حسب نوع الهدف
export function mgDamage(ent) {
  return { infantry: 10, technical: 6, truck: 4.5, ifv: 2.2, tank: 0.25, heli: 3.5, jet: 3.2, drone: 6, aa: 3, artillery: 4.5 }[ent.cls]
    ?? (ent.type === 'atgm' ? 10 : ent.type === 'checkpoint' ? 2 : ent.type === 'bunker' ? 1.2 : ent.type === 'depot' ? 0.5 : 1);
}

// ===================== صاروخ تاو =====================
export class TowMissile {
  constructor(world, player, { topAttack = false } = {}) {
    this.world = world;
    this.player = player;
    this.id = `m${pid++}`;
    this.top = topAttack;
    this.pos = player.launcherMuzzle(new THREE.Vector3());
    this.origin = this.pos.clone();
    this.dir = player.aimDir(new THREE.Vector3());
    this.speed = 75;
    this.t = 0;
    this.traveled = 0;
    this.range = 3750;
    this.wireOk = true;
    this.alive = true;
    this.launchTime = world.time;
    this.obj = towMissileModel();
    this.obj.position.copy(this.pos);
    orient(this.obj, this.dir);
    world.add(this.obj);
    world.recorder?.register(this.id, this.obj, null);
    this.turn = 1.25 + (player.upg.tow_guide || 0) * 0.35;
    this.prev = this.pos.clone();
    this.wirePts = [this.origin.clone()];
    this.wireAge = [0];
    this.wireGeo = new THREE.BufferGeometry();
    this.wireArr = new Float32Array(260 * 3);
    this.wireGeo.setAttribute('position', new THREE.BufferAttribute(this.wireArr, 3));
    this.wire = new THREE.Line(this.wireGeo, new THREE.LineBasicMaterial({ color: 0x8a6a40, transparent: true, opacity: 0.75 }));
    this.wire.frustumCulled = false;
    this.wire.userData.heat = 0.5;
    world.add(this.wire);
    this.wireLife = 0;
    this.jam = 0;
    this.motor = world.audio.loop('motor', this.pos);
    this.lastWire = 0;
    world.fx.launchBlast(this.pos.clone(), this.dir.clone());
  }

  _guide(dt) {
    const w = this.world, pl = this.player;
    if (!pl.isGuiding()) { if (this.wireOk) w.hudMsg('lost'); this.wireOk = false; }
    if (this.traveled > this.range) { this.wireOk = false; this.breakT ??= 1.5; }
    if (!this.wireOk) return;
    const o = pl.sightPos(_v), a = pl.aimDir(_v2);
    const along = _v3.copy(this.pos).sub(o).dot(a);
    const look = along + 30 + this.speed * 0.12;
    const want = o.clone().addScaledVector(a, look);
    if (this.top) want.y += 2.4;
    // تذبذب التصحيح الطبيعي + تشويش شتورا
    const wob = 0.12 + this.jam * 3.2;
    want.x += Math.sin(this.t * 7.3) * wob + Math.sin(this.t * 1.7) * this.jam * 2;
    want.y += Math.cos(this.t * 6.1) * wob + Math.cos(this.t * 2.3) * this.jam * 2.2;
    const desired = want.sub(this.pos).normalize();
    const ang = this.dir.angleTo(desired);
    const maxA = this.turn * dt * (this.t < 0.4 ? 0.3 : 1);
    if (ang > 1e-5) this.dir.lerp(desired, Math.min(1, maxA / ang)).normalize();
  }

  _shtora() {
    // T-90 بمنظومة شتورا تشوش الصاروخ إن كان ضمن قوسها الأمامي
    const w = this.world;
    let jam = 0;
    for (const e of w.entities) {
      if (!e.alive || !e.def.shtora || !e.shtoraOn) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d > 2200 || d < 60) continue;
      const fwd = _v.set(0, 0, 1).applyQuaternion(e.turret ? e.turret.getWorldQuaternion(new THREE.Quaternion()) : e.root.quaternion);
      const toM = _v2.copy(this.pos).sub(e.pos).normalize();
      if (fwd.dot(toM) > Math.cos(0.9)) jam = Math.max(jam, 1 - d / 2200);
    }
    if (jam > 0.05 && this.jam < 0.05) w.hudMsg('shtora');
    this.jam = damp(this.jam, jam, 2, 1 / 60);
  }

  update(dt) {
    const w = this.world;
    if (!this.alive) {
      this.wireLife += dt;
      if (this.wireLife > 8) { w.remove(this.wire); this.wireGeo.dispose(); return false; }
      this._updateWire(dt);
      return true;
    }
    this.t += dt;
    if (this.t < 0.14) this.speed = 75;
    else if (this.t < 1.5) this.speed = damp(this.speed, 285, 2.4, dt);
    else this.speed = Math.max(205, this.speed - dt * 4);
    this._shtora();
    this._guide(dt);
    if (!this.wireOk) {
      this.dir.y -= dt * 0.03;
      this.dir.normalize();
      if (this.breakT != null) {
        this.breakT -= dt;
        if (this.breakT <= 0) return this._explode(this.pos.clone(), null, null, true);
      }
    }
    this.prev.copy(this.pos);
    this.pos.addScaledVector(this.dir, this.speed * dt);
    this.traveled += this.speed * dt;
    this.obj.position.copy(this.pos);
    orient(this.obj, this.dir);
    this.obj.rotateZ(this.t * 9);
    if (this.t > 0.14) w.fx.missileTrail(this.prev.clone(), this.pos.clone(), { step: 1.3 });
    this.motor.update(this.pos);
    // الحبل السلكي
    if (this.traveled - this.lastWire > 8) {
      this.lastWire = this.traveled;
      this.wirePts.push(this.pos.clone());
      this.wireAge.push(0);
    }
    this._updateWire(dt);
    // الهجوم العلوي
    if (this.top && this.t > 0.6) {
      for (const e of w.entities) {
        if (!e.alive || e.cls === 'infantry' || e.cls === 'heli' || e.cls === 'jet' || e.cls === 'drone') continue;
        const r = distToSegment2(e.pos.x, e.pos.z, this.prev.x, this.prev.z, this.pos.x, this.pos.z);
        const y = this.prev.y + (this.pos.y - this.prev.y) * r.t;
        if (r.d < 2.2 && y > e.pos.y + 1 && y < e.pos.y + e.height + 5) {
          const pt = this.prev.clone().lerp(this.pos, r.t);
          return this._explode(pt, e, { side: 'top', part: 'turret', point: pt }, false, true);
        }
      }
    }
    const hit = w.segmentHit(this.prev, this.pos, { ignorePlayer: true });
    if (hit) return this._explode(hit.point, hit.entity, hit);
    if (this.traveled > this.range + 600) return this._explode(this.pos.clone(), null, null, true);
    return true;
  }

  _updateWire(dt) {
    const w = this.world;
    const pts = this.wirePts;
    for (let i = 1; i < pts.length; i++) {
      this.wireAge[i] += dt;
      const gy = w.terrain.heightAt(pts[i].x, pts[i].z) + 0.05;
      if (pts[i].y > gy) pts[i].y = Math.max(gy, pts[i].y - dt * Math.min(6, this.wireAge[i] * 1.5));
    }
    const n = Math.min(pts.length + (this.alive ? 1 : 0), 259);
    const start = Math.max(0, pts.length - 258);
    let k = 0;
    const arr = this.wireArr;
    const m = this.player.launcherMuzzle(_v);
    arr[0] = m.x; arr[1] = m.y; arr[2] = m.z; k = 1;
    for (let i = start + 1; i < pts.length; i++) { arr[k * 3] = pts[i].x; arr[k * 3 + 1] = pts[i].y; arr[k * 3 + 2] = pts[i].z; k++; }
    if (this.alive) { arr[k * 3] = this.pos.x; arr[k * 3 + 1] = this.pos.y; arr[k * 3 + 2] = this.pos.z; k++; }
    this.wireGeo.setDrawRange(0, k);
    this.wireGeo.attributes.position.needsUpdate = true;
  }

  _explode(point, ent, hit, air = false, top = false) {
    const w = this.world;
    this.alive = false;
    this.motor.stop();
    this.obj.visible = false;
    w.remove(this.obj);
    const dist = point.distanceTo(this.origin);
    let killed = false;
    if (ent && ent.alive) {
      const dmg = top ? 185 : 100;
      const wasMoving = ent.speed > 1.5;
      killed = ent.takeDamage(dmg, { side: hit.side, part: hit.part, source: 'tow', distance: dist, moving: wasMoving, point });
      if (!killed) w.fx.explosion(point, { size: 0.8 });
      w.onPlayerHit(ent, { source: 'tow', killed, distance: dist, side: hit.side, part: hit.part, moving: wasMoving });
    } else {
      if (hit && hit.surface === 'water') w.fx.splash(point, { size: 1 });
      else w.fx.explosion(point, { size: air ? 0.6 : 0.85, kind: air ? 'air' : 'he' });
      if (!ent) w.onPlayerMiss('tow');
    }
    if (top) { w.fx.sparks(point, 30, 30); }
    w.damageArea(point, 7, 45, { source: 'splash', exclude: ent });
    w.onMissileEnd(this, { point, ent, killed, dist });
    return true;
  }

  kill() {
    if (!this.alive) return;
    this._explode(this.pos.clone(), null, null, true);
  }
}

// ===================== رصاصة رشاش اللاعب =====================
export class Bullet {
  constructor(world, pos, vel, tracer) {
    this.world = world;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.life = 2.6;
    this.origin = pos.clone();
    if (tracer) world.fx.tracer(pos, vel, { life: 2.2, color: [7, 2.4, 0.8], size: 0.2, stretch: 0.012 });
  }

  update(dt) {
    const w = this.world;
    this.life -= dt;
    if (this.life <= 0) return false;
    const p1 = _v.copy(this.pos).addScaledVector(this.vel, dt);
    this.vel.y -= 9.8 * dt * 0.5;
    const hit = w.segmentHit(this.pos, p1, { ignorePlayer: true, bullet: true });
    if (hit) {
      if (hit.entity && hit.entity.alive) {
        const e = hit.entity;
        const metal = e.cls !== 'infantry';
        w.fx.impact(hit.point, { size: 0.6, metal });
        const dmg = mgDamage(e);
        const killed = e.takeDamage(dmg, { side: hit.side, part: hit.part, source: 'mg', distance: hit.point.distanceTo(this.origin) });
        w.onPlayerHit(e, { source: 'mg', killed, distance: hit.point.distanceTo(this.origin), quiet: !killed });
      } else if (hit.surface === 'water') w.fx.splash(hit.point, { size: 0.25 });
      else w.fx.impact(hit.point, { size: 0.7, metal: hit.surface === 'building' && Math.random() < 0.3 });
      return false;
    }
    this.pos.copy(p1);
    return true;
  }
}

// ===================== صاروخ إيغلا =====================
export class IglaMissile {
  constructor(world, player, target) {
    this.world = world;
    this.id = `i${pid++}`;
    this.target = target;
    this.pos = player.sightPos(new THREE.Vector3()).add(player.aimDir(new THREE.Vector3()).multiplyScalar(1.2));
    this.dir = player.aimDir(new THREE.Vector3());
    this.speed = 30;
    this.t = 0;
    this.alive = true;
    this.obj = rocketModel(0.75, 'camo');
    world.add(this.obj);
    world.recorder?.register(this.id, this.obj, null);
    this.decoy = null;
    this.decided = false;
    this.prev = this.pos.clone();
    world.fx.muzzleFlash(this.pos.clone(), this.dir.clone(), { size: 0.8, sound: 'rifle' });
    world.audio.towLaunch();
    this.launchTime = world.time;
  }

  update(dt) {
    const w = this.world;
    if (!this.alive) return false;
    this.t += dt;
    this.speed = this.t < 0.25 ? 30 : Math.min(620, this.speed + dt * 900);
    let tp = null;
    const tg = this.target;
    if (this.decoy) tp = this.decoy;
    else if (tg && tg.alive) {
      tp = tg.center(new THREE.Vector3());
      // توجيه بقيادة مسبقة
      const tt = tp.distanceTo(this.pos) / Math.max(this.speed, 100);
      tp.addScaledVector(tg.vel, tt * 0.8);
      if (!this.decided && this.t > 0.7 && tg.cls === 'jet') {
        this.decided = true;
        if (chance(w.diff.flares) && tg.deployFlares) {
          tg.deployFlares();
          this.decoy = tg.center(new THREE.Vector3()).add(new THREE.Vector3(rand(-30, 30), -40, rand(-30, 30)));
          w.hudMsg('flares');
        }
      } else if (!this.decided && this.t > 0.7 && tg.cls === 'heli') {
        this.decided = true;
        if (chance(w.diff.flares * 0.6)) {
          w.fx.flares(tg.center(new THREE.Vector3()), tg.vel);
          this.decoy = tg.center(new THREE.Vector3()).add(new THREE.Vector3(rand(-20, 20), -25, rand(-20, 20)));
          w.hudMsg('flares');
        }
      }
    }
    if (tp && this.t > 0.25) {
      const desired = _v.copy(tp).sub(this.pos).normalize();
      const ang = this.dir.angleTo(desired);
      const maxA = 4.5 * dt;
      if (ang > 1e-5) this.dir.lerp(desired, Math.min(1, maxA / ang)).normalize();
    }
    this.prev.copy(this.pos);
    this.pos.addScaledVector(this.dir, this.speed * dt);
    this.obj.position.copy(this.pos);
    orient(this.obj, this.dir);
    if (this.t > 0.25) w.fx.rocketTrail(this.prev.clone(), this.pos.clone());
    if (this.decoy && this.pos.distanceTo(this.decoy) < 8) {
      w.fx.airBurst(this.pos.clone(), { size: 0.5 });
      this.alive = false; w.remove(this.obj);
      w.onPlayerMiss('igla');
      return false;
    }
    // صمام تقاربي على طول مسار الإطار كله (السرعة 620 م/ث تقفز فوق كرة صغيرة)
    let near = false;
    if (!this.decoy && tg && tg.alive) {
      const c = tg.center(_v2);
      const seg = _v3.copy(this.pos).sub(this.prev);
      const L2 = seg.lengthSq() || 1;
      const k = clamp(_v.copy(c).sub(this.prev).dot(seg) / L2, 0, 1);
      near = this.prev.clone().addScaledVector(seg, k).distanceTo(c) < 8;
    }
    if (near) {
      w.fx.airBurst(this.pos.clone(), { size: 0.7 });
      const killed = tg.takeDamage(110, { side: 'side', part: 'hull', source: 'igla', distance: this.pos.length() });
      w.onPlayerHit(tg, { source: 'igla', killed, distance: this.pos.length() });
      this.alive = false; w.remove(this.obj);
      return false;
    }
    const hit = w.segmentHit(this.prev, this.pos, { ignorePlayer: true });
    if (hit || this.t > 14) {
      w.fx.explosion(hit ? hit.point : this.pos.clone(), { size: 0.5, kind: hit ? 'he' : 'air' });
      if (hit && hit.entity && hit.entity.alive) {
        const air = hit.entity.cls === 'heli' || hit.entity.cls === 'jet' || hit.entity.cls === 'drone';
        const killed = hit.entity.takeDamage(air ? 110 : 60, { side: hit.side, source: 'igla' });
        w.onPlayerHit(hit.entity, { source: 'igla', killed, distance: this.pos.length() });
      } else w.onPlayerMiss('igla');
      this.alive = false; w.remove(this.obj);
      return false;
    }
    return true;
  }
}

// ===================== مسيّرة شاهين الانتحارية =====================
export class FPVDrone {
  constructor(world, player) {
    this.world = world;
    this.player = player;
    this.id = `d${pid++}`;
    this.pos = player.pos.clone().add(new THREE.Vector3(0.8, 2.5, -1.5));
    this.yaw = player.yaw;
    this.pitch = 0.08;
    this.roll = 0;
    this.speed = 20;
    this.battery = 80;
    this.alive = true;
    this.obj = fpvDroneModel();
    this.obj.position.copy(this.pos);
    world.add(this.obj);
    world.recorder?.register(this.id, this.obj, null);
    this.vel = new THREE.Vector3();
    this.cls = 'drone';
    this.team = 'friend';
    this.isFPV = true;
    this.buzz = world.audio.loop('fpv', null);
    this.boost = 0;
    this.launchTime = world.time;
    this.signal = 1;
  }

  forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  center(out = new THREE.Vector3()) { return out.copy(this.pos); }

  get alive_() { return this.alive; }

  steer(dYaw, dPitch, dt) {
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, -1.35, 0.9);
    this.roll = damp(this.roll, clamp(-dYaw / Math.max(dt, 1e-3) * 0.35, -0.9, 0.9), 6, dt);
  }

  update(dt) {
    const w = this.world;
    if (!this.alive) return false;
    this.battery -= dt;
    const want = 48 + this.boost * 22;
    this.speed = damp(this.speed, want, 1.5, dt);
    const f = this.forward(_v);
    this.vel.copy(f).multiplyScalar(this.speed);
    const prev = this.pos.clone();
    this.pos.addScaledVector(this.vel, dt);
    this.obj.position.copy(this.pos);
    this.obj.rotation.set(this.pitch - 0.35, -this.yaw, this.roll, 'YXZ');
    this.buzz.throttle(0.4 + this.boost * 0.6);
    const d = this.pos.distanceTo(this.player.pos);
    this.signal = clamp(1 - d / 4200, 0, 1);
    const hit = w.segmentHit(prev, this.pos, { ignorePlayer: true });
    if (hit || this.battery <= 0 || this.signal <= 0) {
      const p = hit ? hit.point : this.pos.clone();
      this.alive = false;
      this.buzz.stop();
      w.remove(this.obj);
      w.fx.explosion(p, { size: 1.15 });
      let killed = false;
      if (hit && hit.entity && hit.entity.alive) {
        killed = hit.entity.takeDamage(150, { side: hit.entity.cls === 'tank' ? 'top' : hit.side, part: hit.part, source: 'drone', distance: d });
        w.onPlayerHit(hit.entity, { source: 'drone', killed, distance: d });
      } else w.onPlayerMiss('drone');
      w.damageArea(p, 9, 50, { source: 'splash', exclude: hit && hit.entity });
      w.onDroneEnd(this, { point: p, killed, ent: hit && hit.entity });
      return false;
    }
    return true;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.battery -= amount * 3;
    if (Math.random() < amount * 0.04) {
      this.battery = 0;
    }
    return false;
  }
}

// ===================== صاروخ رشقة الراجمة =====================
export class BarrageRocket {
  constructor(world, start, target, T, opts = {}) {
    this.world = world;
    this.id = `r${pid++}`;
    this.pos = start.clone();
    this.vel = target.clone().sub(start).addScaledVector(new THREE.Vector3(0, -9.8, 0), -0.5 * T * T).divideScalar(T);
    this.alive = true;
    this.obj = rocketModel(1.3, opts.enemy ? 'camo' : 'dark');
    world.add(this.obj);
    world.recorder?.register(this.id, this.obj, null);
    this.prev = this.pos.clone();
    this.enemy = !!opts.enemy;
    this.damage = opts.damage ?? 70;
    this.t = 0;
  }

  update(dt) {
    const w = this.world;
    if (!this.alive) return false;
    this.t += dt;
    this.prev.copy(this.pos);
    this.vel.y -= 9.8 * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.obj.position.copy(this.pos);
    orient(this.obj, this.vel);
    w.fx.rocketTrail(this.prev.clone(), this.pos.clone(), { dark: this.enemy });
    const hit = w.terrain.segmentHit(this.prev, this.pos, _v);
    if (hit || this.t > 30) {
      const p = hit ? hit.clone() : this.pos.clone();
      this.alive = false;
      w.remove(this.obj);
      w.fx.explosion(p, { size: 1.15 });
      if (this.enemy) w.enemyBlast(p, 22, this.damage);
      else w.damageArea(p, 20, this.damage, { source: 'rockets', player: true });
      return false;
    }
    return true;
  }
}

// ===================== مقذوفات العدو =====================
export class EnemyProjectile {
  constructor(world, o) {
    this.world = world;
    this.o = o;
    this.id = `e${pid++}`;
    this.pos = o.from.clone();
    this.to = o.to.clone();
    this.dir = this.to.clone().sub(this.pos);
    this.total = this.dir.length();
    this.dir.normalize();
    this.speed = o.speed;
    this.traveled = 0;
    this.alive = true;
    this.kind = o.kind;
    this.prev = this.pos.clone();
    this.obj = null;
    if (o.kind === 'shell') this.obj = shellModel();
    else if (o.kind === 'rpg' || o.kind === 'atgm' || o.kind === 'rocket') this.obj = rocketModel(o.kind === 'atgm' ? 0.9 : 0.7, 'dark');
    if (this.obj) {
      this.obj.position.copy(this.pos);
      orient(this.obj, this.dir);
      world.add(this.obj);
      world.recorder?.register(this.id, this.obj, null);
    }
    if (o.kind === 'bullet' && (o.tracerEvery == null || (o.idx || 0) % o.tracerEvery === 0)) {
      world.fx.tracer(this.pos, this.dir.clone().multiplyScalar(this.speed), { life: this.total / this.speed, color: o.tracer || [1.5, 6, 1.2], size: 0.16, stretch: 0.012 });
    }
    this.whizzed = false;
  }

  update(dt) {
    const w = this.world;
    if (!this.alive) return false;
    const o = this.o;
    if (o.guided && o.target && o.target.isPlayer) {
      // صاروخ موجه يتبع اللاعب ما لم يحتمِ
      const tgt = o.target.inCover ? o.target.pos.clone().add(new THREE.Vector3(0, 0.3, -2.8)) : o.target.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
      this.to.lerp(tgt, 1 - Math.exp(-2 * dt));
      const d = this.to.clone().sub(this.pos);
      this.total = this.traveled + d.length();
      this.dir.lerp(d.normalize(), 1 - Math.exp(-3 * dt)).normalize();
      this.dir.y += Math.sin(this.traveled * 0.05) * 0.003;
    }
    this.prev.copy(this.pos);
    const step = this.speed * dt;
    this.pos.addScaledVector(this.dir, step);
    this.traveled += step;
    if (this.obj) { this.obj.position.copy(this.pos); orient(this.obj, this.dir); }
    if (this.kind === 'rpg' || this.kind === 'atgm' || this.kind === 'rocket') w.fx.rocketTrail(this.prev.clone(), this.pos.clone(), { dark: this.kind !== 'atgm' });
    else if (this.kind === 'shell' && Math.random() < 0.5) w.fx.smokePuff(this.pos, { size: 0.3, gray: 0.8 });
    const pp = w.player.pos;
    if (!this.whizzed && this.kind === 'bullet' && this.pos.distanceTo(pp) < 14) { this.whizzed = true; if (Math.random() < 0.5) w.audio.whiz(); }
    if (this.traveled >= this.total) return this._impact();
    // اصطدام مبكر بالأرض للقذائف الضالة
    if (this.kind !== 'bullet' && this.traveled > 30) {
      const gy = w.terrain.groundAt(this.pos.x, this.pos.z);
      if (this.pos.y < gy) { this.to.copy(this.pos); this.to.y = gy; return this._impact(true); }
    }
    return true;
  }

  _impact(ground = false) {
    const w = this.world;
    const o = this.o;
    this.alive = false;
    if (this.obj) w.remove(this.obj);
    const p = this.to;
    const tgt = o.target;
    let hit = o.hit && !ground;
    if (tgt && tgt.isPlayer && tgt.inCover && this.kind !== 'bullet') hit = Math.random() < 0.05;
    if (this.kind === 'bullet') {
      if (hit && tgt) {
        if (tgt.isPlayer) tgt.damage(o.damage, o.from, 'bullet');
        else if (tgt.alive) tgt.takeDamage(o.damage * 0.5, { side: 'side', source: 'enemy' });
      } else w.fx.impact(p, { size: 0.5 });
      return false;
    }
    const size = this.kind === 'shell' ? 0.75 : this.kind === 'atgm' ? 0.85 : 0.6;
    if (tgt && tgt.isPlayer) {
      const near = p.distanceTo(tgt.pos);
      if (hit) {
        // انفجار أمام الموقع ليكون مرئياً
        const vis = tgt.pos.clone().add(tgt.forwardFlat(new THREE.Vector3()).multiplyScalar(4));
        vis.y = w.terrain.heightAt(vis.x, vis.z) + 0.8;
        w.fx.explosion(vis, { size });
        tgt.damage(o.damage, o.from, this.kind);
      } else {
        w.fx.explosion(p, { size });
        if (near < 12) tgt.damage(o.damage * 0.25 * (1 - near / 12), o.from, 'splash');
      }
    } else {
      w.fx.explosion(p, { size });
      if (hit && tgt && tgt.alive) tgt.takeDamage(o.damage * 1.2, { side: 'side', source: 'enemy' });
    }
    return false;
  }
}

// ===================== قنبلة الطائرة =====================
export class Bomb {
  constructor(world, pos, vel) {
    this.world = world;
    this.id = `b${pid++}`;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.obj = bombModel();
    this.obj.position.copy(pos);
    world.add(this.obj);
    world.recorder?.register(this.id, this.obj, null);
    this.prev = pos.clone();
    this.alive = true;
  }

  update(dt) {
    const w = this.world;
    if (!this.alive) return false;
    this.prev.copy(this.pos);
    this.vel.y -= 9.8 * dt;
    this.vel.multiplyScalar(1 - dt * 0.02);
    this.pos.addScaledVector(this.vel, dt);
    this.obj.position.copy(this.pos);
    orient(this.obj, this.vel);
    const hit = w.terrain.segmentHit(this.prev, this.pos, _v);
    if (hit) {
      const p = hit.clone();
      this.alive = false;
      w.remove(this.obj);
      w.fx.explosion(p, { size: 2.8, kind: 'bomb' });
      w.enemyBlast(p, 55, 115);
      return false;
    }
    return true;
  }
}

// صاروخ دفاع جوي (مشهد بصري)
export class SamMissile {
  constructor(world, from) {
    this.world = world;
    this.id = `s${pid++}`;
    this.pos = from.clone();
    this.vel = new THREE.Vector3(rand(-20, 20), 60, rand(-80, -20));
    this.t = 0;
    this.alive = true;
    this.obj = rocketModel(2.4, 'missile');
    world.add(this.obj);
    world.recorder?.register(this.id, this.obj, null);
    this.prev = this.pos.clone();
    world.fx.muzzleFlash(from, new THREE.Vector3(0, 1, 0), { size: 1.6, sound: 'cannon' });
  }

  update(dt) {
    const w = this.world;
    this.t += dt;
    this.prev.copy(this.pos);
    const acc = this.vel.clone().normalize().multiplyScalar(this.t < 6 ? 140 : 0);
    acc.y += this.t > 1.5 ? -20 : 0;
    this.vel.addScaledVector(acc, dt);
    this.pos.addScaledVector(this.vel, dt);
    this.obj.position.copy(this.pos);
    orient(this.obj, this.vel);
    w.fx.rocketTrail(this.prev.clone(), this.pos.clone());
    if (this.t > 9) {
      w.fx.airBurst(this.pos.clone(), { size: 1 });
      w.remove(this.obj);
      return false;
    }
    return true;
  }
}
