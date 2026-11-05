import type { ActorType } from "@openvtt/sdk";
import type { AuditEntryDto, WorldStateDto } from "@openvtt/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { Button } from "../components/ui/button";
import { Disclosure } from "../components/ui/disclosure";
import { Field } from "../components/ui/field";
import { Textarea } from "../components/ui/input";
import { PanelSection } from "../components/ui/panel-section";
import { Select } from "../components/ui/select";
import { EnvironmentControls } from "../components/world/EnvironmentControls";
import { InviteLink } from "../components/world/InviteLink";
import { MemberList } from "../components/world/MemberList";
import { MusicControls } from "../components/world/MusicControls";
import { queryKeys, useWorldSystem } from "../queries";
import { ErrorMessage, useAction } from "../ui";

/** Plain links that act like buttons (a download, a new window) share one look. */
const ACTION_LINK = "justify-self-start font-semibold text-accent-text underline underline-offset-[3px]";

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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Field label={t("sheet.type")}>
        {(control) => (
          <Select {...control} value={type} onValueChange={(value) => setType(value as ActorType)}>
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
            className="font-mono text-label"
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
    </div>
  );
}

/** Rules system, version, license and attribution; every member sees it, since some licenses require the credit to be visible. */
function SystemInfo({ worldId }: { worldId: string }) {
  const { t } = useTranslation();
  const { data: system } = useWorldSystem(worldId);
  if (!system) return null;
  return (
    <p className="m-0 break-words text-ink-2 text-sm">
      {t("settings.system")}: {system.manifest.name} {system.manifest.version} ({system.manifest.license})
      {system.manifest.attribution && (
        <>
          <br />
          {system.manifest.attribution}
        </>
      )}
    </p>
  );
}

function ActionLog({ worldId }: { worldId: string }) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<AuditEntryDto[] | null>(null);
  const { run, error } = useAction();
  return (
    <Disclosure
      title={t("members.actionLog")}
      onOpenChange={(open) => open && void run(async () => setEntries(await api.auditLog(worldId)))}
    >
      <ErrorMessage error={error} />
      {entries?.length === 0 && <p className="m-0 text-ink-2 text-sm">{t("members.actionLogEmpty")}</p>}
      <ol className="m-0 mt-2 grid list-none gap-1 p-0 text-sm">
        {entries?.map((entry) => (
          <li key={`${entry.createdAt}-${entry.action}-${entry.detail}`}>
            <time className="text-ink-2" dateTime={new Date(entry.createdAt).toISOString()}>
              {new Date(entry.createdAt).toLocaleString(i18n.language)}
            </time>{" "}
            <strong>{entry.actorName}</strong> {t(`members.actions.${entry.action.replace(".", "_")}`, { defaultValue: entry.action })}
            {entry.detail && `: ${entry.detail}`}
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}

/**
 * The world tab: who is here, how to invite them, sound, sharing and export, and the advanced rules tools.
 * Personal preferences (language, theme, dice) live in the account menu, not here.
 */
export function SettingsPanel({ state }: { state: WorldStateDto }) {
  const { t } = useTranslation();
  const invite = useAction();
  const manage = useAction();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const isGm = state.yourRole === "gm" || state.yourRole === "assistant";
  const isOwner = state.yourRole === "gm";

  return (
    <div
      role="region"
      aria-label={t("settings.title")}
      className="grid grid-cols-[minmax(0,1fr)] content-start gap-5 [&>*+*]:border-line [&>*+*]:border-t-[1.5px] [&>*+*]:pt-4"
    >
      <PanelSection title={t("table.members")} error={<ErrorMessage error={manage.error} />}>
        <MemberList
          members={state.members}
          manage={
            isOwner
              ? {
                  onRoleChange: (userId, role) => void manage.run(() => api.updateMember(state.id, userId, { role })),
                  onMuteChange: (userId, muted) => void manage.run(() => api.updateMember(state.id, userId, { muted })),
                  onKick: (userId) => void manage.run(() => api.kickMember(state.id, userId)),
                }
              : undefined
          }
        />
      </PanelSection>

      {isOwner && (
        <PanelSection title={t("settings.invite")} error={<ErrorMessage error={invite.error} />}>
          <InviteLink
            link={inviteLink}
            creating={invite.pending}
            onCreate={(options) =>
              invite.run(async () => setInviteLink(`${location.origin}/join/${(await api.createInvite(state.id, options)).code}`))
            }
          />
        </PanelSection>
      )}

      {isGm && <MusicControls worldId={state.id} ambient={state.ambient} />}
      {isGm && <EnvironmentControls worldId={state.id} environment={state.environment} />}

      <PanelSection title={t("settings.share")}>
        <SystemInfo worldId={state.id} />
        <a className={ACTION_LINK} href={`${location.pathname}?tv`} target="_blank" rel="noopener">
          {t("settings.tvView")}
        </a>
        {isGm && (
          <a className={ACTION_LINK} href={api.exportUrl(state.id)} download>
            {t("settings.export")}
          </a>
        )}
      </PanelSection>

      {isGm && (
        <div className="grid gap-1">
          {/* Kept mounted so folding it does not throw away unsaved template edits. */}
          <Disclosure title={t("settings.advanced")} keepMounted>
            <TemplateEditor worldId={state.id} />
          </Disclosure>
          <ActionLog worldId={state.id} />
        </div>
      )}
    </div>
  );
}
