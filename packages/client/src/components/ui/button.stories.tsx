import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "../../icons";
import { Button } from "./button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Create world" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger", "link", "dangerLink"] },
    size: { control: "select", options: ["md", "sm", "icon"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const AllVariants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {(["primary", "secondary", "ghost", "danger", "link", "dangerLink"] as const).map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="icon" aria-label="Send">
        <Icon name="send" />
      </Button>
    </div>
  ),
};

/** A secondary button with `aria-pressed` fills with the accent, which is how toggles read. */
export const Toggle: Story = {
  args: { variant: "secondary", "aria-pressed": true, children: "Hidden" },
};

/** Pending keeps the width, shows a spinner, and tells assistive tech the button is busy. */
export const Pending: Story = { args: { pending: true } };

export const Disabled: Story = { args: { disabled: true } };

export const WithIcon: Story = {
  args: {
    variant: "secondary",
    children: (
      <>
        <Icon name="send" />
        Send
      </>
    ),
  },
};
