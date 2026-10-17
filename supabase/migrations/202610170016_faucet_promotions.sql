-- Paid placement in the faucet directory. Creators spend their FaucetFree points
-- (1000 points = 1 USD) to feature a faucet: 1000 points per day, 1 to 30 days.
-- Points spent this way are platform revenue and never become a withdrawal.

alter table public.faucets add column if not exists featured_until timestamptz;

create table if not exists public.faucet_promotions (
  id bigint generated always as identity primary key,
  faucet_id uuid not null references public.faucets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  days integer not null check (days between 1 and 30),
  points integer not null check (points > 0),
  featured_until timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists faucet_promotions_faucet_idx on public.faucet_promotions (faucet_id);
create index if not exists faucet_promotions_user_idx on public.faucet_promotions (user_id);
create index if not exists faucet_promotions_created_idx on public.faucet_promotions (created_at desc);
create index if not exists faucets_featured_idx on public.faucets (featured_until);

alter table public.faucet_promotions enable row level security;
revoke all on public.faucet_promotions from public, anon, authenticated;

create or replace function public.feature_faucet(p_id uuid, p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user uuid := (select auth.uid());
  v_faucet public.faucets%rowtype;
  v_cost integer;
  v_balance integer;
  v_until timestamptz;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_days is null or p_days not between 1 and 30 then
    raise exception 'Invalid days' using errcode = '22023';
  end if;

  select f.* into v_faucet from public.faucets as f where f.id = p_id and f.owner_id = v_user for update;
  if not found then
    raise exception 'Unknown faucet' using errcode = '22023';
  end if;
  if v_faucet.status <> 'active' then
    raise exception 'Faucet must be active' using errcode = 'P0001';
  end if;

  v_cost := p_days * 1000;
  insert into public.daily_faucet_accounts (user_id) values (v_user) on conflict (user_id) do nothing;
  v_balance := (select a.points from public.daily_faucet_accounts as a where a.user_id = v_user for update);
  if v_balance < v_cost then
    raise exception 'Insufficient balance' using errcode = 'P0001';
  end if;

  update public.daily_faucet_accounts as a
  set points = a.points - v_cost, updated_at = now()
  where a.user_id = v_user
  returning a.points into v_balance;

  v_until := greatest(coalesce(v_faucet.featured_until, now()), now()) + make_interval(days => p_days);
  update public.faucets as f set featured_until = v_until, updated_at = now() where f.id = p_id;

  insert into public.faucet_promotions (faucet_id, user_id, days, points, featured_until)
  values (p_id, v_user, p_days, v_cost, v_until);

  return jsonb_build_object('featured_until', v_until, 'points', v_cost, 'balance', v_balance);
end;
$$;

revoke all on function public.feature_faucet(uuid, integer) from public, anon;
grant execute on function public.feature_faucet(uuid, integer) to authenticated;

-- Directory listing with featured faucets first.
create or replace function public.list_directory_faucets(p_currency text default null, p_limit integer default 120)
returns table (
  slug text, name text, description text, currency text, reward bigint, interval_minutes integer,
  daily_limit integer, claims_count integer, paid_total bigint, funded boolean, featured boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.slug, f.name, f.description, f.currency, f.reward, f.interval_minutes, f.daily_limit,
    f.claims_count, f.paid_total, coalesce(f.last_balance, 0) >= f.reward,
    coalesce(f.featured_until > now(), false), f.created_at
  from public.faucets as f
  where f.status = 'active' and f.api_key_secret is not null
    and (p_currency is null or f.currency = p_currency)
  order by coalesce(f.featured_until > now(), false) and coalesce(f.last_balance, 0) >= f.reward desc,
    (coalesce(f.last_balance, 0) >= f.reward) desc, f.claims_count desc, f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 120), 200));
$$;

revoke all on function public.list_directory_faucets(text, integer) from public;
grant execute on function public.list_directory_faucets(text, integer) to anon, authenticated;
revoke all on function public.list_public_faucets(text, integer) from anon, authenticated;

-- Owners see when their promotion ends.
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
    'featured_until', p_faucet.featured_until, 'created_at', p_faucet.created_at
  );
$$;

revoke all on function public.faucet_owner_view(public.faucets) from public, anon, authenticated;

-- Platform revenue overview for the admin panel.
create or replace function public.admin_platform_revenue()
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
  return jsonb_build_object(
    'fees', coalesce((
      select jsonb_agg(jsonb_build_object('currency', x.currency, 'amount', x.amount, 'count', x.n) order by x.currency)
      from (
        select c.currency, sum(c.fee_amount) as amount, count(*) as n
        from public.faucet_claims as c where c.fee_status = 'paid' group by c.currency
      ) as x
    ), '[]'::jsonb),
    'promotions_points', (select coalesce(sum(p.points), 0) from public.faucet_promotions as p),
    'promotions_count', (select count(*) from public.faucet_promotions as p),
    'promotions_month_points', (select coalesce(sum(p.points), 0) from public.faucet_promotions as p where p.created_at >= date_trunc('month', now())),
    'faucets_active', (select count(*) from public.faucets as f where f.status = 'active'),
    'faucets_total', (select count(*) from public.faucets as f),
    'claims_paid', (select count(*) from public.faucet_claims as c where c.status = 'paid'),
    'claims_failed', (select count(*) from public.faucet_claims as c where c.status = 'failed'),
    'claims_today', (select count(*) from public.faucet_claims as c where c.status = 'paid' and c.created_at >= date_trunc('day', now())),
    'withdrawals_pending_cents', (select coalesce(sum(w.usd_cents), 0) from public.withdrawals as w where w.status = 'pending'),
    'withdrawals_paid_cents', (select coalesce(sum(w.usd_cents), 0) from public.withdrawals as w where w.status = 'paid'),
    'points_outstanding', (select coalesce(sum(a.points), 0) from public.daily_faucet_accounts as a)
  );
end;
$$;

create or replace function public.admin_faucet_promotions(p_limit integer default 200)
returns table (id bigint, faucet_slug text, faucet_name text, owner_email text, days integer, points integer, featured_until timestamptz, created_at timestamptz)
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
    select p.id, f.slug, f.name, u.email::text, p.days, p.points, p.featured_until, p.created_at
    from public.faucet_promotions as p
    join public.faucets as f on f.id = p.faucet_id
    join auth.users as u on u.id = p.user_id
    order by p.created_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

revoke all on function public.admin_platform_revenue() from public, anon;
revoke all on function public.admin_faucet_promotions(integer) from public, anon;
grant execute on function public.admin_platform_revenue() to authenticated;
grant execute on function public.admin_faucet_promotions(integer) to authenticated;
