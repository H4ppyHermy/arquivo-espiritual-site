-- Discord ownership pairing. All private rows are service-role only.
CREATE TABLE IF NOT EXISTS public.ae_discord_link_challenges (
 discord_user_id text PRIMARY KEY CHECK (discord_user_id ~ '^[0-9]{17,22}$'),
 code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ae_discord_links (
 discord_user_id text PRIMARY KEY CHECK (discord_user_id ~ '^[0-9]{17,22}$'),
 account_id uuid NOT NULL UNIQUE REFERENCES public.ae_accounts(id) ON DELETE CASCADE,
 key_id uuid NOT NULL UNIQUE REFERENCES public.ae_keys(id) ON DELETE CASCADE,
 linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ae_discord_link_challenges_expiry_idx ON public.ae_discord_link_challenges(expires_at);
ALTER TABLE public.ae_discord_link_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ae_discord_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ae_discord_link_challenges FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.ae_discord_links FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ae_discord_link_challenges TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ae_discord_links TO service_role;

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
 WHERE se.user_id=auth.uid() AND k.active=true AND k.kind='player' LIMIT 1;
 IF v_acc IS NULL THEN RAISE EXCEPTION 'Entre com uma chave de jogador ativa para vincular o Discord.';END IF;
 v_code=upper(regexp_replace(coalesce(p_code,''),'[[:space:]-]','','g'));
 IF v_code !~ '^[A-F0-9]{16}$' THEN RAISE EXCEPTION 'Código inválido ou incompleto.';END IF;
 SELECT * INTO v_challenge FROM public.ae_discord_link_challenges
 WHERE code_hash=encode(sha256(convert_to(v_code,'UTF8')),'hex')
 AND expires_at>now() FOR UPDATE;
 IF v_challenge.discord_user_id IS NULL THEN RAISE EXCEPTION 'Código inválido ou expirado. Use bvincular no Discord novamente.';END IF;
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
 WHERE se.user_id=auth.uid() AND k.active=true AND k.kind='player' LIMIT 1;
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
 WHERE se.user_id=auth.uid() AND k.active=true AND k.kind='player' LIMIT 1;
 IF v_acc IS NULL THEN RAISE EXCEPTION 'Entre como jogador para desvincular sua conta.';END IF;
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
