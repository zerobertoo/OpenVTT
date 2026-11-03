import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ColorPicker } from "./color-picker";
import { Disclosure } from "./disclosure";
import { Field } from "./field";
import { FilePicker } from "./file-picker";
import { Select } from "./select";
import { Slider } from "./slider";

const meta = {
  title: "Primitives/Inputs",
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Same look in every browser; options are written as `<option>` children. */
export const SelectList: Story = {
  render: () => (
    <Field label="Shape">
      {(control) => (
        <Select {...control} defaultValue="line">
          <option value="line">Line</option>
          <option value="cone">Cone</option>
          <option value="circle">Circle</option>
        </Select>
      )}
    </Field>
  ),
};

/** The thumb carries the accessible name; keys, Home/End and Page keys work. */
export const VolumeSlider: Story = {
  render: () => {
    const [value, setValue] = useState(0.4);
    return (
      <Field label="Volume">
        {(control) => <Slider {...control} aria-label="Volume" min={0} max={1} step={0.05} value={value} onValueChange={setValue} />}
      </Field>
    );
  },
};

/** Swatches for most people, a hex field for the rest. */
export const Color: Story = {
  render: () => {
    const [value, setValue] = useState("#3e63dd");
    return <Field label="Color">{(control) => <ColorPicker {...control} value={value} onChange={setValue} />}</Field>;
  },
};

export const Files: Story = {
  render: () => <Field label="Map files">{(control) => <FilePicker {...control} multiple accept="image/*" />}</Field>,
};

export const Collapsible: Story = {
  render: () => (
    <Disclosure title="How to export">
      <p className="m-0 text-ink-2">Closed content is not in the page.</p>
    </Disclosure>
  ),
};
