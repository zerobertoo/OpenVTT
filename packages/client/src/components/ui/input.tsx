import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const controlStyles = [
  "w-full min-w-0 rounded-sm border-[1.5px] border-line bg-surface px-[0.85rem] py-[0.6rem] text-ink caret-accent",
  "placeholder:text-ink-2 read-only:bg-surface-2 disabled:opacity-55 aria-invalid:border-danger",
].join(" ");

/** Single-line text entry. Put it inside a `Field` so it has a label. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(controlStyles, className)} {...rest} />;
});

/** Multi-line text entry; grows vertically only. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(controlStyles, "resize-y", className)} {...rest} />;
});

/** The platform `select` (menus, keyboard and mobile pickers come for free), styled to match. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cn(controlStyles, className)} {...rest} />;
});
