# Auto Beli

Bring photos to the final Beli ranking screen.

## Requirements

- Node.js 22 or newer
- `GOOGLE_MAPS_PLACES_API_KEY`
- `OPENROUTER_API_KEY`
- Optional: Codex CLI 0.144.0 or newer, installed and authenticated

## Run locally

```bash
nvm use
pnpm i
pnpm dev
```

Labeling runs locally through `app/api/label/route.ts`. The route checks for a
compatible local Codex CLI first and uses GPT-5.6 Luna at medium reasoning. If
Codex is unavailable or incompatible, it uses `openai/gpt-5.6-luna` through
OpenRouter.

Each click of Label creates `logs/<run-id>/`. Logs include the
Places request/result, runtime selection, model result, and errors. Image bytes
are intentionally omitted. Browser progress and a copy of each successful run
are saved in IndexedDB until Clear is confirmed.

## Places search

The app uses Nearby Search (New) with a 150 meter circular location
restriction, distance ranking, 20 results, and 50 broad food, drink, venue,
lodging, retail, and travel types. The complete request schema also exposes the
API's language, region, included/excluded types, included/excluded primary
types, result count, location restriction, ranking, routing, and
future-business parameters in `app/lib/stack-schema.ts`.
