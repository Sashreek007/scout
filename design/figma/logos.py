import base64, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
FAV_DIR = os.path.join(ASSETS, "favicons")
_SI = json.load(open(os.path.join(ASSETS, "simple-icons.json")))["icons"]
_SI_HEX = {k: v["hex"] for k, v in _SI.items()}

def si_path(slug):
    return _SI[slug]["path"]

def lum(h):
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def si_color(slug, on_dark=True):
    h = _SI_HEX.get(slug, "FFFFFF")
    if on_dark and lum(h) < 0.28: return "#ECECEC"
    return "#" + h

def si_svg(slug, size=16, color=None):
    c = color or si_color(slug)
    return (f'<svg class="logo-si" aria-label="logo:{slug}:{c}" width="{size}" height="{size}" viewBox="0 0 24 24" '
            f'xmlns="http://www.w3.org/2000/svg" style="width:{size}px;height:{size}px;flex-shrink:0"><path fill="{c}" d="{si_path(slug)}"/></svg>')

def si_datauri(slug, color=None):
    c = color or si_color(slug)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="{c}" d="{si_path(slug)}"/></svg>'
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()

def fav_datauri(domain):
    return "data:image/png;base64," + base64.b64encode(open(os.path.join(FAV_DIR, domain + ".png"), "rb").read()).decode()

# company -> ("si", slug) | ("fav", domain) | ("mono", letters, color)
COMPANY = {
 "Shopify": ("si", "shopify"), "Google": ("si", "google"), "Intel": ("si", "intel"), "Qualcomm": ("si", "qualcomm"), "EA": ("si", "ea"),
 "Clio": ("fav", "clio.com"), "Cohere": ("fav", "cohere.com"), "Element Fleet": ("fav", "elementfleet.com"), "Element Fleet Management": ("fav", "elementfleet.com"),
 "Northstar Avionics": ("mono", "N", "#4B6BFB"), "Maple Secure Networks": ("mono", "M", "#D9534F"),
 "Wealthsimple": ("fav", "wealthsimple.com"), "Ciena": ("fav", "ciena.com"), "Equitable Bank": ("fav", "eqbank.ca"),
 "Nelnet": ("fav", "nelnet.com"), "Rodan Energy": ("mono", "R", "#E0763C"), "Rodan Energy Solutions": ("mono", "R", "#E0763C"),
 "TechInsights": ("fav", "techinsights.com"), "DataVisor": ("fav", "datavisor.com"), "BiblioCommons": ("fav", "bibliocommons.com"),
 "Boston Scientific": ("fav", "bostonscientific.com"), "General Dynamics Mission Systems": ("fav", "gdmissionsystems.com"),
 "Semtech": ("fav", "semtech.com"), "CodeSignal": ("fav", "codesignal.com"),
 "Northwind Robotics": ("mono", "N", "#7C5CFF"), "Northwind": ("mono", "N", "#7C5CFF"), "Acme Data Labs": ("mono", "A", "#E0763C"),
 "Lakeside Robotics": ("mono", "L", "#2F9E8F"), "Prairie Analytics": ("mono", "P", "#C9A227"), "ShopNorth": ("mono", "S", "#3E7BFA"),
}
BOARD = {"gh": ("si", "greenhouse"), "lv": ("fav", "lever.co"), "ab": ("fav", "ashbyhq.com"), "wd": ("fav", "workday.com"), "ot": ("mono", "?", "#555555")}

def tile(spec, size=22, radius=6):
    inner = int(size * 0.62)
    kind = spec[0]
    base = f'width:{size}px;height:{size}px;min-width:{size}px;border-radius:{radius}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;'
    if kind == "si":
        return f'<span class="ltile" style="{base}background:#FFFFFF">{si_svg(spec[1], inner, "#"+_SI_HEX.get(spec[1],"000000"))}</span>'
    if kind == "fav":
        return f'<span class="ltile" style="{base}background:#FFFFFF"><img src="{fav_datauri(spec[1])}" width="{inner+2}" height="{inner+2}" style="width:{inner+2}px;height:{inner+2}px;display:block"></span>'
    letters, color = spec[1], spec[2]
    return f'<span class="ltile" style="{base}background:{color};color:#FFFFFF;font-weight:600;font-size:{int(size*0.5)}px">{letters}</span>'

def company_logo(name, size=22, radius=6):
    spec = COMPANY.get(name.strip())
    if not spec:
        spec = ("mono", name.strip()[:1].upper(), "#4A4A4A")
    return tile(spec, size, radius)

def board_logo(k, size=16, radius=4):
    return tile(BOARD[k], size, radius)

def google_g(size=16):
    return (f'<svg class="logo-si" aria-label="logo:google-g:multi" width="{size}" height="{size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:{size}px;height:{size}px;flex-shrink:0">'
            '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
            '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
            '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
            '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>')
