import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { FloorSwitcher } from "../table/FloorSwitcher";
import { FloorManager } from "./FloorManager";

const floors = [
  { id: "cellar", name: "Cellar" },
  { id: "ground", name: "Ground" },
  { id: "roof", name: "Roof" },
];

describe("FloorSwitcher", () => {
  it("lists the floors with the highest on top, marks the current and the table floor, and switches on click", async () => {
    const onChange = vi.fn();
    const { container } = render(<FloorSwitcher floors={floors} currentId="ground" tableFloorId="cellar" onChange={onChange} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Roof", "Ground", "Cellar●(table floor)"]);
    expect(screen.getByRole("button", { name: /Ground/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Cellar/ })).toHaveAccessibleName(/table floor/i);
    expect(screen.getByRole("status")).toHaveTextContent("Showing Ground");
    await userEvent.click(screen.getByRole("button", { name: /Roof/ }));
    expect(onChange).toHaveBeenCalledWith("roof");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is switched off while a player is being previewed", () => {
    render(<FloorSwitcher floors={floors} currentId="ground" tableFloorId="cellar" onChange={vi.fn()} disabled />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});

describe("FloorManager", () => {
  const setup = () => {
    const props = {
      floors,
      tableFloorId: "cellar",
      onRename: vi.fn(),
      onMove: vi.fn(),
      onShowToTable: vi.fn(),
      onDelete: vi.fn(),
      onAdd: vi.fn(),
    };
    return { props, ...render(<FloorManager {...props} />) };
  };

  it("renames a floor when its box loses focus, and puts the old name back when it is emptied", async () => {
    const { props } = setup();
    const box = screen.getByRole("textbox", { name: "Name of Ground" });
    await userEvent.clear(box);
    await userEvent.type(box, "Lobby");
    await userEvent.tab();
    expect(props.onRename).toHaveBeenCalledWith("ground", "Lobby");
    const other = screen.getByRole("textbox", { name: "Name of Roof" });
    await userEvent.clear(other);
    await userEvent.tab();
    expect(props.onRename).toHaveBeenCalledTimes(1);
    expect(other).toHaveValue("Roof");
  });

  it("chooses the table floor, moves floors in the stack and asks before deleting", async () => {
    const { props } = setup();
    await userEvent.click(screen.getAllByRole("button", { name: "Show to table" })[0]!);
    expect(props.onShowToTable).toHaveBeenCalledWith("roof");
    await userEvent.click(screen.getByRole("button", { name: "More actions for Ground" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Move up" }));
    expect(props.onMove).toHaveBeenCalledWith("ground", 2);
    await userEvent.click(screen.getByRole("button", { name: "More actions for Ground" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(props.onDelete).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(props.onDelete).toHaveBeenCalledWith("ground");
  });

  it("adds a floor with a name and no background", async () => {
    const { props, container } = setup();
    await userEvent.type(screen.getByRole("textbox", { name: "New floor name" }), "Attic");
    await userEvent.click(screen.getByRole("button", { name: "Add floor" }));
    expect(props.onAdd).toHaveBeenCalledWith("Attic", null);
    expect(await axe(container)).toHaveNoViolations();
  });
});
