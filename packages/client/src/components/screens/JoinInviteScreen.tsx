import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { queryKeys } from "../../queries";
import { ErrorMessage } from "../../ui";
import { useUser } from "../../userContext";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

/** Where an invite link lands: pick a name and a color for this world, then join. */
export function JoinInviteScreen({ code }: { code: string }) {
  const { t } = useTranslation();
  const user = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user.username);
  const [color, setColor] = useState("#3d6fd8");

  const join = useMutation({
    mutationFn: () => api.join(code, displayName, color),
    onSuccess: async (world) => {
      // The new world belongs in the list the person sees when they come back.
      await queryClient.invalidateQueries({ queryKey: queryKeys.worlds });
      await navigate({ to: "/world/$worldId", params: { worldId: world.id } });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    join.mutate();
  };

  return (
    <Card as="section" aria-labelledby="join-title" className="grid gap-4">
      <h1 id="join-title" className="m-0 font-bold text-[1.6rem] tracking-tight">
        {t("invite.title")}
      </h1>
      <p className="m-0 text-ink-2">{t("invite.intro")}</p>
      <form onSubmit={submit} className="grid gap-4">
        <div className="flex items-end gap-3">
          <Avatar size="lg" name={displayName || "?"} color={color} />
          <Field label={t("invite.displayName")} className="flex-1">
            {(control) => (
              <Input {...control} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} />
            )}
          </Field>
        </div>
        <Field label={t("invite.color")}>
          {(control) => (
            <input
              {...control}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[2.6rem] w-24 cursor-pointer rounded-xl border-0 bg-transparent p-0.5"
            />
          )}
        </Field>
        <ErrorMessage error={join.error} />
        <Button type="submit" pending={join.isPending} className="justify-self-start">
          {t("invite.join")}
        </Button>
      </form>
    </Card>
  );
}
