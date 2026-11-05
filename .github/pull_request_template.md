<!--
Title: a Conventional Commit, like "feat(agent): claim with a per-company check".
Pull requests are squash merged, so the title becomes the commit on main. CI checks it.
-->

Closes #

## What changed and why

## Acceptance criteria

<!-- Copy every box from the issue. Tick the ones this pull request meets; for any left open, say why and where it will be done. -->

- [ ]

## How it was tested

<!-- The test that proves each criterion, and anything checked by hand (a dry run, the emulator, a screen). -->

- [ ] `pnpm check` passes
-

## Screenshots

<!-- Required when the UI changed: before and after. Delete this section otherwise. -->

## Eval report

<!-- Required when a prompt, a schema Claude fills or a default model changed: `pnpm eval` on this branch against main (#57). Delete this section otherwise. -->

## Checklist

- [ ] Small Conventional Commits, each passing `pnpm check`, ending with `Refs #n`
- [ ] A bug fix starts with a test that failed before the fix
- [ ] `docs/architecture.md` updated if the design changed
- [ ] Security rules and their tests changed here if this feature needs them
- [ ] No secrets or personal data; `.env.example` lists any new variable
