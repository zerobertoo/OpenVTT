import { Slider as RadixSlider } from "radix-ui";
import { cn } from "../../lib/cn";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Called on every move while dragging or pressing keys. */
  onValueChange: (value: number) => void;
  /** Called once when the drag or key press ends; use it to save instead of saving on every move. */
  onValueCommit?: (value: number) => void;
  /** The thumb is the focusable element, so it carries the name; pass the same text as the `Field` label. */
  "aria-label": string;
  "aria-describedby"?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/** A single-value slider that looks the same everywhere and has a 44 px touch area. Arrow keys, Home, End and Page keys work. */
export function Slider({ value, min, max, step = 1, onValueChange, onValueCommit, className, id, disabled, ...aria }: SliderProps) {
  return (
    <RadixSlider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={([next]) => onValueChange(next ?? value)}
      onValueCommit={onValueCommit ? ([next]) => onValueCommit(next ?? value) : undefined}
      className={cn("relative flex h-11 w-full touch-none select-none items-center data-[disabled]:opacity-55", className)}
    >
      <RadixSlider.Track className="relative h-1.5 grow overflow-hidden rounded-pill bg-ink-2/35">
        <RadixSlider.Range className="absolute h-full bg-accent" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        id={id}
        {...aria}
        className="block size-6 rounded-full border-2 border-surface bg-accent shadow-float outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dice"
      />
    </RadixSlider.Root>
  );
}
