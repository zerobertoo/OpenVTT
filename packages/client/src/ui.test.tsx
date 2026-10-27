import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ApiError } from "./api";
import { ErrorMessage, useAction } from "./ui";

describe("ErrorMessage", () => {
  it("renders nothing without an error", () => {
    const { container } = render(<ErrorMessage error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces a translated API error", async () => {
    const { container } = render(<ErrorMessage error={new ApiError("invalid_credentials")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Wrong username or password.");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("falls back to the generic message for unknown errors", () => {
    render(<ErrorMessage error={new Error("boom")} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("useAction", () => {
  it("returns the result and clears pending", async () => {
    const { result } = renderHook(() => useAction());
    let value: number | undefined;
    await act(async () => {
      value = await result.current.run(async () => 42);
    });
    expect(value).toBe(42);
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("captures the error and resolves undefined", async () => {
    const { result } = renderHook(() => useAction());
    const failure = new ApiError("network");
    let value: unknown = "unset";
    await act(async () => {
      value = await result.current.run(async () => {
        throw failure;
      });
    });
    expect(value).toBeUndefined();
    expect(result.current.error).toBe(failure);
  });
});
