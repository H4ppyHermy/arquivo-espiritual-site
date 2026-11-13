-- Beta 2.8 — rolagem livre independente, de 1 a 30 dados e 2 a 1000 faces.
-- Não altera os dados fixos de perícias, técnicas ou Escudo.
create or replace function public.ae_roll_custom(p_count integer,p_faces integer,p_colors jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_account public.ae_accounts%rowtype;v_dice jsonb:='[]'::jsonb;v_colors jsonb:='[]'::jsonb;
 v_color text;v_eval jsonb;v_bytes bytea;v_rand numeric;v_limit numeric;v_value integer;
 v_i integer;v_row public.ae_rolls%rowtype;
begin
 select a.* into v_account from public.ae_sessions s
 join public.ae_accounts a on a.id=s.account_id
 join public.ae_keys k on k.id=s.key_id and k.active
 where s.user_id=auth.uid() and k.kind in ('master','player') limit 1;
 if v_account.id is null then raise exception 'Entre com sua chave para rolar dados verificados.';end if;
 if p_count is null or p_faces is null or p_count not between 1 and 30 or p_faces not between 2 and 1000
 then raise exception 'Escolha de 1 a 30 dados, com 2 a 1000 faces.';end if;
 v_limit=floor(4294967296::numeric/p_faces)*p_faces;
 for v_i in 1..p_count loop
  loop
   v_bytes=extensions.gen_random_bytes(4);
   v_rand=get_byte(v_bytes,0)::numeric*16777216+get_byte(v_bytes,1)::numeric*65536+
    get_byte(v_bytes,2)::numeric*256+get_byte(v_bytes,3);
   exit when v_rand<v_limit;
  end loop;
  v_value=(mod(v_rand,p_faces)+1)::integer;
  v_dice=v_dice||jsonb_build_array(jsonb_build_object('sides',p_faces,'value',v_value));
  v_color=case when jsonb_typeof(p_colors)='array' and jsonb_array_length(p_colors)>=v_i then p_colors->>(v_i-1) else null end;
  if v_color is null or v_color !~ '^#[0-9a-fA-F]{6}$' then v_color='#4CC9F0';end if;
  v_colors=v_colors||jsonb_build_array(v_color);
 end loop;
 v_eval=public.ae_avaliar_dados(v_dice);
 insert into public.ae_rolls(account_id,account_name,kind,label,dice,total,special,hidden,colors)
 values(v_account.id,v_account.name,'free',p_count::text||'d'||p_faces::text,v_dice,
 (v_eval->>'total')::integer,v_eval->>'special',false,v_colors)
 returning * into v_row;
 return to_jsonb(v_row);
end;$fn$;
revoke all on function public.ae_roll_custom(integer,integer,jsonb) from public,anon;
grant execute on function public.ae_roll_custom(integer,integer,jsonb) to authenticated;
