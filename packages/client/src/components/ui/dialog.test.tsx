import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Button } from "./button";
import { ConfirmDialog, Dialog } from "./dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open settings</Button>
      <Dialog open={open} onOpenChange={setOpen} title="World settings" description="Change how this world works.">
        <Button>Save</Button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens with its title, traps focus, closes on Escape and returns focus", async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open settings" });
    await userEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "World settings" });
    expect(dialog).toHaveAccessibleDescription("Change how this world works.");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes with the close button", async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    render(<Dialog open onOpenChange={() => {}} title="World settings" />);
    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});

describe("ConfirmDialog", () => {
  const baseProps = {
    open: true,
    title: "Delete this scene?",
    description: "Its tokens stay in the world.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  };

  it("starts focus on Cancel and does not confirm by accident", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...baseProps} tone="danger" onConfirm={onConfirm} onOpenChange={onOpenChange} />);
    expect(screen.getByRole("alertdialog", { name: "Delete this scene?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("confirms when asked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
