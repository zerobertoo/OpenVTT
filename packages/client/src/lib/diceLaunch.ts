import type { Launch } from "./diceThrow";

/** A launch is only for the roll it started; after this long it is assumed that roll never came back. */
const EXPIRES_MS = 6000;

let pending: { launch: Launch; at: number } | null = null;

/** Remembers how the dice were thrown, so the overlay can animate that roll from the hand that threw it. */
export function rememberLaunch(launch: Launch) {
  pending = { launch, at: Date.now() };
}

/** The remembered launch, once: it belongs to the next roll this person sees come back. */
export function takeLaunch(): Launch | null {
  const found = pending && Date.now() - pending.at < EXPIRES_MS ? pending.launch : null;
  pending = null;
  return found;
}
