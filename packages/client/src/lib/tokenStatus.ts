import type { TOKEN_CONDITIONS } from "@openvtt/shared";

/** The small picture drawn on the map for each condition; the editor and screen readers use the translated name. */
export const CONDITION_GLYPHS: Record<(typeof TOKEN_CONDITIONS)[number], string> = {
  blinded: "🙈",
  charmed: "💘",
  deafened: "🔇",
  frightened: "😨",
  grappled: "✊",
  incapacitated: "💫",
  invisible: "👻",
  paralyzed: "⚡",
  poisoned: "☠️",
  prone: "⬇️",
  restrained: "⛓️",
  stunned: "🌀",
  unconscious: "💤",
  concentrating: "🎯",
  dead: "💀",
};

/** Share of hit points left, kept between 0 and 1. */
export function healthRatio(hp: number, hpMax: number): number {
  return Math.min(1, Math.max(0, hp / hpMax));
}

/** Bar color: green while healthy, amber when half gone, red when nearly out. */
export function healthColor(ratio: number): number {
  if (ratio > 0.5) return 0x3ddc84;
  return ratio > 0.25 ? 0xffb000 : 0xff4d4d;
}
