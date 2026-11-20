-- Validação da ficha e proibição de reentrada após expulsão.
CREATE OR REPLACE FUNCTION public.ae_live_join(p_character_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- A fonte de autoridade é o vínculo atual, inclusive linkedKeyIds.
  p_character_id=nullif(btrim(coalesce(p_character_id,'')),'');
  if p_character_id is null then p_character_id=nullif(btrim(coalesce(v_key_sheet,'')),'');end if;
  if p_character_id is null then
   select x.value->>'id' into p_character_id
   from public.ae_document d cross join lateral jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) x(value)
   where d.id=1 and public.ae_sheet_linked(x.value,v_key_id,v_key_sheet)
    and not coalesce((x.value->>'masterOnly')::boolean,false)
    and not coalesce((x.value->>'redacted')::boolean,false)
   order by x.value->>'name' limit 1;
  end if;
  if p_character_id is not null then
   select x.value into v_sheet from public.ae_document d
   cross join lateral jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) x(value)
   where d.id=1 and x.value->>'id'=p_character_id limit 1;
   if v_sheet is null or coalesce((v_sheet->>'masterOnly')::boolean,false)
    or coalesce((v_sheet->>'redacted')::boolean,false)
    or not public.ae_sheet_linked(v_sheet,v_key_id,v_key_sheet)
   then raise exception 'Ficha não vinculada à sua chave.';end if;
   v_character=left(coalesce(v_sheet->>'name',''),100);
  end if;
 else
  p_character_id=null;
 end if;
  -- Remoção de mestre permanece válida até começar uma nova sala.
 if exists(select 1 from public.ae_live_participants
   where session_id=v_id and account_id=v_a and removed_at is not null)
 then raise exception 'Você foi removido desta sessão pelo mestre.';end if;
 insert into public.ae_live_participants(session_id,account_id,user_id,account_name,character_name,sheet_id,is_master)
 values(v_id,v_a,v_u,v_name,v_character,p_character_id,v_key_kind='master')
 on conflict(session_id,account_id) do update set
 user_id=excluded.user_id,account_name=excluded.account_name,character_name=excluded.character_name,sheet_id=excluded.sheet_id,
 is_master=excluded.is_master,joined_at=now(),last_seen=now(),left_at=null,removed_at=null,camera_on=false
 returning * into v_row;
 return to_jsonb(v_row);
end $function$
;
