import type { TokenDto, WorldStateDto } from "@openvtt/shared";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { Initiative } from "../components/tokens/Initiative";
import { TokenEditor } from "../components/tokens/TokenEditor";
import { TokenList } from "../components/tokens/TokenList";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Field } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { PanelSection } from "../components/ui/panel-section";
import { Popover } from "../components/ui/popover";
import { Icon } from "../icons";
import { bulkPosition, MAX_BULK_TOKENS, tokenNameFromFile } from "../lib/bulkTokens";
import { useOnline } from "../lib/online";
import { shrinkImage } from "../lib/shrinkImage";
import type { TableActions } from "../lib/tableActions";
import { useTableUi } from "../tableStore";
import { ErrorMessage, useAction } from "../ui";
import { useCan } from "../useCan";

interface Props {
  state: WorldStateDto;
  userId: string;
  viewSceneId: string | null;
  /** Floor the game master is looking at; new tokens land on it. */
  viewFloorId: string | null;
  token: TokenDto | null;
  /** Lets the game master undo what was just done to tokens. */
  actions: Pick<TableActions, "changeToken" | "tokenCreated">;
}

export function TokenPanel({ state, userId, viewSceneId, viewFloorId, token, actions }: Props) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  // The new-token form has its own action so its failure shows inside the popover instead of behind it.
  // Its popover is portaled out of the panel fieldset, so the form follows the connection itself (`online`).
  const addAction = useAction();
  const online = useOnline();
  const selectToken = useTableUi((ui) => ui.selectToken);
  const { isGm, canControlToken } = useCan(state.yourRole, userId);
  const scene = state.scenes.find((s) => s.id === viewSceneId);
  const sceneTokens = state.tokens.filter((candidate) => candidate.sceneId === viewSceneId);

  const [adding, setAdding] = useState(false);
  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!scene) return;
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name"));
    void addAction.run(async () => {
      const created = await api.createToken(state.id, {
        sceneId: scene.id,
        floorId: viewFloorId ?? undefined,
        name,
        x: scene.gridSize,
        y: scene.gridSize,
        size: 1,
      });
      actions.tokenCreated(created);
      form.reset();
      setAdding(false);
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
        const { id: assetId } = await api.uploadAsset(state.id, await shrinkImage(file));
        const { x, y } = bulkPosition(index, scene);
        const created = await api.createToken(state.id, {
          sceneId: scene.id,
          floorId: viewFloorId ?? undefined,
          name: tokenNameFromFile(file.name),
          x,
          y,
          size: 1,
          assetId,
        });
        actions.tokenCreated(created);
      }
      return true;
    });
  };

  const patch = (body: object) => {
    if (token) void run(() => actions.changeToken(token, body as Record<string, unknown>));
  };

  const uploadImage = (file: File) => {
    if (!token) return;
    void run(async () => {
      const { id: assetId } = await api.uploadAsset(state.id, await shrinkImage(file));
      await actions.changeToken(token, { assetId });
    });
  };

  const players = state.members.filter((m) => m.role === "player");
  const canControl = token && canControlToken(token);

  return (
    <PanelSection
      title={t("token.title")}
      error={<ErrorMessage error={error} />}
      action={
        isGm && scene ? (
          <Popover
            open={adding}
            onOpenChange={(open) => {
              if (open) addAction.clear();
              setAdding(open);
            }}
            label={t("token.new")}
            trigger={
              <Button size="sm">
                <Icon name="plus" />
                {t("token.new")}
              </Button>
            }
          >
            <fieldset disabled={!online} className="m-0 grid min-w-0 gap-3 border-0 p-0">
              <form onSubmit={add} className="flex items-end gap-2">
                <Field label={t("token.name")} className="flex-1">
                  {(control) => <Input {...control} name="name" required maxLength={60} />}
                </Field>
                <Button type="submit" pending={addAction.pending}>
                  {t("token.add")}
                </Button>
              </form>
              <ErrorMessage error={addAction.error} />
              <div className="grid gap-1.5 border-line border-t-[1.5px] pt-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAdding(false);
                    bulkInput.current?.click();
                  }}
                >
                  {t("token.importImages")}
                </Button>
                <p className="m-0 text-ink-2 text-sm">{t("token.importImagesHint", { max: MAX_BULK_TOKENS })}</p>
              </div>
            </fieldset>
          </Popover>
        ) : undefined
      }
    >
      {isGm && scene && (
        <input ref={bulkInput} type="file" multiple accept="image/png,image/jpeg,image/webp" hidden onChange={importImages} />
      )}

      {sceneTokens.length > 0 ? (
        <TokenList tokens={sceneTokens} selectedId={token?.id ?? null} onSelect={selectToken} />
      ) : (
        <EmptyState title={t("token.none")} description={isGm ? t("token.noneHint") : undefined} headingLevel={4} />
      )}

      {token && canControl && (
        <TokenEditor
          // Uncontrolled inputs read their defaults once, so remount when the token changes from outside.
          key={
            token.id +
            JSON.stringify([
              token.name,
              token.size,
              token.hidden,
              token.actorId,
              token.assetId,
              token.hp,
              token.hpMax,
              token.conditions,
              token.showName,
            ])
          }
          token={token}
          players={players}
          actors={state.actors}
          isGm={isGm}
          floors={scene?.floors}
          onPatch={patch}
          onUpload={uploadImage}
          onDelete={() => void run(() => api.deleteToken(token.id))}
        />
      )}
      {sceneTokens.length > 0 && !token && <p className="m-0 text-ink-2">{t("token.noneSelected")}</p>}
      {token && !canControl && <p className="m-0 text-ink-2">{t("token.notYours")}</p>}
      <Initiative
        combat={state.combat}
        isGm={isGm}
        selectedToken={token}
        onSetScore={(tokenId, score) => void run(() => api.setCombatant(state.id, tokenId, score))}
        onRemove={(tokenId) => void run(() => api.removeCombatant(state.id, tokenId))}
        onNextTurn={() => void run(() => api.nextTurn(state.id))}
        onEnd={() => void run(() => api.endCombat(state.id))}
      />
    </PanelSection>
  );
}
