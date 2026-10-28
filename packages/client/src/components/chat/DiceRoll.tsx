import type { RollPart, RollResult } from "@openvtt/sdk";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

/** How long the dice "tumble" before showing their final faces. */
export const TUMBLE_MS = 650;

/** Counts through random faces for a moment, then settles on `target`. Static when `animate` is false. */
function useTumble(target: number, sides: number, animate: boolean) {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (!animate) {
      setShown(target);
      return;
    }
    const started = performance.now();
    const timer = setInterval(() => {
      if (performance.now() - started >= TUMBLE_MS) {
        setShown(target);
        clearInterval(timer);
      } else {
        setShown(1 + Math.floor(Math.random() * sides));
      }
    }, 70);
    return () => clearInterval(timer);
  }, [animate, target, sides]);
  return shown;
}

function Die({ sides, value, kept, index, animate }: { sides: number; value: number; kept: boolean; index: number; animate: boolean }) {
  const shown = useTumble(value, sides, animate);
  const settled = shown === value;
  const state = !kept
    ? "dropped"
    : sides === 20 && settled && value === 20
      ? "crit"
      : sides === 20 && settled && value === 1
        ? "fumble"
        : "";
  return (
    <motion.span
      className={`die ${state}`}
      initial={animate ? { rotate: -240, scale: 0.4, opacity: 0 } : false}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: animate ? index * 0.08 : 0 }}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        {sides === 6 ? (
          <rect x="4" y="4" width="24" height="24" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        ) : (
          <path d="M16 2l12 7v14l-12 7L4 23V9z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        )}
      </svg>
      <span>{shown}</span>
    </motion.span>
  );
}

/** The dice of a roll and its total. Hidden from assistive technology: the message carries a text summary instead. */
export function DiceRoll({ roll, animate }: { roll: RollResult; animate: boolean }) {
  let index = 0;
  return (
    <div className="roll-dice" aria-hidden="true">
      {roll.parts.map((part: RollPart, i) => (
        <span key={i} className="contents">
          {(i > 0 || part.sign < 0) && <span className="roll-op">{part.sign < 0 ? "−" : "+"}</span>}
          {part.results.map((value, j) => (
            <Die key={j} sides={part.sides} value={value} kept={part.kept.includes(j)} index={index++} animate={animate} />
          ))}
        </span>
      ))}
      {roll.modifier !== 0 && (
        <span className="roll-op">
          {roll.modifier > 0 ? "+" : "−"} {Math.abs(roll.modifier)}
        </span>
      )}
      <span className="roll-op">=</span>
      <motion.b
        className="roll-total"
        initial={animate ? { scale: 0.2, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 14, delay: animate ? TUMBLE_MS / 1000 : 0 }}
      >
        {roll.total}
      </motion.b>
    </div>
  );
}

/** A kept d20 showing 20 or 1, which the table celebrates (or winces at). */
export function naturalD20(roll: RollResult): "twenty" | "one" | null {
  const kept = roll.parts.filter((p) => p.sides === 20).flatMap((p) => p.kept.map((i) => p.results[i]));
  if (kept.includes(20)) return "twenty";
  if (kept.includes(1)) return "one";
  return null;
}
