import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadDice3D } from "../../lib/dice3dLoader";
import { addDie, type DiceHand, handNotation, handSize, MAX_HAND_DICE, MAX_MODIFIER, removeDie, TRAY_DICE } from "../../lib/diceHand";
import { rememberLaunch } from "../../lib/diceLaunch";
import type { Launch } from "../../lib/diceThrow";
import { ErrorMessage } from "../../ui";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

/** Pointer samples older than this do not count towards the speed of the flick. */
const FLICK_WINDOW_MS = 120;
/** Moving the pad less than this and slower than this is a tap, not a throw. */
const TAP_DISTANCE = 24;
const TAP_SPEED = 200;

interface Props {
  /** Rolls the notation on the server; resolves true when it was accepted. */
  onRoll: (notation: string, gmOnly: boolean) => Promise<boolean>;
  /** The last failure of a roll, shown inside the tray. */
  error: unknown;
  onClose: () => void;
}

interface Sample {
  x: number;
  y: number;
  time: number;
}

/**
 * Pick dice, then throw them: drag the pad onto the table and let go (the speed and direction of the flick carry
 * over to the dice), or press the roll button for a plain throw. The server rolls the numbers; the tray only decides
 * how the throw looks, so it can never change a result.
 */
export function DiceTray({ onRoll, error, onClose }: Props) {
  const { t } = useTranslation();
  const [hand, setHand] = useState<DiceHand>({});
  const [modifier, setModifier] = useState(0);
  const [gmOnly, setGmOnly] = useState(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const pad = useRef<HTMLDivElement>(null);
  const samples = useRef<Sample[]>([]);
  const notation = handNotation(hand, modifier);
  const full = handSize(hand) >= MAX_HAND_DICE;

  // The 3D dice are a separate download; starting it now means the first throw does not wait for it.
  useEffect(() => void loadDice3D().catch(() => undefined), []);

  const throwWith = (launch: Launch) => {
    if (!notation) return;
    rememberLaunch(launch);
    void onRoll(notation, gmOnly);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!notation) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    samples.current = [{ x: event.clientX, y: event.clientY, time: event.timeStamp }];
    setDrag({ dx: 0, dy: 0 });
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const first = samples.current[0];
    if (!drag || !first) return;
    samples.current.push({ x: event.clientX, y: event.clientY, time: event.timeStamp });
    setDrag({ dx: event.clientX - first.x, dy: event.clientY - first.y });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const first = samples.current[0];
    setDrag(null);
    if (!first) return;
    const recent = samples.current.filter((s) => event.timeStamp - s.time <= FLICK_WINDOW_MS);
    const from = recent[0] ?? first;
    const seconds = Math.max((event.timeStamp - from.time) / 1000, 0.016);
    const vx = (event.clientX - from.x) / seconds;
    const vy = (event.clientY - from.y) / seconds;
    samples.current = [];
    const moved = Math.hypot(event.clientX - first.x, event.clientY - first.y);
    if (moved < TAP_DISTANCE && Math.hypot(vx, vy) < TAP_SPEED) return;
    throwWith({ x: event.clientX, y: event.clientY, vx, vy });
  };

  // The button throws from the pad, up the screen, like a gentle toss.
  const plainThrow = () => {
    const box = pad.current?.getBoundingClientRect();
    throwWith({
      x: box ? box.left + box.width / 2 : window.innerWidth / 2,
      y: box?.top ?? window.innerHeight - 200,
      vx: (Math.random() - 0.5) * 400,
      vy: -1100,
    });
  };

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the group only listens for Escape so the tray closes from any control inside it
    <div
      role="group"
      aria-label={t("dice.title")}
      onKeyDown={closeOnEscape}
      className="absolute bottom-24 left-1/2 z-30 grid w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 gap-3 rounded-panel bg-surface p-3 text-ink shadow-float max-sm:top-32 max-sm:bottom-auto max-sm:left-4 max-sm:w-[calc(100%-2rem)] max-sm:translate-x-0"
    >
      <div className="flex items-center justify-between gap-2">
        <strong>{t("dice.title")}</strong>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("dice.close")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("dice.pick")}>
        {TRAY_DICE.map((sides) => (
          <Button
            key={sides}
            variant="secondary"
            size="sm"
            disabled={full}
            onClick={() => setHand((h) => addDie(h, sides))}
            aria-label={t("dice.add", { sides, count: hand[sides] ?? 0 })}
          >
            d{sides}
          </Button>
        ))}
      </div>

      {notation && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("dice.inHand")}>
          {TRAY_DICE.filter((sides) => (hand[sides] ?? 0) > 0).map((sides) => (
            <Button
              key={sides}
              variant="ghost"
              size="sm"
              onClick={() => setHand((h) => removeDie(h, sides))}
              aria-label={t("dice.remove", { count: hand[sides], sides })}
            >
              {hand[sides]}d{sides}
              <span aria-hidden="true"> ✕</span>
            </Button>
          ))}
          <Button variant="link" size="sm" onClick={() => setHand({})}>
            {t("dice.clear")}
          </Button>
        </div>
      )}

      <div
        ref={pad}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => {
          setDrag(null);
          samples.current = [];
        }}
        style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
        className={`grid min-h-20 touch-none select-none place-items-center rounded-xl border-[1.5px] border-line border-dashed bg-surface-2 px-3 text-center ${
          notation ? "cursor-grab active:cursor-grabbing" : "text-ink-2"
        } ${drag ? "relative z-50 shadow-float" : ""}`}
      >
        {notation ? (
          <span>
            <b className="block text-lg tabular-nums">{notation}</b>
            <span className="text-ink-2 text-sm">{t("dice.dragHint")}</span>
          </span>
        ) : (
          <span>{t("dice.empty")}</span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("dice.modifier")} className="w-24">
          {(control) => (
            <Input
              {...control}
              type="number"
              inputMode="numeric"
              min={-MAX_MODIFIER}
              max={MAX_MODIFIER}
              value={modifier}
              onChange={(e) => setModifier(Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, Math.trunc(Number(e.target.value)) || 0)))}
            />
          )}
        </Field>
        <Field label={t("chat.gmOnly")} inline>
          {(control) => <Checkbox {...control} checked={gmOnly} onChange={(e) => setGmOnly(e.target.checked)} />}
        </Field>
        <Button className="ml-auto" disabled={!notation} onClick={plainThrow}>
          {t("dice.roll")}
        </Button>
      </div>
      <ErrorMessage error={error} />
    </div>
  );
}
