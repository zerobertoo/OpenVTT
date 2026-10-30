import type { WorldStateDto } from "@openvtt/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { assetUrl } from "../../api";
import { usePreferences } from "../../lib/preferences";
import { chime } from "../../lib/sound";
import { Button } from "../ui/button";
import { toast } from "../ui/toast";

export function TableSounds({ state, userId }: { state: WorldStateDto; userId: string }) {
  const { t } = useTranslation();
  const turnTokenId = state.combat?.turnTokenId ?? null;
  const myTurn = state.yourRole !== "gm" && state.tokens.some((tk) => tk.id === turnTokenId && tk.controllerIds.includes(userId));

  useEffect(() => {
    if (!myTurn) return;
    chime();
    toast({ title: t("alerts.yourTurn"), tone: "success" });
    if (!document.hidden) return;
    const title = document.title;
    document.title = `▶ ${t("alerts.yourTurn")} · ${title}`;
    const restore = () => {
      if (!document.hidden) document.title = title;
    };
    document.addEventListener("visibilitychange", restore);
    return () => {
      document.removeEventListener("visibilitychange", restore);
      document.title = title;
    };
  }, [myTurn, turnTokenId, t]);

  const lastMessage = state.messages.at(-1);
  const seenMessageId = useRef(lastMessage?.id);
  useEffect(() => {
    if (!lastMessage || lastMessage.id === seenMessageId.current) return;
    seenMessageId.current = lastMessage.id;
    if (lastMessage.kind === "whisper" && lastMessage.toUserId === userId) chime();
  }, [lastMessage, userId]);

  return <TableMusic assetId={state.ambient?.assetId ?? null} playing={state.ambient?.playing ?? false} />;
}

function TableMusic({ assetId, playing }: { assetId: string | null; playing: boolean }) {
  const { t } = useTranslation();
  const volume = usePreferences((p) => p.musicVolume);
  const audio = useRef<HTMLAudioElement>(null);
  // Browsers refuse to start sound before the person has interacted with the page.
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.volume = volume;
    if (playing && volume > 0)
      void element.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      );
    else element.pause();
  }, [playing, volume, assetId]);

  if (!assetId) return null;
  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: background music has no words to caption */}
      <audio ref={audio} src={assetUrl(assetId)} loop preload="none" />
      {blocked && playing && (
        <Button
          size="sm"
          variant="secondary"
          className="music-unlock"
          onClick={() => void audio.current?.play().then(() => setBlocked(false))}
        >
          {t("alerts.playMusic")}
        </Button>
      )}
    </>
  );
}
