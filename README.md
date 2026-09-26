# FORGE — Training Log

A dark, neon workout tracker built as an installable web app (PWA) for the Galaxy Z Fold 6.

- **Log workouts** from the 3-day Level 2 programme (W1 Squat & Push, W2 Bench & Pull, W3 Hinge & Press) with set tracking, "last time" hints, a rest timer and PR detection
- **Garmin data**: scan Garmin Connect screenshots (free on-device OCR), import a `.fit` / Export Original `.zip`, or type the numbers in
- **Stats**: sessions per week, workout split, calories, time trained, heart rate, strength progress (estimated 1RM), PRs, training calendar
- **Daily check-in**: protein, walk, sleep, bodyweight, energy, with streaks
- **Progress photos** with a before/after compare slider
- Works offline; all data stays on the device (export/restore a backup in Settings)

## Install on the phone

Open the GitHub Pages URL in Chrome → ⋮ menu → **Add to Home screen** (or "Install app").

## Develop

```bash
npm install
npm run dev      # http://localhost:5173 (also on your network via --host)
npm run build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), Recharts, Tesseract.js, Garmin FIT SDK.
