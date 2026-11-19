"""Inline dev/color.css, color.html, color.js + ui.js into index.html.

Idempotent: each block sits between markers and is replaced on rebuild.
Run:  python dev/build.py
"""
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
page = root / "index.html"
h = page.read_text(encoding="utf-8")
dev = root / "dev"
blocks = {
    "css": ("/*<spc-css>*/", "/*</spc-css>*/", (dev / "color.css").read_text(encoding="utf-8")),
    "html": ("<!--<spc-html>-->", "<!--</spc-html>-->", (dev / "color.html").read_text(encoding="utf-8")),
    "js": ("/*<spc-js>*/", "/*</spc-js>*/",
           (dev / "color.js").read_text(encoding="utf-8") + "\n" + (dev / "ui.js").read_text(encoding="utf-8")),
}


def put(h, key, anchor_fn):
    s, e, body = blocks[key]
    block = f"{s}\n{body}\n{e}"
    if s in h:
        a, b = h.index(s), h.index(e) + len(e)
        return h[:a] + block + h[b:]
    i = anchor_fn(h)
    return h[:i] + block + "\n" + h[i:]


head_end = lambda h: h.rindex("</style>", 0, h.index("</head>"))
h = put(h, "css", head_end)
h = put(h, "html", lambda h: h.index('<div class="conv">'))
h = put(h, "js", lambda h: h.rindex("</script>"))
page.write_text(h, encoding="utf-8")
print("index.html", len(h.encode()), "bytes")
