import type { MemberDto } from "@openvtt/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Toaster } from "../ui/toast";
import { InviteLink } from "./InviteLink";
import { MemberList } from "./MemberList";

const members: MemberDto[] = [
  { userId: "u1", displayName: "Ada", color: "#3366aa", role: "gm", online: true, muted: false },
  { userId: "u2", displayName: "Grace", color: "#aa6633", role: "player", online: false, muted: false },
];

const stubClipboard = (writeText: () => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

afterEach(() => Reflect.deleteProperty(navigator, "clipboard"));

describe("MemberList", () => {
  it("writes out role and presence for each member", () => {
    render(<MemberList members={members} />);
    const [ada, grace] = screen.getAllByRole("listitem");
    expect(ada).toHaveTextContent("Ada");
    expect(ada).toHaveTextContent("online");
    expect(ada).toHaveTextContent("Game master");
    expect(grace).toHaveTextContent("offline");
    expect(grace).toHaveTextContent("Player");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<MemberList members={members} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("InviteLink", () => {
  it("creates the link and then offers to copy it", async () => {
    const onCreate = vi.fn();
    const { rerender } = render(<InviteLink link={null} onCreate={onCreate} />);
    expect(screen.queryByLabelText("Invite link")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Create invite link" }));
    expect(onCreate).toHaveBeenCalledOnce();

    rerender(<InviteLink link="https://vtt.test/join/abc" onCreate={onCreate} />);
    expect(screen.getByLabelText("Invite link")).toHaveValue("https://vtt.test/join/abc");
    expect(screen.getByLabelText("Invite link")).toHaveAttribute("readonly");
  });

  it("copies the link and confirms with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(
      <>
        <InviteLink link="https://vtt.test/join/abc" onCreate={vi.fn()} />
        <Toaster />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith("https://vtt.test/join/abc");
    expect(await screen.findByText("Invite link copied")).toBeInTheDocument();
  });

  it("tells the person to copy by hand when the clipboard is refused", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(
      <>
        <InviteLink link="https://vtt.test/join/abc" onCreate={vi.fn()} />
        <Toaster />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByText("Could not copy the link")).toBeInTheDocument();
    expect(screen.getByText("Select the link and copy it by hand.")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<InviteLink link="https://vtt.test/join/abc" onCreate={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
