import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapView } from "./MapView";
import { DEFAULT_LAYERS } from "./tableStore";

const noop = () => undefined;

describe("MapView", () => {
  it("tells the user when the browser cannot draw the map instead of leaving a blank area", async () => {
    // The test environment has no WebGL, so starting the map renderer fails just like on an old or locked-down browser.
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    const view = render(
      <MapView
        scene={null}
        floor={null}
        ghostFloor={null}
        tokens={[]}
        tool="select"
        selectedTokenIds={[]}
        canControl={() => false}
        onSelect={noop}
        onToggle={noop}
        onSelectMany={noop}
        onMove={noop}
        vision={null}
        layers={DEFAULT_LAYERS}
        onToggleDoor={noop}
        onPing={noop}
        onEffectPoint={noop}
        formatDistance={String}
        rulerShape="line"
        diagonalRule="exact"
        draw={{ kind: "free", color: "#ffc914", text: "", layer: "objects" }}
        onDraw={noop}
        onErase={noop}
        canErase={() => false}
        onMoved={noop}
        onDropEntry={noop}
        selectedLight={null}
        onSelectLight={noop}
        onAddLight={noop}
        onMoveLight={noop}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("cannot draw the map");

    // Leaving the table must not throw or reject either.
    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
