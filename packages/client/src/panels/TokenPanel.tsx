import type { TokenDto, WorldStateDto } from "@openvtt/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { Button } from "../components/ui/button";
import { ErrorMessage, useAction } from "../ui";

interface Props {
  state: WorldStateDto;
  userId: string;
  viewSceneId: string | null;
  token: TokenDto | null;
}

export function TokenPanel({ state, userId, viewSceneId, token }: Props) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const isGm = state.yourRole === "gm";
  const scene = state.scenes.find((s) => s.id === viewSceneId);
  const [rotation, setRotation] = useState<number | null>(null);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!scene) return;
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name"));
    void run(async () => {
      await api.createToken(state.id, { sceneId: scene.id, name, x: scene.gridSize, y: scene.gridSize, size: 1 });
      form.reset();
    });
  };

  const patch = (body: object) => token && run(() => api.updateToken(token.id, body));

  const uploadImage = (file: File | undefined) => {
    if (!token || !file) return;
    void run(async () => patch({ assetId: (await api.uploadAsset(state.id, file)).id }));
  };

  const players = state.members.filter((m) => m.role === "player");
  const canControl = token && (isGm || token.controllerIds.includes(userId));

  return (
    <section aria-label={t("token.title")}>
      <h3>{t("token.title")}</h3>
      {isGm && scene && (
        <form onSubmit={add} className="row">
          <input name="name" required maxLength={60} placeholder={t("token.name")} aria-label={t("token.name")} />
          <Button type="submit">{t("token.add")}</Button>
        </form>
      )}
      {!token && <p className="muted">{t("token.noneSelected")}</p>}
      {token && (
        <div
          key={token.id + JSON.stringify([token.name, token.size, token.color, token.hidden, token.actorId, token.rotation])}
          className="compact"
        >
          <h4>{token.name}</h4>
          {canControl && (
            <label>
              {t("token.rotation")}
              <input
                type="range"
                min={0}
                max={360}
                step={15}
                value={rotation ?? ((token.rotation % 360) + 360) % 360}
                onChange={(e) => setRotation(Number(e.target.value))}
                onPointerUp={() => {
                  void patch({ rotation: rotation ?? token.rotation });
                  setRotation(null);
                }}
                onKeyUp={() => {
                  void patch({ rotation: rotation ?? token.rotation });
                  setRotation(null);
                }}
              />
            </label>
          )}
          {isGm && (
            <>
              <label>
                {t("token.name")}
                <input
                  defaultValue={token.name}
                  maxLength={60}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== token.name && patch({ name: e.target.value })}
                />
              </label>
              <label>
                {t("token.size")}
                <input
                  type="number"
                  min={0.25}
                  max={20}
                  step={0.25}
                  defaultValue={token.size}
                  onBlur={(e) => patch({ size: Number(e.target.value) })}
                />
              </label>
              <label>
                {t("token.color")}
                <input type="color" defaultValue={token.color} onBlur={(e) => patch({ color: e.target.value })} />
              </label>
              <label>
                {t("token.image")}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadImage(e.target.files?.[0])} />
              </label>
              {token.assetId && (
                <Button variant="link" onClick={() => patch({ assetId: null })}>
                  {t("token.removeImage")}
                </Button>
              )}
              <label className="inline">
                <input type="checkbox" defaultChecked={token.hidden} onChange={(e) => patch({ hidden: e.target.checked })} />{" "}
                {t("token.hidden")}
              </label>
              <label>
                {t("token.actor")}
                <select defaultValue={token.actorId ?? ""} onChange={(e) => patch({ actorId: e.target.value || null })}>
                  <option value="">{t("token.noActor")}</option>
                  {state.actors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>{t("token.controllers")}</legend>
                {players.map((m) => (
                  <label key={m.userId} className="inline">
                    <input
                      type="checkbox"
                      defaultChecked={token.controllerIds.includes(m.userId)}
                      onChange={(e) =>
                        patch({
                          controllerIds: e.target.checked
                            ? [...token.controllerIds, m.userId]
                            : token.controllerIds.filter((id) => id !== m.userId),
                        })
                      }
                    />{" "}
                    {m.displayName}
                  </label>
                ))}
              </fieldset>
              <Button variant="danger" onClick={() => run(() => api.deleteToken(token.id))}>
                {t("common.delete")}
              </Button>
            </>
          )}
          <ErrorMessage error={error} />
        </div>
      )}
      {!token && <ErrorMessage error={error} />}
    </section>
  );
}
