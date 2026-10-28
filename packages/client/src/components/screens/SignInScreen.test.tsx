import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { api } from "../../api";
import { queryKeys } from "../../queries";
import { SignInScreen } from "./SignInScreen";

const setup = () => {
  const queryClient = new QueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <SignInScreen />
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
};

describe("SignInScreen", () => {
  it("asks for both fields before calling the server", async () => {
    const login = vi.spyOn(api, "login");
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findAllByText("This field is required.")).toHaveLength(2);
    expect(login).not.toHaveBeenCalled();
  });

  it("checks the account rules when creating one and shows the first-account hint", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "No account yet? Create one" }));
    expect(screen.getByText("The first account created becomes the installation administrator.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Username"), "a");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Use 3 to 32 letters, numbers, dots, dashes or underscores.")).toBeInTheDocument();
    expect(screen.getAllByText("Use at least 8 characters.").length).toBeGreaterThan(0);
  });

  it("stores the signed-in user so the app moves on", async () => {
    const user = { id: "u1", username: "ada", role: "admin", locale: "en" } as never;
    vi.spyOn(api, "login").mockResolvedValue(user);
    const { queryClient } = setup();
    await userEvent.type(screen.getByLabelText("Username"), "ada");
    await userEvent.type(screen.getByLabelText("Password"), "whatever");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await vi.waitFor(() => expect(queryClient.getQueryData(queryKeys.me)).toBe(user));
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });
});
