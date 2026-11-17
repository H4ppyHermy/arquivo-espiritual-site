-- Alteração aditiva, reversível: nenhuma ficha ou rolagem existente é modificada.
-- Interaction ID permite responder a retries do Discord sem duplicar rolagens.
alter table public.ae_rolls
  add column if not exists discord_interaction_id text,
  add column if not exists discord_user_id text,
  add column if not exists discord_message_id text;
create unique index if not exists ae_rolls_discord_interaction_unique
  on public.ae_rolls (discord_interaction_id) where discord_interaction_id is not null;
comment on column public.ae_rolls.discord_interaction_id is 'ID da interação Discord, para idempotência.';
comment on column public.ae_rolls.discord_user_id is 'Identificador do autor no Discord; não é uma chave mestre do site.';
comment on column public.ae_rolls.discord_message_id is 'Mensagem de notificação publicada no canal do Discord.';
