# Backup and restore

Everything lives in the data directory (the folder of `OPENVTT_DB`; the `openvtt-data` volume in Docker): the database, `assets/` and `systems/`. See [configuration](configuration.md#where-data-lives).

## What to back up

| Piece | How it changes | How to back it up |
|---|---|---|
| `openvtt.db` | Constantly while playing | Scheduled copies, below. Do not copy the live file with a file tool: use a scheduled copy or stop the server first |
| `assets/` | Only grows; files are never edited after upload | Copy the folder from time to time, or sync it |
| `systems/` | Only when the administrator installs a system | Copy the folder (the bundled systems are in the repository) |

## Scheduled copies

Set `OPENVTT_BACKUP_INTERVAL_HOURS` (for example `24`) and optionally `OPENVTT_BACKUP_KEEP` (default `7`). While the server runs it writes `backups/openvtt-<timestamp>.db` using SQLite's `VACUUM INTO`, which gives a consistent copy even mid-session, and deletes older ones beyond the limit.

These copies live next to the database. **Copy them off the machine** (another disk, a NAS, cloud storage); a backup on the same disk does not survive the disk.

Docker example, copying the backups folder and assets to the host:

```sh
docker run --rm -v openvtt-data:/data -v "$PWD/openvtt-backup":/backup alpine \
  sh -c "cp -r /data/backups /data/assets /backup/"
```

## Backing up a single world

The game master can download a world as a `.openvtt.zip` from the **World** tab and import it on any installation from the worlds list. See [world-file-format.md](world-file-format.md). Accounts, memberships, whispers and GM-only rolls are not included. A readable session log can also be downloaded from the chat as Markdown.

## Restoring

1. Stop the server (`docker compose stop`, or Ctrl+C).
2. Replace `openvtt.db` with the chosen copy.
3. Delete `openvtt.db-wal` and `openvtt.db-shm` if they exist.
4. If `assets/` was lost, put your copy back.
5. Start the server again.

In Docker, with the copy in the current folder:

```sh
docker compose stop
docker run --rm -v openvtt-data:/data -v "$PWD":/backup alpine \
  sh -c "cp /backup/openvtt-<timestamp>.db /data/openvtt.db && rm -f /data/openvtt.db-wal /data/openvtt.db-shm"
docker compose start
```

## Test your backup

A backup you never restored is a hope. Once, start a second copy on another port with `OPENVTT_DB` pointing at a restored file and open a world.
