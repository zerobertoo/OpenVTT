import type { WorldStateDto } from "@openvtt/shared";
import { useVirtualizer } from "@tanstack/react-virtual";
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

  // Only the messages in view are in the page, so a long history stays cheap.
  const rows = useVirtualizer({
    count: state.messages.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 72,
    gap: 12,
    overscan: 6,
    initialRect: { width: 320, height: 640 },
  });
  useEffect(() => {
    if (state.messages.length) rows.scrollToIndex(state.messages.length - 1, { align: "end" });
  }, [state.messages.length, rows]);

  // Players may only whisper the GM (the server enforces it too).
  const can = useCan(state.yourRole, userId);
  const recipients = state.members.filter(can.canWhisperTo);
  const colorOf = (id: string) => state.members.find((m) => m.userId === id)?.color;

  return (
    <section aria-label={t("chat.title")} className="chat">
      <ul className="chat-log relative" ref={listRef} aria-live="polite">
        <li aria-hidden="true" className="shrink-0" style={{ height: rows.getTotalSize() }} />
        {rows.getVirtualItems().map(({ index, start }) => {
          const m = state.messages[index]!;
          return (
            <ChatMessage
              key={m.id}
              row={{ ref: rows.measureElement, index, top: start }}
              message={m}
              color={colorOf(m.userId)}
              isNew={!seenOnOpen.current.has(m.id)}
              onRollAgain={
                m.roll && m.userId === userId
                  ? () =>
                      void run(() =>
                        api.sendMessage(state.id, { content: `/r ${m.roll!.notation}`, toUserId: m.toUserId, gmOnly: m.gmOnly }),
                      )
                  : undefined
              }
            />
          );
        })}
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
