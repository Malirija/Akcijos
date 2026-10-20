# Frontend service contract

All money values are USD. Database `NUMERIC` values are returned by Supabase as decimal strings in row objects; callers should parse them for display without using binary floating point for authoritative calculations. Services throw an `Error` on Supabase or Edge Function failure. RLS scopes reads to the authenticated user.

## `src/services/supabaseClient.js`

- `supabase`: configured Supabase client, or `null` when configuration is absent.
- `isSupabaseConfigured`: boolean. The UI uses it to show setup instructions before any API call.

## `src/services/authService.js`

- `register({ email, password, nickname })` → Supabase sign-up data, including `user` and optional `session`. Sends nickname in user metadata; `handle_new_user()` applies a safe fallback and grants USD 10,000. Throws if Auth is unconfigured or signup fails.
- `login({ email, password })` → `{ user, session }`; throws for invalid credentials or configuration.
- `logout()` → resolves after sign-out; throws on error.
- `getSession()` → current session or `null`; throws on session retrieval failure.
- `onSessionChange(callback)` → unsubscribe function. Callback receives session or `null` after auth state changes.

## `src/services/portfolioService.js`

- `getProfile()` → own profile row (`id`, `nickname`, `initial_balance`, `cash_balance`, timestamps).
- `getPositions()` → own positions ordered by symbol (`id`, `symbol`, `quantity`, `average_buy_price`, `updated_at`).
- `getTransactions()` → own append-only transactions newest first, with `side`, `total_amount`, `realized_pl`, and `executed_at`.
- `getSnapshots()` → own portfolio snapshots ordered by `recorded_at` ascending.
- `getPortfolioSummary()` → `cash_balance`, `positions_value`, `total_value`, `realized_pl`, `unrealized_pl`, `total_pl`. Missing cached quote valuation falls back to `average_buy_price`; this is not a current price and must be marked unavailable in UI.
- `getPositionPrices()` → read-only `market_prices` rows (`symbol`, `price`, `price_time`, `fetched_at`) for quote display beside positions. The UI determines quote staleness from `fetched_at` using the documented 24-hour threshold. Missing rows mean the quote and per-position market value/P&L are unavailable; this query does not write prices or alter financial data.
- `getWatchlist()` → own watchlist rows (`id`, `symbol`, `created_at`) ordered by symbol. Reads are scoped to the authenticated user by RLS.

Each method returns the selected Supabase data and throws the Supabase error. Requires an authenticated session and configured client.

## `src/services/tradeService.js`

- `executeTrade({ symbol, side, quantity })` → Edge Function result: transaction and snapshot identifiers, normalized trade fields (`symbol`, `side`, `quantity`, server-derived `price`, `total_amount`, `realized_pl`), updated summary fields, `recorded_at`, and `quote` (`price_time`, `fetched_at`, `stale`). The caller must not send a price or user ID. Throws on auth, quote, validation, or RPC failure; failed RPC trades do not change financial data.

## `src/services/stockPriceService.js`

- `getStockPrice(symbol)` → `{ symbol, price, price_time, fetched_at, stale }` from the authenticated `stock-price` Edge Function. `price_time` is derived from the provider's latest trading date and `stale` is a 24-hour check; provider data can be delayed. Throws on missing configuration, auth, provider, or cache-write errors.

## Edge Function request contracts

- `POST /functions/v1/execute-trade` JSON `{ "symbol": "MSFT", "side": "BUY", "quantity": 1.25 }`; requires Supabase user JWT. Browser supplied price and user ID are ignored/not accepted.
- `POST /functions/v1/stock-price` JSON `{ "symbol": "MSFT" }`; requires Supabase user JWT.

The Edge Functions validate the caller JWT with Supabase Auth. Database quote-cache and trade writes use the Supabase service role only inside Edge Function runtime; clients have no EXECUTE grant on those server RPCs. Never expose the service-role key to the browser.
