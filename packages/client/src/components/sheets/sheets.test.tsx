import type { SheetTemplate } from "@openvtt/sdk";
import type { ActorDto, SystemInfoDto } from "@openvtt/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ActorList } from "./ActorList";
import { SaveStatus, SheetView } from "./SheetView";

const template: SheetTemplate = {
  sections: [
    {
      id: "basics",
      label: "Basics",
      fields: [
        { id: "name", type: "text", label: "Name" },
        { id: "level", type: "number", label: "Level" },
        { id: "double", type: "computed", label: "Double level", formula: "@level * 2" },
        { id: "inspired", type: "checkbox", label: "Inspired" },
        {
          id: "items",
          type: "list",
          label: "Items",
          itemFields: [{ id: "item", type: "text", label: "Item" }],
        },
      ],
    },
  ],
};
const system = { manifest: {}, templates: { character: template }, strings: {}, overridden: [] } as unknown as SystemInfoDto;
const actor: ActorDto = {
  id: "a1",
  type: "character",
  name: "Ada",
  ownerId: null,
  data: { name: "Ada", level: 3, inspired: false, items: [{ item: "Rope" }] },
};

describe("SheetView", () => {
  it("renders the template with computed values and saves a field when it is left", async () => {
    const onSave = vi.fn();
    render(<SheetView actor={actor} template={template} system={system} locale="en" onSave={onSave} />);

    expect(screen.getByRole("heading", { name: "Basics" })).toBeInTheDocument();
    expect(screen.getByText("Double level").nextElementSibling).toHaveTextContent("6");

    const level = screen.getByLabelText("Level");
    await userEvent.clear(level);
    await userEvent.type(level, "5");
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith("level", 5);
  });

  it("saves immediately for a checkbox and edits list rows as a whole", async () => {
    const onSave = vi.fn();
    render(<SheetView actor={actor} template={template} system={system} locale="en" onSave={onSave} />);

    await userEvent.click(screen.getByLabelText("Inspired"));
    expect(onSave).toHaveBeenCalledWith("inspired", true);

    await userEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(onSave).toHaveBeenCalledWith("items", [{ item: "Rope" }, {}]);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onSave).toHaveBeenCalledWith("items", []);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<SheetView actor={actor} template={template} system={system} locale="en" onSave={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("SaveStatus", () => {
  it("announces saving and saved through a status region and stays quiet when idle", () => {
    const { rerender } = render(<SaveStatus state="idle" />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    rerender(<SaveStatus state="saving" />);
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
    rerender(<SaveStatus state="saved" />);
    expect(screen.getByRole("status")).toHaveTextContent("All changes saved");
  });
});

describe("ActorList", () => {
  it("marks the open sheet and reports selection", async () => {
    const onSelect = vi.fn();
    const npc: ActorDto = { ...actor, id: "a2", name: "Goblin", type: "npc" };
    render(<ActorList actors={[actor, npc]} selectedId="a1" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: /Ada/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Goblin/ })).toHaveTextContent("NPC");
    await userEvent.click(screen.getByRole("button", { name: /Goblin/ }));
    expect(onSelect).toHaveBeenCalledWith("a2");
  });
});
