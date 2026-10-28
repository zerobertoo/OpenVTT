import type { SceneDto } from "@openvtt/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { assetUrl } from "../../api";
import { Icon } from "../../icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ConfirmDialog } from "../ui/dialog";
import { DropdownMenu } from "../ui/popover";

interface Props {
  scene: SceneDto;
  /** The scene the game master is looking at right now. */
  viewing: boolean;
  /** The scene the players see. */
  shown: boolean;
  onView: () => void;
  onShowToPlayers: () => void;
  onDelete: () => void;
}

/** A scene in the list: pick it to look at it, and use the menu to show it to players or delete it. */
export function SceneCard({ scene, viewing, shown, onView, onShowToPlayers, onDelete }: Props) {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <Card as="li" variant="inset" className={`flex items-center gap-1 p-1.5 ${viewing ? "shadow-[inset_0_0_0_1.5px_var(--accent)]" : ""}`}>
      <button
        type="button"
        aria-pressed={viewing}
        onClick={onView}
        className="flex min-w-0 flex-1 cursor-pointer items-center justify-start gap-2.5 rounded-xl bg-transparent p-1 text-left text-ink pointer-coarse:min-h-11"
      >
        {scene.assetId ? (
          <img src={assetUrl(scene.assetId)} alt="" className="size-11 flex-none rounded-lg object-cover" />
        ) : (
          <span className="grid size-11 flex-none place-items-center rounded-lg bg-surface text-ink-2" aria-hidden="true">
            <Icon name="scenes" />
          </span>
        )}
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-semibold">{scene.name}</span>
          {shown && <Badge tone="accent">{t("scene.active")}</Badge>}
        </span>
      </button>

      <DropdownMenu
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("scene.moreActions", { name: scene.name })}>
            <Icon name="more" />
          </Button>
        }
        items={[
          { id: "show", label: t("scene.activate"), onSelect: onShowToPlayers, disabled: shown },
          { id: "delete", label: t("common.delete"), tone: "danger", onSelect: () => setConfirmingDelete(true) },
        ]}
      />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t("scene.deleteTitle", { name: scene.name })}
        description={t("scene.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
        }}
      />
    </Card>
  );
}
