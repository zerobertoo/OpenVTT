import { passwordSchema, type UserDto, usernameSchema, type WorldSummaryDto } from "@openvtt/shared";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { createContext, type FormEvent, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";
import { AccountControls } from "./components/AccountControls";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { EmptyState, ErrorState } from "./components/ui/empty-state";
import { Field } from "./components/ui/field";
import { Input } from "./components/ui/input";
import { Loading, Skeleton } from "./components/ui/skeleton";
import { setLocale } from "./i18n";
import { Logo } from "./icons";
import { queryKeys, useMe, useSystems, useWorlds } from "./queries";
import { ErrorMessage, errorKey } from "./ui";

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

  const form = useForm({
    defaultValues: { username: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        onAuthenticated(await (mode === "login" ? api.login : api.register)(value.username, value.password));
      } catch (err) {
        setError(err);
      }
    },
  });

  // Logging in only needs something typed; the server decides. Registering checks the same rules the server enforces.
  const validateUsername = ({ value }: { value: string }) => {
    if (!value.trim()) return t("validation.required");
    return mode === "register" && !usernameSchema.safeParse(value).success ? t("validation.usernameInvalid") : undefined;
  };
  const validatePassword = ({ value }: { value: string }) => {
    if (!value) return t("validation.required");
    return mode === "register" && !passwordSchema.safeParse(value).success ? t("validation.passwordTooShort") : undefined;
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
    form.reset();
  };

  return (
    <div className="welcome">
      <h1>{t("auth.welcomeTitle")}</h1>
      <p className="muted">{t("auth.welcomeText")}</p>
      <form
        noValidate
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="username" validators={{ onBlur: validateUsername, onSubmit: validateUsername }}>
          {(field) => (
            <Field label={t("auth.username")} error={field.state.meta.errors[0]}>
              {(control) => (
                <Input
                  {...control}
                  name={field.name}
                  autoComplete="username"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </Field>
          )}
        </form.Field>
        <form.Field name="password" validators={{ onBlur: validatePassword, onSubmit: validatePassword }}>
          {(field) => (
            <Field
              label={t("auth.password")}
              error={field.state.meta.errors[0]}
              hint={mode === "register" ? t("validation.passwordHint") : undefined}
            >
              {(control) => (
                <Input
                  {...control}
                  name={field.name}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </Field>
          )}
        </form.Field>
        <ErrorMessage error={error} />
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" pending={isSubmitting}>
              {t(mode === "login" ? "auth.login" : "auth.register")}
            </Button>
          )}
        </form.Subscribe>
        {mode === "register" && <p className="muted">{t("auth.firstUserHint")}</p>}
        <Button type="button" variant="link" onClick={switchMode}>
          {t(mode === "login" ? "auth.switchToRegister" : "auth.switchToLogin")}
        </Button>
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
        {worldsQuery.isPending && (
          <Loading label={t("app.loading")} className="mt-3">
            <div className="grid gap-[0.6rem]">
              {[0, 1].map((row) => (
                <Card key={row} variant="inset" className="flex items-center gap-[0.9rem]">
                  <Skeleton shape="block" className="size-[2.8rem] flex-none rounded-[0.85rem]" />
                  <span className="grid flex-1 gap-2">
                    <Skeleton className="w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </span>
                </Card>
              ))}
            </div>
          </Loading>
        )}
        {worldsQuery.isError && (
          <ErrorState
            className="mt-3"
            title={t("states.loadFailed")}
            description={t(errorKey(worldsQuery.error))}
            onRetry={() => void worldsQuery.refetch()}
            retryLabel={t("common.retry")}
            retrying={worldsQuery.isFetching}
          />
        )}
        {worldsQuery.isSuccess && worlds.length === 0 && (
          <EmptyState title={t("worlds.empty")} description={t("worlds.emptyHint")} headingLevel={2} />
        )}
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
              <Button type="button" onClick={() => navigate({ to: "/world/$worldId", params: { worldId: w.id } })}>
                {t("worlds.open")}
              </Button>
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
        <Button type="submit">{t("worlds.create")}</Button>
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
      <Button type="submit">{t("invite.join")}</Button>
    </form>
  );
}
