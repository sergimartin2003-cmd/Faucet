alter table public.reward_ledger
  drop constraint if exists reward_ledger_source_type_check;

alter table public.reward_ledger
  add constraint reward_ledger_source_type_check
  check (source_type in ('daily_faucet', 'earn_task', 'offerwall', 'referral'));

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-f0-9]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  reward integer check (reward is null or reward > 0),
  check (referred_id <> referrer_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on public.referral_codes, public.referrals from public, anon, authenticated;

create or replace function public.get_referral_summary()
returns table (
  code text,
  total_referrals integer,
  rewarded_referrals integer,
  points_earned integer,
  was_referred boolean,
  max_rewarded integer,
  reward_per_referral integer
)
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
      15;
end;
$$;

create or replace function public.apply_referral_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_referrer_id uuid;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  p_code := lower(btrim(coalesce(p_code, '')));
  if p_code !~ '^[a-f0-9]{8}$' then
    raise exception 'Invalid referral code' using errcode = '22023';
  end if;

  select u.created_at into v_created_at from auth.users as u where u.id = v_user_id;
  if v_created_at is null or v_created_at < now() - interval '7 days' then
    raise exception 'Referral codes can only be applied during the first 7 days' using errcode = '22023';
  end if;

  select rc.user_id into v_referrer_id from public.referral_codes as rc where rc.code = p_code;
  if v_referrer_id is null or v_referrer_id = v_user_id then
    raise exception 'Invalid referral code' using errcode = '22023';
  end if;

  if exists (select 1 from public.referrals as r where r.referred_id = v_referrer_id and r.referrer_id = v_user_id) then
    raise exception 'Invalid referral code' using errcode = '22023';
  end if;

  insert into public.referrals (referred_id, referrer_id)
  values (v_user_id, v_referrer_id)
  on conflict (referred_id) do nothing;

  return found;
end;
$$;

create or replace function public.reward_referrer_on_task_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral public.referrals%rowtype;
  v_balance integer;
  v_reward constant integer := 15;
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

drop trigger if exists reward_referrer_after_task on public.earn_task_completions;
create trigger reward_referrer_after_task
  after insert on public.earn_task_completions
  for each row
  when (new.task_key = 'complete_profile')
  execute procedure public.reward_referrer_on_task_completion();

revoke all on function public.reward_referrer_on_task_completion() from public, anon, authenticated;
revoke all on function public.get_referral_summary() from public, anon;
revoke all on function public.apply_referral_code(text) from public, anon;
grant execute on function public.get_referral_summary() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
