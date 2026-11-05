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
const SPARKS = 16;

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
          exit={{ opacity: 0, scale: animate ? 1.06 : 1 }}
          transition={{ duration: 0.5 }}
        >
          {animate ? (
            <div className="entry-stage" aria-hidden="true">
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
                      animationDelay: `${0.15 + (i % 4) * 0.08}s`,
                      "--color": me?.color,
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
            </div>
          ) : (
            <Spinner className="size-6" />
          )}
          <p className="entry-title">{animate ? t("entry.enters", { name }) : t("entry.preparing")}</p>
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
