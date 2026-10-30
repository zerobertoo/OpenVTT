import { type ActorDto, type MemberDto, TOKEN_CONDITIONS, type TokenDto } from "@openvtt/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AssetPicker } from "../ui/asset-picker";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Checkbox, Switch } from "../ui/checkbox";
import { ConfirmDialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input, Select } from "../ui/input";

interface Props {
  token: TokenDto;
  players: MemberDto[];
  actors: ActorDto[];
  /** Game masters edit everything; a controlling player may only rotate. */
  isGm: boolean;
  onPatch: (body: object) => void;
  onUpload: (file: File) => void;
  onDelete: () => void;
}

/** Fields of the selected token. Each change is saved as soon as it is made. */
export function TokenEditor({ token, players, actors, isGm, onPatch, onUpload, onDelete }: Props) {
  const { t } = useTranslation();
  const [rotation, setRotation] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commitRotation = () => {
    onPatch({ rotation: rotation ?? token.rotation });
    setRotation(null);
  };

  return (
    <Card variant="inset" className="grid gap-3" aria-label={t("token.edit")} as="section">
      <h4 className="m-0 text-base">{token.name}</h4>

      <Field label={t("token.rotation")}>
        {(control) => (
          <input
            {...control}
            type="range"
            min={0}
            max={360}
            step={15}
            value={rotation ?? ((token.rotation % 360) + 360) % 360}
            onChange={(e) => setRotation(Number(e.target.value))}
            onPointerUp={commitRotation}
            onKeyUp={commitRotation}
          />
        )}
      </Field>

      {!isGm && token.hp !== null && token.hpMax !== null && (
        <Field label={t("token.hp", { max: token.hpMax })}>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={-9999}
              max={99999}
              step={1}
              defaultValue={token.hp ?? ""}
              onBlur={(e) =>
                e.target.value !== "" && Number(e.target.value) !== token.hp && onPatch({ hp: Math.round(Number(e.target.value)) })
              }
            />
          )}
        </Field>
      )}

      <fieldset className="m-0 grid grid-cols-2 gap-x-3 gap-y-1.5 border-0 p-0">
        <legend className="mb-1 p-0 font-semibold text-[0.9rem]">{t("token.conditions")}</legend>
        {TOKEN_CONDITIONS.map((id) => (
          <Field key={id} label={t(`condition.${id}`)} inline>
            {(control) => (
              <Checkbox
                {...control}
                defaultChecked={token.conditions.includes(id)}
                onChange={(e) =>
                  onPatch({ conditions: e.target.checked ? [...token.conditions, id] : token.conditions.filter((c) => c !== id) })
                }
              />
            )}
          </Field>
        ))}
      </fieldset>

      {isGm && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("token.hpCurrent")}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={-9999}
                  max={99999}
                  defaultValue={token.hp ?? ""}
                  onBlur={(e) => {
                    const hp = e.target.value === "" ? null : Math.round(Number(e.target.value));
                    if (hp !== token.hp) onPatch({ hp, ...(hp !== null && token.hpMax === null ? { hpMax: Math.max(hp, 1) } : {}) });
                  }}
                />
              )}
            </Field>
            <Field label={t("token.hpMax")}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  max={99999}
                  defaultValue={token.hpMax ?? ""}
                  onBlur={(e) => {
                    const hpMax = e.target.value === "" ? null : Math.max(1, Math.round(Number(e.target.value)));
                    if (hpMax !== token.hpMax)
                      onPatch({ hpMax, ...(hpMax === null ? { hp: null } : token.hp === null ? { hp: hpMax } : {}) });
                  }}
                />
              )}
            </Field>
          </div>
          <Field label={t("token.showName")} inline>
            {(control) => <Switch {...control} defaultChecked={token.showName} onChange={(e) => onPatch({ showName: e.target.checked })} />}
          </Field>

          <Field label={t("token.name")}>
            {(control) => (
              <Input
                {...control}
                defaultValue={token.name}
                maxLength={60}
                onBlur={(e) => e.target.value.trim() && e.target.value !== token.name && onPatch({ name: e.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("token.size")}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0.25}
                  max={20}
                  step={0.25}
                  defaultValue={token.size}
                  onBlur={(e) => onPatch({ size: Number(e.target.value) })}
                />
              )}
            </Field>
            <Field label={t("token.color")}>
              {(control) => (
                <input
                  {...control}
                  type="color"
                  defaultValue={token.color}
                  onBlur={(e) => onPatch({ color: e.target.value })}
                  className="h-[2.6rem] w-full cursor-pointer rounded-xl border-0 bg-transparent p-0.5"
                />
              )}
            </Field>
          </div>

          <AssetPicker
            label={t("token.image")}
            assetId={token.assetId}
            name={token.name}
            color={token.color}
            onPick={onUpload}
            onRemove={() => onPatch({ assetId: null })}
          />

          <Field label={t("token.hidden")} inline>
            {(control) => <Switch {...control} defaultChecked={token.hidden} onChange={(e) => onPatch({ hidden: e.target.checked })} />}
          </Field>

          <Field label={t("token.actor")}>
            {(control) => (
              <Select {...control} defaultValue={token.actorId ?? ""} onChange={(e) => onPatch({ actorId: e.target.value || null })}>
                <option value="">{t("token.noActor")}</option>
                {actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {players.length > 0 && (
            <fieldset className="m-0 grid gap-1.5 border-0 p-0">
              <legend className="mb-1 p-0 font-semibold text-[0.9rem]">{t("token.controllers")}</legend>
              {players.map((member) => (
                <Field key={member.userId} label={member.displayName} inline>
                  {(control) => (
                    <Checkbox
                      {...control}
                      defaultChecked={token.controllerIds.includes(member.userId)}
                      onChange={(e) =>
                        onPatch({
                          controllerIds: e.target.checked
                            ? [...token.controllerIds, member.userId]
                            : token.controllerIds.filter((id) => id !== member.userId),
                        })
                      }
                    />
                  )}
                </Field>
              ))}
            </fieldset>
          )}

          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            {t("common.delete")}
          </Button>
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={t("token.deleteTitle", { name: token.name })}
            description={t("token.deleteBody")}
            confirmLabel={t("common.delete")}
            cancelLabel={t("common.cancel")}
            tone="danger"
            onConfirm={() => {
              setConfirmingDelete(false);
              onDelete();
            }}
          />
        </>
      )}
    </Card>
  );
}
