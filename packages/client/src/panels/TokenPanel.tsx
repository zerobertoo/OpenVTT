import type { TokenDto, WorldStateDto } from "@openvtt/shared";
import { type ChangeEvent, type FormEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { Initiative } from "../components/tokens/Initiative";
import { TokenEditor } from "../components/tokens/TokenEditor";
import { TokenList } from "../components/tokens/TokenList";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Field } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { bulkPosition, MAX_BULK_TOKENS, tokenNameFromFile } from "../lib/bulkTokens";
import { useTableUi } from "../tableStore";
import { ErrorMessage, useAction } from "../ui";
import { useCan } from "../useCan";

interface Props {
  state: WorldStateDto;
  userId: string;
  viewSceneId: string | null;
  token: TokenDto | null;
}

export function TokenPanel({ state, userId, viewSceneId, token }: Props) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const selectToken = useTableUi((ui) => ui.selectToken);
  const { isGm, canControlToken } = useCan(state.yourRole, userId);
  const scene = state.scenes.find((s) => s.id === viewSceneId);
  const sceneTokens = state.tokens.filter((candidate) => candidate.sceneId === viewSceneId);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!scene) return;
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name"));
    void run(async () => {
      const created = await api.createToken(state.id, { sceneId: scene.id, name, x: scene.gridSize, y: scene.gridSize, size: 1 });
      form.reset();
      return created;
    });
  };

  const bulkInput = useRef<HTMLInputElement>(null);
  // One token per picked image, named after its file; uploads go one after another to keep the server calm.
  const importImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, MAX_BULK_TOKENS);
    e.target.value = "";
    if (!scene || files.length === 0) return;
    void run(async () => {
      for (const [index, file] of files.entries()) {
        const { id: assetId } = await api.uploadAsset(state.id, file);
        const { x, y } = bulkPosition(index, scene);
        await api.createToken(state.id, { sceneId: scene.id, name: tokenNameFromFile(file.name), x, y, size: 1, assetId });
      }
      return true;
    });
  };

  const patch = (body: object) => {
    if (token) void run(() => api.updateToken(token.id, body));
  };

  const uploadImage = (file: File) => {
    if (!token) return;
    void run(async () => api.updateToken(token.id, { assetId: (await api.uploadAsset(state.id, file)).id }));
  };

  const players = state.members.filter((m) => m.role === "player");
  const canControl = token && canControlToken(token);

  return (
    <section aria-label={t("token.title")} className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
      <h3>{t("token.title")}</h3>
      {isGm && scene && (
        <form onSubmit={add} className="flex items-end gap-2">
          <Field label={t("token.name")} className="flex-1">
            {(control) => <Input {...control} name="name" required maxLength={60} />}
          </Field>
          <Button type="submit">{t("token.add")}</Button>
        </form>
      )}
      {isGm && scene && (
        <>
          <input ref={bulkInput} type="file" multiple accept="image/png,image/jpeg,image/webp" hidden onChange={importImages} />
          <Button variant="secondary" onClick={() => bulkInput.current?.click()}>
            {t("token.importImages")}
          </Button>
          <p className="muted">{t("token.importImagesHint", { max: MAX_BULK_TOKENS })}</p>
        </>
      )}

      {sceneTokens.length > 0 ? (
        <TokenList tokens={sceneTokens} selectedId={token?.id ?? null} onSelect={selectToken} />
      ) : (
        <EmptyState title={t("token.none")} description={isGm ? t("token.noneHint") : undefined} headingLevel={4} />
      )}

      {token && canControl && (
        <TokenEditor
          // Uncontrolled inputs read their defaults once, so remount when the token changes from outside.
          key={token.id + JSON.stringify([token.name, token.size, token.color, token.hidden, token.actorId, token.rotation, token.assetId, token.hp, token.hpMax, token.conditions, token.showName])}
          token={token}
          players={players}
          actors={state.actors}
          isGm={isGm}
          onPatch={patch}
          onUpload={uploadImage}
          onDelete={() => void run(() => api.deleteToken(token.id))}
        />
      )}
      {sceneTokens.length > 0 && !token && <p className="muted">{t("token.noneSelected")}</p>}
      <Initiative
        combat={state.combat}
        isGm={isGm}
        selectedToken={token}
        onSetScore={(tokenId, score) => void run(() => api.setCombatant(state.id, tokenId, score))}
        onRemove={(tokenId) => void run(() => api.removeCombatant(state.id, tokenId))}
        onNextTurn={() => void run(() => api.nextTurn(state.id))}
        onEnd={() => void run(() => api.endCombat(state.id))}
      />
      <ErrorMessage error={error} />
    </section>
  );
}
