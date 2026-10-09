// الإدخال: سحب باللمس، أزرار وعصا توجيه، دوران الجهاز (جيروسكوب)، فأرة، لوحة مفاتيح، يد تحكم
import * as THREE from 'three';
import { clamp, DEG } from '../core/util.js';

const zee = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.enabled = false;
    this.dx = 0; this.dy = 0;          // بكسلات سحب/فأرة متراكمة
    this.gdx = 0; this.gdy = 0;        // راديان من الجيروسكوب
    this.stick = { x: 0, y: 0 };       // عصا التوجيه
    this.keys = new Set();
    this.fireDown = false;
    this._edges = {};
    this.coverToggle = false;
    this.coverHeld = false;
    this.boostHeld = false;
    this.locked = false;
    this.gyroOn = false;
    this._lastGyro = null;
    this._touches = new Map();
    this._pressT = 0;
    this._moved = 0;
    this._bind();
  }

  edge(name) { if (this.enabled) this._edges[name] = true; }

  _bind() {
    const c = this.canvas;
    // الفأرة
    c.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 2) { this.edge('zoom'); return; }
      if (e.button !== 0) return;
      if (this.settings.pointerLock && !this.locked && c.requestPointerLock && !matchMedia('(pointer: coarse)').matches) {
        // نقرة الالتقاط لا تطلق
        try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* */ }
        this._lockClick = true;
        return;
      }
      if (this.locked) { this.fireDown = true; this.edge('fire'); }
      else { this._mouseDrag = true; this._pressT = performance.now(); this._moved = 0; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (this._lockClick) { this._lockClick = false; this.fireDown = false; return; }
      if (this._mouseDrag) {
        this._mouseDrag = false;
        if (this.enabled && this._moved < 6 && performance.now() - this._pressT < 350) { this.edge('fire'); this._tapFire = 0.12; }
      }
      this.fireDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this._mouseDrag) {
        this.dx += e.movementX || 0;
        this.dy += e.movementY || 0;
        this._moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
      }
    });
    c.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const now = performance.now();
      if (now - (this._wheelT || 0) < 180) return;
      this._wheelT = now;
      this.edge(e.deltaY < 0 ? 'zoomIn' : 'zoomOut');
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === c;
      if (this.locked) this._mouseDrag = false;
      else if (was && this.enabled && this.onLockLost) this.onLockLost();
    });

    // اللمس: السحب في أي مكان من الشاشة للتصويب
    c.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) this._touches.set(t.identifier, { x: t.clientX, y: t.clientY, t0: performance.now(), moved: 0 });
      e.preventDefault();
    }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        const s = this._touches.get(t.identifier);
        if (!s) continue;
        const ddx = t.clientX - s.x, ddy = t.clientY - s.y;
        s.x = t.clientX; s.y = t.clientY;
        s.moved += Math.abs(ddx) + Math.abs(ddy);
        if (this.settings.control !== 'buttons' && this.settings.control !== 'dpad') { this.dx += ddx; this.dy += ddy; }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        const s = this._touches.get(t.identifier);
        if (s && this.settings.tapToFire && s.moved < 8 && performance.now() - s.t0 < 250) this.edge('fire');
        this._touches.delete(t.identifier);
      }
    };
    c.addEventListener('touchend', end);
    c.addEventListener('touchcancel', end);

    // لوحة المفاتيح
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.code;
      if (!this.keys.has(k)) {
        if ((k === 'Space' || k === 'KeyF') && this.enabled) { this.fireDown = true; this.edge('fire'); }
        if (k === 'KeyZ' || k === 'KeyQ') this.edge('zoom');
        if (k === 'KeyE') this.edge('zoomOut');
        if (k === 'KeyT') this.edge('thermal');
        if (k === 'KeyC') this.coverToggle = !this.coverToggle;
        if (k === 'Escape' || k === 'KeyP') this.edge('pause');
        if (k === 'Tab' && this.enabled) { this.edge('next'); e.preventDefault(); }
        if (k === 'KeyR') this.edge('replay');
        if (k === 'KeyB') this.edge('top');
        if (k === 'KeyX') this.edge('cancelDrone');
        if (/^Digit[1-5]$/.test(k)) this.edge(`w${k.slice(5)}`);
      }
      this.keys.add(k);
      if (this.enabled && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space' || e.code === 'KeyF') this.fireDown = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.fireDown = false; this.stick.x = this.stick.y = 0; });

    // دوران الجهاز
    this._onOrient = (e) => this._gyro(e);
  }

  // ربط أزرار الشاشة
  bindButton(el, { down, up, edge, hold } = {}) {
    if (!el) return;
    const on = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('pressed');
      if (edge) this.edge(edge);
      if (hold) this[hold] = true;
      down && down(e);
    };
    const off = (e) => {
      el.classList.remove('pressed');
      if (hold) this[hold] = false;
      up && up(e);
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }

  // عصا توجيه: سحب داخل الدائرة يعطي معدّل دوران
  bindStick(base, knob) {
    if (!base) return;
    let id = null;
    const set = (cx, cy) => {
      const r = base.getBoundingClientRect();
      const R = r.width / 2;
      let x = (cx - (r.left + R)) / R, y = (cy - (r.top + R)) / R;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      this.stick.x = x; this.stick.y = y;
      knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`;
    };
    base.addEventListener('pointerdown', (e) => { id = e.pointerId; base.setPointerCapture(id); set(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
    const rel = (e) => { if (e.pointerId !== id) return; id = null; this.stick.x = this.stick.y = 0; knob.style.transform = ''; };
    base.addEventListener('pointerup', rel);
    base.addEventListener('pointercancel', rel);
  }

  // أزرار الأسهم: ضغط مستمر
  bindArrow(el, sx, sy) {
    if (!el) return;
    const on = (e) => { e.preventDefault(); e.stopPropagation(); this._arrow = { x: sx, y: sy }; el.classList.add('pressed'); };
    const off = () => { if (this._arrow && this._arrow.x === sx && this._arrow.y === sy) this._arrow = null; el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }

  async enableGyro() {
    try {
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) return false;
      if (typeof DOE.requestPermission === 'function') {
        const r = await DOE.requestPermission();
        if (r !== 'granted') return false;
      }
      window.addEventListener('deviceorientation', this._onOrient);
      this.gyroOn = true;
      this._lastGyro = null;
      return true;
    } catch (e) { return false; }
  }

  disableGyro() {
    window.removeEventListener('deviceorientation', this._onOrient);
    this.gyroOn = false;
    this._lastGyro = null;
  }

  _gyro(e) {
    if (e.alpha == null) return;
    this._gyroSeen = true;
    const orient = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * DEG;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e.beta * DEG, e.alpha * DEG, -e.gamma * DEG, 'YXZ'));
    q.multiply(q1);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(zee, -orient));
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const yaw = Math.atan2(f.x, -f.z);
    const pitch = Math.asin(clamp(f.y, -1, 1));
    if (this._lastGyro && this.enabled) {
      let dy = yaw - this._lastGyro.yaw;
      if (dy > Math.PI) dy -= Math.PI * 2;
      if (dy < -Math.PI) dy += Math.PI * 2;
      const dp = pitch - this._lastGyro.pitch;
      if (Math.abs(dy) < 0.5 && Math.abs(dp) < 0.5) {
        const s = this.settings.gyroSens ?? 1;
        this.gdx += dy * s;
        this.gdy += dp * s;
      }
    }
    this._lastGyro = { yaw, pitch };
  }

  _gamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    if (!gp) return { x: 0, y: 0 };
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : v);
    const prev = this._gpPrev || [];
    const b = gp.buttons.map((x) => x.pressed);
    const pressed = (i) => b[i] && !prev[i];
    if (pressed(7) || pressed(0)) this.edge('fire');
    this._gpFire = b[7] || b[0];
    if (pressed(6)) this.edge('zoom');
    if (pressed(3)) this.edge('thermal');
    if (pressed(2)) this.edge('next');
    if (pressed(9)) this.edge('pause');
    if (pressed(1)) this.coverToggle = !this.coverToggle;
    if (pressed(5)) this.edge('replay');
    this._gpPrev = b;
    return { x: dz(gp.axes[0] || 0) + dz(gp.axes[2] || 0), y: dz(gp.axes[1] || 0) + dz(gp.axes[3] || 0) };
  }

  // لقطة الإدخال لكل إطار مع تحويل كل شيء إلى زوايا
  frame(dt, fovDeg, screenH) {
    const fov = fovDeg * DEG;
    const sens = this.settings.sens ?? 1;
    const inv = this.settings.invertY ? -1 : 1;
    const perPx = (fov / Math.max(300, screenH)) * sens;
    let ax = this.dx * perPx * (this.locked ? 0.8 : 1);
    let ay = -this.dy * perPx * (this.locked ? 0.8 : 1) * inv;
    this.dx = 0; this.dy = 0;
    // معدّل الدوران من العصا والأسهم والمفاتيح ويد التحكم
    let rx = this.stick.x, ry = this.stick.y;
    if (this._arrow) { rx += this._arrow.x; ry += this._arrow.y; }
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) rx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) rx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) ry -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) ry += 1;
    const gp = this._gamepad(dt);
    rx += gp.x; ry += gp.y;
    const rate = fov * 0.85 * (this.settings.stickSens ?? 1);
    const curve = (v) => Math.sign(v) * Math.min(1, Math.abs(v)) ** 2;
    ax += curve(rx) * rate * dt;
    ay += -curve(ry) * rate * dt * inv;
    // الجيروسكوب
    if (this.gyroOn) {
      ax += this.gdx;
      ay += this.gdy;
    }
    this.gdx = 0; this.gdy = 0;
    const e = this._edges;
    this._edges = {};
    let weaponSel = null;
    for (let i = 1; i <= 5; i++) if (e[`w${i}`]) weaponSel = ['tow', 'mg', 'igla', 'drone', 'rockets'][i - 1];
    if (e.weapon) weaponSel = e.weapon;
    if (this._tapFire > 0) this._tapFire -= dt;
    return {
      aimDX: ax, aimDY: ay,
      fireDown: this.fireDown || this._gpFire || this._tapFire > 0 || this.keys.has('Space'),
      firePressed: !!e.fire,
      zoomPressed: !!e.zoom, zoomOut: !!e.zoomOut, zoomIn: !!e.zoomIn,
      thermalPressed: !!e.thermal, pausePressed: !!e.pause,
      coverHeld: this.coverHeld || this.keys.has('ControlLeft'),
      coverToggle: this.coverToggle,
      nextWeapon: !!e.next, weaponSel,
      replayPressed: !!e.replay, topToggle: !!e.top,
      boostHeld: this.boostHeld || this.keys.has('ShiftLeft'),
      cancelDrone: !!e.cancelDrone,
    };
  }

  selectWeapon(id) { this._edges.weapon = id; }
  resetToggles() {
    this.coverToggle = false; this.coverHeld = false; this.fireDown = false; this.stick.x = this.stick.y = 0; this._arrow = null;
    this._edges = {}; this.dx = this.dy = this.gdx = this.gdy = 0; this._tapFire = 0;
  }
}
