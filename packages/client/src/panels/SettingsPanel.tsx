import type { ActorType } from "@openvtt/sdk";
import type { WorldStateDto } from "@openvtt/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { Button } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { Select, Textarea } from "../components/ui/input";
import { InviteLink } from "../components/world/InviteLink";
import { MemberList } from "../components/world/MemberList";
import { MusicControls } from "../components/world/MusicControls";
import { queryKeys, useWorldSystem } from "../queries";
import { ErrorMessage, useAction } from "../ui";

function TemplateEditor({ worldId }: { worldId: string }) {
  const { t } = useTranslation();
  const { run, error, pending } = useAction();
  const queryClient = useQueryClient();
  const { data: system } = useWorldSystem(worldId);
  const [type, setType] = useState<ActorType>("character");
  const [text, setText] = useState("");
  const [jsonError, setJsonError] = useState(false);

  const load = () => queryClient.invalidateQueries({ queryKey: queryKeys.worldSystem(worldId) });
  useEffect(() => {
    if (system) setText(JSON.stringify(system.templates[type] ?? { sections: [] }, null, 2));
  }, [system, type]);

  const save = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
      setJsonError(false);
    } catch {
      return setJsonError(true);
    }
    void run(async () => {
      await api.updateWorld(worldId, { templateOverrides: { [type]: parsed } });
      await load();
    });
  };
  const reset = () =>
    run(async () => {
      await api.updateWorld(worldId, { templateOverrides: { [type]: null } });
      await load();
    });

  if (!system) return null;
  return (
    <section aria-label={t("settings.template")} className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <h3>{t("settings.template")}</h3>
      <Field label={t("sheet.type")}>
        {(control) => (
          <Select {...control} value={type} onChange={(e) => setType(e.target.value as ActorType)}>
            {(Object.keys(system.manifest.actorTypes) as ActorType[]).map((k) => (
              <option key={k} value={k}>
                {t(k === "npc" ? "sheet.npc" : "sheet.character")}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("settings.template")} hint={t("settings.templateHelp")} error={jsonError ? t("settings.invalidJson") : undefined}>
        {(control) => (
          <Textarea
            {...control}
            className="font-mono text-[0.85rem]"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        )}
      </Field>
      <ErrorMessage error={error} />
      <div className="flex flex-wrap gap-2">
        <Button pending={pending} onClick={save}>
          {t("common.save")}
        </Button>
        {system.overridden.includes(type) && (
          <Button variant="secondary" onClick={reset}>
            {t("settings.resetTemplate")}
          </Button>
        )}
      </div>
    </section>
  );
}

export function SettingsPanel({ state }: { state: WorldStateDto }) {
  const { t } = useTranslation();
  const { run, error, pending } = useAction();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const { data: system } = useWorldSystem(state.id);
  const isGm = state.yourRole === "gm";

  return (
    <section aria-label={t("settings.title")} className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
      <h3>{t("table.members")}</h3>
      <MemberList members={state.members} />
      {system && (
        <p className="m-0 break-words text-ink-2 text-sm">
          {t("settings.system")}: {system.manifest.name} {system.manifest.version} ({system.manifest.license})
          {system.manifest.attribution && (
            <>
              <br />
              {system.manifest.attribution}
            </>
          )}
        </p>
      )}
      {isGm && (
        <>
          <InviteLink
            link={inviteLink}
            creating={pending}
            onCreate={() => run(async () => setInviteLink(`${location.origin}/join/${(await api.createInvite(state.id)).code}`))}
          />
          <a
            className="justify-self-start font-semibold text-accent-text underline underline-offset-[3px]"
            href={api.exportUrl(state.id)}
            download
          >
            {t("settings.export")}
          </a>
          <ErrorMessage error={error} />
          <MusicControls worldId={state.id} ambient={state.ambient} />
          <TemplateEditor worldId={state.id} />
        </>
      )}
    </section>
  );
}
