-- Preserva a fase do mestre mesmo quando jogadores salvam recursos, inventário ou o editor.
DO $protect_phase$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ae_player_update' LIMIT 1;
 IF src IS NULL OR position('v_sheet=public.ae_reconcile_resource_recovery(v_prior_sheet,v_sheet);' in src)=0
 THEN RAISE EXCEPTION 'ae_player_update incompatível';END IF;
 src=replace(src,'v_sheet=public.ae_reconcile_resource_recovery(v_prior_sheet,v_sheet);',
 'v_sheet=public.ae_reconcile_resource_recovery(v_prior_sheet,v_sheet);
  IF v_doc#>>''{site,liveCombat,enabled}''=''true''
    AND EXISTS(SELECT 1 FROM public.ae_live_participants lp
      WHERE lp.session_id::text=v_doc#>>''{site,liveCombat,sessionId}''
       AND lp.sheet_id=p_sheet_id AND lp.left_at IS NULL AND lp.removed_at IS NULL)
  THEN
    v_sheet=jsonb_set(v_sheet,''{combat}'',
      coalesce(v_sheet->''combat'',''{}''::jsonb) ||
      jsonb_build_object(''phase'',v_doc#>''{site,liveCombat,phase}'',
                         ''round'',v_doc#>''{site,liveCombat,round}'',
                         ''scene'',v_doc#>''{site,liveCombat,scene}''),true);
  END IF;');
 EXECUTE src;

 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ae_player_save_sheet' LIMIT 1;
 IF src IS NULL OR position(E' if v_exists is null then\n  v_sheets=' in src)=0
 THEN RAISE EXCEPTION 'ae_player_save_sheet incompatível';END IF;
 src=replace(src,E' if v_exists is null then\n  v_sheets=',
 ' IF v_doc#>>''{site,liveCombat,enabled}''=''true''
   AND EXISTS(SELECT 1 FROM public.ae_live_participants lp
     WHERE lp.session_id::text=v_doc#>>''{site,liveCombat,sessionId}''
      AND lp.sheet_id=v_id AND lp.left_at IS NULL AND lp.removed_at IS NULL)
  THEN
   v_sheet=jsonb_set(v_sheet,''{combat}'',
     coalesce(v_sheet->''combat'',''{}''::jsonb) ||
     jsonb_build_object(''phase'',v_doc#>''{site,liveCombat,phase}'',
                        ''round'',v_doc#>''{site,liveCombat,round}'',
                        ''scene'',v_doc#>''{site,liveCombat,scene}''),true);
  END IF;
 if v_exists is null then
  v_sheets=');
 EXECUTE src;
END $protect_phase$;