from base import icon
from logos import company_logo
def page_mock(company, title, fields, active, typed, agent, scale=1.0, board="Greenhouse"):
    s = scale
    rows = []
    for i,(lab,val) in enumerate(fields):
        on = i == active
        border = f"2px solid #2DD4BF" if on else "1px solid #D4D4D8"
        v = (typed + '<span style="display:inline-block;width:1px;height:%dpx;background:#111;margin-left:1px;vertical-align:middle"></span>' % int(14*s)) if on else val
        tag = f'<span style="position:absolute;right:{int(-6*s)}px;top:{int(-11*s)}px;background:#2DD4BF;color:#0D0D0D;font-size:{max(7,int(10*s))}px;font-weight:600;padding:{int(1*s)}px {int(6*s)}px;border-radius:{int(6*s)}px">{agent}</span>' if on else ""
        rows.append(f'<div style="display:flex;flex-direction:column;gap:{int(4*s)}px"><span style="font-size:{max(6,int(12*s))}px;color:#3F3F46;font-weight:500">{lab}</span><div style="position:relative;height:{int(30*s)}px;border:{border};border-radius:{int(6*s)}px;background:#FFFFFF;display:flex;align-items:center;padding:0 {int(9*s)}px;font-size:{max(6,int(12.5*s))}px;color:#18181B">{v}{tag}</div></div>')
    return f'''<div style="background:#FFFFFF;flex:1;display:flex;flex-direction:column;gap:{int(14*s)}px;padding:{int(22*s)}px {int(26*s)}px;overflow:hidden">
<div style="display:flex;align-items:center;gap:{int(10*s)}px">{company_logo(company,int(30*s),int(7*s))}<div style="display:flex;flex-direction:column"><b style="font-size:{max(7,int(16*s))}px;color:#18181B;font-weight:600">{title}</b><span style="font-size:{max(6,int(11.5*s))}px;color:#71717A">{company}, apply with {board}</span></div></div>
<div style="height:1px;background:#E4E4E7"></div>{"".join(rows)}</div>'''

def chrome_bar(domain, s=1.0):
    dots = "".join(f'<span style="width:{int(9*s)}px;height:{int(9*s)}px;border-radius:50%;background:{c};display:inline-block"></span>' for c in ["#FF5F57","#FEBC2E","#28C840"])
    return f'''<div style="height:{int(34*s)}px;background:#2B2B2B;display:flex;align-items:center;gap:{int(10*s)}px;padding:0 {int(10*s)}px;flex-shrink:0">
<span style="display:inline-flex;gap:{int(5*s)}px">{dots}</span>
<div style="flex:1;height:{int(22*s)}px;border-radius:999px;background:#1E1E1E;display:flex;align-items:center;gap:{int(6*s)}px;padding:0 {int(10*s)}px;color:#B4B4B4;font-size:{max(7,int(12*s))}px">{icon("lock","#8F8F8F",max(8,int(12*s)))}{domain}</div></div>'''

def thumb(domain, company, title, fields, active, typed, agent, w=330, h=170, live=True):
    s = 0.62
    badge = '<span style="position:absolute;left:8px;bottom:8px;display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,0.7);color:#ECECEC;font-size:11px;padding:2px 8px;border-radius:999px"><span style="width:6px;height:6px;border-radius:50%;background:#F87171"></span>Live</span>' if live else ""
    return f'''<div style="position:relative;margin:0 12px;height:{h}px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.10);display:flex;flex-direction:column">
{chrome_bar(domain, s)}{page_mock(company, title, fields, active, typed, agent, s)}{badge}
<span style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,0.7);color:#ECECEC;font-size:11px;padding:2px 8px;border-radius:999px">Click to watch</span></div>'''
