/* Cola de combate do CBB. Texto editorial; as regras continuam nos capítulos.
   Edições do mestre: site.combatGuide.overrides (mesmo formato anterior). */
(function(global){
 'use strict';
 const api=global.ARQUIVO_INTERNAL;
 if(!api)return;

 const entries=[
  {id:'fases',group:'Agir',tag:'01 · RODADA',title:'Em que fase eu ajo?',lead:'Escolha uma das três primeiras fases para usar sua ação principal.',
   text:'- Preparação: liberar poderes, fortalecer, proteger ou dar suporte.\n- Distância: disparos, projéteis e ataques de longe.\n- Duelo: golpes próximos, investidas, agarrões e disputas corporais.\n- Desfecho: resolva condições e efeitos; não é outra chance de agir.',
   tip:'Se preparou uma proteção com sua principal, não tem outra principal normal para atacar no Duelo.',
   risk:'Ações declaradas na mesma fase são simultâneas. Não dá para voltar a uma fase que já passou.',
   topic:'combate',keywords:'preparacao distancia duelo desfecho rodada simultaneo ordem'},
  {id:'objetivo',group:'Agir',tag:'02 · OPORTUNIDADES',title:'Quantas ações eu tenho?',lead:'1 ação principal e 1 reação normal por rodada.',
   text:'- A principal pode ser usada em Preparação, Distância ou Duelo.\n- A reação pode melhorar uma defesa ou ser usada por efeitos que a exijam.\n- Ações menores, como falar, dependem da situação; não substituem as oportunidades principais.\n- No Desfecho, as oportunidades normais voltam, salvo impedimento.',
   tip:'Antes de usar uma técnica, olhe o custo: ALMA, ação, reação e fase.',
   risk:'Ação Completa gasta as duas oportunidades normais. Uma Ação Comprometedora tem regras próprias.',
   topic:'combate',keywords:'acao principal reacao quantidade economia rodada menor'},
  {id:'dados',group:'Agir',tag:'03 · TESTES',title:'RA, RT ou RB?',lead:'RT é a soma. RA é o maior dado. RB é o menor.',
   text:'- Teste comum: use o RT, salvo indicação diferente.\n- Teste-Clash: normalmente vence a maior RA; no empate, vence quem iniciou a ação.\n- Para dano-base normal: use a RA do ataque.\n- Quando a regra mandar usar RT ou RB no lugar da RA, siga essa exceção.',
   tip:'Rolou 5 e 3? RT = 8, RA = 5 e RB = 3.',
   risk:'Não use o RT para acertar num Clash comum só porque o RT é maior.',
   topic:'testes',keywords:'clash duelo resultado rolagem total alta baixa dados pericias teste'},
  {id:'movimento',group:'Agir',tag:'04 · POSIÇÃO',title:'Quanto posso andar?',lead:'Sua movimentação é igual ao valor máximo do dado de Destreza.',
   text:'- Com uma ação principal, você pode andar até sua movimentação antes ou depois de agir.\n- Se gastar a principal só para se deslocar, anda até o dobro.\n- Uma ação principal adicional traz sua própria oportunidade de movimento.',
   tip:'Destreza d6: até 6 m ao agir; até 12 m se gastar a principal apenas para correr.',
   risk:'O deslocamento não permite atravessar obstáculos ou ignorar condições que o impeçam.',
   topic:'combate',keywords:'movimento movimentacao correr metros deslocar destreza'},
  {id:'ataque',group:'Atacar',tag:'05 · ACERTO',title:'Como sei se acertei?',lead:'Num confronto direto, atacante e defensor fazem um Teste-Clash.',
   text:'- Compare a RA dos testes, salvo habilidade que diga o contrário.\n- A maior RA vence. Se empatar, vence quem iniciou a ação.\n- Se o defensor vencer, evita o ataque. Se não, o ataque acerta.\n- Depois do acerto, calcule o dano e aplique a resistência.',
   tip:'Atingir o alvo e causar dano são duas coisas diferentes.',
   risk:'Confira se há crítico ou alguma técnica que altere a regra do teste.',
   topic:'testes',keywords:'ataque acertar acerto clash evasao esquiva disputa rolagem'},
  {id:'defesa',group:'Defender',tag:'06 · REAÇÃO',title:'Preciso gastar reação para defender?',lead:'Não. A defesa comum usa RA; gastar reação permite usar RT.',
   text:'- Quando receber um ataque, faça um teste defensivo com a perícia apropriada.\n- Sem gastar reação: use a RA no Teste-Clash defensivo.\n- Com reação disponível e gasta: use o RT no lugar da RA.\n- Se vencer o Clash, evita o ataque.',
   tip:'Você pode guardar a reação para um ataque mais perigoso, mas corre o risco de não se defender bem agora.',
   risk:'Gastar a reação não garante sucesso. Se ela já foi usada ou está bloqueada, não pode gastá-la novamente.',
   topic:'combate',keywords:'defender bloqueio esquiva rt sem reacao defesa reação'},
  {id:'dano',group:'Atacar',tag:'07 · DANO',title:'Como calculo o dano?',lead:'Dano-base normal = RA do ataque + dados e bônus de dano.',
   text:'- Primeiro confirme o acerto.\n- Some à RA o dano da arma, Habilidade ou Técnica, conforme o efeito.\n- Subtraia a resistência correspondente ao recurso atingido.\n- Desconte o restante de Vida, Estabilidade ou ALMA.',
   tip:'RA 7 + 1d6 que rolou 4 = 11 de dano-base. Resistência 5: o alvo perde 6.',
   risk:'Na Ação Completa, a primeira rolagem de dano-base troca RA por RT. O teste de acerto não muda.',
   topic:'dano',keywords:'dano base vida alma estabilidade arma resistencia calcular'},
  {id:'resistencia',group:'Defender',tag:'08 · RESISTIR',title:'Como funciona a resistência?',lead:'Rola uma vez por recurso afetado, por fase. O resultado vale contra cada ataque dessa fase.',
   text:'- Contra dano à Vida: use Corpo. À Estabilidade: Mente. À ALMA: Espírito.\n- Subtraia o resultado da resistência de cada dano-base recebido.\n- Resistência natural não gasta ação nem reação.\n- Some no máximo uma proteção adicional compatível, a de maior benefício.',
   tip:'Dois ataques na mesma fase, ambos contra Vida: role a resistência de Vida uma vez e aplique o valor a cada ataque.',
   risk:'Resistência reduz dano; não faz um ataque acertado deixar de ser um acerto.',
   topic:'dano',keywords:'protecao resistir dano corpo mente espirito natural coletiva'},
  {id:'completa',group:'Atacar',tag:'09 · APOSTA',title:'Como funciona a Ação Completa?',lead:'Gaste a principal normal + a reação normal para causar mais dano se acertar.',
   text:'- Declare antes do teste. Precisa ter as duas oportunidades disponíveis.\n- O Teste-Clash do acerto continua igual.\n- Se acertar, troque RA por RT na primeira rolagem de dano-base do ataque.\n- Dados e bônus de dano continuam. Só vale para esse ataque e essa rolagem.',
   tip:'Boa para um golpe decisivo quando você não precisa guardar a reação.',
   risk:'Gastou ambas mesmo se errar. Não pode repetir outra Ação Completa na rodada.',
   topic:'combate',keywords:'acao completa rt dano golpe principal reacao decisivo'},
  {id:'pressao',group:'Defender',tag:'10 · PRESSÃO',title:'Fui atingido. Fiquei Pressionado?',lead:'Sim. Um ataque bem-sucedido já deixa você Pressionado.',
   text:'- Cada novo acerto pode agravar sua Exposição Defensiva, no máximo uma vez por rodada.\n- O agravamento entra ao término da fase.\n- Mesmo um acerto com dano totalmente resistido conta para Pressão.\n- Sem sofrer acertos durante uma rodada, Pressionado termina no Desfecho.',
   tip:'Se recebeu mais de um acerto, confira se sua Exposição Defensiva deve subir.',
   risk:'Sair de Pressionado não apaga os níveis de Exposição Defensiva acumulados.',
   topic:'combate',keywords:'pressionado pressao defesa acertos exposicao'},
  {id:'exposicoes',group:'Arriscar',tag:'11 · AÇÃO EXTRA',title:'Posso fazer mais uma ação?',lead:'Pode: use uma Ação Comprometedora e assuma uma Exposição.',
   text:'- Ela concede uma ação principal OU reação adicional.\n- Só é permitido um comprometimento por rodada.\n- Você precisa poder realizar sua ação principal normal.\n- A principal extra pode ocorrer na mesma fase ou em uma posterior.',
   tip:'Use quando essa oportunidade extra realmente mudar a situação.',
   risk:'As penalidades da Exposição escolhida passam a valer conforme sua própria regra.',
   topic:'combate',keywords:'comprometimento comprometedora acao extra reacao adicional'},
  {id:'escolha',group:'Arriscar',tag:'12 · EXPOSIÇÕES',title:'Qual Exposição eu escolho?',lead:'Escolha o preço que consegue pagar: defesa, ataque, próxima rodada ou Espírito.',
   text:'- Defensiva: prejudica suas defesas conforme o nível.\n- Ofensiva: reduz o dado de perícia dos ataques imediatamente.\n- Rítmica: perde movimento, reação e, no nível III, principal na próxima rodada.\n- Espiritual: recupera até 2 ALMA imediatamente, mas reduz passos das perícias de Espírito.',
   tip:'Precisa recuperar ALMA? A Espiritual ajuda, mas não pode ser escolhida com ALMA cheia.',
   risk:'Cada Exposição vai até o nível III. Ao reduzir perícia d4, a redução passa para o dado do grupo.',
   topic:'combate',keywords:'exposicao defensiva ofensiva ritmica espiritual alma nivel'},
  {id:'contencao',group:'Arriscar',tag:'13 · RECUPERAR',title:'Como diminuo uma Exposição?',lead:'Passe uma rodada sem Ação Comprometedora: reduza 1 nível de uma Exposição no Desfecho.',
   text:'- Contenção não gasta sua ação principal nem exige teste.\n- Você escolhe qual Exposição reduzir.\n- Enquanto estiver Pressionado, não pode reduzir a Defensiva por Contenção.',
   tip:'Se você não precisa forçar outra ação, aproveite a rodada para diminuir o risco.',
   risk:'Oportunidades já perdidas pela Exposição Rítmica não são devolvidas retroativamente.',
   topic:'combate',keywords:'contencao tirar penalidade reduzir exposicao pressionado'},
  {id:'equipe',group:'Equipe',tag:'14 · AUXÍLIO',title:'Como ajudo um aliado?',lead:'Gaste sua principal para dar um aumento de passo à perícia dele.',
   text:'- Use uma perícia coerente com a ajuda e de pelo menos d6.\n- Se sua perícia é d6 ou d8: o aliado ganha 1 passo.\n- Se é d10 ou maior: ganha 2 passos.\n- Cada teste aceita apenas um Auxílio, respeitando os limites de passos.',
   tip:'Se o ataque do aliado é a jogada-chave da rodada, talvez seja melhor ajudá-lo.',
   risk:'Auxílio consome a sua ação principal, não é uma ação gratuita.',
   topic:'testes',keywords:'auxiliar ajudar aliado equipe pericia aumento passo'},
  {id:'critico',group:'Agir',tag:'15 · DADOS',title:'Deu crítico. O que acontece?',lead:'Crítico máximo: dois dados iguais em 6 ou mais. Duplique só esses resultados.',
   text:'- Crítico máximo garante sucesso, salvo impossibilidade ou regra específica.\n- Num Teste-Clash, um crítico máximo supera resultados comuns.\n- Falha crítica: dois ou mais dados com 1; RT, RA e RB viram 1.\n- Se ambos tiverem crítico máximo, compare o valor usado no Clash.',
   tip:'Rolou 6 e 6? Os dois viram 12. Rolou 1 e 1? Todos os resultados do teste viram 1.',
   risk:'Se vários críticos ocorrerem, prevalece o dos dados maiores; em igualdade, o resultado repetido mais alto.',
   topic:'testes',keywords:'critico critica crítico máximo falha sucesso dados 6 1 clash'},
  {id:'exemplo',group:'Equipe',tag:'16 · NA PRÁTICA',title:'O que fazer numa rodada difícil?',lead:'Escolha uma prioridade e deixe cada aliado cumprir sua parte.',
   text:'- O suporte usa sua principal na Preparação para proteger alguém.\n- Quem ataca de longe usa a sua principal na Distância.\n- Quem luta perto usa a sua principal no Duelo.\n- Cada um decide quando vale gastar a reação para usar RT na defesa.',
   tip:'Antes de jogar: “Qual é meu alvo? Qual fase? Quanto custa? E minha reação?”',
   risk:'Essas ações são de personagens diferentes. Não são quatro ações normais de uma pessoa.',
   topic:'combate',keywords:'exemplo estrategia time taticas rodada suporte ataque'}
 ];
 const groups=['Tudo','Agir','Atacar','Defender','Arriscar','Equipe'];
 const safe=x=>api.esc(String(x??''));
 const fold=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 let selected='fases',group='Tudo',term='';
 const overrides=()=>api.db.site?.combatGuide?.overrides||{};
 function current(){
  const opts=overrides();
  return entries.map(entry=>{
   const value=opts[entry.id];
   if(!value||typeof value!=='object'||Array.isArray(value))return {...entry};
   const result={...entry};
   for(const key of ['title','lead','text','tip','risk'])
    if(typeof value[key]==='string'&&value[key].trim())result[key]=value[key].trim();
   return result;
  });
 }
 function filtered(items=current()){
  const words=fold(term).split(/\s+/).filter(Boolean);
  return items.filter(item=>(group==='Tudo'||item.group===group)&&
   words.every(word=>fold([item.title,item.lead,item.text,item.tip,item.risk,item.group,item.keywords].join(' ')).includes(word)));
 }
 function sourceFor(item){
  const match=item.topic==='dano'?/dano|resist[eê]ncia/i:item.topic==='testes'?/testes|dados/i:/combate|movimenta[cç][aã]o/i;
  return api.db.rules.find(rule=>rule.book!=='book2'&&match.test(String(rule.title||'')))||null;
 }
 function cards(items){
  if(!items.length)return '<div class="ae-field-no-results" role="status"><strong>Nada com esse nome.</strong><span>Tente “reação”, “dano”, “exposição” ou limpe os filtros.</span><button type="button" data-guide-action="clear">LIMPAR BUSCA</button></div>';
  return items.map((item,i)=>
   '<button type="button" class="ae-field-card'+(item.id===selected?' is-active':'')+'" data-guide-action="step:'+safe(item.id)+'" aria-pressed="'+(item.id===selected)+'">'+
    '<span class="ae-field-card-index">'+String(entries.indexOf(entries.find(e=>e.id===item.id))+1).padStart(2,'0')+'</span>'+
    '<span class="ae-field-card-copy"><strong>'+safe(item.title)+'</strong><small>'+safe(item.lead)+'</small></span>'+
    '<span class="ae-field-card-mark" aria-hidden="true">↗</span></button>').join('');
 }
 function answer(item){
  if(!item)return '<div class="ae-field-no-answer" role="status">Escolha uma pergunta para ver a resposta.</div>';
  const source=sourceFor(item);
  return '<article class="ae-guide-lesson ae-field-answer" id="aeGuideLesson" tabindex="-1" aria-live="polite">'+
   '<div class="ae-field-answer-top"><span>'+safe(item.tag)+'</span><span>RESPOSTA RÁPIDA</span></div>'+
   '<h3>'+safe(item.title)+'</h3>'+
   '<p class="ae-field-answer-lead">'+safe(item.lead)+'</p>'+
   '<div class="ae-field-answer-instructions book-text ae-library-reading">'+api.formatBook(item.text,'',{highlight:false})+'</div>'+
   '<div class="ae-field-example"><span>EXEMPLO / QUANDO USAR</span><p>'+safe(item.tip)+'</p></div>'+
   '<div class="ae-field-warning"><span>ATENÇÃO</span><p>'+safe(item.risk)+'</p></div>'+
   '<div class="ae-field-answer-actions">'+
    (source?'<button type="button" data-guide-action="chapter:'+encodeURIComponent(source.id)+'">REGRA COMPLETA: '+safe(source.title)+' ↗</button>':'')+
    (api.master()?'<button type="button" data-guide-action="edit:'+safe(item.id)+'">EDITAR RESPOSTA</button>':'')+
   '</div></article>';
 }
 function render(){
  const items=current(),matches=filtered(items),choice=matches.find(item=>item.id===selected)||matches[0]||null;
  if(choice)selected=choice.id;
  return '<section class="ae-guide-root ae-field-guide" aria-label="Guia de Combate — referência rápida">'+
   '<div class="ae-field-banner"><div class="ae-field-banner-copy"><span class="ae-field-stamp">CBB <b>/</b> CONSULTA DE MESA</span>'+
    '<h2>COLA DE<br>COMBATE<span class="ae-field-period">.</span></h2>'+
    '<p>Travou numa regra? Ache a resposta e volte pra luta.</p></div>'+
    '<div class="ae-field-badge" aria-hidden="true"><span>16</span><small>RESPOSTAS<br>DE BOLSO</small></div></div>'+
   '<div class="ae-field-toolbar"><div class="ae-field-search"><label for="aeGuideSearch">QUAL É A DÚVIDA?</label>'+
    '<input id="aeGuideSearch" type="search" autocomplete="off" spellcheck="false" value="'+safe(term)+'" placeholder="Reação, dano, Ação Completa, Pressionado…" aria-controls="aeGuideResults">'+
    '<span class="ae-field-search-symbol" aria-hidden="true">/</span></div>'+
   '<div class="ae-field-filters" id="aeGuideFilters" aria-label="Filtrar dúvidas por assunto">'+groups.map(g=>
    '<button type="button" data-guide-action="group:'+safe(g)+'" aria-pressed="'+(g===group)+'" class="'+(g===group?'is-active':'')+'">'+safe(g)+'</button>').join('')+'</div></div>'+
   '<div class="ae-field-layout"><div class="ae-field-questions"><div class="ae-field-list-heading"><strong>ESCOLHA UMA DÚVIDA</strong><span id="aeGuideCount" role="status">'+matches.length+' de '+entries.length+'</span></div>'+
    '<div class="ae-field-results" id="aeGuideResults">'+cards(matches)+'</div></div>'+
    '<div class="ae-field-answer-wrap" id="aeGuideAnswer">'+answer(choice)+'</div></div>'+
   '<p class="ae-field-disclaimer">Resumo para consulta rápida. Se uma Habilidade, Técnica ou regra específica disser algo diferente, siga o texto oficial.</p>'+
  '</section>';
 }
 function refresh(){
  const items=current(),matches=filtered(items),choice=matches.find(item=>item.id===selected)||matches[0]||null;
  if(choice)selected=choice.id;
  const list=document.getElementById('aeGuideResults');if(list)list.innerHTML=cards(matches);
  const box=document.getElementById('aeGuideAnswer');if(box)box.innerHTML=answer(choice);
  const count=document.getElementById('aeGuideCount');if(count)count.textContent=matches.length+' de '+entries.length;
  const filters=document.getElementById('aeGuideFilters');if(filters)filters.querySelectorAll('[data-guide-action^="group:"]').forEach(b=>{
   const yes=b.dataset.guideAction.slice(6)===group;b.classList.toggle('is-active',yes);b.setAttribute('aria-pressed',String(yes));
  });
 }
 function select(id,focus=false){
  if(!current().some(item=>item.id===id))return;
  selected=id;refresh();
  if(focus){
   const panel=document.getElementById('aeGuideLesson');
   if(panel){
    panel.focus?.({preventScroll:true});
    if(global.matchMedia?.('(max-width:900px)').matches)panel.scrollIntoView?.({behavior:'auto',block:'start'});
   }
  }
 }
 function editor(id){
  if(!api.master())return;
  const item=current().find(x=>x.id===id);if(!item)return;
  const field=(name,label,max,rows)=>'<label>'+label+(rows?'<textarea id="aeGuideEdit'+name+'" maxlength="'+max+'" rows="'+rows+'">'+safe(item[name])+'</textarea>':
   '<input id="aeGuideEdit'+name+'" maxlength="'+max+'" value="'+safe(item[name])+'">')+'</label>';
  api.modal('EDITAR RESPOSTA','<div class="ae-guide-editor"><p>Respostas curtas funcionam melhor durante a sessão. Use uma linha por passo; este texto não altera as regras.</p>'+
   field('title','Pergunta',100)+field('lead','Resposta em uma frase',420,2)+
   field('text','Passos (lista curta)',6000,7)+field('tip','Exemplo prático',600,2)+field('risk','Aviso importante',600,2)+
   '<div class="ae-guide-editor-actions"><button type="button" data-guide-action="save:'+safe(id)+'">SALVAR RESPOSTA</button>'+
   '<button type="button" class="quiet" data-guide-action="restore:'+safe(id)+'">RESTAURAR TEXTO PADRÃO</button></div></div>',
   [['FECHAR','closeModal','small']]);
 }
 function save(id){
  if(!api.master()||!entries.some(s=>s.id===id))return;
  const value=(name,max)=>String(document.getElementById('aeGuideEdit'+name)?.value||'').trim().slice(0,max);
  const data={title:value('title',100),lead:value('lead',420),text:value('text',6000),tip:value('tip',600),risk:value('risk',600)};
  if(!data.title||!data.lead||!data.text){api.toast('Campos obrigatórios','Preencha pergunta, resposta e passos.',true);return}
  api.db.site??={};api.db.site.combatGuide??={version:2,overrides:{}};
  api.db.site.combatGuide.overrides??={};
  api.db.site.combatGuide.overrides[id]=data;
  api.save();api.closeModal();refresh();api.toast('Resposta atualizada');
 }
 function restore(id){
  if(!api.master()||!entries.some(s=>s.id===id))return;
  api.confirmSite('RESTAURAR RESPOSTA','Voltar ao texto padrão desta consulta?',()=>{
   const cfg=api.db.site?.combatGuide;
   if(cfg?.overrides)delete cfg.overrides[id];
   api.save();api.closeModal();refresh();api.toast('Texto padrão restaurado');
  });
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-guide-action]');if(!button)return;
  const value=button.dataset.guideAction||'',cut=value.indexOf(':');
  const action=cut<0?value:value.slice(0,cut),arg=cut<0?'':value.slice(cut+1);
  if(action==='step'){select(arg,true);return}
  if(action==='group'){group=groups.includes(arg)?arg:'Tudo';refresh();return}
  if(action==='clear'){group='Tudo';term='';const field=document.getElementById('aeGuideSearch');if(field){field.value='';field.focus()}refresh();return}
  if(action==='chapter'){
   let id='';try{id=decodeURIComponent(arg)}catch(e){return}
   api.openGuideChapter?.(id);return;
  }
  if(action==='edit'){editor(arg);return}
  if(action==='save'){save(arg);return}
  if(action==='restore'){restore(arg)}
 });
 document.addEventListener('input',event=>{
  if(event.target?.id!=='aeGuideSearch')return;
  term=String(event.target.value||'').slice(0,140);refresh();
 });
 document.addEventListener('keydown',event=>{
  if(event.target?.id==='aeGuideSearch'&&event.key==='Escape'&&term){
   term='';event.target.value='';refresh();event.preventDefault();
  }
 });
 global.ARQUIVO_GUIA_COMBATE=Object.freeze({render,sections:current,select,focusSearch:()=>document.getElementById('aeGuideSearch')?.focus()});
})(window);
