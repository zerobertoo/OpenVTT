import { QueryClient, useQuery } from "@tanstack/react-query";
import { ApiError, api } from "./api";

/** Errors the user can fix (bad input, no access) are not worth retrying; only network and server failures are. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        failureCount < 2 && (!(error instanceof ApiError) || error.code === "network" || error.code === "internal_error"),
    },
  },
});

export const queryKeys = {
  me: ["me"] as const,
  worlds: ["worlds"] as const,
  systems: ["systems"] as const,
  worldSystem: (worldId: string) => ["worlds", worldId, "system"] as const,
};

/** The signed-in user, or `null` when there is no session. */
export const useMe = () =>
  useQuery({
    queryKey: queryKeys.me,
    queryFn: () =>
      api.me().catch((error) => {
        if (error instanceof ApiError && error.code === "unauthenticated") return null;
        throw error;
      }),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useWorlds = () => useQuery({ queryKey: queryKeys.worlds, queryFn: api.worlds });

export const useSystems = () => useQuery({ queryKey: queryKeys.systems, queryFn: api.systems });

export const useWorldSystem = (worldId: string) =>
  useQuery({ queryKey: queryKeys.worldSystem(worldId), queryFn: () => api.worldSystem(worldId) });
