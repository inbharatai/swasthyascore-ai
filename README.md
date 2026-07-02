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

Backend persistence is an in-memory store typed and clearly marked as a placeholder until the real Swasthyak backend lands. `SwasthyakAdapter` wraps these routes for client code.

### Safety & privacy guarantees

- No diagnosis claims, no medicine prescriptions. Every advisory and lab explanation is post-processed (`enforceHealthAdvisorySafety`, `enforceLabLensSafety`) to strip diagnosis/prescription wording and force `diagnosis_claimed: false`, `medicine_prescribed: false`.
- No raw face video is uploaded by default; `raw_video_uploaded` is always `false`. Camera vitals are computed on-device.
- Explicit consent is required before lab processing, camera scan, voice/symptom analysis, and the combined advisory.
- Emergency red-flag escalation banner; confidence is always shown; low confidence triggers a repeat-scan prompt.
- Route handlers log real errors server-side and return generic safe messages to the client (`routeErrors.ts`).

### rPPG status (honest)

- **Real, on-device, no mock.** The only engine is `SignalRppgEngine`: genuine frame capture from the phone camera, MediaPipe FaceLandmarker ROI, green-channel signal, detrend, biquad bandpass, and autocorrelation → heart rate. There is no mock/fallback path — every scan reads the live camera. It is still **experimental and not clinically validated**; results are for awareness only and never a diagnosis.
- **Front camera = face scan** → heart rate + respiratory rate. **Rear camera = fingertip scan** → heart rate only (place a fingertip over the lens). The rear/finger provider (`FingerFrameProvider`) averages the pulsing red channel.
- The MediaPipe model is fetched from a CDN on first use, so a scan needs internet the first time; if the model fails to load the scan surfaces a real "needs internet on first use" error (no fabricated numbers). Low confidence nulls the readings and recommends a repeat scan.
- The landing page has a dedicated **Camera Heart-Rate Scan** spotlight with a **Measure heart rate** button that opens Health AI directly on the vital scan.

## Privacy And Data

- No cloud database is required in the current release.
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

- The app shell is cached by the service worker.
- Manual calculator logic works offline after the app has loaded once.
- AI OCR, AI visible-concern analysis, and AI explanation need internet.
- Offline AI actions show a graceful internet-needed message.

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
26. On the landing page, tap **Measure heart rate** and confirm it opens Health AI directly on the Camera Vital Scan (no extra tab navigation).
27. Grant consent and run a real front-camera vital scan (20s); confirm a heart-rate result with a confidence label and the "experimental, not clinically validated" note — no "demo/mock" badge.
28. Switch to the rear camera, follow the fingertip guidance, and scan; confirm a heart-rate result with no respiratory rate.
29. Upload a sample lab report; confirm markers and critical flags render and that no marker says "you have …" or prescribes a medicine.
30. Enter symptoms and generate a health advisory; confirm a risk level, lifestyle plan, doctor summary, family summary, and safety note render with no diagnosis wording.
31. Turn offline before a first scan and confirm the scan shows a "needs internet on first use" error rather than a fabricated heart rate.

## Known Limitations

- Adult screening only.
- Gender options are currently male/female because the supplied waist cutoffs are sex-specific.
- Reports are plain text; PDF can be added later.
- OCR quality depends on image clarity and visible units.
- Browser voice input depends on device and browser support.
- MediaPipe pose detection depends on lighting, full-body visibility, browser support, and model loading.
- Camera Health Assist is guidance only and does not replace manual measurements.
- UnoOne Health rPPG is real and on-device but experimental and not clinically validated. It is for awareness only and never diagnoses; the rear-finger mode gives heart rate only.
- UnoOne Health backend persistence is an in-memory placeholder until the real Swasthyak backend is connected.

## Safety Boundaries

- Deterministic code is always the source of truth for medical screening logic.
- AI never performs the core BMI, diabetes score, BP, lab-threshold, or overall risk calculations.
- AI does not diagnose disease or prescribe medicine.
- OCR values must be reviewed manually before use.
- Doctor confirmation is required for diagnosis and treatment.
