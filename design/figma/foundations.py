from base import *
from logos import si_svg, company_logo, tile
def sw(name, var, hexv):
    return f'<div class="vstack" style="gap:6px;width:128px"><div style="height:56px;border-radius:8px;background:{ {"white 7%":"rgba(255,255,255,0.07)","white 12%":"rgba(255,255,255,0.12)"}.get(hexv,hexv) };border:1px solid var(--line2)"></div><span class="t1" style="font-size:12.5px">{name}</span><span class="mono muted">{hexv}</span></div>'
neutrals = [("Sidebar","side","#181818"),("Canvas","paper","#212121"),("Card","surface","#2A2A2A"),("Input","surface2","#303030"),("Raised","raised","#3A3A3A"),("Line","line","white 7%"),("Line strong","line2","white 12%"),("Text","ink","#ECECEC"),("Text 2","ink2","#B4B4B4"),("Muted","muted","#8F8F8F"),("Faint","faint","#6B6B6B")]
semantic = [("Primary button","pri","#FFFFFF"),("Accent","accentbtn","#346BF1"),("Link","accent","#6E9BFF"),("Success","ok","#34D399"),("Attention","amber","#FBBF24"),("Danger","red","#F87171"),("Draft","violet","#A78BFA"),("Memory","teal","#2DD4BF"),("Offer","gold","#FACC15")]
stages = "".join(stage(k) for k in STAGE_LABEL)
srcs = "".join(src(k) for k in SRC_LABEL)
flags = '<span class="flag f-values">values review</span><span class="flag f-clearance">clearance</span><span class="flag f-term">term unknown</span><span class="flag f-title">title only</span><span class="flag f-captcha">CAPTCHA</span>'
boards = "".join(ats(k) for k in ATS)
icons = "".join(f'<div class="vstack" style="align-items:center;gap:6px;width:76px">{icon(k,"#C9D1DB",20)}<span class="note">{k}</span></div>' for k in ["today","jobs","board","profile","memory","runs","stats","settings","search","alert","q","doc","mac","clock","pause","ext","spark","filter","edit","mail","google","logo"])
logos_row = "".join(f'<div class="vstack" style="align-items:center;gap:6px;width:92px">{company_logo(c,32,9)}<span class="note">{c}</span></div>' for c in ["Clio","Cohere","Shopify","Wealthsimple","Element Fleet","Northwind Robotics"]) + "".join(f'<div class="vstack" style="align-items:center;gap:6px;width:92px">{si_svg(s,26)}<span class="note">{n}</span></div>' for s,n in [("github","GitHub"),("anthropic","Claude API"),("claude","Claude"),("firebase","Firebase"),("vercel","Vercel"),("temporal","Temporal"),("googlechrome","Chrome"),("gmail","Gmail")])
def blk(title, sub, body):
    return f'<div class="card"><div class="cardh"><h2>{title}</h2><span class="sub">{sub}</span></div><div class="cardb" style="display:flex;flex-wrap:wrap;gap:14px 16px;align-items:center">{body}</div></div>'
type_scale = '''<div class="vstack" style="gap:14px;width:100%">
<div class="hstack" style="gap:24px"><span class="note" style="width:120px">Page title 26/600</span><span style="font-size:26px;font-weight:600;letter-spacing:-.5px">Wednesday, November 5</span></div>
<div class="hstack" style="gap:24px"><span class="note" style="width:120px">Topbar 17/600</span><span style="font-size:17px;font-weight:600">Answer sheet</span></div>
<div class="hstack" style="gap:24px"><span class="note" style="width:120px">Card title 15/600</span><span style="font-size:15px;font-weight:600">Ready for review</span></div>
<div class="hstack" style="gap:24px"><span class="note" style="width:120px">Body 13.5/400</span><span>The agent types exactly what you approve.</span></div>
<div class="hstack" style="gap:24px"><span class="note" style="width:120px">Meta 12.5/400</span><span class="note">Asked 7:04</span></div>
<div class="hstack" style="gap:24px"><span class="note" style="width:120px">Code 12 JetBrains Mono</span><span class="mono">work_authorization.canada</span></div></div>'''
body = f'''<div class="screen" id="Foundations" style="flex-direction:column;padding:40px;gap:20px;min-height:0">
<div class="vstack" style="gap:6px"><span style="font-size:26px;font-weight:600;letter-spacing:-.4px">scout foundations</span><span class="muted">Dark only, neutral greys with no tint, after ChatGPT and t3code. Inter for the interface, JetBrains Mono only for values that are code. Pill buttons, 18px cards, white primary button. Real logos for companies, job boards and tools; a coloured letter tile when a company has none.</span></div>
{blk("Neutrals","ChatGPT surfaces, t3code borders", "".join(sw(*n) for n in neutrals))}
{blk("Semantic colour","each colour means one thing everywhere", "".join(sw(*n) for n in semantic))}
{blk("Typography","Inter, tabular figures on", type_scale)}
{blk("Logos","company tiles 22 to 36px; tool logos sit bare on dark", logos_row)}
{blk("Application stages","dot colour carries the stage; only needs answers, needs you, offer and failed tint the text", stages)}
{blk("Answer sources","every answer on a sheet carries one", srcs)}
{blk("Flags","added by filters or triage, never decide on their own", flags)}
{blk("Job boards","", boards)}
{blk("Buttons and controls","", '<span class="btn pri">Approve sheet</span><span class="btn">Open posting</span><span class="btn dark">Yes</span><span class="btn ghost">Open sheet</span><span class="btn danger">Skip</span><span class="btn dis">Approve sheet</span><span class="btn sm">Small</span>' + '<div class="seg"><span class="on">You click</span><span>Agent clicks</span></div><div class="toggle on"></div><div class="toggle"></div><span class="check on">'+icon("check","#FFFFFF",11,2.5)+'</span><span class="check"></span><span class="chip on">Winter 2027</span><span class="chip">Summer 2027</span>' + score(88)+score(63)+score(41))}
{blk("Icons","Tabler outline", icons)}
</div>'''
open("foundations.html","w").write(page([body]))
print("foundations ok")
