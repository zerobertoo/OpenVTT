import type { UserDto, WorldSummaryDto } from "@openvtt/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { UserContext } from "../../App";
import { api } from "../../api";
import { Toaster } from "../ui/toast";
import { WorldListScreen } from "./WorldListScreen";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const user = { id: "u1", username: "ada", role: "user", locale: "en" } as UserDto;
const world: WorldSummaryDto = { id: "w1", name: "Greyhawk", systemId: "generic", role: "gm" } as WorldSummaryDto;

const setup = (worlds: WorldSummaryDto[], role: UserDto["role"] = "user") => {
  vi.spyOn(api, "worlds").mockResolvedValue(worlds);
  vi.spyOn(api, "systems").mockResolvedValue([{ id: "generic", name: "Generic", version: "1.0" }] as never);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UserContext.Provider value={{ ...user, role }}>
        <WorldListScreen />
        <Toaster />
      </UserContext.Provider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
  navigate.mockClear();
});

describe("WorldListScreen", () => {
  it("shows a loading placeholder first, then the worlds with role and an Open button", async () => {
    setup([world]);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(await screen.findByRole("button", { name: /Opens*Greyhawk/ })).toBeInTheDocument();
    expect(screen.getByText("Game master")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Open/ }));
    expect(navigate).toHaveBeenCalledWith({ to: "/world/$worldId", params: { worldId: "w1" } });
  });

  it("offers to start the first world from the empty state and confirms with a toast", async () => {
    const created = { ...world, id: "w2", name: "New land" };
    const createWorld = vi.spyOn(api, "createWorld").mockResolvedValue(created);
    setup([]);

    expect(await screen.findByText("You are not part of any world yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "New world" }));
    await userEvent.type(screen.getByLabelText("World name"), "New land");
    await userEvent.click(screen.getByRole("button", { name: "Create world" }));

    expect(createWorld).toHaveBeenCalledWith("New land", "generic");
    expect(await screen.findByText("World created")).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "Your worlds" })).toHaveTextContent("New land");
  });

  it("shows the system installer only to administrators", async () => {
    const { unmount } = setup([world]);
    await screen.findByRole("button", { name: /Opens*Greyhawk/ });
    expect(screen.queryByRole("button", { name: /Install a rules system/ })).toBeNull();
    unmount();

    setup([world], "admin");
    expect(await screen.findByRole("button", { name: /Install a rules system/ })).toBeInTheDocument();
  });

  it("explains a load failure and lets the person retry", async () => {
    vi.spyOn(api, "worlds").mockRejectedValue(new Error("boom"));
    vi.spyOn(api, "systems").mockResolvedValue([]);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <UserContext.Provider value={user}>
          <WorldListScreen />
        </UserContext.Provider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("We could not load this.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup([world], "admin");
    await screen.findByRole("button", { name: /Opens*Greyhawk/ });
    expect(await axe(container)).toHaveNoViolations();
  });
});
