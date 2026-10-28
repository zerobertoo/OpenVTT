import type { UserDto, WorldSummaryDto } from "@openvtt/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ApiError, api } from "../../api";
import { UserContext } from "../../userContext";
import { JoinInviteScreen } from "./JoinInviteScreen";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const user = { id: "u1", username: "ada", role: "user", locale: "en" } as UserDto;

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <UserContext.Provider value={user}>
        <JoinInviteScreen code="abc" />
      </UserContext.Provider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.restoreAllMocks();
  navigate.mockClear();
});

describe("JoinInviteScreen", () => {
  it("starts with the account name and joins with the chosen name, then opens the world", async () => {
    const join = vi.spyOn(api, "join").mockResolvedValue({ id: "w1", name: "Greyhawk" } as WorldSummaryDto);
    setup();
    const name = screen.getByLabelText("Display name");
    expect(name).toHaveValue("ada");

    await userEvent.clear(name);
    await userEvent.type(name, "Ada the Bold");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(join).toHaveBeenCalledWith("abc", "Ada the Bold", "#3d6fd8");
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/world/$worldId", params: { worldId: "w1" } }));
  });

  it("explains an invalid invite and stays on the page", async () => {
    vi.spyOn(api, "join").mockRejectedValue(new ApiError("invite_invalid"));
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This invite link is not valid.");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });
});
