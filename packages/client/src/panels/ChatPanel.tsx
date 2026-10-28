import type { WorldStateDto } from "@openvtt/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatMessage } from "../components/chat/ChatMessage";
import { useAction } from "../ui";

export function ChatPanel({ state, userId, locale }: { state: WorldStateDto; userId: string; locale: string }) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const listRef = useRef<HTMLUListElement>(null);
  // Messages already on screen when the panel opens are shown still; only later ones animate.
  const seenOnOpen = useRef(new Set(state.messages.map((m) => m.id)));

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state.messages.length]);

  // Players may only whisper the GM (the server enforces it too).
  const recipients = state.members.filter((m) => m.userId !== userId && (state.yourRole === "gm" || m.role === "gm"));
  const colorOf = (id: string) => state.members.find((m) => m.userId === id)?.color;

  return (
    <section aria-label={t("chat.title")} className="chat">
      <ul className="chat-log" ref={listRef} aria-live="polite">
        {state.messages.map((m) => (
          <ChatMessage key={m.id} message={m} locale={locale} color={colorOf(m.userId)} isNew={!seenOnOpen.current.has(m.id)} />
        ))}
      </ul>
      <ChatComposer
        recipients={recipients}
        error={error}
        onSend={async (message) => Boolean(await run(() => api.sendMessage(state.id, message)))}
      />
    </section>
  );
}
