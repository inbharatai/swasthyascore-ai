# SwasthyaScore AI full-flow QA

Target: https://swasthyascore-ai.vercel.app
Generated: 2026-04-28T07:14:25.516Z
Viewport: 390x844 @ 2x

## Results
- PASSED: Production app loads local auth screen
- PASSED: Captured local auth screen
- PASSED: Local auth creates session and opens dashboard
- PASSED: Captured mobile dashboard
- PASSED: Captured Risk Check basic details step
- PASSED: Captured body measurements step with demo values
- PASSED: Captured diabetes risk factor step
- PASSED: Captured BP and lab values step
- PASSED: Deterministic calculator completes high-risk demo case (urgent language present)
- PASSED: Captured deterministic results screen
- PASSED: AI explanation route returns a user-facing result (Lifestyle advice)
- PASSED: Captured AI explanation area
- PASSED: Captured Lab OCR screen before upload
- PASSED: Lab OCR upload flow handles synthetic report (Values extracted)
- PASSED: Captured Lab OCR screen after AI extraction attempt
- PASSED: Camera module opens without blocking calculator
- PASSED: Captured Camera Health Assist screen
- PASSED: Camera start action gives graceful success/fallback state (Stop camera)
- PASSED: Captured camera start/fallback state
- PASSED: Report tab keeps screening result and referral note available
- PASSED: Captured report/referral screen
- PASSED: Language toggle remains visible after full flow
- PASSED: PWA manifest is reachable
- FIXED: Service worker is reachable (Production /service-worker.js was 404 during QA; this change adds a compatibility service-worker.js and registers it.)
- PASSED: Generated demo video from captured product screens
- PASSED: Browser console has no blocking app errors during QA
- PASSED: Dashboard media showcase added from captured QA assets

## Screenshots
- public/product-media/screenshots/01-local-auth.png
- public/product-media/screenshots/02-home-dashboard.png
- public/product-media/screenshots/03-risk-basic-step.png
- public/product-media/screenshots/04-risk-measurements-step.png
- public/product-media/screenshots/05-risk-factors-step.png
- public/product-media/screenshots/06-bp-labs-step.png
- public/product-media/screenshots/07-results-summary.png
- public/product-media/screenshots/08-ai-explanation.png
- public/product-media/screenshots/09-lab-ocr-empty.png
- public/product-media/screenshots/10-lab-ocr-after-upload.png
- public/product-media/screenshots/11-camera-assist.png
- public/product-media/screenshots/12-camera-start-state.png
- public/product-media/screenshots/13-report-download.png

Demo video: public/product-media/swasthyascore-demo.webm
Sample OCR report: public/product-media/sample-lab-report.png