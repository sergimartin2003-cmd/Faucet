-- Casino: multi-step games (mines, hi-lo, blackjack). The whole round is derived
-- from one nonce when it starts and kept in casino_sessions.state, which clients
-- cannot read: mine positions and upcoming cards stay hidden until the round ends.
-- The bet is debited on start and the round is settled when it finishes.

create or replace function public.casino_require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  return v_user;
end;
$$;

create or replace function public.casino_assert_no_session(p_user uuid, p_game text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.casino_sessions as s where s.user_id = p_user and s.game = p_game and s.active) then
    raise exception 'Game in progress' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.casino_balance(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select a.points from public.daily_faucet_accounts as a where a.user_id = p_user), 0);
$$;

-- ---------------------------------------------------------------------------
-- Mines: 5x5 grid. Multiplier after k safe tiles = 0.99 * C(25, k) / C(25 - mines, k).
-- ---------------------------------------------------------------------------
create or replace function public.casino_mines_multiplier(p_mines integer, p_safe integer)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_m double precision := 0.99;
  v_i integer;
begin
  if p_safe <= 0 then
    return 1;
  end if;
  for v_i in 0..p_safe - 1 loop
    v_m := v_m * (25 - v_i)::double precision / (25 - p_mines - v_i);
  end loop;
  return trunc(v_m::numeric, 4);
end;
$$;

create or replace function public.casino_mines_view(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.casino_sessions;
  v_count integer;
  v_safe integer;
begin
  select * into s from public.casino_sessions as x where x.id = p_id;
  v_count := (s.state ->> 'mines_count')::integer;
  v_safe := jsonb_array_length(s.state -> 'revealed');
  return jsonb_build_object(
    'session_id', s.id,
    'game', 'mines',
    'bet', s.bet,
    'mines_count', v_count,
    'revealed', s.state -> 'revealed',
    'multiplier', public.casino_mines_multiplier(v_count, v_safe),
    'next_multiplier', case when v_safe < 25 - v_count then public.casino_mines_multiplier(v_count, v_safe + 1) end,
    'active', s.active,
    'outcome', s.state ->> 'outcome',
    'payout', coalesce((s.state ->> 'payout')::integer, 0),
    'hit', s.state -> 'hit',
    'mines', case when s.active then null else s.state -> 'mines' end,
    'nonce', s.nonce,
    'server_seed_hash', s.server_seed_hash,
    'client_seed', s.client_seed,
    'balance', public.casino_balance(s.user_id)
  );
end;
$$;

create or replace function public.mines_start(p_bet integer, p_mines integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_floats double precision[];
  v_pool integer[];
  v_i integer;
  v_j integer;
  v_tmp integer;
  v_id bigint;
begin
  if p_mines is null or p_mines not between 1 and 24 then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  perform public.casino_assert_no_session(public.casino_require_user(), 'mines');
  select * into c from public.casino_begin(p_bet);
  perform public.casino_adjust_balance(c.o_user, -p_bet);

  v_floats := public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 24);
  v_pool := array(select generate_series(0, 24));
  for v_i in 0..p_mines - 1 loop
    v_j := v_i + floor(v_floats[v_i + 1] * (25 - v_i))::integer;
    v_tmp := v_pool[v_i + 1];
    v_pool[v_i + 1] := v_pool[v_j + 1];
    v_pool[v_j + 1] := v_tmp;
  end loop;

  insert into public.casino_sessions (user_id, game, bet, state, server_seed_hash, client_seed, nonce)
  values (
    c.o_user, 'mines', p_bet,
    jsonb_build_object('mines', to_jsonb(v_pool[1:p_mines]), 'mines_count', p_mines, 'revealed', '[]'::jsonb, 'outcome', 'playing'),
    c.o_hash, c.o_client_seed, c.o_nonce
  )
  returning id into v_id;

  return public.casino_mines_view(v_id);
end;
$$;

create or replace function public.casino_mines_finish(p_id bigint, p_busted boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.casino_sessions;
  v_count integer;
  v_safe integer;
  v_mult numeric;
  v_payout integer;
begin
  select * into s from public.casino_sessions as x where x.id = p_id;
  v_count := (s.state ->> 'mines_count')::integer;
  v_safe := jsonb_array_length(s.state -> 'revealed');
  v_mult := case when p_busted then 0 else public.casino_mines_multiplier(v_count, v_safe) end;
  v_payout := public.casino_payout(s.bet, v_mult);

  update public.casino_sessions as x
  set active = false,
      state = x.state || jsonb_build_object('outcome', case when p_busted then 'busted' else 'cashed' end, 'payout', v_payout),
      updated_at = now()
  where x.id = p_id;

  perform public.casino_settle(
    s.user_id, 'mines', s.bet, v_payout, v_mult,
    jsonb_build_object('mines', v_count),
    jsonb_build_object('mines', s.state -> 'mines', 'revealed', s.state -> 'revealed', 'hit', s.state -> 'hit'),
    s.server_seed_hash, s.client_seed, s.nonce, true
  );
  return public.casino_mines_view(p_id);
end;
$$;

create or replace function public.mines_reveal(p_tile integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.casino_require_user();
  s public.casino_sessions;
begin
  select * into s from public.casino_sessions as x
  where x.user_id = v_user and x.game = 'mines' and x.active
  for update;
  if not found then
    raise exception 'No active game' using errcode = 'P0001';
  end if;
  if p_tile is null or p_tile not between 0 and 24 or (s.state -> 'revealed') @> to_jsonb(p_tile) then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;

  if (s.state -> 'mines') @> to_jsonb(p_tile) then
    update public.casino_sessions as x
    set state = x.state || jsonb_build_object('hit', p_tile)
    where x.id = s.id;
    return public.casino_mines_finish(s.id, true);
  end if;

  update public.casino_sessions as x
  set state = jsonb_set(x.state, '{revealed}', (x.state -> 'revealed') || to_jsonb(p_tile)),
      updated_at = now()
  where x.id = s.id;

  if jsonb_array_length(s.state -> 'revealed') + 1 >= 25 - (s.state ->> 'mines_count')::integer then
    return public.casino_mines_finish(s.id, false);
  end if;
  return public.casino_mines_view(s.id);
end;
$$;

create or replace function public.mines_cashout()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.casino_require_user();
  s public.casino_sessions;
begin
  select * into s from public.casino_sessions as x
  where x.user_id = v_user and x.game = 'mines' and x.active
  for update;
  if not found then
    raise exception 'No active game' using errcode = 'P0001';
  end if;
  if jsonb_array_length(s.state -> 'revealed') = 0 then
    raise exception 'Nothing to cash out' using errcode = 'P0001';
  end if;
  return public.casino_mines_finish(s.id, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Hi-Lo: guess whether the next card is higher-or-equal or lower-or-equal.
-- Ranks A=1 .. K=13. Step multiplier = 0.99 / probability.
-- ---------------------------------------------------------------------------
create or replace function public.casino_hilo_step(p_card integer, p_choice text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_rank integer := p_card % 13 + 1;
  v_outs integer;
begin
  -- Winning ranks out of 13; the step pays 0.99 * 13 / outs.
  v_outs := case p_choice when 'higher' then 14 - v_rank when 'lower' then v_rank end;
  if v_outs is null or v_outs >= 13 then
    return null;
  end if;
  return trunc(12.87 / v_outs, 4);
end;
$$;

create or replace function public.casino_hilo_view(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.casino_sessions;
  v_card integer;
begin
  select * into s from public.casino_sessions as x where x.id = p_id;
  v_card := (s.state -> 'cards' ->> (s.state ->> 'pos')::integer)::integer;
  return jsonb_build_object(
    'session_id', s.id,
    'game', 'hilo',
    'bet', s.bet,
    'card', v_card,
    'multiplier', (s.state ->> 'multiplier')::numeric,
    'steps', jsonb_build_object('higher', public.casino_hilo_step(v_card, 'higher'), 'lower', public.casino_hilo_step(v_card, 'lower')),
    'history', s.state -> 'history',
    'guesses', (s.state ->> 'guesses')::integer,
    'skips', (s.state ->> 'skips')::integer,
    'active', s.active,
    'outcome', s.state ->> 'outcome',
    'payout', coalesce((s.state ->> 'payout')::integer, 0),
    'nonce', s.nonce,
    'server_seed_hash', s.server_seed_hash,
    'client_seed', s.client_seed,
    'balance', public.casino_balance(s.user_id)
  );
end;
$$;

create or replace function public.hilo_start(p_bet integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_floats double precision[];
  v_cards integer[];
  v_id bigint;
begin
  perform public.casino_assert_no_session(public.casino_require_user(), 'hilo');
  select * into c from public.casino_begin(p_bet);
  perform public.casino_adjust_balance(c.o_user, -p_bet);

  v_floats := public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 100);
  v_cards := array(select floor(f * 52)::integer from unnest(v_floats) with ordinality as t (f, i) order by i);

  insert into public.casino_sessions (user_id, game, bet, state, server_seed_hash, client_seed, nonce)
  values (
    c.o_user, 'hilo', p_bet,
    jsonb_build_object(
      'cards', to_jsonb(v_cards), 'pos', 0, 'multiplier', 1, 'guesses', 0, 'skips', 0,
      'history', jsonb_build_array(jsonb_build_object('card', v_cards[1], 'guess', 'start')),
      'outcome', 'playing'
    ),
    c.o_hash, c.o_client_seed, c.o_nonce
  )
  returning id into v_id;

  return public.casino_hilo_view(v_id);
end;
$$;

create or replace function public.casino_hilo_finish(p_id bigint, p_busted boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.casino_sessions;
  v_mult numeric;
  v_payout integer;
begin
  select * into s from public.casino_sessions as x where x.id = p_id;
  v_mult := case when p_busted then 0 else (s.state ->> 'multiplier')::numeric end;
  v_payout := public.casino_payout(s.bet, v_mult);

  update public.casino_sessions as x
  set active = false,
      state = x.state || jsonb_build_object('outcome', case when p_busted then 'busted' else 'cashed' end, 'payout', v_payout),
      updated_at = now()
  where x.id = p_id;

  perform public.casino_settle(
    s.user_id, 'hilo', s.bet, v_payout, v_mult,
    '{}'::jsonb,
    jsonb_build_object('history', s.state -> 'history', 'guesses', s.state -> 'guesses'),
    s.server_seed_hash, s.client_seed, s.nonce, true
  );
  return public.casino_hilo_view(p_id);
end;
$$;

create or replace function public.hilo_guess(p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.casino_require_user();
  s public.casino_sessions;
  v_pos integer;
  v_card integer;
  v_next integer;
  v_step numeric;
  v_correct boolean;
  v_mult numeric;
begin
  if p_choice is null or p_choice not in ('higher', 'lower', 'skip') then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  select * into s from public.casino_sessions as x
  where x.user_id = v_user and x.game = 'hilo' and x.active
  for update;
  if not found then
    raise exception 'No active game' using errcode = 'P0001';
  end if;

  v_pos := (s.state ->> 'pos')::integer;
  if v_pos >= 99 then
    raise exception 'Deck exhausted' using errcode = 'P0001';
  end if;
  v_card := (s.state -> 'cards' ->> v_pos)::integer;
  v_next := (s.state -> 'cards' ->> (v_pos + 1))::integer;

  if p_choice = 'skip' then
    if (s.state ->> 'skips')::integer >= 52 then
      raise exception 'Invalid parameters' using errcode = '22023';
    end if;
    update public.casino_sessions as x
    set state = x.state || jsonb_build_object(
          'pos', v_pos + 1,
          'skips', (x.state ->> 'skips')::integer + 1,
          'history', (x.state -> 'history') || jsonb_build_object('card', v_next, 'guess', 'skip')
        ),
        updated_at = now()
    where x.id = s.id;
    return public.casino_hilo_view(s.id);
  end if;

  v_step := public.casino_hilo_step(v_card, p_choice);
  if v_step is null then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  v_correct := case p_choice
    when 'higher' then v_next % 13 >= v_card % 13
    else v_next % 13 <= v_card % 13
  end;
  v_mult := trunc((s.state ->> 'multiplier')::numeric * v_step, 4);

  update public.casino_sessions as x
  set state = x.state || jsonb_build_object(
        'pos', v_pos + 1,
        'multiplier', case when v_correct then v_mult else (x.state ->> 'multiplier')::numeric end,
        'guesses', (x.state ->> 'guesses')::integer + case when v_correct then 1 else 0 end,
        'history', (x.state -> 'history') || jsonb_build_object('card', v_next, 'guess', p_choice, 'correct', v_correct)
      ),
      updated_at = now()
  where x.id = s.id;

  if not v_correct then
    return public.casino_hilo_finish(s.id, true);
  end if;
  if public.casino_payout(s.bet, v_mult) >= 1000000 then
    return public.casino_hilo_finish(s.id, false);
  end if;
  return public.casino_hilo_view(s.id);
end;
$$;

create or replace function public.hilo_cashout()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.casino_require_user();
  s public.casino_sessions;
begin
  select * into s from public.casino_sessions as x
  where x.user_id = v_user and x.game = 'hilo' and x.active
  for update;
  if not found then
    raise exception 'No active game' using errcode = 'P0001';
  end if;
  if (s.state ->> 'guesses')::integer = 0 then
    raise exception 'Nothing to cash out' using errcode = 'P0001';
  end if;
  return public.casino_hilo_finish(s.id, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Blackjack: infinite deck, dealer stands on all 17s, blackjack pays 3:2,
-- double down on the first two cards, no split, no insurance.
-- Cards are 0..51: rank = card % 13 (0 = A, 9..12 = 10/J/Q/K), suit = card / 13.
-- ---------------------------------------------------------------------------
create or replace function public.casino_bj_total(p_cards integer[])
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_aces integer := 0;
  v_card integer;
  v_rank integer;
begin
  foreach v_card in array coalesce(p_cards, '{}') loop
    v_rank := v_card % 13 + 1;
    if v_rank = 1 then
      v_aces := v_aces + 1;
      v_total := v_total + 11;
    elsif v_rank >= 10 then
      v_total := v_total + 10;
    else
      v_total := v_total + v_rank;
    end if;
  end loop;
  while v_total > 21 and v_aces > 0 loop
    v_total := v_total - 10;
    v_aces := v_aces - 1;
  end loop;
  return v_total;
end;
$$;

create or replace function public.casino_json_ints(p_value jsonb)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array(select e::integer from jsonb_array_elements_text(p_value) with ordinality as t (e, i) order by i), '{}');
$$;

create or replace function public.casino_bj_view(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.casino_sessions;
  v_player integer[];
  v_dealer integer[];
begin
  select * into s from public.casino_sessions as x where x.id = p_id;
  v_player := public.casino_json_ints(s.state -> 'player');
  v_dealer := public.casino_json_ints(s.state -> 'dealer');
  if s.active then
    v_dealer := v_dealer[1:1];
  end if;
  return jsonb_build_object(
    'session_id', s.id,
    'game', 'blackjack',
    'bet', s.bet,
    'player', to_jsonb(v_player),
    'player_total', public.casino_bj_total(v_player),
    'dealer', to_jsonb(v_dealer),
    'dealer_total', public.casino_bj_total(v_dealer),
    'can_double', s.active and cardinality(v_player) = 2,
    'doubled', coalesce((s.state ->> 'doubled')::boolean, false),
    'active', s.active,
    'outcome', s.state ->> 'outcome',
    'payout', coalesce((s.state ->> 'payout')::integer, 0),
    'nonce', s.nonce,
    'server_seed_hash', s.server_seed_hash,
    'client_seed', s.client_seed,
    'balance', public.casino_balance(s.user_id)
  );
end;
$$;

create or replace function public.casino_bj_resolve(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.casino_sessions;
  v_cards integer[];
  v_pos integer;
  v_player integer[];
  v_dealer integer[];
  v_pt integer;
  v_dt integer;
  v_outcome text;
  v_mult numeric;
  v_payout integer;
begin
  select * into s from public.casino_sessions as x where x.id = p_id;
  v_cards := public.casino_json_ints(s.state -> 'cards');
  v_pos := (s.state ->> 'pos')::integer;
  v_player := public.casino_json_ints(s.state -> 'player');
  v_dealer := public.casino_json_ints(s.state -> 'dealer');
  v_pt := public.casino_bj_total(v_player);
  v_dt := public.casino_bj_total(v_dealer);

  if cardinality(v_player) = 2 and v_pt = 21 and cardinality(v_dealer) = 2 and v_dt = 21 then
    v_outcome := 'push';
  elsif cardinality(v_player) = 2 and v_pt = 21 and not coalesce((s.state ->> 'doubled')::boolean, false) then
    v_outcome := 'blackjack';
  elsif cardinality(v_dealer) = 2 and v_dt = 21 and v_pos = 4 then
    v_outcome := 'dealer_blackjack';
  elsif v_pt > 21 then
    v_outcome := 'bust';
  else
    while v_dt < 17 loop
      v_dealer := v_dealer || v_cards[v_pos + 1];
      v_pos := v_pos + 1;
      v_dt := public.casino_bj_total(v_dealer);
    end loop;
    v_outcome := case
      when v_dt > 21 or v_pt > v_dt then 'win'
      when v_pt = v_dt then 'push'
      else 'lose'
    end;
  end if;

  v_mult := case v_outcome when 'blackjack' then 2.5 when 'win' then 2 when 'push' then 1 else 0 end;
  v_payout := public.casino_payout(s.bet, v_mult);

  update public.casino_sessions as x
  set active = false,
      state = x.state || jsonb_build_object('dealer', to_jsonb(v_dealer), 'pos', v_pos, 'outcome', v_outcome, 'payout', v_payout),
      updated_at = now()
  where x.id = p_id;

  perform public.casino_settle(
    s.user_id, 'blackjack', s.bet, v_payout, v_mult,
    jsonb_build_object('doubled', coalesce((s.state ->> 'doubled')::boolean, false)),
    jsonb_build_object('player', to_jsonb(v_player), 'dealer', to_jsonb(v_dealer), 'outcome', v_outcome),
    s.server_seed_hash, s.client_seed, s.nonce, true
  );
  return public.casino_bj_view(p_id);
end;
$$;

create or replace function public.blackjack_start(p_bet integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_floats double precision[];
  v_cards integer[];
  v_player integer[];
  v_dealer integer[];
  v_id bigint;
begin
  perform public.casino_assert_no_session(public.casino_require_user(), 'blackjack');
  select * into c from public.casino_begin(p_bet);
  perform public.casino_adjust_balance(c.o_user, -p_bet);

  v_floats := public.casino_floats(c.o_server_seed, c.o_client_seed, c.o_nonce, 52);
  v_cards := array(select floor(f * 52)::integer from unnest(v_floats) with ordinality as t (f, i) order by i);
  v_player := array[v_cards[1], v_cards[3]];
  v_dealer := array[v_cards[2], v_cards[4]];

  insert into public.casino_sessions (user_id, game, bet, state, server_seed_hash, client_seed, nonce)
  values (
    c.o_user, 'blackjack', p_bet,
    jsonb_build_object('cards', to_jsonb(v_cards), 'pos', 4, 'player', to_jsonb(v_player), 'dealer', to_jsonb(v_dealer), 'doubled', false, 'outcome', 'playing'),
    c.o_hash, c.o_client_seed, c.o_nonce
  )
  returning id into v_id;

  if public.casino_bj_total(v_player) = 21 or public.casino_bj_total(v_dealer) = 21 then
    return public.casino_bj_resolve(v_id);
  end if;
  return public.casino_bj_view(v_id);
end;
$$;

create or replace function public.blackjack_action(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.casino_require_user();
  s public.casino_sessions;
  v_cards integer[];
  v_pos integer;
  v_player integer[];
begin
  if p_action is null or p_action not in ('hit', 'stand', 'double') then
    raise exception 'Invalid parameters' using errcode = '22023';
  end if;
  select * into s from public.casino_sessions as x
  where x.user_id = v_user and x.game = 'blackjack' and x.active
  for update;
  if not found then
    raise exception 'No active game' using errcode = 'P0001';
  end if;

  if p_action = 'stand' then
    return public.casino_bj_resolve(s.id);
  end if;

  v_cards := public.casino_json_ints(s.state -> 'cards');
  v_pos := (s.state ->> 'pos')::integer;
  v_player := public.casino_json_ints(s.state -> 'player');

  if p_action = 'double' then
    if cardinality(v_player) <> 2 then
      raise exception 'Invalid parameters' using errcode = '22023';
    end if;
    perform public.casino_adjust_balance(v_user, -s.bet);
    v_player := v_player || v_cards[v_pos + 1];
    update public.casino_sessions as x
    set bet = x.bet * 2,
        state = x.state || jsonb_build_object('player', to_jsonb(v_player), 'pos', v_pos + 1, 'doubled', true),
        updated_at = now()
    where x.id = s.id;
    return public.casino_bj_resolve(s.id);
  end if;

  v_player := v_player || v_cards[v_pos + 1];
  update public.casino_sessions as x
  set state = x.state || jsonb_build_object('player', to_jsonb(v_player), 'pos', v_pos + 1),
      updated_at = now()
  where x.id = s.id;

  if public.casino_bj_total(v_player) >= 21 then
    return public.casino_bj_resolve(s.id);
  end if;
  return public.casino_bj_view(s.id);
end;
$$;

-- Active round of a multi-step game, or null. Lets the page resume after a reload.
create or replace function public.casino_active_session(p_game text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  v_id := (
    select s.id from public.casino_sessions as s
    where s.user_id = public.casino_require_user() and s.game = p_game and s.active
  );
  if v_id is null then
    return null;
  end if;
  return case p_game
    when 'mines' then public.casino_mines_view(v_id)
    when 'hilo' then public.casino_hilo_view(v_id)
    when 'blackjack' then public.casino_bj_view(v_id)
  end;
end;
$$;

revoke all on function public.casino_require_user() from public, anon, authenticated;
revoke all on function public.casino_assert_no_session(uuid, text) from public, anon, authenticated;
revoke all on function public.casino_balance(uuid) from public, anon, authenticated;
revoke all on function public.casino_mines_multiplier(integer, integer) from public, anon, authenticated;
revoke all on function public.casino_mines_view(bigint) from public, anon, authenticated;
revoke all on function public.casino_mines_finish(bigint, boolean) from public, anon, authenticated;
revoke all on function public.casino_hilo_step(integer, text) from public, anon, authenticated;
revoke all on function public.casino_hilo_view(bigint) from public, anon, authenticated;
revoke all on function public.casino_hilo_finish(bigint, boolean) from public, anon, authenticated;
revoke all on function public.casino_bj_total(integer[]) from public, anon, authenticated;
revoke all on function public.casino_json_ints(jsonb) from public, anon, authenticated;
revoke all on function public.casino_bj_view(bigint) from public, anon, authenticated;
revoke all on function public.casino_bj_resolve(bigint) from public, anon, authenticated;

revoke all on function public.mines_start(integer, integer) from public, anon;
revoke all on function public.mines_reveal(integer) from public, anon;
revoke all on function public.mines_cashout() from public, anon;
revoke all on function public.hilo_start(integer) from public, anon;
revoke all on function public.hilo_guess(text) from public, anon;
revoke all on function public.hilo_cashout() from public, anon;
revoke all on function public.blackjack_start(integer) from public, anon;
revoke all on function public.blackjack_action(text) from public, anon;
revoke all on function public.casino_active_session(text) from public, anon;

grant execute on function public.mines_start(integer, integer) to authenticated;
grant execute on function public.mines_reveal(integer) to authenticated;
grant execute on function public.mines_cashout() to authenticated;
grant execute on function public.hilo_start(integer) to authenticated;
grant execute on function public.hilo_guess(text) to authenticated;
grant execute on function public.hilo_cashout() to authenticated;
grant execute on function public.blackjack_start(integer) to authenticated;
grant execute on function public.blackjack_action(text) to authenticated;
grant execute on function public.casino_active_session(text) to authenticated;
