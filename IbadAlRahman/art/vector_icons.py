"""Writes the monochrome launcher layer and the status-bar glyph as VectorDrawables."""
import importlib.util, io, contextlib

spec = importlib.util.spec_from_file_location("ip", "icon_parts.py")
ip = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()):
    spec.loader.exec_module(ip)

def rect(x, y, w, h): return f"M{x},{y}h{w}v{h}h{-w}z"
def circle(cx, cy, r): return f"M{cx - r},{cy}a{r},{r} 0 1,0 {2 * r},0a{r},{r} 0 1,0 {-2 * r},0z"

BODY = [
    rect(53.4, 33.6, 1.2, 4),
    circle(54, 35.6, 1.35),
    "M48.8,45.2C48.8,40.5 51.5,38.6 54,37.4C56.5,38.6 59.2,40.5 59.2,45.2Z",
    rect(50, 45, 8, 7.4),
    "M47,52.2H61V54.6L58.8,56.8Q54,58.1 49.2,56.8L47,54.6Z",
    rect(49.3, 56.8, 9.4, 9.6),
    "M46.2,66.2H61.8V68.8L59.6,71Q54,72.4 48.4,71L46.2,68.8Z",
    rect(48.4, 71, 11.2, 11.2),
    rect(47.4, 82, 13.2, 3.6),
]

def path(data, color, indent):
    pad = " " * indent
    return f'{pad}<path\n{pad}    android:fillColor="{color}"\n{pad}    android:pathData="{data}" />\n'

def vector(size_dp, viewport, tx, ty, color):
    body = "".join(path(d, color, 12) for d in BODY)
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        f'    android:width="{size_dp}dp"\n    android:height="{size_dp}dp"\n'
        f'    android:viewportWidth="{viewport}"\n    android:viewportHeight="{viewport}">\n'
        f'    <group\n        android:translateX="{tx}"\n        android:translateY="{ty}">\n'
        '        <group\n            android:pivotX="54"\n            android:scaleX="1.24">\n'
        f"{body}"
        "        </group>\n"
        f"{path(ip.CRESCENT, color, 8)}"
        "    </group>\n</vector>\n"
    )

R = "../app/src/main/res/drawable/"
open(R + "ic_launcher_monochrome.xml", "w").write(vector(108, 108, 0, 0, "#FF000000"))
open(R + "ic_stat_minaret.xml", "w").write(vector(24, 70, -19, -18.5, "#FFFFFFFF"))
open(R + "ic_minaret_gold.xml", "w").write(vector(24, 70, -19, -18.5, "#FFE8C468"))
