# Fixtures

Saved responses that tests and `pnpm dev` read instead of calling a job board or Claude.

| Folder | Holds | Served by |
|---|---|---|
| `board/{host}/{path}` | Job-board feeds, form APIs and apply pages, saved under the real host and path | `startFakeJobBoard` |
| `claude/` | Recorded Messages API replies, each with the text a request must contain | `startFakeClaude` |
| `llm/recordings.json` | Triage and plan results by job key | `FakeLlm.recorded()` |

Everything here today is **synthetic**: Northwind Robotics is the made-up company from `docs/architecture.md`, section 7. Real saved copies, like the tribalscale Greenhouse board from 2026-11-05, arrive with the source and reader stories (#5, #6, #14) and sit next to these, named `{board}/{case}`.
