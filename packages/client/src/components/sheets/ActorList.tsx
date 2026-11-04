import type { ActorDto } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { ListItemButton } from "../ui/list-item-button";

interface Props {
  actors: ActorDto[];
  selectedId: string | null;
  onSelect: (actorId: string) => void;
}

/** Sheets the person can see, as a list of buttons. */
export function ActorList({ actors, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t("sheet.list")} className="m-0 grid list-none gap-1 p-0">
      {actors.map((actor) => (
        <li key={actor.id}>
          <ListItemButton aria-pressed={actor.id === selectedId} onClick={() => onSelect(actor.id)}>
            <Avatar name={actor.name} />
            <span className="min-w-0 flex-1 truncate font-semibold">{actor.name}</span>
            <Badge tone={actor.type === "npc" ? "neutral" : "accent"}>{t(actor.type === "npc" ? "sheet.npc" : "sheet.character")}</Badge>
          </ListItemButton>
        </li>
      ))}
    </ul>
  );
}
