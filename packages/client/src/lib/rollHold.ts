import { create } from "zustand";

interface RollHoldState {
  /** Ids of roll messages whose result must stay hidden because their dice are still in the air. */
  held: ReadonlySet<string>;
  hold: (messageId: string) => void;
  release: (messageId: string) => void;
}

/**
 * The server sends a roll result at once, but it must not show before the dice finish rolling. The dice overlay holds a
 * roll while it animates; the chat reads this to keep that message's result back until the overlay releases it.
 */
export const useRollHold = create<RollHoldState>((set) => ({
  held: new Set(),
  hold: (messageId) => set((state) => ({ held: new Set(state.held).add(messageId) })),
  release: (messageId) =>
    set((state) => {
      if (!state.held.has(messageId)) return state;
      const held = new Set(state.held);
      held.delete(messageId);
      return { held };
    }),
}));
