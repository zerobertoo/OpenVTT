import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Popover } from "../ui/popover";
import { GuideSteps } from "./TableGuide";

/** "How a table works": the same steps as the empty table, available at any time from the title chip. */
export function GuideButton({ isGm }: { isGm: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-on-chrome-2 hover:not-disabled:bg-chrome-2"
          aria-label={t("guide.title")}
          title={t("guide.title")}
        >
          <span aria-hidden="true" className="font-bold font-serif italic">
            i
          </span>
        </Button>
      }
      className="w-80"
    >
      <h2 className="m-0 mb-3 font-bold text-base">{t("guide.title")}</h2>
      <GuideSteps isGm={isGm} onDone={() => setOpen(false)} />
    </Popover>
  );
}
