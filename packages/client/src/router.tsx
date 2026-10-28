import { createRootRoute, createRoute, createRouter, Navigate, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { JoinInvite, useUser, WorldList } from "./App";
import { TableLoading } from "./components/screens/TableLoading";
import { Root, Shell } from "./Root";

// The table pulls in PixiJS and motion, so it is its own chunk and never loads on the sign-in screen.
const Table = lazy(() => import("./Table").then((module) => ({ default: module.Table })));

const rootRoute = createRootRoute({ component: Root, notFoundComponent: () => <Navigate to="/" /> });

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

const worldsRoute = createRoute({ getParentRoute: () => shellRoute, path: "/", component: WorldList });

const joinRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/join/$code",
  component: function JoinRoute() {
    return <JoinInvite code={joinRoute.useParams().code} />;
  },
});

const worldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/world/$worldId",
  component: function WorldRoute() {
    const user = useUser();
    return (
      <Suspense fallback={<TableLoading />}>
        <Table worldId={worldRoute.useParams().worldId} user={user} />
      </Suspense>
    );
  },
});

const routeTree = rootRoute.addChildren([shellRoute.addChildren([worldsRoute, joinRoute]), worldRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
