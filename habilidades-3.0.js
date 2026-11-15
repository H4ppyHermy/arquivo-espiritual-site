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
const groupLabel=name=>name==='Classe'?'Habilidades de Classe':name==='Shinigami'?'Habilidades Raciais · Shinigami':name==='Shikai'?'Habilidades de Shikai':name==='Bankai'?'Habilidades de Bankai':name==='Coração de Aço'?'Habilidades de Classe · Coração de Aço':name||'Sem grupo';
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
  {cost:2,name:'(Shinigami) Shunpō',image:'https://static.wikia.nocookie.net/bleach/images/6/69/55Senka.png/revision/latest?cb=20200115051218&path-prefix=en',noTest:true,passive:false,category:'active',description:'Uma vez por rodada, você pode utilizar sua reação para se deslocar até sua movimentação, mesmo quando não estiver sendo atacado. Esse deslocamento não evita automaticamente ataques já declarados contra você.'},
  {cost:0,name:'(Shinigami) Zankensōki: As Quatro Artes',image:'https://static.wikia.nocookie.net/bleach/images/7/7c/65Hozuri2.png/revision/latest?cb=20200119012302&path-prefix=en',noTest:true,passive:true,category:'passive',description:'Aumenta em um passo o dado de perícia dos seus ataques com espadas. (Opção Zanjutsu; escolha outra arte quando necessário.)',automation:{kind:'step',id:'modelo-zanjutsu',target:'skill',key:'Vigor',scope:'next',steps:1}},
  {cost:0,name:'(Shinigami) Percepção Espiritual',image:'https://static.wikia.nocookie.net/bleach/images/e/ec/35Uryu_grabs.png/revision/latest?cb=20200107064156&path-prefix=en',noTest:true,passive:true,category:'passive',description:'Aumenta em um passo seu dado de Sensibilidade em testes para perceber, localizar ou distinguir presenças espirituais.',automation:{kind:'step',id:'modelo-percepcao',target:'skill',key:'Sensibilidade',scope:'next',steps:1}}
 ]
};
function racePrompt(s){
 const options=RACIAL[s.race];
 return '<div id="ae3RacePrompt" class="ae3-race">'+(options?'<strong>'+escape(s.race)+'</strong><span> · '+options.length+' habilidades raciais de referência disponíveis.</span> '+button('ADICIONAR À FICHA','racial','small')+'<p>Não substitui nem duplica habilidades já cadastradas. Zankensōki utiliza a opção Zanjutsu e pode ser personalizada.</p>':'<span>Kit racial: '+escape(s.race||'Selecione uma raça')+'. Somente Shinigami possui habilidades confirmadas nesta biblioteca.</span>')+'</div>';
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


/* Book of the End — confrontos automáticos, relações plásticas e roubo de perícias. */
let bookSelectedTarget='',bookSelectedSkill='Precisão',bookResolving=false;
const BOOK_ACTIONS=new Set(['tsukishima-inserir-presenca','tsukishima-vire-pagina']);
function bookState(s){
 const b=s?.abilityRuntime?.bookOfEnd;
 return b&&Number(b.scene)===Number(s?.combat?.scene||1)?b:{targets:{}};
}
function bookPanel(s){
 if(!(s.abilities||[]).some(ab=>ab.abilityId==='tsukishima-book-of-the-end-manifestacao'))return '';
 const api=APP(),items=(api.db.sheets||[]).filter(t=>t.id!==s.id&&!t.redacted&&(!t.masterOnly||api.master?.()));
 if(!items.length)return '<section class="panel"><h3>BOOK OF THE END · MEMÓRIAS</h3><p>Não há outras fichas visíveis para selecionar como alvo.</p></section>';
 const target=items.find(x=>x.id===bookSelectedTarget)||items[0];
 bookSelectedTarget=target.id;
 const book=bookState(s),entry=book.targets?.[target.id]||{},grade=Math.max(0,Math.min(3,Number(entry.grade)||0));
 const skillPairs=Object.entries(target.skills||{}).filter(([k,v])=>DICE.includes(Number(v)));
 if(!skillPairs.some(([k])=>k===bookSelectedSkill))bookSelectedSkill=skillPairs.find(([k])=>k==='Precisão')?.[0]||skillPairs[0]?.[0]||'Precisão';
 const opts=items.map(t=>'<option value="'+escape(t.id)+'" '+(t.id===target.id?'selected':'')+'>'+escape(t.name||t.id)+'</option>').join('');
 const skillOpts=skillPairs.map(([k,d])=>'<option value="'+escape(k)+'" '+(k===bookSelectedSkill?'selected':'')+'>'+escape(k)+' · d'+d+'</option>').join('');
 const active=gateOpen(s,{unlock:{mode:'hidden',requires:'tsukishima-book-of-the-end-manifestacao'}});
 const ix=s.abilities.findIndex(a=>a.abilityId==='tsukishima-inserir-presenca');
 const ux=s.abilities.findIndex(a=>a.abilityId==='tsukishima-vire-pagina');
 const ins=ix>=0?costQuote(s,s.abilities[ix],ix):{blocked:true,cost:2,reason:'Técnica ausente'};
 const ult=ux>=0?costQuote(s,s.abilities[ux],ux):{blocked:true,cost:7,reason:'Técnica ausente'};
 const can=api.canEditSheet(s.id)&&!bookResolving&&active&&!!window.ARQUIVO_SYNC?.state?.enabled;
 const all=Object.entries(book.targets||{}).filter(([,t])=>Number(t.grade)>0).map(([key,t])=>'<span class="tag">'+escape(t.name||key)+' · '+['—','I','II','III'][Math.min(3,Number(t.grade)||0)]+'</span>').join(' ');
 const stolen=book.stolen;
 const last=Number(entry.lastMemory)||0;
 return '<section class="panel ae3-book-panel">'
  +'<div class="sectionhead"><h3>BOOK OF THE END · MEMÓRIAS</h3><span class="tag">RELAÇÃO '+['—','I · AFINIDADE','II · VÍNCULO','III · DEVOÇÃO'][grade]+'</span></div>'
  +'<p class="color-hint">Selecione o adversário. Os confrontos, os pontos de relação, o d10 de Memória e os efeitos são resolvidos e salvos automaticamente.</p>'
  +'<div class="ae3-automation-grid"><label>Adversário<select id="aeBookTarget">'+opts+'</select></label>'
  +'<label>Perícia a roubar se o d10 resultar em 10<select id="aeBookSkill">'+skillOpts+'</select></label></div>'
  +'<p class="color-hint">Memória anterior: '+(last?'d10 = '+last:'nenhuma')+' · '+(entry.lastSuccess===true?'Último confronto vencido':entry.lastSuccess===false?'Último confronto perdido':'Ainda sem confronto')+'</p>'
  +(stolen?'<p class="color-hint"><b>Perícia roubada:</b> '+escape(stolen.skill)+' · d'+escape(stolen.die)+' de '+escape(items.find(x=>x.id===stolen.targetId)?.name||stolen.targetId)+'</p>':'')
  +'<div class="actions">'+
   '<button type="button" class="btn main" data-ae3="bookUse:insert" '+(!can||ins.blocked?'disabled':'')+'>INSERIR PRESENÇA · '+ins.cost+' ALMA</button>'
   +'<button type="button" class="btn small" data-ae3="bookUse:ultimate" '+(!can||ult.blocked||grade<2?'disabled':'')+'>ENTÃO, VIRE A PÁGINA · '+ult.cost+' ALMA</button></div>'
  +(!active?'<p class="color-hint">Ative Book of the End para utilizar as técnicas.</p>':!window.ARQUIVO_SYNC?.state?.enabled?'<p class="color-hint">Conexão online necessária para rolagens verificadas.</p>':'')
  +(grade<2?'<p class="color-hint">Ultimate disponível após atingir o grau II de relação.</p>':'')
  +(all?'<p class="color-hint">Relações ativas: '+all+'</p>':'')+'</section>';
}
async function bookUse(action){
 if(bookResolving)return;
 const api=APP(),s=api?.db?.sheets.find(x=>x.id===api.currentSheet),st=window.ARQUIVO_SYNC;
 if(!s||!api.canEditSheet(s.id)||!['insert','ultimate'].includes(action))return;
 if(!st?.state?.enabled){api.toast('CONEXÃO NECESSÁRIA','Conecte a ficha para realizar o confronto automático.',true);return;}
 const target=api.db.sheets.find(t=>t.id===bookSelectedTarget);
 if(!target){api.toast('ALVO NECESSÁRIO','Selecione um adversário.',true);return;}
 bookResolving=true;
 try{
  const {data,error}=await st.state.client.rpc('ae_book_of_end_action',{
   p_source_id:s.id,p_target_id:target.id,p_action:action,p_steal_skill:bookSelectedSkill
  });
  if(error)throw Error(error.message);
  await st.refresh(true);api.render();
  const grade=['—','I','II','III'][Math.max(0,Math.min(3,Number(data.grade)||0))];
  let body='<p><b>'+escape(s.name)+' '+(data.success?'venceu':'perdeu')+' o confronto contra '+escape(target.name)+'.</b></p>'
   +'<p>Teste: '+escape(data.attack)+' contra '+escape(data.defense)+' · Relação Plástica: '+grade+'.</p>';
  if(!data.success)body+='<p>Sem alterações de memória'+(action==='ultimate'?' além do grau consumido':'')+'.</p>';
  if(data.success)body+='<p>'+ (action==='insert'?'Nenhum dano causado. ':'Dano automático à Estabilidade: '+escape(data.damage)+'. ')+'Dado de Memória: <b>d10 = '+escape(data.memory)+'</b>.</p>';
  if(Number(data.memory)===1)body+='<p>Lucidez: um grau da relação foi removido.</p>';
  if(Number(data.memory)===10&&data.stolen)body+='<p><b>Perícia roubada:</b> '+escape(data.stolen.skill)+' (d'+escape(data.stolen.die)+'). O alvo perde seu dado de perícia até o fim da cena.</p>';
  api.modal('BOOK OF THE END · '+(action==='insert'?'INSERIR PRESENÇA':'VIRE A PÁGINA'),body,[]);
 }catch(e){api.toast('CONFRONTO NÃO REALIZADO',e.message,true)}
 finally{bookResolving=false;}
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
 if(first)first.closest('label').insertAdjacentHTML('afterend',racePrompt(s));
 const h=[...root.querySelectorAll(':scope > h3')].find(x=>x.textContent.trim()==='HABILIDADES');
 if(!h)return;
 h.insertAdjacentHTML('afterend',editorToolbar(s));
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
  const kind=unlockConfig(ab).mode==='hidden'?'OCULTA ATÉ A LIBERAÇÃO':'BLOQUEADA ATÉ A LIBERAÇÃO';
  return '<article class="ability ae3-ability ae32-locked"><div class="sectionhead"><h3>'+escape(ab.name)+'</h3><span class="tag">'+kind+'</span></div><p class="color-hint">Esta técnica depende de uma liberação que ainda não foi ativada.</p>'+(api.master?.()?'<button type="button" class="btn small" data-action="editAbilityDirect:'+i+'">EDITAR VÍNCULO</button>':'')+'</article>';
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
  BOOK_ACTIONS.has(ab.abilityId)?'<span class="ability-inactive">AUTOMÁTICA · CONTROLES ABAIXO</span>':
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
 const result=[...groups.values()].map((g,index)=>'<details class="ae3-ability-group" '+((lastUnlock?.sheetId===s.id?g.items.some(([ab])=>ab.unlock?.requires===lastUnlock.key):index===0)?'open':'')+'><summary><span>'+escape(groupLabel(g.name))+'</span><small>'+g.items.length+' habilidade(s)</small></summary><div class="grid2 ae3-ability-grid">'+g.items.map(([ab,i])=>abilityArticle(s,ab,i)).join('')+'</div>'+(g.id==='tsukishima-grupo-fullbring'?bookPanel(s):'')+'</details>').join('');
 return header+(result||'<p class="empty">Nenhuma habilidade disponível neste estado.</p>')+api.historyHtml();
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
 APP().toast('IMPORTAÇÃO PREPARADA',unique.length+' habilidades adicionadas sem duplicação. Clique SALVAR para publicar.');
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
  importAbilities({format:AE3,abilities:from});return;
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
 if(event.target.id==='aeBookSkill'){bookSelectedSkill=event.target.value;return}
 if(event.target.id==='ae3Source')useSourceList();
 if(event.target.dataset.ae3Field)editField(event.target);
 if(event.target.dataset.ae3Cost)editCostField(event.target);
 if(event.target.dataset.ae32Unlock)editUnlockField(event.target);
 if(event.target.dataset.ae32Fx)editVisualField(event.target);
 if(event.target.matches('select[data-edit="race"]')){
  const old=document.getElementById('ae3RacePrompt');
  if(old&&APP()?.editorDraft)old.outerHTML=racePrompt(APP().editorDraft);
 }
});
window.ARQUIVO_V3={version:'3.2',enhanceEditor,renderAbilityTab,activationFX,onActivated,gateOpen,unlockConfig,costQuote,costLabel,billingKey,commitLocalCharge,advanceScene,effectiveDie,skillSteps,resistanceSteps,resistanceDie,consumeResistance,consumeNext,useLocally,progressSequences,parseSequence,stepDie,groupLabel};
if(APP()?.page==='sheets')APP().render?.();
})();