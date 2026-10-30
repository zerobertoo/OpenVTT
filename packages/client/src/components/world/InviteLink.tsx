import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input, Select } from "../ui/input";
import { toast } from "../ui/toast";

export interface InviteOptions {
  expiresInHours: number | null;
  maxUses: number | null;
  role: "player" | "observer";
}

const EXPIRY_HOURS = [null, 1, 24, 24 * 7] as const;
const USES = [null, 1, 5] as const;

interface Props {
  /** The link to share, or null before one is created. */
  link: string | null;
  onCreate: (options: InviteOptions) => void;
  creating?: boolean;
}

/** Creates an invite link and offers to copy it. The field is read-only and selects itself, so copying by hand works too. */
export function InviteLink({ link, onCreate, creating }: Props) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<InviteOptions>({ expiresInHours: null, maxUses: null, role: "player" });
  const number = (value: string) => (value ? Number(value) : null);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: t("invite.copied"), tone: "success" });
    } catch {
      toast({ title: t("invite.copyFailed"), description: t("invite.copyFailedHint"), tone: "error" });
    }
  };

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Field label={t("invite.expires")}>
          {(control) => (
            <Select
              {...control}
              value={options.expiresInHours ?? ""}
              onChange={(e) => setOptions({ ...options, expiresInHours: number(e.target.value) })}
            >
              {EXPIRY_HOURS.map((hours) => (
                <option key={hours ?? "never"} value={hours ?? ""}>
                  {hours === null ? t("invite.never") : t("invite.hours", { count: hours })}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("invite.uses")}>
          {(control) => (
            <Select
              {...control}
              value={options.maxUses ?? ""}
              onChange={(e) => setOptions({ ...options, maxUses: number(e.target.value) })}
            >
              {USES.map((uses) => (
                <option key={uses ?? "any"} value={uses ?? ""}>
                  {uses === null ? t("invite.unlimited") : String(uses)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("invite.joinAs")}>
          {(control) => (
            <Select
              {...control}
              value={options.role}
              onChange={(e) => setOptions({ ...options, role: e.target.value as InviteOptions["role"] })}
            >
              <option value="player">{t("members.roles.player")}</option>
              <option value="observer">{t("members.roles.observer")}</option>
            </Select>
          )}
        </Field>
      </div>
      <Button variant={link ? "secondary" : "primary"} pending={creating} onClick={() => onCreate(options)} className="justify-self-start">
        {t("invite.create")}
      </Button>
      {link && (
        <div className="flex items-end gap-2">
          <Field label={t("invite.linkLabel")} className="flex-1">
            {(control) => <Input {...control} readOnly value={link} onFocus={(e) => e.target.select()} />}
          </Field>
          <Button variant="secondary" onClick={copy}>
            {t("invite.copy")}
          </Button>
        </div>
      )}
    </div>
  );
}
