import type { DrawingKind, DrawingLayer, PingDto } from "@openvtt/shared";
import { create } from "zustand";
import type { MapTool } from "./MapView";

export type TableTab = "chat" | "tokens" | "sheets" | "journal" | "scenes" | "settings";

/** What the game master draws over the map; only the game master receives walls, doors and lights at all. */
export interface MapLayers {
  walls: boolean;
  doors: boolean;
  /** The point where each light sits. */
  lights: boolean;
  /** The disc each light reaches; off by default because maps with baked lighting already show it. */
  lightRange: boolean;
  grid: boolean;
  /** Drawings and note pins on the game master's own layer. */
  gmDrawings: boolean;
  /** The map picture with its background drawings, the object drawings, and the tokens. */
  background: boolean;
  objects: boolean;
  tokens: boolean;
}

export const DEFAULT_LAYERS: MapLayers = {
  walls: true,
  doors: true,
  lights: true,
  lightRange: false,
  grid: true,
  gmDrawings: true,
  background: true,
  objects: true,
  tokens: true,
};
/** What a player sees: the map and the grid, none of the game master's overlays. */
export const PLAYER_LAYERS: MapLayers = {
  walls: false,
  doors: false,
  lights: false,
  lightRange: false,
  grid: true,
  gmDrawings: false,
  background: true,
  objects: true,
  tokens: true,
};

/** What the draw tool places next; `erase` removes the mark under the pointer instead. */
export interface DrawSettings {
  kind: DrawingKind | "erase";
  color: string;
  /** Words for the next text or note pin. */
  text: string;
  layer: DrawingLayer;
}

interface TableUiState {
  tab: TableTab;
  drawerOpen: boolean;
  tool: MapTool;
  /** The token the panels edit: the one clicked last. */
  selectedTokenId: string | null;
  /** Every selected token (always includes `selectedTokenId`); several at once move, turn or go together. */
  selectedTokenIds: string[];
  /** Scene the game master is looking at; null follows the active scene. */
  gmViewSceneId: string | null;
  /** Which overlays the game master sees on the map. */
  layers: MapLayers;
  setLayer: (layer: keyof MapLayers, show: boolean) => void;
  /** Player whose view the game master is previewing; null is the normal game master view. */
  viewAsUserId: string | null;
  setViewAs: (userId: string | null) => void;
  /** Latest request to change the map view; `id` makes a repeated press a new request. */
  viewCommand: { kind: "zoomIn" | "zoomOut" | "fit" | "center"; id: number } | null;
  changeView: (kind: "zoomIn" | "zoomOut" | "fit" | "center") => void;
  /** Latest ping received; `id` makes two pings at the same spot distinct events. */
  ping: (PingDto & { id: number }) | null;
  showPing: (ping: PingDto) => void;
  /** Whether the overview map shows in the corner. */
  minimapOpen: boolean;
  toggleMinimap: () => void;
  draw: DrawSettings;
  setDraw: (draw: Partial<DrawSettings>) => void;
  /** Whether the dice tray is open over the map. */
  diceTrayOpen: boolean;
  setDiceTrayOpen: (open: boolean) => void;
  setTab: (tab: TableTab) => void;
  toggleDrawer: () => void;
  setTool: (tool: MapTool) => void;
  selectToken: (tokenId: string | null) => void;
  /** Adds the token to the selection, or takes it out when it is already there. */
  toggleToken: (tokenId: string) => void;
  selectTokens: (tokenIds: string[]) => void;
  viewScene: (sceneId: string | null) => void;
  /** Back to defaults, called when a table opens so one world never leaks into the next. */
  reset: () => void;
}

const initialState = {
  tab: "chat",
  drawerOpen: true,
  tool: "select",
  selectedTokenId: null,
  selectedTokenIds: [] as string[],
  gmViewSceneId: null,
  layers: DEFAULT_LAYERS,
  viewAsUserId: null,
  viewCommand: null,
  ping: null,
  minimapOpen: true,
  diceTrayOpen: false,
  draw: { kind: "free", color: "#ffc914", text: "", layer: "objects" } as DrawSettings,
} as const;

/** Local UI state of the table. Server state lives in `useWorldState`, REST data in TanStack Query. */
export const useTableUi = create<TableUiState>((set) => ({
  ...initialState,
  setLayer: (layer, show) => set((state) => ({ layers: { ...state.layers, [layer]: show } })),
  setViewAs: (viewAsUserId) => set({ viewAsUserId }),
  changeView: (kind) => set((state) => ({ viewCommand: { kind, id: (state.viewCommand?.id ?? 0) + 1 } })),
  showPing: (ping) => set((state) => ({ ping: { ...ping, id: (state.ping?.id ?? 0) + 1 } })),
  toggleMinimap: () => set((state) => ({ minimapOpen: !state.minimapOpen })),
  setDiceTrayOpen: (diceTrayOpen) => set({ diceTrayOpen }),
  setDraw: (draw) => set((state) => ({ draw: { ...state.draw, ...draw } })),
  setTab: (tab) => set({ tab }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  setTool: (tool) => set({ tool }),
  selectToken: (selectedTokenId) => set({ selectedTokenId, selectedTokenIds: selectedTokenId ? [selectedTokenId] : [] }),
  toggleToken: (tokenId) =>
    set((state) => {
      const selectedTokenIds = state.selectedTokenIds.includes(tokenId)
        ? state.selectedTokenIds.filter((id) => id !== tokenId)
        : [...state.selectedTokenIds, tokenId];
      return { selectedTokenIds, selectedTokenId: selectedTokenIds.at(-1) ?? null };
    }),
  selectTokens: (selectedTokenIds) => set({ selectedTokenIds, selectedTokenId: selectedTokenIds.at(-1) ?? null }),
  viewScene: (gmViewSceneId) => set({ gmViewSceneId }),
  reset: () => set(initialState),
}));
