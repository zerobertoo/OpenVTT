import type { UserDto } from "@openvtt/shared";
import { useQueryClient } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import { TableLoading } from "./components/screens/TableLoading";
import { DiceOverlay } from "./components/table/DiceOverlay";
import { DiceTray } from "./components/table/DiceTray";
import { Drawer } from "./components/table/Drawer";
import { DrawOptions } from "./components/table/DrawOptions";
import { MapLayersMenu } from "./components/table/MapLayersMenu";
import { MapToolbar } from "./components/table/MapToolbar";
import { OnlineChip } from "./components/table/OnlineChip";
import { RulerOptions } from "./components/table/RulerOptions";
import { SelectionBar } from "./components/table/SelectionBar";
import { EmptyMap } from "./components/table/TableGuide";
import { TableKeyboard } from "./components/table/TableKeyboard";
import { TitleChip } from "./components/table/TitleChip";
import { ConfirmDialog } from "./components/ui/dialog";
import { TipProvider } from "./components/ui/tooltip";
import { AccountBox } from "./components/world/AccountBox";
import { usePreferences } from "./lib/preferences";
import { MapView } from "./MapView";
import { ChatPanel } from "./panels/ChatPanel";
import { ScenePanel } from "./panels/ScenePanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { SheetsPanel } from "./panels/SheetsPanel";
import { TokenPanel } from "./panels/TokenPanel";
import { queryKeys } from "./queries";
import { PLAYER_LAYERS, type TableTab, useTableUi } from "./tableStore";
import { useAction } from "./ui";
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
  const { tab, drawerOpen, tool, selectedTokenId, selectedTokenIds, gmViewSceneId, layers, viewAsUserId, diceTrayOpen, draw } =
    useTableUi();
  const { setTab, toggleDrawer, setTool, selectToken, toggleToken, selectTokens, viewScene, reset, setDiceTrayOpen, setLayer, setViewAs } =
    useTableUi.getState();

  // Each world starts with a clean UI: no selected token, chat tab, panels open.
  useEffect(() => reset, [worldId, reset]);
  const [helpOpen, setHelpOpen] = useState(false);
  const rulerShape = usePreferences((p) => p.rulerShape);
  const diagonalRule = usePreferences((p) => p.diagonalRule);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

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
  // The tray only picks the dice and how they are thrown; the server rolls them like any other /r message.
  const { run: runRoll, error: rollError } = useAction();
  const rollFromTray = useCallback(
    async (notation: string, gmOnly: boolean) =>
      Boolean(await runRoll(() => api.sendMessage(worldId, { content: `/r ${notation}`, toUserId: null, gmOnly }))),
    [runRoll, worldId],
  );
  const move = useCallback((tokenId: string, x: number, y: number) => send({ type: "token.move", tokenId, x, y }), [send]);

  // The preview only makes sense for a player who is still in the world.
  const previewedPlayer =
    state?.yourRole === "gm" ? state.members.find((m) => m.role === "player" && m.userId === viewAsUserId) : undefined;
  const viewAs = previewedPlayer?.userId ?? null;
  // The server forgets the preview when the socket drops, so it is asked for again on every (re)connect.
  useEffect(() => {
    if (connected && viewAs) send({ type: "world.viewAs", userId: viewAs });
  }, [connected, viewAs, send]);
  const changeViewAs = (userId: string | null) => {
    setViewAs(userId);
    // Asking for a preview happens in the effect above; going back is the only message to send here.
    if (!userId) send({ type: "world.viewAs", userId: null });
  };

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
  // Tokens that vanished (deleted, out of sight) silently leave the selection.
  const selectedTokens = state.tokens.filter((tk) => selectedTokenIds.includes(tk.id));
  const movableTokens = selectedTokens.filter(canControl);
  const rotateSelection = (degrees: number) => {
    for (const token of movableTokens)
      void api.updateToken(token.id, { rotation: (((token.rotation + degrees) % 360) + 360) % 360 }).catch(() => undefined);
  };
  const removeSelection = () => {
    if (isGm && selectedTokens.length > 0) setConfirmingRemoval(true);
  };

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
              selectedTokenIds={selectedTokenIds}
              canControl={canControl}
              onSelect={selectToken}
              onToggle={toggleToken}
              onSelectMany={selectTokens}
              onMove={move}
              vision={state.vision}
              layers={viewAs ? PLAYER_LAYERS : layers}
              onToggleDoor={(wallId, open) => void api.setDoorOpen(scene.id, wallId, open).catch(() => undefined)}
              onPing={(x, y, focus) => send({ type: "map.ping", x, y, focus: isGm && focus })}
              formatDistance={(cells) => format.distance(cells, scene)}
              rulerShape={rulerShape}
              diagonalRule={diagonalRule}
              draw={draw}
              onDraw={(drawing) => void api.createDrawing(scene.id, drawing).catch(() => undefined)}
              onErase={(drawingId) => void api.deleteDrawing(drawingId).catch(() => undefined)}
              canErase={(drawing) => isGm || drawing.authorId === user.id}
            />
          ) : (
            <EmptyMap isGm={isGm} />
          )}

          <DiceOverlay messages={state.messages} userId={user.id} />
          <TitleChip worldName={state.name} connected={connected} isGm={isGm} onShowShortcuts={() => setHelpOpen(true)} />
          <TableKeyboard
            scene={scene}
            movableTokens={movableTokens}
            onMove={move}
            onRotate={rotateSelection}
            onRemove={removeSelection}
            helpOpen={helpOpen}
            onHelpOpenChange={setHelpOpen}
          />
          {tool === "ruler" && <RulerOptions scene={scene} />}
          {tool === "draw" && scene && (
            <DrawOptions
              isGm={isGm}
              lockedLayers={scene.lockedLayers}
              onClear={() => void api.clearDrawings(scene.id).catch(() => undefined)}
            />
          )}
          {selectedTokens.length > 1 && (
            <SelectionBar
              count={selectedTokens.length}
              canRotate={movableTokens.length > 0}
              canDelete={isGm}
              onRotate={rotateSelection}
              onDelete={removeSelection}
              onClear={() => selectToken(null)}
            />
          )}
          <ConfirmDialog
            open={confirmingRemoval}
            onOpenChange={setConfirmingRemoval}
            title={t("selection.deleteTitle", { count: selectedTokens.length })}
            description={t("selection.deleteBody")}
            confirmLabel={t("common.delete")}
            cancelLabel={t("common.cancel")}
            tone="danger"
            onConfirm={() => {
              setConfirmingRemoval(false);
              for (const token of selectedTokens) void api.deleteToken(token.id).catch(() => undefined);
              selectToken(null);
            }}
          />
          <MapToolbar
            tool={tool}
            onToolChange={setTool}
            diceTrayOpen={diceTrayOpen}
            onToggleDiceTray={() => setDiceTrayOpen(!diceTrayOpen)}
            layersMenu={
              isGm && (
                <MapLayersMenu
                  scene={scene}
                  players={state.members.filter((m) => m.role === "player")}
                  layers={layers}
                  onLayerChange={setLayer}
                  viewAsUserId={viewAs}
                  onViewAsChange={changeViewAs}
                  onLockChange={(lockedLayers) => scene && void api.updateScene(scene.id, { lockedLayers }).catch(() => undefined)}
                />
              )
            }
          />
          {diceTrayOpen && <DiceTray onRoll={rollFromTray} error={rollError} onClose={() => setDiceTrayOpen(false)} />}
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
