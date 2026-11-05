import { type EnvironmentDto, SEASONS, TIMES_OF_DAY, WEATHERS } from "@openvtt/shared";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { ErrorMessage, useAction } from "../../ui";
import { Field } from "../ui/field";
import { Select } from "../ui/select";

/** The game master picks the time of day, weather and season; everyone sees them over the map. */
export function EnvironmentControls({ worldId, environment }: { worldId: string; environment: EnvironmentDto }) {
  const { t } = useTranslation();
  const { run, error } = useAction();
  const change = (patch: Partial<EnvironmentDto>) => void run(() => api.setEnvironment(worldId, { ...environment, ...patch }));
  const fields = [
    { key: "time", values: TIMES_OF_DAY },
    { key: "weather", values: WEATHERS },
    { key: "season", values: SEASONS },
  ] as const;

  return (
    <section aria-label={t("environment.title")} className="grid gap-2">
      <h3>{t("environment.title")}</h3>
      {fields.map(({ key, values }) => (
        <Field key={key} label={t(`environment.${key}`)}>
          {(control) => (
            <Select {...control} value={environment[key]} onValueChange={(value) => change({ [key]: value })}>
              {values.map((value) => (
                <option key={value} value={value}>
                  {/* The key is built from two unions, so the typed-key check cannot follow it. */}
                  {t(`environment.${key}Options.${value}` as "environment.timeOptions.day")}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ))}
      <ErrorMessage error={error} />
    </section>
  );
}
