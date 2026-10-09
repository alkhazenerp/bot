// العالم: بناء المنطقة، الوحدات، المقذوفات، التصادم، الأحداث
import * as THREE from 'three';
import { Terrain } from '../engine/terrain.js';
import { Environment } from '../engine/env.js';
import { FX } from '../engine/fx.js';
import { Vision } from '../engine/vision.js';
import { buildSettlement, buildTrees, buildGrass, buildPlayerPosition, buildLandmark, buildBridges, buildRoadside, makeFlag, animateFlag } from '../engine/props.js';
import { preloadModels } from '../engine/models.js';
import { createEntity } from './entities.js';
import { Player } from './player.js';
import { EnemyProjectile, Bomb, BarrageRocket, SamMissile } from './projectiles.js';
import { Recorder } from './replay.js';
import { Emitter, clamp, rand, resamplePolyline, cumulative, hashStr, mulberry32 } from '../core/util.js';
import { UNITS } from '../data/defs.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export class World {
  constructor({ renderer, audio, quality, region, mission, difficulty, loadout, settings }) {
    this.renderer = renderer;
    this.audio = audio;
    this.quality = quality;
    this.region = region;
    this.missionDef = mission;
    this.diff = difficulty;
    this.loadout = loadout;
    this.settings = settings || {};
    this.events = new Emitter();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 18000);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.entities = [];
    this.projectiles = [];
    this.colliders = [];
    this.treeColliders = [];
    this.animated = [];
    this.flags = [];
    this.timers = [];
    this.time = 0;
    this.nextId = 1;
    this.ended = false;
    this.disposed = false;
    this.timeUniform = { value: 0 };
    this.env = null;
  }

  async build(progress = () => {}) {
    const r = this.region, m = this.missionDef;
    const envCfg = { ...r.env, ...(m.env || {}) };
    this.envCfg = envCfg;
    const night = envCfg.time === 'night';
    progress(0.05, 'تجهيز التضاريس…');
    await nextFrame();
    this.terrain = new Terrain(r.layout, { quality: this.quality, night });
    this.scene.add(this.terrain.mesh);
    if (this.terrain.water) this.scene.add(this.terrain.water);
    this.scene.add(this.terrain.horizon);
    progress(0.35, 'رسم السماء والإضاءة…');
    await nextFrame();
    this.env = new Environment(this.scene, this.renderer, { time: envCfg.time, weather: envCfg.weather, quality: this.quality, north: envCfg.north || 0 });
    this.fx = new FX(this.scene, { terrain: this.terrain, audio: this.audio, quality: this.quality });
    this.fx.setEnv({ fogColor: this.env.fogColor, fogDensity: this.env.t.fogD * (this.envCfg.weather === 'dust' ? 2.6 : this.envCfg.weather === 'rain' ? 2 : this.envCfg.weather === 'haze' ? 1.5 : 1), light: this.env.particleLight, wind: this.env.wind });
    this.fx.setEnv({ fogDensity: this.scene.fog.density });
    this.vision = new Vision(this.scene);
    this.recorder = new Recorder(this);
    this.fx.recorder = this.recorder;
    progress(0.5, 'بناء القرى والمعالم…');
    await nextFrame();
    const seed = hashStr(r.id);
    (r.layout.villages || []).forEach((v, i) => {
      const s = buildSettlement(this.terrain, v, seed + i * 31);
      this.scene.add(s.mesh);
      this.colliders.push(...s.colliders);
      this.rooftops = (this.rooftops || []).concat(s.rooftops);
    });
    // مزارع متفرقة
    const rnd = mulberry32(seed + 5);
    for (let i = 0; i < 8; i++) {
      const x = rand(-2600, 2600), z = -rand(500, 3800);
      if (this.terrain.isOnRoad(x, z, 30) || this.terrain.riverDist(x, z) < 40 || this.terrain.heightAt(x, z) > 60) continue;
      const s = buildSettlement(this.terrain, { x, z, r: 50, n: 2 + Math.floor(rnd() * 3), style: 'village', damage: 0.3 }, seed + 100 + i);
      this.scene.add(s.mesh);
      this.colliders.push(...s.colliders);
    }
    for (const lm of r.layout.landmarks || []) {
      const L = buildLandmark(this.terrain, lm, this);
      if (L.mesh) this.scene.add(L.mesh);
      for (const e of L.extras) {
        if (e.userData.nightOnly && !night) continue;
        this.scene.add(e);
        e.traverse((o) => { if (o.userData.flag) this.flags.push(o); });
        if (e.userData.blink) this.animated.push((dt, t) => { e.visible = Math.sin(t * 3 + e.position.x) > 0; });
      }
      this.colliders.push(...L.colliders);
      if (L.animated) this.animated.push(L.animated);
    }
    const br = buildBridges(this.terrain);
    if (br) this.scene.add(br);
    const rs = buildRoadside(this.terrain, seed + 9);
    if (rs) this.scene.add(rs);
    progress(0.65, 'زراعة بساتين الزيتون…');
    await nextFrame();
    const trees = buildTrees(this.terrain, r.layout, this.quality, seed + 77);
    this.scene.add(trees.group);
    this.treeColliders = trees.colliders;
    this.grass = buildGrass(this.terrain, this.quality, this.timeUniform);
    if (this.grass) this.scene.add(this.grass);
    this.scene.add(buildPlayerPosition(this.terrain));
    const flag = makeFlag(-3.2, this.terrain.heightAt(-3.2, 1.6), 1.6, 'revolution', 5);
    this.scene.add(flag);
    flag.traverse((o) => { if (o.userData.flag) this.flags.push(o); });

    // ممرات الحركة
    this.lanes = {};
    for (const [name, L] of Object.entries(r.layout.lanes || {})) {
      const road = this.terrain.roads.find((x) => x.id === L.road);
      if (!road) continue;
      let pts = road.pts.map((p) => [p[0], p[1]]);
      if (L.reverse) pts.reverse();
      const cum0 = cumulative(pts);
      const tot = cum0[cum0.length - 1];
      const a = (L.from ?? 0) * tot, b = (L.to ?? 1) * tot;
      pts = pts.filter((p, i) => cum0[i] >= a - 1 && cum0[i] <= b + 1);
      if (pts.length < 2) continue;
      const cum = cumulative(pts);
      this.lanes[name] = { name, pts, cum, total: cum[cum.length - 1] };
    }
    this.anchors = {};
    for (const [k, v] of Object.entries(r.layout.anchors || {})) {
      this.anchors[k] = new THREE.Vector3(v[0], this.terrain.heightAt(v[0], v[1]), v[1]);
    }
    progress(0.8, 'تجهيز الآليات…');
    await nextFrame();
    preloadModels(['t72', 'bmp1', 'technical', 'militia', 'soldier', 'mi24', 'su24']);
    this.player = new Player(this, this.loadout);
    this.player.yaw = 0;
    progress(0.9, 'تجهيز المهمة…');
    await nextFrame();
    this.audio.ambience(this.envCfg.weather === 'rain' ? 'rain' : 'wind');
    this.camera.position.copy(this.player.pos);
    // تسخين المظللات
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* */ }
    progress(1, 'جاهز');
  }

  add(obj) {
    this.scene.add(obj);
    if (this.vision && this.vision.mode !== 'day') this.vision.apply(obj);
  }

  remove(obj) { if (obj.parent) obj.parent.remove(obj); }

  after(delay, fn) { this.timers.push({ t: this.time + delay, fn }); }

  spawn(type, opts = {}) {
    const e = createEntity(this, type, opts);
    this.entities.push(e);
    if (this.mission) this.mission.onSpawn(e);
    return e;
  }

  addProjectile(p) { this.projectiles.push(p); }

  spawnEnemyProjectile(o) {
    const p = new EnemyProjectile(this, o);
    this.projectiles.push(p);
    return p;
  }

  warn(kind, from) { this.events.emit('warning', { kind, from: from ? from.clone() : null }); }
  hudMsg(kind) { this.events.emit('hudmsg', kind); }
  radio(kind, data) { this.events.emit('radio', { kind, data }); }

  rocketSalvo(heli) {
    const n = heli.type === 'mi24' ? 10 : 6;
    const spread = 70 / this.diff.enemyAcc;
    this.warn('rockets', heli.pos);
    for (let i = 0; i < n; i++) {
      this.after(i * 0.12, () => {
        if (!heli.alive) return;
        const from = heli.center(new THREE.Vector3()).add(new THREE.Vector3(rand(-2.5, 2.5), -0.6, 0));
        const pp = this.player.pos;
        const to = new THREE.Vector3(pp.x + rand(-spread, spread), 0, pp.z + rand(-spread, spread * 0.4));
        to.y = this.terrain.heightAt(to.x, to.z);
        const hit = to.distanceTo(pp) < 8 && Math.random() < 0.6;
        this.fx.muzzleFlash(from, to.clone().sub(from).normalize(), { size: 0.5, sound: 'rifle', quiet: i % 2 === 1 });
        this.projectiles.push(new EnemyProjectile(this, { kind: 'rocket', from, to, speed: 420, hit, target: this.player, damage: 14, source: heli }));
      });
    }
  }

  dropBomb(jet) {
    const p = jet.center(new THREE.Vector3()).add(new THREE.Vector3(rand(-3, 3), -1.2, 0));
    this.projectiles.push(new Bomb(this, p, jet.vel.clone().multiplyScalar(0.98)));
  }

  gradBarrage(ent) {
    this.warn('grad', ent.pos);
    const spread = 110 / this.diff.enemyAcc;
    for (let i = 0; i < 10; i++) {
      this.after(i * 0.25, () => {
        if (!ent.alive) return;
        const from = ent.muzzlePos(new THREE.Vector3());
        const to = this.player.pos.clone().add(new THREE.Vector3(rand(-spread, spread), 0, rand(-spread, spread)));
        to.y = this.terrain.heightAt(to.x, to.z);
        this.fx.muzzleFlash(from, new THREE.Vector3(0, 0.6, 0.8).normalize(), { size: 0.8, sound: 'rifle', quiet: i % 2 === 1 });
        const T = 6 + from.distanceTo(to) / 800;
        this.projectiles.push(new BarrageRocket(this, from, to, T, { enemy: true, damage: 34 }));
      });
    }
  }

  samLaunch(ent) {
    const from = ent.muzzlePos(new THREE.Vector3());
    this.projectiles.push(new SamMissile(this, from));
  }

  // ضرر انفجار للعدو على موقع اللاعب والوحدات القريبة
  enemyBlast(p, radius, damage) {
    const pl = this.player;
    const d = p.distanceTo(pl.base);
    if (d < radius) {
      const k = 1 - d / radius;
      pl.damage(damage * k * k * (pl.inCover ? 0.45 : 1), p, 'blast');
    }
    this.damageArea(p, radius * 0.6, damage * 0.6, { source: 'enemyblast' });
  }

  damageArea(p, radius, damage, info = {}) {
    for (const e of this.entities) {
      if (!e.alive || e === info.exclude) continue;
      if (info.source === 'enemyblast' && e.team === 'enemy') continue;
      const c = e.center(new THREE.Vector3());
      const d = c.distanceTo(p) - e.radius * 0.5;
      if (d > radius) continue;
      const k = clamp(1 - d / radius, 0, 1);
      const resist = e.cls === 'tank' ? 0.15 : e.cls === 'ifv' ? 0.35 : 1;
      const killed = e.takeDamage(damage * k * resist, { side: 'top', source: info.source || 'splash' });
      if (info.player || info.source === 'splash' || info.source === 'rockets' || info.source === 'chain') {
        if (e.team === 'enemy') this.onPlayerHit(e, { source: info.source === 'rockets' ? 'rockets' : 'splash', killed, distance: p.length(), quiet: !killed });
      }
    }
  }

  // تصادم قطعة مستقيمة مع الوحدات والمباني والأشجار والأرض
  segmentHit(p0, p1, opts = {}) {
    let best = null;
    const minx = Math.min(p0.x, p1.x), maxx = Math.max(p0.x, p1.x);
    const minz = Math.min(p0.z, p1.z), maxz = Math.max(p0.z, p1.z);
    for (const e of this.entities) {
      const c = e.pos;
      const r = e.radius + 6;
      if (c.x + r < minx || c.x - r > maxx || c.z + r < minz || c.z - r > maxz) continue;
      if (e.cls === 'jet' || e.cls === 'heli' || e.cls === 'drone') { /* فحص كامل */ }
      const h = e.hitTest(p0, p1);
      if (h && (!best || h.t < best.t)) best = { ...h, entity: e, surface: 'entity' };
    }
    const seg = new THREE.Vector3().subVectors(p1, p0);
    const len = seg.length();
    if (len > 0) {
      const ray = new THREE.Ray(p0, seg.clone().divideScalar(len));
      const tmp = new THREE.Vector3();
      for (const b of this.colliders) {
        if (b.max.x < minx || b.min.x > maxx || b.max.z < minz || b.min.z > maxz) continue;
        const hp = ray.intersectBox(b, tmp);
        if (hp) {
          const t = hp.distanceTo(p0) / len;
          if (t <= 1 && (!best || t < best.t)) best = { t, point: hp.clone(), surface: 'building' };
        }
      }
      if (!opts.noTrees) {
        for (const tc of this.treeColliders) {
          const [x, y, z, r, top] = tc;
          if (x + r < minx || x - r > maxx || z + r < minz || z - r > maxz) continue;
          // اسطوانة تقريبية
          const dx = p1.x - p0.x, dz = p1.z - p0.z;
          const l2 = dx * dx + dz * dz || 1;
          let t = ((x - p0.x) * dx + (z - p0.z) * dz) / l2;
          t = clamp(t, 0, 1);
          const cx = p0.x + dx * t - x, cz = p0.z + dz * t - z;
          if (cx * cx + cz * cz < r * r) {
            const yy = p0.y + (p1.y - p0.y) * t;
            if (yy > y + 1.2 && yy < top && (!best || t < best.t) && Math.random() < (opts.bullet ? 0.5 : 0.8)) best = { t, point: new THREE.Vector3(p0.x + dx * t, yy, p0.z + dz * t), surface: 'tree' };
          }
        }
      }
    }
    const g = this.terrain.segmentHit(p0, p1, new THREE.Vector3());
    if (g) {
      const t = g.distanceTo(p0) / (len || 1);
      if (!best || t < best.t) {
        const water = this.terrain.river && this.terrain.riverDist(g.x, g.z) < 0 && g.y <= this.terrain.river.level + 0.5;
        best = { t, point: g.clone(), surface: water ? 'water' : 'ground' };
      }
    }
    return best;
  }

  // مقياس المدى: أول ما يصيبه خط النظر
  rangeAt(origin, dir, maxDist = 6000) {
    const far = origin.clone().addScaledVector(dir, maxDist);
    const hit = this.segmentHit(origin, far, { noTrees: false });
    if (!hit) return null;
    return { dist: hit.point.distanceTo(origin), entity: hit.entity || null, point: hit.point };
  }

  onEntityKilled(e, info) {
    if (this.mission) this.mission.onKill(e, info);
    this.events.emit('killed', { entity: e, info });
  }

  onEntityEscaped(e, silent = false) {
    e.alive = false;
    e.escaped = true;
    this.remove(e.root);
    e.engine?.stop();
    if (this.mission) this.mission.onEscape(e, silent);
  }

  onPlayerHit(e, info) {
    if (info.source !== 'splash' || !info.quiet) this.player.stats.hits++;
    if (info.source === 'tow') this.player.stats.towHits++;
    this.events.emit('hit', { entity: e, ...info });
  }

  onPlayerMiss(source) { this.events.emit('miss', { source }); }

  onMissileLaunched(m) {
    this.events.emit('launch', { missile: m });
  }

  onMissileEnd(m, res) {
    // صنع لقطة الإصابة بعد اكتمال المشهد
    if (res.killed && res.ent) {
      const meta = {
        kind: 'tow', projId: m.id, targetId: String(res.ent.id), launchT: m.launchTime, impactT: this.time,
        impactPoint: res.point.toArray(), launchPoint: m.origin.toArray(), distance: res.dist, targetName: res.ent.def.name, turretToss: !!(res.ent.killInfo && res.ent.killInfo.turretToss),
      };
      this.after(3.6, () => this._makeClip(meta));
    }
  }

  onDroneLaunched(d) {
    this.events.emit('drone', { drone: d, on: true });
  }

  onDroneEnd(d, res) {
    this.player.onDroneEnd(d);
    this.events.emit('drone', { drone: d, on: false, res });
    if (res.killed && res.ent) {
      const meta = { kind: 'drone', projId: d.id, targetId: String(res.ent.id), launchT: d.launchTime, impactT: this.time, impactPoint: res.point.toArray(), launchPoint: this.player.base.toArray(), distance: res.point.distanceTo(this.player.base), targetName: res.ent.def.name };
      this.after(3.6, () => this._makeClip(meta));
    }
  }

  _makeClip(meta) {
    const t0 = Math.max(meta.launchT - 0.6, meta.impactT - 22);
    const clip = this.recorder.makeClip(t0, this.time, meta);
    if (!clip) return;
    this.lastClip = clip;
    const score = (meta.distance || 0) + (meta.turretToss ? 800 : 0);
    if (!this.bestClip || score > this.bestClip.meta._score) { meta._score = score; this.bestClip = clip; }
    this.events.emit('clip', clip);
  }

  onPlayerDeath() {
    this.events.emit('playerDead');
    if (this.mission) this.mission.fail('dead');
  }

  restartLoops() {
    for (const e of this.entities) {
      if (!e.alive || !e.engine) continue;
      const kind = e.cls === 'heli' ? 'heli' : e.cls === 'jet' ? 'jet' : e.cls === 'drone' ? 'moped' : null;
      if (kind) e.engine = this.audio.loop(kind, e.pos);
    }
    for (const p of this.projectiles) if (p.motor) p.motor = this.audio.loop('motor', p.pos);
    const d = this.player.activeDrone;
    if (d) d.buzz = this.audio.loop('fpv', null);
  }

  setVision(mode) {
    if (mode !== 'day' && !this.terrain.mesh.userData.thermalTex) this.terrain.mesh.userData.thermalTex = this.terrain.thermalTexture();
    this.vision.setMode(mode, this.env, this.fx);
    if (mode === 'day') this.fx.setEnv({ fogColor: this.env.fogColor });
  }

  update(dt) {
    this.time += dt;
    this.timeUniform.value = this.time;
    // مؤقتات
    if (this.timers.length) {
      const due = [];
      this.timers = this.timers.filter((t) => (t.t <= this.time ? (due.push(t), false) : true));
      for (const t of due) t.fn();
    }
    for (const e of this.entities) e.update(dt);
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].update(dt)) { this.projectiles.splice(i, 1); i--; }
    }
    // تنظيف الوحدات الهاربة
    if (this.entities.length > 60) this.entities = this.entities.filter((e) => !e.escaped);
    for (const a of this.animated) a(dt, this.time);
    for (const f of this.flags) animateFlag(f, this.time);
    if (this.mission) this.mission.update(dt);
    this.audio.distantBattle(dt, 1);
  }

  dispose() {
    this.disposed = true;
    this.audio.stopAllLoops();
    this.audio.siren(false);
    this.audio.lockTone(-1);
    this.audio.ambience(null);
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    if (this.terrain && this.terrain.map) this.terrain.map.dispose();
    if (this.env && this.env.envRT) this.env.envRT.dispose();
  }
}
