#!/usr/bin/env python3
"""Bundle the PWA into one self-contained HTML file running on the in-browser mock backend.

Output: demo/index.html  (deployable to GitHub Pages or any static host).
"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
web = root / "backend" / "web"
out = root / "demo" / "index.html"

css = (web / "app.css").read_text()
js = []
for name in ["mock.js", "offline.js", "api.js", "lean.js", "charts.js", "i18n.js", "app.js"]:
    src = (web / "js" / name).read_text()
    src = re.sub(r"^import .*?;\n", "", src, flags=re.M)        # modules are concatenated
    src = re.sub(r"^export (async function|function|const|class|let)", r"\1", src, flags=re.M)
    js.append(f"// ---- {name} ----\n{src}")

html = (web / "index.html").read_text()
icon = (web / "icons" / "icon.svg").read_text().strip()
import base64
icon_uri = "data:image/svg+xml;base64," + base64.b64encode(icon.encode()).decode()
html = html.replace('<link rel="manifest" href="/manifest.webmanifest">\n', "")
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="claude:viewport-fit-sides" content="cover">')
html = html.replace('<meta name="theme-color" content="#0f1c17">\n', "")
html = html.replace('href="/icons/icon.svg"', f'href="{icon_uri}"')
html = html.replace('<link rel="stylesheet" href="/app.css">', f"<style>\n{css}\n</style>")
html = html.replace('<title>Digital Kaizen</title>', '<title>Digital Kaizen Demo</title>')
html = html.replace('<script type="module" src="/js/app.js"></script>',
                    "<script>window.KAIZEN_DEMO = true;</script>\n<script type=\"module\">\n" + "\n".join(js) + "\n</script>")
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
