# RefMap

**Live demo:** https://ykang8.github.io/refmap-handoff/

RefMap turns music references into timestamped creative direction for artists, producers, and engineers. Add reference tracks to a project (YouTube links or your own audio files), drop markers at the exact moments that matter while you listen, and turn them into a Creative Brief.

It is a static, single-page web app: no backend, no login, no database. Demo data is hard-coded; your changes stay in this browser (local storage for projects, IndexedDB for uploaded audio).

## Features

- **Projects:** create, edit, delete
- **References:** add, edit, delete. Choose a source: a YouTube link (plays in an embedded player) or an uploaded audio file (MP3, WAV, M4A, OGG, FLAC; up to 150 MB) with a waveform. Other links open in a new tab.
- **Markers:** capture the current playback time, pick a category, and note "What I like" and "How I'll use it". Markers appear as colour-coded pins on the timeline; click a pin or a marker's time to jump there. Shortcuts: Space (play/pause), M (add marker), ←/→ (seek 5 s).
- **Tracks view:** search and category filters
- **Reference map:** grouped by track or by category; clicking a marker opens the track at that moment
- **Creative Brief:** grouped by track; copy to clipboard or share
- **Settings:** add or restore the demo project, or delete all projects

## Requirements checklist

| Requirement | How RefMap meets it |
|---|---|
| Static HTML/CSS/JS | `pnpm build` outputs plain `index.html`, CSS, and JS to `artifacts/refmap/dist/public/`, with relative asset paths. |
| Single page | One page. Views switch with hash routes (`#/projects/...`), so refreshes and deep links work on any static host. |
| No backend | No server code; nothing is sent to a server. YouTube videos stream from YouTube. |
| No auth | No accounts or login. |
| No database | Demo data lives in `src/App.tsx` (`seedProjects`); edits are saved to browser `localStorage`, and uploaded audio files to the browser's IndexedDB. Nothing leaves the browser. |
| Hard-coded data | Demo project "Night Transit" with three official YouTube videos (YOASOBI, Eve, なとり) and ten markers. |
| Every button works | Every control has a real action. References without a playable YouTube link show a manual timeline instead of a fake play button. |
| All states | Success and error toasts, inline form validation (including unsupported or oversized audio files), in-app confirmation dialogs, empty states (projects, references, search, map, brief, markers), loading and unavailable states for YouTube and audio (including an audio file missing from this browser, with a re-attach button), and not-found pages. |

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
  src/components/timeline.tsx   seekable timeline: waveform, marker pins, playhead, keyboard control
  src/lib/youtube.ts            YouTube link parsing and IFrame API loader
  src/lib/audio-store.ts        IndexedDB storage and validation for uploaded audio
  src/hooks/use-youtube-player.ts  embedded YouTube player state (time, duration, play/pause/seek)
  src/hooks/use-audio-player.ts    uploaded-audio playback and waveform peaks
```

Built with React 19, TypeScript, Vite 7, and Tailwind CSS 4. The project started on Replit; Replit-specific configuration, the unused API server, and the database scaffolding have been removed.
