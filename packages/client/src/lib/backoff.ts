const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/**
 * How long to wait before reconnect attempt number `attempt` (0 for the first retry): doubling up to 30 seconds,
 * with up to a quarter of random jitter so a restarted server is not hit by every client at the same instant.
 */
export function reconnectDelay(attempt: number, random: () => number = Math.random) {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.round(exponential * (0.75 + random() * 0.25));
}
