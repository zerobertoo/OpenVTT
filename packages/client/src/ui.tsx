import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./api";

/** The translation key for an error: its server code, or the generic one for anything unexpected. */
export function errorKey(error: unknown) {
  return `errors.${error instanceof ApiError ? error.code : "internal_error"}` as const;
}

export function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <p role="alert" className="error">
      {t(errorKey(error))}
    </p>
  );
}

/** Runs an async action, exposing its pending state and last error for display. */
export function useAction() {
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err);
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, error, pending };
}
