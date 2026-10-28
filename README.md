# OpenVTT

An open source, self-hosted virtual tabletop for tabletop RPGs, written from scratch. It runs in the browser: the game master hosts a world, players join by link.

## Features

- Local accounts (username + password, argon2). The first account becomes the installation administrator.
- Worlds with invite links; roles: administrator (installation), game master and player (per world).
- Scenes with an uploaded map (PNG/JPG/WebP or an animated video), square grid or no grid, smooth pan/zoom (PixiJS) and a distance ruler in imperial, metric or squares.
- Map import from Dungeon Alchemist and others (Universal VTT, Foundry-style exports, plain images), with walls, doors and lights, multi-floor maps and a visual grid adjuster; scenes export back as Universal VTT.
- Optional fog of war: players only see what their tokens see, shaped by walls, closed doors and lights, and walls stay on the server.
- Tokens: create, move (snapped to the grid), resize, rotate, hide from players, assign controllers, link to a sheet.
- Chat with whispers, `/r 2d6+3` and `/r 1d20 adv` dice rolls (rolled on the server), GM-only rolls and persisted history.
- Character and NPC sheets defined by JSON templates with computed fields, editable by the GM without code.
- Pluggable rules systems: a generic one and D&D 5e SRD 5.1 are included. See [docs/creating-a-system.md](docs/creating-a-system.md).
- Export/import of a whole world as one zip. See [docs/world-file-format.md](docs/world-file-format.md).
- English and Brazilian Portuguese UI; adding a language is adding a JSON file.

The server is authoritative: every action is validated by role, and hidden tokens, whispers and other players' sheets are never sent to clients that cannot see them.

## Running with Docker

```sh
docker compose up -d --build
```

Open http://localhost:3000. Data (database, uploaded maps, installed systems) lives in the `openvtt-data` volume; back it up by copying that volume. Behind an HTTPS reverse proxy, set `OPENVTT_SECURE_COOKIES=1` (see `compose.yaml`) and make sure the proxy forwards WebSocket upgrades on `/ws`.

## Running from source

Requires Node.js 24+ (uses the built-in `node:sqlite`) and pnpm 9.

```sh
pnpm install
pnpm start          # builds the client and serves everything on http://localhost:3000
pnpm dev            # development with hot reload (server :3000, client :5173)
```

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Listen address |
| `OPENVTT_DB` | `data/openvtt.db` | SQLite file; assets and installed systems are stored next to it |
| `OPENVTT_SECURE_COOKIES` | off | Set to `1` when served over HTTPS |
| `OPENVTT_MAX_VIDEO_BYTES` | `104857600` (100 MiB) | Largest animated map video accepted; images stay capped at 15 MiB |

### Animated maps

A scene background can be a `.webm` or `.mp4` video. It plays muted and in a loop; with the system setting "reduce motion" it starts paused, and it pauses while the tab is hidden. The file is streamed to disk in the data directory, checked by its bytes (not its name), and served with HTTP Range support so players can seek. Exports and imports of a world stream the videos too.

Codecs depend on the browser that plays the map, not on the server. WebM with VP9 works in most browsers; MP4 with H.264 is the most compatible choice. HEVC and AV1 only play on some devices. If a browser cannot decode the file, the scene shows a notice and the map is drawn without the video.

Behind a reverse proxy, allow bodies at least as large as the video limit and long upload timeouts (nginx: `client_max_body_size 110m;` and `proxy_request_buffering off;`).

### Importing maps

In the Scenes tab, **Import map** reads a Universal VTT file (`.dd2vtt`, `.uvtt`) or the `.json` of a Foundry-style export together with the picture or video it came with, or just a picture or video (a name like `map_28x38.png` sets the grid). Files named `Name_0`, `Name_1` become the floors of one map. The dialog explains which Dungeon Alchemist options to pick. Walls, doors and lights are visible to the game master only; with fog of war on, players receive just the area their tokens can see.

Limits (no new server settings): the map data file is read in the browser up to 100 MiB, a scene keeps up to 20,000 wall segments and 1,000 lights, an embedded picture follows the 15 MiB image limit and a video follows `OPENVTT_MAX_VIDEO_BYTES`. The map picture itself is not hidden by fog: it is darkened on screen, so keep secrets out of the image if players are not to see them.

A forgotten password is reset by the administrator through `POST /api/admin/reset-password` (no email server involved).

## Checks

```sh
pnpm test           # sdk and server tests (auth, permissions, leaks, sync, import/export, systems)
pnpm typecheck
pnpm check:i18n     # every locale must have the same keys as en.json
```

## Translations

UI strings live in `packages/client/src/i18n/<locale>.json`. To add a language, add a JSON file with the same keys and register the locale in `packages/shared/src/index.ts` and `packages/client/src/i18n/index.ts`. Missing keys fall back to English. The server only returns error codes; the client translates them. Rules systems carry their own `locales/` files.

## Layout

| Package | Purpose | License |
|---|---|---|
| `packages/sdk` | Dice notation, sheet formulas, rules-system schemas | MIT |
| `packages/shared` | Protocol types and validation shared by client and server | AGPL-3.0 |
| `packages/server` | Fastify HTTP API, authoritative WebSocket hub, SQLite persistence | AGPL-3.0 |
| `packages/client` | React + PixiJS single-page app | AGPL-3.0 |
| `systems/` | Bundled rules systems | see each `system.json` |

## License

The core (server, client, shared) is AGPL-3.0-only, see `LICENSE`. The SDK and system-format schemas are MIT, see `packages/sdk/LICENSE`, so authors of rules systems and modules can choose any license for their work. See `CONTRIBUTING.md` to contribute.
