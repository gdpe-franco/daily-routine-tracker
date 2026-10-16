# My Daily Reset

A local-first, mobile-friendly planner for daily activities, notes, mood markers, and a seven-day digital break. It is a Vue 3 PWA with no account or server-side data storage.

## Run with Docker

Start Vite development with hot reload:

```bash
docker compose up --build build
```

Open http://localhost:5173. To build and serve the static app with nginx:

```bash
docker compose up --build preview
```

Open http://localhost:8080.

## Install the PWA

Open the app on an eligible local origin such as `localhost`, or on a secure HTTPS origin. Use your browser's Install or Add to Home Screen option. The app can work offline after its first successful load.

## Privacy and retention

Your data stays in this browser's `localStorage`; it does not sync to another device. The app keeps today and the previous 29 calendar days, then removes older records. Export a JSON backup to archive or move your data before it expires or browser storage is cleared.
