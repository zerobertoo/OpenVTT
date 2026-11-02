import type { FloorDto } from "@openvtt/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { DropdownMenu } from "../ui/popover";

interface Props {
  /** Bottom to top. */
  floors: Pick<FloorDto, "id" | "name">[];
  tableFloorId: string;
  onRename: (floorId: string, name: string) => void;
  /** Moves the floor to this place in the stack (0 = bottom). */
  onMove: (floorId: string, position: number) => void;
  onShowToTable: (floorId: string) => void;
  onDelete: (floorId: string) => void;
  onAdd: (name: string, background: File | null) => void;
  pending?: boolean;
}

/** The floors of the scene being looked at: rename, reorder, choose the table floor, delete, and add one with a background. */
export function FloorManager({ floors, tableFloorId, onRename, onMove, onShowToTable, onDelete, onAdd, pending }: Props) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState<Pick<FloorDto, "id" | "name"> | null>(null);
  const [background, setBackground] = useState<File | null>(null);

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    onAdd(String(new FormData(form).get("name")), background);
    form.reset();
    setBackground(null);
  };

  return (
    <section aria-label={t("floors.title")} className="grid gap-2">
      <h4 className="m-0">{t("floors.title")}</h4>
      <p className="m-0 text-ink-2 text-sm">{t("floors.hint")}</p>
      <ol className="m-0 grid list-none gap-1.5 p-0">
        {[...floors].reverse().map((floor) => {
          const position = floors.findIndex((f) => f.id === floor.id);
          return (
            <li key={floor.id} className="flex items-center gap-1.5">
              {/* Saves when the box loses focus; the key restarts it when the server sends another name. */}
              <Input
                key={floor.name}
                aria-label={t("floors.nameOf", { name: floor.name })}
                defaultValue={floor.name}
                maxLength={60}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== floor.name) onRename(floor.id, name);
                  else e.target.value = floor.name;
                }}
              />
              {floor.id === tableFloorId ? (
                <Badge tone="accent">{t("floors.tableFloor")}</Badge>
              ) : (
                <Button type="button" variant="secondary" size="sm" onClick={() => onShowToTable(floor.id)}>
                  {t("floors.showToTable")}
                </Button>
              )}
              <DropdownMenu
                trigger={
                  <Button type="button" variant="ghost" size="icon" aria-label={t("floors.actions", { name: floor.name })}>
                    <Icon name="more" />
                  </Button>
                }
                items={[
                  {
                    id: "up",
                    label: t("floors.moveUp"),
                    onSelect: () => onMove(floor.id, position + 1),
                    disabled: position === floors.length - 1,
                  },
                  { id: "down", label: t("floors.moveDown"), onSelect: () => onMove(floor.id, position - 1), disabled: position === 0 },
                  {
                    id: "delete",
                    label: t("common.delete"),
                    tone: "danger",
                    onSelect: () => setDeleting(floor),
                    disabled: floors.length === 1,
                  },
                ]}
              />
            </li>
          );
        })}
      </ol>

      <form onSubmit={add} aria-label={t("floors.add")} className="grid gap-2">
        <Field label={t("floors.newName")}>{(control) => <Input {...control} name="name" required maxLength={60} />}</Field>
        <Field label={t("floors.background")} hint={t("floors.backgroundHint")}>
          {(control) => (
            <Input
              {...control}
              type="file"
              accept="image/png,image/jpeg,image/webp,video/webm,video/mp4"
              onChange={(e) => setBackground(e.target.files?.[0] ?? null)}
            />
          )}
        </Field>
        <Button type="submit" variant="secondary" pending={pending} className="justify-self-start">
          {t("floors.add")}
        </Button>
      </form>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("floors.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("floors.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={() => {
          if (deleting) onDelete(deleting.id);
          setDeleting(null);
        }}
      />
    </section>
  );
}
