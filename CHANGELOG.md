# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will follow [Semantic Versioning](https://semver.org/) from 1.0.0. Until then (0.x) anything can change between versions.

## [Unreleased]

### Added

- Documentation: getting started, configuration, reverse proxy, backup and restore, upgrading, troubleshooting and FAQ, architecture, and tutorials (first session, importing maps, lighting and fog of war), indexed in `docs/index.md`.
- Community files: code of conduct, support, governance, issue and pull request templates, code owners, suggested labels, `.editorconfig`, `CITATION.cff`.
- The features listed under "Built" in the [roadmap](docs/ROADMAP.md): scenes with images, videos and imported Universal VTT maps, floors, square and hex grids, walls, doors, lights and fog of war, tokens, initiative, chat with server-side dice, sheets from rules systems, journal, music, undo, world export and import, scheduled database backups, English and Brazilian Portuguese UI.

### Security

- A malformed cookie, upgrade URL or WebSocket frame no longer stops the server.
- Players can no longer move a token through walls or off the map with a direct HTTP request.
- Rate limits on login, world and scene export and world import (HTTP 429, error code `too_many_attempts`).
- Dice notation parsing no longer uses backtracking regexes that could be slow on long input.
- The CI workflow token is read-only.

### Changed

- CI skips jobs a change cannot affect (docs, landing page, repo metadata; Docker build only when its inputs change), splits the e2e suite across four runners and cancels superseded pull request runs.

[Unreleased]: https://github.com/zerobertoo/OpenVTT/commits/main
