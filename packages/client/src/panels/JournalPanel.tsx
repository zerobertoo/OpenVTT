import type { AssetSummaryDto, HandoutDto, WorldStateDto } from "@openvtt/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, assetUrl } from "../api";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { EmptyState } from "../components/ui/empty-state";
import { Field } from "../components/ui/field";
import { FileButton } from "../components/ui/file-button";
import { Input, Textarea } from "../components/ui/input";
import { Markdown } from "../lib/markdown";
import { ErrorMessage, useAction } from "../ui";

interface Props {
  state: WorldStateDto;
  isGm: boolean;
}

export function JournalPanel({ state, isGm }: Props) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { run, error, pending } = useAction();
  const selected = state.handouts.find((h) => h.id === selectedId) ?? null;

  const create = () =>
    run(async () => {
      const { id } = await api.createHandout(state.id, { title: t("journal.untitled"), body: "" });
      setSelectedId(id);
      setEditing(true);
    });

  return (
    <section aria-label={t("tabs.journal")} className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
      <h3>{t("tabs.journal")}</h3>
      {state.handouts.length === 0 ? (
        <EmptyState title={t("journal.none")} description={t(isGm ? "journal.noneGm" : "journal.nonePlayer")} />
      ) : (
        <ul aria-label={t("journal.list")} className="m-0 flex list-none flex-wrap gap-2 p-0">
          {state.handouts.map((h) => (
            <li key={h.id}>
              <Button
                variant={h.id === selectedId ? "primary" : "secondary"}
                size="sm"
                aria-pressed={h.id === selectedId}
                onClick={() => {
                  setSelectedId(h.id);
                  setEditing(false);
                }}
              >
                {h.title}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {isGm && (
        <Button variant="secondary" size="sm" className="justify-self-start" pending={pending} onClick={create}>
          {t("journal.new")}
        </Button>
      )}
      <ErrorMessage error={error} />
      {selected &&
        (editing && isGm ? (
          <HandoutEditor key={selected.id} handout={selected} state={state} onDone={() => setEditing(false)} />
        ) : (
          <article aria-label={selected.title} className="grid gap-2">
            <h3>{selected.title}</h3>
            {isGm && <AudienceNote handout={selected} state={state} />}
            <Markdown source={selected.body} />
            {isGm && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setEditing(true)}>
                  {t("journal.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => run(() => api.deleteHandout(selected.id)).then(() => setSelectedId(null))}
                >
                  {t("common.delete")}
                </Button>
              </div>
            )}
          </article>
        ))}
      {isGm && <AssetLibrary worldId={state.id} canInsert={editing && selected !== null} />}
    </section>
  );
}

function AudienceNote({ handout, state }: { handout: HandoutDto; state: WorldStateDto }) {
  const { t } = useTranslation();
  const names = state.members.filter((m) => handout.audience.includes(m.userId)).map((m) => m.displayName);
  const text = handout.audience.includes("*")
    ? t("journal.sharedAll")
    : names.length
      ? t("journal.sharedWith", { names: names.join(", ") })
      : t("journal.private");
  return <p className="m-0 text-ink-2 text-sm">{text}</p>;
}

function HandoutEditor({ handout, state, onDone }: { handout: HandoutDto; state: WorldStateDto; onDone: () => void }) {
  const { t } = useTranslation();
  const { run, error, pending } = useAction();
  const [title, setTitle] = useState(handout.title);
  const [body, setBody] = useState(handout.body);
  const [audience, setAudience] = useState(handout.audience);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const everyone = audience.includes("*");
  const players = state.members.filter((m) => m.role === "player");
  const toggle = (userId: string, on: boolean) => setAudience((a) => (on ? [...a, userId] : a.filter((id) => id !== userId)));

  const insertImage = (assetId: string) => {
    const at = bodyRef.current?.selectionStart ?? body.length;
    setBody(`${body.slice(0, at)}![](asset:${assetId})${body.slice(at)}`);
  };
  useEffect(() => {
    insertImageRef.current = insertImage;
    return () => {
      insertImageRef.current = null;
    };
  });

  return (
    <form
      aria-label={t("journal.editTitle")}
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => api.updateHandout(handout.id, { title, body, audience })).then((ok) => ok !== undefined && onDone());
      }}
    >
      <Field label={t("journal.title")}>
        {(control) => <Input {...control} value={title} required maxLength={120} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t("journal.body")} hint={t("journal.bodyHint")}>
        {(control) => (
          <Textarea {...control} ref={bodyRef} rows={10} value={body} maxLength={50000} onChange={(e) => setBody(e.target.value)} />
        )}
      </Field>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 p-0 font-semibold text-[0.9rem]">{t("journal.audience")}</legend>
        <Field label={t("journal.everyone")} inline>
          {(control) => <Checkbox {...control} checked={everyone} onChange={(e) => setAudience(e.target.checked ? ["*"] : [])} />}
        </Field>
        {players.map((p) => (
          <Field key={p.userId} label={p.displayName} inline>
            {(control) => (
              <Checkbox
                {...control}
                disabled={everyone}
                checked={everyone || audience.includes(p.userId)}
                onChange={(e) => toggle(p.userId, e.target.checked)}
              />
            )}
          </Field>
        ))}
      </fieldset>
      <ErrorMessage error={error} />
      <div className="flex gap-2">
        <Button type="submit" pending={pending}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** The editor that is open, if any, so the library can insert into it. */
const insertImageRef: { current: ((assetId: string) => void) | null } = { current: null };

function AssetLibrary({ worldId, canInsert }: { worldId: string; canInsert: boolean }) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<AssetSummaryDto[] | null>(null);
  const { run, error, pending } = useAction();
  const load = () => run(async () => setAssets(await api.worldAssets(worldId)));

  return (
    <details className="grid gap-2" onToggle={(e) => (e.currentTarget.open && assets === null ? void load() : undefined)}>
      <summary className="cursor-pointer font-semibold">{t("journal.library")}</summary>
      <div className="mt-2 grid gap-2">
        <FileButton
          label={t("journal.upload")}
          accept="image/png,image/jpeg,image/webp"
          size="sm"
          className="justify-self-start"
          pending={pending}
          onPick={(file) =>
            void run(async () => {
              await api.uploadAsset(worldId, file);
              setAssets(await api.worldAssets(worldId));
            })
          }
        />
        <ErrorMessage error={error} />
        {assets?.length === 0 && <p className="m-0 text-ink-2 text-sm">{t("journal.libraryEmpty")}</p>}
        <ul aria-label={t("journal.library")} className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {assets?.map((asset) => (
            <li key={asset.id} className="grid gap-1">
              {asset.mime.startsWith("image/") ? (
                <img src={assetUrl(asset.id)} alt="" loading="lazy" className="aspect-square w-full rounded-md object-cover" />
              ) : (
                <span className="grid aspect-square place-items-center rounded-md bg-surface-2 text-sm">{t("journal.video")}</span>
              )}
              {canInsert && asset.mime.startsWith("image/") && (
                <Button size="sm" variant="link" onClick={() => insertImageRef.current?.(asset.id)}>
                  {t("journal.insert")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
