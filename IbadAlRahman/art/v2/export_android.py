"""Exports the v2 identity into Android resources (run after icon_v2.py)."""
import importlib.util, io, contextlib, re

spec = importlib.util.spec_from_file_location("iv", "icon_v2.py")
iv = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    spec.loader.exec_module(iv)

RES = "../../app/src/main/res/drawable/"

def path_el(d, color, indent, evenodd=False):
    pad = " " * indent
    ft = f'\n{pad}    android:fillType="evenOdd"' if evenodd else ""
    return f'{pad}<path\n{pad}    android:fillColor="{color}"{ft}\n{pad}    android:pathData="{d}" />\n'

def rect(x, y, w, h):
    return f"M{x},{y}h{w}v{h}h{-w}z"

SHAPES = [
    (f"{iv.OUTER} {iv.INNER}", True),
    (rect(31.8, 80.2, 44.4, 2.4), False),
    (iv.CRESCENT, False),
    (rect(47.8, 76.4, 12.4, 3.4), False),
    (rect(49.4, 64.6, 9.2, 11.9), False),
    ("M47.6,62.4H60.4V64.4L58.6,66.2Q54,67.3 49.4,66.2L47.6,64.4Z", False),
    (rect(50.2, 54.6, 7.6, 7.9), False),
    ("M48.9,52.6H59.1V54.4L57.6,55.8Q54,56.7 50.4,55.8L48.9,54.4Z", False),
    (rect(50.9, 47.4, 6.2, 5.4), False),
    ("M50.3,47.6C50.3,44.6 52.2,43.3 54,42.4C55.8,43.3 57.7,44.6 57.7,47.6Z", False),
    (rect(53.55, 40.6, 0.9, 2.2), False),
    (iv.star4(54, 86.6, 2.6), False),
]

def vector(size_dp, vw, vh, tx, ty, color, shapes=SHAPES):
    body = "".join(path_el(d, color, 8, eo) for d, eo in shapes)
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            f'    android:width="{size_dp}dp"\n    android:height="{size_dp}dp"\n'
            f'    android:viewportWidth="{vw}"\n    android:viewportHeight="{vh}">\n'
            f'    <group\n        android:translateX="{tx}"\n        android:translateY="{ty}">\n'
            f"{body}    </group>\n</vector>\n")

open(RES + "ic_launcher_monochrome.xml", "w").write(vector(108, 108, 108, 0, 0, "#FF000000"))
# Notification / tile glyph: crop the arch (x 31..77, y 19..90) into a square viewport.
open(RES + "ic_stat_minaret.xml", "w").write(vector(24, 72, 72, -18, -18.5, "#FFFFFFFF"))
open(RES + "ic_minaret_gold.xml", "w").write(vector(24, 72, 72, -18, -18.5, "#FFD4AF37"))
