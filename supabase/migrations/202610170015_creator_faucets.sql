-- Creator faucets: users run their own faucets on FaucetFree, funded and paid out
-- from their own FaucetPay account. FaucetFree never holds those funds: each claim
-- is a FaucetPay payout from the creator's faucet balance straight to the claimer.
--
-- The platform earns from a share of the ad impressions on every faucet page and,
-- once enabled by an admin, a fee per payout sent from the creator's faucet to the
-- platform's own FaucetPay account. Amounts are integers in 1e-8 units ("satoshi"),
-- as the FaucetPay API expects for every currency.
--
-- API keys live in Supabase Vault; only the edge functions (service role) can read them.

-- ---------------------------------------------------------------------------
-- Platform settings (single row)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  fee_bps integer not null default 500 check (fee_bps between 0 and 3000),
  fee_enabled boolean not null default false,
  fee_recipient text check (char_length(fee_recipient) <= 120),
  ad_share_pct integer not null default 30 check (ad_share_pct between 0 and 100),
  platform_ad_unit text check (platform_ad_unit ~ '^[0-9]{3,12}$'),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Faucets
-- ---------------------------------------------------------------------------
create table if not exists public.faucets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 300),
  currency text not null check (currency in ('BTC', 'ETH', 'DOGE', 'LTC', 'BCH', 'DASH', 'DGB', 'TRX', 'USDT', 'ZEC', 'BNB', 'SOL', 'XRP', 'TON')),
  reward bigint not null check (reward between 1 and 100000000),
  interval_minutes integer not null default 60 check (interval_minutes between 5 and 1440),
  daily_limit integer not null default 24 check (daily_limit between 1 and 288),
  ad_unit text check (ad_unit ~ '^[0-9]{3,12}$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'banned')),
  status_reason text check (char_length(status_reason) <= 200),
  api_key_secret uuid,
  last_balance bigint,
  balance_checked_at timestamptz,
  claims_count integer not null default 0,
  paid_total bigint not null default 0,
  fees_total bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faucets_owner_idx on public.faucets (owner_id);
create index if not exists faucets_status_claims_idx on public.faucets (status, claims_count desc);

alter table public.faucets enable row level security;
revoke all on public.faucets from public, anon, authenticated;

create table if not exists public.faucet_claims (
  id bigint generated always as identity primary key,
  faucet_id uuid not null references public.faucets (id) on delete cascade,
  address text not null check (char_length(address) between 3 and 120),
  ip_hash text not null,
  currency text not null,
  amount bigint not null check (amount > 0),
  fee_amount bigint not null default 0 check (fee_amount >= 0),
  fee_recipient text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payout_id text,
  payout_user_hash text,
  fee_status text not null default 'none' check (fee_status in ('none', 'paid', 'failed')),
  fee_payout_id text,
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists faucet_claims_faucet_created_idx on public.faucet_claims (faucet_id, created_at desc);
create index if not exists faucet_claims_address_idx on public.faucet_claims (faucet_id, address, created_at desc);
create index if not exists faucet_claims_ip_idx on public.faucet_claims (faucet_id, ip_hash, created_at desc);
create index if not exists faucet_claims_status_idx on public.faucet_claims (status, created_at desc);

alter table public.faucet_claims enable row level security;
revoke all on public.faucet_claims from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public reads
-- ---------------------------------------------------------------------------
create or replace function public.list_public_faucets(p_currency text default null, p_limit integer default 60)
returns table (
  slug text, name text, description text, currency text, reward bigint, interval_minutes integer,
  daily_limit integer, claims_count integer, paid_total bigint, funded boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.slug, f.name, f.description, f.currency, f.reward, f.interval_minutes, f.daily_limit,
    f.claims_count, f.paid_total, coalesce(f.last_balance, 0) >= f.reward, f.created_at
  from public.faucets as f
  where f.status = 'active' and f.api_key_secret is not null
    and (p_currency is null or f.currency = p_currency)
  order by (coalesce(f.last_balance, 0) >= f.reward) desc, f.claims_count desc, f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

create or replace function public.get_public_faucet(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', f.slug, 'name', f.name, 'description', f.description, 'currency', f.currency,
    'reward', f.reward, 'interval_minutes', f.interval_minutes, 'daily_limit', f.daily_limit,
    'status', f.status, 'ready', f.status = 'active' and f.api_key_secret is not null,
    'funded', coalesce(f.last_balance, 0) >= f.reward,
    'claims_count', f.claims_count, 'paid_total', f.paid_total,
    'ad_unit', f.ad_unit, 'platform_ad_unit', s.platform_ad_unit, 'ad_share_pct', s.ad_share_pct
  )
  from public.faucets as f
  cross join public.platform_settings as s
  where f.slug = lower(p_slug) and f.status <> 'banned';
$$;

revoke all on function public.list_public_faucets(text, integer) from public;
revoke all on function public.get_public_faucet(text) from public;
grant execute on function public.list_public_faucets(text, integer) to anon, authenticated;
grant execute on function public.get_public_faucet(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creator management
-- ---------------------------------------------------------------------------
create or replace function public.faucet_owner_view(p_faucet public.faucets)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_faucet.id, 'slug', p_faucet.slug, 'name', p_faucet.name, 'description', p_faucet.description,
    'currency', p_faucet.currency, 'reward', p_faucet.reward, 'interval_minutes', p_faucet.interval_minutes,
    'daily_limit', p_faucet.daily_limit, 'ad_unit', p_faucet.ad_unit, 'status', p_faucet.status,
    'status_reason', p_faucet.status_reason, 'has_key', p_faucet.api_key_secret is not null,
    'last_balance', p_faucet.last_balance, 'balance_checked_at', p_faucet.balance_checked_at,
    'claims_count', p_faucet.claims_count, 'paid_total', p_faucet.paid_total, 'fees_total', p_faucet.fees_total,
    'created_at', p_faucet.created_at
  );
$$;

revoke all on function public.faucet_owner_view(public.faucets) from public, anon, authenticated;

create or replace function public.my_faucets()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'faucets', coalesce((
      select jsonb_agg(public.faucet_owner_view(f) order by f.created_at desc)
      from public.faucets as f where f.owner_id = v_user
    ), '[]'::jsonb),
    'fee_bps', (select case when s.fee_enabled and s.fee_recipient is not null then s.fee_bps else 0 end from public.platform_settings as s),
    'ad_share_pct', (select s.ad_share_pct from public.platform_settings as s)
  );
end;
$$;

create or replace function public.save_faucet(
  p_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_currency text,
  p_reward bigint,
  p_interval_minutes integer,
  p_daily_limit integer,
  p_ad_unit text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user uuid := (select auth.uid());
  v_row public.faucets%rowtype;
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_ad text := nullif(btrim(coalesce(p_ad_unit, '')), '');
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not coalesce((select u.email_confirmed_at is not null from auth.users as u where u.id = v_user), false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;
  if v_slug in ('admin', 'api', 'dashboard', 'faucets', 'new', 'nueva', 'crear', 'faucetfree', 'login', 'terminos', 'privacidad') then
    raise exception 'Slug not available' using errcode = '22023';
  end if;

  if p_id is null then
    if (select count(*) from public.faucets as f where f.owner_id = v_user) >= 10 then
      raise exception 'Faucet limit reached' using errcode = 'P0001';
    end if;
    begin
      insert into public.faucets (owner_id, slug, name, description, currency, reward, interval_minutes, daily_limit, ad_unit)
      values (v_user, v_slug, btrim(p_name), btrim(coalesce(p_description, '')), p_currency, p_reward, p_interval_minutes, p_daily_limit, v_ad)
      returning * into v_row;
    exception when unique_violation then
      raise exception 'Slug not available' using errcode = '22023';
    end;
  else
    select f.* into v_row from public.faucets as f where f.id = p_id and f.owner_id = v_user for update;
    if not found then
      raise exception 'Unknown faucet' using errcode = '22023';
    end if;
    if v_row.status = 'banned' then
      raise exception 'Faucet banned' using errcode = 'P0001';
    end if;
    begin
      update public.faucets as f
      set slug = v_slug, name = btrim(p_name), description = btrim(coalesce(p_description, '')),
          currency = p_currency, reward = p_reward, interval_minutes = p_interval_minutes,
          daily_limit = p_daily_limit, ad_unit = v_ad, updated_at = now(),
          last_balance = case when f.currency = p_currency then f.last_balance end,
          balance_checked_at = case when f.currency = p_currency then f.balance_checked_at end
      where f.id = p_id
      returning * into v_row;
    exception when unique_violation then
      raise exception 'Slug not available' using errcode = '22023';
    end;
  end if;

  return public.faucet_owner_view(v_row);
end;
$$;

create or replace function public.set_faucet_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user uuid := (select auth.uid());
  v_row public.faucets%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_status not in ('active', 'paused') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  select f.* into v_row from public.faucets as f where f.id = p_id and f.owner_id = v_user for update;
  if not found then
    raise exception 'Unknown faucet' using errcode = '22023';
  end if;
  if v_row.status = 'banned' then
    raise exception 'Faucet banned' using errcode = 'P0001';
  end if;
  if p_status = 'active' and v_row.api_key_secret is null then
    raise exception 'API key required' using errcode = 'P0001';
  end if;
  update public.faucets as f
  set status = p_status, status_reason = null, updated_at = now()
  where f.id = p_id
  returning * into v_row;
  return public.faucet_owner_view(v_row);
end;
$$;

create or replace function public.my_faucet_claims(p_faucet_id uuid, p_limit integer default 100)
returns table (
  id bigint, address text, currency text, amount bigint, fee_amount bigint, status text,
  payout_id text, fee_status text, error text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_variable
begin
  if not exists (select 1 from public.faucets as f where f.id = p_faucet_id and f.owner_id = (select auth.uid())) then
    raise exception 'Unknown faucet' using errcode = '22023';
  end if;
  return query
    select c.id, c.address, c.currency, c.amount, c.fee_amount, c.status, c.payout_id, c.fee_status, c.error, c.created_at
    from public.faucet_claims as c
    where c.faucet_id = p_faucet_id
    order by c.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.my_faucets() from public, anon;
revoke all on function public.save_faucet(uuid, text, text, text, text, bigint, integer, integer, text) from public, anon;
revoke all on function public.set_faucet_status(uuid, text) from public, anon;
revoke all on function public.my_faucet_claims(uuid, integer) from public, anon;
grant execute on function public.my_faucets() to authenticated;
grant execute on function public.save_faucet(uuid, text, text, text, text, bigint, integer, integer, text) to authenticated;
grant execute on function public.set_faucet_status(uuid, text) to authenticated;
grant execute on function public.my_faucet_claims(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Edge function helpers (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.faucet_store_api_key(p_faucet_id uuid, p_owner uuid, p_key text, p_balance bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  select f.api_key_secret into v_secret from public.faucets as f where f.id = p_faucet_id and f.owner_id = p_owner for update;
  if not found then
    raise exception 'Unknown faucet' using errcode = '22023';
  end if;
  if v_secret is null then
    v_secret := vault.create_secret(p_key, 'faucet_api_key_' || p_faucet_id::text, 'FaucetPay API key of a creator faucet');
  else
    perform vault.update_secret(v_secret, p_key);
  end if;
  update public.faucets as f
  set api_key_secret = v_secret, last_balance = p_balance, balance_checked_at = now(), updated_at = now(),
      status_reason = case when f.status_reason = 'Sin fondos en FaucetPay' then null else f.status_reason end
  where f.id = p_faucet_id;
end;
$$;

create or replace function public.faucet_api_key_for_owner(p_faucet_id uuid, p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('api_key', d.decrypted_secret, 'currency', f.currency)
  from public.faucets as f
  join vault.decrypted_secrets as d on d.id = f.api_key_secret
  where f.id = p_faucet_id and f.owner_id = p_owner;
$$;

create or replace function public.faucet_set_balance(p_faucet_id uuid, p_balance bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.faucets as f set last_balance = p_balance, balance_checked_at = now() where f.id = p_faucet_id;
$$;

-- Reserves a claim after the anti-abuse checks and hands the edge function what it
-- needs to pay it. Failed claims never count towards the limits.
create or replace function public.faucet_reserve_claim(p_slug text, p_address text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_faucet public.faucets%rowtype;
  v_settings public.platform_settings%rowtype;
  v_address text := btrim(coalesce(p_address, ''));
  v_last timestamptz;
  v_fee bigint := 0;
  v_key text;
  v_claim bigint;
begin
  if v_address !~ '^[A-Za-z0-9@._+:-]{3,120}$' then
    raise exception 'Invalid address' using errcode = '22023';
  end if;

  select f.* into v_faucet from public.faucets as f where f.slug = lower(p_slug);
  if not found or v_faucet.status <> 'active' or v_faucet.api_key_secret is null then
    raise exception 'Faucet unavailable' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_faucet.id::text || ':' || v_address, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_faucet.id::text || ':' || p_ip_hash, 0));

  select max(c.created_at) into v_last
  from public.faucet_claims as c
  where c.faucet_id = v_faucet.id and c.status <> 'failed'
    and (c.address = v_address or c.ip_hash = p_ip_hash)
    and c.created_at > now() - make_interval(mins => v_faucet.interval_minutes);
  if v_last is not null then
    raise exception 'Claim too soon' using errcode = 'P0001',
      detail = to_char(v_last + make_interval(mins => v_faucet.interval_minutes), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  if (select count(*) from public.faucet_claims as c
      where c.faucet_id = v_faucet.id and c.status <> 'failed'
        and (c.address = v_address or c.ip_hash = p_ip_hash)
        and c.created_at > now() - interval '24 hours') >= v_faucet.daily_limit then
    raise exception 'Daily limit reached' using errcode = 'P0001';
  end if;

  select s.* into v_settings from public.platform_settings as s;
  if v_settings.fee_enabled and v_settings.fee_recipient is not null then
    v_fee := floor(v_faucet.reward * v_settings.fee_bps / 10000.0)::bigint;
  end if;

  select d.decrypted_secret into v_key from vault.decrypted_secrets as d where d.id = v_faucet.api_key_secret;
  if v_key is null then
    raise exception 'Faucet unavailable' using errcode = 'P0001';
  end if;

  insert into public.faucet_claims (faucet_id, address, ip_hash, currency, amount, fee_amount, fee_recipient)
  values (v_faucet.id, v_address, p_ip_hash, v_faucet.currency, v_faucet.reward, v_fee, case when v_fee > 0 then v_settings.fee_recipient end)
  returning id into v_claim;

  return jsonb_build_object(
    'claim_id', v_claim, 'faucet_id', v_faucet.id, 'currency', v_faucet.currency, 'amount', v_faucet.reward,
    'fee_amount', v_fee, 'fee_recipient', case when v_fee > 0 then v_settings.fee_recipient end,
    'interval_minutes', v_faucet.interval_minutes, 'api_key', v_key
  );
end;
$$;

create or replace function public.faucet_finish_claim(
  p_claim_id bigint,
  p_status text,
  p_payout_id text,
  p_payout_user_hash text,
  p_error text,
  p_balance bigint,
  p_fee_status text,
  p_fee_payout_id text,
  p_pause_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.faucet_claims%rowtype;
begin
  update public.faucet_claims as c
  set status = p_status, payout_id = left(p_payout_id, 100), payout_user_hash = left(p_payout_user_hash, 100),
      error = left(p_error, 300), fee_status = coalesce(p_fee_status, 'none'), fee_payout_id = left(p_fee_payout_id, 100),
      finished_at = now()
  where c.id = p_claim_id and c.status = 'pending'
  returning * into v_claim;
  if not found then
    return;
  end if;

  update public.faucets as f
  set claims_count = f.claims_count + case when p_status = 'paid' then 1 else 0 end,
      paid_total = f.paid_total + case when p_status = 'paid' then v_claim.amount else 0 end,
      fees_total = f.fees_total + case when p_fee_status = 'paid' then v_claim.fee_amount else 0 end,
      last_balance = coalesce(p_balance, f.last_balance),
      balance_checked_at = case when p_balance is not null then now() else f.balance_checked_at end,
      status = case when p_pause_reason is not null and f.status = 'active' then 'paused' else f.status end,
      status_reason = coalesce(left(p_pause_reason, 200), f.status_reason),
      updated_at = now()
  where f.id = v_claim.faucet_id;
end;
$$;

revoke all on function public.faucet_store_api_key(uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.faucet_api_key_for_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function public.faucet_set_balance(uuid, bigint) from public, anon, authenticated;
revoke all on function public.faucet_reserve_claim(text, text, text) from public, anon, authenticated;
revoke all on function public.faucet_finish_claim(bigint, text, text, text, text, bigint, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_platform_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return (select to_jsonb(s) - 'id' from public.platform_settings as s);
end;
$$;

create or replace function public.admin_update_platform_settings(
  p_fee_bps integer,
  p_fee_enabled boolean,
  p_fee_recipient text,
  p_ad_share_pct integer,
  p_platform_ad_unit text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if p_fee_enabled and nullif(btrim(coalesce(p_fee_recipient, '')), '') is null then
    raise exception 'Fee recipient required' using errcode = '22023';
  end if;
  update public.platform_settings as s
  set fee_bps = p_fee_bps, fee_enabled = p_fee_enabled,
      fee_recipient = nullif(btrim(coalesce(p_fee_recipient, '')), ''),
      ad_share_pct = p_ad_share_pct,
      platform_ad_unit = nullif(btrim(coalesce(p_platform_ad_unit, '')), ''),
      updated_at = now()
  where s.id;
  return public.admin_platform_settings();
end;
$$;

create or replace function public.admin_list_faucets()
returns table (
  id uuid, slug text, name text, owner_email text, currency text, reward bigint, interval_minutes integer,
  daily_limit integer, status text, status_reason text, has_key boolean, last_balance bigint,
  claims_count integer, paid_total bigint, fees_total bigint, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return query
    select f.id, f.slug, f.name, u.email::text, f.currency, f.reward, f.interval_minutes, f.daily_limit,
      f.status, f.status_reason, f.api_key_secret is not null, f.last_balance, f.claims_count, f.paid_total,
      f.fees_total, f.created_at
    from public.faucets as f
    join auth.users as u on u.id = f.owner_id
    order by f.created_at desc;
end;
$$;

create or replace function public.admin_set_faucet_status(p_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if p_status not in ('active', 'paused', 'banned') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  update public.faucets as f
  set status = p_status, status_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 200), updated_at = now()
  where f.id = p_id and (p_status <> 'active' or f.api_key_secret is not null);
  if not found then
    raise exception 'Unknown faucet' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.admin_faucet_claims(p_status text default null, p_faucet uuid default null, p_limit integer default 200, p_offset integer default 0)
returns table (
  id bigint, faucet_slug text, faucet_name text, owner_email text, address text, ip_hash text, currency text,
  amount bigint, fee_amount bigint, fee_recipient text, status text, payout_id text, payout_user_hash text,
  fee_status text, fee_payout_id text, error text, created_at timestamptz, finished_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  return query
    select c.id, f.slug, f.name, u.email::text, c.address, c.ip_hash, c.currency, c.amount, c.fee_amount,
      c.fee_recipient, c.status, c.payout_id, c.payout_user_hash, c.fee_status, c.fee_payout_id, c.error,
      c.created_at, c.finished_at
    from public.faucet_claims as c
    join public.faucets as f on f.id = c.faucet_id
    join auth.users as u on u.id = f.owner_id
    where (p_status is null or c.status = p_status) and (p_faucet is null or c.faucet_id = p_faucet)
    order by c.created_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 1000))
    offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.admin_platform_settings() from public, anon;
revoke all on function public.admin_update_platform_settings(integer, boolean, text, integer, text) from public, anon;
revoke all on function public.admin_list_faucets() from public, anon;
revoke all on function public.admin_set_faucet_status(uuid, text, text) from public, anon;
revoke all on function public.admin_faucet_claims(text, uuid, integer, integer) from public, anon;
grant execute on function public.admin_platform_settings() to authenticated;
grant execute on function public.admin_update_platform_settings(integer, boolean, text, integer, text) to authenticated;
grant execute on function public.admin_list_faucets() to authenticated;
grant execute on function public.admin_set_faucet_status(uuid, text, text) to authenticated;
grant execute on function public.admin_faucet_claims(text, uuid, integer, integer) to authenticated;
