from base import *
from logos import si_svg, company_logo
appicon = lambda s: f'<div style="width:{s}px;height:{s}px;border-radius:{int(s*0.24)}px;background:#ECECEC;display:flex;align-items:center;justify-content:center;flex-shrink:0">{icon("logo","#0D0D0D",int(s*0.62),2)}</div>'
menus = "".join(f'<span style="font-weight:{600 if m=="scout" else 400}">{m}</span>' for m in ["scout","File","Edit","View","Window","Help"])
menubar = f'''<div class="hstack" style="height:30px;padding:0 14px;gap:20px;background:rgba(20,20,28,0.55);font-size:13.5px;color:#F2F2F2">{si_svg("apple",15,"#F2F2F2")}{menus}<span class="sp"></span>
<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:22px;border-radius:6px;background:rgba(255,255,255,0.22)">{icon("logo","#FFFFFF",16,2)}<span style="position:absolute;right:-3px;top:-2px;min-width:14px;height:14px;border-radius:7px;background:#FBBF24;color:#0D0D0D;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center">1</span></span>
{icon("search","#F2F2F2",15)}<span>Wed Nov 5</span><span>9:12 AM</span></div>'''
def arow(company, what, tm, color, live=False):
    bg = "background:rgba(251,191,36,0.14);" if live else ""
    return f'<div class="hstack" style="padding:7px 10px;border-radius:9px;gap:10px;{bg}">{company_logo(company,22,6)}<div class="vstack" style="gap:0;flex:1"><span style="font-size:13.5px">{company}</span><span style="font-size:12px;color:{color}">{what}</span></div><span style="font-size:12px;color:{color}">{tm}</span></div>'
dropdown = f'''<div style="position:absolute;left:960px;top:36px;width:340px;padding:8px;border-radius:14px;background:rgba(44,44,52,0.78);border:1px solid rgba(255,255,255,0.14);box-shadow:0 20px 50px rgba(0,0,0,0.45);display:flex;flex-direction:column;gap:2px">
 <div class="hstack" style="padding:6px 10px 8px;gap:10px">{appicon(26)}<div class="vstack" style="gap:0;flex:1"><b style="font-size:14px;font-weight:600">scout</b><span style="font-size:12px;color:#B4B4B4">3 agents running</span></div><span class="pill st-applied"><span class="d"></span>Server up</span></div>
 <div style="height:1px;background:rgba(255,255,255,0.10);margin:2px 6px 4px"></div>
 {arow("Element Fleet","Waiting on you","8:41","#FBBF24",True)}
 {arow("Clio","Filling, step 4 of 9","2:10","#B4B4B4")}
 {arow("Shopify","Pacing, next in 1:42","","#B4B4B4")}
 <div style="padding:8px 10px 4px" class="vstack"><div class="hstack" style="font-size:12px;color:#B4B4B4"><span>Applied today</span><span class="sp"></span><span>2 of 20</span></div><div class="bar"><i style="width:10%;background:#ECECEC"></i></div></div>
 <div style="height:1px;background:rgba(255,255,255,0.10);margin:4px 6px"></div>
 <div class="hstack" style="padding:6px 10px;font-size:13.5px"><span>Add job from clipboard</span><span class="sp"></span><span style="color:#8F8F8F">⌘J</span></div>
 <div class="hstack" style="padding:6px 10px;font-size:13.5px"><span>Answer Element Fleet's question</span><span class="sp"></span><span style="color:#8F8F8F">⌘1</span></div>
 <div class="hstack" style="padding:6px 10px;font-size:13.5px"><span>Open scout</span><span class="sp"></span><span style="color:#8F8F8F">⌘O</span></div>
 <div class="hstack" style="padding:6px 10px;font-size:13.5px"><span>Pause all agents</span><span class="sp"></span><span style="color:#8F8F8F">⇧⌘P</span></div>
 <div style="height:1px;background:rgba(255,255,255,0.10);margin:4px 6px"></div>
 <div class="hstack" style="padding:6px 10px;font-size:13.5px;color:#B4B4B4"><span>Quit scout</span><span class="sp"></span><span style="color:#8F8F8F">⌘Q</span></div>
</div>'''
banner = f'''<div style="position:absolute;right:16px;top:520px;width:360px;padding:12px 14px;border-radius:18px;background:rgba(44,44,52,0.78);border:1px solid rgba(255,255,255,0.14);box-shadow:0 16px 40px rgba(0,0,0,0.4);display:flex;gap:12px">{appicon(36)}<div class="vstack" style="gap:2px;flex:1"><div class="hstack"><b style="font-size:13.5px;font-weight:600">scout</b><span class="sp"></span><span style="font-size:12px;color:#B4B4B4">now</span></div><span style="font-size:13.5px;font-weight:500">Element Fleet is waiting on you</span><span style="font-size:13px;color:#D4D4D4">Which office would you prefer: Toronto or Mississauga? 8:41 left.</span></div></div>
<div style="position:absolute;right:16px;top:630px;width:360px;font-size:12px;color:rgba(255,255,255,0.65);text-align:right">Clicking the notification opens the question in the scout window.</div>'''
note = '''<div style="position:absolute;left:40px;bottom:40px;width:620px;padding:18px 20px;border-radius:18px;background:rgba(20,20,28,0.55);border:1px solid rgba(255,255,255,0.10);color:#D4D4D4;font-size:13.5px;line-height:1.55"><b style="color:#F2F2F2;font-weight:600">The Mac app outside its window.</b> The menu bar item shows the agents and what is waiting on you, with a badge for live questions. Notifications come from the app itself, and each one opens the right page. Quitting asks first if an agent is past the fill step.</div>'''
screen = f'''<div class="screen" id="Desktop / 21 Mac app, menu bar and notifications" style="flex-direction:column;position:relative;min-height:900px;height:900px;background:radial-gradient(900px 600px at 20% 10%, #3b2f7a 0%, transparent 60%),radial-gradient(900px 700px at 90% 90%, #0f5c78 0%, transparent 60%),linear-gradient(160deg,#1a1840,#0b1626)">{menubar}{dropdown}{banner}{note}</div>'''
open("desktop7.html","w").write(page([screen]))
print("desktop7 ok")
