import { create } from "zustand";
import type { MapTool } from "./MapView";

export type TableTab = "chat" | "tokens" | "sheets" | "scenes" | "settings";

interface TableUiState {
  tab: TableTab;
  drawerOpen: boolean;
  tool: MapTool;
  selectedTokenId: string | null;
  /** Scene the game master is looking at; null follows the active scene. */
  gmViewSceneId: string | null;
  /** Whether the game master sees walls, doors and lights drawn on the map. */
  showMapData: boolean;
  setShowMapData: (show: boolean) => void;
  setTab: (tab: TableTab) => void;
  toggleDrawer: () => void;
  setTool: (tool: MapTool) => void;
  selectToken: (tokenId: string | null) => void;
  viewScene: (sceneId: string | null) => void;
  /** Back to defaults, called when a table opens so one world never leaks into the next. */
  reset: () => void;
}

const initialState = {
  tab: "chat",
  drawerOpen: true,
  tool: "select",
  selectedTokenId: null,
  gmViewSceneId: null,
  showMapData: true,
} as const;

/** Local UI state of the table. Server state lives in `useWorldState`, REST data in TanStack Query. */
export const useTableUi = create<TableUiState>((set) => ({
  ...initialState,
  setShowMapData: (showMapData) => set({ showMapData }),
  setTab: (tab) => set({ tab }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  setTool: (tool) => set({ tool }),
  selectToken: (selectedTokenId) => set({ selectedTokenId }),
  viewScene: (gmViewSceneId) => set({ gmViewSceneId }),
  reset: () => set(initialState),
}));
