import type { ActorType } from "@openvtt/sdk";
import type { WorldStateDto } from "@openvtt/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api } from "../api";
import { queryKeys, useWorldSystem } from "../queries";
import { ErrorMessage, useAction } from "../ui";

function TemplateEditor({ worldId }: { worldId: string }) {
  const { t } = useTranslation();
  const { run, error } = useAction();
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
    <section>
      <h3>{t("settings.template")}</h3>
      <p className="muted">{t("settings.templateHelp")}</p>
      <label>
        {t("sheet.type")}
        <select value={type} onChange={(e) => setType(e.target.value as ActorType)}>
          {(Object.keys(system.manifest.actorTypes) as ActorType[]).map((k) => (
            <option key={k} value={k}>
              {t(k === "npc" ? "sheet.npc" : "sheet.character")}
            </option>
          ))}
        </select>
      </label>
      <textarea
        className="code"
        rows={14}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label={t("settings.template")}
      />
      {jsonError && (
        <p role="alert" className="error">
          {t("settings.invalidJson")}
        </p>
      )}
      <ErrorMessage error={error instanceof ApiError ? error : error} />
      <div className="row">
        <button onClick={save}>{t("common.save")}</button>
        {system.overridden.includes(type) && (
          <button className="secondary" onClick={reset}>
            {t("settings.resetTemplate")}
          </button>
        )}
      </div>
    </section>
  );
}

export function SettingsPanel({ state }: { state: WorldStateDto }) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const { data: system } = useWorldSystem(state.id);
  const isGm = state.yourRole === "gm";

  return (
    <section aria-label={t("settings.title")}>
      <h3>{t("table.members")}</h3>
      <ul className="plain">
        {state.members.map((m) => (
          <li key={m.userId}>
            <span className="dot" style={{ background: m.color }} />
            {m.displayName}
            <span className="muted">
              {t(m.role === "gm" ? "worlds.roleGm" : "worlds.rolePlayer")} · {t(m.online ? "table.online" : "table.offline")}
            </span>
          </li>
        ))}
      </ul>
      {system && (
        <p className="muted">
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
          <button onClick={() => run(async () => setInviteLink(`${location.origin}/join/${(await api.createInvite(state.id)).code}`))}>
            {t("invite.create")}
          </button>
          {inviteLink && (
            <p>
              {t("invite.linkLabel")}: <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} size={40} />
            </p>
          )}
          <p>
            <a href={api.exportUrl(state.id)} download>
              {t("settings.export")}
            </a>
          </p>
          <ErrorMessage error={error} />
          <TemplateEditor worldId={state.id} />
        </>
      )}
    </section>
  );
}
