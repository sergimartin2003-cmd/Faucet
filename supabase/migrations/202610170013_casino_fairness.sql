-- Casino: provably fair seed management and player statistics.

create or replace function public.casino_fairness()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.casino_require_user();
  s public.casino_seeds;
begin
  perform public.casino_ensure_seed(v_user);
  select * into s from public.casino_seeds as x where x.user_id = v_user;
  return jsonb_build_object('server_seed_hash', s.server_seed_hash, 'client_seed', s.client_seed, 'nonce', s.nonce);
end;
$$;

-- Reveals the current server seed (so past bets can be verified) and starts a
-- new pair. Refused while a multi-step round is open, because revealing the
-- seed would expose its hidden cards or mines.
create or replace function public.casino_rotate_seed(p_client_seed text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.casino_require_user();
  v_client text := nullif(btrim(coalesce(p_client_seed, '')), '');
  v_seed text;
  s public.casino_seeds;
begin
  if v_client is not null and v_client !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  if exists (select 1 from public.casino_sessions as x where x.user_id = v_user and x.active) then
    raise exception 'Game in progress' using errcode = 'P0001';
  end if;

  perform public.casino_ensure_seed(v_user);
  select * into s from public.casino_seeds as x where x.user_id = v_user for update;

  insert into public.casino_revealed_seeds (user_id, server_seed, server_seed_hash, client_seed, bets_count)
  values (v_user, s.server_seed, s.server_seed_hash, s.client_seed, s.nonce);

  v_seed := encode(extensions.gen_random_bytes(32), 'hex');
  update public.casino_seeds as x
  set server_seed = v_seed,
      server_seed_hash = public.casino_hash(v_seed),
      client_seed = coalesce(v_client, encode(extensions.gen_random_bytes(8), 'hex')),
      nonce = 0,
      created_at = now()
  where x.user_id = v_user;

  return public.casino_fairness() || jsonb_build_object(
    'revealed', jsonb_build_object(
      'server_seed', s.server_seed,
      'server_seed_hash', s.server_seed_hash,
      'client_seed', s.client_seed,
      'bets_count', s.nonce
    )
  );
end;
$$;

create or replace function public.casino_stats()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'bets', count(*),
    'wagered', coalesce(sum(b.bet), 0),
    'paid', coalesce(sum(b.payout), 0),
    'profit', coalesce(sum(b.payout - b.bet), 0),
    'wins', count(*) filter (where b.payout > b.bet),
    'best_multiplier', coalesce(max(b.multiplier), 0),
    'best_win', coalesce(max(b.payout - b.bet), 0)
  )
  from public.casino_bets as b
  where b.user_id = public.casino_require_user();
$$;

revoke all on function public.casino_fairness() from public, anon;
revoke all on function public.casino_rotate_seed(text) from public, anon;
revoke all on function public.casino_stats() from public, anon;
grant execute on function public.casino_fairness() to authenticated;
grant execute on function public.casino_rotate_seed(text) to authenticated;
grant execute on function public.casino_stats() to authenticated;
