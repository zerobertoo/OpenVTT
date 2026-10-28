import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar, AvatarStack } from "./avatar";
import { Badge } from "./badge";
import { Card } from "./card";

const meta = {
  title: "Primitives/Display",
  tags: ["autodocs"],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A page-level card with an inset row inside it, as on the world list. */
export const Cards: Story = {
  render: () => (
    <Card as="section" aria-labelledby="worlds-title" className="w-96">
      <h2 id="worlds-title" className="m-0 mb-3 font-bold text-xl">
        Your worlds
      </h2>
      <Card variant="inset" className="flex items-center gap-3">
        <Avatar name="Mesa de teste" size="lg" />
        <span className="grid">
          <strong>Mesa de teste</strong>
          <Badge tone="accent">Game master</Badge>
        </span>
      </Card>
    </Card>
  ),
};

/** Badges always carry text; amber is only for dice, red for problems. */
export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Hidden</Badge>
      <Badge tone="accent">Game master</Badge>
      <Badge tone="dice">Natural 20</Badge>
      <Badge tone="danger">Offline</Badge>
    </div>
  ),
};

/** The initial picks a dark or light text color from the background, so any member color stays readable. */
export const Avatars: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="Ana" color="#e8d44d" />
      <Avatar name="Bruno" color="#3d6fd8" />
      <Avatar name="Carla" color="#d94f30" online size="lg" />
      <Avatar name="Dani" size="sm" />
    </div>
  ),
};

export const Stack: Story = {
  render: () => (
    <AvatarStack
      label="7 online"
      max={5}
      people={["Ana", "Bruno", "Carla", "Dani", "Edu", "Fábio", "Gina"].map((name, i) => ({
        id: String(i),
        name,
        color: ["#e8d44d", "#3d6fd8", "#d94f30", "#2f9e6e", "#9b59b6", "#e67e22", "#16a085"][i],
      }))}
    />
  ),
};
