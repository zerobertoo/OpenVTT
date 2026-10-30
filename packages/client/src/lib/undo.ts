import { create } from "zustand";

/** One reversible change; both directions talk to the server, which stays the source of truth. */
export interface UndoEntry {
  undo: () => Promise<unknown>;
  redo: () => Promise<unknown>;
}

const LIMIT = 100;

interface UndoState {
  past: UndoEntry[];
  future: UndoEntry[];
  record: (entry: UndoEntry) => void;
  /** Resolves to false when there was nothing to undo. */
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  clear: () => void;
}

/** The game master's undo history for this table, kept in memory only. */
export const useUndo = create<UndoState>((set, get) => ({
  past: [],
  future: [],
  record: (entry) => set((s) => ({ past: [...s.past, entry].slice(-LIMIT), future: [] })),
  undo: async () => {
    const entry = get().past.at(-1);
    if (!entry) return false;
    set((s) => ({ past: s.past.slice(0, -1), future: [...s.future, entry] }));
    await entry.undo().catch(() => undefined);
    return true;
  },
  redo: async () => {
    const entry = get().future.at(-1);
    if (!entry) return false;
    set((s) => ({ future: s.future.slice(0, -1), past: [...s.past, entry] }));
    await entry.redo().catch(() => undefined);
    return true;
  },
  clear: () => set({ past: [], future: [] }),
}));
