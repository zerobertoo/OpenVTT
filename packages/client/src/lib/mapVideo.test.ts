import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", () => ({
  Texture: class {
    destroy = vi.fn();
  },
  VideoSource: class {},
}));
const closeVideo = vi.fn();
const openVideo = vi.fn();
vi.mock("./media", () => ({ openVideo: (url: string) => openVideo(url), closeVideo: (video: unknown) => closeVideo(video) }));

const { disposeVideoBackground, setVideoHidden, startVideoBackground, toggleVideoPlayback } = await import("./mapVideo");

interface FakeVideo {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}
const fakeVideo = (play = vi.fn(async () => undefined)): FakeVideo => ({ play, pause: vi.fn(), addEventListener: vi.fn() });
const asElement = (video: FakeVideo) => video as unknown as HTMLVideoElement;
const reducedMotion = (reduced: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: reduced }));

const onUi = vi.fn();
/** Starts a background that stays the current one, as the map view does until another replaces it. */
const start = (assetId = "a1") => {
  const holder: { current: Awaited<ReturnType<typeof startVideoBackground>> | null } = { current: null };
  const background = startVideoBackground(assetId, (b) => holder.current === b, onUi);
  holder.current = background;
  return background;
};

beforeEach(() => {
  onUi.mockClear();
  closeVideo.mockClear();
  openVideo.mockReset();
  reducedMotion(false);
});

describe("startVideoBackground", () => {
  it("starts playing once loaded and tells the interface it is ready and playing", async () => {
    const video = fakeVideo();
    openVideo.mockResolvedValue(video);
    const background = start();
    expect(background.wantPlaying).toBe(true);
    const loaded = await background.ready;
    expect(openVideo).toHaveBeenCalledWith("/api/assets/a1");
    expect(loaded?.element).toBe(video);
    expect(video.play).toHaveBeenCalled();
    expect(onUi).toHaveBeenLastCalledWith({ status: "ready", playing: true });
  });

  it("stays paused for a person who prefers reduced motion", async () => {
    reducedMotion(true);
    const video = fakeVideo();
    openVideo.mockResolvedValue(video);
    const background = start();
    await background.ready;
    expect(background.wantPlaying).toBe(false);
    expect(video.play).not.toHaveBeenCalled();
    expect(onUi).toHaveBeenLastCalledWith({ status: "ready", playing: false });
  });

  it("falls back to paused when the browser refuses to autoplay", async () => {
    const video = fakeVideo(vi.fn(async () => Promise.reject(new Error("blocked"))));
    openVideo.mockResolvedValue(video);
    const background = start();
    await background.ready;
    expect(background.wantPlaying).toBe(false);
    expect(onUi).toHaveBeenLastCalledWith({ status: "ready", playing: false });
  });

  it("drops a file that finished loading after another background took over", async () => {
    const video = fakeVideo();
    openVideo.mockResolvedValue(video);
    const background = startVideoBackground("a1", () => false, onUi);
    await expect(background.ready).resolves.toBeNull();
    expect(closeVideo).toHaveBeenCalledWith(video);
    expect(onUi).not.toHaveBeenCalled();
  });

  it("reports an unsupported file only while it is still the current background", async () => {
    openVideo.mockRejectedValue(new Error("unsupported"));
    const background = start();
    await expect(background.ready).resolves.toBeNull();
    expect(onUi).toHaveBeenCalledWith({ status: "unsupported", playing: false });

    onUi.mockClear();
    const stale = startVideoBackground("a2", () => false, onUi);
    await stale.ready;
    expect(onUi).not.toHaveBeenCalled();
  });

  it("reports a decode failure after the first frame", async () => {
    const video = fakeVideo();
    openVideo.mockResolvedValue(video);
    await start().ready;
    const [event, listener] = video.addEventListener.mock.calls[0]!;
    expect(event).toBe("error");
    listener();
    expect(onUi).toHaveBeenLastCalledWith({ status: "unsupported", playing: false });
  });
});

describe("disposeVideoBackground", () => {
  it("clears the interface and frees the texture once it has loaded", async () => {
    openVideo.mockResolvedValue(fakeVideo());
    const background = start();
    const loaded = await background.ready;
    disposeVideoBackground(background, onUi);
    expect(onUi).toHaveBeenLastCalledWith({ status: "none", playing: false });
    await Promise.resolve();
    expect(loaded?.texture.destroy).toHaveBeenCalledWith(true);
  });
});

describe("toggleVideoPlayback", () => {
  it("pauses a playing video and resumes a paused one", async () => {
    const video = fakeVideo();
    openVideo.mockResolvedValue(video);
    const background = start();
    await background.ready;
    toggleVideoPlayback(background, onUi);
    expect(video.pause).toHaveBeenCalled();
    expect(background.wantPlaying).toBe(false);
    expect(onUi).toHaveBeenLastCalledWith({ status: "ready", playing: false });
    toggleVideoPlayback(background, onUi);
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(background.wantPlaying).toBe(true);
    expect(onUi).toHaveBeenLastCalledWith({ status: "ready", playing: true });
  });

  it("goes back to paused when playing is refused", async () => {
    const video = fakeVideo();
    openVideo.mockResolvedValue(video);
    const background = start();
    await background.ready;
    toggleVideoPlayback(background, onUi);
    video.play.mockRejectedValueOnce(new Error("blocked"));
    toggleVideoPlayback(background, onUi);
    await Promise.resolve();
    await Promise.resolve();
    expect(background.wantPlaying).toBe(false);
    expect(onUi).toHaveBeenLastCalledWith({ status: "ready", playing: false });
  });

  it("does nothing before the video has loaded", () => {
    openVideo.mockReturnValue(new Promise(() => undefined));
    const background = start();
    toggleVideoPlayback(background, onUi);
    expect(onUi).not.toHaveBeenCalled();
  });
});

describe("setVideoHidden", () => {
  it("pauses while the tab is hidden and resumes only if the person wanted it playing", async () => {
    const video = fakeVideo();
    openVideo.mockResolvedValue(video);
    const background = start();
    await background.ready;
    setVideoHidden(background, true);
    expect(video.pause).toHaveBeenCalled();
    setVideoHidden(background, false);
    expect(video.play).toHaveBeenCalledTimes(2);

    background.wantPlaying = false;
    video.play.mockClear();
    setVideoHidden(background, false);
    expect(video.play).not.toHaveBeenCalled();
  });

  it("ignores a missing or unloaded background", () => {
    expect(() => setVideoHidden(null, true)).not.toThrow();
  });
});
