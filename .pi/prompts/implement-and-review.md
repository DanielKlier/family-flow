---
description: Implement FamilyFlow test-first with adversarial review and up to two correction rounds
argument-hint: "<task>"
---

Orchestrate this explicit FamilyFlow implementation and review workflow for: $ARGUMENTS

All subagent calls must use `agentScope: "project"` and `confirmProjectAgents: false`. Do not edit files in the parent agent.

## Initial implementation

Use the `subagent` tool in `chain` mode:

1. Run `scout` to investigate the relevant code, tests, documentation, and operational concerns.
2. Run `planner` with the original task and `{previous}` scout handoff.
3. Run `test-writer` with the original task and `{previous}` plan. It must create and prove the expected red tests.
4. Run `implementer` with the original task and `{previous}` test handoff. It must implement, document, and verify the change.

Stop and report if this chain fails.

## Adversarial review loop

Run `reviewer` in single mode against the original task and current worktree. Read its `## Verdict`:

- If the verdict is `PASS`, stop successfully.
- If the verdict is `CHANGES_REQUESTED`, run `implementer` in single mode with the original task and the complete reviewer report. Then run `reviewer` again.
- Repeat the correction step at most two times in total.
- Suggestions alone must not trigger a correction round.
- Never run a third correction round.

After the second correction round, always run the reviewer once more for a final verdict. If it still returns `CHANGES_REQUESTED`, stop and report all remaining findings rather than changing files again.

Return a concise workflow summary, the final reviewer verdict, all verification outcomes, and any unresolved findings.
