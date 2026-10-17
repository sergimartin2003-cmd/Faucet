-- Casino: single-round games. Each RPC validates its parameters, takes the next
-- nonce, derives the outcome from casino_floats and settles in one transaction.
-- Outcome maths runs in double precision so browsers can reproduce it exactly.

create or replace function public.casino_plinko_table(p_rows integer, p_risk text)
returns numeric[]
language sql
immutable
set search_path = ''
as $$
  select case p_rows::text || ':' || p_risk
    when '8:low' then array[5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6]
    when '8:medium' then array[13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13]
    when '8:high' then array[29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29]
    when '12:low' then array[10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10]
    when '12:medium' then array[33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33]
    when '12:high' then array[170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170]
    when '16:low' then array[16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16]
    when '16:medium' then array[110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110]
    when '16:high' then array[1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]
  end::numeric[];
$$;

-- Index = number of hits.
create or replace function public.casino_keno_table(p_picks integer)
returns numeric[]
language sql
immutable
set search_path = ''
as $$
  select case p_picks
    when 1 then array[0.7, 1.85]
    when 2 then array[0, 2, 3.8]
    when 3 then array[0, 1.1, 1.38, 26]
    when 4 then array[0, 0, 2.2, 7.9, 90]
    when 5 then array[0, 0, 1.5, 4.2, 13, 300]
    when 6 then array[0, 0, 1.1, 2, 6.2, 100, 700]
    when 7 then array[0, 0, 1.1, 1.6, 3.5, 15, 225, 700]
    when 8 then array[0, 0, 1.1, 1.5, 2, 5.5, 39, 100, 800]
    when 9 then array[0, 0, 1.1, 1.3, 1.7, 2.5, 7.5, 50, 250, 1000]
    when 10 then array[0, 0, 1.1, 1.2, 1.3, 1.8, 3.5, 13, 50, 250, 1000]
  end::numeric[];
$$;

create or replace function public.casino_wheel_table(p_risk text)
returns numeric[]
language sql
immutable
set search_path = ''
as $$
  select case p_risk
    when 'low' then array[1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0, 1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0]
    when 'medium' then array[0, 1.9, 0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.9, 0, 1.5, 0, 2, 0, 1.5, 0, 3]
    when 'high' then array[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19.8]
  end::numeric[];
$$;

-- Reel weights out of 92: cherry 20, lemon 18, orange 16, grape 14, bell 12, star 8, seven 4.
create or replace function public.casino_slot_symbol(p_float double precision)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_x double precision := p_float * 92;
begin
  if v_x < 20 then return 'cherry';
  elsif v_x < 38 then return 'lemon';
  elsif v_x < 54 then return 'orange';
  elsif v_x < 68 then return 'grape';
  elsif v_x < 80 then return 'bell';
  elsif v_x < 88 then return 'star';
  end if;
  return 'seven';
end;
$$;

-- Limbo and crash share the same distribution: P(point >= x) = 0.99 / x.
create or replace function public.casino_crash_point(p_float double precision)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select least(greatest(floor(0.99::double precision / (1 - p_float) * 100) / 100, 1), 1000000)::numeric;
$$;

create or replace function public.play_dice(p_bet integer, p_target numeric, p_over boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_target numeric := round(p_target, 2);
  v_chance numeric;
  v_mult numeric;
  v_roll numeric;
  v_win boolean;
begin
  if v_target is null or v_target < 2 or v_target > 98 or p_over is null then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  select * into c from public.casino_begin(p_bet);

  v_chance := case when p_over then 100 - v_target else v_target end;
  v_mult := trunc(99 / v_chance, 4);
  v_roll := round(floor((public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 1))[1] * 10001)::numeric / 100, 2);
  v_win := case when p_over then v_roll > v_target else v_roll < v_target end;

  return public.casino_settle(
    c.o_user, 'dice', p_bet,
    case when v_win then public.casino_payout(p_bet, v_mult) else 0 end,
    case when v_win then v_mult else 0 end,
    jsonb_build_object('target', v_target, 'over', p_over, 'chance', v_chance, 'payout_multiplier', v_mult),
    jsonb_build_object('roll', v_roll),
    c.o_hash, c.o_client_seed, c.o_nonce, false
  );
end;
$$;

create or replace function public.casino_play_multiplier(p_game text, p_bet integer, p_target numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_target numeric := round(p_target, 2);
  v_point numeric;
  v_win boolean;
begin
  if v_target is null or v_target < 1.01 or v_target > 10000 then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  select * into c from public.casino_begin(p_bet);

  v_point := public.casino_crash_point((public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 1))[1]);
  v_win := v_point >= v_target;

  return public.casino_settle(
    c.o_user, p_game, p_bet,
    case when v_win then public.casino_payout(p_bet, v_target) else 0 end,
    case when v_win then v_target else 0 end,
    jsonb_build_object('target', v_target),
    jsonb_build_object('point', v_point),
    c.o_hash, c.o_client_seed, c.o_nonce, false
  );
end;
$$;

create or replace function public.play_limbo(p_bet integer, p_target numeric)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.casino_play_multiplier('limbo', p_bet, p_target);
$$;

create or replace function public.play_crash(p_bet integer, p_cashout numeric)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.casino_play_multiplier('crash', p_bet, p_cashout);
$$;

create or replace function public.play_coinflip(p_bet integer, p_side text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_side text;
  v_win boolean;
begin
  if p_side is null or p_side not in ('heads', 'tails') then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  select * into c from public.casino_begin(p_bet);

  v_side := case when (public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 1))[1] < 0.5 then 'heads' else 'tails' end;
  v_win := v_side = p_side;

  return public.casino_settle(
    c.o_user, 'coinflip', p_bet,
    case when v_win then public.casino_payout(p_bet, 1.98) else 0 end,
    case when v_win then 1.98 else 0 end,
    jsonb_build_object('side', p_side),
    jsonb_build_object('side', v_side),
    c.o_hash, c.o_client_seed, c.o_nonce, false
  );
end;
$$;

-- p_bets: [{ "kind": "number", "value": 17, "amount": 5 }, { "kind": "red", "amount": 10 }, ...]
-- kinds: number (0-36, pays 36x), red, black, even, odd, low, high (2x), dozen, column (1-3, 3x).
create or replace function public.play_roulette(p_bets jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_entry jsonb;
  v_kind text;
  v_value integer;
  v_amount numeric;
  v_total integer := 0;
  v_payout bigint := 0;
  v_n integer;
  v_hit boolean;
  v_reds integer[] := array[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
begin
  if p_bets is null or jsonb_typeof(p_bets) <> 'array'
    or jsonb_array_length(p_bets) < 1 or jsonb_array_length(p_bets) > 40 then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;

  for v_entry in select e from jsonb_array_elements(p_bets) as e loop
    v_kind := v_entry ->> 'kind';
    if jsonb_typeof(v_entry -> 'amount') is distinct from 'number' then
      raise exception 'Invalid parameters' using errcode = '22023';
    end if;
    v_amount := (v_entry ->> 'amount')::numeric;
    if v_amount <> trunc(v_amount) or v_amount < 1 or v_amount > 100000 then
      raise exception 'Invalid parameters' using errcode = '22023';
    end if;
    if v_kind in ('number', 'dozen', 'column') then
      if jsonb_typeof(v_entry -> 'value') is distinct from 'number' then
        raise exception 'Invalid parameters' using errcode = '22023';
      end if;
      v_value := (v_entry ->> 'value')::integer;
      if (v_kind = 'number' and v_value not between 0 and 36)
        or (v_kind <> 'number' and v_value not between 1 and 3) then
        raise exception 'Invalid parameters' using errcode = '22023';
      end if;
    elsif v_kind is null or v_kind not in ('red', 'black', 'even', 'odd', 'low', 'high') then
      raise exception 'Invalid parameters' using errcode = '22023';
    end if;
    v_total := v_total + v_amount::integer;
    if v_total > 100000 then
      raise exception 'Invalid bet' using errcode = '22023';
    end if;
  end loop;

  select * into c from public.casino_begin(v_total);
  v_n := floor((public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 1))[1] * 37)::integer;

  for v_entry in select e from jsonb_array_elements(p_bets) as e loop
    v_kind := v_entry ->> 'kind';
    v_value := (v_entry ->> 'value')::integer;
    v_amount := (v_entry ->> 'amount')::numeric;
    v_hit := case v_kind
      when 'number' then v_n = v_value
      when 'red' then v_n = any (v_reds)
      when 'black' then v_n > 0 and not (v_n = any (v_reds))
      when 'even' then v_n > 0 and v_n % 2 = 0
      when 'odd' then v_n % 2 = 1
      when 'low' then v_n between 1 and 18
      when 'high' then v_n between 19 and 36
      when 'dozen' then v_n between (v_value - 1) * 12 + 1 and v_value * 12
      when 'column' then v_n > 0 and (v_n - 1) % 3 + 1 = v_value
    end;
    if v_hit then
      v_payout := v_payout + v_amount::bigint * case when v_kind = 'number' then 36 when v_kind in ('dozen', 'column') then 3 else 2 end;
    end if;
  end loop;

  v_payout := least(v_payout, 1000000);
  return public.casino_settle(
    c.o_user, 'roulette', v_total, v_payout::integer,
    round(v_payout::numeric / v_total, 4),
    jsonb_build_object('bets', p_bets),
    jsonb_build_object('number', v_n),
    c.o_hash, c.o_client_seed, c.o_nonce, false
  );
end;
$$;

create or replace function public.play_slots(p_bet integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_floats double precision[];
  v_reels text[];
  v_mult numeric := 0;
begin
  select * into c from public.casino_begin(p_bet);
  v_floats := public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 3);
  v_reels := array[
    public.casino_slot_symbol(v_floats[1]),
    public.casino_slot_symbol(v_floats[2]),
    public.casino_slot_symbol(v_floats[3])
  ];

  if v_reels[1] = v_reels[2] and v_reels[2] = v_reels[3] then
    v_mult := case v_reels[1]
      when 'cherry' then 10 when 'lemon' then 15 when 'orange' then 20 when 'grape' then 30
      when 'bell' then 50 when 'star' then 100 else 500 end;
  elsif v_reels[1] = 'cherry' and v_reels[2] = 'cherry' then
    v_mult := 4;
  elsif v_reels[1] = 'cherry' then
    v_mult := 1;
  end if;

  return public.casino_settle(
    c.o_user, 'slots', p_bet, public.casino_payout(p_bet, v_mult), v_mult,
    '{}'::jsonb,
    jsonb_build_object('reels', to_jsonb(v_reels)),
    c.o_hash, c.o_client_seed, c.o_nonce, false
  );
end;
$$;

create or replace function public.play_plinko(p_bet integer, p_rows integer, p_risk text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_floats double precision[];
  v_path integer[] := '{}';
  v_bucket integer := 0;
  v_mult numeric;
  v_i integer;
begin
  if p_rows is null or p_rows not in (8, 12, 16) or p_risk is null or p_risk not in ('low', 'medium', 'high') then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  select * into c from public.casino_begin(p_bet);
  v_floats := public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, p_rows);

  for v_i in 1..p_rows loop
    if v_floats[v_i] >= 0.5 then
      v_path := v_path || 1;
      v_bucket := v_bucket + 1;
    else
      v_path := v_path || 0;
    end if;
  end loop;
  v_mult := (public.casino_plinko_table(p_rows, p_risk))[v_bucket + 1];

  return public.casino_settle(
    c.o_user, 'plinko', p_bet, public.casino_payout(p_bet, v_mult), v_mult,
    jsonb_build_object('rows', p_rows, 'risk', p_risk),
    jsonb_build_object('path', to_jsonb(v_path), 'bucket', v_bucket),
    c.o_hash, c.o_client_seed, c.o_nonce, false
  );
end;
$$;

create or replace function public.play_keno(p_bet integer, p_picks integer[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_floats double precision[];
  v_pool integer[];
  v_drawn integer[];
  v_count integer;
  v_hits integer;
  v_i integer;
  v_j integer;
  v_tmp integer;
  v_mult numeric;
begin
  v_count := coalesce(cardinality(p_picks), 0);
  if v_count < 1 or v_count > 10
    or exists (select 1 from unnest(p_picks) as p where p is null or p not between 1 and 40)
    or (select count(distinct p) from unnest(p_picks) as p) <> v_count then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  select * into c from public.casino_begin(p_bet);
  v_floats := public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 10);

  v_pool := array(select generate_series(1, 40));
  for v_i in 0..9 loop
    v_j := v_i + floor(v_floats[v_i + 1] * (40 - v_i))::integer;
    v_tmp := v_pool[v_i + 1];
    v_pool[v_i + 1] := v_pool[v_j + 1];
    v_pool[v_j + 1] := v_tmp;
  end loop;
  v_drawn := v_pool[1:10];
  v_hits := (select count(*) from unnest(p_picks) as p where p = any (v_drawn));
  v_mult := (public.casino_keno_table(v_count))[v_hits + 1];

  return public.casino_settle(
    c.o_user, 'keno', p_bet, public.casino_payout(p_bet, v_mult), v_mult,
    jsonb_build_object('picks', to_jsonb(p_picks)),
    jsonb_build_object('drawn', to_jsonb(v_drawn), 'hits', v_hits),
    c.o_hash, c.o_client_seed, c.o_nonce, false
  );
end;
$$;

create or replace function public.play_wheel(p_bet integer, p_risk text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_segment integer;
  v_mult numeric;
begin
  if p_risk is null or p_risk not in ('low', 'medium', 'high') then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  select * into c from public.casino_begin(p_bet);
  v_segment := floor((public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 1))[1] * 20)::integer;
  v_mult := (public.casino_wheel_table(p_risk))[v_segment + 1];

  return public.casino_settle(
    c.o_user, 'wheel', p_bet, public.casino_payout(p_bet, v_mult), v_mult,
    jsonb_build_object('risk', p_risk),
    jsonb_build_object('segment', v_segment),
    c.o_hash, c.o_client_seed, c.o_nonce, false
  );
end;
$$;

revoke all on function public.casino_plinko_table(integer, text) from public, anon, authenticated;
revoke all on function public.casino_keno_table(integer) from public, anon, authenticated;
revoke all on function public.casino_wheel_table(text) from public, anon, authenticated;
revoke all on function public.casino_slot_symbol(double precision) from public, anon, authenticated;
revoke all on function public.casino_crash_point(double precision) from public, anon, authenticated;
revoke all on function public.casino_play_multiplier(text, integer, numeric) from public, anon, authenticated;

revoke all on function public.play_dice(integer, numeric, boolean) from public, anon;
revoke all on function public.play_limbo(integer, numeric) from public, anon;
revoke all on function public.play_crash(integer, numeric) from public, anon;
revoke all on function public.play_coinflip(integer, text) from public, anon;
revoke all on function public.play_roulette(jsonb) from public, anon;
revoke all on function public.play_slots(integer) from public, anon;
revoke all on function public.play_plinko(integer, integer, text) from public, anon;
revoke all on function public.play_keno(integer, integer[]) from public, anon;
revoke all on function public.play_wheel(integer, text) from public, anon;

grant execute on function public.play_dice(integer, numeric, boolean) to authenticated;
grant execute on function public.play_limbo(integer, numeric) to authenticated;
grant execute on function public.play_crash(integer, numeric) to authenticated;
grant execute on function public.play_coinflip(integer, text) to authenticated;
grant execute on function public.play_roulette(jsonb) to authenticated;
grant execute on function public.play_slots(integer) to authenticated;
grant execute on function public.play_plinko(integer, integer, text) to authenticated;
grant execute on function public.play_keno(integer, integer[]) to authenticated;
grant execute on function public.play_wheel(integer, text) to authenticated;
