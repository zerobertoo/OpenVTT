import { Select as RadixSelect } from "radix-ui";
import { Children, forwardRef, isValidElement, type ReactElement, type ReactNode } from "react";
import { Icon } from "../../icons";
import { cn } from "../../lib/cn";
import { controlStyles } from "./input";

// Radix forbids an empty string as an item value, but our forms use "" for "none"; it travels as this marker.
const EMPTY = "__empty__";
const toInternal = (value: string | number | undefined) => (value === undefined ? undefined : value === "" ? EMPTY : String(value));
const fromInternal = (value: string) => (value === EMPTY ? "" : value);

type OptionElement = ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;

/** Plain text of an option's children, used as its label and as its value when none is given. */
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("");
}

export interface SelectProps {
  /** The options, written as `<option value="x">Label</option>`. */
  children: ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  /** Makes the value part of the surrounding form, like a native select. */
  name?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

/**
 * A list of choices that looks and behaves the same in every browser and on every platform. Options are given as
 * `<option>` children, so a call site reads like a native select; wire it to a `Field` by spreading the field props.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { children, value, defaultValue, onValueChange, name, disabled, required, className, ...aria },
  ref,
) {
  const options = Children.toArray(children).filter(isValidElement) as OptionElement[];
  const first = options.find((option) => !option.props.disabled);
  const firstValue = first ? (first.props.value ?? textOf(first.props.children)) : undefined;
  return (
    <RadixSelect.Root
      value={toInternal(value)}
      // Like a native select, an uncontrolled one with no default starts on its first option.
      defaultValue={toInternal(defaultValue ?? (value === undefined ? firstValue : undefined))}
      onValueChange={onValueChange ? (next) => onValueChange(fromInternal(next)) : undefined}
      name={name}
      disabled={disabled}
      required={required}
    >
      <RadixSelect.Trigger
        ref={ref}
        {...aria}
        className={cn(controlStyles, "flex min-h-11 items-center justify-between gap-2 text-left data-[placeholder]:text-ink-2", className)}
      >
        <span className="min-w-0 truncate">
          <RadixSelect.Value />
        </span>
        <span className="shrink-0 text-ink-2">
          <Icon name="chevronDown" />
        </span>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        {/* Above the dialog layer (z-50), so a select opened inside a dialog is never covered. */}
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className="z-[55] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] animate-overlay-in overflow-hidden rounded-card bg-surface text-ink shadow-float motion-reduce:animate-none"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => {
              const label = textOf(option.props.children);
              const optionValue = toInternal(option.props.value ?? label) as string;
              return (
                <RadixSelect.Item
                  key={optionValue}
                  value={optionValue}
                  disabled={option.props.disabled}
                  className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 rounded-sm px-3 py-2 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent-soft data-[state=checked]:font-bold data-[disabled]:opacity-55"
                >
                  <RadixSelect.ItemText>{label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Icon name="check" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              );
            })}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
});
