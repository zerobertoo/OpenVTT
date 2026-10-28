import type { SheetTemplate } from "@openvtt/sdk";
import type { ActorDto, SystemInfoDto } from "@openvtt/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ActorList } from "./ActorList";
import { SaveStatus, SheetView } from "./SheetView";

const template: SheetTemplate = {
  sections: [
    {
      id: "basics",
      label: "Basics",
      fields: [
        { id: "name", type: "text", label: "Name" },
        { id: "level", type: "number", label: "Level" },
        { id: "double", type: "computed", label: "Double level", formula: "@level * 2" },
        { id: "inspired", type: "checkbox", label: "Inspired" },
        { id: "notes", type: "text", multiline: true, label: "Notes" },
      ],
    },
    {
      id: "gear",
      label: "Gear",
      fields: [{ id: "items", type: "list", label: "Items", itemFields: [{ id: "item", type: "text", label: "Item" }] }],
    },
  ],
};
const system = { manifest: {}, templates: { character: template }, strings: {}, overridden: [] } as unknown as SystemInfoDto;
const ada: ActorDto = {
  id: "a1",
  type: "character",
  name: "Ada",
  ownerId: null,
  data: { name: "Ada", level: 3, inspired: true, notes: "", items: [{ item: "Rope" }] },
};
const goblin: ActorDto = { ...ada, id: "a2", name: "Goblin", type: "npc" };

const meta = { title: "Panels/Sheets", tags: ["autodocs"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Actors: Story = {
  render: () => {
    const [selected, setSelected] = useState("a1");
    return (
      <div className="w-80">
        <ActorList actors={[ada, goblin]} selectedId={selected} onSelect={setSelected} />
      </div>
    );
  },
};

export const Sheet: Story = {
  render: () => (
    <div className="grid w-80 gap-2">
      <SaveStatus state="saved" />
      <SheetView actor={ada} template={template} system={system} locale="en" onSave={() => {}} />
    </div>
  ),
};
