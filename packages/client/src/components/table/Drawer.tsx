import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "../../icons";
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
