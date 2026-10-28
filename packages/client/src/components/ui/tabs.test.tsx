import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { TabContent, TabList, Tabs, TabTrigger } from "./tabs";
import { ToolbarChoices } from "./toolbar";

function Panels() {
  return (
    <Tabs defaultValue="chat" orientation="vertical">
      <TabList aria-label="Panels">
        <TabTrigger value="chat">Chat</TabTrigger>
        <TabTrigger value="tokens">Tokens</TabTrigger>
      </TabList>
      <TabContent value="chat">Chat panel</TabContent>
      <TabContent value="tokens">Tokens panel</TabContent>
    </Tabs>
  );
}

function Tools() {
  const [tool, setTool] = useState<"select" | "ruler">("select");
  return (
    <ToolbarChoices
      label="Map tools"
      value={tool}
      onValueChange={setTool}
      choices={[
        { value: "select", label: "Select", icon: null },
        { value: "ruler", label: "Ruler", icon: null },
      ]}
    />
  );
}

describe("Tabs", () => {
  it("exposes tab roles and switches panel with the arrow keys", async () => {
    render(<Panels />);
    expect(screen.getByRole("tab", { name: "Chat", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Chat panel");

    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Tokens" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Tokens panel");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Panels />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ToolbarChoices", () => {
  it("keeps one tool active and ignores pressing the active one again", async () => {
    render(<Tools />);
    const select = screen.getByRole("radio", { name: "Select" });
    expect(select).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "Ruler" }));
    expect(screen.getByRole("radio", { name: "Ruler" })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: "Ruler" }));
    expect(screen.getByRole("radio", { name: "Ruler" })).toBeChecked();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Tools />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
