import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "../../icons";
import { Button } from "./button";
import { DropdownMenu, Popover } from "./popover";

const meta = {
  title: "Overlays/Popover and menu",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A short hint or mini-form next to its trigger. Esc or a click outside closes it. */
export const HelpPopover: Story = {
  render: () => (
    <Popover trigger={<Button variant="secondary">How does this work?</Button>}>
      <p className="m-0 font-bold">Moving around the map</p>
      <p className="m-0 mt-1 text-ink-2">Drag the background to pan, scroll or pinch to zoom, and drag a token to move it.</p>
    </Popover>
  ),
};

/** Row actions behind one button. Danger items are red and also worded ("Delete"). */
export const ActionsMenu: Story = {
  render: () => (
    <DropdownMenu
      trigger={
        <Button variant="ghost" size="icon" aria-label="Scene actions">
          <Icon name="scenes" />
        </Button>
      }
      items={[
        { id: "show", label: "Show to players", onSelect: () => {} },
        { id: "rename", label: "Rename", onSelect: () => {} },
        { id: "duplicate", label: "Duplicate", onSelect: () => {}, disabled: true },
        { id: "delete", label: "Delete", onSelect: () => {}, tone: "danger" },
      ]}
    />
  ),
};
