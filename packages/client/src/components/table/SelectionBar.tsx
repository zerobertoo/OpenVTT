import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";

interface Props {
  count: number;
  /** Turning needs at least one selected token the person controls. */
  canRotate: boolean;
  /** Only the game master deletes tokens. */
  canDelete: boolean;
  onRotate: (degrees: number) => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Shown at the top of the map while several tokens are selected: the actions that apply to all of them. */
export function SelectionBar({ count, canRotate, canDelete, onRotate, onDelete, onClear }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="toolbar"
      aria-label={t("selection.label")}
      className="absolute top-3 left-1/2 z-1 flex -translate-x-1/2 items-center gap-2 rounded-[1.2rem] bg-chrome px-3 py-2 text-on-chrome text-sm shadow-float"
    >
      <span>{t("selection.count", { count })}</span>
      <Button variant="secondary" size="sm" disabled={!canRotate} onClick={() => onRotate(-45)}>
        {t("selection.rotateLeft")}
      </Button>
      <Button variant="secondary" size="sm" disabled={!canRotate} onClick={() => onRotate(45)}>
        {t("selection.rotateRight")}
      </Button>
      {canDelete && (
        <Button variant="danger" size="sm" onClick={onDelete}>
          {t("common.delete")}
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={onClear}>
        {t("selection.clear")}
      </Button>
    </div>
  );
}
