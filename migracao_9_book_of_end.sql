-- ARQUIVO ESPIRITUAL · Book of the End · migração de referência
-- Funções confirmadas no Supabase. Exigem a estrutura prévia das migrações 5–8.
-- O caso específico do Livro do Fim é restrito à ficha de Tsukishima.
-- Rolagens com NPCs são verificadas no servidor e não modificam fichas inexistentes.

-- ae_book_skill_die
CREATE OR REPLACE FUNCTION public.ae_book_skill_die(p_sheet_id text, p_skill text, p_base integer)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE sh jsonb; b jsonb;st jsonb;
BEGIN
 FOR sh IN SELECT x.value FROM public.ae_document d, jsonb_array_elements(d.data->'sheets') x(value) WHERE d.id=1 LOOP
  IF sh->>'id'<>'arquivo-tsukishima-arena-n3' THEN CONTINUE; END IF;
  b=sh->'abilityRuntime'->'bookOfEnd';st=b->'stolen';
  IF st IS NULL OR st->>'skill' IS DISTINCT FROM p_skill
     OR coalesce((b->>'scene')::integer,-1)<>coalesce((sh->'combat'->>'scene')::integer,1)
     OR coalesce((sh->'abilityRuntime'->'billing'->'tsukishima-book-of-the-end-manifestacao'->>'active')::boolean,false)=false
     OR coalesce((sh->'abilityRuntime'->'billing'->'tsukishima-book-of-the-end-manifestacao'->>'scene')::integer,-1)<>coalesce((sh->'combat'->>'scene')::integer,1)
  THEN CONTINUE; END IF;
  IF sh->>'id'=p_sheet_id THEN RETURN coalesce((st->>'die')::integer,p_base); END IF;
  IF st->>'targetId'=p_sheet_id THEN RETURN 0; END IF;
 END LOOP;
 RETURN p_base;
END;$function$
;

-- ae_ability_gate_open
CREATE OR REPLACE FUNCTION public.ae_ability_gate_open(p_sheet jsonb, p_ability jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE cfg jsonb;req text;target jsonb;target_ix integer;found boolean:=false;entry jsonb;
BEGIN
 IF p_ability ? 'minLevel' AND coalesce(p_ability->>'minLevel','') ~ '^[1-9][0-9]{0,2}$' THEN
  IF (p_ability->>'minLevel')::integer > coalesce((p_sheet->>'level')::integer,1) THEN RETURN false; END IF;
 END IF;
 cfg=p_ability->'unlock';
 IF cfg IS NULL THEN RETURN true;END IF;
 IF jsonb_typeof(cfg)<>'object' THEN RETURN false;END IF;
 req=coalesce(cfg->>'requires','');
 IF req='' THEN RETURN false;END IF;
 IF length(req)>100 OR coalesce(cfg->>'mode','hidden') NOT IN ('hidden','locked') THEN RETURN false;END IF;
 IF jsonb_typeof(p_sheet->'abilities')<>'array' THEN RETURN false;END IF;
 FOR target,target_ix IN SELECT x.value,(x.ord-1)::integer
 FROM jsonb_array_elements(p_sheet->'abilities') WITH ORDINALITY x(value,ord) LOOP
  IF public.ae_ability_billing_key(target,target_ix)=req AND target->'costConfig'->>'mode'='activation' THEN
   found=true;EXIT;
  END IF;
 END LOOP;
 IF NOT found THEN RETURN false;END IF;
 entry=p_sheet->'abilityRuntime'->'billing'->req;
 RETURN coalesce((entry->>'scene')::integer,-1)=coalesce((p_sheet->'combat'->>'scene')::integer,1)
  AND coalesce((entry->>'active')::boolean,false);
END;$function$
;

-- ae_book_of_end_action_v2
CREATE OR REPLACE FUNCTION public.ae_book_of_end_action_v2(p_source_id text, p_target_id text, p_action text, p_steal_skill text DEFAULT 'Precisão'::text, p_npc_name text DEFAULT NULL::text, p_npc_stats jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 k public.ae_keys%ROWTYPE;
 doc jsonb;src jsonb;tgt jsonb;ab jsonb;preview jsonb;book jsonb;rt jsonb;targets jsonb;entry jsonb;
 hist jsonb;event jsonb;all_sheets jsonb;stats jsonb;
 npc boolean:=false;target_key text;target_name text;scene_no integer;round_no integer;
 ix integer;grade integer;old_grade integer;cost integer;att integer;def integer;
 g integer;die integer;memory_die integer:=0;damage integer:=0;stolen_die integer;
 stability_now integer;changed boolean:=false;rev bigint;
BEGIN
 IF p_source_id<>'arquivo-tsukishima-arena-n3'
  OR p_action NOT IN ('insert','ultimate') OR p_target_id IS NULL
  OR p_target_id=p_source_id
 THEN RAISE EXCEPTION 'Ação indisponível para esta ficha.';END IF;
 IF p_steal_skill IS NULL OR p_steal_skill NOT IN
 ('Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão',
 'Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia',
 'Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação')
 THEN RAISE EXCEPTION 'Perícia inválida.';END IF;
 SELECT ky.* INTO k FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys ky ON ky.id=se.key_id AND ky.active
 WHERE se.user_id=auth.uid() LIMIT 1;
 IF k.id IS NULL OR k.kind NOT IN ('player','master') THEN RAISE EXCEPTION 'Entre como jogador ou mestre.';END IF;

 SELECT data INTO doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 SELECT x.value INTO src FROM jsonb_array_elements(doc->'sheets') x(value) WHERE x.value->>'id'=p_source_id LIMIT 1;
 IF src IS NULL THEN RAISE EXCEPTION 'Ficha do Tsukishima não encontrada.';END IF;
 IF k.kind='player' AND NOT public.ae_sheet_linked(src,k.id,k.sheet_id)
 THEN RAISE EXCEPTION 'Ficha não vinculada à sua chave.';END IF;
 npc=p_target_id='npc';
 IF npc THEN
  target_name=btrim(coalesce(p_npc_name,''));
  IF length(target_name) NOT BETWEEN 1 AND 80 OR target_name~'[<>]'
  THEN RAISE EXCEPTION 'Nome do NPC inválido (1 a 80 caracteres).';END IF;
  target_key='npc:'||md5(lower(target_name));
  stats=coalesce(p_npc_stats,'{}'::jsonb);
  IF jsonb_typeof(stats)<>'object' THEN RAISE EXCEPTION 'Atributos do NPC inválidos.';END IF;
  IF coalesce(stats->>'corpo','6') !~ '^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'destreza','6') !~ '^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'mente','6') !~ '^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'determinacao','6') !~ '^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'pericia','6') !~ '^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'estabilidade','20') !~ '^[0-9]{1,3}$'
  THEN RAISE EXCEPTION 'Dados inválidos para o NPC.';END IF;
  -- Preserva apenas os seis campos autorizados, descartando propriedades extras.
  stats=jsonb_build_object(
   'corpo',(coalesce(stats->>'corpo','6'))::integer,
   'destreza',(coalesce(stats->>'destreza','6'))::integer,
   'mente',(coalesce(stats->>'mente','6'))::integer,
   'determinacao',(coalesce(stats->>'determinacao','6'))::integer,
   'pericia',(coalesce(stats->>'pericia','6'))::integer,
   'estabilidade',(coalesce(stats->>'estabilidade','20'))::integer);
  tgt=jsonb_build_object('name',target_name,
   'groups',jsonb_build_object('Corpo',(coalesce(stats->>'corpo','6'))::integer,
       'Mente',(coalesce(stats->>'mente','6'))::integer),
   'skills',jsonb_build_object('Destreza',(coalesce(stats->>'destreza','6'))::integer,
       'Determinação',(coalesce(stats->>'determinacao','6'))::integer),
   'resources',jsonb_build_object('estabilidade',
       jsonb_build_object('current',(coalesce(stats->>'estabilidade','20'))::integer)));
 ELSE
  target_key=p_target_id;
  SELECT x.value INTO tgt FROM jsonb_array_elements(doc->'sheets') x(value)
     WHERE x.value->>'id'=target_key LIMIT 1;
  IF tgt IS NULL THEN RAISE EXCEPTION 'Alvo não encontrado.';END IF;
  IF k.kind='player' THEN
   IF coalesce((tgt->>'masterOnly')::boolean,false) THEN RAISE EXCEPTION 'Alvo reservado ao mestre.';END IF;
   IF NOT EXISTS(
    SELECT 1 FROM public.ae_live_participants pa
    JOIN public.ae_live_participants pb ON pb.session_id=pa.session_id
    JOIN public.ae_live_sessions ls ON ls.id=pa.session_id AND ls.status='open'
    WHERE pa.sheet_id=p_source_id AND pb.sheet_id=target_key
     AND pa.left_at IS NULL AND pa.removed_at IS NULL
     AND pb.left_at IS NULL AND pb.removed_at IS NULL
   ) THEN RAISE EXCEPTION 'Alvo fora da sessão ativa.';END IF;
  END IF;
 END IF;
 IF coalesce((src->'resources'->'vida'->>'current')::numeric,0)<=0 OR
   coalesce((src->'resources'->'alma'->>'current')::numeric,0)<=0 OR
   EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(src->'conditions','[]'::jsonb)) c(value)
          WHERE lower(c.value) IN ('desmaiado','morto'))
 THEN RAISE EXCEPTION 'Tsukishima está incapacitado.';END IF;

 scene_no=coalesce((src->'combat'->>'scene')::integer,1);
 round_no=coalesce((src->'combat'->>'round')::integer,1);
 IF NOT coalesce((src->'abilityRuntime'->'billing'->'tsukishima-book-of-the-end-manifestacao'->>'active')::boolean,false)
 OR coalesce((src->'abilityRuntime'->'billing'->'tsukishima-book-of-the-end-manifestacao'->>'scene')::integer,-1)<>scene_no
 THEN RAISE EXCEPTION 'Manifeste Book of the End primeiro.';END IF;
 SELECT x.value,(x.ord-1)::integer INTO ab,ix
 FROM jsonb_array_elements(src->'abilities') WITH ORDINALITY x(value,ord)
 WHERE x.value->>'abilityId'=CASE WHEN p_action='insert' THEN 'tsukishima-inserir-presenca'
                                             ELSE 'tsukishima-vire-pagina' END LIMIT 1;
 IF ab IS NULL THEN RAISE EXCEPTION 'Habilidade não encontrada.';END IF;
 rt=coalesce(src->'abilityRuntime','{}'::jsonb);
 book=coalesce(rt->'bookOfEnd','{}'::jsonb);
 IF coalesce((book->>'scene')::integer,-1)<>scene_no
 THEN book=jsonb_build_object('scene',scene_no,'targets','{}'::jsonb);END IF;
 targets=coalesce(book->'targets','{}'::jsonb);
 IF npc AND NOT (targets ? target_key) THEN
  IF (SELECT count(*) FROM jsonb_object_keys(targets) x(k))>=35
  THEN RAISE EXCEPTION 'Limite de 35 alvos. Inicie outra cena.';END IF;
 END IF;
 entry=coalesce(targets->target_key,'{}'::jsonb);
 grade=least(3,greatest(0,coalesce((entry->>'grade')::integer,0)));
 old_grade=grade;
 IF npc THEN
  stability_now=greatest(0,coalesce((entry->>'stability')::integer,(stats->>'estabilidade')::integer,20));
  tgt=jsonb_set(tgt,'{resources,estabilidade,current}',to_jsonb(stability_now),true);
 END IF;
 IF p_action='ultimate' AND grade<2 THEN RAISE EXCEPTION 'Requer Relação Plástica II ou III.';END IF;
 preview=public.ae_ability_cost_preview(src,ab,ix);
 cost=(preview->>'cost')::integer;
 IF (src->'resources'->'alma'->>'current')::numeric<cost
 THEN RAISE EXCEPTION 'Alma insuficiente.';END IF;

 IF p_action='insert' THEN
  die=(src->'skills'->>'Precisão')::integer;
  die=public.ae_book_skill_die(p_source_id,'Precisão',die);
  IF die<>0 THEN die=public.ae_die_step(die,public.ae_ability_step_bonus(src,'Precisão','Corpo')+CASE WHEN grade>=2 THEN 1 ELSE 0 END);END IF;
  att=public.ae_random_die((src->'groups'->>'Corpo')::integer)+CASE WHEN die=0 THEN 0 ELSE public.ae_random_die(die) END;
  die=(tgt->'skills'->>'Destreza')::integer;
  IF NOT npc THEN
   die=public.ae_book_skill_die(target_key,'Destreza',die);
   IF die<>0 THEN die=public.ae_die_step(die,public.ae_ability_step_bonus(tgt,'Destreza','Corpo'));END IF;
  END IF;
  def=public.ae_random_die((tgt->'groups'->>'Corpo')::integer)+CASE WHEN die=0 THEN 0 ELSE public.ae_random_die(die) END;
  changed=att>def;
  IF changed THEN
   grade=least(3,grade+1);
   memory_die=public.ae_random_die(10);
   IF memory_die=1 THEN grade=greatest(0,grade-1);END IF;
  END IF;
 ELSE
  grade=grade-1;
  die=(src->'skills'->>'Lábia')::integer;
  die=public.ae_book_skill_die(p_source_id,'Lábia',die);
  IF die<>0 THEN die=public.ae_die_step(die,public.ae_ability_step_bonus(src,'Lábia','Mente'));END IF;
  att=public.ae_random_die((src->'groups'->>'Mente')::integer)+CASE WHEN die=0 THEN 0 ELSE public.ae_random_die(die) END;
  die=(tgt->'skills'->>'Determinação')::integer;
  IF npc THEN
   IF old_grade>=3 THEN die=public.ae_die_step(die,-1);END IF;
  ELSE
   die=public.ae_book_skill_die(target_key,'Determinação',die);
   IF die<>0 THEN die=public.ae_die_step(die,public.ae_ability_step_bonus(tgt,'Determinação','Mente')-CASE WHEN old_grade>=3 THEN 1 ELSE 0 END);END IF;
  END IF;
  def=public.ae_random_die((tgt->'groups'->>'Mente')::integer)+CASE WHEN die=0 THEN 0 ELSE public.ae_random_die(die) END;
  changed=att>def;
  IF changed THEN
   damage=public.ae_random_die(6)+public.ae_random_die(6);
   tgt=jsonb_set(tgt,'{resources,estabilidade,current}',
     to_jsonb(greatest(0,(tgt->'resources'->'estabilidade'->>'current')::numeric-damage)),true);
   IF NOT npc THEN
    IF (tgt->'resources'->'estabilidade'->>'current')::numeric=0 AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements_text(coalesce(tgt->'conditions','[]'::jsonb)) c(value)
      WHERE lower(c.value)='acorrentado')
    THEN tgt=jsonb_set(tgt,'{conditions}',coalesce(tgt->'conditions','[]'::jsonb)||to_jsonb('Acorrentado'::text),true);END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(tgt->'conditions','[]'::jsonb)) c(value)
      WHERE lower(c.value)='confuso') THEN
      tgt=jsonb_set(tgt,'{conditions}',coalesce(tgt->'conditions','[]'::jsonb)||to_jsonb('Confuso'::text),true);
      tgt=jsonb_set(tgt,'{combat,bookEndConfusion}',
        jsonb_build_object('scene',coalesce((tgt->'combat'->>'scene')::integer,1),
        'round',coalesce((tgt->'combat'->>'round')::integer,1)),true);
    END IF;
   END IF;
   memory_die=public.ae_random_die(10);
  END IF;
 END IF;
 IF changed AND memory_die=10 THEN
  stolen_die=CASE WHEN npc THEN (coalesce(stats->>'pericia','6'))::integer
     ELSE coalesce((tgt->'skills'->>p_steal_skill)::integer,0) END;
  IF stolen_die IN (4,6,8,10,12,20) THEN
   book=jsonb_set(book,'{stolen}',
     jsonb_build_object('targetId',target_key,'targetName',tgt->>'name',
       'skill',p_steal_skill,'die',stolen_die,'npc',npc),true);
  END IF;
 END IF;
 entry=jsonb_build_object('grade',grade,'name',tgt->>'name','npc',npc,
   'lastMemory',memory_die,'lastSuccess',changed,'lastRound',round_no,
   'lastAction',p_action,'lastDamage',damage);
 IF npc THEN
  entry=entry||jsonb_build_object('stability',(tgt->'resources'->'estabilidade'->>'current')::integer,
    'npcStats',stats,'confusedRound',CASE WHEN p_action='ultimate' AND changed THEN round_no WHEN coalesce((targets->target_key->>'confusedRound')::integer,-1)=round_no THEN round_no ELSE NULL END);
 END IF;
 targets=targets||jsonb_build_object(target_key,entry);
 hist=coalesce(book->'history','[]'::jsonb);
 event=jsonb_build_object('targetId',target_key,'name',tgt->>'name','action',p_action,
   'success',changed,'attack',att,'defense',def,'memory',memory_die,
   'grade',grade,'damage',damage,'round',round_no);
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ord),'[]'::jsonb) INTO hist
 FROM jsonb_array_elements(hist||jsonb_build_array(event)) WITH ORDINALITY x(value,ord)
 WHERE x.ord>greatest(0,jsonb_array_length(hist)+1-10);
 book=book||jsonb_build_object('targets',targets,'history',hist);
 src=jsonb_set(src,'{abilityRuntime}',rt||jsonb_build_object('bookOfEnd',book),true);
 src=public.ae_ability_cost_commit(src,ab,preview);
 src=jsonb_set(src,'{resources,alma,current}',to_jsonb((src->'resources'->'alma'->>'current')::numeric-cost),true);
 IF (src->'resources'->'alma'->>'current')::numeric=0 THEN
  src=jsonb_set(src,'{combat,almaExhaustion}','true'::jsonb,true);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(src->'conditions','[]'::jsonb)) c(value)
    WHERE lower(c.value)='desmaiado') THEN
   src=jsonb_set(src,'{conditions}',coalesce(src->'conditions','[]'::jsonb)||to_jsonb('Desmaiado'::text),true);END IF;
 END IF;
 SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_source_id THEN src
     WHEN NOT npc AND x.value->>'id'=target_key THEN tgt ELSE x.value END ORDER BY x.ord)
 INTO all_sheets FROM jsonb_array_elements(doc->'sheets') WITH ORDINALITY x(value,ord);
 UPDATE public.ae_document
 SET data=jsonb_set(doc,'{sheets}',all_sheets),revision=revision+1,changed_at=now()
 WHERE id=1 RETURNING revision INTO rev;
 RETURN jsonb_build_object('success',changed,'action',p_action,'attack',att,'defense',def,
  'grade',grade,'memory',memory_die,'damage',damage,'stolen',book->'stolen',
  'alma',(src->'resources'->'alma'->>'current')::numeric,'revision',rev,
  'targetId',target_key,'targetName',tgt->>'name','npc',npc,
  'stability',CASE WHEN npc THEN (tgt->'resources'->'estabilidade'->>'current')::integer ELSE NULL END);
END;$function$
;

-- ae_book_of_end_action
CREATE OR REPLACE FUNCTION public.ae_book_of_end_action(p_source_id text, p_target_id text, p_action text, p_steal_skill text DEFAULT 'Precisão'::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT public.ae_book_of_end_action_v2(p_source_id,p_target_id,p_action,p_steal_skill,NULL,NULL);
$function$
;

-- ae_roll_skill
CREATE OR REPLACE FUNCTION public.ae_roll_skill(p_sheet_id text, p_skill text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_a public.ae_accounts%rowtype;v_key public.ae_keys%rowtype;v_sheet jsonb;v_group text;
v_g integer;v_d integer;v_1 integer;v_2 integer;v_total integer;v_special text;v_row public.ae_rolls%rowtype;v_effect jsonb;v_doc jsonb;v_before jsonb;v_sheets jsonb;
begin
 select a.* into v_a from public.ae_sessions s join public.ae_accounts a on a.id=s.account_id
 join public.ae_keys k on k.id=s.key_id and k.active where s.user_id=auth.uid();
 select k.* into v_key from public.ae_sessions s join public.ae_keys k on k.id=s.key_id
 where s.user_id=auth.uid() and k.active;
 if v_a.id is null or v_key.kind not in ('master','player') then raise exception 'Faça login antes de rolar.';end if;
 perform 1 from public.ae_document where id=1 for update;
 select data into v_doc from public.ae_document where id=1;
 select value into v_sheet from public.ae_document d cross join lateral jsonb_array_elements(d.data->'sheets') x(value)
 where d.id=1 and x.value->>'id'=p_sheet_id limit 1;
 if v_sheet is null then raise exception 'Ficha inexistente.';end if;
 IF coalesce((v_sheet->>'masterOnly')::boolean,false) AND v_key.kind<>'master' THEN RAISE EXCEPTION 'Ficha exclusiva de mestre.'; END IF;
 if v_key.kind='player' and not public.ae_sheet_linked(v_sheet,v_key.id,v_key.sheet_id)
 then raise exception 'Ficha não vinculada à sua chave.';end if;
 v_group=case when p_skill=any(array['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão']) then 'Corpo'
 when p_skill=any(array['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia']) then 'Mente'
 when p_skill=any(array['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']) then 'Espírito' else null end;
 if v_group is null then raise exception 'Perícia inválida.';end if;
 v_g=(v_sheet->'groups'->>v_group)::integer;v_d=(v_sheet->'skills'->>p_skill)::integer;
 if v_g not in (4,6,8,10,12,20) or v_d not in (4,6,8,10,12,20) then raise exception 'Dados da ficha inválidos.';end if;
 v_d=public.ae_book_skill_die(p_sheet_id,p_skill,v_d);IF v_d<>0 THEN v_d=public.ae_die_step(v_d,public.ae_ability_step_bonus(v_sheet,p_skill,v_group));END IF;v_1=public.ae_random_die(v_g);v_2=CASE WHEN v_d=0 THEN 0 ELSE public.ae_random_die(v_d) END;
 v_effect=public.ae_transform_test(
   CASE WHEN v_d=0 THEN jsonb_build_array(jsonb_build_object('sides',v_g,'value',v_1)) ELSE jsonb_build_array(jsonb_build_object('sides',v_g,'value',v_1),jsonb_build_object('sides',v_d,'value',v_2)) END,
   coalesce((v_sheet->'combat'->>'fearDie')::integer,0),
   coalesce((v_sheet->'combat'->>'hollowActive')::boolean,false),
   coalesce((v_sheet->'combat'->>'nextBonusDie')::integer,0));
 v_total=(v_effect->>'total')::integer;v_special=v_effect->>'special';
 v_before=v_sheet;v_sheet=public.ae_apply_test_state(v_sheet,v_effect);v_sheet=public.ae_ability_consume_next(v_sheet,p_skill,v_group);
 IF v_sheet IS DISTINCT FROM v_before THEN
  SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_sheet_id THEN v_sheet ELSE x.value END ORDER BY x.ord)
  INTO v_sheets FROM jsonb_array_elements(v_doc->'sheets') WITH ORDINALITY x(value,ord);
  UPDATE public.ae_document SET data=jsonb_set(v_doc,'{sheets}',v_sheets),revision=revision+1,changed_at=now() WHERE id=1;
 END IF;
 insert into public.ae_rolls(account_id,account_name,sheet_id,character_name,kind,label,dice,total,special)
 values(v_a.id,v_a.name,p_sheet_id,v_sheet->>'name','skill',p_skill,
 v_effect->'dice',v_total,v_special)
 returning * into v_row;
 return to_jsonb(v_row)||jsonb_build_object('effect',v_effect->'effect','usedBonus',v_effect->'usedBonus');
end $function$
;

-- ae_use_ability
CREATE OR REPLACE FUNCTION public.ae_use_ability(p_sheet_id text, p_ability_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_account public.ae_accounts%ROWTYPE;
 v_key public.ae_keys%ROWTYPE;
 v_doc jsonb; v_sheet jsonb; v_ability jsonb; v_sheets jsonb;
 v_alma numeric; v_cost integer; v_rev bigint;v_cost_preview jsonb;
 v_inventory_item_id text; v_inventory_item jsonb; v_inventory_item_ix integer; v_inventory_count integer;
 v_skill text; v_group text; v_group_die integer; v_skill_die integer;
 v_dice_def jsonb; v_die jsonb; v_dice jsonb='[]'::jsonb; v_colors jsonb='[]'::jsonb;
 v_size integer; v_result integer; v_total integer=0; v_i integer;
 v_special text=''; v_eval jsonb;
 v_color text; v_fallback text; v_roll public.ae_rolls%ROWTYPE;
BEGIN
 IF p_sheet_id IS NULL OR p_ability_index IS NULL OR p_ability_index<0 OR p_ability_index>=100 THEN
  RAISE EXCEPTION 'Ficha ou habilidade inválida.';
 END IF;
 SELECT a.* INTO v_account
 FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active
 WHERE se.user_id=auth.uid();
 SELECT k.* INTO v_key
 FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active
 WHERE se.user_id=auth.uid();
 IF v_account.id IS NULL OR v_key.id IS NULL OR v_key.kind NOT IN ('master','player') THEN
  RAISE EXCEPTION 'Entre como mestre ou jogador para usar técnicas.';
 END IF;
 SELECT data INTO v_doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 SELECT x.value INTO v_sheet FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) x(value)
 WHERE x.value->>'id'=p_sheet_id LIMIT 1;
 IF v_sheet IS NULL THEN RAISE EXCEPTION 'Ficha não encontrada.'; END IF;
 IF coalesce((v_sheet->>'masterOnly')::boolean,false) AND v_key.kind<>'master' THEN RAISE EXCEPTION 'Ficha exclusiva de mestre.'; END IF;
 IF v_key.kind='player' AND NOT public.ae_sheet_linked(v_sheet,v_key.id,v_key.sheet_id) THEN
  RAISE EXCEPTION 'Esta ficha não pertence à sua chave.';
 END IF;
 IF jsonb_typeof(v_sheet->'abilities') IS DISTINCT FROM 'array'
    OR p_ability_index>=jsonb_array_length(v_sheet->'abilities') THEN
  RAISE EXCEPTION 'Habilidade não encontrada.';
 END IF;
 v_ability=v_sheet->'abilities'->p_ability_index; IF coalesce((v_ability->>'passive')::boolean,false) OR coalesce(v_ability->>'category','')='passive' THEN RAISE EXCEPTION 'Habilidade passiva não pode ser ativada.'; END IF;
 IF jsonb_typeof(v_ability) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Habilidade inválida.'; END IF;
 IF v_ability->>'abilityId' IN ('tsukishima-inserir-presenca','tsukishima-vire-pagina') THEN RAISE EXCEPTION 'Utilize os controles automáticos de Book of the End.'; END IF;
 IF coalesce(v_ability->>'cost','') !~ '^[0-9]{1,6}$' THEN RAISE EXCEPTION 'Custo de Alma inválido.'; END IF;
 IF coalesce((v_sheet->'resources'->'vida'->>'current')::numeric,0)<=0
 OR coalesce((v_sheet->'resources'->'alma'->>'current')::numeric,0)<=0
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(v_sheet->'conditions','[]'::jsonb)) c(value)
 WHERE lower(c.value) IN ('desmaiado','morto'))
 THEN RAISE EXCEPTION 'Personagem incapacitado não pode utilizar técnicas.';END IF;
 v_cost_preview=public.ae_ability_cost_preview(v_sheet,v_ability,p_ability_index);v_cost=(v_cost_preview->>'cost')::integer;
 IF jsonb_typeof(v_sheet->'resources'->'alma'->'current') <> 'number' THEN RAISE EXCEPTION 'Alma da ficha inválida.'; END IF;
 v_alma=(v_sheet->'resources'->'alma'->>'current')::numeric;
 IF v_alma<v_cost THEN RAISE EXCEPTION 'Alma insuficiente para utilizar esta técnica.'; END IF;

 -- Consumo de ITEM vinculado no mesmo bloqueio transacional do uso da habilidade.
 IF v_ability->>'category'='item' AND nullif(v_ability->>'inventoryItemId','') IS NOT NULL THEN
  v_inventory_item_id=v_ability->>'inventoryItemId';
  SELECT it.value,(it.ord-1)::integer INTO v_inventory_item,v_inventory_item_ix
  FROM jsonb_array_elements(coalesce(v_sheet->'inventory'->'items','[]'::jsonb)) WITH ORDINALITY it(value,ord)
  WHERE it.value->>'id'=v_inventory_item_id LIMIT 1;
  IF v_inventory_item IS NULL THEN RAISE EXCEPTION 'O item vinculado não está mais no inventário.'; END IF;
  -- Ausente ou nulo significa quantidade não controlada (item permanente).
  IF v_inventory_item ? 'quantity' AND jsonb_typeof(v_inventory_item->'quantity') IS DISTINCT FROM 'null' THEN
   IF jsonb_typeof(v_inventory_item->'quantity') IS DISTINCT FROM 'number'
     OR coalesce(v_inventory_item->>'quantity','') !~ '^[0-9]{1,6}$' THEN
    RAISE EXCEPTION 'Quantidade inválida no item vinculado.';
   END IF;
   v_inventory_count=(v_inventory_item->>'quantity')::integer;
   IF v_inventory_count<1 THEN RAISE EXCEPTION 'Item esgotado: não é possível usar esta habilidade.'; END IF;
   v_sheet=jsonb_set(v_sheet,
      array['inventory','items',v_inventory_item_ix::text,'quantity'],
      to_jsonb(v_inventory_count-1),false);
  END IF;
 END IF;

 -- Tipo de teste definido na propria ficha, nunca por dados enviados pelo navegador.
 v_dice_def=CASE WHEN coalesce((v_ability->>'noTest')::boolean,false) OR v_ability->'automation'->>'kind'='progressive' THEN '[]'::jsonb ELSE v_ability->'testDice' END;
 IF jsonb_typeof(v_dice_def)='array' AND jsonb_array_length(v_dice_def)>0 THEN
  IF jsonb_array_length(v_dice_def)>12 THEN RAISE EXCEPTION 'O teste pode ter no máximo 12 dados.'; END IF;
  FOR v_i IN 0..jsonb_array_length(v_dice_def)-1 LOOP
   v_die=v_dice_def->v_i;
   IF coalesce(v_die->>'sides','') !~ '^(4|6|8|10|12|20)$' THEN
    RAISE EXCEPTION 'Faces inválidas no dado %.',v_i+1;
   END IF;
   v_size=(v_die->>'sides')::integer;
   v_color=v_die->>'color';
   IF v_color IS NULL OR v_color !~ '^#[0-9a-fA-F]{6}$' THEN
    v_color=v_sheet->'appearance'->>'diceGroup';
   END IF;
   IF v_color IS NULL OR v_color !~ '^#[0-9a-fA-F]{6}$' THEN v_color='#FF7A1A'; END IF;
   v_result=public.ae_random_die(v_size);
   v_dice=v_dice||jsonb_build_array(jsonb_build_object('sides',v_size,'value',v_result));
   v_colors=v_colors||jsonb_build_array(v_color);
   v_total=v_total+v_result;
  END LOOP;
 ELSE
  v_skill=CASE WHEN coalesce((v_ability->>'noTest')::boolean,false) OR v_ability->'automation'->>'kind'='progressive' THEN NULL ELSE v_ability->>'testSkill' END;
  v_group=CASE WHEN v_skill=ANY(ARRAY['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão']) THEN 'Corpo'
              WHEN v_skill=ANY(ARRAY['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia']) THEN 'Mente'
              WHEN v_skill=ANY(ARRAY['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']) THEN 'Espírito'
              ELSE NULL END;
  IF v_group IS NOT NULL THEN
   IF coalesce(v_sheet->'groups'->>v_group,'') !~ '^(4|6|8|10|12|20)$'
      OR coalesce(v_sheet->'skills'->>v_skill,'') !~ '^(4|6|8|10|12|20)$' THEN
     RAISE EXCEPTION 'Dados de grupo ou perícia inválidos.';
   END IF;
   v_group_die=(v_sheet->'groups'->>v_group)::integer;
   v_skill_die=(v_sheet->'skills'->>v_skill)::integer;v_skill_die=public.ae_book_skill_die(p_sheet_id,v_skill,v_skill_die);IF v_skill_die<>0 THEN v_skill_die=public.ae_die_step(v_skill_die,public.ae_ability_step_bonus(v_sheet,v_skill,v_group));END IF;
   FOR v_i IN 1..(CASE WHEN v_skill_die=0 THEN 1 ELSE 2 END) LOOP
    v_size=CASE WHEN v_i=1 THEN v_group_die ELSE v_skill_die END;
    v_color=CASE WHEN v_i=1 THEN coalesce(v_ability->'diceColors'->>'group',v_sheet->'appearance'->>'diceGroup')
                 ELSE coalesce(v_ability->'diceColors'->>'skill',v_sheet->'appearance'->>'diceSkill') END;
    IF v_color IS NULL OR v_color !~ '^#[0-9a-fA-F]{6}$' THEN
     v_color=CASE WHEN v_i=1 THEN '#FF7A1A' ELSE '#4CC9F0' END;
    END IF;
    v_result=public.ae_random_die(v_size);
    v_dice=v_dice||jsonb_build_array(jsonb_build_object('sides',v_size,'value',v_result));
    v_colors=v_colors||jsonb_build_array(v_color);
    v_total=v_total+v_result;
   END LOOP;
  END IF;
 END IF;

 IF jsonb_array_length(v_dice)>0 THEN
  SELECT public.ae_transform_test(v_dice,
   coalesce((v_sheet->'combat'->>'fearDie')::integer,0),
   coalesce((v_sheet->'combat'->>'hollowActive')::boolean,false),
   coalesce((v_sheet->'combat'->>'nextBonusDie')::integer,0)) INTO v_eval;
  v_dice=v_eval->'dice';
  IF coalesce((v_eval->>'usedBonus')::boolean,false) THEN v_colors=v_colors||jsonb_build_array('#E8C56D');END IF;
  v_sheet=public.ae_apply_test_state(v_sheet,v_eval);IF v_skill IS NOT NULL THEN v_sheet=public.ae_ability_consume_next(v_sheet,v_skill,v_group);END IF;
  v_total=(v_eval->>'total')::integer;
  v_special=v_eval->>'special';
 END IF;

 v_alma=v_alma-v_cost;v_sheet=public.ae_ability_arm(v_sheet,v_ability);v_sheet=public.ae_ability_cost_commit(v_sheet,v_ability,v_cost_preview);
 v_sheet=jsonb_set(v_sheet,'{resources,alma,current}',to_jsonb(v_alma),true);
 IF v_alma=0 THEN
  v_sheet=jsonb_set(v_sheet,'{combat,almaExhaustion}','true'::jsonb,true);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(v_sheet->'conditions','[]'::jsonb)) c(value)
   WHERE lower(c.value)='desmaiado') THEN
   v_sheet=jsonb_set(v_sheet,'{conditions}',coalesce(v_sheet->'conditions','[]'::jsonb)||to_jsonb('Desmaiado'::text),true);
  END IF;
 END IF;
 SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_sheet_id THEN v_sheet ELSE x.value END ORDER BY x.ord)
 INTO v_sheets FROM jsonb_array_elements(v_doc->'sheets') WITH ORDINALITY x(value,ord);
 UPDATE public.ae_document
 SET data=jsonb_set(v_doc,'{sheets}',coalesce(v_sheets,'[]'::jsonb)),revision=revision+1,changed_at=now()
 WHERE id=1 RETURNING revision INTO v_rev;

 IF jsonb_array_length(v_dice)>0 THEN
  INSERT INTO public.ae_rolls(account_id,account_name,sheet_id,character_name,kind,label,dice,total,special,colors)
  VALUES(v_account.id,v_account.name,p_sheet_id,v_sheet->>'name','ability',v_ability->>'name',v_dice,v_total,v_special,v_colors)
  RETURNING * INTO v_roll;
  RETURN jsonb_build_object('alma',v_alma,'revision',v_rev,'roll',to_jsonb(v_roll)||jsonb_build_object('effect',v_eval->'effect','usedBonus',v_eval->'usedBonus'),'chargedCost',v_cost,'costMode',v_cost_preview->>'mode');
 END IF;
 RETURN jsonb_build_object('alma',v_alma,'revision',v_rev,'roll',NULL,'chargedCost',v_cost,'costMode',v_cost_preview->>'mode');
END;
$function$
;

-- Redução explícita da superfície exposta da RPC.
REVOKE ALL ON FUNCTION public.ae_book_skill_die(text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ae_book_of_end_action_v2(text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ae_book_of_end_action_v2(text,text,text,text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ae_book_of_end_action(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ae_book_of_end_action(text,text,text,text) TO authenticated;
