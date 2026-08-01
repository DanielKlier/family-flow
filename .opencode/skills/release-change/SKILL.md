---
name: release-change
description: Use when releasing a FamilyFlow change, including package.json version updates, CHANGELOG.md updates, required quality gates, git tagging, and pushing commits and tags.
---

# Release Change

Use this skill when the user asks to release, ship, publish, tag, or finalize a FamilyFlow change.

## Release Requirements

- A release always updates the `version` field in `package.json`.
- A release always updates `CHANGELOG.md`.
- A release always creates a Git tag for the released version.
- A release always pushes the release commit and the tag.
- A release always creates a GitHub Release for the tag.
- Do not create tags or push anything unless the user has explicitly requested a release.
- Do not modify unrelated worktree changes.

## Versioning

- Read the current `package.json` version before deciding the next version.
- Ask one short question if the requested release does not make the target version clear.
- Use semantic versioning for release versions.
- Keep the tag name aligned with the package version using `v<version>`, for example `v0.8.0`.

## Changelog

- Update `CHANGELOG.md` in the same release change.
- Add a dated entry for the release version.
- Summarize user-visible changes, fixes, migrations, operations notes, and breaking changes if applicable.
- Keep changelog text factual and concise.

## Pre-Release Checks

Before committing or tagging, inspect the repository state:

- Run `git status`.
- Run `git diff`.
- Run `git log --oneline -10`.
- Confirm the release only includes intended files.
- Check for secrets or accidental local-only data in the diff.

Run the expected local quality gates:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`

If Docker, deployment, infrastructure, or operations behavior changed, also run:

- `docker compose build`

If deployment behavior changed, perform a Docker Compose smoke test appropriate for the change.

## Commit

- Commit only the intended release files and any intended feature or fix files that are part of the release.
- Use a Conventional Commit message.
- For a release-only commit, use `chore: release v<version>`.
- Do not amend existing commits unless the user explicitly asks.
- If hooks or quality gates fail, fix the issue and create a new valid commit. Do not bypass hooks.

## Tag And Push

After the release commit is created and checks are green:

- Create an annotated tag named `v<version>`.
- Use the tag message `Release v<version>`.
- Push the current branch.
- Push the tag.

Use non-interactive Git commands. Prefer explicit commands such as:

```sh
git tag -a v<version> -m "Release v<version>"
git push
git push origin v<version>
```

## GitHub Release

After the tag has been pushed:

- Create a GitHub Release for `v<version>`.
- Use the release title `v<version>`.
- Use the corresponding `CHANGELOG.md` release entry as the release notes.
- Prefer `gh release create` for the GitHub Release.
- Do not mark the release as a prerelease unless the version or user request explicitly indicates a prerelease.

Use non-interactive GitHub CLI commands. Prefer explicit commands such as:

```sh
gh release create v<version> --title "v<version>" --notes-file <release-notes-file>
```

## Final Response

Report:

- Released version.
- Commit hash.
- Tag name.
- GitHub Release URL.
- Push status.
- Quality gates that passed.
- Any skipped checks and the reason.
