# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will follow [Semantic Versioning](https://semver.org/) from 1.0.0. Until then (0.x) anything can change between versions.

## [Unreleased]

### Added

- Documentation: getting started, configuration, reverse proxy, backup and restore, upgrading, troubleshooting and FAQ, architecture, and tutorials (first session, importing maps, lighting and fog of war), indexed in `docs/index.md`.
- Community files: code of conduct, support, governance, issue and pull request templates, code owners, suggested labels, `.editorconfig`, `CITATION.cff`.
- The features listed under "Built" in the [roadmap](docs/ROADMAP.md): scenes with images, videos and imported Universal VTT maps, floors, square and hex grids, walls, doors, lights and fog of war, tokens, initiative, chat with server-side dice, sheets from rules systems, journal, music, undo, world export and import, scheduled database backups, English and Brazilian Portuguese UI.

### Added

- Richer map effects built from particles, glow, screen shake and a shockwave, plus four new ones: slash, lightning bolt, frost nova and fireball.
- Vanish and arrive effects dropped on a token hide and reveal it; the game master sees hidden tokens with a dashed ring and an eye badge.
- Weather rebuilt as blending layers: moving fog, rain ripples, wind, and lightning with thunder when sounds are on.
- A badge for each player at the top with a joining animation, a preload step before the table opens, and an optional entrance animation (a per-browser setting).
- `OPENVTT_TRUST_PROXY` makes rate limits and login lockouts use each visitor's real address behind a reverse proxy. `compose.dokploy.yaml` turns it on.

- Limits against abuse on a public instance: a cap on worlds per account and on file storage per world, a per-address limit on registrations, per-account limits on chat and uploads, and table sockets that flood, stall or stop answering pings are dropped. Table sockets from pages on other sites are refused. All of them are configurable (see Configuration).
- Security headers on every answer, including a Content-Security-Policy that only allows the app's own scripts, styles and media.

### Fixed

- A dice roll's result (chat line, natural 20 and natural 1 included) now shows only after the dice stop rolling, and its total sits in the middle of the free part of the table.
- Changing the weather leaves nothing of the previous one on screen: snow or rain no longer stay frozen under fog.
- Shutting down (`SIGTERM`/`SIGINT`, or closing the app with a table open or a request in flight) no longer hangs, and `PORT` is validated at startup.
- A login lockout now applies to the address that kept failing, so a stranger can no longer lock the owner (or the admin) out. The failure counters are capped and expired sessions are deleted.
- The scene, token and sheet forms keep what you are typing when someone else changes another field of the same scene, token or sheet.
- A browser that cannot draw the map (no WebGL) now says so instead of showing a blank area.
- A token can no longer slip through the exact point where two wall pieces meet.
- A player's token that stops with its centre exactly on a wall or closed door now lands a pixel short of it, on the side it came from, which closes a way to cross in two moves.
- A moved token now stays entirely on the map, which also closes a way around a wall reaching the map's edge.
- A map change the server refuses now shows an error, leaves no step in the undo history and keeps what could be redone. An undo pressed while that change was pending does nothing.
- When only some of the selected tokens accept a delete or a turn, the error is shown and undo covers the ones that changed.
- A token dropped after losing control of it goes back to its real position.
- A request body that is not valid JSON now gets `invalid_input` instead of a logged server error.
- Importing a world now accepts a `world.json` of up to 256 MiB instead of 16 MiB, so large exported worlds can be restored.
- Exporting a world now keeps token rotation, time of day, weather, season, the music and up to 10,000 public chat messages.
- A ruler measurement no longer disappears when something else changes on the table.
- Redrawing tokens no longer leaks memory for their condition badges.
- Scenes and floors with up to the promised 20,000 walls can be saved; larger requests report that they are too large.

### Security

- A malformed cookie, upgrade URL or WebSocket frame no longer stops the server.
- Players can no longer move a token through walls or off the map with a direct HTTP request.
- Signing out or having a password reset now drops the live table connections of that session at once, and a connection stops working when its session expires.
- A failure while opening a table connection is logged and no longer leaves a member shown as online.
- Saving map data now checks for the game master role before reading the body.
- The initiative order no longer tells players about tokens on other floors or on scenes not being shown.
- Rate limits on login, world and scene export, world import and map saves (HTTP 429, error code `too_many_attempts`).
- Dice notation parsing no longer uses backtracking regexes that could be slow on long input.
- The CI workflow token is read-only.

### Changed

- CI skips jobs a change cannot affect (docs, landing page, repo metadata; Docker build only when its inputs change), splits the e2e suite across four runners and cancels superseded pull request runs.

[Unreleased]: https://github.com/zerobertoo/OpenVTT/commits/main
