# Split the G 🍺

Wedding-bar game: a kiosk iPad on the bar verifies your full pint of Guinness, you take your
drink, and Claude judges whether the beer line split the G. Most Gs split by the end of the
night wins.

## How it works

```
iPad kiosk (Next.js, web/)
  └─ photo → Sanity (attempt document + image asset)
       └─ Sanity Function (functions/judge-pint) fires on create/update
            └─ Claude Haiku judges the photo (vision + structured output)
                 └─ patches the verdict back onto the attempt
  └─ kiosk polls the attempt, shows verdict/banter
TV (/leaderboard) polls a GROQ aggregation every 4s
```

The two-photo rule is enforced in the data model: an attempt needs an approved `fullPintVerdict`
(full, unsipped pint) before the split photo counts. The function's GROQ filter only matches
unjudged photos, so its own patches never re-trigger it.

- **Sanity project:** `ylubxokd` / dataset `production`
- **Function:** `functions/judge-pint` (blueprint in `sanity.blueprint.ts`)
- **Model:** `claude-haiku-4-5` — well under €0.01 per photo

## Setup

```sh
npm install            # blueprint + function deps
cd web && npm install  # kiosk app
```

`web/.env.local` needs `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_WRITE_TOKEN`
(see `.env.example`; a write token lives in Sanity Manage → API → Tokens).

### Deploy the function

```sh
npx sanity@latest blueprints init . --project-id ylubxokd   # first time only, creates .sanity/
npx sanity@latest functions env add judge-pint ANTHROPIC_API_KEY sk-ant-...
npm run deploy:functions
npm run logs   # tail function logs while testing
```

### Run the kiosk

```sh
cd web && npm run dev   # http://localhost:3000 (kiosk) and /leaderboard (TV)
```

Camera access needs HTTPS in Safari, so deploy to Vercel for the real thing
(set the three env vars, add the Vercel URL as a CORS origin in Sanity Manage if you
ever call Sanity from the browser — currently all Sanity calls are server-side).

## Wedding-night checklist

- [ ] Deploy `web/` to Vercel, open the kiosk URL on the iPad, Add to Home Screen
      (full-screen, no Safari chrome), enable Guided Access so guests can't wander off-app
- [ ] Open `/leaderboard` on the TV/laptop behind the bar
- [ ] iPad on venue Wi-Fi **with a 4G hotspot fallback** — the judge needs internet
- [ ] Test with one branded Guinness glass in venue lighting before guests arrive
- [ ] Top up the Anthropic account (a euro or two covers the night)
