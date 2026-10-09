// حفظ التقدم محلياً: الذهب، النجوم، الأسلحة، الترقيات، المشتريات، الإعدادات
import { CONFIG } from '../config.js';
import { storage, uuid4 } from './util.js';
import { REGIONS } from '../data/regions.js';

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
}

export function defaultQuality() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (isMobile()) return mem >= 6 && cores >= 8 ? 'medium' : 'low';
  return mem >= 8 && cores >= 8 ? 'high' : 'medium';
}

const DEFAULTS = () => ({
  v: 1,
  uuid: uuid4(),
  gold: 600,
  stars: {},            // missionId -> {easy:0..3, normal:..}
  unlocked: 1,          // عدد المناطق المفتوحة
  weapons: ['tow', 'mg'],
  upgrades: {},
  skin: 'olive',
  skins: ['olive'],
  premium: {},          // itemId -> true
  orders: {},           // itemId -> رقم الطلب الحالي
  redeemed: [],
  gift: { welcome: false, last: 0, streak: 0 },
  stats: { kills: 0, missions: 0, longest: 0, turretTosses: 0, played: 0 },
  settings: {
    quality: defaultQuality(),
    control: isMobile() ? 'drag' : 'mouse',
    sens: 1, stickSens: 1, gyroSens: 1.2, invertY: false,
    volume: 0.8, music: 0.45, voice: true,
    autoReplay: true, thermalPolarity: 'white', pointerLock: true, tapToFire: false,
    difficulty: 'normal',
  },
});

export const Save = {
  data: null,
  load() {
    const d = storage.get(CONFIG.saveKey, null);
    const def = DEFAULTS();
    if (!d || typeof d !== 'object') this.data = def;
    else {
      this.data = { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) }, gift: { ...def.gift, ...(d.gift || {}) }, stats: { ...def.stats, ...(d.stats || {}) } };
      if (!this.data.uuid) this.data.uuid = def.uuid;
    }
    if (this.data.premium.unlock_all) this.data.unlocked = REGIONS.length;
    this.save();
    return this.data;
  },
  save() { storage.set(CONFIG.saveKey, this.data); },
  get uuid() { return this.data.uuid; },
  starsFor(mid, diff) { return (this.data.stars[mid] && this.data.stars[mid][diff]) || 0; },
  totalStars() {
    let s = 0;
    for (const m of Object.values(this.data.stars)) s += Math.max(0, ...Object.values(m));
    return s;
  },
  regionUnlocked(i) { return i < this.data.unlocked || !!this.data.premium.unlock_all; },
  missionUnlocked(ri, mi) {
    if (!this.regionUnlocked(ri)) return false;
    if (mi === 0) return true;
    const prev = REGIONS[ri].missions[mi - 1].id;
    return !!this.data.stars[prev] && Math.max(0, ...Object.values(this.data.stars[prev])) > 0;
  },
  recordResult(mid, diff, res, ri, mi) {
    const d = this.data;
    d.stars[mid] ||= {};
    d.stars[mid][diff] = Math.max(d.stars[mid][diff] || 0, res.stars);
    const mult = d.premium.vip ? 2 : 1;
    d.gold += res.gold * mult;
    d.stats.kills += res.kills;
    d.stats.longest = Math.max(d.stats.longest, res.longest || 0);
    d.stats.turretTosses += res.turretTosses || 0;
    d.stats.played++;
    if (res.stars > 0) {
      d.stats.missions++;
      const R = REGIONS[ri];
      if (mi === R.missions.length - 1 && d.unlocked < ri + 2) d.unlocked = Math.min(REGIONS.length, ri + 2);
    }
    this.save();
    return res.gold * mult;
  },
  reset() { const u = this.data.uuid; this.data = DEFAULTS(); this.data.uuid = u; this.save(); },
};
