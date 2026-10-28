import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Button } from "./button";
import { DropdownMenu, Popover } from "./popover";

describe("Popover", () => {
  it("opens from its trigger, closes on Escape and gives focus back", async () => {
    render(
      <Popover trigger={<Button>How it works</Button>}>
        <p>Drag the background to pan.</p>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "How it works" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveTextContent("Drag the background to pan.");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("DropdownMenu", () => {
  const renderMenu = (onRename = vi.fn(), onDelete = vi.fn()) =>
    render(
      <DropdownMenu
        trigger={<Button variant="ghost" size="icon" aria-label="Scene actions" />}
        items={[
          { id: "rename", label: "Rename", onSelect: onRename },
          { id: "delete", label: "Delete", onSelect: onDelete, tone: "danger" },
          { id: "locked", label: "Duplicate", onSelect: () => {}, disabled: true },
        ]}
      />,
    );

  it("opens with the keyboard, lists menu items and runs the chosen one", async () => {
    const onRename = vi.fn();
    renderMenu(onRename);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Rename", "Delete", "Duplicate"]);

    await userEvent.keyboard("{Enter}");
    expect(onRename).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("does not run disabled items", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Scene actions" }));
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveAttribute("aria-disabled", "true");
  });

  it("has no accessibility violations when open", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Scene actions" }));
    expect(await axe(screen.getByRole("menu"))).toHaveNoViolations();
  });
});
