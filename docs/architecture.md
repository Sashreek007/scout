# scout architecture

Sashreek Addanki · November 5, 2026

> AI use: Claude Opus 5.5 (Anthropic), used through Claude Code, helped write
> this document and its diagrams on November 5, 2026, working from decisions
> Sashreek made. It also checked the job sources, the job-board form APIs and
> the free-tier figures in section 6 against the live endpoints and pricing
> pages on that date. Sashreek's review is pending.

This page explains how scout is put together. scout finds internship and co-op postings in Canada, decides which ones fit, writes a one-page resume for each job from what it knows about Sashreek, fills in the application on the company's own site, and asks over the dashboard whenever it doesn't know an answer. It keeps learning about him the way a good assistant does: it remembers every fact, every correction and every decision he makes, with the reason, and never asks him the same thing twice. Section 3 explains the architecture style and why it isn't one big AI agent. Section 7 follows one job from the daily run to "applied", so you can see every part working in one story. Section 9 is the practical part: where files live, what to name things and how to add a new job board.

`docs/PLAN.md` holds the first plan. Where the two differ, this file wins.

## Contents

1. [The big picture](#1-the-big-picture)
2. [What scout has to do](#2-what-scout-has-to-do)
3. [Architecture style](#3-architecture-style)
4. [Design decisions and why we made them](#4-design-decisions-and-why-we-made-them)
5. [The parts](#5-the-parts)
5b. [The knowledge base and per-job resumes](#5b-the-knowledge-base-and-per-job-resumes)
6. [Data in Firebase](#6-data-in-firebase)
7. [One job, front to back](#7-one-job-front-to-back)
8. [When things go wrong](#8-when-things-go-wrong)
9. [Working in the codebase](#9-working-in-the-codebase)
10. [Build order and open questions](#10-build-order-and-open-questions)

## 1. The big picture

scout runs in four places. A daily job in GitHub Actions finds and ranks postings and plans the answers. Firestore holds everything. A dashboard on Vercel is where Sashreek answers questions and approves applications. An agent on his Mac does the one job that needs a real browser, which is filling in and submitting the form.

![Architecture overview](images/overview.png)

| Where | What runs there | When |
|---|---|---|
| GitHub Actions | The pipeline: collect, filter, triage, read forms, plan answers, send the digest | Once a day at 14:00 UTC, which is 7:00 in Edmonton in winter and 8:00 in summer |
| Firebase | Firestore with every job, application, question and the profile. Auth for the dashboard. | Always on |
| Vercel | The dashboard | Always on |
| Sashreek's Mac | The agent: fills approved applications in Chrome | When he starts it, or on a launchd schedule |

| Part | What we use | Why |
|---|---|---|
| Language | TypeScript everywhere | The pipeline, the agent and the dashboard share one set of types, so a Job written by the pipeline is the same Job the dashboard reads. |
| Repo layout | pnpm workspaces: three apps and three packages | Section 9 shows the folders. |
| Data shapes | Zod | One schema gives the TypeScript type and checks data at runtime. It checks feed data, Firestore documents and Claude's output. |
| AI | Claude Opus 5.5 through the Anthropic TypeScript SDK | Triage and answer planning use structured output. The agent's fallback uses the SDK's tool runner. |
| Browser | Playwright driving Chrome with its own scout profile | Runs on the Mac, headed, so Sashreek can watch or take over. |
| Database | Cloud Firestore, Standard edition | Live listeners for the dashboard and transactions for claiming work. |
| Sign-in | Firebase Auth with Google | One user. Security rules let only his account in. |
| Dashboard | Next.js on Vercel's Hobby plan, with shadcn/ui | Hobby is for personal, non-commercial use, which scout is. |
| Schedule | GitHub Actions cron | Free inside the monthly allowance for a private repo, and no server to look after. |
| Alerts | A Discord webhook | Send-only. It needs no bot and no server. All replies happen in the dashboard. |
| Tests | Vitest, with saved copies of real feeds and forms | Tests never hit a live job board. |

## 2. What scout has to do

scout has to:

- Find internship and co-op postings in Canada every day from public sources.
- Drop the postings Sashreek can't or won't take, using rules he can read in code.
- Rank the rest and say why.
- Write a one-page resume for every application, tailored to the job description by the same rules used by hand today, and only from facts that are verified.
- Fill in applications on Greenhouse, Lever and Ashby first, and on Workday later.
- Give every factual answer a source in his profile or in an answer he gave before.
- Ask him when it doesn't know, and never ask the same question twice.
- Submit nothing he hasn't approved.
- Track every application from "found" to "offer".
- Keep learning about him: every correction, edit and decision is stored with its reason and applied from then on.

scout will not:

- Touch LinkedIn. LinkedIn's User Agreement bans automated access, and his main account is not worth the risk.
- Create accounts on job sites. He creates Workday accounts himself.
- Solve CAPTCHAs. A CAPTCHA hands the job to him.
- Send a cover letter, essay answer or resume he hasn't approved.
- Print a claim on a resume that isn't backed by a verified fact, unless he turns that on for one application on purpose.
- Apply to more than the daily cap. It starts at 10.
- Support more than one user.

## 3. Architecture style

scout is a **pipeline with a state machine, and adapters for each job board**. There is no single app with screens and controllers, so MVC doesn't fit. Three ideas carry the design.

**A pipeline of small steps.** Each daily run goes collect, normalize, filter, triage, read forms, plan answers, digest. Each step reads from Firestore and writes back to it, so a crashed run picks up where it stopped the next day. Every step can run again safely, because document IDs come from the posting itself. Section 6 explains how.

**A state machine for every application.** An application is always in exactly one stage, and only certain moves are allowed. The stage list and the allowed moves live in one file, `packages/core/stages.ts`. Every move writes an event, so each application keeps a full history of who moved it and when.

![Application stages](images/stages.png)

| Stage | Meaning | Who moves it on |
|---|---|---|
| `queued` | Chosen to apply, by Sashreek or by the auto rule | The pipeline |
| `planning` | The form is being read and the answers planned | The pipeline |
| `needs_answers` | Questions are waiting for Sashreek | Sashreek, by answering in the dashboard |
| `review` | The answer sheet is ready | Sashreek: approve or skip |
| `approved` | Ready for the agent | The agent, when it claims it |
| `filling` | The agent is working in the browser | The agent |
| `needs_hand` | A CAPTCHA, a login wall, or a result the agent can't read | Sashreek, at the Mac |
| `applied` | The company's confirmation was seen | Sashreek or the mail watcher |
| `assessment`, `interview`, `offer` | After applying | Sashreek or the mail watcher |
| `rejected`, `withdrawn` | Closed after applying | Final |
| `skipped`, `closed`, `failed` | Skipped at review, posting taken down, or an error. A failed one can be retried. | Final, except `failed` |

**Adapters at the edges.** Code that talks to the outside sits behind small interfaces called ports, in `packages/core/ports.ts`. Each job board gets its own adapter. The core never imports Playwright, Firestore or the Anthropic SDK, so it is tested without a network.

```ts
interface JobSource  { id: string; fetch(): Promise<Listing[]> }
interface FormReader { canRead(job: Job): boolean; read(job: Job): Promise<FormSpec> }
interface FormFiller { canFill(app: Application): boolean; fill(page: Page, sheet: Sheet): Promise<FillReport>; submit(page: Page): Promise<SubmitResult> }
interface Store      { /* jobs, applications, questions, memory, profile, runs */ }
interface Notifier   { send(message: Notice): Promise<void> }
interface Llm        { triage(job: Job, profile: Profile): Promise<Triage>; plan(input: PlanInput): Promise<PlanResult> }
```

**Why not one big agent?** One Claude agent with a browser could do all of this. It would also be slow, expensive and hard to test, and it would make different choices on different days. Most of scout's work is plain code: download a JSON file, match a city name, copy an email address into a field. Claude does the four jobs that need judgement:

1. Triage: does this posting fit him, and which side of his work should lead?
2. Resume tailoring: which entries, bullets, titles and skill rows fit this job description, and how to reword a bullet in the job's vocabulary without changing what it claims.
3. Answer planning: which profile fact answers "Are you legally eligible to work in Canada?", and what goes in "Why do you want to work here?"
4. A fallback in the browser when a filler can't find a field on the page. Even then it may only type values from the approved sheet.

Everything Claude writes is checked by code against the knowledge base before Sashreek sees it.

## 4. Design decisions and why we made them

| Decision | Why |
|---|---|
| Jobs come from two GitHub internship lists and public job-board feeds, never LinkedIn. | LinkedIn bans automated access. The GitHub lists and feeds are public JSON, carry structured fields like location and term, and need no login. |
| Canada only, checked in code. | He is on a study permit with a co-op work permit, so Canadian roles are the ones he can take. A location rule in code is easy to test. |
| Values and eligibility filters run in code before Claude sees a posting. | Defence, weapons and surveillance employers are out on values grounds, and SWPP, FSWEP and citizen-or-PR postings are closed to him. Code rules are predictable and testable. Triage still flags anything the rules miss. General Dynamics postings were in the Canadian list on November 5, 2026, so this matters from day one. |
| scout reads the application form before any browser opens. | Greenhouse publishes each job's full form through a public API, with field types and which fields are required. Lever puts its custom questions in the apply page's HTML. So scout can plan every answer and ask every question in one batch, days before the agent runs. |
| Sashreek approves the answer sheet, not a screenshot. | The browser doesn't have to wait open for hours. The agent fills from the approved sheet, reads every value back from the page, and stops if anything differs. |
| Every factual answer cites a profile field or a remembered answer. | Wrong answers on work authorization or availability can cost him the job. The planner may only draft free-text answers like "why us", and those always go to him. |
| The profile and remembered answers live in Firestore. The YAML files in `profile/` only seed it. | The pipeline in GitHub Actions needs the profile, and he edits it from the dashboard. One copy means no drift. |
| A job's document ID is built from the posting, like `greenhouse:tribalscale:4726999006`. The application uses the same ID. | Running the collector twice updates the same documents instead of making copies. Using the same ID for the application means there can only be one application per posting. |
| GitHub Actions runs the schedule. No server, no n8n, no Cybera. | The daily run is a few minutes of HTTP calls and Firestore writes. Actions does that for free in a private repo. Cybera's Rapid Access Cloud is for research and testing, not ongoing hosting. |
| The browser work runs on the Mac in its own Chrome profile. | Chrome locks a profile while it's open, and his daily profile shouldn't carry automation. Running locally also keeps his Workday logins on his own machine. |
| No Firebase Storage in the first version. | Storage needs the Blaze plan since February 3, 2026. Posting text fits in Firestore. Screenshots stay on the Mac under `runs/`. Moving to Blaze later only adds screenshots to the dashboard. |
| One user, and the rules allow one account. | It is a personal tool. Rules for one known account are short and easy to check. |
| Alerts go to a Discord webhook, and answers go into the dashboard. | A webhook is one URL, with no bot to host. The dashboard already has the questions, the sheet and the context, so that is where he answers. |
| The agent claims work with a Firestore transaction and a lease. | Two agent runs can never fill the same application. A crashed run's lease runs out and someone can pick the work up again. |
| The agent writes `submitAttemptAt` before it clicks Submit. | If it crashes between the click and the confirmation, a retry could apply twice. With the marker set, a retry goes to `needs_hand` and he checks his email first. |
| Claude Opus 5.5 at low effort for triage, medium for planning, with server-side refusal fallback. | Triage is a short decision. Planning needs more care. Fallback reruns a refused request on another model in the same call, and the code still checks `stop_reason` before reading the answer. |
| The stable part of every prompt is cached. | The instructions and his profile are the same on every call. Cache reads cost $0.20 per million tokens, against $4 for normal input. |
| Every application gets its own resume, built from the active base resume by the rules in `rules.md`. | This is the process that already works by hand. scout automates it instead of inventing a new one. Fixed variants can't move a project up for one job or swap mint's SDK bullet for its observability bullet for an SRE posting. |
| The knowledge base is modelled on the assistant memory used today: facts with sources, feedback with the reason, and dated decisions. | Facts alone aren't enough. "Never write '100% cited'" only stays fixed if the reason is stored with it, and "no dates on projects, his call" stops the same question coming back. |
| The base resume is a setting, not a constant. | v6 is the base today and v7 is waiting. Bases are stored side by side, one is active, and switching is one action that shows exactly what changed. |
| The knowledge base is seeded from `rules.md`, the memory files and the resume `.tex` files. | scout starts with everything already settled over months of review, not from zero. |
| scout learns only what Sashreek confirms. | Every edit or correction becomes a suggested rule or bullet. Nothing becomes a fact or a rule until he accepts it, so the agent can't drift into claims he never made. |
| A resume is rendered from a template, not written as free LaTeX by Claude. | Claude picks and rewords bullets. Code renders the `.tex` from the active base's preamble and macros, so the layout and fonts are always the same and every check can run on it. |
| The pre-flight list from `rules.md` runs as code on every resume. | One page, line counts, bullet counts, bold spans, banned words, repeated verbs, never-print terms and number provenance are all checkable by a machine. The read-it-aloud test stays with him. |
| Resume PDFs are stored in Firestore as base64, about 80 KB each. | It keeps scout on the free Spark plan. The agent uploads exactly the approved file and checks its hash. |
| scout starts with an empty application history. | Past applications from before scout aren't imported. Sashreek decided this on November 5, 2026. |

## 5. The parts

### Sources

Checked live on November 5, 2026.

| Source | Endpoint | Active Canadian postings |
|---|---|---|
| SimplifyJobs Summer2027 list | `raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json` | 473 |
| vanshb03 Summer2027 list | `raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json` | 289 |
| Greenhouse board | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | Per company |
| Lever board | `api.lever.co/v0/postings/{token}?mode=json` | Per company |
| Ashby board | `api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true` | Per company |

About 134 postings are in both GitHub lists, so together they hold roughly 520 unique Canadian postings. The vansh list uses short links that the collector has to follow to find the real apply URL.

The board list grows on its own. Any GitHub listing whose apply URL is on Greenhouse, Lever or Ashby reveals that company's board token. Each run polls the boards in `sources/boards.yaml`, plus every token found in this run's listings or already stored on a job, so scout sees new postings before the lists do. Nothing is written back to the repo. Board postings are kept only if the title looks like a student role, which keeps full-time jobs out of Firestore.

### Normalize, dedupe and filter

Every source turns its data into the same `Listing` shape. Then:

1. **Job key.** When the apply URL is on a known board, the key is `{ats}:{board}:{postingId}`. Otherwise it is the source name plus a hash of the company and title.
2. **Content hash.** A hash of the title, locations, terms and description. The pipeline writes a job only when the hash changes, which keeps Firestore writes low.
3. **Hard filters**, in this order: location in Canada, role keywords, term, the excluded employers and sectors, eligibility clauses, and already applied. Each failed rule is saved as a reason, so the dashboard can show why a posting was dropped.

### Triage

One Claude call per new posting that passed the filters. The input is the posting text plus his profile. The output is structured and checked with Zod:

| Field | Meaning |
|---|---|
| `decision` | `apply`, `maybe` or `skip` |
| `score` | 0 to 100 |
| `reasons` | Short lines he can read in the digest |
| `lead` | Which side of his work should lead the resume: backend, ai or devops. The tailoring step uses it as a starting point. |
| `flags` | Anything the code filters might have missed, like a citizenship clause in the body text |

Postings scoring above `config/agent.autoQueueScore` go straight to `queued`. The rest wait in the dashboard for him to pick. For Workday and other boards without a public posting API, triage only has the title, company and location, and says so in its reasons.

### Form readers

| Board | How the form is read | Where it runs |
|---|---|---|
| Greenhouse | `GET /v1/boards/{token}/jobs/{id}?questions=true` returns every field with its type and whether it's required | Pipeline |
| Lever | The apply page's HTML holds the custom question cards | Pipeline |
| Ashby | The form only exists once the page runs in a browser, so the agent reads it from the page | Agent |
| Workday | Later phase | Agent |

Every reader returns the same `FormSpec`: a list of fields, each with an ID, label, type, options and a required flag.

### Answer planner

The planner turns a `FormSpec` into an answer sheet in three passes:

1. **Rules.** Name, email, phone, links, the upload of this job's approved resume, and the common yes-or-no questions on work authorization come straight from the profile. No AI is used.
2. **Memory.** Questions he has already answered are matched by their normalized text.
3. **Claude.** Everything left goes to Claude with the form, the profile, the memory and the posting. Each answer comes back with its source and evidence. A factual answer must name the profile field it came from. If Claude can't ground an answer, the field becomes a question for him.

Voluntary demographic questions follow the profile's policy, which by default is to decline.

### Fillers and the agent

The agent is a small Node process on the Mac. Each loop it:

1. Checks `config/agent.paused` and the daily cap.
2. Claims one `approved` application in a transaction and takes a 15-minute lease.
3. Opens the apply URL in Chrome with the scout profile.
4. Hands the page to the filler for that board. The filler knows where the standard fields are and finds custom fields by their labels.
5. If the filler can't find a field, it asks Claude through the SDK tool runner. The tools can only read the page and type values from the approved sheet.
6. Reads every field back and compares it to the sheet.
7. Writes `submitAttemptAt`, clicks Submit, and waits for the board's confirmation page.
8. Marks the application `applied`, logs the event and posts to Discord.

The same Mac process also runs a small render worker. When he edits a resume in the dashboard, it re-renders, compiles and checks the new version with the tectonic already on his Mac.

`config/agent.finalClick` decides step 7. With `auto`, the agent clicks Submit. With `hold`, it stops on the filled form and Sashreek clicks it himself.

### Dashboard

A Next.js app that reads Firestore directly with the Firebase web SDK and live listeners. It has no server code.

| Page | What it shows |
|---|---|
| Today | Open questions, sheets waiting for review, `needs_hand` items and assessment deadlines |
| Board | One column per stage, one card per application |
| Jobs | Triaged postings with their filter and triage reasons, and a button to queue one |
| Application | The saved posting, the tailored resume with its diff and sources, the answer sheet with sources, the event history and notes |
| Profile | His facts and remembered answers, editable |
| Knowledge | Facts, bullets, rules and decisions, the suggestions waiting for him, and the log of what changed |
| Stats | Applications per week, response rate by source, board and resume version |

### Notifier

Discord gets four kinds of message: the daily digest, "questions waiting", "needs you at the Mac" and failures. Each one links to the right dashboard page.

### Mail watcher

Phase 3. It reads Gmail with read-only access and looks for mail from companies he applied to: assessment invites from CodeSignal or HackerRank, interview requests and rejections. Clear cases move the stage. Unclear ones become a question. It runs on the Mac next to the agent, because a Google OAuth app in "Testing" status gets refresh tokens that expire after 7 days. On the Mac he can sign in again in a few seconds.

## 5b. The knowledge base and per-job resumes

![Knowledge base and resume flow](images/resume-flow.png)

scout has to know Sashreek the way a good assistant does after months of working with him: what he built, what each number means and where it came from, which wordings he fought for, what must never be printed, and why each of those calls was made. The knowledge base holds that, and every resume and every form answer is built from it.

### What the knowledge base holds

It is modelled on the memory the assistant keeps today, with the same four kinds of entry.

| Kind | What it holds | Example |
|---|---|---|
| Fact | Something true about him, with a source and a status | mint cut `/validate` p99 from 17 to 10 ms. Source: `benchmarks/RESULTS.md`. Verified. |
| Bullet | An approved resume wording, the facts it relies on, and where it fits | mint's SDK bullet, for backend and API jobs. mint's observability bullet, for SRE jobs. |
| Rule | A constraint or a correction, always with the reason and how to apply it | Never "100% cited". It reads as an inflated metric before the reader reaches the mechanism. Say "an uncited claim cannot reach the report". |
| Decision | A call he made, dated, so it is never re-argued | No dates on projects. His call, August 16, 2026. Do not re-propose. |

Facts carry one of four statuses:

| Status | Meaning | Printable |
|---|---|---|
| `verified` | Checked against a repo, benchmark, CI file or document | Yes |
| `stated` | His own word about his own work, like Quantum Ops' 99.9% uptime | Yes, flagged "rehearse the source" on the review screen |
| `coursework` | Learned in a course, like the AWS services in his Solutions Architect notes | Only in Technical Skills, never in a bullet |
| `unverified` | Proposed but not checked yet | No |

Rules come in three groups, all taken from `rules.md` on day one:

- **Hard constraints** that code can check: one page, at most 4 bullets per entry, at most 2 lines per bullet with the spam-bot exception, no em dashes, 1 to 2 bold spans per bullet, no bolded technology names, no repeated opening verbs in a section, banned words, heading width.
- **Must-survive items** that a tailored resume may reword or reorder but never drop, like the four deterministic stages bullet and the RAG clause in ClubMate.
- **Never-print items** with the reason for each, like LangGraph on ClubMate, any average of Replay's per-class accuracy, and Latch's unbuilt crash-resume.

### How it is seeded

A one-time import reads three places and turns them into entries for him to confirm:

1. `rules.md`, section by section: hard constraints, must-survive items, never-print items, the tailoring process and the Technical Skills standard.
2. The memory files in `resume-eval-agent`: the verified numbers for mint, Replay, Latch, UAIS and Quantum Ops, the values filter, the unbacked-claims policy and his dated decisions.
3. The base resumes in `Resumes/bases/` and the company variants: every `\resumeItem` becomes a bullet linked to the facts it states, with alternates kept side by side.

Imported entries arrive as suggestions. He accepts them in batches on the Knowledge page, so the starting state is something he has read, not something scout assumed.

### The base resume

A base is a complete resume he has signed off: its LaTeX template, its bullets in order, and its skill rows. Every tailored resume starts from the active base.

- Bases live in `kb/bases/items/{baseId}`, for example `v6` and `v7`, each with the `.tex` it came from.
- One base is active at a time. It is set in Settings and shown on the Knowledge page.
- Switching to a new base imports its bullets as suggestions and shows the diff against the current one: bullets added, cut, merged or reworded. For v6 to v7 that is the Replay testing cut, the new four-stages bullet, the merged mint bullet and the new observability bullet.
- Switching never touches resumes already built. Each resume version records the base it came from.
- Applications still in `planning` or `review` when the base changes get a fresh resume version from the new base, and the old version stays for comparison.

### How a resume is built for one job

This runs in the daily pipeline, next to answer planning, for every queued application.

1. **Plan.** Claude Opus 5.5 at high effort reads the job description and the knowledge base. It returns a plan: which entries appear and in what order, an honest retitle if one fits, which bullets by ID, any rewording in the job's vocabulary, the skill rows named the way the job names them, and an availability line if the posting asks for one. Every reworded bullet keeps the fact IDs of the bullet it came from.
2. **Render.** Code fills the active base's template with the plan. Claude never writes raw LaTeX.
3. **Compile.** Tectonic builds the PDF. A small macro in the template writes each bullet's line count to the log, so line limits are measured, not estimated.
4. **Check.** Code runs the pre-flight list from `rules.md`: one page by `pdfinfo`, line and bullet limits, bold spans, banned words, repeated verbs, must-survive items present, no never-print term, every number on the page found in a printable fact, no new overfull heading, and every link returning 200.
5. **Fix or ask.** Failing checks go back to Claude with the reasons, up to three times. If it still fails, scout asks him a choice question instead of guessing, for example "The page runs 3 lines over. Drop one of these bullets."
6. **Show.** The review screen gets the PDF, a diff against the base it was built from, and the source of every bullet. The sheet can't be approved until the resume is.

Tailoring follows the rules in `rules.md` section 6: a job keyword earns its place by replacing a vaguer word, never by being appended, and a keyword that doesn't fit a bullet goes in the stack line or Technical Skills.

**Unbacked claims are off by default.** For one application he can switch on "allow unbacked claims" with a reason, as he did for the Nutrien DevOps variant. Those bullets are marked on the review screen, the application is tagged "rehearse before a screen", and nothing from it ever becomes a fact.

### How it keeps learning

| He does this | scout stores | Used from then on |
|---|---|---|
| Edits a bullet before approving | The new wording as an alternate bullet, tagged with the kind of job | Offered for similar jobs |
| Makes the same kind of edit twice, like "Built" to "Led" | A suggested rule, with the two edits as the reason | After he accepts it, applied to every resume |
| Rejects a claim | A never-print rule with his words as the reason | Checked by code on every resume |
| Settles a question, like "keep one title across variants" | A dated decision | Never asked again |
| Adds a new fact, like a Latch benchmark | An `unverified` fact with a source link | Printable once he marks it verified |
| Gets replies from some resumes and not others | Reply rate per bullet and per entry | Shown to the planner as a soft preference, never a rule |

Nothing is learned silently. Suggestions wait on the Knowledge page until he accepts or dismisses them, and every change to the knowledge base is logged with who made it and why.

**`rules.md` stays the human-readable view.** The knowledge base exports back to Markdown, so the resume advisor and Sashreek can still read the rules in one file.

## 6. Data in Firebase

### Where the data lives

![Firestore layout](images/firestore-layout.png)

| Firestore path | Holds | Why this shape |
|---|---|---|
| `profile/main` | Every fact about him that a form can ask for | One document, read once per run. |
| `memory/{questionKey}` | Answers he gave before | The ID is a hash of the normalized question, so the same question always maps to one document. |
| `jobs/{jobKey}` | A posting, its filter result and its triage | The ID comes from the posting, so collecting twice updates instead of duplicating. |
| `applications/{jobKey}` | Stage, form, answer sheet, lease, submit markers, notes | Same ID as the job, so there is at most one application per posting. |
| `applications/{jobKey}/events/{eventId}` | Every stage move: from, to, by, when, detail | Append-only history. |
| `questions/{questionId}` | One question for one field of one application, with `status` open or answered | The Today page lists the open ones. Answering one also writes to `memory` when he ticks "remember". |
| `runs/{runId}` | One pipeline or agent run, with counts and errors | The dashboard shows when a source failed. |
| `kb/bases/items/{baseId}` | A base resume: template, bullets in order, skill rows, the source `.tex`, and whether it is active | Switching the active base is one write, and each resume records which base it used. |
| `kb/facts/items/{factId}` | A fact about him: claim, numbers, source, status, entry it belongs to | Status decides whether it can be printed. |
| `kb/bullets/items/{bulletId}` | An approved resume wording, its fact IDs, its entry, the kinds of job it suits, its measured line count | Alternates for the same entry sit side by side. |
| `kb/rules/items/{ruleId}` | A constraint, must-survive item or never-print item, with the reason and how to apply it | Code checks every resume against these. |
| `kb/decisions/items/{decisionId}` | A call he made, dated, with his words | The planner reads these so settled questions stay settled. |
| `kb/suggestions/items/{id}` | Something scout learned but he hasn't confirmed: a new rule, bullet or fact | The Knowledge page lists these for accept or dismiss. |
| `kb/log/items/{id}` | Every change to the knowledge base: what, who, why | So he can see how scout's picture of him changed. |
| `applications/{jobKey}/resume/{version}` | The base it came from, the plan, the rendered `.tex`, the PDF as base64, check results, the diff against that base, and approval | Each edit makes a new version. The agent uploads the approved one and checks its hash. |
| `renderRequests/{id}` | A request to re-render a resume after he edits it | The render worker on his Mac picks these up. |
| `config/agent` | `paused`, `dailyCap`, `finalClick`, `autoQueueScore`, `maxTriagePerRun` | He can pause scout from his phone. |
| `counters/{date}` | Applications submitted that day | The claim transaction checks it against `dailyCap`. |

Conventions:

- Times use Firestore server timestamps.
- Stages and enums are stored as lowercase strings, like `needs_answers`.
- Posting text is capped at 50 KB, well under Firestore's 1 MiB document limit.
- A stage change and its event are written in the same batch, so the history is never missing a move.

### Security rules

The pipeline and the agent use the Firebase Admin SDK with a service account, which skips security rules. So the service account key is the most sensitive secret in the project. It lives only in GitHub Actions secrets and in the Mac's `.env`.

The dashboard uses the web SDK and goes through the rules:

- Every request has to come from his Google account's user ID.
- The dashboard can't write `lease`, `submitAttemptAt`, `submittedAt` or anything in `counters`. Those belong to the agent.
- The dashboard can move an application only along the moves a person makes: answer, approve, skip, retry, and the stages after applying.

### Staying inside the free quotas

From the [Firebase pricing page](https://firebase.google.com/pricing), the [Storage FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Vercel's Hobby plan](https://vercel.com/docs/plans/hobby) and [GitHub's Actions billing page](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions), checked November 5, 2026.

| Service | Free amount | What we expect to use |
|---|---|---|
| Firestore, Spark plan | 50,000 reads, 20,000 writes and 20,000 deletes a day, 1 GiB stored | The daily run reads about 800 job documents and writes 50 to 150. Dashboard use adds a few hundred reads. |
| Firebase Storage | Not available on Spark | Not used in the first version. |
| Firebase Auth | 50,000 monthly active users on Spark | One. |
| Vercel Hobby | Personal, non-commercial projects | The dashboard. No Vercel cron is used. |
| GitHub Actions, private repo | $12 of compute a month, about 2,000 minutes of a 2-core Linux runner | One run a day of about 5 minutes, so about 150 minutes a month. Without a card on file, GitHub blocks usage at the limit instead of billing. |

GitHub can delay a scheduled run, or drop it when load is high. A missed run costs nothing, because the next run picks up everything the missed one would have found.

The Claude API is not free. This is an estimate, not a measurement:

| Work | Volume | Tokens per call | Cost a month |
|---|---|---|---|
| Triage | 15 to 30 new postings a day after the code filters | 1,500 new input, 3,000 cached, 500 output | About $8 to $15 |
| Answer planning | 5 to 10 applications a day | 6,000 input, 1,500 output | About $8 to $17 |
| Resume tailoring | 5 to 10 applications a day, up to 3 tries each | 4,000 new input, 20,000 cached knowledge base, 3,000 output | About $15 to $35 |
| Browser fallback | Rare | Varies | Small |

That makes about $30 to $70 a month at full use, plus about $5 once for the first backlog. Tailoring is the biggest line, because it runs at high effort. If that is too much, the levers are Claude Haiku 5.5 for triage, at $0.10 per million input tokens, or the Batches API at half price, since triage doesn't need an answer right away. Set a monthly spend limit in the Anthropic Console either way.

Setup steps:

1. Create the Firebase project on Spark, with Firestore in the Standard edition.
2. Turn on Google sign-in and put his user ID in `firestore.rules`.
3. Create a service account key. Store it as a GitHub Actions secret and in the Mac's `.env`, and nowhere else.
4. Create the Vercel project with the Firebase web config, which is public and not a secret.
5. Create the Discord webhook and store its URL as a secret.
6. Set a monthly spend limit on the Anthropic API key.

## 7. One job, front to back

Northwind Robotics, a made-up company with a Greenhouse board, posts a Software Developer Intern role in Toronto for Winter 2027.

### Step 1. The daily run finds it, triages it and plans the answers

![Sequence diagram: the daily run](images/daily-run.png)

At 7:00 the pipeline downloads both GitHub lists and polls the boards it knows. The Northwind posting is new, it's in Canada, it's a software role, the term matches, and Northwind isn't on the excluded list. So it reaches triage, which returns `apply` with a score of 82 and says his backend work should lead. That is above the auto-queue score, so the application goes to `queued`.

The tailoring step builds Northwind's resume from the active base, v6. The posting asks for Go, Kubernetes, Prometheus and Grafana. Kubernetes has no project behind it, so no bullet claims it, though it stays in Technical Skills as it is in v6. mint moves above Replay, and mint's observability bullet replaces the SDK bullet because the job is platform reliability. Two bullets are reworded to use "platform" where they said "service". The page compiles to exactly one page and every check passes on the first try.

The pipeline reads the form from Greenhouse's API. It has 14 fields:

- 11 come straight from the profile.
- "How did you hear about us?" comes from memory.
- "Why Northwind?" is drafted by Claude for him to edit.
- "Are you available for in-person interviews in Toronto?" isn't in the profile or memory, so it becomes a question.

The application moves to `needs_answers`, and the digest tells him one question is waiting.

### Step 2. He answers and approves, then the agent applies

![Sequence diagram: answering, approving and applying](images/apply.png)

He answers "Yes" on his phone and ticks "remember", so no form will ask him that again. With no questions left, the application moves to `review`. He opens the resume tab, sees the diff against v6 and the source of each bullet, and changes "Built 2 Grafana dashboards" to "Tracked reliability on 2 Grafana dashboards". scout saves that wording as an alternate bullet for platform jobs. He approves the resume, rewrites one sentence of the essay and approves the sheet.

That evening he starts the agent on his Mac. It claims the application, opens the form, fills it, attaches Northwind's approved resume after checking its hash, reads every value back and submits. Greenhouse shows its confirmation page, the stage becomes `applied`, and Discord says "Applied: Northwind Robotics".

If the form had changed since the morning, with a new required field, the agent would have stopped before submitting and sent the application back to `needs_answers` with a new question.

### Step 3. After applying

Two weeks later a CodeSignal invite arrives. In phase 3 the mail watcher matches it to the Northwind application and moves it to `assessment` with the deadline from the email. Until then he moves it himself on the board.

Across the three steps, Claude made two decisions, tailored one resume and drafted one paragraph. Everything else was plain code he can test, and nothing was submitted without his approval.

## 8. When things go wrong

| What happens | What scout does |
|---|---|
| A source is down or changes its format | Zod rejects the bad data. That source is logged as failed in the run, and the other sources carry on. The digest names the failed source. |
| A posting disappears before applying | The reader or filler gets a 404 or a "no longer accepting" page. The application moves to `closed`. |
| The form gained a field since planning | The agent stops before submitting and asks a new question. |
| CAPTCHA or login wall | The stage becomes `needs_hand`, Discord pings him, and the browser stays open for 15 minutes so he can finish by hand. |
| The browser or the Mac crashes mid-fill | The lease runs out and the application goes back to `approved`. Nothing was submitted, because Submit is the last step. |
| A crash between clicking Submit and seeing the confirmation | `submitAttemptAt` is set, so a retry goes to `needs_hand` instead of submitting again. He checks his email and confirms. |
| Claude refuses or errors | Fallback reruns a refused call on another model. If the final answer is still a refusal, or the API errors after the SDK's retries, the job stays untriaged for the next run. |
| A tailored resume won't fit on one page | Claude gets three tries with the failing checks. Then he gets a choice question listing the bullets that could go. |
| A resume uses a number with no printable fact behind it | The check fails, the number is named, and that version can't be approved. |
| He edits a resume while his Mac is off | The re-render waits in `renderRequests` until the Mac worker or the next daily run picks it up. |
| scout misbehaves | He sets `paused` in the dashboard. The agent checks it before every claim. |

## 9. Working in the codebase

### Folder layout

```text
scout/
├── apps/
│   ├── pipeline/                  the daily job GitHub Actions runs
│   │   └── src/
│   │       ├── main.ts            one run: collect, filter, triage, plan, digest
│   │       └── steps/             one file per step
│   ├── agent/                     the Mac runner that fills applications
│   │   └── src/
│   │       ├── main.ts            claims approved applications and fills them
│   │       ├── fillers/           GreenhouseFiller, LeverFiller, AshbyFiller
│   │       └── readers/           AshbyPageReader, the reader that needs a browser
│   └── web/                       Next.js dashboard
│       └── app/                   today, board, jobs, applications/[id], profile, stats
├── packages/
│   ├── core/                      plain code, no network
│   │   ├── schemas/               Zod schemas: Listing, Job, Application, FormSpec, Sheet, Question, Profile
│   │   ├── stages.ts              the stages and the allowed moves
│   │   ├── filters.ts             Canada, role, term, values, eligibility, already applied
│   │   ├── keys.ts                job keys and content hashes
│   │   ├── planner.ts             the rules and memory passes of the answer planner
│   │   ├── resume/                plan schema, template renderer, the pre-flight checks
│   │   ├── kb/                    knowledge base schemas, matching, suggestion rules
│   │   └── ports.ts               JobSource, FormReader, FormFiller, Store, Notifier, Llm
│   ├── adapters/                  code that talks to the outside world
│   │   ├── sources/               GitHubListSource, GreenhouseSource, LeverSource, AshbySource
│   │   ├── readers/               GreenhouseApiReader, LeverPageReader
│   │   ├── store/                 FirestoreStore
│   │   ├── notify/                DiscordNotifier
│   │   └── llm/                   ClaudeTriage, ClaudePlanner
│   └── testkit/                   InMemoryStore, FakeLlm, saved feeds, forms and job descriptions
├── firebase/                      firestore.rules, firestore.indexes.json, firebase.json
├── profile/                       seed files, imported into Firestore once
├── resume/                        base resume templates and the knowledge base seed importer
├── sources/                       sources.yaml and boards.yaml
├── .github/workflows/             daily.yml runs the pipeline, ci.yml runs the tests
└── docs/                          this file, PLAN.md, diagrams/ (draw.io sources), images/ (PNGs)
```

Fillers that need Playwright live in `apps/agent`, so the pipeline and the dashboard never install a browser.

### Naming

| Kind | Pattern | Folder | Example |
|---|---|---|---|
| Schema and type | `XSchema` and `X` | `packages/core/schemas` | `JobSchema`, `Job` |
| Job source | `XSource` | `packages/adapters/sources` | `LeverSource` |
| Form reader | `XApiReader` or `XPageReader` | `adapters/readers`, or `apps/agent/src/readers` if it needs a browser | `GreenhouseApiReader` |
| Form filler | `XFiller` | `apps/agent/src/fillers` | `AshbyFiller` |
| Port | A plain noun | `packages/core/ports.ts` | `FormReader` |
| Fake for tests | `InMemoryX` or `FakeX` | `packages/testkit` | `InMemoryStore` |
| Saved test data | `{board}/{case}.json` or `.html` | `packages/testkit/fixtures` | `greenhouse/tribalscale-form.json` |
| Pipeline step | A verb | `apps/pipeline/src/steps` | `triage.ts` |
| Test | The file under test plus `.test.ts` | Next to the file | `filters.test.ts` |
| Stage | Lowercase with underscores | `stages.ts` | `needs_answers` |

### Adding a job source

Example: a new GitHub list of Canadian co-ops.

1. Add it to `sources/sources.yaml`.
2. Write `XSource` in `packages/adapters/sources`. It returns `Listing[]` and validates the raw data with Zod.
3. Save a real copy of its data in `testkit/fixtures` and test that the source turns it into the right listings.
4. Run the pipeline locally against the Firestore emulator and check the digest.

### Adding a job board to apply on

Example: Workable.

1. Write the reader. Use a public API if the board has one, the page HTML if the form is there, or a page reader in the agent if it only exists in the browser.
2. Write the filler in `apps/agent/src/fillers`. Start from `GreenhouseFiller`. Standard fields get fixed selectors. Custom fields are found by label.
3. Teach the filler to recognise the board's confirmation page.
4. Save the form as a fixture. Test the reader against the fixture. Test the filler against a saved copy of the page loaded in Playwright, never the live site.
5. Do five applications with `finalClick: hold` and check each one by hand before switching to `auto`.
6. Add the board to the table in section 5.

### Adding a profile field

Example: "Willing to work night shifts".

1. Add it to `ProfileSchema` with a default, so older documents still load.
2. Add a rule in `planner.ts` if a common question maps to it.
3. Add it to the Profile page.
4. Add it to `profile/profile.example.yaml`.

### Adding a stage

1. Add it to `stages.ts` with its allowed moves in and out.
2. If the dashboard may make the move, allow it in `firestore.rules`.
3. Add a column to the Board page.
4. Update the stage diagram and the table in section 3.

### Changing security rules

Change `firebase/firestore.rules` in the same pull request as the feature that needs it. Test against the Firebase emulator. A wrong rule either blocks the dashboard or lets it write fields that belong to the agent.

### Editing the diagrams

The sources are in `docs/diagrams/` as `.drawio` files. Open one at app.diagrams.net or in the draw.io desktop app, edit it, and export a PNG at 200% zoom into `docs/images/` with the same name.

## 10. Build order and open questions

The backend is broken into user stories with acceptance criteria, as GitHub issues #1 to #26. Issue #27 is the roadmap that tracks them by phase.

| Phase | What gets built | Done when |
|---|---|---|
| 0 | Repo layout, schemas, profile import, Firebase project and rules | `profile/main` is in Firestore and he has checked every field |
| 1 | Sources, filters, triage, the daily digest, the dashboard's Jobs, Board and Profile pages | A week of digests where he agrees with the picks |
| 2 | Knowledge base and its seed import, per-job resumes with checks, the Knowledge page, Greenhouse and Lever readers, the planner, the questions flow, the agent with Greenhouse and Lever fillers, `finalClick: hold` | 10 real applications with no wrong answers, each with a tailored resume he approved without rewriting more than one bullet |
| 3 | Ashby, then Workday with accounts he creates, the mail watcher, Stats | 10 more with no wrong answers, and stages that update from email |
| 4 | `finalClick: auto` for boards with a clean record, more boards | His call after reading the phase 3 logs |

Open questions:

1. When should `finalClick` move from `hold` to `auto`, and should that be decided per board?
2. Is $15 to $35 a month for Claude acceptable, or should triage move to Haiku 5.5 or the Batches API?
3. Should the daily cap stay at 10?
4. For the mail watcher: sign in again every 7 days, or publish the Google OAuth app as an unverified personal app?
5. Is he already registered in the Science Internship Program? Some forms ask, and the profile needs the answer.
6. Should v7 become the active base before the knowledge base is seeded? Switching later is supported either way.
7. Should cover letters use the same knowledge base and checks in a later phase?
