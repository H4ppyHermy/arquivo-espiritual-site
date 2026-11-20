-- Motor universal CBB. Nunca contém IDs nem nomes de personagens.
CREATE OR REPLACE FUNCTION public.ae_cbb_random(p_faces integer)
RETURNS integer LANGUAGE plpgsql VOLATILE SET search_path TO ''
AS $cbb$
DECLARE b bytea;n integer;lim integer;
BEGIN
 IF p_faces NOT IN (4,6,8,10,12,14,16,18,20) THEN RAISE EXCEPTION 'Dado inválido.';END IF;
 lim=(65536/p_faces)*p_faces;
 LOOP
  b=extensions.gen_random_bytes(2);
  n=get_byte(b,0)*256+get_byte(b,1);
  EXIT WHEN n<lim;
 END LOOP;
 RETURN mod(n,p_faces)+1;
END $cbb$;

CREATE OR REPLACE FUNCTION public.ae_cbb_roll(
 p_sheet_id text,p_kind text,p_skill text DEFAULT NULL,p_context text DEFAULT 'geral',
 p_reaction boolean DEFAULT false,p_group_steps integer DEFAULT 0,p_skill_steps integer DEFAULT 0,
 p_pool jsonb DEFAULT '[]'::jsonb,p_resource text DEFAULT NULL,p_flat integer DEFAULT 0,
 p_attack_id bigint DEFAULT NULL,p_manual_ra integer DEFAULT 0,p_fear integer DEFAULT NULL,
 p_hollow boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $cbb$
DECLARE ac_id uuid;ac_name text;key_id uuid;key_kind text;key_sheet text;
 sh jsonb;doc jsonb;before_sheet jsonb;updated_sheet jsonb;all_sheets jsonb;
 grp text;gdie integer;sdie integer;rolled_group integer;rolled_skill integer;
 scale integer[]:=ARRAY[4,6,8,10,12,14,16,18,20];ix_g integer;ix_s integer;
 gstep integer:=0;sstep integer:=0;expo integer:=0;auto_g integer:=0;auto_s integer:=0;
 special_scale boolean:=false;conditions text[]:=ARRAY[]::text[];
 fear_size integer:=0;fear_value integer:=0;hollow_on boolean:=false;hollow_value integer:=0;barrier integer:=0;
 result_dice jsonb:='[]'::jsonb;colors jsonb:='[]'::jsonb;translated jsonb:='[]'::jsonb;
 group_color text;skill_color text;die jsonb;datum jsonb;faces integer;amount integer;
 total_extra integer:=0;val integer;effective integer;active_dice integer:=0;eval_result jsonb;
 total integer:=0;ra integer:=0;rb integer:=0;special text:='';attack_ra integer:=0;
 prev public.ae_rolls%rowtype;new_roll public.ae_rolls%rowtype;label_text text;v_i integer;
BEGIN
 IF p_sheet_id IS NULL OR length(p_sheet_id)>150 OR p_kind NOT IN ('teste','dano','resistencia','recuperacao')
  OR p_context NOT IN ('geral','ataque','defesa')
  OR p_group_steps NOT BETWEEN -5 AND 5 OR p_skill_steps NOT BETWEEN -5 AND 5
  OR p_flat NOT BETWEEN -500 AND 500 OR p_manual_ra NOT BETWEEN 0 AND 100
  OR jsonb_typeof(p_pool)<>'array' OR jsonb_array_length(p_pool)>6
 THEN RAISE EXCEPTION 'Parâmetros de rolagem inválidos.';END IF;
 IF coalesce(p_reaction,false) AND (p_kind<>'teste' OR p_context<>'defesa') THEN RAISE EXCEPTION 'Reação só pode ser usada em defesa.';END IF;
 SELECT a.id,a.name,k.id,k.kind,k.sheet_id INTO ac_id,ac_name,key_id,key_kind,key_sheet
 FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active
 WHERE se.user_id=auth.uid() LIMIT 1;
 IF ac_id IS NULL OR key_kind NOT IN ('master','player') THEN RAISE EXCEPTION 'Entre para usar a mesa de combate.';END IF;
 SELECT x.value INTO sh FROM public.ae_document d
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) x(value)
 WHERE d.id=1 AND x.value->>'id'=p_sheet_id LIMIT 1;
 IF sh IS NULL THEN RAISE EXCEPTION 'Ficha inexistente.';END IF;
 IF coalesce((sh->>'masterOnly')::boolean,false) AND key_kind<>'master' THEN RAISE EXCEPTION 'Ficha exclusiva do mestre.';END IF;
 IF coalesce((sh->>'redacted')::boolean,false) AND key_kind<>'master' THEN RAISE EXCEPTION 'Ficha indisponível.';END IF;
 IF key_kind='player' AND NOT public.ae_sheet_linked(sh,key_id,key_sheet) THEN RAISE EXCEPTION 'Ficha não vinculada.';END IF;
 group_color=sh->'appearance'->>'diceGroup';skill_color=sh->'appearance'->>'diceSkill';
 IF coalesce(group_color,'') !~ '^#[0-9a-fA-F]{6}$' THEN group_color='#FF7A1A';END IF;
 IF coalesce(skill_color,'') !~ '^#[0-9a-fA-F]{6}$' THEN skill_color='#4CC9F0';END IF;
 IF p_kind='teste' THEN
  grp=CASE WHEN p_skill=ANY(ARRAY['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão']) THEN 'Corpo'
    WHEN p_skill=ANY(ARRAY['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia']) THEN 'Mente'
    WHEN p_skill=ANY(ARRAY['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']) THEN 'Espírito' ELSE NULL END;
  IF grp IS NULL THEN RAISE EXCEPTION 'Perícia inválida.';END IF;
  gdie=(sh->'groups'->>grp)::integer;sdie=(sh->'skills'->>p_skill)::integer;
  ix_g=array_position(scale,gdie);ix_s=array_position(scale,sdie);
  IF ix_g IS NULL OR ix_s IS NULL THEN RAISE EXCEPTION 'Dados inválidos na ficha.';END IF;
  SELECT coalesce(array_agg(lower(c.value)),ARRAY[]::text[]) INTO conditions
  FROM jsonb_array_elements_text(coalesce(sh->'conditions','[]'::jsonb)) c(value);
  IF 'confuso'=ANY(conditions) AND grp='Mente' THEN sstep=sstep-1;END IF;
  IF 'suprimido'=ANY(conditions) AND grp='Espírito' THEN sstep=sstep-1;END IF;
  IF 'exausto'=ANY(conditions) AND grp='Corpo' THEN sstep=sstep-1;END IF;
  IF 'atordoado'=ANY(conditions) THEN sstep=sstep-1;END IF;
  IF 'desorientado'=ANY(conditions) AND p_context IN ('ataque','defesa') THEN sstep=sstep-1;END IF;
  IF 'derrubado'=ANY(conditions) AND p_context='defesa' THEN sstep=sstep-1;END IF;
  IF p_context='ataque' THEN
   expo=greatest(0,least(3,coalesce((sh->'exposures'->>'ofensiva')::integer,0)));
  ELSIF p_context='defesa' THEN
   expo=greatest(0,least(3,coalesce((sh->'exposures'->>'defensiva')::integer,0)));
   expo=CASE WHEN expo=3 THEN 2 WHEN expo=2 THEN 1 WHEN expo=1 AND NOT p_reaction THEN 1 ELSE 0 END;
  END IF;
  IF sdie=4 THEN gstep=gstep-expo; ELSE sstep=sstep-expo;END IF;
  auto_g=gstep;auto_s=sstep;
  gstep=gstep+p_group_steps;sstep=sstep+p_skill_steps;
  SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(sh->'abilities','[]'::jsonb)) z(v)
   WHERE z.v->>'name'='Realismo Animista') INTO special_scale;
  rolled_group=scale[greatest(1,least(greatest(ix_g,CASE WHEN special_scale THEN 6 ELSE 5 END),ix_g+gstep))];
  rolled_skill=scale[greatest(1,least(greatest(ix_s,CASE WHEN special_scale THEN 6 ELSE 5 END),ix_s+sstep))];
  result_dice=result_dice||jsonb_build_array(jsonb_build_object('sides',rolled_group,'value',public.ae_cbb_random(rolled_group)));
  colors=colors||to_jsonb(group_color);
  result_dice=result_dice||jsonb_build_array(jsonb_build_object('sides',rolled_skill,'value',public.ae_cbb_random(rolled_skill)));
  colors=colors||to_jsonb(skill_color);
 ELSIF p_kind='resistencia' THEN
  IF p_resource NOT IN ('vida','estabilidade','alma') THEN RAISE EXCEPTION 'Recurso de resistência inválido.';END IF;
  grp=CASE p_resource WHEN 'vida' THEN 'Corpo' WHEN 'estabilidade' THEN 'Mente' ELSE 'Espírito' END;
  gdie=(sh->'groups'->>grp)::integer;ix_g=array_position(scale,gdie);
  IF ix_g IS NULL THEN RAISE EXCEPTION 'Dado de resistência inválido.';END IF;
  rolled_group=scale[greatest(1,least(greatest(ix_g,5),ix_g+p_group_steps))];
  result_dice=result_dice||jsonb_build_array(jsonb_build_object('sides',rolled_group,'value',public.ae_cbb_random(rolled_group)));
  colors=colors||to_jsonb(group_color);
  IF jsonb_array_length(p_pool)>1 THEN RAISE EXCEPTION 'Uma proteção adicional por recurso.';END IF;
 END IF;
 IF p_kind<>'teste' AND p_skill_steps<>0 THEN RAISE EXCEPTION 'Perícia somente em testes.';END IF;
 IF p_kind IN ('dano','recuperacao') AND p_group_steps<>0 THEN RAISE EXCEPTION 'Grupo somente em testes ou resistência.';END IF;
 FOR datum IN SELECT value FROM jsonb_array_elements(p_pool) LOOP
  IF jsonb_typeof(datum)<>'object' OR coalesce(datum->>'faces','') !~ '^(4|6|8|10|12|14|16|18|20)$'
   OR coalesce(datum->>'count','') !~ '^[1-9][0-9]?$' THEN RAISE EXCEPTION 'Dados adicionais inválidos.';END IF;
  faces=(datum->>'faces')::integer;amount=(datum->>'count')::integer;
  total_extra=total_extra+amount;
  IF total_extra>20 OR (p_kind='teste' AND total_extra>4) OR (p_kind='resistencia' AND total_extra>1) THEN RAISE EXCEPTION 'Excesso de dados.';END IF;
  FOR v_i IN 1..amount LOOP
   result_dice=result_dice||jsonb_build_array(jsonb_build_object('sides',faces,'value',public.ae_cbb_random(faces)));
   colors=colors||to_jsonb(skill_color);
  END LOOP;
 END LOOP;
 IF jsonb_array_length(result_dice)=0 AND NOT (p_kind IN ('dano','recuperacao') AND (p_flat<>0 OR p_manual_ra>0 OR p_attack_id IS NOT NULL)) THEN RAISE EXCEPTION 'Informe os dados de rolagem.';END IF;
 IF p_kind='teste' THEN
  fear_size=coalesce(p_fear,coalesce((sh->'combat'->>'fearDie')::integer,0));
  IF fear_size=0 AND p_fear IS NULL AND 'amedrontado'=ANY(conditions) THEN fear_size=6;END IF;
  IF fear_size NOT IN (0,4,6,8,10,12,14,16,18,20) THEN RAISE EXCEPTION 'Pavor inválido.';END IF;
  hollow_on=coalesce(p_hollow,coalesce((sh->'combat'->>'hollowActive')::boolean,false));
  IF p_reaction AND ('atordoado'=ANY(conditions) OR (coalesce((sh->'combat'->>'reactionUsed')::boolean,false) AND coalesce((sh#>>'{combat,cbb,extraReaction}')::integer,0)<1)) THEN RAISE EXCEPTION 'Reação indisponível.';END IF;
  IF fear_size>0 THEN fear_value=public.ae_cbb_random(fear_size);END IF;
  IF hollow_on THEN hollow_value=public.ae_cbb_random(6);END IF;
  barrier=greatest(fear_value,hollow_value);
  IF barrier>0 THEN
   translated='[]'::jsonb;
   FOR die IN SELECT value FROM jsonb_array_elements(result_dice) LOOP
    val=(die->>'value')::integer;
    effective=CASE WHEN val<barrier THEN 0 WHEN val>barrier AND hollow_on THEN (die->>'sides')::integer ELSE val END;
    IF effective>0 THEN active_dice=active_dice+1;END IF;
    translated=translated||jsonb_build_array(die||jsonb_build_object('effective',effective,'canceled',effective=0,'maximized',effective>val));
   END LOOP;
   result_dice=translated;
  ELSE active_dice=jsonb_array_length(result_dice);END IF;
  eval_result=public.ae_avaliar_dados(result_dice);
  result_dice=eval_result->'dice';
  special=CASE WHEN active_dice=0 THEN 'FALHA CRÍTICA' ELSE eval_result->>'special' END;
  total=CASE WHEN active_dice=0 THEN 1 ELSE (eval_result->>'total')::integer END;
  ra=CASE WHEN active_dice=0 THEN 1 ELSE (eval_result->>'ra')::integer END;
  rb=CASE WHEN active_dice=0 THEN 1 ELSE (eval_result->>'rb')::integer END;
  label_text='TESTE · '||p_skill||' · '||p_context||CASE WHEN p_reaction THEN ' · reação' ELSE '' END;
 ELSE
  SELECT coalesce(sum((d->>'value')::integer),0),coalesce(max((d->>'value')::integer),0),coalesce(min((d->>'value')::integer),0)
   INTO total,ra,rb FROM jsonb_array_elements(result_dice) d;
  IF p_kind='dano' THEN
   IF p_attack_id IS NOT NULL THEN
    SELECT * INTO prev FROM public.ae_rolls
    WHERE id=p_attack_id AND sheet_id=p_sheet_id AND account_id=ac_id
      AND (kind='skill' OR (kind='cbb' AND label LIKE 'TESTE · %'))
      AND created_at>=now()-interval '2 hours' LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Teste anterior não verificado ou expirado.';END IF;
    IF prev.special='FALHA CRÍTICA' THEN attack_ra=1;
    ELSE SELECT coalesce(max(coalesce((d->>'effective')::integer,(d->>'value')::integer)),0)
      INTO attack_ra FROM jsonb_array_elements(prev.dice) d WHERE NOT coalesce((d->>'canceled')::boolean,false);
    END IF;
   ELSE attack_ra=p_manual_ra;END IF;
  END IF;
  total=total+p_flat+attack_ra;
  label_text=CASE p_kind WHEN 'dano' THEN 'DANO' WHEN 'resistencia' THEN 'RESISTÊNCIA · '||p_resource ELSE 'RECUPERAÇÃO' END
   ||CASE WHEN attack_ra<>0 THEN ' · RA '||attack_ra ELSE '' END
   ||CASE WHEN p_flat<>0 THEN ' · ajuste '||p_flat ELSE '' END;
 END IF;
 IF p_reaction THEN
  SELECT data INTO doc FROM public.ae_document WHERE id=1 FOR UPDATE;
  SELECT x.value INTO before_sheet FROM jsonb_array_elements(doc->'sheets') x(value) WHERE x.value->>'id'=p_sheet_id LIMIT 1;
  IF before_sheet IS NULL THEN RAISE EXCEPTION 'Ficha inexistente.';END IF;
  IF coalesce((before_sheet->'combat'->>'reactionUsed')::boolean,false) THEN
   IF coalesce((before_sheet#>>'{combat,cbb,extraReaction}')::integer,0)<1 THEN RAISE EXCEPTION 'Reação já utilizada.';END IF;
   updated_sheet=jsonb_set(before_sheet,'{combat,cbb,extraReaction}','0'::jsonb,true);
  ELSE
   updated_sheet=jsonb_set(before_sheet,'{combat,reactionUsed}','true'::jsonb,true);
  END IF;
  SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_sheet_id THEN updated_sheet ELSE x.value END ORDER BY x.ord)
    INTO all_sheets FROM jsonb_array_elements(doc->'sheets') WITH ORDINALITY x(value,ord);
  UPDATE public.ae_document SET data=jsonb_set(doc,'{sheets}',all_sheets),revision=revision+1,changed_at=now() WHERE id=1;
 END IF;
 INSERT INTO public.ae_rolls(account_id,account_name,sheet_id,character_name,kind,label,dice,total,special,hidden,colors)
 VALUES(ac_id,ac_name,p_sheet_id,sh->>'name','cbb',left(label_text,160),result_dice,total,special,false,colors)
 RETURNING * INTO new_roll;
 RETURN to_jsonb(new_roll)||jsonb_build_object('rt',total,'ra',ra,'rb',rb,'attack_ra',attack_ra,
   'kind_cbb',p_kind,'context',p_context,'reaction',p_reaction,'group',grp,
   'groupDie',rolled_group,'skillDie',rolled_skill,'autoGroupSteps',auto_g,'autoSkillSteps',auto_s,
   'fearDie',fear_size,'fearRoll',fear_value,'fearClear',fear_size>0 AND fear_value=1,
   'hollowDie',CASE WHEN hollow_on THEN 6 ELSE 0 END,'hollowRoll',hollow_value,
   'hollowLost',hollow_on AND special='FALHA CRÍTICA');
END $cbb$;

REVOKE ALL ON FUNCTION public.ae_cbb_random(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ae_cbb_random(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.ae_cbb_roll(text,text,text,text,boolean,integer,integer,jsonb,text,integer,bigint,integer,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ae_cbb_roll(text,text,text,text,boolean,integer,integer,jsonb,text,integer,bigint,integer,integer,boolean) TO authenticated;
