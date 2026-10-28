import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Button } from "./button";
import { EmptyState, ErrorState } from "./empty-state";
import { Loading, Skeleton } from "./skeleton";

describe("Loading", () => {
  it("announces the label and hides the skeleton shapes from assistive technology", () => {
    const { container } = render(
      <Loading label="Loading worlds">
        <Skeleton />
        <Skeleton shape="circle" />
      </Loading>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading worlds");
    for (const shape of container.querySelectorAll("span[aria-hidden]")) expect(shape).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EmptyState", () => {
  it("shows a heading, a hint and the next step", () => {
    render(<EmptyState title="No worlds yet" description="Start your own." action={<Button>Create world</Button>} />);
    expect(screen.getByRole("heading", { name: "No worlds yet", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Start your own.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create world" })).toBeInTheDocument();
  });

  it("uses the requested heading level", () => {
    render(<EmptyState title="Nothing here" headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("is announced and retries when asked", async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="We could not load this." description="Check your connection." onRetry={onRetry} retryLabel="Try again" />);
    expect(screen.getByRole("alert")).toHaveTextContent("We could not load this.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offers no retry button without a handler", () => {
    render(<ErrorState title="Gone" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <main>
        <Loading label="Loading">
          <Skeleton />
        </Loading>
        <EmptyState title="Empty" description="Nothing yet" />
        <ErrorState title="Failed" onRetry={() => {}} retryLabel="Try again" />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
