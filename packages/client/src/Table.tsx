import type { TokenDto, UserDto } from "@openvtt/shared";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Tabs } from "radix-ui";
import { type CSSProperties, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountControls } from "./components/AccountControls";
import { TableLoading } from "./components/screens/TableLoading";
import { Tip, TipProvider } from "./components/ui/tooltip";
import { Icon, type IconName, Logo } from "./icons";
import { type MapTool, MapView } from "./MapView";
import { ChatPanel } from "./panels/ChatPanel";
import { ScenePanel } from "./panels/ScenePanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { SheetsPanel } from "./panels/SheetsPanel";
import { TokenPanel } from "./panels/TokenPanel";
import { useWorldState } from "./useWorldState";

type Tab = "chat" | "tokens" | "sheets" | "scenes" | "settings";

const TAB_ICONS: Record<Tab, IconName> = { chat: "chat", tokens: "tokens", sheets: "sheets", scenes: "scenes", settings: "world" };

interface Props {
  worldId: string;
  user: UserDto;
}

export function Table({ worldId, user }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { state, connected, send } = useWorldState(worldId);
  const [tab, setTab] = useState<Tab>("chat");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [tool, setTool] = useState<MapTool>("select");
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [gmViewSceneId, setGmViewSceneId] = useState<string | null>(null);

  const canControl = useCallback(
    (token: TokenDto) => state?.yourRole === "gm" || token.controllerIds.includes(user.id),
    [state?.yourRole, user.id],
  );
  const move = useCallback((tokenId: string, x: number, y: number) => send({ type: "token.move", tokenId, x, y }), [send]);

  if (!state) return <TableLoading connecting={!connected} />;

  const isGm = state.yourRole === "gm";
  // Players always follow the active scene; the GM can look at any scene.
  const viewSceneId = isGm
    ? gmViewSceneId && state.scenes.some((s) => s.id === gmViewSceneId)
      ? gmViewSceneId
      : state.activeSceneId
    : state.activeSceneId;
  const scene = state.scenes.find((s) => s.id === viewSceneId) ?? null;
  const selectedToken = state.tokens.find((tk) => tk.id === selectedTokenId) ?? null;
  const onlineMembers = state.members.filter((m) => m.online);

  const tabs: Tab[] = isGm ? ["chat", "tokens", "sheets", "scenes", "settings"] : ["chat", "tokens", "sheets", "settings"];

  const stageStyle = { "--drawer-space": drawerOpen ? "calc(var(--drawer-width) + 1.8rem)" : "0px" } as CSSProperties;

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
              onSelect={setSelectedTokenId}
              onMove={move}
              formatDistance={(cells) =>
                `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(cells * scene.gridDistance)} ${scene.distanceUnit}`
              }
            />
          ) : (
            <p className="empty-map">{t(isGm ? "map.emptyGm" : "map.emptyPlayer")}</p>
          )}

          <header className="chrome title-chip">
            <Tip label={t("table.back")}>
              <button className="back-button" aria-label={t("table.back")} onClick={() => navigate({ to: "/" })}>
                <Icon name="back" />
              </button>
            </Tip>
            <Logo />
            <strong>{state.name}</strong>
            {!connected && (
              <span className="status" role="status">
                {t("table.disconnected")}
              </span>
            )}
          </header>

          <div className="chrome dock" role="group" aria-label={t("map.tools")}>
            {(["select", "ruler"] as const).map((id) => (
              <button key={id} aria-pressed={tool === id} onClick={() => setTool(id)}>
                <Icon name={id} />
                {t(`map.${id}`)}
              </button>
            ))}
          </div>
          <p className="map-hint">{t("map.hint")}</p>

          <div className="chrome online-chip">
            <span className="avatar-stack" aria-hidden="true">
              {onlineMembers.slice(0, 5).map((m) => (
                <span key={m.userId} className="avatar" style={{ "--who": m.color } as CSSProperties}>
                  {Array.from(m.displayName)[0]?.toUpperCase()}
                </span>
              ))}
            </span>
            {onlineMembers.length} {t("table.online")}
          </div>

          <Tip label={t(drawerOpen ? "table.hidePanels" : "table.showPanels")}>
            <button
              className="drawer-toggle"
              aria-expanded={drawerOpen}
              aria-controls="drawer"
              aria-label={t(drawerOpen ? "table.hidePanels" : "table.showPanels")}
              onClick={() => setDrawerOpen((open) => !open)}
            >
              <Icon name={drawerOpen ? "panelClose" : "panelOpen"} />
            </button>
          </Tip>

          <AnimatePresence>
            {drawerOpen && (
              // Radix Tabs provides the tablist/tab/tabpanel roles, ids and arrow-key navigation.
              <Tabs.Root value={tab} onValueChange={(value) => setTab(value as Tab)} orientation="vertical" asChild>
                <motion.aside
                  id="drawer"
                  className="drawer"
                  aria-label={t("table.panels")}
                  initial={{ opacity: 0, x: 48 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 48 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                >
                  <Tabs.List aria-label={t("table.panels")} className="drawer-tabs">
                    {tabs.map((id) => (
                      <Tabs.Trigger key={id} value={id}>
                        <Icon name={TAB_ICONS[id]} />
                        {t(`tabs.${id}`)}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                  {tabs.map((id) => (
                    <Tabs.Content key={id} value={id} asChild>
                      <motion.div
                        className="drawer-panel"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {id === "chat" && <ChatPanel state={state} userId={user.id} locale={i18n.language} />}
                        {id === "tokens" && <TokenPanel state={state} userId={user.id} viewSceneId={viewSceneId} token={selectedToken} />}
                        {id === "sheets" && <SheetsPanel state={state} locale={i18n.language} />}
                        {id === "scenes" && <ScenePanel state={state} viewSceneId={viewSceneId} onView={setGmViewSceneId} />}
                        {id === "settings" && (
                          <>
                            <SettingsPanel state={state} />
                            <div className="account-box">
                              <h3>{t("auth.account")}</h3>
                              <AccountControls />
                            </div>
                          </>
                        )}
                      </motion.div>
                    </Tabs.Content>
                  ))}
                </motion.aside>
              </Tabs.Root>
            )}
          </AnimatePresence>
        </main>
      </TipProvider>
    </MotionConfig>
  );
}
