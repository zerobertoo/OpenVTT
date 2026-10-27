import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { RollResult } from "@openvtt/sdk";
import type { MessageDto, WorldStateDto } from "@openvtt/shared";
import { api } from "../api";
import { ErrorMessage, useAction } from "../ui";

function RollView({ roll }: { roll: RollResult }) {
  return (
    <span className="roll">
      {roll.parts.map((part, i) => (
        <span key={i}>
          {part.sign < 0 ? "− " : i > 0 ? "+ " : ""}
          {part.count}d{part.sides}{" "}
          [{part.results.map((r, j) => (
            <span key={j} className={part.kept.includes(j) ? "kept" : "dropped"}>{r}{j < part.results.length - 1 ? ", " : ""}</span>
          ))}]{" "}
        </span>
      ))}
      {roll.modifier !== 0 && <span>{roll.modifier > 0 ? "+" : "−"} {Math.abs(roll.modifier)} </span>}
      = <strong>{roll.total}</strong>
    </span>
  );
}

function Message({ message, locale }: { message: MessageDto; locale: string }) {
  const { t } = useTranslation();
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(message.createdAt);
  const tags = [message.toUserId ? t("chat.whisperTag") : null, message.gmOnly ? t("chat.gmOnlyTag") : null].filter(Boolean);
  return (
    <li className={`message ${message.kind}`}>
      <span className="muted">{time}</span> <strong>{message.senderName}</strong>
      {tags.length > 0 && <em className="muted"> ({tags.join(", ")})</em>}
      {": "}
      {message.roll ? <><span className="muted">{message.roll.notation}</span> → <RollView roll={message.roll} /></> : message.content}
    </li>
  );
}

export function ChatPanel({ state, userId, locale }: { state: WorldStateDto; userId: string; locale: string }) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const [draft, setDraft] = useState("");
  const [recipient, setRecipient] = useState("");
  const [gmOnly, setGmOnly] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state.messages.length]);

  // Players may only whisper the GM (the server enforces it too).
  const recipients = state.members.filter((m) => m.userId !== userId && (state.yourRole === "gm" || m.role === "gm"));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const sent = await run(() => api.sendMessage(state.id, { content: draft, toUserId: recipient || null, gmOnly }));
    if (sent) setDraft("");
  };

  return (
    <section aria-label={t("chat.title")} className="chat">
      <ul className="plain messages" ref={listRef} aria-live="polite">
        {state.messages.map((m) => <Message key={m.id} message={m} locale={locale} />)}
      </ul>
      <form onSubmit={submit}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("chat.placeholder")} aria-label={t("chat.placeholder")} maxLength={2000} />
        <div className="row">
          <label>
            <span className="muted">{t("chat.to")}</span>
            <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="">{t("chat.everyone")}</option>
              {recipients.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
            </select>
          </label>
          <label className="inline"><input type="checkbox" checked={gmOnly} onChange={(e) => setGmOnly(e.target.checked)} /> {t("chat.gmOnly")}</label>
          <button type="submit">{t("chat.send")}</button>
        </div>
        <ErrorMessage error={error} />
      </form>
    </section>
  );
}
