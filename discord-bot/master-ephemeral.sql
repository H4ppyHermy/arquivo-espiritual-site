-- Vinculação de jogadores e mestres com a própria conta de site, nunca por ID de Discord.
CREATE OR REPLACE FUNCTION public.ae_discord_confirm_link(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_acc uuid;v_key uuid;v_challenge public.ae_discord_link_challenges%rowtype;v_code text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login no Arquivo Espiritual.';END IF;
 SELECT a.id,k.id INTO v_acc,v_key
 FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id
 WHERE se.user_id=auth.uid() AND k.active=true AND k.kind IN ('player','master') LIMIT 1;
 IF v_acc IS NULL THEN RAISE EXCEPTION 'Entre com uma chave de jogador ou mestre ativa para vincular o Discord.';END IF;
 v_code=upper(regexp_replace(coalesce(p_code,''),'[[:space:]-]','','g'));
 IF v_code !~ '^[A-F0-9]{16}$' THEN RAISE EXCEPTION 'Código inválido ou incompleto.';END IF;
 SELECT * INTO v_challenge FROM public.ae_discord_link_challenges
 WHERE code_hash=encode(sha256(convert_to(v_code,'UTF8')),'hex')
 AND expires_at>now() FOR UPDATE;
 IF v_challenge.discord_user_id IS NULL THEN RAISE EXCEPTION 'Código inválido ou expirado. Use /vincular no Discord novamente.';END IF;
 DELETE FROM public.ae_discord_links
 WHERE discord_user_id=v_challenge.discord_user_id OR account_id=v_acc OR key_id=v_key;
 INSERT INTO public.ae_discord_links(discord_user_id,account_id,key_id)
 VALUES (v_challenge.discord_user_id,v_acc,v_key);
 DELETE FROM public.ae_discord_link_challenges WHERE discord_user_id=v_challenge.discord_user_id;
 RETURN jsonb_build_object('connected',true,'discordHint','••••' || right(v_challenge.discord_user_id,4));
END
$func$;
CREATE OR REPLACE FUNCTION public.ae_discord_link_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_acc uuid;v_key uuid;v_discord text;
BEGIN
 SELECT a.id,k.id INTO v_acc,v_key
 FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id
 WHERE se.user_id=auth.uid() AND k.active=true AND k.kind IN ('player','master') LIMIT 1;
 IF v_acc IS NULL THEN RETURN jsonb_build_object('connected',false); END IF;
 SELECT l.discord_user_id INTO v_discord FROM public.ae_discord_links l
 WHERE l.account_id=v_acc AND l.key_id=v_key LIMIT 1;
 RETURN jsonb_build_object('connected',v_discord IS NOT NULL,'discordHint',CASE WHEN v_discord IS NULL THEN NULL ELSE '••••'||right(v_discord,4) END);
END
$func$;
CREATE OR REPLACE FUNCTION public.ae_discord_unlink()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_acc uuid;v_key uuid;
BEGIN
 SELECT a.id,k.id INTO v_acc,v_key
 FROM public.ae_sessions se
 JOIN public.ae_accounts a ON a.id=se.account_id AND a.key_id=se.key_id
 JOIN public.ae_keys k ON k.id=se.key_id
 WHERE se.user_id=auth.uid() AND k.active=true AND k.kind IN ('player','master') LIMIT 1;
 IF v_acc IS NULL THEN RAISE EXCEPTION 'Entre com sua chave ativa para desvincular a conta.';END IF;
 DELETE FROM public.ae_discord_links WHERE account_id=v_acc AND key_id=v_key;
 RETURN true;
END
$func$;
REVOKE ALL ON FUNCTION public.ae_discord_confirm_link(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ae_discord_link_status() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ae_discord_unlink() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ae_discord_confirm_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ae_discord_link_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ae_discord_unlink() TO authenticated;

-- Consulta atômica restrita: mestre autenticado pode ver qualquer ficha; jogador só a sua.
CREATE OR REPLACE FUNCTION public.ae_discord_access_sheet(p_discord_user_id text,p_sheet_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $access$
 SELECT sh.value
 FROM public.ae_discord_links l
 JOIN public.ae_accounts a ON a.id=l.account_id AND a.key_id=l.key_id
 JOIN public.ae_keys k ON k.id=l.key_id AND k.active AND k.kind IN ('player','master')
 JOIN public.ae_document d ON d.id=1
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) sh(value)
 WHERE l.discord_user_id=p_discord_user_id
  AND p_sheet_id ~ '^[a-zA-Z0-9_-]{1,100}$'
  AND sh.value->>'id'=p_sheet_id
  AND (
    k.kind='master'
    OR (
      k.kind='player'
      AND NOT coalesce((sh.value->>'masterOnly')::boolean,false)
      AND NOT coalesce((sh.value->>'redacted')::boolean,false)
      AND sh.value->>'ownerKeyId'=l.key_id::text
      AND (
        coalesce(jsonb_typeof(sh.value->'linkedKeyIds'),'null')<>'array'
        OR sh.value->'linkedKeyIds' @> jsonb_build_array(l.key_id::text)
      )
    )
  )
 LIMIT 1
$access$;
REVOKE ALL ON FUNCTION public.ae_discord_access_sheet(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ae_discord_access_sheet(text,text) TO service_role;

-- O token de navegação é privado e expira, mesmo que o ID da ficha seja conhecido.
CREATE TABLE IF NOT EXISTS public.ae_discord_sheet_views (
 token text PRIMARY KEY CHECK (token ~ '^[a-f0-9]{24}$'),
 discord_user_id text NOT NULL CHECK (discord_user_id ~ '^[0-9]{17,22}$'),
 sheet_id text NOT NULL CHECK (sheet_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ae_discord_sheet_views_expiry_idx ON public.ae_discord_sheet_views(expires_at);
ALTER TABLE public.ae_discord_sheet_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ae_discord_sheet_views FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ae_discord_sheet_views TO service_role;
