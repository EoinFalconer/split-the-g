# Spec: live G-detection in the viewfinder

## Goal

Make the kiosk feel alive: as you raise your pint to the camera, a box locks onto the G,
a marker tracks the beer line in real time, and the kiosk auto-captures the moment you
hold steady — no shutter button, instant feedback. This is the part of the original
splittheg.app experience we don't have, and the part a vision LLM can't do (it judges
photos in seconds; live tracking needs ~15+ fps on-device).

## Architecture: hybrid, not replacement

Three layers. Only the first is new.

| Layer | Runs | Job |
|---|---|---|
| **1. Detector** (new) | In the browser, every frame | Find the `G_logo` (and optionally `glass`) bounding box. Tiny fine-tuned YOLO exported to TF.js/ONNX, WebGPU-accelerated. |
| **2. Line finder** (new) | In the browser, per frame | No ML needed. Inside/below the logo box, the stout→foam boundary is the strongest horizontal luminance edge in the frame. A gradient scan down the crop gives the exact line y-position. |
| **3. Judge** (unchanged) | Sanity Function + Claude | Full-pint verification (the detector can't tell "full and unsipped"), the official verdict, and the banter. |

From layers 1+2 we get a **deterministic geometric score**: the line's distance from the
G's vertical centre, normalised by the G's height. That means a live score needle in the
viewfinder, a replayable overlay on the captured photo ("here is exactly where your line
landed"), and no more LLM score wobble — the things we listed as cons of the pure-LLM
approach.

**v1 ruling:** the local score is *provisional* (shown live, recorded on the attempt);
Claude's verdict remains official and writes the banter. Once the model proves itself on
real glasses in real lighting, flip a flag and the geometric score becomes official —
Claude drops back to full-pint checks and commentary.

Why keep Claude at all: the full-pint check is open-ended ("is this a full, unsipped
pint, not a photo of a photo?") and would need far more training data than the logo
detector; the banter is half the entertainment; and the LLM is the fallback when the
detector loses the logo in bad light — the manual shutter still works and the photo
still gets judged.

## The training-data problem (nobody drinks 20 pints)

1. **Seed with the public dataset.** [FindTheG on Roboflow Universe](https://universe.roboflow.com/guinness-time/findtheg)
   — 105 images, CC BY 4.0, already labeled with `G_logo` and `foam_line`. Import it as
   the starting point. There's also a smaller
   [Guinness Cheers](https://universe.roboflow.com/antigravity-4iuss/guinness-cheers-ppwah) set.
2. **One home shoot.** A single pint in the actual wedding glasses: photograph it from
   kiosk distance/angle at every level (someone takes a sip between shots — one pint,
   shared, yields 20+ images; Guinness 0.0 looks identical on camera).
3. **One pub session.** Photograph friends' pints across a round or two — every table is
   a data farm. 100–200 candid pint photos in an evening.
4. **Augment.** Roboflow free tier: brightness/exposure/blur/rotation augmentation
   triples the set. Target ~300–500 images total — plenty for a one-class logo detector,
   which is about the easiest object-detection task there is (high-contrast printed logo
   on a known object).

Labeling: Roboflow's free annotation UI, one box per image, ~2 hours of podcast time.

## Training & export

- **Model:** YOLO11n (Ultralytics) fine-tune, single class `g_logo` (optionally `glass`).
  Free Colab GPU, 30–60 minutes.
- **Export:** ONNX → run with `onnxruntime-web` (WebGPU, wasm fallback), or TF.js export
  if we prefer the TensorFlow toolchain end-to-end. At 320–416 px input a nano model
  runs 15–30 fps on a recent iPad.
- **Eval that matters:** not mAP — one evening with the venue's glasses in venue-like
  lighting. If it locks onto the G across the bar's lighting, ship it.

## Kiosk integration (web/)

- `src/lib/detector.ts` — loads the model once, exposes `detect(videoFrame) → {gBox, lineY, score} | null`.
- `Camera.tsx` grows an overlay canvas: gold box on the G, cream line marker, live score
  needle. Shutter button stays as fallback.
- **Auto-capture:** when the G is locked and the line is stable for ~1.5 s, count down
  3-2-1 on screen and snap. (Stability gate stops mid-sip captures.)
- Feature flag (`NEXT_PUBLIC_LIVE_DETECTOR=1`) so the LLM-only flow keeps working while
  this is in progress.
- Attempt documents gain `localScore` and `lineGeometry` fields next to the existing
  verdicts — Sanity schema is additive, nothing breaks.

## Effort estimate

| Step | Time |
|---|---|
| Import public dataset + home shoot + pub session | 1 evening + 1 evening |
| Labeling + augmentation | ~2 h |
| Training + export + eval loop | ~half a day |
| Browser integration (detector, overlay, auto-capture) | 1–2 days |
| Venue dress rehearsal | the tasting you were doing anyway |

## Risks

- **Curved-glass reflections / pub lighting** — the classic failure mode. Mitigated by
  pub-session photos in the training set and the manual-shutter + LLM fallback.
- **iPad performance** — nano model at 320 px is comfortably real-time; if not, drop to
  detection every 3rd frame and interpolate the overlay.
- **Two sources of truth** — provisional local score vs official Claude verdict can
  disagree. v1 displays the live score as "unofficial" until the flag flips; the
  leaderboard only ever reads one field.
