from base import *
from logos import google_g, si_svg

def fld(label, value, todo=False, hint="", w=None, mono=False):
    st = f' style="width:{w}px"' if w else ""
    cls = "input todo" if todo else "input"
    v = f'<span class="mono">{value}</span>' if mono else value
    h = f'<span class="note">{hint}</span>' if hint else ""
    return f'<div class="field"{st}><label>{label}</label><div class="{cls}">{v}</div>{h}</div>'
def section(title, sub, body, right=""):
    return f'''<div class="card"><div class="cardh"><h2>{title}</h2><span class="sub">{sub}</span><div class="right">{right}</div></div><div class="cardb" style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">{body}</div></div>'''

profile_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Profile</h2><div class="muted">Every form answer comes from here. The planner can't state a fact that isn't on this page or in memory.</div></div><span class="sp"></span><span class="btn">Export to profile.yaml</span><span class="btn pri">Save changes</span></div>
<div class="banner b-amber">{icon("alert","#9A600A",16)}<div style="font-size:13px"><b>2 fields still say TODO.</b> Questions that need them stay open until you fill them in: relocation to Toronto, and Science Internship Program registration.</div></div>
<div class="row" style="align-items:flex-start">
 <div class="col" style="width:200px;flex-shrink:0;gap:2px">
  <div class="nav on" style="color:var(--ink)">Identity and links</div><div class="nav">Education</div><div class="nav">Work authorization <span class="cnt hot">1</span></div><div class="nav">Availability <span class="cnt hot">1</span></div><div class="nav">Compensation</div><div class="nav">Current role</div><div class="nav">Resumes</div><div class="nav">Demographics</div><div class="nav">Filters</div>
 </div>
 <div class="col" style="flex:1">
  {section("Identity and links","", fld("First name","Sashreek")+fld("Last name","Addanki")+fld("Email","sashreek@example.com")+fld("Phone","+1 780 555 0142")+fld("City","Edmonton, AB, Canada")+fld("LinkedIn","linkedin.com/in/sashreek")+fld("GitHub","github.com/Sashreek007")+fld("Portfolio","sashreek-addanki.vercel.app"))}
  {section("Work authorization","Answers yes or no questions about working in Canada", fld("Status","Study permit and co-op work permit")+fld("Citizenship","India")+fld("Canadian citizen or permanent resident","No")+fld("Needs sponsorship for a co-op term","No")+fld("Co-op or internship program","UAlberta Science Internship Program")+fld("Registered in the program","TODO",todo=True,hint="Some forms ask this as yes or no"))}
  {section("Availability","Used for start dates, term length and relocation", fld("Earliest start","January 5, 2027")+fld("Term lengths","4, 8 or 12 months")+fld("Edmonton","Yes")+fld("Calgary","Yes")+fld("Toronto","TODO",todo=True,hint="Blocks 1 open question")+fld("Remote in Canada","Yes"))}
  <div class="card"><div class="cardh"><h2>Resumes</h2><span class="sub">Triage picks a variant for each job. The agent checks the file hash before uploading.</span><div class="right"><span class="btn sm">{icon("plus","#A9B1BD",13)}Add variant</span></div></div>
   <table><tr><th>Variant</th><th>File</th><th>SHA-256</th><th>Used for</th><th>Status</th></tr>
   <tr><td class="t1">backend</td><td class="mono">sashreek-backend.pdf</td><td class="mono muted">3f9a…c21</td><td class="t2">Backend and platform roles</td><td>{icon("ok","#5DB88C",16)}</td></tr>
   <tr><td class="t1">ai</td><td class="mono">sashreek-ai.pdf</td><td class="mono muted">b71e…09d</td><td class="t2">AI and ML roles</td><td>{icon("ok","#5DB88C",16)}</td></tr>
   <tr><td class="t1">devops</td><td class="mono">sashreek-devops.pdf</td><td class="mono muted">e04c…7a2</td><td class="t2">DevOps and SRE roles</td><td>{icon("ok","#5DB88C",16)}</td></tr></table></div>
  <div class="card"><div class="cardh"><h2>Documents</h2><span class="sub">Kept on your Mac. Attached only when a sheet you approved lists them.</span><div class="right"><span class="btn sm">{icon("plus","#A9B1BD",13)}Add document</span></div></div>
   <table><tr><th>Kind</th><th>File</th><th>SHA-256</th><th>Added</th><th>Status</th></tr>
   <tr><td class="t1">Transcript</td><td class="mono">transcript-2026-09.pdf</td><td class="mono muted">a41d…9e0</td><td class="t2">Sep 12</td><td><span class="pill st-applied"><span class="d"></span>Current</span></td></tr>
   <tr><td class="t1">Cover letter template</td><td class="mono">cover-letter.tex</td><td class="mono muted">c90b…12f</td><td class="t2">Nov 5</td><td><span class="pill"><span class="d" style="background:#8F8F8F"></span>Used when required</span></td></tr>
   <tr><td class="t1">Co-op work permit</td><td class="mono">work-permit.pdf</td><td class="mono muted">77e2…b03</td><td class="t2">Aug 20</td><td><span class="pill st-applied"><span class="d"></span>Current</span></td></tr></table></div>
  <div class="card"><div class="cardh"><h2>Filters</h2><span class="sub">Run in code before Claude sees a posting</span></div><div class="cardb vstack" style="gap:14px">
   <div class="field"><label>Excluded employers</label><div class="hstack" style="flex-wrap:wrap;gap:6px"><span class="chip">Palantir {icon("x","#7A8491",12)}</span><span class="chip">Thales {icon("x","#7A8491",12)}</span><span class="chip">CAE {icon("x","#7A8491",12)}</span><span class="chip">General Dynamics {icon("x","#7A8491",12)}</span><span class="chip">Lockheed Martin {icon("x","#7A8491",12)}</span><span class="chip">MDA {icon("x","#7A8491",12)}</span><span class="chip">Calian {icon("x","#7A8491",12)}</span><span class="btn sm ghost">{icon("plus","#A9B1BD",13)}Add</span></div><span class="note">Matched against company names, including longer names like General Dynamics UK. Defence words in a posting only add a values review flag.</span></div>
   <div class="field"><label>Target roles</label><div class="hstack" style="flex-wrap:wrap;gap:6px"><span class="chip on">Software</span><span class="chip on">AI and ML</span><span class="chip on">Data</span><span class="chip on">DevOps and platform</span><span class="chip">Product</span><span class="chip">Hardware</span></div></div>
   <div class="field"><label>Terms</label><div class="hstack" style="gap:6px"><span class="chip on">Winter 2027</span><span class="chip on">Summer 2027</span><span class="chip on">Fall 2027</span><span class="chip">Fall 2026</span></div></div>
  </div></div>
 </div>
</div>'''

def mem_row(q, a, kind, used, last, created):
    k = '<span class="flag f-title">Fact</span>' if kind=="fact" else '<span class="flag f-term">Preference</span>'
    return f'<tr><td><div class="t1">{q}</div></td><td>{a}</td><td>{k}</td><td class="t2">{used}</td><td class="t2">{last}</td><td class="t2">{created}</td><td style="text-align:right"><span class="btn sm ghost">{icon("edit","#A9B1BD",13)}Edit</span></td></tr>'
memory_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Memory</h2><div class="muted">Answers you gave once and scout reuses. Matching is exact after removing case, punctuation and the company name.</div></div><span class="sp"></span><span class="btn">{icon("plus","#A9B1BD",14)}Add answer</span></div>
<div class="hstack"><div class="search" style="margin-left:0;width:360px">{icon("search","#5A636F",14)}<span>Search remembered questions</span></div><div class="seg"><span class="on">All 14</span><span>Facts 9</span><span>Preferences 5</span></div><span class="sp"></span><span class="note">Sorted by last used</span></div>
<div class="card" style="overflow:hidden"><table><tr><th>Question</th><th>Answer</th><th>Kind</th><th>Used</th><th>Last used</th><th>Added</th><th></th></tr>
{mem_row("Are you available for in-person interviews in Toronto?","Yes","preference","2 times","Today","Today, by you")}
{mem_row("How did you hear about us?","Job board","preference","11 times","Today","Nov 2")}
{mem_row("Are you currently enrolled in a co-op or internship program?","Yes, the UAlberta Science Internship Program","fact","7 times","Yesterday","Nov 1")}
{mem_row("Are you willing to relocate for this role?","Yes, anywhere in Canada","preference","6 times","Yesterday","Nov 1")}
{mem_row("What is your expected graduation date?","April 2028","fact","5 times","Nov 4","Nov 1")}
{mem_row("Have you previously worked for this company?","No","fact","4 times","Nov 4","Nov 2")}
{mem_row("Do you now or will you in the future require visa sponsorship?","No, not for a co-op term","fact","9 times","Nov 4","Nov 1")}
{mem_row("Which programming languages are you strongest in?","Go, Java, TypeScript, Python","fact","3 times","Nov 3","Nov 3")}
</table></div>
<div class="banner b-blue">{icon("help-circle" if False else "q","#7AA2F7",16)}<div style="font-size:13px">Editing an answer only changes future forms. Applications already submitted keep the exact answers that were sent.</div></div>'''

def run_row(time, kind, status, dur, new, cost, sel=False):
    st = {"ok":'<span class="pill st-applied"><span class="d"></span>OK</span>',"partial":'<span class="pill st-needs_answers"><span class="d"></span>Partial</span>',"failed":'<span class="pill st-failed"><span class="d"></span>Failed</span>'}[status]
    return f'<tr class="{"sel" if sel else ""}"><td class="t1">{time}</td><td class="t2">{kind}</td><td>{st}</td><td class="t2">{dur}</td><td>{new}</td><td class="t2">{cost}</td></tr>'
runs_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Runs</h2><div class="muted">Every pipeline run on GitHub Actions and every agent session on your Mac. Runs older than 90 days are deleted.</div></div><span class="sp"></span><span class="btn">{icon("refresh","#A9B1BD",14)}Run pipeline now</span></div>
<div class="row" style="align-items:flex-start">
 <div class="card" style="width:470px;flex-shrink:0;overflow:hidden"><div class="cardh"><div class="seg"><span class="on">All</span><span>Pipeline</span><span>Agent</span></div></div>
 <table class="tight" style="font-size:13px"><tr><th>Started</th><th>Kind</th><th>Status</th><th>Took</th><th>New</th><th>Cost</th></tr>
 {run_row("Today 9:05","Agent","partial","4m","1 applied","$0.00")}
 {run_row("Today 7:02","Pipeline","partial","4m 12s","9","$0.41",sel=True)}
 {run_row("Yesterday 7:01","Pipeline","ok","3m 48s","6","$0.33")}
 {run_row("Yesterday 19:40","Agent","ok","22m","5 applied","$0.06")}
 {run_row("Nov 3 7:03","Pipeline","ok","3m 55s","11","$0.52")}
 {run_row("Nov 2 7:02","Pipeline","failed","0m 40s","0","$0.00")}
 {run_row("Nov 1 7:00","Pipeline","ok","9m 30s","214","$4.92")}
 </table></div>
 <div class="col" style="flex:1">
  <div class="card"><div class="cardh"><h2>Pipeline run, today 7:02</h2><span class="pill st-needs_answers"><span class="d"></span>Partial</span><div class="right"><span class="note">Commit 6014445</span><span class="btn sm">{si_svg("github",13,"#ECECEC")}GitHub Actions log</span></div></div>
   <table><tr><th>Source</th><th>Fetched</th><th>Valid</th><th>In Canada</th><th>New</th><th>Changed</th><th>Notes</th></tr>
   <tr><td class="t1">SimplifyJobs list</td><td>17,698</td><td>17,698</td><td>473</td><td>6</td><td>2</td><td class="t2"></td></tr>
   <tr><td class="t1">vanshb03 list</td><td>2,987</td><td>2,984</td><td>289</td><td>3</td><td>0</td><td class="t2">3 bad rows skipped, 2 short links unresolved</td></tr>
   <tr><td class="t1">Greenhouse boards</td><td>53</td><td>52</td><td>41</td><td>0</td><td>1</td><td class="t2"><span style="color:var(--amber)">1 board returned 404</span></td></tr>
   <tr><td class="t1">Lever boards</td><td>15</td><td>15</td><td>12</td><td>0</td><td>0</td><td class="t2"></td></tr>
   <tr><td class="t1">Ashby boards</td><td>18</td><td>18</td><td>9</td><td>0</td><td>0</td><td class="t2"></td></tr></table></div>
  <div class="row">
   <div class="card" style="flex:1"><div class="cardh"><h2>Filters</h2><span class="sub">new and changed jobs</span></div><div class="cardb vstack" style="gap:9px">
    <div class="hstack"><span>Passed</span><span class="sp"></span><b>6</b></div>
    <div class="hstack"><span class="muted">Location</span><span class="sp"></span>2</div><div class="hstack"><span class="muted">Role</span><span class="sp"></span>2</div><div class="hstack"><span class="muted">Eligibility</span><span class="sp"></span>1</div><div class="hstack"><span class="muted">Values</span><span class="sp"></span>0</div></div></div>
   <div class="card" style="flex:1"><div class="cardh"><h2>Triage</h2><span class="sub">Claude Haiku 5.5, low effort</span></div><div class="cardb vstack" style="gap:9px">
    <div class="hstack"><span>Apply</span><span class="sp"></span><b>4</b></div><div class="hstack"><span class="muted">Maybe</span><span class="sp"></span>1</div><div class="hstack"><span class="muted">Skip</span><span class="sp"></span>1</div><div class="hstack"><span class="muted">Auto-queued at 75+</span><span class="sp"></span>3</div></div></div>
   <div class="card" style="flex:1"><div class="cardh"><h2>Tokens and cost</h2></div><div class="cardb vstack" style="gap:9px">
    <div class="hstack"><span class="muted">Input</span><span class="sp"></span>41,260</div><div class="hstack"><span class="muted">Read from cache</span><span class="sp"></span>27,900</div><div class="hstack"><span class="muted">Output</span><span class="sp"></span>9,815</div><div class="hstack"><span>Estimated cost</span><span class="sp"></span><b>$0.41</b></div></div></div>
  </div>
  <div class="card"><div class="cardh"><h2>Errors</h2><span class="sub">The run carried on after each one</span></div>
   <table><tr><th>Step</th><th>Target</th><th>Message</th></tr>
   <tr><td class="t1">collect</td><td class="mono">greenhouse:lumenlabs</td><td class="t2">HTTP 404 from boards-api.greenhouse.io. The board may have moved.</td></tr>
   <tr><td class="t1">normalize</td><td class="mono">go.vansh.nyc/1hQ</td><td class="t2">Short link did not resolve after 5 redirects. Kept the short URL.</td></tr>
   <tr><td class="t1">normalize</td><td class="mono">go.vansh.nyc/1hT</td><td class="t2">Timed out after 10 seconds. Kept the short URL.</td></tr></table></div>
 </div>
</div>'''

def bars(vals, color, h=150, labels=None):
    mx = max(vals)
    cols = "".join(f'<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;height:{h+22}px"><span class="note" style="color:var(--ink2)">{v}</span><div style="width:100%;max-width:34px;height:{int(h*v/mx)}px;background:{color};border-radius:3px 3px 0 0"></div></div>' for v in vals)
    labs = "".join(f'<span class="note" style="flex:1;text-align:center">{l}</span>' for l in labels) if labels else ""
    return f'<div style="display:flex;gap:10px;align-items:flex-end;border-bottom:1px solid var(--line2);padding:0 4px">{cols}</div><div style="display:flex;gap:10px;padding:6px 4px 0">{labs}</div>'
def funnel_row(label, n, pct, width, color="#7AA2F7"):
    return f'<div class="hstack" style="gap:14px"><span style="width:150px">{label}</span><div style="flex:1;height:20px;background:var(--raised);border-radius:4px;overflow:hidden"><div style="width:{width}%;height:100%;background:{color}"></div></div><span style="width:56px;text-align:right" class="t1">{n}</span><span class="note" style="width:110px">{pct}</span></div>'
stats_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Stats</h2><div class="muted">Last 8 weeks, from September 15 to November 5.</div></div><span class="sp"></span><div class="seg"><span>4 weeks</span><span class="on">8 weeks</span><span>Season</span></div></div>
<div class="queue">
 <div class="q"><span class="l">Applied</span><span class="v">47</span><span class="h">9 this week</span></div>
 <div class="q"><span class="l">Got a reply</span><span class="v">11</span><span class="h">23.4% of applications</span></div>
 <div class="q"><span class="l">Found to applied</span><span class="v">1.6 days</span><span class="h">Median time</span></div>
 <div class="q"><span class="l">Wrong answers caught</span><span class="v">0</span><span class="h">Read-back mismatches</span></div>
 <div class="q"><span class="l">Claude spend</span><span class="v">$21.37</span><span class="h">November so far</span></div>
</div>
<div class="row" style="align-items:stretch">
 <div class="card" style="flex:1.3"><div class="cardh"><h2>Applications per week</h2><div class="right"><span class="hstack note"><span class="dot" style="background:#7AA2F7;border-radius:2px"></span>Applied</span></div></div><div class="cardb">{bars([2,4,3,6,8,7,8,9],"#4E78D8",labels=["Sep 15","Sep 22","Sep 29","Oct 6","Oct 13","Oct 20","Oct 27","Nov 3"])}</div></div>
 <div class="card" style="flex:1"><div class="cardh"><h2>Reply rate by source</h2></div><div class="cardb vstack" style="gap:14px">
  {funnel_row("SimplifyJobs list","6 of 24","25.0%",25)}
  {funnel_row("vanshb03 list","2 of 11","18.2%",18)}
  {funnel_row("Company boards","3 of 12","25.0%",25)}
  <div class="divider"></div>
  {funnel_row("backend resume","6 of 22","27.3%",27,"#58C1CB")}
  {funnel_row("ai resume","4 of 17","23.5%",24,"#58C1CB")}
  {funnel_row("devops resume","1 of 8","12.5%",13,"#58C1CB")}
 </div></div>
</div>
<div class="card"><div class="cardh"><h2>From found to offer</h2><span class="sub">Each stage as a share of the one before it</span></div><div class="cardb vstack" style="gap:12px">
 {funnel_row("Found in Canada","1,412","",100,"#3A4757")}
 {funnel_row("Passed filters","286","20.3% of found",20.3,"#4C5D72")}
 {funnel_row("Triaged apply","112","39.2% of passed",7.9,"#5E78A0")}
 {funnel_row("Applied","47","42.0% of apply",3.3,"#7AA2F7")}
 {funnel_row("Assessment","6","12.8% of applied",0.42,"#9BA7F6")}
 {funnel_row("Interview","4","66.7% of assessed",0.28,"#C3CBFA")}
 {funnel_row("Offer","0","",0,"#DCBA55")}
</div></div>'''

def setrow(title, desc, control):
    return f'<div class="hstack" style="padding:16px;border-bottom:1px solid var(--line);gap:24px;align-items:center"><div class="vstack" style="gap:3px;flex:1"><span class="t1">{title}</span><span class="note">{desc}</span></div>{control}</div>'
settings_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Settings</h2><div class="muted">These are read by the pipeline and the agent before every run.</div></div></div>
<div class="row" style="align-items:flex-start">
 <div class="col" style="flex:1">
  <div class="card"><div class="cardh"><h2>Agent</h2><span class="sub">Stored in config/agent</span></div>
   {setrow("Pause scout","Stops the agent before its next claim. The pipeline keeps finding and ranking jobs.",'<div class="toggle"></div>')}
   {setrow("Parallel agents","How many agents fill forms at once, each in its own tab of the scout Chrome window. 1 to 8.",'<div class="hstack" style="gap:6px"><span class="btn sm">-</span><div class="input" style="width:56px;justify-content:center">3</div><span class="btn sm">+</span></div>')}
   {setrow("Wait for your answer","How long an agent holds a form open when it asks you a live question.",'<div class="hstack" style="gap:8px"><div class="input" style="width:70px">10</div><span class="note">minutes</span></div>')}
   {setrow("Daily cap","Most applications all agents submit in one day, in Edmonton time. 20 by default. Leave it empty for no limit.",'<div class="input" style="width:90px">20</div>')}
   {setrow("Auto-queue score","Jobs triaged as apply at or above this score are queued without you.",'<div class="input" style="width:90px">75</div>')}
   {setrow("Triage limit per run","Caps Claude calls in one daily run.",'<div class="input" style="width:90px">60</div>')}
  </div>
  <div class="card"><div class="cardh"><h2>Final click</h2><span class="sub">Who presses Submit, per job board</span></div>
   <table><tr><th>Board</th><th>Submit</th><th>Record</th></tr>
   <tr><td>{ats("gh")}</td><td><div class="seg"><span class="on">You click</span><span>Agent clicks</span></div></td><td class="t2">8 hand-checked, 0 mismatches</td></tr>
   <tr><td>{ats("lv")}</td><td><div class="seg"><span class="on">You click</span><span>Agent clicks</span></div></td><td class="t2">3 hand-checked</td></tr>
   <tr><td>{ats("ab")}</td><td><div class="seg"><span class="on">You click</span><span>Agent clicks</span></div></td><td class="t2">Needs 5 hand-checked first</td></tr>
   <tr><td>{ats("wd")}</td><td><div class="seg"><span class="on">You click</span><span>Agent clicks</span></div></td><td class="t2">Phase 3</td></tr></table>
   <div class="cardb note">When the agent clicks, it writes a submit marker first, so a crash can never send the same application twice.</div></div>
 </div>
 <div class="col" style="width:420px">
  <div class="card"><div class="cardh"><h2>Claude</h2></div><div class="cardb vstack" style="gap:10px">
   <div class="hstack"><span class="muted">Triage</span><span class="sp"></span>Claude Haiku 5.5, low effort</div>
   <div class="hstack"><span class="muted">Answer planning</span><span class="sp"></span>Claude Sonnet 5.5, medium effort</div>
   <div class="hstack"><span class="muted">Refusal fallback</span><span class="sp"></span>On</div>
   <div class="hstack"><span class="muted">This month</span><span class="sp"></span>$21.37 of a $40 limit</div>
   <div class="bar"><i style="width:53%;background:#7AA2F7"></i></div>
   <span class="note">The spend limit is set in the Anthropic Console, not here.</span></div></div>
  <div class="card"><div class="cardh"><h2>Notifications</h2></div><div class="cardb vstack" style="gap:12px">
   <div class="hstack"><span>Discord webhook</span><span class="sp"></span><span class="pill st-applied"><span class="d"></span>Connected</span></div>
   <div class="input"><span class="mono muted">discord.com/api/webhooks/••••••/••••</span></div>
   <div class="hstack"><span class="check on">{icon("check","#FFFFFF",11,2.5)}</span><span>Daily digest</span></div>
   <div class="hstack"><span class="check on">{icon("check","#FFFFFF",11,2.5)}</span><span>Needs you at the Mac</span></div>
   <div class="hstack"><span class="check on">{icon("check","#FFFFFF",11,2.5)}</span><span>Applied and failed</span></div>
   <span class="btn sm" style="align-self:flex-start">Send a test message</span></div></div>
  <div class="card"><div class="cardh"><h2>Mail watcher</h2><span class="sub">Phase 3</span></div><div class="cardb vstack" style="gap:10px">
   <div class="hstack"><span>Gmail, read only</span><span class="sp"></span><span class="pill st-needs_answers"><span class="d"></span>Sign in again in 2 days</span></div>
   <span class="note">Google expires this sign-in every 7 days while the app is in testing.</span><span class="btn sm" style="align-self:flex-start">{google_g(14)}Sign in with Google</span></div></div>
 </div>
</div>'''

signin = f'''<div class="screen" id="Desktop / 13 Sign in" style="align-items:center;justify-content:center;flex-direction:column;gap:28px">
 <div class="vstack" style="align-items:center;gap:14px;width:380px">
  <div class="logo" style="width:40px;height:40px;border-radius:10px">{icon("logo","#0F1216",24)}</div>
  <div style="font-size:22px;font-weight:600;letter-spacing:-.3px">Sign in to scout</div>
  <div class="muted" style="text-align:center">Your internship search: what's new, what needs an answer, and where every application stands.</div>
  <span class="btn lg" style="width:100%;justify-content:center;margin-top:8px">{google_g(18)}Continue with Google</span>
  <span class="note" style="text-align:center">Only the owner's Google account can sign in.</span>
 </div>
</div>'''

S3only = [desktop("Desktop / 12 Settings","settings","Settings",settings_body)]
S3 = [
 desktop("Desktop / 08 Profile","profile","Profile",profile_body),
 desktop("Desktop / 09 Memory","memory","Memory",memory_body),
 desktop("Desktop / 10 Runs","runs","Runs",runs_body),
 desktop("Desktop / 11 Stats","stats","Stats",stats_body),
 signin,
]
open("desktop3.html","w").write(page(S3))
open("settings_only.html","w").write(page(S3only))
print("desktop3", len(page(S3)))
