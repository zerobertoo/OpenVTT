import type { TokenDto } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { assetUrl } from "../../api";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { ListItemButton } from "../ui/list-item-button";

interface Props {
  tokens: TokenDto[];
  selectedId: string | null;
  onSelect: (tokenId: string) => void;
}

/** Tokens of the scene as a list of buttons, so they can be picked without finding them on the map. */
export function TokenList({ tokens, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t("token.list")} className="m-0 grid list-none gap-1 p-0">
      {tokens.map((token) => (
        <li key={token.id}>
          <ListItemButton aria-pressed={token.id === selectedId} onClick={() => onSelect(token.id)}>
            <Avatar name={token.name} color={token.color} src={token.assetId ? assetUrl(token.assetId) : undefined} />
            <span className="min-w-0 flex-1 truncate font-semibold">{token.name}</span>
            {token.hidden && <Badge>{t("token.hiddenBadge")}</Badge>}
          </ListItemButton>
        </li>
      ))}
    </ul>
  );
}
