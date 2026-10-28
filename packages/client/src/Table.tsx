import type { UserDto } from "@openvtt/shared";
import { useQueryClient } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import { TableLoading } from "./components/screens/TableLoading";
import { Drawer } from "./components/table/Drawer";
import { MapToolbar } from "./components/table/MapToolbar";
import { OnlineChip } from "./components/table/OnlineChip";
import { EmptyMap } from "./components/table/TableGuide";
import { TableKeyboard } from "./components/table/TableKeyboard";
import { TitleChip } from "./components/table/TitleChip";
import { TipProvider } from "./components/ui/tooltip";
import { AccountBox } from "./components/world/AccountBox";
import { MapView } from "./MapView";
import { ChatPanel } from "./panels/ChatPanel";
import { ScenePanel } from "./panels/ScenePanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { SheetsPanel } from "./panels/SheetsPanel";
import { TokenPanel } from "./panels/TokenPanel";
import { queryKeys } from "./queries";
import { type TableTab, useTableUi } from "./tableStore";
import { useCan } from "./useCan";
import { useFormat } from "./useFormat";
import { useWorldState } from "./useWorldState";

/** How often a table that cannot connect re-checks the session and the list of worlds. */
const REVALIDATE_WHILE_OFFLINE_MS = 8000;

interface Props {
  worldId: string;
  user: UserDto;
}

export function Table({ worldId, user }: Props) {
  const { t, i18n } = useTranslation();
  const { state, connected, send } = useWorldState(worldId);
  const { tab, drawerOpen, tool, selectedTokenId, gmViewSceneId, showMapData } = useTableUi();
  const { setTab, toggleDrawer, setTool, selectToken, viewScene, reset } = useTableUi.getState();

  // Each world starts with a clean UI: no selected token, chat tab, panels open.
  useEffect(() => reset, [worldId, reset]);
  const [helpOpen, setHelpOpen] = useState(false);

  // A connection that stays down may mean the person lost access (removed, world deleted, session ended),
  // not only a bad network. Re-checking makes the router show the right screen instead of retrying forever.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (connected) return;
    const timer = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.worlds });
    }, REVALIDATE_WHILE_OFFLINE_MS);
    return () => clearInterval(timer);
  }, [connected, queryClient]);

  const can = useCan(state?.yourRole, user.id);
  const canControl = can.canControlToken;
  const format = useFormat();
  const move = useCallback((tokenId: string, x: number, y: number) => send({ type: "token.move", tokenId, x, y }), [send]);

  if (!state) return <TableLoading connecting={!connected} />;

  const isGm = can.isGm;
  // Players always follow the active scene; the GM can look at any scene.
  const viewSceneId = isGm
    ? gmViewSceneId && state.scenes.some((s) => s.id === gmViewSceneId)
      ? gmViewSceneId
      : state.activeSceneId
    : state.activeSceneId;
  const scene = state.scenes.find((s) => s.id === viewSceneId) ?? null;
  const selectedToken = state.tokens.find((tk) => tk.id === selectedTokenId) ?? null;

  const tabs: TableTab[] = isGm ? ["chat", "tokens", "sheets", "scenes", "settings"] : ["chat", "tokens", "sheets", "settings"];

  const stageStyle = { "--drawer-space": drawerOpen ? "calc(var(--drawer-width) + 1.8rem)" : "0px" } as CSSProperties;

  const renderPanel = (id: TableTab) => {
    switch (id) {
      case "chat":
        return <ChatPanel state={state} userId={user.id} />;
      case "tokens":
        return <TokenPanel state={state} userId={user.id} viewSceneId={viewSceneId} token={selectedToken} />;
      case "sheets":
        return <SheetsPanel state={state} locale={i18n.language} />;
      case "scenes":
        return <ScenePanel state={state} viewSceneId={viewSceneId} onView={viewScene} />;
      case "settings":
        return (
          <>
            <SettingsPanel state={state} />
            <AccountBox />
          </>
        );
    }
  };

  // A disabled fieldset turns off every control inside it, so nothing can be sent into a dead connection.
  const renderPanelWhenOnline = (id: TableTab) => (
    <fieldset disabled={!connected} className="contents">
      {renderPanel(id)}
    </fieldset>
  );

  return (
    <MotionConfig reducedMotion="user">
      <TipProvider>
        <main className="table-stage" style={stageStyle}>
          {scene ? (
            <MapView
              scene={scene}
              tokens={state.tokens}
              tool={tool}
              selectedTokenId={selectedTokenId}
              canControl={canControl}
              onSelect={selectToken}
              onMove={move}
              vision={state.vision}
              showMapData={showMapData}
              onToggleDoor={(wallId, open) => void api.setDoorOpen(scene.id, wallId, open).catch(() => undefined)}
              formatDistance={(cells) => format.distance(cells, scene)}
            />
          ) : (
            <EmptyMap isGm={isGm} />
          )}

          <TitleChip worldName={state.name} connected={connected} isGm={isGm} onShowShortcuts={() => setHelpOpen(true)} />
          <TableKeyboard
            scene={scene}
            movableToken={selectedToken && canControl(selectedToken) ? selectedToken : null}
            onMove={move}
            helpOpen={helpOpen}
            onHelpOpenChange={setHelpOpen}
          />
          <MapToolbar tool={tool} onToolChange={setTool} />
          <p className="map-hint">{t("map.hint")}</p>
          <OnlineChip members={state.members} />
          <Drawer
            open={drawerOpen}
            onToggle={toggleDrawer}
            tab={tab}
            onTabChange={setTab}
            tabs={tabs}
            renderPanel={renderPanelWhenOnline}
          />
        </main>
      </TipProvider>
    </MotionConfig>
  );
}
