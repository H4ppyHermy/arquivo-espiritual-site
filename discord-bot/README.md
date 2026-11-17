# Bleach CBB · Bot do Arquivo Espiritual

Bot híbrido: **Discord Gateway** (mensagens com prefixo, hospedado no Railway) + **Discord Interactions** (comandos /, via Supabase Edge Function). Ambos compartilham o mesmo histórico `public.ae_rolls` do site.

## Comandos

| Digite no canal | Resultado |
| --- | --- |
| `br 2d6 + 1d4` | Rola dois d6 e um d4, somando os resultados |
| `br 1d20 + 3` | Rola um d20 com bônus de +3 |
| `br 2d20kh1` | Vantagem: mantém o maior |
| `br 2d20kl1` | Desvantagem: mantém o menor |
| `br 2d6 + 1d4 \| Corte do Zangetsu` | Rolagem com uma descrição |
| `CBBajuda` | Ajuda (alias antigo) |
| `CBBficha ID` | Consulta o resumo de ficha pública |
| `CBBhistorico` | Histórico compartilhado |
| `/rolar`, `/ficha`, `/historico`, `/ajuda` | Comandos de barra também disponíveis |

`CBBrolar` permanece como alias para evitar quebrar mensagens antigas. O prefixo `br` exige **Message Content Intent** no Developer Portal, que já foi ativado.

## Visual

Os cartões exibem a cor secundária roxa; nos especiais a borda muda para **dourado** (CRÍTICO) ou **vermelho** (FALHA CRÍTICA). Os dados efetivamente responsáveis são destacados com 🟡 e 🔴, compatíveis com mobile, e os dados descartados aparecem riscados.

> A API de embeds do Discord oferece uma cor por cartão, mas não altera a cor arbitrária de palavras individuais. Códigos ANSI funcionam de forma inconsistente no celular; por isso, os números usam marcadores visuais independentes do cliente.

## Regras de dados

- De 1 a 30 dados por expressão, faces de 1 até 1000, sem executar código do usuário.
- Duas ou mais faces iguais de valor **6 ou superior**: **CRÍTICO**; o subtotal dos dados é duplicado, preservando modificadores fixos.
- Duas ou mais faces **1**: **FALHA CRÍTICA**.
- Dados descartados por `kh`/`kl` não contribuem para o valor final nem para resultados especiais.
- As regras são espelhadas do avaliador do site `ae_avaliar_dados` para as situações comuns, mantendo o mesmo histórico online.

## Infraestrutura ativa

- Supabase Edge Function: `ae-discord-bot`.
- Railway: projeto `Bleach CBB — Comandos Discord`, serviço `cbb-prefix-gateway`, pasta raiz `/discord-bot`.
- Repositório: `H4ppyHermy/arquivo-espiritual-site`.
- `index.ts` recebe webhooks oficiais e relays autorizados; `dice.mjs` valida expressões; `card.mjs` renderiza os cartões; `gateway.mjs` recebe as mensagens no servidor Discord.
- `npm test` executa testes locais de parser, regras e visual (Node 22+).

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

A versão anterior está preservada na branch `backup/pre-discord-bot-polish-2026-11-17`. Para voltar, reconecte a origem Railway a essa branch e publique novamente no Supabase os arquivos `index.ts` e `dice.mjs` daquele ponto. A branch `main` do site não precisa ser alterada.
