-- Presets de combos da ficha: metadados, sem cobranças automáticas.
-- Atualização isolada que não toca Vida/ALMA, habilidades, ações ou outros dados.
CREATE OR REPLACE FUNCTION public.ae_sheet_set_combos(
 p_sheet_id text,
 p_combos jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_key public.ae_keys%rowtype;
 v_doc jsonb;
 v_sheet jsonb;
 v_sheets jsonb;
 v_combo jsonb;
 v_step jsonb;
 v_seen jsonb := '{}'::jsonb;
 v_id text;
 v_revision bigint;
BEGIN
 SELECT k.* INTO v_key
 FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active
 WHERE se.user_id=auth.uid() AND k.kind IN ('player','master');
 IF v_key.id IS NULL THEN RAISE EXCEPTION 'Entre com sua chave para editar combos.'; END IF;

 IF p_sheet_id IS NULL OR length(p_sheet_id)>100 OR p_sheet_id=''
 THEN RAISE EXCEPTION 'Ficha inválida.'; END IF;
 IF jsonb_typeof(p_combos)<>'array' OR jsonb_array_length(p_combos)>24
    OR length(p_combos::text)>60000
 THEN RAISE EXCEPTION 'Combos inválidos: máximo de 24 combos e 60 KB.'; END IF;

 FOR v_combo IN SELECT value FROM jsonb_array_elements(p_combos) LOOP
  IF jsonb_typeof(v_combo)<>'object'
     OR jsonb_typeof(v_combo->'id')<>'string'
     OR coalesce(v_combo->>'id','') !~ '^[a-zA-Z0-9_-]{3,80}$'
     OR v_seen ? (v_combo->>'id')
     OR jsonb_typeof(v_combo->'name')<>'string'
     OR length(btrim(v_combo->>'name')) NOT BETWEEN 1 AND 70
     OR length(coalesce(v_combo->>'description',''))>500
     OR (v_combo ? 'description' AND jsonb_typeof(v_combo->'description')<>'string')
     OR jsonb_typeof(v_combo->'steps')<>'array'
     OR jsonb_array_length(v_combo->'steps') NOT BETWEEN 1 AND 12
  THEN RAISE EXCEPTION 'Nome, identificador ou etapas de combo inválidos.'; END IF;
  v_id=v_combo->>'id';
  v_seen=jsonb_set(v_seen,ARRAY[v_id],'true'::jsonb,true);
  FOR v_step IN SELECT value FROM jsonb_array_elements(v_combo->'steps') LOOP
   IF jsonb_typeof(v_step)<>'object'
      OR jsonb_typeof(v_step->'name')<>'string'
      OR length(btrim(v_step->>'name')) NOT BETWEEN 1 AND 140
      OR coalesce(v_step->>'kind','') NOT IN ('habilidade','tecnica')
      OR (v_step ? 'abilityId' AND
           (jsonb_typeof(v_step->'abilityId')<>'string' OR length(v_step->>'abilityId')>140))
      OR jsonb_typeof(v_step->'index')<>'number'
      OR coalesce(v_step->>'index','') !~ '^[0-9]{1,3}$'
      OR (v_step->>'index')::integer>199
      OR (v_step ? 'note' AND (jsonb_typeof(v_step->'note')<>'string'
          OR length(v_step->>'note')>220))
   THEN RAISE EXCEPTION 'Referência ou observação de etapa inválida.'; END IF;
  END LOOP;
 END LOOP;

 SELECT data INTO v_doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 IF v_doc IS NULL THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
 SELECT x.value INTO v_sheet
 FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) x(value)
 WHERE x.value->>'id'=p_sheet_id LIMIT 1;
 IF v_sheet IS NULL THEN RAISE EXCEPTION 'Ficha não encontrada.'; END IF;
 IF coalesce((v_sheet->>'masterOnly')::boolean,false) AND v_key.kind<>'master'
 THEN RAISE EXCEPTION 'Ficha exclusiva do mestre.'; END IF;
 IF v_key.kind<>'master' AND NOT
    (v_key.kind='player' AND public.ae_sheet_linked(v_sheet,v_key.id,v_key.sheet_id))
 THEN RAISE EXCEPTION 'Você não pode editar combos desta ficha.'; END IF;

 v_sheet=jsonb_set(v_sheet,'{combos}',p_combos,true);
 SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_sheet_id THEN v_sheet ELSE x.value END ORDER BY x.ord)
 INTO v_sheets FROM jsonb_array_elements(v_doc->'sheets') WITH ORDINALITY x(value,ord);
 UPDATE public.ae_document
 SET data=jsonb_set(v_doc,'{sheets}',v_sheets,true),revision=revision+1,changed_at=now()
 WHERE id=1 RETURNING revision INTO v_revision;

 RETURN jsonb_build_object('revision',v_revision,'combos',p_combos);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.ae_sheet_set_combos(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ae_sheet_set_combos(text,jsonb) TO authenticated;
