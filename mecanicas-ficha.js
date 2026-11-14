(function arquivoFichaFeatures(){
'use strict';
const PHASES=[['preparacao','Preparação'],['distancia','Distância'],['duelo','Duelo'],['desfecho','Desfecho']];
const EXPOS=['defensiva','ofensiva','ritmica'];
const DICE=[4,6,8,10,12,20];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baseCombat=()=>({scene:1,round:1,phase:'preparacao',mainUsed:false,reactionUsed:false,committedUsed:false,rhythmPending:0,rhythmRestriction:0,pressureHits:0,pressuredUntil:0,preparedTrigger:'',fearDie:0,hollowActive:false,hollowLost:false,hollowProgress:0,hollowUnlocked:false,movementSkill:'Destreza',wearGroup:'',wearPoints:0,extraEfforts:0,nextBonusDie:0,resistance:{},sustainText:'',sustainRounds:0,lastContinuousRound:0});
const app=()=>window.ARQUIVO_INTERNAL;
const sheet=()=>app()?.db?.sheets?.find(s=>s.id===app()?.currentSheet);
const can=()=>!!app()?.canEditSheet?.(app().currentSheet);
const combat=s=>({...baseCombat(),...(s?.combat||{}),resistance:{...(s?.combat?.resistance||{})}});
const bonds=s=>Array.isArray(s?.bonds)?s.bonds:[];
const isCondition=(s,name)=>Array.isArray(s?.conditions)&&s.conditions.some(x=>String(x).toLowerCase()===name.toLowerCase());
const stepsDown=(n,k)=>{let pos=DICE.indexOf(Number(n));return DICE[Math.max(0,(pos<0?0:pos)-Math.max(0,k))]};
const hasQty=(it)=>it?.quantity!==null&&it?.quantity!==undefined&&it?.quantity!=='';
function control(s){let c=combat(s);s.combat=c;return c}
function sync(message){app()?.save?.();app()?.render?.();if(message)app()?.toast?.(message)}
function wrong(message){app()?.toast?.('AÇÃO NÃO PERMITIDA',message,true)}
function actionBtn(text,cmd,style='small',disabled=false){return `<button type="button" class="btn ${style}" data-ae-mech="${esc(cmd)}" ${disabled||!can()?'disabled':''}>${text}</button>`}
function labelValue(label,v){return `<div class="ae-kpi"><span>${esc(label)}</span><strong>${esc(v)}</strong></div>`}
function getMovement(s){
 const c=combat(s),skill=c.movementSkill==='Disciplina'?'Disciplina':'Destreza';
 const die=Number(s?.skills?.[skill])||4;
 let move=die,status=[];
 if(skill==='Disciplina')status.push('Perícia alternativa — exige classe/habilidade');
 if(['EXAUSTO','CONGELADO','DESORIENTADO'].some(x=>isCondition(s,x))){move=Math.floor(move/2);status.push('Movimentação reduzida pela metade')}
 if(isCondition(s,'DERRUBADO')||isCondition(s,'IMOBILIZADO')){move=0;status.push('Sem deslocamento livre')}
 if(c.rhythmRestriction>=1){move=0;status.push('Exposição rítmica: sem movimento nesta rodada')}
 return {base:die,move:move,perAction:move*2,status};
}
function renderCombat(s){
 const c=combat(s),mv=getMovement(s),ex=s.exposures||{},wear=Number(s.desgaste)||0;
 const used=!!c.mainUsed,react=!!c.reactionUsed,lock=c.rhythmRestriction>=3,defLock=c.rhythmRestriction>=2||Number(ex.defensiva)>0&&c.committedUsed;
 const wearLimit=Number.isInteger(Number(c.wearPoints))&&Number(c.wearPoints)>0?2+Number(c.wearPoints):null;
 const res=c.resistance||{};
 const defPenalty=(Number(ex.defensiva)>1?Number(ex.defensiva)-1:0)+(Number(c.pressuredUntil)>=Number(c.round)?1:0)+(isCondition(s,'ATORDOADO')?1:0);
 const attackPenalty=Number(ex.ofensiva)||0;
 const sust=Number(c.sustainRounds)||0;
 const fear=c.fearDie?`d${c.fearDie}`:'—';
 return `<div class="ae-rpg-panel">
 <div class="panel ae-rpg-hero"><div class="sectionhead"><h2>QUADRO DE COMBATE</h2><span class="tag">RODADA ${esc(c.round)} · ${esc(PHASES.find(x=>x[0]===c.phase)?.[1]||'Preparação').toUpperCase()}</span></div>
 <p class="subtitle">Preparação → Distância → Duelo → Desfecho. As ações dentro de uma mesma fase são simultâneas.</p>
 <div class="ae-phase-flow">${PHASES.map(([id,text])=>`<span class="${c.phase===id?'active':''}">${esc(text)}</span>`).join('')}</div>
 <div class="ae-rpg-controls">${actionBtn('AVANÇAR FASE','phaseNext','main')}${actionBtn('NOVA CENA','newScene','small quiet')}${actionBtn('REINICIAR RODADA','resetRound','small quiet')}</div>
 <div class="ae-kpis">${labelValue('Ação principal',lock?'BLOQUEADA':used?'USADA':'DISPONÍVEL')}${labelValue('Reação',defLock?'BLOQUEADA':react?'USADA':'DISPONÍVEL')}${labelValue('Ação comprometedora',c.committedUsed?'USADA':wearLimit!==null&&wear>=wearLimit?'LIMITE':'DISPONÍVEL')}</div>
 <div class="ae-rpg-controls">${actionBtn('USAR AÇÃO','mainAction','small',used||lock)}${actionBtn('USAR REAÇÃO','reaction','small',react||defLock)}${actionBtn('AÇÃO PREPARADA','prepareAction','small',used||react||lock)}</div>
 ${c.preparedTrigger?`<p class="color-hint">Ação preparada: ${esc(c.preparedTrigger)}. Exige reação para disparar; é perdida se não ocorrer na rodada. ${actionBtn('DISPARAR','firePrepared','small',react||defLock)} ${actionBtn('CANCELAR','cancelPrepared','small quiet')}</p>`:''}
 </div>
 <div class="grid2">
  <section class="panel"><div class="sectionhead"><h2>MOVIMENTAÇÃO</h2><span class="tag">${mv.move} m / ${mv.perAction} m por ação</span></div>
  <p class="color-hint">Base d${mv.base} de ${esc(c.movementSkill)}. Cada ação principal oferece até o dobro da movimentação, distribuível antes e depois da ação.</p>
  ${mv.status.map(x=>`<p class="color-hint">• ${esc(x)}</p>`).join('')}
  ${can()?`<label>Referência de movimentação<select data-ae-field="movementSkill"><option value="Destreza" ${c.movementSkill==='Destreza'?'selected':''}>Destreza · padrão</option><option value="Disciplina" ${c.movementSkill==='Disciplina'?'selected':''}>Disciplina · somente com especialização</option></select></label>`:''}
  </section>
  <section class="panel"><div class="sectionhead"><h2>DESGASTE & EXPOSIÇÕES</h2><span class="tag">${wear} / ${wearLimit??'?'}</span></div>
  <div class="ae-exposure-grid">${EXPOS.map((k,i)=>labelValue(['Defensiva','Ofensiva','Rítmica'][i],`${Number(ex[k])||0} / 3`)).join('')}</div>
  <p class="color-hint">Defesa: −${defPenalty} passo(s). Ataques: −${attackPenalty} passo(s). A contenção recupera 2 desgastes e reduz uma exposição após uma rodada sem comprometimento.</p>
  ${can()?`<label>Exposição<select id="aeExposure">${EXPOS.map(k=>`<option value="${k}">${esc(k)}</option>`).join('')}</select></label>
  <div class="ae-rpg-controls">${actionBtn('COMPROMETER-SE','commit','small main',c.committedUsed||lock||(wearLimit!==null&&wear>=wearLimit))}</div>
  <label>Grupo de referência do desgaste (definido na criação)<select data-ae-field="wearGroup"><option value="">A definir</option>${['Corpo','Mente','Espírito'].map(k=>`<option value="${k}" ${c.wearGroup===k?'selected':''}>${k}</option>`).join('')}</select></label>
  <label>Pontos do grupo de referência<input type="number" min="0" max="30" data-ae-field="wearPoints" value="${esc(c.wearPoints||'')}"></label>`:''}
  </section>
 </div>
 <div class="grid2">
  <section class="panel"><div class="sectionhead"><h2>DEFESA & RESISTÊNCIA COLETIVA</h2><span class="tag">${c.pressuredUntil>=c.round?'PRESSIONADO':''}</span></div>
  <p class="color-hint">Uma resistência por recurso, por fase, aplicada separadamente a cada ataque. Não consome reação.</p>
  ${[['vida','Corpo'],['estabilidade','Mente'],['alma','Espírito']].map(([resource,g])=>`<div class="ae-resistance-row"><b>${esc(resource.toUpperCase())} · d${esc(s.groups[g]||4)}</b><span>${res[resource]?.phase===c.phase&&res[resource]?.round===c.round?'Rolagem: '+res[resource].value:'Não rolada'}</span>${actionBtn('ROLAR','resist:'+resource,'small',!!(res[resource]&&res[resource].phase===c.phase&&res[resource].round===c.round))}</div>`).join('')}
  ${can()?`<div class="ae-rpg-grid"><label>Recurso<select id="aeDamageResource"><option value="vida">Vida</option><option value="estabilidade">Estabilidade</option><option value="alma">Alma</option></select></label><label>Dano-base<input type="number" min="0" max="99999" id="aeDamageValue" value="0"></label></div>${actionBtn('APLICAR DANO','takeDamage','small main')}</div>`:''}
  <div class="ae-rpg-controls">${actionBtn('REGISTRAR ACERTO SOFRIDO','pressureHit','small')}${actionBtn('LIMPAR ACERTOS DA FASE','pressureReset','small quiet')}</div>
  <p class="color-hint">Acertos nesta fase: ${Number(c.pressureHits)||0}. A partir de 2, Pressionado reduz em 1 passo as defesas até o fim da rodada seguinte.</p>
  </section>
  <section class="panel"><div class="sectionhead"><h2>PAVOR & HOLLOWFICAÇÃO</h2><span class="tag">PAVOR ${fear}</span></div>
  <p class="color-hint">Pavor: dados abaixo do d${c.fearDie||6} são anulados. Pavor 1: supera o medo.</p>
  <div class="ae-rpg-controls">${actionBtn(c.fearDie?'AGRAVAR PAVOR':'APLICAR PAVOR','fearAdd','small')}${actionBtn('ENCERRAR PAVOR','fearClear','small quiet',!c.fearDie)}</div>
  ${c.fearDie?`<p class="color-hint">A condição Amedrontado usa o mesmo dado; novos efeitos aumentam um passo.</p>`:''}
  <p class="color-hint">Máscara: resultados acima do dado de influência são maximizados. Resultado 1: avanço. Máximo: ruptura e perda de controle.</p>
  <div class="ae-rpg-controls">${actionBtn(c.hollowActive?'REMOVER MÁSCARA':'HOLLOWFICAR','maskToggle','small main',!c.hollowActive&&!c.hollowUnlocked&&String(s.race||'').toLowerCase()!=='visored')}${actionBtn('RECUPERAR CONTROLE','maskRecover','small quiet',!c.hollowLost)}</div>
  <p class="color-hint">Máscara: ${c.hollowActive?'ATIVA':c.hollowLost?'RUPTURA · SEM CONTROLE':'INATIVA'}. Avanços de domínio: ${Number(c.hollowProgress)||0}. Os benefícios do domínio dependem de habilidades ainda a definir.</p>
  ${can()?`<label><input type="checkbox" data-ae-field="hollowUnlocked" ${c.hollowUnlocked?'checked':''}> Hollowficação concedida à ficha</label>`:''}
  </section>
 </div>
 <div class="grid2"><section class="panel"><div class="sectionhead"><h2>DESFECHO & CONDIÇÕES</h2></div>
 <p class="color-hint">Efeitos contínuos ignoram resistência natural. O desfecho também resolve Desmaiado e Acorrentado.</p>
 <div class="ae-rpg-controls">${actionBtn('APLICAR DANOS CONTÍNUOS','continuous','small',c.phase!=='desfecho'||c.lastContinuousRound===c.round)}</div>
 <p class="color-hint">Condições: ${esc((s.conditions||[]).join(', ')||'Nenhuma')}. Aplique ou retire condições na aba Condições.</p>
 <label>Exposição reduzida por contenção<select id="aeContainment"><option value="">Automática (primeira disponível)</option>${EXPOS.map(k=>`<option value="${k}">${k}</option>`).join('')}</select></label>
 </section>
 <section class="panel"><div class="sectionhead"><h2>OUTROS CONTROLES</h2></div>
 <label>Efeito sustentado<input data-ae-field="sustainText" value="${esc(c.sustainText)}" placeholder="Técnica, objeto ou esforço"></label>
 <p class="color-hint">Rodadas de sustentação: ${c.sustainRounds}. Testes para sustentar peso recebem −${c.sustainRounds} passo(s) por rodadas consecutivas (mínimo d4).</p>
 <div class="ae-rpg-controls">${actionBtn('MANTER SUSTENTAÇÃO','sustain','small')}${actionBtn('ENCERRAR','sustainEnd','small quiet')}</div>
 <p class="color-hint">Esforço extra: +1 passo em teste pertinente, custo crescente de 1d4 Vida por utilização na cena; não concede ação.</p>
 <div class="ae-rpg-controls">${actionBtn('ESFORÇO EXTRA','effort','small')}<span class="tag">USOS NA CENA ${c.extraEfforts}</span></div>
 ${c.nextBonusDie?`<p class="color-hint">Bônus de vínculo preparado: +1d${c.nextBonusDie} no próximo teste.</p>`:''}
 </section></div></div>`;
}
function renderBonds(s){
 const c=combat(s),items=bonds(s),all=(app()?.db?.sheets||[]).filter(x=>!x.redacted&&!x.masterOnly&&x.id!==s.id),m=app()?.master?.()||false;
 return `<div class="ae-rpg-panel"><section class="panel"><div class="sectionhead"><h2>VÍNCULOS NARRATIVOS</h2><span class="tag">CENA ${esc(c.scene)} · ${items.length} RELAÇÕES</span></div>
 <p class="subtitle">Afinidade (I), Vínculo (II) e Devoção (III). Cada relação pode ser invocada uma vez por cena, mediante justificativa narrativa. O mestre reconhece as evoluções de grau.</p>
 ${items.length?items.map((b,i)=>{const grade=Math.max(1,Math.min(3,Number(b.grade)||1)),used=Number(b.usedScene)===Number(c.scene),die=[0,6,8,12][grade];
 const benefits=[['teste','Bônus próprio +1d'+die],['ajuda','Auxílio +1d'+die],...(grade>=2?[['motivar',`Motivar · ${grade===2?'2d4':'2d6'} Estabilidade`]]:[]),...(grade===3?[['proteger','Ação extra para proteger/auxiliar']]:[])];
 return `<article class="ae-bond"><div class="sectionhead"><h3>${esc(b.name||'Relação sem nome')}</h3><span class="tag">${['','Ⅰ · AFINIDADE','Ⅱ · VÍNCULO','Ⅲ · DEVOÇÃO'][grade]}</span></div>
 <p>${esc(b.relation||'Relação não descrita.')}</p><div class="ae-bond-meta"><span>${b.targetSheetId?'Personagem relacionado':'Pessoa ou NPC'}</span><span>${used?'INVOCADO NESTA CENA':'DISPONÍVEL'}</span></div>
 ${can()?`<div class="ae-rpg-controls"><label>Benefício<select id="aeBondBenefit${i}">${benefits.map(([v,n])=>`<option value="${v}">${esc(n)}</option>`).join('')}</select></label>${actionBtn('INVOCAR VÍNCULO','bondInvoke:'+i,'small main',used||!!c.nextBonusDie)}</div>
 <div class="ae-rpg-controls">${m?`<label>Grau reconhecido<select id="aeBondGrade${i}" data-ae-grade="${i}">${[1,2,3].map(n=>`<option value="${n}" ${grade===n?'selected':''}>${n} — ${['','Afinidade','Vínculo','Devoção'][n]}</option>`).join('')}</select></label>`:''}${actionBtn('REMOVER','bondRemove:'+i,'small quiet')}</div>`:''}
 </article>`}).join(''):'<p class="empty">Nenhum vínculo registrado.</p>'}
 </section>${can()?`<section class="panel"><div class="sectionhead"><h2>REGISTRAR VÍNCULO</h2></div><div class="ae-rpg-grid"><label>Pessoa relacionada<input id="aeBondName" maxlength="100" placeholder="Nome do personagem ou NPC"></label><label>Associar ficha existente (opcional)<select id="aeBondTarget"><option value="">Sem ficha vinculada</option>${all.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label></div><label>Natureza da relação<input id="aeBondRelation" maxlength="200" placeholder="Amizade, rivalidade, lealdade, admiração..."></label>
 ${actionBtn('ADICIONAR AFINIDADE','bondAdd','small main')}<p class="color-hint">Bônus de teste e auxílio são aplicados automaticamente ao próximo teste próprio. Recuperação de Estabilidade é registrada com rolagem, para o mestre aplicar à pessoa indicada.</p></section>`:''}</div>`;
}
async function diceRoll(count,faces){
 const st=window.ARQUIVO_SYNC;
 if(st?.state.enabled){const r=await st.rollFree(count,faces);return {dice:(r.dice||[]).map(x=>Number(x.value)),verified:true}}
 return {dice:Array.from({length:count},()=>1+Math.floor(Math.random()*faces)),verified:false};
}
function movePhase(){
 const s=sheet(),c=control(s),idx=Math.max(0,PHASES.findIndex(x=>x[0]===c.phase));
 if(idx<3){c.phase=PHASES[idx+1][0];c.pressureHits=0;c.resistance={};}
 else{
  if(!c.committedUsed){s.desgaste=Math.max(0,Number(s.desgaste||0)-2);let chosen=document.getElementById('aeContainment')?.value||'';const ex=s.exposures||{};if(!chosen||!Number(ex[chosen]))chosen=EXPOS.find(k=>Number(ex[k])>0)||'';if(chosen)ex[chosen]=Math.max(0,Number(ex[chosen])-1);s.exposures=ex;}
  c.round++;c.phase='preparacao';c.mainUsed=false;c.reactionUsed=false;c.committedUsed=false;c.preparedTrigger='';c.pressureHits=0;c.resistance={};
  c.rhythmRestriction=c.rhythmPending||0;c.rhythmPending=0;
  if(c.rhythmRestriction>=2)c.reactionUsed=true;
  if(c.rhythmRestriction>=3)c.mainUsed=true;
  if(c.pressuredUntil<c.round){s.conditions=(s.conditions||[]).filter(x=>String(x).toLowerCase()!=='pressionado')}
 }
 sync('Fase atualizada');
}
async function runAction(key,param){
 const s=sheet();if(!s||!can())return wrong('Você não pode modificar esta ficha.');
 const c=control(s),ex=s.exposures||{};s.exposures=ex;
 const v=(id)=>document.getElementById(id)?.value;
 const num=(id)=>Number(v(id))||0;
 if(key==='phaseNext')return movePhase();
 if(key==='newScene'){c.scene++;c.extraEfforts=0;c.nextBonusDie=0;return sync('Nova cena iniciada')}
 if(key==='resetRound'){c.mainUsed=false;c.reactionUsed=false;c.committedUsed=false;c.pressureHits=0;c.resistance={};c.preparedTrigger='';return sync('Oportunidades da rodada reiniciadas')}
 if(key==='mainAction'){if(c.mainUsed||c.rhythmRestriction>=3)return wrong('Ação principal indisponível.');c.mainUsed=true;return sync('Ação principal utilizada')}
 if(key==='reaction'){if(c.reactionUsed||c.rhythmRestriction>=2)return wrong('Reação indisponível.');c.reactionUsed=true;return sync('Reação utilizada')}
 if(key==='prepareAction'){if(c.mainUsed||c.reactionUsed)return wrong('É necessário ter ação principal e reação disponíveis.');const trigger=prompt('Qual acontecimento ativa a ação preparada?');if(!trigger)return;c.mainUsed=true;c.preparedTrigger=trigger.slice(0,220);return sync('Ação reservada')}
 if(key==='firePrepared'){if(!c.preparedTrigger||c.reactionUsed)return wrong('A preparação não pode ser disparada.');c.preparedTrigger='';c.reactionUsed=true;return sync('Ação preparada disparada')}
 if(key==='cancelPrepared'){c.preparedTrigger='';return sync('Preparação cancelada')}
 if(key==='commit'){const kind=v('aeExposure');if(!EXPOS.includes(kind))return wrong('Escolha uma exposição válida.');const limit=c.wearPoints?2+Number(c.wearPoints):null;if(c.committedUsed||c.rhythmRestriction>=3||Number(ex[kind])>=3||limit!==null&&Number(s.desgaste)>=limit)return wrong('Limite de ações comprometedoras ou exposição alcançado.');ex[kind]=Math.min(3,Number(ex[kind]||0)+1);s.desgaste=Number(s.desgaste||0)+1;c.committedUsed=true;if(kind==='defensiva')c.reactionUsed=true;if(kind==='ritmica')c.rhythmPending=ex[kind];return sync('Ação comprometedora registrada')}
 if(key==='fearAdd'){c.fearDie=c.fearDie?DICE[Math.min(DICE.length-1,DICE.indexOf(c.fearDie)+1)]:6;s.conditions??=[];if(!isCondition(s,'AMEDRONTADO'))s.conditions.push('Amedrontado');return sync('Pavor aplicado')}
 if(key==='fearClear'){c.fearDie=0;s.conditions=(s.conditions||[]).filter(x=>String(x).toLowerCase()!=='amedrontado');return sync('Pavor encerrado')}
 if(key==='maskToggle'){if(!c.hollowActive&&!c.hollowUnlocked&&String(s.race||'').toLowerCase()!=='visored')return wrong('Hollowficação ainda não autorizada para a ficha.');if(c.hollowLost&&!c.hollowActive)return wrong('Recupere o controle antes de colocar a máscara.');c.hollowActive=!c.hollowActive;return sync(c.hollowActive?'Máscara ativada':'Máscara removida')}
 if(key==='maskRecover'){c.hollowLost=false;return sync('Controle restaurado pelo mestre/narrativa')}
 if(key==='pressureHit'){c.pressureHits++;if(c.pressureHits>=2){c.pressuredUntil=Math.max(c.pressuredUntil,c.round+1);s.conditions??=[];if(!isCondition(s,'Pressionado'))s.conditions.push('Pressionado')}return sync('Acerto sofrido registrado')}
 if(key==='pressureReset'){c.pressureHits=0;return sync('Acertos da fase zerados')}
 if(key==='resist'){if(!['vida','estabilidade','alma'].includes(param))return;const g={vida:'Corpo',estabilidade:'Mente',alma:'Espírito'}[param];if(c.resistance?.[param]?.round===c.round&&c.resistance?.[param]?.phase===c.phase)return wrong('Resistência coletiva já rolada nesta fase.');try{const r=await diceRoll(1,Number(s.groups?.[g])||4);c.resistance[param]={round:c.round,phase:c.phase,value:r.dice[0]};sync('Resistência '+g+': '+r.dice[0]+(r.verified?' · verificada':' · local'));}catch(e){wrong(e.message)}return}
 if(key==='takeDamage'){const resource=v('aeDamageResource'),damage=num('aeDamageValue');if(!['vida','estabilidade','alma'].includes(resource)||damage<0||!Number.isFinite(damage)||damage>99999)return wrong('Dano inválido.');const res=c.resistance?.[resource];const red=res?.round===c.round&&res?.phase===c.phase?Number(res.value):0;const taken=Math.max(0,damage-red);const entry=s.resources?.[resource];if(!entry)return wrong('Recurso indisponível.');entry.current=Math.max(0,Number(entry.current)-taken);if(entry.current===0){s.conditions??=[];const stateName=resource==='estabilidade'?'Acorrentado':'Desmaiado';if(!isCondition(s,stateName))s.conditions.push(stateName)}return sync('Dano efetivo '+taken+' · resistência '+red)}
 if(key==='continuous'){if(c.phase!=='desfecho'||c.lastContinuousRound===c.round)return wrong('Danos contínuos são resolvidos uma vez no Desfecho.');const effects=[['sangrando',4,1],['envenenado',4,1],['queimando',6,1]];if(isCondition(s,'sufocando')){c.suffocationTurns=Number(c.suffocationTurns||0)+1;if(c.suffocationTurns>=2)effects.push(['sufocando',6,1])}else c.suffocationTurns=0;let total=0,log=[];try{for(const [name,die,count] of effects){if(!isCondition(s,name)&&name!=='sufocando')continue;const r=await diceRoll(count,die);const dmg=r.dice.reduce((a,b)=>a+b,0);total+=dmg;log.push(name+' '+dmg)}c.lastContinuousRound=c.round;s.resources.vida.current=Math.max(0,Number(s.resources.vida.current)-total);sync(total?'Danos contínuos '+total+' · '+log.join(', '):'Sem danos contínuos');}catch(e){wrong(e.message)}return}
 if(key==='sustain'){if(!c.sustainText)return wrong('Informe o efeito sustentado.');c.sustainRounds++;return sync('Sustentação: rodada '+c.sustainRounds)}
 if(key==='sustainEnd'){c.sustainText='';c.sustainRounds=0;return sync('Sustentação encerrada')}
 if(key==='effort'){const count=Number(c.extraEfforts||0)+1;if(s.resources?.vida?.current===0)return wrong('Sem Vida disponível.');try{const r=await diceRoll(count,4),dmg=r.dice.reduce((a,b)=>a+b,0);c.extraEfforts=count;s.resources.vida.current=Math.max(0,Number(s.resources.vida.current)-dmg);c.nextStep=1;sync('Esforço extra: −'+dmg+' Vida; +1 passo em teste adequado (aplique no teste)');}catch(e){wrong(e.message)}return}
 if(key==='bondAdd'){const name=v('aeBondName')?.trim(),relation=v('aeBondRelation')?.trim(),target=v('aeBondTarget')||'';if(!name||name.length>100||relation.length>200)return wrong('Preencha o nome e a natureza da relação.');s.bonds??=[];if(s.bonds.length>=20)return wrong('Limite de 20 vínculos por ficha.');s.bonds.push({id:crypto.randomUUID(),name,relation:relation||'',targetSheetId:target,grade:1,usedScene:0});return sync('Afinidade registrada')}
 if(key==='bondRemove'){const i=Number(param);if(!Number.isInteger(i)||!bonds(s)[i])return;if(!confirm('Remover este vínculo narrativo?'))return;s.bonds.splice(i,1);return sync('Vínculo removido')}
 if(key==='bondInvoke'){const i=Number(param),b=bonds(s)[i];if(!b)return;const mode=v('aeBondBenefit'+i);if(Number(b.usedScene)===c.scene)return wrong('Este vínculo já foi invocado na cena.');const grade=Math.max(1,Math.min(3,Number(b.grade)||1)),die=[0,6,8,12][grade];if(['teste','ajuda'].includes(mode)){if(c.nextBonusDie)return wrong('Há um bônus de vínculo aguardando o próximo teste.');b.usedScene=c.scene;c.nextBonusDie=die;return sync('Bônus +1d'+die+' preparado para o próximo teste')}
 if(mode==='proteger'){if(grade<3)return wrong('Requer Devoção III.');b.usedScene=c.scene;c.devotionExtraAction=true;return sync('Ação adicional de Devoção disponível apenas para proteger/auxiliar')}
 if(mode==='motivar'){if(grade<2)return wrong('Requer Vínculo II.');try{const n=grade===2?4:6,r=await diceRoll(2,n),amount=r.dice.reduce((a,b)=>a+b,0);b.usedScene=c.scene;c.lastBondHeal={name:b.name,amount,targetSheetId:b.targetSheetId||'',scene:c.scene};sync('Motivação: '+amount+' de Estabilidade para '+b.name+' · aplicar ao alvo');}catch(e){wrong(e.message)}return}
 }
}
function updateField(key,value){
 const s=sheet();if(!s||!can())return;const c=control(s);
 if(key==='wearGroup'){if(!['','Corpo','Mente','Espírito'].includes(value))return;c.wearGroup=value}
 else if(key==='movementSkill'){if(!['Destreza','Disciplina'].includes(value))return;c.movementSkill=value}
 else if(key==='wearPoints'){const n=value===''?0:Number(value);if(!Number.isInteger(n)||n<0||n>30)return;c.wearPoints=n}
 else if(key==='hollowUnlocked'){c.hollowUnlocked=!!value}
 else if(key==='sustainText')c.sustainText=String(value).slice(0,200);
 else return;
 sync();
}
function updateGrade(i,value){
 if(!app()?.master?.())return wrong('Somente o mestre reconhece evolução dos vínculos.');
 const s=sheet(),b=bonds(s)[i],grade=Number(value);if(!b||!Number.isInteger(grade)||grade<1||grade>3)return;b.grade=grade;sync('Grau do vínculo atualizado');
}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-ae-mech]');if(!t)return;e.preventDefault();e.stopPropagation();if(t.disabled)return;const [action,param]=t.dataset.aeMech.split(':');try{await runAction(action,param)}catch(error){wrong(error.message)}});
document.addEventListener('change',e=>{const el=e.target;if(el.matches('[data-ae-field]'))updateField(el.dataset.aeField,el.type==='checkbox'?el.checked:el.value);if(el.matches('[data-ae-grade]'))updateGrade(Number(el.dataset.aeGrade),el.value)});
window.ARQUIVO_FEATURES={renderCombat,renderBonds,combat};
})();