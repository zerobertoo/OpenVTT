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
  sessionExpired: ["session", "expired"] as const,
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
        if (error instanceof ApiError && error.code === "unauthenticated") {
          // Someone was signed in a moment ago: the session ended, they did not choose to leave.
          if (queryClient.getQueryData(queryKeys.me)) queryClient.setQueryData(queryKeys.sessionExpired, true);
          return null;
        }
        throw error;
      }),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useWorlds = () => useQuery({ queryKey: queryKeys.worlds, queryFn: api.worlds });

export const useSystems = () => useQuery({ queryKey: queryKeys.systems, queryFn: api.systems });

export const useWorldSystem = (worldId: string) =>
  useQuery({ queryKey: queryKeys.worldSystem(worldId), queryFn: () => api.worldSystem(worldId) });

/** True once a session that was working stopped being valid (expired or revoked), so sign-in can say why. */
export const useSessionExpired = () =>
  useQuery({ queryKey: queryKeys.sessionExpired, queryFn: () => false, staleTime: Number.POSITIVE_INFINITY, initialData: false }).data;
