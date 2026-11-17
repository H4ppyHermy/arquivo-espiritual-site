-- Enforce Discord ownership atomically in the database.
-- Only service_role can execute; a sheet ID alone grants no access.
CREATE OR REPLACE FUNCTION public.ae_discord_owner_sheet(p_discord_user_id text,p_sheet_id text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT sh.value
 FROM public.ae_discord_links l
 JOIN public.ae_accounts a ON a.id=l.account_id AND a.key_id=l.key_id
 JOIN public.ae_keys k ON k.id=l.key_id AND k.kind='player' AND k.active
 JOIN public.ae_document d ON d.id=1
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) sh(value)
 WHERE l.discord_user_id=p_discord_user_id
   AND p_sheet_id ~ '^[a-zA-Z0-9_-]{1,100}$'
   AND sh.value->>'id'=p_sheet_id
   AND sh.value->>'ownerKeyId'=l.key_id::text
   AND NOT coalesce((sh.value->>'masterOnly')::boolean,false)
   AND NOT coalesce((sh.value->>'redacted')::boolean,false)
   AND (
     coalesce(jsonb_typeof(sh.value->'linkedKeyIds'),'null')<>'array'
     OR sh.value->'linkedKeyIds' @> jsonb_build_array(l.key_id::text)
   )
 LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.ae_discord_owner_sheet(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ae_discord_owner_sheet(text,text) TO service_role;
