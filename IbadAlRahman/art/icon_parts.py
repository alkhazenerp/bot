"""Generates the Ibad Al-Rahman launcher icon SVGs (108x108 adaptive-icon grid).

Run: python3 icon_parts.py  -> writes icon_background.svg, icon_foreground.svg, icon_full.svg, icon_monochrome.svg
"""
import math

def crescent_path(cx, cy, R, icx, icy, r):
    # Intersection points of the outer circle (cx,cy,R) and inner circle (icx,icy,r).
    dx, dy = icx - cx, icy - cy
    d = math.hypot(dx, dy)
    a = (R * R - r * r + d * d) / (2 * d)
    h = math.sqrt(R * R - a * a)
    mx, my = cx + a * dx / d, cy + a * dy / d
    p1 = (mx + h * dy / d, my - h * dx / d)
    p2 = (mx - h * dy / d, my + h * dx / d)
    f = lambda p: f"{p[0]:.3f},{p[1]:.3f}"
    # Outer arc the long way round (away from the inner circle), inner arc back the short way.
    return f"M{f(p1)} A{R},{R} 0 1,0 {f(p2)} A{r},{r} 0 0,1 {f(p1)} Z"

CRESCENT = crescent_path(54, 27.6, 6.8, 54, 24.2, 5.9)

DEFS = """
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="75%">
      <stop offset="0" stop-color="#1F7A60"/>
      <stop offset="0.45" stop-color="#0C4436"/>
      <stop offset="1" stop-color="#041915"/>
    </radialGradient>
    <radialGradient id="halo" cx="54" cy="30" r="30" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFE38A" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#F5C542" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#F5C542" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="stone" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#E9DDBF"/>
      <stop offset="0.28" stop-color="#FFFDF6"/>
      <stop offset="0.62" stop-color="#E4D5AE"/>
      <stop offset="1" stop-color="#8F7B52"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#B07A16"/>
      <stop offset="0.25" stop-color="#FFF0A3"/>
      <stop offset="0.55" stop-color="#F2BE3C"/>
      <stop offset="1" stop-color="#7A4E08"/>
    </linearGradient>
    <linearGradient id="goldV" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#FFF4B8"/>
      <stop offset="0.5" stop-color="#F0B93A"/>
      <stop offset="1" stop-color="#8A5A0B"/>
    </linearGradient>
    <radialGradient id="dome" cx="38%" cy="30%" r="80%">
      <stop offset="0" stop-color="#FFF8D2"/>
      <stop offset="0.35" stop-color="#F6CB55"/>
      <stop offset="0.8" stop-color="#B9801A"/>
      <stop offset="1" stop-color="#7A4E08"/>
    </radialGradient>
    <linearGradient id="crescent" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#FFF7C4"/>
      <stop offset="0.35" stop-color="#FFD75E"/>
      <stop offset="0.75" stop-color="#E0A526"/>
      <stop offset="1" stop-color="#9A6410"/>
    </linearGradient>
    <linearGradient id="window" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#0A3A2F"/>
      <stop offset="1" stop-color="#14594A"/>
    </linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="0.9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="1.1" dy="1.4" stdDeviation="1.0" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
"""

def stars():
    pts = [(24, 26, 0.9), (82, 22, 1.1), (88, 44, 0.7), (20, 50, 0.6), (30, 16, 0.5), (76, 34, 0.5), (36, 38, 0.45), (72, 14, 0.6)]
    out = []
    for x, y, r in pts:
        out.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFF6D8" opacity="0.75"/>')
    # Two four-point sparkles.
    for x, y, s in [(80, 30, 2.2), (28, 34, 1.6)]:
        out.append(f'<path d="M{x},{y-s} Q{x+0.25*s},{y-0.25*s} {x+s},{y} Q{x+0.25*s},{y+0.25*s} {x},{y+s} Q{x-0.25*s},{y+0.25*s} {x-s},{y} Q{x-0.25*s},{y-0.25*s} {x},{y-s} Z" fill="#FFE9A6" opacity="0.9"/>')
    return "\n    ".join(out)

def background_body():
    return f"""
  <rect width="108" height="108" fill="url(#bg)"/>
  <g>
    {stars()}
  </g>
  <circle cx="54" cy="30" r="30" fill="url(#halo)"/>
  <!-- distant mosque silhouette on the horizon -->
  <path d="M0,92 L0,84 Q10,80 18,84 L18,80 Q24,72 30,80 L30,84 Q40,79 50,84 L58,84 Q68,79 78,84 L78,80 Q84,72 90,80 L90,84 Q98,80 108,84 L108,92 Z" fill="#031411" opacity="0.55"/>
  <rect y="91" width="108" height="17" fill="#031411" opacity="0.55"/>
"""

def windows(y, h, xs, w):
    out = []
    for x in xs:
        out.append(f'<path d="M{x},{y+h} V{y+w/2} A{w/2},{w/2} 0 0,1 {x+w},{y+w/2} V{y+h} Z" fill="url(#window)"/>')
    return "".join(out)

def foreground_body(mono=False):
    if mono:
        F = 'fill="#000"'
        return f"""
  <g transform="translate(54,0) scale(1.24,1) translate(-54,0)">
  <rect x="53.4" y="33.6" width="1.2" height="4" {F}/>
  <circle cx="54" cy="35.6" r="1.35" {F}/>
  <path d="M48.8,45.2 C48.8,40.5 51.5,38.6 54,37.4 C56.5,38.6 59.2,40.5 59.2,45.2 Z" {F}/>
  <rect x="50" y="45" width="8" height="7.4" {F}/>
  <path d="M47,52.2 H61 V54.6 L58.8,57 H49.2 L47,54.6 Z" {F}/>
  <rect x="49.3" y="56.8" width="9.4" height="9.6" {F}/>
  <path d="M46.2,66.2 H61.8 V68.8 L59.6,71.2 H48.4 L46.2,68.8 Z" {F}/>
  <rect x="48.4" y="71" width="11.2" height="11.2" {F}/>
  <rect x="47.4" y="82" width="13.2" height="3.6" rx="0.8" {F}/>
  </g>
  <path d="{CRESCENT}" {F}/>
"""
    return f"""
  <ellipse cx="55.5" cy="86.2" rx="12" ry="2.2" fill="#000" opacity="0.55" filter="url(#soft)"/>
  <g filter="url(#drop)" transform="translate(54,0) scale(1.24,1) translate(-54,0)">
    <!-- base plinth -->
    <rect x="47.4" y="82" width="13.2" height="3.6" rx="0.8" fill="url(#gold)"/>
    <ellipse cx="54" cy="82.1" rx="6.6" ry="0.8" fill="#FFF3B5" opacity="0.85"/>
    <!-- main shaft -->
    <rect x="48.4" y="70.8" width="11.2" height="11.4" fill="url(#stone)"/>
    <rect x="48.4" y="74.2" width="11.2" height="0.9" fill="url(#gold)" opacity="0.85"/>
    {windows(76.2, 6.0, [52.4], 3.2)}
    <!-- lower balcony with muqarnas bracket -->
    <path d="M48.4,68.8 L59.6,68.8 L59.6,71.2 L48.4,71.2 Z" fill="#6E4A0A" opacity="0.35"/>
    <path d="M46.2,66.2 H61.8 V68.8 L59.6,71.0 Q54,72.4 48.4,71.0 L46.2,68.8 Z" fill="url(#gold)"/>
    <ellipse cx="54" cy="66.3" rx="7.8" ry="1.0" fill="#FFF3B5" opacity="0.9"/>
    <path d="M48.4,70.9 Q54,72.3 59.6,70.9" stroke="#5E3D06" stroke-width="0.35" fill="none" opacity="0.6"/>
    <!-- middle shaft -->
    <rect x="49.3" y="56.8" width="9.4" height="9.6" fill="url(#stone)"/>
    {windows(59.0, 5.2, [50.9, 54.9], 2.2)}
    <!-- upper balcony -->
    <path d="M47,52.2 H61 V54.6 L58.8,56.8 Q54,58.1 49.2,56.8 L47,54.6 Z" fill="url(#gold)"/>
    <ellipse cx="54" cy="52.3" rx="7" ry="0.9" fill="#FFF3B5" opacity="0.9"/>
    <path d="M49.2,56.7 Q54,58.0 58.8,56.7" stroke="#5E3D06" stroke-width="0.35" fill="none" opacity="0.6"/>
    <!-- lantern -->
    <rect x="50" y="45" width="8" height="7.4" fill="url(#stone)"/>
    {windows(46.4, 5.0, [51.2, 54.8], 2.0)}
    <!-- onion dome -->
    <path d="M48.8,45.2 C48.8,40.5 51.5,38.6 54,37.4 C56.5,38.6 59.2,40.5 59.2,45.2 Z" fill="url(#dome)"/>
    <path d="M50.6,43.6 C50.8,41.4 52.0,40.0 53.4,39.2" stroke="#FFFBE6" stroke-width="0.6" stroke-linecap="round" fill="none" opacity="0.85"/>
    <rect x="48.6" y="44.6" width="10.8" height="0.9" rx="0.3" fill="url(#gold)"/>
    <!-- finial -->
    <rect x="53.4" y="33.6" width="1.2" height="4" fill="url(#gold)"/>
    <circle cx="54" cy="35.6" r="1.35" fill="url(#dome)"/>
  </g>
  <!-- golden crescent -->
  <g filter="url(#glow)">
    <path d="{CRESCENT}" fill="url(#crescent)" stroke="#8A5A0B" stroke-width="0.25"/>
  </g>
  <path d="M47.9,28.7 A6.2,6.2 0 0,0 51.4,33.2" stroke="#FFFBE0" stroke-width="0.6" stroke-linecap="round" fill="none" opacity="0.9"/>
"""

def svg(body, size=108):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 108 108">{DEFS}{body}</svg>\n'

open("icon_background.svg", "w").write(svg(background_body()))
open("icon_foreground.svg", "w").write(svg(foreground_body()))
open("icon_full.svg", "w").write(svg(background_body() + foreground_body()))
open("icon_monochrome.svg", "w").write(svg(foreground_body(mono=True)))
print(CRESCENT)
