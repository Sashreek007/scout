from base import *

def sheet_row(label, req, answer, s, evidence, extra="", voluntary=False, highlight=False):
    r = '<span style="color:var(--red)">*</span>' if req else ""
    v = '<div class="note">Voluntary</div>' if voluntary else ""
    bg = ' style="background:#FBF8FF"' if highlight else ""
    return f'''<tr{bg}><td style="width:250px"><div class="t1" style="font-size:12.5px">{label}{r}</div>{v}</td><td>{answer}</td><td style="width:110px">{src(s)}</td><td style="width:230px"><span class="mono muted" style="font-size:11px;word-break:break-all">{evidence}</span></td></tr>'''

draft = '''<div class="textarea" style="min-height:0;border-color:#C9B8F0">Northwind's platform team runs the services that keep warehouse robots moving, which is the kind of system I like building. My API key and quota service taught me to care about latency and failure modes, and I'd like to bring that to your Go services.</div>
<div class="hstack note" style="margin-top:6px"><span>62 of 150 words</span><span class="sp"></span><span class="btn sm">Edit</span><span class="btn sm pri">Approve draft</span></div>'''

sheet_rows = "".join([
 sheet_row("First name",True,"Sashreek","profile","identity.first_name"),
 sheet_row("Last name",True,"Addanki","profile","identity.last_name"),
 sheet_row("Email",True,"sashreek@example.com","profile","identity.email"),
 sheet_row("Phone",False,"+1 780 555 0142","profile","identity.phone"),
 sheet_row("Resume/CV",True,f'<span class="hstack">{icon("doc","#38413B",14)}<span class="mono">sashreek-backend.pdf</span><span class="flag f-title" style="background:var(--accentsoft);color:var(--accentink)">sha256 ok</span></span>',"profile","resumes.backend"),
 sheet_row("LinkedIn Profile",False,"linkedin.com/in/sashreek","profile","links.linkedin"),
 sheet_row("Website",False,"sashreek-addanki.vercel.app","profile","links.portfolio"),
 sheet_row("Are you legally eligible to work in Canada?",True,"Yes","profile","work_authorization.canada"),
 sheet_row("Will you now or in the future require sponsorship?",True,"No","profile","work_authorization.requires_sponsorship_for_coop"),
 sheet_row("Earliest start date",True,"January 5, 2027","profile","availability.earliest_start"),
 sheet_row("How did you hear about us?",False,"Job board","memory","how did you hear about us"),
 sheet_row("Are you available for in-person interviews in Toronto?",True,"Yes","you","answered today 8:12 · remembered"),
 sheet_row("Why do you want to work at Northwind Robotics?",True,draft,"draft","posting + projects.mint",highlight=True),
 sheet_row("Gender",False,"I don't wish to answer","policy","demographics.policy",voluntary=True),
 sheet_row("Are you Hispanic/Latino?",False,"Decline to self-identify","policy","demographics.policy",voluntary=True),
])

def ev(color, text, who):
    return f'<div class="tli"><span class="dotc" style="background:{color}"></span><div class="txt"><span>{text}</span><span class="who">{who}</span></div></div>'

app_head = lambda st, actions: f'''<div class="hstack" style="align-items:flex-start">
<div class="vstack" style="gap:6px"><div class="hstack"><span style="font-size:22px;font-weight:700;letter-spacing:-.4px">Northwind Robotics</span>{st}</div>
<div class="hstack muted" style="gap:14px"><span>Software Developer Intern</span><span>Toronto, ON · hybrid</span><span>Winter 2027</span>{ats("gh")}<span class="hstack">{score(82)}<span class="mono">backend</span></span></div></div>
<span class="sp"></span>{actions}</div>'''

review_body = f'''
{app_head(stage("review"), '<span class="btn">'+icon("ext","#38413B",13)+'Posting</span><span class="btn danger">Skip</span><span class="btn dis">'+icon("check","#A3A69F",13)+'Approve sheet</span>')}
<div class="banner b-amber">{icon("alert","#9A600A",16)}<div style="font-size:12.5px"><b>Approve is locked until 1 draft is approved.</b> Every other field traces to your profile, memory, a policy, or an answer you gave. Once approved, the agent types exactly these values and reads each one back before it submits.</div></div>
<div class="tabs"><div class="tab on">Answer sheet <span class="n">15</span></div><div class="tab">Posting</div><div class="tab">History <span class="n">6</span></div><div class="tab">Notes</div></div>
<div class="row" style="align-items:flex-start">
 <div class="card" style="flex:1;overflow:hidden"><table style="table-layout:fixed"><colgroup><col style="width:220px"><col><col style="width:116px"><col style="width:200px"></colgroup><tr><th>Field</th><th>Answer</th><th>Source</th><th>Evidence</th></tr>{sheet_rows}</table></div>
 <div class="col" style="width:300px">
  <div class="card"><div class="cardh"><h2>Where answers came from</h2></div><div class="cardb vstack" style="gap:10px">
   <div class="bar" style="height:8px;gap:2px;background:transparent"><i style="width:66.6%;background:var(--accent);border-radius:2px"></i><i style="width:6.6%;background:var(--teal);border-radius:2px"></i><i style="width:6.6%;background:#E4E8EE;border-radius:2px"></i><i style="width:13.4%;background:#5A636F;border-radius:2px"></i><i style="width:6.6%;background:var(--violet);border-radius:2px"></i></div>
   <div class="hstack">{src("profile")}<span class="sp"></span><span class="mono">10</span></div>
   <div class="hstack">{src("memory")}<span class="sp"></span><span class="mono">1</span></div>
   <div class="hstack">{src("you")}<span class="sp"></span><span class="mono">1</span></div>
   <div class="hstack">{src("policy")}<span class="sp"></span><span class="mono">2</span></div>
   <div class="hstack">{src("draft")}<span class="sp"></span><span class="mono">1</span></div>
   <div class="note">Claude facts must name a profile field. Anything it couldn't ground became a question.</div></div></div>
  <div class="card"><div class="cardh"><h2>Form</h2></div><div class="cardb vstack" style="gap:8px;font-size:12.5px">
   <div class="hstack"><span class="muted">Read from</span><span class="sp"></span>Greenhouse questions API</div>
   <div class="hstack"><span class="muted">Read at</span><span class="sp"></span>Today 7:04</div>
   <div class="hstack"><span class="muted">Fields</span><span class="sp"></span>15, 9 required</div>
   <div class="hstack"><span class="muted">CAPTCHA</span><span class="sp"></span>none expected</div>
   <div class="hstack"><span class="muted">Final click</span><span class="sp"></span><b>Hold, you click Submit</b></div></div></div>
  <div class="card"><div class="cardh"><h2>Files</h2><span class="sub">uploaded only if approved</span></div><div class="cardb vstack" style="gap:10px;font-size:12.5px">
   <div class="hstack">{icon("doc","#B4B4B4",15)}<div class="vstack" style="gap:0"><span>Resume</span><span class="note mono">northwind-backend.pdf</span></div><span class="sp"></span><span class="src src-you">Approved</span></div>
   <div class="hstack">{icon("doc","#B4B4B4",15)}<div class="vstack" style="gap:0"><span>Transcript</span><span class="note mono">transcript-2026-09.pdf</span></div><span class="sp"></span><span class="src src-profile">Profile</span></div>
   <div class="hstack">{icon("doc","#B4B4B4",15)}<div class="vstack" style="gap:0"><span>Cover letter</span><span class="note">optional, left empty</span></div><span class="sp"></span><span class="note">Off</span></div></div></div>
  <div class="card"><div class="cardh"><h2>What scout knows about Northwind</h2></div><div class="cardb vstack" style="gap:8px;font-size:12.5px">
   <div class="hstack"><span class="muted">Applied before</span><span class="sp"></span>Backend Intern, Fall, assessment</div>
   <div class="hstack"><span class="muted">Form quirk</span><span class="sp"></span>Location field autocompletes</div>
   <div class="hstack"><span class="muted">Interviews</span><span class="sp"></span>In person, Toronto</div>
   <div class="hstack"><span class="muted">Recruiter</span><span class="sp"></span>Priya, from email</div></div></div>
  <div class="card"><div class="cardh"><h2>Work log</h2><span class="sub">this application's session</span></div><div class="cardb vstack" style="gap:8px;font-size:12.5px">
   <span class="note">Turn 1, plan answers</span>
   <div class="hstack">{icon("check","#34D399",13,2)}<span>Read 15 fields from the questions API</span></div>
   <div class="hstack">{icon("check","#34D399",13,2)}<span>12 from profile and memory, 2 policy, 1 question</span></div>
   <span class="note">Turn 2, tailor resume</span>
   <div class="hstack">{icon("check","#34D399",13,2)}<span>Backend base v6, 2 bullets reworded, checks pass</span></div>
   <span class="note" style="color:var(--ink2)">Summary: waiting on your approval. In-person answer came from you today.</span></div></div>
  <div class="card"><div class="cardh"><h2>History</h2></div><div class="cardb tl">
   {ev("#8A8F87","Queued automatically, score 82 is above 75","pipeline · today 7:03")}
   {ev("#2459A8","Planning started, form read","pipeline · today 7:04")}
   {ev("#D08A16","1 question: in-person interviews","pipeline · today 7:05")}
   {ev("#6640C2","Moved to review after your answer","you · today 8:12")}</div></div>
 </div>
</div>'''

needs_hand_body = f'''
{app_head(stage("needs_hand").replace("Northwind",""), '<span class="btn">Send back to approved</span><span class="btn pri">'+icon("check","#fff",13)+'It went in, mark applied</span>').replace("Northwind Robotics","Equitable Bank").replace("Software Developer Intern","Product Management Intern").replace("Toronto, ON · hybrid","Toronto, ON").replace("ats gh","ats lv").replace("Greenhouse","Lever").replace(">82<",">70<")}
<div class="banner b-red">{icon("alert","#B42318",18)}<div class="vstack" style="gap:6px;flex:1">
 <div class="t1" style="color:var(--red);font-size:14px">A CAPTCHA appeared when the agent clicked Submit</div>
 <div style="font-size:12.5px">The Chrome window titled <b>scout</b> is still open on your Mac with every field filled and checked. Solve the CAPTCHA there and press Submit. scout watches for Lever's <span class="mono">/thanks</span> page and marks this applied by itself. The agent never touches a CAPTCHA.</div>
 <div class="hstack" style="margin-top:4px"><span class="flag f-captcha">{icon("clock","#B42318",11)}12:41 left before the tab closes</span><span class="flag f-term">submitAttemptAt not set · final click was hold</span></div></div></div>
<div class="row" style="align-items:flex-start">
 <div class="card" style="flex:1"><div class="cardh"><h2>Fill report</h2><span class="sub">read back from the page after filling</span><div class="right"><span class="pill st-applied"><span class="d"></span>12 of 12 match</span></div></div>
  <table><tr><th>Field</th><th>Approved value</th><th>Read back from page</th><th></th></tr>
  <tr><td>Full name</td><td>Sashreek Addanki</td><td>Sashreek Addanki</td><td>{icon("check","#1E7A4C",14)}</td></tr>
  <tr><td>Email</td><td>sashreek@example.com</td><td>sashreek@example.com</td><td>{icon("check","#1E7A4C",14)}</td></tr>
  <tr><td>Phone</td><td>+1 780 555 0142</td><td>+1 780 555 0142</td><td>{icon("check","#1E7A4C",14)}</td></tr>
  <tr><td>Resume</td><td class="mono">sashreek-backend.pdf</td><td class="mono">sashreek-backend.pdf</td><td>{icon("check","#1E7A4C",14)}</td></tr>
  <tr><td>Current company</td><td>Quantum Ops Inc.</td><td>Quantum Ops Inc.</td><td>{icon("check","#1E7A4C",14)}</td></tr>
  <tr><td>Why product management?</td><td>I write specs and run market analysis at a 6-person...</td><td>I write specs and run market analysis at a 6-person...</td><td>{icon("check","#1E7A4C",14)}</td></tr>
  <tr><td colspan="4" class="note">+ 6 more fields, all matching</td></tr></table></div>
 <div class="col" style="width:340px">
  <div class="card"><div class="cardh"><h2>What each button does</h2></div><div class="cardb vstack" style="gap:10px;font-size:12.5px">
   <div><b>It went in, mark applied</b><div class="note">Use this if you submitted and saw Lever's confirmation, or got the confirmation email.</div></div>
   <div><b>Send back to approved</b><div class="note">The agent tries again on its next run. Only safe because Submit never went through.</div></div>
   <div><b>Skip</b><div class="note">Closes it for good with a reason.</div></div></div></div>
  <div class="card"><div class="cardh"><h2>History</h2></div><div class="cardb tl">
   {ev("#1D4C93","Approved by you","you · today 8:40")}
   {ev("#0D7680","Claimed, lease until 9:20","agent · MacBook · 9:05")}
   {ev("#0D7680","Filled 12 fields, all read back","agent · 9:07")}
   {ev("#B42318","CAPTCHA seen, moved to needs you","agent · 9:08")}</div></div>
  <div class="card"><div class="cardb hstack note">{icon("mac","#6C7169",14)}<span>Screenshots stay on your Mac in <span class="mono">runs/2026-11-05/lever:eqbank:e4ed38f2/</span></span></div></div>
 </div>
</div>'''

after_body = f'''
{app_head(stage("assessment"), '<span class="btn">'+icon("chevd","#38413B",13)+'Move to</span><span class="btn">Add note</span>').replace("Software Developer Intern","Backend Intern, Fall")}
<div class="row" style="align-items:flex-start">
 <div class="col" style="flex:1">
  <div class="card"><div class="cardh"><h2>Next action</h2><div class="right"><span class="pill st-assessment"><span class="d"></span>Due Sun Nov 9, 11:59 pm</span></div></div>
   <div class="cardb vstack" style="gap:10px"><div style="font-size:14px;font-weight:600">Complete the CodeSignal General Coding Assessment</div>
   <div class="note">From an email on Nov 4: "Northwind Robotics: your CodeSignal assessment". The mail watcher matched it by sender domain and job title.</div>
   <div class="hstack"><span class="btn sm pri">Mark done</span><span class="btn sm">Change date</span><span class="btn sm ghost">This match is wrong</span></div></div></div>
  <div class="card"><div class="cardh"><h2>Timeline</h2><span class="sub">every stage move, oldest first</span></div><div class="cardb tl">
   {ev("#8A8F87","Queued by you from Jobs","you · Oct 28 6:50 pm")}
   {ev("#2459A8","Form read, 13 fields planned","pipeline · Oct 29 7:04")}
   {ev("#6640C2","Sheet approved","you · Oct 29 8:15")}
   {ev("#0D7680","Filled and read back","agent · Oct 29 9:11")}
   {ev("#1E7A4C","Applied, Greenhouse confirmation seen","agent · Oct 29 9:12 · counter 1 of 10")}
   {ev("#3B4BB8","Moved to assessment, subject quoted: \"Northwind Robotics: your CodeSignal assessment\"","mail watcher · Nov 4 10:02")}</div></div>
 </div>
 <div class="col" style="width:340px">
  <div class="card"><div class="cardh"><h2>Move to</h2><span class="sub">moves you can make from here</span></div><div class="cardb vstack" style="gap:8px">
   <div class="hstack">{stage("interview")}<span class="sp"></span><span class="btn sm">Move</span></div>
   <div class="hstack">{stage("rejected")}<span class="sp"></span><span class="btn sm">Move</span></div>
   <div class="hstack">{stage("withdrawn")}<span class="sp"></span><span class="btn sm">Move</span></div></div></div>
  <div class="card"><div class="cardh"><h2>Submitted</h2></div><div class="cardb vstack" style="gap:8px;font-size:12.5px">
   <div class="hstack"><span class="muted">Submitted at</span><span class="sp"></span>Oct 29, 9:12 am</div>
   <div class="hstack"><span class="muted">Resume sent</span><span class="sp"></span><span class="mono">backend · 3f9a…c21</span></div>
   <div class="hstack"><span class="muted">Confirmation</span><span class="sp"></span>"Thank you for applying..."</div>
   <span class="btn sm" style="align-self:flex-start">View the exact answers sent</span></div></div>
  <div class="card"><div class="cardh"><h2>Notes</h2></div><div class="cardb"><div class="textarea" style="min-height:70px">Recruiter: Priya. Practice graph problems before Sunday.</div></div></div>
 </div>
</div>'''

S2 = [
 desktop("Desktop / 05 Application, review","board","Application",review_body,crumb="Board / Review"),
 desktop("Desktop / 06 Application, needs you","board","Application",needs_hand_body,crumb="Board / Needs you"),
 desktop("Desktop / 07 Application, after applying","board","Application",after_body,crumb="Board / Assessment"),
]
open("desktop2.html","w").write(page(S2))
print("desktop2", len(page(S2)))
