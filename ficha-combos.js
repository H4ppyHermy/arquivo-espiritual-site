/* Combos do Resumo: sequências de habilidades/técnicas sem automatizar cobranças. */
(function(global){
 'use strict';
 const api=global.ARQUIVO_INTERNAL;
 if(!api)return;
 const MAX_COMBOS=24,MAX_STEPS=12,PENDING_KEY='arquivo_combo_pendentes_v1';
 const esc=s=>api.esc(String(s??''));
 const progress=new Map(),opened=new Set();
 let draft=null,draftSheetId='',editingId='',saving=false,flushing=false;
 const rawSheet=id=>api.db?.sheets?.find(s=>s.id===id)||null;
 const list=s=>Array.isArray(s?.combos)?s.combos.filter(c=>c&&typeof c==='object'&&Array.isArray(c.steps)):[];
 const skillList=s=>(Array.isArray(s?.abilities)?s.abilities:[]).map((ab,index)=>({ab,index})).filter(({ab})=>ab&&typeof ab.name==='string'&&ab.name.trim()&&!ab.origin?.auto);
 const kind=ab=>ab.libraryType==='tecnica'?'tecnica':'habilidade';
 const stableId=ab=>String(ab.abilityId||ab.automation?.id||'').trim().slice(0,140);
 const cleanCost=ab=>Number.isFinite(Number(ab?.cost))?Math.max(0,Number(ab.cost)):0;
 const sessionKey=(sid,cid)=>sid+':'+cid;
 function reference(ab,index){return {abilityId:stableId(ab),name:String(ab.name).slice(0,140),kind:kind(ab),index,note:''}}
 function resolve(sheet,step){
  const items=skillList(sheet),identity=String(step?.abilityId||'');
  if(identity){
   const found=items.find(x=>stableId(x.ab)===identity&&kind(x.ab)===step.kind);
   if(found)return found;
  }
  const same=items.filter(x=>kind(x.ab)===step?.kind&&x.ab.name===step?.name);
  if(same.length===1)return same[0];
  const byIndex=items.find(x=>x.index===Number(step?.index));
  return byIndex&&byIndex.ab.name===step?.name&&kind(byIndex.ab)===step?.kind?byIndex:null;
 }
 function totals(sheet,combo){
  let cost=0,missing=0,conditional=0;
  for(const step of combo.steps||[]){
   const found=resolve(sheet,step);
   if(!found){missing++;continue}
   cost+=cleanCost(found.ab);
   if(found.ab.costConfig?.mode==='activation'||found.ab.costConfig?.requires||found.ab.unlock?.requires)conditional++;
  }
  return {cost,missing,conditional};
 }
 function buttonsForStep(sheet,ctx,entry){
  const ab=entry.ab,index=entry.index;
  if(!ctx.canEdit)return '';
  if(ab.passive||ab.category==='passive')return '';
  return global.ARQUIVO_CBB_UI?.abilityActions?.(ab,index,ctx)||'';
 }
 function activeRelease(sheet,entry){
  const ab=entry?.ab;
  if(!ab||ab.costConfig?.mode!=='activation')return false;
  const key=String(ab.abilityId||ab.automation?.id||'legacy:'+entry.index);
  const billing=sheet.abilityRuntime?.billing?.[key];
  return billing?.active===true&&Number(billing.scene)===Number(sheet.combat?.scene||1);
 }
 function manualAllowed(sheet,step){
  const entry=resolve(sheet,step);
  if(!entry)return false;
  if(activeRelease(sheet,entry))return true;
  const ab=entry.ab;
  return ab.passive||ab.category==='passive'||(cleanCost(ab)===0&&ab.costConfig?.mode!=='activation');
 }
 function stepMarkup(s,ctx,combo,step,i,active){
  const found=resolve(s,step),ab=found?.ab;
  const state=progress.get(sessionKey(s.id,combo.id))||0;
  const done=active&&i<state,upcoming=active&&i===state,locked=active&&i>state;
  const type=ab?kind(ab):step.kind;
  const phase=ab?global.ARQUIVO_CBB_ENGINE?.abilityPhase?.(ab):null;
  const cost=ab?cleanCost(ab):0;
  const releaseActive=!!(ab&&upcoming&&activeRelease(s,found));
  const activeActions=ab&&upcoming&&!releaseActive?buttonsForStep(s,ctx,found):'';
  const manual=ab&&upcoming&&manualAllowed(s,step);
  const note=typeof step.note==='string'?step.note:'';
  return '<li class="ae-combo-step'+(done?' is-done':'')+(upcoming?' is-current':'')+(locked?' is-queued':'')+(ab?'':' is-missing')+
   '" data-combo-card-step data-combo-id="'+esc(combo.id)+'" data-combo-step="'+i+'">'+
   '<span class="ae-combo-step-number">'+(done?'✓':i+1)+'</span><div class="ae-combo-step-content"><div class="ae-combo-step-head">'+
   '<strong>'+esc(ab?.name||step.name||'Habilidade removida')+'</strong>'+
   '<span class="ae-combo-step-kind">'+esc(type==='tecnica'?'TÉCNICA':'HABILIDADE')+'</span>'+
   '<span class="ae-combo-step-cost">'+(ab?cost+' ALMA':'INDISPONÍVEL')+'</span></div>'+
   (phase?'<div class="ae-combo-step-phase">Fase: '+esc(phase)+'</div>':'')+
   (note?'<p class="ae-combo-step-note">'+esc(note)+'</p>':'')+
   (!ab?'<p class="ae-combo-step-warning">A habilidade foi alterada ou removida. Edite o combo para substituir esta etapa.</p>':'')+
   (active&&ctx.canEdit&&upcoming?
    '<div class="ae-combo-step-actions">'+
    (releaseActive?'<span class="ae-combo-progress">LIBERAÇÃO JÁ ATIVA</span>':'')+
    activeActions+
    (manual?'<button type="button" class="btn small quiet" data-combo-action="advance:'+esc(combo.id)+':'+i+'">'+(releaseActive?'PRÓXIMA ETAPA':'MARCAR ETAPA FEITA')+'</button>':'')+
    (!manual&&!activeActions?'<span class="ae-combo-step-warning">Ação indisponível; verifique pré-requisitos, automação e conexão.</span>':'')+
    '</div>':'')+
   '</div></li>';
 }
 function card(sheet,ctx,combo){
  const stats=totals(sheet,combo),active=opened.has(sessionKey(sheet.id,combo.id));
  const current=progress.get(sessionKey(sheet.id,combo.id))||0;
  const alma=Number(sheet.resources?.alma?.current??0);
  const enough=stats.cost<=alma;
  return '<article class="ae-combo-card" data-combo-card="'+esc(combo.id)+'"><details'+(active?' open':'')+'>'+
   '<summary class="ae-combo-card-title"><div class="ae-combo-card-heading"><strong>'+esc(combo.name)+'</strong>'+
   '<span>'+combo.steps.length+' ETAPAS · '+stats.cost+' ALMA PREVISTA</span></div>'+
   '<span aria-hidden="true">⌄</span></summary><div class="ae-combo-card-body">'+
   (combo.description?'<p class="ae-combo-description">'+esc(combo.description)+'</p>':'')+
   '<div class="ae-combo-metrics"><span>Custo base: <b>'+stats.cost+' ALMA</b></span>'+
   '<span>Disponível: <b>'+alma+' ALMA</b></span><span class="'+(enough?'':'ae-combo-alert')+'">'+
   (enough?'Saldo suficiente para o custo base':'ALMA abaixo do custo base')+'</span>'+
   (stats.missing?'<span class="ae-combo-alert">'+stats.missing+' habilidade(s) indisponível(is)</span>':'')+
   (stats.conditional?'<span>Custo de liberações e pré-requisitos pode variar</span>':'')+'</div>'+
   '<ol class="ae-combo-steps">'+combo.steps.map((step,i)=>stepMarkup(sheet,ctx,combo,step,i,active)).join('')+'</ol>'+
   (ctx.canEdit?'<div class="ae-combo-card-actions">'+
    (!active?'<button type="button" class="btn main small" data-combo-action="start:'+esc(combo.id)+'">INICIAR SEQUÊNCIA</button>':
     '<span class="ae-combo-progress">'+(current>=combo.steps.length?'COMBO CONCLUÍDO':(current+1)+' / '+combo.steps.length+' · PRÓXIMA ETAPA')+'</span>'+
     '<button type="button" class="btn small" data-combo-action="restart:'+esc(combo.id)+'">REINICIAR</button>')+
    '<button type="button" class="btn small" data-combo-action="edit:'+esc(combo.id)+'">EDITAR</button>'+
    '<button type="button" class="btn small quiet" data-combo-action="duplicate:'+esc(combo.id)+'">DUPLICAR</button>'+
    '<button type="button" class="btn small danger" data-combo-action="delete:'+esc(combo.id)+'">EXCLUIR</button></div>':'')+
   '</div></details></article>';
 }
 function render(sheet,ctx={}){
  const s=rawSheet(sheet?.id)||sheet;if(!s)return '';
  const combos=list(s);
  return '<section class="ae-ficha-combos" aria-label="Combos personalizados">'+
   '<div class="ae-ficha-section-heading"><div class="ae-ficha-section-title"><h2>Combos</h2></div>'+
   (ctx.canEdit?'<button type="button" class="btn main small" data-combo-action="new"'+(combos.length>=MAX_COMBOS?' disabled':'')+'>+ CRIAR COMBO</button>':'')+'</div>'+
   '<p class="ae-combo-intro">Organize habilidades e técnicas na ordem desejada, com custo de ALMA calculado automaticamente. A execução é por etapas para respeitar as regras da Mesa.</p>'+
   (combos.length?'<div class="ae-combo-list">'+combos.map(combo=>card(s,ctx,combo)).join('')+'</div>':
    '<div class="ae-combo-empty">Nenhum combo criado.'+(ctx.canEdit?' Crie uma sequência para preparar suas jogadas favoritas.':'')+'</div>')+
   '</section>';
 }
 function editStepRows(){
  const s=rawSheet(draftSheetId);if(!draft)return '';
  const rows=draft.steps.map((step,i)=>{
   const found=resolve(s,step),ab=found?.ab,cost=ab?cleanCost(ab):0;
   return '<div class="ae-combo-editor-step" data-combo-editor-index="'+i+'"><span class="ae-combo-step-number">'+(i+1)+'</span>'+
    '<div class="ae-combo-editor-step-body"><strong>'+esc(ab?.name||step.name)+'</strong>'+
    '<small>'+(ab?esc(kind(ab)==='tecnica'?'TÉCNICA':'HABILIDADE')+' · '+cost+' ALMA':'HABILIDADE INDISPONÍVEL')+'</small>'+
    '<label>Observação desta etapa<input type="text" data-combo-step-note="'+i+'" maxlength="220" value="'+esc(step.note||'')+'" placeholder="Ex.: usar após atingir o alvo"></label></div>'+
    '<div class="ae-combo-editor-step-buttons"><button type="button" data-combo-action="move:'+i+':-1" aria-label="Mover etapa '+(i+1)+' para cima"'+(i===0?' disabled':'')+'>↑</button>'+
    '<button type="button" data-combo-action="move:'+i+':1" aria-label="Mover etapa '+(i+1)+' para baixo"'+(i===draft.steps.length-1?' disabled':'')+'>↓</button>'+
    '<button type="button" data-combo-action="remove:'+i+'" aria-label="Remover etapa '+(i+1)+'">×</button></div></div>';
  }).join('');
  return rows||'<p class="ae-combo-empty">Inclua pelo menos uma habilidade ou técnica.</p>';
 }
 function draftRefresh(){
  const box=global.document.getElementById('comboStepRows');if(box)box.innerHTML=editStepRows();
  const summary=global.document.getElementById('comboEditorCost');
  if(summary&&draft)summary.textContent='Custo base estimado: '+totals(rawSheet(draftSheetId),draft).cost+' ALMA · '+draft.steps.length+'/'+MAX_STEPS+' etapas';
  const add=global.document.querySelector('[data-combo-action="add"]');if(add)add.disabled=!!draft&&draft.steps.length>=MAX_STEPS;
 }
 function capture(){
  if(!draft)return;
  const name=global.document.getElementById('comboName'),description=global.document.getElementById('comboDescription');
  if(name)draft.name=name.value;if(description)draft.description=description.value;
  global.document.querySelectorAll('[data-combo-step-note]').forEach(input=>{
   const index=Number(input.dataset.comboStepNote);
   if(draft.steps[index])draft.steps[index].note=input.value;
  });
 }
 function editor(id='',duplicate=false){
  const s=rawSheet(api.currentSheet);
  if(!s||!api.canEditSheet(s.id))return;
  if(!id&&list(s).length>=MAX_COMBOS){api.toast('Limite atingido','São permitidos até 24 combos por ficha.',true);return}
  const from=list(s).find(c=>c.id===id);
  if(id&&!from){api.toast('Combo indisponível','Atualize a ficha e tente novamente.',true);return}
  editingId=duplicate?'':id;draftSheetId=s.id;
  draft=from?JSON.parse(JSON.stringify(from)):{id:api.uid(),name:'',description:'',steps:[]};
  if(duplicate){draft.id=api.uid();draft.name=(draft.name+' (cópia)').slice(0,70)}
  const abilities=skillList(s),options=abilities.map(({ab,index})=>'<option value="'+index+'">'+esc(ab.name)+' · '+(kind(ab)==='tecnica'?'TÉCNICA':'HABILIDADE')+' · '+cleanCost(ab)+' ALMA</option>').join('');
  api.modal(duplicate?'DUPLICAR COMBO':from?'EDITAR COMBO':'CRIAR COMBO',
   '<div class="ae-combo-editor"><p>Monte a ordem de execução. Os custos são recalculados conforme a ficha; nada será gasto ao salvar.</p>'+
   '<div class="field"><label for="comboName">NOME DO COMBO</label><input id="comboName" maxlength="70" value="'+esc(draft.name)+'" placeholder="Ex.: Abertura de Duelo"></div>'+
   '<div class="field"><label for="comboDescription">ESTRATÉGIA / GATILHO</label><textarea id="comboDescription" rows="3" maxlength="500" placeholder="Quando utilizar esta sequência?">'+esc(draft.description||'')+'</textarea></div>'+
   '<div class="ae-combo-editor-picker"><label for="comboAbilityPicker">ADICIONAR HABILIDADE OU TÉCNICA</label>'+
   '<div><select id="comboAbilityPicker"'+(abilities.length?'':' disabled')+'>'+options+'</select>'+
   '<button type="button" class="btn small" data-combo-action="add"'+(abilities.length?'':' disabled')+'>+ ETAPA</button></div></div>'+
   '<h3>ORDEM DA SEQUÊNCIA</h3><div id="comboStepRows" class="ae-combo-editor-rows"></div>'+
   '<div class="ae-combo-editor-total" id="comboEditorCost"></div><p id="comboEditorError" class="ae-combo-editor-error" role="alert"></p>'+
   '</div>',
   [['SALVAR COMBO','comboSave','main'],['CANCELAR','closeModal','small']]);
  draftRefresh();
 }
 function readPending(){try{const data=JSON.parse(global.localStorage?.getItem(PENDING_KEY)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch(e){return {}}}
 function writePending(data){try{global.localStorage?.setItem(PENDING_KEY,JSON.stringify(data));return true}catch(e){return false}}
 function pend(sheetId,combos){const p=readPending();p[sheetId]=combos;writePending(p)}
 function unpend(sheetId){const p=readPending();delete p[sheetId];writePending(p)}
 async function persist(combos){
  const s=rawSheet(draftSheetId);if(!s||!api.canEditSheet(s.id))throw Error('Sem permissão nesta ficha.');
  const sync=global.ARQUIVO_SYNC;
  if(sync?.state?.enabled){
   if(typeof sync.saveCombos!=='function')throw Error('Atualize a página para utilizar a sincronização de combos.');
   const result=await sync.saveCombos(s.id,combos);
   if(!result||!Array.isArray(result.combos))throw Error('O servidor não confirmou os combos.');
   s.combos=result.combos;unpend(s.id);
   api.cacheOnly?.();
   return 'sincronizado';
  }
  s.combos=combos;
  pend(s.id,combos);
  api.save();
  return 'local';
 }
 async function saveEditor(){
  if(saving||!draft)return;
  capture();
  const name=String(draft.name||'').trim(),description=String(draft.description||'').trim();
  const error=global.document.getElementById('comboEditorError');
  if(!name||name.length>70){if(error)error.textContent='Informe um nome com até 70 caracteres.';return}
  if(draft.steps.length<1||draft.steps.length>MAX_STEPS){if(error)error.textContent='Adicione entre 1 e 12 etapas.';return}
  const s=rawSheet(draftSheetId);if(!s)return;
  const combos=list(s).map(c=>JSON.parse(JSON.stringify(c))),item={id:draft.id,name,description,steps:draft.steps};
  const i=combos.findIndex(c=>c.id===editingId);
  if(i>=0)combos[i]=item;else combos.push(item);
  if(combos.length>MAX_COMBOS){if(error)error.textContent='Limite de 24 combos alcançado.';return}
  saving=true;
  const button=global.document.querySelector('[data-action="comboSave"]');if(button)button.disabled=true;
  try{
   const result=await persist(combos);
   opened.add(sessionKey(s.id,item.id));progress.set(sessionKey(s.id,item.id),0);
   draft=null;api.closeModal();api.render();
   api.toast(result==='local'?'Combo salvo neste navegador':'Combo sincronizado',result==='local'?'A versão offline será enviada quando a conexão retornar.':name);
  }catch(e){if(error)error.textContent=String(e.message||e);api.toast('Combo não salvo',String(e.message||e),true)}
  finally{saving=false;if(button?.isConnected)button.disabled=false}
 }
 async function deleteCombo(id){
  const s=rawSheet(api.currentSheet);if(!s||!api.canEditSheet(s.id))return;
  const found=list(s).find(c=>c.id===id);if(!found)return;
  api.confirmSite('EXCLUIR COMBO','Excluir "'+found.name+'"? As habilidades da ficha não serão afetadas.',async()=>{
   try{const result=await persistForSheet(s,list(s).filter(c=>c.id!==id));
    opened.delete(sessionKey(s.id,id));progress.delete(sessionKey(s.id,id));api.render();
    api.toast(result==='local'?'Combo excluído localmente':'Combo excluído','');}
   catch(e){api.toast('Não foi possível excluir',String(e.message||e),true)}
  });
 }
 async function persistForSheet(s,combos){
  draftSheetId=s.id;
  return persist(combos);
 }
 function completeStep(sheetId,comboId,index){
  const s=rawSheet(sheetId),combo=list(s).find(c=>c.id===comboId);if(!combo)return;
  const key=sessionKey(sheetId,comboId),current=progress.get(key)||0;
  if(!opened.has(key)||index!==current||current>=combo.steps.length)return;
  progress.set(key,current+1);
 }
 async function flushPending(){
  const sync=global.ARQUIVO_SYNC;if(flushing||!sync?.state?.enabled||!sync.saveCombos)return;
  const data=readPending(),ids=Object.keys(data);if(!ids.length)return;
  flushing=true;
  try{
   for(const sheetId of ids){
    if(!api.canEditSheet(sheetId))continue;
    const combos=data[sheetId];if(!Array.isArray(combos))continue;
    try{
     const confirmed=await sync.saveCombos(sheetId,combos);
     if(Array.isArray(confirmed?.combos)){
      const s=rawSheet(sheetId);if(s)s.combos=confirmed.combos;
      unpend(sheetId);api.cacheOnly?.();
      if(api.currentSheet===sheetId&&api.page==='sheets')api.render();
     }
    }catch(e){api.toast('Combo offline pendente','Falha ao sincronizar: '+String(e.message||e),true)}
   }
  }finally{flushing=false}
 }
 function onClick(event){
  const button=event.target?.closest?.('[data-combo-action]');
  if(!button)return;
  event.preventDefault();
  if(button.disabled)return;
  const [action,id,arg]=button.dataset.comboAction.split(':');
  const s=rawSheet(api.currentSheet);
  if(!s||!api.canEditSheet(s.id))return;
  if(action==='new'){editor();return}
  if(action==='edit'){editor(id);return}
  if(action==='duplicate'){editor(id,true);return}
  if(action==='delete'){deleteCombo(id);return}
  if(action==='start'||action==='restart'){
   const key=sessionKey(s.id,id);opened.add(key);progress.set(key,0);api.render();return;
  }
  if(action==='advance'){
   const index=Number(arg),combo=list(s).find(c=>c.id===id);
   if(!combo||!Number.isInteger(index)||!manualAllowed(s,combo.steps[index]))return;
   completeStep(s.id,id,index);api.render();return;
  }
  if(!draft||draftSheetId!==s.id)return;
  capture();
  if(action==='add'){
   const index=Number(global.document.getElementById('comboAbilityPicker')?.value);
   const found=skillList(s).find(x=>x.index===index);
   if(found&&draft.steps.length<MAX_STEPS)draft.steps.push(reference(found.ab,index));
  }else if(action==='remove'){
   draft.steps.splice(Number(id),1);
  }else if(action==='move'){
   const from=Number(id),to=from+Number(arg);
   if(from>=0&&to>=0&&to<draft.steps.length)[draft.steps[from],draft.steps[to]]=[draft.steps[to],draft.steps[from]];
  }
  draftRefresh();
 }
 global.document.addEventListener('click',onClick);
 global.document.addEventListener('click',event=>{
  if(event.target?.closest?.('[data-action="comboSave"]')){event.preventDefault();saveEditor()}
 });
 global.addEventListener?.('arquivo-online-ready',()=>{flushPending()});
 global.ARQUIVO_COMBOS=Object.freeze({render,resolve,totals,completeStep,flushPending});
 if(global.ARQUIVO_SYNC?.state?.enabled)Promise.resolve().then(flushPending);
})(window);
