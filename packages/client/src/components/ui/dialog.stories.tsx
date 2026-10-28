import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import { ConfirmDialog, Dialog } from "./dialog";
import { Field } from "./field";
import { Input } from "./input";

const meta = {
  title: "Overlays/Dialog",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A centered card on wide screens and a bottom sheet below 52rem (resize the viewport to see it). */
export const FormDialog: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div className="p-6">
        <Button onClick={() => setOpen(true)}>Rename world</Button>
        <Dialog open={open} onOpenChange={setOpen} title="Rename world" description="Everyone in the world sees the new name.">
          <Field label="World name">{(control) => <Input {...control} defaultValue="Mesa de teste" />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Save</Button>
          </div>
        </Dialog>
      </div>
    );
  },
};

/** Focus starts on Cancel so a stray Enter never destroys anything. */
export const Confirm: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div className="p-6">
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete scene
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          tone="danger"
          title="Delete this scene?"
          description="Its tokens stay in the world, but the map image is removed."
          confirmLabel="Delete scene"
          cancelLabel="Cancel"
          onConfirm={() => setOpen(false)}
        />
      </div>
    );
  },
};
