-- Organização pontual, com bloqueio de linha e permissão de mestre.
-- Não substitui o documento inteiro e não altera custos, textos ou fichas vinculadas.
CREATE OR REPLACE FUNCTION public.ae_sheet_move_ability(
 p_sheet_id text,p_from_index integer,p_target_index integer DEFAULT NULL,
 p_after boolean DEFAULT false,p_group_id text DEFAULT '',
 p_expected_name text DEFAULT NULL,p_target_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_doc jsonb;v_revision bigint;v_sh jsonb;v_sheet_index integer;
 v_items jsonb;v_rest jsonb;v_moved jsonb;v_result jsonb;v_head jsonb;v_tail jsonb;
 v_group text;v_insert integer;v_target jsonb;v_updated_revision bigint;
 v_old_billing jsonb;v_new_billing jsonb;v_old_index integer;v_rest_index integer;
 v_old_key text;v_new_key text;v_new_index integer;v_legacy_key text;
BEGIN
 IF NOT public.ae_is_master() THEN RAISE EXCEPTION 'Somente o mestre pode organizar habilidades.';END IF;
 SELECT data,revision INTO v_doc,v_revision FROM public.ae_document WHERE id=1 FOR UPDATE;
 IF v_doc IS NULL THEN RAISE EXCEPTION 'Documento indisponível.';END IF;
 SELECT x.value, x.ordinality-1 INTO v_sh,v_sheet_index
 FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) WITH ORDINALITY x(value,ordinality)
 WHERE x.value->>'id'=p_sheet_id LIMIT 1;
 IF v_sh IS NULL THEN RAISE EXCEPTION 'Ficha não encontrada.';END IF;
 v_items=coalesce(v_sh->'abilities','[]'::jsonb);
 IF jsonb_typeof(v_items)<>'array' THEN RAISE EXCEPTION 'Formato de habilidades inválido.';END IF;
 IF p_from_index IS NULL OR p_from_index<0 OR p_from_index>=jsonb_array_length(v_items)
 THEN RAISE EXCEPTION 'Habilidade inexistente.';END IF;
 v_moved=v_items->p_from_index;
 IF coalesce((v_moved#>>'{origin,auto}')::boolean,false) THEN
  RAISE EXCEPTION 'Habilidades geradas automaticamente não podem ser movidas.';
 END IF;
 IF p_expected_name IS NOT NULL AND v_moved->>'name' IS DISTINCT FROM p_expected_name
 THEN RAISE EXCEPTION 'A ficha mudou. Atualize antes de reorganizar.';END IF;
 v_group=coalesce(p_group_id,'');
 IF length(v_group)>100 THEN RAISE EXCEPTION 'Identificador de categoria inválido.';END IF;
 IF v_group<>'' AND NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(v_sh->'abilityGroups','[]'::jsonb)) g
   WHERE g->>'id'=v_group
 ) THEN RAISE EXCEPTION 'Categoria não encontrada.';END IF;
 IF p_target_index IS NOT NULL THEN
  IF p_target_index<0 OR p_target_index>=jsonb_array_length(v_items)
   THEN RAISE EXCEPTION 'Posição de destino inválida.';END IF;
  v_target=v_items->p_target_index;
  IF p_target_name IS NOT NULL AND v_target->>'name' IS DISTINCT FROM p_target_name
   THEN RAISE EXCEPTION 'A habilidade de destino mudou. Atualize a página.';END IF;
  IF coalesce(v_target->>'groupId','')<>v_group
   THEN RAISE EXCEPTION 'A habilidade de destino pertence a outra categoria.';END IF;
 END IF;
 v_moved=jsonb_set(v_moved,'{groupId}',to_jsonb(v_group),true);
 v_rest=v_items-p_from_index;
 IF p_target_index IS NULL THEN
  v_insert=jsonb_array_length(v_rest);
 ELSIF p_target_index=p_from_index THEN
  v_insert=p_from_index;
 ELSIF coalesce(p_after,false) THEN
  v_insert=p_target_index+CASE WHEN p_from_index<p_target_index THEN 0 ELSE 1 END;
 ELSE
  v_insert=p_target_index-CASE WHEN p_from_index<p_target_index THEN 1 ELSE 0 END;
 END IF;
 v_insert=greatest(0,least(jsonb_array_length(v_rest),v_insert));
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ordinality),'[]'::jsonb)
 INTO v_head FROM jsonb_array_elements(v_rest) WITH ORDINALITY x(value,ordinality)
 WHERE x.ordinality<=v_insert;
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ordinality),'[]'::jsonb)
 INTO v_tail FROM jsonb_array_elements(v_rest) WITH ORDINALITY x(value,ordinality)
 WHERE x.ordinality>v_insert;
 v_result=v_head||jsonb_build_array(v_moved)||v_tail;
 -- A Mesa usa abilityId quando disponível; habilidades legadas usam "legacy:<índice>".
 -- Transportar a cobrança junto com a habilidade preserva suas ativações e limites
 -- quando a lista muda de posição durante uma cena.
 v_old_billing=coalesce(v_sh#>'{abilityRuntime,billing}','{}'::jsonb);
 IF jsonb_typeof(v_old_billing)='object' AND v_old_billing<>'{}'::jsonb THEN
  v_new_billing=v_old_billing;
  FOR v_legacy_key IN SELECT k FROM jsonb_object_keys(v_old_billing) k
   WHERE k LIKE 'legacy:%' LOOP
   v_new_billing=v_new_billing-v_legacy_key;
  END LOOP;
  FOR v_new_index IN 0..jsonb_array_length(v_result)-1 LOOP
   IF v_new_index=v_insert THEN
    v_old_index=p_from_index;
   ELSE
    v_rest_index=v_new_index-CASE WHEN v_new_index>v_insert THEN 1 ELSE 0 END;
    v_old_index=v_rest_index+CASE WHEN v_rest_index>=p_from_index THEN 1 ELSE 0 END;
   END IF;
   v_old_key=public.ae_ability_billing_key(v_items->v_old_index,v_old_index);
   v_new_key=public.ae_ability_billing_key(v_result->v_new_index,v_new_index);
   IF v_old_billing?v_old_key THEN
    v_new_billing=jsonb_set(v_new_billing,ARRAY[v_new_key],v_old_billing->v_old_key,true);
   END IF;
  END LOOP;
  v_sh=jsonb_set(v_sh,'{abilityRuntime,billing}',v_new_billing,true);
 END IF;
 v_sh=jsonb_set(v_sh,'{abilities}',v_result,true);
 v_doc=jsonb_set(v_doc,ARRAY['sheets',v_sheet_index::text],v_sh,true);
 UPDATE public.ae_document SET data=v_doc,revision=revision+1,changed_at=now()
 WHERE id=1 RETURNING revision INTO v_updated_revision;
 RETURN jsonb_build_object('revision',v_updated_revision,'sheet',v_sh);
END $fn$;

CREATE OR REPLACE FUNCTION public.ae_warehouse_move_post(
 p_post_id text,p_target_id text DEFAULT NULL,p_after boolean DEFAULT false,
 p_category text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_doc jsonb;v_warehouse jsonb;v_posts jsonb;v_rest jsonb;
 v_item jsonb;v_target jsonb;v_category text;
 v_from integer;v_target_index integer;v_insert integer;v_head jsonb;v_tail jsonb;
 v_result jsonb;v_revision bigint;
BEGIN
 IF NOT public.ae_is_master() THEN RAISE EXCEPTION 'Somente o mestre pode organizar o Armazém.';END IF;
 SELECT data INTO v_doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 IF v_doc IS NULL THEN RAISE EXCEPTION 'Armazém indisponível.';END IF;
 v_warehouse=coalesce(v_doc#>'{site,warehouse}','{}'::jsonb);
 v_posts=coalesce(v_warehouse->'posts','[]'::jsonb);
 SELECT x.ordinality-1,x.value INTO v_from,v_item
 FROM jsonb_array_elements(v_posts) WITH ORDINALITY x(value,ordinality)
 WHERE x.value->>'id'=p_post_id LIMIT 1;
 IF v_item IS NULL THEN RAISE EXCEPTION 'Publicação não encontrada no Armazém editável.';END IF;
 v_category=coalesce(p_category,v_item->>'category');
 IF v_category IS NULL OR length(v_category)>40 OR NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements_text(coalesce(v_warehouse->'categories','[]'::jsonb)) c
  WHERE c.value=v_category
 ) THEN RAISE EXCEPTION 'Categoria inválida.';END IF;
 IF p_target_id IS NOT NULL AND p_target_id<>'' THEN
  SELECT x.ordinality-1,x.value INTO v_target_index,v_target
  FROM jsonb_array_elements(v_posts) WITH ORDINALITY x(value,ordinality)
  WHERE x.value->>'id'=p_target_id LIMIT 1;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Publicação de destino não encontrada.';END IF;
  IF v_target->>'category' IS DISTINCT FROM v_category
   THEN RAISE EXCEPTION 'Destino pertence a outra categoria.';END IF;
 END IF;
 v_item=jsonb_set(v_item,'{category}',to_jsonb(v_category),true);
 v_rest=v_posts-v_from;
 IF v_target_index IS NULL THEN v_insert=jsonb_array_length(v_rest);
 ELSIF v_from=v_target_index THEN v_insert=v_from;
 ELSIF coalesce(p_after,false) THEN
  v_insert=v_target_index+CASE WHEN v_from<v_target_index THEN 0 ELSE 1 END;
 ELSE v_insert=v_target_index-CASE WHEN v_from<v_target_index THEN 1 ELSE 0 END;
 END IF;
 v_insert=greatest(0,least(jsonb_array_length(v_rest),v_insert));
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ordinality),'[]'::jsonb)
 INTO v_head FROM jsonb_array_elements(v_rest) WITH ORDINALITY x(value,ordinality)
 WHERE x.ordinality<=v_insert;
 SELECT coalesce(jsonb_agg(x.value ORDER BY x.ordinality),'[]'::jsonb)
 INTO v_tail FROM jsonb_array_elements(v_rest) WITH ORDINALITY x(value,ordinality)
 WHERE x.ordinality>v_insert;
 v_result=v_head||jsonb_build_array(v_item)||v_tail;
 v_doc=jsonb_set(v_doc,'{site,warehouse,posts}',v_result,true);
 UPDATE public.ae_document SET data=v_doc,revision=revision+1,changed_at=now()
 WHERE id=1 RETURNING revision INTO v_revision;
 RETURN jsonb_build_object('revision',v_revision,'post',v_item,'posts',v_result);
END $fn$;

REVOKE ALL ON FUNCTION public.ae_sheet_move_ability(text,integer,integer,boolean,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ae_warehouse_move_post(text,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ae_sheet_move_ability(text,integer,integer,boolean,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ae_warehouse_move_post(text,text,boolean,text) TO authenticated;
