# RefMap — project handoff

This document describes the code as it exists at handoff time. RefMap is a frontend-first MVP; several unrelated API/database packages in this repository are workspace scaffolding and are not used by the RefMap web app.

## What the app does

RefMap helps artists, producers, and audio engineers turn music references into specific creative direction. A user organizes reference tracks inside a project and captures the exact timestamp, category, what they like, and how they want to use that sound.

### Main flow

1. Open **My Projects** and create or open a project.
2. Add a reference track by entering its title, artist, Spotify/YouTube/other URL, optional artwork URL, and notes.
3. Open the reference view, move the timeline to a moment, and add a timestamped marker.
4. Assign a category and write both “What I like” and “How I want to use it.”
5. Review references in Tracks View, filter by category, or switch to Reference Map to regroup markers by category.
6. Open Creative Brief to review and copy/share the project’s notes.

### Core features present

- Project dashboard with create, rename/edit, open, and delete actions.
- Reference add, edit, and delete flows with manually entered metadata.
- Marker add, edit, and delete flows with categories and MM:SS display.
- Category filtering, reference search, Tracks View, and Reference Map.
- Creative Brief with copy and browser-native share actions.
- Responsive desktop/mobile navigation and a seeded Sillage example project.
- Browser `localStorage` persistence across reloads in the same browser and site origin.

## Technology and exact versions

Versions below are the versions observed in this workspace on October 18, 2026. The committed `pnpm-lock.yaml` is the authoritative exact dependency resolution.

| Area | Technology | Version / status |
|---|---|---|
| Runtime | Node.js | 24.13.0 observed; root package requires `>=24 <25` |
| Package manager | pnpm | 10.26.1 observed and pinned in root `package.json` |
| Language | TypeScript | 5.9.3 |
| Frontend | React / React DOM | 19.1.0 |
| Dev server and bundler | Vite | 7.3.6 |
| React Vite plugin | `@vitejs/plugin-react` | 5.2.0 |
| Styling | Tailwind CSS / `@tailwindcss/vite` | 4.3.3 / 4.3.3 |
| Routing | Wouter | 3.11.0 |
| Icons | lucide-react | 0.545.0 |
| Query provider | TanStack React Query | 5.102.8; provider is present, but RefMap does not use it for application data |
| API scaffolding | Express | 5.2.1; separate health-check service, not used by RefMap |
| Database scaffolding | Drizzle ORM / node-postgres (`pg`) | 0.45.2 / 8.23.0; no RefMap database tables or runtime DB calls |
| Validation scaffolding | Zod | 3.25.76 |

The main app also uses the installed Radix UI packages through scaffolded UI components. Its package manifest contains additional generated/template dependencies; exact direct and transitive resolutions are recorded in `pnpm-lock.yaml`.

## Repository structure

### Root

- `package.json` — workspace scripts, Node/pnpm version expectations, and root tooling.
- `pnpm-workspace.yaml` — workspace membership, shared dependency catalog, and pnpm overrides.
- `pnpm-lock.yaml` — exact resolved dependency graph; use frozen installs when possible.
- `.npmrc` — pnpm peer-dependency behavior.
- `tsconfig.base.json`, `tsconfig.json` — shared TypeScript compiler settings and library project references.
- `.replit` — Replit Node selection, deployment target, run button, and post-merge hook configuration.
- `.replitignore` — files omitted from Replit deployment packaging.
- `replit.md` — Replit workspace notes about commands and product structure.
- `.env.example` — environment variable names and placeholders for local setup.
- `README.md` — short entry point for developers.
- `HANDOFF.md` — this migration and maintenance guide.

### RefMap web app: `artifacts/refmap/`

- `.replit-artifact/artifact.toml` — Replit artifact route, development command, and static production build/SPA rewrite settings.
- `package.json` — app scripts and direct frontend dependencies.
- `vite.config.ts` — Vite setup; requires `PORT` and `BASE_PATH`, and conditionally loads Replit-only development plugins when `REPL_ID` exists.
- `index.html` — HTML entry point, title, metadata, favicon, and font preconnects.
- `public/favicon.svg`, `public/robots.txt` — static public assets.
- `src/main.tsx` — React entry point, global stylesheet import, and top-level error boundary.
- `src/App.tsx` — routes, data types, Sillage seed data, localStorage persistence, application shell, and project/reference/marker/map/brief/settings flows.
- `src/index.css` — RefMap theme, typography, component styles, and responsive rules. It imports Manrope, Space Grotesk, and DM Mono from Google Fonts.
- `src/components/error-boundary.tsx` — route/application error boundary.
- `src/components/ui/` — scaffolded reusable UI components; many are not currently used by RefMap.
- `src/hooks/use-toast.ts`, `src/components/ui/toaster.tsx` — toast support.
- `src/hooks/use-mobile.tsx` — scaffolded mobile breakpoint hook.
- `src/lib/utils.ts` — shared UI helper utilities.
- `src/pages/not-found.tsx` — not-found view.

### Separate API scaffold: `artifacts/api-server/`

- `.replit-artifact/artifact.toml` — Replit `/api` service configuration.
- `package.json`, `build.mjs`, `tsconfig.json` — service dependencies, build, and typecheck configuration.
- `src/index.ts` — starts the Express service using `PORT`.
- `src/app.ts` — Express setup and `/api` route mounting.
- `src/routes/index.ts` — API route registry.
- `src/routes/health.ts` — the only current route, `GET /api/healthz`.
- `src/lib/logger.ts` — Pino logger configured by `NODE_ENV` and `LOG_LEVEL`.

This API is not called by RefMap and does not provide project/reference/marker CRUD.

### Shared workspace libraries and tools

- `lib/api-spec/openapi.yaml` — OpenAPI contract for the health endpoint.
- `lib/api-spec/orval.config.ts` — generated API client/schema configuration.
- `lib/api-client-react/src/` — generated React API client and fetch helper; not used by RefMap flows.
- `lib/api-zod/src/` — generated Zod schemas used by the API health route.
- `lib/db/src/index.ts` — PostgreSQL/Drizzle connection helper; requires `DATABASE_URL` if imported.
- `lib/db/src/schema/index.ts` — empty schema export; there are currently no tables.
- `lib/db/drizzle.config.ts` — Drizzle Kit configuration; requires `DATABASE_URL` for DB tooling.
- `artifacts/mockup-sandbox/` — Replit Design Canvas component preview app, not needed to run RefMap.
- `scripts/post-merge.sh`, `scripts/src/hello.ts` — workspace maintenance/demo scripts.

## Install and run outside Replit

The simplest local workflow needs Node.js 24 and pnpm 10.26.1. No database, API key, login provider, or third-party account is required to run RefMap.

1. Clone or copy the complete repository. Keep the root `pnpm-workspace.yaml`, all package manifests, and `pnpm-lock.yaml`; the app is a pnpm workspace package.
2. Install Node.js 24.x.
3. Enable Corepack and activate the pinned pnpm version:

   ```sh
   corepack enable
   corepack prepare pnpm@10.26.1 --activate
   ```

4. From the repository root, install dependencies:

   ```sh
   pnpm install --frozen-lockfile
   ```

5. Optionally copy `.env.example` to `.env`. The Vite config reads `PORT` and `BASE_PATH` while the config is evaluated, so for the reliable local command, set them in the shell (do not assume Vite will load them from `.env` early enough):

   ```sh
   PORT=22247 BASE_PATH=/ pnpm --filter @workspace/refmap run dev
   ```

6. Open `http://localhost:22247/`.

To typecheck or make a production static build:

```sh
pnpm --filter @workspace/refmap run typecheck
PORT=22247 BASE_PATH=/ pnpm --filter @workspace/refmap run build
```

The static output is `artifacts/refmap/dist/public/`. A non-Replit static host should serve that directory and rewrite unknown application routes to `/index.html` for direct navigation/refreshes. RefMap currently uses a root base path (`BASE_PATH=/`); hosting under a URL subpath needs a matching base path and should be checked for root-absolute asset URLs.

The separate health-only API scaffold can be started with `PORT=8080 pnpm --filter @workspace/api-server run dev`. It serves `GET /api/healthz`; it is not required by RefMap. `DATABASE_URL` is only needed if the database helper or Drizzle tooling is used.

## Environment variables and secrets

### RefMap

| Name | Required? | Purpose |
|---|---|---|
| `PORT` | Yes for Vite dev/build config | Port for Vite; Replit provides a fixed artifact port, while local commands can use `22247`. |
| `BASE_PATH` | Yes for Vite config | Vite asset/router base path. Use `/` for a root-hosted app. |
| `NODE_ENV` | No | Vite plugin gating; normally supplied by the command/runtime. |
| `REPL_ID` | No; leave unset outside Replit | Enables Replit Cartographer/dev-banner plugins only when present during development. |

### Other workspace packages

| Name | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | No for RefMap; required by DB helper/Drizzle config | PostgreSQL connection string for the separate, currently unused `@workspace/db` package. No schema tables currently exist. |
| `LOG_LEVEL` | No | Pino log level for the separate Express API scaffold; defaults to `info`. |
| `PORT` | Yes if running the API server | API listener port; Replit config uses `8080`. |
| `NODE_ENV` | No | Selects API logger formatting/behavior. |

No secret is required by RefMap. A Replit `SESSION_SECRET` was available in the original environment but is not referenced by the current code; do not create or migrate it unless future code actually uses it. `.env.example` deliberately contains placeholders only. Do not commit a real `.env` file or credentials.

## Data model and persistence

There is no application database schema. RefMap stores a JSON array under the browser localStorage key `refmap-projects-v1`.

- **Project**: `id`, `title`, `artist`, `description`, `references`, `createdAt`, `updatedAt`.
- **Reference** (nested in a project): `id`, `title`, `artist`, `url`, `artwork`, `notes`, `markers`.
- **Marker** (nested in a reference): `id`, `timestamp` (number of seconds), `category`, `whatILike`, `howIWantToUseIt`, `createdAt`.
- **Relationships**: a project contains references; a reference contains markers. These are nested JSON arrays, not relational tables.
- **Categories**: Vocal, Drums, Bass, Guitar, Instruments, Arrangement, Mix, Mood, Other.

The first run seeds the Sillage demo project when this storage key is absent. Data is scoped to the current browser profile and exact site origin. It is not shared across users/devices, not backed up to a server, and is not automatically transferred to a new domain. The app has no complete project JSON export/import feature.

The separate `lib/db` package uses PostgreSQL through `pg` and Drizzle ORM, but `lib/db/src/schema/index.ts` exports no tables. The API server currently only exposes health status.

## External APIs and services

- **No external music API is called.** Spotify, YouTube, and other track URLs are stored as links entered by users; RefMap does not authenticate to those services or fetch their metadata.
- **Reference URLs** are opened as external links from the reference view in `artifacts/refmap/src/App.tsx`.
- **Artwork URLs** are rendered as browser `<img>` sources from that same file; image requests go directly from the browser to the supplied host.
- **Google Fonts** are loaded by the stylesheet import in `artifacts/refmap/src/index.css` and font links in `artifacts/refmap/index.html`. Offline use or a strict CSP may require self-hosting those fonts.
- **Clipboard and share** use browser-native `navigator.clipboard.writeText` and `navigator.share` in the Creative Brief view in `artifacts/refmap/src/App.tsx`; these are not server APIs.
- The separate API's `GET /api/healthz` is internal application scaffolding, not a third-party service.

## Replit-specific pieces and outside replacements

- Root `.replit` selects Node 24, configures the Replit workflow/deployment target, and runs a post-build pnpm store prune. None is needed for a local Node/pnpm workflow; use the root package scripts directly.
- `artifacts/refmap/.replit-artifact/artifact.toml` defines Replit preview routing, injected `PORT`/`BASE_PATH`, static production output, and SPA rewrites. Replace it with the hosting provider's static build/output/fallback configuration.
- The RefMap Vite config conditionally loads Replit development plugins when `REPL_ID` is defined. Outside Replit leave `REPL_ID` unset; the core Vite app does not depend on those plugins.
- No Replit Database, Replit Auth, Object Storage, or Replit integration is used by RefMap. The separate empty Drizzle package is not a Replit Database integration.
- The only available Replit secret, `SESSION_SECRET`, is unused by current code. No secret replacement is needed for the present app.
- The current published Replit URL was `https://ref-map-creative-reference-workspace--Yeonsuk.replit.app`; it belongs to the Replit deployment and is not a portable URL. Publish the static build with another host to receive a new URL.
- `artifacts/api-server/.replit-artifact/artifact.toml` is for the separate API service; there is no reason to migrate or host it for current RefMap features.

## Current status

### Finished and working

- RefMap dashboard and seeded demo project.
- Project create/edit/delete and reference add/edit/delete.
- Marker add/edit/delete, timestamp entry/display, and category assignment.
- Category-based filtering, Tracks View, and Reference Map.
- Creative Brief display, copy, and browser-share actions.
- Responsive desktop and mobile shell.
- Browser localStorage persistence.
- Last recorded verification: app typecheck passed, Vite production build completed, workflow started, and desktop/mobile previews rendered.

### Partially implemented or not implemented

- The reference player is a visual timestamping control, not an audio player. “Play preview” only toggles its button state; it does not play the linked track. The timeline uses a hard-coded 264-second duration and does not follow the external music player.
- Search currently matches reference title, artist, and reference notes only. It does not search marker note text.
- Creative Brief shows markers in a list/table with category labels; it is not organized into category-grouped sections.
- Share is browser-native text sharing/copy fallback, not a public share link or collaboration system.
- No authentication, server-side persistence, team workspace, real-time collaboration, or cross-device sync.
- No automated test suite is present in the RefMap package.

### Broken / known issues

- No known startup failure was observed at handoff. Typecheck and production build succeeded.
- `artifacts/refmap/index.html` still has generic “built on Replit” description/Open Graph text despite the RefMap title; this can produce misleading browser/social metadata.
- The build has emitted a non-fatal source-map warning for the scaffolded tooltip component (`Can't resolve original location of error`); the build still completes.
- Creative Brief copy catches clipboard errors silently and still displays “Creative brief copied,” so the confirmation can be inaccurate when browser clipboard access is blocked.
- Seed reference URLs point to generic platform homepages rather than the exact demo songs.
- localStorage JSON is parsed without schema validation. Browser storage clearing, storage quota, or malformed data can prevent a user's saved data from loading as expected.

## Suggested next steps

1. Decide whether RefMap should remain a local single-user tool or support server-side storage and accounts.
2. Add project data export/import before migrating a user's browser-local data to a different origin.
3. Implement reference search across marker note fields.
4. Group Creative Brief content by category and improve clipboard failure feedback.
5. Decide on audio behavior: embed/launch the external player with a documented timestamp workflow, or integrate a supported preview source and synchronize the in-app timeline. An app cannot seek arbitrary Spotify/YouTube tracks without the relevant integration and provider restrictions.
6. Update HTML description/Open Graph metadata and replace generic demo URLs with precise reference links.
7. Add tests around project/reference/marker CRUD, persistence, filtering, brief generation, and share/copy fallbacks.
8. If server persistence is selected, design a real relational schema and migration plan; the current Drizzle schema is empty.
9. Configure the chosen non-Replit static host to build `artifacts/refmap` and support SPA route fallback.

## Important design decisions and workarounds

- **Local-first persistence** was chosen to keep the MVP usable without account setup, backend CRUD, or third-party API credentials. The tradeoff is browser/origin-local data with no sync or automatic migration.
- **Manual reference metadata** avoids dependence on Spotify/YouTube APIs and authentication. URLs are links only.
- **The player timeline is a marker-positioning aid**, not an audio transport. It makes timestamp notes possible without claiming unsupported external playback control; the “Play preview” label is currently misleading and should be corrected when audio behavior is addressed.
- **The app and API scaffold are separate.** RefMap does not call generated API hooks; the API currently supplies only health status. Do not assume that starting the API enables server persistence.
- **Root-hosted Vite base path** is the current deployment assumption. For a subpath deployment, set `BASE_PATH` to the actual prefix and check favicon and other absolute URLs as well as SPA rewrites.
- **Package declarations use ranges/catalog aliases**, while `pnpm-lock.yaml` records exact package versions. Use `pnpm install --frozen-lockfile` and keep the lockfile with the manifests.
