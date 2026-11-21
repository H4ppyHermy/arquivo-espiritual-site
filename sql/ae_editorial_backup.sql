-- Cópia restaurável exclusivamente no banco antes da revisão editorial.
-- Não expõe descrições privadas em arquivos públicos nem na API de dados.
CREATE SCHEMA IF NOT EXISTS ae_editorial_private;
REVOKE ALL ON SCHEMA ae_editorial_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS ae_editorial_private.cbb_text_backup(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 source_revision bigint NOT NULL,
 sheet_abilities jsonb NOT NULL,
 warehouse_entries jsonb NOT NULL,
 note text NOT NULL
);
ALTER TABLE ae_editorial_private.cbb_text_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ae_editorial_private.cbb_text_backup FROM PUBLIC, anon, authenticated;
INSERT INTO ae_editorial_private.cbb_text_backup(source_revision,sheet_abilities,warehouse_entries,note)
SELECT d.revision,
 coalesce((SELECT jsonb_agg(jsonb_build_object('sheet_id',s.value->>'id','index',a.ord-1,
 'name',a.value->>'name','description',coalesce(a.value->>'description','')) ORDER BY s.ord,a.ord)
 FROM jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) WITH ORDINALITY s(value,ord),
 jsonb_array_elements(coalesce(s.value->'abilities','[]'::jsonb)) WITH ORDINALITY a(value,ord)),'[]'::jsonb),
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.value->>'id','index',p.ord-1,
 'category',p.value->>'category','title',p.value->>'title','content',coalesce(p.value->>'content','')) ORDER BY p.ord)
 FROM jsonb_array_elements(coalesce(d.data#>'{site,warehouse,posts}','[]'::jsonb)) WITH ORDINALITY p(value,ord)
 WHERE p.value->>'category' IN ('Habilidades','Técnicas')),'[]'::jsonb),
 'Cópia dos textos anterior à revisão editorial universal. Custos e mecânicas não são alterados.'
FROM public.ae_document d WHERE d.id=1
RETURNING id,source_revision;