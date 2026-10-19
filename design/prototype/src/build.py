import re, glob, os, json, sys
base = os.path.dirname(os.path.abspath(__file__))
icdir = os.path.join(base, 'node_modules/lucide-static/icons')
avail = {f[:-4] for f in os.listdir(icdir)}
only = sys.argv[2].split(',') if len(sys.argv) > 2 else None
order = ['core.js'] + sorted(f for f in os.listdir(base) if f.startswith('screens-') and f.endswith('.js') and (only is None or f in only))
js = {f: open(f'{base}/{f}', encoding='utf-8').read() for f in order}
alljs = '\n'.join(js.values())
names = set(re.findall(r"['\"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)*)['\"`]", alljs)) & avail
# also icon('x' patterns not matched by avail -> report
called = set(re.findall(r"\bic(?:on)?\(\s*['\"]([a-z0-9-]+)['\"]", alljs)) | set(re.findall(r"icon:\s*['\"]([a-z0-9-]+)['\"]", alljs))
missing = sorted(called - avail)
icons = {}
for n in sorted(names):
    s = open(f'{icdir}/{n}.svg', encoding='utf-8').read()
    inner = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', s, flags=re.S).strip()
    inner = re.sub(r'\s*\n\s*', '', inner)
    icons[n] = inner
css = open(f'{base}/styles.css', encoding='utf-8').read()
html = f'''<title>OCOP Tỉnh Mẫu</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap">
<style>
{css}
</style>
<div class="page-wrap"><div id="app" class="app"></div></div>
<script>window.ICONS={json.dumps(icons, ensure_ascii=False)};</script>
''' + ''.join(f'<script>\n{js[f]}\n</script>\n' for f in order) + '<script>OCOP.start();</script>\n'
out = sys.argv[1] if len(sys.argv) > 1 else base + '/../ocop-prototype.html'
open(out, 'w', encoding='utf-8').write(html)
print('files', order, 'icons', len(icons), 'missing', missing, 'bytes', len(html.encode()))
