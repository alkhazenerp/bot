// المناطق والمهمات — من ريف حلب الغربي حتى دمشق
// الإحداثيات بالمتر: اللاعب عند (0,0) وينظر نحو -Z

const R = (pts) => pts; // للتوضيح فقط

export const REGIONS = [
  {
    id: 'regiment46', name: 'الفوج 46', area: 'ريف حلب الغربي', date: '27 تشرين الثاني 2024',
    intro: 'فجر اليوم الأول. انطلقت معركة ردع العدوان من خطوط ريف حلب الغربي، والهدف الأول قاعدة الفوج 46 المحصّنة بين بساتين الزيتون.',
    env: { time: 'dawn', weather: 'clear', north: 90 },
    layout: {
      terrain: { amp: 16, freq: 1 / 1100, seed: 4601, rock: 0.5, soil: 'red', mountains: [
        { x: -2800, z: -3600, r: 1300, h: 190 }, { x: 2600, z: -4000, r: 1500, h: 240 }, { x: -600, z: -4300, r: 900, h: 130 },
      ] },
      roads: [
        { id: 'r1', w: 10, type: 'road', pts: R([[-3200, -880], [-1700, -980], [-400, -1120], [800, -1080], [1900, -1180], [3200, -1300]]) },
        { id: 'r2', w: 9, type: 'road', pts: R([[700, -3400], [560, -2600], [380, -1900], [180, -1300], [-60, -800], [-260, -350]]) },
        { id: 'r3', w: 6, type: 'track', pts: R([[-2600, -2700], [-1300, -2350], [100, -2200], [620, -2260], [1500, -2600]]) },
      ],
      villages: [
        { x: -1350, z: -1750, r: 260, n: 34, style: 'village', damage: 0.25, mosque: true },
        { x: 1700, z: -1750, r: 200, n: 20, style: 'village', damage: 0.35, mosque: false },
      ],
      groves: [
        { x: -700, z: -650, w: 520, d: 300, rot: 0.1 }, { x: 650, z: -700, w: 600, d: 360, rot: -0.05 },
        { x: -1900, z: -1300, w: 700, d: 400, rot: 0.2 }, { x: 1200, z: -1500, w: 500, d: 300, rot: 0 },
        { x: -400, z: -1500, w: 400, d: 280, rot: 0.3 },
      ],
      landmarks: [{ type: 'base', x: 380, z: -2350, w: 760, d: 520 }],
      lanes: {
        cross: { road: 'r1' }, cross_r: { road: 'r1', reverse: true },
        approach: { road: 'r2', to: 0.72 }, base_road: { road: 'r3' }, base_road_r: { road: 'r3', reverse: true },
      },
      anchors: {
        cp1: [180, -2060], cp2: [560, -2080], bunker1: [-60, -1980], bunker2: [820, -2180], depot: [420, -2460],
        aa1: [950, -2520], hill1: [-900, -1480], village1: [-1300, -1700], tank1: [260, -1960], tank2: [680, -1990],
        atgm1: [-520, -1650], hangar: [150, -2420],
      },
      player: { h: 7 },
    },
    missions: [
      { id: 'r46-1', name: 'ساعة الصفر', template: 'assault', env: { time: 'dawn' }, params: { targets: ['cp1', 'bunker1', 'tank1', 'cp2'], kinds: ['checkpoint', 'bunker', 't72', 'checkpoint'], reinf: ['approach'], squads: ['village1', 'hill1'] },
        brief: 'دمّر الحاجز الشمالي ودشم الرشاشات والدبابة المتمركزة عند بوابة الفوج لفتح الطريق أمام المقتحمين.' },
      { id: 'r46-2', name: 'رتل المؤازرة', template: 'column', env: { time: 'morning' }, params: { lanes: ['cross', 'cross_r'], groups: 3, mix: ['t72', 'bmp1', 'ural', 't72', 'bmp1'], maxEscapes: 3 },
        brief: 'رتل مؤازرة للنظام يتحرك على الطريق العرضي نحو القاعدة. لا تسمح له بالوصول.' },
      { id: 'r46-3', name: 'سقوط الفوج', template: 'depot', env: { time: 'afternoon', weather: 'haze' }, params: { depot: 'depot', guards: ['tank2', 'aa1', 'bunker2', 'hangar'], guardKinds: ['t72', 'zu23', 'bunker', 'bmp1'], reinf: ['base_road'] },
        brief: 'مستودع الذخيرة الرئيسي للفوج 46. دمّره وستنهار دفاعات القاعدة بالكامل.' },
    ],
  },
  {
    id: 'saraqib', name: 'سراقب', area: 'عقدة M4 و M5', date: '28 تشرين الثاني 2024',
    intro: 'سراقب عقدة الطريقين الدوليين M4 و M5. السيطرة عليها تقطع إمداد النظام نحو حلب.',
    env: { time: 'afternoon', weather: 'haze', north: 0 },
    layout: {
      terrain: { amp: 8, freq: 1 / 1400, seed: 5502, rock: 0.15, soil: 'red', mountains: [{ x: 3200, z: -4600, r: 1800, h: 140 }] },
      roads: [
        { id: 'm5', w: 18, type: 'highway', pts: R([[-1900, -4300], [-1150, -2700], [-450, -1650], [650, -800], [2300, 250]]) },
        { id: 'm4', w: 16, type: 'highway', pts: R([[-3300, -2050], [-1600, -1780], [-450, -1650], [900, -1880], [3300, -2200]]) },
        { id: 'loc', w: 7, type: 'road', pts: R([[-450, -1650], [100, -2200], [600, -2500], [1100, -3200]]) },
      ],
      villages: [
        { x: 650, z: -2550, r: 480, n: 70, style: 'town', damage: 0.45, mosque: true },
        { x: -1700, z: -2500, r: 220, n: 18, style: 'village', damage: 0.3, mosque: true },
      ],
      groves: [{ x: -900, z: -700, w: 600, d: 300, rot: 0 }, { x: 1300, z: -1300, w: 500, d: 400, rot: 0.4 }, { x: -2200, z: -1200, w: 600, d: 400, rot: 0 }],
      landmarks: [{ type: 'interchange', x: -450, z: -1650 }],
      lanes: {
        m5_s: { road: 'm5', to: 0.85 }, m5_n: { road: 'm5', reverse: true, from: 0.25 },
        m4_e: { road: 'm4' }, m4_w: { road: 'm4', reverse: true }, town_road: { road: 'loc', reverse: true },
        m5_full: { road: 'm5' },
      },
      anchors: {
        cp1: [-330, -1560], cp2: [-620, -1760], jx: [-450, -1650], town: [600, -2350], aa1: [980, -2700], depot: [350, -2800],
        bunker1: [-150, -1900], bunker2: [-850, -1500], tank1: [200, -2150], hill1: [-1700, -2400], atgm1: [1200, -1600],
      },
      player: { h: 5 },
    },
    missions: [
      { id: 'sq-1', name: 'عقدة الطرق', template: 'column', params: { lanes: ['m4_e', 'm4_w', 'm5_s'], groups: 3, mix: ['t72', 'bmp2', 'ural', 'technical', 'zu23'], maxEscapes: 3 },
        brief: 'أرتال النظام تحاول عبور العقدة. دمّر أكبر عدد ممكن قبل أن تفلت.' },
      { id: 'sq-2', name: 'قطع الإمداد', template: 'escort', params: { lane: 'm5_n', friendlies: ['f_technical', 'f_bmp', 'f_technical', 'f_technical'], need: 3, ambush: [['bunker1', 'bunker'], ['tank1', 't72'], ['atgm1', 'atgm'], ['cp1', 'checkpoint']] },
        brief: 'رتل الثوار يتقدم نحو العقدة. احمِه من الكمائن والدبابات حتى يصل إلى الحاجز.' },
      { id: 'sq-3', name: 'ليل سراقب', template: 'assault', env: { time: 'night' }, params: { targets: ['cp1', 'cp2', 'tank1', 'aa1', 'bunker2'], kinds: ['checkpoint', 'checkpoint', 't72', 'shilka', 'bunker'], reinf: ['town_road'], squads: ['town', 'jx'] },
        brief: 'هجوم ليلي على عقدة سراقب. استخدم المنظار الحراري لكشف الأهداف.' },
    ],
  },
  {
    id: 'aleppo', name: 'حلب', area: 'مدينة حلب ومطار النيرب', date: '29 تشرين الثاني 2024',
    intro: 'بعد ثلاثة أيام فقط، وصل المقاتلون إلى أطراف حلب. القلعة تلوح في الأفق والمطار ما زال بيد النظام.',
    env: { time: 'golden', weather: 'clear', north: 0 },
    layout: {
      terrain: { amp: 10, freq: 1 / 1300, seed: 3700, rock: 0.2, soil: 'pale', mountains: [] },
      roads: [
        { id: 'ring', w: 16, type: 'highway', pts: R([[-3300, -1150], [-1500, -1300], [0, -1380], [1500, -1250], [3300, -1100]]) },
        { id: 'ave', w: 12, type: 'road', pts: R([[60, -3600], [120, -2600], [40, -1380], [-120, -700], [-200, -250]]) },
        { id: 'air', w: 10, type: 'road', pts: R([[900, -1300], [1700, -1600], [2600, -1700], [3300, -1900]]) },
      ],
      villages: [
        { x: -300, z: -2900, r: 1200, n: 220, style: 'city', damage: 0.3, mosque: true },
        { x: -1500, z: -1800, r: 420, n: 50, style: 'industrial', damage: 0.45, mosque: false },
      ],
      groves: [{ x: -1200, z: -500, w: 500, d: 300, rot: 0.1 }],
      landmarks: [{ type: 'citadel', x: -250, z: -3150 }, { type: 'airport', x: 1900, z: -1950, rot: -0.12 }],
      lanes: {
        ring: { road: 'ring' }, ring_r: { road: 'ring', reverse: true }, from_city: { road: 'ave', to: 0.6 },
        airport: { road: 'air', reverse: true, to: 0.8 },
      },
      anchors: {
        cp1: [-150, -1460], cp2: [260, -1420], buk: [1650, -1800], buk2: [2250, -2050], aa1: [2050, -1650], depot: [-1100, -1900],
        bunker1: [600, -1950], roof1: [-450, -2100], tank1: [-700, -1550], tank2: [900, -1500], atgm1: [400, -2200], city: [-200, -2300],
      },
      player: { h: 8 },
    },
    missions: [
      { id: 'al-1', name: 'بوابة حلب', template: 'assault', params: { targets: ['cp1', 'cp2', 'tank1', 'bunker1', 'roof1'], kinds: ['checkpoint', 'checkpoint', 't72', 'bunker', 'atgm'], reinf: ['from_city', 'ring_r'], squads: ['city', 'cp1'] },
        brief: 'حواجز الطريق الدائري هي آخر ما يفصلنا عن أحياء حلب الغربية. افتح البوابة.' },
      { id: 'al-2', name: 'مطار النيرب', template: 'airdef', params: { targets: ['buk', 'buk2', 'aa1'], kinds: ['buk', 'buk', 'shilka'], helis: 3, time: 150 },
        brief: 'منظومات الدفاع الجوي في مطار النيرب تحمي الطيران. دمّرها وأسقط المروحيات المقلعة.' },
      { id: 'al-3', name: 'ليل القلعة', template: 'column', env: { time: 'night' }, params: { lanes: ['ring', 'ring_r', 'from_city'], groups: 4, mix: ['t72', 'bmp2', 'technical', 'technical', 'zu23'], maxEscapes: 4 },
        brief: 'قوات النظام والميليشيات تنسحب ليلاً من المدينة. لا تدعها تعيد التموضع.' },
    ],
  },
  {
    id: 'khanshaykhun', name: 'خان شيخون', area: 'ريف إدلب الجنوبي', date: '30 تشرين الثاني 2024',
    intro: 'الطريق M5 جنوباً. تل النمر يشرف على المدينة المدمرة، والغبار يغطي السهل.',
    env: { time: 'noon', weather: 'dust', north: 0 },
    layout: {
      terrain: { amp: 9, freq: 1 / 1200, seed: 2290, rock: 0.3, soil: 'pale', mountains: [{ x: 1250, z: -1900, r: 380, h: 75, plateau: 0.6 }, { x: -3500, z: -3800, r: 1600, h: 160 }] },
      roads: [
        { id: 'm5', w: 18, type: 'highway', pts: R([[-2700, -3900], [-1300, -2300], [-250, -1350], [1200, -750], [3200, -350]]) },
        { id: 'side', w: 7, type: 'road', pts: R([[-1300, -2300], [0, -2700], [1300, -2400], [2600, -2700]]) },
        { id: 'tal', w: 5, type: 'track', pts: R([[1200, -750], [1300, -1300], [1250, -1700]]) },
      ],
      villages: [{ x: -1500, z: -2650, r: 520, n: 80, style: 'town', damage: 0.65, mosque: true }, { x: 2100, z: -1700, r: 180, n: 14, style: 'village', damage: 0.3 }],
      groves: [{ x: -300, z: -600, w: 500, d: 300, rot: 0.6 }, { x: 600, z: -1700, w: 600, d: 300, rot: 0.2 }, { x: -2200, z: -1400, w: 600, d: 300, rot: 0.6 }],
      landmarks: [],
      lanes: { m5_s: { road: 'm5' }, m5_n: { road: 'm5', reverse: true }, side: { road: 'side' }, side_r: { road: 'side', reverse: true }, tal: { road: 'tal' } },
      anchors: { tal: [1250, -1850], cp1: [-300, -1450], town: [-1400, -2500], aa1: [1350, -1950], tank1: [-650, -1750], bunker1: [1100, -1700], depot: [-1000, -2350], atgm1: [300, -2300] },
      player: { h: 6 },
    },
    missions: [
      { id: 'ks-1', name: 'طريق الموت', template: 'column', params: { lanes: ['m5_n', 'm5_s', 'side'], groups: 4, mix: ['t72', 't72', 'bmp1', 'ural', 'grad'], maxEscapes: 3 },
        brief: 'رتل مدرّع يهرب على الطريق الدولي وسط عاصفة غبار. استعمل الحراري عند انعدام الرؤية.' },
      { id: 'ks-2', name: 'قائد الرتل', template: 'hvt', params: { lane: 'm5_n', boss: 't90', escorts: ['bmp2', 't72', 'technical', 'bmp2'], time: 160 },
        brief: 'دبابة T-90 تقلّ قائد قطاع خان شيخون تحاول الفرار. مزوّدة بمنظومة شتورا للتشويش — اضربها من الجانب.' },
      { id: 'ks-3', name: 'تل النمر', template: 'airdef', params: { targets: ['aa1', 'bunker1', 'tal'], kinds: ['shilka', 'bunker', 'zu23'], helis: 2, time: 140 },
        brief: 'التل يحمي المروحيات التي تقصف المتقدمين. أسكت مضاداته وأسقط المروحيات.' },
    ],
  },
  {
    id: 'hama', name: 'حماة', area: 'جبل زين العابدين', date: '3 - 5 كانون الأول 2024',
    intro: 'جبل زين العابدين بوابة حماة الشمالية، حوّله النظام إلى قلعة نارية. نواعير العاصي تدور في الأسفل.',
    env: { time: 'afternoon', weather: 'clear', north: 0 },
    layout: {
      terrain: { amp: 12, freq: 1 / 1000, seed: 3511, rock: 0.6, soil: 'pale', mountains: [{ x: 250, z: -2250, r: 900, h: 330, ridge: true }, { x: -3200, z: -4200, r: 1400, h: 150 }],
        river: { pts: [[-3300, -3300], [-2400, -3150], [-1500, -3350], [-600, -3700], [400, -4100]], width: 46, level: -4 } },
      roads: [
        { id: 'mt', w: 7, type: 'road', pts: R([[-1700, -1150], [-900, -1350], [-450, -1700], [-150, -1950], [150, -2120], [300, -2230]]) },
        { id: 'm5', w: 16, type: 'highway', pts: R([[-3300, -900], [-1500, -1000], [0, -950], [1500, -880], [3300, -700]]) },
      ],
      villages: [{ x: -2200, z: -3500, r: 900, n: 140, style: 'city', damage: 0.2, mosque: true }, { x: 1700, z: -1300, r: 220, n: 18, style: 'village', damage: 0.4 }],
      groves: [{ x: -500, z: -550, w: 600, d: 300, rot: 0 }, { x: 1100, z: -600, w: 500, d: 260, rot: 0 }, { x: -1200, z: -1700, w: 400, d: 300, rot: 0.4 }],
      landmarks: [{ type: 'shrine', x: 250, z: -2250 }, { type: 'noria', x: -1900, z: -3170 }, { type: 'noria', x: -1640, z: -3300 }],
      lanes: { mountain: { road: 'mt', reverse: true }, mountain_up: { road: 'mt' }, m5: { road: 'm5' }, m5_r: { road: 'm5', reverse: true } },
      anchors: { m1: [80, -1720], m2: [520, -1850], m3: [-250, -1950], summit: [260, -2150], m4: [700, -2100], cp1: [-900, -1350], aa1: [-50, -2250], depot: [450, -2350], atgm1: [-600, -1700] },
      player: { h: 6 },
    },
    missions: [
      { id: 'hm-1', name: 'سفوح الجبل', template: 'assault', params: { targets: ['m1', 'm2', 'm3', 'cp1', 'atgm1'], kinds: ['bunker', 't72', 'bunker', 'checkpoint', 'atgm'], reinf: ['mountain'], squads: ['m1', 'cp1'] },
        brief: 'التحصينات على سفوح الجبل تحصد المهاجمين. دمّرها واحدة تلو الأخرى.' },
      { id: 'hm-2', name: 'معركة القمة', template: 'hvt', params: { lane: 'mountain', boss: 't90', escorts: ['bmp2', 'shilka', 't72'], time: 170, statics: [['summit', 'bunker'], ['aa1', 'zu23']] },
        brief: 'قائد الدفاع عن الجبل يتحرك بدبابة T-90 على الطريق الملتف. اصطده قبل أن يصل إلى القمة.' },
      { id: 'hm-3', name: 'دخول حماة', template: 'escort', env: { time: 'golden' }, params: { lane: 'm5_r', friendlies: ['f_tank', 'f_technical', 'f_bmp', 'f_technical'], need: 3, ambush: [['m1', 't72'], ['cp1', 'checkpoint'], ['atgm1', 'atgm'], ['m3', 'bunker']] },
        brief: 'بعد سقوط الجبل، الرتل يتجه نحو المدينة. احمِه حتى يعبر الطريق.' },
    ],
  },
  {
    id: 'rastan', name: 'الرستن', area: 'جسر العاصي', date: '6 كانون الأول 2024',
    intro: 'الرستن وجسرها على نهر العاصي — المعبر الوحيد نحو ريف حمص الشمالي. سد الرستن يلمع شرقاً.',
    env: { time: 'morning', weather: 'rain', north: 0 },
    layout: {
      terrain: { amp: 14, freq: 1 / 900, seed: 6060, rock: 0.4, soil: 'red', mountains: [],
        river: { pts: [[3300, -1450], [2400, -1350], [1500, -1300], [500, -1520], [-400, -1680], [-1600, -1520], [-3300, -1900]], width: 50, level: -6, lake: { x: 2400, z: -1250, r: 420 } } },
      roads: [
        { id: 'm5', w: 18, type: 'highway', pts: R([[-320, -4000], [-220, -2600], [-120, -1680], [80, -800], [380, 300]]), bridge: true },
        { id: 'bank', w: 8, type: 'road', pts: R([[-2600, -2050], [-900, -1980], [700, -1870], [2600, -1900]]) },
      ],
      villages: [{ x: 0, z: -2500, r: 560, n: 90, style: 'town', damage: 0.4, mosque: true }, { x: -1600, z: -900, r: 200, n: 16, style: 'village', damage: 0.2 }],
      groves: [{ x: 900, z: -700, w: 600, d: 350, rot: 0.1 }, { x: -900, z: -600, w: 400, d: 300, rot: 0 }],
      landmarks: [{ type: 'dam', x: 2820, z: -1250 }],
      lanes: { m5_s: { road: 'm5', to: 0.55 }, m5_full: { road: 'm5' }, bank: { road: 'bank' }, bank_r: { road: 'bank', reverse: true }, m5_n: { road: 'm5', reverse: true, from: 0.2 } },
      anchors: { bridge_n: [-170, -1820], bridge_s: [-80, -1540], cp1: [-250, -2050], town: [0, -2350], aa1: [600, -2150], depot: [-700, -2300], tank1: [400, -1980], bunker1: [-900, -1900], atgm1: [1000, -1950], dam: [2700, -1300] },
      player: { h: 7 },
    },
    missions: [
      { id: 'rs-1', name: 'جسر الرستن', template: 'column', params: { lanes: ['m5_s', 'bank', 'bank_r'], groups: 4, mix: ['t72', 'bmp1', 'ural', 'technical', 't55'], maxEscapes: 3 },
        brief: 'تعزيزات تعبر الجسر تحت المطر. أوقفها قبل أن تثبّت خط الدفاع جنوب النهر.' },
      { id: 'rs-2', name: 'حامية الجسر', template: 'assault', params: { targets: ['bridge_n', 'cp1', 'tank1', 'bunker1', 'aa1'], kinds: ['bunker', 'checkpoint', 't72', 'bunker', 'zu23'], reinf: ['bank_r', 'm5_s'], squads: ['town', 'bridge_n'] },
        brief: 'التحصينات على ضفة العاصي الشمالية تمنع العبور. اسحقها.' },
      { id: 'rs-3', name: 'عبور العاصي', template: 'escort', params: { lane: 'm5_n', friendlies: ['f_bmp', 'f_technical', 'f_tank', 'f_technical', 'f_technical'], need: 3, ambush: [['tank1', 't72'], ['atgm1', 'atgm'], ['cp1', 'checkpoint'], ['aa1', 'zu23']] },
        brief: 'رتلنا يعبر الجسر شمالاً نحو المدينة. غطِّ تقدّمه.' },
    ],
  },
  {
    id: 'talbiseh', name: 'تلبيسة', area: 'ريف حمص الشمالي', date: '6 كانون الأول 2024',
    intro: 'تلبيسة على الطريق الدولي، صوامع الحبوب العملاقة تشرف على السهل الأحمر. الميليشيات الإيرانية تتحصن في المزارع.',
    env: { time: 'dusk', weather: 'clear', north: 0 },
    layout: {
      terrain: { amp: 7, freq: 1 / 1500, seed: 7171, rock: 0.1, soil: 'red', mountains: [{ x: -3800, z: -4500, r: 2000, h: 180 }] },
      roads: [
        { id: 'm5', w: 18, type: 'highway', pts: R([[1250, -4100], [950, -2600], [820, -1500], [720, -600], [620, 500]]) },
        { id: 'loc', w: 8, type: 'road', pts: R([[-2600, -1300], [-1100, -1360], [0, -1420], [820, -1500], [2200, -1700], [3300, -1650]]) },
        { id: 'farm', w: 5, type: 'track', pts: R([[-1800, -2600], [-1100, -2000], [-600, -1400], [-400, -700]]) },
      ],
      villages: [{ x: -350, z: -2050, r: 520, n: 85, style: 'town', damage: 0.35, mosque: true }, { x: 2100, z: -2300, r: 220, n: 16, style: 'village', damage: 0.2 }],
      groves: [{ x: -1400, z: -800, w: 700, d: 400, rot: 0 }, { x: 1700, z: -900, w: 600, d: 300, rot: 0.1 }, { x: -2000, z: -2000, w: 500, d: 400, rot: 0.3 }],
      landmarks: [{ type: 'silos', x: 640, z: -1720 }],
      lanes: { m5_s: { road: 'm5', to: 0.8 }, m5_n: { road: 'm5', reverse: true, from: 0.2 }, local: { road: 'loc' }, local_r: { road: 'loc', reverse: true }, farm: { road: 'farm', to: 0.75 } },
      anchors: { silos: [560, -1650], cp1: [780, -1300], cp2: [0, -1520], town: [-300, -1900], aa1: [-900, -2300], depot: [-600, -2250], tank1: [300, -1750], bunker1: [-1100, -1500], atgm1: [1300, -1400], farm1: [-1300, -2050] },
      player: { h: 5 },
    },
    missions: [
      { id: 'tb-1', name: 'صوامع تلبيسة', template: 'assault', params: { targets: ['silos', 'cp1', 'cp2', 'tank1', 'atgm1'], kinds: ['bunker', 'checkpoint', 'checkpoint', 't72', 'atgm'], reinf: ['m5_s', 'local'], squads: ['town', 'silos'] },
        brief: 'قنّاصة ورشاشات على الصوامع وحواجز الطريق. نظّف المحور قبل حلول الظلام.' },
      { id: 'tb-2', name: 'الطريق الدولي', template: 'column', params: { lanes: ['m5_s', 'm5_n', 'local_r'], groups: 4, mix: ['t72', 'bmp2', 'technical', 'zu23', 'grad'], maxEscapes: 3 },
        brief: 'الطريق الدولي M5 يعج بأرتال تحاول الوصول إلى حمص.' },
      { id: 'tb-3', name: 'كمين الميليشيات', template: 'militia', params: { lanes: ['farm', 'local', 'local_r', 'm5_s'], waves: 4, statics: [['farm1', 'atgm'], ['bunker1', 'bunker']] },
        brief: 'الميليشيات الإيرانية تشن هجوماً معاكساً بسيارات الدوشكا ومسيّرات انتحارية. اصمد.' },
    ],
  },
  {
    id: 'termaala', name: 'تيرمعلة', area: 'بوابة حمص الشمالية', date: '7 كانون الأول 2024',
    intro: 'تيرمعلة آخر قرية قبل حمص. ليلة حاسمة، وأضواء المدينة تتلألأ جنوباً.',
    env: { time: 'night', weather: 'clear', north: 180 },
    layout: {
      terrain: { amp: 9, freq: 1 / 1200, seed: 8888, rock: 0.2, soil: 'red', mountains: [] },
      roads: [
        { id: 'm5', w: 18, type: 'highway', pts: R([[1600, -4100], [1250, -2500], [1050, -1300], [950, 0], [850, 1000]]) },
        { id: 'vil', w: 7, type: 'road', pts: R([[-2400, -1900], [-900, -1600], [200, -1500], [1050, -1300]]) },
        { id: 'trk', w: 5, type: 'track', pts: R([[200, -1500], [100, -900], [-200, -500]]) },
      ],
      villages: [{ x: 180, z: -1550, r: 380, n: 55, style: 'village', damage: 0.3, mosque: true }, { x: -1600, z: -2300, r: 260, n: 22, style: 'village', damage: 0.2, mosque: true }],
      groves: [{ x: -700, z: -800, w: 700, d: 400, rot: 0 }, { x: 600, z: -800, w: 400, d: 300, rot: 0.1 }, { x: -1200, z: -1300, w: 500, d: 300, rot: 0 }],
      landmarks: [{ type: 'cityLights', x: 0, z: -5600, w: 7000 }],
      lanes: { m5_s: { road: 'm5' }, m5_n: { road: 'm5', reverse: true }, vil: { road: 'vil' }, vil_r: { road: 'vil', reverse: true }, trk: { road: 'trk' } },
      anchors: { vil: [180, -1500], cp1: [950, -1250], cp2: [-200, -1350], tank1: [500, -1700], bunker1: [-500, -1600], aa1: [100, -1950], depot: [-300, -1800], atgm1: [700, -1150], farm1: [-1600, -2200] },
      player: { h: 5 },
    },
    missions: [
      { id: 'tm-1', name: 'ليلة تيرمعلة', template: 'assault', params: { targets: ['cp1', 'cp2', 'tank1', 'bunker1', 'atgm1'], kinds: ['checkpoint', 'checkpoint', 't72', 'bunker', 'atgm'], reinf: ['vil', 'm5_n'], squads: ['vil', 'cp2'] },
        brief: 'تحت جنح الظلام، اكشف تحصينات القرية بالمنظار الحراري ودمّرها.' },
      { id: 'tm-2', name: 'الحزام الأخير', template: 'hvt', params: { lane: 'vil_r', boss: 't90', escorts: ['t72', 'technical', 'bmp2', 'technical'], time: 160, statics: [['aa1', 'shilka']] },
        brief: 'قائد ميليشيا يحاول سحب دبابته القيادية نحو حمص. اقطع عليه الطريق.' },
      { id: 'tm-3', name: 'فجر حمص', template: 'militia', env: { time: 'dawn' }, params: { lanes: ['m5_n', 'vil', 'trk', 'vil_r'], waves: 4, statics: [['depot', 'depot'], ['farm1', 'atgm']] },
        brief: 'هجوم معاكس أخير للميليشيات مع شروق الشمس. أمسِك الأرض.' },
    ],
  },
  {
    id: 'homs', name: 'حمص', area: 'عاصمة الثورة', date: '7 - 8 كانون الأول 2024',
    intro: 'حمص، عاصمة الثورة. مآذن جامع خالد بن الوليد وبرج الساعة يعودان إلى أهلهما.',
    env: { time: 'dawn', weather: 'haze', north: 180 },
    layout: {
      terrain: { amp: 6, freq: 1 / 1500, seed: 9393, rock: 0.1, soil: 'pale', mountains: [{ x: 3800, z: -5200, r: 2000, h: 220 }] },
      roads: [
        { id: 'hama', w: 14, type: 'road', pts: R([[-250, -4100], [-120, -2500], [0, -1250], [100, -300]]) },
        { id: 'ring', w: 16, type: 'highway', pts: R([[-3300, -1150], [-1200, -1050], [0, -1100], [1500, -1200], [3300, -1300]]) },
      ],
      villages: [{ x: 0, z: -2900, r: 1300, n: 240, style: 'city', damage: 0.35, mosque: false }],
      groves: [{ x: -1200, z: -500, w: 600, d: 300, rot: 0 }, { x: 1300, z: -600, w: 500, d: 300, rot: 0.2 }],
      landmarks: [{ type: 'khalidMosque', x: -420, z: -1750 }, { type: 'clockTower', x: 350, z: -2050 }],
      lanes: { hama_s: { road: 'hama', to: 0.6 }, ring: { road: 'ring' }, ring_r: { road: 'ring', reverse: true } },
      anchors: { cp1: [-80, -1300], cp2: [400, -1250], tank1: [-800, -1300], bunker1: [700, -1700], aa1: [-1200, -1900], buk: [1300, -1900], depot: [900, -2200], atgm1: [-300, -2000], city: [0, -2300] },
      player: { h: 8 },
    },
    missions: [
      { id: 'hs-1', name: 'شارع حماة', template: 'assault', params: { targets: ['cp1', 'cp2', 'tank1', 'bunker1', 'atgm1'], kinds: ['checkpoint', 'checkpoint', 't72', 'bunker', 'atgm'], reinf: ['hama_s', 'ring_r'], squads: ['city', 'cp1'] },
        brief: 'المدخل الشمالي للمدينة. دمّر الحواجز لتبدأ الأحياء بالتحرر.' },
      { id: 'hs-2', name: 'سماء حمص', template: 'airdef', params: { targets: ['aa1', 'buk', 'bunker1'], kinds: ['shilka', 'buk', 'bunker'], helis: 3, time: 150 },
        brief: 'الطيران يحاول وقف التقدم. دمّر الدفاعات الجوية وأسقط المروحيات.' },
      { id: 'hs-3', name: 'الانهيار', template: 'column', params: { lanes: ['ring', 'ring_r', 'hama_s'], groups: 5, mix: ['t72', 't72', 'bmp2', 'ural', 'technical', 'grad'], maxEscapes: 4 },
        brief: 'قوات النظام تنهار وتنسحب نحو دمشق. لا تسمح للدروع بالفرار.' },
    ],
  },
  {
    id: 'damascus', name: 'دمشق', area: 'أقدم عاصمة مأهولة', date: '8 كانون الأول 2024',
    intro: 'فجر الثامن من كانون الأول. جبل قاسيون يطل على دمشق. المعركة الأخيرة.',
    env: { time: 'dawn', weather: 'clear', north: 180 },
    layout: {
      terrain: { amp: 10, freq: 1 / 1300, seed: 1208, rock: 0.3, soil: 'pale', mountains: [{ x: 1200, z: -4600, r: 1500, h: 520, ridge: true, elong: 2.6 }] },
      roads: [
        { id: 'm5', w: 18, type: 'highway', pts: R([[-1600, -3800], [-900, -2600], [-300, -1500], [200, -700], [500, 200]]) },
        { id: 'ring', w: 12, type: 'road', pts: R([[-3300, -1600], [-1500, -1500], [-300, -1500], [1200, -1600], [3300, -1500]]) },
      ],
      villages: [{ x: 400, z: -2700, r: 1300, n: 240, style: 'city', damage: 0.15, mosque: true }, { x: -1900, z: -900, r: 300, n: 26, style: 'village', damage: 0.3 }],
      groves: [{ x: -900, z: -500, w: 600, d: 300, rot: 0 }, { x: 1300, z: -700, w: 600, d: 300, rot: 0.2 }],
      landmarks: [{ type: 'qasioun', x: 1200, z: -4300 }, { type: 'cityLights', x: 400, z: -3500, w: 3600, on: 'mountain' }],
      lanes: { m5_s: { road: 'm5', to: 0.7 }, m5_n: { road: 'm5', reverse: true, from: 0.25 }, ring: { road: 'ring' }, ring_r: { road: 'ring', reverse: true } },
      anchors: { cp1: [-280, -1600], cp2: [300, -1450], tank1: [-900, -1700], bunker1: [800, -1800], aa1: [-400, -2300], buk: [1300, -2100], depot: [600, -2300], atgm1: [-1300, -1400], city: [400, -2300] },
      player: { h: 7 },
    },
    missions: [
      { id: 'dm-1', name: 'مداخل دمشق', template: 'assault', params: { targets: ['cp1', 'cp2', 'tank1', 'bunker1', 'atgm1'], kinds: ['checkpoint', 'checkpoint', 't72', 'bunker', 'atgm'], reinf: ['m5_s', 'ring'], squads: ['city', 'cp1'] },
        brief: 'آخر حواجز الفرقة الرابعة على مداخل العاصمة.' },
      { id: 'dm-2', name: 'ظل قاسيون', template: 'airdef', params: { targets: ['buk', 'aa1', 'depot'], kinds: ['buk', 'shilka', 'depot'], helis: 4, time: 160 },
        brief: 'المطارات العسكرية حول دمشق ترسل آخر طائراتها. أسقطها ودمّر الدفاعات.' },
      { id: 'dm-3', name: 'فجر التحرير', template: 'final', params: { lanes: ['m5_s', 'ring', 'ring_r'], statics: [['cp1', 'checkpoint'], ['tank1', 't90'], ['aa1', 'shilka'], ['depot', 'depot']] },
        brief: 'المعركة الأخيرة قبل سقوط النظام. كل ما تبقّى يُرمى في المعركة. أنهِها.' },
    ],
  },
];

export function findMission(id) {
  for (let ri = 0; ri < REGIONS.length; ri++) {
    const r = REGIONS[ri];
    for (let mi = 0; mi < r.missions.length; mi++) {
      if (r.missions[mi].id === id) return { region: r, mission: r.missions[mi], ri, mi };
    }
  }
  return null;
}

export function nextMission(id) {
  const f = findMission(id);
  if (!f) return null;
  if (f.mi < f.region.missions.length - 1) return f.region.missions[f.mi + 1].id;
  if (f.ri < REGIONS.length - 1) return REGIONS[f.ri + 1].missions[0].id;
  return null;
}
