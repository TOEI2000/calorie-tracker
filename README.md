# CalTrack — Daily Calorie Tracker PWA

Snap a photo of your food, let an AI vision model estimate the calories, and track your daily intake — all from a lightweight Progressive Web App you can add to your phone's home screen.

**Stack:** plain HTML/CSS/JS, no framework, no build step. Hosted free on GitHub Pages.

## How it works (when complete)

1. Open the app on your phone (installed via "Add to Home Screen")
2. Tap **Take photo** — the rear camera opens directly
3. Tap **Analyze** — an AI vision model identifies the food and estimates calories
4. The result is saved to a database so you can see daily totals and history

## Current status: Week 1 ✅

Frontend skeleton only:

- 📷 Camera capture via `<input type="file" accept="image/*" capture="environment">`, plus a gallery picker
- 🖼️ Photo preview after capture
- ✨ Placeholder **Analyze** button (logs to console — no AI yet)
- 📱 Mobile-first UI, system fonts, light/dark mode
- 🏠 Installable PWA: `manifest.json` + minimal service worker

## 8-week roadmap

| Week | Goal |
|------|------|
| 1 ✅ | Frontend skeleton: camera capture, preview, PWA shell, GitHub Pages deploy |
| 2 | AI vision integration: send photo to a vision model (e.g. Claude API) and get a calorie estimate |
| 3 | Backend proxy: small serverless function to hold the API key (never ship keys in frontend code) |
| 4 | Database: persist each meal (photo, foods, calories, timestamp) |
| 5 | Daily dashboard: today's total, meal list, delete/edit entries |
| 6 | History & trends: calendar view, weekly charts, daily goal setting |
| 7 | Polish: offline queue for photos, loading states, error handling, image compression |
| 8 | Ship: final testing on iPhone/Android, app icon polish, share with friends |

## Project structure

```
calorie-tracker/
├── index.html      # Single page: capture → preview → analyze → results
├── style.css       # Mobile-first styles, system fonts, dark mode support
├── app.js          # Capture/preview logic + service worker registration
├── manifest.json   # PWA manifest (relative paths, subpath-safe)
├── sw.js           # Minimal app-shell cache service worker
└── icons/          # Home-screen icons (192, 512, 180 for iOS)
```

## Run locally

Service workers require HTTP(S), so serve the folder instead of opening `index.html` directly:

```
python -m http.server 8000
# or: npx serve .
```

Then open http://localhost:8000.

## Deploy to GitHub Pages

1. Create a repo named `calorie-tracker` on GitHub
2. Push these files to the `main` branch
3. Repo **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`
4. Visit `https://<your-username>.github.io/calorie-tracker/`

All paths in the app are relative, so it works under the `/calorie-tracker/` subpath without changes.
