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
