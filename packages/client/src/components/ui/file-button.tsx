import { useRef } from "react";
import { Button, type ButtonProps } from "./button";

interface Props extends Omit<ButtonProps, "onClick" | "children"> {
  label: string;
  accept: string;
  onPick: (file: File) => void;
}

/** A button that opens the file picker. The native input stays hidden and out of the tab order; the button carries the label. */
export function FileButton({ label, accept, onPick, variant = "secondary", ...buttonProps }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} {...buttonProps} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
    </>
  );
}
