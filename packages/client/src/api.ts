import type { SystemManifest } from "@openvtt/sdk";
import type { ActorDto, ErrorCode, MessageDto, SceneDto, SystemInfoDto, TokenDto, UserDto, WorldSummaryDto } from "@openvtt/shared";

/** Error carrying a server error code (or "network") that maps to `errors.<code>` in translations. */
export class ApiError extends Error {
  constructor(readonly code: ErrorCode | "network") {
    super(code);
  }
}

async function request<T>(method: string, url: string, body?: unknown, contentType = "application/json"): Promise<T> {
  let res: Response;
  const raw = body instanceof Blob;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": raw ? (body as Blob).type || contentType : contentType },
      body: body === undefined ? undefined : raw ? (body as Blob) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: ErrorCode }).error ?? "internal_error");
  return data as T;
}

const get = <T>(url: string) => request<T>("GET", url);
const post = <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {});
const patch = <T>(url: string, body: unknown) => request<T>("PATCH", url, body);
const del = <T = unknown>(url: string) => request<T>("DELETE", url);

/** Reads the pixel size of an image file; the server trusts it only within fixed bounds. */
export function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  return createImageBitmap(file).then((bitmap) => {
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  });
}

export const assetUrl = (assetId: string) => `/api/assets/${assetId}`;

export const api = {
  me: () => get<UserDto>("/api/me"),
  register: (username: string, password: string) => post<UserDto>("/api/auth/register", { username, password }),
  login: (username: string, password: string) => post<UserDto>("/api/auth/login", { username, password }),
  logout: () => post("/api/auth/logout"),
  setLocale: (locale: string) => patch<UserDto>("/api/me", { locale }),
  systems: () => get<SystemManifest[]>("/api/systems"),
  installSystem: (zip: Blob) => request<SystemManifest>("POST", "/api/admin/systems", zip, "application/zip"),

  worlds: () => get<WorldSummaryDto[]>("/api/worlds"),
  createWorld: (name: string, systemId: string) => post<WorldSummaryDto>("/api/worlds", { name, systemId }),
  updateWorld: (worldId: string, body: object) => patch(`/api/worlds/${worldId}`, body),
  worldSystem: (worldId: string) => get<SystemInfoDto>(`/api/worlds/${worldId}/system`),
  createInvite: (worldId: string) => post<{ code: string }>(`/api/worlds/${worldId}/invites`),
  join: (code: string, displayName: string, color: string) => post<WorldSummaryDto>(`/api/invites/${code}/join`, { displayName, color }),
  exportUrl: (worldId: string) => `/api/worlds/${worldId}/export`,
  importWorld: (zip: Blob) => request<WorldSummaryDto>("POST", "/api/worlds/import", zip, "application/zip"),

  uploadAsset: (worldId: string, file: Blob) => request<{ id: string }>("POST", `/api/worlds/${worldId}/assets`, file),
  createScene: (worldId: string, body: object) => post<SceneDto>(`/api/worlds/${worldId}/scenes`, body),
  updateScene: (sceneId: string, body: object) => patch<SceneDto>(`/api/scenes/${sceneId}`, body),
  deleteScene: (sceneId: string) => del(`/api/scenes/${sceneId}`),

  createToken: (worldId: string, body: object) => post<TokenDto>(`/api/worlds/${worldId}/tokens`, body),
  updateToken: (tokenId: string, body: object) => patch<TokenDto>(`/api/tokens/${tokenId}`, body),
  deleteToken: (tokenId: string) => del(`/api/tokens/${tokenId}`),

  sendMessage: (worldId: string, body: { content: string; toUserId: string | null; gmOnly: boolean }) =>
    post<MessageDto>(`/api/worlds/${worldId}/messages`, body),

  createActor: (worldId: string, name: string, type: string) => post<ActorDto>(`/api/worlds/${worldId}/actors`, { name, type }),
  updateActor: (actorId: string, body: object) => patch<ActorDto>(`/api/actors/${actorId}`, body),
  deleteActor: (actorId: string) => del(`/api/actors/${actorId}`),
};
