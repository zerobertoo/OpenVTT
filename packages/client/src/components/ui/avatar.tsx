import { cva, type VariantProps } from "class-variance-authority";
import { Avatar as RadixAvatar } from "radix-ui";
import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

const avatarStyles = cva("relative inline-grid flex-none place-items-center rounded-full font-extrabold", {
  variants: { size: { sm: "size-7 text-[0.7rem]", md: "size-[1.9rem] text-[0.8rem]", lg: "size-11 text-base" } },
  defaultVariants: { size: "md" },
});

export interface AvatarProps extends VariantProps<typeof avatarStyles> {
  /** Person or token name; the first letter is the fallback when there is no picture. */
  name: string;
  /** Picture URL. Falls back to the initial while loading or if it fails. */
  src?: string;
  /** Background for the fallback (any CSS color); the initial picks a readable text color. */
  color?: string;
  /** Adds a presence dot. It is decorative: write the state out next to the avatar. */
  online?: boolean;
  className?: string;
}

/** Decorative by default (`aria-hidden`): the name next to it is what assistive technology reads. */
export function Avatar({ name, src, color, online, size, className }: AvatarProps) {
  const style = {
    "--who": color ?? "var(--accent)",
    background: "var(--who)",
    // Dark text on light colors and the reverse, from the lightness of the background.
    color: "oklch(from var(--who) clamp(0.2, (0.62 - l) * 100, 0.97) 0 0)",
  } as CSSProperties;
  return (
    <RadixAvatar.Root className={cn(avatarStyles({ size }), className)} style={style} aria-hidden="true">
      {src && <RadixAvatar.Image src={src} alt="" className="size-full rounded-full object-cover" />}
      <RadixAvatar.Fallback>{Array.from(name)[0]?.toUpperCase()}</RadixAvatar.Fallback>
      {online && <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-crit shadow-[0_0_0_2px_var(--surface)]" />}
    </RadixAvatar.Root>
  );
}

export interface AvatarStackProps {
  people: { id: string; name: string; color?: string; src?: string }[];
  /** How many avatars to show before collapsing the rest into "+N". */
  max?: number;
  /** Accessible name of the group, for example "3 online". */
  label: string;
  size?: AvatarProps["size"];
  className?: string;
}

/** Overlapping avatars with a "+N" for the rest. The label gives the count in words. */
export function AvatarStack({ people, max = 5, label, size, className }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  return (
    <div role="group" aria-label={label} className={cn("flex items-center", className)}>
      {shown.map((person) => (
        <Avatar
          key={person.id}
          name={person.name}
          color={person.color}
          src={person.src}
          size={size}
          className="-ml-2 shadow-[0_0_0_2px_var(--surface)] first:ml-0"
        />
      ))}
      {hidden > 0 && <span className="ml-1 font-bold text-ink-2 text-xs">+{hidden}</span>}
    </div>
  );
}
