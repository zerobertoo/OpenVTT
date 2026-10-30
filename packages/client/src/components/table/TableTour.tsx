import type { ParseKeys } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

const KEY = "openvtt-tour-done";
const STEPS: ParseKeys[] = ["tour.map", "tour.tools", "tour.dice", "tour.panels", "tour.keys"];
const GM_STEPS: ParseKeys[] = ["tour.map", "tour.tools", "tour.gmLayers", "tour.dice", "tour.panels", "tour.keys"];

const seen = () => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
};

/** A few short tips the first time this browser sits at a table with a map. */
export function TableTour({ isGm }: { isGm: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => !seen());
  const [step, setStep] = useState(0);
  const steps = isGm ? GM_STEPS : STEPS;
  const finish = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };
  const last = step === steps.length - 1;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && finish()}
      title={t("tour.title", { step: step + 1, total: steps.length })}
      description={t(steps[step]!)}
      size="sm"
    >
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="link" onClick={finish}>
          {t("tour.skip")}
        </Button>
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            {t("tour.back")}
          </Button>
        )}
        <Button onClick={() => (last ? finish() : setStep(step + 1))}>{t(last ? "tour.done" : "tour.next")}</Button>
      </div>
    </Dialog>
  );
}
