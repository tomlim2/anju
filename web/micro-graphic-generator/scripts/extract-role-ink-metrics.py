#!/usr/bin/env python3
# Aggregate per-role ink extents (em-normalized inkTop/inkBottom) from the
# bundled fonts, for typography-metrics-data.js. Roles map to fonts as in
# config.js TYPEFACES. Run from the module root; prints values to paste in.
import re
import string
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

ROLE_FONT = {
    "english": {400: "fonts/SUIT-Regular.woff2", 700: "fonts/SUIT-Bold.woff2", 900: "fonts/SUIT-Heavy.woff2"},
    "korean":  {400: "fonts/SUIT-Regular.woff2", 700: "fonts/SUIT-Bold.woff2", 900: "fonts/SUIT-Heavy.woff2"},
    "mono":    {400: "fonts/NotoSansMono-Regular.ttf", 700: "fonts/NotoSansMono-Bold.ttf", 900: "fonts/NotoSansMono-Black.ttf"},
    "chinese": {400: "fonts/GlowSansSC-Regular.woff2", 700: "fonts/GlowSansSC-Bold.woff2", 900: "fonts/GlowSansSC-Heavy.woff2"},
    "hanja":   {400: "fonts/GlowSansSC-Regular.woff2", 700: "fonts/GlowSansSC-Bold.woff2", 900: "fonts/GlowSansSC-Heavy.woff2"},
}


def role_chars():
    vocab = open("src/vocabulary.js", encoding="utf-8").read()
    hangul = sorted(set(re.findall(r"[가-힣]", vocab)))
    cjk = sorted(set(re.findall(r"[一-鿿]", vocab)) | set("林"))
    latin = list(string.ascii_uppercase + string.digits + "!?()-/.:%#@+&")
    return {"english": latin, "korean": hangul, "mono": latin, "chinese": cjk, "hanja": cjk}


def role_ink(path, chars):
    f = TTFont(path)
    upm = f["head"].unitsPerEm
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    top, bot, n = -9.0, 9.0, 0
    for ch in chars:
        cp = ord(ch)
        if cp not in cmap:
            continue
        pen = BoundsPen(gs)
        gs[cmap[cp]].draw(pen)
        if pen.bounds is None:
            continue
        _, yMin, _, yMax = pen.bounds
        top = max(top, yMax / upm)
        bot = min(bot, yMin / upm)
        n += 1
    return round(top, 4), round(bot, 4), n


def main():
    chars = role_chars()
    for role, weights in ROLE_FONT.items():
        for w in (400, 700, 900):
            t, b, n = role_ink(weights[w], chars[role])
            print(f"{role} {w}: inkTop={t} inkBottom={b} (n={n})")


if __name__ == "__main__":
    main()
