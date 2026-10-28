---
name: OpenVTT
description: A friendly, quiet interface around a full-screen map; teal drives actions, amber marks dice, near-black chrome floats above the table.
colors:
  accent: "oklch(0.537 0.08 177.2)"
  accent-dark: "oklch(0.72 0.094 177.6)"
  accent-text: "oklch(0.463 0.072 175.5)"
  accent-soft: "oklch(0.923 0.024 176.8)"
  accent-soft-dark: "oklch(0.356 0.039 177.8)"
  on-accent: "oklch(1 0 0)"
  on-accent-dark: "oklch(0.223 0.023 176.4)"
  danger: "oklch(0.513 0.167 28.1)"
  danger-dark: "oklch(0.716 0.142 26.9)"
  dice: "oklch(0.817 0.14 80.1)"
  on-dice: "oklch(0.228 0.039 79.5)"
  crit: "oklch(0.837 0.135 153.4)"
  fumble: "oklch(0.768 0.137 26.6)"
  page-bg: "oklch(0.951 0.009 171.8)"
  page-bg-dark: "oklch(0.206 0.017 175.7)"
  surface: "oklch(1 0 0)"
  surface-dark: "oklch(0.269 0.023 177.2)"
  surface-2: "oklch(0.971 0.007 174.4)"
  surface-2-dark: "oklch(0.314 0.027 180.6)"
  text: "oklch(0.243 0.02 173.5)"
  text-dark: "oklch(0.957 0.01 174.3)"
  text-2: "oklch(0.466 0.028 172.7)"
  text-2-dark: "oklch(0.787 0.028 173.5)"
  line: "oklch(0.873 0.017 172.6)"
  line-dark: "oklch(0.407 0.035 179.5)"
  chrome: "oklch(0.204 0.01 220)"
  chrome-dark: "oklch(0.163 0.008 181.7)"
  chrome-2: "oklch(0.28 0.014 211.2)"
  chrome-line: "oklch(0.366 0.019 180.7)"
  on-chrome: "oklch(0.964 0.008 168.8)"
  on-chrome-2: "oklch(0.811 0.021 173.8)"
  map: "oklch(0.231 0.01 268.2)"
typography:
  display:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Text', system-ui, sans-serif"
    fontSize: "2.2rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Text', system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Text', system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Text', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Text', system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.45
  roll-total:
    fontFamily: "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Text', system-ui, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  sm: "0.6rem"
  md: "0.9rem"
  lg: "1.25rem"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.8rem"
  lg: "1.25rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.1rem"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.1rem"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.1rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 0.85rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  dock-tool-active:
    backgroundColor: "{colors.dice}"
    textColor: "{colors.on-dice}"
    rounded: "{rounded.md}"
    padding: "0.45rem 1rem"
  drawer-tab-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "0.55rem 0.1rem"
  roll-card:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.on-chrome}"
    rounded: "{rounded.md}"
    padding: "0.65rem 0.85rem"
---

# Design System: OpenVTT

OpenVTT is an independent project: it does not use its author's personal branding or imitate other VTTs.

## Overview

**Creative North Star: "The Quiet Game Table"**

The table is the star. The map fills the whole screen and everything else is furniture around it: a title chip, a tool dock and a drawer of panels, all floating above the map and all willing to step aside. The interface is welcoming and communal, written for someone who has never opened a virtual tabletop, and it avoids clichéd fantasy styling entirely (no parchment, no ornate type). It gets playful only where play happens: dice, tokens and panels move.

The system is a committed color field of teal. Teal is the brand and drives actions and focus; amber is reserved for dice and the active tool; a near-black "chrome" holds the floating pieces in both themes so they read over any map art. Shapes are round (pill buttons, rounded cards, chat bubbles), type is the platform's own rounded system face, and nothing relies on knowing VTT conventions.

This was chosen from six explored directions (`docs/design-explorations/`, static prototypes): the **stage** layout, the **friendly** language and the **color field**.

**Key Characteristics:**
- Full-bleed map with floating chrome; the drawer hides to give the map the full width.
- Teal for action and focus, amber for dice and the active tool, nothing else competes.
- Always-dark chrome (dock, title chip, drawer tab strip, roll cards) in light and dark themes.
- Pill buttons, rounded containers, chat bubbles, tabs with icon and name.
- Tone of text: plain, friendly, second person; "game master" and "player" are spelled out.
- Light and dark follow the browser (`prefers-color-scheme`). In `styles.css` each theme-dependent token is one `light-dark(light, dark)` value; `data-theme="light"` or `"dark"` on `<html>` forces a side (used by the component catalog, ready for a manual toggle).

## Colors

A tinted teal-green neutral field, one teal accent, one amber signal, and a cool near-black chrome. All values are oklch (Tailwind v4's space); the frontmatter is the source of truth, and `-dark` entries are the dark-theme counterparts used when `prefers-color-scheme: dark`.

### Primary
- **Table Teal** (`accent`, dark `accent-dark`): primary buttons, focus ring, selected drawer tab, selection highlight, checkbox and range accents.
- **Link Teal** (`accent-text`): links and tags on the tinted page background; deeper than the accent so it clears 4.5:1 there. In dark theme it is the same as `accent-dark`.
- **Mist Teal** (`accent-soft`, dark `accent-soft-dark`): quiet tinted fills.

### Secondary
- **Dice Amber** (`dice`, on `on-dice`): dice results, roll totals, the active tool in the dock, focus ring inside dark chrome. Never used for general actions.

### Tertiary
- **Brick Red** (`danger`, dark `danger-dark`): destructive actions and errors.
- **Natural Green** (`crit`) and **Fumble Coral** (`fumble`): natural 20 and natural 1 on roll cards, always paired with written text.

### Neutral
- **Pale Mint Field** (`page-bg`, dark `page-bg-dark`): signed-out and world-list pages.
- **Surface** and **Surface Tint** (`surface`, `surface-2` and dark pairs): drawer, cards, inputs, and the tinted rows inside them.
- **Deep Forest Ink** (`text`, `text-2` and dark pairs): body and secondary text.
- **Soft Teal Line** (`line`, dark `line-dark`): borders at 1.5px.
- **Night Chrome** (`chrome`, `chrome-2`, `chrome-line`, `on-chrome`, `on-chrome-2`): dock, title chip, drawer tab strip, roll cards, tooltips.
- **Map Slate** (`map`): the canvas background, always dark neutral so map art stands out in both themes.

### Named Rules
**The Amber Is Dice Rule.** Amber appears only on dice, roll totals and the active tool. If something is amber, it is about rolling or about what the cursor will do.

**The Chrome Stays Dark Rule.** Floating chrome is near-black in both themes. It sits on top of unknown map art, so it must not depend on the page theme.

**The Four-and-a-Half Rule.** Text clears 4.5:1 against its background in both themes; that is why links use `accent-text` on the page background.

## Typography

**Display / Body / Label Font:** the rounded system stack `ui-rounded, "SF Pro Rounded", "Segoe UI Variable Text", system-ui, sans-serif`
**Mono:** `ui-monospace, Consolas, monospace` for roll notation and code-like template fields.

**Character:** friendly and fast, because it is the platform's own face: no font download, localized for free, rounded enough to match the shapes. Tabular numbers are on everywhere so totals and timestamps do not jitter.

### Hierarchy
- **Display** (800, 2.2rem, 1.2, -0.02em; 1.8rem on narrow screens): the welcome headline, balanced wrapping.
- **Headline** (700, 1.6rem, -0.02em): page titles.
- **Title** (700, 1.3rem `h2`; 1.05rem `h3`; 0.95rem `h4`): section and panel headings.
- **Body** (400, 1rem, 1.45): everything else; welcome copy is capped at 34ch.
- **Label** (600, 0.9rem): form labels; buttons are 700; dock and tab labels are 0.78rem and 0.68rem.
- **Roll total** (800, 2.4rem, 1, -0.02em, amber): the number on a roll card.

### Named Rules
**The Tabular Rule.** Numbers are tabular everywhere (`font-variant-numeric: tabular-nums` on the root).

## Layout

The table is a **stage**: `.table-stage` is a fixed full-viewport map host, and chrome is absolutely positioned on top. The title chip sits top left, the tool dock bottom center (re-centered over the free map area when the drawer is open, via `--drawer-space`), the online chip top right, and the drawer on the right (26rem wide, inset 0.9rem). The drawer's left strip holds icon-and-name tabs; its panel scrolls.

Below **52rem** the drawer becomes a bottom sheet (up to 62dvh) with a horizontal tab row, the dock moves to the top left under the title chip, and the map hint and online chip are hidden. Players on phones are first-class: touch targets of at least 44px, no hover-only information.

Signed-out and world-list screens are a single centered column (max 40rem) on the page background, with cards stacked at 1rem. Spacing is a loose rem scale (0.25 / 0.5 / 0.8 / 1.25 / 2); forms stack at 0.8rem, rows wrap at 0.5rem.

## Elevation & Depth

Hybrid: tonal layering for content, shadow for anything that floats over the map. Cards and the content surfaces use a soft, teal-tinted ambient shadow; the floating chrome uses a stronger two-layer shadow so it separates from any map. Buttons are flat at rest and gain a teal glow on hover.

### Shadow Vocabulary
- **Card** (`0 1px 2px oklch(0.3 0.04 175 / 0.1), 0 8px 24px oklch(0.3 0.04 175 / 0.12)`; dark theme uses black at 0.4 / 0.35): cards on the page background.
- **Float** (`0 2px 4px oklch(0.1 0.01 180 / 0.3), 0 12px 32px oklch(0.1 0.01 180 / 0.35)`): dock, title chip, drawer, drawer toggle, tooltips.
- **Button hover** (`0 2px 10px` of the accent at 45%): hover response on filled buttons.

### Named Rules
**The Float Over Map Rule.** Anything over the map uses the Float shadow; anything on a page background uses the Card shadow. They are not mixed.

## Shapes

Round and soft. Radii are 0.6rem (inputs, small chips, tooltips), 0.9rem (rows, roll cards, dock buttons) and 1.25rem (cards, the drawer). Buttons and chrome bars are full pills (999px); the dock is a 1.2rem rounded bar. Chat bubbles round three corners at 0.9rem and leave the speaker-side corner at 0.3rem. Avatars are circles; world badges are 0.85rem rounded squares. Borders are 1.5px; whispers use a 2px dashed teal outline. The brand mark is a d20 silhouette (solid hexagon with a triangle cut in) that stays recognizable at 16px (`icons.tsx`, `public/favicon.svg`).

## Components

Components are Tailwind v4 utilities in markup plus a few named classes in `styles.css`; accessible widgets are **Radix UI** primitives wrapped in `components/ui/` (Tabs for the drawer, Tooltip).

### Buttons
- **Shape:** full pill (999px).
- **Primary:** teal fill, `on-accent` text, 700 weight, padding 0.55rem 1.1rem, icon gap 0.45rem.
- **Secondary:** tinted surface with an inset 1.5px line; when `aria-pressed="true"` it fills teal.
- **Danger:** brick red fill; `link` and `link.danger` variants are underlined text.
- **Hover / Focus / Active:** teal glow on hover, scale to 0.96 on press, 3px teal outline with 2px offset on focus (amber inside chrome). Disabled drops to 55% opacity.

### Inputs / Fields
- **Style:** surface fill, 1.5px line border, 0.6rem radius, 0.6rem 0.85rem padding, full width; teal caret.
- **Focus:** the global 3px teal outline. Errors are written text in danger, 600 weight, with `role="alert"`.

### Cards / Containers
- **Corner Style:** 1.25rem.
- **Background:** `surface`, with the Card shadow, 1.25rem padding; stacked cards are 1rem apart. Inner rows use `surface-2` at 0.9rem radius.

### Tool Dock
Floating near-black bar, bottom center. Icon over label buttons, `on-chrome-2` text; hover lifts to `chrome-2`; the active tool (`aria-pressed`) fills dice amber with dark text.

### Drawer
Right-hand panel: a near-black icon-and-name tab strip on the left of a `surface` panel. Selected tab fills teal. Becomes a bottom sheet under 52rem. Panels and chat messages animate in (the `motion` library); everything is shortened to nothing under `prefers-reduced-motion`.

### Chat and Roll Cards
Messages have an avatar in the player's color and a bubble in `surface-2`. Whispers are italic in a dashed teal outline and tagged. Rolls are near-black cards with the notation in mono, drawn dice in amber, struck-through dropped dice, and a large amber total; natural 20 is green and natural 1 coral, and both are also written out. Natural 20 triggers confetti, loaded on demand.

### Title Chip and Online Chip
Near-black pills with the d20 logo, world name (ellipsized) and an amber status; the online chip shows an overlapping avatar stack.

## Do's and Don'ts

### Do:
- **Do** keep the map the largest thing on screen; chrome is small, floating and dismissible.
- **Do** use teal for actions and focus, and amber only for dice and the active tool.
- **Do** write state out as well as coloring it (online state, hidden tokens, dropped dice, natural 20 and 1).
- **Do** keep 4.5:1 contrast in both themes, a visible 3px focus ring, and 44px touch targets.
- **Do** use the Radix wrappers in `components/ui/` for tabs, tooltips and future dialogs, popovers, menus and toasts; keep native `select`, `input` and `checkbox`.
- **Do** write copy in plain second person and spell out "game master" and "player".
- **Do** respect `prefers-reduced-motion`; animations are decorative.

### Don't:
- **Don't** use parchment, ornate or fantasy display fonts, or any clichéd fantasy styling.
- **Don't** copy the look, naming or layout of other VTTs.
- **Don't** put information in hover only, or in color only.
- **Don't** make the chrome follow the page theme; it stays near-black over the map.
- **Don't** hand-style a raw `button` or `input` in a screen; use the primitive or the shared element styles.
- **Don't** add a named CSS class until the same utility set repeats three times (or the markup is generated).
