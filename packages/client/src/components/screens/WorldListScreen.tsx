import type { WorldSummaryDto } from "@openvtt/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { queryKeys, useSystems, useWorlds } from "../../queries";
import { ErrorMessage, errorKey } from "../../ui";
import { useUser } from "../../userContext";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog } from "../ui/dialog";
import { EmptyState, ErrorState } from "../ui/empty-state";
import { Field } from "../ui/field";
import { FileButton } from "../ui/file-button";
import { Input, Select } from "../ui/input";
import { Loading, Skeleton } from "../ui/skeleton";
import { toast } from "../ui/toast";

const ZIP_TYPES = ".zip,application/zip";

function WorldRow({ world }: { world: WorldSummaryDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Card as="li" variant="inset" className="flex items-center gap-3.5">
      <Avatar size="lg" name={world.name} />
      <span className="grid min-w-0 flex-1 gap-1">
        <strong className="break-words">{world.name}</strong>
        <span>
          <Badge tone={world.role === "gm" ? "accent" : "neutral"}>{t(world.role === "gm" ? "worlds.roleGm" : "worlds.rolePlayer")}</Badge>
        </span>
      </span>
      <Button onClick={() => navigate({ to: "/world/$worldId", params: { worldId: world.id } })}>
        {t("worlds.open")}
        <span className="sr-only"> {world.name}</span>
      </Button>
    </Card>
  );
}

function WorldRowsSkeleton() {
  const { t } = useTranslation();
  return (
    <Loading label={t("app.loading")}>
      <div className="grid gap-2.5">
        {[0, 1].map((row) => (
          <Card key={row} variant="inset" className="flex items-center gap-3.5">
            <Skeleton shape="circle" className="size-11 flex-none" />
            <span className="grid flex-1 gap-2">
              <Skeleton className="w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </span>
          </Card>
        ))}
      </div>
    </Loading>
  );
}

interface NewWorldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systems: { id: string; name: string; version: string }[];
  pending: boolean;
  onCreate: (name: string, systemId: string) => void;
}

/** Name and rules system of a new world. A bottom sheet on phones, a centered dialog elsewhere. */
function NewWorldDialog({ open, onOpenChange, systems, pending, onCreate }: NewWorldDialogProps) {
  const { t } = useTranslation();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onCreate(String(form.get("name")), String(form.get("systemId")));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("worlds.newTitle")} size="sm">
      <form onSubmit={submit} className="grid gap-3">
        <Field label={t("worlds.newName")}>{(control) => <Input {...control} name="name" required maxLength={80} />}</Field>
        <Field label={t("worlds.system")}>
          {(control) => (
            <Select {...control} name="systemId" defaultValue="generic">
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name} {system.version}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" pending={pending} className="justify-self-end">
          {t("worlds.create")}
        </Button>
      </form>
    </Dialog>
  );
}

/** Home of a signed-in person: their worlds, a way to start one and the file imports. */
export function WorldListScreen() {
  const { t } = useTranslation();
  const user = useUser();
  const queryClient = useQueryClient();
  const worldsQuery = useWorlds();
  const systemsQuery = useSystems();
  const [creating, setCreating] = useState(false);
  const worlds = worldsQuery.data ?? [];

  const addWorld = (world: WorldSummaryDto) =>
    queryClient.setQueryData<WorldSummaryDto[]>(queryKeys.worlds, (previous) => [...(previous ?? []), world]);
  const createWorld = useMutation({
    mutationFn: ({ name, systemId }: { name: string; systemId: string }) => api.createWorld(name, systemId),
    onSuccess: (world) => {
      addWorld(world);
      setCreating(false);
      toast({ title: t("worlds.created"), tone: "success" });
    },
  });
  const importWorld = useMutation({ mutationFn: api.importWorld, onSuccess: addWorld });
  const installSystem = useMutation({
    mutationFn: api.installSystem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.systems }),
  });
  const error = systemsQuery.error ?? createWorld.error ?? importWorld.error ?? installSystem.error;

  const newWorldButton = <Button onClick={() => setCreating(true)}>{t("worlds.new")}</Button>;

  return (
    <section className="grid gap-4">
      <Card className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 font-bold text-[1.6rem] tracking-tight">{t("worlds.title")}</h1>
          {worlds.length > 0 && newWorldButton}
        </div>
        {worldsQuery.isPending && <WorldRowsSkeleton />}
        {worldsQuery.isError && (
          <ErrorState
            title={t("states.loadFailed")}
            description={t(errorKey(worldsQuery.error))}
            onRetry={() => void worldsQuery.refetch()}
            retryLabel={t("common.retry")}
            retrying={worldsQuery.isFetching}
          />
        )}
        {worldsQuery.isSuccess && worlds.length === 0 && (
          <EmptyState title={t("worlds.empty")} description={t("worlds.emptyHint")} headingLevel={2} action={newWorldButton} />
        )}
        {worlds.length > 0 && (
          <ul aria-label={t("worlds.title")} className="m-0 grid list-none gap-2.5 p-0">
            {worlds.map((world) => (
              <WorldRow key={world.id} world={world} />
            ))}
          </ul>
        )}
      </Card>

      <Card as="section" aria-label={t("worlds.moreTitle")} className="grid gap-3">
        <h2 className="m-0 text-[1.05rem]">{t("worlds.moreTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <FileButton
            label={t("worlds.import")}
            accept={ZIP_TYPES}
            pending={importWorld.isPending}
            onPick={(file) => importWorld.mutate(file)}
          />
          {user.role === "admin" && (
            <FileButton
              label={t("worlds.installSystem")}
              accept={ZIP_TYPES}
              pending={installSystem.isPending}
              onPick={(file) => installSystem.mutate(file)}
            />
          )}
        </div>
      </Card>
      <ErrorMessage error={error} />

      <NewWorldDialog
        open={creating}
        onOpenChange={setCreating}
        systems={systemsQuery.data ?? []}
        pending={createWorld.isPending}
        onCreate={(name, systemId) => createWorld.mutate({ name, systemId })}
      />
    </section>
  );
}
