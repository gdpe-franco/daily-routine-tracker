# My Daily Reset: product scope

My Daily Reset is a local-first planner for building a personal daily rhythm through small, self-chosen actions. It is designed for private use on one device, with a calm, optional interface.

## Product features

- Browse weeks and select days in the recent history window.
- Track daily activity checkmarks and progress; edit activities and choose a morning or evening gym window.
- Keep optional daily notes and mood markers.
- Mark dates in a seven-day digital break and use brief alternative suggestions.
- See one encouraging message per local date.
- Export and import JSON backups for archiving or moving retained data.
- Install as a PWA and use offline after the first successful load.

## Architecture and data

The app is a static Vue 3 and TypeScript application built with Vite. It has no backend, account, analytics, or remote data service. All application data is stored only in browser `localStorage`. The service worker and web manifest provide PWA installation and offline access. Production containers use nginx to serve the static build.

Day records use local calendar dates. The app retains today and the preceding 29 days, removing older records automatically. JSON export includes the data still retained; clearing browser storage removes local data.

## Deferred capabilities

- Accounts, server storage, and cross-device sync.
- Reminders, notifications, and integrations.
- Date picker, charts, and history beyond the retained 30-day window.
- Hosted deployment and release automation.
