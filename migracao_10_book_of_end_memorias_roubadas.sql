-- ARQUIVO ESPIRITUAL | BOOK OF THE END V3
-- Limite inicial de 1 perícia roubada; +1 por uso de Então, Vire a Página.
-- Cada perícia roubada pode conceder um dado adicional reduzido em um passo.
-- Inclui NPCs sem ficha, seleção de bônus, teste verificado e golpe físico.
-- Exige migrações anteriores do Arquivo Espiritual.

CREATE OR REPLACE FUNCTION public.ae_book_skill_die(p_sheet_id text, p_skill text, p_base integer)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE sh jsonb;b jsonb;st jsonb;items jsonb;v jsonb;best integer;found boolean;
BEGIN
 FOR sh IN SELECT x.value FROM public.ae_document d,
    jsonb_array_elements(d.data->'sheets') x(value) WHERE d.id=1 LOOP
  IF sh->>'id'<>'arquivo-tsukishima-arena-n3' THEN CONTINUE; END IF;
  b=sh->'abilityRuntime'->'bookOfEnd';st=b->'stolen';
  IF st IS NULL
   OR coalesce((b->>'scene')::integer,-1)<>coalesce((sh->'combat'->>'scene')::integer,1)
   OR NOT coalesce((sh->'abilityRuntime'->'billing'->'tsukishima-book-of-the-end-manifestacao'->>'active')::boolean,false)
   OR coalesce((sh->'abilityRuntime'->'billing'->'tsukishima-book-of-the-end-manifestacao'->>'scene')::integer,-1)<>coalesce((sh->'combat'->>'scene')::integer,1)
  THEN CONTINUE; END IF;
  items=CASE WHEN jsonb_typeof(st)='array' THEN st
         WHEN jsonb_typeof(st)='object' THEN jsonb_build_array(st)
         ELSE '[]'::jsonb END;
  best=0;found=false;
  FOR v IN SELECT value FROM jsonb_array_elements(items) LOOP
   IF v->>'skill' IS DISTINCT FROM p_skill THEN CONTINUE; END IF;
   IF v->>'targetId'=p_sheet_id THEN found=true; END IF;
   IF coalesce((v->>'die')::integer,0) IN (4,6,8,10,12,20)
   THEN best=greatest(best,(v->>'die')::integer); END IF;
  END LOOP;
  IF sh->>'id'=p_sheet_id AND best>0 THEN RETURN best; END IF;
  IF found THEN RETURN 0; END IF;
 END LOOP;
 RETURN p_base;
END;$function$
;

CREATE OR REPLACE FUNCTION public.ae_book_of_end_action_v3(p_source_id text, p_target_id text, p_action text, p_steal_skill text DEFAULT 'Precisão'::text, p_npc_name text DEFAULT NULL::text, p_npc_stats jsonb DEFAULT NULL::jsonb, p_selected_bonuses jsonb DEFAULT NULL::jsonb)
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
 stability_now integer;life_now integer;changed boolean:=false;rev bigint;
 stolen_entries jsonb:='[]'::jsonb;sb jsonb;bonus_dice jsonb:='[]'::jsonb;
 bonus_total integer:=0;bonus_die integer;bonus_value integer;extra_id text;
 page_turns integer:=0;capacity integer:=1;new_stolen jsonb;
BEGIN
 IF p_source_id<>'arquivo-tsukishima-arena-n3'
  OR p_action NOT IN ('insert','ultimate','attack') OR p_target_id IS NULL
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
     coalesce(stats->>'estabilidade','20') !~ '^[0-9]{1,3}$' OR
     coalesce(stats->>'vida','20') !~ '^[0-9]{1,3}$'
  THEN RAISE EXCEPTION 'Dados inválidos para o NPC.';END IF;
  -- Preserva apenas os seis campos autorizados, descartando propriedades extras.
  stats=jsonb_build_object(
   'corpo',(coalesce(stats->>'corpo','6'))::integer,
   'destreza',(coalesce(stats->>'destreza','6'))::integer,
   'mente',(coalesce(stats->>'mente','6'))::integer,
   'determinacao',(coalesce(stats->>'determinacao','6'))::integer,
   'pericia',(coalesce(stats->>'pericia','6'))::integer,
   'estabilidade',(coalesce(stats->>'estabilidade','20'))::integer,
   'vida',(coalesce(stats->>'vida','20'))::integer);
  tgt=jsonb_build_object('name',target_name,
   'groups',jsonb_build_object('Corpo',(coalesce(stats->>'corpo','6'))::integer,
       'Mente',(coalesce(stats->>'mente','6'))::integer),
   'skills',jsonb_build_object('Destreza',(coalesce(stats->>'destreza','6'))::integer,
       'Determinação',(coalesce(stats->>'determinacao','6'))::integer),
   'resources',jsonb_build_object('estabilidade',
       jsonb_build_object('current',(coalesce(stats->>'estabilidade','20'))::integer),
       'vida',jsonb_build_object('current',(coalesce(stats->>'vida','20'))::integer)));
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
 IF p_action<>'attack' THEN
  SELECT x.value,(x.ord-1)::integer INTO ab,ix
  FROM jsonb_array_elements(src->'abilities') WITH ORDINALITY x(value,ord)
  WHERE x.value->>'abilityId'=CASE WHEN p_action='insert' THEN 'tsukishima-inserir-presenca'
                                             ELSE 'tsukishima-vire-pagina' END LIMIT 1;
  IF ab IS NULL THEN RAISE EXCEPTION 'Habilidade não encontrada.';END IF;
 END IF;
 rt=coalesce(src->'abilityRuntime','{}'::jsonb);
 book=coalesce(rt->'bookOfEnd','{}'::jsonb);
 IF coalesce((book->>'scene')::integer,-1)<>scene_no
 THEN book=jsonb_build_object('scene',scene_no,'targets','{}'::jsonb);END IF;
 targets=coalesce(book->'targets','{}'::jsonb);
 page_turns=greatest(0,coalesce((book->>'pageTurns')::integer,0));
 capacity=1+page_turns;
 IF jsonb_typeof(book->'stolen')='array' THEN
  stolen_entries=book->'stolen';
 ELSIF jsonb_typeof(book->'stolen')='object' THEN
  stolen_entries=jsonb_build_array(book->'stolen');
 END IF;
 IF jsonb_array_length(stolen_entries)>100 THEN
  SELECT coalesce(jsonb_agg(v.value ORDER BY v.ord),'[]'::jsonb) INTO stolen_entries
  FROM jsonb_array_elements(stolen_entries) WITH ORDINALITY v(value,ord) WHERE v.ord<=100;
 END IF;
 IF p_selected_bonuses IS NOT NULL AND
    (jsonb_typeof(p_selected_bonuses)<>'array' OR jsonb_array_length(p_selected_bonuses)>100)
 THEN RAISE EXCEPTION 'Seleção de perícias inválida.';END IF;
 IF p_action='attack' AND coalesce((book->>'lastStrikeRound')::integer,-1)=round_no
 THEN RAISE EXCEPTION 'O ataque do Livro já foi realizado nesta rodada.';END IF;
 -- Dados extras: cada perícia roubada oferece um dado um passo abaixo.
 FOR sb IN SELECT value FROM jsonb_array_elements(stolen_entries) LOOP
  extra_id=coalesce(sb->>'targetId','')||'|'||coalesce(sb->>'skill','');
  IF p_selected_bonuses IS NOT NULL AND NOT (p_selected_bonuses ? extra_id) THEN CONTINUE; END IF;
  IF coalesce((sb->>'die')::integer,0) NOT IN (4,6,8,10,12,20) THEN CONTINUE; END IF;
  bonus_die=public.ae_die_step((sb->>'die')::integer,-1);
  bonus_value=public.ae_random_die(bonus_die);
  bonus_total=bonus_total+bonus_value;
  bonus_dice=bonus_dice||jsonb_build_array(jsonb_build_object('skill',sb->>'skill',
     'target',sb->>'targetName','original',sb->'die','sides',bonus_die,'value',bonus_value));
 END LOOP;
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
  life_now=greatest(0,coalesce((entry->>'life')::integer,(stats->>'vida')::integer,20));
  tgt=jsonb_set(tgt,'{resources,vida,current}',to_jsonb(life_now),true);
 END IF;
 IF p_action='ultimate' AND grade<2 THEN RAISE EXCEPTION 'Requer Relação Plástica II ou III.';END IF;
 IF p_action='attack' THEN cost=0;
 ELSE preview=public.ae_ability_cost_preview(src,ab,ix);
  cost=(preview->>'cost')::integer;
 END IF;
 IF (src->'resources'->'alma'->>'current')::numeric<cost
 THEN RAISE EXCEPTION 'Alma insuficiente.';END IF;

 IF p_action IN ('insert','attack') THEN
  die=(src->'skills'->>'Precisão')::integer;
  die=public.ae_book_skill_die(p_source_id,'Precisão',die);
  IF die<>0 THEN die=public.ae_die_step(die,public.ae_ability_step_bonus(src,'Precisão','Corpo')+CASE WHEN grade>=2 THEN 1 ELSE 0 END);END IF;
  att=public.ae_random_die((src->'groups'->>'Corpo')::integer)+CASE WHEN die=0 THEN 0 ELSE public.ae_random_die(die) END;
  die=(tgt->'skills'->>'Destreza')::integer;
  IF NOT npc THEN
   die=public.ae_book_skill_die(target_key,'Destreza',die);
   IF die<>0 THEN die=public.ae_die_step(die,public.ae_ability_step_bonus(tgt,'Destreza','Corpo'));END IF;
  ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(stolen_entries) x(v)
      WHERE x.v->>'targetId'=target_key AND x.v->>'skill'='Destreza') THEN
   die=0;
  END IF;
  def=public.ae_random_die((tgt->'groups'->>'Corpo')::integer)+CASE WHEN die=0 THEN 0 ELSE public.ae_random_die(die) END;
  att=att+bonus_total;
  changed=att>def;
  IF p_action='insert' AND changed THEN
   grade=least(3,grade+1);
   memory_die=public.ae_random_die(10);
   IF memory_die=1 THEN grade=greatest(0,grade-1);END IF;
  END IF;
  IF p_action='attack' THEN
   book=book||jsonb_build_object('lastStrikeRound',round_no);
   IF changed THEN
    damage=public.ae_random_die(4)+public.ae_random_die(4);
    tgt=jsonb_set(tgt,'{resources,vida,current}',
      to_jsonb(greatest(0,(tgt->'resources'->'vida'->>'current')::numeric-damage)),true);
    IF NOT npc AND (tgt->'resources'->'vida'->>'current')::numeric=0 AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements_text(coalesce(tgt->'conditions','[]'::jsonb)) c(value)
     WHERE lower(c.value)='desmaiado')
    THEN tgt=jsonb_set(tgt,'{conditions}',coalesce(tgt->'conditions','[]'::jsonb)||to_jsonb('Desmaiado'::text),true);END IF;
   END IF;
  END IF;
 ELSE
  grade=grade-1;
  -- Cada uso de Vire a Página abre mais um espaço de roubo nesta cena.
  page_turns=page_turns+1;
  capacity=1+page_turns;
  book=book||jsonb_build_object('pageTurns',page_turns);
  die=(src->'skills'->>'Lábia')::integer;
  die=public.ae_book_skill_die(p_source_id,'Lábia',die);
  IF die<>0 THEN die=public.ae_die_step(die,public.ae_ability_step_bonus(src,'Lábia','Mente'));END IF;
  att=public.ae_random_die((src->'groups'->>'Mente')::integer)+CASE WHEN die=0 THEN 0 ELSE public.ae_random_die(die) END;
  die=(tgt->'skills'->>'Determinação')::integer;
  IF npc THEN
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(stolen_entries) x(v)
      WHERE x.v->>'targetId'=target_key AND x.v->>'skill'='Determinação')
   THEN die=0;
   ELSIF old_grade>=3 THEN die=public.ae_die_step(die,-1);END IF;
  ELSE
   die=public.ae_book_skill_die(target_key,'Determinação',die);
   IF die<>0 THEN die=public.ae_die_step(die,public.ae_ability_step_bonus(tgt,'Determinação','Mente')-CASE WHEN old_grade>=3 THEN 1 ELSE 0 END);END IF;
  END IF;
  def=public.ae_random_die((tgt->'groups'->>'Mente')::integer)+CASE WHEN die=0 THEN 0 ELSE public.ae_random_die(die) END;
  att=att+bonus_total;
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
   new_stolen=jsonb_build_object('targetId',target_key,'targetName',tgt->>'name',
       'skill',p_steal_skill,'die',stolen_die,'npc',npc);
   SELECT coalesce(jsonb_agg(v.value ORDER BY v.ord),'[]'::jsonb) INTO stolen_entries
   FROM jsonb_array_elements(stolen_entries) WITH ORDINALITY v(value,ord)
   WHERE NOT(v.value->>'targetId'=target_key AND v.value->>'skill'=p_steal_skill);
   stolen_entries=stolen_entries||jsonb_build_array(new_stolen);
   IF jsonb_array_length(stolen_entries)>capacity THEN
    SELECT coalesce(jsonb_agg(v.value ORDER BY v.ord),'[]'::jsonb) INTO stolen_entries
    FROM jsonb_array_elements(stolen_entries) WITH ORDINALITY v(value,ord)
    WHERE v.ord>jsonb_array_length(stolen_entries)-capacity;
   END IF;
  END IF;
 END IF;
 entry=jsonb_build_object('grade',grade,'name',tgt->>'name','npc',npc,
   'lastMemory',memory_die,'lastSuccess',changed,'lastRound',round_no,
   'lastAction',p_action,'lastDamage',damage);
 IF npc THEN
  entry=entry||jsonb_build_object('stability',(tgt->'resources'->'estabilidade'->>'current')::integer,
    'npcStats',stats,'life',(tgt->'resources'->'vida'->>'current')::integer,
    'confusedRound',CASE WHEN p_action='ultimate' AND changed THEN round_no WHEN coalesce((targets->target_key->>'confusedRound')::integer,-1)=round_no THEN round_no ELSE NULL END);
 END IF;
 targets=targets||jsonb_build_object(target_key,entry);
 hist=coalesce(book->'history','[]'::jsonb);
 event=jsonb_build_object('targetId',target_key,'name',tgt->>'name','action',p_action,
   'success',changed,'attack',att,'defense',def,'memory',memory_die,
   'grade',grade,'damage',damage,'round',round_no,'bonusDice',bonus_dice,'bonusTotal',bonus_total,'pageTurns',page_turns);
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ord),'[]'::jsonb) INTO hist
 FROM jsonb_array_elements(hist||jsonb_build_array(event)) WITH ORDINALITY x(value,ord)
 WHERE x.ord>greatest(0,jsonb_array_length(hist)+1-10);
 book=book||jsonb_build_object('targets',targets,'history',hist,'stolen',stolen_entries,'pageTurns',page_turns);
 src=jsonb_set(src,'{abilityRuntime}',rt||jsonb_build_object('bookOfEnd',book),true);
 IF p_action<>'attack' THEN src=public.ae_ability_cost_commit(src,ab,preview);END IF;
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
  'pageTurns',page_turns,'stolenLimit',capacity,'bonusDice',bonus_dice,'bonusTotal',bonus_total,
  'alma',(src->'resources'->'alma'->>'current')::numeric,'revision',rev,
  'targetId',target_key,'targetName',tgt->>'name','npc',npc,
  'stability',CASE WHEN npc THEN (tgt->'resources'->'estabilidade'->>'current')::integer ELSE NULL END,
  'life',CASE WHEN npc THEN (tgt->'resources'->'vida'->>'current')::integer ELSE NULL END);
END;$function$
;

CREATE OR REPLACE FUNCTION public.ae_book_of_end_action(p_source_id text, p_target_id text, p_action text, p_steal_skill text DEFAULT 'Precisão'::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT public.ae_book_of_end_action_v3(p_source_id,p_target_id,p_action,p_steal_skill,NULL,NULL,NULL);
$function$
;

REVOKE ALL ON FUNCTION public.ae_book_skill_die(text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ae_book_of_end_action_v3(text,text,text,text,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ae_book_of_end_action_v3(text,text,text,text,text,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ae_book_of_end_action_v2(text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ae_book_of_end_action(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ae_book_of_end_action(text,text,text,text) TO authenticated;


-- Alinha as descrições e o limite de uso da ultimate com o código atualizado.
WITH updated AS (
 SELECT jsonb_agg(CASE WHEN s.value->>'id'='arquivo-tsukishima-arena-n3'
  THEN jsonb_set(s.value,'{abilities}',(
   SELECT jsonb_agg(CASE
      WHEN a.value->>'abilityId'='tsukishima-inserir-presenca' THEN jsonb_set(a.value,'{description}',to_jsonb('Uma vez por rodada, utilize sua ação principal para atingir um adversário com Book of the End, sem causar dano. Realize um teste-clash de Precisão contra Destreza. Se vencer, aumenta em um grau sua Relação Plástica com o alvo (máximo III) e ele rola 1d10 de Memória. Com 1, perde o grau recém-adquirido; com 10, rouba uma perícia até o fim da cena. Você começa podendo manter uma perícia roubada por vez; Então, Vire a Página amplia esse limite. O alvo perde o dado da perícia roubada nos testes, enquanto você pode utilizá-lo. Nos ataques de Book of the End, as perícias roubadas também fornecem dados extras reduzidos em um passo.'::text),true)
      WHEN a.value->>'abilityId'='tsukishima-vire-pagina' THEN jsonb_set(jsonb_set(a.value,'{description}',to_jsonb('Uma vez por rodada, com Book of the End manifestado, utilize sua ação principal contra um adversário com Relação Plástica II ou III. Consuma um grau da relação e realize um teste-clash de Lábia contra Determinação. A cada uso, mesmo se o alvo resistir, aumenta em 1 seu limite de perícias roubadas simultaneamente até o fim da cena (limite inicial: 1). Se vencer, causa 2d6 de dano à Estabilidade, deixa o alvo Confuso até o próximo Desfecho e força um Dado de Memória (1d10). Com 10, rouba uma perícia. Cada perícia roubada pode adicionar aos ataques de Book of the End um dado extra, reduzido em um passo, sem consumi-la. O grau é consumido mesmo se o confronto falhar.'::text),true),'{costConfig,limit}',to_jsonb('round'::text),true)
      ELSE a.value END ORDER BY a.ord)
   FROM jsonb_array_elements(s.value->'abilities') WITH ORDINALITY a(value,ord)
  ),true) ELSE s.value END ORDER BY s.ord) arr
 FROM public.ae_document d, jsonb_array_elements(d.data->'sheets') WITH ORDINALITY s(value,ord)
 WHERE d.id=1
)
UPDATE public.ae_document d
 SET data=jsonb_set(d.data,'{sheets}',(SELECT arr FROM updated),true),
 revision=revision+1,changed_at=now()
 WHERE d.id=1;
