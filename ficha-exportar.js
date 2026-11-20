/* Importação manual de habilidades do Armazém para fichas.
   Não executa efeitos, verifica custos nem automatiza requisitos raciais. */
(function(){
 'use strict';
 const api=window.ARQUIVO_INTERNAL;
 if(!api)return;
 const esc=api.esc,fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 let destination='',catalog=[],selected=new Set(),search='',kind='Todas',busy=false;
 const sheet=()=>api.db.sheets.find(s=>s.id===destination);
 const existingNames=()=>new Set((sheet()?.abilities||[]).map(a=>fold(a.name)));
 const eligible=post=>post&&typeof post.id==='string'&&post.id&&
  (post.category==='Habilidades'||post.category==='Técnicas')&&post.title&&
  typeof post.content==='string'&&post.content.trim()&&
  (post.published!==false||api.master());
 function allPosts(){
  const entries=window.ARQUIVO_SECOES?.warehouse?.().posts||[];
  return entries.filter(eligible);
 }
 function visible(){
  const terms=fold(search).split(/\s+/).filter(Boolean);
  return catalog.filter(post=>(kind==='Todas'||post.category===kind)&&terms.every(term=>
   fold([post.title,post.category,post.cost,post.tags,post.content].join(' ')).includes(term)));
 }
 function costNumber(value){
  const match=String(value||'').match(/(?:^|[^\d])(\d{1,5})\s*ALMA\b/i);
  return match?Number(match[1]):0;
 }
 function copyAbility(post){
  return {name:String(post.title).trim().slice(0,100),category:'active',
   cost:costNumber(post.cost),description:String(post.content||'').slice(0,20000)};
 }
 function snippet(post){
  return String(post.content||'').replace(/\[\/?cor(?:=#[0-9a-f]{6})?\]/gi,'')
   .replace(/\[(?:barra|marca|contador|sequencia)(?::[^\]]*)?\]/gi,'[recurso]')
   .replace(/!\[([^\]]+)\]\([^)]+\)/g,'$1')
   .replace(/[#>*_~]/g,'').replace(/\s+/g,' ').trim().slice(0,175);
 }
 function visibleTags(post){
  const restricted=new Set((Array.isArray(post.hiddenTags)?post.hiddenTags:[]).map(fold));
  return String(post.tags||'').split(',').map(s=>s.trim()).filter(s=>s&&
   (api.master()||!restricted.has(fold(s)))).slice(0,5);
 }
 function card(post,names){
  const id=post.id,duplicate=names.has(fold(post.title));
  if(duplicate)selected.delete(id);
  const checked=!duplicate&&selected.has(id);
  const tags=visibleTags(post);
  return '<label class="ae-export-card'+(checked?' is-selected':'')+(duplicate?' is-existing':'')+'">'+
   '<input type="checkbox" data-export-ability="'+esc(id)+'"'+(checked?' checked':'')+
   (duplicate?' disabled':'')+' aria-label="Selecionar '+esc(post.title)+'">'+
   '<span class="ae-export-copy"><span class="ae-export-meta"><span>'+
    (post.category==='Técnicas'?'TÉCNICA LIVRE':'HABILIDADE')+'</span>'+
    (post.cost?'<span>'+esc(post.cost)+'</span>':'')+'</span>'+
   '<strong>'+esc(post.title)+'</strong>'+
   '<span class="ae-export-description">'+esc(snippet(post))+'</span>'+
   (tags.length?'<span class="ae-export-tags">'+tags.map(t=>'<small>'+esc(t)+'</small>').join('')+'</span>':'')+
   (duplicate?'<span class="ae-export-existing">JÁ ESTÁ NA FICHA</span>':'')+
   '</span></label>';
 }
 function refresh(){
  const list=document.getElementById('aeExportAbilityList'),status=document.getElementById('aeExportAbilityStatus');
  const names=existingNames(),entries=visible();
  for(const item of catalog)if(names.has(fold(item.title)))selected.delete(item.id);
  if(list)list.innerHTML=entries.length?entries.map(p=>card(p,names)).join(''):
   '<p class="ae-export-empty">Nenhuma habilidade encontrada.</p>';
  if(status)status.textContent=selected.size+' selecionada(s) · '+entries.length+' resultado(s)';
  const button=document.querySelector('#dialogRoot [data-action="applyExportAbilities"]');
  if(button){button.disabled=busy||selected.size===0;button.textContent=busy?'SALVANDO…':'ADICIONAR '+selected.size+' À FICHA'}
  const all=document.getElementById('aeExportAbilitySelectAll');
  if(all){const available=entries.filter(p=>!names.has(fold(p.title)));
   all.disabled=busy||!available.length;all.textContent=available.length&&available.every(p=>selected.has(p.id))?'DESMARCAR VISÍVEIS':'SELECIONAR VISÍVEIS'}
 }
 function open(){
  const id=api.currentSheet;
  if(!id||!api.canEditSheet(id)){api.toast('Somente leitura','A ficha não pode ser alterada.',true);return}
  destination=id;catalog=allPosts();selected=new Set();search='';kind='Todas';busy=false;
  api.modal('EXPORTAR DO ARMAZÉM',
   '<div class="ae-export-dialog">'+
   '<p>Selecione uma ou várias técnicas e habilidades para adicionar à ficha. Requisitos de raça e nível continuam sujeitos às regras.</p>'+
   '<div class="ae-export-filters"><label>BUSCAR<input id="aeExportAbilitySearch" type="search" autocomplete="off" placeholder="Nome, custo ou efeito"></label>'+
   '<label>TIPO<select id="aeExportAbilityKind"><option value="Todas">Todas</option><option value="Técnicas">Técnicas livres</option><option value="Habilidades">Habilidades</option></select></label></div>'+
   '<div class="ae-export-controls"><span id="aeExportAbilityStatus" role="status" aria-live="polite"></span>'+
   '<button type="button" class="btn small" id="aeExportAbilitySelectAll" data-action="selectExportVisible">SELECIONAR VISÍVEIS</button></div>'+
   '<div id="aeExportAbilityList" class="ae-export-list" aria-label="Habilidades disponíveis"></div>'+
   '</div>',
   [['ADICIONAR 0 À FICHA','applyExportAbilities','main'],['CANCELAR','cancelExportAbilities','small']]);
  document.querySelector('#dialogRoot .dialog')?.classList.add('ae-export-modal');
  refresh();
 }
 function selectVisible(){
  const names=existingNames(),items=visible().filter(p=>!names.has(fold(p.title)));
  if(!items.length)return;
  const all=items.every(p=>selected.has(p.id));
  for(const p of items){if(all)selected.delete(p.id);else selected.add(p.id)}
  refresh();
 }
 function cancel(){selected.clear();destination='';catalog=[];busy=false;api.closeModal()}
 async function apply(){
  if(busy||!selected.size)return;
  if(!destination||api.currentSheet!==destination||!api.canEditSheet(destination)){
   api.toast('Permissão indisponível','Reabra a ficha antes de adicionar habilidades.',true);return;
  }
  const current=sheet();if(!current)return;
  const names=existingNames(),fresh=allPosts(),lookup=new Map(fresh.map(p=>[p.id,p]));
  const added=[];
  for(const id of selected){
   const post=lookup.get(id);
   if(!post||names.has(fold(post.title)))continue;
   const ability=copyAbility(post);
   if(!ability.name||!ability.description)continue;
   names.add(fold(ability.name));added.push(ability);
  }
  if(!added.length){selected.clear();refresh();api.toast('Nenhuma habilidade nova','As selecionadas já estão na ficha ou não estão disponíveis.');return}
  busy=true;refresh();
  const updated={...current,abilities:[...(current.abilities||[]),...added]};
  const sync=window.ARQUIVO_SYNC;
  try{
   if(sync?.state?.enabled&&api.role==='player'){
    // O update simplificado de recursos não envia abilities; usar salvamento completo.
    await sync.saveOwnedSheet(updated);
    await sync.refresh(true);
   }else{
    const original=current.abilities;
    current.abilities=updated.abilities;
    if(api.save()===false){current.abilities=original;throw Error('Não foi possível salvar a ficha.')}
    if(sync?.state?.enabled&&api.master()){
     await sync.state.pending;
     if(sync.state.lastPushError)throw Error(sync.state.lastPushError);
    }
   }
   const count=added.length;
   cancel();api.render();
   api.toast('Habilidades adicionadas',count+' '+(count===1?'registro copiado':'registros copiados')+' do Armazém para a ficha.');
  }catch(error){
   api.toast('Não foi possível adicionar',error.message||'Falha no salvamento.',true);
  }finally{busy=false;if(destination)refresh()}
 }
 document.addEventListener('click',event=>{
  const b=event.target.closest?.('[data-action]'),act=b?.dataset?.action;
  if(!['exportAbilities','applyExportAbilities','cancelExportAbilities','selectExportVisible'].includes(act))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(act==='exportAbilities')open();
  else if(act==='applyExportAbilities')void apply();
  else if(act==='selectExportVisible')selectVisible();
  else cancel();
 },true);
 document.addEventListener('input',event=>{
  if(event.target?.id!=='aeExportAbilitySearch')return;
  // A pesquisa não modifica os dados da ficha nem é uma edição pendente.
  event.stopPropagation();search=event.target.value;refresh();
 },true);
 document.addEventListener('change',event=>{
  const t=event.target;
  if(t?.id==='aeExportAbilityKind'){
   event.stopPropagation();kind=t.value;refresh();return;
  }
  const id=t?.dataset?.exportAbility;
  if(id===undefined)return;
  event.stopPropagation();
  const item=catalog.find(p=>p.id===id);
  if(!item||existingNames().has(fold(item.title)))return;
  if(t.checked)selected.add(id);else selected.delete(id);
  refresh();
 },true);
 window.ARQUIVO_EXPORTADOR={open,copyAbility,costNumber};
})();