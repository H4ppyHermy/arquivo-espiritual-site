# Bot do Discord — Arquivo Espiritual

**Estado atual (17/11/2026):** o código do bot foi instalado no Supabase como Edge Function `ae-discord-bot`, mas **a aplicação Discord ainda não foi configurada**. A integração do site foi preparada apenas na branch `feature/discord-bot-2026-11-17`. A branch `main` do site não foi modificada.

O bot **não usa Discord Activities**, não exige hospedagem contínua, não lê mensagens privadas e não precisa de acesso privilegiado às contas do Arquivo Espiritual.

## Comandos

| Comando | Resultado |
| --- | --- |
| `/rolar expressao:2d6+3` | Rola e registra no mesmo `ae_rolls` consultado pelo site |
| `/rolar expressao:2d20kh1` | Vantagem: mantém o maior dos dois dados |
| `/rolar expressao:2d20kl1` | Desvantagem: mantém o menor dos dois dados |
| `/ficha id:IDENTIFICADOR` | Resumo de uma ficha **pública/desbloqueada**, sem dados de mestre |
| `/historico` | Últimas oito rolagens públicas do site e Discord |
| `/ajuda` | Guia dos comandos |

As expressões aceitam de 1 a 30 dados por rolagem (d1 a d1000), dados somados/subtraídos, modificadores e `kh`/`kl`. Não são executados códigos de usuário.

Ao consultar uma ficha pelo ID, o bot **não** revela fichas `masterOnly`, `locked`, `redacted` ou `private`, nem entrega o documento JSON completo. O ID não substitui uma chave de acesso.

## Configuração sem hospedar outro servidor

1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications) e crie uma aplicação **separada** para o bot (não uma Activity).
2. Na aplicação, copie o **Application ID** e a **Public Key**. Em **Bot**, gere o Bot Token — **não envie nem publique esse token**.
3. No Discord, obtenha o ID do servidor que usará o bot (Developer Mode > botão direito/toque prolongado > copiar ID) e do canal reservado às rolagens.
4. No Supabase, abra **Edge Functions > Secrets** e cadastre, exclusivamente nos segredos do servidor:

   - `DISCORD_PUBLIC_KEY`: Public Key da aplicação Discord.
   - `DISCORD_GUILD_ID`: ID do servidor permitido.
   - `DISCORD_BOT_TOKEN`: Bot Token da aplicação.
   - `DISCORD_ROLL_CHANNEL_ID`: ID do canal destinado às mensagens do site.
   - `ARQUIVO_SITE_URL`: endereço HTTPS do Arquivo Espiritual.
   - `ARQUIVO_SITE_ORIGIN`: somente origem do site, por exemplo `https://exemplo.com` (**sem barra no final**).

   O Supabase fornece normalmente `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` à função; confira que esses valores estejam disponíveis em Edge Function Secrets. O último é público, os dois primeiros não devem ir para o frontend.

5. No Discord Developer Portal, configure **General Information > Interactions Endpoint URL** com a URL da função já publicada:

   `https://cxoqifiewqtxsvylfhco.supabase.co/functions/v1/ae-discord-bot`

   **Cadastre primeiro a Public Key no Supabase**; o Discord enviará um PING assinado e a função precisa validá-lo antes de aceitar o endereço.

6. Em **Installation / OAuth2**, instale a aplicação no servidor de testes com os escopos **applications.commands** e **bot**; autorize apenas **Send Messages** no canal de rolagens. Não conceda Administrator.
7. No seu computador, baixe a branch `feature/discord-bot-2026-11-17` e, num terminal, execute o cadastro dos quatro comandos. O token é usado somente na sua sessão do terminal:

   **Linux/macOS**

   ```bash
   DISCORD_APPLICATION_ID="ID_DA_APLICACAO" DISCORD_GUILD_ID="ID_DO_SERVIDOR" DISCORD_BOT_TOKEN="TOKEN_LOCAL" node discord-bot/register.mjs
   ```

   **PowerShell**

   ```powershell
   $env:DISCORD_APPLICATION_ID="ID_DA_APLICACAO"
   $env:DISCORD_GUILD_ID="ID_DO_SERVIDOR"
   $env:DISCORD_BOT_TOKEN="TOKEN_LOCAL"
   node discord-bot/register.mjs
   ```

8. Teste `/ajuda`, `/rolar expressao:2d6+3`, `/ficha` e `/historico`. Confira o histórico no site **online e autenticado**.
9. Quando tudo estiver confirmado, incorpore os arquivos do site da branch de recurso à `main` e altere `discordNotifications: false` para `true` em `configuracao.js`. Isso habilita a publicação das rolagens **do site para o canal**. Se o Discord falhar, a rolagem do site continua normalmente e fica registrada no banco.

## Segurança, reversão e limitações

- O endpoint do Discord rejeita requisições que não tenham assinatura **Ed25519** válida e timestamp recente. Além disso, o comando só funciona no `DISCORD_GUILD_ID` autorizado.
- A rota `/notify` exige origem do site explicitamente configurada e sessão Supabase válida. A função verifica que a rolagem pertence à conta autenticada e rejeita rolagens ocultas.
- Os resultados aleatórios são gerados **no servidor**, utilizando `crypto.getRandomValues`. Não confiam em valores inventados pelo cliente.
- A tabela online existente recebeu três colunas opcionais e um índice único para a integração; dados anteriores continuam intactos.
- O histórico do Discord é o mesmo registro do site; mensagens antigas do Discord não são importadas.
- No Discord, a consulta de fichas é intencionalmente limitada ao resumo público. Login automático e rolagens de perícia usando ficha exigirão uma etapa posterior de vinculação de contas; saber o ID não concede acesso a dados secretos.
- Para **desligar imediatamente** o bot, desative a aplicação no Developer Portal e/ou remova `DISCORD_PUBLIC_KEY` dos segredos da função. Defina `discordNotifications: false` no site. Isso não apaga nenhum histórico.
- A reversão do código é feita sem tocar a branch `main`: não incorpore ou reverta a branch `feature/discord-bot-2026-11-17`. Para remover também as colunas adicionadas (somente se não houver dados novos), consulte `schema.sql` antes de qualquer operação destrutiva.
- O teste real no Discord **depende da criação da aplicação e das credenciais**, que não podem ser inventadas.

## Arquivos

- `index.ts`: Edge Function HTTP assinada.
- `dice.mjs`: parser de expressões + geração criptográfica de dados.
- `register.mjs`: cadastra comandos slash no servidor escolhido.
- `test.mjs`: testes do parser (execute `node --test discord-bot/test.mjs`).
- `schema.sql`: expansão de esquema já aplicada de forma aditiva.
