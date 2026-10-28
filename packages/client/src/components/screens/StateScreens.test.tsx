import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { NotFoundScreen, RouteErrorScreen, WorldUnavailableScreen } from "./StateScreens";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("../../Root", () => ({ Shell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

describe("state screens", () => {
  it("tells the person nothing is at the address and offers the way back", async () => {
    const { container } = render(<NotFoundScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "There is nothing at this address" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to worlds" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("reassures after a crash and retries when asked", async () => {
    const reset = vi.fn();
    render(<RouteErrorScreen reset={reset} />);
    expect(screen.getByText(/Your games are safe/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("explains an unavailable world and returns to the list", async () => {
    const { container } = render(<WorldUnavailableScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "This world is not available to you" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to worlds" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
