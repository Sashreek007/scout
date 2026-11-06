# Fixtures

Saved responses that tests and `pnpm dev` read instead of calling a job board or Claude.

| Folder | Holds | Served by |
|---|---|---|
| `board/{host}/{path}` | Job-board feeds, form APIs and apply pages, saved under the real host and path | `startFakeJobBoard` |
| `claude/` | Recorded Messages API replies, each with the text a request must contain | `startFakeClaude` |
| `llm/recordings.json` | Triage and plan results by job key | `FakeLlm.recorded()` |

A fixture saved as `name.gz` is served decompressed, so large real files stay small in git. Tests can also script a path's next responses (redirects, outages, slow replies) with `board.script(...)`.

## Real copies

| Fixture | Source | Saved from |
|---|---|---|
| `board/raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json.gz` | The SimplifyJobs Summer 2027 list, 17,653 rows | commit `f084d89`, the last before the end of 2026-11-05 UTC |
| `board/raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json.gz` | The vanshb03 Summer 2027 list, 3,021 rows | commit `267766a`, the last before the end of 2026-11-05 UTC |

## Synthetic

Northwind Robotics is the made-up company from `docs/architecture.md`, section 7. Its Greenhouse board, form and apply page, the Claude recordings and the `FakeLlm` recordings are all invented. More real copies, like the tribalscale Greenhouse board, arrive with the board and reader stories (#6, #14).
