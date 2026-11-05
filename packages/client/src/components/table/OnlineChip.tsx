import type { MemberDto } from "@openvtt/shared";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { Avatar } from "../ui/avatar";

/** How long a player who just connected shows the joining animation. */
export const JOINING_MS = 1600;
const MAX_BADGES = 6;

/** The ids of players who came online since the last render, for as long as their arrival animation plays. */
function useJoining(members: readonly MemberDto[]): ReadonlySet<string> {
  const known = useRef(new Map(members.map((member) => [member.userId, member.online])));
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [joining, setJoining] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const arrived = members.filter((member) => member.online && known.current.get(member.userId) !== true).map((m) => m.userId);
    known.current = new Map(members.map((member) => [member.userId, member.online]));
    if (arrived.length === 0) return;
    setJoining((current) => new Set([...current, ...arrived]));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setJoining((current) => new Set([...current].filter((id) => !arrived.includes(id))));
    }, JOINING_MS);
    timers.current.add(timer);
  }, [members]);

  // Timers outlive a render on purpose (members change often) and are only dropped when the chip goes away.
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );
  return joining;
}

/** Top-right bar with a badge for each player: who is at the table, and a flourish when someone connects. */
export function OnlineChip({ members }: { members: MemberDto[] }) {
  const { t } = useTranslation();
  const joining = useJoining(members);
  const ordered = [...members].sort((a, b) => Number(b.online) - Number(a.online));
  const shown = ordered.slice(0, MAX_BADGES);
  const hidden = ordered.length - shown.length;
  const onlineCount = members.filter((member) => member.online).length;
  return (
    <div className="chrome online-chip presence" role="group" aria-label={`${onlineCount} ${t("table.online")}`}>
      <ul className="presence-list">
        {shown.map((member) => {
          const arriving = joining.has(member.userId);
          return (
            <li
              key={member.userId}
              className={cn("presence-badge", member.online ? "is-online" : "is-offline", arriving && "is-joining")}
              style={{ "--who": member.color } as React.CSSProperties}
            >
              <span className="presence-avatar">
                <Avatar name={member.displayName} color={member.color} size="md" />
                <span className="presence-ring" />
              </span>
              <span className="presence-name">{arriving ? t("table.joining") : member.displayName}</span>
              <span className="sr-only">{t(member.online ? "table.online" : "table.offline")}</span>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && <span className="font-bold text-ink-2 text-xs">+{hidden}</span>}
    </div>
  );
}
