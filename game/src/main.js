// نقطة الدخول: حلقة اللعبة، إدارة الحالات، إعادة اللقطة وتسجيل الفيديو والمشاركة
import * as THREE from 'three';
import { Save } from './core/save.js';
import { Shop } from './core/shop.js';
import { CONFIG } from './config.js';
import { REGIONS, findMission } from './data/regions.js';
import { DIFFICULTIES } from './data/defs.js';
import { Post } from './engine/post.js';
import { AudioEngine } from './engine/audio.js';
import { MenuScene } from './engine/menuscene.js';
import { World } from './game/world.js';
import { MissionRunner } from './game/mission.js';
import { ReplayDirector } from './game/replay.js';
import { Input } from './ui/input.js';
import { HUD } from './ui/hud.js';
import { UI } from './ui/ui.js';
import { clamp, rand, fmtInt } from './core/util.js';

const $ = (id) => document.getElementById(id);

class App {
  constructor() {
    this.state = 'boot';
    this.world = null;
    this.mission = null;
    this.replay = null;
    this.last = performance.now();
    this.time = 0;
    this.quickReplayT = 0;
  }

  bootProgress(p, text) {
    $('boot-fill').style.width = `${Math.round(p * 100)}%`;
    if (text) document.querySelector('.boot-sub').textContent = text;
  }

  async boot() {
    Save.load();
    this.settings = Save.data.settings;
    this.bootProgress(0.2, 'تهيئة الرسوميات…');
    this.canvas = $('gl');
    this.quality = this.settings.quality;
    this.post = new Post(this.canvas, this.quality);
    this.audio = new AudioEngine();
    this.input = new Input(this.canvas, this.settings);
    this.ui = new UI(this);
    this.hud = new HUD();
    this._bindHud();
    this.applySettings();
    await new Promise((r) => setTimeout(r, 30));
    this.bootProgress(0.5, 'بناء ساحة المعركة…');
    await new Promise((r) => requestAnimationFrame(r));
    this.menu = new MenuScene(this.post.renderer, this.audio, this.quality);
    this.bootProgress(0.9, 'جاهز');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
    const first = () => {
      this.audio.init();
      this.audio.setVolume(this.settings.volume);
      this.audio.setMusicVolume(this.settings.music);
      if (this.state === 'menu') this.audio.startMusic();
      if (this.settings.control === 'gyro') this.input.enableGyro();
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
    };
    window.addEventListener('pointerdown', first);
    window.addEventListener('keydown', first);
    this.state = 'menu';
    this.ui.openMenu();
    requestAnimationFrame((t) => this.loop(t));
    // تسجيل عامل الخدمة للعب دون اتصال
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude|usercontent/.test(location.host)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    window.__game = this;
  }

  onMenu() {
    if (this.audio.ctx) this.audio.startMusic();
  }

  _bindHud() {
    const inp = this.input;
    inp.bindButton($('btn-fire'), { edge: 'fire', hold: 'fireDown' });
    inp.bindButton($('btn-zoom'), { edge: 'zoom' });
    inp.bindButton($('btn-thermal'), { edge: 'thermal' });
    inp.bindButton($('btn-cover'), { down: () => { inp.coverToggle = !inp.coverToggle; } });
    inp.bindButton($('btn-pause'), { edge: 'pause' });
    inp.bindButton($('btn-top'), { edge: 'top' });
    inp.bindButton($('btn-replay-quick'), { edge: 'replay' });
    inp.bindStick($('stick'), $('stick-knob'));
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    document.querySelectorAll('#dpad button').forEach((b) => inp.bindArrow(b, ...dirs[b.dataset.a]));
    $('weapon-bar').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.wbtn');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      inp.selectWeapon(b.dataset.w);
    });
    $('btn-skip').onclick = () => this.endReplay();
    $('btn-rec').onclick = () => { if (this.replay && !this.recorder) { const c = this.replayClip; this.endReplay(true); this.playClip(c, true); } };
  }

  applySettings() {
    const s = this.settings;
    const hud = $('hud');
    const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    hud.classList.toggle('ctrl-buttons', s.control === 'buttons');
    hud.classList.toggle('ctrl-dpad', s.control === 'dpad');
    hud.classList.toggle('desktop', !touch && s.control === 'mouse');
    this.audio.setVolume(s.volume);
    this.audio.setMusicVolume(s.music);
    this.audio.voiceEnabled = !!s.voice;
    if (this.world && this.world.vision.mode !== 'day') this._setThermal(true);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.post.setSize(w, h);
    for (const cam of [this.menu && this.menu.camera, this.world && this.world.camera, this.replay && this.replay.cam]) {
      if (!cam) continue;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    this.hud.resize();
  }

  // ===== بدء مهمة =====
  async startMission(mid, diffId) {
    if (this._starting) return;
    this._starting = true;
    this.audio.init();
    this.audio.stopMusic();
    this._disposeWorld();
    const f = findMission(mid);
    const diff = DIFFICULTIES.find((d) => d.id === diffId) || DIFFICULTIES[1];
    this.cur = { mid, diff: diff.id, ri: f.ri, mi: f.mi };
    this.ui.showLoading(mid);
    this.state = 'loading';
    const d = Save.data;
    const loadout = { weapons: d.weapons, upgrades: d.upgrades, skin: d.skin, vip: !!d.premium.vip, tow2b: !!d.premium.tow2b };
    const world = new World({ renderer: this.post.renderer, audio: this.audio, quality: this.quality, region: f.region, mission: f.mission, difficulty: diff, loadout, settings: this.settings });
    try {
      await world.build((p, t) => this.ui.setLoading(p, t));
    } catch (e) {
      console.error(e);
      this.ui.toast(`تعذّر بناء المهمة: ${e.message}`);
      this._starting = false;
      this.quitToMap();
      return;
    }
    this.world = world;
    world.mission = new MissionRunner(world, f.region, f.mission, diff, f.ri);
    this.mission = world.mission;
    world.camera.aspect = window.innerWidth / window.innerHeight;
    world.camera.updateProjectionMatrix();
    this.hud.attach(world, f.region);
    world.events.on('end', (e) => this._onEnd(e));
    world.events.on('clip', () => { if (this.settings.autoReplay) { this.quickReplayT = 8; $('btn-replay-quick').hidden = false; } });
    world.events.on('drone', (d2) => {
      this.post.u.uDrone.value = d2.on ? 1 : 0;
      if (!d2.on) { this.post.u.uStatic.value = 1; }
    });
    this.input.resetToggles();
    this.input.enabled = true;
    this.ui.hideAll();
    $('hud').hidden = false;
    document.getElementById('app').classList.add('playing');
    this.state = 'play';
    this._starting = false;
    this.endT = null;
    this.post.u.uThermal.value = 0;
    this.post.u.uWarm.value = ['golden', 'dusk', 'dawn'].includes(world.envCfg.time) ? 1 : 0;
    if (world.envCfg.time === 'night') {
      this._setThermal(true);
      this.hud.toast('مهمة ليلية: المنظار الحراري مفعّل (زر حراري / T)');
    }
    this.hud.center(f.mission.name, `${f.region.name} · ${diff.name}`, 2.6);
    this.time = 0;
  }

  _disposeWorld() {
    if (this.replay) this.endReplay(true);
    if (this.world) {
      this.world.dispose();
      this.world = null;
      this.mission = null;
    }
    $('btn-replay-quick').hidden = true;
    this.post.u.uDrone.value = 0;
    this.post.u.uThermal.value = 0;
    this.post.u.uDamage.value = 0;
    this.post.u.uChroma.value = 0;
  }

  _setThermal(on) {
    const w = this.world;
    if (!w) return;
    const mode = on ? (this.settings.thermalPolarity === 'black' ? 'bh' : 'wh') : 'day';
    w.setVision(mode);
    this.post.u.uThermal.value = on ? 1 : 0;
    this.post.u.uBlackHot.value = on && mode === 'bh' ? 1 : 0;
    this.audio.click();
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.siren(false);
    this.audio.lockTone(-1);
    if (this.audio.ctx) this.audio.ctx.suspend();
    $('p-replay').hidden = !(this.world && (this.world.lastClip || this.world.bestClip));
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'pause') return;
    if (this.audio.ctx) this.audio.ctx.resume();
    this.ui.hideAll();
    this.state = 'play';
    this.input.enabled = true;
    this.last = performance.now();
  }

  restartMission() {
    if (this.audio.ctx) this.audio.ctx.resume();
    if (this.cur) this.startMission(this.cur.mid, this.cur.diff);
  }

  quitToMap() {
    if (this.audio.ctx) this.audio.ctx.resume();
    this._disposeWorld();
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    $('hud').hidden = true;
    $('replay-ui').hidden = true;
    document.getElementById('app').classList.remove('playing');
    this.state = 'menu';
    this.ui.openMap();
    this.audio.startMusic();
  }

  _onEnd(e) {
    // أكمل المشهد قليلاً قبل شاشة النتيجة
    this.endT = 2.6;
    this.endInfo = e;
    this.hud.center(e.success ? 'تمّت المهمة' : 'فشلت المهمة', e.success ? 'الله أكبر' : '', 2.4);
    if (e.success) this.audio.say('تمت المهمة. الله أكبر');
  }

  _showEnd() {
    const e = this.endInfo;
    const res = this.mission.results();
    const gained = Save.recordResult(this.cur.mid, this.cur.diff, res, this.cur.ri, this.cur.mi);
    this.state = 'end';
    $('hud').hidden = true;
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.siren(false);
    this.audio.lockTone(-1);
    this.lastResult = { success: e.success, res, reason: e.reason, gained, mid: this.cur.mid, diff: this.cur.diff, hasClip: !!this.world.lastClip, hasBest: !!this.world.bestClip && this.world.bestClip !== this.world.lastClip };
    this.ui.showEnd(this.lastResult);
  }

  shareResultLink(info) {
    const f = findMission(info.mid);
    const stars = '★'.repeat(info.res.stars) + '☆'.repeat(3 - info.res.stars);
    const url = Shop.shareUrl();
    const text = info.success
      ? `🎯 أنجزت مهمة «${f.mission.name}» في ${f.region.name} — لعبة ردع العدوان\n${stars}\n💥 ${info.res.kills} إصابة · أبعد رمية ${fmtInt(info.res.longest)} م · ${fmtInt(info.res.score)} نقطة\nهل تستطيع التفوق علي؟ ${url}`
      : `💥 معركة «${f.mission.name}» في ${f.region.name} لم تنتهِ بعد! ${info.res.kills} إصابة حتى الآن — لعبة ردع العدوان ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  // ===== إعادة اللقطة =====
  playClip(clip, record = false) {
    if (!clip || !this.world) { this.ui.toast('لا توجد لقطة بعد — دمّر هدفاً أولاً'); return; }
    if (this.replay) this.endReplay(true);
    this.replayFrom = this.state;
    if (this.state === 'pause' && this.audio.ctx) this.audio.ctx.resume();
    this.state = 'replay';
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.hideAll();
    $('hud').hidden = true;
    $('btn-replay-quick').hidden = true;
    $('replay-ui').hidden = false;
    const m = clip.meta;
    $('replay-info').textContent = `${m.targetName || ''} · ${fmtInt(m.distance || 0)} م${m.turretToss ? ' · طار البرج' : ''}`;
    this.replayClip = clip;
    this.savedVision = this.world.vision.mode;
    if (this.savedVision !== 'day') { this.world.setVision('day'); this.post.u.uThermal.value = 0; }
    this.post.u.uDrone.value = 0;
    this.replay = new ReplayDirector(this.world, clip, { onEnd: () => setTimeout(() => this.endReplay(), 700) });
    this.replay.start();
    this.replay.cam.aspect = window.innerWidth / window.innerHeight;
    this.replay.cam.updateProjectionMatrix();
    $('rec-dot').hidden = true;
    $('btn-rec').hidden = !this._canRecord();
    if (record) this._startRecording();
  }

  endReplay(silent = false) {
    if (!this.replay) return;
    const rp = this.replay;
    this.replay = null;
    rp.stop();
    if (this.recorder) this._stopRecording();
    $('replay-ui').hidden = true;
    if (this.savedVision && this.savedVision !== 'day') { this.world.setVision(this.savedVision); this.post.u.uThermal.value = 1; }
    if (this.world && this.world.player.activeDrone) this.post.u.uDrone.value = 1;
    if (silent) return;
    const from = this.replayFrom;
    if (from === 'end') { this.state = 'end'; this.ui.show('end'); }
    else if (from === 'pause') { this.state = 'pause'; this.ui.show('pause'); if (this.audio.ctx) this.audio.ctx.suspend(); }
    else { this.state = 'play'; $('hud').hidden = false; this.input.enabled = true; this.last = performance.now(); }
  }

  _canRecord() {
    return !!(window.MediaRecorder && this.canvas.captureStream);
  }

  _startRecording() {
    if (!this._canRecord()) { this.ui.toast('تسجيل الفيديو غير مدعوم في هذا المتصفح'); return; }
    try {
      const stream = this.canvas.captureStream(30);
      if (this.audio.recDest) for (const t of this.audio.recDest.stream.getAudioTracks()) stream.addTrack(t);
      const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => this._videoReady(new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' }));
      rec.start(250);
      this.recorder = rec;
      $('rec-dot').hidden = false;
      $('btn-rec').hidden = true;
    } catch (e) {
      this.ui.toast('تعذّر بدء التسجيل');
    }
  }

  _stopRecording() {
    const r = this.recorder;
    this.recorder = null;
    $('rec-dot').hidden = true;
    try { r.stop(); } catch (e) { /* */ }
  }

  _videoReady(blob) {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `rada3-replay.${ext}`, { type: blob.type });
    const url = URL.createObjectURL(blob);
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    this.ui.modal(`<h3>فيديو اللقطة جاهز</h3>
      <video src="${url}" controls playsinline style="width:100%;max-height:40vh;background:#000"></video>
      <p class="muted">${canShare ? 'اضغط «مشاركة» واختر واتساب.' : 'احفظ الفيديو ثم أرسله عبر واتساب.'} ${ext === 'webm' ? 'ملاحظة: بعض نسخ واتساب لا تعرض webm.' : ''}</p>
      <div class="row">${canShare ? '<button class="btn wa" id="v-share">مشاركة</button>' : ''}<a class="btn" id="v-save" href="${url}" download="rada3-replay.${ext}">حفظ الفيديو</a><button class="btn ghost" id="v-close">إغلاق</button></div>`, (card, close) => {
      // داخل صفحات Claude Artifacts: الحفظ عبر قدرة downloads إن توفرت
      const save = card.querySelector('#v-save');
      const cl = window.claude;
      if (cl && typeof cl.use === 'function') {
        cl.use('downloads').then((dl) => {
          if (!dl) return;
          save.onclick = async (ev) => {
            ev.preventDefault();
            try { await dl.save({ filename: `rada3-replay.${ext}`, data: blob }); this.ui.toast('تم حفظ الفيديو'); } catch (err) { if (err && err.code !== 'declined') this.ui.toast('تعذّر حفظ الفيديو هنا'); }
          };
        }).catch(() => {});
      }
      const sh = card.querySelector('#v-share');
      if (sh) sh.onclick = async () => {
        try { await navigator.share({ files: [file], title: 'ردع العدوان', text: `لقطة من لعبة ردع العدوان ${Shop.shareUrl()}` }); } catch (e) { /* أُلغي */ }
      };
      card.querySelector('#v-close').onclick = close;
    });
  }

  // ===== الحلقة الرئيسية =====
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dtReal = Math.min(0.05, Math.max(0.0005, (now - this.last) / 1000));
    this.last = now;
    this.time += dtReal;
    try {
      if (this.state === 'play' || (this.state === 'end' && this.world) || (this.state === 'loading' && false)) this._frameGame(dtReal);
      else if (this.state === 'replay' && this.replay) this._frameReplay(dtReal);
      else if (this.state === 'pause' && this.world) this.post.render(this.world.scene, this.world.camera, this.time, this.world.env.exposure);
      else if (this.menu && (this.state === 'menu' || this.state === 'loading' || this.state === 'boot')) {
        this.menu.update(dtReal);
        this.menu.camera.aspect = window.innerWidth / window.innerHeight;
        this.menu.camera.updateProjectionMatrix();
        this.post.u.uWarm.value = 1;
        this.post.render(this.menu.scene, this.menu.camera, this.time, this.menu.env.exposure);
      }
    } catch (e) {
      console.error(e);
      if (!this._errShown) { this._errShown = true; this.ui.toast(`خطأ: ${e.message}`, 5000); }
    }
  }

  _frameGame(dt) {
    const w = this.world;
    const cam = w.camera;
    if (this.state === 'play') {
      const inp = this.input.frame(dt, cam.fov, window.innerHeight);
      if (inp.pausePressed) { this.pause(); return; }
      if (inp.thermalPressed) this._setThermal(w.vision.mode === 'day');
      if (inp.replayPressed && (w.lastClip || w.bestClip)) { this.playClip(w.lastClip || w.bestClip); return; }
      w.player.update(dt, inp);
      w.update(dt);
    } else {
      // بعد النهاية: المشهد يستمر بلا تحكم
      w.update(dt * 0.6);
    }
    if (this.endT != null && this.state === 'play') {
      this.endT -= dt;
      if (this.endT <= 0) { this.endT = null; this._showEnd(); }
    }
    if (this.quickReplayT > 0) { this.quickReplayT -= dt; if (this.quickReplayT <= 0) $('btn-replay-quick').hidden = true; }
    w.fx.update(dt, cam);
    w.env.update(dt, cam);
    this.audio.setListener(cam);
    this._weather(dt, w, cam);
    // تركيز الظلال حيث ينظر اللاعب
    const range = this.hud.range ? Math.min(this.hud.range.dist, 3000) : 400;
    const aim = w.player.activeDrone ? w.player.activeDrone.pos.clone() : cam.position.clone().addScaledVector(cam.getWorldDirection(new THREE.Vector3()), range * 0.92);
    const rad = clamp(range * Math.tan((cam.fov * Math.PI) / 360) * 1.6, 50, 600);
    w.env.focusShadow(aim, w.player.activeDrone ? 120 : rad);
    w.env.sun.shadow.normalBias = (2 * rad / w.env.sun.shadow.mapSize.x) * 1.5;
    if (this.post.u.uStatic.value > 0) this.post.u.uStatic.value = Math.max(0, this.post.u.uStatic.value - dt * 2.5);
    this.post.u.uGrain.value = w.vision.mode !== 'day' ? 0.05 : 0.03;
    this.post.render(w.scene, cam, this.time, w.env.exposure);
    w.recorder.capture(dt, cam);
    if (this.state === 'play') this.hud.update(dt, w, cam, this.post);
    this.post.adapt(dt);
  }

  _weather(dt, w, cam) {
    const env = w.env;
    if (env.rain) {
      const n = Math.floor(dt * 600 * (this.quality === 'low' ? 0.4 : 1));
      for (let i = 0; i < n; i++) {
        w.fx.smoke.spawn({ x: cam.position.x + rand(-40, 40), y: cam.position.y + rand(5, 25), z: cam.position.z + rand(-45, 15), vx: 1, vy: -22, vz: 0.5, life: 1.2, size: 0.025, color: [0.8, 0.82, 0.88, 0.35], color1: [0.8, 0.82, 0.88, 0.25], frame: 3, stretch: 0.03, wind: 0 });
      }
    }
    if (env.dust && Math.random() < dt * 20) {
      w.fx.smoke.spawn({ x: cam.position.x + rand(-60, 60), y: cam.position.y + rand(-3, 8), z: cam.position.z + rand(-80, 10), vx: env.wind.x * 2, vy: 0.2, vz: env.wind.z * 2, life: 6, size: 4, size1: 9, color: [0.75, 0.6, 0.42, 0.18], color1: [0.75, 0.62, 0.45, 0], frame: 1, fadeIn: 0.3 });
    }
  }

  _frameReplay(dt) {
    const rp = this.replay;
    rp.update(dt);
    if (!this.replay) return;
    this.world.env.update(dt, rp.cam);
    this.world.env.focusShadow(rp.cam.position.clone().add(rp.cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(20)), 70);
    this.post.u.uDamage.value = 0;
    this.post.u.uChroma.value = rp.speed < 0.5 ? 0.6 : 0;
    this.post.render(this.world.scene, rp.cam, this.time, this.world.env.exposure);
  }
}

const app = new App();
app.boot().catch((e) => {
  console.error(e);
  const el = $('boot-err');
  el.hidden = false;
  el.textContent = `تعذّر تشغيل اللعبة: ${e.message}. جرّب متصفحاً يدعم WebGL2.`;
});
