import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { type TableTab, useTableUi } from "../../tableStore";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface Step {
  id: string;
  title: ParseKeys;
  text: ParseKeys;
  action?: ParseKeys;
  /** Tab that does the step, when there is one. */
  tab?: TableTab;
}

const GM_STEPS: Step[] = [
  { id: "gmScene", title: "guide.gmScene.title", text: "guide.gmScene.text", action: "guide.gmScene.action", tab: "scenes" },
  { id: "gmToken", title: "guide.gmToken.title", text: "guide.gmToken.text", action: "guide.gmToken.action", tab: "tokens" },
  { id: "gmInvite", title: "guide.gmInvite.title", text: "guide.gmInvite.text", action: "guide.gmInvite.action", tab: "settings" },
];
const PLAYER_STEPS: Step[] = [
  { id: "playerChat", title: "guide.playerChat.title", text: "guide.playerChat.text", action: "guide.playerChat.action", tab: "chat" },
  { id: "playerMove", title: "guide.playerMove.title", text: "guide.playerMove.text" },
  {
    id: "playerSheet",
    title: "guide.playerSheet.title",
    text: "guide.playerSheet.text",
    action: "guide.playerSheet.action",
    tab: "sheets",
  },
];

/** The first things to do at a table, in order. Each step with a tab opens it. */
export function GuideSteps({ isGm, onDone }: { isGm: boolean; onDone?: () => void }) {
  const { t } = useTranslation();
  const steps = isGm ? GM_STEPS : PLAYER_STEPS;
  const openTab = (tab: TableTab) => {
    const ui = useTableUi.getState();
    ui.setTab(tab);
    if (!ui.drawerOpen) ui.toggleDrawer();
    onDone?.();
  };
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {steps.map((step, index) => (
        <li key={step.id} className="grid grid-cols-[auto_1fr] gap-x-3">
          <span
            aria-hidden="true"
            className="row-span-3 grid size-7 place-items-center rounded-full bg-accent-soft font-bold text-accent-text text-sm"
          >
            {index + 1}
          </span>
          <strong>{t(step.title)}</strong>
          <span className="text-ink-2 text-sm">{t(step.text)}</span>
          {step.tab && step.action && (
            <Button variant="link" size="sm" className="justify-self-start" onClick={() => openTab(step.tab as TableTab)}>
              {t(step.action)}
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Fills the stage while there is no scene to show. The game master gets the steps, players a gentle wait message. */
export function EmptyMap({ isGm }: { isGm: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 grid place-content-center p-4">
      <Card as="section" aria-labelledby="empty-map-title" className="grid max-w-md gap-4">
        <h1 id="empty-map-title" className="m-0 font-bold text-[1.4rem] tracking-tight">
          {t(isGm ? "guide.gmTitle" : "guide.playerTitle")}
        </h1>
        <p className="m-0 text-ink-2">{t(isGm ? "guide.gmIntro" : "guide.playerIntro")}</p>
        <GuideSteps isGm={isGm} />
      </Card>
    </div>
  );
}
