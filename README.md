# SwasthyaScore AI

SwasthyaScore AI is a mobile-first bilingual PWA for AI-guided NCD risk screening in Bharat.

Tagline: Your personal AI NCD detector.

It helps families, field workers, NGOs, clinics, and community healthcare teams screen obesity risk, diabetes risk, waist risk, blood pressure flags, and basic visible health concerns in a fast mobile flow. The main dashboard is the product home screen; there is no separate marketing landing page.

## Medical Disclaimer

- This app is for screening and risk awareness only.
- It does not diagnose diabetes, hypertension, obesity, or any other disease.
- It does not prescribe medicines, dosages, or treatment changes.
- Abnormal values need confirmation by a qualified doctor or diagnostic lab.
- Very high BP, severe symptoms, or very high sugar values may require urgent medical care.
- Blood pressure diagnosis requires repeated properly measured readings.

## What It Does

- AI-first mobile dashboard with English/Hindi support.
- Guided Risk Check wizard for basic details, measurements, risk factors, BP/labs, and results.
- Deterministic calculators for BMI, Indian/Asian BMI category, waist risk, IDRS-style diabetes risk, BP flags, lab interpretation, and overall risk.
- Height input supports centimeters and feet/inches, then normalizes to centimeters.
- Weight input supports kilograms and pounds, then normalizes to kilograms.
- Camera Health Assist supports safe camera permission handling, capture, upload fallback, height guidance, body-risk guidance, waist guidance, and visible-concern support.
- OpenAI-powered lab OCR, visible-concern explanation, patient-friendly explanation, and referral-note support through server-side routes only.
- Report download, WhatsApp sharing, email sharing, native phone share sheet, and copy-to-clipboard without backend messaging APIs.
- Installable PWA with manifest, icons, service worker, offline shell, and mobile safe-area spacing.
- Future-ready placeholders for authentication, patient records, lab reports, referral notes, audit logs, and Supabase schema.
- UnoOne Health — AI Health Intelligence module: lab report analysis, real camera heart-rate scan (rPPG), voice/text symptoms, a combined health advisory, and a per-patient health timeline. Cloud-first via OpenAI 5.5; rPPG runs on-device. Reachable from the **Health AI** tab and the landing-page **Camera Heart-Rate Scan** spotlight.

## UnoOne Health — AI Health Intelligence

`modules/unone-health/` embeds a renamed, TypeScript-first medical agent (the Android UnoOne Local Agent is reference-only and is never modified) as a Swasthyak web module. A generic runtime (`UnoOneHealthRuntime`) dispatches to a registry of health tools, validates every input and output with Zod, and enforces consent/permission gates before any tool runs. Cloud reasoning uses the existing OpenAI client (`lib/ai/openaiClient.ts`, modes default/vision/premium, `OPENAI_MODEL_PREMIUM=gpt-5.5`); rPPG vitals are computed entirely on the client.

### Tools (registered in `modules/unone-health/health-skills/`)

- `health.vitals.rppg_scan` — real camera vital scan (rPPG), on-device only. Front-face mode gives heart rate + respiratory rate; rear-finger mode gives heart rate only. Confidence uses the exact 25/20/15/25/15 weighting with 0.80/0.60/0.40 thresholds; low confidence recommends a repeat scan and fail nulls the readings. No mock path.
- `health.lab.extract_markers` — lab report analysis. Extracts patient/report metadata and markers (diabetes, lipids, kidney, liver, thyroid, CBC/anemia, inflammation, vitamins/minerals), honors the report's own reference ranges, and assigns `severity` (normal/watch/consult_doctor/urgent). PDFs and images via OpenAI vision + premium.
- `health.symptoms.collect` — text/voice symptoms. Returns a `SymptomEvent` with severity and red flags; a local emergency matcher escalates chest pain, severe breathlessness, fainting, stroke signs, etc.
- `health.voice.summarize` — voice note to a structured summary via OpenAI.
- `health.reasoning.generate_plan` — combined health advisory. Fuses lab markers + rPPG vitals + symptoms + voice + age/sex/conditions/meds/BMI into a strict-JSON advisory (`risk_level`, `top_findings`, `user_message`, `doctor_summary`, `family_summary`, `lifestyle_plan`, `safety_note`).
- `health.record.save` — persist a canonical `HealthEvent` (privacy + safety fields, `synced_at`).
- `health.sync.queue` — offline queue + per-patient event store with retry-friendly flush (failed syncs stay pending).

### API routes (`app/api/v1/`, Next.js 16 App Router conventions)

- `POST /api/v1/vital-scan` — accept a computed `VitalScanResult` (no video is uploaded).
- `POST /api/v1/lab-reports/upload` — file + consent → store.
- `POST /api/v1/lab-reports/analyze` — OpenAI 5.5 → `LabReportEvent`. Reads snake_case (`report_id`, `patient_id`, `mime_type`, `base64_data_url`, `consent_given`).
- `POST /api/v1/symptoms` — `SymptomEvent`.
- `POST /api/v1/health-advisory` — OpenAI 5.5 → advisory.
- `POST /api/v1/health-events` — persist an event.
- `GET /api/v1/patient/[id]/timeline` — list a patient's events.

Backend persistence defaults to an in-memory store (volatile, resets on redeploy) and transparently upgrades to durable **Vercel Postgres** the moment a Postgres store is connected to the project (see [Hosting](#hosting-vercel-is-sufficient)). `SwasthyakAdapter` wraps these routes for client code.

### Safety & privacy guarantees

- No diagnosis claims, no medicine prescriptions. Every advisory and lab explanation is post-processed (`enforceHealthAdvisorySafety`, `enforceLabLensSafety`) to strip diagnosis/prescription wording and force `diagnosis_claimed: false`, `medicine_prescribed: false`.
- No raw face video is uploaded by default; `raw_video_uploaded` is always `false`. Camera vitals are computed on-device.
- Explicit consent is required before lab processing, camera scan, voice/symptom analysis, and the combined advisory.
- Emergency red-flag escalation banner; confidence is always shown; low confidence triggers a repeat-scan prompt.
- Route handlers log real errors server-side and return generic safe messages to the client (`routeErrors.ts`).

### rPPG status (honest)

- **Real, on-device, no mock.** The only engine is `SignalRppgEngine`: genuine per-frame RGB capture from the phone camera, MediaPipe FaceLandmarker ROI, a literature-SOTA signal pipeline (POS → SPA detrend → zero-phase bandpass → Welch + autocorrelation), and quality-gated heart rate. There is no mock/fallback path — every scan reads the live camera. It is still **experimental and not clinically validated**; results are for awareness only and never a diagnosis.
- **ROI stability + face-scale sizing (face mode):** the per-frame ROI is placed from **EMA-smoothed** FaceLandmarker coordinates (`landmarkSmoothing.ts`, α = 0.5 → ~33 ms time constant at 30 fps), so sub-pixel detector jitter no longer wobbles the cheek/forehead boxes and leaks broadband noise into the R/G/B means — a leading cause of run-to-run HR fluctuation on a still face. The forehead + both cheek boxes are **sized to the inter-ocular distance** (outer-eye to outer-eye), not a fixed pixel box, so they adapt to how close the user is: enough pulse pixels for a distant face, never crossing into eyes/brow/hair for a close one. The forehead box is anchored above the nasion and capped below the hairline. Motion/stillness are computed on the **smoothed** nose, face-scale-normalised, so a distant face is not penalised for the same pixel motion as a close one.
- **Why the detector was rebuilt (the old pipeline was the literature "GREEN" unsupervised baseline, ~19.8 BPM MAE on UBFC-RPPG):** three capture-level defects plus green-only extraction. Fixed across eight waves: (1) **Full capture, no truncation** — the measurement buffer is now a separate untrimmed `captureRef` (every kept frame for the whole 20 s); only the waveform buffer is trimmed for display. (2) **Per-frame RGB capture + dedup** — `sampleRoiFromFrame` accumulates R/G/B (not just green); `FingerFrameProvider` captures green+blue alongside red for ambient-leak detection; a `video.currentTime` dedup guard returns `null` for duplicate frames (a 30 fps camera on a 60 Hz display yielded ~50% duplicates that inflated the derived sample rate and biased the autocorrelation); the sample is timestamped at capture time, *before* the slow MediaPipe call. (3) **POS multi-channel extraction (face)** — `posSignal` (Wang 2017, "Algorithmic Principles of Remote-PPG") projects per-frame-normalised RGB onto the plane orthogonal to skin tone (`S1 = G−B`, `S2 = −2R+G+B`, `h = S1 + α·S2`), cancelling ambient-light flicker / auto-white-balance drift / specular reflections. Same per-frame means, ~4 BPM MAE on UBFC-RPPG vs ~20 for green-only. Finger keeps red-only (with torch, red is 2–5× better for a contact fingertip). (4) **SPA detrend + zero-phase bandpass** — `spaDetrend` (Tarvainen smoothness priors, tridiagonal Thomas-algorithm solve, λ=50 → ~0.1 Hz cutoff) removes only DC/drift and preserves the 0.7–2.5 Hz HR band (the old moving-average detrend eroded 0.75–1.0 Hz, i.e. 40–60 BPM); `bandpassZeroPhase` (forward→reverse→forward→reverse, 4th-order effective) has no phase lag, so peak locations are not shifted. (5) **Welch PSD + autocorrelation reconciliation** — `welchPsd` (Hann, 5 s segments, 50% overlap, radix-2 FFT, parabolic peak interpolation) reconciled with `dominantFrequencyHz` (autocorrelation) and explicit harmonic checks so Welch locking the 2nd harmonic or autocorr halving are corrected; ~1.5 s warmup trimmed. (6) **Quality gates + per-frame masking + sliding windows** — `snrSqi` (HR-band peak power / total in-band, gate ≥ 0.15) and `rdspSqi` (tallest / 2nd-tallest peak, gate ≥ 2.0) gate acceptance (Ernst 2020); bad frames are masked *before* HR estimation (`motion < 0.4` or `lighting < 0.4` face; `lighting < 0.4` finger) so a mid-scan head turn no longer contaminates the trace; HR is the reconciled Welch + autocorrelation peak of the full capture; 10 s sliding windows (5 s step) are a stability gate — <50% of windows agreeing within 15 BPM → honest null. (7) **Resampling** — `resampleUniform` (monotone cubic Hermite, Fritsch–Carlson) puts the jittery, duplicate-laced rAF cadence onto a uniform grid before any frequency math (timestamp correction keeps MAE ~4.5 vs ~15 without). (8) **Confidence honesty** — the reported `confidence` is capped by signal trust (`0.35 + 0.65·hrTrust`, where `hrTrust = 0.5·snr + 0.5·per-window agreement`), so a well-lit-but-noisy capture cannot read as "good".
- **Front camera = face scan** → heart rate + respiratory rate. **Rear camera = fingertip scan** → heart rate only. Finger quality is **real**: `computeFingerSignalQuality` now takes per-frame R/G/B — motion from frame-to-frame red delta, stability from delta-variance, pulsatility from the detrended-red AC/DC ratio, and a **contact-quality lighting score** that is low on ambient leak (red < 200 + green/blue creeping in → "cover camera fully") or saturation/over-press (red > 254 → "press more lightly"), with a cold-finger/weak-pulse hint ("warm your hands"). The rear/finger provider auto-enables the torch at scan start (manual toggle still works); the torch is reset to off on stop. **Finger mode UX:** before the scan starts, a plain-language placement card says *"Cover the rear camera lens fully with your fingertip"* — the rear lens sits in a *corner* of the phone, not the centre of the screen, so the old centre target ring was misleading and is removed. During the scan the three live meters relabel to the honest finger sub-scores — **Contact / Stillness / Steady** (face mode keeps Lighting / Motion / Stability).
- **Accuracy levers in the live scan UI:** the camera requests an ideal **60 fps** (more samples per cardiac cycle → sharper autocorrelation; `ideal`, not `max`, so the device picks a supported rate and the two-tier fallback drops it if rejected). A **3-2-1 "get ready" countdown + stability gate** discards the first ~seconds while the user settles: the 20s clock starts only after `faceStability > 0.8` (face) or `lightingScore > 0.4` (finger) is sustained ≥1s, with a 10s ceiling → `stability_timeout`. A **live PPG waveform** is drawn each frame on an imperative canvas, plus live **Lighting / Motion / Stability** meters driven by the real per-frame telemetry. The final BPM is shown only on completion (count-up animation) — no provisional jumpy number during the scan.
- **Heart-rate estimation accuracy:** Welch + autocorrelation reconciliation + harmonic checks eliminate the rPPG "halving/doubling" error; **parabolic interpolation** gives sub-bin precision. The `snrSQI`/`rdspSQI` + per-window-stability gates reject flat/noisy captures so a bad scan returns no fabricated number (low/fail confidence nulls the readings and recommends a repeat). **Cross-scan stability:** a prior validated BPM is forwarded into `finalizeVitalScan` and consulted by the harmonic-reconciliation step *only when the current SNR is weak (< 0.3)*, so a confident new reading is never overridden by stale context — it merely suppresses the classic halving/doubling glitch on a borderline capture (a leading cause of run-to-run fluctuation). Unit-tested at every layer: POS illumination invariance, cubic-Hermite resampling of jittered/dropped timestamps, SPA preserves the 0.75 Hz HR edge, Welch locks a pulse-train fundamental (no halving), `snrSQI`/`rdspSQI` reject broadband noise, landmark EMA converges a jittered fixed point to its mean, and end-to-end face-RGB / finger-red recovery of 72 BPM (68–76) under a large in-band common-mode and through a mid-scan motion transient.
- **Respiratory-rate estimation accuracy (overhauled — the previous estimator leaked the heart rate into the breath band):** `estimateRespiratoryRateRpm` (pure, in `signal.ts`) uses a five-step pipeline — (1) **mean-subtract** the trace (the shared `detrend` is a moving-average *high-pass* that would annihilate the 0.1–0.5 Hz breath band before the bandpass saw it); (2) **cascade two 0.1–0.5 Hz biquads** for a steeper roll-off so the ~5–10× stronger HR fundamental leaks far less; (3) **trim ~1.5 s of IIR warmup** so the filter transient doesn't dominate the autocorrelation; (4) pick the **global-max** autocorrelation peak (parabolic-refined) instead of the first-significant peak — over a 20 s window RR is borderline (~2–5 cycles) and the first-significant rule locks onto an HR-leakage phantom at ~0.3–0.4 Hz; (5) a **band-power share gate** requires the respiratory band to carry ≥20% of the total physiological power (`rrP / (rrP + hrP) ≥ 0.2`), so a heart-only trace or pure noise returns **null** instead of inventing a breath rate. RR is only produced for face mode and only when the HR estimate is trustworthy (a failed HR gate means the capture is too noisy for RR too). Unit-tested end-to-end: a 0.25 Hz breath overlaid on a 1.2 Hz HR → 15 rpm, and broadband noise → null (no fabricated rate).
- **Advisory confidence is derived, not a constant:** the combined health advisory's `confidence` is computed by `deriveAdvisoryConfidence` from the evidence actually supplied (age/sex, BMI, lab report, vitals, symptoms) — base 0.5, rising with each objective source (labs > symptoms), capped at 0.9 for a fully-evidenced non-emergency advisory and **capped ≤ 0.7 when red flags or severe symptoms are present** so emergencies never read as high-confidence reassurance. Unit-tested for the floor, monotonic growth, both caps, and the objective-over-subjective ordering.
- **Honest accuracy claim:** the algorithm moves from ~20 BPM MAE (green-only) toward ~4 BPM MAE *controlled* (POS on UBFC-RPPG-class data). Mobile / in-the-wild is worse (SOTA itself is ~12–15 BPM walking) — camera motion, lighting changes, and skin tone all degrade it. The UI always shows the confidence score and the "experimental / not clinically validated" note.
- **Self-hosted model (works on any network):** the MediaPipe FaceLandmarker model **and** the tasks-vision WASM fileset are served from `/public/models/` — no dependency on the googleapis / jsdelivr CDNs. The first scan no longer needs an external CDN fetch; it works on networks that block those CDNs and works offline once the app shell has loaded.
- The landing page hero merges the **Camera Heart-Rate Scan** spotlight: an animated heartbeat/PPG trace, a **Measure heart rate** button (deep-links into Health AI directly on the scan), and a 60-second count-up badge. The scan screen title reads **Heart beat scan**.

## Privacy And Data

- No cloud database is required for the core experience. Durable per-patient history is available by connecting a Vercel Postgres store (one dashboard click — see [Hosting](#hosting-vercel-is-sufficient)); until then, "synced" events live in process memory.
- Authentication is not active yet.
- Form drafts are stored in browser `localStorage` for convenience.
- Uploaded images are not stored by default by the app.
- Images are sent to OpenAI only after the user explicitly chooses AI OCR or AI visible-concern analysis.
- Report sharing opens WhatsApp, email, or the phone share sheet with prefilled text. The user manually sends it.
- Never commit `.env.local` or any API key.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- OpenAI Node SDK and Responses API routes
- MediaPipe `@mediapipe/tasks-vision`
- Zod
- Vitest
- Remotion for product media

## Setup

Install dependencies:

```bash
pnpm install
```

Create the local environment file:

```bash
cp .env.example .env.local
```

Add OpenAI configuration:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL_DEFAULT=gpt-5.4
OPENAI_MODEL_VISION=gpt-5.4
OPENAI_MODEL_PREMIUM=gpt-5.5
OPENAI_MODEL_FALLBACK=gpt-4.1
```

Run locally:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Scripts

- `pnpm dev` starts local development.
- `pnpm lint` runs ESLint.
- `pnpm typecheck` runs TypeScript checks.
- `pnpm test` runs unit tests.
- `pnpm build` creates a production build.
- `pnpm start` runs the production server.
- `pnpm video:render` renders the Remotion product video.
- `pnpm video:poster` renders the video poster.

## OpenAI Setup

- All OpenAI calls happen server-side in `app/api/ai`.
- `OPENAI_MODEL_DEFAULT` is used for standard explanation and report-support flows.
- `OPENAI_MODEL_VISION` is used for lab OCR and visible-concern image analysis.
- `OPENAI_MODEL_PREMIUM` is reserved for stronger explanation flows when configured.
- `OPENAI_MODEL_FALLBACK` helps if the preferred model is unavailable.
- If OpenAI fails or is not configured, deterministic screening still works.

OpenAI is used for OCR, visible-concern explanation, patient-friendly explanation, bilingual simplification, referral note drafting, and safety review. It is not used for the final medical calculations.

## Report Sharing

The app uses RHCF-style mobile sharing without backend APIs:

- WhatsApp opens `https://wa.me/?text=...` with the report prefilled.
- Email opens `mailto:` with the subject and report body prefilled.
- Native sharing uses `navigator.share` when the device supports it.
- Copy Report uses the clipboard when available.
- Download Report saves a plain-text report.

Nothing is auto-sent. The user chooses when and where to send the report.

## Camera Health Assist Safety

- Camera/video does not diagnose disease.
- The app never predicts exact weight, BMI, diabetes, or hypertension from a photo.
- Height Assist requires a reference object such as an A4 sheet, QR marker, one-meter strip, or known-height object.
- Camera outputs are estimates or possible visual risk signs only and require manual confirmation.
- Final waist risk still comes from manual waist circumference.
- AI visible-concern analysis requires explicit consent and internet access.

## Deployment On Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add the environment variables from `.env.example`.
4. Deploy normally.
5. Verify the PWA manifest, icons, offline shell, camera permissions, and AI routes on the deployed HTTPS domain.

## Offline Behavior

- The app shell is cached by the service worker (registered in production only).
- The rPPG face model + WASM are self-hosted under `/public/models/`, so the heart-beat scan works offline once the app shell has loaded — no CDN fetch required.
- Manual calculator logic works offline after the app has loaded once.
- Health events captured while offline are queued in `localStorage` and replayed when connectivity returns (the `OfflineQueue`); failed events stay pending for retry.
- AI OCR, AI visible-concern analysis, and AI explanation need internet (they call OpenAI server-side).
- Offline AI actions show a graceful internet-needed message.

## Hosting (Vercel is sufficient)

- The whole app — UI, API routes, and the on-device rPPG scan — runs on **Vercel** (Next.js, Node 24.x). It is already linked and deployed: `swasthyascore-ai.vercel.app`. You do **not** need Railway, Render, or any other host for the user-facing features to work.
- **AI functions** run as Vercel serverless functions calling OpenAI with the Responses API; every API route sets `maxDuration = 60` so slow structured-output calls (lab report analysis, combined advisory) don't hit the 10s default timeout. The `OPENAI_API_KEY` + `OPENAI_MODEL_*` vars are set in the Vercel **Production** environment. (If you want AI to also work on Preview/branch deployments, add the same vars to the Preview environment in Vercel → Environment Variables.)
- **Durable history is wired up and opt-in via Vercel Postgres (one click).** The `/api/v1` health routes persist events through `serverEventStore` / `serverLabFileStore` (`modules/unone-health/adapters/swasthyak-adapter/serverStore.ts`). When a Postgres connection URL is present in the environment (`POSTGRES_URL` — injected automatically when you connect a Vercel Postgres store), every `save` / `list` / `get` is routed to the durable Postgres implementation (`lib/server/postgresStore.ts`, JSONB `health_events` + `lab_files` tables, schema auto-created on first request — no migration step). When no URL is present, the same calls fall back to the in-memory Map, so the app never breaks on a fresh deploy. The `@vercel/postgres` module is loaded lazily via dynamic `import()`, so tests and `next build` never touch a database.
  - **To activate durable history (one dashboard click):** Vercel → your `swasthyascore-ai` project → **Storage** tab → **Create** → **Postgres** → name it → **Connect to Project** → select `swasthyascore-ai` → confirm. Vercel injects `POSTGRES_URL` (and `POSTGRES_PRISMA_URL` / `POSTGRES_NON_POOLING_URL`) into your environments and triggers a redeploy. On the next request, `ensureSchema()` creates the tables. No code change, no migration command, no env var to paste.
- **What you'd host elsewhere (optional):** nothing for the user-facing features. The only external dependency AI needs is the `OPENAI_API_KEY` (already set in the Vercel Production environment). If you later want auth + row-level security on patient records, Supabase is the natural upgrade (the `lib/future/*` placeholders + `supabase.schema.sql` sketch that path) — but Vercel Postgres alone already gives you a durable, per-patient timeline that survives redeploys and is shared across instances.
- So: **Vercel alone makes every function work accurately for anyone with the link.** A database is a one-click enhancement for durable history, not a requirement for the core experience.

## Future Auth And Database

Future-ready placeholders are available in:

- `lib/future/auth.placeholder.ts`
- `lib/future/database.placeholder.ts`
- `lib/future/supabase.schema.sql`

Planned roles:

- patient
- field_worker
- clinic_admin
- doctor

Before storing patient records in the cloud, add explicit consent, retention rules, audit logging, Supabase Auth, row-level security, and clinical data governance.

## Project Structure

- `app/` contains the PWA shell, dashboard, offline page, AI API routes, and `/api/v1` health routes.
- `components/` contains the mobile-first bilingual UI, including `components/unone-health/` for the Health AI views.
- `components/camera/` and camera-related components provide camera assistance.
- `lib/calculators/` contains deterministic medical screening logic.
- `lib/camera/` contains camera utilities, MediaPipe setup, and safe estimation rules.
- `lib/ai/` contains OpenAI prompts, schemas, client helpers, and services.
- `lib/i18n/` contains English/Hindi dictionaries.
- `lib/utils/` contains validation, unit conversion, report generation, and sharing utilities.
- `lib/future/` contains auth/database placeholders.
- `modules/unone-health/` contains the UnoOne Health AI module (core runtime, tool registry, permissions, offline queue, health skills, and the Swasthyak adapter). `lib/unone-health.ts` is the barrel re-export for app code.
- `tests/` contains calculator, risk engine, AI schema, report, sharing, camera fallback, unit conversion, translation coverage, and `unone-health` (rPPG signal, vital scan, regression, offline queue) tests.

## Manual Test Checklist

1. Open the app on a mobile-width screen.
2. Confirm there is no separate landing page.
3. Confirm the hero says "Your personal AI NCD detector".
4. Start AI Risk Check and complete a normal healthy case.
5. Test a high BMI case.
6. Test a high waist case.
7. Test a high IDRS case.
8. Test HbA1c 6.8.
9. Test fasting glucose 130.
10. Test random glucose 220 with symptoms.
11. Test BP 185/125 urgent warning.
12. Switch English/Hindi.
13. Test height in centimeters.
14. Test height in feet/inches and confirm BMI uses converted centimeters.
15. Test weight in kilograms and pounds.
16. Deny camera permission and confirm upload fallback.
17. Confirm camera starts only after tapping Start Camera.
18. Confirm Lab OCR requires consent and OCR values remain editable.
19. Turn offline mode on and confirm manual calculator still works.
20. Confirm AI actions show internet-needed messages offline.
21. Download the report.
22. Open WhatsApp with the report prefilled.
23. Open email with subject/body prefilled.
24. Use native share where supported.
25. Confirm no diagnosis or medicine prescription language appears.
26. On the landing page, confirm the hero shows the animated heartbeat/PPG trace, a **60-second** count-up badge, and a **Measure heart rate** button; tap it and confirm it opens Health AI directly on the scan (no extra tab navigation).
27. On the scan screen, confirm the title reads **Heart beat scan** and the **Face / Finger** segmented toggle switches the camera mode (front = face HR+RR, rear = finger HR only) with no double-switch.
28. Grant consent and watch the **3-2-1 countdown**; the face oval pulses white → emerald once you hold still, and the 20s clock starts only after the stability gate passes. Confirm the live waveform + Lighting/Motion/Stability meters update each frame (move the phone → the motion meter drops and a motion hint shows).
29. Complete a front-camera scan; confirm an animated result card with a count-up BPM, a confidence ring (good/moderate/low/fail color), and the prominent **experimental, not clinically validated** badge — no "demo/mock" badge and no provisional BPM was shown during the scan.
30. Switch to finger mode, place a fingertip over the rear lens, and confirm the **torch auto-enables** at scan start (the torch button shows "on") and the waveform amplitude rises with the red flood. The manual torch toggle still overrides it; the torch resets to off when the scan ends. On iOS Safari, confirm the torch button is simply absent (not broken) and the scan still runs (no torch → weaker red, lower confidence, but no crash).
30a. Finger contact hints: with a loose finger (ambient light leaking in) confirm the **"cover camera fully"** hint; pressing too hard (red saturated) shows **"press more lightly"**; cold/weak-pulse contact shows **"warm your hands"**. A bad-contact scan returns null/low confidence, not a fabricated number.
30b. Face illumination invariance (POS): run a front-camera scan under a lamp, then **dim the lamp mid-scan** — the HR should stay stable (POS cancels the common-mode illumination change) rather than jumping. A mid-scan head turn should yield a stable median or an honest null, not a wrong number.
30c. Full-window capture: the 20 s scan uses the **entire** window for HR (not a trimmed tail). If you can, watch a debug log of the captured-frame count — it should be ~the whole scan, not just the last ~7–15 s.
31. If the user cannot hold still within 10s, confirm a `stability_timeout` failure (no fabricated heart rate); a no-face or low-light condition shows the matching hint and nulls the readings on low confidence.
31a. On a front-camera scan, confirm the respiratory-rate row appears **only when a real breath modulation is detected** — if you hold your breath or move erratically it should be absent (null), not a fabricated number. The advisory confidence shown on the result/advisory screen should reflect the evidence you supplied (labs + vitals raise it; severe symptoms / red flags keep it ≤ 0.7).
32. Upload a sample lab report; confirm markers and critical flags render and that no marker says "you have …" or prescribes a medicine.
33. Enter symptoms and generate a health advisory; confirm a risk level, lifestyle plan, doctor summary, family summary, and safety note render with no diagnosis wording.
34. Load the app once online (so the shell + self-hosted face model cache), then go offline and run a scan — it should still work (model is served from `/public/models/`, no CDN). If the model/WASM ever fail to load, confirm the scan surfaces a real error rather than a fabricated heart rate.

## Known Limitations

- Adult screening only.
- Gender options are currently male/female because the supplied waist cutoffs are sex-specific.
- Reports are plain text; PDF can be added later.
- OCR quality depends on image clarity and visible units.
- Browser voice input depends on device and browser support.
- MediaPipe pose detection depends on lighting, full-body visibility, browser support, and model loading.
- Camera Health Assist is guidance only and does not replace manual measurements.
- UnoOne Health rPPG is real and on-device but experimental and not clinically validated. It is for awareness only and never diagnoses; the rear-finger mode gives heart rate only. The torch toggle is unavailable on iOS Safari (it does not expose `torch` in track capabilities) — the button is hidden, not broken. The 60fps ideal is a request; the device may deliver a lower rate and the two-tier constraint fallback handles rejection. Respiratory rate is reported only when the breath band carries a meaningful share of the physiological power (≥20%); otherwise it is honestly null rather than fabricated — over a 20 s window RR estimation is inherently borderline and must not be trusted blindly.
- UnoOne Health backend persistence defaults to in-memory and upgrades to durable Vercel Postgres automatically when a Postgres store is connected (one click — no code or migration change).

## Safety Boundaries

- Deterministic code is always the source of truth for medical screening logic.
- AI never performs the core BMI, diabetes score, BP, lab-threshold, or overall risk calculations.
- AI does not diagnose disease or prescribe medicine.
- OCR values must be reviewed manually before use.
- Doctor confirmation is required for diagnosis and treatment.
