# Bleach CBB · Bot do Arquivo Espiritual

Bot híbrido: **Discord Gateway** (mensagens com prefixo, hospedado no Railway) + **Discord Interactions** (comandos /, via Supabase Edge Function). Ambos compartilham o mesmo histórico `public.ae_rolls` do site.

## Comandos

| Digite no canal | Resultado |
| --- | --- |
| `br 2d6 + 1d4` | Rola dois d6 e um d4, somando os resultados |
| `br 1d20 + 3` | Rola um d20 com bônus de +3 |
| `bajuda` | Abre o painel de comandos |
| `bhistorico` | Últimas rolagens do site e Discord |
| `bficha ID` | Consulta uma ficha pública pelo ID |
| `br 2d6 + 1d4 \| Corte do Zangetsu` | Rolagem com uma descrição |
| `CBBajuda`, `CBBhistorico`, `CBBficha ID` | Alternativas antigas ainda aceitas |
| `/rolar`, `/ficha`, `/historico`, `/ajuda` | Comandos de barra também disponíveis |

`CBBrolar` permanece como alternativa antiga para evitar quebrar mensagens existentes. Os atalhos novos são `br`, `bajuda`, `bhistorico` e `bficha`. O prefixo `br` exige **Message Content Intent** no Developer Portal, que já foi ativado.

## Visual

Os cartões exibem a cor secundária roxa; nos especiais a borda muda para **dourado** (CRÍTICO) ou **vermelho** (FALHA CRÍTICA). Os dados efetivamente responsáveis são destacados com 🟡 e 🔴, compatíveis com mobile. Rolagens antigas com dados descartados continuam aparecendo corretamente no histórico.

> A API de embeds do Discord oferece uma cor por cartão, mas não altera a cor arbitrária de palavras individuais. Códigos ANSI funcionam de forma inconsistente no celular; por isso, os números usam marcadores visuais independentes do cliente.

## Regras de dados

- De 1 a 30 dados por expressão, faces de 1 até 1000, sem executar código do usuário.
- Duas ou mais faces iguais de valor **6 ou superior**: **CRÍTICO**; o subtotal dos dados é duplicado, preservando modificadores fixos.
- Duas ou mais faces **1**: **FALHA CRÍTICA**.
- Os atalhos antigos `kh`/`kl` de vantagem/desvantagem **foram removidos** até a implementação do novo sistema. Rolagens históricas permanecem intactas.
- As regras são espelhadas do avaliador do site `ae_avaliar_dados` para as situações comuns, mantendo o mesmo histórico online.

## Infraestrutura ativa

- Supabase Edge Function: `ae-discord-bot`.
- Railway: projeto `Bleach CBB — Comandos Discord`, serviço `cbb-prefix-gateway`, pasta raiz `/discord-bot`.
- Repositório: `H4ppyHermy/arquivo-espiritual-site`.
- `index.ts` recebe webhooks oficiais e relays autorizados; `dice.mjs` valida expressões; `card.mjs` renderiza os cartões; `gateway.mjs` recebe as mensagens no servidor Discord.
- `npm test` executa testes locais de parser, regras e visual (Node 22+). `commands.mjs` mantém as definições de comandos `/` sincronizadas entre Supabase, Railway e `register.mjs`.

## Segurança e manutenção

- **Nunca** envie ou publique `DISCORD_BOT_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY`.
- Configure o token do bot separadamente nos segredos do Supabase e nas variáveis do Railway.
- O endpoint `/prefix` exige o Bot Token e um servidor Discord autorizado.
- O endpoint de interações verifica a assinatura Ed25519 e o timestamp.
- Fichas privadas, bloqueadas e exclusivas do mestre não são divulgadas pelo bot.
- Somente o autor da rolagem pode usar o botão **Re-rolar**.
- As chamadas a `/notify` só publicam rolagens do titular autenticado no site.
- Em emergência, interrompa o serviço `cbb-prefix-gateway` no Railway para desligar apenas os prefixos. Os comandos / e o site permanecem independentes.

### Reversão

O ponto imediatamente anterior a estes atalhos está em `backup/pre-short-prefixes-2026-11-17`. Para reverter, conecte o Railway a essa branch e publique novamente no Supabase `index.ts`, `dice.mjs` e `card.mjs` daquela versão. A branch `main` do site não precisa ser alterada.
