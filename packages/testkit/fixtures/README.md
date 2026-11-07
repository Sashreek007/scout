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
| `board/boards-api.greenhouse.io/v1/boards/tribalscale/jobs.json.gz` | TribalScale's Greenhouse board, 15 postings | `boards-api.greenhouse.io/v1/boards/tribalscale/jobs?content=true`, 2026-11-07 03:25 UTC |
| `board/api.lever.co/v0/postings/eqbank.json.gz` | EQ Bank's Lever board, 82 postings | `api.lever.co/v0/postings/eqbank?mode=json`, 2026-11-07 03:25 UTC |
| `board/api.ashbyhq.com/posting-api/job-board/cohere.json.gz` | Cohere's Ashby board, 124 postings | `api.ashbyhq.com/posting-api/job-board/cohere?includeCompensation=true`, 2026-11-07 03:25 UTC |

The three boards were downloaded once with `curl`, sending scout's user agent, and saved byte for byte before gzipping. The board APIs only serve what is posted today, so these can't be taken from a past date: issue #6 asked for 2026-11-05 copies, and these are the closest. Tests never download them again.

## Synthetic

Northwind Robotics is the made-up company from `docs/architecture.md`, section 7. Its Greenhouse board, form and apply page, the Claude recordings and the `FakeLlm` recordings are all invented. Real form copies arrive with the reader stories (#14, #15).
