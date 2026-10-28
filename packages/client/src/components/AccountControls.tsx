import { SUPPORTED_LOCALES } from "@openvtt/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { normalizeLocale, setLocale } from "../i18n";
import { queryKeys, useMe } from "../queries";

function LanguageSwitcher({ signedIn }: { signedIn: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <label>
      <span className="muted">{t("language.label")}</span>
      <select
        value={normalizeLocale(i18n.language) ?? "en"}
        onChange={(e) => {
          const locale = normalizeLocale(e.target.value)!;
          setLocale(locale);
          if (signedIn) void api.setLocale(locale);
        }}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(`language.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Language picker and, when signed in, the log-out button. */
export function AccountControls() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: user } = useMe();

  const logout = async () => {
    await api.logout();
    // Drop everything the previous user could see, then show the sign-in form.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });
    queryClient.setQueryData(queryKeys.me, null);
    await navigate({ to: "/" });
  };

  return (
    <div className="account">
      <LanguageSwitcher signedIn={!!user} />
      {user && (
        <button type="button" className="link" onClick={logout}>
          {t("auth.logout")} ({user.username})
        </button>
      )}
    </div>
  );
}
