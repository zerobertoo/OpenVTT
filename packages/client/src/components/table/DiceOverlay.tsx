import type { MessageDto } from "@openvtt/shared";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { thrownDice } from "../../lib/dice3dSupport";
import { usePreferences } from "../../lib/preferences";
import { DiceRoll } from "../chat/DiceRoll";

// The 3D library is a separate chunk that only downloads when a roll is thrown with solid dice.
const Dice3D = lazy(() => import("./Dice3D"));
/** Mirrors the throw time in Dice3D without importing it (and the 3D library) up front. */
const THROW_MS = 1300;

/** How long a roll stays on screen after the dice settle. */
export const OVERLAY_MS = 4200;

interface Props {
  messages: readonly MessageDto[];
}

/**
 * Shows the dice of a new roll over the table. It reacts to the messages this client receives, and the server only
 * sends a roll to those allowed to read it, so a whisper or a game master roll is animated for exactly the people
 * who may see it. The result is the server's; the overlay only animates up to it. Skipped when the person turned
 * it off or prefers reduced motion (the chat still shows the result).
 */
export function DiceOverlay({ messages }: Props) {
  const enabled = usePreferences((state) => state.diceOverlay);
  const reduceMotion = useReducedMotion();
  const lastSeen = useRef(messages.at(-1)?.id ?? null);
  const [current, setCurrent] = useState<MessageDto | null>(null);
  const wantsSolid = usePreferences((state) => state.dice3d);
  // Set when WebGL is missing, so that roll (and the next ones) fall back to flat dice.
  const [flat, setFlat] = useState(false);
  const solid = useMemo(() => (wantsSolid && !flat && current?.roll ? thrownDice(current.roll) : null), [wantsSolid, flat, current]);

  useEffect(() => {
    const last = messages.at(-1);
    if (!last || last.id === lastSeen.current) return;
    lastSeen.current = last.id;
    if (!enabled || reduceMotion || last.kind !== "roll" || !last.roll) return;
    setCurrent(last);
    const timer = setTimeout(() => setCurrent(null), OVERLAY_MS);
    return () => clearTimeout(timer);
  }, [messages, enabled, reduceMotion]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      <AnimatePresence>
        {current?.roll && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid justify-items-center gap-1 rounded-panel bg-surface px-5 py-3 text-ink shadow-float"
          >
            <span className="font-semibold text-ink-2 text-sm">{current.senderName}</span>
            {solid ? (
              <Suspense fallback={<DiceRoll roll={current.roll} animate />}>
                <Dice3D dice={solid} onUnavailable={() => setFlat(true)} />
                <motion.b
                  className="roll-total"
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: THROW_MS / 1000 }}
                >
                  {current.roll.total}
                </motion.b>
              </Suspense>
            ) : (
              <DiceRoll roll={current.roll} animate />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
