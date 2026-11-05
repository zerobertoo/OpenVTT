import { Texture, VideoSource } from "pixi.js";
import { assetUrl } from "../api";
import { closeVideo, openVideo } from "./media";

/** An animated map background. Only one lives at a time; it is rebuilt only when the scene's asset changes. */
export interface VideoBackground {
  assetId: string;
  /** What the person asked for; the element itself also pauses while the tab is hidden. */
  wantPlaying: boolean;
  loaded: { element: HTMLVideoElement; texture: Texture } | null;
  /** Resolves to null when the browser cannot play the file. */
  ready: Promise<{ element: HTMLVideoElement; texture: Texture } | null>;
}

/** What the interface shows about the background video: whether there is one, and whether it plays. */
export interface VideoUi {
  status: "none" | "ready" | "unsupported";
  playing: boolean;
}

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Starts loading an animated background; it plays at once unless the person prefers reduced motion. `isCurrent` says
 * whether the map still wants this background, so a file that arrives late is dropped without ever being shown.
 */
export function startVideoBackground(
  assetId: string,
  isCurrent: (background: VideoBackground) => boolean,
  onUi: (ui: VideoUi) => void,
): VideoBackground {
  const background: VideoBackground = { assetId, wantPlaying: !prefersReducedMotion(), loaded: null, ready: Promise.resolve(null) };
  background.ready = openVideo(assetUrl(assetId)).then(
    async (element) => {
      if (!isCurrent(background)) {
        closeVideo(element);
        return null;
      }
      const texture = new Texture({ source: new VideoSource({ resource: element, autoPlay: false }) });
      background.loaded = { element, texture };
      if (background.wantPlaying)
        await element.play().catch(() => {
          background.wantPlaying = false;
        });
      // A decode failure after the first frame (corrupt file, lost connection) ends the animation cleanly.
      element.addEventListener("error", () => onUi({ status: "unsupported", playing: false }));
      onUi({ status: "ready", playing: background.wantPlaying });
      return background.loaded;
    },
    () => {
      if (isCurrent(background)) onUi({ status: "unsupported", playing: false });
      return null;
    },
  );
  return background;
}

/** Clears the interface and frees the video's texture as soon as it exists. */
export function disposeVideoBackground(background: VideoBackground, onUi: (ui: VideoUi) => void) {
  onUi({ status: "none", playing: false });
  void background.ready.then((loaded) => loaded?.texture.destroy(true));
}

/** The play/pause button: flips what the person wants, and goes back to paused if the browser refuses to play. */
export function toggleVideoPlayback(background: VideoBackground, onUi: (ui: VideoUi) => void) {
  if (!background.loaded) return;
  background.wantPlaying = !background.wantPlaying;
  if (background.wantPlaying) {
    void background.loaded.element.play().catch(() => {
      background.wantPlaying = false;
      onUi({ status: "ready", playing: false });
    });
  } else background.loaded.element.pause();
  onUi({ status: "ready", playing: background.wantPlaying });
}

/** A hidden tab has nobody to watch the video, so it stops decoding until the tab is shown again (if it was playing). */
export function setVideoHidden(background: VideoBackground | null | undefined, hidden: boolean) {
  if (!background?.loaded) return;
  if (hidden) background.loaded.element.pause();
  else if (background.wantPlaying) void background.loaded.element.play().catch(() => undefined);
}
