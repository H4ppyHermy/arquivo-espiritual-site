-- Shinji Hirako · Visored + Ludibriador · mecânicas da arena
-- Modo de aplicação: em um banco com ae_document e funções base já instaladas.
-- A ficha permanece no banco da plataforma; este arquivo documenta as alterações.
-- Liberação controlada da Máscara, Descontrole alternado e Shikai Sakanade.

CREATE OR REPLACE FUNCTION public.ae_shinji_inversion_steps(p_sheet_id text, p_skill text)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE tgt jsonb;src jsonb;ptr jsonb;scene_no integer;steps integer:=0;
BEGIN
 SELECT x.value INTO tgt FROM public.ae_document d,jsonb_array_elements(d.data->'sheets') x(value)
 WHERE d.id=1 AND x.value->>'id'=p_sheet_id LIMIT 1;
 IF tgt IS NULL OR p_skill NOT IN ('Vigor','Fortitude','Destreza','Atenção','Precisão','Determinação',
 'Instinto','Lábia','Liberação','Manipulação','Presença','Tática')
 THEN RETURN 0;END IF;
 ptr=tgt->'combat'->'shinjiInversion';
 IF ptr IS NULL THEN RETURN 0;END IF;
 scene_no=coalesce((ptr->>'scene')::integer,-1);
 IF scene_no<1 THEN RETURN 0;END IF;
 SELECT x.value INTO src FROM public.ae_document d,jsonb_array_elements(d.data->'sheets') x(value)
 WHERE d.id=1 AND x.value->>'id'='arquivo-shinji-hirako-arena-n3' LIMIT 1;
 IF src IS NULL OR coalesce((src->'combat'->>'scene')::integer,1)<>scene_no
 OR NOT coalesce((src->'abilityRuntime'->'shinji'->>'shikaiActive')::boolean,false)
 OR NOT coalesce((src->'abilityRuntime'->'billing'->'shinji-sakanade-liberar'->>'active')::boolean,false)
 OR coalesce((src->'abilityRuntime'->'billing'->'shinji-sakanade-liberar'->>'scene')::integer,-1)<>scene_no
 THEN RETURN 0; END IF;
 steps=-1;
 IF p_skill IN ('Fortitude','Destreza','Atenção','Determinação','Instinto') AND
    coalesce((tgt->'combat'->'shinjiDefensePending'->>'scene')::integer,-1)=scene_no AND
    coalesce((tgt->'combat'->'shinjiDefensePending'->>'round')::integer,-1)=
      coalesce((src->'combat'->>'round')::integer,1)
 THEN steps=steps-1;END IF;
 RETURN steps;
END;$function$
;

CREATE OR REPLACE FUNCTION public.ae_shinji_action(p_action text, p_target_id text DEFAULT NULL::text, p_npc_name text DEFAULT NULL::text, p_npc_stats jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 k public.ae_keys%ROWTYPE;
 doc jsonb;src jsonb;tgt jsonb;ab jsonb;preview jsonb;rt jsonb;state jsonb;
 targets jsonb;entry jsonb;stats jsonb;history jsonb;ev jsonb;result jsonb;
 all_sheets jsonb;changed boolean:=false;is_npc boolean:=false;is_target boolean:=false;
 scene_no integer;round_no integer;ix integer;cost integer:=0;attack integer:=0;defense integer:=0;
 sgroup text;sskill text;tgroup text;tskill text;sg integer;sd integer;tg integer;td integer;damage integer:=0;
 transformed jsonb;def_transformed jsonb;target_key text;target_name text;now_life integer;rev bigint;
 action_id text;shikai_on boolean;mask_on boolean;inverted boolean:=false;main_action boolean:=false;
 reaction_action boolean:=false;mask_end integer;mask_mode text;stolen_skill text;crit text:='';
BEGIN
 IF p_action NOT IN ('mask_control','mask_chaos','mask_end','release','release_end',
 'cero','predator','fear','invert','shift','slash','strike','resonance') THEN
  RAISE EXCEPTION 'Técnica do Shinji inválida.';
 END IF;
 SELECT ky.* INTO k FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys ky ON ky.id=se.key_id AND ky.active
 WHERE se.user_id=auth.uid() LIMIT 1;
 IF k.id IS NULL OR k.kind NOT IN ('master','player') THEN RAISE EXCEPTION 'Entre como jogador ou mestre.';END IF;
 SELECT data INTO doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 SELECT s.value INTO src FROM jsonb_array_elements(doc->'sheets') s(value)
 WHERE s.value->>'id'='arquivo-shinji-hirako-arena-n3' LIMIT 1;
 IF src IS NULL THEN RAISE EXCEPTION 'Ficha de Shinji não encontrada.';END IF;
 IF k.kind='player' AND NOT public.ae_sheet_linked(src,k.id,k.sheet_id) THEN
  RAISE EXCEPTION 'Ficha não vinculada à sua chave.';END IF;
 IF (src->>'race')<>'Visored' OR (src->>'className')<>'Ludibriador'
 THEN RAISE EXCEPTION 'Configuração de Shinji inválida.';END IF;
 scene_no=coalesce((src->'combat'->>'scene')::integer,1);
 round_no=coalesce((src->'combat'->>'round')::integer,1);
 rt=coalesce(src->'abilityRuntime','{}'::jsonb);
 state=coalesce(rt->'shinji','{}'::jsonb);
 IF coalesce((state->>'scene')::integer,-1)<>scene_no THEN
  state=jsonb_build_object('scene',scene_no,'shikaiActive',false,
   'targets','{}'::jsonb,'history','[]'::jsonb);
 END IF;
 targets=coalesce(state->'targets','{}'::jsonb);
 mask_end=coalesce((src->'combat'->>'shinjiMaskEndRound')::integer,0);
 mask_on=coalesce((src->'combat'->>'hollowActive')::boolean,false)
  AND mask_end>=round_no AND mask_end>0;
 IF NOT mask_on AND coalesce((src->'combat'->>'hollowActive')::boolean,false) THEN
  src=jsonb_set(src,'{combat,hollowActive}','false'::jsonb,true);
 END IF;
 shikai_on=coalesce((state->>'shikaiActive')::boolean,false)
  AND coalesce((rt->'billing'->'shinji-sakanade-liberar'->>'scene')::integer,-1)=scene_no
  AND coalesce((rt->'billing'->'shinji-sakanade-liberar'->>'active')::boolean,false);
 mask_mode=coalesce(src->'combat'->>'shinjiMaskMode','');
 -- A manifestação voluntária é declarada pelo jogador antes da alternância.
 IF mask_on AND mask_mode='chaos' AND p_action<>'mask_end' THEN
  IF round_no%2=1 AND k.kind<>'master' THEN
   RAISE EXCEPTION 'Descontrole: nas rodadas ímpares, o mestre controla Shinji.';
  END IF;
  IF round_no%2=0 AND k.kind<>'player'
   AND NOT (k.kind='master' AND coalesce(src->>'ownerKeyId','')=''
    AND jsonb_array_length(coalesce(src->'linkedKeyIds','[]'::jsonb))=0) THEN
   RAISE EXCEPTION 'Descontrole: nas rodadas pares, o jogador controla Shinji.';
  END IF;
 END IF;
 IF coalesce((src->'resources'->'vida'->>'current')::numeric,0)<=0 OR
  coalesce((src->'resources'->'alma'->>'current')::numeric,0)<=0 OR
  EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(src->'conditions','[]'::jsonb)) x(v)
   WHERE lower(x.v) IN ('morto','desmaiado'))
 THEN RAISE EXCEPTION 'Shinji está incapacitado.';END IF;
 main_action=p_action IN ('mask_control','mask_chaos','release','cero','fear','invert','slash','strike','resonance');
 reaction_action=p_action='shift';
 IF main_action AND coalesce((src->'combat'->>'mainUsed')::boolean,false) THEN
  RAISE EXCEPTION 'Ação principal já utilizada nesta rodada.';END IF;
 IF reaction_action AND coalesce((src->'combat'->>'reactionUsed')::boolean,false) THEN
  RAISE EXCEPTION 'Reação já utilizada nesta rodada.';END IF;
 IF reaction_action AND coalesce((src->'combat'->>'rhythmRestriction')::integer,0)>=2 THEN
  RAISE EXCEPTION 'Reação indisponível.';END IF;

 is_target=p_action IN ('cero','fear','invert','shift','slash','strike','resonance');
 IF is_target THEN
  IF p_target_id IS NULL OR p_target_id='' THEN RAISE EXCEPTION 'Escolha um alvo.';END IF;
  is_npc=p_target_id='npc' OR left(p_target_id,4)='npc:';
  IF is_npc THEN
   target_name=btrim(coalesce(p_npc_name,''));
   IF length(target_name) NOT BETWEEN 1 AND 80 OR target_name~'[<>]'
   THEN RAISE EXCEPTION 'Nome do NPC inválido.';END IF;
   target_key='npc:'||md5(lower(target_name));
   stats=coalesce(p_npc_stats,'{}'::jsonb);
   IF jsonb_typeof(stats)<>'object' OR
     coalesce(stats->>'corpo','6')!~'^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'mente','6')!~'^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'destreza','6')!~'^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'determinacao','6')!~'^(4|6|8|10|12|20)$' OR
     coalesce(stats->>'vida','24')!~'^[0-9]{1,3}$'
   THEN RAISE EXCEPTION 'Dados inválidos para o NPC.';END IF;
   stats=jsonb_build_object('corpo',(coalesce(stats->>'corpo','6'))::integer,
    'mente',(coalesce(stats->>'mente','6'))::integer,
    'destreza',(coalesce(stats->>'destreza','6'))::integer,
    'determinacao',(coalesce(stats->>'determinacao','6'))::integer,
    'vida',(coalesce(stats->>'vida','24'))::integer);
   entry=coalesce(targets->target_key,'{}'::jsonb);
   IF NOT targets ? target_key AND
    (SELECT count(*) FROM jsonb_object_keys(targets))>=35 THEN
    RAISE EXCEPTION 'Limite de 35 NPCs por cena.';END IF;
   now_life=coalesce((entry->>'life')::integer,(stats->>'vida')::integer);
   tgt=jsonb_build_object('name',target_name,
    'groups',jsonb_build_object('Corpo',(stats->>'corpo')::integer,'Mente',(stats->>'mente')::integer),
    'skills',jsonb_build_object('Destreza',(stats->>'destreza')::integer,
    'Determinação',(stats->>'determinacao')::integer),
    'resources',jsonb_build_object('vida',jsonb_build_object('current',now_life)));
   inverted=coalesce((entry->>'inverted')::boolean,false) AND shikai_on;
  ELSE
   target_key=p_target_id;
   IF target_key='arquivo-shinji-hirako-arena-n3' THEN RAISE EXCEPTION 'Escolha um adversário.';END IF;
   SELECT s.value INTO tgt FROM jsonb_array_elements(doc->'sheets') s(value)
   WHERE s.value->>'id'=target_key LIMIT 1;
   IF tgt IS NULL THEN RAISE EXCEPTION 'Alvo não encontrado.';END IF;
   IF k.kind='player' THEN
    IF coalesce((tgt->>'masterOnly')::boolean,false) THEN RAISE EXCEPTION 'Alvo exclusivo do mestre.';END IF;
    IF NOT EXISTS(
      SELECT 1 FROM public.ae_live_participants pa
      JOIN public.ae_live_participants pb ON pb.session_id=pa.session_id
      JOIN public.ae_live_sessions ls ON ls.id=pa.session_id AND ls.status='open'
      WHERE pa.sheet_id='arquivo-shinji-hirako-arena-n3' AND pb.sheet_id=target_key
       AND pa.left_at IS NULL AND pa.removed_at IS NULL
       AND pb.left_at IS NULL AND pb.removed_at IS NULL)
    THEN RAISE EXCEPTION 'Alvo fora da sessão ativa.';END IF;
   END IF;
   inverted=shikai_on
     AND coalesce((tgt->'combat'->'shinjiInversion'->>'scene')::integer,-1)=scene_no
     AND tgt->'combat'->'shinjiInversion'->>'sourceId'='arquivo-shinji-hirako-arena-n3';
   entry=coalesce(targets->target_key,'{}'::jsonb);
  END IF;
 ELSE
  target_key='';target_name='';
 END IF;
 IF p_action='mask_end' AND NOT mask_on THEN RAISE EXCEPTION 'Máscara não está ativa.';END IF;
 IF p_action='release_end' AND NOT shikai_on THEN RAISE EXCEPTION 'Sakanade já está selada.';END IF;
 IF p_action IN ('mask_control','mask_chaos') THEN
  IF mask_on OR coalesce((src->'combat'->>'hollowLost')::boolean,false) THEN
   RAISE EXCEPTION 'Máscara já ativa ou rompida. Recupere o controle primeiro.';END IF;
  IF p_action='mask_control' AND (src->>'level')::integer<3 THEN
   RAISE EXCEPTION 'Máscara controlada exige nível 3.';END IF;
 ELSIF p_action IN ('cero','predator','fear','resonance') AND NOT mask_on THEN
  RAISE EXCEPTION 'Manifeste a Máscara Hollow primeiro.';
 ELSIF p_action IN ('invert','shift','slash','strike') AND NOT shikai_on THEN
  RAISE EXCEPTION 'Libere Sakanade primeiro.';
 ELSIF p_action='release' AND shikai_on THEN
  RAISE EXCEPTION 'Sakanade já está liberada.';
 END IF;
 IF p_action IN ('shift','slash') AND NOT inverted THEN
  RAISE EXCEPTION 'Essa técnica exige um alvo Invertido.';END IF;
 IF p_action='predator' AND
   coalesce((rt->'billing'->'shinji-shunpo'->>'scene')::integer,-1)<>scene_no
   AND coalesce((rt->'billing'->'shinji-shunpo'->>'lastRound')::integer,-1)<>round_no
 THEN RAISE EXCEPTION 'Utilize Shunpō antes de Passo Predatório.';END IF;
 IF p_action='predator' AND NOT(
  coalesce((rt->'billing'->'shinji-shunpo'->>'scene')::integer,-1)=scene_no
  AND coalesce((rt->'billing'->'shinji-shunpo'->>'lastRound')::integer,-1)=round_no
 ) THEN RAISE EXCEPTION 'Utilize Shunpō nesta rodada antes do Passo Predatório.';END IF;

 action_id=CASE p_action
  WHEN 'mask_control' THEN 'shinji-mascara-hollow' WHEN 'mask_chaos' THEN 'shinji-mascara-hollow'
  WHEN 'release' THEN 'shinji-sakanade-liberar'
  WHEN 'cero' THEN 'shinji-hollow-cero'
  WHEN 'predator' THEN 'shinji-hollow-passo-predatorio'
  WHEN 'fear' THEN 'shinji-hollow-pressao-instintiva'
  WHEN 'invert' THEN 'shinji-sakanade-mundo-invertido'
  WHEN 'shift' THEN 'shinji-sakanade-troca-eixos'
  WHEN 'slash' THEN 'shinji-sakanade-corte-avesso'
  WHEN 'resonance' THEN 'shinji-ressonancia-hollow' ELSE NULL END;
 IF action_id IS NOT NULL THEN
  SELECT a.value,(a.ord-1)::integer INTO ab,ix
  FROM jsonb_array_elements(src->'abilities') WITH ORDINALITY a(value,ord)
  WHERE a.value->>'abilityId'=action_id LIMIT 1;
  IF ab IS NULL THEN RAISE EXCEPTION 'Técnica não encontrada na ficha.';END IF;
  IF p_action='mask_chaos' THEN
   IF coalesce((rt->'billing'->action_id->>'scene')::integer,-1)=scene_no AND
     coalesce((rt->'billing'->action_id->>'uses')::integer,0)>0 THEN
    RAISE EXCEPTION 'Máscara Hollow já utilizada nesta cena.';END IF;
   preview=jsonb_build_object('cost',4,'mode','use','limit','scene',
     'key',action_id,'scene',scene_no,'round',round_no,
     'uses',0,'usesRound',0,'effectCondition','');
  ELSE preview=public.ae_ability_cost_preview(src,ab,ix);END IF;
  cost=(preview->>'cost')::integer;
  IF coalesce((src->'resources'->'alma'->>'current')::numeric,0)<cost THEN
   RAISE EXCEPTION 'Alma insuficiente.';END IF;
 END IF;
 -- Resolva o conflito e as transformações antes de cobrar.
 IF p_action IN ('cero','fear','invert','slash','strike','resonance') THEN
  sskill=CASE p_action WHEN 'cero' THEN 'Liberação' WHEN 'fear' THEN 'Presença'
   WHEN 'invert' THEN 'Manipulação' WHEN 'slash' THEN 'Precisão'
   WHEN 'strike' THEN 'Precisão' WHEN 'resonance' THEN 'Precisão' END;
  sgroup=CASE WHEN sskill IN ('Liberação','Presença','Manipulação') THEN 'Espírito' ELSE 'Corpo' END;
  tskill=CASE WHEN p_action IN ('fear','invert') THEN 'Determinação' ELSE 'Destreza' END;
  tgroup=CASE WHEN tskill='Determinação' THEN 'Mente' ELSE 'Corpo' END;
  sg=(src->'groups'->>sgroup)::integer;sd=(src->'skills'->>sskill)::integer;
  sd=public.ae_book_skill_die('arquivo-shinji-hirako-arena-n3',sskill,sd);
  IF sd<>0 THEN sd=public.ae_die_step(sd,
    public.ae_ability_step_bonus(src,sskill,sgroup)+CASE WHEN p_action='slash' THEN 1
    WHEN p_action='resonance' THEN 2 ELSE 0 END);END IF;
  transformed=public.ae_transform_test(
    CASE WHEN sd=0 THEN jsonb_build_array(
      jsonb_build_object('sides',sg,'value',public.ae_random_die(sg)))
     ELSE jsonb_build_array(
      jsonb_build_object('sides',sg,'value',public.ae_random_die(sg)),
      jsonb_build_object('sides',sd,'value',public.ae_random_die(sd))) END,
    coalesce((src->'combat'->>'fearDie')::integer,0),mask_on,
    coalesce((src->'combat'->>'nextBonusDie')::integer,0));
  attack=(transformed->>'total')::integer;
  src=public.ae_apply_test_state(src,transformed);
  src=public.ae_ability_consume_next(src,sskill,sgroup);
  crit=coalesce(transformed->>'special','');
  tg=(tgt->'groups'->>tgroup)::integer;td=(tgt->'skills'->>tskill)::integer;
  IF NOT is_npc THEN
   td=public.ae_book_skill_die(target_key,tskill,td);
   IF td<>0 THEN td=public.ae_die_step(td,
      public.ae_ability_step_bonus(tgt,tskill,tgroup)+public.ae_shinji_inversion_steps(target_key,tskill));END IF;
  ELSIF inverted THEN
   td=public.ae_die_step(td,-1-CASE WHEN tskill='Destreza' AND
      coalesce((entry->>'shiftRound')::integer,-1)=round_no THEN 1 ELSE 0 END);
  END IF;
  IF NOT is_npc AND coalesce((tgt->'combat'->'shinjiDefensePending'->>'round')::integer,-1)=round_no
   AND coalesce((tgt->'combat'->'shinjiDefensePending'->>'scene')::integer,-1)=scene_no THEN
   tgt=tgt#-'{combat,shinjiDefensePending}';
  ELSIF is_npc AND (entry ? 'shiftRound') THEN
   entry=entry-'shiftRound';
  END IF;
  def_transformed=public.ae_transform_test(
    CASE WHEN td=0 THEN jsonb_build_array(
      jsonb_build_object('sides',tg,'value',public.ae_random_die(tg)))
     ELSE jsonb_build_array(
      jsonb_build_object('sides',tg,'value',public.ae_random_die(tg)),
      jsonb_build_object('sides',td,'value',public.ae_random_die(td))) END,
    CASE WHEN is_npc THEN 0 ELSE coalesce((tgt->'combat'->>'fearDie')::integer,0) END,
    CASE WHEN is_npc THEN false ELSE coalesce((tgt->'combat'->>'hollowActive')::boolean,false) END,
    CASE WHEN is_npc THEN 0 ELSE coalesce((tgt->'combat'->>'nextBonusDie')::integer,0) END);
  defense=(def_transformed->>'total')::integer;
  IF NOT is_npc THEN tgt=public.ae_apply_test_state(tgt,def_transformed);END IF;
  changed=attack>defense;
  IF changed AND p_action IN ('cero','slash','strike','resonance') THEN
   damage=CASE p_action WHEN 'cero' THEN public.ae_random_die(8)+public.ae_random_die(8)
    WHEN 'slash' THEN public.ae_random_die(6)+public.ae_random_die(6)
    ELSE public.ae_random_die(8) END;
   tgt=jsonb_set(tgt,'{resources,vida,current}',
      to_jsonb(greatest(0,coalesce((tgt->'resources'->'vida'->>'current')::integer,0)-damage)),true);
   IF NOT is_npc AND coalesce((tgt->'resources'->'vida'->>'current')::integer,0)=0 AND
     NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(tgt->'conditions','[]'::jsonb)) c(v)
       WHERE lower(c.v)='desmaiado') THEN
     tgt=jsonb_set(tgt,'{conditions}',coalesce(tgt->'conditions','[]'::jsonb)||to_jsonb('Desmaiado'::text),true);
   END IF;
  END IF;
  IF changed AND p_action='fear' THEN
   IF is_npc THEN entry=entry||jsonb_build_object('fearRound',round_no);
   ELSE
    tgt=jsonb_set(tgt,'{combat,fearDie}',to_jsonb(6),true);
    tgt=jsonb_set(tgt,'{combat,shinjiFearExpire}',jsonb_build_object('scene',coalesce((tgt->'combat'->>'scene')::integer,1),'round',coalesce((tgt->'combat'->>'round')::integer,1)),true);
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(tgt->'conditions','[]'::jsonb)) c(v)
       WHERE lower(c.v)='amedrontado') THEN
     tgt=jsonb_set(tgt,'{conditions}',coalesce(tgt->'conditions','[]'::jsonb)||to_jsonb('Amedrontado'::text),true);
    END IF;
   END IF;
  END IF;
  IF changed AND p_action='invert' THEN
   inverted=true;
   IF is_npc THEN entry=entry||jsonb_build_object('inverted',true);
   ELSE
    tgt=jsonb_set(tgt,'{combat,shinjiInversion}',
     jsonb_build_object('scene',scene_no,'sourceId','arquivo-shinji-hirako-arena-n3'),true);
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(tgt->'conditions','[]'::jsonb)) c(v)
     WHERE lower(c.v)='invertido') THEN
     tgt=jsonb_set(tgt,'{conditions}',coalesce(tgt->'conditions','[]'::jsonb)||to_jsonb('Invertido'::text),true);
    END IF;
   END IF;
  END IF;
 ELSIF p_action='shift' THEN
  changed=true;
  IF is_npc THEN entry=entry||jsonb_build_object('shiftRound',round_no);
  ELSE tgt=jsonb_set(tgt,'{combat,shinjiDefensePending}',
    jsonb_build_object('scene',scene_no,'round',round_no),true);END IF;
 END IF;
 IF p_action='mask_control' OR p_action='mask_chaos' THEN
  changed=true;
  src=jsonb_set(src,'{combat,hollowActive}','true'::jsonb,true);
  src=jsonb_set(src,'{combat,hollowLost}','false'::jsonb,true);
  src=jsonb_set(src,'{combat,shinjiMaskEndRound}',to_jsonb(round_no+1),true);
  src=jsonb_set(src,'{combat,shinjiMaskMode}',to_jsonb(CASE WHEN p_action='mask_chaos' THEN 'chaos' ELSE 'control' END),true);
 ELSIF p_action='mask_end' THEN
  changed=true;
  src=jsonb_set(src,'{combat,hollowActive}','false'::jsonb,true);
  src=jsonb_set(src,'{combat,shinjiMaskMode}',to_jsonb(''::text),true);
 ELSIF p_action='release' THEN
  changed=true;
  state=state||jsonb_build_object('shikaiActive',true);
 ELSIF p_action='release_end' THEN
  changed=true;
  state=state||jsonb_build_object('shikaiActive',false);
  -- Encerrar a Shikai encerra as inversões registradas nesta ficha.
  targets=(SELECT coalesce(jsonb_object_agg(k,CASE WHEN v ? 'inverted' THEN v||jsonb_build_object('inverted',false) ELSE v END),'{}'::jsonb)
      FROM jsonb_each(targets) x(k,v));
  src=jsonb_set(src,'{abilityRuntime,billing,shinji-sakanade-liberar,active}','false'::jsonb,true);
 ELSIF p_action='predator' THEN changed=true;
 ELSIF p_action='resonance' THEN
  src=jsonb_set(src,'{combat,hollowActive}','false'::jsonb,true);
  src=jsonb_set(src,'{combat,shinjiMaskMode}',to_jsonb(''::text),true);
 END IF;
 IF is_target AND is_npc THEN
  entry=entry||jsonb_build_object('name',target_name,'npc',true,'npcStats',stats,
    'life',coalesce((tgt->'resources'->'vida'->>'current')::integer,0),
    'lastAction',p_action,'lastSuccess',changed,'lastDamage',damage);
  targets=targets||jsonb_build_object(target_key,entry);
 ELSIF is_target AND NOT is_npc THEN
  entry=entry||jsonb_build_object('name',tgt->>'name','npc',false,
   'lastAction',p_action,'lastSuccess',changed,'lastDamage',damage,
   'inverted',inverted);
  targets=targets||jsonb_build_object(target_key,entry);
 END IF;
 history=coalesce(state->'history','[]'::jsonb);
 ev=jsonb_build_object('action',p_action,'targetId',target_key,'name',target_name,
   'success',changed,'attack',attack,'defense',defense,'damage',damage,'round',round_no,
   'effect',transformed->'effect','defenseEffect',def_transformed->'effect');
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ord),'[]'::jsonb) INTO history
 FROM jsonb_array_elements(history||jsonb_build_array(ev)) WITH ORDINALITY x(value,ord)
 WHERE x.ord>greatest(0,jsonb_array_length(history)+1-12);
 state=state||jsonb_build_object('scene',scene_no,'targets',targets,'history',history);
 src=jsonb_set(src,'{abilityRuntime}',coalesce(src->'abilityRuntime','{}'::jsonb)||jsonb_build_object('shinji',state),true);
 IF action_id IS NOT NULL THEN
  src=public.ae_ability_cost_commit(src,ab,preview);
  IF p_action='predator' THEN src=public.ae_ability_arm(src,ab);END IF;
  src=jsonb_set(src,'{resources,alma,current}',
    to_jsonb((src->'resources'->'alma'->>'current')::numeric-cost),true);
 END IF;
 IF main_action THEN src=jsonb_set(src,'{combat,mainUsed}','true'::jsonb,true);END IF;
 IF reaction_action THEN src=jsonb_set(src,'{combat,reactionUsed}','true'::jsonb,true);END IF;
 IF coalesce((src->'resources'->'alma'->>'current')::numeric,0)=0 THEN
  src=jsonb_set(src,'{combat,almaExhaustion}','true'::jsonb,true);
 END IF;
 SELECT jsonb_agg(CASE WHEN x.value->>'id'='arquivo-shinji-hirako-arena-n3' THEN src
  WHEN is_target AND NOT is_npc AND x.value->>'id'=target_key THEN tgt
  WHEN p_action='release_end' AND x.value->'combat'->'shinjiInversion'->>'sourceId'='arquivo-shinji-hirako-arena-n3'
    THEN jsonb_set(x.value#-'{combat,shinjiInversion}','{conditions}',
       coalesce((SELECT jsonb_agg(c.value ORDER BY c.ord)
         FROM jsonb_array_elements(coalesce(x.value->'conditions','[]'::jsonb)) WITH ORDINALITY c(value,ord)
         WHERE lower(c.value#>>'{}')<>'invertido'),'[]'::jsonb),true)
  ELSE x.value END ORDER BY x.ord)
 INTO all_sheets FROM jsonb_array_elements(doc->'sheets') WITH ORDINALITY x(value,ord);
 UPDATE public.ae_document SET data=jsonb_set(doc,'{sheets}',all_sheets,true),
  revision=revision+1,changed_at=now() WHERE id=1 RETURNING revision INTO rev;
 RETURN jsonb_build_object('action',p_action,'success',changed,'attack',attack,
  'defense',defense,'damage',damage,'targetId',target_key,'targetName',coalesce(tgt->>'name',target_name),
  'npc',is_npc,'alma',(src->'resources'->'alma'->>'current')::numeric,
  'maskActive',(src->'combat'->>'hollowActive')::boolean,
  'shikaiActive',coalesce((state->>'shikaiActive')::boolean,false),
  'maskMode',src->'combat'->>'shinjiMaskMode',
  'maskEndRound',src->'combat'->'shinjiMaskEndRound',
  'inverted',inverted,'life',CASE WHEN is_target THEN tgt->'resources'->'vida'->'current' ELSE NULL END,
  'effect',transformed->'effect','defenseEffect',def_transformed->'effect',
  'revision',rev);
END;$function$
;

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
 IF v_sheet->>'id'='arquivo-shinji-hirako-arena-n3'
  AND coalesce((v_sheet->'combat'->>'hollowActive')::boolean,false)
  AND coalesce((v_sheet->'combat'->>'shinjiMaskEndRound')::integer,0)>=coalesce((v_sheet->'combat'->>'round')::integer,1)
  AND v_sheet->'combat'->>'shinjiMaskMode'='chaos'
 THEN
  IF coalesce((v_sheet->'combat'->>'round')::integer,1)%2=1 AND v_key.kind<>'master'
   THEN RAISE EXCEPTION 'Descontrole: rodada ímpar é controlada pelo mestre.';END IF;
  IF coalesce((v_sheet->'combat'->>'round')::integer,1)%2=0 AND v_key.kind<>'player'
    AND NOT (v_key.kind='master' AND coalesce(v_sheet->>'ownerKeyId','')=''
     AND jsonb_array_length(coalesce(v_sheet->'linkedKeyIds','[]'::jsonb))=0)
   THEN RAISE EXCEPTION 'Descontrole: rodada par é controlada pelo jogador.';END IF;
 END IF;

 v_group=case when p_skill=any(array['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão']) then 'Corpo'
 when p_skill=any(array['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia']) then 'Mente'
 when p_skill=any(array['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']) then 'Espírito' else null end;
 if v_group is null then raise exception 'Perícia inválida.';end if;
 v_g=(v_sheet->'groups'->>v_group)::integer;v_d=(v_sheet->'skills'->>p_skill)::integer;
 if v_g not in (4,6,8,10,12,20) or v_d not in (4,6,8,10,12,20) then raise exception 'Dados da ficha inválidos.';end if;
 v_d=public.ae_book_skill_die(p_sheet_id,p_skill,v_d);IF v_d<>0 THEN v_d=public.ae_die_step(v_d,public.ae_ability_step_bonus(v_sheet,p_skill,v_group)+public.ae_shinji_inversion_steps(p_sheet_id,p_skill));END IF;v_1=public.ae_random_die(v_g);v_2=CASE WHEN v_d=0 THEN 0 ELSE public.ae_random_die(v_d) END;
 v_effect=public.ae_transform_test(
   CASE WHEN v_d=0 THEN jsonb_build_array(jsonb_build_object('sides',v_g,'value',v_1)) ELSE jsonb_build_array(jsonb_build_object('sides',v_g,'value',v_1),jsonb_build_object('sides',v_d,'value',v_2)) END,
   coalesce((v_sheet->'combat'->>'fearDie')::integer,0),
   (coalesce((v_sheet->'combat'->>'hollowActive')::boolean,false) AND
    (p_sheet_id<>'arquivo-shinji-hirako-arena-n3' OR
     coalesce((v_sheet->'combat'->>'shinjiMaskEndRound')::integer,0)>=coalesce((v_sheet->'combat'->>'round')::integer,1))),
   coalesce((v_sheet->'combat'->>'nextBonusDie')::integer,0));
 v_total=(v_effect->>'total')::integer;v_special=v_effect->>'special';
 v_before=v_sheet;v_sheet=public.ae_apply_test_state(v_sheet,v_effect);v_sheet=public.ae_ability_consume_next(v_sheet,p_skill,v_group);
 IF p_skill IN ('Fortitude','Destreza','Atenção','Determinação','Instinto')
  AND v_sheet->'combat'->'shinjiDefensePending' IS NOT NULL
 THEN v_sheet=v_sheet#-'{combat,shinjiDefensePending}';END IF;

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
 
 IF v_sheet->>'id'='arquivo-shinji-hirako-arena-n3'
  AND coalesce((v_sheet->'combat'->>'hollowActive')::boolean,false)
  AND coalesce((v_sheet->'combat'->>'shinjiMaskEndRound')::integer,0)>=coalesce((v_sheet->'combat'->>'round')::integer,1)
  AND v_sheet->'combat'->>'shinjiMaskMode'='chaos'
 THEN
  IF coalesce((v_sheet->'combat'->>'round')::integer,1)%2=1 AND v_key.kind<>'master'
   THEN RAISE EXCEPTION 'Descontrole: rodada ímpar é controlada pelo mestre.';END IF;
  IF coalesce((v_sheet->'combat'->>'round')::integer,1)%2=0 AND v_key.kind<>'player'
    AND NOT (v_key.kind='master' AND coalesce(v_sheet->>'ownerKeyId','')=''
     AND jsonb_array_length(coalesce(v_sheet->'linkedKeyIds','[]'::jsonb))=0)
   THEN RAISE EXCEPTION 'Descontrole: rodada par é controlada pelo jogador.';END IF;
 END IF;
 IF jsonb_typeof(v_sheet->'abilities') IS DISTINCT FROM 'array'
    OR p_ability_index>=jsonb_array_length(v_sheet->'abilities') THEN
  RAISE EXCEPTION 'Habilidade não encontrada.';
 END IF;
 v_ability=v_sheet->'abilities'->p_ability_index; IF coalesce((v_ability->>'passive')::boolean,false) OR coalesce(v_ability->>'category','')='passive' THEN RAISE EXCEPTION 'Habilidade passiva não pode ser ativada.'; END IF;
 IF jsonb_typeof(v_ability) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Habilidade inválida.'; END IF;
 IF v_ability->>'abilityId' IN ('tsukishima-inserir-presenca','tsukishima-vire-pagina') THEN RAISE EXCEPTION 'Utilize os controles automáticos de Book of the End.'; END IF;
 IF v_sheet->>'id'='arquivo-shinji-hirako-arena-n3' AND
   v_ability->>'abilityId' IN ('shinji-mascara-hollow','shinji-ressonancia-hollow',
   'shinji-hollow-cero','shinji-hollow-passo-predatorio','shinji-hollow-pressao-instintiva',
   'shinji-sakanade-liberar','shinji-sakanade-mundo-invertido',
   'shinji-sakanade-troca-eixos','shinji-sakanade-corte-avesso')
 THEN RAISE EXCEPTION 'Utilize o painel de Hollowficação e Sakanade.';END IF;
 IF p_sheet_id='arquivo-shinji-hirako-arena-n3' AND v_ability->>'abilityId'='shinji-shunpo'
 AND coalesce((v_sheet->'combat'->>'reactionUsed')::boolean,false)
 THEN RAISE EXCEPTION 'Shunpō exige uma reação disponível.';END IF;
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
   v_skill_die=(v_sheet->'skills'->>v_skill)::integer;v_skill_die=public.ae_book_skill_die(p_sheet_id,v_skill,v_skill_die);IF v_skill_die<>0 THEN v_skill_die=public.ae_die_step(v_skill_die,public.ae_ability_step_bonus(v_sheet,v_skill,v_group)+public.ae_shinji_inversion_steps(p_sheet_id,v_skill));END IF;
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
   (coalesce((v_sheet->'combat'->>'hollowActive')::boolean,false) AND
    (p_sheet_id<>'arquivo-shinji-hirako-arena-n3' OR
     coalesce((v_sheet->'combat'->>'shinjiMaskEndRound')::integer,0)>=coalesce((v_sheet->'combat'->>'round')::integer,1))),
   coalesce((v_sheet->'combat'->>'nextBonusDie')::integer,0)) INTO v_eval;
  v_dice=v_eval->'dice';
  IF coalesce((v_eval->>'usedBonus')::boolean,false) THEN v_colors=v_colors||jsonb_build_array('#E8C56D');END IF;
  v_sheet=public.ae_apply_test_state(v_sheet,v_eval);IF v_skill IS NOT NULL THEN
    v_sheet=public.ae_ability_consume_next(v_sheet,v_skill,v_group);
    IF v_skill IN ('Fortitude','Destreza','Atenção','Determinação','Instinto')
     AND v_sheet->'combat'->'shinjiDefensePending' IS NOT NULL
    THEN v_sheet=v_sheet#-'{combat,shinjiDefensePending}'; END IF;
   END IF;

  v_total=(v_eval->>'total')::integer;
  v_special=v_eval->>'special';
 END IF;

 v_alma=v_alma-v_cost;v_sheet=public.ae_ability_arm(v_sheet,v_ability);v_sheet=public.ae_ability_cost_commit(v_sheet,v_ability,v_cost_preview);
 v_sheet=jsonb_set(v_sheet,'{resources,alma,current}',to_jsonb(v_alma),true);
 IF p_sheet_id='arquivo-shinji-hirako-arena-n3' AND v_ability->>'abilityId'='shinji-shunpo'
 THEN v_sheet=jsonb_set(v_sheet,'{combat,reactionUsed}','true'::jsonb,true);END IF;
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

REVOKE ALL ON FUNCTION public.ae_shinji_inversion_steps(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ae_shinji_action(text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ae_shinji_action(text,text,text,jsonb) TO authenticated;

-- Complementa a ficha pré-existente somente se a Shikai ainda não estiver cadastrada.
WITH rewritten AS (
 SELECT jsonb_agg(CASE WHEN s.value->>'id'='arquivo-shinji-hirako-arena-n3'
  AND NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(s.value->'abilities','[]'::jsonb)) a(value)
   WHERE a.value->>'abilityId'='shinji-sakanade-liberar'
  )
 THEN jsonb_set(
    jsonb_set(s.value,'{abilities}',
      coalesce(s.value->'abilities','[]'::jsonb)||'[{"cost":5,"name":"(Hollowficação) Cero","noTest":true,"fxColor":"#DA627E","groupId":"shinji-hirako-hollow","passive":false,"category":"active","minLevel":3,"abilityId":"shinji-hollow-cero","costConfig":{"mode":"use","limit":"scene"},"description":"Uma vez por Hollowficação, utilize sua ação principal para disparar uma rajada de energia espiritual contra um adversário a até 20 metros. Realize um teste-clash de Liberação contra Destreza. Se vencer, causa 2d8 de dano à Vida."},{"cost":2,"name":"(Hollowficação) Passo Predatório","noTest":true,"fxColor":"#DA627E","groupId":"shinji-hirako-hollow","passive":false,"category":"active","minLevel":3,"abilityId":"shinji-hollow-passo-predatorio","automation":{"id":"shinji-predator-precisao","key":"Precisão","kind":"step","scope":"next","steps":1,"target":"skill"},"costConfig":{"mode":"use","limit":"round"},"description":"Uma vez por rodada, enquanto estiver em Hollowficação, ao utilizar Shunpō, você pode aumentar em um passo seu dado de Precisão no próximo ataque corpo a corpo realizado até o próximo Desfecho."},{"cost":3,"name":"(Hollowficação) Pressão Instintiva","noTest":true,"fxColor":"#DA627E","groupId":"shinji-hirako-hollow","passive":false,"category":"active","minLevel":3,"abilityId":"shinji-hollow-pressao-instintiva","costConfig":{"mode":"use","limit":"scene"},"description":"Uma vez por Hollowficação, utilize sua ação principal para intimidar um adversário próximo. Realize um teste-clash de Presença contra Determinação. Se vencer, aplica um Dado de Pavor (d6) ao alvo até o próximo Desfecho."},{"cost":5,"name":"(Shikai) Desmorone, Sakanade","noTest":true,"fxColor":"#D2AFE8","groupId":"shinji-hirako-shikai","passive":false,"category":"transformation","minLevel":3,"abilityId":"shinji-sakanade-liberar","costConfig":{"mode":"activation","limit":"scene"},"description":"Utilize sua ação principal para liberar Sakanade até o fim da cena. Sua lâmina utiliza Precisão nos ataques corpo a corpo e causa 1d8 de dano à Vida. Enquanto estiver liberada, você pode utilizar as técnicas de inversão de seus sentidos."},{"cost":3,"name":"(Shikai) Sakasama no Sekai","noTest":true,"unlock":{"mode":"locked","requires":"shinji-sakanade-liberar"},"fxColor":"#D2AFE8","groupId":"shinji-hirako-shikai","passive":false,"category":"active","minLevel":3,"abilityId":"shinji-sakanade-mundo-invertido","costConfig":{"mode":"use","limit":"round","requires":"shinji-sakanade-liberar"},"description":"Uma vez por rodada, utilize sua ação principal para envolver um adversário próximo no aroma de Sakanade. Realize um teste-clash de Manipulação contra Determinação. Se vencer, o alvo fica Invertido até o fim da cena ou até a Shikai terminar, reduzindo em um passo seus dados de perícia nos ataques e defesas diretos."},{"cost":2,"name":"(Shikai) Troca de Eixos","noTest":true,"unlock":{"mode":"locked","requires":"shinji-sakanade-liberar"},"fxColor":"#D2AFE8","groupId":"shinji-hirako-shikai","passive":false,"category":"active","minLevel":3,"abilityId":"shinji-sakanade-troca-eixos","costConfig":{"mode":"use","limit":"round","requires":"shinji-sakanade-liberar"},"description":"Uma vez por rodada, quando um adversário Invertido realizar uma defesa direta, você pode utilizar sua reação para reduzir em mais um passo o dado de perícia dessa defesa. O efeito termina após a resolução do teste."},{"cost":3,"name":"(Shikai) Corte pelo Avesso","noTest":true,"unlock":{"mode":"locked","requires":"shinji-sakanade-liberar"},"fxColor":"#D2AFE8","groupId":"shinji-hirako-shikai","passive":false,"category":"active","minLevel":3,"abilityId":"shinji-sakanade-corte-avesso","costConfig":{"mode":"use","limit":"round","requires":"shinji-sakanade-liberar"},"description":"Uma vez por rodada, utilize sua ação principal para atacar um adversário Invertido com Sakanade. Aumenta em um passo seu dado de Precisão nesse ataque. Se acertar, causa 2d6 de dano à Vida."}]'::jsonb,true),
    '{abilityGroups}',coalesce(s.value->'abilityGroups','[]'::jsonb)||'[{"id":"shinji-hirako-hollow","name":"Habilidades de Hollowficação"},{"id":"shinji-hirako-shikai","name":"Habilidades da Shikai"}]'::jsonb,true)
 ELSE s.value END ORDER BY s.ord) sheets
 FROM public.ae_document d,jsonb_array_elements(d.data->'sheets') WITH ORDINALITY s(value,ord) WHERE d.id=1
)
UPDATE public.ae_document d
 SET data=jsonb_set(d.data,'{sheets}',rewritten.sheets,true),revision=d.revision+1,changed_at=now()
 FROM rewritten WHERE d.id=1;
