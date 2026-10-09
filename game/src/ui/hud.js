// واجهة القتال: منظار التاو، البوصلة، علامات الأهداف، بث المسيّرة، الإصابات والتحذيرات
import * as THREE from 'three';
import { WEAPONS } from '../data/defs.js';
import { FACTIONS } from '../data/defs.js';
import { clamp, fmtTime, fmtInt, DEG } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

const MSG = {
  lost: 'انقطع التوجيه السلكي!',
  shtora: 'تشويش شتورا! اضرب الدبابة من الجانب أو الخلف',
  guiding: 'الصاروخ في الجو — أبقِ التصويب على الهدف',
  reloading: 'جارٍ التلقيم…',
  noammo: 'نفدت ذخيرة هذا السلاح',
  overheat: 'سبطانة الرشاش ساخنة!',
  nolock: 'لا يوجد قفل حراري — صوّب على الطائرة وانتظر النغمة',
  notarget: 'حدّد نقطة أبعد من 250 م',
  flares: 'الهدف أطلق مشاعل حرارية!',
  top_on: 'تاو 2B: وضع الهجوم العلوي',
  top_off: 'تاو: وضع الإصابة المباشرة',
  resupply: '+2 صاروخ تاو',
};

const WARN = {
  atgm: { text: 'صاروخ موجّه قادم — احتمِ!', cls: 'red', beep: true },
  jet: { text: 'طيران حربي روسي — احتمِ!', cls: 'red' },
  heli: { text: 'مروحية معادية تقترب', cls: 'amber' },
  rockets: { text: 'رشقة صواريخ من المروحية!', cls: 'red' },
  grad: { text: 'رشقة غراد! احتمِ', cls: 'red' },
  drone: { text: 'مسيّرة انتحارية إيرانية!', cls: 'amber' },
};

const COMPASS = { 0: 'ش', 45: 'ش.ق', 90: 'ق', 135: 'ج.ق', 180: 'ج', 225: 'ج.غ', 270: 'غ', 315: 'ش.غ' };

export class HUD {
  constructor() {
    this.canvas = $('hud-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.popups = [];
    this.dmgDirs = [];
    this.hitMark = 0;
    this.killMark = 0;
    this.toastT = 0;
    this.warnT = 0;
    this.radioT = 0;
    this.centerT = 0;
    this.dmgFlash = 0;
    this.cache = {};
    this.range = null;
    this._rangeT = 0;
    this.world = null;
    this.north = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
    this.canvas.style.width = `${this.W}px`; this.canvas.style.height = `${this.H}px`;
  }

  _set(id, prop, val) {
    const k = `${id}.${prop}`;
    if (this.cache[k] === val) return;
    this.cache[k] = val;
    const el = $(id);
    if (!el) return;
    if (prop === 'text') el.textContent = val;
    else if (prop === 'html') el.innerHTML = val;
    else if (prop === 'width') el.style.width = val;
    else if (prop === 'class') el.className = val;
    else if (prop === 'hidden') el.hidden = val;
  }

  attach(world, region) {
    this.world = world;
    this.north = (region.env && region.env.north) || 0;
    this.popups = []; this.dmgDirs = []; this.cache = {};
    $('killfeed').innerHTML = '';
    const ev = world.events;
    ev.on('kill', (k) => this._onKill(k));
    ev.on('hit', (h) => { if (!h.quiet) this.hitMark = 0.25; });
    ev.on('playerHit', (h) => this._onDamage(h));
    ev.on('warning', (w) => this._warn(w));
    ev.on('hudmsg', (k) => this.toast(MSG[k] || k));
    ev.on('radio', (r) => this.radio(r.text || ''));
    ev.on('drone', (d) => { $('hud').classList.toggle('drone-mode', d.on); });
    this._buildWeaponBar(world.player);
  }

  _buildWeaponBar(pl) {
    const bar = $('weapon-bar');
    bar.innerHTML = '';
    for (const id of pl.weapons) {
      const b = document.createElement('button');
      b.className = 'wbtn';
      b.dataset.w = id;
      b.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true">${ICONS[id] || ''}</svg><span class="wname">${WEAPONS[id].short}</span><span class="wammo" id="ammo-${id}"></span>`;
      bar.appendChild(b);
    }
  }

  toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    this.toastT = 2.2;
  }

  radio(text) {
    if (!text) return;
    const el = $('radio');
    $('radio-text').textContent = text;
    el.classList.add('show');
    this.radioT = 4;
    this.world?.audio.radio();
    if (/الله أكبر|إصابة مباشرة/.test(text)) this.world?.audio.say(text.replace(/!/g, ''));
  }

  center(text, sub = '', t = 2.2) {
    $('center-msg-main').textContent = text;
    $('center-msg-sub').textContent = sub;
    $('center-msg').classList.add('show');
    this.centerT = t;
  }

  _warn(w) {
    const d = WARN[w.kind];
    if (!d) return;
    const el = $('warning');
    el.textContent = d.text;
    el.className = `warning show ${d.cls}`;
    this.warnT = 3.5;
    if (d.beep && this.world) {
      const a = this.world.audio;
      for (let i = 0; i < 6; i++) setTimeout(() => a.beep(1350, 0.07, 0.12), i * 180);
    }
    if (w.from && this.world) {
      const p = this.world.player;
      const ang = Math.atan2(w.from.x - p.pos.x, -(w.from.z - p.pos.z));
      this.dmgDirs.push({ ang, t: 2, warn: true });
    }
  }

  _onKill(k) {
    const e = k.entity;
    const feed = $('killfeed');
    const row = document.createElement('div');
    row.className = 'kf';
    const fac = FACTIONS[e.def.faction] || FACTIONS.regime;
    const src = { tow: 'تاو', mg: 'رشاش', igla: 'إيغلا', drone: 'شاهين', rockets: 'راجمة', splash: 'شظايا', chain: 'انفجار' }[k.info.source] || '';
    row.innerHTML = `<span class="kf-src">${src}</span><span class="kf-name" style="--fac:${fac.color}">${e.def.name}</span>${k.pts ? `<b class="kf-pts">+${fmtInt(k.pts)}</b>` : ''}${k.tags.length ? `<em>${k.tags.join(' · ')}</em>` : ''}`;
    feed.prepend(row);
    while (feed.children.length > 5) feed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 6000);
    setTimeout(() => row.remove(), 7000);
    this.killMark = 0.6;
    if (k.pts) {
      const c = e.center(new THREE.Vector3());
      this.popups.push({ pos: c, text: `+${fmtInt(k.pts)}`, t: 1.6, tags: k.tags });
    }
    if (k.info.turretToss) this.center('طار البرج!', e.def.name, 1.6);
    else if (e.cls === 'heli' || e.cls === 'jet') this.center('إسقاط!', e.def.name, 1.8);
    else if (k.info.distance > 2500) this.center('رمية أسطورية', `${Math.round(k.info.distance)} م`, 1.6);
    this.world?.audio.coin();
  }

  _onDamage(h) {
    this.dmgFlash = Math.min(1, this.dmgFlash + h.amount / 30);
    if (h.from && this.world) {
      const p = this.world.player;
      const ang = Math.atan2(h.from.x - p.pos.x, -(h.from.z - p.pos.z));
      this.dmgDirs.push({ ang, t: 1.5 });
    }
  }

  // ==================== التحديث ====================
  update(dt, world, camera, post) {
    const pl = world.player;
    const m = world.mission;
    // الأهداف والوقت
    if (m) {
      const st = m.objectiveStatus();
      const html = st.map((s) => `<li class="${s.done ? 'done' : ''}">${s.text}</li>`).join('');
      this._set('obj-list', 'html', html);
      const left = m.timeLimit ? Math.max(0, m.timeLimit - m.t) : m.t;
      this._set('timer', 'text', fmtTime(left));
      this._set('timer', 'class', m.timeLimit && left < 30 ? 'timer urgent' : 'timer');
      this._set('score', 'text', fmtInt(m.score));
    }
    // الصحة والانكشاف
    const hpK = pl.hp / pl.maxHp;
    this._set('hp-fill', 'width', `${Math.round(hpK * 100)}%`);
    this._set('hp-bar', 'class', `bar hp ${hpK < 0.3 ? 'low' : ''}`);
    this._set('exp-fill', 'width', `${Math.round(pl.exposure * 100)}%`);
    this._set('exp-bar', 'class', `bar exp ${pl.exposure > 0.6 ? 'high' : ''}`);
    // الأسلحة
    for (const id of pl.weapons) {
      const a = pl.ammo[id];
      this._set(`ammo-${id}`, 'text', a === Infinity ? '∞' : String(a));
    }
    document.querySelectorAll('.wbtn').forEach((b) => b.classList.toggle('active', b.dataset.w === pl.weapon));
    const w = pl.weapon;
    let status = '';
    if (w === 'tow') status = pl.activeTow ? (pl.activeTow.wireOk ? 'توجيه…' : 'بلا توجيه') : pl.reload > 0 ? 'تلقيم' : pl.ammo.tow > 0 ? 'جاهز' : 'فارغ';
    else if (w === 'mg') status = pl.overheat ? 'ساخن!' : 'جاهز';
    else if (w === 'igla') status = pl.lock.locked ? 'مقفل' : pl.lock.target ? 'قفل…' : 'بحث';
    else if (w === 'drone') status = pl.activeDrone ? 'في الجو' : pl.ammo.drone > 0 ? 'جاهزة' : 'فارغ';
    else if (w === 'rockets') status = pl.rocketCd > 0 ? `${Math.ceil(pl.rocketCd)} ث` : pl.ammo.rockets > 0 ? 'جاهزة' : 'فارغ';
    this._set('wstatus', 'text', status);
    const rl = w === 'tow' ? (pl.reload > 0 && !pl.activeTow ? 1 - pl.reload / WEAPONS.tow.reload : 1) : w === 'mg' ? 1 - pl.heat : w === 'rockets' ? 1 - pl.rocketCd / WEAPONS.rockets.cooldown : 1;
    this._set('reload-fill', 'width', `${Math.round(clamp(rl, 0, 1) * 100)}%`);
    this._set('btn-top', 'hidden', !pl.topAttack || w !== 'tow');
    this._set('btn-top', 'class', `hbtn small ${pl.useTop ? 'on' : ''}`);
    this._set('btn-cover', 'class', `hbtn ${pl.inCover ? 'on' : ''}`);
    this._set('btn-thermal', 'class', `hbtn ${world.vision.mode !== 'day' ? 'on' : ''}`);
    this._set('zoom-label', 'text', `×${pl.zoom}`);

    // مؤقتات العناصر
    const fade = (key, id) => { if (this[key] > 0) { this[key] -= dt; if (this[key] <= 0) $(id).classList.remove('show'); } };
    fade('toastT', 'toast'); fade('warnT', 'warning'); fade('radioT', 'radio'); fade('centerT', 'center-msg');
    this.hitMark = Math.max(0, this.hitMark - dt);
    this.killMark = Math.max(0, this.killMark - dt);
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 1.4);
    if (post) {
      post.u.uDamage.value = Math.max(this.dmgFlash * 0.6, hpK < 0.3 ? (0.3 - hpK) * 1.4 * (0.6 + 0.4 * Math.sin(world.time * 4)) : 0);
      post.u.uChroma.value = this.dmgFlash * 2;
    }
    // مقياس المدى (كل 0.1 ث)
    this._rangeT -= dt;
    if (this._rangeT <= 0 && !pl.activeDrone) {
      this._rangeT = 0.1;
      this.range = world.rangeAt(camera.position, pl.aimDir(_v.set(0, 0, 0)), 6000);
    }
    this._draw(dt, world, camera);
  }

  _proj(p, cam) {
    _v.copy(p).project(cam);
    if (_v.z > 1 || _v.z < -1) return null;
    return { x: (_v.x + 1) / 2 * this.W, y: (1 - _v.y) / 2 * this.H, on: Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1 };
  }

  _draw(dt, world, cam) {
    const g = this.ctx, W = this.W, H = this.H;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const pl = world.player;
    const thermal = world.vision.mode !== 'day';
    const ink = thermal ? 'rgba(255,255,255,0.92)' : 'rgba(10,12,10,0.88)';
    const cx = W / 2, cy = H / 2;
    if (pl.activeDrone) { this._drawDrone(g, world, cam); this._drawCommon(g, world, cam, dt); return; }
    if (pl.scoped) this._drawScope(g, world, ink, thermal);
    else if (pl.weapon === 'mg') this._drawRing(g, cx, cy, thermal);
    else if (pl.weapon === 'igla') this._drawIgla(g, world, cam, cx, cy);
    else this._drawCross(g, cx, cy, thermal ? '#fff' : '#f2efe4', pl.weapon === 'rockets');
    this._drawMarkers(g, world, cam);
    this._drawCommon(g, world, cam, dt);
    // غطاء الاحتماء
    if (pl.coverK > 0.05) {
      g.fillStyle = `rgba(20,16,10,${pl.coverK * 0.35})`;
      g.fillRect(0, 0, W, H);
      if (pl.coverK > 0.6) {
        g.font = '700 18px Changa, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,240,210,0.85)';
        g.fillText('محتمٍ خلف الساتر', cx, cy + 60);
      }
    }
  }

  _drawCommon(g, world, cam, dt) {
    const W = this.W, H = this.H, cx = W / 2, cy = H / 2;
    // علامة الإصابة
    if (this.hitMark > 0 || this.killMark > 0) {
      const k = this.killMark > 0;
      const s = 10 + (k ? 6 : 0);
      g.strokeStyle = k ? 'rgba(255,60,40,0.95)' : 'rgba(255,255,255,0.9)';
      g.lineWidth = k ? 3 : 2;
      g.beginPath();
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.moveTo(cx + a * s, cy + b * s); g.lineTo(cx + a * (s + 9), cy + b * (s + 9)); }
      g.stroke();
    }
    // نقاط عائمة
    g.textAlign = 'center';
    for (const p of this.popups) {
      p.t -= dt;
      const s = this._proj(p.pos, cam);
      if (!s || !s.on) continue;
      const a = clamp(p.t / 0.6, 0, 1);
      const yy = s.y - (1.6 - p.t) * 40 - 30;
      g.font = '800 22px Changa, sans-serif';
      g.fillStyle = `rgba(255,214,90,${a})`;
      g.strokeStyle = `rgba(0,0,0,${a * 0.7})`; g.lineWidth = 3;
      g.strokeText(p.text, s.x, yy); g.fillText(p.text, s.x, yy);
      if (p.tags.length) {
        g.font = '600 13px Changa, sans-serif';
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.strokeText(p.tags[0], s.x, yy + 18); g.fillText(p.tags[0], s.x, yy + 18);
      }
    }
    this.popups = this.popups.filter((p) => p.t > 0);
    // اتجاه الضرر/التهديد
    const pl = world.player;
    for (const d of this.dmgDirs) {
      d.t -= dt;
      const rel = d.ang - pl.yaw;
      const R = Math.min(W, H) * 0.32;
      const a = clamp(d.t, 0, 1);
      g.strokeStyle = d.warn ? `rgba(255,170,40,${a})` : `rgba(255,40,30,${a * 0.9})`;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx, cy, R, rel - Math.PI / 2 - 0.25, rel - Math.PI / 2 + 0.25);
      g.stroke();
    }
    this.dmgDirs = this.dmgDirs.filter((d) => d.t > 0);
    this._drawCompass(g, world);
  }

  _drawCompass(g, world) {
    const W = this.W;
    const pl = world.player;
    const yawDeg = (pl.activeDrone ? pl.activeDrone.yaw : pl.yaw) / DEG;
    const head = ((this.north + yawDeg) % 360 + 360) % 360;
    const cw = Math.min(420, Math.max(170, W - 470)), cx = W / 2, y = 14 + (window.visualViewport ? 0 : 0);
    const pxPerDeg = cw / 100;
    g.save();
    g.beginPath(); g.rect(cx - cw / 2, y - 4, cw, 34); g.clip();
    g.fillStyle = 'rgba(8,10,8,0.35)';
    g.fillRect(cx - cw / 2, y - 4, cw, 30);
    g.strokeStyle = 'rgba(240,235,215,0.8)'; g.fillStyle = 'rgba(240,235,215,0.9)';
    g.lineWidth = 1; g.textAlign = 'center'; g.font = '600 11px Changa, sans-serif';
    for (let d = Math.floor((head - 55) / 5) * 5; d <= head + 55; d += 5) {
      const x = cx + (d - head) * pxPerDeg;
      const dd = ((d % 360) + 360) % 360;
      const major = dd % 45 === 0;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (major ? 9 : 5)); g.stroke();
      if (major) g.fillText(COMPASS[dd], x, y + 21);
      else if (dd % 15 === 0) { g.globalAlpha = 0.6; g.fillText(String(dd), x, y + 20); g.globalAlpha = 1; }
    }
    // نقاط الأعداء على البوصلة
    for (const e of world.entities) {
      if (!e.alive || e.team !== 'enemy' || !e.spotted) continue;
      const b = Math.atan2(e.pos.x - pl.pos.x, -(e.pos.z - pl.pos.z)) / DEG + this.north;
      let rel = ((b - head + 540) % 360) - 180;
      if (Math.abs(rel) > 50) continue;
      const x = cx + rel * pxPerDeg;
      const air = e.cls === 'heli' || e.cls === 'jet' || e.cls === 'drone';
      g.fillStyle = air ? '#ff9a3c' : '#ff4436';
      g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x - 3.5, y - 3); g.lineTo(x + 3.5, y - 3); g.fill();
    }
    g.restore();
    g.fillStyle = 'rgba(240,235,215,0.95)';
    g.beginPath(); g.moveTo(cx, y + 26); g.lineTo(cx - 5, y + 32); g.lineTo(cx + 5, y + 32); g.fill();
    g.font = '700 12px "Share Tech Mono", monospace';
    g.fillText(String(Math.round(head)).padStart(3, '0'), cx, y + 44);
  }

  _drawMarkers(g, world, cam) {
    const pl = world.player;
    const markers = world.diff.markers;
    const W = this.W, H = this.H, cx = W / 2, cy = H / 2;
    let nearest = null, nd = 60;
    for (const e of world.entities) {
      if (!e.alive || e.escaped) continue;
      const friend = e.team === 'friend';
      const air = e.cls === 'heli' || e.cls === 'jet' || e.cls === 'drone';
      if (!friend && !e.spotted && !(e.tag === 'hvt')) continue;
      if (!markers && !friend && !air && e.tag !== 'hvt' && e.tag !== 'target') continue;
      const top = e.center(new THREE.Vector3());
      top.y += e.height * 0.7 + 1;
      const s = this._proj(top, cam);
      const dist = e.pos.distanceTo(pl.pos);
      if (!s) continue;
      if (!s.on) {
        if (air && !friend) {
          // سهم على حافة الشاشة للتهديدات الجوية
          const ang = Math.atan2(s.y - cy, s.x - cx);
          const ex = cx + Math.cos(ang) * (Math.min(W, H) * 0.42), ey = cy + Math.sin(ang) * (Math.min(W, H) * 0.42);
          g.save(); g.translate(ex, ey); g.rotate(ang);
          g.fillStyle = 'rgba(255,150,50,0.9)';
          g.beginPath(); g.moveTo(12, 0); g.lineTo(-6, -8); g.lineTo(-6, 8); g.fill();
          g.restore();
        }
        continue;
      }
      const sz = clamp(900 / (dist + 200), 3, 9) * (pl.zoom > 2 ? 1.4 : 1);
      if (friend) {
        g.strokeStyle = 'rgba(80,220,120,0.9)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(s.x - sz, s.y - sz); g.lineTo(s.x, s.y); g.lineTo(s.x + sz, s.y - sz); g.stroke();
        continue;
      }
      const hvt = e.tag === 'hvt';
      const tgt = e.tag === 'target';
      g.fillStyle = hvt ? '#ffc832' : air ? '#ff9a3c' : '#ff3b2f';
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1;
      g.beginPath();
      if (hvt) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? sz * 0.5 : sz * 1.3; i ? g.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r) : g.moveTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r); } g.closePath(); }
      else { g.moveTo(s.x, s.y + sz); g.lineTo(s.x - sz, s.y - sz * 0.4); g.lineTo(s.x + sz, s.y - sz * 0.4); g.closePath(); }
      g.fill(); g.stroke();
      if (tgt) { g.strokeStyle = 'rgba(255,60,45,0.8)'; g.lineWidth = 1.5; g.strokeRect(s.x - sz * 1.6, s.y - sz * 1.6, sz * 3.2, sz * 3.2); }
      const dd = Math.hypot(s.x - cx, s.y - cy);
      if (dd < nd) { nd = dd; nearest = { e, s, dist }; }
    }
    if (nearest) {
      g.font = '600 12px Changa, sans-serif'; g.textAlign = 'center';
      g.fillStyle = 'rgba(255,235,220,0.95)';
      g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3;
      const t = `${nearest.e.def.name} · ${Math.round(nearest.dist)} م`;
      g.strokeText(t, nearest.s.x, nearest.s.y - 14); g.fillText(t, nearest.s.x, nearest.s.y - 14);
    }
  }

  _drawCross(g, cx, cy, col, barrage) {
    g.strokeStyle = col; g.lineWidth = 1.6;
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 3;
    g.beginPath();
    g.moveTo(cx - 18, cy); g.lineTo(cx - 6, cy); g.moveTo(cx + 6, cy); g.lineTo(cx + 18, cy);
    g.moveTo(cx, cy - 18); g.lineTo(cx, cy - 6); g.moveTo(cx, cy + 6); g.lineTo(cx, cy + 18);
    g.stroke();
    g.beginPath(); g.arc(cx, cy, 1.6, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    if (barrage) { g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.stroke(); }
    g.shadowBlur = 0;
    if (this.range) {
      g.font = '700 13px "Share Tech Mono", monospace'; g.textAlign = 'left'; g.fillStyle = col;
      g.fillText(`${Math.round(this.range.dist)}m`, cx + 24, cy + 16);
    }
  }

  _drawRing(g, cx, cy, thermal) {
    // منظار حلقي مضاد للطائرات
    const c = thermal ? 'rgba(255,255,255,0.9)' : 'rgba(250,245,225,0.9)';
    g.strokeStyle = c; g.lineWidth = 1.5;
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 3;
    for (const r of [28, 64]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    g.beginPath();
    g.moveTo(cx - 80, cy); g.lineTo(cx - 6, cy); g.moveTo(cx + 6, cy); g.lineTo(cx + 80, cy);
    g.moveTo(cx, cy - 80); g.lineTo(cx, cy - 6); g.moveTo(cx, cy + 6); g.lineTo(cx, cy + 80);
    g.stroke();
    g.shadowBlur = 0;
    const pl = this.world.player;
    g.fillStyle = pl.overheat ? '#ff4b3a' : c;
    g.fillRect(cx + 90, cy + 40 - 80 * pl.heat, 5, 80 * pl.heat);
    g.strokeRect(cx + 90, cy - 40, 5, 80);
  }

  _drawIgla(g, world, cam, cx, cy) {
    const pl = world.player;
    g.strokeStyle = 'rgba(250,245,225,0.9)'; g.lineWidth = 1.5;
    g.strokeRect(cx - 40, cy - 30, 80, 60);
    g.beginPath(); g.moveTo(cx - 8, cy); g.lineTo(cx + 8, cy); g.moveTo(cx, cy - 8); g.lineTo(cx, cy + 8); g.stroke();
    const L = pl.lock;
    if (L.target) {
      const s = this._proj(L.target.center(new THREE.Vector3()), cam);
      if (s) {
        const k = clamp(L.t / WEAPONS.igla.lockTime, 0, 1);
        const r = 34 - k * 18;
        g.strokeStyle = L.locked ? '#ff3b2f' : `rgba(255,200,60,${0.5 + 0.5 * Math.sin(world.time * 20)})`;
        g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(s.x, s.y - r); g.lineTo(s.x + r, s.y); g.lineTo(s.x, s.y + r); g.lineTo(s.x - r, s.y); g.closePath(); g.stroke();
        g.font = '700 14px Changa, sans-serif'; g.textAlign = 'center'; g.fillStyle = L.locked ? '#ff3b2f' : '#ffc83c';
        g.fillText(L.locked ? 'مقفل — أطلق!' : 'جارٍ القفل…', s.x, s.y + r + 18);
      }
    }
  }

  _drawScope(g, world, ink, thermal) {
    const W = this.W, H = this.H, cx = W / 2, cy = H / 2;
    const pl = world.player;
    const R = Math.min(W, H) * 0.47;
    // قناع المنظار
    g.save();
    g.fillStyle = '#050605';
    g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, R, 0, Math.PI * 2, true); g.fill('evenodd');
    const grd = g.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.restore();
    // الشعيرات
    g.strokeStyle = ink; g.fillStyle = ink;
    g.lineWidth = 1.4;
    const gap = 14;
    g.beginPath();
    g.moveTo(cx - R, cy); g.lineTo(cx - gap, cy); g.moveTo(cx + gap, cy); g.lineTo(cx + R, cy);
    g.moveTo(cx, cy - R); g.lineTo(cx, cy - gap); g.moveTo(cx, cy + gap); g.lineTo(cx, cy + R);
    g.stroke();
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(cx - R, cy); g.lineTo(cx - R * 0.42, cy); g.moveTo(cx + R * 0.42, cy); g.lineTo(cx + R, cy);
    g.moveTo(cx, cy + R * 0.42); g.lineTo(cx, cy + R);
    g.stroke();
    g.lineWidth = 1.2;
    // علامات المدى بالميل
    const mil = (H / ((pl.camera.fov * DEG))) * 0.001; // بكسل لكل مِلّ
    for (let i = 1; i <= 6; i++) {
      const o = i * 5 * mil;
      if (o > R * 0.4) break;
      const h = i % 2 ? 4 : 7;
      g.beginPath(); g.moveTo(cx + o, cy - h); g.lineTo(cx + o, cy + h); g.moveTo(cx - o, cy - h); g.lineTo(cx - o, cy + h); g.stroke();
    }
    // أقواس حجم الدبابة (عرض 3.5م) عند 1000/2000/3000م
    g.font = '600 10px "Share Tech Mono", monospace'; g.textAlign = 'center';
    [1000, 2000, 3000].forEach((d, k) => {
      const wpx = (3.5 / d) / (pl.camera.fov * DEG) * H;
      const hpx = (2.3 / d) / (pl.camera.fov * DEG) * H;
      if (wpx < 4) return;
      const bx = cx + R * 0.18 + k * Math.max(26, wpx + 14), by = cy + R * 0.2;
      g.beginPath();
      g.moveTo(bx - wpx / 2 + 3, by - hpx); g.lineTo(bx - wpx / 2, by - hpx); g.lineTo(bx - wpx / 2, by); g.lineTo(bx - wpx / 2 + 3, by);
      g.moveTo(bx + wpx / 2 - 3, by - hpx); g.lineTo(bx + wpx / 2, by - hpx); g.lineTo(bx + wpx / 2, by); g.lineTo(bx + wpx / 2 - 3, by);
      g.stroke();
      g.fillText(String(d / 1000), bx, by + 12);
    });
    // معلومات المنظار
    g.font = '700 13px "Share Tech Mono", monospace';
    const tx = cx - R * 0.62, ty = cy + R * 0.62;
    g.textAlign = 'left';
    g.fillText(`TOW-2${pl.useTop ? 'B' : 'A'}  ×${pl.zoom}`, tx, ty);
    g.fillText(thermal ? (world.vision.mode === 'bh' ? 'THRM BH' : 'THRM WH') : 'DAY', tx, ty + 16);
    if (this.range) g.fillText(`RNG ${String(Math.round(this.range.dist)).padStart(4, '0')}`, tx, ty + 32);
    const m = pl.activeTow;
    g.textAlign = 'right';
    const rx = cx + R * 0.62;
    if (m && m.alive) {
      g.fillText(`TOF ${m.t.toFixed(1)}s`, rx, ty);
      g.fillText(`WIRE ${Math.round(m.traveled)}/3750`, rx, ty + 16);
      if (!m.wireOk) { g.fillStyle = '#ff3b2f'; g.fillText('WIRE CUT', rx, ty + 32); }
      else if (m.jam > 0.05) { g.fillStyle = '#ff3b2f'; g.fillText('JAMMED', rx, ty + 32); }
      // ومضة حول وهج الصاروخ
      const s = this._proj(m.pos, pl.camera);
      if (s && s.on) { g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(s.x - 6, s.y - 6, 12, 12); }
    } else {
      g.fillText(pl.reload > 0 ? `RLD ${pl.reload.toFixed(1)}` : `RDY ${pl.ammo.tow}`, rx, ty);
    }
    if (this.range && this.range.entity && this.range.entity.alive && this.range.entity.team === 'enemy') {
      g.textAlign = 'center';
      g.fillStyle = thermal ? '#fff' : '#9c1d12';
      g.font = '700 14px Changa, sans-serif';
      g.fillText(this.range.entity.def.name, cx, cy - R * 0.55);
    }
  }

  _drawDrone(g, world, cam) {
    const W = this.W, H = this.H, cx = W / 2, cy = H / 2;
    const d = world.player.activeDrone;
    const col = 'rgba(240,255,240,0.92)';
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.5;
    g.font = '700 14px "Share Tech Mono", monospace';
    // صليب ومنظار
    g.beginPath(); g.moveTo(cx - 22, cy); g.lineTo(cx - 8, cy); g.moveTo(cx + 8, cy); g.lineTo(cx + 22, cy); g.moveTo(cx, cy - 22); g.lineTo(cx, cy - 8); g.moveTo(cx, cy + 8); g.lineTo(cx, cy + 22); g.stroke();
    // أفق صناعي
    g.save(); g.translate(cx, cy); g.rotate(-d.roll); g.beginPath();
    const py = d.pitch * 220;
    g.moveTo(-120, py); g.lineTo(-40, py); g.moveTo(40, py); g.lineTo(120, py); g.stroke(); g.restore();
    const alt = d.pos.y - world.terrain.heightAt(d.pos.x, d.pos.z);
    const dist = d.pos.distanceTo(world.player.pos);
    g.textAlign = 'left';
    g.fillText(`ALT ${Math.round(alt)}m`, 24, cy - 10);
    g.fillText(`SPD ${Math.round(d.speed * 3.6)}km/h`, 24, cy + 10);
    g.fillText(`DST ${Math.round(dist)}m`, 24, cy + 30);
    g.textAlign = 'right';
    g.fillText(`BAT ${Math.max(0, Math.round(d.battery / 80 * 100))}%`, W - 24, cy - 10);
    const bars = Math.ceil(d.signal * 5);
    for (let i = 0; i < 5; i++) { g.globalAlpha = i < bars ? 1 : 0.25; g.fillRect(W - 70 + i * 9, cy + 30 - i * 4, 6, 6 + i * 4); }
    g.globalAlpha = 1;
    g.fillStyle = Math.sin(world.time * 6) > 0 ? '#ff3b2f' : 'transparent';
    g.beginPath(); g.arc(W - 120, 30, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = col; g.textAlign = 'right'; g.fillText('REC  شاهين', W - 24, 36);
    g.textAlign = 'center';
    g.font = '600 13px Changa, sans-serif';
    g.fillText('وجّه المسيّرة نحو الهدف — اضغط إطلاق للتسارع', cx, H - 120);
    this._drawMarkers(g, world, cam);
  }
}

// أيقونات الأسلحة (SVG مضمّن)
const ICONS = {
  tow: '<path d="M6 30h30l4-3v-4l-4-3H6z" fill="currentColor"/><rect x="10" y="16" width="8" height="5" fill="currentColor"/><path d="M14 30l-6 12M22 30l0 12M30 30l6 12" stroke="currentColor" stroke-width="2.4" fill="none"/>',
  mg: '<path d="M4 22h28v4H4z" fill="currentColor"/><rect x="30" y="19" width="8" height="10" fill="currentColor"/><path d="M38 24h6" stroke="currentColor" stroke-width="3"/><path d="M18 26l-6 16M22 26l2 16M26 26l8 16" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  igla: '<path d="M6 30L40 16" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M14 30l-2 10M20 27l2 9" stroke="currentColor" stroke-width="2.5"/><circle cx="41" cy="15.5" r="3" fill="currentColor"/>',
  drone: '<rect x="18" y="20" width="12" height="8" rx="2" fill="currentColor"/><path d="M12 16l24 16M36 16L12 32" stroke="currentColor" stroke-width="2.5"/><ellipse cx="11" cy="15" rx="7" ry="2" fill="currentColor"/><ellipse cx="37" cy="15" rx="7" ry="2" fill="currentColor"/><ellipse cx="11" cy="33" rx="7" ry="2" fill="currentColor"/><ellipse cx="37" cy="33" rx="7" ry="2" fill="currentColor"/>',
  rockets: '<path d="M8 40L26 10l4 2-14 30z" fill="currentColor"/><path d="M18 40L36 10l4 2-14 30z" fill="currentColor"/><path d="M6 42h34" stroke="currentColor" stroke-width="3"/>',
};
