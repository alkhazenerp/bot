// توليد الأنسجة إجرائياً على Canvas — بلا أي ملفات خارجية
import * as THREE from 'three';
import { makeNoise2D, fbm } from '../core/noise.js';
import { mulberry32 } from '../core/util.js';

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(canvas, { repeat = false, srgb = true, mips = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  t.generateMipmaps = mips;
  t.needsUpdate = true;
  return t;
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// أطلس الدخان والنار 2×2: [0] دخان، [1] دخان كثيف، [2] لهب، [3] توهج
export function particleAtlas() {
  return cached('atlas', () => {
    const S = 256;
    const c = makeCanvas(S * 2);
    const g = c.getContext('2d');
    const img = g.createImageData(S * 2, S * 2);
    const n1 = makeNoise2D(11), n2 = makeNoise2D(29);
    for (let fy = 0; fy < 2; fy++) for (let fx = 0; fx < 2; fx++) {
      const frame = fy * 2 + fx;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = (x / S) * 2 - 1, v = (y / S) * 2 - 1;
        const r = Math.sqrt(u * u + v * v);
        let a = 0, R = 255, G = 255, B = 255;
        if (frame === 0 || frame === 1) {
          const nn = fbm(frame ? n2 : n1, u * 2.2 + 7, v * 2.2 + 3, 5);
          const edge = 1 - r + nn * 0.55;
          a = Math.max(0, Math.min(1, edge * 1.6 - 0.15));
          a = a * a * (frame ? 1 : 0.85);
          const shade = 0.72 + 0.28 * (-v * 0.5 + 0.5) + nn * 0.25;
          R = G = B = Math.max(0, Math.min(255, 255 * shade));
        } else if (frame === 2) {
          const nn = fbm(n1, u * 3 + 1, v * 3 - 5, 4);
          const e = 1 - r * 1.15 + nn * 0.5;
          a = Math.max(0, Math.min(1, e * 1.5));
          const hot = Math.max(0, Math.min(1, e * 1.4));
          R = 255; G = 140 + 115 * hot; B = 60 + 170 * hot * hot;
        } else {
          const e = Math.max(0, 1 - r);
          a = Math.pow(e, 2.2);
          R = G = B = 255;
        }
        const px = ((fy * S + y) * S * 2 + fx * S + x) * 4;
        img.data[px] = R; img.data[px + 1] = G; img.data[px + 2] = B; img.data[px + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return tex(c, { srgb: true });
  });
}

export function noiseTexture(size = 256, seed = 3, scale = 8, oct = 4, lo = 0.6, hi = 1) {
  return cached(`noise${size}_${seed}_${scale}_${oct}_${lo}_${hi}`, () => {
    const c = makeCanvas(size);
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const n = makeNoise2D(seed);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      // ضجيج قابل للتكرار عبر مزج حلقي
      const u = x / size, v = y / size;
      const a = fbm(n, Math.cos(u * Math.PI * 2) * scale / 6 + 10, Math.sin(u * Math.PI * 2) * scale / 6 + Math.cos(v * Math.PI * 2) * scale / 6, oct);
      const b = fbm(n, Math.sin(v * Math.PI * 2) * scale / 6 - 5, a * 2, 2);
      const t = Math.max(0, Math.min(1, 0.5 + (a * 0.8 + b * 0.3)));
      const val = (lo + (hi - lo) * t) * 255;
      const p = (y * size + x) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = val; img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c, { repeat: true, srgb: false });
  });
}

// تفاصيل الأرض: حصى وتراب
export function groundDetail() {
  return cached('gdetail', () => {
    const S = 512;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const n = makeNoise2D(77);
    const rnd = mulberry32(5);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * Math.PI * 2, v = y / S * Math.PI * 2;
      const a = fbm(n, Math.cos(u) * 2 + Math.sin(v) * 0.5, Math.sin(u) * 2 + Math.cos(v) * 2, 5);
      const b = n(Math.cos(u) * 9 + 3, Math.sin(v) * 9 + Math.cos(v) * 3);
      let val = 0.78 + a * 0.28 + b * 0.08;
      const p = (y * S + x) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = Math.max(0, Math.min(255, val * 255)); img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // حصى صغيرة
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * S, y = rnd() * S, r = 0.6 + rnd() * 2.2;
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return tex(c, { repeat: true, srgb: false, aniso: 8 });
  });
}

// تمويه عسكري
export function camoTexture(colors, seed = 1, size = 256) {
  return cached(`camo${colors.join()}_${seed}`, () => {
    const c = makeCanvas(size);
    const g = c.getContext('2d');
    const rnd = mulberry32(seed);
    g.fillStyle = colors[0];
    g.fillRect(0, 0, size, size);
    for (let k = 1; k < colors.length; k++) {
      g.fillStyle = colors[k];
      for (let i = 0; i < 9; i++) {
        const cx = rnd() * size, cy = rnd() * size;
        g.beginPath();
        const pts = 9;
        for (let j = 0; j <= pts; j++) {
          const a = (j / pts) * Math.PI * 2;
          const r = (18 + rnd() * 34) * (k === colors.length - 1 ? 0.6 : 1);
          const x = cx + Math.cos(a) * r * 1.6, y = cy + Math.sin(a) * r;
          if (j === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.closePath(); g.fill();
        // تكرار عبر الحواف
        g.save(); g.translate(cx > size / 2 ? -size : size, 0); g.fill(); g.restore();
      }
    }
    // اتساخ وغبار
    const n = makeNoise2D(seed + 9);
    const img = g.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = 0.86 + 0.18 * fbm(n, x / 40, y / 40, 3) + (y / size) * 0.06;
      const p = (y * size + x) * 4;
      img.data[p] *= d; img.data[p + 1] *= d; img.data[p + 2] *= d * 0.97;
    }
    g.putImageData(img, 0, 0);
    return tex(c, { repeat: true });
  });
}

// واجهة مبنى بنوافذ: شبكة 4×4 بلاطات (كل بلاطة 3م) — البلاطة (0,0) جدار مصمت للأسطح
export function facadeTexture() {
  return cached('facade', () => {
    const S = 512, T = S / 4;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const rnd = mulberry32(42);
    const n = makeNoise2D(4);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 222 + 26 * fbm(n, x / 50, y / 50, 4) + (rnd() - 0.5) * 12;
      const p = (y * S + x) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
      if (tx === 0 && ty === 0) continue;
      const x0 = tx * T, y0 = ty * T;
      const kind = rnd();
      if (kind < 0.1) continue;
      const ww = T * (0.3 + rnd() * 0.18), wh = T * (0.36 + rnd() * 0.14);
      const wx = x0 + (T - ww) / 2, wy = y0 + T * 0.26;
      g.fillStyle = kind < 0.25 ? '#2a2622' : kind < 0.45 ? '#3b4246' : '#141618';
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(70,64,56,0.55)';
      g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(wx - 3, wy + wh, ww + 6, 4);
      if (kind > 0.62) {
        g.fillStyle = 'rgba(45,42,38,0.6)';
        g.fillRect(wx - 8, wy + wh * 0.55, ww + 16, 3);
        for (let k = 0; k < 7; k++) g.fillRect(wx - 8 + k * (ww + 16) / 6, wy + wh * 0.55, 2, wh * 0.45);
      }
      if (rnd() < 0.35) {
        g.fillStyle = 'rgba(30,25,20,0.55)';
        for (let k = 0; k < 10; k++) { g.beginPath(); g.arc(x0 + rnd() * T, y0 + rnd() * T, 1 + rnd() * 2.5, 0, 7); g.fill(); }
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.1)';
    for (let ty = 0; ty < 4; ty++) g.fillRect(T, ty * T + T - 3, S - T, 3);
    return tex(c, { repeat: true, aniso: 8 });
  });
}

// حجر أبلق: صفوف سوداء وبيضاء
export function ablaqTexture() {
  return cached('ablaq', () => {
    const c = makeCanvas(64, 256);
    const g = c.getContext('2d');
    for (let k = 0; k < 16; k++) {
      g.fillStyle = k % 2 ? '#2e2d2b' : '#e9e4d8';
      g.fillRect(0, k * 16, 64, 16);
    }
    return tex(c, { repeat: true });
  });
}

// مدرج المطار
export function runwayTexture() {
  return cached('runway', () => {
    const c = makeCanvas(128, 1024);
    const g = c.getContext('2d');
    g.fillStyle = '#4a4845'; g.fillRect(0, 0, 128, 1024);
    g.fillStyle = 'rgba(240,240,230,0.85)';
    for (let y = 40; y < 1000; y += 60) g.fillRect(62, y, 4, 30);
    g.fillRect(4, 0, 3, 1024); g.fillRect(121, 0, 3, 1024);
    for (let k = 0; k < 6; k++) { g.fillRect(14 + k * 9, 8, 5, 40); g.fillRect(70 + k * 9, 8, 5, 40); }
    return tex(c, { repeat: true });
  });
}

export function trackTexture() {
  return cached('track', () => {
    const c = makeCanvas(64, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#2a2724'; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = '#3d3934'; g.fillRect(0, i * 16, 64, 10);
      g.fillStyle = '#1b1917'; g.fillRect(28, i * 16 + 2, 8, 6);
    }
    return tex(c, { repeat: true });
  });
}

export function cloudTexture(seed = 5) {
  return cached(`cloud${seed}`, () => {
    const S = 256;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const n = makeNoise2D(seed);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * 2 - 1, v = y / S * 2 - 1;
      const r = Math.sqrt(u * u * 0.7 + v * v * 1.4);
      const f = fbm(n, u * 2.5, v * 2.5, 5);
      let a = (1 - r) * 1.3 + f * 0.8 - 0.25;
      a = Math.max(0, Math.min(1, a));
      const shade = 0.78 + 0.22 * Math.max(0, -v) + f * 0.12;
      const p = (y * S + x) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = Math.min(255, shade * 255);
      img.data[p + 3] = a * a * 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c);
  });
}

export function grassTexture() {
  return cached('grass', () => {
    const W = 128, H = 128;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const rnd = mulberry32(8);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 46; i++) {
      const x = 4 + rnd() * (W - 8);
      const h = H * (0.45 + rnd() * 0.55);
      const lean = (rnd() - 0.5) * 26;
      const wdt = 1.6 + rnd() * 2.4;
      const gr = g.createLinearGradient(0, H, 0, H - h);
      const dry = rnd();
      gr.addColorStop(0, dry < 0.5 ? '#4c5a26' : '#6b6a30');
      gr.addColorStop(1, dry < 0.5 ? '#b9b35b' : '#e0cd80');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - wdt, H);
      g.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h);
      g.quadraticCurveTo(x + lean * 0.3 + wdt * 0.5, H - h * 0.6, x + wdt, H);
      g.fill();
      if (rnd() < 0.25) { // سنبلة قمح
        g.fillStyle = '#e8d38c';
        g.beginPath(); g.ellipse(x + lean, H - h, 2.4, 7, lean * 0.02, 0, Math.PI * 2); g.fill();
      }
    }
    return tex(c, { aniso: 2 });
  });
}

function drawStar(g, cx, cy, r, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.4 : r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath(); g.fill();
}

// علم الثورة: أخضر/أبيض/أسود مع ثلاث نجوم حمراء
export function flagTexture(kind = 'revolution') {
  return cached(`flag_${kind}`, () => {
    const W = 192, H = 128;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    if (kind === 'revolution') {
      g.fillStyle = '#007a3d'; g.fillRect(0, 0, W, H / 3);
      g.fillStyle = '#ffffff'; g.fillRect(0, H / 3, W, H / 3);
      g.fillStyle = '#000000'; g.fillRect(0, 2 * H / 3, W, H / 3);
      for (let i = 0; i < 3; i++) drawStar(g, W / 2 + (i - 1) * 46, H / 2, 15, '#ce1126');
    } else if (kind === 'regime') {
      g.fillStyle = '#ce1126'; g.fillRect(0, 0, W, H / 3);
      g.fillStyle = '#ffffff'; g.fillRect(0, H / 3, W, H / 3);
      g.fillStyle = '#000000'; g.fillRect(0, 2 * H / 3, W, H / 3);
      for (let i = 0; i < 2; i++) drawStar(g, W / 2 + (i - 0.5) * 50, H / 2, 15, '#007a3d');
    } else {
      g.fillStyle = '#d4b106'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#2f6b2f'; g.fillRect(0, H * 0.4, W, H * 0.2);
    }
    return tex(c);
  });
}

export function scorchTexture() {
  return cached('scorch', () => {
    const S = 128;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const n = makeNoise2D(91);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * 2 - 1, v = y / S * 2 - 1;
      const r = Math.sqrt(u * u + v * v);
      const a = Math.max(0, Math.min(1, (1 - r) * 1.6 + fbm(n, u * 3, v * 3, 4) * 0.7 - 0.2));
      const p = (y * S + x) * 4;
      img.data[p] = 18; img.data[p + 1] = 15; img.data[p + 2] = 12; img.data[p + 3] = a * 235;
    }
    g.putImageData(img, 0, 0);
    return tex(c);
  });
}

// قرص المروحة الضبابي
export function rotorDiscTexture() {
  return cached('rotor', () => {
    const S = 256;
    const c = makeCanvas(S);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(20,20,20,0.0)');
    gr.addColorStop(0.2, 'rgba(20,20,20,0.18)');
    gr.addColorStop(0.92, 'rgba(20,20,20,0.24)');
    gr.addColorStop(1, 'rgba(20,20,20,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
    return tex(c);
  });
}

export function glassMaterial() {
  return cached('glassmat', () => new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.4 }));
}

export function textTexture(text, { w = 512, h = 128, font = 'bold 64px sans-serif', color = '#fff', bg = null } = {}) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = color;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.direction = 'rtl';
  g.fillText(text, w / 2, h / 2);
  return tex(c);
}
