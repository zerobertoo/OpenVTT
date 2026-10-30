import { DRAWING_KINDS, DRAWING_LAYERS } from "@openvtt/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type DrawSettings, useTableUi } from "../../tableStore";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";
import { Input, Select } from "../ui/input";

interface Props {
  isGm: boolean;
  /** Erases the scene for the game master, or the person's own marks for anyone else. */
  onClear: () => void;
}

/** Shown above the map tools while drawing: what to place, its color and words, and the layer (game master). */
export function DrawOptions({ isGm, onClear }: Props) {
  const { t } = useTranslation();
  const draw = useTableUi((ui) => ui.draw);
  const setDraw = useTableUi((ui) => ui.setDraw);
  const [confirming, setConfirming] = useState(false);
  // Note pins are the game master's own notes.
  const kinds = [...DRAWING_KINDS.filter((k) => isGm || k !== "note"), "erase"] as const;
  const needsText = draw.kind === "text" || draw.kind === "note";
  return (
    <div
      role="group"
      aria-label={t("draw.options")}
      className="ruler-options flex flex-wrap items-center gap-2 rounded-[1.2rem] bg-chrome p-2 shadow-float"
    >
      <Select
        className="w-auto"
        aria-label={t("draw.kind")}
        value={draw.kind}
        onChange={(e) => setDraw({ kind: e.target.value as DrawSettings["kind"] })}
      >
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {t(`draw.kinds.${kind}`)}
          </option>
        ))}
      </Select>
      {draw.kind !== "erase" && (
        <input
          type="color"
          aria-label={t("draw.color")}
          value={draw.color}
          onChange={(e) => setDraw({ color: e.target.value })}
          className="h-9 w-11 cursor-pointer rounded-md border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-dice focus-visible:outline-offset-2"
        />
      )}
      {needsText && (
        <Input
          aria-label={t("draw.text")}
          placeholder={t("draw.textHint")}
          maxLength={500}
          value={draw.text}
          onChange={(e) => setDraw({ text: e.target.value })}
          className="w-52"
        />
      )}
      {isGm && draw.kind !== "erase" && draw.kind !== "note" && (
        <Select
          className="w-auto"
          aria-label={t("draw.layer")}
          value={draw.layer}
          onChange={(e) => setDraw({ layer: e.target.value as DrawSettings["layer"] })}
        >
          {DRAWING_LAYERS.map((layer) => (
            <option key={layer} value={layer}>
              {t(`draw.layers.${layer}`)}
            </option>
          ))}
        </Select>
      )}
      <Button variant="secondary" size="sm" onClick={() => (isGm ? setConfirming(true) : onClear())}>
        {t(isGm ? "draw.clearAll" : "draw.clearMine")}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("draw.clearTitle")}
        description={t("draw.clearBody")}
        confirmLabel={t("draw.clearAll")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={() => {
          setConfirming(false);
          onClear();
        }}
      />
    </div>
  );
}
