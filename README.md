# RefMap

RefMap turns music references into timestamped creative direction for artists, producers, and engineers. The MVP stores projects, references, and markers in the current browser's local storage.

## Run locally

Requires Node.js 24.x and pnpm 10.26.1.

```sh
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install --frozen-lockfile
PORT=22247 BASE_PATH=/ pnpm --filter @workspace/refmap run dev
```

Open `http://localhost:22247/`.

See [HANDOFF.md](./HANDOFF.md) for the feature status, data model, environment variables, deployment notes, known limitations, and migration guidance.
