-- Ação Completa (principal + reação) e Exposição Espiritual (2 ALMA).
-- Preserva ACL, assinaturas e validação de chave em RPCs existentes.
CREATE OR REPLACE FUNCTION public.ae_cbb_action(p_sheet_id text, p_action text, p_ability_index integer DEFAULT NULL::integer, p_resource text DEFAULT NULL::text, p_value integer DEFAULT NULL::integer, p_exposure text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE ac_id uuid; key_id uuid;key_kind text;key_sheet text;doc jsonb;sh jsonb;ab jsonb;
 combat jsonb;exposures jsonb;rt jsonb; billing jsonb;preview jsonb;old_entry jsonb;
 current_alma integer;cost integer;current_resource integer;max_resource integer;
 scene_num integer;round_num integer;phase text;exposure_level integer;
 need_main boolean:=false;need_reaction boolean:=false;is_locked boolean:=false;
 state_key text;v_mode text;v_limit text;desc_text text;
 extra_main integer;extra_reaction integer;uses_in_scene integer;
 v_result jsonb;rows jsonb;v_rev bigint;change_target text;rhythm_level integer;hit_count integer;raised_round integer;pending_rhythm boolean;phase_req text;ability_ix integer;pin_key text;pins jsonb;pin_position integer;boss_ratio numeric;boss_partner jsonb;boss_party jsonb;party_old integer;party_new integer;vida_step integer;max_old integer;max_new integer;current_old integer;initial_meters jsonb;meter_key text;meter_initial integer;origin_post text;origin_content text;meter_match text[];
BEGIN
 IF p_sheet_id IS NULL OR length(p_sheet_id)>150 OR p_action NOT IN
  ('ability','deactivate','main','reaction','complete','phase','round','scene','adjust','expose','contain','commit','hit','party','pin','toggleAutomation','reset')
 THEN RAISE EXCEPTION 'Ação inválida.';END IF;
 SELECT a.id,k.id,k.kind,k.sheet_id INTO ac_id,key_id,key_kind,key_sheet
 FROM public.ae_sessions se JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active WHERE se.user_id=auth.uid() LIMIT 1;
 IF ac_id IS NULL OR key_kind NOT IN ('master','player') THEN RAISE EXCEPTION 'Entre para usar a ficha.';END IF;
 IF p_action='deactivate' THEN
  SELECT x.value INTO sh FROM public.ae_document d
   CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) x(value)
   WHERE d.id=1 AND x.value->>'id'=p_sheet_id LIMIT 1;
  IF coalesce((sh->>'automationEnabled')::boolean,true)=false THEN RAISE EXCEPTION 'Automação desativada nesta ficha.';END IF;
  IF p_ability_index IS NULL OR p_ability_index NOT BETWEEN 0 AND 99 THEN RAISE EXCEPTION 'Habilidade inválida.';END IF;
  v_result=public.ae_ability_deactivate(p_sheet_id,p_ability_index);
  SELECT d.revision,x.value INTO v_rev,sh FROM public.ae_document d
   CROSS JOIN LATERAL jsonb_array_elements(d.data->'sheets') x(value)
   WHERE d.id=1 AND x.value->>'id'=p_sheet_id LIMIT 1;
  RETURN jsonb_build_object('ok',true,'revision',v_rev,'resources',sh->'resources',
   'combat',sh->'combat','exposures',sh->'exposures','abilityRuntime',sh->'abilityRuntime','info',v_result);
 END IF;
 SELECT data INTO doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 SELECT x.value INTO sh FROM jsonb_array_elements(coalesce(doc->'sheets','[]'::jsonb)) x(value)
 WHERE x.value->>'id'=p_sheet_id LIMIT 1;
 IF sh IS NULL THEN RAISE EXCEPTION 'Ficha inexistente.';END IF;
 IF coalesce((sh->>'masterOnly')::boolean,false) AND key_kind<>'master' THEN RAISE EXCEPTION 'Ficha privada do mestre.';END IF;
 IF coalesce((sh->>'redacted')::boolean,false) AND key_kind<>'master' THEN RAISE EXCEPTION 'Ficha indisponível.';END IF;
 IF key_kind='player' AND NOT public.ae_sheet_linked(sh,key_id,key_sheet) THEN RAISE EXCEPTION 'Ficha não vinculada.';END IF;
 IF p_action IN ('phase','round','scene','reset')
    AND coalesce((doc#>>'{site,liveCombat,enabled}')::boolean,false)
    AND current_setting('ae.live_phase_global',true) IS DISTINCT FROM 'yes'
   THEN RAISE EXCEPTION 'A fase é controlada pelo mestre na Sessão ao Vivo.';END IF;
 combat=coalesce(sh->'combat','{}'::jsonb);
 combat=combat||jsonb_build_object('cbb',coalesce(combat->'cbb','{}'::jsonb));
 exposures=coalesce(sh->'exposures','{}'::jsonb);
 rt=coalesce(sh->'abilityRuntime','{}'::jsonb);
 scene_num=greatest(1,coalesce((combat->>'scene')::integer,1));
 round_num=greatest(1,coalesce((combat->>'round')::integer,1));
 phase=coalesce(combat->>'phase','preparacao');
 extra_main=greatest(0,coalesce((combat#>>'{cbb,extraMain}')::integer,0));
 extra_reaction=greatest(0,coalesce((combat#>>'{cbb,extraReaction}')::integer,0));
 IF coalesce((sh->>'automationEnabled')::boolean,true)=false
    AND p_action NOT IN ('pin','toggleAutomation','reset')
   AND NOT (p_action IN ('phase','round') AND current_setting('ae.live_phase_global',true)='yes')
 THEN RAISE EXCEPTION 'Automação desativada nesta ficha.';END IF;
 IF p_action='toggleAutomation' THEN
  sh=jsonb_set(sh,'{automationEnabled}',
    to_jsonb(NOT coalesce((sh->>'automationEnabled')::boolean,true)),true);
  v_result=jsonb_build_object('enabled',sh->'automationEnabled');
 ELSIF p_action='reset' THEN
  IF key_kind<>'master' THEN RAISE EXCEPTION 'Somente o mestre pode reiniciar fichas.';END IF;
  -- Reconstrói apenas estado transitório. Identidade, talentos, inventário,
  -- fichas vinculadas, notas, pins e escolha de participantes são preservados.
  FOR change_target IN SELECT value FROM jsonb_array_elements_text('["vida","estabilidade","alma"]'::jsonb)
  LOOP
   max_resource=greatest(0,coalesce((sh->'resources'->change_target->>'max')::integer,0));
   sh=jsonb_set(sh,ARRAY['resources',change_target,'current'],to_jsonb(max_resource),true);
  END LOOP;
  sh=jsonb_set(sh,'{conditions}','[]'::jsonb,true);
  sh=jsonb_set(sh,'{exposures}','{"defensiva":0,"ofensiva":0,"ritmica":0,"espiritual":0}'::jsonb,true);
  sh=jsonb_set(sh,'{restCount}','0'::jsonb,true);
  sh=jsonb_set(sh,'{desgaste}','0'::jsonb,true);
  initial_meters='{}'::jsonb;
  FOR meter_key IN SELECT x.key FROM jsonb_each(coalesce(sh#>'{abilityRuntime,originMeters}','{}'::jsonb)) x
  LOOP
   meter_initial=0;
   origin_post=split_part(meter_key,':',2);
   SELECT p->>'content' INTO origin_content
     FROM jsonb_array_elements(coalesce(doc#>'{site,warehouse,posts}','[]'::jsonb)) p
     WHERE p->>'id'=origin_post LIMIT 1;
   -- Mesmo cálculo genérico das iniciações explícitas de classe/raça.
   IF origin_content IS NOT NULL THEN
    meter_match=regexp_match(origin_content,
     '(?:começa|inicia)[^.!?\n]{0,100}?com\s+\[(?:sequencia|barra|marca|contador):\s*([0-9]+)', 'i');
    IF meter_match IS NOT NULL THEN meter_initial=greatest(0,least(100,(meter_match[1])::integer));END IF;
   END IF;
   initial_meters=jsonb_set(initial_meters,ARRAY[meter_key],to_jsonb(meter_initial),true);
  END LOOP;
  sh=jsonb_set(sh,'{abilityRuntime}',jsonb_build_object('originMeters',initial_meters),true);
  combat=jsonb_build_object('scene',1,'round',1,'phase','preparacao',
   'mainUsed',false,'reactionUsed',false,'committedUsed',false,'pressureHits',0,
   'cbb',jsonb_build_object(
     'extraMain',greatest(0,least(2,coalesce((sh#>>'{boss,tempo,extraMain}')::integer,0))),
     'extraReaction',greatest(0,least(2,coalesce((sh#>>'{boss,tempo,extraReaction}')::integer,0)))));
  exposures=sh->'exposures';
  v_result=jsonb_build_object('reset',true);
 ELSIF p_action='pin' THEN
  IF p_ability_index IS NULL OR p_ability_index NOT BETWEEN 0 AND 99
   OR jsonb_typeof(sh->'abilities')<>'array' OR p_ability_index>=jsonb_array_length(sh->'abilities')
  THEN RAISE EXCEPTION 'Habilidade inexistente.';END IF;
  ab=sh->'abilities'->p_ability_index;
  IF nullif(btrim(ab->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Habilidade sem nome.';END IF;
  pin_key=(CASE WHEN ab->>'libraryType'='tecnica' THEN 'tecnica' ELSE 'habilidade' END)||':'||btrim(ab->>'name');
  pins=CASE WHEN jsonb_typeof(sh->'pinnedAbilities')='array' THEN sh->'pinnedAbilities' ELSE '[]'::jsonb END;
  SELECT ord-1 INTO pin_position FROM jsonb_array_elements_text(pins) WITH ORDINALITY x(value,ord)
    WHERE x.value=pin_key LIMIT 1;
  IF pin_position IS NULL THEN
   IF jsonb_array_length(pins)>=12 THEN RAISE EXCEPTION 'Limite de 12 habilidades fixadas.';END IF;
   pins=pins||to_jsonb(pin_key);
  ELSE pins=pins-pin_position;END IF;
  sh=jsonb_set(sh,'{pinnedAbilities}',pins,true);
  v_result=jsonb_build_object('pin',pin_key,'active',pin_position IS NULL);
 ELSIF p_action='ability' THEN
  IF p_ability_index IS NULL OR p_ability_index NOT BETWEEN 0 AND 99
   OR jsonb_typeof(sh->'abilities')<>'array' OR p_ability_index>=jsonb_array_length(sh->'abilities')
  THEN RAISE EXCEPTION 'Habilidade inválida.';END IF;
  ab=sh->'abilities'->p_ability_index;
  IF coalesce(ab->>'name','')='' THEN RAISE EXCEPTION 'Habilidade sem nome.';END IF;
  IF coalesce(ab->>'category','')='passive' OR coalesce((ab->>'passive')::boolean,false)
   OR (coalesce((ab->>'cost')::integer,0)=0 AND ab->'costConfig' IS NULL)
  THEN RAISE EXCEPTION 'Efeito passivo não requer ativação.';END IF;
  IF ab->'unlock'->>'mode'='locked' AND key_kind<>'master' THEN RAISE EXCEPTION 'Liberação bloqueada para jogadores.';END IF;
  IF jsonb_typeof(ab->'costConfig')='object' THEN
   v_mode=coalesce(ab->'costConfig'->>'mode','use');
   v_limit=coalesce(ab->'costConfig'->>'limit','none');
  ELSE v_mode='use';v_limit='none';END IF;
  -- Respeitar limites textuais já existentes quando faltarem metadados.
  desc_text=lower(coalesce(ab->>'description',''));
  IF v_limit='none' THEN
   IF lower(coalesce(ab->>'usage','')) LIKE '%uma vez por cena%' OR desc_text LIKE 'uma vez por cena,%'
     THEN v_limit='scene';
   ELSIF lower(coalesce(ab->>'usage','')) LIKE '%uma vez por rodada%' OR desc_text LIKE 'uma vez por rodada,%'
     THEN v_limit='round';END IF;
  END IF;
  IF v_limit<>'none' AND ab->'costConfig'->>'limit' IS DISTINCT FROM v_limit THEN
   ab=jsonb_set(ab,'{costConfig}',coalesce(ab->'costConfig','{}'::jsonb)||jsonb_build_object('limit',v_limit),true);
  END IF;
  IF ab->'costConfig' ? 'requiresHealthBelow' THEN
   boss_ratio=(ab->'costConfig'->>'requiresHealthBelow')::numeric;
   IF boss_ratio<=0 OR boss_ratio>=1 THEN RAISE EXCEPTION 'Limiar de Vida inválido.';END IF;
   IF coalesce((sh#>>'{resources,vida,current}')::numeric,0) >
      coalesce((sh#>>'{resources,vida,max}')::numeric,0)*boss_ratio THEN
    RAISE EXCEPTION 'Esta liberação só pode ser ativada com %%% da Vida ou menos.',round(boss_ratio*100);
   END IF;
  END IF;
  IF coalesce((ab#>>'{costConfig,requiresPartnerDown}')::boolean,false) THEN
   SELECT x.value INTO boss_partner FROM jsonb_array_elements(doc->'sheets') x(value)
    WHERE x.value->>'id'=sh#>>'{boss,partner}' LIMIT 1;
   IF boss_partner IS NULL OR coalesce((boss_partner#>>'{resources,vida,current}')::numeric,1)>0
   THEN RAISE EXCEPTION 'A liberação exige que o parceiro esteja incapacitado.';END IF;
  END IF;
  preview=public.ae_ability_cost_preview(sh,ab,p_ability_index);
  cost=(preview->>'cost')::integer;
  current_alma=coalesce((sh#>>'{resources,alma,current}')::integer,0);
  IF current_alma<cost THEN RAISE EXCEPTION 'Alma insuficiente.';END IF;
  phase_req=lower(coalesce(ab->'costConfig'->>'phase',''));
  IF phase_req='' THEN
   IF position('na fase de preparação' in desc_text)>0 THEN phase_req='preparacao';
   ELSIF position('na fase de distância' in desc_text)>0 THEN phase_req='distancia';
   ELSIF position('na fase de duelo' in desc_text)>0 THEN phase_req='duelo';
   END IF;
  END IF;
  IF phase_req<>'' AND phase_req NOT IN ('preparacao','distancia','duelo') THEN RAISE EXCEPTION 'Fase da habilidade inválida.';END IF;
  IF phase_req<>'' AND phase_req<>phase THEN
   RAISE EXCEPTION 'Essa habilidade exige a fase %.',phase_req;
  END IF;
  need_main=desc_text LIKE '%utilize sua ação principal%';
  need_reaction=desc_text LIKE '%utilize sua reação%';
  IF need_main AND need_reaction THEN RAISE EXCEPTION 'A habilidade exige definição manual da ação.';END IF;
  IF need_main AND coalesce((combat->>'mainUsed')::boolean,false) AND extra_main=0 THEN RAISE EXCEPTION 'Ação principal indisponível.';END IF;
  IF need_reaction AND coalesce((combat->>'reactionUsed')::boolean,false) AND extra_reaction=0 THEN RAISE EXCEPTION 'Reação indisponível.';END IF;
  IF need_main THEN
   IF coalesce((combat->>'mainUsed')::boolean,false) THEN
    combat=jsonb_set(combat,'{cbb,extraMain}','0'::jsonb,true);
   ELSE combat=jsonb_set(combat,'{mainUsed}','true'::jsonb,true);END IF;
  END IF;
  IF need_reaction THEN
   IF coalesce((combat->>'reactionUsed')::boolean,false) THEN
    combat=jsonb_set(combat,'{cbb,extraReaction}','0'::jsonb,true);
   ELSE combat=jsonb_set(combat,'{reactionUsed}','true'::jsonb,true);END IF;
  END IF;
  sh=public.ae_ability_cost_commit(sh,ab,preview);
  sh=jsonb_set(sh,'{resources,alma,current}',to_jsonb(current_alma-cost),true);
  v_result=jsonb_build_object('chargedCost',cost,'ability',ab->>'name','mode',preview->>'mode');
 ELSIF p_action='complete' THEN
  -- Reserva ambas as oportunidades normais antes da rolagem, atomicamente.
  IF coalesce((combat->>'mainUsed')::boolean,false) OR coalesce((combat->>'reactionUsed')::boolean,false)
    THEN RAISE EXCEPTION 'Ação Completa exige ação principal e reação normais disponíveis.';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(sh->'conditions','[]'::jsonb)) z(value)
     WHERE lower(btrim(z.value))='atordoado') THEN
     RAISE EXCEPTION 'Atordoado impede utilizar Ação Completa.';END IF;
  combat=combat||jsonb_build_object('mainUsed',true,'reactionUsed',true);
  combat=jsonb_set(combat,'{cbb}',coalesce(combat->'cbb','{}'::jsonb)||
    jsonb_build_object('completePending',true,'completeRound',round_num,
      'completeScene',scene_num,'completeAttackId',null,'completeDamageUsed',false),true);
  v_result=jsonb_build_object('completePending',true,'action','complete');
 ELSIF p_action IN ('main','reaction') THEN
  IF p_action='reaction' AND EXISTS(
   SELECT 1 FROM jsonb_array_elements_text(coalesce(sh->'conditions','[]'::jsonb)) c(value)
   WHERE lower(btrim(c.value))='atordoado'
  ) THEN RAISE EXCEPTION 'Atordoado impede reações até o próximo Desfecho.';END IF;
  change_target=CASE WHEN p_action='main' THEN 'mainUsed' ELSE 'reactionUsed' END;
  IF coalesce((combat->>change_target)::boolean,false) THEN
   IF p_action='main' AND extra_main>0 THEN combat=jsonb_set(combat,'{cbb,extraMain}','0'::jsonb,true);
   ELSIF p_action='reaction' AND extra_reaction>0 THEN combat=jsonb_set(combat,'{cbb,extraReaction}','0'::jsonb,true);
   ELSE RAISE EXCEPTION 'Esta ação já foi usada na rodada.';END IF;
  ELSE combat=jsonb_set(combat,ARRAY[change_target],'true'::jsonb,true);END IF;
 ELSIF p_action='phase' THEN
  phase=CASE phase WHEN 'preparacao' THEN 'distancia' WHEN 'distancia' THEN 'duelo'
   WHEN 'duelo' THEN 'desfecho' ELSE NULL END;
  IF phase IS NULL THEN RAISE EXCEPTION 'Use avançar rodada após o Desfecho.';END IF;
  combat=jsonb_set(combat,'{phase}',to_jsonb(phase),true);
  IF coalesce((combat#>>'{cbb,pendingDefensive}')::boolean,false) THEN
   exposure_level=greatest(0,least(3,coalesce((exposures->>'defensiva')::integer,0)));
   exposures=jsonb_set(exposures,'{defensiva}',to_jsonb(least(3,exposure_level+1)),true);
   combat=jsonb_set(combat,'{cbb,pendingDefensive}','false'::jsonb,true);
   combat=jsonb_set(combat,'{cbb,defensiveRaisedRound}',to_jsonb(round_num),true);
  END IF;
 ELSIF p_action='round' THEN
  IF phase<>'desfecho' THEN RAISE EXCEPTION 'Finalize o Desfecho antes da próxima rodada.';END IF;
  rhythm_level=greatest(0,least(3,coalesce((exposures->>'ritmica')::integer,0)));
  pending_rhythm=coalesce((combat#>>'{cbb,rhythmPending}')::boolean,false);
  IF coalesce((combat->>'pressureHits')::integer,0)=0 THEN
   combat=jsonb_set(combat,'{cbb,pressured}','false'::jsonb,true);
  END IF;
  combat=combat||jsonb_build_object('round',round_num+1,'phase','preparacao',
   'mainUsed',pending_rhythm AND rhythm_level>=3,
   'reactionUsed',pending_rhythm AND rhythm_level>=2,
   'committedUsed',false,'pressureHits',0);
  combat=jsonb_set(combat,'{cbb,completePending}','false'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,completeAttackId}','null'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,completeDamageUsed}','false'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,movementBlocked}',to_jsonb(pending_rhythm AND rhythm_level>=1),true);
  combat=jsonb_set(combat,'{cbb,rhythmPending}','false'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,extraMain}',to_jsonb(greatest(0,least(2,coalesce((sh#>>'{boss,tempo,extraMain}')::integer,0)))),true);
  combat=jsonb_set(combat,'{cbb,extraReaction}',to_jsonb(greatest(0,least(2,coalesce((sh#>>'{boss,tempo,extraReaction}')::integer,0)))),true);
 ELSIF p_action='scene' THEN
  IF key_kind<>'master' THEN RAISE EXCEPTION 'Somente o mestre pode iniciar outra cena.';END IF;
  -- Durações de sessão sobrevivem à troca de cena, independentemente do personagem.
  billing=coalesce(rt->'billing','{}'::jsonb);
  IF jsonb_typeof(billing)='object' THEN
   FOR ab,ability_ix IN SELECT x.item,(x.ord-1)::integer
     FROM jsonb_array_elements(coalesce(sh->'abilities','[]'::jsonb)) WITH ORDINALITY x(item,ord) LOOP
    IF ab->'costConfig'->>'duration'='session' AND ab->'costConfig'->>'mode'='activation' THEN
     state_key=public.ae_ability_billing_key(ab,ability_ix);
     old_entry=billing->state_key;
     IF old_entry IS NOT NULL AND coalesce((old_entry->>'active')::boolean,false)
       AND coalesce((old_entry->>'scene')::integer,0)=scene_num THEN
      billing=jsonb_set(billing,ARRAY[state_key],old_entry||jsonb_build_object('scene',scene_num+1,'lastRound',0,'usesRound',0),true);
     END IF;
    END IF;
   END LOOP;
   rt=jsonb_set(rt,'{billing}',billing,true);
   sh=jsonb_set(sh,'{abilityRuntime}',rt,true);
  END IF;
  combat=combat||jsonb_build_object('scene',scene_num+1,'round',1,'phase','preparacao',
   'mainUsed',false,'reactionUsed',false,'committedUsed',false,'pressureHits',0);
  combat=jsonb_set(combat,'{cbb,completePending}','false'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,completeAttackId}','null'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,completeDamageUsed}','false'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,extraMain}',to_jsonb(greatest(0,least(2,coalesce((sh#>>'{boss,tempo,extraMain}')::integer,0)))),true);
  combat=jsonb_set(combat,'{cbb,extraReaction}',to_jsonb(greatest(0,least(2,coalesce((sh#>>'{boss,tempo,extraReaction}')::integer,0)))),true);
  combat=jsonb_set(combat,'{cbb,movementBlocked}','false'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,rhythmPending}','false'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,pressured}','false'::jsonb,true);
  combat=jsonb_set(combat,'{cbb,pendingDefensive}','false'::jsonb,true);
 ELSIF p_action='party' THEN
  IF key_kind<>'master' OR sh->'boss' IS NULL THEN RAISE EXCEPTION 'Somente o mestre ajusta confrontos de chefes.';END IF;
  IF p_value IS NULL OR p_value NOT BETWEEN 6 AND 8 THEN RAISE EXCEPTION 'Selecione 6, 7 ou 8 jogadores.';END IF;
  boss_party=sh->'boss'->'party';
  party_old=coalesce((boss_party->>'current')::integer,(boss_party->>'base')::integer,7);
  party_new=p_value;
  vida_step=coalesce((boss_party->>'vidaPorJogador')::integer,0);
  IF party_old NOT BETWEEN 6 AND 8 OR vida_step NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Escalonamento de chefe inválido.';END IF;
  max_old=(sh#>>'{resources,vida,max}')::integer;
  current_old=(sh#>>'{resources,vida,current}')::integer;
  max_new=max_old+(party_new-party_old)*vida_step;
  IF max_new<1 THEN RAISE EXCEPTION 'Vida final inválida.';END IF;
  sh=jsonb_set(sh,'{resources,vida}',jsonb_build_object('max',max_new,
   'current',greatest(0,least(max_new,current_old+(max_new-max_old)))),true);
  sh=jsonb_set(sh,'{boss,party,current}',to_jsonb(party_new),true);
  v_result=jsonb_build_object('party',party_new,'vidaMax',max_new);
 ELSIF p_action='adjust' THEN
  IF p_resource NOT IN ('vida','estabilidade','alma') OR p_value IS NULL OR p_value NOT BETWEEN -100000 AND 100000
   THEN RAISE EXCEPTION 'Ajuste de recurso inválido.';END IF;
  current_resource=coalesce((sh->'resources'->p_resource->>'current')::integer,0);
  max_resource=greatest(0,coalesce((sh->'resources'->p_resource->>'max')::integer,0));
  current_resource=greatest(0,least(max_resource,current_resource+p_value));
  sh=jsonb_set(sh,ARRAY['resources',p_resource,'current'],to_jsonb(current_resource),true);
  v_result=jsonb_build_object('resource',p_resource,'newCurrent',current_resource);
 ELSIF p_action='hit' THEN
  hit_count=greatest(0,coalesce((combat->>'pressureHits')::integer,0));
  combat=jsonb_set(combat,'{pressureHits}',to_jsonb(least(100,hit_count+1)),true);
  combat=jsonb_set(combat,'{cbb,pressured}','true'::jsonb,true);
  raised_round=coalesce((combat#>>'{cbb,defensiveRaisedRound}')::integer,0);
  IF hit_count>=1 AND raised_round<>round_num THEN
   combat=jsonb_set(combat,'{cbb,pendingDefensive}','true'::jsonb,true);
  END IF;
 ELSIF p_action IN ('expose','contain','commit') THEN
  IF p_exposure NOT IN ('defensiva','ofensiva','ritmica','espiritual') THEN RAISE EXCEPTION 'Exposição inválida.';END IF;
  exposure_level=greatest(0,least(3,coalesce((exposures->>p_exposure)::integer,0)));
  IF p_action='contain' THEN
   IF phase<>'desfecho' OR coalesce((combat->>'committedUsed')::boolean,false) THEN
    RAISE EXCEPTION 'Contenção apenas no Desfecho de rodada sem comprometimento.';END IF;
   IF p_exposure='defensiva' AND coalesce((combat->>'pressureHits')::integer,0)>0
    THEN RAISE EXCEPTION 'Enquanto Pressionado, não reduza Exposição Defensiva.';END IF;
   exposure_level=greatest(0,exposure_level-1);
  ELSIF p_action='expose' THEN
   IF p_value IS NULL OR p_value NOT IN (1,-1) THEN RAISE EXCEPTION 'Ajuste de Exposição inválido.';END IF;
   exposure_level=greatest(0,least(3,exposure_level+p_value));
   IF p_exposure='ritmica' AND p_value>0 THEN
    combat=jsonb_set(combat,'{cbb,rhythmPending}','true'::jsonb,true);
   END IF;
  ELSE
   IF coalesce((combat->>'committedUsed')::boolean,false) THEN RAISE EXCEPTION 'Somente um comprometimento por rodada.';END IF;
   IF exposure_level>=3 THEN RAISE EXCEPTION 'Exposição no nível III: escolha outra categoria.';END IF;
   IF p_resource NOT IN ('main','reaction') THEN RAISE EXCEPTION 'Escolha ação principal ou reação adicional.';END IF;
   IF p_exposure='espiritual' THEN
    current_alma=greatest(0,coalesce((sh#>>'{resources,alma,current}')::integer,0));
    max_resource=greatest(0,coalesce((sh#>>'{resources,alma,max}')::integer,0));
    IF current_alma>=max_resource THEN RAISE EXCEPTION 'ALMA já está no máximo; não é possível obter esta exposição.';END IF;
    sh=jsonb_set(sh,'{resources,alma,current}',to_jsonb(least(max_resource,current_alma+2)),true);
    v_result=jsonb_build_object('recoveredAlma',least(2,max_resource-current_alma),
      'newAlma',least(max_resource,current_alma+2),'exposure','espiritual');
   END IF;
   exposure_level=exposure_level+1;
   combat=jsonb_set(combat,'{committedUsed}','true'::jsonb,true);
   IF p_exposure='ritmica' THEN
    combat=jsonb_set(combat,'{cbb,rhythmPending}','true'::jsonb,true);
   END IF;
   IF p_resource='main' THEN combat=jsonb_set(combat,'{cbb,extraMain}','1'::jsonb,true);
   ELSE combat=jsonb_set(combat,'{cbb,extraReaction}','1'::jsonb,true);END IF;
  END IF;
  exposures=jsonb_set(exposures,ARRAY[p_exposure],to_jsonb(exposure_level),true);
 ELSE RAISE EXCEPTION 'Ação não implementada.';END IF;
 sh=sh||jsonb_build_object('combat',combat,'exposures',exposures);
 SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_sheet_id THEN sh ELSE x.value END ORDER BY x.ord)
  INTO rows FROM jsonb_array_elements(doc->'sheets') WITH ORDINALITY x(value,ord);
 UPDATE public.ae_document SET data=jsonb_set(doc,'{sheets}',rows),revision=revision+1,changed_at=now()
 WHERE id=1 RETURNING revision INTO v_rev;
 RETURN jsonb_build_object('ok',true,'revision',v_rev,'resources',sh->'resources','combat',sh->'combat',
   'exposures',sh->'exposures','abilityRuntime',sh->'abilityRuntime','pinnedAbilities',coalesce(sh->'pinnedAbilities','[]'::jsonb),'boss',sh->'boss',
    'automationEnabled',coalesce(sh->'automationEnabled','true'::jsonb),
    'conditions',coalesce(sh->'conditions','[]'::jsonb),
    'restCount',coalesce(sh->'restCount','0'::jsonb),
    'desgaste',coalesce(sh->'desgaste','0'::jsonb),
    'info',coalesce(v_result,'{}'::jsonb));
END $function$
;

CREATE OR REPLACE FUNCTION public.ae_cbb_roll(p_sheet_id text, p_kind text, p_skill text DEFAULT NULL::text, p_context text DEFAULT 'geral'::text, p_reaction boolean DEFAULT false, p_group_steps integer DEFAULT 0, p_skill_steps integer DEFAULT 0, p_pool jsonb DEFAULT '[]'::jsonb, p_resource text DEFAULT NULL::text, p_flat integer DEFAULT 0, p_attack_id bigint DEFAULT NULL::bigint, p_manual_ra integer DEFAULT 0, p_fear integer DEFAULT NULL::integer, p_hollow boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 total integer:=0;ra integer:=0;rb integer:=0;special text:='';attack_ra integer:=0;complete_attack boolean:=false;complete_damage boolean:=false;
 prev public.ae_rolls%rowtype;new_roll public.ae_rolls%rowtype;label_text text;v_i integer;
BEGIN
 IF p_sheet_id IS NULL OR length(p_sheet_id)>150 OR p_kind NOT IN ('teste','dano','resistencia','recuperacao','protecao')
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
 -- Bloqueio serializa o consumo da Ação Completa com alterações da fase.
 IF (p_kind='teste' AND p_context='ataque') OR (p_kind='dano' AND p_attack_id IS NOT NULL) OR p_reaction THEN
  SELECT data INTO doc FROM public.ae_document WHERE id=1 FOR UPDATE;
  SELECT x.value INTO sh FROM jsonb_array_elements(coalesce(doc->'sheets','[]'::jsonb)) x(value)
    WHERE x.value->>'id'=p_sheet_id LIMIT 1;
 ELSE
  SELECT x.value INTO sh FROM public.ae_document d
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) x(value)
  WHERE d.id=1 AND x.value->>'id'=p_sheet_id LIMIT 1;
 END IF;
 IF sh IS NULL THEN RAISE EXCEPTION 'Ficha inexistente.';END IF;
 IF coalesce((sh->>'masterOnly')::boolean,false) AND key_kind<>'master' THEN RAISE EXCEPTION 'Ficha exclusiva do mestre.';END IF;
 IF coalesce((sh->>'redacted')::boolean,false) AND key_kind<>'master' THEN RAISE EXCEPTION 'Ficha indisponível.';END IF;
 IF key_kind='player' AND NOT public.ae_sheet_linked(sh,key_id,key_sheet) THEN RAISE EXCEPTION 'Ficha não vinculada.';END IF;
 IF coalesce((sh->>'automationEnabled')::boolean,true)=false THEN
  RAISE EXCEPTION 'Automação desativada nesta ficha.';
 END IF;
 group_color=sh->'appearance'->>'diceGroup';skill_color=sh->'appearance'->>'diceSkill';
 IF coalesce(group_color,'') !~ '^#[0-9a-fA-F]{6}$' THEN group_color='#FF7A1A';END IF;
 IF coalesce(skill_color,'') !~ '^#[0-9a-fA-F]{6}$' THEN skill_color='#4CC9F0';END IF;
 SELECT coalesce(array_agg(lower(c.value)),ARRAY[]::text[]) INTO conditions
 FROM jsonb_array_elements_text(coalesce(sh->'conditions','[]'::jsonb)) c(value);
 IF p_kind='teste' THEN
  grp=CASE WHEN p_skill=ANY(ARRAY['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão']) THEN 'Corpo'
    WHEN p_skill=ANY(ARRAY['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia']) THEN 'Mente'
    WHEN p_skill=ANY(ARRAY['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']) THEN 'Espírito' ELSE NULL END;
  IF grp IS NULL THEN RAISE EXCEPTION 'Perícia inválida.';END IF;
  gdie=(sh->'groups'->>grp)::integer;sdie=(sh->'skills'->>p_skill)::integer;
  ix_g=array_position(scale,gdie);ix_s=array_position(scale,sdie);
  IF ix_g IS NULL OR ix_s IS NULL THEN RAISE EXCEPTION 'Dados inválidos na ficha.';END IF;
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
  -- A Exposição Espiritual afeta todos os testes de Espírito imediatamente.
  IF grp='Espírito' THEN
   expo=expo+greatest(0,least(3,coalesce((sh->'exposures'->>'espiritual')::integer,0)));
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
  IF 'fragilizado'=ANY(conditions) AND jsonb_array_length(p_pool)=0 THEN
   auto_g=-1;
  END IF;
  rolled_group=scale[greatest(1,least(greatest(ix_g,5),ix_g+p_group_steps+auto_g))];
  result_dice=result_dice||jsonb_build_array(jsonb_build_object('sides',rolled_group,'value',public.ae_cbb_random(rolled_group)));
  colors=colors||to_jsonb(group_color);
  IF jsonb_array_length(p_pool)>1 THEN RAISE EXCEPTION 'Uma proteção adicional por recurso.';END IF;
 END IF;
 IF p_kind='protecao' AND (p_resource NOT IN ('vida','estabilidade','alma')
  OR jsonb_array_length(p_pool)<>1 OR p_group_steps<>0 OR p_flat<>0
  OR p_attack_id IS NOT NULL OR p_manual_ra<>0)
 THEN RAISE EXCEPTION 'Proteção exige exatamente um dado adicional e um recurso.';END IF;
 IF p_kind<>'teste' AND p_skill_steps<>0 THEN RAISE EXCEPTION 'Perícia somente em testes.';END IF;
 IF p_kind IN ('dano','recuperacao','protecao') AND p_group_steps<>0 THEN RAISE EXCEPTION 'Grupo somente em testes ou resistência.';END IF;
 FOR datum IN SELECT value FROM jsonb_array_elements(p_pool) LOOP
  IF jsonb_typeof(datum)<>'object' OR coalesce(datum->>'faces','') !~ '^(4|6|8|10|12|14|16|18|20)$'
   OR coalesce(datum->>'count','') !~ '^[1-9][0-9]?$' THEN RAISE EXCEPTION 'Dados adicionais inválidos.';END IF;
  faces=(datum->>'faces')::integer;amount=(datum->>'count')::integer;
  IF p_kind IN ('resistencia','protecao') AND 'fragilizado'=ANY(conditions) THEN
   faces=scale[greatest(1,array_position(scale,faces)-1)];
  END IF;
  total_extra=total_extra+amount;
  IF total_extra>20 OR (p_kind='teste' AND total_extra>4) OR (p_kind IN ('resistencia','protecao') AND total_extra>1) THEN RAISE EXCEPTION 'Excesso de dados.';END IF;
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
  IF p_context='ataque' AND coalesce((sh#>>'{combat,cbb,completePending}')::boolean,false)
   AND coalesce((sh#>>'{combat,cbb,completeRound}')::integer,0)=coalesce((sh#>>'{combat,round}')::integer,1)
   AND coalesce((sh#>>'{combat,cbb,completeScene}')::integer,0)=coalesce((sh#>>'{combat,scene}')::integer,1) THEN
   complete_attack=true;
   label_text=label_text||' · COMPLETA';
  END IF;
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
    IF prev.label LIKE '% · COMPLETA' THEN
     IF coalesce((sh#>>'{combat,cbb,completeAttackId}')::bigint,-1)<>prev.id
       OR coalesce((sh#>>'{combat,cbb,completeDamageUsed}')::boolean,false)
       OR coalesce((sh#>>'{combat,cbb,completeRound}')::integer,0)<>coalesce((sh#>>'{combat,round}')::integer,1)
       OR coalesce((sh#>>'{combat,cbb,completeScene}')::integer,0)<>coalesce((sh#>>'{combat,scene}')::integer,1)
      THEN RAISE EXCEPTION 'Ação Completa já utilizada ou fora da rodada.';END IF;
     attack_ra=prev.total;complete_damage=true;
    ELSIF prev.special='FALHA CRÍTICA' THEN attack_ra=1;
    ELSE SELECT coalesce(max(coalesce((d->>'effective')::integer,(d->>'value')::integer)),0)
      INTO attack_ra FROM jsonb_array_elements(prev.dice) d WHERE NOT coalesce((d->>'canceled')::boolean,false);
    END IF;
   ELSE attack_ra=p_manual_ra;END IF;
  END IF;
  total=total+p_flat+attack_ra;
  label_text=CASE p_kind WHEN 'dano' THEN 'DANO' WHEN 'resistencia' THEN 'RESISTÊNCIA · '||p_resource WHEN 'protecao' THEN 'PROTEÇÃO · '||p_resource ELSE 'RECUPERAÇÃO' END
   ||CASE WHEN attack_ra<>0 THEN ' · '||(CASE WHEN complete_damage THEN 'RT' ELSE 'RA' END)||' '||attack_ra ELSE '' END
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
 IF complete_attack OR complete_damage THEN
  -- A marca é vinculada ao registro da rolagem, não a um campo livre do navegador.
  updated_sheet=sh;
  IF complete_attack THEN
   updated_sheet=jsonb_set(updated_sheet,'{combat,cbb,completePending}','false'::jsonb,true);
   updated_sheet=jsonb_set(updated_sheet,'{combat,cbb,completeAttackId}',to_jsonb(new_roll.id),true);
  END IF;
  IF complete_damage THEN
   updated_sheet=jsonb_set(updated_sheet,'{combat,cbb,completeDamageUsed}','true'::jsonb,true);
  END IF;
  SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_sheet_id THEN updated_sheet ELSE x.value END ORDER BY x.ord)
   INTO all_sheets FROM jsonb_array_elements(doc->'sheets') WITH ORDINALITY x(value,ord);
  UPDATE public.ae_document SET data=jsonb_set(doc,'{sheets}',all_sheets),
    revision=revision+1,changed_at=now() WHERE id=1;
 END IF;
 RETURN to_jsonb(new_roll)||jsonb_build_object('complete_attack',complete_attack,
   'complete_damage',complete_damage,'damage_basis',CASE WHEN complete_damage THEN 'RT' ELSE 'RA' END,
   'rt',total,'ra',ra,'rb',rb,'attack_ra',attack_ra,
   'kind_cbb',p_kind,'context',p_context,'reaction',p_reaction,'group',grp,
   'groupDie',rolled_group,'skillDie',rolled_skill,'autoGroupSteps',auto_g,'autoSkillSteps',auto_s,
   'fragilized',p_kind IN ('resistencia','protecao') AND 'fragilizado'=ANY(conditions),
   'fearDie',fear_size,'fearRoll',fear_value,'fearClear',fear_size>0 AND fear_value=1,
   'hollowDie',CASE WHEN hollow_on THEN 6 ELSE 0 END,'hollowRoll',hollow_value,
   'hollowLost',hollow_on AND special='FALHA CRÍTICA');
END $function$
;
