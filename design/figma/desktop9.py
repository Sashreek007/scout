from base import *
from logos import company_logo, board_logo, si_svg
from browserview import chrome_bar

# Reviewing on the filled form (architecture section 5, issue #78) and remembering answers after submit.
# States share one colour on the page and in the panel.
PAGE_COL = {"ok": "#059669", "prop": "#2563EB", "ask": "#D97706", "draft": "#7C3AED", "you": "#18181B"}
PANEL_COL = {"ok": "#34D399", "prop": "#6E9BFF", "ask": "#FBBF24", "draft": "#A78BFA", "you": "#ECECEC"}
STATE_TXT = {"ok": "Accepted", "prop": "Proposed", "ask": "Needs you", "draft": "Read first", "you": "Edited by you"}

def kbd(k): return f'<span style="display:inline-flex;align-items:center;height:20px;padding:0 6px;border-radius:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.10);font-size:11.5px;color:var(--ink2);font-weight:500">{k}</span>'
def match(t): return f'<span class="mono" style="font-size:11px;color:var(--muted);background:rgba(255,255,255,0.05);border-radius:6px;padding:1px 6px;white-space:nowrap">{t}</span>'
def chip(kind):
    label = {"profile": "Profile", "memory": "Memory", "you": "You", "policy": "Policy", "draft": "Claude draft"}[kind]
    return f'<span class="src src-{kind}">{label}</span>'
def state_ico(s, size=16):
    c = PANEL_COL[s]
    if s == "ok": return f'<span style="width:{size}px;height:{size}px;border-radius:50%;background:rgba(52,211,153,0.16);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">{icon("check",c,size-5,2.5)}</span>'
    if s == "prop": return f'<span style="width:{size}px;height:{size}px;border-radius:50%;border:1.5px solid {c};flex-shrink:0;display:inline-block"></span>'
    if s == "ask": return icon("alert", c, size)
    if s == "draft": return icon("doc", c, size)
    return icon("edit", c, size)

# ---------- the Greenhouse page, filled by the agent ----------
def gfield(label, value, s, req=True, focus=False, select=False, area=False, note=""):
    col = PAGE_COL[s]
    bw = "2px" if focus or s in ("ask", "draft") else "1.5px"
    bg = {"ok": "#F0FDF4", "prop": "#EFF6FF", "ask": "#FFFBEB", "draft": "#F5F3FF", "you": "#FFFFFF"}[s]
    r = '<span style="color:#DC2626">*</span>' if req else ""
    caret = f'<span style="margin-left:auto;display:inline-flex">{icon("chevd","#71717A",14)}</span>' if select else ""
    ghost = (f'<span style="position:absolute;right:10px;top:50%;margin-top:-10px;height:20px;display:inline-flex;align-items:center;gap:5px;'
             f'background:#2563EB;color:#FFFFFF;font-size:11px;font-weight:600;padding:0 7px;border-radius:6px">Tab to accept</span>') if focus else ""
    h = "auto" if area else "34px"
    pad = "8px 10px" if area else "0 10px"
    box = (f'<div style="position:relative;min-height:{h};border:{bw} solid {col};border-radius:7px;background:{bg};display:flex;align-items:{"flex-start" if area else "center"};'
           f'padding:{pad};font-size:12.5px;color:#18181B;line-height:1.5">{value}{caret}{ghost}</div>')
    n = f'<span style="font-size:11px;color:#71717A">{note}</span>' if note else ""
    return f'<div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-size:12px;color:#3F3F46;font-weight:500">{label}{r}</span>{box}{n}</div>'

def pair(a, b): return f'<div style="display:flex;gap:14px"><div style="flex:1;min-width:0">{a}</div><div style="flex:1;min-width:0">{b}</div></div>'

resume_val = f'<span style="display:inline-flex;align-items:center;gap:7px">{icon("doc","#52525B",14)}<span>northwind-backend.pdf</span><span style="font-size:11px;color:#059669">attached, hash checked</span></span>'
why_val = ("Northwind's platform team runs the services that keep warehouse robots moving, which is the kind of system I like building. "
           "My API key and quota service taught me to care about latency and failure modes...")
form_page = f'''<div style="background:#FFFFFF;flex:1;display:flex;flex-direction:column;gap:13px;padding:20px 26px;overflow:hidden">
<div style="display:flex;align-items:center;gap:12px">{company_logo("Northwind Robotics",34,8)}<div style="display:flex;flex-direction:column"><b style="font-size:16px;color:#18181B;font-weight:600">Software Developer Intern</b><span style="font-size:12px;color:#71717A">Northwind Robotics, Toronto, ON, hybrid, Winter 2027</span></div></div>
<div style="height:1px;background:#E4E4E7"></div>
<b style="font-size:14px;color:#18181B;font-weight:600">Apply for this job</b>
{pair(gfield("First name","Sashreek","ok"), gfield("Last name","Addanki","ok"))}
{pair(gfield("Email","sashreek@example.com","ok"), gfield("Phone","+1 780 555 0142","ok",req=False))}
{gfield("Resume/CV",resume_val,"ok")}
{pair(gfield("LinkedIn profile","linkedin.com/in/sashreek","ok",req=False), gfield("Website","sashreek-addanki.vercel.app","ok",req=False))}
{gfield("Are you legally eligible to work in Canada?","Yes","ok",select=True)}
{gfield("Will you require Northwind to support a work permit application, now or later?","No","ask",select=True)}
{pair(gfield("Earliest start date","January 5, 2027","ok"), gfield("Where did you find this role?","Job board","prop",req=False,focus=True,select=True))}
{gfield("Are you available for in-person interviews in Toronto?","Yes","prop",select=True)}
{gfield("Why do you want to work at Northwind Robotics?",why_val,"draft",area=True,note="Claude draft, 62 of 150 words")}
{gfield("Gender","I don't wish to answer","prop",req=False,select=True,note="Voluntary")}
</div>'''

def browser(head, domain, page_html):
    return f'''<div class="card" style="flex:1;display:flex;flex-direction:column;min-width:0">
<div class="hstack" style="padding:12px 16px;gap:10px">{head}</div>
<div style="margin:0 14px 14px;flex:1;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.10)">{chrome_bar(domain,1.0)}{page_html}</div></div>'''

live = '<span class="pill" style="background:rgba(248,113,113,0.14);color:#F87171"><span class="d" style="background:#F87171"></span>Live</span>'
head24 = f'''{company_logo("Northwind Robotics",26,7)}<div class="vstack" style="gap:0;min-width:0"><b style="font-weight:600;font-size:14px">Tab "scout 1", Northwind Robotics</b><span class="note">Agent 1 filled 14 fields from the sheet in 14 seconds</span></div><span class="sp"></span>{live}<span class="btn sm">{si_svg("googlechrome",14)}Open in Chrome</span>'''

# ---------- the panel ----------
def done_row(label, value, kind, how):
    return f'''<div class="hstack" style="gap:8px;height:26px;padding:0 4px">{state_ico("ok",14)}<span style="font-size:12px;color:var(--ink2);width:112px;flex-shrink:0;white-space:nowrap;overflow:hidden">{label}</span><span style="font-size:12px;color:var(--ink);flex:1;min-width:0;white-space:nowrap;overflow:hidden">{value}</span>{match(how)}</div>'''

def open_row(s, label, value, kind, how, focus=False, extra="", right=""):
    bd = f"border:1px solid {PANEL_COL[s]};" if focus else "border:1px solid var(--line);"
    bg = "background:rgba(110,155,255,0.07);" if focus else "background:rgba(255,255,255,0.02);"
    return f'''<div style="{bd}{bg}border-radius:12px;padding:8px 11px;display:flex;flex-direction:column;gap:6px">
 <div class="hstack" style="gap:9px;align-items:flex-start">{state_ico(s)}<span style="font-size:12px;color:var(--ink2);flex:1;min-width:0;line-height:1.4">{label}</span><span class="note" style="color:{PANEL_COL[s]};white-space:nowrap">{STATE_TXT[s]}</span></div>
 <div class="hstack" style="gap:6px;padding-left:25px"><span style="font-size:13px;color:var(--ink);font-weight:500;flex:1;min-width:0;white-space:nowrap;overflow:hidden">{value}</span>{right}{chip(kind)}{match(how)}</div>{extra}</div>'''

confirm = f'''<div style="margin-left:25px;padding:8px 10px;border-radius:10px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.22);display:flex;flex-direction:column;gap:7px">
 <span style="font-size:12.5px;color:var(--ink)">This looks like the sponsorship question. Answer No?</span>
 <div class="hstack" style="gap:8px"><span class="btn sm pri">Yes, answer No</span><span class="btn sm">It's a different question</span></div></div>'''

panel24 = f'''<div class="card" style="width:430px;flex-shrink:0;display:flex;flex-direction:column">
 <div class="hstack" style="padding:12px 16px 8px;gap:10px">{company_logo("Northwind Robotics",30,8)}<div class="vstack" style="gap:0;flex:1;min-width:0"><b style="font-size:14.5px;font-weight:600">Northwind Robotics</b><span class="note">Greenhouse, set to hold</span></div>{stage("review")}</div>
 <div style="padding:0 16px 10px" class="vstack">
  <div class="hstack note"><span>9 of 14 accepted</span><span class="sp"></span><span>2 need you</span></div>
  <div class="bar" style="height:6px;gap:2px;background:transparent"><i style="width:64%;background:#34D399;border-radius:3px"></i><i style="width:22%;background:#6E9BFF;border-radius:3px"></i><i style="width:7%;background:#FBBF24;border-radius:3px"></i><i style="width:7%;background:#A78BFA;border-radius:3px"></i></div>
 </div>
 <div style="padding:0 16px 10px;display:flex;flex-direction:column;gap:8px">
  <div class="hstack" style="gap:10px"><span class="btn pri" style="flex:1;justify-content:center">{icon("check","#0D0D0D",14,2.25)}Accept all 3<span style="margin-left:6px;font-size:12px;color:#52525B">⌘↵</span></span><span class="btn">Skip</span></div>
  <div class="hstack note" style="gap:6px">{kbd("Tab")}<span>accept, next</span>{kbd("Esc")}<span>clear</span>{kbd("↑")}{kbd("↓")}<span>move</span><span class="sp"></span><span>Skips drafts</span></div>
 </div>
 <div class="divider"></div>
 <div style="padding:10px 14px;display:flex;flex-direction:column;gap:7px">
  <span class="sectionlabel">Waiting on you, 5</span>
  {open_row("ask","Will you require Northwind to support a work permit application, now or later?","No","profile","type 0.88",extra=confirm)}
  {open_row("prop","Where did you find this role?","Job board","memory","type 0.91",focus=True)}
  {open_row("prop","Are you available for in-person interviews in Toronto?","Yes","you","exact")}
  {open_row("draft","Why do you want to work at Northwind Robotics?","62 words","draft","drafted",right='<span class="btn sm">Open to read</span>')}
  {open_row("prop","Gender","I don't wish to answer","policy","rule")}
 </div>
 <div class="divider"></div>
 <div style="padding:8px 12px 6px;display:flex;flex-direction:column">
  <div class="hstack" style="padding:0 4px 2px"><span class="sectionlabel">Accepted, 9</span><span class="note" style="margin-left:8px">all from your profile</span><span class="sp"></span>{icon("chevd","#8F8F8F",14)}</div>
  {done_row("First name","Sashreek","profile","rule")}
  {done_row("Last name","Addanki","profile","rule")}
  {done_row("Email","sashreek@example.com","profile","rule")}
  {done_row("Phone","+1 780 555 0142","profile","rule")}
  {done_row("Resume/CV","northwind-backend.pdf","profile","approved")}
  {done_row("LinkedIn profile","linkedin.com/in/sashreek","profile","rule")}
  {done_row("Website","sashreek-addanki.vercel.app","profile","rule")}
  {done_row("Eligible in Canada","Yes","profile","rule")}
  {done_row("Earliest start date","January 5, 2027","profile","rule")}
 </div>
 <span class="sp"></span>
 <div class="divider"></div>
 <div class="hstack" style="padding:10px 16px 12px;gap:10px"><span class="note" style="flex:1">The agent reads every value back, then you click Submit.</span><span class="btn dis">Submit</span></div>
</div>'''

def filling_pill(n): return f'<span class="pill" style="background:var(--tealsoft);color:#5EEAD4;gap:7px"><span class="spin" style="width:11px;height:11px"></span>{n} more filling</span>'
right24 = f'<div class="hstack" style="gap:8px;margin-left:12px">{filling_pill(2)}<span class="btn sm">Stop reviewing</span></div>'
body24 = f'<div class="row" style="gap:16px;align-items:stretch">{browser(head24,"job-boards.greenhouse.io/northwindrobotics/jobs/4810021",form_page)}{panel24}</div>'

# ---------- after submitting: remember these answers ----------
thanks_page = f'''<div style="background:#FFFFFF;flex:1;display:flex;flex-direction:column;align-items:center;gap:14px;padding:90px 40px;overflow:hidden">
{company_logo("Clio",52,12)}
<b style="font-size:20px;color:#18181B;font-weight:600">Thank you for applying to Clio</b>
<span style="font-size:13px;color:#52525B">Software Developer Co-op, Calgary, AB or Edmonton, AB</span>
<span style="font-size:13px;color:#71717A;max-width:420px;text-align:center;line-height:1.6">We've received your application and will be in touch if your experience is a match. You'll get a copy of this confirmation by email.</span>
<span style="margin-top:auto;font-size:11px;color:#A1A1AA;display:inline-flex;align-items:center;gap:6px">Powered by {board_logo("gh",14,3)} Greenhouse</span>
</div>'''
head25 = f'''{company_logo("Clio",26,7)}<div class="vstack" style="gap:0;min-width:0"><b style="font-weight:600;font-size:14px">Tab "scout 2", Clio</b><span class="note">Confirmation page seen at 9:41</span></div><span class="sp"></span>{stage("applied")}'''

def rem_row(on, q, a, qtype, high=False, note=""):
    box = f'<span class="check on">{icon("check","#FFFFFF",11,2.5)}</span>' if on else '<span class="check"></span>'
    hs = '<span class="flag f-values">High stakes</span>' if high else ""
    n = f'<span class="note">{note}</span>' if note else ""
    return f'''<div class="hstack" style="gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line)">{box}<div class="vstack" style="gap:5px;flex:1;min-width:0">
 <span style="font-size:12.5px;color:var(--ink2)">{q}</span><span style="font-size:13.5px;font-weight:500">{a}</span>
 <div class="hstack" style="gap:6px">{chip("you")}<span class="pill">{qtype}</span>{hs}</div>{n}</div></div>'''

panel25 = f'''<div class="col" style="width:430px;flex-shrink:0;gap:16px">
 <div class="banner b-green">{icon("ok","#34D399",18)}<div class="vstack" style="gap:3px;flex:1"><b style="font-weight:600">Applied to Clio</b><span style="font-size:12.5px;color:var(--ink2)">The agent read every value back before you clicked Submit. Rodan Energy is filled and ready next.</span></div></div>
 <div class="card"><div class="cardh"><h2>Remember these 4 answers?</h2></div>
  <div class="cardb" style="padding-top:0">
   <span class="note">You typed or changed these on Clio's form. Ticked answers are saved by question type and used on future forms, however they're worded.</span>
   {rem_row(True,"What are your pronouns?","he/him","Pronouns")}
   {rem_row(True,"Do you hold a valid driver's licence?","No","Driver's licence")}
   {rem_row(True,"What hourly pay are you expecting, in CAD?","$28 an hour","Salary expectation",high=True,note="Saved as confirmed by you, so it is reused without asking.")}
   {rem_row(False,"What would you want to build in your first month at Clio?","I'd start with the matter timeline API...","Free text",note="Free text names the company, so it stays with this application.")}
   <div class="hstack" style="padding-top:14px;gap:10px"><span class="btn pri">Remember 3</span><span class="btn">Not now</span><span class="sp"></span><span class="btn ghost sm">Edit in Profile</span></div>
  </div></div>
 <div class="banner b-blue">{icon("hand","#60A5FA",18)}<div class="vstack" style="gap:4px;flex:1"><b style="font-weight:600">Filling a form yourself?</b><span style="font-size:12.5px;color:var(--ink2)">Open any job in a scout tab and choose Fill it myself. Before you click Submit, scout reads every field back, sorts each question into a type and offers the answers here the same way. Nothing is saved without your tick.</span>
  <div class="hstack" style="margin-top:4px"><span class="btn sm">{icon("tab","#ECECEC",13)}Fill it myself</span></div></div></div>
</div>'''
right25 = f'<div class="hstack" style="gap:8px;margin-left:12px"><span class="pill st-review"><span class="d"></span>Rodan Energy ready</span><span class="btn sm pri">Next form</span></div>'
body25 = f'<div class="row" style="gap:16px;align-items:stretch">{browser(head25,"job-boards.greenhouse.io/clio/jobs/7741203/confirmation",thanks_page)}{panel25}</div>'

S9 = [desktop("Desktop / 24 Reviewing on the filled form","today","Review",body24,crumb="Northwind Robotics, 1 of 3",right=right24),
      desktop("Desktop / 25 Remember these answers","today","Review",body25,crumb="Clio, 2 of 3",right=right25)]
open("desktop9.html","w").write(page(S9))
print("desktop9", len(page(S9)))
