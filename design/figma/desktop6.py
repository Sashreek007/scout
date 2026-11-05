from base import *
from logos import si_svg, tile, company_logo, google_g, board_logo
import desktop1 as d1
L = si_svg

# ---------- 17 Today, first run ----------
def step(done, title, desc, action, lead=""):
    mark = f'<span class="check on">{icon("check","#FFFFFF",11,2.5)}</span>' if done else '<span class="check"></span>'
    t = f'<span class="t1" style="{"color:var(--muted);text-decoration:line-through" if done else ""}">{title}</span>'
    return f'<div class="hstack" style="padding:14px 18px;border-top:1px solid var(--line);gap:14px">{mark}{lead}<div class="vstack" style="gap:2px;flex:1">{t}<span class="note">{desc}</span></div>{action}</div>'
setup = f'''<div class="card"><div class="cardh"><h2>Set up scout</h2><span class="sub">3 of 6 done. Nothing is applied until all six are.</span><div class="right"><div class="bar" style="width:160px"><i style="width:50%;background:#ECECEC"></i></div></div></div>
{step(True,"Sign in with your Google account","Only this account can open the dashboard.","",google_g(18))}
{step(True,"Import your profile","42 facts and 18 remembered answers from profile.yaml.","",icon("profile","#B4B4B4",18))}
{step(True,"Choose the base resume","v6 is active. v7 is stored and can be switched in Knowledge.","",icon("doc","#B4B4B4",18))}
{step(False,"Turn on phone notifications","Add the dashboard to your home screen and allow notifications, so live questions reach you away from the Mac.",'<span class="btn sm pri">Turn on</span>',icon("msg","#B4B4B4",18))}
{step(False,"Start the agent on your Mac","Run pnpm agent once. It starts Temporal and opens the scout Chrome window.",'<span class="btn sm">Copy command</span>',L("apple",18,"#ECECEC"))}
{step(False,"Run the pipeline for the first time","Finds today's Canadian postings from the GitHub lists and job boards. Takes about 4 minutes.",'<span class="btn sm">Run now</span>',L("githubactions",18,"#ECECEC"))}
</div>'''
def empty(title, text, ic):
    return f'''<div class="card"><div class="cardh"><h2>{title}</h2></div><div class="vstack" style="align-items:center;text-align:center;padding:28px 24px 34px;gap:10px">
<span style="width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,0.06);display:inline-flex;align-items:center;justify-content:center">{icon(ic,"#8F8F8F",22)}</span>
<span class="muted" style="max-width:360px">{text}</span></div></div>'''
first_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Welcome, Sashreek</h2><div class="muted">Finish setup and scout starts finding internships every morning at 7:00, Edmonton time.</div></div></div>
<div class="row" style="align-items:flex-start">
 <div class="col" style="flex:1">{setup}
  {empty("Questions","Questions show up here after the first run reads application forms. Anything your profile can't answer lands here once, then scout remembers.","q")}
 </div>
 <div class="col" style="width:360px">
  {empty("Last pipeline run","No runs yet. The first one starts at 7:00 tomorrow, or now from the checklist.","runs")}
  {empty("Agents","No agent is connected. Start one on your Mac and it shows here with its tab and step.","agents")}
 </div>
</div>'''

# ---------- 18 Search ----------
def res(lead, title, sub, right=""):
    return f'<div class="hstack" style="padding:9px 12px;border-radius:12px;gap:12px">{lead}<div class="vstack" style="gap:0;flex:1"><span style="font-size:14px">{title}</span><span class="note">{sub}</span></div>{right}</div>'
palette = f'''<div style="position:absolute;left:50%;top:110px;margin-left:-310px;width:620px;background:#2F2F2F;border:1px solid rgba(255,255,255,0.10);border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,0.55);overflow:hidden">
 <div class="hstack" style="padding:16px 18px;gap:12px;border-bottom:1px solid var(--line)">{icon("search","#8F8F8F",18)}<span style="font-size:16px">clio</span><span class="sp"></span><span class="kbd">esc</span></div>
 <div style="padding:8px">
  <div class="note" style="padding:8px 12px 4px">Applications</div>
  <div style="background:rgba(255,255,255,0.07);border-radius:12px">{res(company_logo("Clio",30,8),"Clio, Software Developer Co-op","Review, 88, Greenhouse, waiting 3h",stage("review"))}</div>
  <div class="note" style="padding:10px 12px 4px">Jobs</div>
  {res(company_logo("Clio",30,8),"Clio, Platform Engineering Co-op","Calgary, AB, Summer 2027, score 64",'<span class="pill">Maybe</span>')}
  <div class="note" style="padding:10px 12px 4px">Knowledge</div>
  {res('<span class="ltile" style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.06);display:inline-flex;align-items:center;justify-content:center">'+icon("memory","#B4B4B4",16)+'</span>',"Decision: Clio is fine for backend-led variants","Nov 4, from your feedback on a resume","")}
  <div class="note" style="padding:10px 12px 4px">Actions</div>
  {res('<span class="ltile" style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.06);display:inline-flex;align-items:center;justify-content:center">'+icon("pause","#B4B4B4",16)+'</span>',"Pause scout","Agents finish their step, then wait",'<span class="kbd">⇧P</span>')}
  {res('<span class="ltile" style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.06);display:inline-flex;align-items:center;justify-content:center">'+icon("play","#B4B4B4",16)+'</span>',"Start the next agent","Wealthsimple is next in the queue",'')}
 </div>
 <div class="hstack note" style="padding:10px 18px;border-top:1px solid var(--line);gap:16px"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">⌘↵</span> open in new tab</span></div>
</div>'''
search_screen = desktop("Desktop / 18 Search","jobs","Jobs",d1.jobs_body if hasattr(d1,"jobs_body") else "",crumb="360 Canadian postings tracked")
search_screen = search_screen.replace('<div class="screen" id="Desktop / 18 Search">','<div class="screen" id="Desktop / 18 Search" style="position:relative">',1)
search_screen = search_screen[:search_screen.rindex("</div>")] + '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55)"></div>' + palette + "</div>"

# ---------- 19 Agents, trouble ----------
from desktop5 import agent_card, logline, sup_card, queue_card
offline = f'<div class="banner b-amber">{icon("alert","#FBBF24",18)}<div class="vstack" style="gap:2px;flex:1"><b style="font-weight:500">Agent 3 hasn\'t reported for 3 minutes</b><span class="note" style="color:var(--ink2)">Your Mac may be asleep. Temporal resumes it from the last finished step when it wakes, and nothing is submitted twice.</span></div><span class="btn sm">Open Temporal UI</span></div>'
cap_card = f'''<div style="margin:12px 12px 0;padding:12px 14px;border-radius:14px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.22);display:flex;flex-direction:column;gap:8px">
 <div class="hstack"><span class="flag f-captcha">CAPTCHA</span><span class="sp"></span><span style="color:var(--red);font-size:12.5px">12:41 left</span></div>
 <span style="font-size:13.5px">Every field is filled and read back. Solve it in the tab and press Submit; scout watches for the confirmation.</span>
 <div class="hstack"><span class="btn sm pri">Show tab</span><span class="btn sm">It went in</span></div></div>'''
retry = f'''<div style="margin:12px 12px 0;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:6px">
 <div class="hstack note"><span>Retry 2 of 2 for this step</span><span class="sp"></span><span>next try in 0:40</span></div>
 <span class="mono" style="font-size:12px;color:var(--red)">TimeoutError: upload input not visible after 90s</span></div>'''
cards = f'''<div class="row" style="gap:16px;align-items:stretch">
{agent_card(1,"Equitable Bank","Product Management Intern","needs_hand",8,9,[logline("ok","Filled 14 fields and read them back","9:20"),logline("ok","Wrote the submit marker","9:21"),logline("q","CAPTCHA appeared after Submit","9:21")],"Opus 5.5","22.0k tokens, $0.11","2:19",body_extra=cap_card,live=True,foot=f'<span class="sp"></span><span class="btn sm ghost">{icon("stop","#F87171",14)}<span style="color:#F87171">Stop</span></span>')}
{agent_card(2,"Ciena","Software Design Co-op","failed",3,9,[logline("ok","Opened the Workday form","9:12"),logline("ok","Signed in with your saved account","9:13"),logline("q","Resume upload timed out twice","9:16")],"Opus 5.5","6.1k tokens, $0.03","4:02",body_extra=retry,foot=f'<span class="btn sm">Retry now</span><span class="btn sm">Send back to approved</span><span class="sp"></span>')}
{agent_card(3,"Agent 3","Last seen 9:18","pacing",0,0,[logline("ok","Applied to Shopify, confirmation seen","9:14"),logline("wait","Pacing 3 minutes","9:14")],"Opus 5.5","idle","3:00 ago",foot=f'<span class="btn sm">Show tab</span><span class="sp"></span>')}
</div>'''
dialog = f'''<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55)"></div>
<div style="position:absolute;left:50%;top:300px;margin-left:-230px;width:460px;background:#2F2F2F;border:1px solid rgba(255,255,255,0.10);border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,0.55);padding:22px;display:flex;flex-direction:column;gap:12px">
 <div class="hstack" style="gap:12px">{company_logo("Equitable Bank",36,10)}<b style="font-size:17px;font-weight:600">Stop agent 1?</b></div>
 <span class="muted">Agent 1 already clicked Submit on Equitable Bank's form. If the application went in, stopping now loses the confirmation. scout will move it to needs you so you can check your email.</span>
 <div class="hstack" style="margin-top:6px"><span class="sp"></span><span class="btn">Keep it running</span><span class="btn danger">Stop agent 1</span></div></div>'''
trouble_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Agents</h2><div class="muted">1 needs you, 1 retrying, 1 not reporting.</div></div><span class="sp"></span><span class="btn">{icon("pause","#ECECEC",14)}Pause all</span></div>
{offline}{cards}
<div class="row" style="align-items:flex-start">{queue_card}{sup_card}</div>'''
trouble = desktop("Desktop / 19 Agents, when something goes wrong","agents","Agents",trouble_body)
trouble = trouble.replace('<div class="screen" id="Desktop / 19 Agents, when something goes wrong">','<div class="screen" id="Desktop / 19 Agents, when something goes wrong" style="position:relative">',1)
trouble = trouble[:trouble.rindex("</div>")] + dialog + "</div>"

S6 = [desktop("Desktop / 17 Today, first run","today","Today",first_body,right='<span class="pill">No runs yet</span>',first=True), search_screen, trouble]
open("desktop6.html","w").write(page(S6))
print("desktop6", len(page(S6)))
