# OpenVTT

An open source, self-hosted virtual tabletop for tabletop RPGs, written from scratch. It runs in the browser: the game master hosts, players join by link.

> Status: milestone M1 (skeleton). Accounts, worlds, invite links and live presence work. Maps, tokens, dice and sheets come in later milestones.

## Requirements

- Node.js 24 or newer (uses the built-in `node:sqlite`)
- pnpm 9

## Running

```sh
pnpm install
pnpm start          # builds the client and serves everything on http://localhost:3000
```

Development with hot reload (server on :3000, client on :5173):

```sh
pnpm dev
```

Environment variables: `PORT` (default 3000), `HOST`, `OPENVTT_DB` (default `data/openvtt.db`), `OPENVTT_SECURE_COOKIES=1` when served over HTTPS.

The first account created becomes the installation administrator. The admin can reset another user's password via `POST /api/admin/reset-password` (no email server needed).

## Checks

```sh
pnpm test           # server tests (auth, permissions, websocket sync, persistence)
pnpm typecheck
pnpm check:i18n     # every locale must have the same keys as en.json
```

## Translations

UI strings live in `packages/client/src/i18n/<locale>.json`. To add a language, add a JSON file with the same keys and register the locale in `packages/shared/src/index.ts` and `packages/client/src/i18n/index.ts`. Missing keys fall back to English. The server only returns error codes; the client translates them.

## Layout

| Package | Purpose |
|---|---|
| `packages/shared` | Types, error codes, validation schemas shared by client and server |
| `packages/server` | Fastify HTTP API, authoritative WebSocket hub, SQLite persistence |
| `packages/client` | React single-page app |

## License

The core (server and client) is AGPL-3.0-only, see `LICENSE`. The future SDK and system-format schemas will be MIT. See `CONTRIBUTING.md` for how to contribute.
