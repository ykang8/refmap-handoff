# RefMap

RefMap turns music references into timestamped creative direction for artists, producers, and engineers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/refmap/src/App.tsx` — routed app shell, local data model, seeded demo data, project/reference/marker flows, Reference Map, and Creative Brief.
- `artifacts/refmap/src/index.css` — RefMap's dark session-notebook visual system and responsive layout rules.
- `artifacts/refmap/.replit-artifact/artifact.toml` — managed web artifact configuration.

## Architecture decisions

- The MVP is local-first: browser localStorage is the persistence layer for projects, references, and markers.
- External music APIs are intentionally not required; Spotify/YouTube URLs are stored as reference links with manual metadata.
- The app keeps the main workflow inside one responsive React artifact with route-level views for workspace, reference player, brief, and settings.

## Product

RefMap provides a project dashboard, reference track library, timestamp marker capture and editing, category filtering, searchable references, a category-based Reference Map, and a copy/share-ready Creative Brief. It includes a seeded Sillage project so the workflow is understandable immediately.

## User preferences

- Dark, restrained, professional music-production-tool aesthetic with responsive mobile navigation.

## Gotchas

- The app stores user data in the current browser only; clearing browser site data removes local projects.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
