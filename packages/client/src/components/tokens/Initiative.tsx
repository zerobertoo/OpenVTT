import type { CombatDto, TokenDto } from "@openvtt/shared";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

interface Props {
  combat: CombatDto | null;
  isGm: boolean;
  /** The token picked on the map, which the game master can add to the order. */
  selectedToken: TokenDto | null;
  onSetScore: (tokenId: string, score: number) => void;
  onRemove: (tokenId: string) => void;
  onNextTurn: () => void;
  onEnd: () => void;
}

/** Initiative order. Everyone reads it; only the game master edits scores and moves the turn. */
export function Initiative({ combat, isGm, selectedToken, onSetScore, onRemove, onNextTurn, onEnd }: Props) {
  const { t } = useTranslation();
  const [score, setScore] = useState("");
  const inOrder = !!selectedToken && !!combat?.combatants.some((c) => c.tokenId === selectedToken.id);
  if (!combat && !isGm) return null;

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedToken || score.trim() === "" || !Number.isFinite(Number(score))) return;
    onSetScore(selectedToken.id, Number(score));
    setScore("");
  };

  return (
    <section aria-label={t("initiative.title")} className="grid grid-cols-[minmax(0,1fr)] gap-2 border-line border-t-[1.5px] pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4>{t("initiative.title")}</h4>
        {combat && <Badge tone="accent">{t("initiative.round", { round: combat.round })}</Badge>}
      </div>

      {combat && combat.combatants.length > 0 && (
        <ol aria-label={t("initiative.list")} className="m-0 grid list-none gap-1 p-0">
          {combat.combatants.map((c) => (
            <li
              key={c.tokenId}
              aria-current={c.tokenId === combat.turnTokenId ? "true" : undefined}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 aria-[current=true]:bg-accent-soft aria-[current=true]:shadow-[inset_0_0_0_1.5px_var(--accent)]"
            >
              <span className="w-9 shrink-0 text-right font-bold tabular-nums">{c.score}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
              {c.tokenId === combat.turnTokenId && <Badge tone="accent">{t("initiative.turn")}</Badge>}
              {isGm && (
                <Button variant="ghost" size="sm" onClick={() => onRemove(c.tokenId)} aria-label={t("initiative.remove", { name: c.name })}>
                  {t("initiative.removeShort")}
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}

      {isGm && (
        <>
          <form onSubmit={add} className="flex items-end gap-2">
            <Field
              label={selectedToken ? t("initiative.scoreFor", { name: selectedToken.name }) : t("initiative.score")}
              className="flex-1"
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  disabled={!selectedToken}
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" disabled={!selectedToken || score.trim() === ""}>
              {inOrder ? t("initiative.update") : t("initiative.add")}
            </Button>
          </form>
          {!selectedToken && <p className="muted">{t("initiative.selectHint")}</p>}
          {combat && (
            <div className="flex gap-2">
              <Button onClick={onNextTurn} disabled={combat.combatants.length === 0}>
                {t("initiative.next")}
              </Button>
              <Button variant="dangerLink" onClick={onEnd}>
                {t("initiative.end")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
