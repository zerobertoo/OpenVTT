import type { UserDto, WorldSummaryDto } from "@openvtt/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { createContext, type FormEvent, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import { AccountControls } from "./components/AccountControls";
import { setLocale } from "./i18n";
import { Logo } from "./icons";
import { queryKeys, useMe, useSystems, useWorlds } from "./queries";
import { ErrorMessage } from "./ui";

export const UserContext = createContext<UserDto | null>(null);

/** The signed-in user; only valid below `Root`, which renders routes only once there is one. */
export function useUser(): UserDto {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser called outside a signed-in route");
  return user;
}

export function AuthForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const onAuthenticated = (user: UserDto) => queryClient.setQueryData(queryKeys.me, user);
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

export function WorldList() {
  const { t } = useTranslation();
  const user = useUser();
  const navigate = useNavigate();
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
              <button type="button" onClick={() => navigate({ to: "/world/$worldId", params: { worldId: w.id } })}>
                {t("worlds.open")}
              </button>
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

export function JoinInvite({ code }: { code: string }) {
  const { t } = useTranslation();
  const user = useUser();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const world = await api.join(code, String(form.get("displayName")), String(form.get("color")));
      await navigate({ to: "/world/$worldId", params: { worldId: world.id } });
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
