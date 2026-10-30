import type { MessageDto } from "@openvtt/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ChatComposer } from "./ChatComposer";
import { ChatMessage } from "./ChatMessage";

const base: MessageDto = {
  id: "m1",
  userId: "u1",
  senderName: "Ada",
  kind: "chat",
  toUserId: null,
  gmOnly: false,
  content: "Hello table",
  roll: null,
  createdAt: Date.UTC(2026, 0, 1, 12, 30),
};

const rollMessage: MessageDto = {
  ...base,
  id: "m2",
  kind: "roll",
  content: "",
  roll: {
    notation: "1d20+3",
    parts: [{ sign: 1, count: 1, sides: 20, results: [20], kept: [0] }],
    modifier: 3,
    advantage: null,
    total: 23,
  },
};

const inList = (ui: React.ReactElement) => <ul aria-live="polite">{ui}</ul>;

describe("ChatMessage", () => {
  it("shows text with sender and tags for whispers", () => {
    render(inList(<ChatMessage message={{ ...base, toUserId: "u2" }} color="#3366aa" isNew={false} />));
    expect(screen.getByText("Hello table")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("whisper")).toBeInTheDocument();
  });

  it("gives a roll a text summary for screen readers, since the dice are decorative", () => {
    render(inList(<ChatMessage message={rollMessage} color={undefined} isNew={false} />));
    expect(screen.getByText("1d20+3: total 23")).toHaveClass("sr-only");
    expect(screen.getByText("Natural 20!")).toBeInTheDocument();
  });

  it("offers to roll again only when asked to", async () => {
    const onRollAgain = vi.fn();
    const { rerender } = render(inList(<ChatMessage message={rollMessage} color={undefined} isNew={false} />));
    expect(screen.queryByRole("button", { name: "Roll again" })).toBeNull();
    rerender(inList(<ChatMessage message={rollMessage} color={undefined} isNew={false} onRollAgain={onRollAgain} />));
    await userEvent.click(screen.getByRole("button", { name: "Roll again" }));
    expect(onRollAgain).toHaveBeenCalled();
  });

  it("is announced through a polite live region", () => {
    render(inList(<ChatMessage message={base} color={undefined} isNew />));
    expect(screen.getByRole("list")).toHaveAttribute("aria-live", "polite");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(inList(<ChatMessage message={base} color="#3366aa" isNew={false} />));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ChatComposer", () => {
  const recipients = [{ userId: "u2", displayName: "Grace" }];

  it("sends the message with its options and clears the draft when accepted", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<ChatComposer recipients={recipients} onSend={onSend} error={null} />);

    await userEvent.type(screen.getByLabelText(/Message, or/), "/r 2d6");
    await userEvent.selectOptions(screen.getByLabelText("To"), "u2");
    await userEvent.click(screen.getByLabelText("GM only"));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith({ content: "/r 2d6", toUserId: "u2", gmOnly: true });
    await waitFor(() => expect(screen.getByLabelText(/Message, or/)).toHaveValue(""));
  });

  it("brings back earlier messages with the arrow keys", async () => {
    render(<ChatComposer recipients={[]} onSend={vi.fn().mockResolvedValue(true)} error={null} />);
    const box = screen.getByLabelText(/Message, or/);
    await userEvent.type(box, "/r 1d20{Enter}");
    await userEvent.type(box, "hello{Enter}");
    await userEvent.type(box, "{ArrowUp}");
    await waitFor(() => expect(box).toHaveValue("hello"));
    await userEvent.type(box, "{ArrowUp}");
    await waitFor(() => expect(box).toHaveValue("/r 1d20"));
    await userEvent.type(box, "{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(box).toHaveValue(""));
  });

  it("keeps the draft when sending fails and ignores empty drafts", async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    render(<ChatComposer recipients={[]} onSend={onSend} error={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Message, or/), "hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByLabelText(/Message, or/)).toHaveValue("hi");
  });

  it("rolls with advantage using the dice already typed, or a plain d20", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<ChatComposer recipients={[]} onSend={onSend} error={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Advantage" }));
    expect(onSend).toHaveBeenLastCalledWith({ content: "/r 1d20 adv", toUserId: null, gmOnly: false });

    await userEvent.type(screen.getByLabelText(/Message, or/), "/r 1d20+5 adv");
    await userEvent.click(screen.getByRole("button", { name: "Disadvantage" }));
    expect(onSend).toHaveBeenLastCalledWith({ content: "/r 1d20+5 dis", toUserId: null, gmOnly: false });
  });

  it("turns /w Name message into a whisper, and explains an unknown name", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<ChatComposer recipients={recipients} onSend={onSend} error={null} />);
    const box = screen.getByLabelText(/Message, or/);
    await userEvent.type(box, "/w grace psst{Enter}");
    expect(onSend).toHaveBeenCalledWith({ content: "psst", toUserId: "u2", gmOnly: false });

    await userEvent.type(box, "/w Nobody hi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("No one here by that name");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ChatComposer recipients={recipients} onSend={vi.fn()} error={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
