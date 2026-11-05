from base import *

# ---------- resume preview (paper) ----------
def rb(text, hl=None):
    bg = f"background:{hl};border-radius:2px;" if hl else ""
    return f'<li style="margin:0 0 2px 0;{bg}">{text}</li>'
paper = f'''<div style="width:560px;flex-shrink:0;background:#FBFBF9;border-radius:4px;padding:34px 38px 30px;color:#111;font-family:'Source Serif 4',serif;font-size:9.6px;line-height:1.32;box-shadow:0 20px 60px rgba(0,0,0,0.45)">
<div style="text-align:center;font-size:20px;font-weight:600;letter-spacing:.3px">Sashreek Addanki</div>
<div style="text-align:center;font-size:7.9px;margin:3px 0 6px;white-space:nowrap">sashreek@example.com <span style="color:#888">|</span> +1 780 555 0142 <span style="color:#888">|</span> <u>linkedin.com/in/sashreek</u> <span style="color:#888">|</span> <u>github.com/Sashreek007</u> <span style="color:#888">|</span> <u>sashreek-addanki.vercel.app</u></div>
<div style="font-variant:small-caps;font-size:11.5px;border-bottom:.8px solid #111;margin-top:6px">Education</div>
<div style="display:flex;margin-top:3px"><b>University of Alberta</b><span style="flex:1"></span>Edmonton, AB</div>
<div style="display:flex"><i>B.Sc. Honors in Computing Science</i><span style="flex:1"></span><i>Sept. 2024 - May 2028</i></div>
<div style="font-variant:small-caps;font-size:11.5px;border-bottom:.8px solid #111;margin-top:7px">Experience</div>
<div style="display:flex;margin-top:3px"><b>Quantum Ops Inc.</b><span style="flex:1"></span>Oct. 2026 - Present</div>
<div style="display:flex"><i>Software Engineer</i><span style="flex:1"></span><i>Remote (Edmonton, AB)</i></div>
<ul style="margin:2px 0 0 14px;padding:0">
{rb("Worked on the backend of dropdog.ai, a fashion-discovery product that lists <b>~3,500 live sale deals</b> from <b>~250 brands</b>, on a 6-person startup team.")}
{rb('Held dropdog.ai at <b>99.9% uptime</b> while scaling its catalog REST API for a growing brand list, fixing failures in the affiliate redirect path.', "#FFF1CC")}
</ul>
<div style="display:flex;margin-top:4px"><b>Undergraduate Artificial Intelligence Club</b><span style="flex:1"></span>Sept. 2025 - Sept. 2026</div>
<div style="display:flex"><i>Software Engineer</i><span style="flex:1"></span><i>Edmonton, AB</i></div>
<ul style="margin:2px 0 0 14px;padding:0">
{rb("Screened every incoming message in the club's <b>~1,000-member</b> Discord in real time with a solo-built bot, cutting spam from <b>~daily to ~once a month</b>.")}
{rb("Led <b>4 contributors</b> on ClubMate AI, a hand-rolled Gemini agent loop calling ~21 tools across <b>5 MCP servers</b>, with LangChain/ChromaDB RAG over club documents.")}
</ul>
<div style="font-variant:small-caps;font-size:11.5px;border-bottom:.8px solid #111;margin-top:7px">Projects</div>
<div style="margin-top:3px"><b><u style="color:#1a3ea6">API Key &amp; Quota Service</u></b> | <i>Go, Redis, PostgreSQL, nginx, Lua, Docker, Prometheus, Grafana</i></div>
<ul style="margin:2px 0 0 14px;padding:0">
{rb('Validated API keys and enforced quotas for every request to a customer platform API, cutting /validate <b>p99 latency 41%</b> (17 to 10 ms) and <b>raising throughput 52%</b>.', "#E3EDFF")}
{rb("Reduced Postgres metering writes <b>376x</b> with write coalescing and held a <b>99.7% cache hit rate</b> (1,000 Zipf keys, 300k requests).")}
{rb('Tracked reliability on <b>2 Grafana dashboards (13 panels)</b>: request rate, 5xx errors, and p50/p95/p99 latency against a <b>p99 &lt; 20 ms SLO</b>.', "#E3EDFF")}
</ul>
<div style="margin-top:4px"><b><u style="color:#1a3ea6">Incident Diagnosis Engine</u></b> | <i>Java, Spring Boot, Spring AI, PostgreSQL, React, OpenTelemetry, Docker</i></div>
<ul style="margin:2px 0 0 14px;padding:0">
{rb("Ranked the likely root causes of a microservice outage in <b>under 60 seconds</b>, cutting <b>10,000 log lines</b> to a 15-signal evidence packet.")}
{rb("Narrowed every incident through <b>four deterministic stages before a single model call</b>: blast radius, change-point onset, suspect scoring, and log templating.")}
{rb("Implemented an evidence gate that drops any AI model claim not traceable to a retrieved signal, so <b>an uncited claim cannot reach the report</b>, checked on every push.")}
</ul>
<div style="font-variant:small-caps;font-size:11.5px;border-bottom:.8px solid #111;margin-top:7px">Technical Skills</div>
<div style="font-size:8.8px;margin-top:3px"><b>Languages</b>: Go, Python, Java, TypeScript, SQL, Bash<div style="background:#E3EDFF;border-radius:2px"><b>Platform and observability</b>: Docker, PostgreSQL, Redis, Prometheus, Grafana, OpenTelemetry, CI/CD, Linux</div><b>Frameworks and AI</b>: Spring Boot, Spring AI, React, FastAPI, LangChain, ChromaDB<br><b>Cloud</b>: AWS, Kubernetes</div>
</div>'''

def chk(label, detail, ok=True, warn=False):
    ic = icon("alert","#E3A23B",15) if warn else (icon("check","#5DB88C",15) if ok else icon("x","#EE6E5D",15))
    return f'<div class="hstack" style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);align-items:flex-start">{ic}<div class="vstack" style="gap:1px;flex:1"><span style="font-size:12.5px">{label}</span><span class="note">{detail}</span></div></div>'
def change(kind, text, detail=""):
    d = f'<div class="note" style="margin-top:2px">{detail}</div>' if detail else ""
    return f'<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div class="hstack"><span class="flag f-title">{kind}</span><span style="font-size:12.5px">{text}</span></div>{d}</div>'

resume_body = f'''
<div class="hstack" style="align-items:flex-start">
<div class="vstack" style="gap:6px"><div class="hstack"><span style="font-size:22px;font-weight:600;letter-spacing:-.3px">Northwind Robotics</span>{stage("review")}</div>
<div class="hstack muted" style="gap:14px"><span>Software Developer Intern</span><span>Toronto, ON</span><span>Winter 2027</span>{ats("gh")}<span class="hstack">{score(82)}<span class="note">leads with backend</span></span></div></div>
<span class="sp"></span><span class="btn">{icon("ext","#A9B1BD",13)}Posting</span><span class="btn danger">Skip</span><span class="btn dis">{icon("check","#5A636F",13)}Approve sheet</span></div>
<div class="tabs"><div class="tab">Answer sheet <span class="n">15</span></div><div class="tab on">Resume <span class="n">v2</span></div><div class="tab">Posting</div><div class="tab">History <span class="n">7</span></div><div class="tab">Notes</div></div>
<div class="row" style="align-items:flex-start;gap:24px">
 <div class="vstack" style="gap:12px;align-items:center;flex:1">
  <div class="hstack" style="width:560px"><span class="note">Version 2 of 2, after your edit to the dashboards bullet</span><span class="sp"></span><div class="seg"><span class="on">Page</span><span>Diff</span><span>Sources</span></div></div>
  {paper}
  <div class="hstack note" style="width:560px"><span class="hstack" style="gap:6px"><span style="width:10px;height:10px;background:#E3EDFF;border-radius:2px;display:inline-block"></span>Reworded for this job</span><span class="hstack" style="gap:6px"><span style="width:10px;height:10px;background:#FFF1CC;border-radius:2px;display:inline-block"></span>Stated by you, rehearse the source</span></div>
 </div>
 <div class="col" style="width:380px">
  <div class="card"><div class="cardh"><h2>Built from base v6</h2><span class="pill st-applied"><span class="d"></span>Active</span><div class="right"><span class="btn sm ghost">Change base</span></div></div>
   <div class="cardb vstack" style="gap:0">
    {change("Moved","API Key &amp; Quota Service now comes before Incident Diagnosis Engine","Platform job: mint's latency and SLO work leads.")}
    {change("Swapped","mint's SDK bullet out, observability bullet in","Alternate bullet for SRE and platform jobs.")}
    {change("Reworded","\"customer API\" to \"customer platform API\"","Same facts: mint.validate.p99, mint.throughput.")}
    {change("Cut","Durable Execution Engine (Latch) and the TA entry","Page space. The job asks for no agent work.")}
    {change("Skills","\"Technologies\" renamed \"Platform and observability\"","Row named the way the job names it.")}
   </div></div>
  <div class="card"><div class="cardh"><h2>Checks</h2><span class="sub">rules.md pre-flight</span><div class="right"><span class="pill st-applied"><span class="d"></span>13 of 13</span></div></div>
   <div class="cardb" style="padding-top:4px;padding-bottom:4px">
    {chk("One page","pdfinfo reports 1 page")}
    {chk("Bullets and lines","At most 3 per entry, every bullet 2 lines or fewer")}
    {chk("Bold spans","1 or 2 per bullet, no technology names bolded")}
    {chk("Opening verbs","No verb repeated within a section")}
    {chk("Words and dashes","No banned words, no em dashes")}
    {chk("Must-survive","Four deterministic stages, the RAG clause, the evidence gate wording")}
    {chk("Never-print","No hits on 31 never-print rules")}
    {chk("Numbers traced","14 of 14 numbers found in printable facts")}
    {chk("Links","4 of 4 return 200, including github.com/Sashreek007")}
    {chk("Stated fact on the page","99.9% uptime is your own figure. Have the monitor ready for an interview.", warn=True)}
   </div></div>
  <div class="card"><div class="cardb vstack" style="gap:10px">
   <div class="hstack" style="gap:12px"><div class="vstack" style="gap:2px;flex:1"><span class="t1">Allow unbacked claims</span><span class="note">Off. Turning it on needs a reason and tags this application "rehearse before a screen".</span></div><div class="toggle"></div></div>
   <div class="hstack"><span class="btn">{icon("edit","#A9B1BD",13)}Edit a bullet</span><span class="sp"></span><span class="btn pri">{icon("check","#FFFFFF",13)}Approve resume</span></div>
  </div></div>
 </div>
</div>'''

# ---------- Knowledge page ----------
def sug(kind, title, body, reason, actions, src=""):
    s = f'<span class="note">{src}</span>' if src else ""
    return f'''<div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.06)" class="vstack">
<div class="hstack"><span class="flag f-title">{kind}</span><span class="t1">{title}</span><span class="sp"></span>{s}</div>
<div style="font-size:13px;color:var(--ink);padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07)">{body}</div>
<div class="hstack note" style="align-items:flex-start">{icon("q","#7A8491",14)}<span>{reason}</span></div>
<div class="hstack">{actions}</div></div>'''
A = '<span class="btn sm pri">Accept</span><span class="btn sm">Edit</span><span class="btn sm ghost">Dismiss</span>'
knowledge_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Knowledge</h2><div class="muted">What scout knows about you. Nothing becomes part of it until you accept it, and every change is logged with the reason.</div></div><span class="sp"></span><span class="btn">{icon("plus","#A9B1BD",14)}Add a fact</span><span class="btn">Export to rules.md</span></div>
<div class="row" style="align-items:stretch">
 <div class="card" style="flex:1.1"><div class="cardh"><h2>Base resume</h2><span class="sub">Every tailored resume starts here</span></div>
  <div class="cardb hstack" style="gap:20px;align-items:flex-start">
   <div class="vstack" style="gap:6px"><div class="hstack"><span style="font-size:22px;font-weight:600">v6</span><span class="pill st-applied"><span class="d"></span>Active</span></div><span class="note">Locked August 16, 2026, your call</span><span class="note">12 bullets, 4 skill rows</span></div>
   <div style="width:1px;align-self:stretch;background:rgba(255,255,255,0.07)"></div>
   <div class="vstack" style="gap:8px;flex:1"><div class="hstack"><span class="t1">v7 is stored</span><span class="note">4 changes from v6</span></div>
    <div class="vstack" style="gap:4px;font-size:12.5px;color:var(--ink2)"><span>Cuts Replay's testing bullet</span><span>Adds the four deterministic stages bullet</span><span>Merges mint bullets 2 and 3, adds the observability bullet</span><span>Rewords the evidence gate</span></div>
    <div class="hstack"><span class="btn sm">Compare v6 and v7</span><span class="btn sm dark">Make v7 active</span></div>
    <span class="note">Resumes already built keep v6. Applications in review get a new version from v7.</span></div>
  </div></div>
 <div class="queue" style="flex:1;flex-wrap:wrap">
  <div class="q" style="flex:1 1 30%;border-bottom:1px solid rgba(255,255,255,0.06)"><span class="l">Facts</span><span class="v">64</span><span class="h">52 verified, 5 stated, 7 coursework</span></div>
  <div class="q" style="flex:1 1 30%;border-bottom:1px solid rgba(255,255,255,0.06)"><span class="l">Bullets</span><span class="v">31</span><span class="h">12 in v6, 19 alternates</span></div>
  <div class="q" style="flex:1 1 30%;border-right:none;border-bottom:1px solid rgba(255,255,255,0.06)"><span class="l">Rules</span><span class="v">48</span><span class="h">31 never-print</span></div>
  <div class="q" style="flex:1 1 30%"><span class="l">Decisions</span><span class="v">23</span><span class="h">Never re-asked</span></div>
  <div class="q" style="flex:1 1 30%"><span class="l">Remembered answers</span><span class="v">14</span><span class="h">Form questions</span></div>
  <div class="q" style="flex:1 1 30%;border-right:none"><span class="l">Waiting for you</span><span class="v" style="color:var(--amber)">6</span><span class="h">Suggestions</span></div>
 </div>
</div>
<div class="tabs"><div class="tab on">Suggestions <span class="n">8</span></div><div class="tab">Facts <span class="n">64</span></div><div class="tab">Bullets <span class="n">31</span></div><div class="tab">Rules <span class="n">48</span></div><div class="tab">Decisions <span class="n">23</span></div><div class="tab">Remembered answers <span class="n">14</span></div><div class="tab">Log</div></div>
<div class="row" style="align-items:flex-start">
 <div class="card" style="flex:1">
  {sug("Alternate bullet","From your edit on Northwind Robotics","Tracked reliability on <b>2 Grafana dashboards (13 panels)</b>: request rate, 5xx errors, and p50/p95/p99 latency against a <b>p99 &lt; 20 ms SLO</b>.","You changed \"Built 2 Grafana dashboards\" to \"Tracked reliability on\". Saved for platform and SRE jobs. Facts: mint.grafana.dashboards, mint.slo.",A,"Today 8:20")}
  {sug("Rule","Use \"Led\" for team work, never \"Built\"","Attribution: \"Built\" implies solo work. Team projects open with \"Led\" and name the team size.","You made this edit twice: on Clio (\"Built ClubMate AI\" to \"Led 4 contributors on ClubMate AI\") and on Nelnet.",A,"Yesterday")}
  {sug("Never-print","Don't claim Kafka","Kafka never appears on a resume or in a form answer.","You removed it from the Rodan Energy resume and wrote: \"never used it\".",A,"Nov 4")}
  {sug("Fact","Latch resumes a killed run from its last completed step","Unverified. Source: the Latch repo, runner tests added Nov 3.","Proposed by the repo check. READMEs don't verify a capability on their own, so check the code and tests before marking it verified.",'<span class="btn sm pri">Mark verified</span><span class="btn sm">Open source</span><span class="btn sm ghost">Dismiss</span>',"Nov 3")}
  {sug("Company","Northwind Robotics interviews in person in Toronto","Company memory. Every Northwind application so far asked about Toronto interviews.","Seen on 2 applications and in Priya's email on Nov 4.",A,"Nov 5")}
  {sug("Board skill","Lever: the location field autocompletes","Type the city, wait for the list, then pick the first match. Typing alone leaves the field empty.","A fill on TechInsights failed read-back on this field twice. Accepting opens a pull request on skills/lever.md.",A,"Nov 5")}
  {sug("Decision","Keep \"Software Engineer\" as the Quantum Ops title on every resume","One title across variants so reference checks and LinkedIn agree.","Your answer on Nov 5. Marked \"do not re-raise\".",A,"Nov 5")}
 </div>
 <div class="col" style="width:360px">
  <div class="card"><div class="cardh"><h2>Rehearse before interviews</h2><span class="sub">stated by you</span></div><div class="cardb vstack" style="gap:10px">
   <div class="vstack" style="gap:2px"><span class="t1">99.9% uptime</span><span class="note">Quantum Ops. Source owed: the monitor or status page.</span></div>
   <div class="vstack" style="gap:2px"><span class="t1">~250 partner brands, ~3,500 deals</span><span class="note">Public dropdog.ai homepage counts. Confirm with the team.</span></div></div></div>
  <div class="card"><div class="cardh"><h2>Recently changed</h2></div><div class="cardb tl">
   <div class="tli"><span class="dotc" style="background:#5DB88C"></span><div class="txt"><span>Accepted rule: no "100% cited"</span><span class="who">You, Aug 16. Reads as an inflated metric.</span></div></div>
   <div class="tli"><span class="dotc" style="background:#5DB88C"></span><div class="txt"><span>Accepted decision: no dates on projects</span><span class="who">You, Aug 16. Do not re-propose.</span></div></div>
   <div class="tli"><span class="dotc" style="background:#7AA2F7"></span><div class="txt"><span>Imported base v7 as stored, not active</span><span class="who">Seed import, Nov 5</span></div></div>
   <div class="tli"><span class="dotc" style="background:#E3A23B"></span><div class="txt"><span>Retired bullet: Replay 195 JUnit cases</span><span class="who">You, when comparing v7</span></div></div>
  </div></div>
 </div>
</div>'''

S4only = [desktop("Desktop / 05b Application, resume","board","Application",resume_body,crumb="Board / Review / Resume")]
S4 = [
 desktop("Desktop / 05b Application, resume","board","Application",resume_body,crumb="Board / Review / Resume"),
 desktop("Desktop / 09b Knowledge","memory","Knowledge",knowledge_body),
]
open("desktop4.html","w").write(page(S4))
open("resume_only.html","w").write(page(S4only))
print("desktop4", len(page(S4)))
