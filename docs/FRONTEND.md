# Frontend plan

How the OpenVTT client is organized, which tools it uses, and the order in which the remaining pieces get built. Visual language, tokens and accessibility rules live in `DESIGN.md`; planned features live in `docs/ROADMAP.md`. This file is the build plan that connects them.

Status: **approved**; implementation follows section 5. Nothing in here is implemented yet except what is marked "exists".

Dependency policy (decided by the project owner): bundle size is not a concern for the app itself, because the platform is meant to be robust. Prefer a well-maintained library when it speeds up development or helps the code scale, over hand-rolling. Weight is kept in check only by lazy-loading heavy parts (map, 3D dice) so the sign-in route stays fast. Licenses must be compatible with AGPL-3.0.

## 1. Principles

1. One primitive per job. A screen never styles a raw `<button>` or `<input>`; it uses the primitive.
2. Radix for behavior that is hard to get right (focus trapping, roving tabindex, dismissal, live regions). Native elements where the platform already does it well (`select`, `input`, `textarea`, `checkbox`, `details`).
3. Server state in TanStack Query, live table state in the WebSocket hook, everything else in local component state. No global store until a real need shows up.
4. Every component ships with: a story, a unit/component test for its behavior, and an axe check, in light and dark.
5. Accessibility is part of "done": 4.5:1 contrast in both themes, visible keyboard focus, correct roles, `prefers-reduced-motion` respected.
6. Players on phones are first-class: touch targets of at least 44 px, bottom sheet under 52rem, no hover-only information.
7. Nothing is copied from proprietary VTTs. Map formats are read from public specifications or sample files only.

## 2. Component inventory

Legend for **Source**: *Radix* = wraps a Radix primitive, *native* = styled platform element, *own* = hand-written.
Everything lives in `packages/client/src/components/`: `ui/` for primitives, `table/` for table composites, `screens/` for full pages.

### 2.1 Primitives (`components/ui/`)

| Component | Responsibility | Variants / sizes | States | Accessibility | Source |
|---|---|---|---|---|---|
| `Button` | Any action | `primary` (teal), `secondary`, `ghost`, `danger`; `sm`, `md`; `icon` (square, requires `aria-label`) | hover, focus-visible, active, disabled, pending (spinner, `aria-busy`) | Real `<button>`; pending keeps width and announces via `aria-busy` | own (cva) |
| `Input`, `Textarea` | Text entry | `md`; `invalid` | focus, disabled, read-only, invalid | Always inside `Field`; `aria-invalid`, `aria-describedby` | native |
| `Field` | Label + control + hint + error | stacked, inline (checkbox/switch) | error, required | `label[for]`, hint and error linked by id, error is `role="alert"` | own |
| `Select` | Pick one from a short list | `md` | focus, disabled, invalid | Native `<select>` (decided); custom arrow only | native |
| `Checkbox` | Boolean in forms | default | checked, indeterminate, disabled | Native input | native |
| `Switch` | Boolean that applies immediately | default | on, off, disabled | Native checkbox with `role="switch"` | native |
| `Card` | Grouped content on a surface | `plain`, `interactive` (whole card is a link/button) | hover, focus | Heading level chosen by caller | own |
| `Avatar` | Person or token picture with initial fallback | `sm`, `md`; optional online dot | image loading, fallback, online | Decorative by default; name given by neighbor text | Radix Avatar |
| `AvatarStack` | Overlapping avatars with "+N" | max 5 | overflow | Group labelled with the count | own |
| `Badge` | Short status or role label ("Game master", "Hidden") | `neutral`, `accent`, `dice`, `danger` | none | Text, never color only | own |
| `Tooltip` | Names an icon-only control | `top`, `bottom` | open on focus and hover | Radix handles `aria-describedby`, Esc | Radix (exists as `Tip`) |
| `Tabs` | Panel switching | vertical (drawer), horizontal (sheet sections) | selected, focus | tablist/tab/tabpanel, arrows | Radix (exists, inline in `Table`) |
| `Dialog` | Modal task or confirmation | `sm` (confirm), `md` (form); bottom sheet under 52rem | open, closing | Focus trap, return focus, Esc, `aria-labelledby` | Radix |
| `ConfirmDialog` | Destructive confirmation built on `Dialog` | `danger` | pending | Default focus on the safe action | own on Radix |
| `Popover` | Small floating form or help | default | open | Focus managed, Esc closes | Radix |
| `DropdownMenu` | Row/overflow actions | default | open, item disabled | Menu roles, typeahead, arrows | Radix |
| `Toast` | Non-blocking feedback ("Link copied", "Reconnected") | `info`, `success`, `error` | auto-dismiss, hover pause | Polite live region; errors that need action stay in the page, not only in a toast | Radix Toast |
| `Skeleton` | Loading placeholder | line, block, circle | pulsing (static under reduced motion) | `aria-hidden`; the container carries `aria-busy` | own |
| `Spinner` | Short pending indicator | `sm`, `md` | spinning | `role="status"` with text only when it stands alone | own |
| `EmptyState` | Explains an empty list and offers the next step | with/without action | none | Heading + one primary action | own |
| `ErrorState` | Failed load with retry | inline, full-page | retrying | `role="alert"` | own |
| `Icon` | Line icon on a 24 px grid | name set in `icons.tsx` | none | `aria-hidden`; caller gives text | own (exists) |
| `VisuallyHidden` | Text for screen readers only | none | none | none | Radix |
| `Toolbar` | Group of tools with one tab stop | horizontal | pressed (`aria-pressed`) | Roving tabindex, arrow keys | Radix Toolbar |

Not wrapped on purpose: scroll areas (native scrolling), selects (native), date pickers (`<input type="date">`), command palette (not needed).

### 2.2 Table composites (`components/table/`)

| Component | Responsibility | Variants | States | Accessibility | Source |
|---|---|---|---|---|---|
| `TitleChip` | World name, back button, connection status | normal, disconnected | online, offline | Back button labelled; status is `role="status"` | own (exists in `Table`) |
| `MapToolbar` | Tool dock (select, ruler, later draw/measure) | dock bottom center; under 52rem it sits above the sheet handle | tool active | `Toolbar`, shortcut shown in tooltip | Radix Toolbar |
| `Drawer` | Right panel with tab strip; bottom sheet when narrow | open, hidden, expanded (sheet) | animating | `aside` landmark, Radix Tabs, toggle with `aria-expanded` | Radix Tabs + motion (exists) |
| `OnlineChip` | Who is here now | collapsed, expanded list | none | Text count, not only avatars | own (exists) |
| `ChatMessage` | One bubble: text, whisper, system, roll | `own`, `other`, `system`, `whisper`, `roll` | sending, failed | Inside the `aria-live="polite"` log; author and time in text | own (exists in `ChatPanel`) |
| `DiceRoll` | Animated roll card with notation, dice and total | per die: kept, dropped, crit, fumble | tumbling, settled | Dice `aria-hidden`; visually hidden sentence "2d20kh1 + 5 = 23"; nat 20/1 written out | own (exists) |
| `ChatComposer` | Message box with roll shortcuts | default | pending, error, disconnected (disabled with reason) | Labelled textarea, Enter sends, Shift+Enter newline | own |
| `TokenRow` | One token in the list: avatar, name, controllers, visibility | selected, hidden (faded and labelled) | selected, controlled-by-you | Button with accessible name "Goblin, hidden"; keyboard select | own |
| `TokenEditor` | Edit the selected token | GM full, player limited | saving | Fields via `Field` | own (exists in `TokenPanel`) |
| `SheetField` | One field of a character sheet by type (number, text, multiline, checkbox, select, computed, later rows) | per field type | read-only, invalid, committing on blur | Label bound; computed uses `<output>` | native, own (exists as `FieldInput`) |
| `SheetView` | Template-driven sheet with sections and roll buttons | read-only, editable | saving, saved | Sections as headings; roll buttons labelled with what they roll | own (exists in `SheetsPanel`) |
| `SceneCard` | Scene thumbnail, name, active badge, actions | active, viewing, idle | uploading | Card with `DropdownMenu` of actions; "Activate" is a real button | own |
| `AssetPicker` | Choose or drop an image (map, token) with preview and size limit | drop zone, button, paste | idle, dragging, uploading, error | File input behind the drop zone, error text, keyboard operable | native + own |
| `MemberList` | Members with role, online state, color | GM sees actions | online, offline | Online written out; role as `Badge` | own |
| `InviteLink` | Show, copy and regenerate the invite link | default | copied, regenerating | Copy button announces via `Toast`; field read-only and selectable | own |
| `AccountBox` | Language and log-out | default | none | Native select for language | own (exists) |
| `RollButton` | Quick roll chip ("d20", "d6") | die kinds | rolling | Labelled "Roll d20" | own |

### 2.3 Screens and states (`components/screens/`)

| Screen | Contents | States to design and test |
|---|---|---|
| Signed-out (login / register) | Welcome text, `Field`s, toggle between modes, first-user hint | idle, pending, wrong credentials, server error, registration closed, language switch |
| World list | World cards (role badge), create form (`Dialog` on narrow screens), import world, install system (admin) | loading skeleton, empty (first world), error with retry, creating, import failed |
| Join invite | Display name, color, join | invalid or expired code, already a member (go straight to the world), pending |
| Table | Map + chrome + drawer | loading, connecting, connected, disconnected (banner, composer disabled, auto-retry), no scene (GM: "add a scene", player: "waiting for the game master"), world not found, no access, kicked |
| Panels | Chat, Tokens, Sheets, Scenes, World | each: loading, empty, error, read-only for players |
| App-level | Error boundary, 404, session expired (back to sign-in keeping the target URL) | rendered in a story and in e2e |

## 3. Technology stack

Each row is final unless a later step proves it wrong; changing it means updating this file.

| Area | Decision | Why | Not using |
|---|---|---|---|
| UI framework | React 18, Vite | Exists; no SSR needed (self-hosted SPA behind Fastify) | Next.js, Remix, TanStack Start |
| Routing | **TanStack Router**, code-based route tree, lazy table route | Typed params and search; the table chunk (Pixi, motion) stays out of the sign-in bundle. Five routes do not need the file-based plugin | React Router, file-based routing plugin |
| Server data | **TanStack Query** for `me`, worlds, systems, system info, mutations with invalidation | Replaces ad-hoc `useEffect` fetches and `useAction`; caching, retry, pending states for free | SWR, hand-rolled hooks |
| Live table state | Existing `useWorldState` over WebSocket | Server-pushed state does not fit request/response caching | Putting the socket into Query |
| Client state | **Zustand** for table UI state (selected tool, selection, drawer, shortcuts); `useState` for local state | Avoids prop drilling between map, drawer and toolbar; works outside React (Pixi handlers) | Redux, Jotai |
| Forms | **TanStack Form** + **zod** (schemas shared with the server through `@openvtt/shared` where possible) | Typed fields, per-field validation and errors feeding `Field`; one schema validates both sides | React Hook Form, uncontrolled `FormData` for anything non-trivial |
| Styling | Tailwind v4, oklch tokens (exists), `cva` + `clsx` + `tailwind-merge` (`cn` helper) | Variants stay readable and callers can safely override classes | CSS-in-JS |
| Accessible widgets | `radix-ui` (exists) | Behavior we should not hand-roll | Headless UI, Ark, MUI |
| Icons | **lucide-react** (per-icon imports) behind the `Icon` component; the d20 logo and any custom glyph stay in `icons.tsx` | Large consistent set, one stroke weight, no drawing each icon by hand | Icon fonts, mixing several icon sets |
| 2D animation | `motion` (UI), Pixi ticker (map), `canvas-confetti` (nat 20, lazy) | Already in use | GSAP, react-spring, Lottie |
| 3D dice | Later, lazy chunk: `three` + a small physics engine (`@dimforge/rapier3d-compat`), rendered into an offscreen canvas over the chat or map | Real physics, no heavy engine. Decided when the item is scheduled, after measuring the bundle cost | Babylon, Unity-style engines, loading it on the sign-in route |
| Map | Pixi v8 (exists) | | Canvas 2D by hand, Konva |
| i18n | i18next + react-i18next (exists), `Intl` for dates and numbers via one `useFormat` hook | | A second formatting library |
| Unit and component tests | **Vitest** + `@testing-library/react` + `user-event` + `jsdom` | Same runner as the server; tests read like user behavior | Jest, Enzyme, snapshot tests of markup |
| Accessibility tests | `vitest-axe` in component tests; `@axe-core/playwright` in e2e | Catches roles, names and contrast regressions early (jsdom cannot compute contrast; e2e does) | Manual-only checks |
| End-to-end | **Playwright** against `pnpm start` with a temporary `OPENVTT_DB`, projects: desktop Chromium, Pixel-class mobile, dark scheme | Real browser, real server, real WebSocket | Cypress, mocking the API in e2e |
| Component catalog | **Storybook** (React + Vite), addons: a11y (axe), docs, interactions, viewport; light/dark toolbar toggle; one story file per component | Mature ecosystem, axe panel per story, interaction tests that run in CI, and the catalog doubles as living documentation | Ladle (lighter, but fewer addons) |
| Visual regression | Playwright `toHaveScreenshot` on a short list of Storybook stories and screens, Linux CI only, added last | Cheap once stories exist; kept small to avoid flaky baselines | Hosted services (Chromatic, Percy) unless the project later wants them |
| Lint and format | **Biome** (lint, format, a11y rules), one config at the root | One fast tool instead of ESLint + Prettier + plugins | ESLint/Prettier stack |
| Types | TypeScript strict (exists), shared DTOs from `@openvtt/shared` | | |
| Bundle and performance | `vite build` output checked by a small script against budgets (sign-in route JS gzip, table route JS gzip) in CI; `rollup-plugin-visualizer` on demand | A budget catches regressions; no extra service | Lighthouse CI, size-limit |
| Logging | None in the client beyond the dev console | | Third-party analytics or telemetry |

CI gains: `pnpm lint`, client Vitest, a Playwright job (Linux, Chromium only), and the bundle budget. Existing checks stay (`check:i18n`, `typecheck`, `test`, `build`).

## 4. Gaps and decisions

**Now** = scheduled in section 5. **Later** = wanted, designed after the "now" work lands. **No** = deliberately out of scope.

| Item | Decision | Notes |
|---|---|---|
| Phone layout of the table | **Now** | Bottom sheet exists; verify every panel at 360 px; 44 px targets |
| Touch on the map (pinch zoom, two-finger pan, long press for context, `touch-action`) | **Now** | Pixi pointer events; ruler by drag; tap to select |
| Keyboard shortcuts | **Now** (small set) | `V` select, `R` ruler, `T` toggle drawer, `/` focus chat, `?` shortcut help dialog. Rebinding is **later** |
| Keyboard play on the map | **Now** | Tab to a token, arrows move one cell when you may control it (this is also the screen-reader path) |
| Reduced motion | **Now** | Already honored in motion and Pixi; audit confetti and add to the checklist for new animation. A manual in-app override is **later** |
| Screen readers on map and dice | **Now** | Token list as the accessible map, polite announcements for moves ("Goblin moved to B4"), dice sentence (exists) |
| Reconnect and offline | **Now** (reconnect only) | Backoff reconnect, `world.resync`, banner, disabled composer with a reason. Offline mode and PWA install: **No** |
| Dates and numbers per locale | **Now** | Single `useFormat` hook over `Intl`; no hand-formatted strings |
| Game master vs player in the UI | **Now** | One `useCan()` helper. Rule: hide what a role can never do, disable with a reason what is temporarily unavailable |
| Onboarding for first-time users | **Now** (light) | Useful empty states with one next action, a short "how a table works" popover, shortcut help. Guided tour: **later**. Video: **No** |
| Upload map and token image | **Now** | `AssetPicker` (drag, paste, preview, size limit); scene upload exists, token image added |
| Toasts, error boundary, 404, session expiry | **Now** | Part of the infrastructure and screen steps |
| Light/dark manual toggle | **Later** | Browser preference stays the default |
| Map import (`.dd2vtt`/`.uvtt`, Dungeon Alchemist, Foundry-style JSON) | **Later** | Order and rules in `docs/ROADMAP.md`; UI is an import `Dialog` in the Scenes panel |
| Walls, doors, lights, fog and vision | **Later** | Needs the scene model from the roadmap first |
| Initiative and combat tracker | **Later** | `TokenRow` keeps a slot for an initiative value |
| Notes and journal | **Later** | |
| Music and ambient sound | **Later** | Local files and a shared volume; streaming-service integrations: **No** |
| Sheet printing | **Later** | `@media print` stylesheet for `SheetView` |
| Per-world theme (accent color) | **Later** | Must keep 4.5:1; the token set is ready for one override |
| 3D physics dice | **Later** | Roadmap item; lazy chunk |
| Map pings, measurement templates (cone, circle), undo | **Later** | |
| Drag a token from the list onto the map | **Later** | |
| Windowed chat history | **Later** | TanStack Virtual when history is long (roadmap); adopt as soon as a long-history test shows jank |
| Voice, video, screen share | **No** | Tables already use Discord, Meet or similar |
| Command palette | **No** | Too few commands to justify it |
| Right-to-left layouts | **No** | Until a RTL locale is requested; logical CSS properties are used so it stays possible |
| Telemetry and analytics | **No** | Self-hosted and privacy-first |
| Marketplace or in-app store | **No** | |

## 5. Implementation order

Each step is one commit (Conventional Commits, English, no AI mention) and must leave the app working. After every step: `pnpm typecheck`, `pnpm test`, `pnpm check:i18n`, plus a check in the browser (`pnpm start`, `localhost:3000`, temporary `OPENVTT_DB` and a test account) in light and dark, desktop and phone width. Files are added to git by name; `docs/PRD.md` stays local.

### Phase A: infrastructure

1. `chore: add Biome for linting and formatting` (config, `pnpm lint`, CI step; formatting applied in the same commit)
2. `test(client): add Vitest, Testing Library and axe` (first tests: `ErrorMessage`, `useAction`; CI runs them)
3. `feat(client): add TanStack Query and move REST data to it` (provider, `me`, worlds, systems, world system info; world-list mutations. `useAction` stays for panel actions whose result arrives over the WebSocket). Zustand arrives with the Table refactor (step 16) and TanStack Form with the first real form (step 9).
4. `feat(client): add TanStack Router with a lazy table route` (replaces `usePath`; typed `/`, `/join/$code`, `/world/$worldId`; `redirect` to sign-in keeps the target)
5. `test(e2e): add Playwright smoke tests` (register, create world, open table, send a chat roll; desktop and phone; axe on each screen; CI job)
6. `chore(client): add Storybook component catalog` (a11y addon, light/dark and width controls, story convention, `pnpm catalog`)
7. `chore: add bundle size budget check` (script and CI step; baseline recorded)

### Phase B: primitives (each with story, test and axe; usages migrated in the same commit)

8. `feat(client): add cn helper and Button` (variants, pending state; replaces raw buttons)
9. `feat(client): add Field, Input, Textarea, Select, Checkbox and Switch`
10. `feat(client): add Card, Badge, Avatar and AvatarStack`
11. `feat(client): add Skeleton, Spinner, EmptyState and ErrorState`
12. `feat(client): add Dialog and ConfirmDialog` (Radix)
13. `feat(client): add Popover and DropdownMenu` (Radix)
14. `feat(client): add Toast` (Radix; used for copy, reconnect, save errors)
15. `feat(client): extract Tabs and Toolbar wrappers` (moves what is inline in `Table`)

### Phase C: composites and panels

16. `refactor(client): extract Drawer, TitleChip and MapToolbar from Table`
17. `feat(client): extract ChatMessage, DiceRoll and ChatComposer` (live region test)
18. `feat(client): redesign Tokens panel` (`TokenRow`, `TokenEditor`, token image through `AssetPicker`, accessible list)
19. `feat(client): redesign Sheets panel` (`SheetField`, `SheetView`, saved/saving state)
20. `feat(client): redesign Scenes panel` (`SceneCard`, `AssetPicker`, menu actions)
21. `feat(client): redesign World panel` (`MemberList`, `InviteLink`, `AccountBox`)

### Phase D: map interaction, resilience and polish

22. `feat(client): touch gestures on the map` (pinch, two-finger pan, tap, `touch-action`)
23. `feat(client): keyboard shortcuts and token keyboard movement` (shortcut help dialog, move announcements)
24. `feat(client): reconnect with backoff and disabled-when-offline controls`
25. `feat(client): format dates and numbers through useFormat` and `useCan` permission helper

### Phase E: screens

26. `feat(client): redesign the signed-out screen`
27. `feat(client): redesign the world list`
28. `feat(client): redesign the join-invite screen`
29. `feat(client): table loading, empty and error states` (not found, no access, kicked, error boundary, 404, session expiry)
30. `feat(client): first-run guidance` (empty-state actions, "how a table works" popover)
31. `test(e2e): visual regression on key stories and screens` (Linux CI baselines, short list)

After step 31, update `DESIGN.md` (components, catalog, test commands) and move finished items out of `docs/ROADMAP.md`. Later items from section 4 get their own plan when scheduled.

## 6. UX rules for loading, empty and error states

Applied from the first screen that touches them, reviewed with the `impeccable` skill (critique and harden passes) at the end of phases B and E.

- **Content-shaped waits get a skeleton** (lists, cards, sheets, chat history): same layout as the real content so nothing jumps when it arrives. Delay showing it by ~150 ms to avoid a flash on fast loads.
- **Short actions get inline pending state** on the control that triggered them (button spinner, `aria-busy`), never a full-page spinner.
- **Refetching keeps the old data visible**; show a subtle indicator, not a blank state.
- **Every empty list explains itself and offers the next step** (`EmptyState`).
- **Every failed load says what happened in plain words and offers a retry** (`ErrorState`); mutation errors appear next to the control that caused them.
- **Disconnected means read-only with a reason**, not silently broken.
- Skeletons and spinners respect `prefers-reduced-motion` (static placeholder).

Until the `Skeleton` primitive lands (step 11), screens still show plain "Loading…" text; step 11 replaces every one of them.

## 7. Definition of done for a component

- Props typed, no `any`; variants through `cva`; tokens only (no raw colors).
- Story covering every variant and state, visible in light and dark.
- Test of the behavior a user relies on (keyboard, disabled, error) and an axe check.
- Text through i18n (`en`, `pt-br`); `pnpm check:i18n` passes.
- Verified in the browser at desktop and 360 px width, light and dark, keyboard only once.
