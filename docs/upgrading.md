# Upgrading

OpenVTT is on 0.x: until 1.0.0 anything can change between versions. Read the [changelog](../CHANGELOG.md) before upgrading, and **back up first** ([backup-and-restore.md](backup-and-restore.md)).

The database schema is migrated automatically when the server starts: ordered migrations run once and are tracked in SQLite's `user_version`. There is no downgrade path, so keep a copy of `openvtt.db` from before the upgrade if you may want to go back.

## Docker

```sh
cd OpenVTT
git pull
docker compose up -d --build
```

The `openvtt-data` volume is kept. Check `docker compose logs -f openvtt` for errors and `curl http://localhost:3000/healthz` for health.

To go back: `git checkout <previous commit>`, restore the pre-upgrade database copy, and rebuild.

## From source

```sh
git pull
pnpm install
pnpm start
```

## After upgrading

- Players should reload their browser tabs to get the new client.
- Rules systems you installed as `.zip` packages are unaffected. Bundled systems in `systems/` update with the repository.
- Exported world files (`.openvtt.zip`) keep importing: importers ignore unknown fields and accept older files ([world-file-format.md](world-file-format.md)).
