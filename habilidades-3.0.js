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
  if(a?.kind!=='step'||!matchStep(a,skill,group))continue;
  const amount=Number(a.steps);
  if(!Number.isInteger(amount)||Math.abs(amount)>3)continue;
  if(a.scope==='passive'&&(ab.passive===true||ab.category==='passive')||a.scope!=='passive'&&activeStep(s,ab,a))steps+=amount;
 }
 return clamp(steps,-4,4);
}
function resistanceSteps(s,group){
 let value=0;
 for(const ab of s.abilities||[]){
  const a=normalize(ab);if(a?.kind!=='step'||a.target!=='resistance'||a.key!==group)continue;
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
function costQuote(s,ab,index){
 const cfg=costConfig(ab),state=billingState(s,ab,index);
 const uses=Math.max(0,Number(state?.uses)||0),round=Number(s?.combat?.round||1);
 const countRound=state&&Number(state.lastRound)===round?Math.max(0,Number(state.usesRound)||0):0;
 const active=cfg.mode==='activation'&&state?.active===true;
 const cost=Math.max(0,Number(ab.cost)||0)+(cfg.mode==='progressive'?cfg.increase*uses:0);
 let reason='';
 if(active)reason='Técnica ativa. Encerre o efeito antes de ativar novamente.';
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
  const options=groupOptions(s,ab.groupId||'');
  const content='<div class="ae3-edit-extras"><div class="ae3-ability-head"><label><input type="checkbox" data-ae3-select="'+i+'"> Selecionar para copiar</label>'+button('COPIAR ESTA','copyOne:'+i,'small')+'</div>'
   +'<label>Grupo de habilidades<select data-ae3-field="'+i+':groupId">'+options+'</select></label>'
   +costEditor(s,ab,i)+automationEditor(ab,i)+'</div>';
  block.insertAdjacentHTML('afterbegin',content);
 });
}
function abilityArticle(s,ab,i){
 const api=APP(),auto=normalize(ab),can=api.canEditSheet(s.id),isPassive=ab.passive===true||ab.category==='passive';
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
 return '<article class="ability ae3-ability" id="ability-'+i+'"><div class="sectionhead"><h3>'+escape(ab.name)+'</h3>'+badge+'</div>'+image
 +'<div class="sheet-rich">'+api.sheetRich(ab.description||'Sem descrição.')+'</div>'+test+item+costStatus(s,ab,i)+dynamic
 +'<div class="actions ae3-card-actions">'+(can?'<button type="button" class="btn small" data-action="editAbilityDirect:'+i+'">EDITAR TÉCNICA</button>':'')
 +button('COPIAR','copyOne:'+i,'small quiet')
 +(isPassive?'<span class="ability-inactive">PASSIVA</span>':
  !can?'':
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
  const g=assignedGroup(s,ab);
  if(!groups.has(g.id))groups.set(g.id,{...g,items:[]});
  groups.get(g.id).items.push([ab,i]);
 });
 const header='<div class="actions ae3-tab-toolbar">'+(can?'<button class="btn main" data-action="newAbilityDirect">+ CRIAR TÉCNICA</button><button class="btn small" data-action="editSheetSection:abilities">ORGANIZAR E TRANSFERIR</button>':'')+button('ABRIR GRUPOS','groupsOpen','small')+button('FECHAR GRUPOS','groupsClose','small')+'</div>';
 const result=[...groups.values()].map((g,index)=>'<details class="ae3-ability-group" '+(index===0?'open':'')+'><summary><span>'+escape(groupLabel(g.name))+'</span><small>'+g.items.length+' habilidade(s)</small></summary><div class="grid2 ae3-ability-grid">'+g.items.map(([ab,i])=>abilityArticle(s,ab,i)).join('')+'</div></details>').join('');
 return header+(result||'<p class="empty">Nenhuma habilidade cadastrada.</p>')+api.historyHtml();
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
 if(action==='copyAll')list=[...(source.abilities||[])];
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
   if(!['active','passive','mechanic','item'].includes(a.category))a.category=a.passive?'passive':'active';
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
 wrap.innerHTML=(source.abilities||[]).map((ab,i)=>'<label><input type="checkbox" data-ae3-source-select="'+i+'" checked> '+escape(ab.name)+'</label>').join('')||'<span>Sem habilidades nessa ficha.</span>';
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
 const depend=(s.abilities||[]).find((x,i)=>i!==index&&costConfig(x).requires===key&&billingState(s,x,i)?.active===true);
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
 if(event.target.id==='ae3Source')useSourceList();
 if(event.target.dataset.ae3Field)editField(event.target);
 if(event.target.dataset.ae3Cost)editCostField(event.target);
 if(event.target.matches('select[data-edit="race"]')){
  const old=document.getElementById('ae3RacePrompt');
  if(old&&APP()?.editorDraft)old.outerHTML=racePrompt(APP().editorDraft);
 }
});
window.ARQUIVO_V3={version:'3.0',enhanceEditor,renderAbilityTab,costQuote,costLabel,billingKey,commitLocalCharge,advanceScene,effectiveDie,skillSteps,resistanceSteps,resistanceDie,consumeResistance,consumeNext,useLocally,progressSequences,parseSequence,stepDie,groupLabel};
})();