# SwasthyaScore AI

SwasthyaScore AI is a mobile-first bilingual PWA for quick NCD screening in Bharat. It helps laypersons, NGOs, field workers, clinics, and community health workers screen obesity risk, diabetes risk, waist risk, and blood pressure risk in under a minute.

This MVP is intentionally structured so manual screening works without a database and without OpenAI. It includes a local-device authentication gate for role-based access context, while patient and screening data remains local-first. AI is optional and only used when the user explicitly asks for lab OCR, visible-concern explanation, referral-note support, or patient-friendly explanation.

## Medical disclaimer

- This is a screening and risk-awareness tool only.
- It does not diagnose diabetes, hypertension, obesity, or any other disease.
- It does not prescribe medicines or dosages.
- Abnormal results need confirmation by a qualified doctor or diagnostic lab.
- Blood pressure diagnosis needs repeated properly measured readings.

## Features

- Mobile-first Next.js App Router PWA with install prompt, manifest, icons, and offline shell
- Direct-to-dashboard experience with no separate marketing landing page
- Local-device authentication gate with role selection for patient, field worker, clinic admin, or doctor context
- English and Hindi local translations
- Deterministic calculators for BMI, Indian/Asian obesity risk, waist risk, IDRS-style diabetes risk, BP flags, lab interpretation, and overall triage
- Optional AI lab OCR using the OpenAI Responses API
- Camera Health Assist using the browser camera API and MediaPipe Pose Landmarker for safe height/body guidance
- Optional AI visible-concern explanation from selected images, with explicit consent and non-diagnostic output
- Optional AI explanation, simplification, and referral-note drafting using the OpenAI Responses API
- Voice-assisted note entry through the browser Web Speech API when supported
- Plain-text downloadable screening report
- Future-ready auth/database placeholders and Supabase schema stub

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- OpenAI Node SDK
- MediaPipe `@mediapipe/tasks-vision`
- Zod
- Vitest

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Add your OpenAI configuration if you want AI features:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL_DEFAULT=gpt-5.4
OPENAI_MODEL_VISION=gpt-5.4
OPENAI_MODEL_PREMIUM=gpt-5.5
OPENAI_MODEL_FALLBACK=gpt-4.1
```

4. Start the app:

```bash
pnpm dev
```

5. Open:

```text
http://localhost:3000
```

## Authentication and storage in v1

- Authentication is local-device only in this MVP.
- The local session stores display name, role, selected language, and timestamps in browser `localStorage`.
- Screening form drafts are also stored in browser `localStorage`.
- No Supabase database is required for v1.
- Clearing browser data signs the user out and removes local drafts.
- For production clinic workflows, replace the local auth service with Supabase Auth or Auth.js and add explicit consent, retention, audit, and row-level-security rules before storing patient records in the cloud.

## Scripts

- `pnpm dev` starts local development
- `pnpm lint` runs ESLint
- `pnpm typecheck` runs TypeScript checks
- `pnpm test` runs unit tests
- `pnpm build` creates a production build
- `pnpm start` runs the production server

## OpenAI model configuration

- `OPENAI_MODEL_DEFAULT` is used for standard OCR and explanation flows
- `OPENAI_MODEL_VISION` is used for image-based lab OCR and visible-concern explanation
- `OPENAI_MODEL_PREMIUM` is reserved for future premium or more complex explanation flows
- `OPENAI_MODEL_FALLBACK` protects the app if the preferred model is unavailable in the account
- If OpenAI is not configured, the calculator still works and AI routes fail gracefully

## Camera Health Assist safety

- The camera module does not diagnose disease.
- The app never predicts exact weight, BMI, diabetes, or hypertension from a photo.
- Height Assist requires a reference object such as an A4 sheet, QR marker, one-meter strip, or known-height object.
- Camera outputs are estimates or possible visual risk signs only and require manual confirmation.
- Final waist risk still comes from manual waist circumference in centimeters.
- Images are not stored by default; AI image explanation is sent only after the user gives consent.

## Deployment on Vercel

1. Push the project to a Git repository.
2. Import the repo into Vercel.
3. Add the environment variables from `.env.example`.
4. Deploy normally.
5. Verify the manifest, icon loading, offline shell, and AI routes on the deployed domain.

## Offline behavior

- The app shell is cached by the service worker.
- Manual calculator logic works offline after the app has been loaded once.
- AI OCR and AI explanation need internet access.
- The UI shows a graceful offline message for AI-only actions.

## How to add Supabase later

- Review [`lib/future/database.placeholder.ts`](/C:/Users/reetu/Desktop/NCD%20calculator/lib/future/database.placeholder.ts)
- Review [`lib/future/supabase.schema.sql`](/C:/Users/reetu/Desktop/NCD%20calculator/lib/future/supabase.schema.sql)
- Review [`lib/future/auth.placeholder.ts`](/C:/Users/reetu/Desktop/NCD%20calculator/lib/future/auth.placeholder.ts)
- Add Supabase client wiring in a new repository implementation
- Replace the placeholder repository with a real persistence layer
- Add auth flows around the existing placeholder session contract in [`lib/future/auth.placeholder.ts`](/C:/Users/reetu/Desktop/NCD%20calculator/lib/future/auth.placeholder.ts)

## Project structure

- `app/` contains the PWA shell, dashboard, offline page, and AI API routes
- `components/` contains the mobile-first bilingual UI building blocks
- `lib/calculators/` contains deterministic medical logic
- `lib/camera/` contains MediaPipe setup and safe camera-estimation rules
- `lib/ai/` contains OpenAI prompts, schemas, client helpers, and modular services
- `lib/i18n/` contains local English/Hindi dictionaries
- `lib/future/` contains auth/database placeholders for later phases
- `tests/` contains calculator, lab interpretation, risk engine, and translation coverage tests

## Manual test checklist

1. Normal healthy case
2. High BMI case
3. High waist case
4. High IDRS case
5. HbA1c 6.8 case
6. Fasting glucose 130 case
7. Random glucose 220 with symptoms
8. BP 185/125 urgent case
9. Hindi language switch
10. Offline mode after first load
11. OpenAI failure fallback
12. Lab image OCR with manual verification
13. Camera permission denied fallback
14. Height Assist without reference marker refuses estimation
15. Visible-concern AI requires consent and internet

## Known limitations

- This version supports adult screening only.
- Gender options are currently limited to male/female because the supplied public-health cutoffs are sex-specific.
- Reports are plain text in v1; PDF export is scaffolded conceptually but not implemented yet.
- OCR quality depends on image clarity and visible units.
- Browser voice input depends on device and browser support.
- MediaPipe pose detection depends on lighting, full-body visibility, browser support, and model loading.
- Camera Health Assist is guidance only and does not replace manual measurements.

## Safety notes

- Deterministic code is always the source of truth for medical screening logic.
- AI never performs the core calculations.
- Users must explicitly trigger AI OCR or AI explanation before any data is sent to OpenAI.
- Uploaded lab images are not stored by default by the app.
- Camera images and visible-concern images are not uploaded unless the user explicitly starts AI analysis.
- OCR results must be reviewed manually before final use.
