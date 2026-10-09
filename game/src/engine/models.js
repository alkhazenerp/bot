// نماذج إجرائية للآليات والطائرات والأفراد — تُدمج حسب المادة لتقليل نداءات الرسم
import * as THREE from 'three';
import { camoTexture, trackTexture, rotorDiscTexture, flagTexture } from './textures.js';
import { mulberry32 } from '../core/util.js';

export const HEAT = {
  camo: 0.5, engine: 0.92, dark: 0.55, rubber: 0.6, track: 0.68, glass: 0.32, red: 0.9, white: 0.45, canvas: 0.42,
  wood: 0.35, concrete: 0.3, sandbag: 0.3, skin: 0.88, cloth: 0.7, cloth2: 0.7, metal: 0.5, missile: 0.6, exhaust: 1,
  gold: 0.5, rotor: 0.4, hot: 1, flag: 0.4, black: 0.5, fabric: 0.55,
};

const PALETTES = {
  regime: ['#5d6140', '#3e4229', '#7a7451', '#2a2b1d'],
  desert: ['#a28b60', '#7c6947', '#c2ab7d', '#5a4a33'],
  ru_air: ['#8d989e', '#76838a', '#a3adb1', '#69767c'],
  ru_heli: ['#7b7550', '#59573a', '#9a8f68', '#3e3c2a'],
  friend: ['#6a6845', '#4c4b32', '#8b8456', '#3a2f22'],
  olive: ['#5b6145', '#4a503a', '#6c7152'],
  white: ['#d8d5cd', '#cfcac0', '#e2ded6'],
  tan: ['#b9a27a', '#a8916a', '#c8b38c'],
  grey: ['#7c8084', '#686c70', '#8e9296'],
  urban: ['#7c8084', '#686c70', '#8e9296', '#55595c'],
  night: ['#2c2f30', '#222526', '#373a3b'],
  gold: ['#c99a2e', '#a77c1f', '#e2b64a'],
  iran: ['#8c8a6c', '#6b6a52', '#a6a184'],
};

const matCache = new Map();
export function getMat(key, palette = 'regime') {
  const k = `${key}|${palette}`;
  if (matCache.has(k)) return matCache.get(k);
  let m;
  switch (key) {
    case 'camo': m = new THREE.MeshStandardMaterial({ map: camoTexture(PALETTES[palette] || PALETTES.regime, palette.length * 7 + 3), roughness: 0.82, metalness: 0.18 }); break;
    case 'engine': m = getMat('camo', palette).clone(); break;
    case 'dark': m = new THREE.MeshStandardMaterial({ color: 0x2e2e2a, roughness: 0.7, metalness: 0.45 }); break;
    case 'metal': m = new THREE.MeshStandardMaterial({ color: 0x6f7173, roughness: 0.45, metalness: 0.7 }); break;
    case 'rubber': m = new THREE.MeshStandardMaterial({ color: 0x171716, roughness: 1, metalness: 0 }); break;
    case 'track': { const t = trackTexture().clone(); t.needsUpdate = true; m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0.3 }); break; }
    case 'glass': m = new THREE.MeshStandardMaterial({ color: 0x1a252c, roughness: 0.05, metalness: 0.95, envMapIntensity: 1.6 }); break;
    case 'red': m = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.15, 0.1) }); break;
    case 'hot': m = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.6) }); break;
    case 'white': m = new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.5, metalness: 0.1 }); break;
    case 'black': m = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }); break;
    case 'canvas': m = new THREE.MeshStandardMaterial({ color: 0x5e5d3f, roughness: 1 }); break;
    case 'wood': m = new THREE.MeshStandardMaterial({ color: 0x6d5236, roughness: 1 }); break;
    case 'concrete': m = new THREE.MeshStandardMaterial({ color: 0xa39e93, roughness: 0.95 }); break;
    case 'sandbag': m = new THREE.MeshStandardMaterial({ color: 0xa48f6b, roughness: 1 }); break;
    case 'skin': m = new THREE.MeshStandardMaterial({ color: 0xb08262, roughness: 0.8 }); break;
    case 'cloth': m = new THREE.MeshStandardMaterial({ map: camoTexture(PALETTES[palette] || PALETTES.olive, 77), roughness: 1 }); break;
    case 'cloth2': m = new THREE.MeshStandardMaterial({ color: palette === 'iran' ? 0x2b2a26 : palette === 'friend' ? 0x3d3a30 : 0x4d5135, roughness: 1 }); break;
    case 'fabric': m = new THREE.MeshStandardMaterial({ color: palette === 'friend' ? 0xd8d2c0 : 0xb5a77e, roughness: 1 }); break;
    case 'missile': m = new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.5, metalness: 0.3 }); break;
    case 'gold': m = new THREE.MeshStandardMaterial({ color: 0xd4a536, roughness: 0.3, metalness: 0.9 }); break;
    case 'exhaust': m = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.2, 0.8), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }); break;
    case 'rotor': m = new THREE.MeshBasicMaterial({ map: rotorDiscTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide }); break;
    default: m = new THREE.MeshStandardMaterial({ color: 0x888888 });
  }
  m.userData.heat = HEAT[key] ?? 0.5;
  m.userData.key = key;
  matCache.set(k, m);
  return m;
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _mx = new THREE.Matrix4();

// باني جزء: يجمع أشكالاً بدائية ويدمجها حسب المادة مع UV مُسقَط
class Part {
  constructor(palette) { this.palette = palette; this.items = new Map(); }
  add(geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _mx.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(_mx);
    if (!this.items.has(key)) this.items.set(key, []);
    this.items.get(key).push(g);
    return this;
  }
  box(w, h, d, key, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), key, x, y, z, rx, ry, rz); }
  cylX(r, len, key, x, y, z, seg = 12) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); return this.add(g, key, x, y, z); }
  cylZ(rt, rb, len, key, x, y, z, seg = 12, rx = 0, ry = 0) { const g = new THREE.CylinderGeometry(rt, rb, len, seg); g.rotateX(Math.PI / 2); return this.add(g, key, x, y, z, rx, ry); }
  cylY(rt, rb, h, key, x, y, z, seg = 12) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), key, x, y, z); }

  build(name = '') {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, list] of this.items) {
      let n = 0;
      for (const g of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      for (const g of list) {
        const p = g.attributes.position.array, nn = g.attributes.normal.array;
        const guv = g.attributes.uv ? g.attributes.uv.array : null;
        const cnt = g.attributes.position.count;
        pos.set(p, o * 3); nor.set(nn, o * 3);
        for (let i = 0; i < cnt; i++) {
          const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
          const ax = Math.abs(nn[i * 3]), ay = Math.abs(nn[i * 3 + 1]), az = Math.abs(nn[i * 3 + 2]);
          let u, v;
          if (key === 'track') { u = y * 0.6; v = z * 0.5; }
          else if (key === 'rotor' || key === 'flag') { u = guv ? guv[i * 2] : 0; v = guv ? guv[i * 2 + 1] : 0; }
          else if (ay >= ax && ay >= az) { u = x / 2.6; v = z / 2.6; }
          else if (ax >= az) { u = z / 2.6; v = y / 2.6; }
          else { u = x / 2.6; v = y / 2.6; }
          uv[(o + i) * 2] = u; uv[(o + i) * 2 + 1] = v;
        }
        o += cnt;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mat = key === 'flag' ? new THREE.MeshStandardMaterial({ map: flagTexture(this.palette === 'friend' ? 'revolution' : this.palette === 'iran' ? 'militia' : 'regime'), side: THREE.DoubleSide, roughness: 0.9 }) : getMat(key, this.palette);
      if (key === 'flag') mat.userData.heat = HEAT.flag;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !['exhaust', 'rotor', 'red', 'hot'].includes(key);
      mesh.receiveShadow = key !== 'rotor' && key !== 'exhaust';
      mesh.userData.heat = mat.userData.heat;
      mesh.userData.matKey = key;
      if (key === 'rotor') mesh.renderOrder = 2;
      group.add(mesh);
    }
    return group;
  }
}

function pivot(name, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return o;
}

function extrudeSide(points, width) {
  // مضلع جانبي (z,y) يُبثق عرضياً
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

function addTracks(P, { len, w, trackW = 0.6, wheels = 6, r = 0.38, y = 0, skirts = true }) {
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - trackW / 2);
    P.box(trackW, 0.18, len, 'track', x, y + 0.09, 0);
    P.box(trackW, 0.18, len - 0.5, 'track', x, y + r * 2 + 0.12, 0);
    P.cylX(r * 0.95, trackW * 0.9, 'track', x, y + r + 0.05, len / 2 - 0.35, 14);
    P.cylX(r * 0.9, trackW * 0.9, 'track', x, y + r + 0.08, -len / 2 + 0.35, 14);
    for (let i = 0; i < wheels; i++) {
      const z = -len / 2 + 0.9 + (i * (len - 1.8)) / (wheels - 1);
      P.cylX(r, trackW * 0.7, 'dark', x, y + r + 0.04, z, 14);
      P.cylX(r * 0.45, trackW * 0.74, 'camo', x, y + r + 0.04, z, 10);
    }
    if (skirts) P.box(0.06, 0.55, len - 0.4, 'rubber', s * (w / 2 + 0.02), y + r * 2 + 0.35, 0);
  }
}

function addWheels(P, axles, halfW, r, y) {
  for (const z of axles) for (const s of [-1, 1]) {
    P.cylX(r, 0.32, 'rubber', s * halfW, y + r, z, 14);
    P.cylX(r * 0.55, 0.34, 'dark', s * halfW, y + r, z, 10);
  }
}

// ===================== الدبابات =====================
function tankModel({ palette = 'regime', kind = 't72' }) {
  const root = new THREE.Group();
  const H = new Part(palette);
  const is55 = kind === 't55' || kind === 'f_t55';
  const is90 = kind === 't90';
  const len = is55 ? 6.2 : 6.8, w = is55 ? 3.27 : 3.5;
  addTracks(H, { len: len - 0.4, w, wheels: is55 ? 5 : 6, r: is55 ? 0.41 : 0.37, skirts: !is55 });
  // الهيكل العلوي بمقطع جانبي منحدر
  H.add(extrudeSide([[-len / 2, 0.48], [-len / 2, 1.45], [len / 2 - 1.6, 1.55], [len / 2, 0.98], [len / 2 - 0.4, 0.48]], w - 1.25), 'camo');
  H.box(w - 0.1, 0.08, len - 0.8, 'camo', 0, 1.38, -0.2);
  // سطح المحرك الحار
  H.box(w - 1.5, 0.12, 1.9, 'engine', 0, 1.5, -len / 2 + 1.1);
  for (let i = 0; i < 5; i++) H.box(w - 1.6, 0.03, 0.08, 'dark', 0, 1.57, -len / 2 + 0.4 + i * 0.32);
  // براميل الوقود الخلفية
  if (!is90) for (const s of [-0.6, 0.6]) H.cylX(0.3, 0.9, 'dark', s, 1.35, -len / 2 - 0.25, 12);
  // صناديق على الرفارف
  for (let i = 0; i < 3; i++) H.box(0.5, 0.35, 0.9, 'camo', w / 2 - 0.3, 1.55, -1.6 + i * 1.0);
  H.box(0.5, 0.3, 1.6, 'camo', -w / 2 + 0.3, 1.52, -1.0);
  // دروع تفاعلية على المقدمة
  if (!is55) for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) H.box(0.44, 0.08, 0.32, 'camo', -1.1 + c * 0.44, 1.32 - r * 0.22, len / 2 - 0.85 + r * 0.36, -0.55);
  // مصابيح
  for (const s of [-1, 1]) H.cylZ(0.09, 0.09, 0.1, 'white', s * 1.3, 1.25, len / 2 - 0.55, 8);
  const hull = H.build('hull');
  root.add(hull);

  // البرج
  const turret = pivot('turret', 0, is55 ? 1.5 : 1.55, is55 ? 0.6 : 0.2);
  const T = new Part(palette);
  if (is90) {
    const sh = new THREE.Shape([[-1.15, -1.3], [1.15, -1.3], [1.35, 0.2], [0.9, 1.25], [-0.9, 1.25], [-1.35, 0.2]].map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.62, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.06, bevelSegments: 1 });
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.62, 0);
    T.add(g, 'camo', 0, 0, 0);
    // دروع كونتاكت-5 على شكل إسفين
    for (const s of [-1, 1]) T.box(0.75, 0.5, 0.7, 'camo', s * 0.8, 0.38, 1.25, 0, s * 0.35, 0);
    // شتورا: العينان الحمراوان
    for (const s of [-1, 1]) {
      T.box(0.42, 0.34, 0.38, 'dark', s * 0.55, 0.55, 1.4);
      T.cylZ(0.11, 0.11, 0.06, 'red', s * 0.55, 0.55, 1.6, 12);
    }
  } else {
    const dome = new THREE.SphereGeometry(is55 ? 1.12 : 1.18, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    T.add(dome, 'camo', 0, 0, 0, 0, 0, 0, 1, is55 ? 0.62 : 0.55, 1.12);
    T.cylY(is55 ? 1.12 : 1.18, is55 ? 1.12 : 1.18, 0.14, 'camo', 0, 0.02, 0, 22);
    if (!is55) {
      // كونتاكت-1 على شكل V
      for (const s of [-1, 1]) for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        T.box(0.3, 0.2, 0.08, 'camo', s * (0.45 + c * 0.28), 0.35 + r * 0.2, 1.05 - c * 0.18, -0.3, s * 0.55, 0);
      }
    }
  }
  // قبة القائد ورشاشه
  T.cylY(0.36, 0.38, 0.28, 'camo', 0.5, 0.68, -0.25, 12);
  T.cylZ(0.025, 0.03, 1.1, 'dark', 0.55, 0.92, 0.2, 8);
  T.box(0.14, 0.14, 0.3, 'dark', 0.55, 0.9, -0.15);
  // المنظار والكشاف
  T.box(0.3, 0.32, 0.35, 'camo', -0.55, 0.72, 0.35);
  T.box(0.36, 0.36, 0.2, 'dark', -0.62, 0.45, 1.15);
  T.cylZ(0.15, 0.15, 0.06, 'glass', -0.62, 0.45, 1.27, 12);
  // أنبوب الغطس الخلفي
  T.cylX(0.1, 1.7, 'camo', 0, 0.42, -1.3, 8);
  // سلة البرج
  T.box(1.8, 0.4, 0.4, 'camo', 0, 0.3, -1.4);
  const tGroup = T.build('turretMesh');
  turret.add(tGroup);

  // المدفع
  const gun = pivot('gun', 0, is55 ? 0.42 : 0.38, is55 ? 1.05 : 1.15);
  const Gp = new Part(palette);
  const gl = is55 ? 5.2 : 5.8;
  Gp.box(0.7, 0.42, 0.45, 'camo', 0, 0, 0.05);
  Gp.cylZ(0.075, 0.115, gl, 'camo', 0, 0, gl / 2 + 0.2, 12);
  Gp.cylZ(0.135, 0.135, 0.9, 'camo', 0, 0, is55 ? gl - 0.4 : gl * 0.42, 12);
  Gp.cylZ(0.11, 0.11, 0.25, 'dark', 0, 0, gl + 0.15, 10);
  gun.add(Gp.build('gunMesh'));
  const muzzle = pivot('muzzle', 0, 0, gl + 0.35);
  gun.add(muzzle);
  turret.add(gun);
  root.add(turret);

  const exhaust = pivot('exhaust', w / 2 - 0.2, 1.0, -len / 2 + 0.8);
  root.add(exhaust);

  return {
    root, hitboxes: [
      { name: 'hull', min: [-w / 2, 0.2, -len / 2], max: [w / 2, 1.55, len / 2] },
      { name: 'turret', min: [-1.3, 1.5, -1.6], max: [1.3, 2.35, 1.6] },
    ],
    height: 2.4, length: len, width: w, tracked: true,
  };
}

// ===================== مدرعات BMP =====================
function bmpModel({ palette = 'regime', kind = 'bmp1' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  const len = 6.7, w = 2.95;
  addTracks(P, { len: len - 0.6, w, wheels: 6, r: 0.33, skirts: false });
  P.add(extrudeSide([[-len / 2, 0.45], [-len / 2, 1.62], [0.9, 1.68], [len / 2, 0.95], [len / 2 - 0.35, 0.45]], w - 0.9), 'camo');
  P.box(w + 0.05, 0.06, len - 1.6, 'camo', 0, 1.15, -0.6);
  // أضلاع المقدمة
  for (let i = 0; i < 6; i++) P.box(w - 1.0, 0.04, 0.05, 'camo', 0, 1.62 - i * 0.12, 1.3 + i * 0.32, -0.36);
  // كوى الرمي والأبواب الخلفية
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) P.cylX(0.07, 0.06, 'dark', s * (w / 2 - 0.44), 1.42, -2.2 + i * 0.6, 8);
  for (const s of [-0.45, 0.45]) P.box(0.7, 0.9, 0.08, 'camo', s, 1.0, -len / 2 - 0.02);
  for (let i = 0; i < 4; i++) P.box(0.55, 0.06, 0.6, 'camo', (i % 2 ? 0.4 : -0.4), 1.7, -1.8 + Math.floor(i / 2) * 0.8);
  P.box(1.0, 0.1, 1.0, 'engine', 0.6, 1.68, 1.4, -0.36);
  root.add(P.build('hull'));
  const turret = pivot('turret', 0, 1.7, -0.1);
  const T = new Part(palette);
  const is2 = kind === 'bmp2' || kind === 'f_bmp';
  T.cylY(is2 ? 0.75 : 0.55, is2 ? 0.95 : 0.85, is2 ? 0.55 : 0.45, 'camo', 0, 0.25, 0, 14);
  T.box(0.3, 0.25, 0.35, 'dark', -0.4, 0.55, 0.2);
  if (is2) {
    T.cylZ(0.14, 0.14, 0.9, 'camo', 0.55, 0.62, -0.2, 10);
  } else {
    T.box(0.08, 0.06, 0.8, 'dark', 0, 0.62, 0.3);
    T.cylZ(0.065, 0.065, 0.55, 'camo', 0, 0.75, 0.35, 8);
  }
  turret.add(T.build('turretMesh'));
  const gun = pivot('gun', 0, 0.3, 0.6);
  const Gp = new Part(palette);
  const gl = is2 ? 3.0 : 2.1;
  Gp.cylZ(is2 ? 0.035 : 0.06, is2 ? 0.06 : 0.09, gl, 'dark', 0, 0, gl / 2, 10);
  Gp.box(0.35, 0.3, 0.3, 'camo', 0, 0, 0);
  gun.add(Gp.build('gunMesh'));
  gun.add(pivot('muzzle', 0, 0, gl + 0.1));
  turret.add(gun);
  root.add(turret);
  if (palette === 'friend') addFlag(root, 0.9, 1.7, -2.6);
  root.add(pivot('exhaust', w / 2 - 0.2, 1.1, 1.5));
  return {
    root, hitboxes: [{ name: 'hull', min: [-w / 2, 0.2, -len / 2], max: [w / 2, 1.7, len / 2] }, { name: 'turret', min: [-0.9, 1.6, -0.9], max: [0.9, 2.3, 0.9] }],
    height: 2.2, length: len, width: w, tracked: true,
  };
}

function shilkaModel({ palette = 'regime' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  const len = 6.5, w = 3.1;
  addTracks(P, { len: len - 0.4, w, wheels: 6, r: 0.36, skirts: false });
  P.add(extrudeSide([[-len / 2, 0.45], [-len / 2, 1.4], [len / 2 - 0.9, 1.45], [len / 2, 0.9], [len / 2 - 0.3, 0.45]], w - 1), 'camo');
  P.box(w, 0.06, len - 0.8, 'camo', 0, 1.1, 0);
  P.box(1.4, 0.1, 1.4, 'engine', 0, 1.45, -2.2);
  root.add(P.build('hull'));
  const turret = pivot('turret', 0, 1.45, 0.3);
  const T = new Part(palette);
  T.box(2.6, 1.05, 2.6, 'camo', 0, 0.52, 0);
  T.box(2.4, 0.25, 2.2, 'camo', 0, 1.15, -0.1);
  // رادار
  T.cylY(0.12, 0.12, 0.6, 'dark', 0, 1.5, -0.9, 8);
  T.add(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 16), 'dark', 0, 1.9, -0.9, Math.PI / 2, 0, 0);
  turret.add(T.build('turretMesh'));
  const gun = pivot('gun', 0, 0.6, 1.3);
  const Gp = new Part(palette);
  for (const [x, y] of [[-0.25, 0.15], [0.25, 0.15], [-0.25, -0.15], [0.25, -0.15]]) Gp.cylZ(0.03, 0.04, 2.3, 'dark', x, y, 1.15, 8);
  Gp.box(0.9, 0.6, 0.4, 'camo', 0, 0, 0);
  gun.add(Gp.build('gunMesh'));
  gun.add(pivot('muzzle', 0, 0, 2.4));
  turret.add(gun);
  root.add(turret);
  root.add(pivot('exhaust', 1.2, 1.1, -2.6));
  return { root, hitboxes: [{ name: 'hull', min: [-w / 2, 0.2, -len / 2], max: [w / 2, 1.5, len / 2] }, { name: 'turret', min: [-1.4, 1.4, -1.1], max: [1.4, 2.8, 1.7] }], height: 3.2, length: len, width: w, tracked: true };
}

// ===================== الشاحنات =====================
function truckModel({ palette = 'regime', kind = 'ural' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  const len = 7.4, w = 2.5;
  addWheels(P, [2.6, -1.2, -2.6], 1.0, 0.55, 0);
  P.box(1.0, 0.35, len, 'dark', 0, 1.05, 0);
  // المقصورة والمحرك
  P.box(2.3, 1.1, 1.7, 'camo', 0, 1.6, 2.7);
  P.box(2.4, 1.3, 1.4, 'camo', 0, 2.2, 1.35);
  P.box(2.1, 0.5, 0.05, 'glass', 0, 2.55, 2.06);
  for (const s of [-1, 1]) P.box(0.05, 0.5, 0.8, 'glass', s * 1.21, 2.5, 1.4);
  P.box(2.3, 0.25, 0.2, 'dark', 0, 1.15, 3.6);
  for (const s of [-1, 1]) P.box(0.5, 0.15, 0.9, 'camo', s * 1.0, 1.5, 2.8);
  const atk = kind === 'zu23' ? 'zu' : kind === 'grad' ? 'grad' : 'cargo';
  if (atk === 'cargo') {
    P.box(2.45, 0.6, 4.4, 'camo', 0, 1.55, -1.45);
    const arch = new THREE.CylinderGeometry(1.22, 1.22, 4.3, 14, 1, true, -Math.PI / 2, Math.PI);
    arch.rotateX(Math.PI / 2);
    P.add(arch, 'canvas', 0, 2.15, -1.45, 0, 0, 0, 1, 0.7, 1);
    P.box(2.44, 0.7, 4.3, 'canvas', 0, 2.2, -1.45);
  } else {
    P.box(2.45, 0.25, 4.4, 'camo', 0, 1.35, -1.45);
    for (const s of [-1, 1]) P.box(0.06, 0.4, 4.4, 'camo', s * 1.2, 1.6, -1.45);
  }
  if (palette === 'friend') addFlag(root, -0.9, 2.9, 1.0);
  root.add(P.build('hull'));
  const turret = pivot('turret', 0, 1.5, -1.6);
  const gun = pivot('gun', 0, 0.75, 0);
  const T = new Part(palette);
  const Gp = new Part(palette);
  if (atk === 'zu') {
    T.cylY(0.6, 0.7, 0.4, 'camo', 0, 0.2, 0, 10);
    T.box(0.5, 0.6, 0.5, 'dark', -0.7, 0.6, -0.4);
    for (const s of [-0.2, 0.2]) Gp.cylZ(0.035, 0.045, 2.6, 'dark', s, 0, 1.3, 8);
    Gp.box(0.8, 0.5, 0.9, 'camo', 0, 0, 0);
    gun.position.y = 0.9;
  } else if (atk === 'grad') {
    T.box(1.2, 0.4, 1.2, 'camo', 0, 0.2, 0);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) Gp.cylZ(0.062, 0.062, 3.0, 'camo', -0.72 + c * 0.16, -0.24 + r * 0.16, 0.0, 8);
    Gp.box(1.7, 0.75, 0.15, 'camo', 0, 0, -1.5);
    gun.position.set(0, 0.8, -0.2);
    gun.rotation.x = -0.35;
  }
  turret.add(T.build('turretMesh'));
  gun.add(Gp.build('gunMesh'));
  gun.add(pivot('muzzle', 0, 0, atk === 'grad' ? 1.6 : 2.7));
  turret.add(gun);
  root.add(turret);
  root.add(pivot('exhaust', 1.25, 2.6, 0.7));
  return { root, hitboxes: [{ name: 'hull', min: [-w / 2, 0.3, -len / 2], max: [w / 2, 3.0, len / 2] }], height: 3.0, length: len, width: w, wheeled: true };
}

// سيارة دفع رباعي بدوشكا
function technicalModel({ palette = 'iran', friendly = false }) {
  const root = new THREE.Group();
  const P = new Part(friendly ? 'tan' : palette === 'iran' ? 'white' : palette);
  const len = 5.3, w = 1.85;
  addWheels(P, [1.6, -1.55], 0.82, 0.39, 0);
  P.box(1.8, 0.45, len - 0.2, 'camo', 0, 0.85, 0);
  P.box(1.8, 0.35, 1.5, 'camo', 0, 1.22, 1.85);
  P.box(1.75, 0.7, 1.3, 'camo', 0, 1.42, 0.55);
  P.box(1.6, 0.48, 0.05, 'glass', 0, 1.52, 1.22, 0.35);
  for (const s of [-1, 1]) P.box(0.05, 0.42, 1.0, 'glass', s * 0.88, 1.52, 0.55);
  P.box(1.6, 0.04, 1.1, 'camo', 0, 1.8, 0.55);
  // صندوق الحمولة
  for (const s of [-1, 1]) P.box(0.06, 0.45, 2.1, 'camo', s * 0.88, 1.3, -1.45);
  P.box(1.8, 0.45, 0.06, 'camo', 0, 1.3, -2.5);
  P.box(1.9, 0.18, 0.2, 'dark', 0, 0.75, 2.62);
  root.add(P.build('hull'));
  const turret = pivot('turret', 0, 1.15, -1.3);
  const T = new Part(palette);
  T.cylY(0.05, 0.08, 1.0, 'dark', 0, 0.5, 0, 6);
  // الرامي
  T.box(0.42, 0.55, 0.28, friendly ? 'cloth2' : 'cloth2', 0, 1.15, -0.55);
  T.add(new THREE.SphereGeometry(0.13, 10, 8), 'skin', 0, 1.55, -0.55);
  T.add(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), friendly ? 'fabric' : 'cloth2', 0, 1.57, -0.55);
  T.box(0.14, 0.5, 0.16, 'cloth2', -0.13, 0.65, -0.55);
  T.box(0.14, 0.5, 0.16, 'cloth2', 0.13, 0.65, -0.55);
  turret.add(T.build('turretMesh'));
  const gun = pivot('gun', 0, 1.1, 0);
  const Gp = new Part(palette);
  Gp.cylZ(0.022, 0.03, 1.6, 'dark', 0, 0, 0.8, 8);
  Gp.box(0.16, 0.18, 0.55, 'dark', 0, 0, -0.1);
  Gp.box(0.55, 0.4, 0.04, 'dark', 0, 0.1, 0.25);
  gun.add(Gp.build('gunMesh'));
  gun.add(pivot('muzzle', 0, 0, 1.65));
  turret.add(gun);
  root.add(turret);
  addFlag(root, -0.8, 1.6, -2.4, friendly ? 'revolution' : 'militia');
  root.add(pivot('exhaust', 0.6, 0.6, -2.6));
  return { root, hitboxes: [{ name: 'hull', min: [-0.95, 0.3, -len / 2], max: [0.95, 1.9, len / 2] }], height: 2.6, length: len, width: w, wheeled: true };
}

function addFlag(root, x, y, z, kind = 'revolution') {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 5), getMat('dark'));
  pole.position.set(x, y + 0.8, z);
  const geo = new THREE.PlaneGeometry(0.9, 0.6, 6, 2);
  geo.translate(-0.45, 0, 0);
  const m = new THREE.MeshStandardMaterial({ map: flagTexture(kind), side: THREE.DoubleSide, roughness: 1 });
  m.userData.heat = 0.4;
  const cloth = new THREE.Mesh(geo, m);
  cloth.position.set(x, y + 1.3, z);
  cloth.userData.flag = true;
  cloth.userData.base = geo.attributes.position.array.slice();
  cloth.name = 'flag';
  root.add(pole, cloth);
}

// ===================== منشآت ثابتة =====================
function bunkerModel({ palette = 'regime' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  const rnd = mulberry32(12);
  const bag = new THREE.CapsuleGeometry(0.2, 0.5, 2, 6);
  bag.rotateZ(Math.PI / 2);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    if (r > 1 && r < 4 && (k === 0 || k === 17)) continue; // فتحة الرمي
    P.add(bag, 'sandbag', Math.sin(a) * 2.2, 0.2 + r * 0.32, Math.cos(a) * 2.2, 0, a + Math.PI / 2 + (rnd() - 0.5) * 0.2, 0, 1, 0.8, 1.2);
  }
  P.box(5.2, 0.35, 5.2, 'concrete', 0, 1.85, 0);
  P.box(5.4, 0.25, 5.4, 'sandbag', 0, 2.1, 0);
  root.add(P.build('hull'));
  const turret = pivot('turret', 0, 1.15, 1.6);
  const gun = pivot('gun', 0, 0, 0);
  const Gp = new Part(palette);
  Gp.cylZ(0.025, 0.035, 1.6, 'dark', 0, 0, 0.8, 8);
  Gp.box(0.18, 0.2, 0.5, 'dark', 0, 0, -0.1);
  gun.add(Gp.build('gunMesh'));
  gun.add(pivot('muzzle', 0, 0, 1.65));
  turret.add(gun);
  root.add(turret);
  return { root, hitboxes: [{ name: 'hull', min: [-2.6, 0, -2.6], max: [2.6, 2.3, 2.6] }], height: 2.3, length: 5, width: 5, static: true };
}

function checkpointModel({ palette = 'regime' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  // غرفة الحرس
  P.box(3, 2.6, 3, 'concrete', -3, 1.3, 0);
  P.box(3.4, 0.2, 3.4, 'dark', -3, 2.7, 0);
  P.box(1.2, 0.8, 0.05, 'glass', -3, 1.7, 1.52);
  // كتل خرسانية
  for (let k = 0; k < 5; k++) P.box(1.8, 1.0, 0.6, 'concrete', 1 + k * 2, 0.5, 2.5 * (k % 2 ? 1 : -1), 0, (k % 2) * 0.1, 0);
  // حاجز بخطوط
  P.box(5, 0.12, 0.12, 'white', 1.2, 1.1, 0);
  for (let k = 0; k < 4; k++) P.box(0.6, 0.13, 0.13, 'red', -0.6 + k * 1.2, 1.1, 0);
  P.box(0.3, 1.2, 0.3, 'dark', -1.3, 0.6, 0);
  // براميل وإطارات
  for (let k = 0; k < 4; k++) P.cylY(0.3, 0.3, 0.9, 'dark', 4 + (k % 2) * 0.7, 0.45, -1 + Math.floor(k / 2) * 0.7, 10);
  // متراس أكياس رمل
  const bag = new THREE.CapsuleGeometry(0.2, 0.5, 2, 6);
  bag.rotateZ(Math.PI / 2);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) P.add(bag, 'sandbag', -6 + k * 0.62 + (r % 2) * 0.3, 0.2 + r * 0.32, 2.5, 0, 0, 0, 1, 0.8, 1.2);
  root.add(P.build('hull'));
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 6, 6), getMat('metal'));
  pole.position.y = 3;
  const geo = new THREE.PlaneGeometry(1.8, 1.2, 8, 3);
  geo.translate(0.9, 0, 0);
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTexture('regime'), side: THREE.DoubleSide }));
  cloth.position.y = 5.3;
  cloth.userData.flag = true;
  cloth.userData.base = geo.attributes.position.array.slice();
  cloth.name = 'flag';
  flag.add(pole, cloth);
  flag.position.set(-4.8, 0, -1.2);
  root.add(flag);
  const turret = pivot('turret', -5, 1.0, 2.4);
  const gun = pivot('gun', 0, 0, 0);
  const Gp = new Part(palette);
  Gp.cylZ(0.02, 0.03, 1.2, 'dark', 0, 0, 0.6, 8);
  gun.add(Gp.build('gunMesh'));
  gun.add(pivot('muzzle', 0, 0, 1.25));
  turret.add(gun);
  root.add(turret);
  return { root, hitboxes: [{ name: 'hull', min: [-6.5, 0, -2.5], max: [5.5, 3, 3] }], height: 3, length: 6, width: 12, static: true };
}

function depotModel({ palette = 'regime' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  const rnd = mulberry32(5);
  // حاوية شحن
  P.box(2.4, 2.6, 6, 'camo', -4, 1.3, 0);
  P.box(2.4, 2.6, 6, 'dark', 4.5, 1.3, 1, 0, 0.4, 0);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 7, z = (rnd() - 0.5) * 7, lvl = Math.floor(rnd() * 3);
    P.box(1.2, 0.5, 0.6, i % 3 ? 'wood' : 'camo', x, 0.25 + lvl * 0.5, z, 0, rnd() * 0.6, 0);
  }
  for (let i = 0; i < 12; i++) P.cylZ(0.08, 0.08, 1.1, 'metal', -1.5 + (i % 6) * 0.2, 0.1 + Math.floor(i / 6) * 0.17, 4.2, 8);
  // شبكة تمويه
  const net = new THREE.PlaneGeometry(14, 12, 8, 8);
  const p = net.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, (rnd() - 0.5) * 0.6);
  net.rotateX(-Math.PI / 2);
  P.add(net, 'canvas', 0, 3.4, 0);
  for (const [x, z] of [[-6.5, -5.5], [6.5, -5.5], [-6.5, 5.5], [6.5, 5.5]]) P.cylY(0.08, 0.08, 3.4, 'wood', x, 1.7, z, 5);
  root.add(P.build('hull'));
  return { root, hitboxes: [{ name: 'hull', min: [-7, 0, -6], max: [7, 3.5, 6] }], height: 3.5, length: 12, width: 14, static: true };
}

function bukModel({ palette = 'regime' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  const len = 7.5, w = 3.2;
  addTracks(P, { len: len - 0.4, w, wheels: 6, r: 0.38, skirts: false });
  P.add(extrudeSide([[-len / 2, 0.45], [-len / 2, 1.5], [len / 2 - 1.2, 1.55], [len / 2, 1.0], [len / 2 - 0.3, 0.45]], w - 1), 'camo');
  P.box(w, 0.08, len - 0.6, 'camo', 0, 1.2, 0);
  root.add(P.build('hull'));
  const turret = pivot('turret', 0, 1.55, -0.6);
  const T = new Part(palette);
  T.cylY(1.2, 1.3, 0.35, 'camo', 0, 0.18, 0, 16);
  T.box(1.7, 1.5, 1.4, 'camo', 0, 1.1, 1.3);
  T.box(1.4, 1.0, 0.1, 'dark', 0, 1.3, 2.05);
  turret.add(T.build('turretMesh'));
  const gun = pivot('gun', 0, 0.9, -0.2);
  const Gp = new Part(palette);
  for (const [x, y] of [[-0.42, 0.25], [0.42, 0.25], [-0.42, -0.2], [0.42, -0.2]]) {
    Gp.cylZ(0.2, 0.2, 5.4, 'missile', x, y, 0.4, 12);
    Gp.add(new THREE.ConeGeometry(0.2, 0.5, 12).rotateX(Math.PI / 2), 'red', x, y, 3.35);
    for (const s of [-1, 1]) Gp.box(0.02, 0.4, 0.5, 'missile', x + s * 0.2, y, -1.8);
  }
  Gp.box(1.2, 0.2, 5, 'dark', 0, -0.45, 0.2);
  gun.rotation.x = -0.55;
  gun.add(Gp.build('gunMesh'));
  gun.add(pivot('muzzle', 0, 0, 3.6));
  turret.add(gun);
  root.add(turret);
  return { root, hitboxes: [{ name: 'hull', min: [-w / 2, 0.2, -len / 2], max: [w / 2, 4.5, len / 2] }], height: 4.5, length: len, width: w, tracked: true };
}

function atgmTeamModel({ palette = 'iran' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  const bag = new THREE.CapsuleGeometry(0.2, 0.5, 2, 6);
  bag.rotateZ(Math.PI / 2);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 8; k++) {
    const a = -0.9 + (k / 7) * 1.8;
    P.add(bag, 'sandbag', Math.sin(a) * 1.8, 0.2 + r * 0.3, Math.cos(a) * 1.8, 0, a + Math.PI / 2, 0, 1, 0.8, 1.2);
  }
  // جندي جاثٍ
  P.box(0.4, 0.5, 0.3, 'cloth2', 0.6, 0.55, -0.4);
  P.add(new THREE.SphereGeometry(0.13, 8, 6), 'skin', 0.6, 0.95, -0.4);
  P.box(0.4, 0.5, 0.3, 'cloth2', -0.8, 0.5, -0.6);
  P.add(new THREE.SphereGeometry(0.13, 8, 6), 'skin', -0.8, 0.9, -0.6);
  root.add(P.build('hull'));
  const turret = pivot('turret', 0, 0.6, 0.2);
  const T = new Part(palette);
  for (const a of [0, 2.1, 4.2]) T.box(0.04, 0.7, 0.04, 'dark', Math.sin(a) * 0.3, -0.25, Math.cos(a) * 0.3, Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
  turret.add(T.build('turretMesh'));
  const gun = pivot('gun', 0, 0.2, 0);
  const Gp = new Part(palette);
  Gp.cylZ(0.08, 0.08, 1.3, 'camo', 0, 0.08, 0.2, 10);
  Gp.box(0.25, 0.25, 0.35, 'dark', 0.2, -0.05, -0.2);
  gun.add(Gp.build('gunMesh'));
  gun.add(pivot('muzzle', 0, 0.08, 0.9));
  turret.add(gun);
  root.add(turret);
  return { root, hitboxes: [{ name: 'hull', min: [-2, 0, -1.5], max: [2, 1.4, 2] }], height: 1.4, length: 2, width: 3, static: true };
}

// ===================== المشاة =====================
function soldierModel({ palette = 'regime', kind = 'soldier' }) {
  const root = new THREE.Group();
  const clothPal = palette === 'friend' ? 'friend' : palette === 'iran' ? 'iran' : 'regime';
  const body = new Part(clothPal);
  body.box(0.42, 0.6, 0.26, 'cloth', 0, 1.18, 0);
  body.box(0.46, 0.3, 0.3, 'cloth2', 0, 1.15, 0.02); // جعبة
  body.add(new THREE.SphereGeometry(0.12, 10, 8), 'skin', 0, 1.62, 0);
  if (kind === 'militia') {
    body.add(new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'cloth2', 0, 1.64, 0);
    body.box(0.26, 0.05, 0.03, 'red', 0, 1.69, 0.12);
  } else if (kind === 'friend') {
    body.add(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'fabric', 0, 1.63, 0);
  } else {
    body.add(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'cloth', 0, 1.64, 0, 0, 0, 0, 1, 0.85, 1);
  }
  // الذراعان والبندقية
  body.box(0.1, 0.45, 0.1, 'cloth', -0.24, 1.22, 0.16, -1.1, 0, 0.2);
  body.box(0.1, 0.45, 0.1, 'cloth', 0.24, 1.22, 0.16, -1.2, 0, -0.3);
  body.box(0.06, 0.08, 0.9, 'dark', 0.05, 1.3, 0.35);
  if (kind === 'rpg') body.cylZ(0.05, 0.05, 1.0, 'cloth2', 0.12, 1.55, 0.05, 8);
  const bodyG = body.build('body');
  bodyG.name = 'body';
  root.add(bodyG);
  const legL = pivot('legL', -0.11, 0.88, 0), legR = pivot('legR', 0.11, 0.88, 0);
  const LP = new Part(clothPal);
  LP.box(0.15, 0.85, 0.17, 'cloth', 0, -0.43, 0);
  LP.box(0.15, 0.1, 0.26, 'black', 0, -0.83, 0.04);
  const lg = LP.build('leg');
  legL.add(lg);
  legR.add(lg.clone());
  root.add(legL, legR);
  root.add(pivot('muzzle', 0.05, 1.3, 0.85));
  return { root, hitboxes: [{ name: 'hull', min: [-0.35, 0, -0.3], max: [0.35, 1.8, 0.4] }], height: 1.8, length: 0.6, width: 0.6, infantry: true };
}

// ===================== المروحيات =====================
function lathe(profile, seg = 16) {
  // LatheGeometry يتوقع النقاط من الأسفل للأعلى ليكون الوجه الخارجي ظاهراً
  const pts = profile[0][1] > profile[profile.length - 1][1] ? [...profile].reverse() : profile;
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}

function mi24Model({ palette = 'ru_heli' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  // جسم ضيق طويل
  P.add(lathe([[0.01, 7.6], [0.45, 7.2], [0.8, 6.2], [1.05, 4.5], [1.12, 2.0], [1.08, 0], [0.9, -1.8], [0.5, -3.2], [0.32, -6], [0.22, -9.5], [0.01, -9.6]], 14), 'camo', 0, 1.9, 0, 0, 0, 0, 0.85, 1.15, 1);
  // قمرتان متتاليتان
  P.add(new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'glass', 0, 2.55, 5.2, 0, 0, 0, 1, 0.9, 1.4);
  P.add(new THREE.SphereGeometry(0.68, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'glass', 0, 2.95, 3.6, 0, 0, 0, 1, 0.9, 1.4);
  // المحركات
  for (const s of [-1, 1]) P.cylZ(0.42, 0.48, 4.2, 'camo', s * 0.62, 3.1, 0.5, 12);
  P.cylZ(0.1, 0.1, 0.4, 'engine', 0, 3.2, -1.7, 8);
  for (const s of [-1, 1]) P.cylZ(0.25, 0.32, 0.4, 'engine', s * 1.05, 3.0, -1.2, 10);
  // الأجنحة القصيرة وحواضن الصواريخ
  for (const s of [-1, 1]) {
    P.box(3.2, 0.14, 1.3, 'camo', s * 2.1, 1.85, 0.4, 0, 0, s * -0.22);
    for (const k of [1.6, 2.8]) {
      P.cylZ(0.25, 0.25, 1.6, 'dark', s * k, 1.35 - (k - 1.6) * 0.25, 0.4, 10);
      P.add(new THREE.SphereGeometry(0.25, 8, 6), 'dark', s * k, 1.35 - (k - 1.6) * 0.25, 1.2);
    }
    P.box(0.18, 0.3, 1.2, 'camo', s * 3.6, 1.2, 0.3);
  }
  // مدفع الأنف والعجلات
  P.add(new THREE.SphereGeometry(0.3, 10, 8), 'dark', 0, 1.25, 6.5);
  P.cylZ(0.04, 0.05, 1.0, 'dark', 0, 1.15, 7.1, 8);
  for (const [x, z] of [[-1, 0.5], [1, 0.5], [0, 5.5]]) { P.cylX(0.3, 0.2, 'rubber', x, 0.3, z, 10); P.box(0.08, 0.7, 0.08, 'dark', x * 0.8, 0.7, z); }
  // الذيل
  P.box(0.12, 2.0, 1.2, 'camo', 0, 3.1, -9.1, -0.2, 0, 0);
  P.box(2.6, 0.08, 0.8, 'camo', 0, 2.1, -8.4);
  root.add(P.build('hull'));
  const rotor = pivot('rotor', 0, 3.85, 0.3);
  const R = new Part(palette);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; R.box(0.45, 0.06, 8.6, 'dark', Math.sin(a) * 4.3, 0, Math.cos(a) * 4.3, 0, a, 0); }
  R.cylY(0.35, 0.35, 0.5, 'dark', 0, -0.1, 0, 10);
  rotor.add(R.build('blades'));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(8.8, 40), getMat('rotor'));
  disc.rotation.x = -Math.PI / 2;
  disc.name = 'disc';
  disc.userData.heat = 0.2;
  disc.userData.noThermalSwap = true;
  disc.userData.matKey = 'rotor';
  rotor.add(disc);
  root.add(rotor);
  const tail = pivot('tailRotor', 0.3, 3.4, -9.3);
  const TR = new Part(palette);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; TR.box(0.05, 1.7, 0.2, 'dark', 0, Math.cos(a) * 0.85, Math.sin(a) * 0.85, a, 0, 0); }
  tail.add(TR.build('tblades'));
  root.add(tail);
  root.add(pivot('muzzle', 0, 1.3, 1.5));
  root.add(pivot('exhaust', 0, 3.1, -1.8));
  return { root, hitboxes: [{ name: 'hull', min: [-1.4, 0.4, -9.5], max: [1.4, 3.6, 7.6] }, { name: 'wings', min: [-3.8, 1, -0.6], max: [3.8, 2.2, 1.4] }], height: 4, length: 17, width: 6, air: true };
}

function mi8Model({ palette = 'ru_heli' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  P.add(lathe([[0.01, 6.4], [0.9, 6.0], [1.3, 4.8], [1.45, 3], [1.45, -1.8], [1.1, -3.2], [0.4, -5], [0.28, -10.5], [0.01, -10.6]], 16), 'camo', 0, 2.1, 0, 0, 0, 0, 1, 1.15, 1);
  P.add(new THREE.SphereGeometry(1.0, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'glass', 0, 2.5, 5.0, -0.6, 0, 0, 1.1, 1, 1.2);
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) P.cylX(0.18, 0.08, 'glass', s * 1.42, 2.6, 2.5 - k * 0.9, 10);
  P.box(1.6, 0.9, 3.8, 'camo', 0, 3.5, 1.2);
  for (const s of [-1, 1]) P.cylZ(0.5, 0.5, 2.2, 'camo', s * 1.65, 1.5, 0.8, 12);
  for (const [x, z] of [[-1.5, 0], [1.5, 0], [0, 4.5]]) { P.cylX(0.35, 0.22, 'rubber', x, 0.35, z, 10); P.box(0.08, 0.8, 0.08, 'dark', x * 0.9, 0.8, z); }
  P.box(0.12, 2.2, 1.3, 'camo', 0, 3.3, -10.1, -0.25, 0, 0);
  root.add(P.build('hull'));
  const rotor = pivot('rotor', 0, 4.25, 0.8);
  const R = new Part(palette);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; R.box(0.5, 0.06, 10.6, 'dark', Math.sin(a) * 5.3, 0, Math.cos(a) * 5.3, 0, a, 0); }
  rotor.add(R.build('blades'));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(10.8, 40), getMat('rotor'));
  disc.rotation.x = -Math.PI / 2;
  disc.name = 'disc';
  disc.userData.noThermalSwap = true;
  disc.userData.matKey = 'rotor';
  rotor.add(disc);
  root.add(rotor);
  const tail = pivot('tailRotor', -0.3, 3.6, -10.3);
  const TR = new Part(palette);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; TR.box(0.05, 2.0, 0.22, 'dark', 0, Math.cos(a), Math.sin(a), a, 0, 0); }
  tail.add(TR.build('tblades'));
  root.add(tail);
  root.add(pivot('muzzle', 0, 0.4, 0));
  root.add(pivot('exhaust', 0, 3.6, -1));
  return { root, hitboxes: [{ name: 'hull', min: [-1.8, 0.4, -10.5], max: [1.8, 4.2, 6.4] }], height: 4.5, length: 18, width: 4, air: true };
}

// ===================== المقاتلات =====================
function wingGeo(points, thick = 0.18) {
  const shape = new THREE.Shape(points.map(([x, f]) => new THREE.Vector2(x, -f)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thick / 2, 0);
  return g;
}

function jetModel({ palette = 'ru_air', kind = 'su24' }) {
  const root = new THREE.Group();
  const P = new Part(palette);
  const is34 = kind === 'su34';
  // جسم الطائرة
  P.add(lathe([[0.01, 11.5], [0.35, 10.6], [0.75, 9], [1.0, 7], [1.15, 4], [1.25, 0], [1.2, -5], [1.0, -8.5], [0.9, -10]], 16), 'camo', 0, 0, 0, 0, 0, 0, is34 ? 1.35 : 1.1, 0.85, 1);
  P.add(new THREE.SphereGeometry(0.85, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'glass', 0, 0.55, 6.6, 0, 0, 0, 1, 0.75, 2.0);
  // مآخذ الهواء
  for (const s of [-1, 1]) P.box(0.9, 1.1, 5.5, 'camo', s * 1.25, -0.1, 1.5);
  // الأجنحة المسحوبة
  for (const s of [-1, 1]) {
    P.add(wingGeo(s > 0 ? [[0.8, 3], [7.2, -3.2], [7.2, -4.3], [0.8, -2.2]] : [[-0.8, 3], [-7.2, -3.2], [-7.2, -4.3], [-0.8, -2.2]], 0.16), 'camo', 0, 0.1, 0);
    P.add(wingGeo(s > 0 ? [[0.8, -6.8], [4.0, -9.2], [4.0, -10.1], [0.8, -9.4]] : [[-0.8, -6.8], [-4.0, -9.2], [-4.0, -10.1], [-0.8, -9.4]], 0.12), 'camo', 0, 0.05, 0);
    // قنابل FAB تحت الأجنحة
    P.cylZ(0.25, 0.25, 2.2, 'dark', s * 2.6, -0.55, -0.6, 10);
    P.add(new THREE.ConeGeometry(0.25, 0.6, 10).rotateX(Math.PI / 2), 'dark', s * 2.6, -0.55, 0.8);
    if (is34) P.add(wingGeo(s > 0 ? [[0.9, 6.5], [2.2, 5.6], [2.2, 5.2], [0.9, 5.2]] : [[-0.9, 6.5], [-2.2, 5.6], [-2.2, 5.2], [-0.9, 5.2]], 0.08), 'camo', 0, 0.3, 0);
  }
  // الذيل العمودي
  const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(3.6, 0), new THREE.Vector2(3.5, 4.2), new THREE.Vector2(2.5, 4.2)]);
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false });
  fg.rotateY(Math.PI / 2);
  for (const x of is34 ? [-1.0, 1.0] : [0]) P.add(fg, 'camo', x - 0.07, 0.8, -6.2);
  // الفوهات
  for (const s of [-1, 1]) P.cylZ(0.62, 0.55, 1.2, 'dark', s * 0.75, -0.05, -10, 14);
  const glow = new Part(palette);
  for (const s of [-1, 1]) glow.add(new THREE.ConeGeometry(0.5, 3.2, 12, 1, true).rotateX(-Math.PI / 2), 'exhaust', s * 0.75, -0.05, -12.1);
  root.add(P.build('hull'));
  const ab = glow.build('afterburner');
  ab.name = 'afterburner';
  root.add(ab);
  root.add(pivot('muzzle', 0, -0.8, -0.5));
  root.add(pivot('exhaust', 0, 0, -11));
  return { root, hitboxes: [{ name: 'hull', min: [-1.6, -1, -11], max: [1.6, 1.5, 11.5] }, { name: 'wings', min: [-7.2, -0.4, -4.5], max: [7.2, 0.4, 3] }], height: 5, length: 23, width: 14, air: true };
}

// مسيّرات إيرانية
function droneModel({ palette = 'iran', kind = 'kamikaze' }) {
  const root = new THREE.Group();
  const P = new Part('grey');
  if (kind === 'kamikaze') {
    // جناح دلتا مثلث مع مروحة خلفية
    P.add(wingGeo([[0, 1.6], [1.25, -1.0], [-1.25, -1.0]], 0.12), 'camo', 0, 0, 0);
    P.add(lathe([[0.01, 1.7], [0.16, 1.2], [0.18, -0.6], [0.1, -1.0]], 10), 'camo', 0, 0.05, 0);
    for (const s of [-1, 1]) P.box(0.03, 0.5, 0.45, 'camo', s * 1.2, 0.18, -0.85);
  } else {
    P.add(lathe([[0.01, 2.2], [0.35, 1.6], [0.4, 0], [0.3, -1.6], [0.1, -1.9]], 12), 'camo', 0, 0, 0);
    P.add(wingGeo([[-5, 0.4], [5, 0.4], [5, -0.3], [-5, -0.3]], 0.1), 'camo', 0, 0.2, 0);
    for (const s of [-1, 1]) { P.cylZ(0.05, 0.05, 3.2, 'camo', s * 0.9, 0.15, -1.7, 6); P.box(0.04, 0.6, 0.5, 'camo', s * 0.9, 0.45, -3.2); }
    P.box(1.9, 0.04, 0.4, 'camo', 0, 0.75, -3.2);
  }
  root.add(P.build('hull'));
  const prop = pivot('rotor', 0, 0.05, kind === 'kamikaze' ? -1.05 : -2.0);
  const R = new Part('grey');
  R.box(kind === 'kamikaze' ? 0.75 : 1.3, 0.08, 0.03, 'dark', 0, 0, 0);
  prop.add(R.build('blades'));
  prop.userData.axis = 'z';
  root.add(prop);
  return { root, hitboxes: [{ name: 'hull', min: [kind === 'kamikaze' ? -1.3 : -5, -0.4, -1.5], max: [kind === 'kamikaze' ? 1.3 : 5, 0.6, 2] }], height: 1, length: 3, width: 3, air: true };
}

// ===================== أسلحة اللاعب =====================
export function towLauncherModel(skin = 'olive') {
  const root = new THREE.Group();
  const P = new Part(skin);
  // الحامل الثلاثي
  for (const a of [Math.PI, Math.PI / 3, -Math.PI / 3]) {
    const g = new THREE.CylinderGeometry(0.025, 0.03, 1.15, 6);
    P.add(g, 'dark', Math.sin(a) * 0.35, 0.42, Math.cos(a) * 0.35, Math.cos(a) * 0.62, 0, -Math.sin(a) * 0.62);
  }
  P.cylY(0.07, 0.09, 0.25, 'dark', 0, 0.85, 0, 10);
  root.add(P.build('tripod'));
  const yaw = pivot('yaw', 0, 0.98, 0);
  const pitch = pivot('pitch', 0, 0.08, 0);
  const T = new Part(skin === 'gold' ? 'gold' : skin);
  const mk = skin === 'gold' ? 'gold' : 'camo';
  // وحدة التوجيه والأنبوب
  T.box(0.32, 0.28, 0.42, mk, 0, 0, 0);
  T.cylZ(0.115, 0.115, 1.55, mk, 0.05, 0.22, 0.25, 16);
  T.cylZ(0.125, 0.125, 0.08, 'dark', 0.05, 0.22, 1.02, 16);
  T.cylZ(0.125, 0.125, 0.08, 'dark', 0.05, 0.22, -0.5, 16);
  // المنظار البصري والحراري
  T.box(0.2, 0.22, 0.5, mk, -0.24, 0.08, -0.02);
  T.cylZ(0.06, 0.06, 0.08, 'glass', -0.24, 0.1, 0.25, 12);
  T.box(0.3, 0.26, 0.55, mk, -0.25, 0.36, 0.0);
  T.cylZ(0.1, 0.1, 0.1, 'glass', -0.25, 0.36, 0.3, 14);
  T.cylZ(0.04, 0.05, 0.14, 'rubber', -0.24, 0.1, -0.33, 10);
  T.box(0.05, 0.05, 0.25, 'dark', 0.2, -0.05, -0.3);
  pitch.add(T.build('unit'));
  pitch.add(pivot('muzzle', 0.05, 0.22, 1.08));
  pitch.add(pivot('sight', -0.24, 0.1, -0.42));
  yaw.add(pitch);
  root.add(yaw);
  // صندوق المرسل على الأرض
  const B = new Part(skin);
  B.box(0.5, 0.35, 0.35, 'camo', -0.55, 0.17, -0.55);
  B.cylZ(0.015, 0.015, 0.8, 'rubber', -0.3, 0.1, -0.2, 6, 0, 0.6);
  root.add(B.build('mgs'));
  return root;
}

export function operatorModel() {
  const r = soldierModel({ palette: 'friend', kind: 'friend' }).root;
  // جاثٍ خلف القاذف ووجهه نحو ساحة المعركة
  r.getObjectByName('legL').rotation.x = -1.2;
  r.getObjectByName('legR').rotation.x = 0.4;
  r.position.y = -0.35;
  r.rotation.y = Math.PI;
  const g = new THREE.Group();
  g.add(r);
  return g;
}

export function kpvModel(skin = 'olive') {
  const root = new THREE.Group();
  const P = new Part(skin);
  for (const a of [Math.PI, Math.PI / 3, -Math.PI / 3]) P.add(new THREE.CylinderGeometry(0.03, 0.035, 1.0, 6), 'dark', Math.sin(a) * 0.35, 0.38, Math.cos(a) * 0.35, Math.cos(a) * 0.65, 0, -Math.sin(a) * 0.65);
  root.add(P.build('tripod'));
  const yaw = pivot('yaw', 0, 0.85, 0);
  const pitch = pivot('pitch', 0, 0.05, 0);
  const G = new Part(skin === 'gold' ? 'gold' : skin);
  const mk = skin === 'gold' ? 'gold' : 'dark';
  G.box(0.18, 0.2, 0.9, mk, 0, 0, 0);
  G.cylZ(0.03, 0.045, 1.5, mk, 0, 0.02, 1.15, 10);
  G.cylZ(0.055, 0.055, 0.6, mk, 0, 0.02, 0.7, 10);
  G.box(0.08, 0.12, 0.08, mk, 0, 0.14, 1.8);
  G.box(0.4, 0.06, 0.06, mk, 0, -0.02, -0.55);
  G.box(0.28, 0.28, 0.25, 'camo', 0.24, -0.08, 0.05);
  G.box(0.75, 0.36, 0.03, 'camo', 0, -0.06, 0.55);
  pitch.add(G.build('gun'));
  pitch.add(pivot('muzzle', 0, 0.02, 1.92));
  yaw.add(pitch);
  root.add(yaw);
  return root;
}

export function iglaViewModel() {
  const root = new THREE.Group();
  const P = new Part('olive');
  P.cylZ(0.04, 0.04, 1.6, 'camo', 0, 0, 0, 12);
  P.cylZ(0.05, 0.05, 0.12, 'dark', 0, 0, 0.8, 12);
  P.box(0.12, 0.2, 0.18, 'dark', 0, -0.12, 0.2);
  P.box(0.05, 0.08, 0.12, 'dark', -0.06, 0.05, 0.4);
  P.box(0.08, 0.06, 0.3, 'cloth2', 0, -0.25, -0.1);
  root.add(P.build('igla'));
  return root;
}

export function fpvDroneModel() {
  const root = new THREE.Group();
  const P = new Part('grey');
  P.box(0.2, 0.06, 0.32, 'dark', 0, 0, 0);
  for (const [x, z] of [[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.18], [0.18, -0.18]]) {
    P.box(0.03, 0.02, 0.28, 'dark', x / 2, 0, z / 2, 0, Math.atan2(x, z), 0);
    P.cylY(0.03, 0.03, 0.05, 'metal', x, 0.03, z, 8);
  }
  P.cylZ(0.05, 0.05, 0.4, 'camo', 0, -0.07, 0.05, 10);
  P.box(0.05, 0.04, 0.04, 'red', 0, 0.04, -0.16);
  root.add(P.build('fpv'));
  return root;
}

// ===================== المقذوفات =====================
export function towMissileModel() {
  const P = new Part('olive');
  P.cylZ(0.076, 0.076, 1.0, 'missile', 0, 0, 0, 12);
  P.cylZ(0.04, 0.07, 0.25, 'missile', 0, 0, 0.62, 12);
  P.cylZ(0.022, 0.022, 0.35, 'dark', 0, 0, 0.9, 8); // مسبار الحشوة الترادفية
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; P.box(0.01, 0.2, 0.14, 'dark', Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0.1, 0, 0, -a); }
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; P.box(0.01, 0.12, 0.1, 'dark', Math.sin(a) * 0.1, Math.cos(a) * 0.1, -0.45, 0, 0, -a); }
  const g = P.build('tow');
  const flare = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), getMat('hot'));
  flare.position.z = -0.55;
  flare.userData.heat = 1;
  g.add(flare);
  return g;
}

export function rocketModel(scale = 1, color = 'dark') {
  const P = new Part('olive');
  P.cylZ(0.06 * scale, 0.06 * scale, 1.4 * scale, color, 0, 0, 0, 8);
  P.add(new THREE.ConeGeometry(0.06 * scale, 0.25 * scale, 8).rotateX(Math.PI / 2), color, 0, 0, 0.82 * scale);
  const g = P.build('rocket');
  const flare = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 8, 6), getMat('hot'));
  flare.position.z = -0.75 * scale;
  g.add(flare);
  return g;
}

export function bombModel() {
  const P = new Part('olive');
  P.add(lathe([[0.01, 1.3], [0.22, 1.0], [0.27, 0.3], [0.25, -0.6], [0.12, -1.0]], 12), 'dark', 0, 0, 0);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; P.box(0.01, 0.3, 0.3, 'dark', Math.sin(a) * 0.2, Math.cos(a) * 0.2, -1.05, 0, 0, -a); }
  return P.build('bomb');
}

export function shellModel() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), getMat('hot'));
  m.scale.set(1, 1, 3);
  m.userData.heat = 1;
  return m;
}

// ===================== المصنع =====================
const BUILDERS = {
  t72: () => tankModel({ palette: 'regime', kind: 't72' }),
  t90: () => tankModel({ palette: 'desert', kind: 't90' }),
  t55: () => tankModel({ palette: 'regime', kind: 't55' }),
  f_t55: () => { const m = tankModel({ palette: 'friend', kind: 'f_t55' }); addFlag(m.root, 1.0, 1.8, -2.4); return m; },
  bmp1: () => bmpModel({ palette: 'regime', kind: 'bmp1' }),
  bmp2: () => bmpModel({ palette: 'regime', kind: 'bmp2' }),
  f_bmp: () => bmpModel({ palette: 'friend', kind: 'f_bmp' }),
  ural: () => truckModel({ palette: 'regime', kind: 'ural' }),
  zu23: () => truckModel({ palette: 'regime', kind: 'zu23' }),
  grad: () => truckModel({ palette: 'regime', kind: 'grad' }),
  shilka: () => shilkaModel({ palette: 'regime' }),
  technical: () => technicalModel({ palette: 'iran' }),
  f_technical: () => technicalModel({ palette: 'friend', friendly: true }),
  bunker: () => bunkerModel({ palette: 'regime' }),
  checkpoint: () => checkpointModel({ palette: 'regime' }),
  depot: () => depotModel({ palette: 'regime' }),
  buk: () => bukModel({ palette: 'ru_heli' }),
  atgmteam: () => atgmTeamModel({ palette: 'iran' }),
  militia: () => soldierModel({ palette: 'iran', kind: 'militia' }),
  soldier: () => soldierModel({ palette: 'regime', kind: 'soldier' }),
  f_soldier: () => soldierModel({ palette: 'friend', kind: 'friend' }),
  mi24: () => mi24Model({ palette: 'ru_heli' }),
  mi8: () => mi8Model({ palette: 'regime' }),
  su24: () => jetModel({ palette: 'ru_air', kind: 'su24' }),
  su34: () => jetModel({ palette: 'ru_air', kind: 'su34' }),
  recon: () => droneModel({ kind: 'recon' }),
  kamikaze: () => droneModel({ kind: 'kamikaze' }),
};

const protoCache = new Map();
export function createModel(type) {
  if (!protoCache.has(type)) {
    const b = BUILDERS[type];
    if (!b) throw new Error(`unknown model ${type}`);
    protoCache.set(type, b());
  }
  const proto = protoCache.get(type);
  const root = proto.root.clone(true);
  // مواد مستقلة للجنازير لتحريك نسيجها، وللأعلام للتموّج
  root.traverse((o) => {
    if (o.isMesh && o.userData.matKey === 'track') {
      o.material = o.material.clone();
      o.material.map = o.material.map.clone();
      o.material.map.needsUpdate = true;
      o.material.userData = { ...o.material.userData };
    }
    if (o.isMesh && o.userData.flag) {
      o.geometry = o.geometry.clone();
    }
  });
  return { ...proto, root };
}

export function preloadModels(types) {
  for (const t of types) if (!protoCache.has(t) && BUILDERS[t]) protoCache.set(t, BUILDERS[t]());
}
