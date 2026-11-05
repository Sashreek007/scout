# scout

Sashreek's personal agent for Canadian software and AI internships. It finds postings, ranks them, tailors a resume, plans every answer and fills applications on the company's own site, and asks him whenever it doesn't know. It fills forms under his name, so a bug can send a wrong answer to an employer: test accordingly.

Read before changing anything:

- `docs/architecture.md`: the design. Where it and `docs/PLAN.md` differ, architecture wins. Section 9 has the folder layout, naming and how-tos.
- `docs/workflow.md`: how every change is tested and lands. The rules below come from it.
- The issue you're working on, its dependencies, and the roadmap in #27.

## Commands

| Command                                      | Does                                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                               | Installs the workspace. Node 24 (`.nvmrc`), pnpm 10.                                                                                                                         |
| `pnpm check`                                 | Type check, ESLint, Prettier check, then every Vitest suite under the Firestore emulator with coverage. **CI runs exactly this.** Needs Java 21 or newer for the emulator.   |
| `pnpm test:unit`                             | Unit tests only, no emulator. The fast loop.                                                                                                                                 |
| `pnpm test:watch`                            | Unit tests in watch mode.                                                                                                                                                    |
| `pnpm test`                                  | Every suite, unit and `*.emulator.test.ts`, inside `firebase emulators:exec`. Fails if `packages/core` drops below 90% of lines.                                             |
| `pnpm dev`                                   | Firestore and Auth emulators on `demo-scout` with seed data, the Emulator UI on :4000, the fake job board on :4318 and the fake Claude API on :4319. Ctrl-C stops all of it. |
| `pnpm emulators`                             | Only the Firestore and Auth emulators, empty, with the rules in `firebase/`.                                                                                                 |
| `pnpm lint`, `pnpm typecheck`, `pnpm format` | One piece of `pnpm check` each; `format` rewrites files.                                                                                                                     |

## Where things go

- `packages/core`: plain code with no network. Zod schemas in `schemas/`, ports in `ports.ts`, the stage machine in `stages.ts`. ESLint fails any import of Firebase, Playwright, the Anthropic SDK or node networking here, and `fetch`.
- `packages/adapters`: everything that talks to the outside, behind a port.
- `packages/testkit`: `InMemoryStore`, `storeContract` (the tests every `Store` passes), `FakeLlm`, `startFakeJobBoard`, `startFakeClaude`, builders like `aJob()`, `devSeed()`, and `fixtures/`.
- `apps/pipeline`, `apps/agent`, `apps/web`: placeholders until their stories land.
- `firebase/`: `firebase.json` and the rules. `scripts/`: dev and seed scripts.
- `design/`: Figma and diagram generators. Change a script and regenerate; never edit the output by hand (`design/README.md`).

## Rules

- **Never open LinkedIn, Indeed, Glassdoor or Handshake**, from code, a test or a browser tool.
- **No live job boards and no real Claude calls in tests.** Use the testkit fakes and saved fixtures under `packages/testkit/fixtures/{board}/{case}`.
- **Fakes, not mocks**, at the edges: tests use the same ports as production.
- **Inject time and randomness.** Anything with pacing, leases, timeouts or IDs takes a clock and a random source.
- **Every document goes through its Zod schema** on write and read. A new field gets a default so older documents still load.
- **An application's stage changes only through the stage machine**, with its event in the same write.
- **Emulator tests** are named `*.emulator.test.ts`. They refuse to run unless the emulator is up and the project starts with `demo-`.
- **Secrets:** never read, print, log or commit one. `.env` is gitignored and `.env.example` lists every variable with no values (a test enforces it). Never create accounts or cloud projects, and never handle API keys: ask Sashreek.
- **`profile/profile.yaml` holds his real data** and is gitignored. Never commit it, paste it into an issue or pull request, or log it.
- Claude models: Haiku 5.5 (`claude-haiku-5-5`) and Sonnet 5.5 (`claude-sonnet-5-5`) by default, Opus 5.5 (`claude-opus-5-5`) only as a fallback. Settings in `config/models` decide per task.

## How an issue becomes a merged pull request

1. Read the issue, its dependencies and the architecture sections it links.
2. Branch from `main`, one branch per issue: `feat/37-temporal-supervisor`, `fix/112-lever-location-field`, `docs/…`, `chore/…`.
3. Turn every acceptance criterion into a failing test first. A bug fix starts with a test that reproduces it.
4. Write the code in small Conventional Commits (`feat(agent): …`, `fix(planner): …`, `test(rules): …`, `docs: …`, `chore: …`). Each commit passes `pnpm check` on its own. The body says why, ends with `Refs #n`, and an AI-assisted commit ends with a `Co-Authored-By:` line naming the model.
5. If the design changed, update `docs/architecture.md` in the same pull request. A change to the stage table also updates `docs/diagrams/stages.drawio` and section 3.
6. A change to a prompt, a schema Claude fills or a default model needs an eval report no worse than `main` (#57). A filler change needs a dry run on real postings.
7. Open the pull request with the template filled in and `Closes #n`. The title is a Conventional Commit, because squash merging makes it the commit on `main`.
8. Never merge your own pull request. Sashreek reviews and merges. After the merge, tick the issue's box on roadmap #27.

If an issue turns out to be wrong or too big, say so on the issue instead of quietly changing its scope.
