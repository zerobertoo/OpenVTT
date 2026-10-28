import type { SceneDto, TokenDto } from "@openvtt/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useTableUi } from "../../tableStore";
import { TableKeyboard } from "./TableKeyboard";

const scene: SceneDto = {
  id: "s1",
  name: "Tavern",
  assetId: null,
  assetKind: null,
  width: 700,
  height: 700,
  gridType: "square",
  gridSize: 70,
  gridDistance: 5,
  distanceUnit: "ft",
  walls: [],
  lights: [],
  bakedLighting: false,
  floorGroup: null,
  floor: 0,
};
const token: TokenDto = {
  id: "t1",
  sceneId: "s1",
  name: "Goblin",
  x: 70,
  y: 70,
  size: 1,
  rotation: 0,
  color: "#aa3333",
  assetId: null,
  hidden: false,
  actorId: null,
  controllerIds: [],
};

function Harness({ movableToken, onMove }: { movableToken: TokenDto | null; onMove: () => void }) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <input aria-label="Chat box" />
      <TableKeyboard scene={scene} movableToken={movableToken} onMove={onMove} helpOpen={helpOpen} onHelpOpenChange={setHelpOpen} />
    </>
  );
}

beforeEach(() => useTableUi.getState().reset());

describe("TableKeyboard", () => {
  it("moves the selected token one cell, announces where it landed and stops at the map edge", async () => {
    const onMove = vi.fn();
    render(<Harness movableToken={token} onMove={onMove} />);

    await userEvent.keyboard("{ArrowRight}");
    expect(onMove).toHaveBeenCalledWith("t1", 140, 70);
    expect(screen.getByRole("status")).toHaveTextContent("Goblin moved to column 3, row 2");

    onMove.mockClear();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    // The second step would leave the map, so only the first one moves.
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenLastCalledWith("t1", 70, 0);
  });

  it("does nothing for a token the person cannot control", async () => {
    const onMove = vi.fn();
    render(<Harness movableToken={null} onMove={onMove} />);
    await userEvent.keyboard("{ArrowRight}");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("switches tools and panels, but not while typing", async () => {
    render(<Harness movableToken={null} onMove={vi.fn()} />);
    await userEvent.keyboard("r");
    expect(useTableUi.getState().tool).toBe("ruler");
    await userEvent.keyboard("p");
    expect(useTableUi.getState().drawerOpen).toBe(false);

    await userEvent.click(screen.getByLabelText("Chat box"));
    await userEvent.keyboard("v");
    expect(useTableUi.getState().tool).toBe("ruler");
  });

  it("opens the shortcut list with ? and has no accessibility violations", async () => {
    render(<Harness movableToken={null} onMove={vi.fn()} />);
    await userEvent.keyboard("?");
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
