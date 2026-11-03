# Architecture

A short tour for contributors. For UI conventions see [FRONTEND.md](FRONTEND.md); for file formats see [world-file-format.md](world-file-format.md) and [creating-a-system.md](creating-a-system.md).

## Packages

pnpm workspaces; TypeScript everywhere; the server runs TypeScript directly with `tsx`.

| Package | Role |
|---|---|
| `@openvtt/sdk` (MIT) | Pure logic with no I/O: dice notation (`dice.ts`), sheet formulas (`formula.ts`) and the rules-system schemas (`sheet.ts`). Usable by anyone writing a system. |
| `@openvtt/shared` | Everything both sides must agree on: Zod schemas and DTO types for the protocol (`index.ts`), vision geometry (`vision.ts`, `geometry.ts`), and the Universal VTT / Foundry parsers (`uvtt.ts`, `foundry.ts`). |
| `@openvtt/server` | Fastify HTTP API, the WebSocket `Hub`, services (`worlds`, `scenes`, `tokens`, `actors`, `chat`, `combat`, `drawings`, `handouts`, `assets`, `systems`, `portability`) and SQLite via `node:sqlite` (`db.ts`). |
| `@openvtt/client` | React single-page app (TanStack Router and Query, Zustand-style `tableStore`), PixiJS map (`MapView.tsx`), side panels (`panels/`), i18n JSON (`i18n/`). |
| `systems/` | Bundled rules systems, loaded by the server; admins can install more as zips. |

Dependency direction: `client` and `server` depend on `shared` and `sdk`; `shared` and `sdk` depend on nothing in the repo.

## Running shape

One Node process serves the built client (static files), the HTTP API under `/api`, a health check at `/healthz` and the WebSocket at `/ws?world=<id>`. State is one SQLite file plus an `assets/` folder next to it. In development, Vite serves the client on :5173 and talks to the server on :3000.

Schema changes are ordered migrations in `db.ts`; a released migration is never edited.

## Client/server protocol

- **HTTP (`/api`)** handles accounts, worlds, invites, scenes, uploads, imports/exports and all the "edit the world" operations. Requests are validated with Zod schemas from `shared`.
- **WebSocket (`/ws`)** is the live channel for one user in one world. The connection is authorized from the session cookie and the world membership. Messages are defined in `shared` as `ClientMessage` and `ServerMessage`:
  - client to server: `world.resync`, `token.move`, `map.ping`, `world.viewAs`;
  - server to client: `world.state` (full state for this recipient), `token.upsert`, `token.remove`, `chat.message`, `vision.update`, `combat.update`, `scene.drawings`, `map.ping`, `error` (a code, never text).
- Errors are codes (`ErrorCode`); the client translates them. The server has no UI strings.
- Incoming WebSocket messages are parsed with Zod; a malformed or unauthorized message gets an `error` and nothing else happens.

## Authority model

The server is the single source of truth. The client proposes, the server decides:

1. Every operation checks the caller's role in the world (game master, assistant, player, observer) and, for tokens, whether they control it.
2. Dice are rolled on the server; the client only displays results.
3. Token moves are checked against walls and closed doors on the server.
4. The client keeps no authority: after a reconnect it asks for `world.resync` and replaces its state.

Undo/redo is a client feature that issues ordinary, validated operations; it grants no extra rights.

## Visibility

"Never send what a client cannot see" is the main rule, and the main source of security bugs. Where it is enforced:

- **Per-recipient messages.** The hub builds each outgoing message for each connection (`Hub`, `TokenService.forViewer` / `visibleTo`). Hidden tokens, whispers, GM-only rolls and other players' sheets are filtered out before serialization.
- **Fog of war.** `visionRegion` (`server/src/vision.ts`, geometry in `shared`) computes, from the tokens a player controls, the area they see, shaped by walls, closed doors and lights. The client receives the resulting polygons (`vision.update`), never the walls or lights themselves.
- **Floors.** A player only receives the floor their token stands on (or the table floor when they have none).
- **"View as player".** The game master can ask the server to render what a given player would receive (`world.viewAs`); it is the same code path, not a client-side imitation.
- **Tests.** `packages/server/src/*.test.ts` include leak tests: a client without access must get nothing. Changes in this area need one.

Known limit: the map picture itself is darkened on screen, not withheld, so secrets must stay out of the image.

## Client structure

- `Table.tsx` is the table shell; `useWorldState` keeps the WebSocket and the world state in sync; `tableStore.ts` holds local UI state (selection, tools, layers).
- `MapView.tsx` renders with PixiJS: map, grid, tokens, drawings, fog and light, with off-screen culling and a capped texture cache. Its pure helpers live in `lib/` and are unit tested.
- `lib/permissions.ts` mirrors server rules for the UI only (hiding buttons); the server enforces them.
- Components for Storybook (`pnpm catalog`) are under `components/`.

## Testing

| Layer | Tool | Where |
|---|---|---|
| Logic, rules, permissions, leaks, import/export | Vitest | `packages/*/src/*.test.ts` |
| Components and helpers | Vitest + Testing Library | `packages/client/src` |
| Whole app in a browser, accessibility (axe), visual | Playwright | `e2e/` |
| Bundle budget | `scripts/check-bundle-size.mjs` | CI |

CI (`.github/workflows/ci.yml`) runs lint, i18n check, typecheck, unit tests, build, bundle budget, e2e and a Docker build; CodeQL (GitHub's default setup) and Dependabot are enabled on the repository.
