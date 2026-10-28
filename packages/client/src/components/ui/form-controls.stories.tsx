import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox, Switch } from "./checkbox";
import { Field } from "./field";
import { Input, Select, Textarea } from "./input";

const meta = {
  title: "Primitives/Form controls",
  component: Field,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

/** `Field` generates the id and wires label, hint and error to the control through the props it passes. */
export const TextInput: Story = {
  args: { label: "World name", hint: "Players see this on their world list.", children: (control) => <Input {...control} /> },
};

export const WithError: Story = {
  args: {
    label: "Password",
    error: "Use at least 8 characters.",
    children: (control) => <Input type="password" {...control} defaultValue="abc" />,
  },
};

export const Disabled: Story = {
  args: { label: "Rules system", children: (control) => <Input {...control} disabled defaultValue="D&D 5e" /> },
};

export const Multiline: Story = {
  args: { label: "Notes", children: (control) => <Textarea rows={4} {...control} /> },
};

export const Dropdown: Story = {
  args: {
    label: "Rules system",
    children: (control) => (
      <Select {...control} defaultValue="generic">
        <option value="dnd5e-srd">D&D 5e (SRD 5.1)</option>
        <option value="generic">Generic</option>
      </Select>
    ),
  },
};

export const CheckboxField: Story = {
  args: { label: "Game master only", inline: true, children: (control) => <Checkbox {...control} /> },
};

/** A switch applies immediately; a checkbox is saved with its form. */
export const SwitchField: Story = {
  args: { label: "Show to players", inline: true, children: (control) => <Switch {...control} defaultChecked /> },
};
