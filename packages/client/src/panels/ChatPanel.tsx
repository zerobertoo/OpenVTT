import type { WorldStateDto } from "@openvtt/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatMessage } from "../components/chat/ChatMessage";
import { useAction } from "../ui";
import { useCan } from "../useCan";

export function ChatPanel({ state, userId }: { state: WorldStateDto; userId: string }) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const listRef = useRef<HTMLUListElement>(null);
  // Messages already on screen when the panel opens are shown still; only later ones animate.
  const seenOnOpen = useRef(new Set(state.messages.map((m) => m.id)));

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state.messages.length]);

  // Players may only whisper the GM (the server enforces it too).
  const can = useCan(state.yourRole, userId);
  const recipients = state.members.filter(can.canWhisperTo);
  const colorOf = (id: string) => state.members.find((m) => m.userId === id)?.color;

  return (
    <section aria-label={t("chat.title")} className="chat">
      <ul className="chat-log" ref={listRef} aria-live="polite">
        {state.messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            color={colorOf(m.userId)}
            isNew={!seenOnOpen.current.has(m.id)}
            onRollAgain={
              m.roll && m.userId === userId
                ? () =>
                    void run(() => api.sendMessage(state.id, { content: `/r ${m.roll!.notation}`, toUserId: m.toUserId, gmOnly: m.gmOnly }))
                : undefined
            }
          />
        ))}
      </ul>
      {can.isObserver || state.members.find((m) => m.userId === userId)?.muted ? (
        <p className="m-0 text-ink-2 text-sm">{t(can.isObserver ? "members.observerChat" : "members.mutedChat")}</p>
      ) : (
        <ChatComposer
          recipients={recipients}
          error={error}
          onSend={async (message) => Boolean(await run(() => api.sendMessage(state.id, message)))}
        />
      )}
      <a className="justify-self-start text-sm text-accent-text underline underline-offset-[3px]" href={api.logUrl(state.id)} download>
        {t("chat.exportLog")}
      </a>
    </section>
  );
}
