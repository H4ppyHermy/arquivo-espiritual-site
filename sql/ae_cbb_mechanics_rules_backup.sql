CREATE SCHEMA IF NOT EXISTS ae_editorial_private;
REVOKE ALL ON SCHEMA ae_editorial_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS ae_editorial_private.cbb_mechanics_backup (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 source_revision bigint NOT NULL,
 rules jsonb NOT NULL,
 note text NOT NULL
);
ALTER TABLE ae_editorial_private.cbb_mechanics_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ae_editorial_private.cbb_mechanics_backup FROM PUBLIC, anon, authenticated;
INSERT INTO ae_editorial_private.cbb_mechanics_backup(source_revision,rules,note)
 SELECT revision,data->'rules','CBB — antes da Ação Completa e Exposição Espiritual'
 FROM public.ae_document WHERE id=1;
