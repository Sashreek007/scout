from base import *
from logos import company_logo
def phone(name, title, sub, body, tab="today", back=False, sticky=""):
    tabs = [("today","Today"),("jobs","Jobs"),("board","Board"),("agents","Agents"),("profile","Profile")]
    tb = "".join(f'<div class="{"on" if k==tab else ""}">{icon(k, "#E4E8EE" if k==tab else "#7A8491", 22)}<span>{l}</span></div>' for k,l in tabs)
    bk = (f'<div class="hstack" style="color:var(--accentink);font-size:15px;margin-bottom:6px;gap:2px">{icon("chevl","#A9C4FA",18)}Today</div>') if back else ""
    st = f'<div style="padding:12px 14px 14px;border-top:1px solid var(--line);background:var(--surface)">{sticky}</div>' if sticky else ""
    return f'''<div class="mobile" id="{name}"><div class="status"><span>9:41</span><span class="hstack" style="gap:6px"><span style="width:18px;height:10px;border:1.5px solid var(--ink);border-radius:3px"></span></span></div>
<div class="mhead">{bk}<h1>{title}</h1><span class="muted" style="font-size:13.5px">{sub}</span></div>
<div class="mbody">{body}</div>{st}<div class="tabbar">{tb}</div></div>'''

m_today = phone("Mobile / 01 Today","Today","9 new matches. 2 of 20 applications used.", f'''
<div class="queue" style="flex-wrap:wrap">
 <div class="q" style="flex:1 1 40%;border-bottom:1px solid var(--line)"><span class="l">Questions</span><span class="v" style="color:var(--amber)">3</span></div>
 <div class="q" style="flex:1 1 40%;border-right:none;border-bottom:1px solid var(--line)"><span class="l">To review</span><span class="v">2</span></div>
 <div class="q" style="flex:1 1 40%"><span class="l">Needs you</span><span class="v" style="color:var(--red)">1</span></div>
 <div class="q" style="flex:1 1 40%;border-right:none"><span class="l">Approved</span><span class="v">4</span></div>
</div>
<div class="banner b-red">{icon("alert","#EE6E5D",18)}<div class="vstack" style="gap:4px"><b>Equitable Bank needs you at the Mac</b><span class="muted" style="font-size:13px">CAPTCHA on the Lever form. 12:41 left.</span></div></div>
<div class="sectionlabel" style="padding:4px 2px 0">Questions</div>
<div class="card">
 <div style="padding:14px;border-bottom:1px solid var(--line)" class="vstack"><span class="note wl">{company_logo("Northwind Robotics",18,5)}Northwind Robotics</span><b style="font-weight:500;font-size:15px">Available for in-person interviews in Toronto?</b><div class="hstack"><span class="btn" style="height:40px;flex:1;justify-content:center">Yes</span><span class="btn" style="height:40px;flex:1;justify-content:center">No</span></div></div>
 <div style="padding:14px;border-bottom:1px solid var(--line)" class="vstack"><span class="note wl">{company_logo("TechInsights",18,5)}TechInsights</span><b style="font-weight:500;font-size:15px">Do you have a valid driver's licence?</b><div class="hstack"><span class="btn" style="height:40px;flex:1;justify-content:center">Yes</span><span class="btn" style="height:40px;flex:1;justify-content:center">No</span></div></div>
 <div style="padding:14px" class="hstack"><div class="vstack" style="gap:2px"><span class="note wl">{company_logo("Nelnet",18,5)}Nelnet</span><b style="font-weight:500;font-size:15px">Expected hourly rate (CAD)?</b></div><span class="sp"></span>{icon("chev","#7A8491",18)}</div>
</div>
<div class="sectionlabel" style="padding:4px 2px 0">Ready for review</div>
<div class="card">
 <div style="padding:14px;border-bottom:1px solid var(--line)" class="hstack">{score(88)}{company_logo("Clio",30,8)}<div class="vstack" style="gap:2px"><b style="font-weight:500">Clio</b><span class="note">14 fields, no drafts</span></div><span class="sp"></span>{icon("chev","#7A8491",18)}</div>
 <div style="padding:14px" class="hstack">{score(79)}{company_logo("Rodan Energy Solutions",30,8)}<div class="vstack" style="gap:2px"><b style="font-weight:500">Rodan Energy Solutions</b><span class="note">1 draft to read</span></div><span class="sp"></span>{icon("chev","#7A8491",18)}</div>
</div>''')

m_question = phone("Mobile / 02 Answer a question","Question","Northwind Robotics, Software Developer Intern", f'''
<div class="card" style="padding:18px" ><div class="vstack" style="gap:16px">
 <div style="font-size:19px;font-weight:500;line-height:1.35">Are you available for in-person interviews in Toronto?</div>
 <div class="hstack note">{icon("spark","#A994F3",14)}<span>Claude suggests Yes, but relocation to Toronto is still TODO in your profile.</span></div>
 <div class="vstack" style="gap:10px"><span class="btn" style="height:48px;justify-content:center;font-size:15px;background:var(--accentsoft);border-color:#2E4675;color:var(--accentink)">{icon("check","#A9C4FA",18)}Yes</span><span class="btn" style="height:48px;justify-content:center;font-size:15px">No</span></div>
 <div class="divider"></div>
 <div class="hstack" style="gap:12px"><div class="vstack" style="gap:2px;flex:1"><span>Remember this answer</span><span class="note">Also answers 1 other open application</span></div><div class="toggle on"></div></div>
 <div class="hstack" style="gap:12px"><div class="vstack" style="gap:2px;flex:1"><span>Save to profile</span><span class="note">Sets relocation to Toronto to Yes</span></div><div class="toggle"></div></div>
</div></div>
<div class="note" style="padding:0 4px">This was the last open question for Northwind, so it moves to review after you save.</div>''', back=True,
 sticky='<span class="btn pri" style="height:48px;width:100%;justify-content:center;font-size:15px">Save answer</span>')

def mrow(label, answer, s, last=False):
    b = "" if last else "border-bottom:1px solid var(--line);"
    return f'<div style="padding:12px 14px;{b}" class="vstack"><div class="hstack"><span class="note">{label}</span><span class="sp"></span>{src(s)}</div><span style="font-size:14.5px">{answer}</span></div>'
m_review = phone("Mobile / 03 Review a sheet","Review","Rodan Energy Solutions, AI Solutions Specialist Co-op", f'''
<div class="hstack" style="gap:6px;flex-wrap:wrap">{src("profile")}<span class="note">8</span>{src("memory")}<span class="note">1</span>{src("you")}<span class="note">1</span>{src("draft")}<span class="note">1</span></div>
<div class="card" style="border-color:#4A3E78">
 <div style="padding:12px 14px" class="vstack"><div class="hstack"><span class="note">Why are you interested in this role?</span><span class="sp"></span>{src("draft")}</div>
 <div class="textarea" style="min-height:0;font-size:14px">I built an engine that diagnoses outages from telemetry with a grounded LLM, and I'd like to apply the same approach to Rodan's energy data.</div>
 <div class="hstack"><span class="btn" style="flex:1;justify-content:center;height:40px">Edit</span><span class="btn pri" style="flex:1;justify-content:center;height:40px">Approve draft</span></div></div>
</div>
<div class="card">
 {mrow("Legally eligible to work in Canada?","Yes","profile")}
 {mrow("Require sponsorship?","No","profile")}
 {mrow("Earliest start date","January 5, 2027","profile")}
 {mrow("How did you hear about us?","Job board","memory")}
 {mrow("Resume","sashreek-ai.pdf","profile",last=True)}
</div>
<span class="note" style="padding:0 4px">+ 6 more fields from your profile</span>''', back=True,
 sticky='<div class="vstack" style="gap:8px"><span class="btn dis" style="height:48px;width:100%;justify-content:center;font-size:15px">Approve sheet</span><span class="note" style="text-align:center">Approve the draft first</span></div>')

# Discord digest on a phone
def dline(score_n, company, title, loc, reason):
    return f'<div class="vstack" style="gap:2px;padding:6px 0"><div class="hstack" style="gap:6px"><b style="color:#E4E8EE;font-weight:600">{score_n}</b><span style="color:#E4E8EE">{company}</span></div><span style="color:#B5BAC1;font-size:13px">{title}, {loc}</span><span style="color:#949BA4;font-size:12.5px">{reason}</span></div>'
def notif(title, body, tm, lead):
    return f'<div style="background:rgba(60,60,60,0.72);border-radius:22px;padding:12px 14px;display:flex;gap:12px;align-items:flex-start">{lead}<div style="flex:1;display:flex;flex-direction:column;gap:2px"><div class="hstack"><b style="font-weight:600;font-size:14px">{title}</b><span class="sp"></span><span style="font-size:12px;color:#B4B4B4">{tm}</span></div><span style="font-size:14px;line-height:1.35;color:#ECECEC">{body}</span></div></div>'
appicon = '<div style="width:36px;height:36px;border-radius:9px;background:#ECECEC;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon("logo","#0D0D0D",22,2) + '</div>'
m_discord = f'''<div class="mobile" id="Mobile / 04 Notifications" style="background:linear-gradient(180deg,#1b1b2b 0%,#101014 100%)">
<div class="status"><span></span><span class="hstack" style="gap:6px"><span style="width:18px;height:10px;border:1.5px solid var(--ink);border-radius:3px"></span></span></div>
<div style="text-align:center;padding:10px 0 26px"><div style="font-size:15px;color:#D4D4D4">Wednesday, November 5</div><div style="font-size:84px;font-weight:600;letter-spacing:-3px;line-height:1.05">9:12</div></div>
<div style="padding:0 12px;display:flex;flex-direction:column;gap:10px">
{notif("scout", "Element Fleet is waiting on you: which office do you prefer? 8:41 left.", "now", appicon)}
{notif("scout", "Equitable Bank needs you at the Mac. A CAPTCHA appeared after Submit.", "9:21", appicon)}
{notif("scout", "Morning digest: 9 new matches, 4 questions waiting, 2 sheets to review.", "7:06", appicon)}
</div>
<div style="flex:1"></div>
<div style="text-align:center;font-size:12.5px;color:#B4B4B4;padding:0 30px 40px">Push notifications from the scout dashboard on your home screen, sent through Firebase Cloud Messaging. Tapping one opens that question or application.</div>
</div>'''

m_live = phone("Mobile / 05 Live question","Live question","Element Fleet, Forward Deployed Engineer Intern", f'''
<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px;border-color:rgba(251,191,36,0.35)">
 <div class="hstack">{company_logo("Element Fleet",28,8)}<div class="vstack" style="gap:0"><b style="font-weight:500">Agent 2 is holding the form</b><span class="note">tab "scout 2", step 6 of 9</span></div></div>
 <div style="text-align:center;padding:6px 0"><div style="font-size:44px;font-weight:600;letter-spacing:-1px;color:var(--amber)">8:41</div><span class="note">left before it moves to needs answers</span></div>
 <b style="font-size:19px;font-weight:600;line-height:1.35">Which office would you prefer: Toronto or Mississauga?</b>
 <span class="btn lg" style="justify-content:center">Toronto</span><span class="btn lg" style="justify-content:center">Mississauga</span><span class="btn lg" style="justify-content:center">No preference</span>
 <div class="hstack"><span>Remember for future forms</span><span class="sp"></span><div class="toggle on"></div></div>
</div>
<span class="note" style="text-align:center">You got here from a notification. The answer goes straight to agent 2.</span>''', tab="agents", back=True, sticky='<span class="btn lg pri" style="width:100%;justify-content:center">Send to agent 2</span>')
def magent(company, what, tm, pct, color, extra=""):
    return f'''<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px">
 <div class="hstack">{company_logo(company,32,9)}<div class="vstack" style="gap:0;flex:1"><b style="font-weight:500">{company}</b><span class="note">{what}</span></div><span class="note">{tm}</span></div>
 <div class="bar"><i style="width:{pct}%;background:{color}"></i></div>{extra}</div>'''
m_agents = phone("Mobile / 06 Agents","Agents","3 running on your MacBook. 2 of 20 applied today.", f'''
{magent("Element Fleet","Waiting on you","8:41",66,"#FBBF24",'<span class="btn" style="justify-content:center;background:rgba(251,191,36,0.14);color:var(--amber)">Answer the question</span>')}
{magent("Clio","Filling, step 4 of 9","2:10",44,"#2DD4BF")}
{magent("Northwind Robotics","Pacing, next in 1:42","",100,"#5A5A5A")}
<div class="hstack" style="margin-top:4px"><span class="btn" style="flex:1;justify-content:center">Pause all</span><span class="btn pri" style="flex:1;justify-content:center">Start the next one</span></div>''', tab="agents")
open("mobile.html","w").write(page([m_today, m_question, m_review, m_discord, m_live, m_agents]))
print("mobile ok")
