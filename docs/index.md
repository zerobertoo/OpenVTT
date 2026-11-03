# OpenVTT documentation

OpenVTT is an open source, self-hosted virtual tabletop. Pick what you need:

## I want to run it

| Guide | What it covers |
|---|---|
| [Getting started](getting-started.md) | Install with Docker or from source, first account, invites |
| [Configuration](configuration.md) | Environment variables, limits, where data lives |
| [Reverse proxy and HTTPS](reverse-proxy.md) | Caddy, nginx, Traefik, WebSockets, upload limits |
| [Backup and restore](backup-and-restore.md) | Scheduled copies, restoring, moving servers |
| [Upgrading](upgrading.md) | Updating safely |
| [Troubleshooting and FAQ](troubleshooting.md) | Common problems, password reset, answers |

## I want to run a game

| Tutorial | What it covers |
|---|---|
| [Your first session](tutorial-first-session.md) | World, scene, token, invite, dice, initiative, sheets |
| [Importing a map](tutorial-importing-maps.md) | Dungeon Alchemist, Universal VTT, Foundry-style, plain images |
| [Lighting and fog of war](tutorial-lighting-and-fog.md) | Walls, lights, ambient light, previewing as a player |
| [Creating a rules system](creating-a-system.md) | Sheets and compendium as JSON, no code |

Reference: [world file format](world-file-format.md).

## I want to contribute

| Document | What it covers |
|---|---|
| [CONTRIBUTING](../CONTRIBUTING.md) | Setup, checks, commits, pull requests |
| [Architecture](ARCHITECTURE.md) | Packages, protocol, authority and visibility |
| [Frontend guide](FRONTEND.md) | UI conventions and components |
| [Roadmap](ROADMAP.md) | What is built and what is planned |
| [Governance](../GOVERNANCE.md), [Code of Conduct](../CODE_OF_CONDUCT.md), [Security](../SECURITY.md), [Support](../SUPPORT.md) | How the project works |
| [Changelog](../CHANGELOG.md) | Notable changes |

## Design notes

`PLAN-*.md` files record the design of individual features (lighting, floors, animated maps, map import, UI primitives) and [AUDIT-ui.md](AUDIT-ui.md) is a UI audit. They are historical working notes: the code and the guides above are authoritative. [PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md) describe who the product is for and its visual language.
