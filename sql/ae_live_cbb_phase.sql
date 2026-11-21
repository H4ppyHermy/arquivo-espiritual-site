-- Controle único de fases durante a Sessão ao Vivo, autoritativo no banco.
-- A atualização do documento dispara o broadcast já existente; nenhuma consulta periódica adicional é criada.
CREATE OR REPLACE FUNCTION public.ae_live_cbb_phase(
 p_action text, p_sheet_id text DEFAULT NULL, p_phase text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $ae_live_phase$
DECLARE
 v_session uuid; v_doc jsonb; v_live jsonb; v_sheet jsonb; v_sheets jsonb;
 v_ids text[]; v_id text; v_phase text; v_scene integer; v_round integer;
 v_revision bigint; v_rpc text;
BEGIN
 IF NOT public.ae_is_master() THEN RAISE EXCEPTION 'Somente o mestre pode sincronizar fases.';END IF;
 IF p_action IS NULL OR p_action NOT IN ('enable','disable','set','advance') THEN
  RAISE EXCEPTION 'Ação de fase inválida.';END IF;
 IF p_phase IS NOT NULL AND p_phase NOT IN ('preparacao','distancia','duelo','desfecho') THEN
  RAISE EXCEPTION 'Fase inválida.';END IF;
 SELECT id INTO v_session FROM public.ae_live_sessions WHERE status='open'
 ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
 IF v_session IS NULL THEN RAISE EXCEPTION 'Inicie uma Sessão ao Vivo para sincronizar as fases.';END IF;
 SELECT data INTO v_doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 v_live=v_doc#>'{site,liveCombat}';
 SELECT coalesce(array_agg(DISTINCT p.sheet_id),'{}'::text[]) INTO v_ids
 FROM public.ae_live_participants p
 WHERE p.session_id=v_session AND p.sheet_id IS NOT NULL
  AND p.left_at IS NULL AND p.removed_at IS NULL;
 IF p_action='enable' THEN
  IF p_sheet_id IS NULL OR length(p_sheet_id)>150 THEN RAISE EXCEPTION 'Ficha inválida.';END IF;
  SELECT x.value INTO v_sheet FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) x(value)
   WHERE x.value->>'id'=p_sheet_id LIMIT 1;
  IF v_sheet IS NULL THEN RAISE EXCEPTION 'Selecione uma ficha para usar como referência.';END IF;
  v_phase=coalesce(v_sheet#>>'{combat,phase}','preparacao');
  v_round=greatest(1,coalesce((v_sheet#>>'{combat,round}')::integer,1));
  v_scene=greatest(1,coalesce((v_sheet#>>'{combat,scene}')::integer,1));
 ELSIF p_action='disable' THEN
  IF v_live IS NOT NULL AND coalesce(v_live->>'sessionId','')=v_session::text THEN
   v_doc=jsonb_set(v_doc,'{site}',coalesce(v_doc->'site','{}'::jsonb)-'liveCombat',true);
   UPDATE public.ae_document SET data=v_doc,revision=revision+1,changed_at=now()
    WHERE id=1 RETURNING revision INTO v_revision;
  END IF;
  RETURN jsonb_build_object('ok',true,'revision',v_revision,'liveCombat',null);
 ELSE
  IF coalesce((v_live->>'enabled')::boolean,false)=false
     OR coalesce(v_live->>'sessionId','')<>v_session::text THEN
    RAISE EXCEPTION 'Ative a sincronização antes de alterar a fase.';END IF;
  v_phase=v_live->>'phase';
  v_round=greatest(1,coalesce((v_live->>'round')::integer,1));
  v_scene=greatest(1,coalesce((v_live->>'scene')::integer,1));
  IF p_action='set' THEN v_phase=coalesce(p_phase,v_phase);END IF;
 END IF;
 IF v_phase NOT IN ('preparacao','distancia','duelo','desfecho') THEN RAISE EXCEPTION 'Fase indisponível.';END IF;
 IF p_action='advance' THEN
  -- Reaproveita ae_cbb_action para as regras reais de fase, exposição e rodada.
  SELECT jsonb_agg(CASE WHEN x.value->>'id'=ANY(v_ids) THEN
   jsonb_set(x.value,'{combat}',coalesce(x.value->'combat','{}'::jsonb)||jsonb_build_object('phase',v_phase,'round',v_round,'scene',v_scene),true)
   ELSE x.value END ORDER BY x.ord)
  INTO v_sheets FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) WITH ORDINALITY x(value,ord);
  UPDATE public.ae_document SET data=jsonb_set(v_doc,'{sheets}',coalesce(v_sheets,'[]'::jsonb)),
   revision=revision+1,changed_at=now() WHERE id=1;
  v_rpc=CASE WHEN v_phase='desfecho' THEN 'round' ELSE 'phase' END;
  PERFORM set_config('ae.live_phase_global','yes',true);
  FOREACH v_id IN ARRAY v_ids LOOP
   PERFORM public.ae_cbb_action(v_id,v_rpc);
  END LOOP;
  PERFORM set_config('ae.live_phase_global','',true);
  IF v_phase='preparacao' THEN v_phase='distancia';
  ELSIF v_phase='distancia' THEN v_phase='duelo';
  ELSIF v_phase='duelo' THEN v_phase='desfecho';
  ELSE v_phase='preparacao';v_round=v_round+1;END IF;
  SELECT data INTO v_doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 ELSE
  SELECT jsonb_agg(CASE WHEN x.value->>'id'=ANY(v_ids) THEN
    jsonb_set(x.value,'{combat}',coalesce(x.value->'combat','{}'::jsonb)||jsonb_build_object('phase',v_phase,'round',v_round,'scene',v_scene),true)
    ELSE x.value END ORDER BY x.ord)
   INTO v_sheets FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) WITH ORDINALITY x(value,ord);
  v_doc=jsonb_set(v_doc,'{sheets}',coalesce(v_sheets,'[]'::jsonb),true);
 END IF;
 v_live=jsonb_build_object('enabled',true,'sessionId',v_session::text,'phase',v_phase,'round',v_round,'scene',v_scene);
 v_doc=jsonb_set(v_doc,'{site,liveCombat}',v_live,true);
 UPDATE public.ae_document SET data=v_doc,revision=revision+1,changed_at=now()
 WHERE id=1 RETURNING revision INTO v_revision;
 SELECT x.value->'combat' INTO v_sheet FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) x(value)
 WHERE x.value->>'id'=p_sheet_id LIMIT 1;
 RETURN jsonb_build_object('ok',true,'revision',v_revision,'liveCombat',v_live,'combat',v_sheet,'syncedSheets',cardinality(v_ids));
END $ae_live_phase$;
REVOKE ALL ON FUNCTION public.ae_live_cbb_phase(text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ae_live_cbb_phase(text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ae_live_cbb_phase(text,text,text) TO authenticated;

-- Atualizações pontuais das RPCs existentes, preservando toda a lógica consolidada.
DO $update_live_phase$
DECLARE v_source text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_source FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='ae_cbb_action' LIMIT 1;
 IF v_source IS NULL OR position('combat=coalesce(sh->''combat''' in v_source)=0 THEN
  RAISE EXCEPTION 'ae_cbb_action não compatível'; END IF;
 v_source=replace(v_source,' combat=coalesce(sh->''combat'',''{}''::jsonb);',
 ' IF p_action IN (''phase'',''round'',''scene'',''reset'')
    AND coalesce((doc#>>''{site,liveCombat,enabled}'')::boolean,false)
    AND current_setting(''ae.live_phase_global'',true) IS DISTINCT FROM ''yes''
   THEN RAISE EXCEPTION ''A fase é controlada pelo mestre na Sessão ao Vivo.'';END IF;
 combat=coalesce(sh->''combat'',''{}''::jsonb);');
 v_source=replace(v_source,
  'AND p_action NOT IN (''pin'',''toggleAutomation'',''reset'')',
  'AND p_action NOT IN (''pin'',''toggleAutomation'',''reset'')
   AND NOT (p_action IN (''phase'',''round'') AND current_setting(''ae.live_phase_global'',true)=''yes'')');
 EXECUTE v_source;

 SELECT pg_get_functiondef(p.oid) INTO v_source FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='ae_live_end' LIMIT 1;
 IF v_source IS NULL OR position(' RETURN v_ended;' in v_source)=0 THEN RAISE EXCEPTION 'ae_live_end incompatível';END IF;
 v_source=replace(v_source,' RETURN v_ended;',
  ' UPDATE public.ae_document d SET data=jsonb_set(d.data,''{site}'',
      coalesce(d.data->''site'',''{}''::jsonb)-''liveCombat'',true),
      revision=d.revision+1,changed_at=now()
    WHERE d.id=1 AND d.data#>>''{site,liveCombat,enabled}''=''true'';
   RETURN v_ended;');
 EXECUTE v_source;

 SELECT pg_get_functiondef(p.oid) INTO v_source FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='ae_live_join' LIMIT 1;
 IF v_source IS NULL OR position(' return to_jsonb(v_row);' in v_source)=0 THEN RAISE EXCEPTION 'ae_live_join incompatível';END IF;
 v_source=replace(v_source,' return to_jsonb(v_row);',
 ' IF p_character_id IS NOT NULL THEN
     UPDATE public.ae_document d SET
      data=jsonb_set(d.data,''{sheets}'',(
       SELECT jsonb_agg(CASE WHEN x.value->>''id''=p_character_id THEN
        jsonb_set(x.value,''{combat}'',coalesce(x.value->''combat'',''{}''::jsonb)||jsonb_build_object(''phase'',d.data#>''{site,liveCombat,phase}'',''round'',d.data#>''{site,liveCombat,round}'',''scene'',d.data#>''{site,liveCombat,scene}''),true)
        ELSE x.value END ORDER BY x.ord)
       FROM jsonb_array_elements(coalesce(d.data->''sheets'',''[]''::jsonb)) WITH ORDINALITY x(value,ord)),true),
      revision=d.revision+1,changed_at=now()
     WHERE d.id=1 AND d.data#>>''{site,liveCombat,enabled}''=''true''
      AND d.data#>>''{site,liveCombat,sessionId}''=v_id::text;
   END IF;
   return to_jsonb(v_row);');
 EXECUTE v_source;

 SELECT pg_get_functiondef(p.oid) INTO v_source FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='ae_master_replace' LIMIT 1;
 IF v_source IS NULL OR position('data=(p_data-''keys''-''keysChanged'')' in v_source)=0 THEN RAISE EXCEPTION 'ae_master_replace incompatível';END IF;
 v_source=replace(v_source,'data=(p_data-''keys''-''keysChanged'')',
 'data=CASE WHEN data#>''{site,liveCombat}'' IS NOT NULL THEN
   jsonb_set(p_data-''keys''-''keysChanged'',''{site,liveCombat}'',data#>''{site,liveCombat}'',true)
   ELSE p_data-''keys''-''keysChanged'' END');
 EXECUTE v_source;
END $update_live_phase$;