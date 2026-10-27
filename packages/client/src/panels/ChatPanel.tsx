import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import type { RollPart, RollResult } from "@openvtt/sdk";
import type { MessageDto, WorldStateDto } from "@openvtt/shared";
import { api } from "../api";
import { Icon } from "../icons";
import { ErrorMessage, useAction } from "../ui";

/** How long the dice "tumble" before showing their final faces. */
const TUMBLE_MS = 650;

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
  const state = !kept ? "dropped" : sides === 20 && settled && value === 20 ? "crit" : sides === 20 && settled && value === 1 ? "fumble" : "";
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

function RollDice({ roll, animate }: { roll: RollResult; animate: boolean }) {
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
      {roll.modifier !== 0 && <span className="roll-op">{roll.modifier > 0 ? "+" : "−"} {Math.abs(roll.modifier)}</span>}
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
function naturalD20(roll: RollResult): "twenty" | "one" | null {
  const kept = roll.parts.filter((p) => p.sides === 20).flatMap((p) => p.kept.map((i) => p.results[i]));
  if (kept.includes(20)) return "twenty";
  if (kept.includes(1)) return "one";
  return null;
}

function Message({ message, locale, color, isNew }: { message: MessageDto; locale: string; color: string | undefined; isNew: boolean }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const animateDice = isNew && !reduceMotion;
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(message.createdAt);
  const tags = [message.toUserId ? t("chat.whisperTag") : null, message.gmOnly ? t("chat.gmOnlyTag") : null].filter(Boolean);
  const roll = message.roll;
  const natural = roll ? naturalD20(roll) : null;

  useEffect(() => {
    if (!animateDice || natural !== "twenty") return;
    const timer = setTimeout(() => void import("canvas-confetti").then((m) => m.default({ particleCount: 90, spread: 70, origin: { x: 0.8, y: 0.6 }, disableForReducedMotion: true })), TUMBLE_MS + 250);
    return () => clearTimeout(timer);
  }, [animateDice, natural]);

  const kind = roll ? "roll" : message.kind === "whisper" || message.toUserId ? "whisper" : "chat";

  return (
    <motion.li
      className={`msg msg-${kind}`}
      initial={isNew && !reduceMotion ? { opacity: 0, y: 14, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <span className="avatar" style={{ "--who": color ?? "var(--accent)" } as CSSProperties} aria-hidden="true">{Array.from(message.senderName)[0]?.toUpperCase()}</span>
      <motion.div
        className="msg-body"
        animate={animateDice && natural === "one" ? { x: [0, -7, 7, -5, 5, 0] } : undefined}
        transition={{ duration: 0.4, delay: TUMBLE_MS / 1000 }}
      >
        <div className="msg-meta">
          <strong>{message.senderName}</strong>
          <time>{time}</time>
          {tags.length > 0 && <span className="msg-tag">{tags.join(", ")}</span>}
          {natural && <span className="msg-tag" style={{ color: natural === "twenty" ? "var(--crit)" : "var(--fumble)" }}>{t(natural === "twenty" ? "chat.naturalTwenty" : "chat.naturalOne")}</span>}
        </div>
        {roll ? (
          <>
            <p className="roll-notation">{roll.notation}</p>
            <span className="sr-only">{t("chat.rollSummary", { notation: roll.notation, total: roll.total })}</span>
            <RollDice roll={roll} animate={animateDice} />
          </>
        ) : (
          <p className="msg-text">{message.content}</p>
        )}
      </motion.div>
    </motion.li>
  );
}

export function ChatPanel({ state, userId, locale }: { state: WorldStateDto; userId: string; locale: string }) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const [draft, setDraft] = useState("");
  const [recipient, setRecipient] = useState("");
  const [gmOnly, setGmOnly] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  // Messages already on screen when the panel opens are shown still; only later ones animate.
  const seenOnOpen = useRef(new Set(state.messages.map((m) => m.id)));

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state.messages.length]);

  // Players may only whisper the GM (the server enforces it too).
  const recipients = state.members.filter((m) => m.userId !== userId && (state.yourRole === "gm" || m.role === "gm"));
  const colorOf = (id: string) => state.members.find((m) => m.userId === id)?.color;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const sent = await run(() => api.sendMessage(state.id, { content: draft, toUserId: recipient || null, gmOnly }));
    if (sent) setDraft("");
  };

  return (
    <section aria-label={t("chat.title")} className="chat">
      <ul className="chat-log" ref={listRef} aria-live="polite">
        {state.messages.map((m) => (
          <Message key={m.id} message={m} locale={locale} color={colorOf(m.userId)} isNew={!seenOnOpen.current.has(m.id)} />
        ))}
      </ul>
      <form className="chat-form" onSubmit={submit}>
        <div className="chat-input-row">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("chat.placeholder")} aria-label={t("chat.placeholder")} maxLength={2000} />
          <button type="submit" aria-label={t("chat.send")} title={t("chat.send")}><Icon name="send" /></button>
        </div>
        <div className="chat-options">
          <label>
            <span className="text-ink-2">{t("chat.to")}</span>
            <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="">{t("chat.everyone")}</option>
              {recipients.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
            </select>
          </label>
          <label className="inline"><input type="checkbox" checked={gmOnly} onChange={(e) => setGmOnly(e.target.checked)} /> {t("chat.gmOnly")}</label>
        </div>
        <ErrorMessage error={error} />
      </form>
    </section>
  );
}
