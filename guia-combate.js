/* Guia de Combate do CBB: tutorial editorial, separado do motor e dos capítulos.
   As edições opcionais do mestre residem em site.combatGuide.overrides. */
(function(global){
 'use strict';
 const api=global.ARQUIVO_INTERNAL;
 if(!api)return;
 const sections=[
  {id:'objetivo',tag:'01 · PLANEJAMENTO',title:'Ganhe a cena antes de ganhar o duelo',
   lead:'A melhor ação não é sempre a que causa mais dano. Primeiro, entenda o que precisa acontecer para vencer.',
   text:[
    '**Identifique a condição de vitória.** A luta pede derrotar todos, proteger alguém, escapar ou resistir até um evento? O livro admite objetivos diferentes de incapacitar inimigos.',
    '**Escolha uma prioridade.** Descubra quem ameaça seu plano e quem precisa de ajuda. Evite gastar sua ação principal apenas porque há um inimigo ao alcance.',
    '**Combine responsabilidades.** Quem vai proteger, quem vai preparar o campo e quem realmente precisa atacar? Evite que dois aliados gastem recursos para resolver o mesmo problema.',
    '**Observe o custo.** ALMA, reação e oportunidade de ação principal são recursos da rodada. Um golpe impressionante que deixe o grupo exposto pode não ser eficiente.'
   ].join('\n\n'),
   tip:'Antes de declarar: “Se eu acertar, o que muda na cena?” Se a resposta for “quase nada”, procure uma ação mais útil.',
   risk:'Não confunda vencer a cena com maximizar dano. Proteção, fuga e controle também podem ser objetivos válidos.',
   topic:'combate'},
  {id:'fases',tag:'02 · LEITURA DE RITMO',title:'Aja na fase certa',
   lead:'Preparação, Distância, Duelo e Desfecho organizam quando sua intervenção acontece.',
   text:[
    '**Preparação:** fortaleça aliados, libere poderes, organize defesa ou execute suporte quando o efeito permitir.',
    '**Distância:** use ataques de longo alcance e habilidades apropriadas para alcançar alvos antes dos confrontos próximos.',
    '**Duelo:** resolva investidas, ataques corporais, armas e outras disputas de curta distância.',
    '**Desfecho:** observe condições, danos contínuos, recuperações e efeitos que terminam; não é uma fase livre para gastar uma nova ação principal.',
    '**Economia básica:** sua ação principal normal é escolhida entre as três primeiras fases; normalmente há também uma reação por rodada. Declarações na mesma fase são simultâneas conforme as regras.'
   ].join('\n\n'),
   tip:'Decida primeiro a fase e só depois a habilidade. Se você usar sua principal para preparar, não conte com outra principal normal para atacar no Duelo.',
   risk:'Não espere uma fase já encerrada para tentar agir nela. Ações adicionais seguem as limitações de fase e das próprias habilidades.',
   topic:'combate'},
  {id:'ataque',tag:'03 · CONSTRUÇÃO DO GOLPE',title:'Ataque com vantagem, não por impulso',
   lead:'Concentre acertos nos alvos relevantes e conheça a diferença entre acertar, causar dano e superar resistência.',
   text:[
    '**Teste de acerto:** em ações diretamente opostas, o Teste-Clash usa normalmente a RA de cada lado. Não confunda o resultado para acertar com o cálculo posterior do dano.',
    '**Dano-base comum:** RA do ataque mais o dano da arma, técnica ou habilidade. A resistência reduz o dano recebido; ela não cancela retroativamente o acerto.',
    '**Resistência natural:** Corpo contra dano à Vida, Mente contra Estabilidade e Espírito contra ALMA. Para cada recurso atingido, há uma rolagem de resistência por fase, aplicada separadamente aos ataques daquela fase.',
    '**Selecione a ferramenta certa:** se uma técnica causa uma condição, desloca o inimigo ou pressiona uma defesa, avalie o benefício além dos pontos de dano.',
    '**Concentre esforços:** um adversário já comprometido pode ser um alvo taticamente melhor, mas confirme distância, alcance, fase e gatilhos de cada técnica antes de usar ALMA.'
   ].join('\n\n'),
   tip:'Confirme três coisas: chance de acertar, benefício real caso acerte e custo de ALMA por esse benefício.',
   risk:'Acerto bem-sucedido não garante dano à Vida: a resistência pode reduzir o dano a zero, embora efeitos que dependam apenas do acerto ainda possam ocorrer.',
   topic:'dano'},
  {id:'defesa',tag:'04 · SOBREVIVÊNCIA',title:'Sua reação vale uma escolha',
   lead:'Defender sem reação e defender gastando reação não são a mesma coisa no CBB.',
   text:[
    '**Defesa comum:** ao receber um ataque, faça o teste defensivo apropriado. O Teste-Clash defensivo utiliza normalmente a RA.',
    '**Com reação disponível:** você pode gastá-la para usar o RT no lugar da RA do seu teste defensivo. Se vencer o Clash, evita o ataque; caso contrário, sofre seus efeitos.',
    '**Pressionado:** um ataque bem-sucedido pode iniciar Pressionado. Acertos posteriores agravam a Exposição Defensiva, com os limites previstos por rodada, aplicados ao fim da fase.',
    '**Proteções e resistência:** mesmo sem reação, a resistência natural funciona. Proteções adicionais aplicáveis obedecem à regra de escolher a mais vantajosa, não somar todas.',
    '**Escolha o momento:** avalie se vale gastar sua reação agora ou preservá-la para uma ameaça ainda maior. Ação Completa também consome a reação normal.'
   ].join('\n\n'),
   tip:'Guarde reação quando houver ameaça realmente relevante, mas não a preserve automaticamente se isso colocar seu objetivo em risco.',
   risk:'Pressionado e as Exposições Defensivas acumuladas são diferentes. Uma rodada sem acertos encerra Pressionado no Desfecho, mas as Exposições exigem suas regras de redução.',
   topic:'combate'},
  {id:'completa',tag:'05 · ALTO RISCO / ALTO IMPACTO',title:'Quando usar a Ação Completa',
   lead:'Trocar defesa por dano pode decidir a luta — se você tiver uma boa oportunidade de acerto.',
   text:[
    '**Declare antes do ataque.** A Ação Completa gasta sua ação principal normal E sua reação normal da rodada. Ambas são consumidas mesmo em falha.',
    '**Acerto não muda:** o Teste-Clash permanece o mesmo. Se acertar, use o RT do teste de acerto no lugar da RA apenas na primeira rolagem de dano-base daquele ataque.',
    '**O restante é preservado:** dados da arma, técnica, habilidade e outros bônus de dano continuam valendo normalmente.',
    '**Restrições:** você precisa ter ambas as oportunidades disponíveis e não pode usar uma segunda Ação Completa na mesma rodada. A conversão não vale para ataques posteriores.',
    '**Uso inteligente:** escolha um alvo com boa chance de acerto e um momento em que perder sua reação não comprometa a sobrevivência nem a proteção de aliados.'
   ].join('\n\n'),
   tip:'Pense nela como “uma aposta em um golpe decisivo”, não como um ataque gratuito ou um bônus permanente.',
   risk:'Se a chance de acertar for pequena ou você precisar reagir a uma ameaça, preservar a reação pode ser mais eficiente.',
   topic:'combate'},
  {id:'exposicoes',tag:'06 · GESTÃO DE RISCO',title:'Acelere sem destruir a próxima rodada',
   lead:'Ação Comprometedora oferece uma oportunidade adicional, mas deixa consequências.',
   text:[
    '**Comprometimento:** você pode realizar uma ação principal ou reação adicional assumindo uma Exposição, respeitando o limite de um comprometimento por rodada e as demais condições de uso.',
    '**Defensiva:** piora defesas conforme seus níveis; **Ofensiva:** reduz passos dos ataques imediatamente; **Rítmica:** sacrifica movimentação, reação e, no nível mais grave, ação principal da próxima rodada.',
    '**Espiritual:** ao escolher esta Exposição para um comprometimento, recupere até 2 ALMA sem exceder o máximo, mas receba reduções de passo nos testes do grupo Espírito. Não pode ser escolhida com ALMA cheia.',
    '**Contenção:** complete uma rodada sem Ações Comprometedoras para reduzir uma Exposição em um nível no Desfecho. A Exposição Defensiva não pode ser reduzida por Contenção enquanto estiver Pressionado.',
    '**Escolha conforme seu objetivo:** uma ação adicional hoje pode valer muito; repetir comprometimentos sem controlar os níveis pode enfraquecer profundamente seu próximo turno.'
   ].join('\n\n'),
   tip:'Compare o ganho da ação extra ao custo na rodada seguinte. Se a ameaça passou, considere uma rodada de Contenção.',
   risk:'A Exposição Ofensiva e a Espiritual afetam imediatamente a ação que as provocou. A Rítmica aplica as perdas de oportunidade na rodada seguinte.',
   topic:'combate'},
  {id:'equipe',tag:'07 · COOPERAÇÃO',title:'Multiplique o valor do grupo',
   lead:'Cooperação eficiente pode superar uma sequência de ações isoladas.',
   text:[
    '**Auxílio:** um personagem pode gastar uma ação principal para auxiliar um teste com perícia coerente de pelo menos d6. Uma perícia d6 ou d8 aumenta em 1 passo a perícia do aliado; d10 ou superior aumenta em 2 passos.',
    '**Limite importante:** apenas um Auxílio pode beneficiar cada teste, respeitando os limites normais de aumento de passos.',
    '**Planeje as fases:** um aliado pode estabelecer proteção na Preparação enquanto outro se posiciona para atacar na fase apropriada — cada um respeitando suas ações disponíveis.',
    '**Não desperdice gatilhos:** antes de ativar uma Habilidade ou Técnica, veja se precisa de acerto, dano à Vida, condição anterior, distância, fase ou custo de ALMA.',
    '**Proteja a função de cada um:** se uma pessoa precisa manter a reação para defender o grupo, não force essa pessoa a usar Ação Completa apenas por aumentar o dano.'
   ].join('\n\n'),
   tip:'Uma boa comunicação simples é “eu preparo”, “eu ataco”, “eu guardo reação”. Isso reduz decisões incompatíveis.',
   risk:'Auxiliar não cria uma ação adicional. Quem auxilia gasta sua própria ação principal.',
   topic:'testes'},
  {id:'exemplo',tag:'08 · TREINO ORIENTADO',title:'Uma rodada bem planejada',
   lead:'Exemplo tático ilustrativo com três personagens. Não é um combo automático nem concede ações extras.',
   text:[
    '**Situação:** um aliado está vulnerável, um inimigo ameaça a linha de frente e o grupo precisa afastá-lo sem abandonar quem está ferido.',
    '**Preparação:** a personagem de suporte usa sua ação principal para aplicar uma proteção permitida por sua ficha. Ela já gastou a principal normal da rodada.',
    '**Distância:** a combatente de alcance tenta atingir o inimigo com sua ação principal, verificando alcance, acerto e custo da técnica.',
    '**Duelo:** o combatente corpo a corpo escolhe sua ação principal para um ataque de curta distância; se o inimigo já foi acertado, verifique os efeitos de Pressionado de acordo com as regras da fase.',
    '**Defesa:** cada personagem decide se gastará sua reação para trocar RA por RT no próprio teste defensivo quando houver ataque contra ele.',
    '**Desfecho:** resolvam condições e efeitos periódicos, verifiquem quem pode receber Contenção e se novas oportunidades de ação serão restauradas.',
    '**Avaliação:** o grupo distribuiu pressão, suporte e ofensiva. Se faltasse apenas um golpe decisivo, um atacante com sua principal e reação ainda disponíveis poderia considerar uma Ação Completa.'
   ].join('\n\n'),
   tip:'Refaça este exemplo trocando o objetivo: sobreviver, escoltar um aliado ou fugir. A melhor ação muda quando a vitória muda.',
   risk:'As ações do exemplo pertencem a personagens diferentes. Um personagem isolado não pode copiar todas elas usando apenas sua ação principal normal.',
   topic:'combate'}
 ];
 let active='objetivo';
 const safe=x=>api.esc(String(x??''));
 const normalize=val=>typeof val==='string'?val:'';
 const overrides=()=>api.db.site?.combatGuide?.overrides||{};
 function current(){
  const customized=overrides();
  return sections.map(s=>{
   const o=customized[s.id];
   if(!o||typeof o!=='object'||Array.isArray(o))return {...s};
   return {...s,title:normalize(o.title)||s.title,lead:normalize(o.lead)||s.lead,
    text:normalize(o.text)||s.text,tip:normalize(o.tip)||s.tip,risk:normalize(o.risk)||s.risk};
  });
 }
 const lookup={
  combate:/combate|fases de combate/i,
  dano:/dano|resist[eê]ncia/i,
  testes:/teste|dados/i
 };
 function sourceFor(step){
  const regex=lookup[step.topic]||lookup.combate;
  return api.db.rules.find(rule=>regex.test(String(rule.title||'')))||null;
 }
 function render(){
  const items=current(),index=Math.max(0,items.findIndex(s=>s.id===active)),step=items[index]||items[0];
  if(!step)return '';
  const chapter=sourceFor(step);
  return '<section class="ae-guide-root" aria-label="Guia de Combate do CBB">'+
   '<div class="ae-guide-hero"><div><span class="ae-library-kicker">TREINAMENTO PRÁTICO · CBB</span>'+
    '<h2>DA PRIMEIRA DECISÃO AO GOLPE FINAL</h2>'+
    '<p>Oito aulas curtas para tomar boas decisões, entender riscos e combater em equipe. Orientações práticas baseadas nas regras atuais, não regras adicionais.</p></div>'+
    '<div class="ae-guide-metrics"><strong>08</strong><span>ETAPAS DE APRENDIZADO</span></div></div>'+
   '<div class="ae-guide-layout"><nav class="ae-guide-index" aria-label="Etapas do tutorial">'+
    '<span class="ae-guide-index-label">ROTEIRO DE COMBATE</span>'+
    items.map((entry,i)=>'<button type="button" class="ae-guide-step'+(entry.id===step.id?' is-active':'')+'" data-guide-action="step:'+safe(entry.id)+'" aria-current="'+(entry.id===step.id?'step':'false')+'">'+
      '<span>'+String(i+1).padStart(2,'0')+'</span><strong>'+safe(entry.title)+'</strong></button>').join('')+'</nav>'+
   '<article class="ae-guide-lesson" id="aeGuideLesson" tabindex="-1" aria-live="polite">'+
    '<header class="ae-guide-lesson-header"><span>'+safe(step.tag)+'</span><span>ETAPA '+String(index+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0')+'</span></header>'+
    '<h3>'+safe(step.title)+'</h3><p class="ae-guide-lead">'+safe(step.lead)+'</p>'+
    '<div class="ae-guide-lesson-copy book-text ae-library-reading">'+api.formatBook(step.text,'',{highlight:false})+'</div>'+
    '<div class="ae-guide-tactic"><span>DECISÃO EFICIENTE</span><p>'+safe(step.tip)+'</p></div>'+
    '<div class="ae-guide-caution"><span>EVITE ESTE ERRO</span><p>'+safe(step.risk)+'</p></div>'+
    '<div class="ae-guide-reference">'+
     (chapter?'<button type="button" data-guide-action="chapter:'+encodeURIComponent(chapter.id)+'">LER REGRA ORIGINAL: '+safe(chapter.title)+' ↗</button>':'<span>Consulte os capítulos originais para confirmar a redação vigente.</span>')+
     (api.master()?'<button type="button" class="ae-guide-edit" data-guide-action="edit:'+safe(step.id)+'">EDITAR ESTA ETAPA</button>':'')+'</div>'+
    '<footer class="ae-guide-lesson-footer">'+
     '<button type="button" data-guide-action="previous"'+(index===0?' disabled':'')+'>← ANTERIOR</button>'+
     '<span>'+String(index+1)+' de '+String(items.length)+'</span>'+
     '<button type="button" data-guide-action="next"'+(index===items.length-1?' disabled':'')+'>PRÓXIMA ETAPA →</button></footer>'+
   '</article></div>'+
   '<div class="ae-guide-checklist"><div><span class="ae-library-kicker">ANTES DE DECLARAR SUA AÇÃO</span><h3>LISTA TÁTICA DE CONFERÊNCIA</h3></div>'+
    '<ul><li>Qual é o objetivo real desta cena?</li><li>Qual fase permite executar minha ação?</li>'+
    '<li>Preciso da reação para me defender?</li><li>Meu custo de ALMA e meus gatilhos são válidos?</li>'+
    '<li>Uma Ação Completa ou um comprometimento valem o risco?</li></ul></div>'+
   '</section>';
 }
 function select(id){
  if(!sections.some(s=>s.id===id))return;
  active=id;api.render();
  const lesson=document.getElementById('aeGuideLesson');
  if(lesson&&matchMedia('(max-width:850px)').matches)lesson.scrollIntoView({behavior:'auto',block:'start'});
 }
 function editor(id){
  if(!api.master())return;
  const step=current().find(s=>s.id===id);if(!step)return;
  const field=(field,label,max,rows)=>'<label>'+label+(rows?'<textarea id="aeGuideEdit'+field+'" maxlength="'+max+'" rows="'+rows+'">'+safe(step[field])+'</textarea>':
   '<input id="aeGuideEdit'+field+'" maxlength="'+max+'" value="'+safe(step[field])+'">')+'</label>';
  api.modal('EDITAR · '+step.title,'<div class="ae-guide-editor">'+
   '<p>Edite esta etapa sem alterar as regras originais dos livros. O conteúdo será sincronizado como parte das configurações do mestre.</p>'+
   field('title','Título',100)+field('lead','Introdução',420,3)+
   field('text','Texto completo da aula',6000,13)+
   field('tip','Decisão eficiente',600,3)+field('risk','Erro a evitar',600,3)+
   '<div class="ae-guide-editor-actions"><button type="button" data-guide-action="save:'+safe(id)+'">SALVAR ETAPA</button>'+
   '<button type="button" class="quiet" data-guide-action="restore:'+safe(id)+'">RESTAURAR TEXTO PADRÃO</button></div></div>',
   [['FECHAR','closeModal','small']]);
 }
 function save(id){
  if(!api.master()||!sections.some(s=>s.id===id))return;
  const read=(field,max)=>String(document.getElementById('aeGuideEdit'+field)?.value||'').trim().slice(0,max);
  const entry={title:read('title',100),lead:read('lead',420),text:read('text',6000),tip:read('tip',600),risk:read('risk',600)};
  if(!entry.title||!entry.lead||!entry.text){api.toast('Campos obrigatórios','Preencha título, introdução e conteúdo.',true);return}
  api.db.site??={};api.db.site.combatGuide??={version:1,overrides:{}};
  api.db.site.combatGuide.overrides??={};
  api.db.site.combatGuide.overrides[id]=entry;
  api.save();api.closeModal();api.render();api.toast('Guia de Combate atualizado');
 }
 function restore(id){
  if(!api.master()||!sections.some(s=>s.id===id))return;
  api.confirmSite('RESTAURAR ETAPA','Substituir a edição desta aula pelo conteúdo inicial do Guia de Combate?',()=>{
   const conf=api.db.site?.combatGuide;
   if(conf?.overrides)delete conf.overrides[id];
   api.save();api.closeModal();api.render();api.toast('Texto padrão restaurado');
  });
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-guide-action]');
  if(!button)return;
  const instruction=button.dataset.guideAction||'';
  const split=instruction.indexOf(':'),action=split<0?instruction:instruction.slice(0,split),arg=split<0?'':instruction.slice(split+1);
  if(action==='step'){select(arg);return}
  if(action==='previous'||action==='next'){
   const i=sections.findIndex(s=>s.id===active),to=i+(action==='next'?1:-1);
   if(to>=0&&to<sections.length)select(sections[to].id);
   return;
  }
  if(action==='chapter'){
   let id='';try{id=decodeURIComponent(arg)}catch(e){return}
   api.openGuideChapter?.(id);return;
  }
  if(action==='edit'){editor(arg);return}
  if(action==='save'){save(arg);return}
  if(action==='restore'){restore(arg)}
 });
 global.ARQUIVO_GUIA_COMBATE=Object.freeze({render,sections:()=>current(),select});
})(window);
