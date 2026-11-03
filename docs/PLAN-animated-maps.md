# Plan: animated maps (`.webm` / `.mp4` scene backgrounds)

Local planning note (not committed). Everything stays inside the server process and the data directory: files on disk, SQLite rows, no external service.

## What exists today (relevant bits)

- `assets.ts`: `save(worldId, Buffer)` writes `<dataDir>/.../<uuid>.<ext>` and an `assets` row (`mime`, `size`, `file_name`). Signature check in `detectImageType`. Whole file in memory, limit `MAX_UPLOAD_BYTES` (15 MB).
- `app.ts`: Fastify content-type parser with `parseAs: "buffer"` for the 3 image types. `GET /api/assets/:id` reads the whole file and sends it (no Range, no ETag).
- `portability.ts`: export = `zipSync` of every asset in memory; import = `unzipSync` of the whole body (cap 256 MB).
- `MapView.tsx`: `loadTexture` (fetch -> ImageBitmap -> `Texture.from`), background is a `Sprite`. `ScenePanel` reads image size with `createImageBitmap` and uploads before creating the scene.
- `SceneDto` has only `assetId`; the client cannot tell image from video.
- `compose.yaml` and `Dockerfile` already exist (single image, volume `/data`). README mentions `docker-compose.yml` by mistake. `.github/workflows/ci.yml` already runs lint, i18n, typecheck, test, build, bundle, e2e and docker build.

## Steps (one commit each, all checks green before each)

### 1. Server: video asset type, signature check, streamed upload

- `shared`: `ALLOWED_VIDEO_TYPES = ["video/webm", "video/mp4"]`, `DEFAULT_MAX_VIDEO_BYTES = 100 MiB`, new error code `asset_too_large` (HTTP 413) with an `errors.*` translation.
- `assets.ts`: `detectVideoType(head: Buffer)` on the first 4 KB:
  - WebM: EBML magic `1A 45 DF A3` and DocType `webm` (Matroska `.mkv` is rejected).
  - MP4: `ftyp` at offset 4 with a brand allow-list (`isom`, `iso2`, `mp41`, `mp42`, `avc1`, `M4V `); HEIC/AVIF/3GP brands are rejected.
- `AssetService.saveStream(worldId, stream, { maxBytes })`: writes to `<uuid>.part` through a counting Transform, checks the signature on the first chunk(s), aborts and deletes the partial file on oversize, bad type or client abort, then renames and inserts the row. The existing buffered `save` stays for images (small, already limited).
- `app.ts`: stream parser for `video/webm` and `video/mp4` that hands the raw stream to the handler (no buffering); early 413 from `Content-Length`; Fastify `requestTimeout` raised so a 100 MB upload on a slow link is not cut.
- Limit: `OPENVTT_MAX_VIDEO_BYTES` (default 100 MiB), read in `main.ts`, passed through `AppOptions`.
- Tests: valid webm and mp4 stored on disk; PNG sent as `video/webm` rejected; oversize rejected and no leftover file; truncated/aborted upload leaves nothing; non-GM forbidden.

### 2. Server: serving with Range, ETag, immutable cache

- `GET /api/assets/:id` streams with `createReadStream`; supports `Range: bytes=a-b`, `a-`, `-n` (206 + `Content-Range`), 416 on invalid ranges, `Accept-Ranges: bytes`.
- `ETag: "<assetId>"` (the id never changes its bytes), `If-None-Match` -> 304. `Cache-Control: private, max-age=31536000, immutable` (stays `private`: auth cookie required). Same path serves images, so they gain ETag/304 for free.
- Tests: 200 full, 206 partial, suffix range, 416, 304, cross-world still 404.

### 3. Server: export/import in stream

- Export: `fflate` streaming `Zip` + `ZipPassThrough` (assets are already compressed, stored as-is) piped from `createReadStream` into the reply stream; `world.json` written first and deflated. No asset ever fully in memory.
- Import: request body streamed into fflate `Unzip`; `world.json` collected in memory (capped, 16 MiB), each `assets/*` entry streamed to a temp file under `<dataDir>/import-<uuid>/` (never named after the entry). Counted on decompressed bytes as they arrive (not the zip's declared sizes), per-asset cap by type, total cap `MAX_IMPORT_BYTES` (1 GiB). Signature re-checked on the temp file; refs validated as today; inside the DB transaction assets are adopted by rename; the temp dir is removed on every exit path.
- `portability.ts` accepts any entry order. `docs/world-file-format.md`: video assets and `assetKind` on scenes (format version stays 1, importers ignore unknown fields).
- Tests: round trip with an image and a video (bytes identical), zip bomb rejected, entry with path traversal name ignored, no temp dir left after failure.

### 4. Client: video background

- `SceneDto.assetKind: "image" | "video" | null` (SceneService joins `assets.mime`); `MapView` picks the loader from it.
- Scene creation: the file input accepts `.webm`/`.mp4`; `readMediaSize` reads `videoWidth`/`videoHeight` through a hidden `<video>` on an object URL. `canPlayType` plus a failed `loadedmetadata` show a clear message (new `scene.videoUnsupported`) before uploading anything.
- Texture: `HTMLVideoElement` with `muted`, `loop`, `playsInline`, `preload="auto"`, `src=assetUrl(id)` -> Pixi v8 `Texture.from(video)` (`VideoSource`, auto update). Element and texture are destroyed when the scene changes or `MapView` unmounts.
- Playback rules: autoplay only when `prefers-reduced-motion` is not set; otherwise starts paused. A play/pause toggle on the map (video scenes only; real `<button>`, focus ring, translated label, 4.5:1 in both themes). Pause on `visibilitychange` hidden; resume on visible only if the user had not paused.
- Runtime decode error on the element -> inline notice over the map ("this browser can't play this video format") instead of a blank map.
- Texture cache: videos are not cached across scenes (one live element at a time).
- i18n keys in `pt-BR` and `en`; `check:i18n` must pass.

### 5. Tests, fixture, docs, infra

- Fixture `e2e/fixtures/map-loop.webm` (VP9, ~2 s, 128x96, <40 KB, made with ffmpeg once and committed). Playwright Chromium lacks H.264, so the browser test uses WebM; MP4 is covered at the server level and documented as the most compatible format for real browsers.
- e2e: create a scene from the video (size read from the file), map shows the toggle, toggle pauses/plays, reduced-motion emulation starts paused; unsupported file (renamed text file) shows the message. Visual baseline untouched.
- README: env var table (`OPENVTT_MAX_VIDEO_BYTES`), codec guidance (WebM/VP9 widely supported; MP4/H.264 most compatible; avoid HEVC/AV1 for players on older devices), reverse-proxy note (`client_max_body_size`, buffering off, long timeouts), and fix `docker-compose.yml` -> `compose.yaml`.
- `compose.yaml`: commented `environment:` block with `OPENVTT_MAX_VIDEO_BYTES`. `Dockerfile`: no change needed (assets live under the `/data` volume).
- ROADMAP: mark animated maps done.

## Decisions taken without asking (tell me if you disagree)

- New `asset_too_large` error code instead of reusing `asset_invalid`, so the UI can say "too big" rather than "invalid file".
- `assetKind` on `SceneDto` rather than an extra request per scene to learn the type.
- Play/pause toggle is shown for every video scene, not only under reduced motion.
- No per-world storage quota in this item (disk usage is the host's concern); can be a later item.
- Client does not pre-check the video size limit (the server owns it); a clean 413 message is shown after the attempt.

## Risks

- fflate streaming `Unzip` needs careful backpressure on large entries; covered by the round-trip test with a multi-MB video.
- Safari plays MP4/H.264 and WebM/VP9 only on recent versions; documented, not worked around.
