# Bleach CBB · Discord (somente dados)

O Discord e o Arquivo Espiritual compartilham exclusivamente **rolagens de dados**. Não há vinculação de conta Discord com chave de jogador ou mestre, consulta de fichas, exportação JSON, DMs de fichas ou navegação privada.

## Comandos

- `br 2d6 + 1d4` — rolagem por mensagem, com descrição opcional após `|`
- `bajuda` — ajuda de rolagens
- `bhistorico` — histórico público de rolagens
- `/rolar`, `/ajuda`, `/historico` — equivalentes por comandos de barra

As rolagens feitas no Discord são registradas em `ae_rolls` e aparecem no histórico do site. As rolagens verificadas do site podem ser notificadas no canal Discord por `/notify`. Rolagens ocultas e rolagens de fichas privadas não são publicadas no Discord. **As fichas continuam sendo gerenciadas somente no site.**

## Componentes

- `gateway.mjs`: recebe mensagens de prefixo e sincroniza os comandos de barra no servidor na conexão
- `index.ts`: Edge Function Supabase, assinaturas Discord, histórico compartilhado e notificações de rolagem
- `dice.mjs`: validação e RNG de dados
- `card.mjs`: cartões de dados (críticos e falhas críticas)
- `commands.mjs`: registro de comandos de barra
- `schema.sql`: campos de auditoria/idempotência de rolagens, sem contas vinculadas
- `test.mjs`: testes de regras, parser e ausência de comandos de ficha

Segredos `DISCORD_BOT_TOKEN` e `SUPABASE_SERVICE_ROLE_KEY` devem ficar somente nos ambientes Railway/Supabase, nunca no GitHub. O Gateway Railway usa `CBB_PREFIX_ENDPOINT` e `DISCORD_GUILD_ID`. O endpoint `/prefix` autentica pela credencial do bot; a rota de interações verifica assinaturas Ed25519. O cadastro de comandos em guild usa PUT, substituindo comandos antigos.
