-- Stock Trading Simulator schema. Apply with `supabase db push` or the Supabase SQL editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  initial_balance numeric(18,6) not null default 10000 check (initial_balance = 10000),
  cash_balance numeric(18,6) not null default 10000 check (cash_balance >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.watchlist (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.]{0,9}$'), created_at timestamptz not null default now(), unique(user_id,symbol)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.]{0,9}$'), side text not null check (side in ('BUY','SELL')),
  quantity numeric(18,6) not null check (quantity > 0), price numeric(18,6) not null check (price > 0),
  total_amount numeric(18,6) not null check (total_amount > 0), realized_pl numeric(18,6) not null default 0,
  executed_at timestamptz not null default now()
);
create table public.positions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.]{0,9}$'), quantity numeric(18,6) not null check (quantity > 0),
  average_buy_price numeric(18,6) not null check (average_buy_price > 0), updated_at timestamptz not null default now(), unique(user_id,symbol)
);
create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  cash_balance numeric(18,6) not null check (cash_balance >= 0), positions_value numeric(18,6) not null check (positions_value >= 0),
  total_value numeric(18,6) not null, realized_pl numeric(18,6) not null, unrealized_pl numeric(18,6) not null, recorded_at timestamptz not null default now()
);
create table public.market_prices (
  symbol text primary key check (symbol ~ '^[A-Z][A-Z0-9.]{0,9}$'), price numeric(18,6) not null check (price > 0),
  price_time timestamptz not null, fetched_at timestamptz not null
);
create index transactions_user_executed_idx on public.transactions(user_id,executed_at desc);
create index snapshots_user_recorded_idx on public.portfolio_snapshots(user_id,recorded_at desc);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger positions_updated_at before update on public.positions for each row execute function public.set_updated_at();

-- Do not allow a client to change either balance or initial grant through profile updates.
create function public.protect_profile_financial_fields() returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and (new.initial_balance is distinct from old.initial_balance or new.cash_balance is distinct from old.cash_balance) then
    raise exception 'Financial profile fields cannot be changed directly';
  end if;
  return new;
end $$;
create trigger profiles_protect_financial before update on public.profiles for each row execute function public.protect_profile_financial_fields();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare chosen_nickname text;
begin
  chosen_nickname := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'nickname','')),40),'');
  if chosen_nickname is null then chosen_nickname := 'Trader-' || left(replace(new.id::text,'-',''),8); end if;
  insert into public.profiles(id,nickname,initial_balance,cash_balance) values(new.id,chosen_nickname,10000,10000);
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Server-only trade RPC. Its only caller validates the bearer token with Supabase Auth first,
-- then supplies that verified subject. Never expose this RPC to browser roles.
create function public.execute_trade(p_user_id uuid,p_symbol text, p_side text, p_quantity numeric, p_price numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := p_user_id; sym text := upper(trim(p_symbol)); trade_side text := upper(trim(p_side));
  qty numeric(18,6) := round(p_quantity,6); px numeric(18,6) := round(p_price,6); amount numeric(18,6);
  cash numeric(18,6); pos public.positions%rowtype; realized numeric(18,6) := 0; new_qty numeric(18,6);
  new_avg numeric(18,6); position_total numeric(18,6); unrealized numeric(18,6); realized_total numeric(18,6);
  transaction_id uuid; snapshot_id uuid; executed timestamptz := now();
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if sym !~ '^[A-Z][A-Z0-9.]{0,9}$' then raise exception 'Invalid symbol'; end if;
  if trade_side not in ('BUY','SELL') then raise exception 'Side must be BUY or SELL'; end if;
  if qty is null or qty <= 0 or qty > 1000000000 then raise exception 'Quantity must be positive and within supported range'; end if;
  if px is null or px <= 0 then raise exception 'Price must be positive'; end if;
  amount := round(qty * px,6);
  if qty <= 0 or px <= 0 or amount <= 0 then raise exception 'Trade amount is below supported precision'; end if;
  select cash_balance into cash from public.profiles where id=owner_id for update;
  if not found then raise exception 'Profile not found'; end if;
  select * into pos from public.positions where user_id=owner_id and symbol=sym for update;
  if trade_side='BUY' then
    if cash < amount then raise exception 'Insufficient cash'; end if;
    new_qty := round(coalesce(pos.quantity,0)+qty,6);
    new_avg := round((coalesce(pos.quantity,0)*coalesce(pos.average_buy_price,0)+amount)/new_qty,6);
    update public.profiles set cash_balance=round(cash-amount,6) where id=owner_id;
    insert into public.positions(user_id,symbol,quantity,average_buy_price) values(owner_id,sym,new_qty,new_avg)
      on conflict(user_id,symbol) do update set quantity=excluded.quantity,average_buy_price=excluded.average_buy_price,updated_at=now();
  else
    if pos.id is null or pos.quantity < qty then raise exception 'Insufficient shares'; end if;
    realized := round(qty*(px-pos.average_buy_price),6); new_qty := round(pos.quantity-qty,6);
    update public.profiles set cash_balance=round(cash+amount,6) where id=owner_id;
    if new_qty=0 then delete from public.positions where id=pos.id;
    else update public.positions set quantity=new_qty where id=pos.id; end if;
  end if;
  insert into public.transactions(user_id,symbol,side,quantity,price,total_amount,realized_pl,executed_at)
    values(owner_id,sym,trade_side,qty,px,amount,realized,executed) returning id into transaction_id;
  select coalesce(sum(p.quantity*coalesce(mp.price,p.average_buy_price)),0),
         coalesce(sum(p.quantity*(coalesce(mp.price,p.average_buy_price)-p.average_buy_price)),0)
    into position_total,unrealized from public.positions p left join public.market_prices mp on mp.symbol=p.symbol where p.user_id=owner_id;
  select coalesce(sum(realized_pl),0) into realized_total from public.transactions where user_id=owner_id;
  select cash_balance into cash from public.profiles where id=owner_id;
  insert into public.portfolio_snapshots(user_id,cash_balance,positions_value,total_value,realized_pl,unrealized_pl,recorded_at)
    values(owner_id,cash,position_total,cash+position_total,realized_total,unrealized,executed) returning id into snapshot_id;
  return jsonb_build_object('transaction_id',transaction_id,'snapshot_id',snapshot_id,'symbol',sym,'side',trade_side,
    'quantity',qty,'price',px,'total_amount',amount,'realized_pl',realized,'cash_balance',cash,'positions_value',position_total,
    'total_value',cash+position_total,'unrealized_pl',unrealized,'recorded_at',executed);
end $$;
-- Only the Edge Function's server credential can call this RPC. The function still derives
-- ownership from auth.uid() and rejects missing identity. Frontend authenticated users have no EXECUTE.

create function public.get_portfolio_summary()
returns table(cash_balance numeric,positions_value numeric,total_value numeric,realized_pl numeric,unrealized_pl numeric,total_pl numeric)
language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  return query with vals as (
    select p.cash_balance,
      coalesce(sum(pos.quantity*coalesce(mp.price,pos.average_buy_price)),0)::numeric(18,6) as pv,
      coalesce(sum(pos.quantity*(coalesce(mp.price,pos.average_buy_price)-pos.average_buy_price)),0)::numeric(18,6) as upl
    from public.profiles p left join public.positions pos on pos.user_id=p.id
    left join public.market_prices mp on mp.symbol=pos.symbol where p.id=owner_id group by p.cash_balance
  ), realized as (select coalesce(sum(t.realized_pl),0)::numeric(18,6) as rp from public.transactions t where t.user_id=owner_id)
  select vals.cash_balance,vals.pv,vals.cash_balance+vals.pv,realized.rp,vals.upl,realized.rp+vals.upl from vals cross join realized;
end $$;

-- Narrow cache writer for Edge Functions. EXECUTE is limited to Supabase's server role;
-- that credential exists only in Edge Function secrets and never reaches the browser.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create function public.cache_market_price(p_symbol text,p_price numeric,p_price_time timestamptz,p_fetched_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_symbol !~ '^[A-Z][A-Z0-9.]{0,9}$' or p_price is null or p_price<=0 or p_price_time is null or p_fetched_at is null then raise exception 'Invalid market price'; end if;
  insert into public.market_prices(symbol,price,price_time,fetched_at) values(p_symbol,p_price,p_price_time,p_fetched_at)
    on conflict(symbol) do update set price=excluded.price,price_time=excluded.price_time,fetched_at=excluded.fetched_at
    where excluded.fetched_at >= public.market_prices.fetched_at;
end $$;
revoke all on function public.cache_market_price(text,numeric,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.cache_market_price(text,numeric,timestamptz,timestamptz) to service_role;

alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.transactions enable row level security;
alter table public.positions enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.market_prices enable row level security;
create policy "profiles read own" on public.profiles for select to authenticated using(id=auth.uid());
create policy "profiles update nickname only" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "watchlist own access" on public.watchlist for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "transactions read own" on public.transactions for select to authenticated using(user_id=auth.uid());
create policy "positions read own" on public.positions for select to authenticated using(user_id=auth.uid());
create policy "snapshots read own" on public.portfolio_snapshots for select to authenticated using(user_id=auth.uid());
create policy "market prices readable" on public.market_prices for select to authenticated using(price>0);

revoke all on public.profiles,public.watchlist,public.transactions,public.positions,public.portfolio_snapshots,public.market_prices from anon,authenticated;
grant select on public.profiles,public.watchlist,public.transactions,public.positions,public.portfolio_snapshots,public.market_prices to authenticated;
grant update(nickname) on public.profiles to authenticated;
grant insert,delete on public.watchlist to authenticated;
grant execute on function public.get_portfolio_summary() to authenticated;
revoke all on function public.execute_trade(uuid,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.execute_trade(uuid,text,text,numeric,numeric) to service_role;
revoke all on function public.get_portfolio_summary() from public,anon;
