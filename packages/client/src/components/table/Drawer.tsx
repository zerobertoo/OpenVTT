import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "../../icons";
import { usePreferences } from "../../lib/preferences";
import type { TableTab } from "../../tableStore";
import { Button } from "../ui/button";
import { TabContent, TabList, Tabs, TabTrigger } from "../ui/tabs";
import { Tip } from "../ui/tooltip";

const TAB_ICONS: Record<TableTab, IconName> = {
  chat: "chat",
  tokens: "tokens",
  sheets: "sheets",
  journal: "journal",
  scenes: "scenes",
  settings: "world",
};

interface Props {
  open: boolean;
  onToggle: () => void;
  tab: TableTab;
  onTabChange: (tab: TableTab) => void;
  tabs: TableTab[];
  renderPanel: (tab: TableTab) => ReactNode;
}

const MIN_DRAWER = 300;
const MAX_DRAWER = 760;
const DEFAULT_DRAWER = 416;

/** Drag (or arrow keys) on the panel's left edge to make it wider or narrower. */
function DrawerResizer() {
  const { t } = useTranslation();
  const width = usePreferences((p) => p.drawerWidth) ?? DEFAULT_DRAWER;
  const setWidth = usePreferences((p) => p.setDrawerWidth);
  const clamp = (value: number) => Math.round(Math.min(MAX_DRAWER, Math.max(MIN_DRAWER, value)));
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable, adjustable separator has no native element
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("table.resizePanels")}
      aria-valuemin={MIN_DRAWER}
      aria-valuemax={MAX_DRAWER}
      aria-valuenow={width}
      tabIndex={0}
      className="drawer-resizer"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        e.stopPropagation();
        setWidth(clamp(width + (e.key === "ArrowLeft" ? 32 : -32)));
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const right = e.currentTarget.parentElement!.getBoundingClientRect().right;
        const move = (event: PointerEvent) => setWidth(clamp(right - event.clientX));
        const stop = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop);
      }}
    />
  );
}

/** Right-hand panel with a tab rail (a bottom sheet on phones) and the button that shows or hides it. */
export function Drawer({ open, onToggle, tab, onTabChange, tabs, renderPanel }: Props) {
  const { t } = useTranslation();
  const toggleLabel = t(open ? "table.hidePanels" : "table.showPanels");
  return (
    <>
      <Tip label={toggleLabel}>
        <Button
          variant="ghost"
          size="icon"
          className="drawer-toggle bg-chrome text-on-chrome"
          aria-expanded={open}
          aria-controls="drawer"
          aria-label={toggleLabel}
          onClick={onToggle}
        >
          <Icon name={open ? "panelClose" : "panelOpen"} />
        </Button>
      </Tip>

      <AnimatePresence>
        {open && (
          <Tabs value={tab} onValueChange={(value) => onTabChange(value as TableTab)} orientation="vertical" asChild>
            <motion.aside
              id="drawer"
              className="drawer"
              aria-label={t("table.panels")}
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 48 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <DrawerResizer />
              <TabList aria-label={t("table.panels")}>
                {tabs.map((id) => (
                  <TabTrigger key={id} value={id}>
                    <Icon name={TAB_ICONS[id]} />
                    {t(`tabs.${id}`)}
                  </TabTrigger>
                ))}
              </TabList>
              {tabs.map((id) => (
                <TabContent key={id} value={id} asChild>
                  <motion.div
                    className="drawer-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {renderPanel(id)}
                  </motion.div>
                </TabContent>
              ))}
            </motion.aside>
          </Tabs>
        )}
      </AnimatePresence>
    </>
  );
}
