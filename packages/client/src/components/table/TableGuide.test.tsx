import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "../../i18n";
import { useTableUi } from "../../tableStore";
import { EmptyMap } from "./TableGuide";

describe("EmptyMap", () => {
  beforeEach(() => useTableUi.getState().reset());

  it("shows the game master three steps and opens the matching tab", async () => {
    render(<EmptyMap isGm />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Open Scenes" }));
    expect(useTableUi.getState().tab).toBe("scenes");
    expect(useTableUi.getState().drawerOpen).toBe(true);
  });

  it("shows players a waiting message with chat, move and sheet steps", () => {
    render(<EmptyMap isGm={false} />);
    expect(screen.getByRole("heading", { name: "Waiting for the game master" })).toBeInTheDocument();
    expect(screen.getByText("Move your token")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<EmptyMap isGm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
