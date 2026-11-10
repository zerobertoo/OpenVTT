import type { WorldStateDto } from "@openvtt/shared";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePreferences } from "../../lib/preferences";
import { preloadTable } from "../../lib/preload";
import { Avatar } from "../ui/avatar";
import { Spinner } from "../ui/spinner";

/** The entrance animation plays at least this long, even when everything is already loaded. */
export const ENTRY_MS = 1800;
/** A plain loading bar waits this long before showing, so a table that opens at once never flashes one. */
const BAR_DELAY_MS = 300;
const SPARKS = 20;

interface Props {
  state: WorldStateDto;
  userId: string;
  fallbackName: string;
}

/**
 * Covers the table while it gets ready. It downloads what the table needs (`preloadTable`) and, if the person wants it,
 * plays an entrance for them over that wait. The two do not replace each other: whichever finishes last keeps the cover
 * up, and a loading bar is always there while files are still arriving.
 */
export function RoomEntry({ state, userId, fallbackName }: Props) {
  const { t } = useTranslation();
  const wantsAnimation = usePreferences((p) => p.entryAnimation);
  const solidDice = usePreferences((p) => p.dice3d && p.diceOverlay);
  const reduceMotion = useReducedMotion();
  const animate = wantsAnimation && !reduceMotion;

  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const [loaded, setLoaded] = useState(false);
  const [played, setPlayed] = useState(!animate);
  const [barVisible, setBarVisible] = useState(animate);
  // Only the state at the door matters: the table keeps itself current afterwards.
  const first = useRef(state);

  useEffect(() => {
    let cancelled = false;
    void preloadTable(first.current, solidDice, (done, total) => !cancelled && setProgress({ done, total })).then(
      () => !cancelled && setLoaded(true),
    );
    return () => {
      cancelled = true;
    };
  }, [solidDice]);

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => setPlayed(true), ENTRY_MS);
    return () => clearTimeout(timer);
  }, [animate]);

  useEffect(() => {
    if (animate) return;
    const timer = setTimeout(() => setBarVisible(true), BAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [animate]);

  const me = state.members.find((member) => member.userId === userId);
  const name = me?.displayName ?? fallbackName;
  const percent = Math.round((progress.done / progress.total) * 100);
  const open = !(loaded && played);

  return (
    <AnimatePresence>
      {open && (animate || barVisible) && (
        <motion.div
          key="entry"
          className="room-entry"
          initial={{ opacity: animate ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={animate ? { opacity: 0, scale: 1.08, filter: "blur(6px)" } : { opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {animate ? (
            <div className="entry-stage" aria-hidden="true" style={{ "--color": me?.color } as React.CSSProperties}>
              <span className="entry-halo" />
              <span className="entry-ring" style={{ animationDelay: "0s" }} />
              <span className="entry-ring" style={{ animationDelay: "0.35s" }} />
              <span className="entry-ring" style={{ animationDelay: "0.7s" }} />
              {Array.from({ length: SPARKS }, (_, i) => (
                <span
                  key={i}
                  className="entry-spark"
                  style={
                    {
                      "--angle": `${(i / SPARKS) * 360}deg`,
                      // Uneven distances, sizes and beats, so the sparks read as a swarm and not as a wheel.
                      "--reach": `${5.2 + ((i * 7) % 5) * 0.55}rem`,
                      "--size": `${0.25 + ((i * 3) % 4) * 0.07}rem`,
                      animationDelay: `${0.1 + ((i * 5) % 8) * 0.09}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
              <motion.div
                className="entry-avatar"
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 13, delay: 0.5 }}
              >
                <Avatar name={name} color={me?.color} size="lg" />
              </motion.div>
              <span className="entry-burst" />
            </div>
          ) : (
            <Spinner className="size-6" />
          )}
          <motion.p
            className="entry-title"
            initial={animate ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: animate ? 0.7 : 0, ease: [0.22, 1, 0.36, 1] }}
          >
            {animate ? t("entry.enters", { name }) : t("entry.preparing")}
          </motion.p>
          <div
            role="progressbar"
            aria-label={t("entry.preparing")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="entry-bar"
          >
            <span style={{ "--progress": percent / 100 } as React.CSSProperties} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
