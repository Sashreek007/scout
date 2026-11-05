from base import *

# ---------- Today ----------
def q_card(company, role, ats_k, label, kind, options, suggestion, apps=1, sel=None):
    if kind == "choice":
        opts = "".join(f'<span class="btn sm{" dark" if o==sel else ""}">{o}</span>' for o in options)
        ans = f'<div class="hstack">{opts}</div>'
    else:
        ans = f'<div class="input" style="width:100%;color:var(--faint)">{options}</div>'
    sug = f'<div class="hstack note">{icon("spark","#6640C2",12)}<span>{suggestion}</span></div>' if suggestion else ""
    more = f'<span class="flag f-title">Also asked by {apps-1} other application{"s" if apps>2 else ""}</span>' if apps > 1 else ""
    return f'''<div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--line)">
 <div class="hstack" style="flex-wrap:wrap;row-gap:6px"><span class="t1">{company}</span><span class="muted">{role}</span><span class="sep"></span>{ats(ats_k)}<span class="sp"></span>{more}<span class="note">Asked 7:04</span></div>
 <div style="font-size:14px;font-weight:500">{label}</div>
 {ans}{sug}
 <div class="hstack"><span class="check on">{icon("check","#FFFFFF",11,2.5)}</span><span style="font-size:12.5px;color:var(--ink2)">Remember for future forms</span><span class="sp"></span><span class="btn sm ghost">Open sheet</span><span class="btn sm pri">Save answer</span></div>
</div>'''

def review_row(company, role, ats_k, counts, drafts, age, score_n):
    chips = " ".join(f'<span class="src src-{k}">{n} {SRC_LABEL[k] if k!="draft" else "draft"}</span>' for k,n in counts)
    return f'''<tr><td>{score(score_n)}</td><td><div class="t1">{company}</div><div class="t2">{role}</div></td><td>{ats(ats_k)}</td>
<td><div class="hstack" style="flex-wrap:wrap;gap:5px">{chips}</div></td><td>{drafts}</td><td class="t2">{age}</td><td style="text-align:right"><span class="btn sm dark">Review sheet</span></td></tr>'''

today_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Wednesday, November 5</h2><div class="muted">9 new matches since yesterday. 2 of today's 20 applications used.</div></div>
<span class="sp"></span><span class="btn">{icon("pause","#A9B1BD",14)}Pause scout</span><span class="btn">{icon("mac","#A9B1BD",14)}Start the agent</span></div>
<div class="queue">
 <div class="q"><span class="l">Questions waiting</span><span class="v" style="color:var(--amber)">4</span><span class="h">1 live, an agent is waiting</span></div>
 <div class="q"><span class="l">Sheets to review</span><span class="v">2</span><span class="h">One has a draft to read</span></div>
 <div class="q"><span class="l">Needs you at the Mac</span><span class="v" style="color:var(--red)">1</span><span class="h">CAPTCHA on a Lever form</span></div>
 <div class="q"><span class="l">Approved, waiting for the agent</span><span class="v">4</span><span class="h">Run <span class="mono">pnpm agent</span> on your Mac</span></div>
 <div class="q"><span class="l">Deadlines this week</span><span class="v">1</span><span class="h">CodeSignal, due Sunday</span></div>
</div>
<div class="row" style="align-items:flex-start">
 <div class="col" style="flex:1">
  <div class="banner b-red">{icon("alert","#B42318",18)}<div class="vstack" style="gap:4px;flex:1"><div class="t1" style="color:var(--ink)">Equitable Bank needs you at the Mac</div>
   <div style="font-size:12.5px">A CAPTCHA appeared on the Lever form. The browser is still open on your Mac with every field filled. Finish it there and scout marks it applied when the confirmation shows. <b>12:41 left</b> before the agent closes the tab.</div>
   <div class="hstack" style="margin-top:6px"><span class="btn sm">It went in, mark applied</span><span class="btn sm">Send back to approved</span><span class="btn sm ghost">Open application</span></div></div></div>
  <div class="card"><div class="cardh"><h2>Questions</h2><span class="sub">Not in your profile or memory yet</span><div class="right"><div class="seg"><span class="on">All 3</span><span>Choice</span><span>Text</span></div></div></div>
   <div>
   <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--line);background:rgba(227,162,59,0.07);box-shadow:inset 3px 0 0 #E3A23B">
 <div class="hstack"><span class="flag f-values">Live</span><span class="t1">Element Fleet</span><span class="muted">Forward Deployed Engineer Intern</span><span class="sep"></span><span class="note">tab "scout 2 · Element Fleet"</span><span class="sp"></span><span class="flag f-values">{icon("clock","#E3A23B",12)}8:41 left</span></div>
 <div style="font-size:14px;font-weight:500">Which office would you prefer: Toronto or Mississauga?</div>
 <div class="hstack"><span class="btn sm">Toronto</span><span class="btn sm">Mississauga</span><span class="btn sm">No preference</span></div>
 <div class="hstack note">{icon("mac","#7A8491",13)}<span>Agent 2 is holding this form open. Answer in time and it carries on filling; otherwise it moves to needs answers.</span></div>
 <div class="hstack"><span class="check on">{icon("check","#FFFFFF",11,2.5)}</span><span style="font-size:12.5px;color:var(--ink2)">Remember for future forms</span><span class="sp"></span><span class="btn sm pri">Send to agent 2</span></div>
</div>
   {q_card("Northwind Robotics","Software Developer Intern","gh","Are you available for in-person interviews in Toronto?","choice",["Yes","No"],"Claude suggests <b>Yes</b> from relocation.toronto, but that field is still TODO in your profile",apps=2,sel="Yes")}
   {q_card("TechInsights","Software Development Co-op","lv","Do you have a valid driver's licence?","choice",["Yes","No"],"")}
   {q_card("Nelnet","Platform Engineer Intern","gh","What is your expected hourly rate (CAD)?","text","Type an answer, e.g. 28","Claude suggests $26 to $30 from compensation.expected_hourly_cad")}
   </div></div>
  <div class="card"><div class="cardh"><h2>Ready for review</h2><span class="sub">The agent types exactly what you approve</span></div>
   <table class="tight"><tr><th style="width:56px">Score</th><th style="width:210px">Application</th><th>Board</th><th>Answer sources</th><th>Drafts</th><th>Waiting</th><th></th></tr>
   {review_row("Clio","Software Developer Co-op","gh",[("profile",10),("memory",2),("policy",2)],'<span class="muted">none</span>',"3h",88)}
   {review_row("Rodan Energy Solutions","AI Solutions Specialist Co-op","lv",[("profile",8),("memory",1),("you",1),("draft",1)],'<span class="src src-draft">1 to read</span>',"40m",79)}
   </table></div>
 </div>
 <div class="col" style="width:360px">
  <div class="card"><div class="cardh"><h2>Last pipeline run</h2><div class="right"><span class="pill st-needs_answers"><span class="d"></span>Partial</span></div></div>
   <div class="cardb vstack" style="gap:10px">
    <div class="hstack note">{icon("clock","#6C7169",14)}Today 7:02 to 7:06 on GitHub Actions, $0.41</div>
    <div class="hstack"><span>SimplifyJobs list</span><span class="sp"></span><span class="muted">473 in Canada, <b style="color:var(--ink)">6 new</b></span></div>
    <div class="hstack"><span>vanshb03 list</span><span class="sp"></span><span class="muted">289 in Canada, <b style="color:var(--ink)">3 new</b></span></div>
    <div class="hstack"><span>Greenhouse boards</span><span class="sp"></span><span class="muted">53 boards</span></div>
    <div class="hstack"><span>Lever boards</span><span class="sp"></span><span class="muted">15 boards</span></div>
    <div class="hstack"><span>Ashby boards</span><span class="sp"></span><span class="muted">18 boards</span></div>
    <div class="banner b-amber" style="padding:10px 12px;font-size:12px">{icon("alert","#9A600A",14)}<span>2 vansh short links didn't resolve, and 1 Greenhouse board returned 404. Everything else ran.</span></div>
    <span class="btn sm" style="align-self:flex-start">Open run log</span>
   </div></div>
  <div class="card"><div class="cardh"><h2>Coming up</h2></div>
   <div class="cardb vstack" style="gap:12px">
    <div class="hstack" style="align-items:flex-start"><div class="vstack" style="gap:2px"><span class="t1">Northwind · CodeSignal</span><span class="note">Found by mail watcher · Nov 4</span></div><span class="sp"></span>{stage("assessment")}</div>
    <div class="hstack"><span class="note">Due Sun Nov 9, 11:59 pm</span><span class="sp"></span><span class="btn sm">Mark done</span></div>
    <div class="divider"></div>
    <div class="hstack" style="align-items:flex-start"><div class="vstack" style="gap:2px"><span class="t1">Cohere · Interview</span><span class="note">Moved by you · Nov 3</span></div><span class="sp"></span>{stage("interview")}</div>
    <div class="hstack"><span class="note">Prep notes added · Fri Nov 7, 2:00 pm</span></div>
   </div></div>
  <div class="card"><div class="cardh"><h2>Today's cap</h2><div class="right"><span class="muted">2 of 20</span></div></div>
   <div class="cardb vstack"><div class="bar"><i style="width:10%;background:var(--accent)"></i></div><span class="note">Resets at midnight, Edmonton time. Change it in Settings.</span></div></div>
 </div>
</div>'''

# ---------- Jobs ----------
def job_row(sc, company, title, loc, term, atsk, resume, reason, flags, seen, action, sel=False):
    fl = "".join(flags)
    extra = f'<div class="hstack" style="gap:4px;margin-top:5px">{fl}</div>' if flags else ""
    return f'''<tr class="{"sel" if sel else ""}"><td>{score(sc)}</td><td><div class="co" style="align-items:flex-start">{company_logo(company,30,8)}<div><div class="t1">{company}</div><div class="t2" style="color:var(--ink2)">{title}</div><div class="t2">{loc} · {term}</div>{extra}</div></div></td>
<td>{ats(atsk)}</td><td><span class="mono">{resume}</span></td><td style="text-align:right">{action}</td></tr>'''
Q = '<span class="btn sm pri">Queue</span>'
QD = f'<span class="pill st-queued"><span class="d"></span>Queued</span>'
jobs_rows = "".join([
 job_row(88,"Clio","Software Developer Co-op","Calgary, AB · Edmonton, AB","Winter 2027","gh","backend","Rails and React product team; matches your API and Postgres work; Alberta",[],"Today",'<span class="pill st-review"><span class="d"></span>Review</span>'),
 job_row(82,"Northwind Robotics","Software Developer Intern","Toronto, ON","Winter 2027","gh","backend","Go and Kubernetes services; your API key service lines up with their platform team",[],"Today",'<span class="pill st-needs_answers"><span class="d"></span>Needs answers</span>',sel=True),
 job_row(79,"Rodan Energy Solutions","AI Solutions Specialist Co-op","Mississauga, ON","Winter 2027","lv","ai","LLM tooling for energy data; your incident diagnosis engine is a close fit",[],"Today",'<span class="pill st-review"><span class="d"></span>Review</span>'),
 job_row(77,"Nelnet","Platform Engineer Intern","Mississauga, ON","Summer 2027","gh","devops","CI/CD and AWS; strong DevOps match",[],"Today",'<span class="pill st-needs_answers"><span class="d"></span>Needs answers</span>'),
 job_row(74,"Element Fleet Management","Forward Deployed Engineer Intern","Toronto, ON","Summer 2027","ot","ai","Customer-facing AI engineering; title only, no posting text",['<span class="flag f-title">title only</span>'],"Today",Q),
 job_row(71,"TechInsights","Software Development Co-op","Ottawa, ON","Winter 2027","lv","backend","Internal tooling in Python and Java",[],"Yesterday",QD),
 job_row(68,"Northstar Avionics","Embedded Software Intern","Kanata, ON","Summer 2027","wd","backend","Aerospace software; description mentions military customers",['<span class="flag f-values">values review</span>'],"Yesterday",Q),
 job_row(63,"Maple Secure Networks","Security Engineering Co-op","Ottawa, ON","Winter 2027","gh","devops","Network security tooling; asks for security clearance eligibility",['<span class="flag f-clearance">clearance</span>'],"Nov 3",Q),
 job_row(58,"DataVisor","Software Engineer Intern","Remote in Canada","Unknown","ot","backend","Fraud detection backend; term not stated",['<span class="flag f-term">term unknown</span>'],"Nov 3",Q),
])

drawer = f'''<div class="card" style="width:350px;flex-shrink:0;display:flex;flex-direction:column">
 <div class="cardh" style="align-items:flex-start"><div class="vstack" style="gap:3px"><span class="note">greenhouse:northwind:7741203</span><h2 style="font-size:16px">Software Developer Intern</h2><span class="muted">Northwind Robotics, Toronto, ON, Winter 2027</span></div><div class="right">{icon("x","#6C7169",16)}</div></div>
 <div class="cardb vstack" style="gap:16px">
  <div class="hstack">{score(82)}<span class="pill st-applied"><span class="d"></span>Apply</span><span class="mono muted">resume: backend</span><span class="sp"></span><span class="note">Claude Haiku 5.5 · low effort</span></div>
  <div class="vstack" style="gap:6px"><span class="sectionlabel">Why it fits</span>
   <div class="hstack" style="align-items:flex-start">{icon("check","#1E7A4C",14)}<span>Go and Kubernetes platform work matches your API key and quota service</span></div>
   <div class="hstack" style="align-items:flex-start">{icon("check","#1E7A4C",14)}<span>Winter 2027, 4 or 8 months, Toronto hybrid</span></div>
   <div class="hstack" style="align-items:flex-start">{icon("check","#1E7A4C",14)}<span>Asks for Prometheus and Grafana, which your resume backs</span></div></div>
  <div class="vstack" style="gap:6px"><span class="sectionlabel">Hard filters</span>
   <table style="font-size:12px"><tr><td style="padding:5px 0;border:none">Location</td><td style="padding:5px 0;border:none" class="muted">Toronto, ON</td><td style="padding:5px 0;border:none;text-align:right">{icon("check","#1E7A4C",13)}</td></tr>
   <tr><td style="padding:5px 0;border:none">Role</td><td style="padding:5px 0;border:none" class="muted">software</td><td style="padding:5px 0;border:none;text-align:right">{icon("check","#1E7A4C",13)}</td></tr>
   <tr><td style="padding:5px 0;border:none">Term</td><td style="padding:5px 0;border:none" class="muted">Winter 2027 in your terms</td><td style="padding:5px 0;border:none;text-align:right">{icon("check","#1E7A4C",13)}</td></tr>
   <tr><td style="padding:5px 0;border:none">Values</td><td style="padding:5px 0;border:none" class="muted">not on excluded list</td><td style="padding:5px 0;border:none;text-align:right">{icon("check","#1E7A4C",13)}</td></tr>
   <tr><td style="padding:5px 0;border:none">Eligibility</td><td style="padding:5px 0;border:none" class="muted">no citizen, PR or SWPP clause</td><td style="padding:5px 0;border:none;text-align:right">{icon("check","#1E7A4C",13)}</td></tr>
   <tr><td style="padding:5px 0;border:none">Already applied</td><td style="padding:5px 0;border:none" class="muted">no</td><td style="padding:5px 0;border:none;text-align:right">{icon("check","#1E7A4C",13)}</td></tr></table></div>
  <div class="vstack" style="gap:6px"><span class="sectionlabel">Seen in</span>
   <div class="hstack"><span class="chip">SimplifyJobs list</span><span class="chip">Greenhouse board</span></div><span class="note">First seen today 7:03 · last seen today 7:03</span></div>
  <div class="vstack" style="gap:6px"><span class="sectionlabel">Posting</span>
   <div style="font-size:12.5px;color:var(--ink2);line-height:1.55;background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:10px 12px">Join the Platform team building the services that schedule and monitor our warehouse robots. You will write Go services, own a Kubernetes deployment end to end, and add metrics in Prometheus... <span style="color:var(--blue)">Show all</span></div></div>
  <div class="hstack"><span class="btn sm danger">Skip</span><span class="sp"></span><span class="btn sm">{icon("ext","#38413B",13)}Posting</span><span class="btn sm pri">Open application</span></div>
 </div></div>'''

jobs_body = f'''
<div class="hstack" style="gap:10px"><div class="input" style="flex:1;max-width:620px;height:40px;border-radius:999px;gap:10px;color:var(--muted)">{icon("plus","#8F8F8F",16)}<span>Paste a job link from anywhere, LinkedIn included</span><span class="sp"></span><span class="kbd">⌘J</span></div><span class="btn pri">Add job</span><span class="sp"></span><span class="note">You added 3 jobs this week</span></div>
<div class="tabs"><div class="tab on">Apply <span class="n">8</span></div><div class="tab">Maybe <span class="n">5</span></div><div class="tab">Skipped by triage <span class="n">14</span></div><div class="tab">Filtered out <span class="n">311</span></div><div class="tab">Closed <span class="n">22</span></div><div class="tab">All <span class="n">360</span></div></div>
<div class="hstack" style="flex-wrap:wrap"><span class="chip on">{icon("filter","#fff",12)}Canada</span><span class="chip">Alberta first</span><span class="chip">Remote in Canada</span><span class="chip">Winter 2027</span><span class="chip">Summer 2027</span><span class="chip">Greenhouse</span><span class="chip">Lever</span><span class="chip">Ashby</span><span class="chip">Workday</span><span class="chip">Score 55+</span><span class="chip">Has flags</span><span class="sp"></span><span class="note">Sorted by score · auto-queue at 75</span></div>
<div class="row" style="align-items:flex-start">
 <div class="card" style="flex:1;overflow:hidden"><table>
 <tr><th style="width:64px">Score</th><th>Job</th><th style="width:128px">Board</th><th style="width:96px">Resume</th><th style="width:150px"></th></tr>{jobs_rows}</table>
 <div class="hstack" style="padding:12px 16px"><span class="note">9 of 8 apply and 1 maybe shown · scores come from Claude, filters from code</span><span class="sp"></span><span class="btn sm">Load more</span></div></div>
 {drawer}
</div>'''

# ---------- Jobs: filtered out ----------
def f_row(company, title, loc, rule, detail, src_):
    return f'<tr><td><div class="t1">{company}</div><div class="t2">{title}</div></td><td>{loc}</td><td><span class="flag f-term">{rule}</span></td><td style="font-size:12px">{detail}</td><td class="t2">{src_}</td><td style="text-align:right"><span class="btn sm ghost">View posting</span></td></tr>'
filt_rows = "".join([
 f_row("General Dynamics Mission Systems","Software Developer Co-op","Ottawa, ON","values","General Dynamics is on your excluded employers list","SimplifyJobs"),
 f_row("Acme Data Labs","Data Engineering Intern","Remote in USA","location","No Canadian location","SimplifyJobs"),
 f_row("Prairie Analytics","Junior Data Analyst","Regina, SK","eligibility","Funded through SWPP: \"must be a Canadian citizen, permanent resident or protected person\"","vanshb03"),
 f_row("Qualcomm","Display IP FPGA Emulation Intern","Markham, ON","role","Hardware title: FPGA, emulation","SimplifyJobs"),
 f_row("Boston Scientific","R&amp;D Product Development Intern","Montreal, QC","role","Mechanical and R&amp;D, not a software role","SimplifyJobs"),
 f_row("Semtech","Analog Design Engineer Intern","Calgary, AB","role","Analog design","SimplifyJobs"),
 f_row("ShopNorth","Software Engineer Intern","Toronto, ON","term","Fall 2026 only; not in your terms","Greenhouse board"),
 f_row("Lakeside Robotics","Controls Co-op","Waterloo, ON","eligibility","Federal FSWEP posting","vanshb03"),
])
filtered_body = f'''
<div class="tabs"><div class="tab">Apply <span class="n">8</span></div><div class="tab">Maybe <span class="n">5</span></div><div class="tab">Skipped by triage <span class="n">14</span></div><div class="tab on">Filtered out <span class="n">311</span></div><div class="tab">Closed <span class="n">22</span></div><div class="tab">All <span class="n">360</span></div></div>
<div class="queue">
 <div class="q"><span class="l">Location</span><span class="v">164</span><span class="h">No Canadian location</span></div>
 <div class="q"><span class="l">Role</span><span class="v">118</span><span class="h">Hardware, analog, sales</span></div>
 <div class="q"><span class="l">Term</span><span class="v">17</span><span class="h">Outside your terms</span></div>
 <div class="q"><span class="l">Values</span><span class="v">4</span><span class="h">Excluded employers</span></div>
 <div class="q"><span class="l">Eligibility</span><span class="v">8</span><span class="h">Citizen, PR, SWPP or FSWEP</span></div>
</div>
<div class="banner b-blue">{icon("filter","#2459A8",16)}<div style="font-size:12.5px">These rules run in code before Claude sees a posting, so they never cost tokens. Edit the lists in <b>Profile → Filters</b>. Defence keywords only add a <span class="flag f-values">values review</span> flag; they never drop a job by themselves.</div></div>
<div class="card" style="overflow:hidden"><table><tr><th>Job</th><th>Location</th><th>Rule</th><th>Why it was dropped</th><th>Source</th><th></th></tr>{filt_rows}</table></div>'''

# ---------- Board ----------
def bcard(company, role, extra="", score_n=None, age="", ats_k="gh"):
    s = score(score_n) if score_n else ""
    return f'''<div class="card" style="padding:10px 11px;display:flex;flex-direction:column;gap:6px;border-radius:12px;background:#333333">
<div class="hstack"><span class="t1" style="font-size:13px">{company}</span></div>
<div class="t2">{role}</div><div class="hstack" style="gap:6px">{board_logo(ats_k,16,4)}<span class="note" style="font-size:12px">{age}</span><span class="sp"></span>{s}</div>{extra}</div>'''
def bcol(st, n, cards, w=150):
    return f'''<div style="width:{w}px;flex-shrink:0;display:flex;flex-direction:column;gap:8px">
<div class="hstack">{stage(st)}<span class="note">{n}</span></div>{"".join(cards)}</div>'''
board_body = f'''
<div class="hstack"><div class="seg"><span class="on">Board</span><span>List</span></div><span class="chip on">All boards</span><span class="chip">This week</span><span class="chip">Has deadline</span><span class="sp"></span><span class="note">Drag is only allowed for moves you can make: answer, approve, skip, retry, and stages after applied.</span></div>
<div class="card" style="padding:14px;background:var(--surface2)">
 <div class="hstack" style="margin-bottom:10px"><span class="t1">Getting ready</span><span class="note">pipeline and agent move these</span></div>
 <div style="display:flex;gap:10px;align-items:flex-start">
 {bcol("queued",2,[bcard("Element Fleet","Forward Deployed Engineer Intern",score_n=74,age="2h",ats_k="ot"),bcard("TechInsights","Software Development Co-op",score_n=71,age="1d",ats_k="lv")])}
 {bcol("planning",1,[bcard("DataVisor","Software Engineer Intern",score_n=58,age="5m",ats_k="ot")])}
 {bcol("needs_answers",2,[bcard("Northwind Robotics","Software Developer Intern",'<span class="flag f-values" style="background:var(--ambersoft)">1 question</span>',82,"3h"),bcard("Nelnet","Platform Engineer Intern",'<span class="flag f-values">1 question</span>',77,"3h")])}
 {bcol("review",2,[bcard("Clio","Software Developer Co-op",'',88,"3h"),bcard("Rodan Energy","AI Solutions Specialist Co-op",'<span class="src src-draft">1 draft</span>',79,"40m","lv")])}
 {bcol("approved",4,[bcard("Wealthsimple","Software Engineer Intern",'',84,"1d","ab"),bcard("Shopify","Dev Degree Intern",'',81,"1d"),bcard("+ 2 more","",'',None,"")])}
 {bcol("filling",0,['<div class="note" style="padding:6px 2px">Empty</div>'],w=78)}
 {bcol("needs_hand",1,[bcard("Equitable Bank","Product Mgmt Intern",'<span class="flag f-captcha">CAPTCHA · 12:41 left</span>',70,"6m","lv")],w=170)}
 </div>
</div>
<div class="card" style="padding:14px;background:var(--surface2)">
 <div class="hstack" style="margin-bottom:10px"><span class="t1">After applying</span><span class="note">you or the mail watcher move these</span></div>
 <div style="display:flex;gap:10px;align-items:flex-start">
 {bcol("applied",9,[bcard("BiblioCommons","Junior Full-Stack Eng. Intern",'',76,"2d"),bcard("Cohere","Software Engineer Intern",'',90,"6d","ab"),bcard("+ 7 more","",'',None,"")],w=190)}
 {bcol("assessment",1,[bcard("Northwind Robotics","Backend Intern, Fall",'<span class="flag f-clearance" style="background:var(--indigosoft);color:var(--indigo)">due Sun Nov 9</span>',80,"1d")],w=190)}
 {bcol("interview",1,[bcard("Cohere","ML Infra Intern",'<span class="note">Fri Nov 7, 2:00 pm</span>',86,"2d","ab")],w=190)}
 {bcol("offer",0,['<div class="note" style="padding:6px 2px">Not yet</div>'],w=150)}
 {bcol("rejected",2,[bcard("Ciena","Software Design Co-op",'',66,"4d","wd")],w=180)}
 {bcol("withdrawn",0,['<div class="note" style="padding:6px 2px">None</div>'],w=150)}
 </div>
</div>
<div class="hstack note"><span>Hidden columns:</span><span class="pill st-skipped"><span class="d"></span>Skipped 6</span><span class="pill st-closed"><span class="d"></span>Closed 3</span><span class="pill st-failed"><span class="d"></span>Failed 1</span><span class="btn sm ghost">Show</span></div>'''

S1only = [desktop("Desktop / 01 Today","today","Today",today_body)]
S1 = [
 desktop("Desktop / 01 Today","today","Today",today_body),
 desktop("Desktop / 02 Jobs","jobs","Jobs",jobs_body,crumb="360 Canadian postings tracked"),
 desktop("Desktop / 03 Jobs, filtered out","jobs","Jobs",filtered_body,crumb="Why postings were dropped"),
 desktop("Desktop / 04 Board","board","Board",board_body,crumb="22 active applications"),
]
open("desktop1.html","w").write(page(S1))
open("today_only.html","w").write(page(S1only))
print("desktop1", len(page(S1)))
