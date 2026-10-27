import type { ErrorCode, UserDto, WorldSummaryDto } from "@openvtt/shared";

/** Error carrying a server error code (or "network") that maps to `errors.<code>` in translations. */
export class ApiError extends Error {
  constructor(readonly code: ErrorCode | "network") {
    super(code);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: ErrorCode }).error ?? "internal_error");
  return data as T;
}

export const api = {
  me: () => request<UserDto>("GET", "/api/me"),
  register: (username: string, password: string) => request<UserDto>("POST", "/api/auth/register", { username, password }),
  login: (username: string, password: string) => request<UserDto>("POST", "/api/auth/login", { username, password }),
  logout: () => request<unknown>("POST", "/api/auth/logout"),
  setLocale: (locale: string) => request<UserDto>("PATCH", "/api/me", { locale }),
  worlds: () => request<WorldSummaryDto[]>("GET", "/api/worlds"),
  createWorld: (name: string) => request<WorldSummaryDto>("POST", "/api/worlds", { name }),
  createInvite: (worldId: string) => request<{ code: string }>("POST", `/api/worlds/${worldId}/invites`),
  join: (code: string, displayName: string, color: string) =>
    request<WorldSummaryDto>("POST", `/api/invites/${code}/join`, { displayName, color }),
};
