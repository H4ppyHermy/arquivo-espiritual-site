-- Remove tags marcadas como ocultas dos payloads de visitantes/jogadores.
-- Mestres continuam recebendo tags e metadados integrais.
CREATE OR REPLACE FUNCTION public.ae_read_document()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_data jsonb;v_revision bigint;v_kind text;v_key uuid;v_link text;v_visible jsonb;
BEGIN
 SELECT d.data,d.revision INTO v_data,v_revision FROM public.ae_document d WHERE d.id=1;
 IF v_data IS NULL THEN RETURN jsonb_build_object('data','{}'::jsonb,'revision',0); END IF;
 SELECT k.kind,k.id,k.sheet_id INTO v_kind,v_key,v_link
 FROM public.ae_sessions se JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active WHERE se.user_id=auth.uid() LIMIT 1;
 IF v_kind='master' THEN RETURN jsonb_build_object('data',v_data,'revision',v_revision); END IF;
 SELECT coalesce(jsonb_agg(CASE
 WHEN coalesce((s.value->>'locked')::boolean,false)=false OR
 (v_kind='player' AND public.ae_sheet_linked(s.value,v_key,v_link))
 THEN s.value ELSE jsonb_build_object('id',s.value->>'id','name','FICHA DESCONHECIDA','locked',true,'redacted',true)
 END ORDER BY s.ord),'[]'::jsonb) INTO v_visible
 FROM jsonb_array_elements(coalesce(v_data->'sheets','[]'::jsonb)) WITH ORDINALITY s(value,ord)
 WHERE coalesce((s.value->>'masterOnly')::boolean,false)=false;

 -- Remova rascunhos do documento retornado a jogadores ou visitantes.
 -- IDs ocultos também evitam revelar uma classe padrão do bundle após ser despublicada.
 v_data=jsonb_set(v_data,'{site,warehouse,hiddenPosts}',
   coalesce(v_data #> '{site,warehouse,hiddenPosts}','[]'::jsonb) ||
   coalesce((select jsonb_agg(p.value->>'id')
      from jsonb_array_elements(coalesce(v_data #> '{site,warehouse,posts}','[]'::jsonb)) p(value)
      where p.value->'published' = 'false'::jsonb),'[]'::jsonb),true);
 v_data=jsonb_set(v_data,'{site,warehouse,posts}',
   coalesce((select jsonb_agg(
      CASE WHEN jsonb_typeof(p.value->'hiddenTags')='array' THEN
        jsonb_set(
          p.value - 'hiddenTags',
          '{tags}',
          to_jsonb(coalesce((
            select string_agg(btrim(t.value), ', ' order by t.ord)
            from unnest(string_to_array(coalesce(p.value->>'tags',''), ',')) with ordinality as t(value,ord)
            where btrim(t.value)<>''
              and not exists(
                select 1
                from jsonb_array_elements_text(p.value->'hiddenTags') as h(value)
                where lower(btrim(h.value))=lower(btrim(t.value))
              )
          ),'')),
          true
        )
      ELSE p.value - 'hiddenTags' END
      order by p.ord)
     from jsonb_array_elements(coalesce(v_data #> '{site,warehouse,posts}','[]'::jsonb))
      with ordinality p(value,ord)
     where p.value->'published' IS DISTINCT FROM 'false'::jsonb),'[]'::jsonb),true);
 RETURN jsonb_build_object('data',jsonb_set(v_data,'{sheets}',v_visible),'revision',v_revision);
END $function$
;
