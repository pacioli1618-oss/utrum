-- Utrum: schema, tables and RPCs.
--
-- Lives in the QuemLeva Supabase project, in its own schema. The schema is not exposed through
-- the Data API: every read and write goes through the public.ut_* functions below.
--
-- Identity without accounts (docs/conventions.md):
--   * host token        — manages the list (details, items, participants); only its sha256 is stored.
--   * participant token — one person's comparisons and ranking; only its sha256 is stored, and the
--                          plain token lives on that person's device.
--
-- Rankings are computed in the browser from the person's own comparisons (src/lib/ranking.ts)
-- and sent back with the comparison that completes them. The server checks that a ranking covers
-- every item of the list exactly once, and only shows other people's rankings to someone who has
-- completed their own (participants.completed_at), so nobody is nudged by the others' choices.

create schema if not exists utrum;
revoke all on schema utrum from public, anon, authenticated;

------------------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------------------
create table utrum.lists (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null check (length(trim(title)) between 1 and 120),
  -- The question shown on every comparison: "Qual é mais urgente?".
  criterion        text not null check (length(trim(criterion)) between 1 and 140),
  criterion_detail text check (length(criterion_detail) <= 300),
  method           text not null default 'quick' check (method in ('quick', 'full')),
  locale           text not null default 'pt-BR' check (locale in ('pt-BR', 'es', 'en')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table utrum.host_tokens (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references utrum.lists(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index host_tokens_list_id_idx on utrum.host_tokens (list_id);

create table utrum.participants (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references utrum.lists(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 60),
  token_hash   text not null unique,
  device_id    uuid,
  -- Item ids, most to least; null while the person still has comparisons to make
  -- (including after a new item was added to the list).
  ranking      uuid[],
  -- First time the ranking was complete. Unlocks the others' rankings and stays set.
  completed_at timestamptz,
  -- Display order: the order people joined, independent of clock resolution.
  sequence_number bigint generated always as identity,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index participants_list_id_idx on utrum.participants (list_id);
-- Two "Ana" in one list would make the comparison of views ambiguous.
create unique index participants_list_id_name_idx on utrum.participants (list_id, lower(trim(name)));

create table utrum.items (
  id                      uuid primary key default gen_random_uuid(),
  list_id                 uuid not null references utrum.lists(id) on delete cascade,
  label                   text not null check (length(trim(label)) between 1 and 120),
  -- Null when the host added it; the participant's id when they suggested it.
  added_by_participant_id uuid references utrum.participants(id) on delete set null,
  -- Display order: the order the items were typed in, independent of clock resolution.
  sequence_number         bigint generated always as identity,
  created_at              timestamptz not null default now()
);
create index items_list_id_idx on utrum.items (list_id);
create index items_added_by_participant_id_idx on utrum.items (added_by_participant_id);
create unique index items_list_id_label_idx on utrum.items (list_id, lower(trim(label)));

-- One answer per person and pair of items, stored once with item_low_id < item_high_id.
create table utrum.comparisons (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references utrum.participants(id) on delete cascade,
  item_low_id    uuid not null references utrum.items(id) on delete cascade,
  item_high_id   uuid not null references utrum.items(id) on delete cascade,
  winner_id      uuid not null,
  created_at     timestamptz not null default now(),
  check (item_low_id < item_high_id),
  check (winner_id in (item_low_id, item_high_id)),
  unique (participant_id, item_low_id, item_high_id)
);
create index comparisons_item_low_id_idx on utrum.comparisons (item_low_id);
create index comparisons_item_high_id_idx on utrum.comparisons (item_high_id);
create index comparisons_participant_id_created_at_idx on utrum.comparisons (participant_id, created_at desc);

-- Anti-spam for ut_create_list, same rules as QuemLeva and AmigoSecreto.
create table utrum.secrets (
  name  text primary key,
  value text not null
);
insert into utrum.secrets (name, value)
values ('ip_salt', encode(extensions.gen_random_bytes(32), 'hex'));

create table utrum.create_list_log (
  id         bigint generated always as identity primary key,
  device_id  uuid,
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index create_list_log_device_id_idx on utrum.create_list_log (device_id, created_at desc) where device_id is not null;
create index create_list_log_ip_hash_idx on utrum.create_list_log (ip_hash, created_at desc) where ip_hash is not null;
create index create_list_log_created_at_idx on utrum.create_list_log (created_at);

-- RLS on and no policies: no direct access for anon/authenticated.
alter table utrum.lists           enable row level security;
alter table utrum.host_tokens     enable row level security;
alter table utrum.participants    enable row level security;
alter table utrum.items           enable row level security;
alter table utrum.comparisons     enable row level security;
alter table utrum.secrets         enable row level security;
alter table utrum.create_list_log enable row level security;
revoke all on all tables in schema utrum from public, anon, authenticated;

------------------------------------------------------------------------
-- 2. Internal helpers (schema utrum, not callable by clients)
------------------------------------------------------------------------
create function utrum.hash_token(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create function utrum.random_text(n int)
returns text language sql volatile set search_path = '' as $$
  -- Alphabet without look-alikes (0/o, 1/l/i) so links survive being read aloud.
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (get_byte(b, i) % 31) + 1, 1), '' order by i)
  from (select extensions.gen_random_bytes(n) as b) x, generate_series(0, n - 1) as i
$$;

create function utrum.require_list(p_slug text)
returns utrum.lists language plpgsql stable set search_path = '' as $$
declare l utrum.lists;
begin
  select * into l from utrum.lists where slug = p_slug;
  if not found then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  return l;
end $$;

create function utrum.require_host_list(p_slug text, p_host_token text)
returns utrum.lists language plpgsql stable set search_path = '' as $$
declare l utrum.lists;
begin
  select li.* into l
  from utrum.lists li
  join utrum.host_tokens h on h.list_id = li.id
  where li.slug = p_slug
    and h.token_hash = utrum.hash_token(p_host_token)
    and h.revoked_at is null;
  if not found then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return l;
end $$;

create function utrum.require_participant(p_slug text, p_participant_token text)
returns utrum.participants language plpgsql stable set search_path = '' as $$
declare p utrum.participants;
begin
  select pa.* into p
  from utrum.participants pa
  join utrum.lists l on l.id = pa.list_id
  where l.slug = p_slug and pa.token_hash = utrum.hash_token(p_participant_token);
  if not found then
    raise exception 'participant_not_found' using errcode = 'P0002';
  end if;
  return p;
end $$;

-- Inserts one participant and returns its plain token (only the hash is kept).
create function utrum.insert_participant(p_list_id uuid, p_name text, p_device_id uuid)
returns jsonb language plpgsql volatile set search_path = '' as $$
declare
  v_name  text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_token text := utrum.random_text(24);
  v_id    uuid;
begin
  if v_name = '' then
    raise exception 'participant_name_required' using errcode = '22023';
  end if;
  if (select count(*) from utrum.participants where list_id = p_list_id) >= 200 then
    raise exception 'list_full' using errcode = 'P0001';
  end if;
  if exists (select 1 from utrum.participants
             where list_id = p_list_id and lower(trim(name)) = lower(v_name)) then
    raise exception 'participant_name_taken' using errcode = '23505', detail = v_name;
  end if;

  insert into utrum.participants (list_id, name, token_hash, device_id, created_at)
  values (p_list_id, left(v_name, 60), utrum.hash_token(v_token), p_device_id, clock_timestamp())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'name', v_name, 'participant_token', v_token);
end $$;

-- Inserts one item. A label already on the list is skipped (returns null) when p_is_bulk —
-- people paste lists with repeats — and is an error ('item_label_taken') otherwise.
create function utrum.insert_item(p_list_id uuid, p_label text, p_participant_id uuid, p_is_bulk boolean)
returns uuid language plpgsql volatile set search_path = '' as $$
declare
  v_label text := left(regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g'), 120);
  v_id    uuid;
begin
  if v_label = '' then
    if p_is_bulk then return null; end if;
    raise exception 'item_label_required' using errcode = '22023';
  end if;
  if exists (select 1 from utrum.items where list_id = p_list_id and lower(trim(label)) = lower(v_label)) then
    if p_is_bulk then return null; end if;
    raise exception 'item_label_taken' using errcode = '23505', detail = v_label;
  end if;
  if (select count(*) from utrum.items where list_id = p_list_id) >= 100 then
    raise exception 'list_items_full' using errcode = 'P0001';
  end if;

  insert into utrum.items (list_id, label, added_by_participant_id, created_at)
  values (p_list_id, v_label, p_participant_id, clock_timestamp())
  returning id into v_id;
  return v_id;
end $$;

-- A new item means every ranking is missing it: everyone has a few comparisons to make again.
-- completed_at stays, so whoever had finished keeps seeing the others' rankings meanwhile.
create function utrum.clear_rankings(p_list_id uuid)
returns void language sql volatile set search_path = '' as $$
  update utrum.participants set ranking = null, updated_at = now()
  where list_id = p_list_id and ranking is not null
$$;

-- p_ranking when it lists every item of the list exactly once; null otherwise (an item was
-- added or removed while the person was comparing: their screen reloads and asks what is missing).
create function utrum.valid_ranking(p_list_id uuid, p_ranking uuid[])
returns uuid[] language sql stable set search_path = '' as $$
  select case
    when p_ranking is null or cardinality(p_ranking) = 0 then null
    when cardinality(p_ranking) = (select count(*) from utrum.items where list_id = p_list_id)
     and cardinality(p_ranking) = (select count(distinct r.item_id)
                                   from unnest(p_ranking) as r(item_id)
                                   join utrum.items i on i.id = r.item_id and i.list_id = p_list_id)
    then p_ranking
  end
$$;

create function utrum.request_ip_hash()
returns text language sql stable set search_path = '' as $$
  with h as (select nullif(current_setting('request.headers', true), '')::json as headers),
       ip as (
         select nullif(trim(coalesce(
                  headers->>'cf-connecting-ip',
                  split_part(headers->>'x-forwarded-for', ',', 1))), '') as value
         from h)
  select case when ip.value is null then null
              else utrum.hash_token((select value from utrum.secrets where name = 'ip_salt') || ip.value)
         end
  from ip
$$;

-- Limits (generous: mobile carriers put many people behind one IP):
--   per device 10/hour, 30/day; per IP 30/hour, 100/day. Over → 'rate_limited' (DETAIL hour|day).
create function utrum.check_create_list_rate(p_device_id uuid)
returns void language plpgsql volatile set search_path = '' as $$
declare
  v_ip_hash text := utrum.request_ip_hash();
begin
  if p_device_id is not null then perform pg_advisory_xact_lock(hashtext('ut_create:' || p_device_id::text)); end if;
  if v_ip_hash   is not null then perform pg_advisory_xact_lock(hashtext('ut_create:' || v_ip_hash)); end if;

  delete from utrum.create_list_log where created_at < now() - interval '1 day';

  if p_device_id is not null then
    if (select count(*) from utrum.create_list_log
        where device_id = p_device_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'rate_limited' using detail = 'hour';
    end if;
    if (select count(*) from utrum.create_list_log where device_id = p_device_id) >= 30 then
      raise exception 'rate_limited' using detail = 'day';
    end if;
  end if;

  if v_ip_hash is not null then
    if (select count(*) from utrum.create_list_log
        where ip_hash = v_ip_hash and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'rate_limited' using detail = 'hour';
    end if;
    if (select count(*) from utrum.create_list_log where ip_hash = v_ip_hash) >= 100 then
      raise exception 'rate_limited' using detail = 'day';
    end if;
  end if;

  insert into utrum.create_list_log (device_id, ip_hash) values (p_device_id, v_ip_hash);
end $$;

-- Public view of a list: what anyone with the list link may see. No rankings.
create function utrum.list_json(p_list utrum.lists)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'slug', p_list.slug,
    'title', p_list.title,
    'criterion', p_list.criterion,
    'criterion_detail', p_list.criterion_detail,
    'method', p_list.method,
    'locale', p_list.locale,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'label', i.label, 'added_by_name', pa.name)
                       order by i.sequence_number)
      from utrum.items i
      left join utrum.participants pa on pa.id = i.added_by_participant_id
      where i.list_id = p_list.id), '[]'::jsonb),
    'participant_names', coalesce((
      select jsonb_agg(p.name order by p.sequence_number)
      from utrum.participants p where p.list_id = p_list.id), '[]'::jsonb)
  )
$$;

-- Everyone's progress and ranking. Only for the host and for people who completed their own.
create function utrum.results_json(p_list_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'ranking', to_jsonb(p.ranking),
           'comparison_count', (select count(*) from utrum.comparisons c where c.participant_id = p.id),
           'has_completed', p.completed_at is not null
         ) order by p.sequence_number), '[]'::jsonb)
  from utrum.participants p where p.list_id = p_list_id
$$;

revoke execute on all functions in schema utrum from public, anon, authenticated;

------------------------------------------------------------------------
-- 3. Public RPCs — anyone with the list link
------------------------------------------------------------------------

-- Returns the host token once (and the host's own participant token when they take part).
create function public.ut_create_list(
  p_title            text,
  p_criterion        text,
  p_items            text[],
  p_criterion_detail text    default null,
  p_method           text    default 'quick',
  p_locale           text    default 'pt-BR',
  p_device_id        uuid    default null,
  p_host_name        text    default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_slug        text;
  v_host_token  text := utrum.random_text(32);
  v_list_id     uuid;
  v_label       text;
  v_participant jsonb;
begin
  perform utrum.check_create_list_rate(p_device_id);

  loop
    v_slug := utrum.random_text(12);
    exit when not exists (select 1 from utrum.lists where slug = v_slug);
  end loop;

  insert into utrum.lists (slug, title, criterion, criterion_detail, method, locale)
  values (v_slug, trim(p_title), trim(p_criterion), nullif(trim(p_criterion_detail), ''),
          coalesce(p_method, 'quick'), coalesce(p_locale, 'pt-BR'))
  returning id into v_list_id;

  foreach v_label in array coalesce(p_items, '{}') loop
    perform utrum.insert_item(v_list_id, v_label, null, true);
  end loop;
  if (select count(*) from utrum.items where list_id = v_list_id) < 2 then
    raise exception 'not_enough_items' using errcode = 'P0001';
  end if;

  insert into utrum.host_tokens (list_id, token_hash)
  values (v_list_id, utrum.hash_token(v_host_token));

  -- The host takes part when they give a name: their token stays on their device only.
  if nullif(trim(p_host_name), '') is not null then
    v_participant := utrum.insert_participant(v_list_id, p_host_name, p_device_id);
  end if;

  return jsonb_build_object(
    'slug', v_slug,
    'host_token', v_host_token,
    'participant_token', v_participant->>'participant_token');
end $$;

-- Join screen: the list, its items and who is already in. Never anyone's ranking.
create function public.ut_get_list(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return utrum.list_json(utrum.require_list(p_slug));
end $$;

-- Self-join through the list link. The token is returned once and kept only on that device.
create function public.ut_join_list(p_slug text, p_name text, p_device_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l utrum.lists := utrum.require_list(p_slug);
  v_participant jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('ut_list:' || l.id::text));
  v_participant := utrum.insert_participant(l.id, p_name, p_device_id);
  update utrum.lists set updated_at = now() where id = l.id;
  return jsonb_build_object('participant_id', v_participant->>'id', 'participant_token', v_participant->>'participant_token');
end $$;

------------------------------------------------------------------------
-- 4. Public RPCs — a participant's personal link
------------------------------------------------------------------------

-- The person's own page: the list, their comparisons so far and, once they have completed their
-- own ranking, everyone's progress and rankings.
create function public.ut_open_participant(p_slug text, p_participant_token text, p_device_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p utrum.participants := utrum.require_participant(p_slug, p_participant_token);
  l utrum.lists;
begin
  select * into l from utrum.lists where id = p.list_id;
  if p.device_id is null and p_device_id is not null then
    update utrum.participants set device_id = p_device_id where id = p.id;
  end if;

  return jsonb_build_object(
    'list', utrum.list_json(l),
    'me', jsonb_build_object('id', p.id, 'name', p.name),
    'comparisons', coalesce((
      select jsonb_agg(jsonb_build_object('item_low_id', c.item_low_id, 'item_high_id', c.item_high_id, 'winner_id', c.winner_id)
                       order by c.created_at, c.id)
      from utrum.comparisons c where c.participant_id = p.id), '[]'::jsonb),
    'has_completed', p.completed_at is not null,
    'results', case when p.completed_at is not null then utrum.results_json(l.id) end);
end $$;

-- One answer: "between these two, this one". p_ranking goes along when this answer completes the
-- person's ranking (computed in the browser); it is kept only if it covers every item once.
create function public.ut_add_comparison(
  p_slug              text,
  p_participant_token text,
  p_item_a_id         uuid,
  p_item_b_id         uuid,
  p_winner_id         uuid,
  p_ranking           uuid[] default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p utrum.participants := utrum.require_participant(p_slug, p_participant_token);
  v_low     uuid := least(p_item_a_id, p_item_b_id);
  v_high    uuid := greatest(p_item_a_id, p_item_b_id);
  v_ranking uuid[];
begin
  if v_low is null or v_high is null or v_low = v_high or p_winner_id is null or p_winner_id not in (v_low, v_high) then
    raise exception 'comparison_invalid' using errcode = '22023';
  end if;
  if (select count(*) from utrum.items where list_id = p.list_id and id in (v_low, v_high)) <> 2 then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;

  insert into utrum.comparisons (participant_id, item_low_id, item_high_id, winner_id, created_at)
  values (p.id, v_low, v_high, p_winner_id, clock_timestamp())
  on conflict (participant_id, item_low_id, item_high_id)
  do update set winner_id = excluded.winner_id, created_at = excluded.created_at;

  v_ranking := utrum.valid_ranking(p.list_id, p_ranking);
  update utrum.participants
  set ranking = v_ranking,
      completed_at = case when v_ranking is not null then coalesce(completed_at, now()) else completed_at end,
      updated_at = now()
  where id = p.id;

  return jsonb_build_object('has_ranking', v_ranking is not null, 'has_completed', v_ranking is not null or p.completed_at is not null);
end $$;

-- Takes back the latest answer. The ranking is incomplete again until that pair is answered.
create function public.ut_undo_comparison(p_slug text, p_participant_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p utrum.participants := utrum.require_participant(p_slug, p_participant_token);
begin
  delete from utrum.comparisons
  where id = (select id from utrum.comparisons where participant_id = p.id order by created_at desc, id desc limit 1);
  update utrum.participants set ranking = null, updated_at = now() where id = p.id;
end $$;

-- Starts over: all of this person's answers go. Whoever had completed keeps seeing the results.
create function public.ut_reset_comparisons(p_slug text, p_participant_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p utrum.participants := utrum.require_participant(p_slug, p_participant_token);
begin
  delete from utrum.comparisons where participant_id = p.id;
  update utrum.participants set ranking = null, updated_at = now() where id = p.id;
end $$;

-- A participant adds an item to the list. Everyone gets the new comparisons it brings.
create function public.ut_suggest_item(p_slug text, p_participant_token text, p_label text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p    utrum.participants := utrum.require_participant(p_slug, p_participant_token);
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ut_list:' || p.list_id::text));
  v_id := utrum.insert_item(p.list_id, p_label, p.id, false);
  perform utrum.clear_rankings(p.list_id);
  update utrum.lists set updated_at = now() where id = p.list_id;
  return v_id;
end $$;

------------------------------------------------------------------------
-- 5. Public RPCs — host link
------------------------------------------------------------------------

-- Everything the host needs: the list, who suggested what, everyone's progress and ranking.
create function public.ut_get_list_as_host(p_slug text, p_host_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l utrum.lists := utrum.require_host_list(p_slug, p_host_token);
begin
  return utrum.list_json(l) || jsonb_build_object('results', utrum.results_json(l.id));
end $$;

create function public.ut_update_list(
  p_slug             text,
  p_host_token       text,
  p_title            text,
  p_criterion        text,
  p_criterion_detail text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  l utrum.lists := utrum.require_host_list(p_slug, p_host_token);
begin
  update utrum.lists
  set title = trim(p_title), criterion = trim(p_criterion),
      criterion_detail = nullif(trim(p_criterion_detail), ''), updated_at = now()
  where id = l.id;
end $$;

-- Host pastes items. Labels already on the list are skipped. Returns how many were added.
create function public.ut_add_items(p_slug text, p_host_token text, p_labels text[])
returns int language plpgsql security definer set search_path = '' as $$
declare
  l       utrum.lists := utrum.require_host_list(p_slug, p_host_token);
  v_label text;
  v_added int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('ut_list:' || l.id::text));
  foreach v_label in array coalesce(p_labels, '{}') loop
    if utrum.insert_item(l.id, v_label, null, true) is not null then
      v_added := v_added + 1;
    end if;
  end loop;
  if v_added > 0 then
    perform utrum.clear_rankings(l.id);
    update utrum.lists set updated_at = now() where id = l.id;
  end if;
  return v_added;
end $$;

-- Removing an item drops its comparisons and takes it out of every ranking; the rest of each
-- ranking keeps its order, so nobody has to compare again.
create function public.ut_delete_item(p_slug text, p_host_token text, p_item_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l utrum.lists := utrum.require_host_list(p_slug, p_host_token);
begin
  perform pg_advisory_xact_lock(hashtext('ut_list:' || l.id::text));
  if not exists (select 1 from utrum.items where id = p_item_id and list_id = l.id) then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from utrum.items where list_id = l.id) <= 2 then
    raise exception 'not_enough_items' using errcode = 'P0001';
  end if;
  delete from utrum.items where id = p_item_id and list_id = l.id;
  update utrum.participants
  set ranking = array_remove(ranking, p_item_id), updated_at = now()
  where list_id = l.id and ranking is not null;
  update utrum.lists set updated_at = now() where id = l.id;
end $$;

create function public.ut_remove_participant(p_slug text, p_host_token text, p_participant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l utrum.lists := utrum.require_host_list(p_slug, p_host_token);
begin
  delete from utrum.participants where id = p_participant_id and list_id = l.id;
  if not found then
    raise exception 'participant_not_found' using errcode = 'P0002';
  end if;
  update utrum.lists set updated_at = now() where id = l.id;
end $$;

create function public.ut_delete_list(p_slug text, p_host_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l utrum.lists := utrum.require_host_list(p_slug, p_host_token);
begin
  delete from utrum.lists where id = l.id;
end $$;

------------------------------------------------------------------------
-- 6. Grants: only the public RPCs, for the browser (anon) role
------------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'ut\_%'
  loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
