import {
  BookOpen,
  ChevronLeft,
  CircleUserRound,
  Dices,
  Ellipsis,
  FileText,
  Globe,
  Image,
  Layers,
  type LucideIcon,
  MessageSquare,
  MousePointer2,
  PanelRight,
  PanelRightClose,
  Pause,
  Pencil,
  Play,
  Ruler,
  Send,
  Users,
  X,
} from "lucide-react";

const ICONS = {
  back: ChevronLeft,
  layers: Layers,
  chat: MessageSquare,
  tokens: CircleUserRound,
  sheets: FileText,
  journal: BookOpen,
  scenes: Image,
  world: Globe,
  select: MousePointer2,
  ruler: Ruler,
  draw: Pencil,
  dice: Dices,
  play: Play,
  pause: Pause,
  send: Send,
  users: Users,
  close: X,
  more: Ellipsis,
  panelOpen: PanelRight,
  panelClose: PanelRightClose,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Lucide line icons. Decorative: callers provide the accessible text. */
export function Icon({ name }: { name: IconName }) {
  const Glyph = ICONS[name];
  return <Glyph className="icon" strokeWidth={1.75} aria-hidden="true" />;
}

/** A d20 silhouette: solid hexagon with a triangle cut into it, still readable at 16 px. */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2l12 7v14l-12 7L4 23V9z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 8.5l6.5 11.5h-13z" fill="none" stroke="var(--on-accent, white)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
