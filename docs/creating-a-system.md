# Creating a rules system

A rules system is a folder of JSON files that tells OpenVTT what a character sheet looks like. No code is involved. The core knows nothing about any specific RPG: everything game-specific lives in a package.

The format is defined by `@openvtt/sdk` (MIT licensed), so you can license your package however you like. If the game you implement has a restrictive license, say so in `license` and `attribution`, and only include content you are allowed to redistribute.

## Package layout

```
my-system/
  system.json
  templates/
    character.json
    npc.json
  locales/
    en.json
    pt-br.json
  compendium.json   (optional)
```

Look at `systems/generic` for a minimal example and `systems/dnd5e-srd` for a larger one.

## system.json

```json
{
  "id": "my-system",
  "name": "My System",
  "version": "1.0.0",
  "author": "Your name",
  "license": "CC-BY-4.0",
  "attribution": "Optional credit text, shown in the world settings.",
  "minOpenVTT": "0.1.0",
  "actorTypes": {
    "character": { "template": "templates/character.json" },
    "npc": { "template": "templates/npc.json" }
  },
  "locales": ["en", "pt-br"]
}
```

- `id`: lowercase letters, digits and dashes; must be unique in the installation.
- `actorTypes`: the supported kinds of sheet (`character`, `npc`) and the template file of each.
- `locales`: every listed language needs a `locales/<locale>.json` file (at least `en`).

## Sheet templates

A template is a list of sections, each with fields:

```json
{
  "sections": [
    {
      "id": "abilities",
      "label": "abilities",
      "fields": [
        { "id": "str", "type": "number", "label": "str", "default": 10, "min": 1, "max": 30 },
        { "id": "str_mod", "type": "computed", "label": "str_mod", "formula": "floor((@str - 10) / 2)" }
      ]
    }
  ]
}
```

Ids are lowercase letters, digits and underscores, and must be unique across the whole template.

| Field type | Stored value | Options |
|---|---|---|
| `text` | string | `multiline`, `default` |
| `number` | number | `default`, `min`, `max` |
| `checkbox` | boolean | `default` |
| `select` | string | `options: [{ "value", "label" }]`, `default` |
| `list` | array of rows | `itemFields`: a list of non-computed fields |
| `computed` | derived, never stored | `formula` |

### Formulas

Formulas are plain arithmetic evaluated on the sheet values:

- numbers, `@field_id` references, `+ - * / %`, parentheses;
- functions `floor`, `ceil`, `round`, `abs`, `min`, `max`;
- checkboxes count as 1 (checked) or 0, so `@skill_prof * @proficiency` works;
- a formula can reference other computed fields; circular references and division by zero show `—`.

References to unknown fields and syntax errors are rejected when the package is loaded.

### Labels

A `label` is either a key into the system's locale files, or inline text per language:

```json
{ "id": "luck", "type": "number", "label": { "en": "Luck", "pt-br": "Sorte" } }
```

Keys are looked up in the viewer's language, then in `en`, and finally shown as written. World game masters can edit a template for their world directly in the **World** tab and use inline labels there.

## Installing

- Copy the folder into the `systems/` directory of the installation (or `<data dir>/systems/`), then restart; or
- zip the folder contents (so `system.json` is at the root of the zip) and upload it from the world list as an administrator.

Packages may only contain `system.json`, `templates/*.json` and `locales/*.json`. Invalid packages are rejected with the reason written to the server log.

## Checking your work

Load the package in a test world, create a sheet and edit the fields. The SDK exposes `sheetTemplateSchema` and `systemManifestSchema` (zod) if you want to validate files in your own CI.

## compendium.json (optional)

Monsters and items the game master can drag onto the map (or place with a button). A monster becomes an NPC sheet plus a token linked to it; an item becomes a token only.

```json
[
  {
    "id": "goblin",
    "name": "Goblin",
    "kind": "monster",
    "size": 1,
    "color": "#4f7a3a",
    "data": { "str": 8, "dex": 14, "ac": 15, "hp": 7, "hp_max": 7 }
  },
  { "id": "torch", "name": "Torch", "kind": "item", "size": 0.5 }
]
```

- `id`: lowercase letters, digits and dashes, unique in the file.
- `size` is in grid cells (default 1); `color` is the token color when it has no picture.
- `data` must fit the system's `npc` template; the package is refused otherwise. When it has `hp_max`, the token starts with that many hit points.
- Up to 2,000 entries. Only include content you may redistribute (`systems/dnd5e-srd` uses SRD 5.1 monsters under CC-BY-4.0).
