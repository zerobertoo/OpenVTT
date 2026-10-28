import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "../../Root";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { EmptyState, ErrorState } from "../ui/empty-state";

/** Goes back to the world list, as a link so it also works with the keyboard and a middle click. */
function BackToWorldsLink() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="font-semibold text-accent-text underline underline-offset-[3px]">
      {t("table.back")}
    </Link>
  );
}

/** An address that matches no page, inside the normal page chrome. */
export function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <Shell>
      <Card>
        <EmptyState
          title={t("states.notFoundTitle")}
          description={t("states.notFoundText")}
          headingLevel={1}
          action={<BackToWorldsLink />}
        />
      </Card>
    </Shell>
  );
}

/** Shown by the router when a page throws while rendering, instead of a blank screen. */
export function RouteErrorScreen({ reset }: { reset: () => void }) {
  const { t } = useTranslation();
  return (
    <Shell>
      <Card>
        <ErrorState title={t("states.crashTitle")} description={t("states.crashText")} onRetry={reset} retryLabel={t("common.retry")} />
      </Card>
    </Shell>
  );
}

/** The table is not available to this person: the world is gone, never existed or they were removed from it. */
export function WorldUnavailableScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <main className="fixed inset-0 grid place-content-center bg-map p-4">
      <Card className="max-w-md">
        <EmptyState
          title={t("states.worldUnavailableTitle")}
          description={t("states.worldUnavailableText")}
          headingLevel={1}
          action={<Button onClick={() => navigate({ to: "/" })}>{t("table.back")}</Button>}
        />
      </Card>
    </main>
  );
}
