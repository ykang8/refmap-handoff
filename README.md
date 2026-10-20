# RefMap

RefMap turns music references into timestamped creative direction for artists, producers, and engineers. Add reference tracks to a project, play YouTube references inside the app, drop markers at the exact moments that matter, and turn them into a Creative Brief.

It is a static, single-page web app: no backend, no login, no database. Demo data is hard-coded and your changes are kept in the browser's local storage.

## Features

- **Projects:** create, edit, delete
- **References:** add, edit, delete. YouTube links play in an embedded player; other links open in a new tab.
- **Markers:** capture the current playback time, pick a category, and note "What I like" and "How I want to use it". Click a marker's time to jump the video there.
- **Tracks view:** search and category filters
- **Reference map:** grouped by track (01, 02, 03…) or by category
- **Creative Brief:** copy to clipboard or share
- **Settings:** add or restore the demo project, or delete all projects

## Requirements checklist

| Requirement | How RefMap meets it |
|---|---|
| Static HTML/CSS/JS | `pnpm build` outputs plain `index.html`, CSS, and JS to `artifacts/refmap/dist/public/`, with relative asset paths. |
| Single page | One page. Views switch with hash routes (`#/projects/...`), so refreshes and deep links work on any static host. |
| No backend | No server code; nothing is sent to a server. YouTube videos stream from YouTube. |
| No auth | No accounts or login. |
| No database | Demo data lives in `src/App.tsx` (`seedProjects`); edits are saved to browser `localStorage`. |
| Hard-coded data | Demo project "Night Transit" with three official YouTube videos (YOASOBI, Eve, なとり) and ten markers. |
| Every button works | Every control has a real action. References without a playable YouTube link show a manual timeline instead of a fake play button. |
| All states | Success and error toasts, inline form validation errors, in-app confirmation dialogs, empty states (dashboard, project, map, brief, reference), loading and unavailable states for the YouTube player, and not-found pages. |

## Run locally

Requires Node.js 24.x and pnpm 10.26.1.

```sh
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:22247/`. No `.env` is required. `.env.example` lists the two optional settings: `PORT` and `BASE_PATH`.

## Build and deploy

```sh
pnpm build     # typecheck, then build to artifacts/refmap/dist/public
pnpm preview   # serve the built files locally
```

Upload the contents of `artifacts/refmap/dist/public/` to any static host, such as GitHub Pages or Netlify. No rewrite rules are needed: assets use relative paths and routing uses the URL hash, so the app also works from a sub-path like `https://<user>.github.io/<repo>/`.

## Project structure

```
artifacts/refmap/
  index.html                    page shell and metadata
  src/main.tsx                  entry point
  src/App.tsx                   views, data model, demo data, local storage
  src/index.css                 visual design and responsive layout
  src/lib/youtube.ts            YouTube link parsing and IFrame API loader
  src/hooks/use-youtube-player.ts  embedded player state (time, duration, play/pause/seek)
```

Built with React 19, TypeScript, Vite 7, and Tailwind CSS 4. The project started on Replit; Replit-specific configuration, the unused API server, and the database scaffolding have been removed.
