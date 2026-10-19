# Stockroom — Stock Trading Simulator

A small virtual stock trading app foundation built with React, Vite, Supabase Auth/PostgreSQL, Supabase Edge Functions, Alpha Vantage, and Recharts. All balances are virtual USD; no real trades are placed. The app starts with a safe setup screen when Supabase configuration is missing.

## Prerequisites and local setup

- Node.js 20.19+ or 22.12+ and npm.
- A Supabase project and an Alpha Vantage API key.
- (Optional for local functions and migration CLI) Supabase CLI and Docker.

```sh
npm install
cp .env.example .env
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` (the Supabase anon key is also accepted as the publishable key). Never put a secret or Alpha Vantage key in a `VITE_` variable. Then run `npm run dev` and open the shown local URL. `npm run build` creates the production bundle; `npm run preview` serves it locally.

## Supabase configuration

1. Apply `supabase/migrations/001_initial_schema.sql` using `supabase db push` after linking the project, or paste it into the Supabase SQL editor. The migration creates the schema, RLS policies, auth trigger, and RPCs.
2. Enable email/password sign-in in Supabase Auth. Configure the allowed redirect URLs for local and deployed app URLs.
3. Set Edge Function secret `ALPHA_VANTAGE_API_KEY` with `supabase secrets set ALPHA_VANTAGE_API_KEY=...`. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions; the service-role key is used only server-side for restricted database RPCs and must never be exposed to browser code.
4. Deploy `stock-price` and `execute-trade` with JWT verification enabled (the default): `supabase functions deploy stock-price` and `supabase functions deploy execute-trade`. For local development, serve the functions with the same JWT verification and local Supabase secrets.
5. Configure the Vercel project root to this repository. Add the two `VITE_` variables to Vercel environment settings and deploy. Never configure a service-role key in the browser.

## Financial security design

`execute-trade` validates the end-user access token, fetches a fresh Alpha Vantage quote server-side, updates the shared market price cache and calls the server-only `execute_trade` RPC. The RPC execution permission is restricted to `service_role`; the Edge Function supplies the user ID only from the verified Auth response and the quote price only from its server-side provider request. Browsers cannot call the RPC or set execution price. Financial rows are locked and all balance, position, transaction, and snapshot changes run in one database transaction. Any trade RPC exception rolls those changes back. The quote cache write happens before the trade and is market data only, so a rejected trade can refresh a quote but cannot change financial records.

`get_portfolio_summary` values a position at its latest known valid cached market price. If no quote exists it uses average_buy_price as a valuation fallback, which keeps the summary available but is not a current market value. The frontend labels holding quotes as unavailable until it fetches quote status; it does not present this fallback as live price data. Alpha Vantage may return delayed daily quote data and has rate limits; the UI should display `price_time` and `fetched_at` when quote display is implemented.

## API and database documentation

- Frontend service parameters, return values, and errors: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)
- Tables, RLS, triggers, RPC rules, and known constraints: [`docs/DATABASE.md`](docs/DATABASE.md)

## Available checks

- `npm run build` — Vite production compilation.
- `npm run dev` — local development server.
- `supabase db push` — applies migrations to a linked Supabase project (requires the CLI and credentials).
- `supabase functions serve` / `supabase functions deploy` — local/deployed Edge Functions (requires CLI, Docker for local mode, and configured secrets).

No database, Auth, Alpha Vantage, deployment, or Edge Function integration has been verified against live external services in this workspace. No automated test suite is included yet.

## Limitations

- This is an MVP foundation, not investment advice or a production financial platform.
- Alpha Vantage quote freshness and request limits depend on the selected provider plan.
- A quote-cache failure rejects quote and trade operations instead of silently substituting a stale execution price.
- The Trade page, Watchlist, and daily historical price chart use `stock-price` with `{ "symbol": "MSFT", "history": true }` for history requests.
- Quote cache reuse is five minutes per symbol. This reduces Alpha Vantage calls but does not promise real-time data. Quote staleness is measured against provider trading date (24 hours); trades always fetch a fresh quote server-side and reject stale provider data.
- Historical charts use Alpha Vantage `TIME_SERIES_DAILY` compact output and display only valid provider points. Provider plan and rate limits determine availability.
- Supabase/Vercel project setup and secrets require operator-provided credentials.
