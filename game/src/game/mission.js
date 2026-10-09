// منطق المهمة: الموجات، الأهداف، الغارات الروسية حسب الصعوبة، النقاط والنجوم
import * as THREE from 'three';
import { UNITS } from '../data/defs.js';
import { rand, pick, chance, clamp, mulberry32, hashStr } from '../core/util.js';

const RADIO = {
  start: ['على بركة الله، الأهداف أمامك. ابدأ بالرمي.', 'موقع التاو جاهز. توكّل على الله.', 'كل المحاور تتقدم. نحتاج غطاء التاو الآن.'],
  kill: ['إصابة مباشرة! الله أكبر', 'تم تدمير الهدف', 'رمية موفقة، استمر', 'احترقت! أحسنت'],
  turret: ['طار البرج! الله أكبر', 'برج الدبابة في السماء!'],
  heli: ['سقطت المروحية! الله أكبر'],
  jet: ['أسقطنا السوخوي! الله أكبر'],
  escape: ['هرب هدف من المحور', 'آلية تجاوزت المنطقة'],
  wave: ['رتل جديد يقترب', 'تعزيزات للعدو على الطريق', 'رصدنا حركة جديدة'],
  air: ['انتباه! طيران حربي روسي في الأجواء', 'سوخوي تقترب، احتمِ!'],
  heliIn: ['مروحية معادية تقترب'],
  drone: ['مسيّرة انتحارية إيرانية تقترب! أسقطها بالرشاش'],
  recon: ['مسيّرة استطلاع فوقنا، موقعك مكشوف'],
  friendLost: ['خسرنا آلية من الرتل!'],
  friendArrive: ['وصلت آلية من الرتل بسلام'],
  half: ['الهدف قريب، أكمل المهمة'],
  rockets: ['الراجمة أطلقت، الرشقة في الطريق'],
};

export class MissionRunner {
  constructor(world, region, def, diff, regionIndex) {
    this.world = world;
    this.region = region;
    this.def = def;
    this.diff = diff;
    this.power = regionIndex;
    this.p = def.params || {};
    this.t = 0;
    this.kills = 0;
    this.killsByCls = {};
    this.score = 0;
    this.escapes = 0;
    this.friendLost = 0;
    this.friendArrived = 0;
    this.objectives = [];
    this.waves = [];
    this.waveIdx = 0;
    this.state = 'running';
    this.tagged = [];
    this.allSpawned = [];
    this.friends = [];
    this.alertAll = false;
    this.airT = rand(35, 55);
    this.heliT = rand(50, 80);
    this.droneT = rand(40, 70);
    this.militiaT = rand(25, 45);
    this.bonus = [];
    this.longest = 0;
    this.turretTosses = 0;
    this.rnd = mulberry32(hashStr(def.id) + diff.id.length);
    this._setup();
  }

  radio(kind) {
    const list = RADIO[kind];
    if (!list) return;
    const text = pick(list);
    this.world.events.emit('radio', { kind, text });
  }

  n(base) { return Math.max(1, Math.round(base * this.diff.count + this.power * 0.15)); }

  lane(name) {
    const L = this.world.lanes[name];
    if (L) return L;
    const keys = Object.keys(this.world.lanes);
    return this.world.lanes[keys[Math.floor(this.rnd() * keys.length)]];
  }

  anchor(name) {
    return this.world.anchors[name] || Object.values(this.world.anchors)[0] || new THREE.Vector3(0, 0, -1500);
  }

  // ===== إعداد القوالب =====
  _setup() {
    const T = this.def.template, p = this.p;
    if (T === 'column') {
      const groups = (p.groups || 3) + ({ easy: -1, normal: 0, hard: 1, legend: 1 }[this.diff.id] || 0);
      let total = 0;
      for (let g = 0; g < groups; g++) {
        const size = 3 + (this.rnd() < 0.5 ? 1 : 0) + (this.power > 5 && this.diff.id !== 'easy' ? 1 : 0);
        const units = [];
        for (let k = 0; k < size; k++) units.push(p.mix[Math.floor(this.rnd() * p.mix.length)]);
        if (g === 0) units[0] = 't72';
        total += size;
        this.waves.push({ at: g === 0 ? 3 : null, after: g === 0 ? null : 18 + this.rnd() * 10, kind: 'convoy', lane: p.lanes[g % p.lanes.length], units, behavior: 'pass' });
      }
      const need = Math.max(3, Math.min(14, Math.round(total * (this.diff.id === 'easy' ? 0.45 : 0.55))));
      this.objectives.push({ type: 'kill', count: need, text: `دمّر ${need} آليات من الأرتال`, progress: () => this.kills });
      this.maxEscapes = p.maxEscapes ?? 3;
      this.objectives.push({ type: 'noescape', text: `لا تسمح بفرار أكثر من ${this.maxEscapes}`, progress: () => this.escapes, fail: true });
      this.timeLimit = null;
    } else if (T === 'assault' || T === 'depot') {
      const targets = T === 'depot' ? [p.depot, ...p.guards] : p.targets;
      const kinds = T === 'depot' ? ['depot', ...p.guardKinds] : p.kinds;
      targets.forEach((a, i) => this.waves.push({ at: 0, kind: 'static', anchor: a, unit: kinds[i], tag: T === 'depot' ? (i === 0 ? 'target' : null) : 'target', hullDown: kinds[i] === 't72' || kinds[i] === 't90' }));
      (p.squads || []).forEach((a) => this.waves.push({ at: 0, kind: 'squad', anchor: a, units: this._squad(4) }));
      (p.reinf || []).forEach((l, i) => this.waves.push({ at: 45 + i * 40, kind: 'convoy', lane: l, units: this._mix(['t72', 'bmp1', 'technical', 'bmp2'], 3), behavior: 'advance', stopAt: 0.75 }));
      if (T === 'depot') this.objectives.push({ type: 'tag', text: 'دمّر مستودع الذخيرة', progress: () => this._tagDone(), count: 1 });
      else this.objectives.push({ type: 'tag', text: `دمّر ${targets.length} أهداف محددة`, progress: () => this._tagDone(), count: targets.length });
      this.timeLimit = 420;
    } else if (T === 'escort') {
      this.waves.push({ at: 2, kind: 'friends', lane: p.lane, units: p.friendlies });
      p.ambush.forEach(([a, u], i) => this.waves.push({ at: 0, kind: 'static', anchor: a, unit: u, hullDown: u === 't72' }));
      this.waves.push({ at: 35, kind: 'squad', anchor: p.ambush[0][0], units: this._squad(5) });
      this.waves.push({ at: 60, kind: 'convoy', lane: Object.keys(this.world.lanes).find((k) => k !== p.lane) || p.lane, units: this._mix(['t72', 'technical', 'bmp1'], 3), behavior: 'advance', stopAt: 0.7 });
      this.need = p.need;
      this.objectives.push({ type: 'escort', text: `أوصل ${p.need} آليات من الرتل`, progress: () => this.friendArrived, count: p.need });
      this.timeLimit = 360;
      this.alertAll = true;
    } else if (T === 'airdef') {
      p.targets.forEach((a, i) => this.waves.push({ at: 0, kind: 'static', anchor: a, unit: p.kinds[i], tag: 'target' }));
      for (let i = 0; i < this.n(p.helis); i++) this.waves.push({ at: 8 + i * 28, kind: 'air', unit: this.rnd() < 0.6 ? 'mi24' : 'mi8', tag: 'air' });
      this.waves.push({ at: 50, kind: 'squad', anchor: p.targets[0], units: this._squad(4) });
      this.objectives.push({ type: 'tag', text: `دمّر ${p.targets.length} منظومات دفاع`, progress: () => this._tagDone('target'), count: p.targets.length });
      this.objectives.push({ type: 'tagAir', text: 'أسقط المروحيات المهاجمة', progress: () => this._tagDone('air'), count: this.n(p.helis) });
      this.timeLimit = (p.time || 150) + 120;
      this.forceHelis = true;
    } else if (T === 'hvt') {
      const lane = p.lane;
      const units = [...p.escorts.slice(0, 2), p.boss, ...p.escorts.slice(2)];
      this.waves.push({ at: 6, kind: 'convoy', lane, units, behavior: 'pass', bossIndex: 2, speedMul: 0.85 });
      (p.statics || []).forEach(([a, u]) => this.waves.push({ at: 0, kind: 'static', anchor: a, unit: u }));
      this.waves.push({ at: 40, kind: 'squad', anchor: Object.keys(this.world.anchors)[0], units: this._squad(4) });
      this.objectives.push({ type: 'hvt', text: `دمّر دبابة القائد (${UNITS[p.boss].name.replace('دبابة ', '')})`, progress: () => this._tagDone('hvt'), count: 1 });
      this.timeLimit = p.time || 160;
      this.hvtEscapeFails = true;
    } else if (T === 'militia') {
      for (let wv = 0; wv < (p.waves || 4); wv++) {
        const units = [];
        const n = 3 + wv + this.diff.militia;
        for (let k = 0; k < n; k++) units.push(this.rnd() < 0.7 ? 'technical' : 'bmp1');
        this.waves.push({ at: wv === 0 ? 4 : null, after: 14, kind: 'convoy', lane: p.lanes[wv % p.lanes.length], units, behavior: 'advance', stopAt: 0.85, militia: true });
        this.waves.push({ at: wv === 0 ? 10 : null, after: 6, kind: 'squad', anchor: Object.keys(this.world.anchors)[wv % Object.keys(this.world.anchors).length], units: this._squad(4 + wv, true), militia: true });
      }
      (p.statics || []).forEach(([a, u]) => this.waves.push({ at: 0, kind: 'static', anchor: a, unit: u, tag: 'target' }));
      this.objectives.push({ type: 'killAll', text: 'اصمد وصدّ كل موجات الميليشيات', progress: () => this.kills, count: 0 });
      this.timeLimit = 480;
      this.droneT = 20;
      this.alertAll = true;
    } else if (T === 'final') {
      (p.statics || []).forEach(([a, u]) => this.waves.push({ at: 0, kind: 'static', anchor: a, unit: u, tag: 'target', hullDown: u === 't90' }));
      for (let g = 0; g < 4; g++) this.waves.push({ at: g === 0 ? 5 : null, after: 15, kind: 'convoy', lane: p.lanes[g % p.lanes.length], units: this._mix(['t72', 't90', 'bmp2', 'technical', 'shilka', 'grad'], 4 + Math.floor(g / 2)), behavior: g % 2 ? 'advance' : 'pass', stopAt: 0.75 });
      this.waves.push({ at: 30, kind: 'air', unit: 'mi24', tag: null });
      this.waves.push({ at: 70, kind: 'air', unit: 'mi8', tag: null });
      this.objectives.push({ type: 'tag', text: 'دمّر آخر حصون النظام', progress: () => this._tagDone(), count: p.statics.length });
      this.objectives.push({ type: 'kill', text: 'دمّر 10 أهداف', count: 10, progress: () => this.kills });
      this.timeLimit = 540;
      this.forceHelis = true;
    }
  }

  _squad(n, militia = false) {
    const out = [];
    const nn = Math.round(n * this.diff.count);
    for (let i = 0; i < nn; i++) out.push(i === 0 && this.diff.id !== 'easy' ? 'rpg' : (militia || this.rnd() < 0.5 + this.diff.militia * 0.12 ? 'infantry' : 'soldier'));
    return out;
  }

  _mix(list, n) {
    const out = [];
    for (let i = 0; i < Math.round(n * this.diff.count); i++) out.push(list[Math.floor(this.rnd() * list.length)]);
    return out;
  }

  _tagDone(tag = 'target') {
    return this.tagged.filter((e) => (e.tag === tag || (tag === 'target' && e.tag === 'target')) && !e.alive && !e.escaped).length;
  }

  _spawnWave(wv) {
    const w = this.world;
    wv.spawned = true;
    wv.spawnT = this.t;
    wv.ents = [];
    if (wv.kind === 'convoy' || wv.kind === 'friends') {
      const L = this.lane(wv.lane);
      if (!L) return;
      wv.units.forEach((u, i) => {
        const e = w.spawn(u, {
          lane: L, startD: 10 + (wv.units.length - 1 - i) * 26, behavior: wv.kind === 'friends' ? 'advance' : wv.behavior,
          stopAt: wv.stopAt ? L.total * wv.stopAt - i * 28 : null, tag: i === wv.bossIndex ? 'hvt' : null, speed: (UNITS[u].speed || 8) * (wv.speedMul || 1),
        });
        // الأول في المقدمة، والبقية خلفه على مسافات موجبة دائماً
        e.d = 10 + (wv.units.length - 1 - i) * 26;
        if (i === wv.bossIndex) { e.shtoraOn = Math.random() < this.diff.shtora; e.spotted = true; }
        // رتل الثوار يصل بعد قطع مسافة معقولة ضمن زمن المهمة
        if (wv.kind === 'friends') e.arriveAt = Math.min(L.total - 2, e.d + 1700);
        wv.ents.push(e);
      });
      if (wv.kind === 'convoy' && wv.at !== 0 && this.waveIdx > 0) this.radio('wave');
    } else if (wv.kind === 'static') {
      const a = this.anchor(wv.anchor);
      const e = w.spawn(wv.unit, { pos: a.clone(), heading: Math.atan2(-a.x, -a.z) + rand(-0.3, 0.3), tag: wv.tag || null, hullDown: wv.hullDown });
      if (UNITS[wv.unit].shtora) e.shtoraOn = Math.random() < this.diff.shtora;
      wv.ents.push(e);
    } else if (wv.kind === 'squad') {
      const a = this.anchor(wv.anchor);
      wv.units.forEach((u) => {
        const p = a.clone().add(new THREE.Vector3(rand(-20, 20), 0, rand(-20, 20)));
        wv.ents.push(w.spawn(u, { pos: p }));
      });
    } else if (wv.kind === 'air') {
      const e = w.spawn(wv.unit, { tag: wv.tag });
      wv.ents.push(e);
      this.radio(UNITS[wv.unit].cls === 'jet' ? 'air' : 'heliIn');
    }
  }

  onSpawn(e) {
    this.allSpawned.push(e);
    if (e.tag) this.tagged.push(e);
    if (e.team === 'friend') this.friends.push(e);
    if (this.diff.markers === false && e.team === 'enemy') e.spotted = false;
  }

  onKill(e, info) {
    if (e.team === 'friend') {
      this.friendLost++;
      this.radio('friendLost');
      return;
    }
    this.kills++;
    this.killsByCls[e.cls] = (this.killsByCls[e.cls] || 0) + 1;
    const fromPlayer = ['tow', 'mg', 'igla', 'drone', 'rockets', 'splash', 'chain'].includes(info.source);
    let pts = (e.def.reward || 50) * (fromPlayer ? 1 : 0.3);
    const tags = [];
    if (info.distance > 2000) { pts *= 1.5; tags.push('رمية بعيدة +50%'); }
    if (info.turretToss) { pts += 100; tags.push('طار البرج!'); this.turretTosses++; }
    if (info.moving && info.source === 'tow') { pts *= 1.2; tags.push('هدف متحرك'); }
    if (info.side === 'rear') { pts *= 1.15; tags.push('إصابة خلفية'); }
    if ((e.cls === 'heli' || e.cls === 'jet') && info.source === 'tow') { pts *= 2; tags.push('إسقاط بالتاو!'); }
    if (e.tag === 'hvt') { pts += 400; tags.push('الهدف الثمين'); }
    pts = Math.round(pts * this.diff.reward);
    this.score += pts;
    if (info.distance) this.longest = Math.max(this.longest, info.distance);
    this.world.events.emit('kill', { entity: e, info, pts, tags });
    if (info.turretToss) this.radio('turret');
    else if (e.cls === 'heli') this.radio('heli');
    else if (e.cls === 'jet') this.radio('jet');
    else if (chance(0.45)) this.radio('kill');
  }

  onEscape(e, silent) {
    if (e.team === 'friend') {
      this.friendArrived++;
      this.radio('friendArrive');
      return;
    }
    // مروحية مطلوب إسقاطها انسحبت: تعود أخرى بعد قليل
    if (e.tag === 'air' && this.state === 'running') {
      this.world.after(12, () => { if (this.state === 'running') { this.world.spawn(e.type, { tag: 'air' }); this.radio('heliIn'); } });
      return;
    }
    if (silent) return;
    if (e.cls === 'infantry') return;
    this.escapes++;
    if (e.tag === 'hvt' && this.hvtEscapeFails) { this.fail('hvt'); return; }
    this.radio('escape');
  }

  fail(reason) {
    if (this.state !== 'running') return;
    this.state = 'failed';
    this.failReason = reason;
    this.world.ended = true;
    this.world.events.emit('end', { success: false, reason });
  }

  succeed() {
    if (this.state !== 'running') return;
    this.state = 'success';
    this.world.ended = true;
    this.world.events.emit('end', { success: true });
  }

  objectiveStatus() {
    return this.objectives.map((o) => {
      let done = false, txt = o.text, val = o.progress ? o.progress() : 0;
      if (o.type === 'kill') { done = val >= o.count; txt = `${o.text} (${Math.min(val, o.count)}/${o.count})`; }
      else if (o.type === 'tag' || o.type === 'tagAir' || o.type === 'hvt' || o.type === 'escort') { done = val >= o.count; txt = `${o.text} (${Math.min(val, o.count)}/${o.count})`; }
      else if (o.type === 'noescape') { done = true; txt = `${o.text} (${val}/${this.maxEscapes})`; }
      else if (o.type === 'killAll') { done = this._allWavesDone() && this._enemiesAlive() === 0; txt = `${o.text} (${this.waves.filter((w) => w.spawned).length}/${this.waves.length})`; }
      return { text: txt, done, fail: o.fail };
    });
  }

  _allWavesDone() { return this.waves.every((w) => w.spawned); }
  _enemiesAlive() { return this.world.entities.filter((e) => e.alive && e.team === 'enemy' && e.cls !== 'jet').length; }

  // تدخل الطيران الروسي والميليشيات حسب الصعوبة
  _difficultyEvents(dt) {
    const w = this.world, d = this.diff;
    if (d.jets) {
      this.airT -= dt;
      if (this.airT <= 0) {
        this.airT = rand(48, 75) / (d.id === 'legend' ? 1.5 : 1);
        const n = d.id === 'legend' && chance(0.5) ? 2 : 1;
        for (let i = 0; i < n; i++) w.after(i * 3, () => { if (!w.ended) w.spawn(chance(0.5) ? 'su24' : 'su34', { angle: rand(-1.2, 1.2) }); });
        this.radio('air');
        w.audio.siren(true);
        w.after(9, () => w.audio.siren(false));
      }
    }
    if (d.helis && (this.forceHelis || chance(0.0))) { /* المروحيات في القوالب */ }
    if (d.helis && !this.forceHelis) {
      this.heliT -= dt;
      if (this.heliT <= 0) {
        this.heliT = rand(80, 120) / (d.id === 'legend' ? 1.4 : 1);
        w.spawn(d.jets ? 'mi24' : 'mi8', {});
        this.radio('heliIn');
      }
    }
    if (d.militia >= 1) {
      this.militiaT -= dt;
      if (this.militiaT <= 0) {
        this.militiaT = rand(55, 80) / d.militia;
        const lanes = Object.keys(w.lanes);
        if (lanes.length) {
          const L = w.lanes[lanes[Math.floor(this.rnd() * lanes.length)]];
          const n = 1 + Math.floor(d.militia / 2);
          for (let i = 0; i < n; i++) w.spawn('technical', { lane: L, startD: 40 - i * 24, behavior: 'advance', stopAt: L.total * 0.7 - i * 24 });
        }
      }
    }
    if (d.id === 'legend' || (d.id === 'hard' && this.def.template === 'militia') || this.def.template === 'militia') {
      this.droneT -= dt;
      if (this.droneT <= 0) {
        this.droneT = rand(35, 60);
        if (this.diff.id !== 'easy') { w.spawn('kamikaze', {}); this.radio('drone'); }
      }
    }
    if (d.id !== 'easy' && !this.recon && this.t > 30 && chance(dt * 0.01)) {
      this.recon = w.spawn('recon', {});
      this.radio('recon');
    }
  }

  update(dt) {
    if (this.state !== 'running') return;
    this.t += dt;
    const w = this.world;
    // تشغيل الموجات
    for (let i = 0; i < this.waves.length; i++) {
      const wv = this.waves[i];
      if (wv.spawned) continue;
      if (wv.at != null) {
        if (this.t >= wv.at) this._spawnWave(wv);
      } else {
        const prev = this.waves.slice(0, i).filter((x) => x.kind === wv.kind || x.kind === 'convoy').pop();
        if (!prev || !prev.spawned) continue;
        const prevDone = prev.ents.every((e) => !e.alive);
        if (prevDone || this.t - prev.spawnT > (wv.after || 20) + 25) {
          wv._wait = (wv._wait || 0) + dt;
          if (wv._wait > (prevDone ? 4 : 0)) this._spawnWave(wv);
        }
      }
    }
    this.waveIdx = this.waves.filter((x) => x.spawned).length;
    if (this.t > 2 && !this._started) { this._started = true; this.radio('start'); }
    this._difficultyEvents(dt);
    // الكشف التلقائي للأهداف الظاهرة
    if (this.diff.markers) {
      for (const e of w.entities) {
        if (e.team !== 'enemy' || e.spotted || !e.alive) continue;
        if (e.pos.distanceTo(w.player.pos) < 3200) e.spotted = true;
      }
    }
    // شروط الفشل
    if (this.maxEscapes != null && this.escapes > this.maxEscapes) return this.fail('escape');
    if (this.def.template === 'escort') {
      const remaining = this.friends.filter((e) => e.alive).length;
      if (this.friends.length && this.friendArrived + remaining < this.need) return this.fail('escort');
    }
    if (this.timeLimit && this.t > this.timeLimit) return this.fail('time');
    // شروط النجاح
    const st = this.objectiveStatus();
    if (this.t > 5 && st.length && st.every((s) => s.done)) {
      // في القوالب التي فيها أرتال، انتظر حتى تنتهي الموجات
      if (this.def.template === 'column' && !this._allWavesDone()) return;
      return this.succeed();
    }
  }

  results() {
    const pl = this.world.player;
    const acc = pl.stats.towShots ? pl.stats.towHits / pl.stats.towShots : 1;
    const hpK = pl.hp / pl.maxHp;
    let stars = this.state === 'success' ? 1 : 0;
    if (stars && hpK > 0.5) stars++;
    if (stars && acc >= 0.7) stars++;
    const gold = Math.round(this.score * 0.6 + (this.state === 'success' ? 250 * this.diff.reward : 0) + stars * 100);
    return { stars, acc, hpK, gold, score: this.score, kills: this.kills, time: this.t, longest: this.longest, escapes: this.escapes, turretTosses: this.turretTosses };
  }
}
