-- Ações universais: um update por ação; nenhuma habilidade específica por personagem.
CREATE OR REPLACE FUNCTION public.ae_cbb_action(
 p_sheet_id text,p_action text,p_ability_index integer DEFAULT NULL,
 p_resource text DEFAULT NULL,p_value integer DEFAULT NULL,p_exposure text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $cbb$
DECLARE ac_id uuid; key_id uuid;key_kind text;key_sheet text;doc jsonb;sh jsonb;ab jsonb;
 combat jsonb;exposures jsonb;rt jsonb; billing jsonb;preview jsonb;old_entry jsonb;
 current_alma integer;cost integer;current_resource integer;max_resource integer;
 scene_num integer;round_num integer;phase text;exposure_level integer;
 need_main boolean:=false;need_reaction boolean:=false;is_locked boolean:=false;
 state_key text;v_mode text;v_limit text;desc_text text;
 extra_main integer;extra_reaction integer;uses_in_scene integer;
 v_result jsonb;rows jsonb;v_rev bigint;change_target text;rhythm_level integer;hit_count integer;raised_round integer;pending_rhythm boolean;phase_req text;ability_ix integer;boss_ratio numeric;boss_partner jsonb;boss_party jsonb;party_old integer;party_new integer;vida_step integer;max_old integer;max_new integer;current_old integer;
BEGIN
 IF p_sheet_id IS NULL OR length(p_sheet_id)>150 OR p_action NOT IN
  ('ability','deactivate','main','reaction','phase','round','scene','adjust','expose','contain','commit','hit','party')
 THEN RAISE EXCEPTION 'Ação inválida.';END IF;
 SELECT a.id,k.id,k.kind,k.sheet_id INTO ac_id,key_id,key_kind,key_sheet
 FROM public.ae_sessions se JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active WHERE se.user_id=auth.uid() LIMIT 1;
 IF ac_id IS NULL OR key_kind NOT IN ('master','player') THEN RAISE EXCEPTION 'Entre para usar a ficha.';END IF;
 IF p_action='deactivate' THEN
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
 combat=coalesce(sh->'combat','{}'::jsonb);
 combat=combat||jsonb_build_object('cbb',coalesce(combat->'cbb','{}'::jsonb));
 exposures=coalesce(sh->'exposures','{}'::jsonb);
 rt=coalesce(sh->'abilityRuntime','{}'::jsonb);
 scene_num=greatest(1,coalesce((combat->>'scene')::integer,1));
 round_num=greatest(1,coalesce((combat->>'round')::integer,1));
 phase=coalesce(combat->>'phase','preparacao');
 extra_main=greatest(0,coalesce((combat#>>'{cbb,extraMain}')::integer,0));
 extra_reaction=greatest(0,coalesce((combat#>>'{cbb,extraReaction}')::integer,0));
 IF p_action='ability' THEN
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
 ELSIF p_action IN ('main','reaction') THEN
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
  IF p_exposure NOT IN ('defensiva','ofensiva','ritmica') THEN RAISE EXCEPTION 'Exposição inválida.';END IF;
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
   'exposures',sh->'exposures','abilityRuntime',sh->'abilityRuntime','boss',sh->'boss','info',coalesce(v_result,'{}'::jsonb));
END $cbb$;
REVOKE ALL ON FUNCTION public.ae_cbb_action(text,text,integer,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ae_cbb_action(text,text,integer,text,integer,text) TO authenticated;
