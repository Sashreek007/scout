import sys, zlib, base64, urllib.parse, itertools, os
from xml.sax.saxutils import quoteattr

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "diagrams")
URLS = os.path.join(os.path.dirname(__file__), "urls")
os.makedirs(URLS, exist_ok=True)

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "figma"))
import logos as _L
def lg(spec, size=18):
    kind, name = spec.split(":", 1)
    if kind == "si":
        src = _L.si_datauri(name)
        return f'<img src="{src}" width="{size}" height="{size}" style="vertical-align:middle;margin-right:6px">'
    src = _L.fav_datauri(name)
    return f'<img src="{src}" width="{size}" height="{size}" style="vertical-align:middle;margin-right:6px;border-radius:4px;background:#fff">'

class D:
    def __init__(self, name):
        self.name = name; self.cells = []; self.ids = itertools.count(2)
    def nid(self): return f"n{next(self.ids)}"
    def v(self, value, x, y, w, h, style="", parent="1", id=None):
        id = id or self.nid()
        base = "rounded=0;whiteSpace=wrap;html=1;"
        self.cells.append(f'<mxCell id="{id}" value={quoteattr(value)} style={quoteattr(base+style)} vertex="1" parent="{parent}"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return id
    def text(self, value, x, y, w, h, style=""):
        return self.v(value, x, y, w, h, "text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;" + style)
    def box(self, title, body, x, y, w, h, style="", logo=None):
        pre = "".join(lg(l) for l in (logo if isinstance(logo, list) else [logo])) if logo else ""
        val = f"{pre}<b>{title}</b>" + (f"<br>{body}" if body else "")
        return self.v(val, x, y, w, h, style)
    def group(self, title, x, y, w, h, style="", logo=None):
        pre = lg(logo) if logo else ""
        return self.v(f"{pre}<b>{title}</b>", x, y, w, h, "verticalAlign=top;spacingTop=8;fillColor=none;" + style)
    def e(self, src, tgt, label="", style="", points=None):
        id = self.nid()
        base = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;html=1;endArrow=open;endSize=8;"
        pts = ""
        if points:
            pts = '<Array as="points">' + "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in points) + "</Array>"
        self.cells.append(f'<mxCell id="{id}" value={quoteattr(label)} style={quoteattr(base+style)} edge="1" parent="1" source="{src}" target="{tgt}"><mxGeometry relative="1" as="geometry">{pts}</mxGeometry></mxCell>')
        return id
    def free_e(self, x1, y1, x2, y2, label="", style="", points=None):
        id = self.nid()
        pts = ""
        if points:
            pts = '<Array as="points">' + "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in points) + "</Array>"
        self.cells.append(f'<mxCell id="{id}" value={quoteattr(label)} style={quoteattr("html=1;rounded=0;"+style)} edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="{x1}" y="{y1}" as="sourcePoint"/><mxPoint x="{x2}" y="{y2}" as="targetPoint"/>{pts}</mxGeometry></mxCell>')
    def xml(self):
        body = '<mxCell id="0"/><mxCell id="1" parent="0"/>' + "".join(self.cells)
        return (f'<mxfile host="scout-gen"><diagram name={quoteattr(self.name)} id="{self.name}">'
                f'<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0">'
                f'<root>{body}</root></mxGraphModel></diagram></mxfile>')
    def save(self):
        x = self.xml()
        open(os.path.join(OUT, self.name + ".drawio"), "w").write(x)
        enc = urllib.parse.quote(x, safe="-_.!~*'()")
        c = zlib.compressobj(9, zlib.DEFLATED, -15)
        raw = c.compress(enc.encode()) + c.flush()
        frag = urllib.parse.quote(base64.b64encode(raw).decode(), safe="")
        open(os.path.join(URLS, self.name + ".url"), "w").write("https://app.diagrams.net/?splash=0#R" + frag)
        print(self.name, len(x), "chars, url", len(frag))

TITLE = "fontSize=18;"

# ---------- 1. overview ----------
d = D("overview")
d.text("scout: architecture overview", 0, 0, 600, 30, TITLE)
s1 = d.box("GitHub internship lists", "SimplifyJobs and vanshb03<br>listings.json", 40, 100, 260, 70, logo="si:github")
s2 = d.box("Job-board feeds", "Greenhouse, Lever, Ashby<br>public JSON, no login", 40, 210, 260, 70, logo=["si:greenhouse","fav:lever.co","fav:ashbyhq.com"])
cl = d.box("Claude API", "Haiku 5.5 for triage,<br>Sonnet 5.5 for planning", 40, 420, 260, 70, logo="si:anthropic")
s3 = d.box("Company application pages", "Greenhouse, Lever and Ashby forms<br>Workday in a later phase", 40, 660, 260, 70)
d.group("GitHub Actions (once a day)", 380, 80, 330, 300, logo="si:githubactions")
pl = d.box("Pipeline", "collect and dedupe postings<br>Canada and hard filters<br>triage with Claude<br>read forms, plan answers<br>send the daily digest", 410, 130, 270, 220)
d.group("Your Mac", 380, 470, 330, 340, logo="si:apple")
ag = d.box("scout server", "supervisor and agents fill approved<br>applications, read every value back,<br>stream live events to every client", 410, 520, 270, 110)
ch = d.box("Chrome via Playwright", "a separate scout profile", 410, 690, 270, 80, logo=["si:googlechrome","fav:playwright.dev"])
d.group("Firebase (Spark plan)", 800, 220, 300, 340, logo="si:firebase")
au = d.box("Firebase Auth", "Google sign-in, one user", 830, 280, 240, 60)
fs = d.box("Cloud Firestore", "profile, memory, jobs,<br>applications, questions,<br>runs, config", 830, 380, 240, 140)
gm = d.box("Gmail (phase 3)", "read-only, finds replies<br>from employers", 800, 690, 300, 70, "dashed=1;", logo="si:gmail")
d.group("Vercel (Hobby)", 1200, 220, 300, 180, logo="si:vercel")
db = d.box("Dashboard", "Next.js on the web and phone;<br>the Mac app shows the same pages", 1230, 280, 240, 90, logo="si:nextdotjs")
me = d.box("Sashreek", "phone or laptop", 1230, 480, 240, 60)
dc = d.box("Notifications", "Mac app banners and<br>phone push through FCM", 1230, 650, 240, 70, logo="si:firebase")
d.e(pl, s1, "fetch lists", "exitX=0;exitY=0.2;entryX=1;entryY=0.5;")
d.e(pl, s2, "fetch feeds,<br>read forms", "exitX=0;exitY=0.55;entryX=1;entryY=0.5;")
d.e(pl, cl, "triage,<br>plan answers", "exitX=0;exitY=0.9;entryX=1;entryY=0.3;")
d.e(ag, cl, "Ashby forms,<br>field help", "exitX=0;exitY=0.5;entryX=1;entryY=0.8;")
d.e(ch, s3, "fill and submit", "exitX=0;exitY=0.5;entryX=1;entryY=0.5;")
d.e(ag, ch, "drives", "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.e(pl, fs, "read and write", "exitX=1;exitY=0.8;entryX=0;entryY=0.25;startArrow=open;startSize=8;")
d.e(ag, fs, "claim, update stages", "exitX=1;exitY=0.3;entryX=0;entryY=0.8;startArrow=open;startSize=8;")
d.e(db, fs, "live listeners,<br>answers, approvals", "exitX=0;exitY=0.7;entryX=1;entryY=0.35;startArrow=open;startSize=8;")
d.e(db, au, "sign in", "exitX=0;exitY=0.3;entryX=1;entryY=0.5;")
d.e(me, db, "reviews, answers,<br>approves", "exitX=0.5;exitY=0;entryX=0.5;entryY=1;")
d.e(dc, me, "pings", "exitX=0.5;exitY=0;entryX=0.5;entryY=1;")
d.e(pl, dc, "daily summary", "exitX=1;exitY=0.15;entryX=1;entryY=0.5;", points=[(760, 163), (760, 120), (1540, 120), (1540, 685)])
d.e(ag, dc, "live questions, alerts", "exitX=1;exitY=0.8;entryX=0;entryY=0.5;", points=[(750, 608), (750, 640), (1150, 640), (1150, 685)])
d.e(ag, gm, "read replies", "exitX=1;exitY=1;entryX=0;entryY=0.5;dashed=1;", points=[(740, 630), (740, 725)])
d.save()

# ---------- 2. stages ----------
d = D("stages")
d.text("scout: application stages", 0, 0, 600, 30, TITLE)
d.text("Labels say who moves an application. Every move writes an event.", 0, 32, 800, 24, "fontSize=12;")
W, H = 150, 50
def st(name, x, y): return d.v(name, x, y, W, H, "rounded=1;")
def lab(t, x, y, w=160, h=34, align="left"): return d.v(t, x, y, w, h, f"text;strokeColor=none;fillColor=none;align={align};verticalAlign=middle;fontSize=11;")
start = d.v("", 20, 155, 20, 20, "ellipse;fillColor=#999999;strokeColor=#999999;")
q = st("queued", 180, 140); p = st("planning", 480, 140); na = st("needs_answers", 780, 140)
rv = st("review", 1080, 140); ap = st("approved", 1380, 140); fi = st("filling", 1680, 140); ad = st("applied", 1980, 140)
cs = st("closed", 480, 340); sk = st("skipped", 1080, 340); fl = st("failed", 1380, 340); nh = st("needs_hand", 1680, 340)
asm = st("assessment", 1380, 500); iv = st("interview", 1680, 500); of = st("offer", 1980, 500)
rj = st("rejected", 1680, 640); wd = st("withdrawn", 1980, 640)
# main row
d.e(start, q, "you, or<br>auto rule", "exitX=1;exitY=0.5;entryX=0;entryY=0.5;fontSize=11;")
d.e(q, p, "pipeline", "fontSize=11;")
d.e(p, na, "pipeline", "fontSize=11;")
d.e(na, rv, "you answer", "fontSize=11;")
d.e(rv, ap, "you approve", "fontSize=11;")
d.e(ap, fi, "agent claims", "exitX=1;exitY=0.5;entryX=0;entryY=0.5;fontSize=11;")
d.e(fi, ad, "agent, or you on hold:<br>confirmation seen", "fontSize=11;")
# over the top
d.e(p, rv, "pipeline, no questions", "exitX=0.5;exitY=0;entryX=0.5;entryY=0;fontSize=11;", points=[(555, 100), (1155, 100)])
d.e(fi, na, "agent: a field that is not on the sheet", "exitX=0.5;exitY=0;entryX=0.4;entryY=0;fontSize=11;", points=[(1755, 60), (840, 60)])
d.e(fi, ap, "agent: stopped, or the lease ran out", "exitX=0.2;exitY=0;entryX=0.5;entryY=0;fontSize=11;", points=[(1710, 118), (1455, 118)])
# down to row B
d.e(p, cs, "", "exitX=0.5;exitY=1;entryX=0.5;entryY=0;dashed=1;")
lab("posting taken down,<br>any stage before applied", 565, 245, 170)
d.e(p, fl, "", "exitX=1;exitY=0.9;entryX=0;entryY=0.5;", points=[(760, 185), (760, 300), (1330, 300), (1330, 365)])
lab("pipeline: planning<br>failed 3 times", 770, 305, 150)
d.e(rv, sk, "", "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
lab("you skip", 1162, 255, 80)
d.e(fi, fl, "", "exitX=0;exitY=0.85;entryX=1;entryY=0.5;", points=[(1605, 182), (1605, 365)])
lab("agent:<br>error", 1612, 250, 60)
d.e(fl, ap, "", "exitX=0.5;exitY=0;entryX=0.5;entryY=1;")
lab("you retry", 1385, 255, 60, 24, "right")
d.e(fl, q, "", "exitX=0.3;exitY=1;entryX=0.5;entryY=1;", points=[(1425, 440), (255, 440)])
lab("you: plan it again from the start", 700, 444, 220, 24)
d.e(fi, nh, "", "exitX=0.8;exitY=1;entryX=0.8;entryY=0;")
lab("agent: CAPTCHA, login<br>or unclear result", 1808, 240, 160)
d.e(nh, fi, "", "exitX=0.3;exitY=0;entryX=0.3;entryY=1;")
lab("you<br>fixed it", 1660, 280, 62, 34, "right")
d.e(nh, ap, "", "exitX=0.1;exitY=0;entryX=0.8;entryY=1;", points=[(1695, 325), (1500, 325)])
lab("you: back to<br>the agents", 1508, 291, 95, 32)
d.e(nh, ad, "", "exitX=1;exitY=0.5;entryX=0.4;entryY=1;", points=[(2040, 365)])
lab("you confirm it went in,<br>or the agent sees it", 1840, 329, 150)
# after applying
d.e(ad, asm, "", "exitX=0.8;exitY=1;entryX=0.5;entryY=0;", points=[(2100, 450), (1455, 450)])
lab("you or mail watcher", 1480, 455, 160, 24)
d.e(ad, iv, "", "exitX=0.6;exitY=1;entryX=0.5;entryY=0;", points=[(2070, 420), (1755, 420)])
lab("you or mail watcher", 1790, 396, 160, 24)
d.e(asm, iv, "you or<br>mail watcher", "fontSize=11;")
d.e(iv, of, "you", "fontSize=11;")
d.e(asm, rj, "", "exitX=0.5;exitY=1;entryX=0;entryY=0.5;", points=[(1455, 665)])
lab("you or mail watcher", 1470, 670, 160, 24)
d.e(iv, rj, "", "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.e(iv, wd, "", "exitX=0.9;exitY=1;entryX=0.5;entryY=0;", points=[(1815, 590), (2055, 590)])
lab("you", 1930, 566, 40, 24)
lab("Rejected and withdrawn can follow any stage from applied on.", 1380, 720, 500, 24)
d.save()

# ---------- 3. firestore layout ----------
d = D("firestore-layout")
d.text(lg("si:firebase", 22) + "scout: Firestore layout", 0, 0, 600, 30, TITLE)
def coll(path, fields, x, y, w, h):
    return d.v(f"<b>{path}</b><hr size='1'>" + "<br>".join(fields), x, y, w, h, "align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;")
pr = coll("profile/main", ["identity, links, education", "workAuthorization, availability", "relocation, compensation", "resumes: variant, file, sha256", "filters: excluded employers,", "roles, terms, daily cap"], 40, 70, 320, 160)
rn = coll("runs/{runId}", ["kind: pipeline or agent", "startedAt, finishedAt", "counts per source, errors[]"], 40, 290, 320, 100)
jb = coll("jobs/{jobKey}", ["company, title, locations[], terms[]", "ats, boardToken, applyUrl", "sources[], firstSeenAt, lastSeenAt", "active, contentHash, description", "filter: passed, reasons[]", "triage: decision, score, reasons[],", "resumeVariant, model, at"], 420, 70, 340, 190)
apl = coll("applications/{jobKey}", ["stage, stageAt, company, title", "formSpec: fields[]", "sheet: fields[] with answer, source,", "evidence, approved", "resumeVariant, resumeSha256", "lease: owner, until", "submitAttemptAt, submittedAt", "confirmationText, nextAction, due, notes"], 420, 320, 340, 215)
ev = coll("applications/{jobKey}/events/{eventId}", ["from, to, by, at, detail"], 420, 595, 340, 65)
mm = coll("memory/{questionKey}", ["question, answer", "kind: fact or preference", "createdAt, lastUsedAt, useCount"], 820, 70, 320, 100)
qu = coll("questions/{questionId}", ["applicationId, fieldId", "label, type, options[]", "askedAt, answer, answeredAt", "remember"], 820, 230, 320, 120)
cf = coll("config/agent", ["paused, dailyCap", "finalClick: auto or hold", "autoQueueScore"], 820, 410, 320, 95)
ct = coll("counters/{date}", ["applied today, checked against dailyCap"], 820, 560, 320, 65)
d.e(apl, jb, "same document ID", "exitX=0.5;exitY=0;entryX=0.5;entryY=1;")
d.e(ev, apl, "subcollection", "exitX=0.5;exitY=0;entryX=0.5;entryY=1;")
d.e(qu, apl, "applicationId", "exitX=0;exitY=0.6;entryX=1;entryY=0.2;")
d.e(qu, mm, "answer saved to", "exitX=0.5;exitY=0;entryX=0.5;entryY=1;dashed=1;")
d.save()

# ---------- sequence helper ----------
LOGO_FOR = {":GitHub Actions":"si:githubactions", ":Sources":"si:github", ":Claude API":"si:anthropic", ":Firestore":"si:firebase", ":Notifications":"si:firebase", ":Dashboard":"si:nextdotjs", ":Chrome":"si:googlechrome", ":Greenhouse form":"si:greenhouse"}
def sequence(name, title, parts, msgs, notes, height):
    d = D(name)
    d.text(title, 0, 0, 900, 30, TITLE)
    cx = {}
    for i, (key, label, kind) in enumerate(parts):
        x = 40 + i * 230
        style = "shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;dropTarget=0;collapsible=0;recursiveResize=0;outlineConnect=0;size=50;"
        if kind == "actor":
            d.v(label, x + 80, 60, 30, 50, "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;outlineConnect=0;")
            d.free_e(x + 95, 130, x + 95, 60 + height, "", "dashed=1;endArrow=none;")
            cx[key] = x + 95
        else:
            d.v((lg(LOGO_FOR[label]) if label in LOGO_FOR else "") + label, x, 60, 190, height, style)
            cx[key] = x + 95
    for (key, y1, y2) in [m for m in msgs if m[0] == "act"]:
        pass
    for m in msgs:
        kind, a, b, label, y = m
        if kind == "self":
            x = cx[a]
            d.free_e(x + 5, y, x + 5, y + 24, label, "align=left;spacingLeft=4;endArrow=block;endFill=1;edgeStyle=orthogonalEdgeStyle;", points=[(x + 40, y), (x + 40, y + 24)])
            continue
        x1, x2 = cx[a], cx[b]
        off = 5 if x2 > x1 else -5
        if kind == "call":
            d.free_e(x1 + off, y, x2 - off, y, label, "verticalAlign=bottom;endArrow=block;endFill=1;")
        else:
            d.free_e(x1 + off, y, x2 - off, y, label, "verticalAlign=bottom;endArrow=open;dashed=1;")
    for (key, y1, y2) in notes.get("act", []):
        d.v("", cx[key] - 5, y1, 10, y2 - y1, "fillColor=default;")
    for (key, text, y, w, h) in notes.get("notes", []):
        d.v(text, cx[key] + 20, y, w, h, "shape=note;size=12;align=left;spacingLeft=8;")
    d.save()

sequence("daily-run", "Step 1. The daily run finds, filters, triages and plans",
    [("gh", ":GitHub Actions", "box"), ("pl", ":Pipeline", "box"), ("src", ":Sources", "box"),
     ("cl", ":Claude API", "box"), ("fs", ":Firestore", "box"), ("dc", ":Notifications", "box")],
    [("call", "gh", "pl", "7:00 Edmonton: start the run", 150),
     ("call", "pl", "fs", "create runs/{runId}", 190),
     ("call", "pl", "src", "GET listings.json, board feeds", 230),
     ("ret", "src", "pl", "listings from every source", 270),
     ("self", "pl", None, "normalize, dedupe, hard filters", 300),
     ("call", "pl", "fs", "read known job keys and content hashes", 400),
     ("ret", "fs", "pl", "known jobs", 440),
     ("call", "pl", "fs", "upsert new and changed jobs", 480),
     ("call", "pl", "cl", "triage each new job: posting + profile", 530),
     ("ret", "cl", "pl", "apply, maybe or skip, score, reasons", 570),
     ("call", "pl", "fs", "save triage, auto-queue above the threshold", 610),
     ("call", "pl", "src", "read the form (Greenhouse, Lever)", 660),
     ("ret", "src", "pl", "FormSpec", 700),
     ("call", "pl", "cl", "plan answers: form + profile + memory", 740),
     ("ret", "cl", "pl", "answer sheet, open questions", 780),
     ("call", "pl", "fs", "save sheet and questions, stage needs_answers or review", 820),
     ("call", "pl", "dc", "daily summary: new matches, questions waiting", 870),
     ("call", "pl", "fs", "close the run with counts and errors", 910)],
    {"act": [("pl", 145, 925)],
     "notes": [("src", "Hard filters run in code before Claude:<br>Canada, role, term, values,<br>citizenship or PR, already applied", 282, 230, 60)]},
    900)

sequence("apply", "Step 2. You answer and approve, then the agent applies",
    [("me", "Sashreek", "actor"), ("db", ":Dashboard", "box"), ("fs", ":Firestore", "box"),
     ("ag", ":Agent", "box"), ("ch", ":Chrome", "box"), ("gh", ":Greenhouse form", "box"), ("dc", ":Notifications", "box")],
    [("call", "me", "db", "answers: in person OK? Yes", 150),
     ("call", "db", "fs", "save the answer; stage review", 190),
     ("call", "me", "db", "edits the essay, taps Approve", 240),
     ("call", "db", "fs", "stage approved", 280),
     ("call", "ag", "fs", "claim it in a transaction", 330),
     ("ret", "fs", "ag", "claimed, stage filling", 370),
     ("call", "ag", "ch", "open applyUrl in the scout profile", 410),
     ("call", "ch", "gh", "GET the application page", 450),
     ("call", "ag", "ch", "fill from the sheet, attach resume", 490),
     ("call", "ag", "ch", "read back every value", 530),
     ("ret", "ch", "ag", "values match the sheet", 570),
     ("call", "ag", "fs", "write submitAttemptAt", 610),
     ("call", "ag", "ch", "click Submit", 650),
     ("call", "ch", "gh", "POST the application", 690),
     ("ret", "gh", "ch", "confirmation page", 730),
     ("call", "ag", "fs", "stage applied, submittedAt, event", 770),
     ("call", "ag", "dc", "Applied: Northwind Robotics", 810),
     ("ret", "fs", "db", "listener: the card moves to Applied", 850)],
    {"act": [("ag", 325, 825)],
     "notes": [("ch", "A CAPTCHA, a login wall or a field<br>not on the sheet stops the run here.<br>The stage becomes needs_hand or<br>needs_answers and a notification pings you.", 580, 250, 76)]},
    840)
