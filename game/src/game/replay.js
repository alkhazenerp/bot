// تسجيل اللقطات وإعادة عرضها سينمائياً (كاميرا ملاحقة الصاروخ، تبطيء عند الإصابة، دوران حول الانفجار)
import * as THREE from 'three';
import { clamp, smoothstep, lerp } from '../core/util.js';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export class Recorder {
  constructor(world, { seconds = 40, hz = 30 } = {}) {
    this.world = world;
    this.objs = new Map();
    this.frames = [];
    this.seconds = seconds;
    this.interval = 1 / hz;
    this.acc = 0;
    this.pending = [];
    this.enabled = true;
  }

  register(id, obj, entity) { this.objs.set(String(id), { obj, entity }); }

  event(name, args) {
    if (!this.enabled) return;
    this.pending.push([this.world.time, name, args]);
  }

  capture(dt, camera) {
    if (!this.enabled) return;
    this.acc += dt;
    if (this.acc < this.interval && this.frames.length) return;
    this.acc = 0;
    const ids = [];
    const data = [];
    for (const [id, r] of this.objs) {
      const o = r.obj;
      if (!o.parent) continue;
      if (!o.visible && !(r.entity && r.entity.wrecked)) continue;
      o.matrixWorld.decompose(_p, _q, _s);
      ids.push(id);
      data.push(_p.x, _p.y, _p.z, _q.x, _q.y, _q.z, _q.w, o.visible ? 1 : 0, r.entity && r.entity.wrecked ? 1 : 0);
    }
    const f = {
      t: this.world.time,
      ids,
      data: new Float32Array(data),
      cam: [camera.position.x, camera.position.y, camera.position.z, camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w, camera.fov],
      events: this.pending,
    };
    this.pending = [];
    this.frames.push(f);
    const cut = this.world.time - this.seconds;
    while (this.frames.length && this.frames[0].t < cut) this.frames.shift();
    // تنظيف الكائنات الزائلة الخارجة عن النافذة
    if (Math.random() < 0.02) {
      const live = new Set();
      for (const fr of this.frames) for (const id of fr.ids) live.add(id);
      for (const [id, r] of this.objs) if (!r.obj.parent && !live.has(id)) this.objs.delete(id);
    }
  }

  makeClip(t0, t1, meta) {
    const frames = this.frames.filter((f) => f.t >= t0 && f.t <= t1);
    if (frames.length < 4) return null;
    const objs = new Map();
    for (const f of frames) for (const id of f.ids) if (!objs.has(id) && this.objs.has(id)) objs.set(id, this.objs.get(id));
    return { frames, objs, meta, t0: frames[0].t, t1: frames[frames.length - 1].t };
  }
}

function frameIndex(frames, t) {
  let lo = 0, hi = frames.length - 1;
  if (t <= frames[0].t) return 0;
  if (t >= frames[hi].t) return hi - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (frames[m].t <= t) lo = m; else hi = m;
  }
  return lo;
}

function readObj(frame, id, out) {
  const i = frame._map ? frame._map.get(id) : (frame._map = new Map(frame.ids.map((x, k) => [x, k])), frame._map.get(id));
  if (i == null) return null;
  const d = frame.data, o = i * 9;
  out.p.set(d[o], d[o + 1], d[o + 2]);
  out.q.set(d[o + 3], d[o + 4], d[o + 5], d[o + 6]);
  out.vis = d[o + 7] > 0.5;
  out.wreck = d[o + 8] > 0.5;
  return out;
}

export class ReplayDirector {
  constructor(world, clip, { onEnd } = {}) {
    this.world = world;
    this.clip = clip;
    this.onEnd = onEnd;
    this.t = clip.t0;
    this.done = false;
    this.cam = new THREE.PerspectiveCamera(50, world.camera.aspect, 0.3, 18000);
    this.saved = [];
    this.lastEventT = clip.t0 - 0.0001;
    this.orbitA = Math.random() * Math.PI * 2;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.first = true;
    this.speed = 1;
    const m = clip.meta;
    this.impactT = m.impactT ?? clip.t1 - 3;
    this.launchT = m.launchT ?? clip.t0 + 0.5;
    this.shot = '';
  }

  start() {
    const w = this.world;
    for (const [id, r] of this.clip.objs) {
      const o = r.obj;
      this.saved.push({
        id, o, entity: r.entity, parent: o.parent, pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone(), vis: o.visible, wreck: r.entity ? r.entity.wrecked : false,
      });
      w.scene.attach(o);
      w.vision.restore(o);
      o.visible = false;
    }
    // إخفاء ما لم يكن موجوداً في اللقطة (وحدات ظهرت لاحقاً، هياكل لاحقة)
    this.hidden = [];
    const inClip = new Set([...this.clip.objs.values()].map((r) => r.obj));
    for (const [, r] of w.recorder.objs) {
      const o = r.obj;
      if (inClip.has(o) || !o.parent || !o.visible) continue;
      this.hidden.push(o);
      o.visible = false;
    }
    for (const e of w.entities) {
      if (inClip.has(e.root) || !e.root.parent || !e.root.visible) continue;
      this.hidden.push(e.root);
      e.root.visible = false;
    }
    w.fx.clear();
    w.fx.replaying = true;
    w.recorder.enabled = false;
    this.wasVisible = { igla: w.player.igla.visible, op: w.player.operator.visible, marker: w.player.marker.visible };
    w.player.igla.visible = false;
    w.player.operator.visible = true;
    w.player.marker.visible = false;
    this.cam.aspect = w.camera.aspect;
    this.cam.updateProjectionMatrix();
    w.audio.stopAllLoops();
    w.audio.lockTone(-1);
  }

  stop() {
    const w = this.world;
    for (const s of this.saved) {
      const o = s.o;
      if (s.parent) s.parent.add(o); else w.scene.remove(o);
      o.position.copy(s.pos); o.quaternion.copy(s.quat); o.scale.copy(s.scale);
      o.visible = s.vis;
      if (s.entity) s.entity.setWrecked(s.wreck);
    }
    for (const o of this.hidden || []) o.visible = true;
    w.fx.clear();
    w.fx.replaying = false;
    w.recorder.enabled = true;
    w.player.igla.visible = this.wasVisible.igla;
    w.player.operator.visible = false;
    w.player.marker.visible = this.wasVisible.marker;
    w.restartLoops?.();
  }

  _apply(t) {
    const frames = this.clip.frames;
    const i = frameIndex(frames, t);
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    const k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    const ra = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, rb = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    for (const s of this.saved) {
      const A = readObj(a, s.id, ra);
      const B = readObj(b, s.id, rb);
      const o = s.o;
      if (!A && !B) { o.visible = false; continue; }
      const src = A || B;
      if (A && B) {
        o.position.copy(A.p).lerp(B.p, k);
        o.quaternion.copy(A.q).slerp(B.q, k);
      } else { o.position.copy(src.p); o.quaternion.copy(src.q); }
      o.scale.copy(s.scale);
      o.visible = src.vis;
      if (s.entity) s.entity.setWrecked(src.wreck);
    }
    return { a, b, k };
  }

  _objPos(id, t, out) {
    const frames = this.clip.frames;
    const i = frameIndex(frames, t);
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    const ra = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    const rb = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    const A = readObj(a, id, ra), B = readObj(b, id, rb);
    if (!A && !B) return null;
    const k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    if (A && B) return out.copy(A.p).lerp(B.p, k);
    return out.copy((A || B).p);
  }

  update(dtReal) {
    if (this.done) return;
    const m = this.clip.meta;
    const t = this.t;
    // منحنى السرعة: تبطيء حول لحظة الإصابة
    const near = Math.abs(t - this.impactT);
    let sp = 1;
    if (t > this.launchT + 1 && t < this.impactT - 1.2) sp = (this.impactT - this.launchT) > 7 ? 1.6 : 1.1;
    if (near < 1.2) sp = lerp(0.22, 1, smoothstep(0.15, 1.2, near));
    if (t > this.impactT + 1.2) sp = 0.7;
    this.speed = sp;
    this.t = Math.min(this.clip.t1, t + dtReal * sp);
    this._apply(this.t);
    // أحداث المؤثرات
    for (const f of this.clip.frames) {
      if (f.t <= this.lastEventT || f.t > this.t) continue;
      for (const [, name, args] of f.events) this.world.fx.playEvent(name, args);
    }
    this.lastEventT = this.t;
    this.world.fx.update(dtReal * sp, this.cam);
    this._camera(dtReal);
    if (this.t >= this.clip.t1 - 0.01) {
      this.done = true;
      this.onEnd?.();
    }
  }

  _camera(dt) {
    const m = this.clip.meta;
    const cam = this.cam;
    const t = this.t;
    const projPos = m.projId ? this._objPos(m.projId, t, new THREE.Vector3()) : null;
    const projAhead = m.projId ? this._objPos(m.projId, Math.min(t + 0.15, this.impactT - 0.01), new THREE.Vector3()) : null;
    const tgtPos = m.targetId ? this._objPos(m.targetId, t, new THREE.Vector3()) : null;
    const impact = m.impactPoint ? new THREE.Vector3(...m.impactPoint) : (tgtPos || new THREE.Vector3());
    const lp = m.launchPoint ? new THREE.Vector3(...m.launchPoint) : new THREE.Vector3(0, 2, 0);
    let want = new THREE.Vector3(), look = new THREE.Vector3(), fov = 50, shot;
    const dir = new THREE.Vector3().copy(impact).sub(lp).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    if (t < this.launchT + 0.9 && m.kind !== 'drone') {
      shot = 'launch';
      want.copy(lp).addScaledVector(dir, -3.2).addScaledVector(side, 2.2).add(new THREE.Vector3(0, 1.4, 0));
      look.copy(projPos || lp.clone().addScaledVector(dir, 30));
      if (!projPos) look.copy(lp).addScaledVector(dir, 40);
      fov = 55;
    } else if (t < this.impactT - 0.9 && projPos) {
      shot = 'chase';
      const fwd = projAhead && projAhead.distanceToSquared(projPos) > 0.01 ? projAhead.clone().sub(projPos).normalize() : dir;
      want.copy(projPos).addScaledVector(fwd, -6.5).add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(side, 1.2);
      look.copy(projPos).addScaledVector(fwd, 25);
      fov = 48;
    } else if (t < this.impactT + 0.7) {
      shot = 'target';
      const c = tgtPos || impact;
      want.copy(c).addScaledVector(side, 17).addScaledVector(dir, 6).add(new THREE.Vector3(0, 3.5, 0));
      look.copy(c).add(new THREE.Vector3(0, 1.4, 0));
      fov = 38;
    } else {
      shot = 'orbit';
      this.orbitA += dt * 0.35;
      const c = tgtPos || impact;
      want.set(c.x + Math.cos(this.orbitA) * 26, c.y + 8, c.z + Math.sin(this.orbitA) * 26);
      look.copy(c).add(new THREE.Vector3(0, 3, 0));
      fov = 50;
    }
    const w = this.world;
    const gy = w.terrain.heightAt(want.x, want.z) + 1.2;
    if (want.y < gy) want.y = gy;
    const cut = shot !== this.shot;
    this.shot = shot;
    if (this.first || cut || shot === 'chase') {
      // الملاحقة ملتصقة بالصاروخ (سرعته 280 م/ث لا تحتمل التنعيم)
      this.camPos.copy(want);
      if (this.first || cut) this.camLook.copy(look); else this.camLook.lerp(look, 1 - Math.exp(-14 * dt));
      this.first = false;
    } else {
      this.camPos.lerp(want, 1 - Math.exp(-4 * dt));
      this.camLook.lerp(look, 1 - Math.exp(-10 * dt));
    }
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    w.audio.setListener(cam);
  }
}
