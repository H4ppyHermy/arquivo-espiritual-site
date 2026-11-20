/* Organização universal de cartões — mouse, toque prolongado e teclado.
 * Grava apenas a alteração pontual; nunca faz push do documento inteiro.
 */
(function(){
 'use strict';
 const api=()=>window.ARQUIVO_INTERNAL;
 const online=()=>window.ARQUIVO_SYNC;
 let gesture=null,active=null,highlight=null,ghost=null,busy=false,clickGuard=0;
 const within=(n,sel)=>n?.closest?.(sel)||null;
 const isMaster=()=>api()?.master?.()===true;
 const supported=()=>isMaster()&&online()?.state?.enabled&&online()?.state?.identity?.kind==='master';
 const notify=(title,message,error=true)=>api()?.toast?.(title,message,error);
 const visible=x=>!!x&&!x.hidden;
 const number=x=>Number.isSafeInteger(Number(x))?Number(x):null;

 function sourceOf(node){
  if(!node||!supported())return null;
  const ability=within(node,'.ae-ficha-ability-entry[data-drop-ability-index]');
  if(ability){
   const root=within(ability,'.ae-ficha-abilities[data-ability-sheet]');
   const from=number(ability.dataset.dropAbilityIndex);
   const record=api()?.db?.sheets?.find(x=>x.id===root?.dataset.abilitySheet);
   const item=record?.abilities?.[from];
   if(!root||from===null||!item||item.origin?.auto)return null;
   const group=within(ability,'[data-drop-ability-group]');
   return {type:'ability',node:ability,from,root,record,item,groupId:group?.dataset.dropAbilityGroup||'',
    text:item.name||'Habilidade'};
  }
  const wh=within(node,'.ae-warehouse-post[data-drag-warehouse-id]');
  if(wh&&api()?.page==='library'){
   const id=wh.dataset.dragWarehouseId,post=api()?.db?.site?.warehouse?.posts?.find(x=>x.id===id);
   if(!post)return null;
   return {type:'warehouse',node:wh,id,item:post,root:document.getElementById('warehousePosts'),
    text:post.title||'Publicação'};
  }
  return null;
 }
 function removeHighlight(){
  highlight?.classList?.remove('ae-drag-target');
  highlight?.removeAttribute?.('data-drag-side');
  highlight=null;
 }
 function teardown(){
  if(gesture?.timer)clearTimeout(gesture.timer);
  if(active?.node)active.node.classList.remove('ae-drag-source');
  removeHighlight();ghost?.remove();ghost=null;
  document.body.classList.remove('ae-dragging');
  gesture=null;active=null;
 }
 function begin(){
  if(!gesture||busy||active)return;
  active=gesture.source;
  active.node.classList.add('ae-drag-source');
  document.body.classList.add('ae-dragging');
  ghost=document.createElement('div');ghost.className='ae-drag-ghost';
  ghost.textContent=active.text;
  ghost.setAttribute('aria-hidden','true');
  document.body.appendChild(ghost);
  moveGhost(gesture.x,gesture.y);
 }
 function moveGhost(x,y){
  if(!ghost)return;
  ghost.style.transform='translate('+Math.round(x+13)+'px,'+Math.round(y+13)+'px)';
 }
 function findTarget(x,y){
  const el=document.elementFromPoint?.(x,y);
  if(!el||!active)return null;
  if(active.type==='ability'){
   const card=within(el,'[data-drop-ability-index]');
   const group=within(el,'[data-drop-ability-group]');
   if(!group||!within(group,'.ae-ficha-abilities')||
     within(group,'.ae-ficha-abilities')!==active.root)return null;
   const groupId=group.dataset.dropAbilityGroup||'';
   if(card&&within(card,'[data-drop-ability-group]')===group){
    const targetIndex=number(card.dataset.dropAbilityIndex);
    const rect=card.getBoundingClientRect();
    return {node:card,groupId,targetIndex,
     after:y>rect.top+rect.height/2};
   }
   return {node:group,groupId,targetIndex:null,after:false};
  }
  const category=within(el,'[data-drop-warehouse-category]');
  if(!category)return null;
  const group=category.dataset.dropWarehouseCategory;
  const card=within(el,'[data-drop-warehouse-id]');
  if(card){
   const rect=card.getBoundingClientRect();
   return {node:card,groupId:group,targetId:card.dataset.dropWarehouseId,
    after:y>rect.top+rect.height/2};
  }
  return {node:category,groupId:group,targetId:null,after:false};
 }
 function targetAt(x,y){
  const next=findTarget(x,y);
  const node=next?.node;
  if(node!==highlight){removeHighlight();highlight=node;if(node)node.classList.add('ae-drag-target')}
  if(node)node.dataset.dragSide=next.after?'after':'before';
  return next;
 }
 async function persist(src,dest){
  if(!src||!dest||busy)return;
  if(src.type==='ability'){
   if(dest.targetIndex===src.from&&dest.groupId===src.groupId)return;
   const current=api()?.db?.sheets?.find(x=>x.id===src.record.id);
   const fromItem=current?.abilities?.[src.from];
   if(!fromItem||fromItem.name!==src.item.name){
    notify('Ficha alterada','Atualize a ficha e tente novamente.');return;
   }
   const to=dest.targetIndex===null?null:current.abilities[dest.targetIndex];
   if(dest.targetIndex!==null&&!to)return;
   busy=true;
   try{
    const result=await online().moveAbility({
     p_sheet_id:src.record.id,p_from_index:src.from,p_target_index:dest.targetIndex,
     p_after:dest.after,p_group_id:dest.groupId,
     p_expected_name:src.item.name,p_target_name:to?.name||null
    });
    const sheet=api().db.sheets.find(x=>x.id===src.record.id);
    if(sheet)sheet.abilities=result.sheet.abilities;
    if(api().page==='sheets'&&api().currentSheet===src.record.id)api().render();
   }catch(error){
    notify('Organização não salva',error.message||'Não foi possível sincronizar.',true);
    online()?.refresh?.(true).catch(()=>{});
   }finally{busy=false}
   return;
  }
  if(dest.targetId===src.id&&dest.groupId===src.item.category)return;
  busy=true;
  try{
   const result=await online().moveWarehousePost({
    p_post_id:src.id,p_target_id:dest.targetId||null,p_after:dest.after,
    p_category:dest.groupId
   });
   const w=api().db.site?.warehouse;
   if(w)w.posts=result.posts;
   if(api().page==='library')api().render();
  }catch(error){
   notify('Publicação não movida',error.message||'Não foi possível sincronizar.',true);
   online()?.refresh?.(true).catch(()=>{});
  }finally{busy=false}
 }
 function down(event){
  if(busy||gesture||event.button!==0||!event.isPrimary&&event.isPrimary!==undefined)return;
  if(within(event.target,'[data-drag-ghost]'))return;
  const handle=within(event.target,'[data-drag-handle]');
  if(!handle&&within(event.target,
   'button,a,input,textarea,select,summary,details,[contenteditable="true"],[role="button"]'))return;
  const src=sourceOf(event.target);
  if(!src)return;
  const pointerType=event.pointerType||'mouse';
  const wait=handle?(pointerType==='touch'?230:105):pointerType==='touch'?350:220;
  gesture={source:src,id:event.pointerId,x:event.clientX,y:event.clientY,
   startX:event.clientX,startY:event.clientY,pointerType,
   timer:setTimeout(begin,wait)};
 }
 function move(event){
  if(!gesture||gesture.id!==event.pointerId)return;
  gesture.x=event.clientX;gesture.y=event.clientY;
  if(!active){
   const distance=Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY);
   if(distance>13&&gesture.pointerType==='touch'){
    teardown();return;
   }
   if(distance>15&&gesture.pointerType!=='touch')begin();
  }
  if(!active)return;
  if(event.cancelable)event.preventDefault();
  moveGhost(event.clientX,event.clientY);
  targetAt(event.clientX,event.clientY);
  if(typeof window.scrollBy==='function'&&typeof window.innerHeight==='number'){
   const edge=65;
   if(event.clientY>window.innerHeight-edge)window.scrollBy(0,13);
   else if(event.clientY<edge)window.scrollBy(0,-13);
  }
 }
 function up(event){
  if(!gesture||gesture.id!==event.pointerId)return;
  const drop=active?targetAt(event.clientX,event.clientY):null,src=active;
  if(active){clickGuard=Date.now()+360;if(event.cancelable)event.preventDefault()}
  teardown();
  if(src&&drop)persist(src,drop).catch(error=>notify('Falha ao organizar',error.message));
 }
 document.addEventListener('pointerdown',down,{passive:true});
 document.addEventListener('pointermove',move,{passive:false});
 document.addEventListener('pointerup',up);
 document.addEventListener('pointercancel',teardown);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)teardown()});
 window.addEventListener?.('pagehide',teardown);
 document.addEventListener('click',event=>{
  if(Date.now()>=clickGuard)return;
  if(!within(event.target,'[data-drag-handle],.ae-ficha-ability-entry,.ae-warehouse-post'))return;
  event.preventDefault();event.stopImmediatePropagation();
 },true);
 document.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown'].includes(event.key)||!supported())return;
  const handle=within(event.target,'[data-drag-handle]');
  if(!handle)return;
  const src=sourceOf(handle);if(!src)return;
  const up=event.key==='ArrowUp';
  const entries=src.type==='ability'?
   [...src.root.querySelectorAll('.ae-ficha-ability-entry')].filter(visible)
    .filter(e=>within(e,'[data-drop-ability-group]')===within(src.node,'[data-drop-ability-group]')):
   [...document.querySelectorAll('.ae-warehouse-post[data-drop-warehouse-id]')].filter(visible);
  const pos=entries.indexOf(src.node),next=entries[pos+(up?-1:1)];
  if(!next)return;
  event.preventDefault();
  if(src.type==='ability'){
   const groupId=within(next,'[data-drop-ability-group]')?.dataset.dropAbilityGroup||'';
   persist(src,{node:next,groupId,targetIndex:number(next.dataset.dropAbilityIndex),after:!up}).catch(()=>{});
  }else{
   persist(src,{node:next,groupId:next.dataset.dropWarehouseCategory,
    targetId:next.dataset.dropWarehouseId,after:!up}).catch(()=>{});
  }
 });
 window.ARQUIVO_ORGANIZADOR=Object.freeze({get busy(){return busy}});
})();
