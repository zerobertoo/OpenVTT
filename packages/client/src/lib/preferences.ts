import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_MEASURE_PREFS, type MeasurePrefs } from "./units";

interface PreferencesState {
  measure: MeasurePrefs;
  /** Animate other people's rolls over the table. */
  diceOverlay: boolean;
  setDiceOverlay: (on: boolean) => void;
  /** Throw solid dice in the overlay instead of flat ones (downloads the 3D library on first roll). */
  dice3d: boolean;
  setDice3d: (on: boolean) => void;
  setMeasure: (measure: Partial<MeasurePrefs>) => void;
}

/** Per-browser display preferences. They are kept in this browser only; nothing is sent to the server. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      measure: DEFAULT_MEASURE_PREFS,
      diceOverlay: true,
      setDiceOverlay: (diceOverlay) => set({ diceOverlay }),
      dice3d: true,
      setDice3d: (dice3d) => set({ dice3d }),
      setMeasure: (measure) => set((state) => ({ measure: { ...state.measure, ...measure } })),
    }),
    { name: "openvtt-preferences", version: 1 },
  ),
);
