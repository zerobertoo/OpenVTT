import type { SceneDto } from "@openvtt/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { SceneCard } from "./SceneCard";
import { SceneCreateForm, SceneSettingsForm } from "./SceneForms";

const scene: SceneDto = {
  id: "s1",
  name: "Tavern",
  assetId: null,
  assetKind: null,
  width: 2000,
  height: 1500,
  gridType: "square",
  gridSize: 70,
  gridDistance: 5,
  distanceUnit: "ft",
  walls: [],
  lights: [],
  bakedLighting: false,
  floorGroup: null,
  floor: 0,
  visionEnabled: false,
  visionRadius: 12,
  drawings: [],
  lockedLayers: [],
};

const setup = (overrides: Partial<Parameters<typeof SceneCard>[0]> = {}) => {
  const handlers = { onView: vi.fn(), onShowToPlayers: vi.fn(), onDelete: vi.fn() };
  const view = render(
    <ul>
      <SceneCard scene={scene} viewing={false} shown={false} {...handlers} {...overrides} />
    </ul>,
  );
  return { ...handlers, ...view };
};

describe("SceneCard", () => {
  it("shows which scene players see and which one is being viewed", () => {
    setup({ viewing: true, shown: true });
    expect(screen.getByRole("button", { name: /^Tavern/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("shown to players")).toBeInTheDocument();
  });

  it("shows the scene to players from the menu", async () => {
    const { onShowToPlayers } = setup();
    await userEvent.click(screen.getByRole("button", { name: "More actions for Tavern" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show to players" }));
    expect(onShowToPlayers).toHaveBeenCalledOnce();
  });

  it("asks before deleting a scene", async () => {
    const { onDelete } = setup();
    await userEvent.click(screen.getByRole("button", { name: "More actions for Tavern" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();

    expect(await screen.findByRole("alertdialog", { name: "Delete Tavern?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup({ shown: true });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("scene forms", () => {
  it("fills the settings form from the scene and submits it", async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<SceneSettingsForm scene={scene} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Tavern");
    expect(screen.getByLabelText("Cell size (px)")).toHaveValue(70);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("asks for a size only when there is no image", () => {
    const { rerender } = render(<SceneCreateForm onSubmit={vi.fn()} imageFile={null} onImageChange={vi.fn()} />);
    expect(screen.getByLabelText(/Width/)).toBeInTheDocument();

    rerender(<SceneCreateForm onSubmit={vi.fn()} imageFile={new File(["x"], "map.png")} onImageChange={vi.fn()} />);
    expect(screen.queryByLabelText(/Width/)).toBeNull();
    expect(screen.getByText("The scene takes the size of the image.")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <>
        <SceneSettingsForm scene={scene} onSubmit={vi.fn()} />
        <SceneCreateForm onSubmit={vi.fn()} imageFile={null} onImageChange={vi.fn()} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
