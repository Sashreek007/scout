# scout

An agent that finds Canadian internship postings from public GitHub lists and job-board feeds,
applies on each company's own site from a structured profile, and asks the candidate when unsure.

Status: phase 0, the foundation. The design is in `docs/architecture.md`, and how changes are
tested and land is in `docs/workflow.md`. The roadmap is issue #27.

```bash
pnpm install
pnpm check   # type check, lint, format and every test, as CI runs it (needs Java 21+)
pnpm dev     # Firestore emulator with seed data, the fake job board and the fake Claude API
```
