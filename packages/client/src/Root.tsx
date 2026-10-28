import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "./App";
import { AccountControls } from "./components/AccountControls";
import { SignInScreen } from "./components/screens/SignInScreen";
import { Card } from "./components/ui/card";
import { Loading, Skeleton } from "./components/ui/skeleton";
import { setLocale } from "./i18n";
import { Logo } from "./icons";
import { useMe } from "./queries";

/** Page chrome shared by every screen except the table, which is full-bleed and owns its own. */
export function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="app-main">
      <header className="app-header">
        <span className="brand">
          <Logo />
          {t("app.title")}
        </span>
        <AccountControls />
      </header>
      {children}
    </main>
  );
}

/**
 * Gates every route on a session. Signed-out visitors see the sign-in form at the URL they asked for,
 * so after signing in they land where they were going (for example an invite link).
 */
export function Root() {
  const { t } = useTranslation();
  const { data: user, isPending } = useMe();

  useEffect(() => {
    if (user?.locale) setLocale(user.locale);
  }, [user]);

  if (isPending)
    return (
      <Shell>
        <Loading label={t("app.loading")}>
          <Skeleton shape="block" className="h-12 w-3/4" />
          <Card className="mt-6 grid gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-11 rounded-full" />
          </Card>
        </Loading>
      </Shell>
    );
  // Also reached when /api/me is unreachable; the sign-in form then reports the network error on submit.
  if (!user)
    return (
      <Shell>
        <SignInScreen />
      </Shell>
    );
  return (
    <UserContext.Provider value={user}>
      <Outlet />
    </UserContext.Provider>
  );
}
