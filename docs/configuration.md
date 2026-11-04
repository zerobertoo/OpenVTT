# Configuration

OpenVTT is configured with environment variables only. Unset means the default. A numeric variable that is set to something that is not a positive integer stops the server at startup with a clear message.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | TCP port the server listens on |
| `HOST` | `0.0.0.0` | Address to bind. Use `127.0.0.1` when a reverse proxy on the same machine is the only entry point |
| `OPENVTT_DB` | `data/openvtt.db` | SQLite file. Uploaded assets (`assets/`), installed systems (`systems/`) and backups (`backups/`) are stored next to it |
| `OPENVTT_SECURE_COOKIES` | off | Set to `1` when users reach the server over HTTPS. Without it the session cookie is not marked `Secure` |
| `OPENVTT_MAX_VIDEO_BYTES` | `104857600` (100 MiB) | Largest animated map video or music file (MP3, Ogg). Images stay capped at 15 MiB |
| `OPENVTT_BACKUP_INTERVAL_HOURS` | off | Copy the database into `backups/` every N hours (at most 504) |
| `OPENVTT_BACKUP_KEEP` | `7` | How many copies to keep; older ones are deleted |

Docker-only: `OPENVTT_HOST_PORT` (default `3000`) in `compose.yaml` is the port published on the host; the container always listens on 3000.

## Docker

Uncomment the `environment:` block in `compose.yaml`, or create a `.env` file for `OPENVTT_HOST_PORT`. `compose.dokploy.yaml` already enables secure cookies and daily backups.

## From source

```sh
PORT=8080 OPENVTT_DB=/srv/openvtt/openvtt.db OPENVTT_SECURE_COOKIES=1 pnpm start
```

(On PowerShell: `$env:PORT = "8080"; pnpm start`.)

## Limits (not configurable)

- A scene keeps up to 20,000 wall segments, 1,000 lights and 2,000 drawings.
- A map data file (`.dd2vtt`, `.uvtt`, `.json`) is read in the browser up to 100 MiB.
- Images are capped at 15 MiB.
- Login is limited to 60 requests per minute, world and scene export to 30 and world import to 10, per client IP (see [reverse-proxy.md](reverse-proxy.md#rate-limits)).

## Where data lives

```
<folder of OPENVTT_DB>/
  openvtt.db          SQLite database (accounts, worlds, scenes, chat, sheets)
  openvtt.db-wal/-shm SQLite write-ahead files while the server runs
  assets/             uploaded maps, token pictures, music (never modified after upload)
  systems/            rules systems installed by the administrator
  backups/            scheduled database copies
```

In Docker this folder is `/data`, the `openvtt-data` volume.
