import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { dismissAllToasts, Toaster, toast } from "./toast";

afterEach(() => act(() => dismissAllToasts()));

describe("Toaster", () => {
  it("shows a message pushed from outside React, with its description", async () => {
    render(<Toaster />);
    act(() => toast({ title: "Link copied", description: "Paste it to invite someone." }));
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
    expect(screen.getByText("Paste it to invite someone.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Notifications/ })).toBeInTheDocument();
  });

  it("stacks several toasts and dismisses one with its close button", async () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "First", tone: "success" });
      toast({ title: "Second", tone: "error" });
    });
    expect(await screen.findByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Close" })[0]!);
    await waitFor(() => expect(screen.queryByText("First")).toBeNull());
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    render(<Toaster />);
    act(() => toast({ title: "Saved" }));
    await screen.findByText("Saved");
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
