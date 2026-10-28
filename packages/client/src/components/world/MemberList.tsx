import type { MemberDto } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/badge";

/** Everyone in the world, with role and whether they are at the table now. Presence is written out, not only colored. */
export function MemberList({ members }: { members: MemberDto[] }) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t("table.members")} className="m-0 grid list-none gap-2 p-0">
      {members.map((member) => (
        <li key={member.userId} className="flex items-center gap-2.5">
          <Avatar name={member.displayName} color={member.color} online={member.online} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{member.displayName}</span>
            <span className="text-ink-2 text-sm">{t(member.online ? "table.online" : "table.offline")}</span>
          </span>
          <Badge tone={member.role === "gm" ? "accent" : "neutral"}>
            {t(member.role === "gm" ? "worlds.roleGm" : "worlds.rolePlayer")}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
