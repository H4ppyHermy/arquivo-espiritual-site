/* Arquivo Espiritual 3.0 — grupos, biblioteca e automações de habilidades.
   Estrutura declarativa e compatível com fichas anteriores. */
(function(){
'use strict';
const APP=()=>window.ARQUIVO_INTERNAL;
const DICE=[4,6,8,10,12,20];
const GROUPS={Corpo:['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão'],Mente:['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia'],Espírito:['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']};
const ALL=Object.values(GROUPS).flat();
const AE3='arquivo-espiritual-habilidades/3';
const progressBusy=new Set();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(name,action,cls='small')=>'<button type="button" class="btn '+cls+'" data-ae3="'+escape(action)+'">'+escape(name)+'</button>';
const id=()=>crypto.randomUUID();
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rawGroup=ab=>{const m=/^\(([^)]{1,65})\)\s*/.exec(String(ab.name||''));return m?m[1]:''};
const groupLabel=name=>name==='Fullbringer'?'Habilidades Raciais · Fullbringer':name==='Classe'?'Habilidades de Classe':name==='Shinigami'?'Habilidades Raciais · Shinigami':name==='Shikai'?'Habilidades de Shikai':name==='Bankai'?'Habilidades de Bankai':name==='Coração de Aço'?'Habilidades de Classe · Coração de Aço':name||'Sem grupo';
const assignedGroup=(s,ab)=>{
 if(ab.groupId){const g=(s.abilityGroups||[]).find(g=>g.id===ab.groupId);if(g)return {id:g.id,name:g.name};if(String(ab.groupId).startsWith('auto:'))return {id:ab.groupId,name:ab.groupId.slice(5)}}
 const label=rawGroup(ab);return {id:label?'auto:'+label:'__ungrouped',name:label||'Sem grupo'};
};
function groupOptions(s,chosen){
 const map=new Map([['','Organizar automaticamente pelo prefixo'],['auto:Shinigami','Habilidades Raciais · Shinigami'],['auto:Classe','Habilidades de Classe'],['auto:Shikai','Habilidades de Shikai'],['auto:Bankai','Habilidades de Bankai']]);
 for(const g of s.abilityGroups||[])if(g&&g.id)map.set(g.id,g.name);
 return [...map].map(([value,name])=>'<option value="'+escape(value)+'" '+(chosen===value?'selected':'')+'>'+escape(name)+'</option>').join('');
}
function normalize(a){
 const auto=a?.automation;
 if(!auto||!['step','progressive'].includes(auto.kind))return null;
 return auto;
}
function runtime(s){if(!s.abilityRuntime||typeof s.abilityRuntime!=='object')s.abilityRuntime={};s.abilityRuntime.active??={};s.abilityRuntime.progress??={};return s.abilityRuntime}
function matchStep(a,skill,group){
 if(a.target==='group')return a.key===group;
 return a.target==='skill'&&a.key===skill;
}
function activeStep(s,ab,auto){
 const state=s.abilityRuntime?.active?.[auto.id];
 if(!state||Number(state.scene)!==Number(s.combat?.scene||1))return false;
 return auto.scope==='scene'?state.enabled===true:auto.scope==='next'&&Number(state.uses)>0;
}
function skillSteps(s,skill){
 const group=Object.keys(GROUPS).find(g=>GROUPS[g].includes(skill));
 if(!group)return 0;
 let steps=0;
 for(const ab of s.abilities||[]){
  const a=normalize(ab);
  if(a?.kind!=='step'||!gateOpen(s,ab)||!matchStep(a,skill,group))continue;
  const amount=Number(a.steps);
  if(!Number.isInteger(amount)||Math.abs(amount)>3)continue;
  if(a.scope==='passive'&&(ab.passive===true||ab.category==='passive')||a.scope!=='passive'&&activeStep(s,ab,a))steps+=amount;
 }
 return clamp(steps,-4,4);
}
function resistanceSteps(s,group){
 let value=0;
 for(const ab of s.abilities||[]){
  const a=normalize(ab);if(a?.kind!=='step'||!gateOpen(s,ab)||a.target!=='resistance'||a.key!==group)continue;
  const amount=Number(a.steps);if(!Number.isInteger(amount)||Math.abs(amount)>3)continue;
  if(a.scope==='passive'&&(ab.passive||ab.category==='passive')||a.scope!=='passive'&&activeStep(s,ab,a))value+=amount;
 }
 return clamp(value,-4,4);
}
function resistanceDie(s,group){return stepDie(s.groups?.[group]||4,resistanceSteps(s,group))}
function consumeResistance(s,group){
 for(const ab of s.abilities||[]){
  const a=normalize(ab);
  if(a?.kind==='step'&&a.target==='resistance'&&a.key===group&&a.scope==='next'&&activeStep(s,ab,a)){
   if(s.abilityRuntime?.active?.[a.id])delete s.abilityRuntime.active[a.id];
  }
 }
}
function stepDie(die,steps){const i=DICE.indexOf(Number(die));return i<0?4:DICE[clamp(i+steps,0,DICE.length-1)]}
function effectiveDie(s,skill){return stepDie(s.skills?.[skill]||4,skillSteps(s,skill))}
function consumeNext(s,skill){
 const group=Object.keys(GROUPS).find(g=>GROUPS[g].includes(skill));
 if(!group)return;
 for(const ab of s.abilities||[]){
  const a=normalize(ab);
  if(a?.kind==='step'&&a.scope==='next'&&matchStep(a,skill,group)&&activeStep(s,ab,a)){
   if(s.abilityRuntime?.active?.[a.id])delete s.abilityRuntime.active[a.id];
  }
 }
}
function useLocally(s,ab){
 const a=normalize(ab);if(!a?.id)return;
 const r=runtime(s),scene=Number(s.combat?.scene||1);
 if(a.kind==='step'&&a.scope!=='passive')r.active[a.id]={scene,enabled:true,uses:a.scope==='next'?1:0};
 if(a.kind==='progressive')r.progress[a.id]={scene,hits:0,enabled:true};
}
function progressState(s,auto){
 const p=s.abilityRuntime?.progress?.[auto.id];
 return p&&p.enabled===true&&Number(p.scene)===Number(s.combat?.scene||1)?p:null;
}
function progressSequences(src){
 if(!Array.isArray(src)||!src.length||src.length>6)throw Error('Defina entre 1 e 6 etapas de dano.');
 return src.map(stage=>{
  if(!Array.isArray(stage)||!stage.length||stage.length>6)throw Error('Etapa inválida.');
  const parts=stage.map(d=>({count:Number(d.count),sides:Number(d.sides)}));
  if(parts.some(d=>!Number.isInteger(d.count)||d.count<1||d.count>12||!DICE.includes(d.sides))||parts.reduce((a,d)=>a+d.count,0)>12)throw Error('Cada etapa permite até 12 dados válidos.');
  return parts;
 });
}
function parseSequence(text){
 const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const out=lines.map(line=>line.split('+').map(term=>{
  const m=/^(\d{1,2})d(4|6|8|10|12|20)$/i.exec(term.trim());
  if(!m)throw Error('Use dados como 1d10, 1d20 ou 2d6+1d8, uma etapa por linha.');
  return {count:Number(m[1]),sides:Number(m[2])};
 }));
 return progressSequences(out);
}
function seqText(sequence){
 try{return progressSequences(sequence).map(stage=>stage.map(d=>d.count+'d'+d.sides).join(' + ')).join('\n')}catch(e){return '1d10\n1d20\n5d8'}
}
function diceDescription(stage){return stage.map(d=>d.count+'d'+d.sides).join(' + ')}
const RACIAL={
 Shinigami:[
  {minLevel:1,cost:2,name:'(Shinigami) Shunpō',image:'https://static.wikia.nocookie.net/bleach/images/6/69/55Senka.png/revision/latest?cb=20200115051218&path-prefix=en',noTest:true,passive:false,category:'active',description:'Uma vez por rodada, você pode utilizar sua reação para se deslocar até sua movimentação, mesmo quando não estiver sendo atacado. Esse deslocamento não evita automaticamente ataques já declarados contra você.'},
  {minLevel:1,cost:0,name:'(Shinigami) Zankensōki: As Quatro Artes',image:'https://static.wikia.nocookie.net/bleach/images/7/7c/65Hozuri2.png/revision/latest?cb=20200119012302&path-prefix=en',noTest:true,passive:true,category:'passive',description:'Aumenta em um passo o dado de perícia dos seus ataques com espadas. (Opção Zanjutsu; escolha outra arte quando necessário.)',automation:{kind:'step',id:'modelo-zanjutsu',target:'skill',key:'Vigor',scope:'next',steps:1}},
  {minLevel:1,cost:0,name:'(Shinigami) Percepção Espiritual',image:'https://static.wikia.nocookie.net/bleach/images/e/ec/35Uryu_grabs.png/revision/latest?cb=20200107064156&path-prefix=en',noTest:true,passive:true,category:'passive',description:'Aumenta em um passo seu dado de Sensibilidade em testes para perceber, localizar ou distinguir presenças espirituais.',automation:{kind:'step',id:'modelo-percepcao',target:'skill',key:'Sensibilidade',scope:'next',steps:1}}
 ],
 Fullbringer:[
  {minLevel:1,cost:2,name:'(Fullbringer) Bringer Light',
   image:'https://static.wikia.nocookie.net/bleach/images/0/04/429Bringer_Light.png/revision/latest?cb=20251130064823&path-prefix=en',
   noTest:true,passive:false,category:'active',costConfig:{mode:'use',limit:'round'},
   description:'Uma vez por rodada, ao se deslocar durante sua ação principal, você pode aumentar sua movimentação em metade do valor original, utilizando paredes, líquidos e o ar como pontos de apoio. Se percorrer pelo menos sua movimentação original antes de realizar um ataque físico corpo a corpo na mesma ação, aumenta em um passo o dado de perícia desse ataque.'},
  {minLevel:2,cost:2,name:'(Fullbringer) Alma da Matéria',
   noTest:true,passive:false,category:'active',costConfig:{mode:'use',limit:'none'},
   description:'Utilize sua ação principal para manipular a alma de um objeto inanimado próximo que não esteja sendo empunhado por um adversário, alterando sua rigidez, aderência ou movimento até o próximo Desfecho. Aumenta em um passo seu dado de Destreza ou Manipulação no primeiro teste diretamente relacionado ao objeto. Essa habilidade não causa dano diretamente.'},
  {minLevel:3,cost:0,name:'(Fullbringer) Objeto de Afinidade',
   noTest:true,passive:true,category:'passive',
   description:'Seu Fullbring se manifesta através de um objeto de grande significado pessoal. Enquanto essa manifestação estiver ativa, aumenta em um passo o dado de perícia utilizado nos testes das habilidades concedidas por ela.'}
 ]
};
function racePrompt(s){
 const options=RACIAL[s.race],level=Math.max(1,Number(s.level)||1);
 if(!options)return '<div id="ae3RacePrompt" class="ae3-race"><span>Escolha uma raça com habilidades padronizadas para importar técnicas raciais.</span></div>';
 const available=options.filter(a=>Number(a.minLevel||1)<=level);
 const already=new Set((s.abilities||[]).map(a=>String(a.name||'').trim().toLowerCase()));
 const pending=available.filter(a=>!already.has(a.name.toLowerCase()));
 return '<div id="ae3RacePrompt" class="ae3-race"><div class="ae3-race-head"><strong>HABILIDADES RACIAIS · '+escape(s.race.toUpperCase())+'</strong><span>Nível '+level+' · '+pending.length+' disponível(is) para adicionar</span></div>'
 +'<div class="ae3-race-list">'+options.map(a=>{
  const unlocked=Number(a.minLevel||1)<=level,obtained=already.has(a.name.toLowerCase());
  return '<div class="ae3-race-item '+(!unlocked?'is-locked':'')+'"><span>'+escape(a.name.replace(/^\([^)]+\)\s*/,''))
   +'</span><small>'+(obtained?'NA FICHA':unlocked?'DISPONÍVEL':'REQUER NÍVEL '+escape(a.minLevel||1))+'</small></div>';
 }).join('')+'</div>'
 +'<div class="actions">'+(pending.length?button('ADICIONAR '+pending.length+' HABILIDADE'+(pending.length===1?'':'S'),'racial','small main'):'<span class="color-hint">Nenhuma habilidade nova liberada neste nível.</span>')+'</div>'
 +'<p>O kit respeita o nível da ficha, não inclui técnicas ainda bloqueadas e evita duplicações.</p></div>';
}
function editorToolbar(s){
 const accessible=(APP()?.db?.sheets||[]).filter(sh=>sh.id!==s.id&&!sh.redacted&&(!sh.locked||APP().canEditSheet(sh.id)));
 return '<div class="ae3-editor-toolbar">'
  +'<div class="ae3-toolbar-head"><strong>ARQUIVO DE HABILIDADES · 3.0</strong><span>Grupos, efeitos automáticos e transferência</span></div>'
  +'<div class="ae3-toolbar-row"><label>Novo grupo personalizado<input id="ae3GroupName" maxlength="65" placeholder="Ex.: Técnicas de Kidō"></label>'+button('CRIAR GRUPO','groupAdd','small')+'</div>'
  +'<div class="ae3-toolbar-row"><label>Gerenciar grupo<select id="ae3GroupManage"><option value="">Escolha um grupo</option>'+(s.abilityGroups||[]).map(g=>'<option value="'+escape(g.id)+'">'+escape(g.name)+'</option>').join('')+'</select></label><label>Novo nome<input id="ae3GroupRename" maxlength="65" placeholder="Renomear grupo"></label>'+button('RENOMEAR','groupRename','small')+button('EXCLUIR GRUPO','groupRemove','small danger')+'</div>'
  +'<details class="ae3-transfer"><summary>Copiar, colar e transferir habilidades</summary>'
  +'<p>Marque as técnicas desejadas abaixo para copiar apenas algumas, ou use Copiar todas. O código gerado mantém imagens, configurações e grupos.</p>'
  +'<div class="actions">'+button('COPIAR MARCADAS','copyMarked')+button('COPIAR TODAS','copyAll')+'</div>'
  +'<label>Código para importar de outra ficha<textarea id="ae3Paste" rows="4" placeholder="Cole aqui o JSON das habilidades ou uma habilidade individual"></textarea></label>'
  +'<div class="actions">'+button('IMPORTAR CÓDIGO','paste','small main')+'</div>'
  +(accessible.length?'<label>Ou trazer da ficha existente<select id="ae3Source"><option value="">Selecione...</option>'+accessible.map(sh=>'<option value="'+escape(sh.id)+'">'+escape(sh.name)+'</option>').join('')+'</select></label><div id="ae3SourceList" class="ae3-source-list"></div><div class="actions">'+button('TRAZER SELECIONADAS','fromSheet','small main')+'</div>':'<p>Nenhuma outra ficha acessível para copiar.</p>')
  +'</details></div>';
}



/* Book of the End: painel e efeitos restritos à ficha de Shūkurō Tsukishima. */
const BOOK_SHEET_ID='arquivo-tsukishima-arena-n3';
const BOOK_ACTIONS=new Set(['tsukishima-inserir-presenca','tsukishima-vire-pagina']);
const BOOK_SKILLS=Object.values(GROUPS).flat();
let bookSelectedTarget='npc:new',bookSelectedSkill='Precisão',bookNpcName='';
let bookNpcStats={corpo:6,destreza:6,mente:6,determinacao:6,pericia:6,estabilidade:20};
let bookResolving=false,bookAudio=null;
function bookState(s){
 const v=s?.abilityRuntime?.bookOfEnd;
 return v&&Number(v.scene)===Number(s?.combat?.scene||1)?v:{targets:{},history:[]};
}
function bookSound(kind){
 const api=APP(),prefs=api?.prefs||{};
 if(prefs.effectsMuted||Number(prefs.effectsVolume)===0)return;
 try{
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  bookAudio??=new Context();
  if(bookAudio.state==='suspended')bookAudio.resume().catch(()=>{});
  const at=bookAudio.currentTime,vol=Math.min(.11,Math.max(0,Number(prefs.effectsVolume??35)/100)*.11);
  const tone=(start,end,length,delay=0,type='triangle')=>{
   const osc=bookAudio.createOscillator(),gain=bookAudio.createGain();
   osc.type=type;
   osc.frequency.setValueAtTime(start,at+delay);
   osc.frequency.exponentialRampToValueAtTime(end,at+delay+length);
   gain.gain.setValueAtTime(.0001,at+delay);
   gain.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),at+delay+.015);
   gain.gain.exponentialRampToValueAtTime(.0001,at+delay+length);
   osc.connect(gain);gain.connect(bookAudio.destination);
   osc.start(at+delay);osc.stop(at+delay+length+.01);
  };
  if(kind==='activate'){tone(320,720,.21);tone(560,360,.17,.12)}
  else if(kind==='memory'){tone(830,490,.16);tone(410,1010,.28,.12)}
  else if(kind==='steal'){tone(280,760,.42);tone(960,1640,.47,.15);tone(1220,2100,.38,.39)}
  else if(kind==='ultimate'){tone(210,640,.57);tone(540,1200,.42,.2);tone(870,1680,.51,.41)}
  else tone(460,290,.17);
 }catch(e){}
}
function bookEffect(kind){
 const api=APP();
 if(api?.prefs?.reduceMotion===true||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const node=document.createElement('div');
 node.className='ae3-book-cinematic ae3-book-'+kind;
 node.setAttribute('aria-hidden','true');
 node.innerHTML='<div class="ae3-book-pages"><i></i><i></i><i></i><i></i></div><div class="ae3-book-cinematic-title">BOOK OF THE END</div>';
 document.body.append(node);
 window.setTimeout(()=>node.remove(),kind==='ultimate'||kind==='steal'?1700:1050);
}
function bookSelect(label,value,choices){
 return '<label>'+label+'<select data-ae-book-stat="'+escape(value)+'">'+choices.map(([id,title])=>'<option value="'+escape(id)+'" '+(String(bookNpcStats[value])===String(id)?'selected':'')+'>'+escape(title)+'</option>').join('')+'</select></label>';
}
function bookPanel(s){
 if(s?.id!==BOOK_SHEET_ID)return '';
 const api=APP(),book=bookState(s),targets=book.targets||{};
 const sheets=(api?.db?.sheets||[]).filter(x=>x.id!==s.id&&!x.redacted&&(!x.masterOnly||api.master?.()));
 const npcs=Object.entries(targets).filter(([key,v])=>key.startsWith('npc:')&&v?.npc);
 const valid=bookSelectedTarget==='npc:new'||npcs.some(([key])=>key===bookSelectedTarget)||sheets.some(x=>x.id===bookSelectedTarget);
 if(!valid)bookSelectedTarget=npcs.length?npcs[0][0]:sheets.length?sheets[0].id:'npc:new';
 const isNpc=bookSelectedTarget.startsWith('npc:'),isNew=bookSelectedTarget==='npc:new';
 const sheetTarget=sheets.find(x=>x.id===bookSelectedTarget),entry=targets[bookSelectedTarget]||{};
 if(isNpc&&!isNew&&entry.npcStats){bookNpcStats={...bookNpcStats,...entry.npcStats};bookNpcName=entry.name||bookNpcName;}
 const active=gateOpen(s,{unlock:{mode:'hidden',requires:'tsukishima-book-of-the-end-manifestacao'}});
 const grade=Math.max(0,Math.min(3,Number(entry.grade)||0));
 const ix=s.abilities.findIndex(a=>a.abilityId==='tsukishima-inserir-presenca');
 const ux=s.abilities.findIndex(a=>a.abilityId==='tsukishima-vire-pagina');
 const ins=ix<0?{blocked:true,cost:2,reason:'Não disponível'}:costQuote(s,s.abilities[ix],ix);
 const ult=ux<0?{blocked:true,cost:7,reason:'Não disponível'}:costQuote(s,s.abilities[ux],ux);
 const connected=!!window.ARQUIVO_SYNC?.state.enabled;
 const can=api.canEditSheet(s.id)&&!bookResolving&&connected&&active;
 const choices=sheetTarget?Object.entries(sheetTarget.skills||{}).filter(([,v])=>DICE.includes(Number(v))).map(([k,d])=>[k,k+' · d'+d]):BOOK_SKILLS.map(k=>[k,k]);
 if(!choices.some(([k])=>k===bookSelectedSkill))bookSelectedSkill=choices[0]?.[0]||'Precisão';
 const opt=(value,label)=>'<option value="'+escape(value)+'" '+(bookSelectedTarget===value?'selected':'')+'>'+escape(label)+'</option>';
 const targetOptions=opt('npc:new','+ Criar NPC sem ficha')
  +(npcs.length?'<optgroup label="NPCs desta cena">'+npcs.map(([key,v])=>opt(key,v.name||'NPC')).join('')+'</optgroup>':'')
  +(sheets.length?'<optgroup label="Fichas cadastradas">'+sheets.map(v=>opt(v.id,v.name)).join('')+'</optgroup>':'');
 const diceOptions=DICE.map(n=>[n,'d'+n]);
 const npcHtml=isNpc?
  '<div class="ae3-book-npc"><label>Nome do NPC<input id="aeBookNpcName" maxlength="80" placeholder="Ex.: Guarda do palácio" value="'+escape(isNew?bookNpcName:entry.name||'')+'" '+(isNew?'':'readonly')+'></label>'
  +'<details class="ae3-book-npc-config"><summary>Dados do NPC <small>Use os dados da criatura; não é necessária uma ficha</small></summary>'
  +'<div class="ae3-book-stat-grid">'+bookSelect('Grupo Corpo','corpo',diceOptions)+bookSelect('Destreza','destreza',diceOptions)
  +bookSelect('Grupo Mente','mente',diceOptions)+bookSelect('Determinação','determinacao',diceOptions)
  +bookSelect('Perícia a roubar','pericia',diceOptions)
  +'<label>Estabilidade inicial<input type="number" min="0" max="999" data-ae-book-stat="estabilidade" value="'+escape(bookNpcStats.estabilidade)+'"></label></div>'
  +'<p class="color-hint">O sistema registra os danos à Estabilidade e a progressão separadamente por nome. NPCs com nomes idênticos compartilham a mesma memória.</p></details></div>':'';
 const history=(Array.isArray(book.history)?book.history:[]).filter(h=>h.targetId===bookSelectedTarget).slice(-4).reverse();
 const streak=Array.from({length:3},(_,i)=>'<span class="'+(grade>i?'reached':'')+'">'+['I','II','III'][i]+' <small>'+['Afinidade','Vínculo','Devoção'][i]+'</small></span>').join('');
 const stolen=book.stolen&&typeof book.stolen==='object'?book.stolen:null;
 const last=Number(entry.lastMemory)||0;
 const stable=isNpc&&!isNew&&Number.isFinite(Number(entry.stability))?'<strong>Estabilidade do NPC: '+escape(entry.stability)+'</strong>':'';
 return '<section class="ae3-book-panel'+(!active?' ae3-book-idle':'')+'">'
 +'<div class="ae3-book-header"><div><p>MEMÓRIAS REESCRITAS</p><h3>Book of the End</h3></div><span class="ae3-book-seal">'+(active?'MANIFESTADO':'INATIVO')+'</span></div>'
 +'<p class="ae3-book-help">'+(active?'Escolha o alvo e resolva o confronto. O d10, os graus da relação e o roubo de perícia serão registrados automaticamente.':'Ative a Manifestação: Book of the End para começar a reescrever memórias.')+'</p>'
 +'<div class="ae3-book-fields"><label>Alvo<select id="aeBookTarget">'+targetOptions+'</select></label>'
 +'<label>Perícia desejada<select id="aeBookSkill">'+choices.map(([k,label])=>'<option value="'+escape(k)+'" '+(bookSelectedSkill===k?'selected':'')+'>'+escape(label)+'</option>').join('')+'</select></label></div>'
 +npcHtml
 +'<div class="ae3-book-progress"><div class="ae3-book-progress-top"><strong>Relação Plástica</strong><small>Grau '+(grade?['','I','II','III'][grade]:'—')+' / III</small></div><div class="ae3-book-grades">'+streak+'</div></div>'
 +(stable?'<p class="ae3-book-stability">'+stable+'</p>':'')
 +(stolen?'<p class="ae3-book-stolen">MEMÓRIA ROUBADA · '+escape(stolen.skill)+' (d'+escape(stolen.die)+') de '+escape(stolen.targetName||stolen.targetId||'alvo')+'</p>':'')
 +(last?'<p class="color-hint">Último Dado de Memória: <b>d10 = '+last+'</b></p>':'')
 +'<div class="ae3-book-buttons"><button type="button" class="btn main" data-ae3="bookUse:insert" '+(!can||ins.blocked?'disabled':'')+'>INSERIR PRESENÇA <small>'+ins.cost+' ALMA</small></button>'
 +'<button type="button" class="btn" data-ae3="bookUse:ultimate" '+(!can||ult.blocked||grade<2?'disabled':'')+'>ENTÃO, VIRE A PÁGINA <small>'+ult.cost+' ALMA</small></button></div>'
 +(!connected?'<p class="color-hint">Conexão online necessária para os confrontos verificados.</p>':'')
 +(active&&grade<2?'<p class="color-hint">A ultimate exige uma Relação Plástica de grau II ou III.</p>':'')
 +(history.length?'<details class="ae3-book-history"><summary>Últimos confrontos deste alvo</summary>'+history.map(h=>'<p><b>Rodada '+escape(h.round)+'</b> · '+(h.action==='ultimate'?'Vire a Página':'Inserir Presença')+' · '+(h.success?'sucesso':'falha')+' · '+escape(h.attack)+' × '+escape(h.defense)+(h.memory?' · Memória '+escape(h.memory)+'/10':'')+'</p>').join('')+'</details>':'')
 +'</section>';
}
async function bookUse(action){
 if(bookResolving||!['insert','ultimate'].includes(action))return;
 const api=APP(),s=api?.db?.sheets.find(x=>x.id===api.currentSheet),st=window.ARQUIVO_SYNC;
 if(!s||s.id!==BOOK_SHEET_ID||!api.canEditSheet(s.id))return;
 if(!st?.state?.enabled){api.toast('CONEXÃO NECESSÁRIA','Os confrontos automáticos exigem conexão online.',true);return}
 const npc=bookSelectedTarget.startsWith('npc:');
 const state=bookState(s),saved=state.targets?.[bookSelectedTarget];
 const npcName=npc?(saved?.name||bookNpcName).trim():'';
 if(npc&&(!npcName||npcName.length>80)){api.toast('NOME DO NPC','Informe o nome do alvo.',true);return}
 const target=api.db.sheets.find(x=>x.id===bookSelectedTarget);
 if(!npc&&!target){api.toast('ALVO NÃO ENCONTRADO','Escolha um adversário válido.',true);return}
 const skill=bookSelectedSkill;
 const npcData=npc?Object.fromEntries(Object.entries(bookNpcStats).map(([k,v])=>[k,Number(v)])):null;
 if(npc&&!DICE.includes(Number(npcData.pericia))){api.toast('DADO INVÁLIDO','Escolha um dado válido para o NPC.',true);return}
 bookResolving=true;
 bookSound(action==='ultimate'?'ultimate':'activate');
 try{
  const {data,error}=await st.state.client.rpc('ae_book_of_end_action_v2',{
   p_source_id:s.id,p_target_id:npc?'npc':target.id,p_action:action,
   p_steal_skill:skill,p_npc_name:npc?npcName:null,p_npc_stats:npc?npcData:null
  });
  if(error)throw Error(error.message);
  if(data?.targetId)bookSelectedTarget=data.targetId;
  await st.refresh(true);
  bookResolving=false;
  api.render();
  const grade=['—','I','II','III'][Math.max(0,Math.min(3,Number(data.grade)||0))];
  if(data.success){bookEffect(Number(data.memory)===10?'steal':action==='ultimate'?'ultimate':'memory');bookSound(Number(data.memory)===10?'steal':'memory');}
  let body='<div class="ae3-book-result"><p class="ae3-book-verdict '+(data.success?'success':'failed')+'">'+(data.success?'MEMÓRIA INSERIDA':'MEMÓRIA RESISTIDA')+'</p>'
   +'<p><b>'+escape(data.targetName||npcName||target?.name)+'</b> · Teste '+escape(data.attack)+' contra '+escape(data.defense)+'</p>'
   +'<p>Relação Plástica: <b>'+grade+'</b> / III.</p>';
  if(data.success)body+='<div class="ae3-book-memory-roll"><span>DADO DE MEMÓRIA</span><strong>'+escape(data.memory)+'</strong><small>1d10</small></div>'
   +(action==='ultimate'?'<p>Estabilidade: −'+escape(data.damage)+(npc?' · restante '+escape(data.stability):'')+'. Confuso até o próximo Desfecho.</p>':'<p>A técnica não causa dano.</p>');
  else body+='<p>Sem efeito no alvo.'+(action==='ultimate'?' O grau foi consumido.':'')+'</p>';
  if(Number(data.memory)===1)body+='<p>Lucidez: o alvo recuperou um grau de sua memória verdadeira.</p>';
  if(Number(data.memory)===10&&data.stolen)body+='<p><b>Perícia roubada:</b> '+escape(data.stolen.skill)+' · d'+escape(data.stolen.die)+'.</p>';
  body+='</div>';
  api.modal(action==='ultimate'?'ENTÃO, VIRE A PÁGINA':'INSERIR PRESENÇA',body,[]);
 }catch(e){bookSound('fail');api.toast('CONFRONTO NÃO REALIZADO',e.message,true)}
 finally{bookResolving=false}
}

/* 3.1 — custos, pré-requisitos, limites e condições vinculadas à ficha. */
function billingKey(ab,index){return String(ab?.abilityId||ab?.automation?.id||'legacy:'+index)}
function costConfig(ab){
 const c=ab?.costConfig&&typeof ab.costConfig==='object'?ab.costConfig:{};
 return {mode:['use','activation','progressive'].includes(c.mode)?c.mode:'use',
 increase:Math.max(1,Math.min(99999,Number(c.increase)||1)),
 limit:['none','round','scene'].includes(c.limit)?c.limit:'none',
 requires:String(c.requires||''),selfCondition:String(c.selfCondition||'')};
}
function billingState(s,ab,index){
 const c=s?.abilityRuntime?.billing?.[billingKey(ab,index)];
 return c&&Number(c.scene)===Number(s?.combat?.scene||1)?c:null;
}

/* 3.2 — visibilidade dependente de liberações, sem filtrar os dados salvos da ficha. */
let masterReveal=false;
let lastUnlock=null;
function onActivated(s,ab,index){
 const key=billingKey(ab,index);
 const target=(s.abilities||[]).some(a=>a.unlock?.requires===key);
 if(target)lastUnlock={sheetId:s.id,key};
}
function unlockConfig(ab){
 const u=ab?.unlock;
 return {mode:['hidden','locked'].includes(u?.mode)?u.mode:'always',requires:String(u?.requires||'')};
}
function gateOpen(sheet,ability){
 if(Number(ability?.minLevel||1)>Number(sheet?.level||1))return false;
 const u=unlockConfig(ability);
 if(u.mode==='always')return true;
 if(!u.requires)return false;
 const index=(sheet.abilities||[]).findIndex((a,i)=>billingKey(a,i)===u.requires&&costConfig(a).mode==='activation');
 if(index<0)return false;
 return billingState(sheet,sheet.abilities[index],index)?.active===true;
}
function unlockEditor(s,ab,i){
 const u=unlockConfig(ab),links=[['','Selecione uma liberação...']];
 (s.abilities||[]).forEach((other,index)=>{
  if(index!==i&&costConfig(other).mode==='activation')
   links.push([billingKey(other,index),other.name||'Liberação '+(index+1)]);
 });
 const sel=(field,value,items)=>'<select data-ae32-unlock="'+i+':'+field+'">'+items.map(([k,v])=>'<option value="'+escape(k)+'" '+(k===value?'selected':'')+'>'+escape(v)+'</option>').join('')+'</select>';
 return '<section class="ae32-unlock-editor"><strong>HABILIDADE VINCULADA</strong><div class="ae3-automation-grid"><label>Disponibilidade '
 +sel('mode',u.mode,[['always','Visível sempre'],['hidden','Ocultar até ativar a liberação'],['locked','Mostrar bloqueada até ativar a liberação']])+'</label>'
 +(u.mode!=='always'?'<label>Liberação que desbloqueia '+sel('requires',u.requires,links)+'</label>':'')+'</div>'
 +'<p>Funciona com habilidades normais, passivas e Ultimates. A ficha só revela e permite usar a técnica quando a liberação vinculada estiver ativa.</p>'
 +(u.mode!=='always'&&!u.requires?'<p class="ae32-warning">Escolha uma liberação para ativar esse bloqueio.</p>':'')+'</section>';
}
function editUnlockField(el){
 const draft=APP()?.editorDraft;
 if(!draft||!document.querySelector('.sheet-edit-scroll'))return;
 const [n,field]=(el.dataset.ae32Unlock||'').split(':'),index=Number(n),ab=draft.abilities?.[index];
 if(!ab)return;
 if(field==='mode'){
  if(!['always','hidden','locked'].includes(el.value))return;
  if(el.value==='always'){delete ab.unlock;APP().redrawSheetForm();return}
  const options=(draft.abilities||[]).map((x,j)=>({x,j})).filter(o=>o.j!==index&&costConfig(o.x).mode==='activation');
  if(!options.length){APP().toast('LIBERAÇÃO NECESSÁRIA','Crie uma habilidade com custo por ativação antes de vincular técnicas.',true);el.value='always';return}
  const target=options[0];if(!target.x.abilityId&&!target.x.automation?.id)target.x.abilityId=id();
  ab.unlock={mode:el.value,requires:ab.unlock?.requires||billingKey(target.x,target.j)};
  APP().redrawSheetForm();return;
 }
 if(field==='requires'){
  const target=(draft.abilities||[]).findIndex((x,j)=>j!==index&&billingKey(x,j)===el.value&&costConfig(x).mode==='activation');
  if(target<0){APP().toast('LIBERAÇÃO INVÁLIDA','Selecione uma liberação válida.',true);return}
  const source=draft.abilities[target];
  if(!source.abilityId&&!source.automation?.id)source.abilityId=id();
  ab.unlock??={mode:'hidden'};ab.unlock.requires=billingKey(source,target);
  APP().redrawSheetForm();
 }
}

function visualEditor(sheet,ab,index){
 if(!['release','transformation','ultimate'].includes(ab.category))return '';
 const custom=typeof ab.fxColor==='string'&&/^#[0-9a-f]{6}$/i.test(ab.fxColor),color=scenePalette(sheet,ab);
 return '<section class="ae32-visual-editor"><strong>APRESENTAÇÃO NA TELA</strong>'
 +'<p>O som e a animação usam por padrão a paleta da habilidade. É possível escolher uma cor específica para a ativação.</p>'
 +'<label class="ae32-visual-toggle"><input type="checkbox" data-ae32-fx="'+index+':custom" '+(custom?'checked':'')+'> Usar uma cor personalizada</label>'
 +(custom?'<label>Cor do efeito <input type="color" data-ae32-fx="'+index+':color" value="'+escape(color)+'"></label>':
 '<p><span class="ae32-color-dot" style="background:'+color+'"></span> Cor atual: '+escape(color)+' · herdada dos dados</p>')
 +'</section>';
}
function editVisualField(el){
 const draft=APP()?.editorDraft;
 if(!draft||!document.querySelector('.sheet-edit-scroll'))return;
 const [index,field]=(el.dataset.ae32Fx||'').split(':'),ab=draft.abilities?.[Number(index)];
 if(!ab)return;
 if(field==='custom'){
  if(el.checked)ab.fxColor=scenePalette(draft,ab);else delete ab.fxColor;
  APP().redrawSheetForm();
 }else if(field==='color'&&/^#[0-9a-f]{6}$/i.test(el.value))ab.fxColor=el.value;
}

function scenePalette(sheet,ab){
 const colors=[ab?.fxColor,ab?.testDice?.[0]?.color,ab?.diceColors?.group,ab?.diceColors?.skill,sheet?.appearance?.diceGroup,sheet?.appearance?.accent,'#D6A15B'];
 return colors.find(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c))||'#D6A15B';
}
function activationFX(sheet,ab){
 const category=ab?.category;
 if(!['ultimate','release','transformation'].includes(category))return;
 if(typeof document==='undefined'||!document.body)return;
 document.querySelectorAll('.ae32-impact').forEach(x=>x.remove());
 const tone=scenePalette(sheet,ab),reduced=APP()?.prefs?.noSheetMotion||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const heading=category==='ultimate'?'ULTIMATE':category==='release'?'LIBERAÇÃO ESPIRITUAL':'TRANSFORMAÇÃO';
 const overlay=document.createElement('div');
 overlay.className='ae32-impact ae32-'+category+(reduced?' ae32-reduced':'');
 overlay.style.setProperty('--ae32-tone',tone);
 overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML='<div class="ae32-halo"></div><div class="ae32-impact-copy"><span>'+heading+'</span><strong>'+escape(ab.name.replace(/^\([^)]+\)\s*/,'').slice(0,100))+'</strong></div>'
 +(reduced?'':Array.from({length:category==='ultimate'?18:9},(_,i)=>'<i class="ae32-spark" style="--n:'+i+';--x:'+((i*47)%96-48)+'vw;--y:'+((i*31)%82-41)+'vh;--delay:'+((i%7)*-0.06)+'s"></i>').join(''));
 document.body.append(overlay);
 window.setTimeout(()=>overlay.remove(),reduced?1100:category==='ultimate'?2300:1600);
}

function costQuote(s,ab,index){
 const cfg=costConfig(ab),state=billingState(s,ab,index);
 const uses=Math.max(0,Number(state?.uses)||0),round=Number(s?.combat?.round||1);
 const countRound=state&&Number(state.lastRound)===round?Math.max(0,Number(state.usesRound)||0):0;
 const active=cfg.mode==='activation'&&state?.active===true;
 const cost=Math.max(0,Number(ab.cost)||0)+(cfg.mode==='progressive'?cfg.increase*uses:0);
 let reason='';
 if(!gateOpen(s,ab))reason='Ative a liberação vinculada para desbloquear esta técnica.';
 else if(active)reason='Técnica ativa. Encerre o efeito antes de ativar novamente.';
 else if(cfg.limit==='round'&&countRound>0)reason='Limite de uma utilização por rodada.';
 else if(cfg.limit==='scene'&&uses>0)reason='Limite de uma utilização por cena.';
 if(!reason&&cfg.requires){
  const target=(s.abilities||[]).find((x,i)=>i!==index&&billingKey(x,i)===cfg.requires&&costConfig(x).mode==='activation');
  if(!target||billingState(s,target,s.abilities.indexOf(target))?.active!==true)reason='Ative a habilidade pré-requisito primeiro.';
 }
 if(!reason&&cost>999999)reason='O custo ultrapassou o limite de Alma permitido.';
 if(!reason&&Number(s.resources?.alma?.current||0)<cost)reason='Alma insuficiente: faltam '+(cost-Number(s.resources?.alma?.current||0))+' pontos.';
 return {cfg,state,uses,countRound,active,cost,blocked:!!reason,reason};
}
function costLabel(ab){
 const c=costConfig(ab),base=Math.max(0,Number(ab?.cost)||0);
 if(c.mode==='activation')return base+' ALMA · ATIVAÇÃO';
 if(c.mode==='progressive')return base+' ALMA +'+c.increase+'/USO';
 return base>0?base+' ALMA':'SEM CUSTO';
}
function costEditor(s,ab,i){
 if(ab.passive||ab.category==='passive')return '<p class="ae3-cost-note">Habilidade passiva: sem custo de Alma.</p>';
 const c=costConfig(ab),select=(field,value,choices)=>'<select data-ae3-cost="'+i+':'+field+'">'+choices.map(([k,name])=>'<option value="'+escape(k)+'" '+(String(value)===String(k)?'selected':'')+'>'+escape(name)+'</option>').join('')+'</select>';
 const requires=[['','Sem pré-requisito']];
 (s.abilities||[]).forEach((other,j)=>{
  if(i!==j&&costConfig(other).mode==='activation')requires.push([billingKey(other,j),other.name||'Técnica '+(j+1)]);
 });
 const conds=Array.isArray(APP()?.conditionsCatalog)?APP().conditionsCatalog:[];
 return '<section class="ae3-cost-editor"><strong>ALMA & ATIVAÇÃO</strong><div class="ae3-automation-grid">'
 +'<label>Modelo de cobrança'+select('mode',c.mode,[['use','Por uso · custo fixo'],['activation','Por ativação · apenas ao ligar'],['progressive','Progressivo · aumenta a cada uso na cena']])+'</label>'
 +(c.mode==='progressive'?'<label>Aumento por uso na mesma cena<input data-ae3-cost="'+i+':increase" type="number" min="1" max="99999" step="1" value="'+escape(c.increase)+'"></label>':'')
 +'<label>Limite automático'+select('limit',c.limit,[['none','Sem limite adicional'],['round','Uma vez por rodada'],['scene','Uma vez por cena']])+'</label>'
 +'<label>Exige habilidade ativa'+select('requires',c.requires,requires)+'</label>'
 +'<label>Condição automática em si mesmo'+select('selfCondition',c.selfCondition,[['','Nenhuma'],...conds.map(v=>[v,v])])+'</label>'
 +'</div><p>Custo básico: o valor de Alma acima. Por ativação, o efeito permanece até o encerramento manual ou mudança de cena; reativar cobra novamente. Progressivo: custo básico + aumento × usos anteriores na cena. Pré-requisitos devem estar ativos no momento da ativação.</p></section>';
}
function costStatus(s,ab,index){
 if(ab.passive||ab.category==='passive')return '';
 const q=costQuote(s,ab,index),c=q.cfg;
 const text=c.mode==='activation'?(q.active?'ATIVA · Alma já paga nesta ativação':'ATIVAÇÃO · '+q.cost+' Alma'):
 c.mode==='progressive'?'PRÓXIMO CUSTO · '+q.cost+' Alma (uso '+(q.uses+1)+')':q.cost+' Alma por uso';
 const limit=c.limit==='round'?' · 1/rodada':c.limit==='scene'?' · 1/cena':'';
 return '<div class="ae3-cost-status '+(q.active?'running':q.blocked?'blocked':'')+'"><strong>'+escape(text)+'</strong>'+escape(limit)+(q.reason?'<p>'+escape(q.reason)+'</p>':'')+'</div>';
}
function commitLocalCharge(s,ab,index,quote){
 const q=quote||costQuote(s,ab,index),rt=runtime(s),cfg=q.cfg,key=billingKey(ab,index);
 const granted=cfg.selfCondition&&!((s.conditions||[]).some(c=>String(c).toLowerCase()===cfg.selfCondition.toLowerCase()))?cfg.selfCondition:'';
 if(granted){s.conditions??=[];s.conditions.push(granted)}
 rt.billing??={};
 rt.billing[key]={scene:Number(s.combat?.scene||1),lastRound:Number(s.combat?.round||1),uses:q.uses+1,
 usesRound:q.countRound+1,active:cfg.mode==='activation',lastCost:q.cost,grantedCondition:cfg.mode==='activation'?granted:''};
}
function stopLocally(s,ab,index){
 const rt=runtime(s),key=billingKey(ab,index),old=rt.billing?.[key],autoId=ab.automation?.id;
 if(old){
  if(old.grantedCondition&&Number(old.scene)===Number(s.combat?.scene||1)){
   s.conditions=(s.conditions||[]).filter(x=>String(x).toLowerCase()!==String(old.grantedCondition).toLowerCase());
  }
  rt.billing[key]={...old,active:false,grantedCondition:''};
 }
 if(autoId){delete rt.active[autoId];delete rt.progress[autoId];}
}
function advanceScene(s){
 const rt=runtime(s),scene=Number(s.combat?.scene||1),expired=[];
 for(const entry of Object.values(rt.billing||{})){
  if(entry&&entry.active===true&&Number(entry.scene)!==scene&&entry.grantedCondition)expired.push(entry.grantedCondition.toLowerCase());
  if(entry&&Number(entry.scene)!==scene)entry.active=false;
 }
 if(expired.length)s.conditions=(s.conditions||[]).filter(x=>!expired.includes(String(x).toLowerCase()));
}

function automationEditor(ab,i){
 const a=normalize(ab),kind=a?.kind||'none';
 const select=(key,value,opts)=>'<select data-ae3-field="'+i+':'+key+'">'+opts.map(pair=>'<option value="'+escape(pair[0])+'" '+(String(value)===String(pair[0])?'selected':'')+'>'+escape(pair[1])+'</option>').join('')+'</select>';
 let html='<div class="ae3-automation"><strong>DINAMISMO DA HABILIDADE</strong><label>Automação '+select('kind',kind,[['none','Somente descrição (sem automação)'],['step','Modificar dado de perícia'],['progressive','Dano progressivo por acertos']])+'</label>';
 if(kind==='step'){
  const target=a.target==='resistance'?'resistance':a.target==='group'?'group':'skill',key=String(a.key||(target==='skill'?'Vigor':'Corpo')),scope=a.scope||'next';
  html+='<div class="ae3-automation-grid"><label>Tipo de alvo '+select('target',target,[['skill','Perícia específica'],['group','Todas as perícias de um grupo'],['resistance','Resistência natural de um grupo']])+'</label>'
   +'<label>Perícia ou grupo '+select('key',key,(target==='skill'?ALL:Object.keys(GROUPS)).map(x=>[x,x]))+'</label>'
   +'<label>Passos '+select('steps',a.steps||1,[[-3,'−3 passos'],[-2,'−2 passos'],[-1,'−1 passo'],[1,'+1 passo'],[2,'+2 passos'],[3,'+3 passos']])+'</label>'
   +'<label>Quando se aplica '+select('scope',scope,[['passive','Sempre (somente habilidade passiva)'],['next','Próximo teste aplicável'],['scene','Até mudar de cena ou desativar']])+'</label></div>'
   +'<p>O dado-base da ficha não é alterado. O bônus entra na rolagem real, respeitando o limite de dados. Efeitos condicionais devem ser ativados somente quando a condição narrada for atendida.</p>';
 }else if(kind==='progressive'){
  html+='<label>Etapas de dano (uma por linha)<textarea rows="4" data-ae3-field="'+i+':sequence">'+escape(seqText(a.sequence))+'</textarea></label>'
   +'<p>Exemplo do Dangai Jōe: 1d10 / 1d20 / 5d8. Ao usar a técnica, o contador inicia em zero. Clique ACERTO para rolar o dano e avançar; ERRO não avança. Após a última etapa, retorna à primeira.</p>';
 }
 return html+'</div>';
}
function enhanceEditor(){
 const api=APP(),s=api?.editorDraft,root=document.querySelector('.sheet-edit-scroll');if(!s||!root)return;
 const first=root.querySelector('select[data-edit="race"]');
 const h=[...root.querySelectorAll(':scope > h3')].find(x=>x.textContent.trim()==='HABILIDADES');
 if(!h)return;
 h.insertAdjacentHTML('afterend',racePrompt(s)+editorToolbar(s));
 const blocks=[...root.querySelectorAll('.ability-edit')];
 blocks.forEach((block,i)=>{
  const ab=s.abilities?.[i];if(!ab)return;
  if(!api.master?.()&&!gateOpen(s,ab)&&unlockConfig(ab).mode==='hidden'){
   block.innerHTML='<div class="ae32-editor-secret"><strong>TÉCNICA AINDA NÃO LIBERADA</strong><p>Esta habilidade será revelada após sua liberação espiritual.</p></div>';return;
  }
  const options=groupOptions(s,ab.groupId||'');
  const content='<div class="ae3-edit-extras"><div class="ae3-ability-head"><label><input type="checkbox" data-ae3-select="'+i+'"> Selecionar para copiar</label>'+button('COPIAR ESTA','copyOne:'+i,'small')+'</div>'
   +'<label>Grupo de habilidades<select data-ae3-field="'+i+':groupId">'+options+'</select></label>'
   +costEditor(s,ab,i)+unlockEditor(s,ab,i)+visualEditor(s,ab,i)+automationEditor(ab,i)+'</div>';
  block.insertAdjacentHTML('afterbegin',content);
 });
}
function abilityArticle(s,ab,i){
 const api=APP(),auto=normalize(ab),can=api.canEditSheet(s.id),isPassive=ab.passive===true||ab.category==='passive';
 const accessible=gateOpen(s,ab);
 if(!accessible){
  const requiredLevel=Math.max(1,Number(ab.minLevel)||1),tooLow=Number(s.level||1)<requiredLevel;
  const kind=tooLow?'BLOQUEADA · NÍVEL '+requiredLevel:unlockConfig(ab).mode==='hidden'?'OCULTA ATÉ A LIBERAÇÃO':'BLOQUEADA ATÉ A LIBERAÇÃO';
  return '<article class="ability ae3-ability ae32-locked"><div class="sectionhead"><h3>'+escape(ab.name)+'</h3><span class="tag">'+kind+'</span></div><p class="color-hint">'+(tooLow?'Esta técnica exige nível '+requiredLevel+'.':'Esta técnica depende de uma liberação que ainda não foi ativada.')+'</p>'+(api.master?.()?'<button type="button" class="btn small" data-action="editAbilityDirect:'+i+'">EDITAR VÍNCULO</button>':'')+'</article>';
 }
 const image=ab.image&&api.dataUrlOk(ab.image)?'<img class="ability-media" src="'+escape(api.mediaSrc(ab.image)||'')+'" alt="Imagem de '+escape(ab.name)+'" loading="lazy">':'';
 const badge=api.abilityBadge(ab),test=api.abilityTestButton(s,ab,i),item=api.inventoryItemAbilityLabel(s,ab),quote=isPassive?null:costQuote(s,ab,i);
 let dynamic='';
 if(auto?.kind==='step'){
  const key=auto.target==='group'?auto.key: auto.key||'Vigor';
  const on=auto.scope==='passive'?isPassive:activeStep(s,ab,auto);
  dynamic='<div class="ae3-effect '+(on?'enabled':'')+'"><span class="ae3-effect-dot"></span><b>EFEITO CONFIGURADO</b> · '+(Number(auto.steps)>0?'+':'')+escape(auto.steps)+' passo(s) em '+escape(key)+(on?' · APLICADO':' · INATIVO')+'</div>';
  if(can&&isPassive&&auto.scope!=='passive')dynamic+=button(on?'PREPARAR NOVAMENTE':'PREPARAR BÔNUS','prepare:'+i,'small main');if(can&&on&&auto.scope!=='passive')dynamic+=button('ENCERRAR EFEITO','stop:'+i,'small');
 }else if(auto?.kind==='progressive'){
  const seq=(()=>{try{return progressSequences(auto.sequence)}catch(e){return null}})();
  if(seq){
   const st=progressState(s,auto),idx=st?Number(st.hits||0)%seq.length:0;
   dynamic='<div class="ae3-progress"><span class="ae3-prog-kicker">DANO PROGRESSIVO</span><div class="ae3-progress-track">'+seq.map((part,j)=>'<span class="'+(j===idx&&st?'current':'')+'">'+(j+1)+'. '+escape(diceDescription(part))+'</span>').join('')+'</div>'
    +'<p>'+(st?'PRÓXIMO ACERTO: '+escape(diceDescription(seq[idx])):'INATIVO · Use a técnica para iniciar a sequência.')+'</p>'
    +(can&&st?'<div class="actions">'+button('ACERTO · ROLAR DANO','hit:'+i,'small main')+button('ERRO · NÃO AVANÇAR','miss:'+i,'small')+button('ENCERRAR','stop:'+i,'small danger')+'</div>':'')+'</div>';
  }
 }
 return '<article class="ability ae3-ability '+(['ultimate','release','transformation'].includes(ab.category)?'ae32-card-'+ab.category:'')+'" id="ability-'+i+'"><div class="sectionhead"><h3>'+escape(ab.name)+'</h3>'+badge+'</div>'+image
 +'<div class="sheet-rich">'+api.sheetRich(ab.description||'Sem descrição.')+'</div>'+test+item+costStatus(s,ab,i)+dynamic
 +'<div class="actions ae3-card-actions">'+(can?'<button type="button" class="btn small" data-action="editAbilityDirect:'+i+'">EDITAR TÉCNICA</button>':'')
 +button('COPIAR','copyOne:'+i,'small quiet')
 +(isPassive?'<span class="ability-inactive">PASSIVA</span>':
  !can?'':
  BOOK_ACTIONS.has(ab.abilityId)?'<span class="ability-inactive">USE PELO PAINEL BOOK OF THE END</span>':
  !api.inventoryItemCanUse(s,ab)?'<span class="ability-inactive">ITEM INDISPONÍVEL</span>':
  quote.active?'<span class="ability-inactive">ATIVA · ENCERRAR PARA REATIVAR</span>':
  quote.blocked?'<button type="button" class="btn main" disabled title="'+escape(quote.reason)+'">USO INDISPONÍVEL</button>':
  '<button type="button" class="btn main" data-action="useAbility:'+i+'">'+(quote.cfg.mode==='activation'?'ATIVAR':'USAR TÉCNICA')+' · '+quote.cost+' ALMA</button>')
 +(can&&quote?.active&&auto?.kind!=='progressive'&&auto?.kind!=='step'?button('ENCERRAR ATIVAÇÃO','stop:'+i,'small danger'):'')
 +'</div></article>';
}
function renderAbilityTab(s){
 const api=APP(),can=api.canEditSheet(s.id),groups=new Map();
 (s.abilities||[]).forEach((ab,i)=>{
  if(!gateOpen(s,ab)&&unlockConfig(ab).mode==='hidden'&&!(api.master?.()&&masterReveal))return;
  const g=assignedGroup(s,ab);
  if(!groups.has(g.id))groups.set(g.id,{...g,items:[]});
  groups.get(g.id).items.push([ab,i]);
 });
 const header='<div class="actions ae3-tab-toolbar">'+(can?'<button class="btn main" data-action="newAbilityDirect">+ CRIAR TÉCNICA</button><button class="btn small" data-action="editSheetSection:abilities">ORGANIZAR E TRANSFERIR</button>':'')+button('ABRIR GRUPOS','groupsOpen','small')+button('FECHAR GRUPOS','groupsClose','small')+(api.master?.()?button(masterReveal?'OCULTAR TÉCNICAS SECRETAS':'REVELAR TÉCNICAS SECRETAS','masterReveal','small quiet'):'')+'</div>';
 const result=[...groups.values()].map((g,index)=>'<details class="ae3-ability-group"><summary><span>'+escape(groupLabel(g.name))+'</span><small>'+g.items.length+' habilidade(s)</small></summary><div class="grid2 ae3-ability-grid">'+g.items.map(([ab,i])=>abilityArticle(s,ab,i)).join('')+'</div></details>').join('');
 return header+bookPanel(s)+(result||'<p class="empty">Nenhuma habilidade disponível neste estado.</p>')+api.historyHtml();
}
function exportSelected(abilities,source){
 const groups=[],refs=new Set();
 for(const a of abilities){const g=(source.abilityGroups||[]).find(g=>g.id===a.groupId);if(g&&!refs.has(g.id)){groups.push(g);refs.add(g.id)}}
 return JSON.stringify({format:AE3,abilities,groups},null,2);
}
function copyText(value){
 if(navigator.clipboard?.writeText&&window.isSecureContext){
  return navigator.clipboard.writeText(value).then(()=>APP().toast('HABILIDADES COPIADAS','Cole o código no editor da ficha de destino.')).catch(()=>fallbackText(value));
 }
 fallbackText(value);return Promise.resolve();
}
function fallbackText(value){
 const t=document.getElementById('ae3Paste');
 if(t){t.value=value;t.focus();t.select();APP().toast('CÓDIGO PRONTO','Copie o conteúdo selecionado da caixa de texto.');return}
 APP().modal('COPIAR HABILIDADE','<p>Selecione e copie o código.</p><textarea rows="13" readonly>'+escape(value)+'</textarea>');
}
function copyActions(action,index){
 const draft=APP()?.editorDraft,sheet=APP()?.db?.sheets?.find(s=>s.id===APP().currentSheet);
 const editing=!!draft&&!!document.querySelector('.sheet-edit-scroll');
 const source=editing?draft:sheet;
 if(!source)return;
 let list=[];
 if(action==='copyOne')list=[source.abilities?.[index]].filter(Boolean);
 if(action==='copyAll')list=(source.abilities||[]).filter(ab=>APP().master?.()||gateOpen(source,ab)||unlockConfig(ab).mode==='locked');
 if(action==='copyMarked'){
  const selected=[...document.querySelectorAll('[data-ae3-select]:checked')].map(el=>Number(el.dataset.ae3Select));
  list=selected.map(i=>source.abilities?.[i]).filter(Boolean);
 }
 if(!list.length){APP().toast('NENHUMA HABILIDADE','Marque uma ou mais habilidades para copiar.',true);return}
 copyText(exportSelected(list,source));
}
function importAbilities(payload){
 const draft=APP()?.editorDraft;
 if(!draft||!Array.isArray(draft.abilities))return;
 let data;
 try{data=typeof payload==='string'?JSON.parse(payload):payload}catch(e){APP().toast('JSON INVÁLIDO',e.message,true);return}
 const abilities=Array.isArray(data)?data:Array.isArray(data?.abilities)?data.abilities:data&&typeof data==='object'&&data.name?[data]:null;
 if(!abilities||!abilities.length||abilities.length>100){APP().toast('FORMATO NÃO ACEITO','Cole uma habilidade, uma lista ou o pacote da versão 3.0.',true);return}
 const incoming=[];
 try{
  for(const item of abilities){
   if(!item||typeof item!=='object'||typeof item.name!=='string'||!item.name.trim()||item.name.length>150)throw Error('Uma habilidade tem nome inválido.');
   const cost=Number(item.cost||0);
   if(!Number.isInteger(cost)||cost<0||cost>9999)throw Error('Custo de Alma inválido.');
   const a=JSON.parse(JSON.stringify(item));a.cost=cost;
   if(!['active','passive','mechanic','item','release','transformation','ultimate'].includes(a.category))a.category=a.passive?'passive':'active';
   a.passive=a.category==='passive';if(a.passive){a.cost=0;a.noTest=true}
   if(a.image&&!APP().dataUrlOk(a.image))a.image='';
   if(a.automation){
    const fx=normalize(a);
    if(!fx){delete a.automation}
    else{
     fx.id=id();
     if(fx.kind==='progressive')fx.sequence=progressSequences(fx.sequence);
     if(fx.kind==='step'&&(!['skill','group','resistance'].includes(fx.target)||!Number.isInteger(Number(fx.steps))||Math.abs(Number(fx.steps))>3))throw Error('Automação inválida em '+a.name);
    }
   }
   const originalKey=billingKey(item,abilities.indexOf(item));
   a.abilityId=id();
   if(a.costConfig){
    a.costConfig={...costConfig(a)};
    if(a.costConfig.selfCondition&&!APP().conditionsCatalog?.includes(a.costConfig.selfCondition))a.costConfig.selfCondition='';
   }
   Object.defineProperty(a,'__sourceCostKey',{value:originalKey,enumerable:false,configurable:true});
   incoming.push(a);
  }
 }catch(e){APP().toast('IMPORTAÇÃO RECUSADA',e.message,true);return}
 const sourceGroups=Array.isArray(data.groups)?data.groups:[];
 draft.abilityGroups??=[];
 for(const g of sourceGroups){
  if(!g||typeof g.name!=='string'||!g.name.trim()||g.name.length>65)continue;
  const existing=draft.abilityGroups.find(v=>v.name.toLowerCase()===g.name.toLowerCase());
  const target=existing||{id:id(),name:g.name};
  if(!existing)draft.abilityGroups.push(target);
  for(let k=0;k<incoming.length;k++)if(incoming[k].groupId===g.id)incoming[k].groupId=target.id;
 }
 incoming.forEach(a=>{
  if(a.groupId&&!String(a.groupId).startsWith('auto:')&&!draft.abilityGroups.some(g=>g.id===a.groupId))delete a.groupId;
 });
 const destinationByName=new Map(draft.abilities.map((a,i)=>[a.name.trim().toLocaleLowerCase('pt-BR'),billingKey(a,i)]));
 const remap=new Map(incoming.map(a=>[a.__sourceCostKey,a.abilityId]));
 for(const item of incoming){
  const matching=destinationByName.get(item.name.trim().toLocaleLowerCase('pt-BR'));
  if(matching)remap.set(item.__sourceCostKey,matching);
 }
 incoming.forEach(a=>{
  if(a.unlock?.requires){
   a.unlock.requires=remap.get(a.unlock.requires)||(
    draft.abilities.some((ab,i)=>billingKey(ab,i)===a.unlock.requires)?a.unlock.requires:''
   );
   if(!a.unlock.requires)delete a.unlock;
  }
  if(a.costConfig?.requires){
   a.costConfig.requires=remap.get(a.costConfig.requires)||(
    draft.abilities.some((ab,i)=>billingKey(ab,i)===a.costConfig.requires)?a.costConfig.requires:''
   );
  }
  delete a.__sourceCostKey;
 });
 const existing=new Set(draft.abilities.map(a=>a.name.trim().toLocaleLowerCase('pt-BR')));
 const unique=incoming.filter(a=>!existing.has(a.name.trim().toLocaleLowerCase('pt-BR'))&&(existing.add(a.name.trim().toLocaleLowerCase('pt-BR')),true));
 draft.abilities.push(...unique);
 APP().redrawSheetForm();
 APP().toast('IMPORTAÇÃO PREPARADA',unique.length+' habilidade'+(unique.length===1?'':'s')+' adicionada'+(unique.length===1?'':'s')+' sem duplicação. Clique SALVAR para publicar.');
}
function useSourceList(){
 const source=APP()?.db?.sheets?.find(s=>s.id===document.getElementById('ae3Source')?.value),wrap=document.getElementById('ae3SourceList');if(!wrap)return;
 if(!source){wrap.innerHTML='';return}
 const visible=(source.abilities||[]).map((ab,i)=>({ab,i})).filter(({ab})=>APP().master?.()||gateOpen(source,ab)||unlockConfig(ab).mode==='locked');
 wrap.innerHTML=visible.map(({ab,i})=>'<label><input type="checkbox" data-ae3-source-select="'+i+'" checked> '+escape(ab.name)+'</label>').join('')||'<span>Sem habilidades disponíveis nessa ficha.</span>';
}
async function preparePassive(index){
 const api=APP(),s=api?.db?.sheets.find(sh=>sh.id===api.currentSheet),ab=s?.abilities?.[index],a=normalize(ab);
 if(!s||!api.canEditSheet(s.id)||!ab.passive||a?.kind!=='step'||!['next','scene'].includes(a.scope))return;
 try{
  if(window.ARQUIVO_SYNC?.state.enabled){
   const {error}=await window.ARQUIVO_SYNC.state.client.rpc('ae_ability_prepare',{p_sheet_id:s.id,p_ability_index:index});
   if(error)throw Error(error.message);
   await window.ARQUIVO_SYNC.refresh(true);
  }else{useLocally(s,ab);api.save();api.render()}
  api.toast('BÔNUS PREPARADO',a.scope==='scene'?'Aplicado até o fim da cena ou ser encerrado.':'Será aplicado ao próximo teste compatível.');
 }catch(e){api.toast('NÃO FOI POSSÍVEL PREPARAR',e.message,true)}
}
async function progressHit(index){
 if(progressBusy.has(index))return;
 progressBusy.add(index);
 const api=APP(),s=api?.db?.sheets.find(sh=>sh.id===api.currentSheet),ab=s?.abilities?.[index],a=normalize(ab);
 if(!s||!api.canEditSheet(s.id)||a?.kind!=='progressive'){progressBusy.delete(index);return;}
 if(!progressState(s,a)||costConfig(ab).mode==='activation'&&billingState(s,ab,index)?.active!==true){
  api.toast('TÉCNICA INATIVA','Ative e pague a técnica antes de registrar os acertos.',true);progressBusy.delete(index);return
 }
 const seq=progressSequences(a.sequence);
 const st=progressState(s,a);
 const stage=Number(st.hits||0)%seq.length;
 let total=0,rolled=[],online=window.ARQUIVO_SYNC?.state.enabled;
 try{
  if(online){
   const {data,error}=await window.ARQUIVO_SYNC.state.client.rpc('ae_ability_progress_hit',{p_sheet_id:s.id,p_ability_index:index});
   if(error)throw Error(error.message);
   total=Number(data.total);rolled=data.dice||[];
   await window.ARQUIVO_SYNC.refresh(true);
  }else{
   for(const d of seq[stage])for(let j=0;j<d.count;j++){const values=new Uint32Array(1);crypto.getRandomValues(values);const value=1+values[0]%d.sides;rolled.push({sides:d.sides,value});total+=value}
   st.hits=Number(st.hits||0)+1;
   api.save();api.render();
  }
  api.modal('DANO PROGRESSIVO · ACERTO '+(stage+1),'<div class="ae3-damage-result"><strong>'+total+'</strong><span>DANO À VIDA · '+(online?'ROLAGEM VERIFICADA':'ROLAGEM LOCAL')+'</span><p>'+rolled.map(d=>'d'+d.sides+' = '+d.value).join(' + ')+'</p><small>Próximo acerto: '+escape(diceDescription(seq[(stage+1)%seq.length]))+'</small></div>');
 }catch(e){api.toast('NÃO FOI POSSÍVEL ROLAR',e.message,true)}finally{progressBusy.delete(index)}
}

const stopping=new Set();
async function stopEffect(index){
 if(stopping.has(index))return;
 const api=APP(),s=api?.db?.sheets.find(sh=>sh.id===api.currentSheet),ab=s?.abilities?.[index];
 if(!s||!ab||!api.canEditSheet(s.id))return;
 const key=billingKey(ab,index);
 const depend=(s.abilities||[]).find((x,i)=>i!==index&&(costConfig(x).requires===key||unlockConfig(x).requires===key)&&billingState(s,x,i)?.active===true);
 if(depend){api.toast('LIBERAÇÃO EM USO','Encerre primeiro '+depend.name+'.',true);return}
 stopping.add(index);
 try{
  if(window.ARQUIVO_SYNC?.state.enabled){
   const {error}=await window.ARQUIVO_SYNC.state.client.rpc('ae_ability_deactivate',{p_sheet_id:s.id,p_ability_index:index});
   if(error)throw Error(error.message);
   await window.ARQUIVO_SYNC.refresh(true);
  }else{stopLocally(s,ab,index);api.save()}
  api.render();api.toast('EFEITO ENCERRADO',ab.name+' · Uma nova ativação poderá cobrar Alma novamente.');
 }catch(e){api.toast('NÃO FOI POSSÍVEL ENCERRAR',e.message,true)}
 finally{stopping.delete(index)}
}
function dispatch(action){
 const parts=action.split(':'),cmd=parts[0],i=Number(parts[1]),api=APP(),draft=api?.editorDraft,editing=!!draft&&!!document.querySelector('.sheet-edit-scroll');
 if(['copyOne','copyAll','copyMarked'].includes(cmd)){copyActions(cmd,i);return}
 if(cmd==='bookUse'){bookUse(parts[1]);return}
 if(cmd==='masterReveal'&&api.master?.()){masterReveal=!masterReveal;api.render();return}
 if(cmd==='groupsOpen'||cmd==='groupsClose'){document.querySelectorAll('.ae3-ability-group').forEach(g=>g.open=cmd==='groupsOpen');return}if(cmd==='hit'){progressHit(i);return}if(cmd==='prepare'){preparePassive(i);return}
 if(cmd==='miss'){api.toast('ATAQUE NÃO ACERTOU','O contador de dano permanece na mesma etapa.');return}
 if(cmd==='stop'){stopEffect(i);return}
 if(!editing)return;
 if(cmd==='racial'){
  const from=RACIAL[draft.race];
  if(!from){api.toast('RAÇA SEM KIT','Ainda não existem habilidades raciais padronizadas para '+draft.race,true);return}
  const level=Math.max(1,Number(draft.level)||1);
  const eligible=from.filter(a=>Number(a.minLevel||1)<=level);
  if(!eligible.length){api.toast('NÍVEL INSUFICIENTE','Nenhuma habilidade racial disponível para o nível '+level+'.',true);return}
  importAbilities({format:AE3,abilities:eligible});return;
 }
 if(cmd==='groupAdd'){
  const name=(document.getElementById('ae3GroupName')?.value||'').trim();
  if(!name||name.length>65){api.toast('NOME INVÁLIDO','Informe o nome do grupo até 65 caracteres.',true);return}
  draft.abilityGroups??=[];
  if(draft.abilityGroups.some(g=>g.name.toLowerCase()===name.toLowerCase())){api.toast('GRUPO EXISTENTE','Use o grupo já cadastrado.',true);return}
  draft.abilityGroups.push({id:id(),name});api.redrawSheetForm();return;
 }
 if(cmd==='groupRename'||cmd==='groupRemove'){
  const gid=document.getElementById('ae3GroupManage')?.value;
  const g=draft.abilityGroups?.find(x=>x.id===gid);if(!g)return;
  if(cmd==='groupRemove'){draft.abilityGroups=draft.abilityGroups.filter(x=>x.id!==gid);draft.abilities.forEach(a=>{if(a.groupId===gid)delete a.groupId})}
  else{const name=(document.getElementById('ae3GroupRename')?.value||'').trim();if(!name||name.length>65)return;g.name=name}
  api.redrawSheetForm();return;
 }
 if(cmd==='paste'){importAbilities(document.getElementById('ae3Paste')?.value||'');return}
 if(cmd==='fromSheet'){
  const source=api.db.sheets.find(s=>s.id===document.getElementById('ae3Source')?.value);
  if(!source||source.redacted||source.locked&&!api.canEditSheet(source.id))return;
  const ix=[...document.querySelectorAll('[data-ae3-source-select]:checked')].map(el=>Number(el.dataset.ae3SourceSelect));
  importAbilities({format:AE3,abilities:ix.map(j=>source.abilities[j]).filter(Boolean),groups:source.abilityGroups||[]});return;
 }
}

function editCostField(el){
 const draft=APP()?.editorDraft;
 if(!draft||!document.querySelector('.sheet-edit-scroll'))return;
 const [index,field]=(el.dataset.ae3Cost||'').split(':'),ab=draft.abilities?.[Number(index)];
 if(!ab||ab.passive||ab.category==='passive')return;
 ab.costConfig??={};
 const c=ab.costConfig;
 if(field==='mode'){
  if(!['use','activation','progressive'].includes(el.value))return;
  c.mode=el.value;
  if(!ab.abilityId&&!ab.automation?.id&&c.mode!=='use')ab.abilityId=id();
  if(c.mode==='progressive')c.increase=Math.max(1,Math.min(99999,Number(c.increase)||1));
  APP().redrawSheetForm();return;
 }
 if(field==='increase'){
  c.increase=Math.max(1,Math.min(99999,Math.trunc(Number(el.value)||1)));
  el.value=String(c.increase);return;
 }
 if(field==='limit'){if(['none','round','scene'].includes(el.value))c.limit=el.value;return;}
 if(field==='selfCondition'){
  if(el.value===''||APP().conditionsCatalog?.includes(el.value))c.selfCondition=el.value;
  return;
 }
 if(field==='requires'){
  const selected=(draft.abilities||[]).findIndex((other,i)=>i!==Number(index)&&billingKey(other,i)===el.value);
  if(el.value&&selected<0){APP().toast('PRÉ-REQUISITO INVÁLIDO','Selecione outra habilidade ativa.',true);return}
  if(selected>=0){
   const target=draft.abilities[selected];
   if(costConfig(target).mode!=='activation'){APP().toast('CONFIGURAÇÃO NECESSÁRIA','A habilidade exigida deve cobrar por ativação.',true);return}
   if(!target.abilityId&&!target.automation?.id)target.abilityId=id();
   c.requires=billingKey(target,selected);
  }else c.requires='';
  APP().redrawSheetForm();
 }
}

function editField(el){
 const draft=APP()?.editorDraft;
 if(!draft||!document.querySelector('.sheet-edit-scroll'))return;
 const [i,key]=(el.dataset.ae3Field||'').split(':'),ab=draft.abilities?.[Number(i)];if(!ab)return;
 if(key==='groupId'){if(el.value)ab.groupId=el.value;else delete ab.groupId;return}
 const a=ab.automation??={};
 if(key==='kind'){
  if(el.value==='none'){delete ab.automation;APP().redrawSheetForm();return}
  ab.automation={id:id(),kind:el.value};
  if(el.value==='step')Object.assign(ab.automation,{target:'skill',key:'Vigor',steps:1,scope:ab.passive?'passive':'next'});
  else ab.automation.sequence=[[{count:1,sides:10}],[{count:1,sides:20}],[{count:5,sides:8}]];
  APP().redrawSheetForm();return;
 }
 if(key==='target'){a.target=el.value;a.key=el.value==='skill'?'Vigor':'Corpo';APP().redrawSheetForm();return}
 if(key==='scope'){a.scope=el.value;if(a.scope==='passive'&&!ab.passive){a.scope='next';APP().toast('HABILIDADE ATIVA','Para um efeito permanente, configure a técnica como PASSIVA.',true)}APP().redrawSheetForm();return}
 if(key==='sequence'){
  try{a.sequence=parseSequence(el.value);el.classList.remove('ae3-invalid');APP().toast('ETAPAS CONFIGURADAS',a.sequence.length+' etapas válidas. Salve a ficha.')}
  catch(e){el.classList.add('ae3-invalid');APP().toast('SEQUÊNCIA INVÁLIDA',e.message,true)}return;
 }
 if(key==='steps')a.steps=Number(el.value);
 if(key==='key')a.key=el.value;
}
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-ae3]');
 if(!btn)return;
 event.preventDefault();event.stopPropagation();
 dispatch(btn.dataset.ae3);
},true);
document.addEventListener('change',event=>{
 if(event.target.id==='aeBookTarget'){bookSelectedTarget=event.target.value;APP()?.render?.();return}
 if(event.target.dataset.aeBookStat){
  const key=event.target.dataset.aeBookStat;
  if(Object.prototype.hasOwnProperty.call(bookNpcStats,key))bookNpcStats[key]=Number(event.target.value);
  return;
 }
 if(event.target.id==='aeBookSkill'){bookSelectedSkill=event.target.value;return}
 if(event.target.id==='ae3Source')useSourceList();
 if(event.target.dataset.edit==='level'){const box=document.getElementById('ae3RacePrompt');if(box&&APP()?.editorDraft)box.outerHTML=racePrompt(APP().editorDraft)}
 if(event.target.dataset.ae3Field)editField(event.target);
 if(event.target.dataset.ae3Cost)editCostField(event.target);
 if(event.target.dataset.ae32Unlock)editUnlockField(event.target);
 if(event.target.dataset.ae32Fx)editVisualField(event.target);
 if(event.target.matches('select[data-edit="race"]')){
  const old=document.getElementById('ae3RacePrompt');
  if(old&&APP()?.editorDraft)old.outerHTML=racePrompt(APP().editorDraft);
 }
});
document.addEventListener('input',event=>{if(event.target.id==='aeBookNpcName')bookNpcName=event.target.value;});
window.ARQUIVO_V3={version:'3.2',enhanceEditor,renderAbilityTab,activationFX,onActivated,gateOpen,unlockConfig,costQuote,costLabel,billingKey,commitLocalCharge,advanceScene,effectiveDie,skillSteps,resistanceSteps,resistanceDie,consumeResistance,consumeNext,useLocally,progressSequences,parseSequence,stepDie,groupLabel};
if(APP()?.page==='sheets')APP().render?.();
})();