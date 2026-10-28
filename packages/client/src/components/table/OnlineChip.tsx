import type { MemberDto } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { AvatarStack } from "../ui/avatar";

/** Top-right chip with who is at the table right now. */
export function OnlineChip({ members }: { members: MemberDto[] }) {
  const { t } = useTranslation();
  const online = members.filter((member) => member.online);
  const label = `${online.length} ${t("table.online")}`;
  return (
    <div className="chrome online-chip">
      <AvatarStack
        label={label}
        size="md"
        max={5}
        people={online.map((member) => ({ id: member.userId, name: member.displayName, color: member.color }))}
      />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
