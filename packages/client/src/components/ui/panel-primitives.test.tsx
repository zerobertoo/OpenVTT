import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { cn } from "../../lib/cn";
import { DockButton, DockGroup } from "./dock";
import { ListItemButton } from "./list-item-button";
import { PanelSection } from "./panel-section";

describe("PanelSection", () => {
  it("names the region after its heading and shows the action and the error beside it", async () => {
    render(
      <PanelSection title="Tokens" action={<button type="button">New token</button>} error={<p role="alert">Could not save</p>}>
        <p>Content</p>
      </PanelSection>,
    );
    expect(screen.getByRole("region", { name: "Tokens" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Tokens" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New token" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <PanelSection title="Scenes">
        <p>Content</p>
      </PanelSection>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ListItemButton", () => {
  it("is a toggle button that reports the picked row", async () => {
    const onClick = vi.fn();
    render(
      <ListItemButton aria-pressed onClick={onClick}>
        Goblin
      </ListItemButton>,
    );
    const row = screen.getByRole("button", { name: "Goblin", pressed: true });
    await userEvent.click(row);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("DockButton", () => {
  it("never submits a form and keeps its pressed state", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DockGroup role="group" aria-label="Dice and layers">
          <DockButton aria-pressed>Dice</DockButton>
        </DockGroup>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dice", pressed: true }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Dice and layers" })).toBeInTheDocument();
  });
});

describe("cn", () => {
  it("keeps both the type scale size and the text color", () => {
    expect(cn("text-caption", "text-on-chrome-2")).toBe("text-caption text-on-chrome-2");
  });
});
