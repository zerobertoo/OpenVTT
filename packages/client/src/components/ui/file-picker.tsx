import { type ChangeEvent, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";

interface FilePickerProps {
  accept?: string;
  multiple?: boolean;
  name?: string;
  id?: string;
  onChange?: (files: File[]) => void;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  className?: string;
}

/**
 * A file field that looks the same in every browser. The real `<input type="file">` stays on top, fully transparent,
 * so the label, keyboard focus, form submission and drag-and-drop all keep working; the visible button and file
 * name underneath are decoration that mirrors it.
 */
export const FilePicker = forwardRef<HTMLInputElement, FilePickerProps>(function FilePicker(
  { accept, multiple, name, id, onChange, className, ...aria },
  ref,
) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [files, setFiles] = useState<File[]>([]);

  // A form reset empties the input without a change event; keep the shown name in step.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const clear = () => setFiles([]);
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    setFiles(picked);
    onChange?.(picked);
  };

  const summary =
    files.length === 0 ? t("files.none") : files.length === 1 ? (files[0]?.name ?? "") : t("files.count", { count: files.length });

  return (
    <div className={cn("relative flex min-h-11 items-center gap-3 rounded-sm", className)}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={change}
        {...aria}
        className="peer absolute inset-0 z-[1] size-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className="inline-flex min-h-11 shrink-0 items-center rounded-pill bg-surface-2 px-4 font-semibold shadow-[inset_0_0_0_1.5px_var(--line)] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dice peer-disabled:opacity-55"
      >
        {multiple ? t("files.chooseMany") : t("files.choose")}
      </span>
      <span aria-hidden="true" className="min-w-0 truncate text-ink-2">
        {summary}
      </span>
    </div>
  );
});
