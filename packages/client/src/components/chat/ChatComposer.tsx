import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../icons";
import { ErrorMessage } from "../../ui";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import { Input, Select } from "../ui/input";

interface Props {
  recipients: { userId: string; displayName: string }[];
  /** Resolves true when the message was accepted, so the draft can be cleared. */
  onSend: (message: { content: string; toUserId: string | null; gmOnly: boolean }) => Promise<boolean>;
  error: unknown;
}

/** Message box with recipient and "GM only" options. Text starting with /r is rolled by the server. */
export function ChatComposer({ recipients, onSend, error }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [recipient, setRecipient] = useState("");
  const [gmOnly, setGmOnly] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    if (await onSend({ content: draft, toUserId: recipient || null, gmOnly })) setDraft("");
  };

  return (
    <form className="chat-form" onSubmit={submit}>
      <div className="chat-input-row">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          maxLength={2000}
        />
        <Button type="submit" size="icon" aria-label={t("chat.send")} title={t("chat.send")}>
          <Icon name="send" />
        </Button>
      </div>
      <div className="chat-options">
        <Field label={t("chat.to")}>
          {(control) => (
            <Select {...control} value={recipient} onChange={(e) => setRecipient(e.target.value)} className="py-1.5">
              <option value="">{t("chat.everyone")}</option>
              {recipients.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("chat.gmOnly")} inline>
          {(control) => <Checkbox {...control} checked={gmOnly} onChange={(e) => setGmOnly(e.target.checked)} />}
        </Field>
      </div>
      <ErrorMessage error={error} />
    </form>
  );
}
