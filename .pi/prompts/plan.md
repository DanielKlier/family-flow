---
description: Inspect FamilyFlow and produce a read-only implementation plan
argument-hint: "<task>"
---

Orchestrate this explicit FamilyFlow planning workflow for: $ARGUMENTS

Use the `subagent` tool in `chain` mode with `agentScope: "project"` and `confirmProjectAgents: false`:

1. Run `scout` to investigate all code, tests, documentation, and operational concerns relevant to the task.
2. Run `planner` with the original task and `{previous}` scout handoff to produce a concrete red-green-refactor plan.

Do not edit files yourself. Do not invoke the test writer or implementer. Return the planner's final plan.
