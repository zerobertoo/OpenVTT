import { useCallback, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { TokenDto, UserDto } from "@openvtt/shared";
import { Icon, Logo, type IconName } from "./icons";
import { MapView, type MapTool } from "./MapView";
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
  navigate: (to: string) => void;
  /** Language and log-out controls, shown at the bottom of the World panel. */
  account: ReactNode;
}

export function Table({ worldId, user, navigate, account }: Props) {
  const { t, i18n } = useTranslation();
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

  if (!state) return <main className="app-main"><p>{t(connected ? "app.loading" : "table.connecting")}</p></main>;

  const isGm = state.yourRole === "gm";
  // Players always follow the active scene; the GM can look at any scene.
  const viewSceneId = isGm ? (gmViewSceneId && state.scenes.some((s) => s.id === gmViewSceneId) ? gmViewSceneId : state.activeSceneId) : state.activeSceneId;
  const scene = state.scenes.find((s) => s.id === viewSceneId) ?? null;
  const selectedToken = state.tokens.find((tk) => tk.id === selectedTokenId) ?? null;
  const onlineMembers = state.members.filter((m) => m.online);

  const tabs: Tab[] = isGm ? ["chat", "tokens", "sheets", "scenes", "settings"] : ["chat", "tokens", "sheets", "settings"];

  // Arrow keys move between tabs (roving tabindex), as the ARIA tabs pattern asks.
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length]!;
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const stageStyle = { "--drawer-space": drawerOpen ? "calc(var(--drawer-width) + 1.8rem)" : "0px" } as CSSProperties;

  return (
    <MotionConfig reducedMotion="user">
      <div className="table-stage" style={stageStyle}>
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
          <p className="empty-map">{t(isGm ? "map.emptyGm" : "map.emptyPlayer")}</p>
        )}

        <header className="chrome title-chip">
          <button className="back-button" aria-label={t("table.back")} title={t("table.back")} onClick={() => navigate("/")}><Icon name="back" /></button>
          <Logo />
          <strong>{state.name}</strong>
          {!connected && <span className="status" role="status">{t("table.disconnected")}</span>}
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
              <span key={m.userId} className="avatar" style={{ "--who": m.color } as CSSProperties}>{Array.from(m.displayName)[0]?.toUpperCase()}</span>
            ))}
          </span>
          {onlineMembers.length} {t("table.online")}
        </div>

        <button
          className="drawer-toggle"
          aria-expanded={drawerOpen}
          aria-controls="drawer"
          aria-label={t(drawerOpen ? "table.hidePanels" : "table.showPanels")}
          title={t(drawerOpen ? "table.hidePanels" : "table.showPanels")}
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <Icon name={drawerOpen ? "panelClose" : "panelOpen"} />
        </button>

        <AnimatePresence>
          {drawerOpen && (
            <motion.aside
              id="drawer"
              className="drawer"
              aria-label={t("table.panels")}
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 48 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <div role="tablist" aria-label={t("table.panels")} aria-orientation="vertical" className="drawer-tabs">
                {tabs.map((id) => (
                  <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="panel" tabIndex={tab === id ? 0 : -1} onKeyDown={onTabKeyDown} onClick={() => setTab(id)}>
                    <Icon name={TAB_ICONS[id]} />
                    {t(`tabs.${id}`)}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  role="tabpanel"
                  id="panel"
                  aria-labelledby={`tab-${tab}`}
                  className="drawer-panel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  {tab === "chat" && <ChatPanel state={state} userId={user.id} locale={i18n.language} />}
                  {tab === "tokens" && <TokenPanel state={state} userId={user.id} viewSceneId={viewSceneId} token={selectedToken} />}
                  {tab === "sheets" && <SheetsPanel state={state} locale={i18n.language} />}
                  {tab === "scenes" && isGm && <ScenePanel state={state} viewSceneId={viewSceneId} onView={setGmViewSceneId} />}
                  {tab === "settings" && (
                    <>
                      <SettingsPanel state={state} />
                      <div className="account-box">
                        <h3>{t("auth.account")}</h3>
                        {account}
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
