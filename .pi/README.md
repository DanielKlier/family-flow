# Pi Agent Workflows

FamilyFlow defines project-specific subagents in `.pi/agents/` and explicit prompt workflows in `.pi/prompts/`.

## Prerequisite

Install Pi's bundled `examples/extensions/subagent` extension as the global `subagent` extension. The extension runs each delegated agent in an isolated Pi process while sharing the current working tree.

After installing or changing the extension or project resources, run `/reload` in an existing Pi session.

## Workflows

- `/plan <task>` runs `scout` and then `planner`. It never changes files.
- `/implement <task>` runs `scout`, `planner`, `test-writer`, and `implementer` sequentially.
- `/implement-and-review <task>` runs the implementation workflow and an adversarial `reviewer`. Critical and Warning findings trigger at most two implementer correction rounds, each followed by another review.

All workflows are explicit. The parent agent must not delegate automatically outside these commands unless the user requests it.

## Safety

Project-local agents are repository-controlled prompts. Use them only after trusting the repository. Writing agents run sequentially against the shared worktree; do not run them in parallel. Agents preserve unrelated changes and never commit.
