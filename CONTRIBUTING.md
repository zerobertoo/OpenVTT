# Contributing to OpenVTT

Thanks for helping! This guide covers how to set up the project, what the rules are and how a change gets merged. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** or **suggest a feature** with the [issue templates](https://github.com/zerobertoo/OpenVTT/issues/new/choose).
- **Improve the docs**: fixing a typo or a confusing step is a perfectly good first pull request.
- **Translate the UI**: see [Translations](#translations).
- **Write a rules system**: see [docs/creating-a-system.md](docs/creating-a-system.md). Systems are plain JSON and can live in their own repository.
- **Fix an issue**: look for [`good first issue`](https://github.com/zerobertoo/OpenVTT/labels/good%20first%20issue) and [`help wanted`](https://github.com/zerobertoo/OpenVTT/labels/help%20wanted). Comment on the issue before you start so work is not duplicated.

Security problems go through the [private report](SECURITY.md), never a public issue.

## Proposing a feature

1. Read the [roadmap](docs/ROADMAP.md) and [PRODUCT.md](PRODUCT.md): some things are planned, some deliberately are not.
2. Open a "Feature request" issue describing the problem at the table, not just the solution.
3. Wait for a maintainer to agree on the direction before writing a large change. Small fixes do not need this.

## Setting up

Requirements: Node.js 24 and pnpm 9 (`corepack enable` provides the right pnpm). No database server is needed; SQLite is built into Node.

```sh
git clone https://github.com/zerobertoo/OpenVTT.git
cd OpenVTT
pnpm install
pnpm dev            # server on http://localhost:3000, client with hot reload on http://localhost:5173
```

Open http://localhost:5173, create an account (the first one becomes the administrator) and start a world. Development data lives in `data/` (ignored by git); delete the folder to start over.

### Project layout

| Path | What lives there |
|---|---|
| `packages/sdk` | Dice, sheet formulas and system schemas (MIT) |
| `packages/shared` | Protocol types and validation shared by client and server |
| `packages/server` | Fastify API, WebSocket hub, SQLite |
| `packages/client` | React + PixiJS app (`MapView.tsx` is the map; `panels/` the side tabs) |
| `systems/` | Bundled rules systems |
| `e2e/` | Playwright end-to-end tests |
| `docs/` | Documentation; start at [docs/index.md](docs/index.md) |

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the pieces fit, and [docs/FRONTEND.md](docs/FRONTEND.md) the UI conventions.

## Checks

Run these before opening a pull request; CI runs the same ones.

```sh
pnpm lint           # Biome (format and lint); `pnpm exec biome check --write .` fixes most findings
pnpm check:i18n     # every locale has exactly the keys of en.json
pnpm typecheck
pnpm test           # Vitest: sdk, server and client unit tests
pnpm build && pnpm check:bundle   # client build and bundle budget
pnpm test:e2e       # Playwright; builds the client first
pnpm catalog        # optional: Storybook component catalog on :6006
```

End-to-end tests start their own server on port 3100 with a temporary database. Locally they use your installed Chrome; if you do not have it, run `pnpm exec playwright install chromium` and set `CI=1` for the run. Visual regression tests (`pnpm test:visual`) only run on request because their baselines come from Linux CI.

Tests are expected with behavior changes. Anything about permissions, hidden information or synchronization needs a server test that proves a client without access gets nothing.

## Code conventions

- Code, comments, commit messages, branch names and docs are in English.
- Keep comments sparse: say *why*, not *what*.
- Formatting is Biome's; `.editorconfig` covers the rest.
- New UI text goes in both `packages/client/src/i18n/en.json` and `pt-br.json`. The server only returns error codes; the client translates them.
- Do not use or copy code, assets or formats from proprietary VTTs.
- Prefer small, focused pull requests over large ones.

### Translations

UI strings live in `packages/client/src/i18n/<locale>.json`. To add a language, copy `en.json`, translate it, and register the locale in `packages/shared/src/index.ts` and `packages/client/src/i18n/index.ts`. `pnpm check:i18n` verifies the keys match. Rules systems carry their own `locales/` files.

## Branches and commits

- Branch from `main`: `feat/fog-of-war-doors`, `fix/token-snap`, `docs/reverse-proxy`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`, with types `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `chore`. Example: `fix(vision): keep closed doors opaque`.
- One logical change per commit; no merge commits in a pull request (rebase on `main`).

### Developer Certificate of Origin

There is no CLA. Contributions are licensed under the project licenses (AGPL-3.0 for the core, MIT for the SDK and schemas), and every commit from a contributor must be signed off to certify the [DCO](https://developercertificate.org/):

```sh
git commit -s -m "fix(vision): keep closed doors opaque"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line. Forgot it? `git commit --amend -s` for the last commit, or `git rebase --signoff main` for the branch.

## Pull requests

1. Fork, branch, commit, push, and open a pull request against `main`. Fill in the template.
2. CI must be green (lint, i18n, typecheck, unit tests, build, bundle budget, e2e, Docker build). To save time, CI skips the jobs a change cannot affect: docs, the landing page (`site/`) and repo metadata skip everything, and the Docker build only runs when files it copies change. Skipped jobs count as passing, so the required checks (`check`, `e2e`, `docker`) always report. The path rules live in `.github/scripts/changes.sh`.
3. A maintainer reviews. Expect questions and requests for changes; they are about the code, not about you. Push fixes as new commits and they will be squashed or rebased at merge.
4. Add a line under *Unreleased* in [CHANGELOG.md](CHANGELOG.md) for anything a user would notice.

Review is done on a best effort basis by a single maintainer ([governance](GOVERNANCE.md)), so please be patient.

## Labels

Maintainers use the labels listed in [.github/labels.yml](.github/labels.yml): type (`bug`, `enhancement`, `question`, `documentation`), status (`needs-triage`, `needs-info`), area (`area/map`, `area/server`, `area/systems`, `area/i18n`, `area/ops`) and welcome signs (`good first issue`, `help wanted`). Only maintainers apply labels; you do not need to set any when opening an issue.
