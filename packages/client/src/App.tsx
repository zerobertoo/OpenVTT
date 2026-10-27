import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, type UserDto, type WorldSummaryDto } from "@openvtt/shared";
import { api, ApiError } from "./api";
import { normalizeLocale, setLocale } from "./i18n";
import { useWorldState } from "./useWorldState";

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

function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  const code = error instanceof ApiError ? error.code : "internal_error";
  return <p role="alert" className="error">{t(`errors.${code}`)}</p>;
}

function LanguageSwitcher({ signedIn }: { signedIn: boolean }) {
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
          <option key={l} value={l}>{t(`language.${l}`)}</option>
        ))}
      </select>
    </label>
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
    <form onSubmit={submit}>
      <label>{t("auth.username")}<input name="username" autoComplete="username" required /></label>
      <label>
        {t("auth.password")}
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
      </label>
      <ErrorMessage error={error} />
      <button type="submit">{t(mode === "login" ? "auth.login" : "auth.register")}</button>
      {mode === "register" && <p className="muted">{t("auth.firstUserHint")}</p>}
      <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {t(mode === "login" ? "auth.switchToRegister" : "auth.switchToLogin")}
      </button>
    </form>
  );
}

function WorldList({ navigate }: { navigate: (to: string) => void }) {
  const { t } = useTranslation();
  const [worlds, setWorlds] = useState<WorldSummaryDto[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.worlds().then(setWorlds, setError);
  }, []);

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      const world = await api.createWorld(String(new FormData(form).get("name")));
      setWorlds((prev) => [...prev, world]);
      form.reset();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <section>
      <h2>{t("worlds.title")}</h2>
      {worlds.length === 0 && <p className="muted">{t("worlds.empty")}</p>}
      <ul className="plain">
        {worlds.map((w) => (
          <li key={w.id}>
            <strong>{w.name}</strong>
            <span className="muted">{t(w.role === "gm" ? "worlds.roleGm" : "worlds.rolePlayer")}</span>
            <button onClick={() => navigate(`/world/${w.id}`)}>{t("worlds.open")}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={create}>
        <label>{t("worlds.newName")}<input name="name" required maxLength={80} /></label>
        <button type="submit">{t("worlds.create")}</button>
      </form>
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
    <form onSubmit={submit}>
      <h2>{t("invite.title")}</h2>
      <label>{t("invite.displayName")}<input name="displayName" defaultValue={user.username} required maxLength={40} /></label>
      <label>{t("invite.color")}<input name="color" type="color" defaultValue="#3d6fd8" /></label>
      <ErrorMessage error={error} />
      <button type="submit">{t("invite.join")}</button>
    </form>
  );
}

function Table({ worldId, navigate }: { worldId: string; navigate: (to: string) => void }) {
  const { t } = useTranslation();
  const { state, connected } = useWorldState(worldId);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const invite = async () => {
    try {
      const { code } = await api.createInvite(worldId);
      setInviteLink(`${location.origin}/join/${code}`);
    } catch (err) {
      setError(err);
    }
  };

  if (!state) return <p>{t(connected ? "app.loading" : "table.connecting")}</p>;
  return (
    <section>
      <button className="link" onClick={() => navigate("/")}>{t("table.back")}</button>
      <h2>{state.name}</h2>
      {!connected && <p className="muted">{t("table.disconnected")}</p>}
      <h3>{t("table.members")}</h3>
      <ul className="plain">
        {state.members.map((m) => (
          <li key={m.userId}>
            <span className="dot" style={{ background: m.color }} />
            {m.displayName}
            <span className="muted">{t(m.online ? "table.online" : "table.offline")}</span>
          </li>
        ))}
      </ul>
      {state.yourRole === "gm" && (
        <>
          <button onClick={invite}>{t("invite.create")}</button>
          {inviteLink && <p>{t("invite.linkLabel")}: <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} size={50} /></p>}
          <ErrorMessage error={error} />
        </>
      )}
    </section>
  );
}

export function App() {
  const { t } = useTranslation();
  const { path, navigate } = usePath();
  const [user, setUser] = useState<UserDto | null | undefined>(undefined);

  useEffect(() => {
    api.me().then(
      (u) => {
        setUser(u);
        if (u.locale) setLocale(u.locale);
      },
      () => setUser(null),
    );
  }, []);

  const authenticated = (u: UserDto) => {
    setUser(u);
    if (u.locale) setLocale(u.locale);
  };

  let body;
  if (user === undefined) body = <p>{t("app.loading")}</p>;
  else if (user === null) body = <AuthForm onAuthenticated={authenticated} />;
  else if (path.startsWith("/join/")) body = <JoinInvite code={path.slice(6)} user={user} navigate={navigate} />;
  else if (path.startsWith("/world/")) body = <Table worldId={path.slice(7)} navigate={navigate} />;
  else body = <WorldList navigate={navigate} />;

  return (
    <main>
      <header>
        <h1>{t("app.title")}</h1>
        <LanguageSwitcher signedIn={!!user} />
        {user && (
          <button
            className="link"
            onClick={async () => {
              await api.logout();
              setUser(null);
              navigate("/");
            }}
          >
            {t("auth.logout")} ({user.username})
          </button>
        )}
      </header>
      {body}
    </main>
  );
}
