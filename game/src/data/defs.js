// تعريفات الأسلحة والوحدات والصعوبات والمتجر

export const DIFFICULTIES = [
  {
    id: 'easy', name: 'سهل', desc: 'رماية مريحة، العدو بطيء الرد. مناسب للتعلّم.',
    enemyAcc: 0.4, enemyRate: 0.6, count: 0.8, jets: false, helis: false, militia: 0,
    markers: true, sway: 0.25, dmgTaken: 0.55, reward: 1, shtora: 0.2, flares: 0,
  },
  {
    id: 'normal', name: 'متوسط', desc: 'ميليشيات إيرانية إضافية ومروحيات النظام.',
    enemyAcc: 0.7, enemyRate: 0.85, count: 1, jets: false, helis: true, militia: 1,
    markers: true, sway: 0.5, dmgTaken: 0.8, reward: 1.3, shtora: 0.45, flares: 0.25,
  },
  {
    id: 'hard', name: 'صعب', desc: 'تدخّل الطيران الروسي: غارات سوخوي ومروحيات Mi-24.',
    enemyAcc: 0.95, enemyRate: 1, count: 1.25, jets: true, helis: true, militia: 2,
    markers: true, sway: 0.75, dmgTaken: 1, reward: 1.7, shtora: 0.7, flares: 0.5,
  },
  {
    id: 'legend', name: 'أسطوري', desc: 'غارات روسية كثيفة، مسيّرات انتحارية، بلا مؤشرات أهداف.',
    enemyAcc: 1.2, enemyRate: 1.2, count: 1.5, jets: true, helis: true, militia: 3,
    markers: false, sway: 1, dmgTaken: 1.25, reward: 2.3, shtora: 0.9, flares: 0.7,
  },
];

export const FACTIONS = {
  regime: { name: 'قوات النظام', color: '#d1322c' },
  iran: { name: 'ميليشيات إيرانية', color: '#e0a43a' },
  russia: { name: 'الطيران الروسي', color: '#5fa8ff' },
  friend: { name: 'قوات ردع العدوان', color: '#3fbf6a' },
};

// cls يحدد سلوك الذكاء الاصطناعي ونموذج الإصابة
export const UNITS = {
  t72: { name: 'دبابة T-72', cls: 'tank', model: 't72', hp: 100, speed: 8, reward: 150, faction: 'regime', weapon: 'cannon', turretToss: 0.65, armor: { front: 1.0, side: 1.25, rear: 1.5, top: 1.6 } },
  t90: { name: 'دبابة T-90 قيادية', cls: 'tank', model: 't90', hp: 175, speed: 8, reward: 320, faction: 'regime', weapon: 'cannon', turretToss: 0.5, shtora: true, armor: { front: 0.6, side: 1.8, rear: 2.0, top: 2.0 } },
  t55: { name: 'دبابة T-55', cls: 'tank', model: 't55', hp: 80, speed: 7, reward: 110, faction: 'regime', weapon: 'cannon', turretToss: 0.7, armor: { front: 1.0, side: 1.2, rear: 1.4, top: 1.6 } },
  bmp1: { name: 'مدرعة BMP-1', cls: 'ifv', model: 'bmp1', hp: 65, speed: 10, reward: 100, faction: 'regime', weapon: 'gun73', atgm: true, armor: { front: 1, side: 1.2, rear: 1.3, top: 1.5 } },
  bmp2: { name: 'مدرعة BMP-2', cls: 'ifv', model: 'bmp2', hp: 70, speed: 10, reward: 120, faction: 'regime', weapon: 'autocannon', atgm: true, armor: { front: 1, side: 1.2, rear: 1.3, top: 1.5 } },
  ural: { name: 'شاحنة ذخيرة', cls: 'truck', model: 'ural', hp: 35, speed: 12, reward: 70, faction: 'regime', weapon: null, explosive: true, armor: { front: 1.3, side: 1.3, rear: 1.3, top: 1.3 } },
  technical: { name: 'سيارة ميليشيا (دوشكا)', cls: 'technical', model: 'technical', hp: 30, speed: 15, reward: 60, faction: 'iran', weapon: 'dshk', armor: { front: 1.5, side: 1.5, rear: 1.5, top: 1.5 } },
  zu23: { name: 'شاحنة ZU-23', cls: 'aa', model: 'zu23', hp: 40, speed: 11, reward: 90, faction: 'regime', weapon: 'zu23', armor: { front: 1.4, side: 1.4, rear: 1.4, top: 1.4 } },
  shilka: { name: 'شيلكا ZSU-23-4', cls: 'aa', model: 'shilka', hp: 80, speed: 8, reward: 180, faction: 'regime', weapon: 'zu23', armor: { front: 1, side: 1.2, rear: 1.3, top: 1.5 } },
  grad: { name: 'راجمة غراد BM-21', cls: 'artillery', model: 'grad', hp: 45, speed: 10, reward: 220, faction: 'regime', weapon: 'grad', explosive: true, armor: { front: 1.3, side: 1.3, rear: 1.3, top: 1.3 } },
  bunker: { name: 'دشمة رشاش', cls: 'static', model: 'bunker', hp: 60, reward: 80, faction: 'regime', weapon: 'dshk', armor: { front: 1, side: 1, rear: 1, top: 1 } },
  checkpoint: { name: 'حاجز عسكري', cls: 'static', model: 'checkpoint', hp: 80, reward: 120, faction: 'regime', weapon: 'pkm', armor: { front: 1, side: 1, rear: 1, top: 1 } },
  depot: { name: 'مستودع ذخيرة', cls: 'static', model: 'depot', hp: 95, reward: 450, faction: 'regime', weapon: null, explosive: true, armor: { front: 1, side: 1, rear: 1, top: 1.2 } },
  buk: { name: 'منظومة دفاع جوي', cls: 'static', model: 'buk', hp: 90, reward: 380, faction: 'russia', weapon: 'sam', explosive: true, armor: { front: 1, side: 1.2, rear: 1.3, top: 1.4 } },
  atgm: { name: 'فريق صواريخ كونكورس', cls: 'static', model: 'atgmteam', hp: 20, reward: 140, faction: 'iran', weapon: 'atgm', armor: { front: 1.5, side: 1.5, rear: 1.5, top: 1.5 } },
  infantry: { name: 'عنصر ميليشيا', cls: 'infantry', model: 'militia', hp: 10, speed: 2.2, reward: 15, faction: 'iran', weapon: 'rifle', armor: { front: 1, side: 1, rear: 1, top: 1 } },
  soldier: { name: 'جندي', cls: 'infantry', model: 'soldier', hp: 10, speed: 2.2, reward: 12, faction: 'regime', weapon: 'rifle', armor: { front: 1, side: 1, rear: 1, top: 1 } },
  rpg: { name: 'رامي RPG', cls: 'infantry', model: 'militia', hp: 10, speed: 2.4, reward: 25, faction: 'iran', weapon: 'rpg', armor: { front: 1, side: 1, rear: 1, top: 1 } },
  mi24: { name: 'مروحية Mi-24 روسية', cls: 'heli', model: 'mi24', hp: 90, speed: 55, reward: 450, faction: 'russia', weapon: 'rockets', armor: { front: 1, side: 1.2, rear: 1.2, top: 1.2 } },
  mi8: { name: 'مروحية Mi-8 للنظام', cls: 'heli', model: 'mi8', hp: 70, speed: 50, reward: 320, faction: 'regime', weapon: 'barrel', armor: { front: 1.2, side: 1.3, rear: 1.3, top: 1.3 } },
  su24: { name: 'قاذفة Su-24 روسية', cls: 'jet', model: 'su24', hp: 55, speed: 200, reward: 650, faction: 'russia', weapon: 'bombs', armor: { front: 1, side: 1, rear: 1, top: 1 } },
  su34: { name: 'قاذفة Su-34 روسية', cls: 'jet', model: 'su34', hp: 75, speed: 210, reward: 850, faction: 'russia', weapon: 'bombs', armor: { front: 1, side: 1, rear: 1, top: 1 } },
  recon: { name: 'مسيّرة استطلاع إيرانية', cls: 'drone', model: 'recon', hp: 12, speed: 35, reward: 120, faction: 'iran', weapon: null, armor: { front: 1, side: 1, rear: 1, top: 1 } },
  kamikaze: { name: 'مسيّرة انتحارية إيرانية', cls: 'drone', model: 'kamikaze', hp: 8, speed: 45, reward: 110, faction: 'iran', weapon: 'self', armor: { front: 1, side: 1, rear: 1, top: 1 } },
  // وحدات صديقة
  f_technical: { name: 'سيارة الثوار', cls: 'technical', model: 'f_technical', hp: 45, speed: 12, reward: 0, faction: 'friend', weapon: 'dshk', friendly: true, armor: { front: 1, side: 1, rear: 1, top: 1 } },
  f_bmp: { name: 'BMP مغتنمة', cls: 'ifv', model: 'f_bmp', hp: 80, speed: 9, reward: 0, faction: 'friend', weapon: 'gun73', friendly: true, armor: { front: 1, side: 1, rear: 1, top: 1 } },
  f_tank: { name: 'T-55 مغتنمة', cls: 'tank', model: 'f_t55', hp: 110, speed: 7, reward: 0, faction: 'friend', weapon: 'cannon', friendly: true, armor: { front: 1, side: 1, rear: 1, top: 1 } },
};

export const WEAPONS = {
  tow: {
    id: 'tow', name: 'تاو TOW-2A', short: 'تاو', desc: 'صاروخ موجّه سلكياً حتى 3750 م. أبقِ التصويب على الهدف حتى الإصابة.',
    ammo: 8, reload: 5, speed: 260, range: 3750, damage: 100, free: true,
  },
  mg: {
    id: 'mg', name: 'رشاش KPV 14.5 مم', short: 'رشاش', desc: 'ضد الأفراد والسيارات والمسيّرات. يسخن مع الرمي المتواصل.',
    ammo: Infinity, rpm: 600, damage: 7, range: 2000, free: true,
  },
  igla: {
    id: 'igla', name: 'إيغلا م/ط', short: 'إيغلا', desc: 'صاروخ حراري محمول على الكتف ضد الطائرات والمروحيات. انتظر نغمة القفل.',
    ammo: 3, reload: 4, lockTime: 1.3, range: 5200, damage: 100, price: 1500,
  },
  drone: {
    id: 'drone', name: 'مسيّرة شاهين', short: 'شاهين', desc: 'مسيّرة FPV انتحارية تقودها بنفسك نحو الهدف.',
    ammo: 2, damage: 140, price: 2500,
  },
  rockets: {
    id: 'rockets', name: 'راجمة صواريخ', short: 'راجمة', desc: 'رشقة من 12 صاروخاً على نقطة تحددها. إعادة تذخير طويلة.',
    ammo: 1, cooldown: 75, damage: 70, price: 4000,
  },
};

export const WEAPON_ORDER = ['tow', 'mg', 'igla', 'drone', 'rockets'];

export const UPGRADES = [
  { id: 'tow_ammo', name: 'صواريخ تاو إضافية', desc: '+2 صاروخ لكل مستوى', costs: [800, 1600, 3000] },
  { id: 'tow_guide', name: 'منظومة توجيه محسّنة', desc: 'ثبات أعلى للتصويب واستجابة أسرع للصاروخ', costs: [1000, 2200, 3800] },
  { id: 'tow_reload', name: 'طاقم تلقيم مدرّب', desc: 'تلقيم أسرع للقاذف', costs: [900, 1800, 3200] },
  { id: 'armor', name: 'تحصين الموقع', desc: '+20% تحمّل لموقع الرماية', costs: [700, 1500, 2800] },
  { id: 'thermal', name: 'منظار حراري متطور', desc: 'صورة حرارية أوضح وتكبير ×20', costs: [600, 1400] },
  { id: 'drones', name: 'مسيّرات إضافية', desc: '+1 مسيّرة شاهين لكل مستوى', costs: [1500, 3000] },
];

export const SKINS = [
  { id: 'olive', name: 'زيتوني', color: '#5b6145', price: 0 },
  { id: 'desert', name: 'صحراوي', color: '#b49a6a', price: 600 },
  { id: 'urban', name: 'رمادي مدني', color: '#7c8084', price: 900 },
  { id: 'night', name: 'أسود ليلي', color: '#26292a', price: 1200 },
  { id: 'gold', name: 'ذهبي', color: '#d9a734', price: null, premium: 'skin_gold' },
];

// منتجات تُشترى بكود تفعيل يُرسل عبر واتساب (مرتبط بمعرّف الجهاز)
export const PREMIUM = [
  { id: 'gold_5k', name: 'صندوق ذهب 5,000', desc: 'يضاف 5,000 ذهب إلى رصيدك', consumable: true, gold: 5000, price: '1$' },
  { id: 'gold_25k', name: 'خزنة ذهب 25,000', desc: 'يضاف 25,000 ذهب إلى رصيدك', consumable: true, gold: 25000, price: '4$' },
  { id: 'tow2b', name: 'تاو 2B — هجوم علوي', desc: 'ينفجر فوق الدبابة ويخترق السقف. يدمّر T-90 بضربة واحدة.', price: '3$' },
  { id: 'unlock_all', name: 'فتح كل المناطق', desc: 'افتح الخريطة كاملة من حلب إلى دمشق', price: '2$' },
  { id: 'vip', name: 'عضوية القائد', desc: 'ذهب مضاعف ×2 دائماً + صاروخان إضافيان في كل مهمة', price: '5$' },
  { id: 'skin_gold', name: 'قاذف ذهبي', desc: 'طلاء ذهبي فاخر للقاذف والرشاش', price: '1$' },
];
