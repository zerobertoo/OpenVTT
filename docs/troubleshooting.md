# Troubleshooting and FAQ

## Installation

**`node:sqlite` is missing or the server fails at start from source.** OpenVTT needs Node.js 24. Check `node -v`.

**Port 3000 is already in use.** From source, set `PORT`. With Docker Compose, set `OPENVTT_HOST_PORT` in a `.env` file. See [configuration](configuration.md).

**`pnpm: command not found`.** Run `corepack enable` (ships with Node), or install pnpm 9.

**`@node-rs/argon2` or `esbuild` fail to install.** Use the pnpm version pinned in `package.json` and do not pass `--ignore-scripts`; `pnpm-workspace.yaml` already allows those two packages to run their build steps.

## Signing in

**I can't log in after putting OpenVTT behind HTTPS.** Set `OPENVTT_SECURE_COOKIES=1` and make sure the proxy sends the request over HTTPS to the browser. Without HTTPS and with that variable set, the browser drops the cookie, so use it only behind TLS.

**I forgot my password.** There is no email. The installation administrator can reset any password with an API call (the new password needs 8+ characters):

```sh
curl -c jar -X POST http://localhost:3000/api/auth/login -H "content-type: application/json" \
  -d '{"username":"admin-name","password":"admin-password"}'
curl -b jar -X POST http://localhost:3000/api/admin/reset-password -H "content-type: application/json" \
  -d '{"username":"player-name","newPassword":"a-new-password"}'
```

That user's sessions are ended. If the administrator is the one who forgot, stop the server and restore a backup, or ask in an issue.

## The table

**"Connection lost, reconnecting…" stays on screen.** The WebSocket at `/ws` is not getting through. Behind a reverse proxy, forward upgrades ([reverse-proxy.md](reverse-proxy.md)). Check the browser console (F12) for failed `ws://` or `wss://` requests.

**Uploading a map fails.** The proxy body limit is probably lower than the file. Images are capped at 15 MiB; videos and music at `OPENVTT_MAX_VIDEO_BYTES` (100 MiB). Raise both the proxy limit and, if needed, the variable.

**The animated map does not play, and the map shows a notice.** The player's browser cannot decode the codec. Use MP4 (H.264) or WebM (VP9). HEVC and AV1 only play on some devices.

**Players see the whole map even with fog of war.** Fog needs walls on the map and the *Fog of war* setting on in the scene settings. Maps imported without walls (plain images) have none: import a Universal VTT file or use "View as player" to preview. See [lighting and fog](tutorial-lighting-and-fog.md). Note that the picture itself is only darkened on screen; keep secrets out of the image.

**The grid does not match the map.** Use *Adjust grid on the map* in the scene settings, or name the file with the cell size (`map_28x38.png`). In Dungeon Alchemist, turn its own grid off in the export.

**Keyboard shortcuts do nothing.** They are ignored while a text field, dialog or menu has focus. Press Escape and try again; `?` lists them.

## Data

**Where is my data?** In the folder of `OPENVTT_DB`; in Docker, the `openvtt-data` volume ([configuration](configuration.md#where-data-lives)).

**How do I move to another server?** Stop the old server, copy the data folder, and start the new one pointing at it. Or export worlds individually and import them.

## FAQ

**Is there a hosted version?** No. OpenVTT is self-hosted by design.

**Do players need an account?** Yes, a local one on your server. They get it through your invite link; there is no email or third-party sign-in.

**How many players can it handle?** No limit is enforced. The design is one Node process with SQLite, aimed at normal tables; if you test larger groups, please share your numbers.

**Which game systems are supported?** A generic one and D&D 5e SRD 5.1 are bundled. Anyone can write a package without code: [creating-a-system.md](creating-a-system.md).

**Can I import from Roll20 / Foundry / Fantasy Grounds?** Universal VTT (`.dd2vtt`, `.uvtt`) and Foundry-style scene JSON maps work. Other formats are not supported ([roadmap](ROADMAP.md)).

**Can I use it commercially?** The core is AGPL-3.0: you can, but if you offer a modified version over a network you must publish your changes. The SDK is MIT.

**It is still 0.x, is it safe to use?** It is usable at a real table, but formats can change before 1.0.0. Keep backups.

Still stuck? [Open a question](https://github.com/zerobertoo/OpenVTT/issues/new?template=question.yml) with the details listed in [SUPPORT.md](../SUPPORT.md).
