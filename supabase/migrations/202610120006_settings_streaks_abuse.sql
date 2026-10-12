alter table public.profiles
  add column if not exists country text,
  add column if not exists bio text,
  add column if not exists avatar_color text;

alter table public.profiles drop constraint if exists profiles_country_check;
alter table public.profiles add constraint profiles_country_check
  check (country is null or country ~ '^[A-Z]{2}$');

alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check
  check (bio is null or char_length(bio) <= 160);

alter table public.profiles drop constraint if exists profiles_avatar_color_check;
alter table public.profiles add constraint profiles_avatar_color_check
  check (avatar_color is null or avatar_color ~ '^#[0-9a-fA-F]{6}$');

grant update (display_name, country, bio, avatar_color) on public.profiles to authenticated;

insert into public.profiles (id, display_name)
select u.id, nullif(left(u.raw_user_meta_data ->> 'display_name', 50), '')
from auth.users as u
on conflict (id) do nothing;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notify_faucet_ready boolean not null default false,
  hide_balance boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on public.user_settings from public, anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "Users can read their own settings" on public.user_settings;
create policy "Users can read their own settings"
  on public.user_settings for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own settings" on public.user_settings;
create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute procedure public.set_profile_updated_at();

alter table public.daily_faucet_accounts
  add column if not exists streak integer not null default 0 check (streak >= 0),
  add column if not exists best_streak integer not null default 0 check (best_streak >= 0);

drop function if exists public.claim_daily_faucet();

create function public.claim_daily_faucet()
returns table (
  claimed boolean,
  reward integer,
  balance integer,
  last_claim_at timestamptz,
  next_claim_at timestamptz,
  streak integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_confirmed boolean;
  v_balance integer;
  v_streak integer;
  v_best integer;
  v_claim_id bigint;
  v_last_claim_at timestamptz;
  v_reward integer;
  v_base_reward constant integer := 10;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_confirmed := (select u.email_confirmed_at is not null from auth.users as u where u.id = v_user_id);
  if not coalesce(v_confirmed, false) then
    raise exception 'Email confirmation required' using errcode = '22023';
  end if;

  insert into public.daily_faucet_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  v_balance := (
    select account.points
    from public.daily_faucet_accounts as account
    where account.user_id = v_user_id
    for update
  );
  v_streak := (select account.streak from public.daily_faucet_accounts as account where account.user_id = v_user_id);
  v_best := (select account.best_streak from public.daily_faucet_accounts as account where account.user_id = v_user_id);
  v_last_claim_at := (
    select claim.claimed_at
    from public.daily_faucet_claims as claim
    where claim.user_id = v_user_id
    order by claim.claimed_at desc
    limit 1
  );

  if v_last_claim_at is not null and v_last_claim_at > v_now - interval '24 hours' then
    return query
      select false, 0, v_balance, v_last_claim_at, v_last_claim_at + interval '24 hours', v_streak;
    return;
  end if;

  if v_last_claim_at is null or v_last_claim_at < v_now - interval '48 hours' then
    v_streak := 1;
  else
    v_streak := v_streak + 1;
  end if;
  v_best := greatest(v_best, v_streak);
  v_reward := v_base_reward + 2 * least(v_streak - 1, 6);

  insert into public.daily_faucet_claims (user_id, reward, claimed_at)
  values (v_user_id, v_reward, v_now)
  returning id into v_claim_id;

  update public.daily_faucet_accounts as account
  set points = account.points + v_reward,
      streak = v_streak,
      best_streak = v_best,
      updated_at = v_now
  where account.user_id = v_user_id
  returning account.points into v_balance;

  insert into public.reward_ledger (user_id, source_type, source_id, points, balance_after, created_at)
  values (v_user_id, 'daily_faucet', v_claim_id, v_reward, v_balance, v_now);

  return query
    select true, v_reward, v_balance, v_now, v_now + interval '24 hours', v_streak;
end;
$$;

revoke all on function public.claim_daily_faucet() from public, anon;
grant execute on function public.claim_daily_faucet() to authenticated;

create table if not exists public.blocked_email_domains (
  domain text primary key check (domain = lower(domain))
);

alter table public.blocked_email_domains enable row level security;
revoke all on public.blocked_email_domains from public, anon, authenticated;

insert into public.blocked_email_domains (domain) values
  ('mailinator.com'), ('guerrillamail.com'), ('guerrillamail.net'), ('guerrillamail.org'),
  ('sharklasers.com'), ('grr.la'), ('10minutemail.com'), ('10minutemail.net'),
  ('tempmail.com'), ('temp-mail.org'), ('temp-mail.io'), ('tempmailo.com'),
  ('yopmail.com'), ('yopmail.net'), ('trashmail.com'), ('trashmail.net'),
  ('getnada.com'), ('dispostable.com'), ('maildrop.cc'), ('throwawaymail.com'),
  ('fakeinbox.com'), ('mohmal.com'), ('emailondeck.com'), ('mintemail.com'),
  ('spam4.me'), ('mytemp.email'), ('burnermail.io'), ('tmpmail.org'),
  ('tmpmail.net'), ('moakt.com'), ('discard.email'), ('inboxkitten.com')
on conflict (domain) do nothing;

create or replace function public.is_email_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.blocked_email_domains as blocked
    where blocked.domain = lower(split_part(coalesce(p_email, ''), '@', 2))
  );
$$;

revoke all on function public.is_email_allowed(text) from public;
grant execute on function public.is_email_allowed(text) to anon, authenticated;

create or replace function public.reject_blocked_email_domains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null
    and (tg_op = 'INSERT' or new.email is distinct from old.email)
    and not public.is_email_allowed(new.email) then
    raise exception 'Disposable email addresses are not allowed' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_blocked_email_domains on auth.users;
create trigger reject_blocked_email_domains
  before insert or update of email on auth.users
  for each row execute procedure public.reject_blocked_email_domains();

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
