// المتجر: شراء بالذهب، ومشتريات مميزة بكود تفعيل مرتبط بالمعرّف عبر واتساب، والباقة الهدية
import { CONFIG } from '../config.js';
import { Save } from './save.js';
import { WEAPONS, UPGRADES, SKINS, PREMIUM } from '../data/defs.js';
import { makeCode, verifyCode, cleanCode, normalizeUuid } from './codes.js';
import { fmtInt } from './util.js';

const DAY = 20 * 3600 * 1000;

export const Shop = {
  canAfford(n) { return Save.data.gold >= n; },

  buyWeapon(id) {
    const w = WEAPONS[id];
    const d = Save.data;
    if (!w || d.weapons.includes(id) || !w.price) return { ok: false, msg: 'غير متاح' };
    if (d.gold < w.price) return { ok: false, msg: 'لا يكفي الذهب' };
    d.gold -= w.price;
    d.weapons.push(id);
    Save.save();
    return { ok: true, msg: `تم فتح ${w.name}` };
  },

  upgradeLevel(id) { return Save.data.upgrades[id] || 0; },

  buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const d = Save.data;
    const lvl = d.upgrades[id] || 0;
    if (!u || lvl >= u.costs.length) return { ok: false, msg: 'وصلت للحد الأقصى' };
    const cost = u.costs[lvl];
    if (d.gold < cost) return { ok: false, msg: 'لا يكفي الذهب' };
    d.gold -= cost;
    d.upgrades[id] = lvl + 1;
    Save.save();
    return { ok: true, msg: `${u.name} — المستوى ${lvl + 1}` };
  },

  buySkin(id) {
    const s = SKINS.find((x) => x.id === id);
    const d = Save.data;
    if (!s) return { ok: false };
    if (d.skins.includes(id)) { d.skin = id; Save.save(); return { ok: true, msg: `تم تجهيز التمويه ${s.name}` }; }
    if (s.premium) return { ok: false, msg: 'هذا الطلاء من المنتجات المميزة' };
    if (d.gold < s.price) return { ok: false, msg: 'لا يكفي الذهب' };
    d.gold -= s.price;
    d.skins.push(id);
    d.skin = id;
    Save.save();
    return { ok: true, msg: `تم شراء ${s.name}` };
  },

  orderNo(itemId) { return Save.data.orders[itemId] || 1; },

  owned(itemId) { return !!Save.data.premium[itemId]; },

  shareUrl() { return CONFIG.shareUrl || (location.protocol.startsWith('http') ? location.href.split('#')[0] : ''); },

  // رسالة طلب الشراء عبر واتساب (لنفسك أو هدية لصديق)
  orderLink(itemId, friendUuid = null) {
    const it = PREMIUM.find((x) => x.id === itemId);
    const target = friendUuid ? normalizeUuid(friendUuid) : Save.uuid;
    const order = friendUuid ? 1 : this.orderNo(itemId);
    const lines = [
      friendUuid ? '🎁 طلب إهداء من لعبة ردع العدوان' : '🛒 طلب شراء من لعبة ردع العدوان',
      `المنتج: ${it ? it.name : itemId} (${itemId})`,
      `السعر: ${it ? it.price : ''}`,
      `المعرّف: ${target}`,
      `رقم الطلب: ${order}`,
    ];
    if (friendUuid) lines.push(`من المعرّف: ${Save.uuid}`);
    const text = lines.join('\n');
    const num = (CONFIG.whatsappNumber || '').replace(/\D/g, '');
    return { url: `https://wa.me/${num}?text=${encodeURIComponent(text)}`, text, number: num };
  },

  // التحقق من كود التفعيل ومنح المنتج
  redeem(code) {
    const c = cleanCode(code);
    const d = Save.data;
    if (c.length !== 10) return { ok: false, msg: 'الكود يتكون من 10 أحرف (XXXXX-XXXXX)' };
    if (d.redeemed.includes(c)) return { ok: false, msg: 'هذا الكود مستخدم مسبقاً' };
    for (const it of PREMIUM) {
      // نجرب رقم الطلب الحالي ورقم هدية الصديق (1)
      const nums = [...new Set([this.orderNo(it.id), 1])];
      for (const n of nums) {
        if (!verifyCode(c, Save.uuid, it.id, n, CONFIG.shopSecret)) continue;
        if (!it.consumable && d.premium[it.id]) return { ok: false, msg: 'تملك هذا المنتج بالفعل' };
        d.redeemed.push(c);
        if (it.consumable) {
          d.gold += it.gold || 0;
          d.orders[it.id] = this.orderNo(it.id) + 1;
        } else {
          d.premium[it.id] = true;
          if (it.id === 'unlock_all') d.unlocked = 99;
          if (it.id === 'skin_gold') { d.skins.push('gold'); d.skin = 'gold'; }
        }
        Save.save();
        return { ok: true, msg: `تم التفعيل: ${it.name}${it.gold ? ` (+${fmtInt(it.gold)} ذهب)` : ''}`, item: it };
      }
    }
    return { ok: false, msg: 'الكود غير صحيح لهذا الجهاز. تأكد من إرسال المعرّف الصحيح.' };
  },

  // ===== الباقة الهدية =====
  giftState() {
    const g = Save.data.gift;
    const now = Date.now();
    const ready = now - (g.last || 0) >= DAY;
    const streakAlive = now - (g.last || 0) < DAY * 2.4;
    const streak = ready ? (streakAlive ? Math.min(7, (g.streak || 0) + 1) : 1) : g.streak || 0;
    return { welcome: !g.welcome, ready, streak, amount: 250 + streak * 50, next: (g.last || 0) + DAY };
  },

  claimWelcome() {
    const d = Save.data;
    if (d.gift.welcome) return { ok: false };
    d.gift.welcome = true;
    d.gold += 1500;
    if (!d.weapons.includes('igla')) d.weapons.push('igla');
    Save.save();
    return { ok: true, msg: 'باقة الترحيب: +1,500 ذهب وصاروخ إيغلا مجاناً!' };
  },

  claimDaily() {
    const st = this.giftState();
    if (!st.ready) return { ok: false, msg: 'الهدية اليومية غير جاهزة بعد' };
    const d = Save.data;
    d.gift.last = Date.now();
    d.gift.streak = st.streak;
    d.gold += st.amount;
    Save.save();
    return { ok: true, msg: `الهدية اليومية (اليوم ${st.streak}): +${fmtInt(st.amount)} ذهب`, amount: st.amount };
  },

  // أداة البائع (تُستخدم في tools/keygen.html أيضاً)
  _makeCode(uuid, itemId, order) { return makeCode(uuid, itemId, order, CONFIG.shopSecret); },
};
