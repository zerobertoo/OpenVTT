import type { MemberDto, WorldRole } from "@openvtt/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";
import { Select } from "../ui/input";

interface Management {
  onRoleChange: (userId: string, role: WorldRole) => void;
  onMuteChange: (userId: string, muted: boolean) => void;
  onKick: (userId: string) => void;
}

const ASSIGNABLE_ROLES = ["assistant", "player", "observer"] as const;

/** Everyone in the world, with role and whether they are at the table now. Presence is written out, not only colored. */
export function MemberList({ members, manage }: { members: MemberDto[]; manage?: Management }) {
  const { t } = useTranslation();
  const [kicking, setKicking] = useState<MemberDto | null>(null);
  return (
    <>
      <ul aria-label={t("table.members")} className="m-0 grid list-none gap-2 p-0">
        {members.map((member) => (
          <li key={member.userId} className="flex flex-wrap items-center gap-2.5">
            <Avatar name={member.displayName} color={member.color} online={member.online} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{member.displayName}</span>
              <span className="text-ink-2 text-sm">
                {t(member.online ? "table.online" : "table.offline")}
                {member.muted && ` · ${t("members.muted")}`}
              </span>
            </span>
            {manage && member.role !== "gm" ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <Select
                  aria-label={t("members.roleOf", { name: member.displayName })}
                  value={member.role}
                  onChange={(e) => manage.onRoleChange(member.userId, e.target.value as WorldRole)}
                  className="w-auto py-1"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`members.roles.${role}`)}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="secondary" onClick={() => manage.onMuteChange(member.userId, !member.muted)}>
                  {t(member.muted ? "members.unmute" : "members.mute")}
                  <span className="sr-only"> {member.displayName}</span>
                </Button>
                <Button size="sm" variant="dangerLink" onClick={() => setKicking(member)}>
                  {t("members.kick")}
                  <span className="sr-only"> {member.displayName}</span>
                </Button>
              </span>
            ) : (
              <Badge tone={member.role === "gm" ? "accent" : "neutral"}>{t(`members.roles.${member.role}`)}</Badge>
            )}
          </li>
        ))}
      </ul>
      {manage && (
        <ConfirmDialog
          open={kicking !== null}
          onOpenChange={(open) => !open && setKicking(null)}
          title={t("members.kickTitle", { name: kicking?.displayName })}
          description={t("members.kickBody")}
          confirmLabel={t("members.kick")}
          cancelLabel={t("common.cancel")}
          tone="danger"
          onConfirm={() => {
            if (kicking) manage.onKick(kicking.userId);
            setKicking(null);
          }}
        />
      )}
    </>
  );
}
