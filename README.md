# Arquivo Espiritual · Bleach CBB

Aplicação web estática do sistema CBB, publicada pelo GitHub Pages. O código do navegador está organizado em módulos JavaScript clássicos e estilos CSS; não existe etapa obrigatória de compilação.

## Onde alterar cada funcionalidade

| Área | Fonte |
| --- | --- |
| Rotas, interface, preferências, editores e fichas | `arquivo-app.js` |
| Componentes e abas da ficha | `ficha-visual.js` e `ficha-visual.css` |
| Regras e prévias do CBB | `cbb-engine.js` |
| Mesa e rolagens | `cbb-interativo.js` e `cbb-interativo.css` |
| Sincronização, autenticação e RPC | `online.js` |
| Sessão de voz, vídeo, HUD e fases | `sala-ao-vivo.js` |
| Biblioteca | `biblioteca-secoes.js`, `biblioteca-editor.js` |
| Conteúdo público de referência | `dados.js` |
| Fonte de migrações da base | `sql/` e `migracao_*.sql` |
| Testes | `tests/` e `e2e/` |
| Automação | `.github/workflows/` |

## Verificação antes de publicar

Instale Node.js 22 ou mais recente. Não é necessário instalar pacotes para os testes unitários.

```bash
node scripts/audit-static.mjs --report
node --test tests/*.test.mjs
node --test discord-bot/test.mjs
```

Para testar com Chrome, instale `puppeteer-core@24.26.0` localmente (o workflow já instala a dependência) e execute `node --test e2e/mesa-browser.test.mjs`. O teste real de WebRTC usa `e2e/rtc-browser.test.mjs`.

O workflow **Verificação de integridade** valida todos os arquivos JavaScript da raiz, a ordem e existência dos recursos estáticos, a suíte do bot e os testes do site. Os workflows de navegador exercitam a Mesa e o WebRTC.

## Fluxo seguro de alterações

1. Faça uma branch de desenvolvimento, modifique somente os módulos relevantes e abra um pull request. Não altere manualmente dados reais de personagens em migrações.
2. Garanta que testes e auditoria estejam aprovados.
3. Se alterar CSS ou JavaScript, incremente a versão `?v=` ou o identificador de cache correspondente em `index.html`. **Não** reintroduza verificadores periódicos ou pop-ups de atualização.
4. Na publicação, valide uma ficha de jogador e uma de mestre em dispositivos distintos. Teste cenas, ações, itens, rolagens, vídeo e sincronização.
5. Atualizações SQL exigem migração testada e revisão das permissões de funções `SECURITY DEFINER`.

## Princípios de desempenho

- Uma gravação de jogador deve enviar **apenas a ficha alterada**, nunca o livro inteiro.
- Chamadas concorrentes para ler o documento compartilham uma mesma requisição.
- Alterações de outras fichas não devem reconstruir a ficha aberta.
- Persistência offline pode ser agrupada para evitar serializações síncronas em sequência, mas deve ser gravada ao deixar a página.
- Nunca desligue testes, validações de permissão ou o motor de regras para obter uma medição mais rápida.

A auditoria `--report` informa os bytes brutos dos arquivos realmente referenciados pelo HTML. Isso é **tamanho de transferência sem compressão**, não um tempo de carregamento: qualquer ganho em segundos ou FPS precisa ser medido no navegador em condições comparáveis.

## Proteção de dados

`configuracao.js` contém somente configuração pública do cliente. Não envie chaves privadas, tokens de serviço, dados de autenticação ou códigos de ativação ao repositório. As RPCs autenticadas do Supabase são a autoridade das regras e das permissões; não confie apenas em ocultar controles na UI.
