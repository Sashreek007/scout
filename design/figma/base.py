import re
CSS = r"""
:root{
 --paper:#212121; --surface:#2A2A2A; --surface2:#303030; --raised:#3A3A3A; --line:rgba(255,255,255,0.07); --line2:rgba(255,255,255,0.12);
 --ink:#ECECEC; --ink2:#B4B4B4; --muted:#8F8F8F; --faint:#6B6B6B;
 --side:#181818; --side2:#262626; --sideink:#D6D6D6; --sidemuted:#8F8F8F;
 --accent:#6E9BFF; --accentbtn:#346BF1; --accentsoft:rgba(52,107,241,0.16); --accentink:#9DBBFF;
 --ok:#34D399; --oksoft:rgba(52,211,153,0.12);
 --amber:#FBBF24; --ambersoft:rgba(251,191,36,0.12);
 --red:#F87171; --redsoft:rgba(248,113,113,0.12);
 --blue:#60A5FA; --bluesoft:rgba(96,165,250,0.12);
 --violet:#A78BFA; --violetsoft:rgba(167,139,250,0.13);
 --teal:#2DD4BF; --tealsoft:rgba(45,212,191,0.12);
 --gold:#FACC15; --goldsoft:rgba(250,204,21,0.12);
 --grey:#8F8F8F; --greysoft:rgba(255,255,255,0.06);
 --indigo:#818CF8; --indigosoft:rgba(129,140,248,0.13);
 --onlight:#0D0D0D;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Inter",sans-serif;background:#0D0D0D;color:var(--ink);font-size:13.5px;line-height:1.5;padding:64px;display:flex;flex-direction:column;gap:120px;align-items:flex-start;width:max-content;font-feature-settings:"tnum" 1}
.mono{font-family:"JetBrains Mono",monospace;font-size:12px}
b,strong{font-weight:600}
.sep{display:inline-block;width:3px;height:3px;border-radius:50%;background:var(--faint);margin:0 3px;vertical-align:middle}
.screen{width:1440px;min-width:1440px;flex-shrink:0;min-height:960px;background:var(--paper);display:flex}
.side{width:260px;flex-shrink:0;background:var(--side);color:var(--sideink);display:flex;flex-direction:column;padding:10px 8px 10px}
.brand{display:flex;align-items:center;gap:10px;padding:6px 8px 12px}
.logo{width:28px;height:28px;border-radius:8px;background:#ECECEC;display:flex;align-items:center;justify-content:center}
.brand .name{font-size:15px;font-weight:600;letter-spacing:-.2px;color:var(--ink)}
.brand .tag{font-size:12px;color:var(--sidemuted)}
.navlabel{font-size:12px;color:var(--sidemuted);padding:16px 10px 6px;font-weight:500;display:flex;align-items:center;gap:6px}
.nav{display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:10px;color:var(--sideink);font-size:14px}
.nav.on{background:var(--side2);color:var(--ink);font-weight:500}
.nav .cnt{margin-left:auto;font-size:12px;color:var(--sidemuted)}
.nav .cnt.hot{color:#0D0D0D;background:var(--amber);font-weight:600;border-radius:999px;padding:0 7px;height:18px;display:inline-flex;align-items:center;font-size:11.5px}
.ico{width:16px;height:16px;flex-shrink:0}
.sbtn{display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:10px;color:var(--ink);font-size:14px}
.agentrow{display:flex;align-items:center;gap:10px;height:40px;padding:0 10px;border-radius:10px;font-size:13.5px;color:var(--sideink)}
.agentrow .meta{display:flex;flex-direction:column;line-height:1.25;min-width:0}
.agentrow .meta span:last-child{font-size:12px;color:var(--sidemuted)}
.agentrow .tm{margin-left:auto;font-size:12px;color:var(--sidemuted)}
.agentrow.live{background:rgba(251,191,36,0.07)}
.agentrow.live .meta span:last-child,.agentrow.live .tm{color:var(--amber)}
.sidefoot{margin-top:auto;display:flex;flex-direction:column;gap:6px}
.agentcard{padding:10px 10px 4px;display:flex;flex-direction:column;gap:8px}
.agentcard .row{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--sidemuted)}
.agentcard .row b{color:var(--ink2);font-weight:500}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.me{display:flex;align-items:center;gap:10px;padding:8px 10px;font-size:13.5px;border-radius:10px}
.avatar{width:30px;height:30px;border-radius:50%;background:#7C5CFF;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:11.5px}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.topbar{height:56px;flex-shrink:0;display:flex;align-items:center;gap:10px;padding:0 24px 0 28px}
.topbar h1{font-size:17px;font-weight:600;letter-spacing:-.2px}
.crumb{color:var(--muted);font-size:14px}
.search{margin-left:auto;width:320px;height:36px;border-radius:999px;background:var(--surface2);display:flex;align-items:center;padding:0 14px;gap:8px;color:var(--muted);font-size:13.5px}
.kbd{margin-left:auto;font-size:11.5px;border-radius:6px;padding:1px 6px;color:var(--muted);background:rgba(255,255,255,0.06)}
.content{padding:12px 32px 48px;display:flex;flex-direction:column;gap:20px}
.pagehead{display:flex;align-items:flex-end;gap:10px}
.pagehead h2{font-size:26px;font-weight:600;letter-spacing:-.5px}
.row{display:flex;gap:20px}
.col{display:flex;flex-direction:column;gap:16px;min-width:0}
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.cardh{display:flex;align-items:center;gap:10px;padding:14px 18px;min-height:52px}
.cardh h2{font-size:15px;font-weight:600;letter-spacing:-.1px}
.cardh .sub{color:var(--muted);font-size:13px}
.cardh .right{margin-left:auto;display:flex;gap:8px;align-items:center}
.cardb{padding:4px 18px 18px}
.btn{height:32px;padding:0 14px;border-radius:999px;border:1px solid transparent;background:rgba(255,255,255,0.07);font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:7px;color:var(--ink);white-space:nowrap}
.btn.pri{background:#FFFFFF;border-color:#FFFFFF;color:#0D0D0D}
.btn.dark{background:#ECECEC;border-color:#ECECEC;color:#0D0D0D}
.btn.ghost{border-color:transparent;background:transparent;color:var(--ink2)}
.btn.danger{color:var(--red);background:var(--redsoft);border-color:transparent}
.btn.dis{background:rgba(255,255,255,0.04);border-color:transparent;color:var(--faint)}
.btn.out{background:transparent;border-color:var(--line2)}
.btn.sm{height:28px;padding:0 11px;font-size:12.5px}
.btn.lg{height:44px;padding:0 20px;font-size:15px}
.pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap;background:rgba(255,255,255,0.07);color:var(--ink2)}
.pill .d{width:6px;height:6px;border-radius:50%}
.st-queued .d{background:#8F8F8F}
.st-planning{background:var(--bluesoft);color:#93C5FD} .st-planning .d{background:var(--blue)}
.st-needs_answers{background:var(--ambersoft);color:var(--amber)} .st-needs_answers .d{background:var(--amber)}
.st-review{background:var(--violetsoft);color:#C4B5FD} .st-review .d{background:var(--violet)}
.st-approved{background:var(--accentsoft);color:var(--accentink)} .st-approved .d{background:var(--accent)}
.st-filling{background:var(--tealsoft);color:#5EEAD4} .st-filling .d{background:var(--teal)}
.st-needs_hand{background:var(--redsoft);color:var(--red)} .st-needs_hand .d{background:var(--red)}
.st-applied{background:var(--oksoft);color:#6EE7B7} .st-applied .d{background:var(--ok)}
.st-assessment{background:var(--indigosoft);color:#A5B4FC} .st-assessment .d{background:var(--indigo)}
.st-interview{background:var(--indigosoft);color:#C7D2FE} .st-interview .d{background:#C7D2FE}
.st-offer{background:var(--goldsoft);color:var(--gold)} .st-offer .d{background:var(--gold)}
.st-rejected .d,.st-withdrawn .d,.st-skipped .d,.st-closed .d{background:#5A5A5A}
.st-rejected,.st-withdrawn,.st-skipped,.st-closed{color:var(--muted);background:rgba(255,255,255,0.05)}
.st-failed{background:var(--redsoft);color:var(--red)} .st-failed .d{background:transparent;border:1.5px solid var(--red);width:6px;height:6px}
.src{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px 0 8px;border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap;color:var(--ink2);background:rgba(255,255,255,0.06)}
.src::before{content:"";width:6px;height:6px;border-radius:50%;display:inline-block}
.src-profile::before{background:var(--accent)}
.src-memory::before{background:var(--teal)}
.src-you::before{background:#ECECEC}
.src-policy::before{background:#6B6B6B}
.src-fact::before{background:var(--violet)}
.src-draft{color:#C4B5FD;background:var(--violetsoft)}
.src-draft::before{background:transparent;border:1.5px solid var(--violet);width:5px;height:5px}
.flag{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap;background:rgba(255,255,255,0.06);color:var(--ink2)}
.f-values{color:var(--amber);background:var(--ambersoft)}
.f-clearance{color:var(--red);background:var(--redsoft)}
.f-term{color:var(--muted)}
.f-title{color:var(--accentink);background:var(--accentsoft)}
.f-captcha{color:var(--red);background:var(--redsoft)}
.score{min-width:36px;height:24px;padding:0 8px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:12.5px;background:rgba(255,255,255,0.06)}
.sc-hi{color:#6EE7B7;background:var(--oksoft)} .sc-mid{color:var(--ink)} .sc-lo{color:var(--muted)}
.ats{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink2)}
.co{display:flex;align-items:center;gap:11px}
.wl{display:inline-flex;align-items:center;gap:8px}
.tight td,.tight th{padding-left:12px;padding-right:12px}
table{border-collapse:collapse;width:100%}
th{font-size:12.5px;color:var(--muted);font-weight:500;text-align:left;padding:8px 18px;border-bottom:1px solid var(--line)}
td{padding:11px 18px;border-bottom:1px solid var(--line);vertical-align:middle;font-size:13.5px;color:var(--ink)}
tr:last-child td{border-bottom:none}
tr.sel td{background:rgba(255,255,255,0.05)}
.t1{font-weight:500;color:var(--ink)} .t2{color:var(--muted);font-size:12.5px}
.tabs{display:flex;gap:4px}
.tab{padding:0 14px;height:34px;border-radius:999px;font-size:13.5px;color:var(--muted);display:flex;gap:7px;align-items:center}
.tab.on{color:var(--ink);font-weight:500;background:rgba(255,255,255,0.08)}
.tab .n{font-size:12px;color:var(--faint)}
.tab.on .n{color:var(--ink2)}
.chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:1px solid var(--line2);border-radius:999px;font-size:13px;background:transparent;color:var(--ink2)}
.chip.on{background:#ECECEC;border-color:#ECECEC;color:#0D0D0D;font-weight:500}
.queue{display:flex;background:var(--surface);border:1px solid var(--line);border-radius:18px}
.queue .q{flex:1;padding:16px 18px;display:flex;flex-direction:column;gap:4px;border-right:1px solid var(--line)}
.queue .q:last-child{border-right:none}
.queue .q .v{font-size:26px;font-weight:600;letter-spacing:-.5px}
.queue .q .l{font-size:13px;color:var(--ink2)}
.queue .q .h{font-size:12.5px;color:var(--muted)}
.kpi{flex:1;padding:16px 18px;display:flex;flex-direction:column;gap:4px}
.kpi .v{font-size:26px;font-weight:600;letter-spacing:-.5px}
.kpi .l{font-size:13px;color:var(--ink2)}
.kpi .h{font-size:12.5px;color:var(--muted)}
.banner{border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start;background:var(--surface);border:1px solid var(--line)}
.b-red{background:rgba(248,113,113,0.08);border-color:rgba(248,113,113,0.22)}
.b-amber{background:rgba(251,191,36,0.07);border-color:rgba(251,191,36,0.20)}
.b-green{background:rgba(52,211,153,0.07);border-color:rgba(52,211,153,0.20)}
.b-blue{background:rgba(96,165,250,0.08);border-color:rgba(96,165,250,0.22)}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:13px;font-weight:500;color:var(--ink2)}
.input{height:38px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);padding:0 13px;display:flex;align-items:center;font-size:13.5px;color:var(--ink)}
.input.todo{border-color:rgba(251,191,36,0.4);color:var(--amber)}
.textarea{min-height:88px;border:1px solid var(--line);border-radius:14px;background:var(--surface2);padding:11px 13px;font-size:13.5px;line-height:1.6;color:var(--ink)}
.seg{display:inline-flex;border-radius:999px;background:rgba(255,255,255,0.05);padding:3px;gap:2px}
.seg span{padding:4px 12px;font-size:12.5px;color:var(--ink2);border-radius:999px}
.seg span.on{background:#424242;color:var(--ink);font-weight:500}
.toggle{width:36px;height:20px;border-radius:999px;background:#4A4A4A;position:relative;flex-shrink:0}
.toggle::after{content:"";position:absolute;width:16px;height:16px;border-radius:50%;background:#FFFFFF;top:2px;left:2px}
.toggle.on{background:var(--accentbtn)} .toggle.on::after{left:18px;background:#FFFFFF}
.check{width:18px;height:18px;border-radius:6px;border:1.5px solid #5A5A5A;background:transparent;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center}
.check.on{background:var(--accentbtn);border-color:var(--accentbtn)}
.tl{display:flex;flex-direction:column}
.tli{display:flex;gap:12px;padding-bottom:14px}
.tli .dotc{width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0}
.tli .txt{display:flex;flex-direction:column;gap:2px;font-size:13.5px}
.tli .who{color:var(--muted);font-size:12.5px}
.bar{height:6px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden;display:flex}
.bar i{display:block;height:100%;border-radius:999px}
.muted{color:var(--muted)} .faint{color:var(--faint)}
.sp{flex:1}
.hstack{display:flex;align-items:center;gap:8px}
.vstack{display:flex;flex-direction:column;gap:8px}
.divider{height:1px;background:var(--line)}
.note{font-size:12.5px;color:var(--muted)}
.sectionlabel{font-size:13px;font-weight:600;color:var(--ink2)}
.mobile{width:390px;min-width:390px;flex-shrink:0;min-height:844px;background:var(--paper);display:flex;flex-direction:column;border-radius:48px;overflow:hidden;border:1px solid #3A3A3A;outline:8px solid #171717}
.status{height:47px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;font-size:15px;font-weight:600;color:var(--ink)}
.mhead{padding:6px 18px 12px;display:flex;flex-direction:column;gap:4px}
.mhead h1{font-size:26px;font-weight:600;letter-spacing:-.5px}
.mbody{padding:12px 14px;display:flex;flex-direction:column;gap:12px;flex:1}
.tabbar{height:82px;background:var(--side);border-top:1px solid var(--line);display:flex;justify-content:space-around;align-items:flex-start;padding-top:10px}
.tabbar div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:var(--muted);min-width:56px}
.tabbar div.on{color:var(--ink);font-weight:500}
.annot{width:1440px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px 22px;display:flex;gap:28px;font-size:13px;color:var(--ink2)}
.annot h3{font-size:14px;color:var(--ink);margin-bottom:6px;font-weight:600}
.spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(45,212,191,0.25);border-top-color:#2DD4BF;flex-shrink:0}
"""

import os as _os, json as _json
_ASSETS = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "assets")
_TABLER = _json.load(open(_os.path.join(_ASSETS, "tabler-icons.json")))["icons"]
ICON_MAP = {"today":"calendar-event","jobs":"briefcase","board":"layout-kanban","profile":"user-circle","memory":"bookmarks","runs":"activity","stats":"chart-bar","settings":"adjustments-horizontal","search":"search","check":"check","x":"x","alert":"alert-triangle","q":"help-circle","doc":"file-text","mac":"device-laptop","clock":"clock","pause":"player-pause","play":"player-play","ext":"external-link","chev":"chevron-right","chevd":"chevron-down","plus":"plus","spark":"sparkles","filter":"filter","edit":"pencil","mail":"mail","bolt":"bolt","logo":"radar-2","google":"brand-google","back":"arrow-back-up","inbox":"inbox","home":"home","list":"list-details","msg":"message-circle","lock":"lock","refresh":"refresh","ok":"circle-check","chevl":"chevron-left","agents":"robot","collapse":"layout-sidebar-left-collapse","loader":"loader-2","stop":"player-stop","tab":"app-window","newrun":"square-rounded-plus","dots":"dots","share":"share-3","hand":"hand-stop","cpu":"cpu"}
def _inner(name):
    return _TABLER[name]
def icon(name, color="currentColor", size=16, sw=1.75):
    return f'<svg class="ico" aria-label="icon:{name}:{sw}" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="width:{size}px;height:{size}px">{_inner(name)}</svg>'

STAGE_LABEL = {"queued":"Queued","planning":"Planning","needs_answers":"Needs answers","review":"Review","approved":"Approved","filling":"Filling","needs_hand":"Needs you","applied":"Applied","assessment":"Assessment","interview":"Interview","offer":"Offer","rejected":"Rejected","withdrawn":"Withdrawn","skipped":"Skipped","closed":"Closed","failed":"Failed"}
def stage(s): return f'<span class="pill st-{s}"><span class="d"></span>{STAGE_LABEL[s]}</span>'
SRC_LABEL = {"profile":"Profile","memory":"Memory","you":"You","policy":"Policy","fact":"Claude fact","draft":"Draft"}
def src(s): return f'<span class="src src-{s}">{SRC_LABEL[s]}</span>'
def score(n):
    c = "sc-hi" if n >= 75 else ("sc-mid" if n >= 55 else "sc-lo")
    return f'<span class="score {c}">{n}</span>'
ATS = {"gh":"Greenhouse","lv":"Lever","ab":"Ashby","wd":"Workday","ot":"Other"}
from logos import company_logo, board_logo, si_svg, COMPANY
def ats(k): return f'<span class="ats">{board_logo(k,16,4)}{ATS[k]}</span>'

NAV = [("today","Today","4",True),("jobs","Jobs","9",False),("board","Board","",False),("agents","Agents","3",False),
       ("profile","Profile","",False),("memory","Knowledge","",False),("runs","Runs","",False),("stats","Stats","",False),("settings","Settings","",False)]
AGENTS = [("Clio","Filling, step 4 of 9","2:10","fill"),("Element Fleet","Waiting on you","8:41","live"),("Agent 3","Pacing","1:42","idle")]
def side(active, paused=False, cap="2 / 20", first=False):
    items = []
    if first: cap = "0 / 20"
    for k,label,cnt,hot in NAV:
        if first: cnt = ""
        if k == "profile": items.append('<div class="navlabel">You</div>')
        if k == "runs": items.append('<div class="navlabel">System</div>')
        on = " on" if k == active else ""
        c = f'<span class="cnt{" hot" if hot else ""}">{cnt}</span>' if cnt else ""
        items.append(f'<div class="nav{on}">{icon(k, "#B4B4B4" if not on else "#ECECEC", 18)}<span>{label}</span>{c}</div>')
    rows = []
    if first:
        rows.append('<div class="agentrow"><span class="dot" style="background:#5A5A5A"></span><div class="meta"><span>No agent connected</span><span>Run pnpm agent on your Mac</span></div></div>')
    elif paused:
        rows.append('<div class="agentrow"><span class="dot" style="background:#FBBF24"></span><div class="meta"><span>All agents paused</span><span>Resume from Agents</span></div></div>')
    else:
        for name, what, tm, kind in AGENTS:
            lg = company_logo(name, 20, 6) if name in COMPANY else f'<span class="ltile" style="width:20px;height:20px;min-width:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:#303030">{icon("agents","#8F8F8F",13)}</span>'
            ind = '<span class="spin"></span>' if kind == "fill" else ""
            rows.append(f'<div class="agentrow{" live" if kind=="live" else ""}">{lg}<div class="meta"><span>{name}</span><span>{what}</span></div><span class="tm">{tm}</span>{ind}</div>')
    state = "Off" if first else ("Paused" if paused else "3 running")
    return f'''<aside class="side">
<div class="brand"><div class="logo">{icon("logo","#0D0D0D",17,2)}</div><div style="flex:1"><div class="name">scout</div></div>{icon("collapse","#8F8F8F",20)}</div>
<div class="sbtn">{icon("newrun","#ECECEC",18)}<span>New run</span></div>
<div class="sbtn">{icon("search","#ECECEC",18)}<span>Search</span><span class="kbd">⌘K</span></div>
<div style="height:8px"></div>
{"".join(items)}
<div class="navlabel">Agents on Mac<span class="sp"></span><span style="color:{"#FBBF24" if paused else "#34D399"};font-weight:500">{state}</span></div>
{"".join(rows)}
<div class="sidefoot">
 <div class="agentcard">
  <div class="row"><span>Applied today</span><b>{cap}</b></div>
  <div class="bar"><i style="width:10%;background:#ECECEC"></i></div>
 </div>
 <div class="me"><div class="avatar">SA</div><div><div style="color:var(--ink);font-weight:500">Sashreek Addanki</div><div style="color:var(--sidemuted);font-size:12px">Google account</div></div><span class="sp"></span>{icon("dots","#8F8F8F",18)}</div>
</div></aside>'''

def topbar(title, crumb="", right=""):
    c = f'<span class="crumb">{icon("chev","#6B6B6B",16)}</span><span class="crumb">{crumb}</span>' if crumb else ""
    return f'''<header class="topbar"><h1>{title}</h1>{c}
<div class="search">{icon("search","#8F8F8F",16)}<span>Search jobs, companies, questions</span><span class="kbd">⌘K</span></div>{right}</header>'''

def run_pill(): return '<span class="pill st-applied"><span class="d"></span>Last run 7:02, 9 new</span>'

def desktop(name, active, title, body, crumb="", right=None, paused=False, first=False):
    r = right if right is not None else run_pill()
    return f'<div class="screen" id="{name}">{side(active, paused, first=first)}<main class="main">{topbar(title, crumb, r)}<div class="content">{body}</div></main></div>'

DARK_MAP = [('"#38413B"','"#A9B1BD"'),('"#6C7169"','"#7A8491"'),('"#9A9E96"','"#5A636F"'),('"#1E7A4C"','"#5DB88C"'),('"#B42318"','"#EE6E5D"'),('"#9A600A"','"#E3A23B"'),('"#2459A8"','"#7AA2F7"'),('"#6640C2"','"#A994F3"'),('"#A3A69F"','"#5A636F"'),
 ('background:#FBF8FF','background:#191629'),('border-color:#C9B8F0','border-color:#4A3E78'),('"#8A8F87"','"#8C95A1"'),('"#D08A16"','"#E3A23B"'),('"#1D4C93"','"#A9C4FA"'),('"#0D7680"','"#58C1CB"'),('"#3B4BB8"','"#9BA7F6"'),
 (' · ','<span class="sep"></span>'),('text-transform:uppercase;letter-spacing:.5px;',''),(';text-transform:uppercase;letter-spacing:.5px',''),('style="font-size:22px;font-weight:700;letter-spacing:-.4px"','style="font-size:22px;font-weight:600;letter-spacing:-.3px"')]
# old dark palette -> neutral ChatGPT/t3code palette
NEUTRAL_MAP = [("#E4E8EE","#ECECEC"),("#A9B1BD","#B4B4B4"),("#7A8491","#8F8F8F"),("#5A636F","#6B6B6B"),("#8C95A1","#8F8F8F"),
 ("#5DB88C","#34D399"),("#E3A23B","#FBBF24"),("#EE6E5D","#F87171"),("#7AA2F7","#6E9BFF"),("#A994F3","#A78BFA"),("#58C1CB","#2DD4BF"),
 ("#DCBA55","#FACC15"),("#A9C4FA","#9DBBFF"),("#9BA7F6","#818CF8"),("#C3CBFA","#C7D2FE"),("#C9D1DB","#D4D4D4"),("#3D6AD6","#346BF1"),
 ("#0F1216","#0D0D0D"),("#4E78D8","#6E9BFF"),("#2E4675","rgba(110,155,255,0.35)"),("#4A3E78","rgba(167,139,250,0.35)"),("#191629","rgba(167,139,250,0.08)"),
 ("#14181D","#2A2A2A"),("#191E24","#303030"),("#1E242B","#3A3A3A"),("#232930","#2F2F2F"),("#2F3640","#3A3A3A"),("#2A3340","#3A3A3A"),
 ("#1E1413","rgba(248,113,113,0.08)"),("#1C1812","rgba(251,191,36,0.07)"),("#121C17","rgba(52,211,153,0.07)"),("#131A26","rgba(96,165,250,0.08)"),
 ("#172131","rgba(255,255,255,0.05)"),("#56271F","rgba(248,113,113,0.3)"),("#4D3A17","rgba(251,191,36,0.3)"),("#24503A","rgba(52,211,153,0.3)"),("#2A3D66","rgba(96,165,250,0.3)"),
 ("#6A4E1C","rgba(251,191,36,0.4)"),("#38414D","#4A4A4A"),("#2A323C","#3A3A3A"),("#323A45","#4A4A4A"),("#535C67","#5A5A5A"),("#59626E","#5A5A5A"),
 ("background:#E3EDFF","background:rgba(110,155,255,0.22)"),("background:#FFF1CC","background:rgba(251,191,36,0.25)")]
def neutralize(h):
    for a,b in NEUTRAL_MAP:
        h = h.replace(a,b).replace(a.lower(),b)
    return h

import re as _re
def _lg(name, size=22):
    return company_logo(name, size, 6 if size < 26 else 8)
def add_logos(h):
    # table cells: company over role
    def cell(m):
        name = m.group(1)
        if name.strip() not in COMPANY: return m.group(0)
        return f'<td><div class="co">{_lg(name,28)}<div><div class="t1">{name}</div><div class="t2">{m.group(2)}</div></div></div></td>'
    h = _re.sub(r'<td><div class="t1">([^<]+)</div><div class="t2">([^<]*)</div></td>', cell, h)
    # inline company names
    def span(m):
        name = m.group(2)
        if name.strip() not in COMPANY: return m.group(0)
        opening = m.group(1).replace('class="t1"', 'class="t1 wl"', 1)
        return f'{opening}{_lg(name,20)}{name}{m.group(3)}'
    h = _re.sub(r'(<span class="t1"(?: style="[^"]*")?>)([^<]+)(</span>|<span class="sep">)', span, h)
    def title(m):
        name = m.group(2)
        if name.strip() not in COMPANY: return m.group(0)
        return f'<div class="hstack" style="gap:12px">{_lg(name,32)}{m.group(1)}{name}</span>'
    h = _re.sub(r'<div class="hstack">(<span style="font-size:22px;font-weight:600;letter-spacing:-.3px">)([^<]+)</span>', title, h)
    for label, spec in SOURCES:
        lg = tile_inline(spec)
        h = h.replace(f'<span>{label}</span>', f'<span class="wl">{lg}{label}</span>')
        h = h.replace(f'<span class="t1">{label}</span>', f'<span class="t1 wl">{lg}{label}</span>')
        h = h.replace(f'<td>{label}</td>', f'<td><span class="wl">{lg}{label}</span></td>')
    return h

from logos import tile as _tile
SOURCES = [("SimplifyJobs list", ("fav","simplify.jobs")), ("vanshb03 list", ("si","github")), ("Greenhouse boards", ("si","greenhouse")),
           ("Lever boards", ("fav","lever.co")), ("Ashby boards", ("fav","ashbyhq.com")), ("Workday boards", ("fav","workday.com"))]
def tile_inline(spec): return _tile(spec, 18, 5)

def page(screens):
    screens = [add_logos(neutralize(darkify(x))) for x in screens]
    return f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"><style>{CSS}</style></head><body>{"".join(screens)}</body></html>'

def darkify(h):
    for a,b in DARK_MAP: h = h.replace(a,b)
    return h
