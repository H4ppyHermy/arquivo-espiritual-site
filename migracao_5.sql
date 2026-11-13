-- migracao_5.sql | Beta 2.5 | repetível, preserva dados
create table if not exists public.ae_live_sessions(
 id uuid primary key default gen_random_uuid(), title text not null default 'Sessão',
 status text not null default 'open' check (status in ('open','ended')),
 started_by uuid not null, master_name text not null, started_at timestamptz not null default now(),
 ended_at timestamptz, created_at timestamptz not null default now()
);
create unique index if not exists ae_live_only_one_open on public.ae_live_sessions((1)) where status='open';
create table if not exists public.ae_live_participants(
 session_id uuid not null references public.ae_live_sessions(id) on delete cascade,
 account_id uuid not null, user_id uuid not null,
 account_name text not null, character_name text, sheet_id text,
 is_master boolean not null default false,
 joined_at timestamptz not null default now(), last_seen timestamptz not null default now(),
 left_at timestamptz, removed_at timestamptz, camera_on boolean not null default false,
 primary key(session_id,account_id)
);
create index if not exists ae_live_participants_active on public.ae_live_participants(session_id) where left_at is null;
alter table public.ae_live_sessions enable row level security;
alter table public.ae_live_participants enable row level security;
revoke all on public.ae_live_sessions,public.ae_live_participants from anon;
grant select on public.ae_live_sessions,public.ae_live_participants to authenticated;
create or replace function public.ae_live_logged_in() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ae_sessions s join public.ae_keys k on k.id=s.key_id and k.active
 where s.user_id=(select auth.uid()) and k.kind in ('master','player'))
$$;
revoke all on function public.ae_live_logged_in() from public,anon;
grant execute on function public.ae_live_logged_in() to authenticated;
drop policy if exists ae_live_sessions_read on public.ae_live_sessions;
create policy ae_live_sessions_read on public.ae_live_sessions for select to authenticated using (public.ae_live_logged_in());
drop policy if exists ae_live_participants_read on public.ae_live_participants;
create policy ae_live_participants_read on public.ae_live_participants for select to authenticated using (public.ae_live_logged_in());

create or replace function public.ae_live_start(p_title text default 'Sessão') returns jsonb language plpgsql security definer set search_path='' as $$
declare v_a uuid;v_name text;v_row public.ae_live_sessions%rowtype;
begin
 if not public.ae_is_master() then raise exception 'Somente o mestre pode iniciar.';end if;
 select a.id,a.name into v_a,v_name from public.ae_sessions s join public.ae_accounts a on a.id=s.account_id
 join public.ae_keys k on k.id=s.key_id and k.active where s.user_id=auth.uid() and k.kind='master' limit 1;
 if v_a is null then raise exception 'Chave de mestre necessária.';end if;
 if exists(select 1 from public.ae_live_sessions where status='open') then raise exception 'Já há uma sessão em andamento.';end if;
 insert into public.ae_live_sessions(title,started_by,master_name) values(left(coalesce(nullif(trim(p_title),''),'Sessão'),90),v_a,v_name) returning * into v_row;
 return to_jsonb(v_row);
end $$;
create or replace function public.ae_live_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_session public.ae_live_sessions%rowtype;v_participants jsonb;
begin
 if not public.ae_live_logged_in() then return jsonb_build_object('session',null,'participants','[]'::jsonb);end if;
 select * into v_session from public.ae_live_sessions where status='open' limit 1;
 if not found then return jsonb_build_object('session',null,'participants','[]'::jsonb);end if;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.joined_at),'[]'::jsonb) into v_participants
 from public.ae_live_participants p where p.session_id=v_session.id and p.left_at is null and p.removed_at is null and p.last_seen>now()-interval '70 seconds';
 return jsonb_build_object('session',to_jsonb(v_session),'participants',v_participants);
end $$;
create or replace function public.ae_live_join(p_character_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_a uuid;v_u uuid;v_name text;v_key_id uuid;v_key_kind text;v_key_sheet text;v_sheet jsonb;v_character text;v_id uuid;v_row public.ae_live_participants%rowtype;
begin
 select a.id,s.user_id,a.name,k.id,k.kind,k.sheet_id into v_a,v_u,v_name,v_key_id,v_key_kind,v_key_sheet
 from public.ae_sessions s join public.ae_accounts a on a.id=s.account_id
 join public.ae_keys k on k.id=s.key_id and k.active
 where s.user_id=auth.uid() and k.kind in ('master','player') limit 1;
 if v_a is null then raise exception 'Entre com sua chave de acesso.';end if;
 select id into v_id from public.ae_live_sessions where status='open' limit 1;
 if v_id is null then raise exception 'Nenhuma sessão aberta.';end if;
 if v_key_kind='player' then
  if p_character_id is null then p_character_id=v_key_sheet;end if;
  if p_character_id is not null then
   select x.value into v_sheet from public.ae_document d cross join lateral jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) x(value)
   where d.id=1 and x.value->>'id'=p_character_id limit 1;
   if v_sheet is null or coalesce((v_sheet->>'masterOnly')::boolean,false)
   or (v_key_sheet is distinct from p_character_id and v_sheet->>'ownerKeyId' is distinct from v_key_id::text)
   then raise exception 'Ficha não vinculada à sua chave.';end if;
   v_character=left(coalesce(v_sheet->>'name',''),100);
  end if;
 else
  p_character_id=null;
 end if;
 insert into public.ae_live_participants(session_id,account_id,user_id,account_name,character_name,sheet_id,is_master)
 values(v_id,v_a,v_u,v_name,v_character,p_character_id,v_key_kind='master')
 on conflict(session_id,account_id) do update set
 user_id=excluded.user_id,account_name=excluded.account_name,character_name=excluded.character_name,sheet_id=excluded.sheet_id,
 is_master=excluded.is_master,joined_at=now(),last_seen=now(),left_at=null,removed_at=null,camera_on=false
 returning * into v_row;
 return to_jsonb(v_row);
end $$;
create or replace function public.ae_live_heartbeat(p_camera boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_account uuid;v_count int;v_p public.ae_live_participants%rowtype;
begin
 select s.account_id into v_account from public.ae_sessions s join public.ae_keys k on k.id=s.key_id and k.active where s.user_id=auth.uid() limit 1;
 select id into v_id from public.ae_live_sessions where status='open' limit 1;
 if v_account is null or v_id is null then raise exception 'Sessão indisponível.';end if;
 perform 1 from public.ae_live_sessions where id=v_id for update;
 select * into v_p from public.ae_live_participants where session_id=v_id and account_id=v_account and left_at is null and removed_at is null;
 if not found then raise exception 'Você não está participando da sessão.';end if;
 if coalesce(p_camera,false) then
  select count(*) into v_count from public.ae_live_participants where session_id=v_id and camera_on and left_at is null and removed_at is null and last_seen>now()-interval '70 seconds' and account_id<>v_account;
  if v_count>=8 then raise exception 'Limite de 8 câmeras atingido.';end if;
 end if;
 update public.ae_live_participants set last_seen=now(),camera_on=coalesce(p_camera,false)
 where session_id=v_id and account_id=v_account returning * into v_p;
 return to_jsonb(v_p);
end $$;
create or replace function public.ae_live_leave() returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.ae_live_participants set left_at=now(),camera_on=false where user_id=auth.uid() and left_at is null;
 return true;
end $$;
create or replace function public.ae_live_kick(p_account_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.ae_is_master() then raise exception 'Somente mestre pode remover participantes.';end if;
 update public.ae_live_participants set removed_at=now(),left_at=now(),camera_on=false
 where account_id=p_account_id and session_id in (select id from public.ae_live_sessions where status='open');
 return found;
end $$;
create or replace function public.ae_live_end() returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.ae_is_master() then raise exception 'Somente mestre pode encerrar a sessão.';end if;
 update public.ae_live_participants set left_at=now(),camera_on=false where session_id in(select id from public.ae_live_sessions where status='open');
 update public.ae_live_sessions set status='ended',ended_at=now() where status='open';
 return found;
end $$;
create or replace function public.ae_live_can_topic(p_topic text) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_topic='ae-live-notify' then public.ae_live_logged_in()
 else exists(select 1 from public.ae_live_participants p
 join public.ae_live_sessions s on s.id=p.session_id and s.status='open'
 where p.user_id=auth.uid() and p.left_at is null and p.removed_at is null and p_topic='ae-video-'||s.id::text) end
$$;
revoke all on function public.ae_live_can_topic(text) from public,anon;
grant execute on function public.ae_live_can_topic(text) to authenticated;
do $$ begin
 if to_regclass('realtime.messages') is not null then
  execute 'drop policy if exists ae_live_video_read on realtime.messages';
  execute 'drop policy if exists ae_live_video_write on realtime.messages';
  execute 'create policy ae_live_video_read on realtime.messages for select to authenticated using (public.ae_live_can_topic(realtime.topic()))';
  execute 'create policy ae_live_video_write on realtime.messages for insert to authenticated with check (public.ae_live_can_topic(realtime.topic()))';
 end if;
end $$;
do $$ declare r record;begin for r in select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('ae_live_start','ae_live_state','ae_live_join','ae_live_heartbeat','ae_live_leave','ae_live_kick','ae_live_end')
 loop execute 'revoke all on function '||r.signature||' from public,anon';execute 'grant execute on function '||r.signature||' to authenticated';end loop;end $$;
-- Verificação: select status,title,started_at from public.ae_live_sessions order by started_at desc limit 5;
