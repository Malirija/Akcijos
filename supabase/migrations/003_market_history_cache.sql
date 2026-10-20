-- Shared server-side cache for Alpha Vantage daily history responses.
create table if not exists public.market_history_cache (
  symbol text primary key check (symbol ~ '^[A-Z][A-Z0-9.]{0,9}$'),
  data jsonb not null,
  fetched_at timestamptz not null
);

alter table public.market_history_cache enable row level security;
revoke all on public.market_history_cache from anon, authenticated;
grant all on public.market_history_cache to service_role;
