# How scout gets built: testing and the git workflow

Sashreek Addanki · November 5, 2026

> AI use: Claude Opus 5.5 (Anthropic), through Claude Code, drafted this page on November 5, 2026 from the architecture in `docs/architecture.md`. Sashreek's review is pending.

scout fills in job applications under his name, so a bug isn't an annoyance: it can send a wrong answer to an employer. This page says how every change gets tested and how work moves from an issue to `main`. It applies to every change, whoever writes it, Claude included.

## 1. What has to be true before anything ships

- Every acceptance box on the issue is ticked.
- `pnpm check` passes: types, lint and every test.
- A change to a prompt, a schema Claude fills, or a default model has an eval report that is no worse than `main`.
- A change to a filler has passed a dry run on real postings for that board.
- Sashreek has approved the pull request.

## 2. Testing, layer by layer

Most bugs in scout would come from four places: a job board changing its format, two agents racing, a model giving a confident wrong answer, and a crash at the wrong moment. Each layer below targets at least one of them.

| Layer | Tool | What it covers | When it runs |
|---|---|---|---|
| Types and lint | TypeScript strict, ESLint, Prettier | Shapes shared by every app, and unused or unsafe code | Every save, every pull request |
| Schemas | Zod | Feed data, Firestore documents, Claude's output and the server protocol are rejected if malformed | At runtime, and in every test that loads data |
| Unit | Vitest | `packages/core`: the stage machine, filters, job keys, the planner's rules pass, the resume pre-flight checks, the permission guard | Every pull request |
| Property | fast-check with Vitest | The stage machine never allows a move outside its table, job keys are stable, collecting twice never duplicates | Every pull request |
| Fixtures | Vitest with saved files | Each source and form reader against saved real feeds and pages. Tests never call a live job board. | Every pull request |
| Firestore | Firebase emulator, `@firebase/rules-unit-testing` | Security rules allow only his account and only the writes each client may make. The claim transaction with 8 agents and a cap of 5 submits exactly 5. | Every pull request |
| Workflows | Temporal's test environment with time skipping | Supervisor limits, one workflow per job key, live-question timeouts, resume after a killed worker, submit never retried | Every pull request |
| Browser | Playwright against a local fake job board | Fillers and read-back on saved forms and on built edge cases: autocomplete, file upload, multi-page forms, a CAPTCHA appearing, a field added after planning | Every pull request |
| Server | Vitest with a real WebSocket | Event order, reconnect with sequence numbers, each command run exactly once | Every pull request |
| Dashboard | Testing Library, Playwright, axe | Components; the answer, approve, live question and take-over flows against the emulator with seeded data; accessibility | Every pull request |
| Screens | Playwright screenshots | Key screens compared against approved baselines taken from the Figma designs, so a layout regression is caught | Every pull request that touches `packages/ui` |
| Mac app | Playwright for Electron | The app starts, the server child starts and restarts, the page has no Node access | Every pull request that touches `apps/desktop` |
| AI quality | `pnpm eval` (#57) | Triage agreement, zero wrong factual answers, resume checks | Pull requests that change prompts, schemas Claude fills or default models |
| Dry runs | The real agent in dry-run mode | 5 real postings per board, filled and read back, never submitted, checked by hand | Before a board leaves dry run, and after a filler change |

### Rules that keep the tests honest

- **A bug gets a failing test first.** Every fix starts with a test that reproduces it, so the same bug can't come back.
- **No live job boards in CI.** A monthly manual job, `pnpm fixtures:refresh`, downloads fresh samples of each feed and form. If any changed, it opens a pull request, so format changes show up as a diff instead of a failed application.
- **Fakes, not mocks, at the edges.** `packages/testkit` has an in-memory store, a fake Claude with recorded responses, and the fake job board. Tests use the same ports as production code.
- **Coverage where it matters.** `packages/core` stays above 90% of lines. Elsewhere, every acceptance criterion has a test, and the percentage isn't chased.
- **Time and randomness are injected.** Pacing, leases, timeouts and IDs take a clock and a random source, so tests are exact.

### Safety nets in production

Tests can't catch everything, so production has its own stops, all from the architecture:

- The guard hook refuses any typed value that isn't on the approved sheet.
- The submit marker stops a double submission after a crash.
- The daily cap and the pause switch limit how much can go wrong in one day.
- **One wrong factual answer sends that board back to dry run automatically**, and the Runs page shows why.

## 3. The git workflow

### Branches

- `main` is always working. Once the first line of code lands, nothing reaches `main` except through a pull request with green checks. Branch protection enforces it; his account has GitHub Pro, which private repositories need for it.
- One branch per issue, cut from `main` and kept short, a few days at most: `feat/37-temporal-supervisor`, `fix/112-lever-location-field`, `docs/…`, `chore/…`.
- Before merging, the branch is rebased on `main` so the history stays straight.

### Commits

- Small and complete: each commit builds and passes `pnpm check` on its own.
- Conventional Commits, so the changelog writes itself: `feat(agent): claim with a per-company check`, `fix(planner): …`, `test(rules): …`, `docs: …`, `chore: …`.
- The body says why, not what, and ends with `Refs #37`. AI-assisted commits carry a `Co-Authored-By` line naming the model.
- No secrets, ever. `.env.example` lists what's needed, and a secret scanner runs in CI.

### Pull requests

- A template copies the issue's acceptance criteria as a checklist, and asks how it was tested, for screenshots when the UI changed, and for the eval report when a prompt changed.
- The pull request closes its issue with `Closes #37`, and the roadmap box in #27 is ticked when it merges.
- Review: the author reviews the diff first, then runs a code review pass, then Sashreek approves. Claude never merges its own pull request without his approval.
- Squash merge, so `main` has one commit per issue.

### Continuous integration

| Trigger | Runs |
|---|---|
| Every pull request | Install with the pnpm cache, typecheck, lint, unit, property, fixture, emulator, workflow, Playwright and server tests, then build the web and desktop apps |
| Pull requests that change prompts, schemas Claude fills or default models | Evals, reported as a comment on the pull request |
| Merge to `main` | Vercel deploys the dashboard to production |
| A tag like `v0.2.0` | Creates a GitHub Release with the changelog. The Mac app is built on his Mac, not in CI, because it isn't signed for distribution |
| Every night | The Firestore backup from #58 |
| Every morning | The pipeline |

### Environments

- **Local:** the Firebase emulator with seeded data, the fake job board, and recorded Claude responses. `pnpm dev` starts all of it.
- **Development:** a Firebase project, `scout-dev`, on the free plan. Vercel preview deployments for pull requests point here.
- **Production:** `scout-prod`, used only by `main`, the morning run and the Mac app.
- Data shape changes ship with a versioned migration script, which takes a backup first.

### Releases

Each phase milestone ends with a tag: `v0.1.0` when phase 1 is done, and so on. The changelog comes from the commit messages. He updates the Mac app with `pnpm desktop:update`, which pulls `main` and rebuilds it locally.

## 4. How Claude works an issue

1. Read the issue, its dependencies and the architecture sections it links to.
2. Create the branch.
3. Turn each acceptance criterion into a failing test.
4. Write the code until the tests pass, committing in small steps.
5. Run `pnpm check`, and the evals or a dry run if the change calls for them.
6. Update `docs/architecture.md` in the same pull request if the design changed.
7. Open the pull request with the template filled in, and wait for Sashreek's review.
8. After approval and the merge, tick the box on the roadmap.

If an issue turns out to be wrong or too big, Claude stops and says so on the issue instead of quietly changing its scope.
