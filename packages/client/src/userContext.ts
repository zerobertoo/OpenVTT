import type { UserDto } from "@openvtt/shared";
import { createContext, useContext } from "react";

export const UserContext = createContext<UserDto | null>(null);

/** The signed-in user; only valid below `Root`, which renders routes only once there is one. */
export function useUser(): UserDto {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser called outside a signed-in route");
  return user;
}
