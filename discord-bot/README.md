# Bleach CBB · Bot do Arquivo Espiritual

Bot híbrido: **Discord Gateway** no Railway (comandos sem barra) e **Discord Interactions** no Supabase (comandos /). Histórico de dados compartilhado em `public.ae_rolls`.


## Mestre no Discord · visualização secreta

1. Faça login no **site** usando sua chave de mestre.
2. Vá a **Configurações → Discord · Mestre → VINCULAR DISCORD**.
3. No Discord, execute `/vincular`: a resposta com código é **ephemeral** (visível só a quem executou o comando), sem DM e sem postar no canal.
4. Cole o código no site e confirme. O vínculo é com a chave mestre real da conta do site, não com um cargo Discord.
5. Execute `/ficha ID`. A ficha inteira é acessível ao mestre, mesmo bloqueada, masterOnly ou com proprietário diferente. O conteúdo é apresentado como uma mensagem **secreta e navegável** com **Anterior**, **Próxima** e **JSON completo**.
6. Ao tocar em JSON completo, o arquivo é anexado em outra resposta ephemeral, nunca no chat público.

A visualização não publica mensagens normais e não cria DMs. Cada clique verifica novamente usuário Discord, vínculo à conta, chave ativa e permissões no Supabase. A sessão de navegação expira em 30 minutos; depois é necessário executar `/ficha ID` novamente.

Limitação da plataforma: `bficha ID` é texto comum, então **não pode** retornar ephemeral. Por compatibilidade, esse atalho continua entregando DMs apenas aos proprietários jogadores. Para uma consulta verdadeiramente invisível no canal, use **`/ficha ID`**. <https://support-apps.discord.com/hc/en-us/articles/26501839512855-Ephemeral-Messages-FAQ>

A implementação usa `ae_discord_access_sheet` (RPC master ou proprietário, service_role only), `ae_discord_sheet_views` (token privado com TTL de 30min), e `discord-bot/ephemeral-sheet.mjs` (paginador e exportação JSON). Fichas de outros jogadores seguem inacessíveis a jogadores comuns.

### Restaurar versão anterior

Backup: `backup/pre-master-ephemeral-2026-11-17`. Para reverter, reconecte o Railway ao backup, publique no Supabase o `index.ts` e módulos anteriores e reverta as modificações do site. As novas tabelas/RPCs no banco podem permanecer sem expor dados.

## Comandos sem barra

| Comando | Função |
| --- | --- |
| `br 2d6 + 1d4` | Rola dados com somas e subtrações |
| `br 1d20 + 3` | Rola com bônus |
| `br 2d6 + 1d4 \| Corte do Zangetsu` | Adiciona descrição |
| `bajuda` | Abre o guia |
| `bhistorico` | Consulta o histórico do site e Discord |
| `bvincular` | Alternativa por DM para jogadores; prefira **`/vincular`** para código secreto no canal |
| `bficha ID` | Alternativa por DM para o jogador proprietário. Mestre deve usar **`/ficha ID`** em modo secreto |

Os aliases `CBBrolar`, `CBBajuda`, `CBBficha` e `CBBhistorico` **foram removidos**. Os comandos de barra `/rolar`, `/ajuda`, `/historico`, `/vincular` e `/ficha` estão ativos. `/ficha` retorna um visualizador ephemeral para mestre ou jogador proprietário.

Os antigos modificadores `kh` e `kl` de vantagem/desvantagem estão desativados, até a criação do novo sistema.

## Como vincular sua conta e ler sua ficha

1. No Discord (servidor autorizado), digite `/vincular` (resposta secreta) ou `bvincular` (alternativa por DM).
2. O bot mostra um código em **resposta secreta**, visível apenas para você. No atalho `bvincular`, envia o código por DM.
3. Entre no site Arquivo Espiritual com sua chave de **jogador**.
4. Abra uma ficha da qual sua chave é **proprietária** e clique em **VINCULAR DISCORD**.
5. Digite o código recebido e clique em **CONECTAR**.
6. No Discord, use `/ficha ID` para abrir sua ficha sem mensagem pública, ou `bficha arquivo-hn9c15m7` para receber por DM.

Apenas o proprietário recebe por DM os recursos, atributos, perícias, combate, condições, inventário, vínculos, anotações, habilidades com suas descrições e o **JSON exato da ficha inteira**. O canal público recebe apenas uma confirmação sem os dados da ficha. No site, a janela também permite **desvincular** o Discord.

### Política de acesso

- Saber o ID não dá acesso. O bot valida o vínculo entre **usuário Discord ⇄ conta no site ⇄ chave ativa ⇄ `ownerKeyId` da ficha (jogador) ou tipo master (mestre)** a cada requisição.
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
