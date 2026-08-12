---
description: Implement FamilyFlow test-first with bounded review and fast correction
argument-hint: "<task>"
---

Orchestrate this FamilyFlow implementation and review workflow for: $ARGUMENTS

All subagent calls use `agentScope: "project"` and `confirmProjectAgents: false`. Do not edit files in the parent agent.

## Initial implementation

Use `subagent` chain mode:

1. `scout` investigates relevant code, tests, documentation, and operations.
2. `planner` uses the original task and `{previous}` handoff.
3. `test-writer` creates focused tests and proves the expected Red state.
4. `implementer` uses the test handoff, implements the smallest change, runs focused verification, updates documentation, and creates small green Conventional Commits.

Stop if the chain fails.

## Bounded review

Run `reviewer` once against the original task and worktree.

- `PASS`: continue to final verification.
- `CHANGES_REQUESTED`: run one implementer correction for all Critical and Warning findings, then review again.
- After the first correction review, run a second correction only when the report contains a non-empty `## Critical` section. Warnings and Suggestions alone do not trigger a second correction.
- Never run a third correction.
- Correction reviews are limited to prior finding classes and concrete regressions introduced by corrections.

## Final verification and commit

After review completion, use `implementer` once for finalization. It must run `pnpm verify` exactly once, plus only applicable conditional gates (`pnpm test:postgres`, Docker build/smoke, migrations, backup/restore). If all pass, update documentation as needed and create the final Conventional Commit. Do not squash, rebase, or push. Before an eventual push, the same full and conditional gates must be rerun.

Return a concise workflow summary, commits, final reviewer verdict, final verification, and unresolved findings.
