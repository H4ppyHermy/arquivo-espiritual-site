-- Realtime para INSERTs de dados verificados: publicação existente do projeto.
-- Não altera resultados, fichas nem tipos de rolagem.
DO $add_roll_stream$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_publication_tables
  WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ae_rolls'
 ) THEN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ae_rolls';
 END IF;
END
$add_roll_stream$;

-- Uma referência a ficha removida não passa a ser pública por ausência do ID.
-- Fichas do mestre são sempre restritas, independentemente do campo locked.
CREATE OR REPLACE FUNCTION public.ae_roll_sheet_public(p_sheet_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $body$
 SELECT p_sheet_id IS NULL OR EXISTS(
  SELECT 1 FROM public.ae_document d
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) x(sheet)
  WHERE d.id=1 AND x.sheet->>'id'=p_sheet_id
   AND NOT coalesce((x.sheet->>'masterOnly')::boolean,false)
 );
$body$;

COMMENT ON FUNCTION public.ae_roll_sheet_public(text) IS
'Rolagens em ficha são públicas apenas se a ficha existir e não for exclusiva do mestre.';
