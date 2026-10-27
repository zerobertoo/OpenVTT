import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./api";

export function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  const code = error instanceof ApiError ? error.code : "internal_error";
  return (
    <p role="alert" className="error">
      {t(`errors.${code}`)}
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
