from base import *
from logos import si_svg, tile, company_logo, google_g
from browserview import thumb, page_mock, chrome_bar

def L(slug, size=16, color=None): return si_svg(slug, size, color)
def F(domain, size=16): return tile(("fav", domain), size, 4)

# ---------- Agents ----------
def logline(kind, text, t):
    ic = {"ok": icon("check","#34D399",14,2), "run": '<span class="spin" style="width:12px;height:12px"></span>', "q": icon("q","#FBBF24",14), "wait": icon("clock","#8F8F8F",14)}[kind]
    col = "var(--ink)" if kind in ("run","q") else "var(--ink2)"
    return f'<div class="hstack" style="gap:10px;align-items:flex-start;padding:3px 0"><span style="width:16px;display:inline-flex;justify-content:center;padding-top:2px">{ic}</span><span style="flex:1;color:{col};font-size:13px">{text}</span><span class="mono faint" style="font-size:11.5px">{t}</span></div>'

def agent_card(n, company, role, stage_k, step, steps, logs, model, tokens, elapsed, body_extra="", live=False, foot=None, view=""):
    pct = int(step/steps*100) if steps else 0
    border = "border-color:rgba(251,191,36,0.35);box-shadow:0 0 0 1px rgba(251,191,36,0.12)" if live else ""
    f = foot or f'<span class="btn sm">{icon("tab","#ECECEC",14)}Show tab</span><span class="btn sm">{icon("pause","#ECECEC",14)}Pause</span><span class="sp"></span><span class="btn sm ghost">{icon("stop","#F87171",14)}<span style="color:#F87171">Stop</span></span>'
    return f'''<div class="card" style="flex:1;min-width:0;{border}">
 <div class="cardh" style="align-items:flex-start;padding-bottom:10px">{company_logo(company,36,10)}<div class="vstack" style="gap:2px;min-width:0"><div class="hstack"><span class="t1 nl" style="font-size:15px">{company}</span></div><span class="note">{role}</span></div><div class="right" style="align-self:flex-start">{stage(stage_k) if stage_k != "pacing" else '<span class="pill"><span class="d" style="background:#8F8F8F"></span>Pacing</span>'}</div></div>
 <div style="padding:0 18px 12px" class="vstack">
  <div class="hstack note"><span>Agent {n}</span><span class="sep"></span><span>tab "scout {n}"</span><span class="sp"></span><span>Step {step} of {steps}</span></div>
  <div class="bar"><i style="width:{pct}%;background:{"#FBBF24" if live else "#2DD4BF"}"></i></div>
 </div>
 {view}<div style="margin:{"10px" if view else "0"} 12px 0;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,0.22);display:flex;flex-direction:column">{"".join(logs)}</div>
 {body_extra}
 <div class="hstack note" style="padding:12px 18px 0;gap:10px"><span class="wl">{L("claude",13)}{model}</span><span class="sep"></span><span>{tokens}</span><span class="sp"></span>{icon("clock","#8F8F8F",13)}<span>{elapsed}</span></div>
 <div class="hstack" style="padding:12px 18px 16px">{f}</div>
</div>'''

live_q = '''<div style="margin:12px 12px 0;padding:12px 14px;border-radius:14px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.22);display:flex;flex-direction:column;gap:10px">
 <div class="hstack"><span class="flag f-values">Live question</span><span class="sp"></span><span class="hstack" style="color:var(--amber);font-size:12.5px;gap:5px">''' + icon("clock","#FBBF24",13) + '''8:41 left</span></div>
 <div style="font-size:14px;font-weight:500">Which office would you prefer: Toronto or Mississauga?</div>
 <div class="hstack"><span class="btn sm">Toronto</span><span class="btn sm">Mississauga</span><span class="btn sm">No preference</span></div>
 <div class="hstack"><span class="check on">''' + icon("check","#FFFFFF",11,2.5) + '''</span><span class="note" style="color:var(--ink2)">Remember for future forms</span><span class="sp"></span><span class="btn sm pri">Send to agent 2</span></div>
</div>'''

pacing_body = '''<div style="margin:12px 12px 0;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:8px">
 <span class="note">Next for this agent</span>''' + "".join(
 f'<div class="hstack" style="gap:10px">{company_logo(c,22,6)}<div class="vstack" style="gap:0"><span style="font-size:13px">{c}</span><span class="note">{r}</span></div><span class="sp"></span>{ats(b)}</div>'
 for c,r,b in [("Wealthsimple","Software Engineer Intern","ab"),("Shopify","Dev Degree Intern","gh")]) + '</div>'

cards = f'''<div class="row" style="gap:16px;align-items:stretch">
{agent_card(1,"Clio","Software Developer Co-op","filling",4,9,[logline("ok","Filled 12 of 15 fields from the approved sheet","9:15"),logline("run","Reading every value back from the page","9:16"),logline("wait","Write submit marker, then hand you the final click","")],"Sonnet 5.5","18.2k tokens, $0.05","2:10",view=thumb("job-boards.greenhouse.io/clio","Clio","Software Developer Co-op",[("First name","Sashreek"),("Email","sashreek@example.com"),("Phone","+1 780 555 0142"),("LinkedIn","linkedin.com/in/sashreek")],3,"linkedin.com/in/sash","Agent 1"))}
{agent_card(2,"Element Fleet","Forward Deployed Engineer Intern","filling",6,9,[logline("ok","Filled 19 fields from the sheet","9:11"),logline("q","Office preference is not on the sheet. Asked you.","9:12")],"Sonnet 5.5","31.5k tokens, $0.08","6:19",body_extra=live_q,live=True,view=thumb("careers.elementfleet.com/apply","Element Fleet","Forward Deployed Engineer Intern",[("Preferred office",""),("Earliest start date","January 5, 2027"),("Work authorization","Study permit with co-op work permit")],0,"","Agent 2"),foot=f'<span class="btn sm">{icon("tab","#ECECEC",14)}Show tab</span><span class="btn sm">Ask later</span><span class="sp"></span><span class="btn sm ghost">{icon("stop","#F87171",14)}<span style="color:#F87171">Stop</span></span>')}
{agent_card(3,"Agent 3","Between applications","pacing",0,0,[logline("ok","Applied to BiblioCommons, confirmation seen","9:02"),logline("wait","Pacing 3 minutes so boards see a human rhythm","9:02"),logline("wait","Lever has 2 in flight, its limit. Picking an Ashby job next.","")],"Sonnet 5.5","idle","next in 1:42",body_extra=pacing_body,foot=f'<span class="btn sm">Start now</span><span class="sp"></span><span class="btn sm ghost">{icon("pause","#B4B4B4",14)}Pause</span>')}
</div>'''.replace('<span class="ltile" style="width:36px;height:36px;min-width:36px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;background:#4A4A4A;color:#FFFFFF;font-weight:600;font-size:18px">A</span>',
 '<span class="ltile" style="width:36px;height:36px;min-width:36px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#303030">'+icon("agents","#B4B4B4",20)+'</span>')

def qrow(c, role, b, why, wait):
    return f'<tr><td><div class="t1">{c}</div><div class="t2">{role}</div></td><td>{ats(b)}</td><td class="t2">{why}</td><td class="t2" style="text-align:right">{wait}</td></tr>'
queue_card = f'''<div class="card" style="flex:1"><div class="cardh"><h2>Up next</h2><span class="sub">Approved, waiting for a free agent</span><div class="right"><span class="note">4 in the queue</span></div></div>
<table><tr><th>Application</th><th>Board</th><th>Why it waits</th><th style="text-align:right">Approved</th></tr>
{qrow("Wealthsimple","Software Engineer Intern","ab","Next for agent 3","1d")}
{qrow("Shopify","Dev Degree Intern","gh","Next for agent 3","1d")}
{qrow("Cohere","ML Infra Intern","ab","Agent 2 holds Cohere's other form; one per company","3h")}
{qrow("Ciena","Software Design Co-op","wd","Workday comes in phase 3","4d")}
</table></div>'''

sup_card = f'''<div class="card" style="width:380px;flex-shrink:0"><div class="cardh"><h2>Supervisor</h2><div class="right"><span class="pill st-applied"><span class="d"></span>Running</span></div></div>
<div class="cardb vstack" style="gap:12px">
 <div class="hstack"><span class="wl">{L("temporal",15,"#ECECEC")}Temporal on this Mac</span><span class="sp"></span><span class="mono muted">localhost:8233</span></div>
 <div class="hstack"><span class="wl">{L("googlechrome",15)}scout Chrome window</span><span class="sp"></span><span class="muted">3 tabs</span></div>
 <div class="divider"></div>
 <div class="hstack"><span class="muted">Agents</span><span class="sp"></span><div class="hstack" style="gap:6px"><span class="btn sm">-</span><div class="input" style="width:48px;height:28px;justify-content:center">3</div><span class="btn sm">+</span></div></div>
 <div class="hstack"><span class="muted">Applied today</span><span class="sp"></span><b>2 of 20</b></div>
 <div class="bar"><i style="width:10%;background:#ECECEC"></i></div>
 <div class="hstack"><span class="muted">Per company</span><span class="sp"></span>1 at a time</div>
 <div class="hstack"><span class="muted">Per board</span><span class="sp"></span>2 at a time</div>
 <div class="hstack"><span class="muted">Restarted today</span><span class="sp"></span>1, a Lever timeout at step 3</div>
 <div class="hstack" style="margin-top:4px"><span class="btn sm">{icon("ext","#ECECEC",13)}Open Temporal UI</span><span class="sp"></span><span class="btn sm">Agent settings</span></div>
</div></div>'''

agents_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Agents</h2><div class="muted">3 agents on your MacBook, each in its own tab. Answer a live question here or on your phone.</div></div>
<span class="sp"></span><span class="btn">{icon("pause","#ECECEC",14)}Pause all</span><span class="btn pri">{icon("player-play" if False else "play","#0D0D0D",14)}Start the next one</span></div>
{cards}
<div class="row" style="align-items:flex-start">{queue_card}{sup_card}</div>'''

# ---------- Settings (expanded) ----------
SNAV = [("Agents","agents",True),("Models","spark",False),("Permissions","lock",False),("Browser","tab",False),("Limits","filter",False),("Modes per board","check",False),("Notifications","msg",False),("Mac app","mac",False),("Account","profile",False)]
snav = '<div class="vstack" style="gap:2px;width:200px;flex-shrink:0">' + "".join(
 f'<div class="nav{" on" if on else ""}" style="height:34px;font-size:13.5px">{icon(ic, "#ECECEC" if on else "#8F8F8F",16)}<span>{lab}</span></div>' for lab,ic,on in SNAV) + '</div>'

def setrow(title, desc, control, last=False):
    bb = "" if last else "border-bottom:1px solid var(--line);"
    return f'<div class="hstack" style="padding:14px 18px;{bb}gap:24px;align-items:center"><div class="vstack" style="gap:2px;flex:1"><span class="t1">{title}</span><span class="note">{desc}</span></div>{control}</div>'
def stepper(v): return f'<div class="hstack" style="gap:6px"><span class="btn sm">-</span><div class="input" style="width:52px;height:30px;justify-content:center">{v}</div><span class="btn sm">+</span></div>'
def unit(v, u, w=64): return f'<div class="hstack" style="gap:8px"><div class="input" style="width:{w}px;height:32px">{v}</div><span class="note">{u}</span></div>'
def sel(v, w=220, lead=""): return f'<div class="input" style="width:{w}px;height:32px;gap:8px">{lead}<span style="flex:1">{v}</span>{icon("chevd","#8F8F8F",14)}</div>'

agents_card = f'''<div class="card"><div class="cardh"><h2>Agents</h2><span class="sub">config/agent, read by the supervisor before every claim</span></div>
{setrow("Parallel agents","How many applications are filled at once. Each agent gets its own tab in the scout Chrome window.",stepper(3))}
{setrow("Per company","Agents allowed on the same company at once.",stepper(1))}
{setrow("Per job board","Agents allowed on the same board at once, so no board sees a burst.",stepper(2))}
{setrow("Pacing","Pause between two applications from one agent.",unit("3","minutes"))}
{setrow("Wait for a live answer","How long an agent holds a form open after asking you. Then the application moves to needs answers.",unit("10","minutes"))}
{setrow("Step timeout","Longest a single step may run before the supervisor restarts it.",unit("90","seconds"))}
{setrow("Retries per step","Restarts before the application moves to failed.",stepper(2))}
{setrow("Pause all agents","Agents finish the step they are on, then wait.",'<div class="toggle"></div>',last=True)}
</div>'''

def mrow(task, why, prov, model, effort):
    plogo = L("anthropic",14,"#ECECEC") if prov == "api" else L("claude",14)
    ptxt = "Claude API" if prov == "api" else "Subscription"
    segs = "".join(f'<span class="on">{e}</span>' if e == effort else f'<span>{e}</span>' for e in ["Low","Medium","High"])
    return f'<tr><td><div class="t1">{task}</div><div class="t2">{why}</div></td><td>{sel(ptxt,190,plogo)}</td><td>{sel(model,150)}</td><td><div class="seg">{segs}</div></td></tr>'
models_card = f'''<div class="card"><div class="cardh"><h2>Models</h2><span class="sub">config/models, one row per task</span></div>
<table><tr><th>Task</th><th style="width:210px">Account</th><th style="width:170px">Model</th><th style="width:200px">Effort</th></tr>
{mrow("Triage","Ranks every new posting, batched","api","Haiku 5.5","Low")}
{mrow("Answer planning","Writes the answer sheet","api","Sonnet 5.5","Medium")}
{mrow("Resume tailoring","Third try on Opus 5.5 if checks fail","sub","Sonnet 5.5","High")}
{mrow("Live field help","Fields the agent meets mid-form","api","Sonnet 5.5","Low")}
{mrow("Reading and summaries","Careers pages, session summaries, email","api","Haiku 5.5","Low")}
</table>
<div class="banner b-amber" style="margin:4px 18px 18px;font-size:12.5px">{icon("alert","#FBBF24",16)}<span>The subscription option runs <span class="mono">claude -p</span> on this Mac only, and falls back to the API when it hits a usage limit. Anthropic's terms point automated products to API keys, so it stays off by default.</span></div>
</div>'''

browser_card = f'''<div class="card"><div class="cardh"><h2>Browser</h2></div>
{setrow("Chrome profile","A separate profile, so your own Chrome stays untouched.",sel("scout",160,L("googlechrome",14)))}
{setrow("Generic filler","For company sites that are not Greenhouse, Lever or Ashby. Stagehand finds the fields; scout types the values.",'<div class="hstack" style="gap:10px">'+F("browserbase.com",18)+'<div class="toggle on"></div></div>')}
{setrow("Headed window","Keep the Chrome window visible so you can watch and take over.",'<div class="toggle on"></div>',last=True)}
</div>'''

limits_card = f'''<div class="card"><div class="cardh"><h2>Limits</h2></div>
{setrow("Daily cap","Most applications all agents submit in one day, Edmonton time. 20 by default. Leave it empty for no limit.",unit("20","a day",70))}
{setrow("Auto-queue score","Jobs triaged as apply at or above this score are queued without you.",unit("75","of 100",70))}
{setrow("Triage limit per run","Caps Claude calls in one daily run.",unit("60","jobs",70),last=True)}
</div>'''
def fcrow(k, mode, rec):
    seg = "".join(f'<span class="on">{m}</span>' if m == mode else f'<span>{m}</span>' for m in ["Dry run","Hold","Auto"])
    return f'<tr><td>{ats(k)}</td><td><div class="seg">{seg}</div></td><td class="t2">{rec}</td></tr>'
final_card = f'''<div class="card"><div class="cardh"><h2>Modes per board</h2><span class="sub">How far an agent goes on each job board</span></div>
<table><tr><th>Board</th><th style="width:250px">Mode</th><th>Record</th></tr>{fcrow("gh","Hold","8 hand-checked, 0 mismatches")}{fcrow("lv","Hold","3 hand-checked")}{fcrow("ab","Dry run","New filler, 2 dry runs clean")}{fcrow("wd","Dry run","Phase 3")}{fcrow("ot","Dry run","Generic filler with Stagehand")}</table>
<div class="cardb note" style="padding-top:12px">Dry run fills and reads back but never submits. Hold stops for you to click Submit. Auto submits approved sheets, and writes a submit marker first so a crash can never send twice.</div></div>'''

def prow(tool, does, pol, locked=False):
    seg = "".join(f'<span class="on">{m}</span>' if m == pol else f'<span>{m}</span>' for m in ["Allow","Ask","Deny"])
    lock = '<span class="note" style="margin-left:8px">fixed</span>' if locked else ""
    return f'<tr><td><span class="mono">{tool}</span></td><td class="t2">{does}</td><td><div class="hstack" style="gap:0"><div class="seg">{seg}</div>{lock}</div></td></tr>'
perm_card = f'''<div class="card"><div class="cardh"><h2>Permissions</h2><span class="sub">config/permissions, checked by the guard before every tool call</span></div>
<table><tr><th style="width:170px">Tool</th><th>What it does</th><th style="width:250px">Policy</th></tr>
{prow("kb_search","Read what scout knows about you","Allow")}
{prow("field_fill","Type a value from the approved sheet","Allow")}
{prow("click","Click on the company's own site","Allow")}
{prow("navigate","Leave the company's site or its application system","Ask")}
{prow("upload_file","Attach a document approved on the sheet","Allow")}
{prow("submit","Click the final Submit","Ask")}
{prow("field_fill_text","Type text that isn't on the sheet","Deny",True)}
{prow("create_account","Make an account on a job site","Deny",True)}
{prow("solve_captcha","Answer a CAPTCHA","Deny",True)}
</table>
<div class="cardb note" style="padding-top:12px">Ask sends you a request on the Agents page and your phone, and the agent waits like it does for a live question. Submit follows each board's mode below.</div></div>'''

mac_card = f'''<div class="card"><div class="cardh"><h2>Mac app</h2><span class="sub">Electron, runs the scout server</span></div>
{setrow("Open at login","Starts the server and the agents when you log in.",'<div class="toggle on"></div>')}
{setrow("Menu bar item","Shows agents running and what is waiting on you.",'<div class="toggle on"></div>')}
{setrow("Liquid Glass","macOS 26 only, through the electron-liquid-glass package. Falls back to the frosted sidebar if it fails to load.",'<div class="toggle"></div>')}
{setrow("Live browser view","Frames per second for the agent you're watching.",unit("15","fps"),last=True)}
</div>'''

notif_card = f'''<div class="card"><div class="cardh"><h2>Notifications</h2><span class="sub">scout asks and you answer in the same app</span></div>
{setrow('<span class="wl">'+L("apple",16,"#ECECEC")+'Mac notifications</span>',"Live questions, needs you at the Mac, failures and the morning digest, from the Mac app.",'<div class="toggle on"></div>')}
{setrow('<span class="wl">'+L("firebase",16)+'Phone notifications</span>',"Push through Firebase Cloud Messaging to the dashboard on your home screen.",'<span class="pill st-applied"><span class="d"></span>iPhone connected</span>')}
{setrow('<span class="wl">'+L("gmail",16)+'Mail watcher</span>',"Read only. Finds replies from employers. Phase 3.",'<span class="btn sm">'+google_g(14)+'Sign in with Google</span>',last=True)}
</div>'''

settings_body = f'''
<div class="pagehead"><div class="vstack" style="gap:4px"><h2>Settings</h2><div class="muted">Read by the pipeline, the supervisor and every agent before each run.</div></div></div>
<div class="row" style="align-items:flex-start;gap:28px">{snav}<div class="col" style="flex:1;gap:20px">{agents_card}{models_card}{perm_card}{browser_card}{limits_card}{final_card}{notif_card}{mac_card}</div></div>'''

big_fields = [("First name","Sashreek"),("Last name","Addanki"),("Email","sashreek@example.com"),("Phone","+1 780 555 0142"),("LinkedIn profile","linkedin.com/in/sashreek"),("Website","sashreek-addanki.vercel.app")]
viewer = f'''<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6)"></div>
<div style="position:absolute;left:300px;top:70px;width:1100px;height:820px;background:#2A2A2A;border:1px solid rgba(255,255,255,0.10);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,0.6);display:flex;flex-direction:column;overflow:hidden">
 <div class="hstack" style="padding:14px 18px;gap:12px;border-bottom:1px solid var(--line)">{company_logo("Clio",30,8)}<div class="vstack" style="gap:0"><b style="font-weight:600;font-size:15px">Agent 1, Clio</b><span class="note">Software Developer Co-op, tab "scout 1"</span></div>{stage("filling")}<span class="sp"></span><span class="note">Step 4 of 9, 2:10</span><span class="pill" style="background:rgba(248,113,113,0.14);color:#F87171"><span class="d" style="background:#F87171"></span>Live</span>{icon("x","#8F8F8F",20)}</div>
 <div style="display:flex;flex:1;min-height:0">
  <div style="flex:1;display:flex;flex-direction:column;margin:16px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.10)">{chrome_bar("job-boards.greenhouse.io/clio/jobs/7741203",1.0)}{page_mock("Clio","Software Developer Co-op",big_fields,4,"linkedin.com/in/sash","Agent 1",1.0)}</div>
  <div style="width:330px;flex-shrink:0;border-left:1px solid var(--line);display:flex;flex-direction:column;padding:16px;gap:12px">
   <span class="sectionlabel">Work log</span>
   <div style="padding:10px 12px;border-radius:14px;background:rgba(0,0,0,0.22);display:flex;flex-direction:column">{logline("ok","Opened the Greenhouse form","9:14")}{logline("ok","First name, last name, email, phone","9:15")}{logline("run","Typing LinkedIn profile from the sheet","9:15")}{logline("wait","Website, resume, 9 custom questions","")}</div>
   <span class="sectionlabel">Now</span>
   <div class="note" style="color:var(--ink2)">field_fill(linkedin) with the approved value. The guard matched it to the sheet.</div>
   <span class="sp"></span>
   <span class="btn pri" style="justify-content:center">{icon("hand","#0D0D0D",15)}Take over</span>
   <div class="hstack"><span class="btn" style="flex:1;justify-content:center">{L("googlechrome",14)}Open in Chrome</span><span class="btn" style="flex:1;justify-content:center">{icon("pause","#ECECEC",14)}Pause</span></div>
   <span class="note">Taking over pauses the agent after this step. Your clicks and keys go to the tab, and the agent reads the page again when you hand back.</span>
  </div>
 </div>
</div>'''
watch = desktop("Desktop / 20 Agents, watching live","agents","Agents",agents_body)
watch = watch.replace('<div class="screen" id="Desktop / 20 Agents, watching live">','<div class="screen" id="Desktop / 20 Agents, watching live" style="position:relative">',1)
watch = watch[:watch.rindex("</div>")] + viewer + "</div>"
S5 = [desktop("Desktop / 16 Agents","agents","Agents",agents_body,right=run_pill()),
      desktop("Desktop / 12 Settings","settings","Settings",settings_body), watch]
open("desktop5.html","w").write(page(S5))
print("desktop5", len(page(S5)))
