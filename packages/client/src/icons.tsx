import type { ReactNode } from "react";

/** Line icons on a 24px grid, drawn with one stroke weight. Decorative: callers provide the accessible text. */
const PATHS = {
  back: <path d="M15 6l-6 6 6 6" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  tokens: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
    </>
  ),
  sheets: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 11h6M9 15h6" />
    </>
  ),
  scenes: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
    </>
  ),
  world: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  select: <path d="M6 3l12 8-5 1.5L10.5 18z" />,
  ruler: (
    <>
      <path d="M3 16L16 3l5 5L8 21z" />
      <path d="M8 11l2 2M11 8l2 2M14 5l2 2" />
    </>
  ),
  play: <path d="M8 5l11 7-11 7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  send: <path d="M4 12l16-8-6 16-3-7z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.5-5 6-5s6 1.5 6 5M16 5a3 3 0 010 6M18 15c2 .6 3 2 3 5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  panelOpen: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </>
  ),
  panelClose: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16M9 10l3 2-3 2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** A d20 silhouette: solid hexagon with a triangle cut into it, still readable at 16 px. */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2l12 7v14l-12 7L4 23V9z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 8.5l6.5 11.5h-13z" fill="none" stroke="var(--on-accent, white)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
