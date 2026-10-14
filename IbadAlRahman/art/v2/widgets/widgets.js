// Prototype of the Andalusian widget art. The Kotlin renderer (widget/AndalusArt.kt) mirrors
// this geometry; this file renders the gallery and the widget-picker preview images.
const THEMES = {
  ANDALUS: { bg: '#0E4D47', text: '#F5E6C8', secondary: '#A8DCD4', accent: '#E3C35A', light: false },
  NIGHT:   { bg: '#061A18', text: '#FFFFFF', secondary: '#9FBDB7', accent: '#E3C35A', light: false },
  ROYAL:   { bg: '#4B3A7A', text: '#F5E6C8', secondary: '#D3CAF0', accent: '#F1CF63', light: false },
  GLASS:   { bg: '#000000', text: '#FFFFFF', secondary: '#E6E6E6', accent: '#6ED1C5', light: false },
  CREAM:   { bg: '#F5E6C8', text: '#0E4D47', secondary: '#6B5B3E', accent: '#9C7A1C', light: true },
};

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }
function mix(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
// Pattern strength: lattice and secondary lines are a little stronger on the light theme.
function patternAlpha(t) { return t.light ? 0.16 : 0.11; }

// ---------------------------------------------------------------------------------- geometry

function star16(p, cx, cy, R, r, rot = -Math.PI / 2) {
  for (let i = 0; i < 16; i++) {
    const a = rot + Math.PI / 8 * i;
    const rr = i % 2 === 0 ? R : r;
    const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
    i === 0 ? p.moveTo(x, y) : p.lineTo(x, y);
  }
  p.closePath();
}
const KHATAM = 0.7654; // inner/outer radius of two overlapping squares (the rub el hizb star)

// Ogee arch: same curve as archShape() in ui/components/Andalus.kt.
function arch(p, x, y, w, h, s, r) {
  s = Math.min(s, h * 0.6); r = Math.min(r, Math.min(w, h) / 4);
  p.moveTo(x, y + h - r);
  p.lineTo(x, y + s);
  p.bezierCurveTo(x, y + s * 0.35, x + w * 0.30, y + s * 0.62, x + w * 0.44, y + s * 0.22);
  p.bezierCurveTo(x + w * 0.475, y + s * 0.12, x + w * 0.495, y + s * 0.04, x + w * 0.5, y);
  p.bezierCurveTo(x + w * 0.505, y + s * 0.04, x + w * 0.525, y + s * 0.12, x + w * 0.56, y + s * 0.22);
  p.bezierCurveTo(x + w * 0.70, y + s * 0.62, x + w, y + s * 0.35, x + w, y + s);
  p.lineTo(x + w, y + h - r);
  r > 0 ? p.quadraticCurveTo(x + w, y + h, x + w - r, y + h) : p.lineTo(x + w, y + h);
  p.lineTo(x + r, y + h);
  r > 0 ? p.quadraticCurveTo(x, y + h, x, y + h - r) : p.lineTo(x, y + h);
  p.closePath();
}

// Pointed horseshoe arch between left and right, springing at `spring`, down to `bottom`.
// `vy` (<= 1) flattens the arch when the frame is short.
function horseshoe(p, left, right, spring, bottom, vy = 1) {
  const cx = (left + right) / 2, rx = (right - left) / 2, ry = rx * vy;
  // The sides swell past the jambs, then meet at a slight point.
  const crown = spring - ry * 1.3;
  p.moveTo(left, bottom);
  p.lineTo(left, spring + ry * 0.3);
  p.bezierCurveTo(left - rx * 0.26, spring - ry * 0.28, cx - rx * 0.62, crown + ry * 0.04, cx, crown);
  p.bezierCurveTo(cx + rx * 0.62, crown + ry * 0.04, right + rx * 0.26, spring - ry * 0.28, right, spring + ry * 0.3);
  p.lineTo(right, bottom);
  p.closePath();
}

// Cartouche: a band whose two ends close in pointed ogee tips.
function cartouche(p, x, y, w, h, cap) {
  const m = y + h / 2;
  p.moveTo(x + cap, y);
  p.lineTo(x + w - cap, y);
  p.bezierCurveTo(x + w - cap * 0.35, y, x + w - cap * 0.05, m - h * 0.22, x + w, m);
  p.bezierCurveTo(x + w - cap * 0.05, m + h * 0.22, x + w - cap * 0.35, y + h, x + w - cap, y + h);
  p.lineTo(x + cap, y + h);
  p.bezierCurveTo(x + cap * 0.35, y + h, x + cap * 0.05, m + h * 0.22, x, m);
  p.bezierCurveTo(x + cap * 0.05, m - h * 0.22, x + cap * 0.35, y, x + cap, y);
  p.closePath();
}

function roundRect(p, x, y, w, h, r) {
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); p.closePath();
}

// Lattice of eight-pointed stars joined by straight links (GirihPattern in Andalus.kt).
function girih(ctx, w, h, cell, color, lw) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  const r = cell * 0.42;
  for (let y = 0; y < h + cell; y += cell) {
    for (let x = 0; x < w + cell; x += cell) {
      const p = new Path2D();
      star16(p, x, y, r, r * 0.62, -Math.PI / 2);
      p.moveTo(x + r, y); p.lineTo(x + cell - r, y);
      p.moveTo(x, y + r); p.lineTo(x, y + cell - r);
      ctx.stroke(p);
    }
  }
  ctx.restore();
}

function sparkle(ctx, cx, cy, s, color) {
  const k = 0.22, p = new Path2D();
  p.moveTo(cx, cy - s);
  p.quadraticCurveTo(cx + k * s, cy - k * s, cx + s, cy);
  p.quadraticCurveTo(cx + k * s, cy + k * s, cx, cy + s);
  p.quadraticCurveTo(cx - k * s, cy + k * s, cx - s, cy);
  p.quadraticCurveTo(cx - k * s, cy - k * s, cx, cy - s);
  ctx.fillStyle = color; ctx.fill(p);
}

function divider(ctx, cx, y, half, color, d) {
  for (const dir of [-1, 1]) {
    const g = ctx.createLinearGradient(cx, y, cx + dir * half, y);
    g.addColorStop(0, color); g.addColorStop(1, rgba('#000000', 0));
    ctx.strokeStyle = g; ctx.lineWidth = 1 * d;
    ctx.beginPath(); ctx.moveTo(cx + dir * 6 * d, y); ctx.lineTo(cx + dir * half, y); ctx.stroke();
  }
  sparkle(ctx, cx, y, 3.6 * d, color);
}

// ---------------------------------------------------------------------------------- art layers
// Every function draws the decorative layer only (no text) into a canvas of w x h px; d = px per dp.

function fillGradientV(ctx, path, t, opacity, h, top = 0.10) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(mix(t.bg, t.accent, top), opacity));
  g.addColorStop(0.55, rgba(t.bg, opacity));
  g.addColorStop(1, rgba(mix(t.bg, '#000000', t.light ? 0.04 : 0.18), opacity));
  ctx.fillStyle = g; ctx.fill(path);
}

function artMihrab(ctx, w, h, d, t, opacity) {
  const s = Math.min(w * 0.42, h * 0.40), r = 20 * d;
  const outer = new Path2D(); arch(outer, 0, 0, w, h, s, r);
  fillGradientV(ctx, outer, t, opacity, h);
  ctx.save(); ctx.clip(outer); girih(ctx, w, h, 22 * d, rgba(t.accent, patternAlpha(t)), 0.8 * d); ctx.restore();
  ctx.strokeStyle = rgba(t.accent, 0.55); ctx.lineWidth = 1.2 * d;
  const rim = new Path2D(); arch(rim, 0.6 * d, 0.6 * d, w - 1.2 * d, h - 1.2 * d, s, r); ctx.stroke(rim);
  const i1 = 7 * d, i2 = 11 * d;
  const p1 = new Path2D(); arch(p1, i1, i1, w - 2 * i1, h - 2 * i1, s - 5 * d, r - 5 * d);
  ctx.strokeStyle = rgba(t.accent, 0.92); ctx.lineWidth = 1.4 * d; ctx.stroke(p1);
  const p2 = new Path2D(); arch(p2, i2, i2, w - 2 * i2, h - 2 * i2, s - 8 * d, r - 8 * d);
  ctx.strokeStyle = rgba(t.accent, 0.45); ctx.lineWidth = 0.8 * d; ctx.stroke(p2);
  // Keystone star on the apex and a sparkle on each shoulder.
  const ks = new Path2D(); star16(ks, w / 2, i1 + 1 * d, 6 * d, 6 * d * KHATAM);
  ctx.fillStyle = rgba(mix(t.bg, '#000000', 0.1), Math.max(opacity, 0.9)); ctx.fill(ks);
  ctx.strokeStyle = t.accent; ctx.lineWidth = 1 * d; ctx.stroke(ks);
  sparkle(ctx, w / 2, i1 + 1 * d, 2.4 * d, t.accent);
  divider(ctx, w / 2, h - 15 * d, Math.min(52 * d, w * 0.32), rgba(t.accent, 0.75), d);
}

function artStar(ctx, w, h, d, t, opacity, progress) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 1 * d;
  const outer = new Path2D(); star16(outer, cx, cy, R, R * KHATAM, -Math.PI / 2);
  const g = ctx.createRadialGradient(cx, cy * 0.8, 0, cx, cy, R);
  g.addColorStop(0, rgba(mix(t.bg, t.accent, 0.10), opacity));
  g.addColorStop(1, rgba(mix(t.bg, '#000000', t.light ? 0.03 : 0.15), opacity));
  ctx.fillStyle = g; ctx.fill(outer);
  ctx.save(); ctx.clip(outer); girih(ctx, w, h, 20 * d, rgba(t.accent, patternAlpha(t)), 0.8 * d); ctx.restore();
  ctx.strokeStyle = rgba(t.accent, 0.55); ctx.lineWidth = 1.2 * d;
  const rim = new Path2D(); star16(rim, cx, cy, R - 0.6 * d, (R - 0.6 * d) * KHATAM); ctx.stroke(rim);
  const Ri = R - 7 * d;
  const inner = new Path2D(); star16(inner, cx, cy, Ri, Ri * KHATAM);
  ctx.strokeStyle = rgba(t.accent, 0.92); ctx.lineWidth = 1.4 * d; ctx.stroke(inner);
  // Gold beads on the eight tips.
  ctx.fillStyle = t.accent;
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    ctx.beginPath(); ctx.arc(cx + (R - 3.6 * d) * Math.cos(a), cy + (R - 3.6 * d) * Math.sin(a), 1.4 * d, 0, 2 * Math.PI); ctx.fill();
  }
  // Progress ring between the two prayers.
  const rc = R * 0.60, sw = 3.4 * d;
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(t.text, 0.16); ctx.lineWidth = sw;
  ctx.beginPath(); ctx.arc(cx, cy, rc, 0, 2 * Math.PI); ctx.stroke();
  const sweep = 2 * Math.PI * Math.max(0, Math.min(1, progress));
  if (sweep > 0.01) {
    ctx.strokeStyle = t.accent;
    ctx.beginPath(); ctx.arc(cx, cy, rc, -Math.PI / 2, -Math.PI / 2 + sweep); ctx.stroke();
  }
  const a = -Math.PI / 2 + sweep;
  ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(cx + rc * Math.cos(a), cy + rc * Math.sin(a), 3.8 * d, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx + rc * Math.cos(a), cy + rc * Math.sin(a), 1.6 * d, 0, 2 * Math.PI); ctx.fill();
  ctx.lineCap = 'butt';
}

// Arcade frame: n horseshoe arches; `hl` is the index of the next prayer (-1 for none).
function artArcade(ctx, w, h, d, t, n, hl) {
  const bay = w / n, col = bay * 0.15, rx = (bay - col) / 2;
  const rise = Math.min(rx * 1.3, h * 0.40), vy = rise / (rx * 1.3), ry = rx * vy;
  const spring = Math.max(h * 0.36, rise + 6 * d), crown = spring - rise;
  // Index 0 (Fajr) is the rightmost bay, like the right-to-left text.
  const left = i => w - (i + 1) * bay + col / 2, right = i => w - i * bay - col / 2;
  const openings = [];
  for (let i = 0; i < n; i++) { const p = new Path2D(); horseshoe(p, left(i), right(i), spring, h, vy); openings.push(p); }
  // Lattice in the spandrels only.
  const spandrels = new Path2D(); spandrels.rect(0, 0, w, h);
  openings.forEach(o => spandrels.addPath(o));
  ctx.save(); ctx.clip(spandrels, 'evenodd'); girih(ctx, w, h, 15 * d, rgba(t.accent, patternAlpha(t) + 0.03), 0.7 * d); ctx.restore();
  openings.forEach((o, i) => {
    if (i === hl) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgba(t.accent, t.light ? 0.30 : 0.34)); g.addColorStop(1, rgba(t.accent, t.light ? 0.12 : 0.10));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = rgba(t.text, t.light ? 0.05 : 0.045);
    }
    ctx.fill(o);
    ctx.strokeStyle = rgba(t.accent, i === hl ? 1 : 0.7); ctx.lineWidth = (i === hl ? 1.8 : 1.1) * d; ctx.stroke(o);
  });
  // Capitals on the columns, frieze above and a base line.
  ctx.fillStyle = rgba(t.accent, 0.7);
  for (let i = 0; i <= n; i++) {
    const x = i * bay, cw = col * (i === 0 || i === n ? 0.9 : 1.6);
    ctx.fillRect(Math.max(0, Math.min(w - cw, x - cw / 2)), spring + ry * 0.3 - 1.2 * d, cw, 2.4 * d);
  }
  ctx.fillStyle = rgba(t.accent, 0.55); ctx.fillRect(0, 0, w, 1 * d); ctx.fillRect(0, h - 1 * d, w, 1 * d);
  if (hl >= 0) {
    const ks = new Path2D(); star16(ks, (left(hl) + right(hl)) / 2, Math.max(4.5 * d, crown - 5.5 * d), 4 * d, 4 * d * KHATAM);
    ctx.fillStyle = t.accent; ctx.fill(ks);
  }
}

// Zellige grid: cols x rows tiles; `hl` index of the next prayer.
function artZellige(ctx, w, h, d, t, cols, rows, hl) {
  const g = 6 * d, tw = (w - (cols - 1) * g) / cols, th = (h - (rows - 1) * g) / rows, rr = 9 * d;
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const i = row * cols + c, on = i === hl;
      // Tiles are laid right to left, like the text.
      const x = w - (c + 1) * tw - c * g, y = row * (th + g);
      const tile = new Path2D(); roundRect(tile, x, y, tw, th, rr);
      ctx.fillStyle = on ? rgba(t.accent, t.light ? 0.26 : 0.26) : rgba(t.text, t.light ? 0.05 : 0.05);
      ctx.fill(tile);
      ctx.save(); ctx.clip(tile);
      const cx = x + tw / 2, cy = y + th / 2, R = Math.min(tw, th) * 0.47;
      const st = new Path2D(); star16(st, cx, cy, R, R * KHATAM, -Math.PI / 2);
      ctx.strokeStyle = rgba(t.accent, on ? 0.55 : 0.24); ctx.lineWidth = 0.9 * d; ctx.stroke(st);
      // Interlace: from the star's diagonal tips out to the tile corners.
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2;
        const sx = cx + R * Math.cos(a), sy = cy + R * Math.sin(a);
        const ex = Math.cos(a) > 0 ? x + tw : x, ey = Math.sin(a) > 0 ? y + th : y;
        ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
      }
      ctx.strokeStyle = rgba(t.accent, on ? 0.40 : 0.16); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = rgba(t.accent, on ? 1 : 0.5); ctx.lineWidth = (on ? 1.6 : 1) * d; ctx.stroke(tile);
    }
  }
}

function artCartouche(ctx, w, h, d, t, opacity, logo) {
  const cap = Math.min(h * 0.34, 24 * d);
  const outer = new Path2D(); cartouche(outer, 0, 0, w, h, cap);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, rgba(t.bg, opacity)); g.addColorStop(0.75, rgba(mix(t.bg, t.accent, 0.09), opacity)); g.addColorStop(1, rgba(t.bg, opacity));
  ctx.fillStyle = g; ctx.fill(outer);
  ctx.save(); ctx.clip(outer); girih(ctx, w, h, 18 * d, rgba(t.accent, patternAlpha(t)), 0.8 * d); ctx.restore();
  ctx.strokeStyle = rgba(t.accent, 0.55); ctx.lineWidth = 1.2 * d;
  const rim = new Path2D(); cartouche(rim, 0.6 * d, 0.6 * d, w - 1.2 * d, h - 1.2 * d, cap); ctx.stroke(rim);
  const i1 = 5 * d;
  const inner = new Path2D(); cartouche(inner, i1, i1, w - 2 * i1, h - 2 * i1, cap - 3 * d);
  ctx.strokeStyle = rgba(t.accent, 0.92); ctx.lineWidth = 1.3 * d; ctx.stroke(inner);
  // Medallion with the logo at the start (right) end.
  const mr = 24 * d, mx = w - cap - 6 * d - mr, my = h / 2;
  ctx.fillStyle = rgba(mix(t.bg, '#000000', t.light ? 0.0 : 0.22), Math.max(opacity, 0.6));
  if (t.light) ctx.fillStyle = rgba('#0E4D47', Math.max(opacity, 0.9));
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = t.accent; ctx.lineWidth = 1.4 * d; ctx.stroke();
  ctx.strokeStyle = rgba(t.accent, 0.5); ctx.lineWidth = 0.8 * d;
  ctx.beginPath(); ctx.arc(mx, my, mr - 3.5 * d, 0, 2 * Math.PI); ctx.stroke();
  if (logo) { const ls = mr * 1.62; ctx.drawImage(logo, mx - ls / 2, my - ls / 2 - 0.5 * d, ls, ls); }
  // A small star at the far tip.
  const ks = new Path2D(); star16(ks, cap * 0.62 + 2 * d, my, 3.6 * d, 3.6 * d * KHATAM);
  ctx.fillStyle = rgba(t.accent, 0.85); ctx.fill(ks);
}

// Panel used behind the arcade and zellige frames (widget_bg + widget_border in the layout).
function panel(ctx, w, h, d, t, opacity) {
  const p = new Path2D(); roundRect(p, 0, 0, w, h, 22 * d);
  ctx.fillStyle = rgba(t.bg, opacity); ctx.fill(p);
  const rim = new Path2D(); roundRect(rim, 0.6 * d, 0.6 * d, w - 1.2 * d, h - 1.2 * d, 21.4 * d);
  ctx.strokeStyle = t === THEMES.GLASS ? rgba(t.text, 0.35) : rgba(t.accent, 0.59); ctx.lineWidth = 1.2 * d; ctx.stroke(rim);
}

if (typeof module !== 'undefined') module.exports = { THEMES };
