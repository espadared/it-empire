#!/usr/bin/env python3
"""Inline css/js into one self-contained page (also valid as a published Artifact)."""
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root/'index.html').read_text()
css  = (root/'css/style.css').read_text()
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = re.sub(r'<script src="[^"]+"></script>\s*', '', body)
js = '\n'.join((root/'js'/n).read_text() for n in
               ['data.js','battle-data.js','art.js','net.js','game.js','ui.js','battle.js','onboard.js','main.js'])
out = f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no">
<meta name="theme-color" content="#0E1220">
<title>IT Empire</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
{css}
</style>
{body.strip()}
<script>
{js}
</script>
"""
(root/'dist'/'it-empire.html').write_text(out)
print(f"dist/it-empire.html  {len(out)/1024:.0f} KB")
