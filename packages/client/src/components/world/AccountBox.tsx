import { useTranslation } from "react-i18next";
import { AccountControls } from "../AccountControls";

/** Language and log-out, at the bottom of the World tab. */
export function AccountBox() {
  const { t } = useTranslation();
  return (
    <section aria-label={t("auth.account")} className="mt-2 grid gap-2 border-line border-t-[1.5px] pt-3">
      <h3>{t("auth.account")}</h3>
      <AccountControls />
    </section>
  );
}
