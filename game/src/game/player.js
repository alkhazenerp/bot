// اللاعب: موقع الرماية، التصويب، الأسلحة، الاحتماء، الضرر والكاميرا
import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER } from '../data/defs.js';
import { towLauncherModel, operatorModel, kpvModel, iglaViewModel } from '../engine/models.js';
import { makeNoise2D } from '../core/noise.js';
import { clamp, damp, rand, DEG } from '../core/util.js';
import { TowMissile, Bullet, IglaMissile, FPVDrone, BarrageRocket } from './projectiles.js';

const BASE_FOV = 55;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export class Player {
  constructor(world, cfg) {
    this.world = world;
    this.isPlayer = true;
    this.cfg = cfg;
    this.upg = cfg.upgrades || {};
    this.alive = true;
    this.cls = 'player';
    const t = world.terrain;
    this.base = new THREE.Vector3(0, t.heightAt(0, 0), 0);
    this.pos = this.base.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.0;
    this.swayX = 0; this.swayY = 0;
    this.noise = makeNoise2D(17);
    this.t = 0;
    this.weapons = WEAPON_ORDER.filter((w) => cfg.weapons.includes(w));
    this.weapon = 'tow';
    const extraTow = (this.upg.tow_ammo || 0) * 2 + (cfg.vip ? 2 : 0);
    this.ammo = {
      tow: WEAPONS.tow.ammo + extraTow,
      mg: Infinity,
      igla: WEAPONS.igla.ammo,
      drone: WEAPONS.drone.ammo + (this.upg.drones || 0),
      rockets: WEAPONS.rockets.ammo,
    };
    this.maxAmmo = { ...this.ammo };
    this.reload = 0;
    this.reloadIgla = 0;
    this.rocketCd = 0;
    this.maxHp = 100 * (1 + (this.upg.armor || 0) * 0.2);
    this.hp = this.maxHp;
    this.exposure = 0.05;
    this.inCover = false;
    this.coverK = 0;
    this.zoomIdx = 0;
    this.thermal = false;
    this.heat = 0;
    this.overheat = false;
    this.mgCd = 0;
    this.lastDamage = -99;
    this.activeTow = null;
    this.activeDrone = null;
    this.lock = { target: null, t: 0, locked: false };
    this.topAttack = !!cfg.tow2b;
    this.useTop = false;
    this.recoil = 0;
    this.stats = { shots: 0, hits: 0, towShots: 0, towHits: 0 };
    this.camera = world.camera;
    // إمداد دوري بصواريخ التاو
    this.resupplyEvery = { easy: 35, normal: 45, hard: 55, legend: 65 }[world.diff.id] || 45;
    this.resupplyT = this.resupplyEvery;
    this._buildModels(cfg.skin || 'olive');
  }

  _buildModels(skin) {
    const w = this.world, t = w.terrain;
    this.launcher = towLauncherModel(skin === 'gold' ? 'gold' : skin);
    this.launcher.position.copy(this.base);
    this.lYaw = this.launcher.getObjectByName('yaw');
    this.lPitch = this.launcher.getObjectByName('pitch');
    this.launcher.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    w.add(this.launcher);
    this.operator = operatorModel();
    this.operator.position.copy(this.base).add(new THREE.Vector3(0.25, 0, 0.95));
    this.operator.visible = false;
    this.operator.userData.hiddenByGame = true;
    w.add(this.operator);
    this.kpvBase = new THREE.Vector3(2.0, t.heightAt(2.0, 0.6), 0.6);
    this.kpv = kpvModel(skin === 'gold' ? 'gold' : skin);
    this.kpv.position.copy(this.kpvBase);
    this.kYaw = this.kpv.getObjectByName('yaw');
    this.kPitch = this.kpv.getObjectByName('pitch');
    this.kMuzzle = this.kpv.getObjectByName('muzzle');
    this.kpv.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    w.add(this.kpv);
    this.iglaBase = new THREE.Vector3(-1.5, t.heightAt(-1.5, 0.7), 0.7);
    this.igla = iglaViewModel();
    this.igla.position.set(0.17, -0.16, -0.42);
    this.igla.rotation.set(0.04, Math.PI + 0.05, 0);
    this.igla.visible = false;
    this.camera.add(this.igla);
    // علامة هدف الراجمة
    const ring = new THREE.Mesh(new THREE.RingGeometry(16, 20, 40), new THREE.MeshBasicMaterial({ color: 0xff5040, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.userData.noThermalSwap = true;
    ring.renderOrder = 5;
    this.marker = ring;
    w.add(ring);
    w.recorder?.register('L:yaw', this.lYaw, null);
    w.recorder?.register('L:pitch', this.lPitch, null);
    w.recorder?.register('K:yaw', this.kYaw, null);
    w.recorder?.register('K:pitch', this.kPitch, null);
  }

  get zoomLevels() {
    if (this.weapon === 'tow') return this.upg.thermal >= 2 ? [1, 4, 12, 20] : [1, 4, 12];
    if (this.weapon === 'mg') return [1, 2.5];
    if (this.weapon === 'igla') return [1, 2];
    if (this.weapon === 'rockets') return [1, 3];
    return [1];
  }
  get zoom() { return this.zoomLevels[Math.min(this.zoomIdx, this.zoomLevels.length - 1)]; }
  get fov() { return 2 * Math.atan(Math.tan((BASE_FOV * DEG) / 2) / this.zoom) / DEG; }
  get scoped() { return this.weapon === 'tow' && this.zoom > 1 && !this.activeDrone; }

  aimAngles() {
    return { yaw: this.yaw + this.swayX, pitch: this.pitch + this.swayY };
  }

  aimDir(out = new THREE.Vector3()) {
    const { yaw, pitch } = this.aimAngles();
    return out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }

  forwardFlat(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  _q(out = _q) {
    const { yaw, pitch } = this.aimAngles();
    _e.set(pitch, -yaw, 0, 'YXZ');
    return out.setFromEuler(_e);
  }

  pivot(out = new THREE.Vector3()) { return out.copy(this.base).add(_v.set(0, 0.98, 0)); }

  sightPos(out = new THREE.Vector3()) {
    const q = this._q(new THREE.Quaternion());
    return this.pivot(out).add(new THREE.Vector3(0.24, 0.2, -0.3).applyQuaternion(q));
  }

  launcherMuzzle(out = new THREE.Vector3()) {
    const q = this._q(new THREE.Quaternion());
    return this.pivot(out).add(new THREE.Vector3(-0.05, 0.3, -1.1).applyQuaternion(q));
  }

  isGuiding() {
    return this.alive && this.weapon === 'tow' && !this.inCover && !this.activeDrone;
  }

  setWeapon(id) {
    if (!this.weapons.includes(id) || this.activeDrone) return;
    if (id === this.weapon) return;
    this.weapon = id;
    this.zoomIdx = 0;
    this.lock = { target: null, t: 0, locked: false };
    this.world.audio.lockTone(-1);
    this.world.audio.click();
  }

  cycleZoom(dir = 1) {
    const n = this.zoomLevels.length;
    this.zoomIdx = (this.zoomIdx + dir + n) % n;
    this.world.audio.click();
  }

  damage(amount, fromPos, kind = 'hit') {
    if (!this.alive || this.world.ended) return;
    const w = this.world;
    const dmg = amount * w.diff.dmgTaken;
    this.hp -= dmg;
    this.lastDamage = w.time;
    w.fx.shake(clamp(dmg / 40, 0.15, 0.8));
    w.audio.hitThud();
    w.events.emit('playerHit', { amount: dmg, from: fromPos ? fromPos.clone() : null, kind });
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      w.onPlayerDeath();
    }
  }

  update(dt, input) {
    const w = this.world;
    this.t += dt;
    if (!this.alive) return;
    // تحكم المسيّرة
    if (this.activeDrone) {
      const d = this.activeDrone;
      d.steer(input.aimDX * 1.8, input.aimDY * 1.8, dt);
      d.boost = input.boostHeld || input.fireDown ? 1 : 0;
      if (input.firePressed && d.alive && d.battery < 78) d.boost = 1;
      if (input.cancelDrone) { d.battery = 0; }
    } else {
      // تصويب
      const lim = this.weapon === 'igla' ? [-0.1, 1.3] : this.weapon === 'mg' ? [-0.3, 1.1] : [-0.35, 0.45];
      this.yaw += input.aimDX;
      this.pitch = clamp(this.pitch + input.aimDY, lim[0], lim[1]);
      this.yaw = clamp(this.yaw, -1.9, 1.9);
    }
    // اهتزاز اليد
    const sw = (0.0011 * w.diff.sway + 0.0002) * (1 - (this.upg.tow_guide || 0) * 0.22) * (this.weapon === 'mg' ? 1.6 : 1);
    const n = this.noise;
    this.swayX = (n(this.t * 0.55, 3.1) + n(this.t * 1.9, 7.7) * 0.35) * sw;
    this.swayY = (n(this.t * 0.47, 11.3) + n(this.t * 2.2, 1.9) * 0.35) * sw * 0.8 + Math.sin(this.t * 1.3) * sw * 0.25;
    this.swayX += this.recoil * (Math.random() - 0.5) * 0.004;
    this.swayY += this.recoil * 0.004;
    this.recoil = Math.max(0, this.recoil - dt * 6);

    // الاحتماء
    const wantCover = input.coverHeld || input.coverToggle;
    this.inCover = !!wantCover && !this.activeDrone;
    this.coverK = damp(this.coverK, this.inCover ? 1 : 0, 7, dt);

    if (input.zoomPressed && !this.activeDrone) this.cycleZoom(1);
    if (!this.activeDrone && (input.zoomIn || input.zoomOut)) {
      const n = this.zoomLevels.length;
      const z = Math.max(0, Math.min(n - 1, this.zoomIdx + (input.zoomIn ? 1 : -1)));
      if (z !== this.zoomIdx) { this.zoomIdx = z; this.world.audio.click(); }
    }
    if (input.weaponSel) this.setWeapon(input.weaponSel);
    if (input.nextWeapon) {
      const i = this.weapons.indexOf(this.weapon);
      this.setWeapon(this.weapons[(i + 1) % this.weapons.length]);
    }
    if (input.topToggle && this.topAttack) { this.useTop = !this.useTop; w.audio.click(); w.hudMsg(this.useTop ? 'top_on' : 'top_off'); }

    // وصول الإمداد
    this.resupplyT -= dt;
    if (this.resupplyT <= 0) {
      this.resupplyT = this.resupplyEvery;
      if (this.ammo.tow < this.maxAmmo.tow) {
        this.ammo.tow = Math.min(this.maxAmmo.tow, this.ammo.tow + 2);
        w.hudMsg('resupply');
        w.events.emit('radio', { kind: 'resupply', text: 'وصل الإمداد: صاروخا تاو إضافيان' });
      }
    }
    // التلقيم والتبريد
    if (!this.activeTow && this.reload > 0) this.reload = Math.max(0, this.reload - dt);
    this.rocketCd = Math.max(0, this.rocketCd - dt);
    this.reloadIgla = Math.max(0, this.reloadIgla - dt);
    this.heat = Math.max(0, this.heat - dt * 0.28);
    if (this.overheat && this.heat < 0.35) this.overheat = false;
    this.mgCd -= dt;

    // الانكشاف
    const decay = this.inCover ? 0.12 : 0.035;
    this.exposure = Math.max(0.05, this.exposure - dt * decay);

    // ترميم ذاتي بطيء
    if (w.time - this.lastDamage > 7 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * (this.inCover ? 4 : 1.2));

    // الأسلحة
    if (!this.inCover && !this.activeDrone) this._weapons(dt, input);
    else { this.marker.visible = false; if (this.weapon === 'igla') w.audio.lockTone(-1); }

    if (this.activeTow && !this.activeTow.alive) this.activeTow = null;
    this._updateModels();
    this._updateCamera(dt);
  }

  _weapons(dt, input) {
    const w = this.world;
    const wp = this.weapon;
    this.marker.visible = false;
    if (wp === 'tow') {
      if (input.firePressed) {
        if (this.activeTow) w.hudMsg('guiding');
        else if (this.reload > 0) w.hudMsg('reloading');
        else if (this.ammo.tow <= 0) w.hudMsg('noammo');
        else {
          this.ammo.tow--;
          this.stats.towShots++;
          this.stats.shots++;
          this.activeTow = new TowMissile(w, this, { topAttack: this.topAttack && this.useTop });
          w.addProjectile(this.activeTow);
          w.onMissileLaunched(this.activeTow);
          this.reload = WEAPONS.tow.reload * (1 - (this.upg.tow_reload || 0) * 0.18);
          this.exposure = Math.min(1, this.exposure + 0.38);
          this.recoil = 0.6;
        }
      }
    } else if (wp === 'mg') {
      if (input.fireDown && !this.overheat && this.mgCd <= 0) {
        this.mgCd = 60 / WEAPONS.mg.rpm;
        const m = this.kMuzzle.getWorldPosition(new THREE.Vector3());
        const dir = this.aimDir(new THREE.Vector3());
        dir.x += rand(-0.0025, 0.0025); dir.y += rand(-0.002, 0.002);
        dir.normalize();
        this._mgCount = (this._mgCount || 0) + 1;
        w.addProjectile(new Bullet(w, m, dir.multiplyScalar(1000), this._mgCount % 3 === 0));
        w.fx.muzzleFlash(m, this.aimDir(new THREE.Vector3()), { size: 0.55, sound: 'kpv' });
        this.heat += 0.04;
        if (this.heat >= 1) { this.overheat = true; w.hudMsg('overheat'); }
        this.recoil = Math.min(1.2, this.recoil + 0.35);
        w.fx.shake(0.04);
        this.exposure = Math.min(1, this.exposure + 0.012);
        this.stats.shots++;
      }
    } else if (wp === 'igla') {
      // البحث عن هدف جوي ضمن مخروط التصويب
      const dir = this.aimDir(new THREE.Vector3());
      const eye = this.camera.position;
      let best = null, ba = 0.05 / Math.sqrt(this.zoom);
      for (const e of w.entities) {
        if (!e.alive || e.team !== 'enemy' || !(e.cls === 'heli' || e.cls === 'jet' || e.cls === 'drone')) continue;
        const c = e.center(new THREE.Vector3());
        if (c.distanceTo(eye) > WEAPONS.igla.range) continue;
        const a = dir.angleTo(c.sub(eye).normalize());
        if (a < ba) { ba = a; best = e; }
      }
      if (best && this.ammo.igla > 0 && this.reloadIgla <= 0) {
        if (this.lock.target !== best) { this.lock = { target: best, t: 0, locked: false }; }
        this.lock.t += dt;
        this.lock.locked = this.lock.t >= WEAPONS.igla.lockTime;
        w.audio.lockTone(this.lock.locked ? 1 : 0);
      } else {
        this.lock = { target: null, t: 0, locked: false };
        w.audio.lockTone(-1);
      }
      if (input.firePressed) {
        if (this.ammo.igla <= 0) w.hudMsg('noammo');
        else if (this.reloadIgla > 0) w.hudMsg('reloading');
        else if (!this.lock.locked) w.hudMsg('nolock');
        else {
          this.ammo.igla--;
          this.stats.shots++;
          w.addProjectile(new IglaMissile(w, this, this.lock.target));
          this.reloadIgla = WEAPONS.igla.reload;
          this.exposure = Math.min(1, this.exposure + 0.2);
          this.lock = { target: null, t: 0, locked: false };
          w.audio.lockTone(-1);
          w.fx.shake(0.2);
        }
      }
    } else if (wp === 'drone') {
      if (input.firePressed) {
        if (this.ammo.drone <= 0) w.hudMsg('noammo');
        else {
          this.ammo.drone--;
          this.stats.shots++;
          this.activeDrone = new FPVDrone(w, this);
          w.addProjectile(this.activeDrone);
          w.onDroneLaunched(this.activeDrone);
        }
      }
    } else if (wp === 'rockets') {
      const hit = w.terrain.rayHit(this.camera.position, this.aimDir(new THREE.Vector3()), 5000);
      if (hit && hit.dist > 250) {
        this.marker.visible = true;
        this.marker.position.copy(hit.point).add(_v.set(0, 1.5, 0));
        const s = clamp(hit.dist / 1500, 0.6, 2.5);
        this.marker.scale.setScalar(s);
      }
      if (input.firePressed) {
        if (this.ammo.rockets <= 0) w.hudMsg('noammo');
        else if (this.rocketCd > 0) w.hudMsg('reloading');
        else if (!hit || hit.dist < 250) w.hudMsg('notarget');
        else {
          this.ammo.rockets--;
          this.rocketCd = WEAPONS.rockets.cooldown;
          this.stats.shots++;
          const target = hit.point.clone();
          w.radio('rockets');
          for (let i = 0; i < 12; i++) {
            w.after(i * 0.18, () => {
              const start = new THREE.Vector3(rand(-80, 80), this.base.y + 6, rand(1300, 1500));
              const tp = target.clone().add(new THREE.Vector3(rand(-28, 28), 0, rand(-28, 28)));
              tp.y = w.terrain.heightAt(tp.x, tp.z);
              const T = 5 + start.distanceTo(tp) / 700;
              w.addProjectile(new BarrageRocket(w, start, tp, T, { damage: WEAPONS.rockets.damage }));
              if (i % 3 === 0) w.audio.gunshot(start, 'rifle');
            });
          }
        }
      }
    }
  }

  _updateModels() {
    const { yaw, pitch } = this.aimAngles();
    // القاذف يتبع التصويب حتى عند استخدام سلاح آخر لا
    if (this.weapon === 'tow' || this.weapon === 'rockets') {
      this.lYaw.rotation.y = Math.PI - yaw;
      this.lPitch.rotation.x = -pitch;
    }
    if (this.weapon === 'mg') {
      this.kYaw.rotation.y = Math.PI - yaw;
      this.kPitch.rotation.x = -pitch + this.recoil * 0.01;
    }
    this.igla.visible = this.weapon === 'igla' && !this.activeDrone;
  }

  _updateCamera(dt) {
    const cam = this.camera;
    const w = this.world;
    const tr = w.fx.trauma;
    const sh = tr * tr;
    const n = this.noise;
    const shX = n(this.t * 22, 50) * sh * 0.03, shY = n(this.t * 22, 90) * sh * 0.03, shR = n(this.t * 18, 130) * sh * 0.02;
    if (this.activeDrone) {
      const d = this.activeDrone;
      cam.position.copy(d.pos);
      cam.rotation.set(d.pitch + shY, -d.yaw + shX, d.roll + shR, 'YXZ');
      cam.fov = 92;
    } else {
      const { yaw, pitch } = this.aimAngles();
      const q = this._q(new THREE.Quaternion());
      let p;
      if (this.weapon === 'mg') p = this.kpvBase.clone().add(_v.set(0, 0.85, 0)).add(new THREE.Vector3(0, 0.4, 0.95).applyQuaternion(q));
      else if (this.weapon === 'igla') p = this.iglaBase.clone().add(_v.set(0, 1.55, 0));
      else if (this.scoped) p = this.sightPos(new THREE.Vector3());
      else p = this.pivot(new THREE.Vector3()).add(new THREE.Vector3(0.55, 0.95, 1.75).applyQuaternion(q));
      p.y -= this.coverK * 0.95;
      cam.position.copy(p);
      cam.rotation.set(pitch + shY - this.coverK * 0.25, -yaw + shX, shR, 'YXZ');
      cam.fov = damp(cam.fov, this.fov, 14, dt);
    }
    cam.updateProjectionMatrix();
  }

  onDroneEnd() {
    this.activeDrone = null;
  }
}
