# scout: plan

> Superseded in detail by `docs/architecture.md` (Nov 5, 2026): TypeScript monorepo, pipeline on GitHub Actions,
> profile and answers in Firestore, agent on the Mac. Where the two differ, architecture.md wins.

## 1. Goal

Find internship and co-op postings in Canada from public sources, decide which ones fit Sashreek,
apply on the company's own careers site with accurate answers from his profile, and message him
whenever a question cannot be answered from the profile. LinkedIn is not used at all.

## 2. Job sources (verified 2026-11-05)

### GitHub internship lists (primary)

Both repos publish a machine-readable `listings.json`, so no HTML scraping is needed.

| Repo | File | Active Canada listings |
| --- | --- | --- |
| SimplifyJobs/Summer2027-Internships | `.github/scripts/listings.json` (branch `dev`) | 473 |
| vanshb03/Summer2027-Internships | `.github/scripts/listings.json` (branch `dev`) | 289 |

- About 134 jobs appear in both lists, so the two together give roughly 520 unique Canadian postings.
- Fields used: `company_name`, `title`, `locations`, `url`, `active`, `is_visible`, `date_posted`,
  `terms` (Simplify) or `season` (vansh), `category`, `sponsorship`.
- Simplify Canada terms include Winter 2027 (130), Summer 2027 (138), Fall 2026/2027, and many N/A.
- vansh URLs are short links (`go.vansh.nyc/...`) that must be resolved to the real apply URL.
- `SimplifyJobs/New-Grad-Positions` has 158 Canadian rows. It is out of scope for now.

### ATS job-board feeds (secondary)

These are public JSON endpoints with no login. They catch postings before the GitHub lists add them,
plus roles the lists skip.

| ATS | Endpoint | Tested with |
| --- | --- | --- |
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | tribalscale: 15 jobs, Toronto |
| Lever | `https://api.lever.co/v0/postings/{company}?mode=json` | eqbank: 82 jobs |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` | cohere: 118 jobs |

**The company list builds itself.** Every GitHub listing whose URL is on Greenhouse, Lever or Ashby
reveals that company's board token. scout stores those tokens in `sources/boards.yaml` and polls each
board daily, so it learns new companies as the lists grow. He can also add companies by hand.

## 3. Where the applications actually live

Apply URLs of the 473 active Canadian Simplify listings, by application system:

| System | Listings | Account needed to apply |
| --- | --- | --- |
| Workday | 210 | Yes, one per company |
| Other or custom | 67 | Varies |
| Greenhouse | 53 | No |
| Eightfold | 34 | Usually no |
| iCIMS | 30 | Usually yes |
| Ashby | 18 | No |
| Lever | 15 | No |
| Oracle, Workable, SuccessFactors, SmartRecruiters, Taleo, BambooHR | 44 | Mixed |

This drives the phase order. Greenhouse, Lever and Ashby are simple one-page forms with no account,
so they come first. Workday is the biggest group but needs an account per company plus email
verification, so it comes later and he creates those accounts himself.

## 4. Architecture

```
daily scheduler
      │
      v
collect ──> normalize + dedupe ──> hard filters ──> triage (Claude) ──> digest to chat
(GitHub lists,  (one record per        (code rules,     (fit score +          │
 ATS feeds)      company + title)       section 6)       reason)               v
                                                                     he picks / auto-queue
                                                                               │
                                                                               v
                                         apply agent (Claude + Playwright, one job at a time)
                                                  │                    │
                                           ask-human bridge      submit gate
                                           (chat question,       (summary + Approve/Skip)
                                            answer saved)              │
                                                                       v
                                                Firestore + Storage ──> CRM dashboard (Vercel)
```

### Components

1. **Collectors.** One small module per source, each returning the same `Job` record
   (source, company, title, locations, terms, url, ats, posted_at). Pure HTTP, no browser.
2. **Normalize and dedupe.** Key on company plus normalized title. Resolve vansh short links.
   Tag each job with its ATS from the URL.
3. **Canada filter.** Match city, province code, or "Canada" in the location strings. Mark
   Edmonton/Alberta and remote-in-Canada as preferred.
4. **Hard filters (code, section 6).**
5. **Triage.** One Claude call per new posting: job text plus profile in, structured
   apply / skip / maybe with a reason and the resume variant to use. New jobs only, so this stays cheap.
6. **Digest.** One chat message a day: new matching jobs, grouped by ATS, with tap-to-queue.
7. **Apply agent.** Playwright with a persistent browser profile, driven by Claude through a small tool
   set: `read_form`, `fill_field`, `select_option`, `upload_file`, `click`, `ask_human`, `skip_job`.
   Reads the DOM as text; screenshots go to the log only.
8. **Ask-human bridge.** Sends the question, company, role and field. That job pauses while others
   continue. His reply is saved to `profile/answers.yaml` and reused.
9. **Submit gate.** Stops on the final screen and sends a summary of every answer for Approve or Skip.
   A CAPTCHA also pauses the job and hands it to him; the agent never tries to solve one.
10. **Log.** Firestore: job, decision, answers given, questions asked, status, timestamps (section 7).

## 5. The profile

- `profile/profile.yaml`: hard facts for every form field (gitignored).
- `profile/answers.yaml`: answers to questions he has already been asked.
- Resumes: PDFs per role type, chosen by triage.
- Free-text questions ("why this company") are drafted from the profile and posting, then sent to
  him for approval. Nothing outside the profile gets stated as fact.

## 6. Hard filters

- **Location:** Canada only (remote-in-Canada counts).
- **Role:** software, AI/ML/data, DevOps/platform. Skip hardware, analog design, quant, sales.
- **Term:** must match his availability (set in profile).
- **Values:** skip defence, weapons, surveillance and policing-data employers. This is not optional:
  General Dynamics postings are already in the Canadian list today.
- **Eligibility:** skip postings that need Canadian citizenship or PR, or that are SWPP or FSWEP funded.
- **Already seen or applied:** skip.
- **Volume:** daily apply cap, starting at 10.

## 7. Application tracker (CRM)

**Stack:** Next.js dashboard on Vercel, Firebase for the backend.
- **Firestore** is the single source of truth for jobs, applications, stage history, questions and answers.
- **Firebase Storage** holds screenshots, posting snapshots and the exact resume PDF sent.
- **Firebase Auth** with Google sign-in. Security rules allow his user ID only, because the records hold
  his phone, work authorization and every answer he gave.
- The agent writes with the Firebase Admin SDK using a service account key kept in `.env` on the machine
  that runs it. The dashboard never holds that key.
- The free Spark tier covers this volume, about tens of writes a day.

**Bonus: approvals from the phone.** Because the dashboard is online, the Approve/Skip step and the
answers to the agent's questions can happen in the dashboard as well as in chat. The agent watches
Firestore for his decision.

**Collections:** `jobs` (deduped postings), `applications` (one per job applied or queued, with a
`stages` subcollection), `questions` (pending and answered, feeding `answers.yaml`), `runs` (agent run logs).

**Pipeline stages:** found, queued, needs-answer, ready-to-submit, applied, assessment, interview,
offer, rejected, withdrawn, skipped (with reason).

**What each application record holds:** company, role, location, term, source, ATS, apply URL,
posting text snapshot (postings disappear), resume version sent, every answer submitted, date applied,
current stage, stage history with dates, contacts, notes, next action and due date.

**Views:**
- Board: one column per stage, a card per application.
- Today: jobs waiting on him (questions, approvals, CAPTCHAs, assessments due).
- Stats: applied per week, response rate, response rate by source, ATS and resume version.

**Status updates from email (phase 3+).** Read his Gmail for messages from employers he applied to:
assessment invites (CodeSignal, HackerRank), interview requests, and rejections. Move the stage
automatically for clear cases, ask him for unclear ones. Read-only access, never sends mail.

**Import the existing tracker.** `~/Documents/resume-eval-agent/applications.md` already holds his
applications since Aug 2026. Import it on day one so scout never re-applies to a company there.

## 8. Phases

| Phase | Deliverable | Done when |
| --- | --- | --- |
| 0 | Profile filled and reviewed | Every standard field has a confirmed answer |
| 1 | Collect, filter, triage, daily digest, tracker dashboard, import of the existing tracker. No applying | Digest runs for a week and he agrees with its picks |
| 2 | Apply on Greenhouse, Lever, Ashby with approve-to-submit | 10 real applications, zero wrong answers |
| 3 | Workday (he creates the account once, scout fills after) and Gmail status updates | 10 Workday applications, zero wrong answers |
| 4 | iCIMS, Eightfold, others; optional auto-submit when no question was asked | His call after phase 3 logs |

Phase 1 is useful on its own: a daily filtered list of Canadian roles that fit him beats checking two
GitHub lists by hand.

## 9. Open decisions

1. Chat app for questions and the digest: Telegram (simplest bot API) or Discord (he has built bots).
2. Language: Python (recommended) or TypeScript.
3. Submit policy in phase 2: approve every submit, or auto-submit when no question was asked.
4. Where it runs: his Mac (simplest, browser profile is local) or an always-on server.
