-- Autovínculo explícito, sem expor fichas restritas ou tomar vínculos alheios.
-- A autorização é feita na RPC contra a sessão e a chave ativas do usuário.
CREATE OR REPLACE FUNCTION public.ae_joinable_sheets()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_key public.ae_keys%rowtype;
BEGIN
 SELECT k.* INTO v_key FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active
 WHERE se.user_id=auth.uid() AND k.kind='player' LIMIT 1;
 IF v_key.id IS NULL THEN RAISE EXCEPTION 'Entre com uma chave de jogador.';END IF;
 RETURN (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',s.value->>'id','name',left(s.value->>'name',140),
   'subtitle',left(coalesce(s.value->>'subtitle',''),150),
   'level',s.value->'level',
   'open',coalesce((s.value->>'selfLinkEnabled')::boolean,false),
   'mine',public.ae_sheet_linked(s.value,v_key.id,v_key.sheet_id)
  ) ORDER BY s.ord),'[]'::jsonb)
  FROM public.ae_document d,
  LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb))
    WITH ORDINALITY AS s(value,ord)
  WHERE d.id=1
   AND NOT coalesce((s.value->>'masterOnly')::boolean,false)
   AND NOT coalesce((s.value->>'private')::boolean,false)
   AND NOT coalesce((s.value->>'redacted')::boolean,false)
   AND (
    coalesce((s.value->>'selfLinkEnabled')::boolean,false)
    OR (NOT coalesce((s.value->>'locked')::boolean,false)
       AND coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(s.value->'linkedKeyIds')='array'
         THEN s.value->'linkedKeyIds' ELSE '[]'::jsonb END),0)=0)
   )
 );
END $fn$;

CREATE OR REPLACE FUNCTION public.ae_sheet_self_link(p_sheet_id text,p_action text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_key public.ae_keys%rowtype;v_doc jsonb;v_sheet jsonb;
 v_members jsonb;v_owner text;v_sheets jsonb;v_rev bigint;v_open boolean;
BEGIN
 SELECT k.* INTO v_key FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active
 WHERE se.user_id=auth.uid() LIMIT 1;
 IF v_key.id IS NULL OR v_key.kind NOT IN ('player','master') THEN RAISE EXCEPTION 'Entre com uma chave válida.';END IF;
 IF p_action NOT IN ('join','open','close') OR p_sheet_id IS NULL OR length(p_sheet_id)>150
 THEN RAISE EXCEPTION 'Pedido de vínculo inválido.';END IF;
 IF p_action IN ('open','close') AND v_key.kind<>'master'
 THEN RAISE EXCEPTION 'Somente o mestre libera o autovínculo.';END IF;
 IF p_action='join' AND v_key.kind<>'player'
 THEN RAISE EXCEPTION 'Somente o jogador pode se vincular.';END IF;
 SELECT data INTO v_doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 SELECT x.value INTO v_sheet FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) x(value)
 WHERE x.value->>'id'=p_sheet_id LIMIT 1;
 IF v_sheet IS NULL THEN RAISE EXCEPTION 'Ficha indisponível.';END IF;
 IF coalesce((v_sheet->>'masterOnly')::boolean,false)
    OR coalesce((v_sheet->>'private')::boolean,false)
    OR coalesce((v_sheet->>'redacted')::boolean,false)
 THEN RAISE EXCEPTION 'Ficha reservada: vínculo indisponível.';END IF;
 IF p_action IN ('open','close') THEN
  v_sheet=jsonb_set(v_sheet,'{selfLinkEnabled}',to_jsonb(p_action='open'),true);
 ELSE
  v_members=CASE WHEN jsonb_typeof(v_sheet->'linkedKeyIds')='array'
    THEN v_sheet->'linkedKeyIds' ELSE '[]'::jsonb END;
  v_open=coalesce((v_sheet->>'selfLinkEnabled')::boolean,false);
  IF public.ae_sheet_linked(v_sheet,v_key.id,v_key.sheet_id)
  THEN RETURN jsonb_build_object('ok',true,'alreadyLinked',true,'sheet',v_sheet,
      'revision',(SELECT revision FROM public.ae_document WHERE id=1));END IF;
  IF NOT v_open AND (coalesce((v_sheet->>'locked')::boolean,false)
      OR jsonb_array_length(v_members)>0) THEN
    RAISE EXCEPTION 'Esta ficha não foi liberada para autovínculo pelo mestre.';END IF;
  IF jsonb_array_length(v_members)>=12 THEN RAISE EXCEPTION 'Limite de jogadores vinculados.';END IF;
  v_owner=nullif(v_sheet->>'ownerKeyId','');
  v_members=v_members||jsonb_build_array(v_key.id::text);
  IF v_owner IS NULL THEN v_owner=v_key.id::text;END IF;
  v_sheet=v_sheet||jsonb_build_object('linkedKeyIds',v_members,'ownerKeyId',v_owner);
 END IF;
 SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_sheet_id THEN v_sheet ELSE x.value END ORDER BY x.ord)
 INTO v_sheets FROM jsonb_array_elements(v_doc->'sheets') WITH ORDINALITY x(value,ord);
 UPDATE public.ae_document SET data=jsonb_set(v_doc,'{sheets}',v_sheets),revision=revision+1,
 changed_at=now() WHERE id=1 RETURNING revision INTO v_rev;
 RETURN jsonb_build_object('ok',true,'revision',v_rev,'sheet',v_sheet);
END $fn$;

-- Recuperação isolada de erros de controle de turno. Não altera ALMA,
-- habilidades, Vida, exposições ou fases de outras fichas.
CREATE OR REPLACE FUNCTION public.ae_cbb_correct_turn(p_sheet_id text,p_action text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_key public.ae_keys%rowtype;v_doc jsonb;v_sheet jsonb;v_combat jsonb;v_cbb jsonb;
 v_sheets jsonb;v_rev bigint;
BEGIN
 SELECT k.* INTO v_key FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id AND k.active
 WHERE se.user_id=auth.uid() LIMIT 1;
 IF v_key.id IS NULL OR v_key.kind NOT IN ('master','player') THEN RAISE EXCEPTION 'Chave inválida.';END IF;
 IF p_action NOT IN ('reset_main','reset_reaction','cancel_complete')
 OR p_sheet_id IS NULL OR length(p_sheet_id)>150 THEN RAISE EXCEPTION 'Correção inválida.';END IF;
 SELECT data INTO v_doc FROM public.ae_document WHERE id=1 FOR UPDATE;
 SELECT x.value INTO v_sheet FROM jsonb_array_elements(coalesce(v_doc->'sheets','[]'::jsonb)) x(value)
 WHERE x.value->>'id'=p_sheet_id LIMIT 1;
 IF v_sheet IS NULL THEN RAISE EXCEPTION 'Ficha inexistente.';END IF;
 IF coalesce((v_sheet->>'masterOnly')::boolean,false) AND v_key.kind<>'master'
 THEN RAISE EXCEPTION 'Ficha exclusiva do mestre.';END IF;
 IF v_key.kind='player' AND NOT public.ae_sheet_linked(v_sheet,v_key.id,v_key.sheet_id)
 THEN RAISE EXCEPTION 'Esta ficha não está vinculada à sua chave.';END IF;
 IF coalesce((v_sheet->>'automationEnabled')::boolean,true)=false
 THEN RAISE EXCEPTION 'Ative a automação primeiro.';END IF;
 v_combat=coalesce(v_sheet->'combat','{}'::jsonb);
 v_cbb=coalesce(v_combat->'cbb','{}'::jsonb);
 IF p_action='cancel_complete' THEN
  IF NOT coalesce((v_cbb->>'completePending')::boolean,false)
     OR coalesce((v_cbb->>'completeAbilitySpent')::boolean,false)
     OR nullif(v_cbb->>'completeAttackId','') IS NOT NULL
  THEN RAISE EXCEPTION 'Não é possível cancelar: o ataque já foi iniciado ou a ação completa não está pendente.';END IF;
  v_combat=jsonb_set(v_combat,'{mainUsed}','false'::jsonb,true);
  v_combat=jsonb_set(v_combat,'{reactionUsed}','false'::jsonb,true);
  v_cbb=jsonb_set(v_cbb,'{completePending}','false'::jsonb,true);
  v_cbb=jsonb_set(v_cbb,'{completeAbilitySpent}','false'::jsonb,true);
 ELSE
  IF coalesce((v_cbb->>'completePending')::boolean,false)
  THEN RAISE EXCEPTION 'Ação Completa pendente: cancele-a antes de corrigir as ações.';END IF;
  IF p_action='reset_main' THEN
   v_combat=jsonb_set(v_combat,'{mainUsed}','false'::jsonb,true);
  ELSE
   v_combat=jsonb_set(v_combat,'{reactionUsed}','false'::jsonb,true);
  END IF;
 END IF;
 -- Registro visível da última correção para que o mestre saiba que foi manual.
 v_cbb=jsonb_set(v_cbb,'{lastTurnCorrection}',jsonb_build_object(
  'action',p_action,'at',now(),'round',coalesce(v_combat->'round','1'::jsonb),
  'scene',coalesce(v_combat->'scene','1'::jsonb)),true);
 v_combat=jsonb_set(v_combat,'{cbb}',v_cbb,true);
 v_sheet=jsonb_set(v_sheet,'{combat}',v_combat,true);
 SELECT jsonb_agg(CASE WHEN x.value->>'id'=p_sheet_id THEN v_sheet ELSE x.value END ORDER BY x.ord)
 INTO v_sheets FROM jsonb_array_elements(v_doc->'sheets') WITH ORDINALITY x(value,ord);
 UPDATE public.ae_document SET data=jsonb_set(v_doc,'{sheets}',v_sheets),revision=revision+1,
 changed_at=now() WHERE id=1 RETURNING revision INTO v_rev;
 RETURN jsonb_build_object('ok',true,'revision',v_rev,'combat',v_combat,
  'correction',p_action,'info','Estado da ação corrigido manualmente.');
END $fn$;

REVOKE ALL ON FUNCTION public.ae_joinable_sheets() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ae_sheet_self_link(text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ae_cbb_correct_turn(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ae_joinable_sheets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ae_sheet_self_link(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ae_cbb_correct_turn(text,text) TO authenticated;
