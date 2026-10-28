import type { MemberDto } from "@openvtt/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Toaster } from "../ui/toast";
import { InviteLink } from "./InviteLink";
import { MemberList } from "./MemberList";

const members: MemberDto[] = [
  { userId: "u1", displayName: "Ada", color: "#3366aa", role: "gm", online: true },
  { userId: "u2", displayName: "Grace", color: "#aa6633", role: "player", online: false },
  { userId: "u3", displayName: "Linus", color: "#448855", role: "player", online: true },
];

const meta = { title: "Panels/World", tags: ["autodocs"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Members: Story = {
  render: () => (
    <div className="w-80">
      <MemberList members={members} />
    </div>
  ),
};

export const Invite: Story = {
  render: () => {
    const [link, setLink] = useState<string | null>(null);
    return (
      <div className="w-80">
        <Toaster />
        <InviteLink link={link} onCreate={() => setLink("https://vtt.example/join/Kq3x9Zt")} />
      </div>
    );
  },
};
