-- ============================================================================
-- Casino (points only). Points are internal promotional points with no
-- monetary value: they cannot be bought, withdrawn or exchanged. Bets debit and
-- credit daily_faucet_accounts.points but never touch reward_ledger, so levels,
-- achievements and the monthly leaderboard keep measuring earned points only.
--
-- Provably fair: every outcome is derived from
--   HMAC_SHA256(key = server_seed, message = client_seed || ':' || nonce || ':' || cursor)
-- split into 4-byte floats in [0, 1). The SHA-256 of the server seed is shown
-- before playing; rotating the seed reveals it so players can verify past bets.
-- ============================================================================

create table if not exists public.casino_seeds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  server_seed text not null,
  server_seed_hash text not null,
  client_seed text not null,
  nonce bigint not null default 0 check (nonce >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.casino_revealed_seeds (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  server_seed text not null,
  server_seed_hash text not null,
  client_seed text not null,
  bets_count bigint not null,
  revealed_at timestamptz not null default now()
);

create index if not exists casino_revealed_seeds_user_idx
  on public.casino_revealed_seeds (user_id, revealed_at desc);

create table if not exists public.casino_bets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in (
    'dice', 'limbo', 'crash', 'coinflip', 'roulette', 'slots',
    'plinko', 'keno', 'wheel', 'mines', 'hilo', 'blackjack'
  )),
  bet integer not null check (bet > 0),
  payout integer not null check (payout >= 0),
  multiplier numeric(14, 4) not null check (multiplier >= 0),
  params jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  server_seed_hash text not null,
  client_seed text not null,
  nonce bigint not null,
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index if not exists casino_bets_user_created_idx
  on public.casino_bets (user_id, created_at desc, id desc);

create table if not exists public.casino_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('mines', 'hilo', 'blackjack')),
  bet integer not null check (bet > 0),
  state jsonb not null,
  server_seed_hash text not null,
  client_seed text not null,
  nonce bigint not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists casino_sessions_one_active_idx
  on public.casino_sessions (user_id, game) where active;

alter table public.casino_seeds enable row level security;
alter table public.casino_revealed_seeds enable row level security;
alter table public.casino_bets enable row level security;
alter table public.casino_sessions enable row level security;

revoke all on public.casino_seeds, public.casino_revealed_seeds, public.casino_bets, public.casino_sessions
  from public, anon, authenticated;
grant select on public.casino_bets, public.casino_revealed_seeds to authenticated;

create policy "Users can read their own casino bets"
  on public.casino_bets for select
  using ((select auth.uid()) = user_id);

create policy "Users can read their own revealed casino seeds"
  on public.casino_revealed_seeds for select
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Randomness
-- ---------------------------------------------------------------------------
create or replace function public.casino_floats(p_server_seed text, p_client_seed text, p_nonce bigint, p_count integer)
returns double precision[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out double precision[] := '{}';
  v_cursor integer := 0;
  v_digest bytea;
  v_i integer;
begin
  while cardinality(v_out) < p_count loop
    v_digest := extensions.hmac(
      convert_to(p_client_seed || ':' || p_nonce || ':' || v_cursor, 'UTF8'),
      convert_to(p_server_seed, 'UTF8'),
      'sha256'
    );
    for v_i in 0..7 loop
      exit when cardinality(v_out) >= p_count;
      v_out := v_out || (
        get_byte(v_digest, v_i * 4)::double precision / 256
        + get_byte(v_digest, v_i * 4 + 1)::double precision / 65536
        + get_byte(v_digest, v_i * 4 + 2)::double precision / 16777216
        + get_byte(v_digest, v_i * 4 + 3)::double precision / 4294967296
      );
    end loop;
    v_cursor := v_cursor + 1;
  end loop;
  return v_out;
end;
$$;

create or replace function public.casino_hash(p_seed text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_seed, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.casino_ensure_seed(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seed text;
begin
  if exists (select 1 from public.casino_seeds as s where s.user_id = p_user) then
    return;
  end if;
  v_seed := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.casino_seeds (user_id, server_seed, server_seed_hash, client_seed)
  values (p_user, v_seed, public.casino_hash(v_seed), encode(extensions.gen_random_bytes(8), 'hex'))
  on conflict (user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bet lifecycle helpers (not callable by clients)
-- ---------------------------------------------------------------------------
create or replace function public.casino_begin(
  p_bet integer,
  out o_user uuid,
  out o_balance integer,
  out o_server_seed text,
  out o_hash text,
  out o_client_seed text,
  out o_nonce bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  o_user := (select auth.uid());
  if o_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select u.email_confirmed_at is not null from auth.users as u where u.id = o_user), false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;

  if p_bet is null or p_bet < 1 or p_bet > 100000 then
    raise exception 'Invalid bet' using errcode = '22023';
  end if;

  insert into public.daily_faucet_accounts (user_id)
  values (o_user)
  on conflict (user_id) do nothing;

  o_balance := (
    select a.points
    from public.daily_faucet_accounts as a
    where a.user_id = o_user
    for update
  );
  if o_balance < p_bet then
    raise exception 'Insufficient balance' using errcode = 'P0001';
  end if;

  perform public.casino_ensure_seed(o_user);

  update public.casino_seeds as s
  set nonce = s.nonce + 1
  where s.user_id = o_user
  returning s.server_seed, s.server_seed_hash, s.client_seed, s.nonce - 1
  into o_server_seed, o_hash, o_client_seed, o_nonce;
end;
$$;

-- Maximum points a single bet can pay out.
create or replace function public.casino_payout(p_bet integer, p_multiplier numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(floor(p_bet * p_multiplier), 1000000)::integer;
$$;

create or replace function public.casino_adjust_balance(p_user uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  update public.daily_faucet_accounts as a
  set points = (a.points::bigint + p_delta)::integer,
      updated_at = now()
  where a.user_id = p_user
  returning a.points into v_balance;
  if v_balance is null or v_balance < 0 then
    raise exception 'Insufficient balance' using errcode = 'P0001';
  end if;
  return v_balance;
end;
$$;

create or replace function public.casino_settle(
  p_user uuid,
  p_game text,
  p_bet integer,
  p_payout integer,
  p_multiplier numeric,
  p_params jsonb,
  p_result jsonb,
  p_hash text,
  p_client_seed text,
  p_nonce bigint,
  p_already_debited boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_id bigint;
begin
  v_balance := public.casino_adjust_balance(
    p_user,
    p_payout - case when p_already_debited then 0 else p_bet end
  );

  insert into public.casino_bets (
    user_id, game, bet, payout, multiplier, params, result,
    server_seed_hash, client_seed, nonce, balance_after
  )
  values (
    p_user, p_game, p_bet, p_payout, p_multiplier,
    coalesce(p_params, '{}'::jsonb), coalesce(p_result, '{}'::jsonb),
    p_hash, p_client_seed, p_nonce, v_balance
  )
  returning id into v_id;

  return jsonb_build_object(
    'bet_id', v_id,
    'game', p_game,
    'bet', p_bet,
    'payout', p_payout,
    'profit', p_payout - p_bet,
    'multiplier', p_multiplier,
    'win', p_payout > p_bet,
    'balance', v_balance,
    'params', p_params,
    'result', p_result,
    'nonce', p_nonce,
    'server_seed_hash', p_hash,
    'client_seed', p_client_seed
  );
end;
$$;

revoke all on function public.casino_floats(text, text, bigint, integer) from public, anon, authenticated;
revoke all on function public.casino_hash(text) from public, anon, authenticated;
revoke all on function public.casino_ensure_seed(uuid) from public, anon, authenticated;
revoke all on function public.casino_begin(integer) from public, anon, authenticated;
revoke all on function public.casino_payout(integer, numeric) from public, anon, authenticated;
revoke all on function public.casino_adjust_balance(uuid, integer) from public, anon, authenticated;
revoke all on function public.casino_settle(uuid, text, integer, integer, numeric, jsonb, jsonb, text, text, bigint, boolean) from public, anon, authenticated;
