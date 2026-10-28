import { useQueryClient } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef } from "react";
import { JoinInviteScreen } from "./components/screens/JoinInviteScreen";
import { NotFoundScreen, RouteErrorScreen, WorldUnavailableScreen } from "./components/screens/StateScreens";
import { TableLoading } from "./components/screens/TableLoading";
import { WorldListScreen } from "./components/screens/WorldListScreen";
import { queryKeys, useWorlds } from "./queries";
import { Root, Shell } from "./Root";
import { useUser } from "./userContext";

// The table pulls in PixiJS and motion, so it is its own chunk and never loads on the sign-in screen.
const Table = lazy(() => import("./Table").then((module) => ({ default: module.Table })));

const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFoundScreen });

// Pages with the standard header; the table route sits beside it, outside the shell.
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "shell",
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});

const worldsRoute = createRoute({ getParentRoute: () => shellRoute, path: "/", component: WorldListScreen });

const joinRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/join/$code",
  component: function JoinRoute() {
    return <JoinInviteScreen code={joinRoute.useParams().code} />;
  },
});

const worldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/world/$worldId",
  component: function WorldRoute() {
    const user = useUser();
    const { worldId } = worldRoute.useParams();
    const worlds = useWorlds();
    const queryClient = useQueryClient();
    const isMember = worlds.data?.some((world) => world.id === worldId) ?? false;

    // A cached list can be stale (for example right after joining), so check the server once before giving up.
    const rechecked = useRef(false);
    useEffect(() => {
      if (worlds.isSuccess && !isMember && !rechecked.current) {
        rechecked.current = true;
        void queryClient.invalidateQueries({ queryKey: queryKeys.worlds });
      }
    }, [worlds.isSuccess, isMember, queryClient]);

    if (worlds.isPending || (worlds.isSuccess && !isMember && worlds.isFetching)) return <TableLoading />;
    // If the list itself fails to load, still try the table: the live connection has the final say.
    if (worlds.isSuccess && !isMember) return <WorldUnavailableScreen />;
    return (
      <Suspense fallback={<TableLoading />}>
        <Table worldId={worldId} user={user} />
      </Suspense>
    );
  },
});

const routeTree = rootRoute.addChildren([shellRoute.addChildren([worldsRoute, joinRoute]), worldRoute]);

export const router = createRouter({ routeTree, defaultErrorComponent: ({ reset }) => <RouteErrorScreen reset={reset} /> });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
