/** Thrown when the browser cannot decode a map video (unsupported container or codec, or a broken file). */
export class UnsupportedMediaError extends Error {
  constructor() {
    super("unsupported media");
  }
}

/**
 * Opens a video as a silent, looping, inline element and resolves once its first frame is decodable.
 * Rejects with `UnsupportedMediaError` when the browser cannot play it. The caller owns the element
 * and must call `closeVideo` when done.
 */
export function openVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    const fail = () => {
      closeVideo(video);
      reject(new UnsupportedMediaError());
    };
    video.addEventListener("error", fail, { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        video.removeEventListener("error", fail);
        // A file some players open but that carries no picture (audio only) has no size to use.
        if (video.videoWidth > 0 && video.videoHeight > 0) resolve(video);
        else fail();
      },
      { once: true },
    );
    video.src = url;
    video.load();
  });
}

/** Stops a video and releases its decoder and network connection. */
export function closeVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

/** Pixel size of an image or video file; the server trusts it only within fixed bounds. */
export async function readMediaSize(file: Blob): Promise<{ width: number; height: number }> {
  if (file.type.startsWith("video/")) {
    const url = URL.createObjectURL(file);
    try {
      const video = await openVideo(url);
      const size = { width: video.videoWidth, height: video.videoHeight };
      closeVideo(video);
      return size;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
