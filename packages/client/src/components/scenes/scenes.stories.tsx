import type { SceneDto } from "@openvtt/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SceneCard } from "./SceneCard";
import { SceneCreateForm, SceneSettingsForm } from "./SceneForms";

const tavern: SceneDto = {
  id: "s1",
  name: "Tavern",
  assetId: null,
  assetKind: null,
  width: 2000,
  height: 1500,
  gridType: "square",
  gridSize: 70,
  gridDistance: 5,
  distanceUnit: "ft",
  walls: [],
  lights: [],
  bakedLighting: false,
  floorGroup: null,
  floor: 0,
  visionEnabled: false,
  visionRadius: 12,
  drawings: [],
};
const cave: SceneDto = { ...tavern, id: "s2", name: "Goblin cave" };

const meta = { title: "Panels/Scenes", tags: ["autodocs"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SceneList: Story = {
  render: () => {
    const [viewing, setViewing] = useState("s1");
    return (
      <ul className="m-0 grid w-80 list-none gap-1.5 p-0">
        {[tavern, cave].map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            viewing={scene.id === viewing}
            shown={scene.id === "s1"}
            onView={() => setViewing(scene.id)}
            onShowToPlayers={() => {}}
            onDelete={() => {}}
          />
        ))}
      </ul>
    );
  },
};

export const Settings: Story = {
  render: () => (
    <div className="w-80">
      <SceneSettingsForm scene={tavern} onSubmit={(e) => e.preventDefault()} />
    </div>
  ),
};

export const Create: Story = {
  render: () => {
    const [file, setFile] = useState<File | null>(null);
    return (
      <div className="w-80">
        <SceneCreateForm onSubmit={(e) => e.preventDefault()} imageFile={file} onImageChange={setFile} />
      </div>
    );
  },
};
