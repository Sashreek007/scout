from base import *
from logos import company_logo, board_logo, tile
import desktop1 as d1

def check(ok, label, detail):
    ic = icon("check","#34D399",14,2) if ok else icon("alert","#FBBF24",14)
    return f'<div class="hstack" style="gap:8px;font-size:13px">{ic}<span style="width:110px;color:var(--ink2)">{label}</span><span class="muted">{detail}</span></div>'

def dialog(inner, top=110):
    return f'''<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6)"></div>
<div style="position:absolute;left:50%;top:{top}px;margin-left:-330px;width:660px;background:#2F2F2F;border:1px solid rgba(255,255,255,0.10);border-radius:22px;box-shadow:0 24px 60px rgba(0,0,0,0.55);display:flex;flex-direction:column;overflow:hidden">{inner}</div>'''

head = lambda link, note: f'''<div class="hstack" style="padding:18px 20px 6px"><b style="font-size:17px;font-weight:600">Add a job</b><span class="sp"></span>{icon("x","#8F8F8F",20)}</div>
<div style="padding:8px 20px 4px"><div class="input" style="height:42px;border-radius:12px;gap:10px">{icon("ext","#8F8F8F",15)}<span class="mono" style="font-size:12.5px;color:var(--ink)">{link}</span></div></div>
<div class="hstack note" style="padding:6px 22px 12px;gap:8px">{icon("lock","#8F8F8F",13)}<span>{note}</span></div>'''

found = f'''{head("linkedin.com/jobs/view/software-developer-intern-at-clio-4012345678", "scout doesn't open LinkedIn. It read the title and company from the link.")}
<div style="margin:0 20px;padding:16px;border-radius:16px;background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;gap:12px">
 <div class="hstack" style="gap:12px">{company_logo("Clio",40,10)}<div class="vstack" style="gap:2px;flex:1"><b style="font-size:15px;font-weight:600">Software Developer Intern</b><span class="muted">Clio, Calgary, AB or Edmonton, AB, Winter 2027</span></div>{score(86)}</div>
 <div class="hstack note" style="gap:8px">{board_logo("gh",16,4)}<span>Found the same job on Clio's own Greenhouse board. scout applies there.</span></div>
 <div class="divider"></div>
 {check(True,"Canada","Calgary and Edmonton")}
 {check(True,"Term","Winter 2027, in your terms")}
 {check(True,"Values","not on your excluded list")}
 {check(True,"Eligibility","no citizen, PR or SWPP clause")}
 {check(True,"Triage","Rails and Postgres product team; backend resume")}
</div>
<div class="hstack" style="padding:16px 20px 20px;gap:10px"><span class="note">The form has 15 fields; 2 will need you.</span><span class="sp"></span><span class="btn">Add to list</span><span class="btn pri">Add and apply</span></div>'''

def pick(title, where, sc, sel=False):
    bg = "background:rgba(255,255,255,0.07);" if sel else ""
    radio = f'<span style="width:16px;height:16px;border-radius:50%;border:{"5px solid #346BF1" if sel else "1.5px solid #5A5A5A"};flex-shrink:0"></span>'
    return f'<div class="hstack" style="padding:10px 12px;border-radius:12px;gap:12px;{bg}">{radio}<div class="vstack" style="gap:0;flex:1"><span style="font-size:14px">{title}</span><span class="note">{where}</span></div>{score(sc)}</div>'
ask = f'''{head("linkedin.com/jobs/view/4019876543", "This link only has a job number, and scout doesn't open LinkedIn to look it up.")}
<div style="padding:0 20px;display:flex;flex-direction:column;gap:12px">
 <div class="field"><label>Which company is it?</label><div class="input" style="gap:10px">{company_logo("Shopify",20,6)}<span>Shopify</span></div></div>
 <span class="note">2 internship postings on Shopify's Greenhouse board. Pick the one you saw.</span>
 <div style="display:flex;flex-direction:column;gap:4px">
  {pick("Dev Degree Intern, Winter 2027","Remote in Canada, Greenhouse",81,True)}
  {pick("Software Engineering Intern, Summer 2027","Toronto, ON, Greenhouse",77)}
 </div>
 <div class="hstack note" style="gap:8px">{icon("ext","#8F8F8F",13)}<span>Not here? Paste the company's apply link instead.</span></div>
 <div class="banner b-amber" style="font-size:12.5px">{icon("alert","#FBBF24",16)}<span>Another link you added today is for Seattle, WA, outside Canada. It is on Jobs with a warning, and only applies if you say "add anyway".</span></div>
</div>
<div class="hstack" style="padding:16px 20px 20px;gap:10px"><span class="sp"></span><span class="btn">Add to list</span><span class="btn pri">Add and apply</span></div>'''

def framed(name, inner, top=110):
    sc = desktop(name,"jobs","Jobs",d1.jobs_body,crumb="360 Canadian postings tracked")
    sc = sc.replace(f'<div class="screen" id="{name}">', f'<div class="screen" id="{name}" style="position:relative">',1)
    return sc[:sc.rindex("</div>")] + dialog(inner, top) + "</div>"

S8 = [framed("Desktop / 22 Add a job by link", found), framed("Desktop / 23 Add a job, scout needs the company", ask, 90)]
open("desktop8.html","w").write(page(S8))
print("desktop8", len(page(S8)))
