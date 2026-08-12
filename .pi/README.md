# Pi Agent Workflows

FamilyFlow defines project-specific subagents in `.pi/agents/` and explicit prompt workflows in `.pi/prompts/`.

## Prerequisite

Install Pi's bundled `examples/extensions/subagent` extension as the global `subagent` extension. The extension runs each delegated agent in an isolated Pi process while sharing the current working tree.

After installing or changing the extension or project resources, run `/reload` in an existing Pi session.

## Workflows

- `/plan <task>` runs `scout` and then `planner`. It never changes files.
- `/implement <task>` runs `scout`, `planner`, `test-writer`, and `implementer` sequentially with focused verification and small green commits.
- `/implement-and-review <task>` adds a bounded reviewer. The first Critical or Warning report gets one correction; a second correction runs only for remaining Critical findings.
- Full canonical and applicable conditional gates run once before the final commit and again before push, rather than during every implementation turn.

All workflows are explicit. The parent agent must not delegate automatically outside these commands unless the user requests it.

## Safety

Project-local agents are repository-controlled prompts. Use them only after trusting the repository. Writing agents run sequentially against the shared worktree and preserve unrelated changes. Implementers may create small passing Conventional Commits; workflows never squash, rebase, or push automatically.
