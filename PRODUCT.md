# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Game master:** builds scenes quickly, controls what players see, manages NPCs and rules without friction.
- **Player:** joins by link, sees the map, moves their own token, rolls dice and consults their sheet. Often on a phone.
- **Installation administrator:** the first account created; hosts the instance and resets forgotten passwords (no email server involved).
- **Rules-system author** (post-MVP): creates systems through a stable declarative format.

## Product Purpose

OpenVTT is an open source, self-hosted virtual tabletop for tabletop RPGs, written from scratch. The game master hosts a world and players join by link to play on a shared map with tokens, sheets, dice and chat in real time. Success is a table playable end to end, running within minutes on a home network or small VPS, with low perceived latency.

## Positioning

Open source and self-hosted, with no third-party account required to play; the server is authoritative, so players are never sent anything reserved to the game master (hidden tokens, whispers, other players' sheets). The core knows no RPG: rules arrive as pluggable systems, and a whole world exports as one open-format zip.

## Operating Context

Sessions are live and social: several people on one map, often with voice chat running elsewhere (Discord or similar). The game master prepares scenes beforehand and reacts at the table. Players join from desktop and phone browsers.

## Capabilities and Constraints

- Local accounts (username and password), world invite links; roles: administrator, game master, player.
- Scenes with uploaded map, square grid or none, pan/zoom, distance ruler.
- Tokens: create, move, resize, rotate, hide, assign controllers, link to a sheet.
- Chat with whispers and server-rolled dice (`/r 2d6+3`, `adv`), GM-only rolls, persisted history.
- Sheets defined by JSON templates with computed fields; pluggable rules systems (generic and D&D 5e SRD included).
- UI in English and Brazilian Portuguese; adding a language is adding a JSON file.
- Browser is the only platform; no native app, no built-in voice/video, no hosted service.
- Independent project: no code, assets or formats from proprietary VTTs; no distribution of protected game content.

## Brand Commitments

Independent identity: does not use its author's personal branding and does not imitate other VTTs. Text tone is plain and friendly, second person, no jargon ("game master" and "player" spelled out). Visual direction is recorded in DESIGN.md.

## Evidence on Hand

Working server, client and bundled systems in the repo. No testimonials, customer logos or benchmarks exist; future work must not fabricate them.

## Product Principles

1. The table is the star; the interface stays out of the way.
2. A first-time player needs no VTT knowledge.
3. Server authority: nothing reserved to the game master ever reaches a client that cannot see it.
4. Own your data: self-hosted, open formats, exportable.
5. Rules are modules; the core stays system-agnostic.

## Accessibility & Inclusion

WCAG AA: 4.5:1 contrast in light and dark, visible keyboard focus, full keyboard operation, `prefers-reduced-motion` respected. Touch targets of at least 44 px for players on phones. English and pt-BR are first-class.
