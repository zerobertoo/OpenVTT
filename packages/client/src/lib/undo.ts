import { create } from "zustand";
import { toastActionFailure } from "./actionFailure";

/** One reversible change; both directions talk to the server, which stays the source of truth. */
export interface UndoEntry {
  undo: () => Promise<unknown>;
  redo: () => Promise<unknown>;
}

const LIMIT = 100;

interface UndoState {
  past: UndoEntry[];
  future: UndoEntry[];
  /** Returns what takes the step back out of the history, for a change the server ends up refusing. */
  record: (entry: UndoEntry) => () => void;
  /** Resolves to false when there was nothing to undo. */
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  clear: () => void;
}

/** The game master's undo history for this table, kept in memory only. */
export const useUndo = create<UndoState>((set, get) => ({
  past: [],
  future: [],
  record: (entry) => {
    set((s) => ({ past: [...s.past, entry].slice(-LIMIT), future: [] }));
    return () => set((s) => ({ past: s.past.filter((e) => e !== entry), future: s.future.filter((e) => e !== entry) }));
  },
  undo: async () => {
    const entry = get().past.at(-1);
    if (!entry) return false;
    set((s) => ({ past: s.past.slice(0, -1), future: [...s.future, entry] }));
    await entry.undo().catch(toastActionFailure);
    return true;
  },
  redo: async () => {
    const entry = get().future.at(-1);
    if (!entry) return false;
    set((s) => ({ future: s.future.slice(0, -1), past: [...s.past, entry] }));
    await entry.redo().catch(toastActionFailure);
    return true;
  },
  clear: () => set({ past: [], future: [] }),
}));
