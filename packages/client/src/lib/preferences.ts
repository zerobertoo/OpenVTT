import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_MEASURE_PREFS, type MeasurePrefs } from "./units";

interface PreferencesState {
  measure: MeasurePrefs;
  setMeasure: (measure: Partial<MeasurePrefs>) => void;
}

/** Per-browser display preferences. They are kept in this browser only; nothing is sent to the server. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      measure: DEFAULT_MEASURE_PREFS,
      setMeasure: (measure) => set((state) => ({ measure: { ...state.measure, ...measure } })),
    }),
    { name: "openvtt-preferences", version: 1 },
  ),
);
