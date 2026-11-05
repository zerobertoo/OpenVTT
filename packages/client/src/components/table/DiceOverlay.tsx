import type { MessageDto } from "@openvtt/shared";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { loadDice3D } from "../../lib/dice3dLoader";
import { thrownDice } from "../../lib/dice3dSupport";
import { takeLaunch } from "../../lib/diceLaunch";
import { type Launch, randomLaunch } from "../../lib/diceThrow";
import { usePreferences } from "../../lib/preferences";
import { useRollHold } from "../../lib/rollHold";
import { DiceRoll, TUMBLE_MS } from "../chat/DiceRoll";

// The 3D library is a separate chunk that only downloads when a roll is thrown with solid dice.
const Dice3D = lazy(loadDice3D);

/** How long a roll stays on screen after it starts. */
export const OVERLAY_MS = 5200;
/** The flat dice tumble for `TUMBLE_MS` and then pop the total; the result is released a little after that. */
const FLAT_SETTLE_MS = TUMBLE_MS + 300;

interface Props {
  messages: readonly MessageDto[];
  /** Whose rolls were thrown from this browser's tray, so they start at the hand that threw them. */
  userId: string;
}

interface Showing {
  message: MessageDto;
  launch: Launch;
}

/**
 * Shows a new roll over the table. It reacts to the messages this client receives, and the server only sends a roll
 * to those allowed to read it, so a whisper or a game master roll is animated for exactly the people who may see it.
 * The result is the server's; the overlay only animates up to it. With solid dice the dice fly across the whole screen,
 * from the hand that threw them for your own rolls and from the side for everybody else's. Skipped when the person
 * turned it off or prefers reduced motion (the chat still shows the result).
 */
export function DiceOverlay({ messages, userId }: Props) {
  const enabled = usePreferences((state) => state.diceOverlay);
  const wantsSolid = usePreferences((state) => state.dice3d);
  const reduceMotion = useReducedMotion();
  const lastSeen = useRef(messages.at(-1)?.id ?? null);
  const [current, setCurrent] = useState<Showing | null>(null);
  // Set when WebGL is missing, so that roll (and the next ones) fall back to flat dice.
  const [flat, setFlat] = useState(false);
  const onUnavailable = useCallback(() => setFlat(true), []);
  const roll = current?.message.roll;
  const solid = useMemo(() => (wantsSolid && !flat && roll ? thrownDice(roll) : null), [wantsSolid, flat, roll]);

  const [settledId, setSettledId] = useState<string | null>(null);
  const heldId = useRef<string | null>(null);
  const settle = useCallback((id: string) => {
    setSettledId(id);
    useRollHold.getState().release(id);
  }, []);
  const settled = current !== null && settledId === current.message.id;

  // A layout effect, so the chat hides the result before the first paint instead of flashing it.
  useLayoutEffect(() => {
    const last = messages.at(-1);
    if (!last || last.id === lastSeen.current) return;
    lastSeen.current = last.id;
    if (!enabled || reduceMotion || last.kind !== "roll" || !last.roll) return;
    const mine = last.userId === userId ? takeLaunch() : null;
    if (heldId.current) useRollHold.getState().release(heldId.current);
    heldId.current = last.id;
    useRollHold.getState().hold(last.id);
    setCurrent({ message: last, launch: mine ?? randomLaunch({ width: window.innerWidth, height: window.innerHeight }) });
  }, [messages, enabled, reduceMotion, userId]);

  // Its own effect: a chat message arriving mid-animation re-runs the one above and must not cancel this timer.
  useEffect(() => {
    if (!current) return;
    const id = current.message.id;
    const timer = setTimeout(() => {
      settle(id);
      setCurrent(null);
    }, OVERLAY_MS);
    return () => clearTimeout(timer);
  }, [current, settle]);

  useEffect(() => {
    if (!current || solid) return;
    const id = current.message.id;
    const timer = setTimeout(() => settle(id), FLAT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [current, solid, settle]);

  useEffect(
    () => () => {
      if (heldId.current) useRollHold.getState().release(heldId.current);
    },
    [],
  );

  return (
    <>
      <AnimatePresence>
        {solid && current && (
          <motion.div key={current.message.id} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="contents">
            <Suspense fallback={null}>
              <Dice3D dice={solid} launch={current.launch} onUnavailable={onUnavailable} onSettled={() => settle(current.message.id)} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
      <div aria-hidden="true" className="roll-result">
        <AnimatePresence>
          {current?.message.roll && (!solid || settled) && (
            <motion.div
              key={current.message.id}
              initial={{ opacity: 0, y: -16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid justify-items-center gap-1 rounded-panel bg-surface px-5 py-3 text-ink shadow-float"
            >
              <span className="font-semibold text-ink-2 text-sm">{current.message.senderName}</span>
              {solid ? (
                <motion.b
                  className="roll-total"
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14 }}
                >
                  {current.message.roll.total}
                </motion.b>
              ) : (
                <DiceRoll roll={current.message.roll} animate />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
