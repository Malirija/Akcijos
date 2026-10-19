# Database contract

Apply `supabase/migrations/001_initial_schema.sql` to a Supabase project. Authentication remains in Supabase `auth.users`; the public schema contains only application data.

## Tables

- `profiles`: one row per Auth user. `initial_balance` is constrained to USD 10,000 and `cash_balance` starts at the same value. Clients can read their profile and update only `nickname`; a trigger rejects direct balance/initial grant edits.
- `watchlist`: user-owned uppercase ticker symbols, unique per user and symbol.
- `transactions`: append-only BUY/SELL history with positive fractional quantity and execution price. `total_amount` is computed by PostgreSQL as `round(quantity * price, 6)`; `realized_pl` and `executed_at` are stored alongside it. Clients have read-only grants.
- `positions`: one row per user/symbol with positive open quantity and weighted `average_buy_price`. Clients have read-only grants.
- `portfolio_snapshots`: one row per successful trade, with cash, positions value, total value, realized and unrealized P/L, and `recorded_at`. Clients have read-only grants; there is no snapshot-creation RPC.
- `market_prices`: latest positive price, provider `price_time`, and cache `fetched_at` by symbol. Authenticated users can read only. Edge Functions update through the narrow secret-checked `cache_market_price` function.

All tables have RLS enabled, owner policies use `auth.uid()`, and FK cascades remove user application data when the Auth user is deleted. Timestamp columns use `timestamptz`. Profiles and positions have `updated_at` triggers.

## Functions and trigger

- `handle_new_user()` is a locked-down `SECURITY DEFINER` trigger function on `auth.users`. It chooses a trimmed nickname (up to 40 chars) from Auth metadata or `Trader-<8 id chars>`, then inserts the immutable USD 10,000 starting grant.
- `execute_trade(p_user_id,p_symbol,p_side,p_quantity,p_price)` is a server-only `SECURITY DEFINER` RPC with a fixed search path and EXECUTE granted only to `service_role`. The trade Edge Function validates the caller JWT with Supabase Auth, obtains the user ID from the verified Auth response, obtains a fresh provider quote, and only then calls the RPC. Browser roles cannot call this RPC, so a client cannot supply an arbitrary execution price. It validates inputs, locks the user's profile and relevant position, checks funds/shares, applies weighted-average cost or realized P/L, appends one transaction, and writes one snapshot in the same PostgreSQL transaction. Exceptions roll back all financial writes.
- `get_portfolio_summary()` is a read-only `SECURITY INVOKER` function and returns own balances and P/L. It values positions at latest `market_prices.price` or, if absent, `average_buy_price`; that fallback is not a live market price.
- `set_updated_at()` and `protect_profile_financial_fields()` are trigger helpers with no client execute permission.

Public/anon/authenticated execution of the trade RPC and cache writer is revoked; both grants are restricted to Supabase's `service_role`. The cache writer is a `SECURITY DEFINER` function with a locked-down search path and strict validation. The service-role credential exists only in Edge Function runtime and is never included in browser code.

## Financial precision and limitations

Values use `numeric(18,6)`, and trades have no fees, tax, dividend, short sale, or leverage accounting. Selling the full position deletes the position row; realized gains/losses remain in transactions and summary totals. Quote caching is per symbol, not a historical tick store.
