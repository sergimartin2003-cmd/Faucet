-- Leaderboard visibility setting.
-- user_settings already has table-level select/insert/update grants for
-- authenticated users (migration 0006), so the new column is covered.
alter table public.user_settings
  add column if not exists show_on_leaderboard boolean not null default true;

-- More earn tasks.
alter table public.earn_task_completions
  drop constraint if exists earn_task_completions_task_key_check;

alter table public.earn_task_completions
  add constraint earn_task_completions_task_key_check
  check (task_key in ('complete_profile', 'profile_details', 'enable_2fa'));

-- The ledger links earn_task rows to earn_task_completions through source_id,
-- so no extra detail column is needed. Index to speed up monthly aggregation
-- and per-user history.
create index if not exists reward_ledger_created_at_idx
  on public.reward_ledger (created_at);

create index if not exists reward_ledger_user_created_at_idx
  on public.reward_ledger (user_id, created_at desc, id desc);

-- Same signature and return columns as migration 0003.
create or replace function public.complete_earn_task(task_key text)
returns table (
  awarded boolean,
  reward integer,
  balance integer,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_task text := task_key;
  v_account_balance integer;
  v_completion_id bigint;
  v_existing_reward integer;
  v_existing_at timestamptz;
  v_email_confirmed boolean;
  v_display_name text;
  v_country text;
  v_bio text;
  v_avatar_color text;
  v_met boolean := false;
  v_reward integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_task is null or v_task not in ('complete_profile', 'profile_details', 'enable_2fa') then
    raise exception 'Unknown earn task' using errcode = '22023';
  end if;

  v_reward := case v_task
    when 'complete_profile' then 25
    when 'profile_details' then 10
    when 'enable_2fa' then 30
  end;

  insert into public.daily_faucet_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  v_account_balance := (
    select account.points
    from public.daily_faucet_accounts as account
    where account.user_id = v_user_id
    for update
  );

  v_existing_at := (
    select completion.completed_at
    from public.earn_task_completions as completion
    where completion.user_id = v_user_id
      and completion.task_key = v_task
  );

  if v_existing_at is not null then
    v_existing_reward := (
      select completion.reward
      from public.earn_task_completions as completion
      where completion.user_id = v_user_id
        and completion.task_key = v_task
    );
    return query
      select false, v_existing_reward, v_account_balance, v_existing_at;
    return;
  end if;

  v_email_confirmed := (
    select (user_record.email_confirmed_at is not null)
    from auth.users as user_record
    where user_record.id = v_user_id
  );

  if v_task = 'complete_profile' then
    v_display_name := (
      select nullif(btrim(user_record.raw_user_meta_data ->> 'display_name'), '')
      from auth.users as user_record
      where user_record.id = v_user_id
    );
    v_met := coalesce(v_email_confirmed, false)
      and v_display_name is not null
      and char_length(v_display_name) <= 50;
  elsif v_task = 'profile_details' then
    v_country := (select nullif(btrim(p.country), '') from public.profiles as p where p.id = v_user_id);
    v_bio := (select nullif(btrim(p.bio), '') from public.profiles as p where p.id = v_user_id);
    v_avatar_color := (select p.avatar_color from public.profiles as p where p.id = v_user_id);
    v_met := coalesce(v_email_confirmed, false)
      and v_country is not null
      and v_bio is not null
      and v_avatar_color is not null;
  elsif v_task = 'enable_2fa' then
    v_met := coalesce(v_email_confirmed, false)
      and exists (
        select 1
        from auth.mfa_factors as factor
        where factor.user_id = v_user_id
          and factor.factor_type = 'totp'
          and factor.status = 'verified'
      );
  end if;

  if not v_met then
    raise exception 'Task requirements not met' using errcode = '22023';
  end if;

  insert into public.earn_task_completions (user_id, task_key, reward, completed_at)
  values (v_user_id, v_task, v_reward, v_now)
  returning id into v_completion_id;

  update public.daily_faucet_accounts as account
  set points = account.points + v_reward,
      updated_at = v_now
  where account.user_id = v_user_id
  returning account.points into v_account_balance;

  insert into public.reward_ledger (user_id, source_type, source_id, points, balance_after, created_at)
  values (v_user_id, 'earn_task', v_completion_id, v_reward, v_account_balance, v_now);

  return query
    select true, v_reward, v_account_balance, v_now;
end;
$$;

revoke all on function public.complete_earn_task(text) from public, anon;
grant execute on function public.complete_earn_task(text) to authenticated;

-- Reward history for the calling user, newest first.
create or replace function public.get_reward_history(
  p_limit integer default 50,
  p_offset integer default 0,
  p_source text default null
)
returns table (
  id bigint,
  source_type text,
  detail text,
  points integer,
  balance_after integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
    select
      l.id,
      l.source_type,
      case when l.source_type = 'earn_task' then c.task_key else null end,
      l.points,
      l.balance_after,
      l.created_at
    from public.reward_ledger as l
    left join public.earn_task_completions as c
      on l.source_type = 'earn_task'
      and c.id = l.source_id
      and c.user_id = l.user_id
    where l.user_id = v_user_id
      and (p_source is null or l.source_type = p_source)
    order by l.created_at desc, l.id desc
    limit v_limit
    offset v_offset;
end;
$$;

revoke all on function public.get_reward_history(integer, integer, text) from public, anon;
grant execute on function public.get_reward_history(integer, integer, text) to authenticated;

-- Monthly leaderboard (UTC calendar month).
create or replace function public.get_leaderboard(p_limit integer default 20)
returns table (
  rank bigint,
  display_name text,
  avatar_color text,
  points_month integer,
  is_me boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := (select auth.uid());
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_month_end timestamptz := (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
    with month_totals as (
      select
        l.user_id,
        least(sum(l.points), 2147483647)::integer as pts,
        min(l.created_at) as first_at
      from public.reward_ledger as l
      where l.created_at >= v_month_start
        and l.created_at < v_month_end
        and l.points > 0
      group by l.user_id
    ),
    ranked as (
      select
        mt.user_id,
        mt.pts,
        row_number() over (order by mt.pts desc, mt.first_at asc, mt.user_id asc) as rn
      from month_totals as mt
      where mt.pts > 0
    )
    select
      r.rn,
      case
        when r.user_id = v_user_id or coalesce(s.show_on_leaderboard, true)
          then nullif(btrim(p.display_name), '')
        else null
      end,
      case
        when r.user_id = v_user_id or coalesce(s.show_on_leaderboard, true)
          then p.avatar_color
        else null
      end,
      r.pts,
      (r.user_id = v_user_id)
    from ranked as r
    left join public.profiles as p on p.id = r.user_id
    left join public.user_settings as s on s.user_id = r.user_id
    where r.rn <= v_limit
      or r.user_id = v_user_id
    order by r.rn;
end;
$$;

revoke all on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;
