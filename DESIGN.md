# OpenVTT design

OpenVTT is an independent project: it does not use its author's personal branding or imitate other VTTs.

## Direction

Welcoming and communal, clear for someone who has never used a VTT, without clichéd fantasy styling (no parchment, no ornate fonts). The table is the star; the interface stays quiet around it.

- **Tone of text:** plain, friendly, second person ("You are not part of any world yet."). No jargon; "game master" and "player" are spelled out.
- **Typography:** the system UI font stack, so it is fast, readable and localized for free.
- **Shape:** soft corners (0.4rem), thin borders, no heavy shadows.
- **Icon/logo:** to be drawn; it must stay recognizable at 16 px (a simple d20 silhouette in the accent color is the working idea).

## Palette

Tokens live in `packages/client/src/styles.css`. Light and dark follow the browser (`prefers-color-scheme`).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` | `#2f7d6d` | `#5bb8a4` | primary buttons, links, focus ring |
| `--on-accent` | `#ffffff` | `#0f1f1b` | text on accent |
| `--danger` | `#b3322a` | `#ef7d72` | destructive actions, errors |
| `--surface` | `#f6f5f2` | `#1f2124` | sidebar and panels |
| `--border` | 22% of text color | | dividers |

The map canvas is always dark neutral (`#1b1d22`) so map art stands out in both themes.

## Accessibility

- Text/background contrast of at least 4.5:1, checked for both themes.
- Every control is reachable by keyboard; focus is a 3 px accent outline.
- Panels use `tablist`/`tabpanel`; chat is an `aria-live` region.
- Color is never the only signal (online state is also written out, hidden tokens are also faded and listed).
