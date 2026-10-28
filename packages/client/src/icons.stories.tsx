import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon, type IconName, Logo } from "./icons";

const ICON_NAMES: IconName[] = [
  "back",
  "chat",
  "tokens",
  "sheets",
  "scenes",
  "world",
  "select",
  "ruler",
  "send",
  "users",
  "panelOpen",
  "panelClose",
];

const meta = {
  title: "Foundations/Icons",
  component: Icon,
  tags: ["autodocs"],
} satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every icon on its 24px grid. They are decorative (`aria-hidden`): the control that holds one supplies the accessible name. */
export const AllIcons: Story = {
  args: { name: "chat" },
  render: () => (
    <ul className="m-0 grid list-none grid-cols-4 gap-4 p-0">
      {ICON_NAMES.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2 text-sm text-ink-2">
          <span className="text-ink">
            <Icon name={name} />
          </span>
          {name}
        </li>
      ))}
    </ul>
  ),
};

/** The d20 silhouette used as brand mark; it takes the current text color. */
export const BrandLogo: Story = {
  args: { name: "chat" },
  render: () => (
    <span className="text-accent" style={{ fontSize: "3rem" }}>
      <Logo />
    </span>
  ),
};
