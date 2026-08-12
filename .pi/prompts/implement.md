---
description: Execute a fast FamilyFlow test-first implementation workflow
argument-hint: "<task>"
---

Orchestrate this FamilyFlow implementation workflow for: $ARGUMENTS

Use `subagent` chain mode with `agentScope: "project"` and `confirmProjectAgents: false`:

1. `scout` investigates only the relevant code, tests, documentation, and operations.
2. `planner` uses the original task and `{previous}` to provide a compact red-green plan.
3. `test-writer` creates focused tests and proves the expected Red state.
4. `implementer` uses `{previous}`, implements the smallest solution, runs focused verification, updates documentation, and creates small green Conventional Commits.

Do not modify files in the parent agent. Stop on failure. Do not run all canonical gates repeatedly; `pnpm verify` and applicable conditional gates run once before the final phase commit and again before push. Return the implementation report and commits.
