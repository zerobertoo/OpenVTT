# World file format

A world is exported as a single zip (`<name>.openvtt.zip`) containing:

```
world.json
assets/<uuid>.<png|jpg|webp>
```

`world.json` has `format: "openvtt-world"` and `version: 1`, plus the world settings (name, system id, sheet template overrides, active scene), `assets`, `scenes`, `actors`, `tokens` and `messages`. Ids inside the file only link records to each other; importing assigns fresh ids.

What is **not** exported, on purpose:

- user accounts and memberships: the importer becomes the game master of the new world, so token controllers and sheet owners are cleared;
- whispers and GM-only rolls.

Import checks the structure, that every reference resolves, that images really are PNG/JPEG/WebP, that sheet data fits the template and that the rules system is installed. Nothing is created if any check fails.
