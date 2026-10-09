// محرك صوت إجرائي بالكامل عبر WebAudio — انفجارات، صواريخ، مروحيات، موسيقى عود ودربكة
import * as THREE from 'three';
import { clamp, rand } from '../core/util.js';

const SPEED_OF_SOUND = 343;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.musicVolume = 0.45;
    this.muted = false;
    this.lpos = new THREE.Vector3();
    this.lright = new THREE.Vector3(1, 0, 0);
    this.loops = new Set();
    this._musicOn = false;
    this.voiceEnabled = true;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.sfx = ctx.createGain();
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.25;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.sfx.connect(this.muffle).connect(this.comp);
    this.musicBus.connect(this.comp);
    this.comp.connect(this.master).connect(ctx.destination);
    try {
      this.recDest = ctx.createMediaStreamDestination();
      this.master.connect(this.recDest);
    } catch (e) { this.recDest = null; }
    // ضجيج أبيض وبني
    const len = ctx.sampleRate * 3;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const r = Math.random() * 2 - 1;
      w[i] = r;
      last = (last + 0.02 * r) / 1.02;
      b[i] = last * 3.5;
    }
  }

  get ok() { return !!this.ctx && !this.muted; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusicVolume(v) { this.musicVolume = v; if (this.musicBus) this.musicBus.gain.value = v; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }

  setListener(camera) {
    this.lpos.copy(camera.position);
    this.lright.set(1, 0, 0).applyQuaternion(camera.quaternion);
  }

  _spatial(pos, range = 1) {
    if (!pos) return { gain: 1, pan: 0, delay: 0, cutoff: 20000, d: 0 };
    const d = pos.distanceTo(this.lpos);
    const dir = pos.clone().sub(this.lpos).normalize();
    const pan = clamp(dir.dot(this.lright), -1, 1) * 0.8;
    return {
      d,
      gain: 1 / Math.pow(1 + d / (110 * range), 1.3),
      pan,
      delay: Math.min(d / SPEED_OF_SOUND, 5),
      cutoff: clamp(20000 / (1 + d / 220), 250, 20000),
    };
  }

  // سلسلة إخراج مكانية
  _chain(sp, gain = 1) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = sp.cutoff;
    const g = ctx.createGain();
    g.gain.value = gain * sp.gain;
    let out = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = sp.pan;
      g.connect(p);
      out = p;
    }
    f.connect(g);
    out.connect(this.sfx);
    return { input: f, gain: g, filter: f };
  }

  _noise(type = 'white', when, dur, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = type === 'brown' ? this.brown : this.white;
    s.playbackRate.value = rate;
    s.loop = true;
    s.start(when, Math.random() * 2);
    s.stop(when + dur + 0.05);
    return s;
  }

  _env(param, when, peak, attack, decay, curve = 'exp') {
    param.setValueAtTime(0.0001, when);
    param.linearRampToValueAtTime(peak, when + attack);
    if (curve === 'exp') param.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    else param.linearRampToValueAtTime(0, when + attack + decay);
  }

  explosion(pos, size = 1, kind = 'he') {
    if (!this.ok) return;
    const ctx = this.ctx;
    const sp = this._spatial(pos, Math.sqrt(size) * 2.2);
    const t = this.now + sp.delay;
    const vol = Math.min(1.6, 0.9 * Math.sqrt(size));
    const out = this._chain(sp, vol);
    // صدع حاد
    if (sp.d < 1500) {
      const n = this._noise('white', t, 0.2);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.6;
      const g = ctx.createGain();
      this._env(g.gain, t, 0.9, 0.002, 0.14);
      n.connect(bp).connect(g).connect(out.input);
    }
    // جسم الانفجار
    const dur = (kind === 'water' ? 1.2 : 2.2) * (0.7 + size * 0.4);
    const nb = this._noise('brown', t, dur + 0.5, 0.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(kind === 'water' ? 2400 : 1400, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g2 = ctx.createGain();
    this._env(g2.gain, t, 1.2, 0.008, dur);
    nb.connect(lp).connect(g2).connect(out.input);
    // ضربة تحت صوتية
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(75, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 0.9);
    const g3 = ctx.createGain();
    this._env(g3.gain, t, 1.1 * Math.min(1.5, size), 0.01, 1.0 + size * 0.3);
    o.connect(g3).connect(out.input);
    o.start(t); o.stop(t + 2 + size);
    // تدحرج بعيد
    if (size > 1.2) {
      const nr = this._noise('brown', t + 0.3, 4.5, 0.5);
      const lr = ctx.createBiquadFilter(); lr.type = 'lowpass'; lr.frequency.value = 260;
      const gr = ctx.createGain();
      gr.gain.setValueAtTime(0.0001, t + 0.3);
      gr.gain.linearRampToValueAtTime(0.5, t + 0.8);
      gr.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
      nr.connect(lr).connect(gr).connect(out.input);
    }
    // صمم مؤقت عند الانفجارات القريبة
    if (sp.d < 45 * Math.sqrt(size)) this.deafen(clamp(1 - sp.d / (45 * Math.sqrt(size)), 0.2, 1));
  }

  deafen(k) {
    if (!this.ok) return;
    const t = this.now;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setValueAtTime(20000, t);
    this.muffle.frequency.exponentialRampToValueAtTime(500 + (1 - k) * 2000, t + 0.05);
    this.muffle.frequency.exponentialRampToValueAtTime(20000, t + 1.5 + k * 2.5);
    const o = this.ctx.createOscillator();
    o.frequency.value = 3800 + Math.random() * 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * k, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3 * k + 0.5);
    o.connect(g).connect(this.comp);
    o.start(t); o.stop(t + 4);
  }

  towLaunch() {
    if (!this.ok) return;
    const ctx = this.ctx, t = this.now;
    const out = this._chain({ gain: 1, pan: 0, cutoff: 20000 }, 0.9);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = ctx.createGain();
    this._env(g.gain, t, 1.2, 0.004, 0.35);
    o.connect(g).connect(out.input);
    o.start(t); o.stop(t + 0.5);
    const n = this._noise('white', t, 0.5);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7;
    const g2 = ctx.createGain();
    this._env(g2.gain, t, 1.0, 0.003, 0.3);
    n.connect(bp).connect(g2).connect(out.input);
    // اشتعال المحرك وصفيره المتلاشي
    const n2 = this._noise('white', t + 0.12, 4.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, t + 0.12);
    lp.frequency.exponentialRampToValueAtTime(900, t + 4);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.0001, t + 0.12);
    g3.gain.linearRampToValueAtTime(0.7, t + 0.2);
    g3.gain.exponentialRampToValueAtTime(0.05, t + 2);
    g3.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    n2.connect(lp).connect(g3).connect(out.input);
  }

  gunshot(pos, kind = 'cannon') {
    if (!this.ok) return;
    const ctx = this.ctx;
    const range = kind === 'cannon' ? 3 : kind === 'kpv' ? 0.6 : 1.2;
    const sp = this._spatial(pos, range);
    if (sp.gain < 0.01) return;
    const t = this.now + sp.delay;
    const out = this._chain(sp, kind === 'kpv' ? 0.55 : kind === 'cannon' ? 1 : 0.5);
    const n = this._noise('white', t, 0.3);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = kind === 'cannon' ? 900 : kind === 'kpv' ? 650 : 1300;
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    this._env(g.gain, t, 1, 0.002, kind === 'cannon' ? 0.5 : 0.09);
    n.connect(bp).connect(g).connect(out.input);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(kind === 'cannon' ? 90 : 140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g2 = ctx.createGain();
    this._env(g2.gain, t, kind === 'cannon' ? 1 : 0.6, 0.002, kind === 'cannon' ? 0.6 : 0.08);
    o.connect(g2).connect(out.input);
    o.start(t); o.stop(t + 0.8);
    if (kind === 'cannon') {
      const nb = this._noise('brown', t, 1.6, 0.7);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const g3 = ctx.createGain();
      this._env(g3.gain, t, 0.7, 0.01, 1.4);
      nb.connect(lp).connect(g3).connect(out.input);
    }
  }

  // صفير رصاصة قريبة
  whiz() {
    if (!this.ok) return;
    const ctx = this.ctx, t = this.now;
    const n = this._noise('white', t, 0.25);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(5000, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.2);
    const g = ctx.createGain();
    this._env(g.gain, t, 0.35, 0.02, 0.18);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    n.connect(bp).connect(g);
    if (p) { p.pan.value = rand(-0.9, 0.9); g.connect(p).connect(this.sfx); } else g.connect(this.sfx);
  }

  hitThud() {
    if (!this.ok) return;
    const ctx = this.ctx, t = this.now;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
    const g = ctx.createGain();
    this._env(g.gain, t, 0.8, 0.002, 0.3);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.4);
  }

  beep(freq = 880, dur = 0.08, vol = 0.15, type = 'square') {
    if (!this.ok) return;
    const ctx = this.ctx, t = this.now;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.comp);
    o.start(t); o.stop(t + dur + 0.02);
  }

  click() { this.beep(1400, 0.03, 0.08, 'triangle'); }
  coin() { this.beep(1320, 0.06, 0.1, 'triangle'); setTimeout(() => this.beep(1760, 0.1, 0.1, 'triangle'), 70); }

  radio() {
    if (!this.ok) return;
    const ctx = this.ctx, t = this.now;
    const n = this._noise('white', t, 0.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
    const g = ctx.createGain();
    this._env(g.gain, t, 0.18, 0.005, 0.16, 'lin');
    n.connect(bp).connect(g).connect(this.comp);
    this.beep(1150, 0.07, 0.07, 'sine');
  }

  // حلقة صوتية مكانية: مروحية، طائرة، مسيّرة، صاروخ
  loop(kind, pos) {
    if (!this.ok) return { kind, stopped: true, update() {}, throttle() {}, stop() {} };
    const ctx = this.ctx, t = this.now;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    f.connect(g);
    if (p) g.connect(p).connect(this.sfx); else g.connect(this.sfx);
    const nodes = [];
    let jetOsc = null, fpvOsc = null;
    let base = 1, cutoff = 1200, range = 1;
    if (kind === 'heli') {
      const n = this._noise('brown', t, 3600, 1);
      const am = ctx.createGain(); am.gain.value = 0.55;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 17;
      const lg = ctx.createGain(); lg.gain.value = 0.45;
      lfo.connect(lg).connect(am.gain);
      n.connect(am).connect(f);
      const whine = ctx.createOscillator(); whine.frequency.value = 1650;
      const wg = ctx.createGain(); wg.gain.value = 0.03;
      whine.connect(wg).connect(f);
      lfo.start(t); whine.start(t);
      nodes.push(n, lfo, whine);
      base = 1.3; cutoff = 900; range = 4;
    } else if (kind === 'jet') {
      const n = this._noise('white', t, 3600, 1);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.4;
      n.connect(bp).connect(f);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 85;
      const og = ctx.createGain(); og.gain.value = 0.25;
      o.connect(og).connect(f);
      o.start(t);
      nodes.push(n, o);
      jetOsc = o;
      base = 2.2; cutoff = 4000; range = 9;
    } else if (kind === 'moped') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 92;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 184;
      const vib = ctx.createOscillator(); vib.frequency.value = 7;
      const vg = ctx.createGain(); vg.gain.value = 4;
      vib.connect(vg).connect(o.frequency);
      const og = ctx.createGain(); og.gain.value = 0.25;
      o.connect(og).connect(f); o2.connect(og);
      o.start(t); o2.start(t); vib.start(t);
      nodes.push(o, o2, vib);
      base = 1; cutoff = 1200; range = 2.5;
    } else if (kind === 'fpv') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 260;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 263;
      const og = ctx.createGain(); og.gain.value = 0.12;
      o.connect(og).connect(f); o2.connect(og);
      o.start(t); o2.start(t);
      nodes.push(o, o2);
      fpvOsc = [o, o2];
      base = 0.6; cutoff = 3000; range = 50;
    } else if (kind === 'motor') {
      const n = this._noise('white', t, 3600, 1);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6;
      n.connect(bp).connect(f);
      nodes.push(n);
      base = 0.5; cutoff = 6000; range = 1.5;
    } else if (kind === 'engine') {
      const n = this._noise('brown', t, 3600, 0.6);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38;
      const og = ctx.createGain(); og.gain.value = 0.2;
      o.connect(og).connect(f); n.connect(f);
      o.start(t);
      nodes.push(n, o);
      base = 0.7; cutoff = 500; range = 1.2;
    }
    const self = this;
    const handle = {
      kind,
      stopped: false,
      update(pos2, vel) {
        if (handle.stopped || !self.ctx) return;
        const sp = self._spatial(pos2, range);
        const tt = self.now;
        g.gain.setTargetAtTime(base * sp.gain, tt, 0.08);
        f.frequency.setTargetAtTime(Math.min(cutoff, sp.cutoff), tt, 0.08);
        if (p) p.pan.setTargetAtTime(sp.pan, tt, 0.08);
        if (vel && kind === 'jet' && jetOsc) {
          const dir = pos2.clone().sub(self.lpos).normalize();
          const vr = vel.dot(dir);
          const dop = SPEED_OF_SOUND / (SPEED_OF_SOUND + vr);
          jetOsc.frequency.setTargetAtTime(85 * dop, tt, 0.1);
        }
      },
      throttle(k) {
        if (fpvOsc) for (const o of fpvOsc) o.frequency.setTargetAtTime(200 + k * 260, self.now, 0.05);
      },
      stop() {
        if (handle.stopped) return;
        handle.stopped = true;
        const tt = self.now;
        g.gain.setTargetAtTime(0, tt, 0.15);
        setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) { /* */ } } try { g.disconnect(); } catch (e) { /* */ } }, 800);
        self.loops.delete(handle);
      },
    };
    this.loops.add(handle);
    handle.update(pos || null);
    return handle;
  }

  stopAllLoops() { for (const l of [...this.loops]) l.stop(); }

  siren(on) {
    if (!this.ok) return;
    if (on && !this._siren) {
      const ctx = this.ctx, t = this.now;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35;
      const lg = ctx.createGain(); lg.gain.value = 220;
      o.frequency.value = 680;
      lfo.connect(lg).connect(o.frequency);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.6);
      o.connect(lp).connect(g).connect(this.comp);
      o.start(t); lfo.start(t);
      this._siren = { o, lfo, g };
    } else if (!on && this._siren) {
      const s = this._siren;
      this._siren = null;
      s.g.gain.setTargetAtTime(0, this.now, 0.3);
      setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch (e) { /* */ } }, 1500);
    }
  }

  lockTone(state) {
    // 0 بحث، 1 مقفل، -1 إيقاف
    if (!this.ok) return;
    if (state < 0) { if (this._lock) { try { this._lock.o.stop(); } catch (e) { /* */ } this._lock = null; } return; }
    if (!this._lock) {
      const o = this.ctx.createOscillator(); o.type = 'square';
      const g = this.ctx.createGain(); g.gain.value = 0;
      o.connect(g).connect(this.comp);
      o.start();
      this._lock = { o, g, state: -1 };
    }
    if (this._lock.state === state) return;
    this._lock.state = state;
    const t = this.now;
    const { o, g } = this._lock;
    g.gain.cancelScheduledValues(t);
    if (state === 1) { o.frequency.setValueAtTime(1250, t); g.gain.setValueAtTime(0.06, t); }
    else {
      o.frequency.setValueAtTime(780, t);
      for (let k = 0; k < 40; k++) { g.gain.setValueAtTime(0.05, t + k * 0.25); g.gain.setValueAtTime(0, t + k * 0.25 + 0.1); }
    }
  }

  ambience(kind) {
    if (!this.ok) return;
    if (this._amb) { const a = this._amb; try { a.n.stop(); a.lfo.stop(); } catch (e) { /* */ } try { a.g.disconnect(); } catch (e) { /* */ } this._amb = null; }
    if (!kind) return;
    const ctx = this.ctx, t = this.now;
    const n = this._noise('brown', t, 3600, kind === 'rain' ? 2.2 : 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = kind === 'rain' ? 'highpass' : 'lowpass';
    lp.frequency.value = kind === 'rain' ? 900 : 380;
    const g = ctx.createGain(); g.gain.value = kind === 'rain' ? 0.12 : 0.18;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.08;
    lfo.connect(lg).connect(g.gain);
    lfo.start(t);
    n.connect(lp).connect(g).connect(this.sfx);
    this._amb = { n, lfo, g };
  }

  // أصوات معركة بعيدة عشوائية
  distantBattle(dt, intensity = 1) {
    if (!this.ok) return;
    this._db = (this._db || 0) - dt;
    if (this._db > 0) return;
    this._db = rand(1.5, 5) / intensity;
    const far = new THREE.Vector3(this.lpos.x + rand(-3000, 3000), 0, this.lpos.z - rand(1500, 5000));
    if (Math.random() < 0.6) this.explosion(far, rand(0.6, 2.2), 'far');
    else {
      const n = 3 + Math.floor(Math.random() * 8);
      for (let i = 0; i < n; i++) setTimeout(() => this.gunshot(far, 'rifle'), i * 110);
    }
  }

  // نداءات صوتية عربية عبر التوليف الكلامي إن توفر
  say(text) {
    if (!this.voiceEnabled || this.muted) return;
    try {
      const s = window.speechSynthesis;
      if (!s) return;
      const voices = s.getVoices();
      const v = voices.find((x) => /^ar/i.test(x.lang));
      if (!v) return;
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = 1.05; u.pitch = 0.9; u.volume = Math.min(1, this.volume + 0.1);
      s.cancel();
      s.speak(u);
    } catch (e) { /* */ }
  }

  // ===== موسيقى: عود (Karplus-Strong) على مقام الحجاز مع إيقاع المقسوم =====
  _pluck(freq) {
    this._plucks ||= new Map();
    const key = Math.round(freq * 10);
    if (this._plucks.has(key)) return this._plucks.get(key);
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 2.2);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0, prev = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const nxt = 0.5 * (cur + prev) * 0.996;
      prev = cur;
      ring[idx] = nxt;
      d[i] = cur * (i < 40 ? i / 40 : 1);
      idx = (idx + 1) % N;
    }
    this._plucks.set(key, buf);
    return buf;
  }

  startMusic() {
    if (!this.ctx || this._musicOn) return;
    this._musicOn = true;
    const scale = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66, 311.13, 369.99, 392.0];
    const ctx = this.ctx;
    const bpm = 96, eighth = 60 / bpm / 2;
    let next = ctx.currentTime + 0.1, step = 0, noteIdx = 4;
    // طنين القرار
    const dr = ctx.createOscillator(); dr.type = 'sawtooth'; dr.frequency.value = 73.42;
    const dr2 = ctx.createOscillator(); dr2.type = 'sawtooth'; dr2.frequency.value = 73.9;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 260;
    const dg = ctx.createGain(); dg.gain.value = 0.06;
    dr.connect(dlp); dr2.connect(dlp); dlp.connect(dg).connect(this.musicBus);
    dr.start(); dr2.start();
    this._drone = [dr, dr2, dg];
    const maqsum = ['D', 'T', '', 'T', 'D', '', 'T', ''];
    const tick = () => {
      if (!this._musicOn) return;
      while (next < ctx.currentTime + 0.25) {
        const s = step % 8;
        const bar = Math.floor(step / 8);
        const hit = maqsum[s];
        if (hit === 'D') this._doum(next);
        else if (hit === 'T') this._tak(next, 0.5);
        else if (Math.random() < 0.3) this._tak(next, 0.18);
        // لحن عود متجول
        const play = s === 0 || s === 3 || s === 4 || (s === 6 && Math.random() < 0.7) || (Math.random() < 0.15);
        if (play && bar % 8 !== 7) {
          noteIdx = Math.max(0, Math.min(scale.length - 1, noteIdx + Math.floor(Math.random() * 5) - 2));
          if (s === 0 && bar % 4 === 0) noteIdx = Math.random() < 0.5 ? 4 : 7;
          const src = ctx.createBufferSource();
          src.buffer = this._pluck(scale[noteIdx]);
          const g = ctx.createGain(); g.gain.value = 0.32;
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
          src.connect(lp).connect(g).connect(this.musicBus);
          src.start(next);
          if (Math.random() < 0.25) {
            const s2 = ctx.createBufferSource(); s2.buffer = src.buffer;
            const g2 = ctx.createGain(); g2.gain.value = 0.18;
            s2.connect(lp); s2.start(next + eighth * 0.5);
          }
        }
        next += eighth;
        step++;
      }
      this._musicTimer = setTimeout(tick, 60);
    };
    tick();
  }

  _doum(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.2);
    const g = ctx.createGain();
    this._env(g.gain, t, 0.55, 0.003, 0.35);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 0.45);
  }

  _tak(t, v) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.white;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.5;
    const g = ctx.createGain();
    this._env(g.gain, t, v, 0.001, 0.07);
    n.connect(bp).connect(g).connect(this.musicBus);
    n.start(t, Math.random()); n.stop(t + 0.1);
  }

  stopMusic() {
    this._musicOn = false;
    clearTimeout(this._musicTimer);
    if (this._drone) {
      const [a, b, g] = this._drone;
      g.gain.setTargetAtTime(0, this.now, 0.3);
      setTimeout(() => { try { a.stop(); b.stop(); } catch (e) { /* */ } }, 1500);
      this._drone = null;
    }
  }
}
