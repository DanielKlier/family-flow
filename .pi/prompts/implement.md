---
description: Execute the FamilyFlow scout, plan, red-test, and implementation workflow
argument-hint: "<task>"
---

Orchestrate this explicit FamilyFlow implementation workflow for: $ARGUMENTS

Use the `subagent` tool in `chain` mode with `agentScope: "project"` and `confirmProjectAgents: false`:

1. Run `scout` to investigate the relevant code, tests, documentation, and operational concerns.
2. Run `planner` with the original task and `{previous}` scout handoff. Require a concrete red-green-refactor plan.
3. Run `test-writer` with the original task and `{previous}` plan. It must add the required tests and prove that they fail for the expected missing behavior.
4. Run `implementer` with the original task and `{previous}` test handoff. It must implement the smallest correct solution, update documentation, and run all required gates.

Do not modify files in the parent agent. Stop if any chain step fails. Return the implementer's final report.
