import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenDto, UserDto } from "@openvtt/shared";
import { MapView, type MapTool } from "./MapView";
import { ChatPanel } from "./panels/ChatPanel";
import { ScenePanel } from "./panels/ScenePanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { SheetsPanel } from "./panels/SheetsPanel";
import { TokenPanel } from "./panels/TokenPanel";
import { useWorldState } from "./useWorldState";

type Tab = "chat" | "tokens" | "sheets" | "scenes" | "settings";

export function Table({ worldId, user, navigate }: { worldId: string; user: UserDto; navigate: (to: string) => void }) {
  const { t, i18n } = useTranslation();
  const { state, connected, send } = useWorldState(worldId);
  const [tab, setTab] = useState<Tab>("chat");
  const [tool, setTool] = useState<MapTool>("select");
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [gmViewSceneId, setGmViewSceneId] = useState<string | null>(null);

  const canControl = useCallback(
    (token: TokenDto) => state?.yourRole === "gm" || token.controllerIds.includes(user.id),
    [state?.yourRole, user.id],
  );
  const move = useCallback((tokenId: string, x: number, y: number) => send({ type: "token.move", tokenId, x, y }), [send]);

  if (!state) return <p>{t(connected ? "app.loading" : "table.connecting")}</p>;

  const isGm = state.yourRole === "gm";
  // Players always follow the active scene; the GM can look at any scene.
  const viewSceneId = isGm ? (gmViewSceneId && state.scenes.some((s) => s.id === gmViewSceneId) ? gmViewSceneId : state.activeSceneId) : state.activeSceneId;
  const scene = state.scenes.find((s) => s.id === viewSceneId) ?? null;
  const selectedToken = state.tokens.find((tk) => tk.id === selectedTokenId) ?? null;

  const tabs: Tab[] = isGm ? ["chat", "tokens", "sheets", "scenes", "settings"] : ["chat", "tokens", "sheets", "settings"];

  return (
    <div className="table-layout">
      <div className="map-column">
        <div className="toolbar">
          <button className="link" onClick={() => navigate("/")}>{t("table.back")}</button>
          <strong>{state.name}</strong>
          <div role="group" aria-label={t("map.tools")} className="row">
            <button className={tool === "select" ? "" : "secondary"} aria-pressed={tool === "select"} onClick={() => setTool("select")}>{t("map.select")}</button>
            <button className={tool === "ruler" ? "" : "secondary"} aria-pressed={tool === "ruler"} onClick={() => setTool("ruler")}>{t("map.ruler")}</button>
          </div>
          {!connected && <span className="muted">{t("table.disconnected")}</span>}
        </div>
        {scene ? (
          <MapView
            scene={scene}
            tokens={state.tokens}
            tool={tool}
            selectedTokenId={selectedTokenId}
            canControl={canControl}
            onSelect={setSelectedTokenId}
            onMove={move}
            formatDistance={(cells) => `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(cells * scene.gridDistance)} ${scene.distanceUnit}`}
          />
        ) : (
          <p className="empty-map muted">{t(isGm ? "map.emptyGm" : "map.emptyPlayer")}</p>
        )}
        <p className="muted hint">{t("map.hint")}</p>
      </div>
      <aside className="sidebar">
        <div role="tablist" aria-label={t("table.panels")} className="tabs">
          {tabs.map((id) => (
            <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="panel" className={tab === id ? "" : "secondary"} onClick={() => setTab(id)}>
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="panel" aria-labelledby={`tab-${tab}`} className="panel">
          {tab === "chat" && <ChatPanel state={state} userId={user.id} locale={i18n.language} />}
          {tab === "tokens" && <TokenPanel state={state} userId={user.id} viewSceneId={viewSceneId} token={selectedToken} />}
          {tab === "sheets" && <SheetsPanel state={state} locale={i18n.language} />}
          {tab === "scenes" && isGm && <ScenePanel state={state} viewSceneId={viewSceneId} onView={setGmViewSceneId} />}
          {tab === "settings" && <SettingsPanel state={state} />}
        </div>
      </aside>
    </div>
  );
}
