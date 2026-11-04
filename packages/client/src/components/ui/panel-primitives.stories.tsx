import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "../../icons";
import { Button } from "./button";
import { DockButton, DockGroup } from "./dock";
import { ListItemButton } from "./list-item-button";
import { PanelSection } from "./panel-section";

const meta = {
  title: "Primitives/Panel and dock",
  tags: ["autodocs"],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A drawer panel: heading, one main action beside it, an inline error and the content. */
export const Section: Story = {
  render: () => (
    <div className="max-w-sm">
      <PanelSection
        title="Tokens"
        action={
          <Button size="sm">
            <Icon name="plus" />
            New token
          </Button>
        }
        error={<p className="error m-0">Could not save the token.</p>}
      >
        <ul className="m-0 grid list-none gap-1 p-0">
          <li>
            <ListItemButton aria-pressed>Goblin</ListItemButton>
          </li>
          <li>
            <ListItemButton aria-pressed={false}>Orc</ListItemButton>
          </li>
        </ul>
      </PanelSection>
    </div>
  ),
};

/** Two groups on the dark chrome: amber marks the pressed dice button, teal marks a state of the view. */
export const Dock: Story = {
  render: () => (
    <div className="flex gap-2 bg-map p-6">
      <DockGroup role="group" aria-label="Dice and layers">
        <DockButton aria-pressed>
          <Icon name="dice" />
          Dice
        </DockButton>
        <DockButton tone="accent" aria-pressed>
          <Icon name="layers" />
          Layers
        </DockButton>
      </DockGroup>
    </div>
  ),
};
