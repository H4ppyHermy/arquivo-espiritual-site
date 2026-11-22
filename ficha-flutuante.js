/* Ficha sempre à mão: painel portátil, sem trocar de página. */
(function(global){
 'use strict';
 const d=global.document,api=global.ARQUIVO_INTERNAL;
 if(!d||!api)return;
 let selected='',expanded=false,tab='summary',loading=false,revision='',requesting=false;
 const safe=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const num=value=>Math.max(0,Number(value)||0);
 const label={summary:'RESUMO',mesa:'MESA',skills:'PERÍCIAS',abilities:'HABILIDADES'};
 function ownSheets(){
  if(api.role!=='player'||!global.ARQUIVO_SYNC?.state?.identity?.id)return [];
  return (api.db?.sheets||[]).filter(s=>s&&!s.masterOnly&&!s.redacted&&api.isLinked(s));
 }
 function storageKey(){
  const id=global.ARQUIVO_SYNC?.state?.identity?.id||'';
  return 'ae_quick_character_v1:'+id;
 }
 function resolve(){
  const available=ownSheets();if(!available.length){selected='';return null}
  if(!available.some(s=>s.id===selected)){
   let saved='';try{saved=global.localStorage?.getItem(storageKey())||''}catch(e){}
   selected=available.some(s=>s.id===saved)?saved:available[0].id;
  }
  return available.find(s=>s.id===selected)||null;
 }
 function remember(id){
  selected=id;try{global.localStorage?.setItem(storageKey(),id)}catch(e){}
 }
 function host(){
  let root=d.getElementById('aeQuickSheetRoot');
  if(root)return root;
  root=d.createElement('div');root.id='aeQuickSheetRoot';root.className='ae-quick-sheet-root';
  d.body.appendChild(root);
  return root;
 }
 function img(sheet){
  if(!sheet.image||!api.dataUrlOk(sheet.image))return '<span aria-hidden="true" class="ae-quick-avatar-fallback">魂</span>';
  const url=api.mediaSrc(sheet.image);
  return url?'<img src="'+safe(url)+'" alt="" loading="lazy" decoding="async">':
   '<span aria-hidden="true" class="ae-quick-avatar-fallback">魂</span>';
 }
 function resources(sheet){
  return [['vida','VIDA'],['estabilidade','ESTABILIDADE'],['alma','ALMA']].map(([key,name])=>{
   const r=sheet.resources?.[key]||{},value=num(r.current),max=num(r.max);
   const percent=max?Math.max(0,Math.min(100,value/max*100)):0;
   return '<div class="ae-quick-resource ae-quick-resource-'+key+'"><div><strong>'+name+
    '</strong><span>'+value+' / '+max+'</span></div><div class="ae-quick-meter" role="meter" aria-label="'+name+
    '" aria-valuenow="'+value+'" aria-valuemin="0" aria-valuemax="'+Math.max(max,value)+
    '"><i style="width:'+percent.toFixed(2)+'%"></i></div></div>';
  }).join('');
 }
 function actionSummary(sheet){
  const combat=sheet.combat||{},extra=combat.cbb||{},stunned=(sheet.conditions||[]).some(c=>String(c).toLowerCase()==='atordoado');
  const status=(spent,extras,block)=>block?'BLOQUEADA':extras?'EXTRA DISPONÍVEL':spent?'USADA':'DISPONÍVEL';
  return '<div class="ae-quick-actions">'+
   '<div><span>PRINCIPAL</span><strong class="'+(combat.mainUsed&&!extra.extraMain?'is-spent':'')+'">'+
    status(combat.mainUsed,extra.extraMain,false)+'</strong></div>'+
   '<div><span>REAÇÃO</span><strong class="'+(combat.reactionUsed&&!extra.extraReaction||stunned?'is-spent':'')+'">'+
    status(combat.reactionUsed,extra.extraReaction,stunned)+'</strong></div></div>';
 }
 function summary(sheet){
  const condition=(sheet.conditions||[]).filter(Boolean);
  return '<div class="ae-quick-summary"><div class="ae-quick-resource-grid">'+resources(sheet)+'</div>'+
   '<div class="ae-quick-section-title">ESTADO DO TURNO</div>'+actionSummary(sheet)+
   '<button class="ae-quick-primary" type="button" data-quick-action="mesa">ABRIR CONTROLES DE COMBATE</button>'+
   '<div class="ae-quick-section-title">CONDIÇÕES ATIVAS</div>'+
   (condition.length?'<div class="ae-quick-conditions">'+condition.map(c=>'<span>'+safe(c)+'</span>').join('')+'</div>':
   '<p class="ae-quick-muted">Nenhuma condição aplicada.</p>')+
   '<p class="ae-quick-note">Recursos, condições e ações são atualizados pelo servidor. Os controles completos ficam na aba Mesa.</p></div>';
 }
 function skills(sheet){
  const engine=global.ARQUIVO_CBB_ENGINE,values=Object.entries(sheet.skills||{});
  return '<div class="ae-ficha-skills ae-quick-skills">'+
   '<p class="ae-quick-note">Clique em ROLAR para executar o teste imediatamente. Ajustes de passos e contexto ficam abaixo.</p>'+
   '<div class="ae-quick-skill-grid">'+values.map(([name,value])=>{
    const group=engine?.groupOf?.(name)||'Corpo',g=sheet.groups?.[group]||4;
    return '<div class="ae-quick-skill"><span>'+safe(name)+'</span><small>d'+safe(g)+' + d'+safe(value)+'</small>'+
     '<button type="button" data-cbb-pick-skill="'+safe(name)+'" aria-label="Rolar '+safe(name)+'">ROLAR</button></div>';
   }).join('')+'</div>'+
   (global.ARQUIVO_CBB_UI?.renderSkillQuick?.(sheet,{canEdit:true})||'')+'</div>';
 }
 function abilities(sheet){
  const list=Array.isArray(sheet.abilities)?sheet.abilities:[];
  return '<div class="ae-quick-abilities"><p class="ae-quick-note">Consulte as habilidades sem fechar a biblioteca. As ativações continuam verificadas pelo servidor.</p>'+
   list.map((ab,i)=>'<article class="ae-quick-ability"><div><strong>'+safe(ab.name||'Habilidade')+
     '</strong><small>'+safe((ab.libraryType||'Habilidade').toUpperCase())+' · '+num(ab.cost)+' ALMA</small></div>'+
     '<p>'+safe(ab.description||'Sem descrição.')+'</p>'+
     (ab.passive||ab.category==='passive'||Number(ab.cost)===0&&!ab.costConfig?'': 
     '<button type="button" data-cbb-command="ability" data-cbb-index="'+i+'">ATIVAR HABILIDADE</button>')+
     '</article>').join('')+'</div>';
 }
 function content(sheet){
  if(tab==='mesa')return '<div class="ae-quick-combat">'+(global.ARQUIVO_CBB_UI?.render?.(sheet,{canEdit:true,master:false})||'<p>Mesa indisponível.</p>')+'</div>';
  if(tab==='skills')return skills(sheet);
  if(tab==='abilities')return abilities(sheet);
  return summary(sheet);
 }
 function refresh(force=false){
  const root=host(),sheet=resolve(),role=api.role;
  if(role!=='player'||!global.ARQUIVO_SYNC?.state?.identity?.id){
   root.hidden=true;expanded=false;revision='';return;
  }
  root.hidden=false;
  const key=JSON.stringify([role,selected,expanded,tab,sheet&&{
   name:sheet.name,image:sheet.image,resources:sheet.resources,combat:sheet.combat,
   conditions:sheet.conditions,abilities:tab==='abilities'?sheet.abilities?.map(a=>[a.name,a.cost,a.description]):undefined,
   skills:tab==='skills'?sheet.skills:undefined
  },ownSheets().map(s=>s.id)]);
  if(!force&&revision===key)return;
  // Alterações remotas não devem apagar uma digitação em andamento.
  if(!force&&expanded&&root.contains(d.activeElement)&&
     /^(INPUT|SELECT|TEXTAREA)$/.test(d.activeElement?.tagName||''))return;
  revision=key;
  root.innerHTML='<button type="button" class="ae-quick-launch" data-quick-action="toggle" aria-expanded="'+expanded+
   '" aria-controls="aeQuickSheetWindow">'+
   (sheet?'<span class="ae-quick-avatar">'+img(sheet)+'</span>':'<span class="ae-quick-avatar ae-quick-avatar-unlinked">+</span>')+
   '<span class="ae-quick-launch-text"><small>FICHA RÁPIDA</small><strong>'+safe(sheet?.name||'VINCULAR PERSONAGEM')+'</strong></span>'+
   (sheet?'<span class="ae-quick-launch-alma">'+num(sheet.resources?.alma?.current)+' ALMA</span>':'')+
   '<span class="ae-quick-launch-chevron" aria-hidden="true">'+(expanded?'▾':'▴')+'</span></button>'+
   (!expanded?'':'<section class="ae-quick-window" id="aeQuickSheetWindow" role="dialog" aria-modal="false" aria-label="Ficha rápida'+(sheet?' de '+safe(sheet.name):'')+'">'+
    '<header class="ae-quick-head">'+
    '<div class="ae-quick-head-title"><small>PAINEL DE PERSONAGEM</small><strong>'+safe(sheet?.name||'Escolha sua ficha')+'</strong></div>'+
    '<div class="ae-quick-head-actions">'+(sheet?
     '<button type="button" data-quick-action="full">ABRIR COMPLETA</button>':'')+
     '<button type="button" data-quick-action="picker">ESCOLHER FICHA</button>'+
     '<button type="button" class="ae-quick-close" data-quick-action="toggle" aria-label="Fechar ficha rápida">×</button></div></header>'+
    (sheet?'<nav class="ae-quick-tabs" aria-label="Seções da ficha rápida">'+
      Object.entries(label).map(([id,name])=>'<button type="button" data-quick-tab="'+id+
       '" class="'+(tab===id?'is-active':'')+'" aria-pressed="'+(tab===id)+'">'+name+'</button>').join('')+'</nav>'+
      '<div class="ae-quick-body" data-quick-body>'+content(sheet)+'</div>':
      '<div class="ae-quick-empty"><p>Vincule uma ficha para acompanhar Vida, ALMA, ações e rolagens em qualquer página.</p>'+
      '<button type="button" class="ae-quick-primary" data-quick-action="picker">ESCOLHER MINHA FICHA</button></div>')+
    '</section>');
 }
 function selectTab(name){
  if(!Object.hasOwn(label,name))return;
  tab=name;revision='';expanded=true;refresh(true);
  host().querySelector('.ae-quick-body')?.scrollTo({top:0,behavior:'instant'});
 }
 function toggle(){
  expanded=!expanded;revision='';refresh(true);
 }
 function full(){
  const s=resolve();if(!s)return openPicker();
  expanded=false;api.viewSheet(s.id);revision='';refresh(true);
 }
 async function openPicker(){
  const sync=global.ARQUIVO_SYNC;
  if(!sync?.state?.enabled||sync.state.identity?.kind!=='player'){
   api.toast('Conexão necessária','Entre com uma chave de jogador.',true);return;
  }
  if(requesting)return;requesting=true;
  try{
   const entries=await sync.joinableSheets();
   const mine=ownSheets();
   const all=Array.isArray(entries)?entries:[];
   const marked=new Set(mine.map(s=>s.id));
   const options=all.filter(s=>!marked.has(s.id));
   api.modal('ESCOLHER MINHA FICHA',
    '<div class="ae-quick-picker"><p>Você pode vincular uma ficha livre ou uma ficha cujo autovínculo foi liberado pelo mestre. Nenhuma ficha de chefe é disponibilizada aqui.</p>'+
    (mine.length?'<h3>SUAS FICHAS</h3><div class="ae-quick-picker-list">'+mine.map(s=>
      '<button type="button" data-quick-select="'+safe(s.id)+'">'+safe(s.name)+' <span>ABRIR</span></button>').join('')+'</div>':'')+
    '<h3>DISPONÍVEIS PARA VÍNCULO</h3>'+
    (options.length?'<div class="ae-quick-picker-list">'+options.map(s=>
      '<button type="button" data-quick-join="'+safe(s.id)+'"><span>'+safe(s.name)+
      '</span><small>NÍVEL '+safe(s.level??'?')+'</small><b>VINCULAR</b></button>').join('')+'</div>':
      '<p class="ae-quick-muted">Nenhuma outra ficha liberada. Peça ao mestre para habilitar AUTOVÍNCULO na ficha desejada.</p>')+
    '</div>',[['FECHAR','closeModal']]);
  }catch(error){api.toast('Fichas indisponíveis',error?.message||String(error),true)}
  finally{requesting=false}
 }
 async function join(id,button){
  if(loading)return;
  const sync=global.ARQUIVO_SYNC;
  loading=true;if(button){button.disabled=true;button.setAttribute('aria-busy','true')}
  try{
   await sync.selfLinkSheet(id,'join');
   remember(id);expanded=true;tab='summary';
   api.closeModal();
   await sync.refresh(true);
   revision='';refresh(true);
   api.toast('Ficha vinculada','Sua chave agora está associada à ficha escolhida.');
  }catch(error){api.toast('Vínculo não realizado',error?.message||String(error),true)}
  finally{loading=false;if(button?.isConnected){button.disabled=false;button.removeAttribute('aria-busy')}}
 }
 async function toggleSelfLink(id){
  const sync=global.ARQUIVO_SYNC,s=api.db?.sheets.find(x=>x.id===id);
  if(!s||api.role!=='master'||s.masterOnly||loading)return;
  loading=true;
  try{
   const enabled=!!s.selfLinkEnabled,result=await sync.selfLinkSheet(id,enabled?'close':'open');
   const i=api.db.sheets.findIndex(x=>x.id===id);
   if(i>=0)api.db.sheets[i]=result.sheet;
   api.render();
   api.toast(enabled?'Autovínculo fechado':'Autovínculo liberado',
    enabled?'Somente os vínculos existentes permanecem.':'Jogadores podem escolher esta ficha com a própria chave.');
  }catch(error){api.toast('Não foi possível alterar o autovínculo',error?.message||String(error),true)}
  finally{loading=false}
 }
 d.addEventListener('click',event=>{
  const q=event.target.closest?.('[data-quick-action],[data-quick-tab],[data-quick-join],[data-quick-select]');
  if(!q)return;
  event.preventDefault();event.stopPropagation();
  if(q.dataset.quickTab){selectTab(q.dataset.quickTab);return}
  if(q.dataset.quickJoin){void join(q.dataset.quickJoin,q);return}
  if(q.dataset.quickSelect){remember(q.dataset.quickSelect);tab='summary';expanded=true;api.closeModal();revision='';refresh(true);return}
  switch(q.dataset.quickAction){
   case 'toggle':toggle();break;
   case 'mesa':selectTab('mesa');break;
   case 'full':full();break;
   case 'picker':void openPicker();break;
  }
 },true);
 // A ficha flutuante permite consultar e rolar sem transferir a navegação da Biblioteca.
 // Edição estrutural permanece na ficha completa.
 d.addEventListener('click',event=>{
  const root=host(),target=event.target.closest?.('[data-action],[data-page],[data-tab]');
  if(!target||!root.contains(target))return;
  event.preventDefault();event.stopPropagation();
  if(target.dataset.tab){selectTab(target.dataset.tab);return}
  full();
 },true);
 d.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&expanded&&!d.querySelector('#dialogRoot [role="dialog"]')){
   expanded=false;revision='';refresh(true);
  }
 });
 global.addEventListener('arquivo-online-snapshot',()=>refresh());
 global.addEventListener('arquivo-online-ready',()=>refresh());
 global.addEventListener('arquivo-logged-out',()=>{selected='';expanded=false;revision='';refresh(true)});
 global.ARQUIVO_QUICK_SHEET=Object.freeze({
  get activeId(){return resolve()?.id||null},
  refresh,openPicker,toggleSelfLink,open:()=>{expanded=true;revision='';refresh(true)}
 });
 refresh(true);
})(window);
