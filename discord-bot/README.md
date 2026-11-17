# Bleach CBB · Bot do Arquivo Espiritual

Bot híbrido: **Discord Gateway** no Railway (comandos sem barra) e **Discord Interactions** no Supabase (comandos /). Histórico de dados compartilhado em `public.ae_rolls`.

## Comandos sem barra

| Comando | Função |
| --- | --- |
| `br 2d6 + 1d4` | Rola dados com somas e subtrações |
| `br 1d20 + 3` | Rola com bônus |
| `br 2d6 + 1d4 \| Corte do Zangetsu` | Adiciona descrição |
| `bajuda` | Abre o guia |
| `bhistorico` | Consulta o histórico do site e Discord |
| `bvincular` | Envia por **DM** um código pessoal de vinculação (10 minutos) |
| `bficha ID` | Entrega a **ficha completa ao proprietário, exclusivamente por DM** |

Os aliases `CBBrolar`, `CBBajuda`, `CBBficha` e `CBBhistorico` **foram removidos**. Os comandos de barra `/rolar`, `/ajuda`, `/historico` continuam. `/ficha` apenas orienta o usuário a usar o fluxo privado `bficha`.

Os antigos modificadores `kh` e `kl` de vantagem/desvantagem estão desativados, até a criação do novo sistema.

## Como vincular sua conta e ler sua ficha

1. No Discord (servidor autorizado), digite `bvincular`.
2. O bot envia um código por **mensagem privada**. Se estiver com as DMs bloqueadas, habilite mensagens diretas para membros desse servidor.
3. Entre no site Arquivo Espiritual com sua chave de **jogador**.
4. Abra uma ficha da qual sua chave é **proprietária** e clique em **VINCULAR DISCORD**.
5. Digite o código recebido e clique em **CONECTAR**.
6. No Discord, use `bficha arquivo-hn9c15m7` (ou outro ID de **sua** ficha).

Apenas o proprietário recebe por DM os recursos, atributos, perícias, combate, condições, inventário, vínculos, anotações, habilidades com suas descrições e o **JSON exato da ficha inteira**. O canal público recebe apenas uma confirmação sem os dados da ficha. No site, a janela também permite **desvincular** o Discord.

### Política de acesso

- Saber o ID não dá acesso. O bot valida o vínculo entre **usuário Discord ⇄ conta no site ⇄ chave de jogador ativa ⇄ `ownerKeyId` da ficha** a cada requisição.
- Jogadores vinculados como colaboradores (`linkedKeyIds`) não ganham acesso à ficha por este comando, **se não forem o proprietário**.
- O bot **não entrega fichas exclusivas do mestre**, mesmo quando o ID é conhecido.
- O código é aleatório, de 16 caracteres hexadecimais, guardado **somente como SHA-256**, expira em 10 minutos e é consumido quando vinculado.
- O RPC de confirmação exige sessão real de jogador. As tabelas de vínculos não expõem linhas ao navegador, a anon e a authenticated.
- Alterações de posse da chave, revogações e mudanças de conta invalidam o vínculo de consulta automaticamente.
- O site contém um botão para desconectar o Discord; novo vínculo substitui o anterior, um por conta/chave.

## Visual e exportação

- Cartões de rolagens roxos; críticos dourados com 🟡 nos dados correspondentes; falhas críticas avermelhadas com 🔴.
- Fichas entregues em grupos de embeds com identidades, recursos, atributos, combate, perícias, itens, vínculos, anotações, estados e **todas as habilidades**, inclusive suas descrições completas.
- A mensagem privada inclui anexo `ficha-<ID>.json`, preservando campos adicionais, automações, aparências, referências de imagem e dados que não tenham correspondência visual.
- Somente o autor da rolagem pode utilizar o botão **Re-rolar**.
- Não exiba as DMs de ficha em canais públicos: o bot jamais envia o payload `dmSheet` a uma resposta do servidor.

## Arquitetura

- `discord-bot/dice.mjs`: parser e motor de dados.
- `discord-bot/card.mjs`: visuais de rolagens e ajuda.
- `discord-bot/sheet-dm.mjs`: apresentação de ficha privada e exportação integral.
- `discord-bot/index.ts`: Supabase Edge Function `ae-discord-bot`, assinatura Discord, autenticação e consulta ao banco.
- `discord-bot/gateway.mjs`: Railway Gateway, entrega privada de DMs, comandos sem barra.
- `discord-bot/commands.mjs`: comandos /.
- `discord-bot/link-schema.sql`: esquema para vinculação segura de usuário.
- `discord-bot/owner-access.sql`: autorização transacional e consulta privada por proprietário.
- `discord-bot/test.mjs`: testes em Node 22+ via `npm test`.

O token Discord fica nos segredos do Railway e Supabase, **nunca no repositório**. As funções no site `ARQUIVO_SYNC.discordLinkStatus/discordConfirm/discordUnlink` usam a sessão autenticada existente. O endpoint `/prefix` só aceita chamadas com o token Bot, apenas do servidor configurado.

## Operação e reversão

- Railway: projeto **Bleach CBB — Comandos Discord**, serviço `cbb-prefix-gateway`, pasta `/discord-bot`.
- Supabase: `ae-discord-bot`, com `index.ts`, `dice.mjs`, `card.mjs` e `commands.mjs`, mais RPCs de vínculo e acesso privado.
- O site publicado usa `index.html` e `online.js` com botão de vinculação na página da ficha do proprietário.
- Backup de bot anterior: `backup/pre-private-discord-sheet-2026-11-17`.
- Para reverter, restaure `index.ts`, `dice.mjs`, `card.mjs`, `commands.mjs` no Supabase e reconecte o Railway à branch de backup. O esquema de vínculo no banco pode permanecer sem impactar os recursos anteriores.

Atenção: se um usuário compartilhar manualmente o JSON ou a DM recebida, esse compartilhamento é responsabilidade dele. O bot não reenvia a ficha em canais.

- O acesso privado usa a função `ae_discord_owner_sheet`, executável apenas por `service_role`, validando o proprietário atomicamente.
