import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Icon } from "../../icons";
import { TabContent, TabList, Tabs, TabTrigger } from "./tabs";
import { ToolbarChoices } from "./toolbar";

const meta = { title: "Navigation/Tabs and Toolbar", tags: ["autodocs"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The drawer rail: a column on wide screens, a scrolling row under 52rem. */
export const DrawerTabs: Story = {
  render: () => (
    <Tabs defaultValue="chat" orientation="vertical" className="flex h-64 w-80 overflow-hidden rounded-card bg-surface">
      <TabList aria-label="Panels">
        <TabTrigger value="chat">
          <Icon name="chat" />
          Chat
        </TabTrigger>
        <TabTrigger value="tokens">
          <Icon name="tokens" />
          Tokens
        </TabTrigger>
      </TabList>
      <TabContent value="chat" className="p-4">
        Chat panel
      </TabContent>
      <TabContent value="tokens" className="p-4">
        Tokens panel
      </TabContent>
    </Tabs>
  ),
};

/** Map tools: exactly one is always active. */
export const MapTools: Story = {
  render: () => {
    const [tool, setTool] = useState<"select" | "ruler">("select");
    return (
      <ToolbarChoices
        label="Map tools"
        value={tool}
        onValueChange={setTool}
        choices={[
          { value: "select", label: "Select", icon: <Icon name="select" /> },
          { value: "ruler", label: "Ruler", icon: <Icon name="ruler" /> },
        ]}
      />
    );
  },
};
