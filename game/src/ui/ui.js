// الشاشات والقوائم: الخريطة، الإيجاز، النتيجة، المتجر، الباقة الهدية، الإعدادات
import { REGIONS, findMission, nextMission } from '../data/regions.js';
import { DIFFICULTIES, WEAPONS, WEAPON_ORDER, UPGRADES, SKINS, PREMIUM, UNITS } from '../data/defs.js';
import { Save } from '../core/save.js';
import { Shop } from '../core/shop.js';
import { CONFIG } from '../config.js';
import { fmtInt, fmtTime } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TEMPLATE_LABEL = { column: 'كمين رتل', assault: 'اقتحام', depot: 'تدمير مستودع', escort: 'حماية رتل', airdef: 'دفاع جوي', hvt: 'هدف ثمين', militia: 'صدّ هجوم معاكس', final: 'المعركة الأخيرة' };
const TEMPLATE_OBJ = {
  column: ['دمّر معظم آليات الأرتال العابرة', 'لا تسمح بفرار عدد كبير منها'],
  assault: ['دمّر كل الأهداف المحددة', 'صدّ التعزيزات القادمة'],
  depot: ['دمّر مستودع الذخيرة', 'الحراسة تشمل مدرعات ورشاشات مضادة'],
  escort: ['احمِ رتل الثوار حتى يصل', 'دمّر الكمائن على الطريق'],
  airdef: ['دمّر منظومات الدفاع الجوي', 'أسقط المروحيات المهاجمة'],
  hvt: ['دمّر دبابة القائد قبل فرارها', 'انتبه لتشويش شتورا — اضرب من الجانب'],
  militia: ['اصمد أمام موجات الميليشيات', 'أسقط المسيّرات الانتحارية بالرشاش'],
  final: ['دمّر آخر حصون النظام', 'كل أنواع التهديد في معركة واحدة'],
};
const TIME_LABEL = { dawn: 'فجر', morning: 'صباح', noon: 'ظهيرة', afternoon: 'عصر', golden: 'قبيل الغروب', dusk: 'غسق', night: 'ليل' };
const WEATHER_LABEL = { clear: 'صحو', haze: 'ضباب خفيف', dust: 'عاصفة غبار', rain: 'مطر' };
const TIPS = [
  'التاو موجّه سلكياً: أبقِ الشعيرات على الهدف حتى لحظة الانفجار.',
  'الإصابة من الخلف أو الجانب تضاعف فرصة طيران برج الدبابة.',
  'كل صاروخ يكشف موقعك. احتمِ حين يرتفع مؤشر الانكشاف.',
  'عند تحذير «صاروخ موجّه قادم» اضغط احتماء فوراً — الساتر يحميك.',
  'المنظار الحراري يكشف الأهداف ليلاً وخلف الدخان والغبار.',
  'رشاش 14.5 مثالي ضد سيارات الدوشكا والمسيّرات الانتحارية.',
  'في المستوى الصعب يتدخل الطيران الروسي: سوخوي تقصف موقعك، احتمِ أو أسقطها بالإيغلا.',
  'مسيّرة شاهين تضرب الدبابات من الأعلى حيث الدرع أضعف.',
  'بعد كل إصابة قاتلة يمكنك مشاهدة إعادة اللقطة ومشاركتها على واتساب.',
];

// إحداثيات تخطيطية للعقد على الخريطة
const NODE_POS = {
  regiment46: [140, 78], saraqib: [168, 168], aleppo: [262, 74], khanshaykhun: [150, 258], hama: [182, 336],
  rastan: [168, 402], talbiseh: [196, 446], termaala: [158, 490], homs: [190, 538], damascus: [118, 652],
};

export class UI {
  constructor(app) {
    this.app = app;
    this.current = 'boot';
    this.sel = { region: 0, mission: null, diff: Save.data.settings.difficulty || 'normal' };
    this.storeTab = 'weapons';
    this._bindStatic();
  }

  show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === `scr-${name}`));
    this.current = name;
    this.app.audio.click?.();
  }

  hideAll() { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('show')); this.current = null; }

  toast(text, t = 2400) {
    const el = $('ui-toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => el.classList.remove('show'), t);
  }

  modal(html, bind) {
    $('modal-card').innerHTML = html;
    $('modal').hidden = false;
    const close = () => { $('modal').hidden = true; };
    $('modal').onclick = (e) => { if (e.target.id === 'modal') close(); };
    bind && bind($('modal-card'), close);
    return close;
  }

  _bindStatic() {
    const a = this.app;
    $('btn-play').onclick = () => { a.audio.init(); this.openMap(); };
    $('btn-store').onclick = () => this.openStore('weapons');
    $('btn-gift').onclick = () => this.openGift();
    $('btn-settings').onclick = () => this.openSettings('menu');
    $('btn-about').onclick = () => { $('about-ver').textContent = `الإصدار ${CONFIG.version} · المعرّف ${Save.uuid}`; this.show('about'); };
    document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => { if (b.dataset.back === 'menu') this.openMenu(); else if (b.dataset.back === 'map') this.openMap(); }; });
    $('settings-back').onclick = () => { if (this._settingsFrom === 'pause') { this.show('pause'); } else this.openMenu(); };
    document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => this.openStore(t.dataset.tab); });
    $('p-resume').onclick = () => a.resume();
    $('p-restart').onclick = () => a.restartMission();
    $('p-quit').onclick = () => a.quitToMap();
    $('p-settings').onclick = () => this.openSettings('pause');
    $('p-replay').onclick = () => a.playClip(a.world && (a.world.lastClip || a.world.bestClip));
    $('rotate-ok').onclick = () => document.getElementById('app').classList.add('rotate-ok');
  }

  // ===== القائمة الرئيسية =====
  openMenu() {
    const d = Save.data;
    $('m-gold').textContent = fmtInt(d.gold);
    $('m-stars').textContent = `${Save.totalStars()}/90`;
    $('m-kills').textContent = fmtInt(d.stats.kills);
    $('m-long').textContent = `${fmtInt(d.stats.longest)} م`;
    const g = Shop.giftState();
    $('gift-dot').hidden = !(g.welcome || g.ready);
    this.show('menu');
    this.app.onMenu?.();
  }

  // ===== الخريطة =====
  openMap() {
    $('map-gold').textContent = fmtInt(Save.data.gold);
    let last = 0;
    REGIONS.forEach((r, i) => { if (Save.regionUnlocked(i)) last = i; });
    if (!Save.regionUnlocked(this.sel.region)) this.sel.region = last;
    this._drawMap();
    this._panel();
    this.show('map');
  }

  _drawMap() {
    const svg = $('route-map');
    const parts = [];
    // خطوط كنتورية زخرفية
    for (let k = 0; k < 14; k++) {
      const y0 = 30 + k * 48;
      let d = `M -10 ${y0}`;
      for (let x = 0; x <= 420; x += 30) d += ` Q ${x + 15} ${y0 + Math.sin((x + k * 37) * 0.03) * 14} ${x + 30} ${y0 + Math.sin((x + 30 + k * 37) * 0.025) * 10}`;
      parts.push(`<path d="${d}" fill="none" stroke="rgba(232,222,195,0.05)" stroke-width="1"/>`);
    }
    // البحر والحدود والنهر
    parts.push('<path d="M0 0 L58 0 L62 60 L48 130 L58 210 L44 300 L60 380 L40 470 L0 470 Z" fill="rgba(70,110,130,0.22)"/>');
    parts.push('<text x="22" y="300" transform="rotate(-90 22 300)" fill="rgba(170,200,215,0.55)" font-size="13" font-family="Changa">البحر المتوسط</text>');
    parts.push('<path d="M58 22 L400 30" stroke="rgba(232,222,195,0.3)" stroke-dasharray="5 6" fill="none"/><text x="300" y="18" fill="rgba(232,222,195,0.45)" font-size="12" font-family="Changa">تركيا</text>');
    parts.push('<path d="M40 470 L95 505 L72 600 L130 700" stroke="rgba(232,222,195,0.3)" stroke-dasharray="5 6" fill="none"/><text x="40" y="560" fill="rgba(232,222,195,0.45)" font-size="12" font-family="Changa">لبنان</text>');
    parts.push('<path d="M128 585 C150 545 172 470 170 410 C168 370 185 345 172 300 C150 240 120 190 95 140 C80 110 70 80 62 60" stroke="rgba(110,170,200,0.55)" stroke-width="2.4" fill="none"/><text x="96" y="210" fill="rgba(140,190,215,0.6)" font-size="11" font-family="Changa">العاصي</text>');
    // مسار المعركة
    const pts = REGIONS.map((r) => NODE_POS[r.id]);
    const unlockedN = REGIONS.filter((r, i) => Save.regionUnlocked(i)).length;
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    parts.push(`<path d="${path}" stroke="rgba(232,222,195,0.25)" stroke-width="3" fill="none" stroke-dasharray="2 7" stroke-linecap="round"/>`);
    const donePath = pts.slice(0, unlockedN).map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    parts.push(`<path d="${donePath}" stroke="#49b46a" stroke-width="3.5" fill="none" stroke-linecap="round"/>`);
    REGIONS.forEach((r, i) => {
      const [x, y] = NODE_POS[r.id];
      const un = Save.regionUnlocked(i);
      const stars = r.missions.reduce((s, m) => s + Math.max(0, ...DIFFICULTIES.map((d) => Save.starsFor(m.id, d.id))), 0);
      const done = r.missions.every((m) => Math.max(0, ...DIFFICULTIES.map((d) => Save.starsFor(m.id, d.id))) > 0);
      const left = x > 200;
      parts.push(`<g class="node ${un ? '' : 'locked'} ${i === this.sel.region ? 'sel' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(r.name)}">
        <circle cx="${x}" cy="${y}" r="20" fill="transparent"/>
        <circle class="ring" cx="${x}" cy="${y}" r="11" fill="${done ? '#2f8a4c' : un ? '#1c221d' : '#111'}" stroke="${un ? '#e8dec3' : '#555'}" stroke-width="2"/>
        <text x="${left ? x - 18 : x + 18}" y="${y + 4}" text-anchor="${left ? 'end' : 'start'}">${esc(r.name)}</text>
        ${un ? `<text x="${left ? x - 18 : x + 18}" y="${y + 19}" text-anchor="${left ? 'end' : 'start'}" style="font-size:10px;fill:#e0a43a;font-family:'Share Tech Mono'">${'★'.repeat(Math.min(stars, 9))}</text>` : ''}
      </g>`);
    });
    svg.innerHTML = parts.join('');
    svg.querySelectorAll('.node').forEach((n) => {
      const pick = () => {
        const i = +n.dataset.i;
        if (!Save.regionUnlocked(i)) { this.toast('أكمل المحور السابق لفتح هذه المنطقة'); return; }
        this.sel.region = i; this.sel.mission = null;
        this._drawMap(); this._panel();
      };
      n.onclick = pick;
      n.onkeydown = (e) => { if (e.key === 'Enter') pick(); };
    });
  }

  _panel() {
    const ri = this.sel.region;
    const r = REGIONS[ri];
    const diff = this.sel.diff;
    if (!this.sel.mission) {
      const firstOpen = r.missions.findIndex((m, mi) => Save.missionUnlocked(ri, mi) && !Save.starsFor(m.id, diff));
      this.sel.mission = r.missions[Math.max(0, firstOpen)].id;
      if (!Save.missionUnlocked(ri, Math.max(0, firstOpen))) this.sel.mission = r.missions[0].id;
    }
    const ms = r.missions.map((m, mi) => {
      const un = Save.missionUnlocked(ri, mi);
      const st = Save.starsFor(m.id, diff);
      return `<button class="mission ${un ? '' : 'locked'} ${m.id === this.sel.mission ? 'sel' : ''}" data-m="${m.id}" ${un ? '' : 'aria-disabled="true"'}>
        <span class="num">${ri + 1}.${mi + 1}</span>
        <span><span class="mname">${esc(m.name)}</span><br><span class="mtype">${TEMPLATE_LABEL[m.template]} · ${TIME_LABEL[(m.env && m.env.time) || r.env.time]}</span></span>
        <span class="stars">${[0, 1, 2].map((k) => `<span class="${k < st ? '' : 'off'}">★</span>`).join('')}</span>
      </button>`;
    }).join('');
    const D = DIFFICULTIES.find((d) => d.id === diff);
    $('map-panel').innerHTML = `
      <div class="meta">${esc(r.area)} · ${esc(r.date)}</div>
      <h3>${esc(r.name)}</h3>
      <p>${esc(r.intro)}</p>
      <div style="display:flex;flex-direction:column;gap:6px">${ms}</div>
      <div>
        <div class="diff-row">${DIFFICULTIES.map((d) => `<button class="diff ${d.id === diff ? 'sel' : ''}" data-d="${d.id}">${d.name}</button>`).join('')}</div>
        <p class="diff-desc">${esc(D.desc)}</p>
      </div>
      <button class="btn primary big" id="map-go"><span>إيجاز المهمة</span></button>`;
    $('map-panel').querySelectorAll('.mission').forEach((b) => {
      b.onclick = () => {
        const f = findMission(b.dataset.m);
        if (!Save.missionUnlocked(f.ri, f.mi)) { this.toast('أنجز المهمة السابقة أولاً'); return; }
        this.sel.mission = b.dataset.m;
        this._panel();
      };
    });
    $('map-panel').querySelectorAll('.diff').forEach((b) => {
      b.onclick = () => { this.sel.diff = b.dataset.d; Save.data.settings.difficulty = b.dataset.d; Save.save(); this._panel(); };
    });
    $('map-go').onclick = () => this.openBrief(this.sel.mission);
  }

  // ===== الإيجاز =====
  openBrief(mid) {
    const f = findMission(mid);
    const { region: r, mission: m } = f;
    const D = DIFFICULTIES.find((d) => d.id === this.sel.diff);
    const env = { ...r.env, ...(m.env || {}) };
    const threats = new Set();
    const p = m.params || {};
    const add = (u) => { if (UNITS[u]) threats.add(u); };
    (p.mix || []).forEach(add); (p.kinds || []).forEach(add); (p.guardKinds || []).forEach(add); (p.escorts || []).forEach(add);
    if (p.boss) add(p.boss);
    (p.ambush || []).forEach(([, u]) => add(u)); (p.statics || []).forEach(([, u]) => add(u));
    if (m.template === 'airdef' || m.template === 'final') { add('mi24'); add('mi8'); }
    if (m.template === 'militia') { add('technical'); add('kamikaze'); }
    add('infantry');
    if (D.helis) add('mi24');
    if (D.jets) { add('su24'); add('su34'); }
    if (D.id === 'legend') add('kamikaze');
    const chips = [...threats].map((u) => {
      const fac = UNITS[u].faction;
      return `<span class="chip ${fac === 'russia' ? 'blue' : fac === 'iran' ? 'amber' : 'red'}">${esc(UNITS[u].name)}</span>`;
    }).join('');
    const weapons = WEAPON_ORDER.map((w) => `<span class="chip ${Save.data.weapons.includes(w) ? '' : 'muted'}">${Save.data.weapons.includes(w) ? '' : '🔒 '}${esc(WEAPONS[w].name)}</span>`).join('');
    $('brief-title').textContent = m.name;
    $('brief-body').innerHTML = `
      <div class="card">
        <div class="eyebrow">${esc(r.name)} · ${esc(r.area)} · ${esc(r.date)}</div>
        <p class="lead">${esc(m.brief)}</p>
        <h4>الأهداف</h4>
        <ul>${TEMPLATE_OBJ[m.template].map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
        <h4>الظروف</h4>
        <div class="threats"><span class="chip">${TIME_LABEL[env.time]}</span><span class="chip">${WEATHER_LABEL[env.weather] || 'صحو'}</span>${env.time === 'night' ? '<span class="chip amber">استخدم المنظار الحراري</span>' : ''}</div>
        <h4>التهديدات المتوقعة</h4>
        <div class="threats">${chips}</div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <h4 style="margin:0">العتاد</h4>
        <div class="threats">${weapons}</div>
        ${Save.data.premium.tow2b ? '<span class="chip amber">تاو 2B متاح — زر 2B أو مفتاح B</span>' : ''}
        <h4 style="margin:0">الصعوبة</h4>
        <div class="diff-row">${DIFFICULTIES.map((d) => `<button class="diff ${d.id === this.sel.diff ? 'sel' : ''}" data-d="${d.id}">${d.name}</button>`).join('')}</div>
        <p class="diff-desc">${esc(D.desc)}</p>
        <button class="btn primary big" id="brief-go"><span>انطلق</span><small>مكافأة الصعوبة ×${D.reward}</small></button>
        <button class="btn ghost" id="brief-store">تجهيز من المتجر</button>
      </div>`;
    $('brief-body').querySelectorAll('.diff').forEach((b) => { b.onclick = () => { this.sel.diff = b.dataset.d; Save.data.settings.difficulty = b.dataset.d; Save.save(); this.openBrief(mid); }; });
    $('brief-go').onclick = () => this.app.startMission(mid, this.sel.diff);
    $('brief-store').onclick = () => { this._storeReturn = mid; this.openStore('weapons'); };
    this.show('brief');
  }

  // ===== التحميل =====
  showLoading(mid) {
    const f = findMission(mid);
    $('load-region').textContent = `${f.region.name} · ${f.region.date}`;
    $('load-title').textContent = f.mission.name;
    $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    $('load-fill').style.width = '0%';
    this.show('loading');
  }

  setLoading(p, text) {
    $('load-fill').style.width = `${Math.round(p * 100)}%`;
    $('load-step').textContent = text;
  }

  // ===== النتيجة =====
  showEnd(info) {
    const { success, res, reason, gained, mid, diff, hasClip, hasBest } = info;
    const f = findMission(mid);
    const reasons = { dead: 'سقط موقع الرماية', escape: 'فرّ عدد كبير من الآليات', escort: 'خسرنا الرتل', time: 'انتهى الوقت', hvt: 'فرّ الهدف الثمين' };
    const nxt = nextMission(mid);
    const nf = nxt && findMission(nxt);
    const canNext = success && nf && Save.missionUnlocked(nf.ri, nf.mi);
    $('end-card').innerHTML = `
      <div class="end-head">
        <div class="eyebrow">${esc(f.region.name)} · ${esc(f.mission.name)}</div>
        <h2 class="${success ? 'win' : 'lose'}">${success ? 'تمّت المهمة' : 'فشلت المهمة'}</h2>
        ${success ? `<div class="end-stars">${[0, 1, 2].map((k) => `<span class="${k < res.stars ? '' : 'off'}">★</span>`).join('')}</div>` : `<p>${esc(reasons[reason] || '')}</p>`}
      </div>
      <div class="end-grid">
        <div><span class="k">الإصابات</span><span class="v">${res.kills}</span></div>
        <div><span class="k">النقاط</span><span class="v">${fmtInt(res.score)}</span></div>
        <div><span class="k">دقة التاو</span><span class="v">${Math.round(res.acc * 100)}%</span></div>
        <div><span class="k">أبعد إصابة</span><span class="v">${fmtInt(res.longest)} م</span></div>
        <div><span class="k">الزمن</span><span class="v">${fmtTime(res.time)}</span></div>
        <div><span class="k">الذهب</span><span class="v" style="color:var(--brass)">+${fmtInt(gained)}</span></div>
      </div>
      <div class="end-actions">
        ${hasClip ? '<button class="btn" id="e-replay">إعادة آخر لقطة</button>' : ''}
        ${hasBest ? '<button class="btn" id="e-best">أفضل لقطة</button>' : ''}
        <a class="btn wa ${hasClip || hasBest ? '' : 'wide'}" id="e-share" target="_blank" rel="noopener">مشاركة النتيجة على واتساب</a>
        ${hasClip ? '<button class="btn" id="e-video">فيديو اللقطة للمشاركة</button>' : ''}
        ${canNext ? '<button class="btn primary wide" id="e-next">المهمة التالية</button>' : `<button class="btn primary wide" id="e-retry">${success ? 'إعادة المهمة' : 'حاول مجدداً'}</button>`}
        <button class="btn ghost wide" id="e-map">العودة للخريطة</button>
      </div>`;
    const a = this.app;
    const share = $('e-share');
    share.href = a.shareResultLink(info);
    share.onclick = () => a.audio.click();
    if ($('e-replay')) $('e-replay').onclick = () => a.playClip(a.world.lastClip);
    if ($('e-best')) $('e-best').onclick = () => a.playClip(a.world.bestClip);
    if ($('e-video')) $('e-video').onclick = () => a.playClip(a.world.bestClip || a.world.lastClip, true);
    if ($('e-next')) $('e-next').onclick = () => { this.sel.mission = nxt; this.sel.region = nf.ri; a.startMission(nxt, diff); };
    if ($('e-retry')) $('e-retry').onclick = () => a.startMission(mid, diff);
    $('e-map').onclick = () => a.quitToMap();
    this.show('end');
  }

  // ===== المتجر =====
  openStore(tab) {
    this.storeTab = tab || this.storeTab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === this.storeTab));
    $('store-gold').textContent = fmtInt(Save.data.gold);
    const body = $('store-body');
    const d = Save.data;
    let html = '';
    if (this.storeTab === 'weapons') {
      for (const id of WEAPON_ORDER) {
        const w = WEAPONS[id];
        const own = d.weapons.includes(id);
        html += `<div class="item ${own ? 'owned' : ''}"><h4>${esc(w.name)}</h4><p>${esc(w.desc)}</p>
          ${own ? '<span class="price">في الترسانة</span>' : `<button class="btn small" data-buyw="${id}">شراء · <span class="price">${fmtInt(w.price)}</span></button>`}</div>`;
      }
      const top = d.premium.tow2b;
      html += `<div class="item ${top ? 'owned' : ''}"><h4>تاو 2B — هجوم علوي</h4><p>ينفجر فوق الدبابة ويخترق سقفها. متاح في تبويب «مميز».</p><span class="price">${top ? 'مفعّل' : 'مميز'}</span></div>`;
    } else if (this.storeTab === 'upgrades') {
      for (const u of UPGRADES) {
        const lv = d.upgrades[u.id] || 0;
        const max = lv >= u.costs.length;
        html += `<div class="item"><h4>${esc(u.name)}</h4><p>${esc(u.desc)}</p>
          <div class="lv">${u.costs.map((c, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</div>
          ${max ? '<span class="price">المستوى الأقصى</span>' : `<button class="btn small" data-upg="${u.id}">ترقية · <span class="price">${fmtInt(u.costs[lv])}</span></button>`}</div>`;
      }
    } else if (this.storeTab === 'skins') {
      for (const s of SKINS) {
        const own = d.skins.includes(s.id);
        const eq = d.skin === s.id;
        html += `<div class="item ${eq ? 'owned' : ''}"><h4>${esc(s.name)}</h4><div class="swatch" style="background:${s.color}"></div>
          ${eq ? '<span class="price">مُجهّز</span>' : own ? `<button class="btn small" data-skin="${s.id}">تجهيز</button>` : s.premium ? '<span class="price">مميز (واتساب)</span>' : `<button class="btn small" data-skin="${s.id}">شراء · <span class="price">${fmtInt(s.price)}</span></button>`}</div>`;
      }
    } else {
      const num = CONFIG.whatsappNumber;
      html += `<div class="premium-head">
        <div><h4 style="margin:0 0 4px;font-family:var(--f-ui);color:var(--white)">الشراء عبر المعرّف (UUID)</h4>
        <p>1) اختر المنتج واضغط «اطلب عبر واتساب» — تُرسل رسالة فيها معرّف جهازك ورقم الطلب.<br>2) بعد الدفع يصلك كود تفعيل خاص بجهازك.<br>3) أدخل الكود هنا. ${num ? '' : '<br><b style="color:#f3c97d">ملاحظة: لم يُضبط رقم البائع بعد — ستختار جهة الاتصال يدوياً في واتساب.</b>'}</p></div>
        <button class="btn small" id="copy-uuid">نسخ المعرّف</button>
        <div class="uuid-box" id="uuid-box" style="grid-column:1/-1">${esc(Save.uuid)}</div>
        <div class="redeem"><input id="code-in" placeholder="XXXXX-XXXXX" maxlength="11" autocomplete="off" aria-label="كود التفعيل"><button class="btn primary small" id="code-go">تفعيل الكود</button></div>
      </div>`;
      for (const it of PREMIUM) {
        const own = !it.consumable && d.premium[it.id];
        const link = Shop.orderLink(it.id);
        html += `<div class="item ${own ? 'owned' : ''}"><h4>${esc(it.name)}</h4><p>${esc(it.desc)}</p><span class="price">${esc(it.price)}${it.consumable ? ` · طلب رقم ${Shop.orderNo(it.id)}` : ''}</span>
          ${own ? '<span class="price">مملوك</span>' : `<a class="btn small wa" href="${link.url}" target="_blank" rel="noopener">اطلب عبر واتساب</a>`}
          <button class="btn small ghost" data-gift="${it.id}">إهداء لصديق</button></div>`;
      }
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-buyw]').forEach((b) => { b.onclick = () => this._result(Shop.buyWeapon(b.dataset.buyw)); });
    body.querySelectorAll('[data-upg]').forEach((b) => { b.onclick = () => this._result(Shop.buyUpgrade(b.dataset.upg)); });
    body.querySelectorAll('[data-skin]').forEach((b) => { b.onclick = () => this._result(Shop.buySkin(b.dataset.skin)); });
    body.querySelectorAll('[data-gift]').forEach((b) => { b.onclick = () => this._giftFriend(b.dataset.gift); });
    if ($('copy-uuid')) {
      $('copy-uuid').onclick = () => this._copy(Save.uuid, $('uuid-box'));
      $('code-go').onclick = () => { this._result(Shop.redeem($('code-in').value)); };
      $('code-in').onkeydown = (e) => { if (e.key === 'Enter') $('code-go').click(); };
    }
    if (this.current !== 'store') this.show('store');
    const back = document.querySelector('#scr-store [data-back]');
    back.onclick = () => { if (this._storeReturn) { const m = this._storeReturn; this._storeReturn = null; this.openBrief(m); } else this.openMenu(); };
  }

  _copy(text, el) {
    const done = () => this.toast('تم النسخ');
    try {
      navigator.clipboard.writeText(text).then(done).catch(() => this._selectText(el));
    } catch (e) { this._selectText(el); }
  }

  _selectText(el) {
    if (!el) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s.removeAllRanges(); s.addRange(r);
    this.toast('حدّد النص وانسخه يدوياً');
  }

  _result(r) {
    if (!r) return;
    this.toast(r.msg || (r.ok ? 'تم' : 'تعذّر'));
    if (r.ok) this.app.audio.coin();
    if (this.current === 'store') this.openStore();
    if (this.current === 'gift') this.openGift();
  }

  _giftFriend(itemId) {
    const it = PREMIUM.find((x) => x.id === itemId);
    this.modal(`<h3>إهداء «${esc(it.name)}»</h3>
      <p class="muted">اطلب من صديقك نسخ معرّفه من: المتجر ← مميز ← نسخ المعرّف، ثم الصقه هنا. سيصله كود تفعيل يعمل على جهازه فقط.</p>
      <input class="input" id="friend-uuid" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" aria-label="معرّف الصديق">
      <div class="row"><a class="btn wa" id="gift-send" target="_blank" rel="noopener">أرسل طلب الإهداء</a><button class="btn ghost" id="gift-cancel">إلغاء</button></div>`, (card, close) => {
      const send = card.querySelector('#gift-send');
      const inp = card.querySelector('#friend-uuid');
      const upd = () => {
        const v = inp.value.trim();
        const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        send.classList.toggle('disabled', !ok);
        send.href = ok ? Shop.orderLink(itemId, v).url : '#';
      };
      inp.oninput = upd; upd();
      send.onclick = (e) => { if (send.getAttribute('href') === '#') { e.preventDefault(); this.toast('أدخل معرّفاً صحيحاً'); } else close(); };
      card.querySelector('#gift-cancel').onclick = close;
    });
  }

  // ===== الباقة الهدية =====
  openGift() {
    $('gift-gold').textContent = fmtInt(Save.data.gold);
    const st = Shop.giftState();
    const days = [1, 2, 3, 4, 5, 6, 7].map((k) => `<div class="${k <= (st.ready ? st.streak - 1 : st.streak) ? 'on' : ''}">يوم ${k}<b>${250 + k * 50}</b></div>`).join('');
    const nextIn = Math.max(0, st.next - Date.now());
    const hrs = Math.floor(nextIn / 3600000), mins = Math.floor((nextIn % 3600000) / 60000);
    const link = `https://wa.me/?text=${encodeURIComponent(`🎯 انضم لمعركة «ردع العدوان» — لعبة صواريخ التاو من حلب إلى دمشق!\n${Shop.shareUrl()}`)}`;
    $('gift-body').innerHTML = `
      <div class="gift-hero">
        <div class="eyebrow">الباقة الهدية</div>
        <h3>${st.welcome ? 'هدية الترحيب بانتظارك' : 'هديتك اليومية'}</h3>
        <p>${st.welcome ? '1,500 ذهب + صاروخ إيغلا المضاد للطيران مجاناً' : 'ادخل كل يوم لترتفع قيمة الهدية حتى اليوم السابع.'}</p>
        ${st.welcome ? '<button class="btn primary big" id="g-welcome">استلم هدية الترحيب</button>' : ''}
      </div>
      <div class="item">
        <h4>الهدية اليومية</h4>
        <div class="streak">${days}</div>
        <p>${st.ready ? `جاهزة الآن: ${fmtInt(st.amount)} ذهب` : `الهدية التالية بعد ${hrs} س ${mins} د`}</p>
        <button class="btn ${st.ready ? 'primary' : ''} small" id="g-daily" ${st.ready ? '' : 'disabled'}>استلم الهدية اليومية</button>
      </div>
      <div class="item">
        <h4>أهدِ صديقاً</h4>
        <p>اشترِ أي منتج مميز باسم صديقك عبر معرّفه، ويصله كود تفعيل خاص بجهازه.</p>
        <button class="btn small" id="g-friend">اختيار هدية</button>
      </div>
      <div class="item">
        <h4>ادعُ رفاقك</h4>
        <p>شارك رابط اللعبة على واتساب وابدأوا المعركة معاً.</p>
        <a class="btn small wa" href="${link}" target="_blank" rel="noopener">مشاركة على واتساب</a>
      </div>`;
    if ($('g-welcome')) $('g-welcome').onclick = () => this._result(Shop.claimWelcome());
    $('g-daily').onclick = () => this._result(Shop.claimDaily());
    $('g-friend').onclick = () => this.openStore('premium');
    this.show('gift');
  }

  // ===== الإعدادات =====
  openSettings(from) {
    this._settingsFrom = from;
    const s = Save.data.settings;
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'sel' : ''}">${l}</button>`).join('')}</div>`;
    const rng = (key, min, max, step) => `<input type="range" id="set-${key}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}">`;
    $('settings-body').innerHTML = `
      <div class="setting"><label>طريقة التحكم</label>${seg('control', [['drag', 'سحب بالإصبع'], ['buttons', 'عصا توجيه'], ['dpad', 'أزرار أسهم'], ['gyro', 'دوران الجهاز'], ['mouse', 'فأرة']])}
        <small>«دوران الجهاز» يستخدم الجيروسكوب: حرّك الهاتف لتصوّب، ويمكن الجمع مع السحب.</small></div>
      <div class="setting"><label>حساسية التصويب</label>${rng('sens', 0.3, 2.5, 0.05)}<label>حساسية العصا والأسهم</label>${rng('stickSens', 0.3, 2.5, 0.05)}<label>حساسية الدوران</label>${rng('gyroSens', 0.3, 3, 0.05)}</div>
      <div class="setting"><label>جودة الرسوميات</label>${seg('quality', [['low', 'منخفضة'], ['medium', 'متوسطة'], ['high', 'عالية']])}<small>تُطبّق عند بدء المهمة التالية.</small></div>
      <div class="setting"><label>المنظار الحراري</label>${seg('thermalPolarity', [['white', 'أبيض ساخن'], ['black', 'أسود ساخن']])}</div>
      <div class="setting"><label>الصوت العام</label>${rng('volume', 0, 1, 0.05)}<label>الموسيقى</label>${rng('music', 0, 1, 0.05)}</div>
      <div class="setting"><label>خيارات</label>
        ${seg('voice', [[true, 'نداءات صوتية'], [false, 'بلا نداءات']])}
        ${seg('autoReplay', [[true, 'زر اللقطة بعد الإصابة'], [false, 'إخفاء']])}
        ${seg('invertY', [[false, 'محور عادي'], [true, 'محور معكوس']])}
        ${seg('tapToFire', [[false, 'الإطلاق بالزر'], [true, 'النقر للإطلاق']])}</div>
      <div class="setting"><label>البيانات</label><small>المعرّف: <span style="font-family:var(--f-mono);direction:ltr;display:inline-block">${esc(Save.uuid)}</span></small>
        <button class="btn small danger" id="reset-prog">مسح التقدم</button></div>`;
    const body = $('settings-body');
    body.querySelectorAll('.seg').forEach((g) => {
      g.querySelectorAll('button').forEach((b) => {
        b.onclick = async () => {
          const key = g.dataset.key;
          let v = b.dataset.v;
          if (v === 'true') v = true; else if (v === 'false') v = false;
          s[key] = v;
          Save.save();
          if (key === 'control' && v === 'gyro') {
            const ok = await this.app.input.enableGyro();
            if (!ok) this.toast('لم يُسمح باستخدام مستشعر الدوران على هذا الجهاز');
            else this.toast('حرّك الجهاز للتصويب');
          } else if (key === 'control') this.app.input.disableGyro();
          if (key === 'quality' && v !== this.app.quality) {
            if (from === 'pause') this.toast('تُطبّق الجودة الجديدة عند إعادة تشغيل اللعبة');
            else { this.toast('جارٍ إعادة التحميل لتطبيق الجودة…'); setTimeout(() => location.reload(), 700); }
          }
          this.app.applySettings();
          this.openSettings(from);
        };
      });
    });
    body.querySelectorAll('input[type=range]').forEach((r) => {
      r.oninput = () => { s[r.dataset.key] = parseFloat(r.value); Save.save(); this.app.applySettings(); };
    });
    $('reset-prog').onclick = () => {
      this.modal('<h3>مسح كل التقدم؟</h3><p class="muted">ستفقد الذهب والنجوم والأسلحة. المشتريات المميزة تحتاج إعادة تفعيل بالكود.</p><div class="row"><button class="btn danger" id="rs-yes">نعم، امسح</button><button class="btn" id="rs-no">إلغاء</button></div>', (card, close) => {
        card.querySelector('#rs-yes').onclick = () => { Save.reset(); close(); this.toast('تم مسح التقدم'); this.openSettings(from); };
        card.querySelector('#rs-no').onclick = close;
      });
    };
    this.show('settings');
  }
}
