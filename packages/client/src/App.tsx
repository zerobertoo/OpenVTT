import { SUPPORTED_LOCALES, type UserDto, type WorldSummaryDto } from "@openvtt/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import { normalizeLocale, setLocale } from "./i18n";
import { Logo } from "./icons";
import { queryKeys, useMe, useSystems, useWorlds } from "./queries";
import { Table } from "./Table";
import { ErrorMessage } from "./ui";

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const navigate = useCallback((to: string) => {
    history.pushState(null, "", to);
    setPath(to);
  }, []);
  return { path, navigate };
}

export function LanguageSwitcher({ signedIn }: { signedIn: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <label>
      <span className="muted">{t("language.label")}</span>
      <select
        value={normalizeLocale(i18n.language) ?? "en"}
        onChange={(e) => {
          const locale = normalizeLocale(e.target.value)!;
          setLocale(locale);
          if (signedIn) void api.setLocale(locale);
        }}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(`language.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AccountControls({ user, onLogout }: { user: UserDto | null; onLogout: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="account">
      <LanguageSwitcher signedIn={!!user} />
      {user && (
        <button className="link" onClick={onLogout}>
          {t("auth.logout")} ({user.username})
        </button>
      )}
    </div>
  );
}

function AuthForm({ onAuthenticated }: { onAuthenticated: (user: UserDto) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get("username"));
    const password = String(form.get("password"));
    try {
      onAuthenticated(await (mode === "login" ? api.login : api.register)(username, password));
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="welcome">
      <h1>{t("auth.welcomeTitle")}</h1>
      <p className="muted">{t("auth.welcomeText")}</p>
      <form className="card" onSubmit={submit}>
        <label>
          {t("auth.username")}
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          {t("auth.password")}
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
          />
        </label>
        <ErrorMessage error={error} />
        <button type="submit">{t(mode === "login" ? "auth.login" : "auth.register")}</button>
        {mode === "register" && <p className="muted">{t("auth.firstUserHint")}</p>}
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {t(mode === "login" ? "auth.switchToRegister" : "auth.switchToLogin")}
        </button>
      </form>
    </div>
  );
}

function WorldList({ user, navigate }: { user: UserDto; navigate: (to: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const worldsQuery = useWorlds();
  const systemsQuery = useSystems();
  const worlds = worldsQuery.data ?? [];
  const systems = systemsQuery.data ?? [];

  const addWorld = (world: WorldSummaryDto) =>
    queryClient.setQueryData<WorldSummaryDto[]>(queryKeys.worlds, (prev) => [...(prev ?? []), world]);
  const createWorld = useMutation({
    mutationFn: ({ name, systemId }: { name: string; systemId: string }) => api.createWorld(name, systemId),
    onSuccess: addWorld,
  });
  const importWorldMutation = useMutation({ mutationFn: api.importWorld, onSuccess: addWorld });
  const installSystemMutation = useMutation({
    mutationFn: api.installSystem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.systems }),
  });
  const error = worldsQuery.error ?? systemsQuery.error ?? createWorld.error ?? importWorldMutation.error ?? installSystemMutation.error;

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    createWorld.mutate({ name: String(f.get("name")), systemId: String(f.get("systemId")) }, { onSuccess: () => form.reset() });
  };

  const importWorld = (file: File | undefined) => file && importWorldMutation.mutate(file);
  const installSystem = (file: File | undefined) => file && installSystemMutation.mutate(file);

  return (
    <section>
      <div className="card">
        <h1 className="page-title">{t("worlds.title")}</h1>
        {worlds.length === 0 && <p className="muted">{t("worlds.empty")}</p>}
        <ul className="world-list">
          {worlds.map((w) => (
            <li key={w.id} className="world-item">
              <span className="world-badge" aria-hidden="true">
                {Array.from(w.name)[0]?.toUpperCase()}
              </span>
              <span className="info">
                <strong>{w.name}</strong>
                <span className="muted">{t(w.role === "gm" ? "worlds.roleGm" : "worlds.rolePlayer")}</span>
              </span>
              <button onClick={() => navigate(`/world/${w.id}`)}>{t("worlds.open")}</button>
            </li>
          ))}
        </ul>
      </div>
      <form className="card" onSubmit={create}>
        <h2>{t("worlds.newTitle")}</h2>
        <label>
          {t("worlds.newName")}
          <input name="name" required maxLength={80} />
        </label>
        <label>
          {t("worlds.system")}
          <select name="systemId" defaultValue="generic">
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.version}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{t("worlds.create")}</button>
      </form>
      <div className="card worlds-actions">
        <label>
          {t("worlds.import")}
          <input type="file" accept=".zip,application/zip" onChange={(e) => importWorld(e.target.files?.[0])} />
        </label>
        {user.role === "admin" && (
          <label>
            {t("worlds.installSystem")}
            <input type="file" accept=".zip,application/zip" onChange={(e) => installSystem(e.target.files?.[0])} />
          </label>
        )}
      </div>
      <ErrorMessage error={error} />
    </section>
  );
}

function JoinInvite({ code, user, navigate }: { code: string; user: UserDto; navigate: (to: string) => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const world = await api.join(code, String(form.get("displayName")), String(form.get("color")));
      navigate(`/world/${world.id}`);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="page-title">{t("invite.title")}</h1>
      <label>
        {t("invite.displayName")}
        <input name="displayName" defaultValue={user.username} required maxLength={40} />
      </label>
      <label>
        {t("invite.color")}
        <input name="color" type="color" defaultValue="#3d6fd8" />
      </label>
      <ErrorMessage error={error} />
      <button type="submit">{t("invite.join")}</button>
    </form>
  );
}

export function App() {
  const { t } = useTranslation();
  const { path, navigate } = usePath();
  const queryClient = useQueryClient();
  const meQuery = useMe();
  // undefined while loading, null when signed out (also if /api/me is unreachable).
  const user: UserDto | null | undefined = meQuery.isPending ? undefined : (meQuery.data ?? null);

  useEffect(() => {
    if (meQuery.data?.locale) setLocale(meQuery.data.locale);
  }, [meQuery.data]);

  const authenticated = (u: UserDto) => queryClient.setQueryData(queryKeys.me, u);

  const account = (
    <AccountControls
      user={user ?? null}
      onLogout={async () => {
        await api.logout();
        // Drop everything the previous user could see, then show the sign-in form.
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });
        queryClient.setQueryData(queryKeys.me, null);
        navigate("/");
      }}
    />
  );

  // The table is full-bleed: it owns its chrome and shows the account controls in its World panel.
  if (user && path.startsWith("/world/")) return <Table worldId={path.slice(7)} user={user} navigate={navigate} account={account} />;

  let body;
  if (user === undefined) body = <p>{t("app.loading")}</p>;
  else if (user === null) body = <AuthForm onAuthenticated={authenticated} />;
  else if (path.startsWith("/join/")) body = <JoinInvite code={path.slice(6)} user={user} navigate={navigate} />;
  else body = <WorldList user={user} navigate={navigate} />;

  return (
    <main className="app-main">
      <header className="app-header">
        <span className="brand">
          <Logo />
          {t("app.title")}
        </span>
        {account}
      </header>
      {body}
    </main>
  );
}
