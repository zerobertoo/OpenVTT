import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { assetUrl } from "../../api";
import { Avatar } from "./avatar";
import { Button } from "./button";

interface Props {
  label: string;
  /** Uploaded asset shown as preview; null shows the fallback. */
  assetId: string | null;
  /** Name and color of the thing the image belongs to, for the fallback preview. */
  name: string;
  color?: string;
  onPick: (file: File) => void;
  onRemove?: () => void;
  pending?: boolean;
}

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";

/** Preview plus buttons to choose, change or remove an uploaded image. The file input stays out of the tab order. */
export function AssetPicker({ label, assetId, name, color, onPick, onRemove, pending }: Props) {
  const { t } = useTranslation();
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div role="group" aria-labelledby={labelId} className="grid gap-1.5">
      <span id={labelId} className="font-semibold text-[0.9rem]">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <Avatar size="lg" name={name} color={color} src={assetId ? assetUrl(assetId) : undefined} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" pending={pending} onClick={() => inputRef.current?.click()}>
            {t(assetId ? "asset.change" : "asset.choose")}
          </Button>
          {assetId && onRemove && (
            <Button variant="link" size="sm" disabled={pending} onClick={onRemove}>
              {t("asset.remove")}
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          hidden
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clearing the value lets the same file be picked again later.
            event.target.value = "";
            if (file) onPick(file);
          }}
        />
      </div>
      <p className="m-0 text-ink-2 text-sm">{t("asset.formats")}</p>
    </div>
  );
}
