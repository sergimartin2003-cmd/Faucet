-- Crypto withdrawals paid manually by an admin, offerwall reversals, and the end
-- of every activity that granted points without a paying partner behind it.
--
-- Points now have a fixed value: 1000 points = 1 USD. The only earning sources
-- are partner offerwalls (BitLabs) and the referral bonus, which is now paid when
-- the referred user completes their first offer.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
revoke all on public.app_admins from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins as a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Withdrawals
-- ---------------------------------------------------------------------------
create table if not exists public.withdrawals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  points integer not null check (points >= 5000),
  usd_cents integer not null check (usd_cents > 0),
  method text not null check (method in ('ltc', 'usdt_bep20', 'trx', 'doge', 'binance_pay')),
  address text not null check (char_length(address) between 6 and 120),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  tx_ref text check (char_length(tx_ref) <= 200),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users (id) on delete set null
);

create index if not exists withdrawals_user_created_at_idx on public.withdrawals (user_id, created_at desc);
create index if not exists withdrawals_status_created_at_idx on public.withdrawals (status, created_at);
create index if not exists withdrawals_processed_by_idx on public.withdrawals (processed_by);
create unique index if not exists withdrawals_one_pending_per_user on public.withdrawals (user_id) where status = 'pending';

alter table public.withdrawals enable row level security;
revoke all on public.withdrawals from public, anon, authenticated;
grant select on public.withdrawals to authenticated;

create policy "Users can read their own withdrawals"
  on public.withdrawals for select
  using ((select auth.uid()) = user_id);

create or replace function public.withdrawal_address_valid(p_method text, p_address text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_method
    when 'ltc' then p_address ~ '^(ltc1[a-z0-9]{25,62}|[LM3][a-km-zA-HJ-NP-Z1-9]{26,33})$'
    when 'usdt_bep20' then p_address ~ '^0x[a-fA-F0-9]{40}$'
    when 'trx' then p_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
    when 'doge' then p_address ~ '^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$'
    when 'binance_pay' then p_address ~ '^[0-9]{6,12}$'
    else false
  end;
$$;

revoke all on function public.withdrawal_address_valid(text, text) from public, anon, authenticated;

create or replace function public.request_withdrawal(p_points integer, p_method text, p_address text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_address text := btrim(coalesce(p_address, ''));
  v_balance integer;
  v_row public.withdrawals%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select u.email_confirmed_at is not null from auth.users as u where u.id = v_user_id), false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;

  if p_points is null or p_points < 5000 or p_points > 10000000 then
    raise exception 'Invalid withdrawal amount' using errcode = '22023';
  end if;

  if not public.withdrawal_address_valid(p_method, v_address) then
    raise exception 'Invalid withdrawal address' using errcode = '22023';
  end if;

  insert into public.daily_faucet_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  v_balance := (
    select a.points from public.daily_faucet_accounts as a where a.user_id = v_user_id for update
  );

  if exists (select 1 from public.withdrawals as w where w.user_id = v_user_id and w.status = 'pending') then
    raise exception 'Withdrawal already pending' using errcode = 'P0001';
  end if;

  if v_balance < p_points then
    raise exception 'Insufficient balance' using errcode = 'P0001';
  end if;

  update public.daily_faucet_accounts as a
  set points = a.points - p_points, updated_at = now()
  where a.user_id = v_user_id
  returning a.points into v_balance;

  insert into public.withdrawals (user_id, points, usd_cents, method, address)
  values (v_user_id, p_points, p_points / 10, p_method, v_address)
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id, 'points', v_row.points, 'usd_cents', v_row.usd_cents, 'method', v_row.method,
    'address', v_row.address, 'status', v_row.status, 'created_at', v_row.created_at, 'balance', v_balance
  );
end;
$$;

revoke all on function public.request_withdrawal(integer, text, text) from public, anon;
grant execute on function public.request_withdrawal(integer, text, text) to authenticated;

create or replace function public.admin_list_withdrawals(p_status text default 'pending', p_limit integer default 100)
returns table (
  id bigint,
  user_id uuid,
  email text,
  account_created_at timestamptz,
  points integer,
  usd_cents integer,
  method text,
  address text,
  status text,
  tx_ref text,
  note text,
  created_at timestamptz,
  processed_at timestamptz,
  offer_points bigint,
  reversed_points bigint,
  casino_net bigint,
  paid_points bigint,
  balance integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_variable
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  return query
    select
      w.id, w.user_id, u.email::text, u.created_at, w.points, w.usd_cents, w.method, w.address,
      w.status, w.tx_ref, w.note, w.created_at, w.processed_at,
      (select coalesce(sum(c.points), 0) from public.offerwall_completions as c where c.user_id = w.user_id),
      (select coalesce(sum(r.deducted), 0) from public.offerwall_reversals as r where r.user_id = w.user_id),
      (select coalesce(sum(b.payout - b.bet), 0) from public.casino_bets as b where b.user_id = w.user_id),
      (select coalesce(sum(p.points), 0) from public.withdrawals as p where p.user_id = w.user_id and p.status = 'paid'),
      coalesce((select a.points from public.daily_faucet_accounts as a where a.user_id = w.user_id), 0)
    from public.withdrawals as w
    join auth.users as u on u.id = w.user_id
    where p_status is null or w.status = p_status
    order by case when w.status = 'pending' then w.created_at end asc, w.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_list_withdrawals(text, integer) from public, anon;
grant execute on function public.admin_list_withdrawals(text, integer) to authenticated;

create or replace function public.admin_process_withdrawal(p_id bigint, p_action text, p_tx_ref text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_admin uuid := (select auth.uid());
  v_row public.withdrawals%rowtype;
  v_tx text := nullif(btrim(coalesce(p_tx_ref, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  if p_action not in ('paid', 'rejected') then
    raise exception 'Invalid action' using errcode = '22023';
  end if;

  if p_action = 'paid' and v_tx is null then
    raise exception 'Transaction reference required' using errcode = '22023';
  end if;

  select w.* into v_row from public.withdrawals as w where w.id = p_id for update;
  if not found then
    raise exception 'Unknown withdrawal' using errcode = '22023';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Withdrawal already processed' using errcode = 'P0001';
  end if;

  if p_action = 'rejected' then
    insert into public.daily_faucet_accounts (user_id)
    values (v_row.user_id)
    on conflict (user_id) do nothing;

    update public.daily_faucet_accounts as a
    set points = a.points + v_row.points, updated_at = now()
    where a.user_id = v_row.user_id;
  end if;

  update public.withdrawals as w
  set status = p_action, tx_ref = left(v_tx, 200), note = left(v_note, 300), processed_at = now(), processed_by = v_admin
  where w.id = p_id
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'tx_ref', v_row.tx_ref, 'note', v_row.note, 'processed_at', v_row.processed_at);
end;
$$;

revoke all on function public.admin_process_withdrawal(bigint, text, text, text) from public, anon;
grant execute on function public.admin_process_withdrawal(bigint, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Offerwall reversals (reconciliations): take the points back, never below zero.
-- ---------------------------------------------------------------------------
create table if not exists public.offerwall_reversals (
  id bigint generated always as identity primary key,
  provider text not null,
  external_transaction_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  points integer not null check (points > 0),
  deducted integer not null check (deducted >= 0),
  created_at timestamptz not null default now(),
  unique (provider, external_transaction_id)
);

create index if not exists offerwall_reversals_user_id_idx on public.offerwall_reversals (user_id);

alter table public.offerwall_reversals enable row level security;
revoke all on public.offerwall_reversals from public, anon, authenticated;

create or replace function public.reverse_offerwall_completion(
  p_provider text,
  p_external_transaction_id text,
  p_user_id uuid,
  p_points integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_deducted integer;
  v_id bigint;
begin
  if p_provider is null or p_external_transaction_id is null or p_user_id is null
    or p_points is null or p_points not between 1 and 100000 then
    raise exception 'Invalid offerwall reversal' using errcode = '22023';
  end if;

  insert into public.daily_faucet_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  v_balance := (select a.points from public.daily_faucet_accounts as a where a.user_id = p_user_id for update);
  v_deducted := least(v_balance, p_points);

  insert into public.offerwall_reversals (provider, external_transaction_id, user_id, points, deducted)
  values (p_provider, p_external_transaction_id, p_user_id, p_points, v_deducted)
  on conflict (provider, external_transaction_id) do nothing
  returning id into v_id;

  if v_id is null then
    return 0;
  end if;

  update public.daily_faucet_accounts as a
  set points = a.points - v_deducted, updated_at = now()
  where a.user_id = p_user_id;

  return v_deducted;
end;
$$;

revoke all on function public.reverse_offerwall_completion(text, text, uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Referral bonus: 100 points when the referred user completes their first offer.
-- ---------------------------------------------------------------------------
create or replace function public.reward_referrer_on_task_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral public.referrals%rowtype;
  v_balance integer;
  v_reward constant integer := 100;
  v_max_rewarded constant integer := 20;
  v_now timestamptz := now();
begin
  select r.* into v_referral
  from public.referrals as r
  where r.referred_id = new.user_id and r.rewarded_at is null
  for update;
  if not found then
    return new;
  end if;
  insert into public.daily_faucet_accounts (user_id)
  values (v_referral.referrer_id)
  on conflict (user_id) do nothing;
  select account.points into v_balance
  from public.daily_faucet_accounts as account
  where account.user_id = v_referral.referrer_id
  for update;
  if (select count(*) from public.referrals as r where r.referrer_id = v_referral.referrer_id and r.rewarded_at is not null) >= v_max_rewarded
    or v_balance > 2147483647 - v_reward then
    return new;
  end if;
  update public.daily_faucet_accounts as account
  set points = account.points + v_reward, updated_at = v_now
  where account.user_id = v_referral.referrer_id
  returning account.points into v_balance;
  update public.referrals as r
  set rewarded_at = v_now, reward = v_reward
  where r.id = v_referral.id;
  insert into public.reward_ledger (user_id, source_type, source_id, points, balance_after, created_at)
  values (v_referral.referrer_id, 'referral', v_referral.id, v_reward, v_balance, v_now);
  return new;
end;
$$;

create trigger reward_referrer_after_offer
  after insert on public.offerwall_completions
  for each row execute function public.reward_referrer_on_task_completion();

create or replace function public.get_referral_summary()
returns table (code text, total_referrals integer, rewarded_referrals integer, points_earned integer, was_referred boolean, max_rewarded integer, reward_per_referral integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select rc.code into v_code from public.referral_codes as rc where rc.user_id = v_user_id;

  while v_code is null loop
    begin
      insert into public.referral_codes (user_id, code)
      values (v_user_id, substr(md5(random()::text || clock_timestamp()::text), 1, 8))
      returning referral_codes.code into v_code;
    exception when unique_violation then
      select rc.code into v_code from public.referral_codes as rc where rc.user_id = v_user_id;
    end;
  end loop;

  return query
    select
      v_code,
      (select count(*)::integer from public.referrals as r where r.referrer_id = v_user_id),
      (select count(*)::integer from public.referrals as r where r.referrer_id = v_user_id and r.rewarded_at is not null),
      (select coalesce(sum(r.reward), 0)::integer from public.referrals as r where r.referrer_id = v_user_id and r.rewarded_at is not null),
      exists (select 1 from public.referrals as r where r.referred_id = v_user_id),
      20,
      100;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retire the activities that granted points with nobody paying for them.
-- Their tables stay for history; the functions can no longer be called.
-- ---------------------------------------------------------------------------
revoke execute on function public.claim_daily_faucet() from public, anon, authenticated;
revoke execute on function public.complete_earn_task(text) from public, anon, authenticated;
revoke execute on function public.list_surveys() from public, anon, authenticated;
revoke execute on function public.get_survey(text) from public, anon, authenticated;
revoke execute on function public.submit_survey(text, jsonb) from public, anon, authenticated;
revoke execute on function public.list_videos() from public, anon, authenticated;
revoke execute on function public.get_video_status() from public, anon, authenticated;
revoke execute on function public.start_video(text) from public, anon, authenticated;
revoke execute on function public.complete_video(text) from public, anon, authenticated;
revoke execute on function public.get_daily_trivia() from public, anon, authenticated;
revoke execute on function public.answer_trivia(bigint, integer) from public, anon, authenticated;
revoke execute on function public.get_scratch_status() from public, anon, authenticated;
revoke execute on function public.play_scratch() from public, anon, authenticated;
