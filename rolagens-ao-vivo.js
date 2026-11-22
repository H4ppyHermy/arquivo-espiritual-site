/* Rolagens públicas em tempo real: UI independente da página e da ficha.
   O backend (RLS) e este filtro excluem rolagens de fichas exclusivas do mestre. */
(function(global){
 'use strict';
 const doc=global.document;
 if(!doc)return;
 const MAX_SEEN=180;
 const seen=new Set();
 let identity=null,lastId=0,initialized=false,polling=false,pollTimer=null,dismissTimer=null;
 let activeRoll=null,streamEpoch=0;
 const newestId=roll=>Number(roll?.id)||0;
 const isHidden=roll=>roll?.hidden===true||roll?.hidden==='true'||roll?.kind==='shield';
 const escape=x=>String(x??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
 function publicRoll(roll){
  if(!roll||!Number.isSafeInteger(newestId(roll))||newestId(roll)<1||isHidden(roll))return false;
  if(!roll.sheet_id)return true;
  const sheets=global.ARQUIVO_INTERNAL?.db?.sheets;
  const sheet=Array.isArray(sheets)?sheets.find(s=>s.id===roll.sheet_id):null;
  // O documento do jogador substitui outras fichas locked por placeholders
  // "FICHA DESCONHECIDA". Isso protege o conteúdo da ficha, mas a RLS
  // de ae_rolls autoriza suas rolagens públicas; não as esconda da mesa.
  if(!sheet||sheet.masterOnly===true||sheet.masterOnly==='true'||sheet.private===true)return false;
  if(sheet.redacted!==true)return true;
  return sheet.locked===true && sheet.name==='FICHA DESCONHECIDA' &&
   global.ARQUIVO_SYNC?.state?.identity?.kind!=='master';
 }
 function remember(id){
  seen.add(id);
  if(seen.size>MAX_SEEN)seen.delete(seen.values().next().value);
 }
 function root(){
  let box=doc.getElementById('aeRollToast');
  if(box)return box;
  box=doc.createElement('aside');
  box.id='aeRollToast';
  box.className='ae-roll-live-toast';
  box.setAttribute('aria-live','polite');
  box.setAttribute('aria-atomic','true');
  box.setAttribute('role','status');
  box.hidden=true;
  doc.body.appendChild(box);
  return box;
 }
 function show(roll,initial=false){
  if(doc.hidden)return;
  const box=root();
  if(dismissTimer){clearTimeout(dismissTimer);dismissTimer=null}
  const kind=roll.kind==='discord'?'DISCORD':roll.kind==='cbb'||roll.kind==='ability'?'FICHA':'ROLAGEM LIVRE';
  const player=String(roll.account_name||roll.character_name||'Participante').slice(0,90);
  const character=roll.character_name&&roll.account_name?' · '+String(roll.character_name).slice(0,70):'';
  const label=String(roll.label||'Rolagem').slice(0,135);
  const total=Number.isFinite(Number(roll.total))?Number(roll.total):'—';
  const special=String(roll.special||'').slice(0,40);
  const dice=Array.isArray(roll.dice)?roll.dice.slice(0,30).map(d=>
   'd'+Number(d.sides)+' '+Number(d.value)+(d.effective!=null&&Number(d.effective)!==Number(d.value)?'→'+Number(d.effective):'')).join(' · '):'';
  const time=roll.created_at?new Date(roll.created_at):new Date();
  const clock=Number.isNaN(time.getTime())?'':time.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  box.innerHTML='<div class="ae-roll-live-head">'+
    '<span class="ae-roll-live-pulse" aria-hidden="true"></span>'+
    '<span class="ae-roll-live-kicker">'+(initial?'ÚLTIMA ROLAGEM':'ROLAGEM REGISTRADA')+' <i>·</i> '+kind+'</span>'+
    '<span class="ae-roll-live-clock">'+escape(clock)+'</span>'+
    '<button type="button" class="ae-roll-live-close" aria-label="Fechar aviso de rolagem" title="Fechar">×</button></div>'+
    '<div class="ae-roll-live-body"><div class="ae-roll-live-copy">'+
    '<strong>'+escape(player+character)+'</strong>'+
    '<span class="ae-roll-live-label">'+escape(label)+'</span>'+
    (dice?'<span class="ae-roll-live-dice" title="'+escape(dice)+'">'+escape(dice)+'</span>':'')+
    '</div><div class="ae-roll-live-score"><small>RT</small><b>'+escape(total)+'</b></div></div>'+
    (special?'<div class="ae-roll-live-special">'+escape(special)+'</div>':'');
  box.hidden=false;
  box.classList.remove('ae-roll-live-appear');
  void box.offsetWidth;
  box.classList.add('ae-roll-live-appear');
  dismissTimer=setTimeout(()=>{box.hidden=true;dismissTimer=null},7000);
 }
 function publicEvent(roll,source,notify=true){
  const id=newestId(roll);
  if(!publicRoll(roll)||seen.has(id))return false;
  remember(id);
  lastId=Math.max(lastId,id);
  if(!activeRoll||id>=newestId(activeRoll))activeRoll=roll;
  global.dispatchEvent(new CustomEvent('arquivo-roll-public',{detail:{roll,source}}));
  if(notify&&activeRoll===roll)show(roll,false);
  return true;
 }
 function onRegistered(event){
  if(!identity||identity!==String(global.ARQUIVO_SYNC?.state?.identity?.id||''))return;
  const roll=event?.detail?.roll;
  if(!roll)return;
  // Cada evento vem do registro já confirmado; nunca mostrar cálculos locais não verificados.
  publicEvent(roll,event.detail.source||'realtime');
 }
 function schedule(delay){
  if(pollTimer)clearTimeout(pollTimer);
  if(!identity||doc.hidden)return;
  pollTimer=setTimeout(()=>{pollTimer=null;void poll()},delay);
 }
 async function poll(){
  const sync=global.ARQUIVO_SYNC;
  if(polling||!identity||doc.hidden||!sync?.state?.enabled||!sync.rollLatest)return;
  polling=true;
  const epoch=streamEpoch,previous=lastId,first=!initialized;
  try{
   const rows=await sync.rollLatest(first?30:50,first?0:previous);
   if(epoch!==streamEpoch)return;
   const ordered=[...rows].sort((a,b)=>newestId(a)-newestId(b));
   if(first){
    initialized=true;
    for(const roll of ordered){lastId=Math.max(lastId,newestId(roll));remember(newestId(roll))}
    const mostRecent=ordered.filter(publicRoll).pop();
    if(mostRecent&&!activeRoll){activeRoll=mostRecent;show(mostRecent,true)}
   }else{
    const valid=ordered.filter(r=>publicRoll(r)&&!seen.has(newestId(r)));
    for(const row of ordered)lastId=Math.max(lastId,newestId(row));
    for(let i=0;i<valid.length;i++)publicEvent(valid[i],'recovery',i===valid.length-1);
   }
  }catch(e){
   // Realtime continua recebendo eventos mesmo se a consulta de recuperação falhar.
   if(global.console?.warn)console.warn('Sincronização de rolagens:',e?.message||e);
  }finally{
   polling=false;
   if(epoch===streamEpoch)schedule(sync.state.rollRealtime==='connected'?24000:3500);
  }
 }
 function disconnect(){
  streamEpoch++;
  identity=null;initialized=false;lastId=0;activeRoll=null;seen.clear();
  if(pollTimer){clearTimeout(pollTimer);pollTimer=null}
  if(dismissTimer){clearTimeout(dismissTimer);dismissTimer=null}
  const box=doc.getElementById('aeRollToast');if(box)box.hidden=true;
 }
 function boot(){
  const sync=global.ARQUIVO_SYNC;
  const next=sync?.state?.enabled&&sync.state.identity?.id?String(sync.state.identity.id):'';
  if(!next){if(identity)disconnect();return}
  if(identity!==next){disconnect();identity=next;schedule(0)}
 }
 doc.addEventListener('click',event=>{
  if(!event.target.closest?.('.ae-roll-live-close'))return;
  const box=doc.getElementById('aeRollToast');if(box)box.hidden=true;
  if(dismissTimer){clearTimeout(dismissTimer);dismissTimer=null}
 });
 doc.addEventListener('visibilitychange',()=>{
  if(!doc.hidden){boot();schedule(0)}
 });
 global.addEventListener('arquivo-online-ready',boot);
 global.addEventListener('arquivo-online-snapshot',boot);
 global.addEventListener('arquivo-online-state',boot);
 global.addEventListener('arquivo-logged-out',disconnect);
 global.addEventListener('arquivo-roll-feed-state',()=>{boot();if(identity&&!doc.hidden)schedule(350)});
 global.addEventListener('arquivo-roll-registered',onRegistered);
 global.ARQUIVO_ROLL_LIVE=Object.freeze({publicRoll,showLast:()=>{if(activeRoll)show(activeRoll,true)},get lastId(){return lastId}});
 setTimeout(boot,0);
})(window);
