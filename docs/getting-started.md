# Getting started

OpenVTT runs as one small server (Node.js + SQLite). The game master hosts it; players only need a browser and a link.

## Option 1: Docker (recommended)

Requirements: Docker with the Compose plugin.

```sh
git clone https://github.com/zerobertoo/OpenVTT.git
cd OpenVTT
docker compose up -d --build
```

Open <http://localhost:3000>. If port 3000 is taken, put `OPENVTT_HOST_PORT=3001` in a `.env` file next to `compose.yaml`.

Everything (database, uploaded maps, installed systems, backups) lives in the `openvtt-data` Docker volume. See [backup and restore](backup-and-restore.md) before you rely on it.

Check that it is healthy: `curl http://localhost:3000/healthz` answers `{"ok":true}`.

To play over the internet, put the container behind an HTTPS reverse proxy: [reverse-proxy.md](reverse-proxy.md). For Dokploy, use `compose.dokploy.yaml` (see the [README](../README.md#behind-dokploy-traefik)).

## Option 2: From source

Requirements: Node.js 24 (OpenVTT uses the built-in `node:sqlite`) and pnpm 9 (`corepack enable`).

```sh
git clone https://github.com/zerobertoo/OpenVTT.git
cd OpenVTT
pnpm install
pnpm start          # builds the client, then serves everything on http://localhost:3000
```

For development with hot reload use `pnpm dev` (server on :3000, client on :5173). Data goes to `data/openvtt.db` unless you set `OPENVTT_DB`; see [configuration](configuration.md).

## First run

1. Open the address and choose **Create account**. **The first account becomes the installation administrator**, so create yours before sharing the address.
2. Everyone else creates their own account, or joins through an invite link (below). Passwords need at least 8 characters.
3. Continue with the [first session tutorial](tutorial-first-session.md): create a world, a scene, a token and roll dice.

## Inviting players

In the world, open the **World** tab: create an invite link there, choose when it expires and how many times it can be used, and send it. Members (roles, mute, remove) are managed in the same tab. Players open `https://your-address/join/<code>`, sign in or create an account, pick a display name and color, and join.

Roles in a world: game master, assistant game master, player and observer. The administrator is a per-installation role (installing systems, resetting passwords).

## Next steps

- [Tutorial: your first session](tutorial-first-session.md)
- [Tutorial: importing a map](tutorial-importing-maps.md)
- [Tutorial: lighting and fog of war](tutorial-lighting-and-fog.md)
- [Configuration](configuration.md) · [Upgrading](upgrading.md) · [Troubleshooting](troubleshooting.md)
