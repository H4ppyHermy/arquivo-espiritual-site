CREATE OR REPLACE FUNCTION public.ae_live_end()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $live$
DECLARE v_session uuid;v_ended boolean:=false;
BEGIN
 IF NOT public.ae_is_master() THEN RAISE EXCEPTION 'Somente mestre pode encerrar a sessão.';END IF;
 FOR v_session IN SELECT id FROM public.ae_live_sessions WHERE status='open' LOOP
  PERFORM realtime.send(jsonb_build_object('session_id',v_session),'session-end','ae-video-'||v_session::text,true);
  v_ended=true;
 END LOOP;
 UPDATE public.ae_live_participants SET left_at=now(),camera_on=false
  WHERE session_id IN(SELECT id FROM public.ae_live_sessions WHERE status='open');
 UPDATE public.ae_live_sessions SET status='ended',ended_at=now() WHERE status='open';
 RETURN v_ended;
END $live$;

CREATE OR REPLACE FUNCTION public.ae_live_kick(p_account_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $live$
DECLARE v_session uuid;v_removed integer:=0;
BEGIN
 IF NOT public.ae_is_master() THEN RAISE EXCEPTION 'Somente mestre pode remover participantes.';END IF;
 SELECT id INTO v_session FROM public.ae_live_sessions WHERE status='open' LIMIT 1;
 IF v_session IS NULL THEN RETURN false;END IF;
 UPDATE public.ae_live_participants SET removed_at=now(),left_at=now(),camera_on=false
 WHERE account_id=p_account_id AND session_id=v_session AND left_at IS NULL;
 GET DIAGNOSTICS v_removed=ROW_COUNT;
 IF v_removed>0 THEN
  PERFORM realtime.send(jsonb_build_object('account_id',p_account_id),
   'participant-kicked','ae-video-'||v_session::text,true);
 END IF;
 RETURN v_removed>0;
END $live$;
