-- Backup privado dos textos de equipamentos e descrições de classes/raças.
CREATE TABLE IF NOT EXISTS ae_editorial_private.cbb_extended_backup(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 source_revision bigint NOT NULL,
 item_descriptions jsonb NOT NULL,
 warehouse_other jsonb NOT NULL
);
ALTER TABLE ae_editorial_private.cbb_extended_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ae_editorial_private.cbb_extended_backup FROM PUBLIC, anon, authenticated;
INSERT INTO ae_editorial_private.cbb_extended_backup(source_revision,item_descriptions,warehouse_other)
SELECT d.revision,
 coalesce((SELECT jsonb_agg(jsonb_build_object('sheet_id',s.value->>'id','index',it.ord,'name',it.value->>'name',
   'description',coalesce(it.value->>'description','')) ORDER BY s.ord,it.ord)
 FROM jsonb_array_elements(coalesce(d.data->'sheets','[]'::jsonb)) WITH ORDINALITY s(value,ord),
 jsonb_array_elements(coalesce(s.value#>'{inventory,items}','[]'::jsonb)) WITH ORDINALITY it(value,ord)),'[]'::jsonb),
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.value->>'id','index',p.ord,
   'category',p.value->>'category','content',coalesce(p.value->>'content','')) ORDER BY p.ord)
 FROM jsonb_array_elements(coalesce(d.data#>'{site,warehouse,posts}','[]'::jsonb)) WITH ORDINALITY p(value,ord)
 WHERE p.value->>'category' NOT IN ('Habilidades','Técnicas')),'[]'::jsonb)
FROM public.ae_document d WHERE d.id=1;