from base import *
from logos import si_svg
rows = [("01 Today","Live questions, other questions, sheets to review, needs you, last run, deadlines, cap","#43 #18 #36 #12"),
("02 Jobs","Triaged postings with score, logo, board, resume variant, and the detail panel","#44 #7 #8 #9"),
("03 Jobs, filtered out","Every dropped posting with the rule that dropped it","#44 #8"),
("04 Board","All 16 stages in two lanes, with board logos and flags on every card","#45 #2"),
("05 Application, review","Answer sheet with sources, files to attach, company memory and the work log","#46 #51 #52 #56 #16 #17"),
("06 Application, needs you","CAPTCHA hand-off with the read-back fill report","#46 #20 #21 #23"),
("07 Application, after applying","Timeline, next action from the mail watcher, stage moves","#46 #26"),
("08 Profile","Facts the planner may use, TODO blockers, resumes, documents, filters","#47 #56 #4"),
("09 Knowledge, remembered answers","Remembered answers, reused across forms","#47 #18"),
("10 Runs","Per-source counts, filter and triage results, tokens, errors","#48 #11 #23"),
("11 Stats","Applications per week, reply rate by source and resume, funnel, spend","#48 #41"),
("12 Settings","Agents, models, permissions, modes per board, notifications, the Mac app","#39 #53 #55 #12"),
("13 Sign in","One Google account, the owner's","#42 #3"),
("14 Application, resume","The tailored resume, what changed from the base, every check, approval","#33 #29 #30 #31 #32"),
("15 Knowledge","Base resume, facts, bullets, rules, decisions, company and board-skill suggestions","#28 #34 #35 #52"),
("16 Agents","Every agent with a live view of its tab, its log, model and cost; live questions; the queue","#38 #54 #37 #36"),
("17 Today, first run","Setup checklist and empty states","#42 #4"),
("18 Search","⌘K across jobs, applications, Knowledge and actions","#42"),
("19 Agents, when something goes wrong","CAPTCHA, a failing step with retries, a silent agent, and the stop confirmation","#38 #37 #21 #23"),
("20 Agents, watching live","One agent's tab full size, the work log beside it, take over or open in Chrome","#54 #50"),
("21 Mac app, menu bar and notifications","The menu bar item with agents and what is waiting, and a native notification","#55"),
("Mobile 01 to 06","Today, answer, review, notifications, live question, agents","#49 #36 #12")]
tr = "".join(f'<tr><td class="t1">{a}</td><td style="color:var(--ink2)">{b}</td><td class="mono" style="color:var(--accent)">{c}</td></tr>' for a,b,c in rows)
def card(t, d): return f'<div class="card" style="flex:1;padding:18px 20px;display:flex;flex-direction:column;gap:6px"><b style="font-size:16px;font-weight:600">{t}</b><span class="muted">{d}</span></div>'
logos_row = "".join(si_svg(s, 22) for s in ["github","githubactions","anthropic","firebase","vercel","temporal","googlechrome","gmail","greenhouse"])
body = f'''<div class="screen" id="Cover" style="width:1920px;min-width:1920px;flex-direction:column;padding:96px 112px;gap:28px;min-height:0">
<div class="hstack" style="gap:16px"><div class="logo" style="width:56px;height:56px;border-radius:16px">{icon("logo","#0D0D0D",32,2)}</div><span style="font-size:64px;font-weight:600;letter-spacing:-2px">scout</span></div>
<div style="font-size:22px;line-height:1.45;color:var(--ink2);max-width:1100px">Dashboard and phone mockups for scout, the agent that finds Canadian internships, writes a resume for each job from what it knows about you, runs several applying agents at once, and submits only what you approve.</div>
<div class="hstack" style="gap:18px">{logos_row}<span class="note" style="margin-left:8px">November 5, 2026. Dark only, neutral greys after ChatGPT and t3code. Inter, pill buttons, real logos. Built from docs/architecture.md and issues #1 to #58.</span></div>
<div class="row" style="gap:16px;margin-top:12px">{card("Foundations","Colour tokens, type scale, logos, the 16 stages, answer sources, flags, boards, controls and icons.")}{card("Desktop","21 screens at 1440px: daily work, one application, your data and the system, knowledge and resumes, and first run, search, trouble and the Mac app.")}{card("Mobile","Today, answering, reviewing, push notifications, a live question with its countdown, and the agents.")}{card("User flows","FigJam board with eight flows: setup, the morning, answering, approving, parallel agents, watching and taking over, needs you at the Mac, after applying.")}</div>
<div style="font-size:22px;font-weight:600;letter-spacing:-.3px;margin-top:20px">Screens and the stories they cover</div>
<div class="card"><table><tr><th style="width:340px">Screen</th><th>What it shows</th><th style="width:300px">Issues</th></tr>{tr}</table></div>
</div>'''
open("cover.html","w").write(page([body]))
print("cover ok")
