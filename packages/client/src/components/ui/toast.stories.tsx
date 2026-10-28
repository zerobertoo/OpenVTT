import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Toaster, toast } from "./toast";

const meta = {
  title: "Feedback/Toast",
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <>
        <Toaster />
        <Story />
      </>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** `toast()` can be called from anywhere, including mutation callbacks. Errors stay longer and are announced assertively. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => toast({ title: "Invite link copied" })}>
        Info
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ title: "Reconnected", description: "You are back at the table.", tone: "success" })}
      >
        Success
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ title: "Could not save", description: "Check your connection and try again.", tone: "error" })}
      >
        Error
      </Button>
    </div>
  ),
};
