-- Exibição de HUD exclusivamente na sessão: não modifica vínculo de chave ou ficha.
ALTER TABLE public.ae_live_participants
 ADD COLUMN IF NOT EXISTS hud_sheet_id text,
 ADD COLUMN IF NOT EXISTS hud_hide_numbers boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ae_live_hud_choices()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $live$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.ae_is_master() THEN
  RAISE EXCEPTION 'Somente o mestre pode configurar os HUDs.';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',sh.item->>'id','name',left(coalesce(sh.item->>'name',''),100),
  'masterOnly',coalesce((sh.item->>'masterOnly')::boolean,false))
  ORDER BY sh.item->>'name'),'[]'::jsonb) INTO v_result
 FROM public.ae_document d CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) sh(item)
 WHERE d.id=1 AND nullif(sh.item->>'id','') IS NOT NULL
  AND NOT coalesce((sh.item->>'redacted')::boolean,false);
 RETURN v_result;
END $live$;

CREATE OR REPLACE FUNCTION public.ae_live_set_hud(
 p_account_id uuid,p_sheet_id text DEFAULT NULL,p_hide_numbers boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $live$
DECLARE v_session uuid;v_target public.ae_live_participants%rowtype;
 v_sheet text;
BEGIN
 IF NOT public.ae_is_master() THEN
  RAISE EXCEPTION 'Somente o mestre pode configurar o HUD.';
 END IF;
 SELECT id INTO v_session FROM public.ae_live_sessions WHERE status='open' LIMIT 1;
 IF v_session IS NULL THEN RAISE EXCEPTION 'Nenhuma sessão em andamento.';END IF;
 IF p_account_id IS NULL THEN RAISE EXCEPTION 'Participante inválido.';END IF;
 SELECT * INTO v_target FROM public.ae_live_participants
 WHERE session_id=v_session AND account_id=p_account_id
  AND left_at IS NULL AND removed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participante não está na sala.';END IF;
 v_sheet=nullif(btrim(coalesce(p_sheet_id,'')),'');
 IF v_sheet IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.ae_document d
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) sh(item)
  WHERE d.id=1 AND sh.item->>'id'=v_sheet
   AND NOT coalesce((sh.item->>'redacted')::boolean,false)
 ) THEN RAISE EXCEPTION 'Ficha de exibição inexistente.';END IF;
 UPDATE public.ae_live_participants
  SET hud_sheet_id=v_sheet,hud_hide_numbers=coalesce(p_hide_numbers,false)
 WHERE session_id=v_session AND account_id=p_account_id
 RETURNING * INTO v_target;
 PERFORM realtime.send(jsonb_build_object('account_id',p_account_id),
  'hud-updated','ae-video-'||v_session::text,true);
 RETURN to_jsonb(v_target);
END $live$;

CREATE OR REPLACE FUNCTION public.ae_live_hud()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $live$
DECLARE v_session uuid;v_result jsonb;
BEGIN
 SELECT s.id INTO v_session
 FROM public.ae_live_sessions s
 JOIN public.ae_live_participants p ON p.session_id=s.id
 WHERE s.status='open' AND p.user_id=auth.uid()
  AND p.left_at IS NULL AND p.removed_at IS NULL
  AND p.last_seen>now()-interval '70 seconds'
 LIMIT 1;
 IF v_session IS NULL THEN RETURN '[]'::jsonb;END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',sh.item->>'id','name',left(coalesce(sh.item->>'name',''),100),
  'image',coalesce(sh.item->'image','null'::jsonb),
  'resources',coalesce(sh.item->'resources','{}'::jsonb),
  'conditions',coalesce(sh.item->'conditions','[]'::jsonb),
  'appearance',coalesce(sh.item->'appearance','{}'::jsonb)
 ) ORDER BY sh.item->>'name'),'[]'::jsonb) INTO v_result
 FROM public.ae_document d
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) sh(item)
 WHERE d.id=1 AND EXISTS (
  SELECT 1 FROM public.ae_live_participants p
  WHERE p.session_id=v_session
   AND coalesce(p.hud_sheet_id,p.sheet_id)=sh.item->>'id'
   AND p.left_at IS NULL AND p.removed_at IS NULL
   AND p.last_seen>now()-interval '70 seconds'
 );
 RETURN v_result;
END $live$;

REVOKE ALL ON FUNCTION public.ae_live_hud_choices() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ae_live_set_hud(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ae_live_hud_choices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ae_live_set_hud(uuid,text,boolean) TO authenticated;
