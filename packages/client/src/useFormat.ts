import { useTranslation } from "react-i18next";
import { createFormatter } from "./lib/format";

/** Date, time, number and distance formatting in the current interface language. */
export function useFormat() {
  const { i18n } = useTranslation();
  return createFormatter(i18n.language);
}
