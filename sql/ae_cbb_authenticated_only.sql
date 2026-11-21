-- Apenas contas autenticadas invocam as RPCs de combate privilegiadas.
-- Autorização por chave/ficha permanece verificada dentro das funções.
REVOKE EXECUTE ON FUNCTION public.ae_cbb_action(text,text,integer,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ae_cbb_action(text,text,integer,text,integer,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ae_cbb_roll(text,text,text,text,boolean,integer,integer,jsonb,text,integer,bigint,integer,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ae_cbb_roll(text,text,text,text,boolean,integer,integer,jsonb,text,integer,bigint,integer,integer,boolean) TO authenticated;