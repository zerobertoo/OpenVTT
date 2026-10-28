import { useTranslation } from "react-i18next";
import { Spinner } from "../ui/spinner";

/** Full-stage placeholder shown while the table's code or its live state is on the way. */
export function TableLoading({ connecting = false }: { connecting?: boolean }) {
  const { t } = useTranslation();
  return (
    <main className="fixed inset-0 grid place-content-center justify-items-center gap-3 bg-map text-on-chrome-2">
      <div role="status" className="flex items-center gap-3">
        <Spinner className="size-5" />
        {t(connecting ? "table.connecting" : "app.loading")}
      </div>
    </main>
  );
}
