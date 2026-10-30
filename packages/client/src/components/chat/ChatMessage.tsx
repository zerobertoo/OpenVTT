import type { MessageDto } from "@openvtt/shared";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormat } from "../../useFormat";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { DiceRoll, naturalD20, TUMBLE_MS } from "./DiceRoll";

interface Props {
  message: MessageDto;
  /** Sender color, from the member list. */
  color: string | undefined;
  /** Only messages that arrive while the panel is open animate and celebrate. */
  isNew: boolean;
  /** Given for the person's own rolls: throws the same dice again. */
  onRollAgain?: () => void;
  /** Placement from the virtual list. */
  row?: { ref: (element: HTMLElement | null) => void; index: number; top: number };
}

/** One chat line: a plain message, a whisper or a dice roll. */
export function ChatMessage({ message, color, isNew, onRollAgain, row }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const animateDice = isNew && !reduceMotion;
  const time = useFormat().time(message.createdAt);
  const tags = [message.toUserId ? t("chat.whisperTag") : null, message.gmOnly ? t("chat.gmOnlyTag") : null].filter(Boolean);
  const roll = message.roll;
  const natural = roll ? naturalD20(roll) : null;

  useEffect(() => {
    if (!animateDice || natural !== "twenty") return;
    const timer = setTimeout(
      () =>
        void import("canvas-confetti").then((m) =>
          m.default({ particleCount: 90, spread: 70, origin: { x: 0.8, y: 0.6 }, disableForReducedMotion: true }),
        ),
      TUMBLE_MS + 250,
    );
    return () => clearTimeout(timer);
  }, [animateDice, natural]);

  const kind = roll ? "roll" : message.kind === "whisper" || message.toUserId ? "whisper" : "chat";

  return (
    <motion.li
      ref={row?.ref}
      data-index={row?.index}
      style={row && { position: "absolute", top: row.top, left: 0, right: 0 }}
      className={`msg msg-${kind}`}
      initial={isNew && !reduceMotion ? { opacity: 0, y: 14, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <Avatar name={message.senderName} color={color} />
      <motion.div
        className="msg-body"
        animate={animateDice && natural === "one" ? { x: [0, -7, 7, -5, 5, 0] } : undefined}
        transition={{ duration: 0.4, delay: TUMBLE_MS / 1000 }}
      >
        <div className="msg-meta">
          <strong>{message.senderName}</strong>
          <time>{time}</time>
          {tags.length > 0 && <span className="msg-tag">{tags.join(", ")}</span>}
          {natural && (
            <span className="msg-tag" style={{ color: natural === "twenty" ? "var(--crit)" : "var(--fumble)" }}>
              {t(natural === "twenty" ? "chat.naturalTwenty" : "chat.naturalOne")}
            </span>
          )}
        </div>
        {roll ? (
          <>
            <p className="roll-notation">{roll.notation}</p>
            <span className="sr-only">{t("chat.rollSummary", { notation: roll.notation, total: roll.total })}</span>
            <DiceRoll roll={roll} animate={animateDice} />
            {onRollAgain && (
              <Button variant="secondary" size="sm" onClick={onRollAgain}>
                {t("chat.rollAgain")}
              </Button>
            )}
          </>
        ) : (
          <p className="msg-text">{message.content}</p>
        )}
      </motion.div>
    </motion.li>
  );
}
