import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { toast } from "../ui/toast";

interface Props {
  /** The link to share, or null before one is created. */
  link: string | null;
  onCreate: () => void;
  creating?: boolean;
}

/** Creates an invite link and offers to copy it. The field is read-only and selects itself, so copying by hand works too. */
export function InviteLink({ link, onCreate, creating }: Props) {
  const { t } = useTranslation();

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
      <Button variant={link ? "secondary" : "primary"} pending={creating} onClick={onCreate} className="justify-self-start">
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
