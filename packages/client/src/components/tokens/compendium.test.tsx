import type { ActorDto, SystemInfoDto } from "@openvtt/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { Compendium } from "./Compendium";

vi.mock("../../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api")>()),
  api: { compendium: vi.fn(), worldSystem: vi.fn(), updateActor: vi.fn() },
}));

const characterTemplate = {
  sections: [
    {
      id: "gear",
      fields: [
        {
          id: "inventory",
          type: "list",
          accepts: "item",
          nameField: "item",
          itemFields: [
            { id: "item", type: "text" },
            { id: "quantity", type: "number", default: 1 },
            { id: "weight", type: "number" },
          ],
        },
      ],
    },
  ],
};
const system = { manifest: {}, templates: { character: characterTemplate, npc: { sections: [] } }, strings: {}, overridden: [] };
const ada: ActorDto = {
  id: "a1",
  type: "character",
  name: "Ada",
  ownerId: null,
  data: { inventory: [{ item: "Torch", quantity: 1, weight: 1 }] },
};
const goblinSheet: ActorDto = { id: "a2", type: "npc", name: "Goblin", ownerId: null, data: {} };

function renderCompendium(actors: ActorDto[], edited = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Compendium worldId="w1" onPlace={vi.fn()} actors={actors} actions={{ edited }} />
    </QueryClientProvider>,
  );
  return edited;
}

describe("Compendium: adding an item to a sheet", () => {
  beforeEach(() => {
    vi.mocked(api.compendium).mockResolvedValue([
      { id: "torch", name: "Torch", kind: "item", size: 0.5, color: "#e67e22", data: { weight: 1 } },
      { id: "goblin", name: "Goblin", kind: "monster", size: 1, color: "#4f7a3a", data: {} },
    ]);
    vi.mocked(api.worldSystem).mockResolvedValue(system as unknown as SystemInfoDto);
    vi.mocked(api.updateActor).mockReset().mockResolvedValue(ada);
  });

  it("stacks the item into the list, saves it and records one undo step", async () => {
    const edited = renderCompendium([ada, goblinSheet]);

    await userEvent.click(await screen.findByRole("button", { name: /Add to sheet.*Torch · Ada/ }));
    const before = [{ item: "Torch", quantity: 1, weight: 1 }];
    const after = [{ item: "Torch", quantity: 2, weight: 1 }];
    expect(api.updateActor).toHaveBeenCalledWith("a1", { data: { inventory: after } });
    await vi.waitFor(() =>
      expect(edited).toHaveBeenCalledWith("a1", api.updateActor, { data: { inventory: before } }, { data: { inventory: after } }),
    );
  });

  it("offers the button for items only, and only when a sheet accepts items", async () => {
    renderCompendium([ada]);
    expect(await screen.findAllByRole("button", { name: /Add to sheet/ })).toHaveLength(1);
  });

  it("hides the button when no sheet has a list that accepts items", async () => {
    renderCompendium([goblinSheet]);
    await screen.findByRole("button", { name: /Place on map.*Torch/ });
    expect(screen.queryByRole("button", { name: /Add to sheet/ })).not.toBeInTheDocument();
  });

  it("does not record an undo step when the server refuses", async () => {
    vi.mocked(api.updateActor).mockRejectedValue(new Error("forbidden"));
    const edited = renderCompendium([ada]);
    await userEvent.click(await screen.findByRole("button", { name: /Add to sheet.*Torch · Ada/ }));
    await vi.waitFor(() => expect(api.updateActor).toHaveBeenCalled());
    expect(edited).not.toHaveBeenCalled();
  });
});
