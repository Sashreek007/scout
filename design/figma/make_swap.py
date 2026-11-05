"""Build the Figma script that swaps imported icons and logos for clean vectors.

html_to_figma mangles SVG arcs, so every icon and logo in the generated HTML
carries aria-label="icon:<name>:<stroke>" or "logo:<slug>:<colour>", which the
importer turns into a frame named "Icon - icon:...". This prints a use_figma
script that replaces each of those frames on one page with a clean vector.

    python3 make_swap.py "Desktop" desktop1.html desktop2.html > swap.js
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import base, logos

page_name, files = sys.argv[1], sys.argv[2:]
html = "".join(open(f).read() for f in files)
labels = set(re.findall(r'aria-label="((?:icon|logo):[^"]+)"', html))
icons = {l.split(":")[1]: base._inner(l.split(":")[1]) for l in labels if l.startswith("icon:")}
paths = {l.split(":")[1]: logos.si_path(l.split(":")[1]) for l in labels if l.startswith("logo:") and "google-g" not in l}
g = logos.google_g(24)
gg = g[g.index(">") + 1:g.rindex("</svg>")]
print(f"""const ICONS = {json.dumps(icons)};
const LOGOS = {json.dumps(paths)};
const GG = {json.dumps(gg)};
const page = figma.root.children.find(p => p.name === {json.dumps(page_name)});
await figma.setCurrentPageAsync(page);
let done = 0; const miss = [];
for (const f of page.findAll(n => n.type === "FRAME" && n.name.startsWith("Icon - "))) {{
  const parent = f.parent; const [kind, name, extra] = f.name.slice(7).split(":");
  const size = Math.round(f.width); let svg;
  if (kind === "icon" && ICONS[name]) {{
    let color = "#ECECEC";
    const v = f.findOne(n => "strokes" in n && n.strokes && n.strokes.length && n.strokes[0].type === "SOLID");
    if (v) {{ const c = v.strokes[0].color; const h = x => Math.round(x*255).toString(16).padStart(2,"0"); color = "#" + h(c.r) + h(c.g) + h(c.b); }}
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${{size}}" height="${{size}}" viewBox="0 0 24 24" fill="none" stroke="${{color}}" stroke-width="${{extra}}" stroke-linecap="round" stroke-linejoin="round">${{ICONS[name]}}</svg>`;
  }} else if (name === "google-g") {{
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${{size}}" height="${{size}}" viewBox="0 0 48 48">${{GG}}</svg>`;
  }} else if (kind === "logo" && LOGOS[name]) {{
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${{size}}" height="${{size}}" viewBox="0 0 24 24"><path fill="${{extra}}" d="${{LOGOS[name]}}"/></svg>`;
  }} else {{ miss.push(f.name); continue; }}
  const node = figma.createNodeFromSvg(svg); node.name = kind + "/" + name;
  parent.insertChild(parent.children.indexOf(f), node);
  if (!(parent.layoutMode && parent.layoutMode !== "NONE" && f.layoutPositioning !== "ABSOLUTE")) {{ node.x = f.x; node.y = f.y; }}
  node.resize(size, size); f.remove(); done++;
}}
return {{ done, miss }};""")
