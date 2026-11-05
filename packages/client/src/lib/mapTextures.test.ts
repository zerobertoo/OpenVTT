import { beforeEach, describe, expect, it, vi } from "vitest";

const destroyed: string[] = [];
vi.mock("pixi.js", () => ({
  Texture: {
    from: (source: { label: string }) => ({ label: source.label, destroy: () => destroyed.push(source.label) }),
  },
}));
const closeVideo = vi.fn();
const openVideo = vi.fn(async (url: string) => ({ label: `video ${url}` }));
vi.mock("./media", () => ({ openVideo: (url: string) => openVideo(url), closeVideo: (video: unknown) => closeVideo(video) }));

const { loadTexture } = await import("./mapTextures");

const fetchMock = vi.fn();
let counter = 0;
/** Ids differ per test because decoded textures are cached for the life of the page. */
const freshId = () => `asset-${++counter}`;
const none = () => new Set<string>();

beforeEach(() => {
  destroyed.length = 0;
  closeVideo.mockClear();
  openVideo.mockClear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ({ ok: true, blob: async () => ({ label: url }) }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("createImageBitmap", async (source: { label: string }) => ({ label: source.label }));
});

describe("loadTexture", () => {
  it("decodes an image once and hands the same texture to every later caller", async () => {
    const id = freshId();
    const [a, b] = await Promise.all([loadTexture(id, none), loadTexture(id, none)]);
    expect(a).toBe(b);
    await loadTexture(id, none);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/assets/${id}`);
  });

  it("does not keep a failed load, so the picture can be retried", async () => {
    const id = freshId();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(loadTexture(id, none)).rejects.toThrow(`asset ${id}: 404`);
    await expect(loadTexture(id, none)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reduces a video to its first frame and releases the decoder at once", async () => {
    const id = freshId();
    const texture = (await loadTexture(id, none, true)) as unknown as { label: string };
    expect(openVideo).toHaveBeenCalledWith(`/api/assets/${id}`);
    expect(closeVideo).toHaveBeenCalledWith({ label: `video /api/assets/${id}` });
    expect(texture.label).toBe(`video /api/assets/${id}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("releases the least recently used textures that are not on screen once too many are cached", async () => {
    const ids = Array.from({ length: 120 }, freshId);
    const kept = ids[0]!;
    for (const id of ids) await loadTexture(id, () => new Set([kept]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(destroyed.length).toBeGreaterThan(0);
    // The oldest one is still on screen, so it is never the one released.
    expect(destroyed).not.toContain(`/api/assets/${kept}`);
    expect(destroyed).toContain(`/api/assets/${ids[1]}`);
  });
});
