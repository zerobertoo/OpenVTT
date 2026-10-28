import type { WorldRole } from "@openvtt/shared";
import { useMemo } from "react";
import { type Permissions, permissionsFor } from "./lib/permissions";

/** Permissions of the person at the table, stable between renders so they are safe in dependency lists. */
export function useCan(role: WorldRole | undefined, userId: string): Permissions {
  return useMemo(() => permissionsFor(role, userId), [role, userId]);
}
