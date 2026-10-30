import type { TokenDto } from "@openvtt/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AssetPicker } from "../ui/asset-picker";
import { TokenEditor } from "./TokenEditor";
import { TokenList } from "./TokenList";

const goblin: TokenDto = {
  id: "t1",
  sceneId: "s1",
  name: "Goblin",
  x: 0,
  y: 0,
  size: 1,
  rotation: 90,
  color: "#aa3333",
  assetId: null,
  hidden: true,
  actorId: null,
  controllerIds: [],
  hp: null,
  hpMax: null,
  conditions: [],
  showName: false,
};
const hero: TokenDto = { ...goblin, id: "t2", name: "Hero", hidden: false, color: "#3366aa" };

const meta = { title: "Panels/Tokens", tags: ["autodocs"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  render: () => {
    const [selected, setSelected] = useState<string | null>("t2");
    return (
      <div className="w-80">
        <TokenList tokens={[goblin, hero]} selectedId={selected} onSelect={setSelected} />
      </div>
    );
  },
};

export const EditorAsGameMaster: Story = {
  render: () => (
    <div className="w-80">
      <TokenEditor
        token={goblin}
        players={[{ userId: "u2", displayName: "Grace", color: "#336699", role: "player", online: true, muted: false }]}
        actors={[{ id: "a1", type: "npc", name: "Goblin sheet", ownerId: null, data: {} }]}
        isGm
        onPatch={() => {}}
        onUpload={() => {}}
        onDelete={() => {}}
      />
    </div>
  ),
};

export const ImagePicker: Story = {
  render: () => <AssetPicker label="Image" assetId={null} name="Goblin" color="#aa3333" onPick={() => {}} onRemove={() => {}} />,
};
