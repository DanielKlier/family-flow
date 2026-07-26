# FamilyFlow

FamilyFlow is a local web application for household and family finance planning.

## Requirements

- Node.js 24
- pnpm 11
- Docker and Docker Compose

## Local Development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and adjust values if needed.
3. Start the development server with `pnpm dev`.
4. Open `http://127.0.0.1:3000/health` to verify the app is running.

## Commands

- `pnpm format`: format files with Biome.
- `pnpm format:check`: check formatting.
- `pnpm lint`: run Biome linting.
- `pnpm test`: run unit and integration tests.
- `pnpm test:e2e`: run E2E tests.
- `pnpm build`: compile TypeScript.

## Versioning

Pre-release versions use `0.x.y` SemVer-style versions. Each versioned state has:

- A `package.json` version.
- A `CHANGELOG.md` entry.
- A Git tag named `vMAJOR.MINOR.PATCH`, for example `v0.1.0`.

## Docker

Build the image with `docker compose build`.

Start the app and PostgreSQL with `docker compose up`.
