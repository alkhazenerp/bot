"""Andalusian visual identity for عباد الرحمن (v2).

Generates SVGs on the 108x108 adaptive-icon grid:
  icon_background.svg  icon_foreground.svg  icon_full.svg  icon_full_light.svg
  icon_full_black.svg  icon_monochrome.svg  logo_mark.svg (transparent, cropped)
Palette: deep teal #0E4D47, gold #D4AF37, turquoise #6ED1C5, royal purple #4B3A7A, cream #F5E6C8.
"""
import math

def f(x):
    return f"{x:.2f}"

# ---------------------------------------------------------------- arch geometry
CX = 54.0

def arch_path(half_w, base_y, shoulder_y, apex_y, spike=0.0):
    """Ogee (Andalusian) arch: straight sides, S-curve up to a pointed apex."""
    l, r = CX - half_w, CX + half_w
    h = shoulder_y - apex_y
    # Right half goes apex -> shoulder; left half mirrors it.
    p = [f"M{f(l)},{f(base_y)}", f"L{f(l)},{f(shoulder_y)}"]
    # left: shoulder -> bulge -> apex (ogee: convex then concave near apex)
    p.append(f"C{f(l)},{f(shoulder_y - h*0.55)} {f(l + half_w*0.30)},{f(apex_y + h*0.42)} {f(CX - half_w*0.12)},{f(apex_y + h*0.16)}")
    p.append(f"C{f(CX - half_w*0.05)},{f(apex_y + h*0.08)} {f(CX - 0.6)},{f(apex_y + 1.2)} {f(CX)},{f(apex_y - spike)}")
    p.append(f"C{f(CX + 0.6)},{f(apex_y + 1.2)} {f(CX + half_w*0.05)},{f(apex_y + h*0.08)} {f(CX + half_w*0.12)},{f(apex_y + h*0.16)}")
    p.append(f"C{f(r - half_w*0.30)},{f(apex_y + h*0.42)} {f(r)},{f(shoulder_y - h*0.55)} {f(r)},{f(shoulder_y)}")
    p.append(f"L{f(r)},{f(base_y)} Z")
    return " ".join(p)

OUTER = arch_path(20.5, 81.0, 47.0, 22.5, spike=3.2)
INNER = arch_path(15.6, 81.0, 49.0, 29.0, spike=0.8)

def crescent_path(cx, cy, R, icx, icy, r):
    dx, dy = icx - cx, icy - cy
    d = math.hypot(dx, dy)
    a = (R * R - r * r + d * d) / (2 * d)
    h = math.sqrt(R * R - a * a)
    mx, my = cx + a * dx / d, cy + a * dy / d
    p1 = (mx + h * dy / d, my - h * dx / d)
    p2 = (mx - h * dy / d, my + h * dx / d)
    return f"M{f(p1[0])},{f(p1[1])} A{R},{R} 0 1,0 {f(p2[0])},{f(p2[1])} A{r},{r} 0 0,1 {f(p1[0])},{f(p1[1])} Z"

CRESCENT = crescent_path(54, 36.6, 5.0, 54, 34.0, 4.35)

def star4(x, y, s, k=0.22):
    return (f"M{f(x)},{f(y-s)} Q{f(x+k*s)},{f(y-k*s)} {f(x+s)},{f(y)} Q{f(x+k*s)},{f(y+k*s)} {f(x)},{f(y+s)} "
            f"Q{f(x-k*s)},{f(y+k*s)} {f(x-s)},{f(y)} Q{f(x-k*s)},{f(y-k*s)} {f(x)},{f(y-s)} Z")

# ---------------------------------------------------------------- girih lattice (8-point stars)
def girih(cell, x0, y0, x1, y1):
    out = []
    y = y0
    while y < y1 + cell:
        x = x0
        while x < x1 + cell:
            r = cell * 0.42
            pts = []
            for i in range(16):
                ang = math.pi / 8 * i - math.pi / 2
                rr = r if i % 2 == 0 else r * 0.62
                pts.append((x + rr * math.cos(ang), y + rr * math.sin(ang)))
            out.append("M" + " L".join(f"{f(px)},{f(py)}" for px, py in pts) + " Z")
            # connecting cross lines
            out.append(f"M{f(x + r)},{f(y)} L{f(x + cell - r)},{f(y)} M{f(x)},{f(y + r)} L{f(x)},{f(y + cell - r)}")
            x += cell
        y += cell
    return " ".join(out)

DEFS = f"""
<defs>
  <radialGradient id="bgTeal" cx="50%" cy="38%" r="78%">
    <stop offset="0" stop-color="#1B6E66"/><stop offset="0.5" stop-color="#0E4D47"/><stop offset="1" stop-color="#05201D"/>
  </radialGradient>
  <radialGradient id="bgCream" cx="50%" cy="35%" r="80%">
    <stop offset="0" stop-color="#FFFBF2"/><stop offset="0.6" stop-color="#F5E6C8"/><stop offset="1" stop-color="#E6CFA2"/>
  </radialGradient>
  <radialGradient id="bgBlack" cx="50%" cy="38%" r="80%">
    <stop offset="0" stop-color="#26302E"/><stop offset="1" stop-color="#070909"/>
  </radialGradient>
  <radialGradient id="halo" cx="54" cy="44" r="34" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#6ED1C5" stop-opacity="0.30"/><stop offset="0.55" stop-color="#6ED1C5" stop-opacity="0.08"/><stop offset="1" stop-color="#6ED1C5" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFF4C2"/><stop offset="0.28" stop-color="#F1CF63"/><stop offset="0.55" stop-color="#D4AF37"/>
    <stop offset="0.8" stop-color="#A9801C"/><stop offset="1" stop-color="#F3D774"/>
  </linearGradient>
  <linearGradient id="goldH" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#8E6510"/><stop offset="0.3" stop-color="#FFF0A8"/><stop offset="0.6" stop-color="#D4AF37"/><stop offset="1" stop-color="#7A5208"/>
  </linearGradient>
  <linearGradient id="tealGlass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5FC2B6"/><stop offset="0.22" stop-color="#1F7F74"/><stop offset="0.55" stop-color="#0E4D47"/><stop offset="0.85" stop-color="#0B3D38"/><stop offset="1" stop-color="#2B8A7F"/>
  </linearGradient>
  <radialGradient id="niche" cx="50%" cy="30%" r="75%">
    <stop offset="0" stop-color="#145C55"/><stop offset="0.6" stop-color="#0A3532"/><stop offset="1" stop-color="#05201D"/>
  </radialGradient>
  <linearGradient id="ribbon" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#0B4A44"/><stop offset="0.45" stop-color="#2E9B8E"/><stop offset="0.7" stop-color="#7FDCD0"/><stop offset="1" stop-color="#1C7A70"/>
  </linearGradient>
  <linearGradient id="ivory" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#E6D3A8"/><stop offset="0.3" stop-color="#FFF8E6"/><stop offset="0.65" stop-color="#EAD8AE"/><stop offset="1" stop-color="#A88E5E"/>
  </linearGradient>
  <radialGradient id="dome" cx="38%" cy="30%" r="80%">
    <stop offset="0" stop-color="#FFF7CF"/><stop offset="0.4" stop-color="#EBC453"/><stop offset="0.85" stop-color="#A9801C"/><stop offset="1" stop-color="#6F4A08"/>
  </radialGradient>
  <linearGradient id="window" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#0A3F3A"/><stop offset="1" stop-color="#1F7F74"/>
  </linearGradient>
  <clipPath id="band"><path d="{OUTER} {INNER}" clip-rule="evenodd"/></clipPath>
  <clipPath id="opening"><path d="{INNER}"/></clipPath>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0.8" dy="1.4" stdDeviation="1.1" flood-color="#000" flood-opacity="0.5"/>
  </filter>
</defs>
"""

def background(kind="teal"):
    fill = {"teal": "url(#bgTeal)", "cream": "url(#bgCream)", "black": "url(#bgBlack)"}[kind]
    pat_color = "#D4AF37" if kind != "cream" else "#B8901F"
    pat_op = 0.10 if kind == "teal" else (0.14 if kind == "cream" else 0.08)
    return f"""
  <rect width="108" height="108" fill="{fill}"/>
  <path d="{girih(13.5, 0, 0, 108, 108)}" fill="none" stroke="{pat_color}" stroke-width="0.35" opacity="{pat_op}"/>
  <circle cx="54" cy="44" r="34" fill="url(#halo)"/>
"""

def minaret():
    # Compact golden minaret standing in the arch opening.
    return f"""
  <g filter="url(#drop)">
    <rect x="47.8" y="76.4" width="12.4" height="3.4" rx="0.7" fill="url(#goldH)"/>
    <ellipse cx="54" cy="76.5" rx="6.2" ry="0.7" fill="#FFF3B5" opacity="0.85"/>
    <rect x="49.4" y="64.6" width="9.2" height="11.9" fill="url(#ivory)"/>
    <path d="M52.6,76.4 V71.4 A1.4,1.4 0 0,1 55.4,71.4 V76.4 Z" fill="url(#window)"/>
    <rect x="49.4" y="67.6" width="9.2" height="0.8" fill="url(#goldH)"/>
    <path d="M47.6,62.4 H60.4 V64.4 L58.6,66.2 Q54,67.3 49.4,66.2 L47.6,64.4 Z" fill="url(#goldH)"/>
    <ellipse cx="54" cy="62.5" rx="6.4" ry="0.8" fill="#FFF3B5" opacity="0.9"/>
    <rect x="50.2" y="54.6" width="7.6" height="7.9" fill="url(#ivory)"/>
    <path d="M51.5,61.6 V58.3 A0.9,0.9 0 0,1 53.3,58.3 V61.6 Z M54.7,61.6 V58.3 A0.9,0.9 0 0,1 56.5,58.3 V61.6 Z" fill="url(#window)"/>
    <path d="M48.9,52.6 H59.1 V54.4 L57.6,55.8 Q54,56.7 50.4,55.8 L48.9,54.4 Z" fill="url(#goldH)"/>
    <ellipse cx="54" cy="52.7" rx="5.1" ry="0.7" fill="#FFF3B5" opacity="0.9"/>
    <rect x="50.9" y="47.4" width="6.2" height="5.4" fill="url(#ivory)"/>
    <path d="M52.6,52.4 V50 A0.7,0.7 0 0,1 54,50 V52.4 Z M54.2,52.4 V50 A0.7,0.7 0 0,1 55.6,50 V52.4 Z" fill="url(#window)"/>
    <path d="M50.3,47.6 C50.3,44.6 52.2,43.3 54,42.4 C55.8,43.3 57.7,44.6 57.7,47.6 Z" fill="url(#dome)"/>
    <path d="M51.5,46.6 C51.7,45.2 52.5,44.3 53.4,43.7" stroke="#FFFBE6" stroke-width="0.45" fill="none" stroke-linecap="round" opacity="0.9"/>
    <rect x="53.55" y="40.6" width="0.9" height="2.2" fill="url(#goldH)"/>
    <circle cx="54" cy="41.0" r="0.95" fill="url(#dome)"/>
  </g>
"""

def ribbon():
    # Turquoise silk sash sweeping across the base, echoing the reference's ribbon.
    return """
  <g clip-path="url(#opening)" filter="url(#drop)">
    <path d="M35,77.5 C44,73 50,70.6 56,70.2 C63,69.8 68,71.6 74,74.6 L74,78.4 C68,75.8 63,74.4 56,74.8 C50,75.2 44,77.4 35,81.6 Z" fill="url(#ribbon)"/>
    <path d="M35,77.5 C44,73 50,70.6 56,70.2 C63,69.8 68,71.6 74,74.6" stroke="#F1CF63" stroke-width="0.45" fill="none"/>
    <path d="M35,81.6 C44,77.4 50,75.2 56,74.8 C63,74.4 68,75.8 74,78.4" stroke="#B8901F" stroke-width="0.35" fill="none" opacity="0.9"/>
  </g>
"""

def frame():
    return f"""
  <path d="{OUTER}" fill="#6ED1C5" opacity="0.35" filter="url(#softGlow)"/>
  <path d="{INNER}" fill="url(#niche)"/>
  <path d="{INNER}" fill="none" stroke="#000" stroke-width="2.2" opacity="0.35" clip-path="url(#opening)" filter="url(#softGlow)"/>
  <g filter="url(#drop)">
    <path d="{OUTER} {INNER}" fill="url(#tealGlass)" fill-rule="evenodd"/>
    <g clip-path="url(#band)">
      <path d="{girih(7.0, 30, 18, 80, 84)}" fill="none" stroke="#F1CF63" stroke-width="0.32" opacity="0.6"/>
      <path d="M30,18 L54,40 L78,18 Z" fill="#FFFFFF" opacity="0.10"/>
    </g>
    <path d="{OUTER}" fill="none" stroke="url(#gold)" stroke-width="1.15" filter="url(#glow)"/>
    <path d="{INNER}" fill="none" stroke="url(#gold)" stroke-width="0.85"/>
    <rect x="31.8" y="80.2" width="44.4" height="2.4" rx="0.8" fill="url(#goldH)"/>
  </g>
"""

def crescent_and_stars():
    return f"""
  <g filter="url(#glow)">
    <path d="{CRESCENT}" fill="url(#gold)" stroke="#8A5A0B" stroke-width="0.22"/>
  </g>
  <path d="{star4(43.6, 41.5, 1.9)}" fill="#F7DD86"/>
  <path d="{star4(64.4, 41.5, 1.9)}" fill="#F7DD86"/>
  <path d="{star4(54, 86.6, 2.6)}" fill="url(#gold)" filter="url(#glow)"/>
"""

def foreground():
    return frame() + ribbon() + minaret() + crescent_and_stars()

def monochrome():
    # Single-colour silhouette for themed icons: frame band, minaret, crescent.
    F = 'fill="#000"'
    return f"""
  <path d="{OUTER} {INNER}" {F} fill-rule="evenodd"/>
  <rect x="31.8" y="80.2" width="44.4" height="2.4" {F}/>
  <path d="{CRESCENT}" {F}/>
  <rect x="47.8" y="76.4" width="12.4" height="3.4" {F}/>
  <rect x="49.4" y="64.6" width="9.2" height="11.9" {F}/>
  <path d="M47.6,62.4 H60.4 V64.4 L58.6,66.2 Q54,67.3 49.4,66.2 L47.6,64.4 Z" {F}/>
  <rect x="50.2" y="54.6" width="7.6" height="7.9" {F}/>
  <path d="M48.9,52.6 H59.1 V54.4 L57.6,55.8 Q54,56.7 50.4,55.8 L48.9,54.4 Z" {F}/>
  <rect x="50.9" y="47.4" width="6.2" height="5.4" {F}/>
  <path d="M50.3,47.6 C50.3,44.6 52.2,43.3 54,42.4 C55.8,43.3 57.7,44.6 57.7,47.6 Z" {F}/>
  <rect x="53.55" y="40.6" width="0.9" height="2.2" {F}/>
  <path d="{star4(54, 86.6, 2.6)}" {F}/>
"""

def svg(body, size=108, viewbox="0 0 108 108"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="{viewbox}">{DEFS}{body}</svg>\n'

if __name__ == "__main__":
    open("icon_background.svg", "w").write(svg(background("teal")))
    open("icon_foreground.svg", "w").write(svg(foreground()))
    open("icon_full.svg", "w").write(svg(background("teal") + foreground()))
    open("icon_full_light.svg", "w").write(svg(background("cream") + foreground()))
    open("icon_full_black.svg", "w").write(svg(background("black") + foreground()))
    open("icon_monochrome.svg", "w").write(svg(monochrome()))
    open("logo_mark.svg", "w").write(svg(foreground(), viewbox="26 15 56 76"))
