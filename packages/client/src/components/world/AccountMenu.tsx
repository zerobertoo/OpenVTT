import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import { AccountControls } from "../AccountControls";
import { Button } from "../ui/button";
import { Popover } from "../ui/popover";
import { DiceSetting } from "./DiceSetting";
import { MeasureSettings } from "./MeasureSettings";
import { SoundSetting } from "./SoundSetting";
import { ThemeSetting } from "./ThemeSetting";

/** Personal settings of this browser and the account: language, distances, dice, sounds, theme and log-out. Not about the world. */
export function AccountMenu() {
  const { t } = useTranslation();
  return (
    <Popover
      label={t("auth.account")}
      className="grid max-h-[min(36rem,calc(100dvh-6rem))] w-80 content-start gap-3 overflow-y-auto"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-on-chrome-2 hover:not-disabled:bg-chrome-2"
          aria-label={t("auth.account")}
          title={t("auth.account")}
        >
          <Icon name="account" />
        </Button>
      }
    >
      <h2 className="m-0 font-bold text-base">{t("auth.account")}</h2>
      <AccountControls />
      <MeasureSettings />
      <DiceSetting />
      <SoundSetting />
      <ThemeSetting />
    </Popover>
  );
}
