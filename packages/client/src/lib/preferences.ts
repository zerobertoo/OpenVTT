import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DiagonalRule, RulerShape } from "./ruler";
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
  /** What the ruler draws and how it counts diagonals on a square grid. */
  rulerShape: RulerShape;
  setRulerShape: (shape: RulerShape) => void;
  diagonalRule: DiagonalRule;
  setDiagonalRule: (rule: DiagonalRule) => void;
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
      rulerShape: "line",
      setRulerShape: (rulerShape) => set({ rulerShape }),
      diagonalRule: "exact",
      setDiagonalRule: (diagonalRule) => set({ diagonalRule }),
    }),
    {
      name: "openvtt-preferences",
      version: 2,
      // Version 1 kept distances "as the scene says" by default; metric is the default now.
      migrate: (stored) => {
        const old = stored as Partial<PreferencesState>;
        return {
          ...old,
          measure: {
            ...DEFAULT_MEASURE_PREFS,
            ...old.measure,
            system: old.measure?.system === "scene" ? "metric" : (old.measure?.system ?? "metric"),
          },
        };
      },
    },
  ),
);
