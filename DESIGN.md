# OpenVTT design

OpenVTT is an independent project: it does not use its author's personal branding or imitate other VTTs.

## Direction

Welcoming and communal, clear for someone who has never used a VTT, without clichéd fantasy styling (no parchment, no ornate fonts). The table is the star; the interface stays quiet around it, and playful where it matters: dice, tokens and panels move.

Decision (from six explored directions): the **stage** layout, the **friendly** language and a committed **color field**.

- **Stage:** the map fills the whole screen. Chrome floats above it: a title chip (top left), a tool dock (bottom center) and a drawer with the panels (right). On narrow screens (below 52rem) the drawer becomes a bottom sheet. The drawer can be hidden to give the map the full width.
- **Friendly:** rounded corners (0.6 / 0.9 / 1.25rem), pill buttons, chat bubbles, tabs with icon and name. Nothing relies on knowing VTT conventions.
- **Color:** teal is the brand and drives actions and focus. Amber marks dice and the active tool. A near-black "chrome" holds the dock, the title chip, the drawer tab strip and roll cards, in both themes.
- **Tone of text:** plain, friendly, second person ("You are not part of any world yet."). No jargon; "game master" and "player" are spelled out.
- **Typography:** rounded system stack (`ui-rounded`, `SF Pro Rounded`, `Segoe UI Variable Text`, `system-ui`), so it is fast, readable and localized for free. Tabular numbers everywhere.
- **Icon/logo:** a d20 silhouette (solid hexagon with a triangle cut in), drawn in `icons.tsx` and `public/favicon.svg`. It stays recognizable at 16 px.

Explorations that led here live in `docs/design-explorations/` (static prototypes, not production code).

## Stack

- React, plain Vite, **Tailwind CSS v4** (`@tailwindcss/vite`). Tokens are CSS variables in `styles.css`; `@theme inline` exposes them as utilities (`bg-surface`, `text-ink-2`, `bg-accent`, `rounded-card`).
- Light and dark follow the browser (`prefers-color-scheme`). Tailwind's `dark:` variant uses the same media query.
- Cascade layers: element defaults in `base`, named components (`.drawer`, `.msg`, `.dock`) in `components`. Utilities written in markup always win over both.
- Rule of thumb: write utilities in markup; add a named class only when the same set repeats three times or the markup is generated (sheet fields).
- Motion uses the `motion` library (drawer, tab panels, chat messages, dice) and `canvas-confetti` (natural 20, loaded on demand). Everything respects `prefers-reduced-motion`.

## Palette

Colors are **oklch** (Tailwind v4's space); each token notes the sRGB hex it came from.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` | `oklch(0.537 0.08 177.2)` (#2f7d6d) | `oklch(0.72 0.094 177.6)` (#5bb8a4) | primary buttons, focus ring, selected tab |
| `--accent-text` | `oklch(0.463 0.072 175.5)` | same as accent | links on the page background |
| `--on-accent` | white | `oklch(0.223 0.023 176.4)` | text on accent |
| `--danger` | `oklch(0.513 0.167 28.1)` | `oklch(0.716 0.142 26.9)` | destructive actions, errors |
| `--surface`, `--surface-2` | white, `oklch(0.971 0.007 174.4)` | `oklch(0.269 0.023 177.2)`, `oklch(0.314 0.027 180.6)` | drawer, cards, inputs |
| `--bg` | `oklch(0.951 0.009 171.8)` | `oklch(0.206 0.017 175.7)` | signed-out and world-list pages |
| `--text`, `--text-2` | `oklch(0.243 0.02 173.5)`, `oklch(0.466 0.028 172.7)` | `oklch(0.957 0.01 174.3)`, `oklch(0.787 0.028 173.5)` | body and secondary text |
| `--line` | `oklch(0.873 0.017 172.6)` | `oklch(0.407 0.035 179.5)` | borders |
| `--dice` | `oklch(0.817 0.14 80.1)` | same | dice results, active tool |
| `--chrome` | `oklch(0.204 0.01 220)` | `oklch(0.163 0.008 181.7)` | floating dock, title chip, roll cards |

The map canvas is always dark neutral (`--map`, #1b1d22) so map art stands out in both themes.

## Accessibility

- Text/background contrast of at least 4.5:1, checked for both themes (links use `--accent-text` on the tinted page background for this reason).
- Every control is reachable by keyboard; focus is a 3 px outline (amber inside dark chrome).
- The drawer uses `tablist`/`tab`/`tabpanel` with roving tabindex and arrow-key navigation; chat is an `aria-live` region.
- Dice are drawn for the eye (`aria-hidden`); a visually hidden line gives the notation and total to screen readers. Natural 20 and natural 1 are also written out, not only colored.
- Color is never the only signal (online state is also written out, hidden tokens are also faded and listed, dropped dice are struck through).
- Animations are decorative and shortened to nothing under `prefers-reduced-motion`.
