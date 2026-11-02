"""Generate the workbench icon: a data grid with one column selected.

SVG is the source of truth; the PNGs are rasterised from the same geometry.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

SIZE = 512
RADIUS = 116
BG = (31, 32, 33, 255)          # charcoal panel
CELL = (64, 66, 69, 255)        # muted grid cell
ACCENT = (122, 162, 255, 255)   # the selected column

COLS, ROWS = 4, 3
CELLW, GAP, CRADIUS = 78, 13, 12
ACCENT_COL = 1

SPAN_X = COLS * CELLW + (COLS - 1) * GAP
SPAN_Y = ROWS * CELLW + (ROWS - 1) * GAP
X0 = (SIZE - SPAN_X) // 2
Y0 = (SIZE - SPAN_Y) // 2


def cell_xy(r, c):
    return X0 + c * (CELLW + GAP), Y0 + r * (CELLW + GAP)


def draw(size):
    s = 4                                   # supersample, then downscale
    img = Image.new("RGBA", (size * s, size * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size * s / SIZE
    d.rounded_rectangle([0, 0, size * s - 1, size * s - 1], radius=RADIUS * k, fill=BG)
    for r in range(ROWS):
        for c in range(COLS):
            x, y = cell_xy(r, c)
            d.rounded_rectangle([x * k, y * k, (x + CELLW) * k, (y + CELLW) * k],
                                radius=CRADIUS * k,
                                fill=ACCENT if c == ACCENT_COL else CELL)
    return img.resize((size, size), Image.LANCZOS)


def svg():
    cells = []
    for r in range(ROWS):
        for c in range(COLS):
            x, y = cell_xy(r, c)
            fill = "#7aa2ff" if c == ACCENT_COL else "#404245"
            cells.append(f'  <rect x="{x}" y="{y}" width="{CELLW}" height="{CELLW}" '
                         f'rx="{CRADIUS}" fill="{fill}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
            f'width="{SIZE}" height="{SIZE}" role="img" aria-label="workbench">\n'
            f'  <rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" fill="#1f2021"/>\n'
            + "\n".join(cells) + "\n</svg>\n")


def icns():
    """A macOS .icns, built by hand: the container is a magic header followed by
    typed chunks that may hold PNG data directly. No iconutil needed."""
    import struct
    chunks = []
    for typ, px in (("ic11", 32), ("ic12", 64), ("ic07", 128),
                    ("ic13", 256), ("ic08", 256), ("ic14", 512),
                    ("ic09", 512), ("ic10", 1024)):
        import io
        buf = io.BytesIO()
        draw(px).save(buf, format="PNG")
        data = buf.getvalue()
        chunks.append(typ.encode("ascii") + struct.pack(">I", len(data) + 8) + data)
    body = b"".join(chunks)
    return b"icns" + struct.pack(">I", len(body) + 8) + body


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8") as fh:
        fh.write(svg())
    for px in (512, 180, 32, 16):
        draw(px).save(os.path.join(OUT, f"icon-{px}.png"))
    # a real .ico so the steady stream of /favicon.ico 404s stops
    draw(64).save(os.path.join(OUT, "favicon.ico"),
                  sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    # and a .icns for the .app bundle
    with open(os.path.join(OUT, "AppIcon.icns"), "wb") as fh:
        fh.write(icns())
    for f in sorted(os.listdir(OUT)):
        if f.startswith(("icon", "favicon")):
            print(f"  {f:16} {os.path.getsize(os.path.join(OUT, f)):>7} bytes")
