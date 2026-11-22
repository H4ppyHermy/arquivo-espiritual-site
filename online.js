(function(){
'use strict';
const config=window.ARQUIVO_ONLINE_CONFIG||{};
const apiUrl=String(config.url||'').trim().replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
const apiKey=String(config.anonKey||'').replace(/\s/g,'');
const isSecret=apiKey.startsWith('sb_secret_')||(/^[^.]+\.[^.]+\.[^.]+$/.test(apiKey)&&(()=>{try{return JSON.parse(atob(apiKey.split('.')[1])).role==='service_role'}catch(e){return false}})());
const ready=/^https:\/\/[^ ]+\.supabase\.co$/.test(apiUrl) && !isSecret && /^(sb_publishable_|eyJ)/.test(apiKey);
const state={configured:ready,enabled:false,connecting:false,error:isSecret?'Chave secreta recusada. Use a chave pública.':!apiUrl?'Configuração ausente: falta a URL.':!apiKey?'Configuração ausente: falta a chave pública.':!ready?'Chave pública inválida ou URL incorreta.':'',client:null,identity:null,revision:0,keys:[],pending:Promise.resolve(),saving:false,busyUntil:0,appliedOnce:false,lastPushError:null,documentRealtime:'disconnected',rollRealtime:'disconnected'};
function stripDoc(db){const c=JSON.parse(JSON.stringify(db));delete c.keys;delete c.keysChanged;return c}
function assignments(db){return (db.keys||[]).filter(k=>k.kind==='player').map(k=>({id:k.id,sheetId:k.sheetId||''}))}
function stateOnly(s){return {resources:Object.fromEntries(['vida','estabilidade','alma'].map(k=>[k,{current:s.resources[k].current}])),conditions:s.conditions||[],notes:s.notes||'',noteImages:s.noteImages||[],inventory:s.inventory||{items:[],currencies:[]},restCount:s.restCount||0,desgaste:s.desgaste||0,exposures:s.exposures||{},combat:s.combat||{},bonds:s.bonds||[],abilityRuntime:s.abilityRuntime||{}}}
async function rpc(fn,args={}){const {data,error}=await state.client.rpc(fn,args);if(error)throw Error(error.message||'Erro de conexão');return data}
let docChannel=null,docNoticeTimer=null,rollChannel=null,rollIdentity=null;
function rollConnectionStatus(status){
 state.rollRealtime=status;
 window.dispatchEvent(new CustomEvent('arquivo-roll-feed-state',{detail:{status}}));
}
function disconnectRollChannel(){
 if(rollChannel){state.client?.removeChannel(rollChannel).catch(()=>{});rollChannel=null}
 rollIdentity=null;
 rollConnectionStatus('disconnected');
}
function connectRollChannel(){
 if(!state.enabled||!state.identity?.id||!state.client)return;
 const identity=String(state.identity.id);
 if(rollChannel&&rollIdentity===identity)return;
 disconnectRollChannel();
 rollIdentity=identity;
 const channel=state.client.channel('ae-roll-feed-'+identity);
 rollChannel=channel;
 rollConnectionStatus('connecting');
 channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'ae_rolls',filter:'hidden=eq.false'},payload=>{
  if(rollIdentity!==identity||state.identity?.id!==identity)return;
  const roll=payload?.new;
  if(!roll?.id||roll.hidden)return;
  window.dispatchEvent(new CustomEvent('arquivo-roll-registered',{detail:{roll,source:'realtime'}}));
 }).subscribe(status=>{
  if(rollChannel!==channel)return;
  const next=status==='SUBSCRIBED'?'connected':status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'unavailable':'connecting';
  rollConnectionStatus(next);
 });
}
function localVerifiedRoll(roll){
 if(!roll?.id||roll.hidden)return;
 window.dispatchEvent(new CustomEvent('arquivo-roll-registered',{detail:{roll,source:'confirmed'}}));
}
function disconnectDocumentChannel(){
 if(docNoticeTimer){clearTimeout(docNoticeTimer);docNoticeTimer=null}
 if(docChannel){state.client?.removeChannel(docChannel).catch(()=>{});docChannel=null}
 state.documentRealtime='disconnected';
}
function scheduleDocumentRefresh(revision){
 if(!state.identity?.id||document.hidden)return;
 if(Number(revision)<=Number(state.revision))return;
 if(docNoticeTimer)clearTimeout(docNoticeTimer);
 docNoticeTimer=setTimeout(async()=>{
  docNoticeTimer=null;
  try{
   await state.pending.catch(()=>{});
   if(Number(revision)>Number(state.revision))await refresh(true);
  }catch(e){state.error=e.message}
 },180);
}
function connectDocumentChannel(){
 if(!state.enabled||!state.identity?.id||docChannel)return;
 const ch=state.client.channel('ae-live-notify',{config:{private:true}});
 docChannel=ch;
 ch.on('broadcast',{event:'document-changed'},({payload})=>scheduleDocumentRefresh(payload?.revision))
   .subscribe(status=>{
    state.documentRealtime=status==='SUBSCRIBED'?'connected':status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'unavailable':'connecting';
    if(status==='SUBSCRIBED')refresh(false).catch(()=>{});
   });
}
async function init(){if(!ready)return false;
 if(!window.supabase?.createClient){state.error='Biblioteca de conexão indisponível. Verifique a internet.';return false}
 state.connecting=true;window.dispatchEvent(new Event('arquivo-online-connecting'));
 try{
  state.client=window.supabase.createClient(apiUrl,apiKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let {data:{session},error}=await state.client.auth.getSession();if(error)throw error;
  if(!session){const res=await state.client.auth.signInAnonymously();if(res.error)throw res.error}
  state.identity=await rpc('ae_session_info');if(!state.identity?.id)state.identity=null;
  state.enabled=true;await refresh(true);connectDocumentChannel();connectRollChannel();
  // Fichas em uso: sincronização frequente. Demais páginas: consultas leves e espaçadas.
let nextDocumentRefresh=0;
setInterval(()=>{
 if(!state.enabled||document.hidden)return;
 const page=window.ARQUIVO_INTERNAL?.page||'home';
 const period=page==='sheets'?(state.documentRealtime==='connected'?12000:6000):page==='admin'?14000:25000;
 const now=Date.now();
 if(now<nextDocumentRefresh)return;
 nextDocumentRefresh=now+period;
 refresh(false).catch(e=>{state.error=e.message;window.dispatchEvent(new CustomEvent('arquivo-sync-error',{detail:e.message}))});
},3000);
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden){nextDocumentRefresh=0;if(state.identity?.id)connectDocumentChannel();refresh(false).catch(()=>{})}
});
  window.dispatchEvent(new Event('arquivo-online-ready'));
  return true;
 }catch(e){state.error=e.message;state.enabled=false;window.dispatchEvent(new CustomEvent('arquivo-sync-error',{detail:e.message}));return false}
 finally{state.connecting=false;window.dispatchEvent(new Event('arquivo-online-state'))}
}
let refreshInFlight=null;
async function refresh(force=false){
 if(!state.enabled)return;
 const identityId=state.identity?.id||null;
 if(refreshInFlight){
  const running=refreshInFlight;
  // A mesma leitura é reutilizada só para a mesma identidade. Uma nova chave
  // ou um refresh obrigatório após login deve receber outro snapshot.
  try{await running.task}catch(e){if(!force)throw e}
  if(!force||(running.force&&running.identityId===identityId))return;
 }
 if(!force&&(state.saving||Date.now()<state.busyUntil))return;
 const task=(async()=>{
  const data=await rpc('ae_read_document');
  if(!data)return;
  // O resultado pode pertencer à chave anterior caso o login tenha mudado
  // enquanto a requisição estava no ar. Não publicar nem cachear esse resultado.
  if((state.identity?.id||null)!==identityId)return;
  if(state.error){state.error='';window.dispatchEvent(new Event('arquivo-online-state'))}
  if(Number(data.revision)<Number(state.revision))return;
  if(!force&&Number(data.revision)===Number(state.revision))return;
  state.revision=data.revision;
  if(Object.keys(data.data||{}).length===0){window.dispatchEvent(new CustomEvent('arquivo-online-empty'));return}
  window.dispatchEvent(new CustomEvent('arquivo-online-snapshot',{detail:{data:data.data,identity:state.identity,keys:state.keys,revision:state.revision}}));
  state.appliedOnce=true;
 })();
 const running={task,force,identityId};
 refreshInFlight=running;
 try{return await task}
 finally{if(refreshInFlight===running)refreshInFlight=null}
}
async function login(name,code){mediaSignedCache.clear();if(!state.enabled)throw Error('A conexão online não está ativa.');state.identity=await rpc('ae_login',{p_name:name,p_code:code});await keys();await refresh(true);connectDocumentChannel();connectRollChannel();return state.identity}
async function bootstrap(token,code,name){mediaSignedCache.clear();if(!state.enabled)throw Error('A conexão online não está ativa.');state.identity=await rpc('ae_bootstrap_master',{p_token:token,p_code:code,p_name:name});await keys();connectDocumentChannel();connectRollChannel();return state.identity}
async function logout(){mediaSignedCache.clear();disconnectDocumentChannel();disconnectRollChannel();if(state.enabled)await rpc('ae_logout');state.identity=null;state.keys=[];await refresh(true);window.dispatchEvent(new Event('arquivo-logged-out'))}
async function removeAccount(id){return rpc('ae_master_remove_account',{p_id:id})}
async function keys(){if(state.identity?.kind==='master')state.keys=await rpc('ae_master_keys');else if(state.identity)state.keys=[state.identity];else state.keys=[];return state.keys}
async function createKey(name,kind,sheetId){const created=await rpc('ae_master_create_key',{p_name:name,p_kind:kind,p_sheet_id:sheetId||null});await keys();return created}
async function changeKey(id,action){await rpc('ae_master_change_key',{p_id:id,p_action:action});await keys()}
async function manageKey(id,action,name=null,sheetId=null){const result=await rpc('ae_master_manage_key',{p_id:id,p_action:action,p_name:name,p_sheet_id:sheetId});await keys();return result}
function push(db,role,sheetId){if(!state.enabled)return;
 state.lastPushError=null;
 state.busyUntil=Date.now()+1700;
 // Jogadores gravam apenas sua ficha: não clonar os livros, outras fichas ou o armazém.
 // O mestre continua enviando o documento completo quando altera o conteúdo global.
 const isMaster=role==='master';
 const snapshot=isMaster?stripDoc(db):null;
 const links=isMaster?assignments(db):null;
 const sheet=isMaster?null:db.sheets.find(s=>s.id===sheetId);
 const payload=sheet?stateOnly(sheet):null;
 state.pending=state.pending.catch(()=>{}).then(async()=>{
  state.saving=true;
  try{
   if(isMaster)state.revision=await rpc('ae_master_replace',{p_data:snapshot,p_assignments:links});
   else if(role==='player' && payload)state.revision=await rpc('ae_player_update',{p_sheet_id:sheetId,p_state:payload});
  }catch(e){state.lastPushError=e.message;state.error=e.message;window.dispatchEvent(new CustomEvent('arquivo-sync-error',{detail:'Alteração NÃO sincronizada: '+e.message}));}
  finally{state.saving=false;state.busyUntil=Date.now()+800}
 });
 return state.pending;
}
async function saveAppearance(sheetId,appearance){if(!state.enabled)throw Error('Conexão online indisponível.');
 state.busyUntil=Date.now()+3000;
 state.pending=state.pending.catch(()=>{}).then(async()=>{
  state.saving=true;
  try{state.revision=await rpc('ae_sheet_set_appearance',{p_sheet_id:sheetId,p_appearance:appearance})}
  finally{state.saving=false;state.busyUntil=Date.now()+800}
 });
 return state.pending;
}
async function moveAbility(args){
 if(!state.enabled||state.identity?.kind!=='master')throw Error('A organização exige uma chave de mestre conectada.');
 await state.pending.catch(()=>{});
 state.busyUntil=Date.now()+1800;
 const result=await rpc('ae_sheet_move_ability',args);
 if(!result?.sheet?.id||result.sheet.id!==args.p_sheet_id||!Array.isArray(result.sheet.abilities))
  throw Error('O servidor não confirmou a movimentação da habilidade.');
 state.revision=Math.max(state.revision,Number(result.revision)||0);
 return result;
}
async function moveWarehousePost(args){
 if(!state.enabled||state.identity?.kind!=='master')throw Error('A organização exige uma chave de mestre conectada.');
 await state.pending.catch(()=>{});
 state.busyUntil=Date.now()+1800;
 const result=await rpc('ae_warehouse_move_post',args);
 if(!Array.isArray(result?.posts)||result?.post?.id!==args.p_post_id)
  throw Error('O servidor não confirmou a movimentação da publicação.');
 state.revision=Math.max(state.revision,Number(result.revision)||0);
 return result;
}
async function playerDirectory(){return rpc('ae_player_directory')}
async function sheetLink(sheetId,action,targetKey=null){
 if(!state.enabled)throw Error('Conexão online indisponível.');
 // Não concorrer com gravações pendentes do mesmo documento.
 await state.pending.catch(()=>{});
 const result=await rpc('ae_sheet_link',{p_sheet_id:sheetId,p_action:action,p_target_key:targetKey||null});
 if(!result?.sheet||result.sheet.id!==sheetId)throw Error('O servidor não confirmou a alteração do vínculo.');
 // A operação retorna a ficha e a revisão já confirmadas: dispensa uma segunda leitura.
 const revision=Number(result.revision);
 if(Number.isFinite(revision))state.revision=Math.max(Number(state.revision)||0,revision);
 state.busyUntil=Date.now()+400;
 return result;
}
async function saveOwnedSheet(sheet){if(!state.enabled||state.identity?.kind!=='player')throw Error('Entre com uma chave de jogador.');return rpc('ae_player_save_sheet',{p_sheet:sheet})}
async function notifyDiscordRoll(result){
 if(config.discordNotifications!==true||!state.enabled||!result?.id||result.hidden)return;
 // O Discord nunca atrasa a confirmação do dado: entrega assíncrona com retries curtos.
 try{
  const {data:{session}}=await state.client.auth.getSession();
  if(!session?.access_token)return;
  const url=apiUrl+'/functions/v1/ae-discord-bot/notify';
  for(let attempt=0;attempt<3;attempt++){
   let retry=false;
   try{
    const response=await fetch(url,{
     method:'POST',
     headers:{'Content-Type':'application/json','apikey':apiKey,'Authorization':'Bearer '+session.access_token},
     body:JSON.stringify({rollId:result.id}),signal:AbortSignal.timeout(9000)
    });
    if(response.ok){
     const outcome=await response.json().catch(()=>({ok:true}));
     if(outcome?.ok||outcome?.privateSheet||outcome?.disabled||outcome?.duplicate)return;
     retry=true;
    }else{
     retry=response.status===408||response.status===429||response.status>=500;
     if(!retry)console.warn('Discord recusou a notificação:',response.status);
    }
   }catch(e){retry=true}
   if(!retry)return;
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }
  console.warn('Notificação Discord indisponível após tentativas:',result.id);
 }catch(e){console.warn('Não foi possível iniciar a notificação Discord.')}
}
function withDiscordRoll(promise){
 return promise.then(result=>{localVerifiedRoll(result);void notifyDiscordRoll(result);return result});
}
async function saveCombos(sheetId,combos){
 if(!state.enabled||!state.identity?.id)throw Error('Entre com sua chave antes de salvar combos.');
 if(typeof sheetId!=='string'||!Array.isArray(combos))throw Error('Dados de combo inválidos.');
 const task=state.pending.catch(()=>{}).then(async()=>{
  state.saving=true;state.busyUntil=Date.now()+1200;
  try{
   const result=await rpc('ae_sheet_set_combos',{p_sheet_id:sheetId,p_combos:combos});
   if(!result||!Array.isArray(result.combos))throw Error('O servidor não confirmou a atualização dos combos.');
   state.revision=Math.max(Number(state.revision)||0,Number(result.revision)||0);
   return result;
  }finally{state.saving=false;state.busyUntil=Date.now()+500}
 });
 state.pending=task;return task;
}
async function rollFree(count,faces,hidden=false,colors=[]){
 if(!hidden&&Number.isInteger(faces)&&faces>=2&&faces<=1000&&Number.isInteger(count)&&count>=1&&count<=30)
  return withDiscordRoll(rpc('ae_roll_custom',{p_count:count,p_faces:faces,p_colors:Array.isArray(colors)?colors:[]}));
 return withDiscordRoll(rpc('ae_roll_free_colored',{p_count:count,p_faces:faces,p_hidden:hidden,p_colors:Array.isArray(colors)?colors:[]}));
}
async function cbbRoll(args){
 if(!state.enabled||!state.identity?.id)throw Error('Entre com a chave do personagem para rolar.');
 // A rolagem verificada nunca pode ultrapassar uma condição ou item ainda pendente de sincronização.
 await state.pending.catch(()=>{});
 if(state.lastPushError)throw Error('A última alteração da ficha não foi sincronizada: '+state.lastPushError);
 return withDiscordRoll(rpc('ae_cbb_roll',args));
}
async function cbbAction(args){
 if(!state.enabled||!state.identity?.id)throw Error('Entre com uma chave para agir.');
 await state.pending.catch(()=>{});
 state.busyUntil=Date.now()+900;
 const result=await rpc('ae_cbb_action',args);
 if(result?.revision)state.revision=Math.max(state.revision,Number(result.revision)||0);
 return result;
}
async function liveCombatPhase(action,sheetId=null,phase=null){
 if(!state.enabled||state.identity?.kind!=='master')throw Error('Somente o mestre pode sincronizar as fases.');
 if(!['enable','disable','set','advance'].includes(action))throw Error('Ação de fase inválida.');
 await state.pending.catch(()=>{});
 if(state.lastPushError)throw Error('Existem alterações da ficha pendentes: '+state.lastPushError);
 const result=await rpc('ae_live_cbb_phase',{p_action:action,p_sheet_id:sheetId,p_phase:phase});
 if(!result?.ok)throw Error('O servidor não confirmou a atualização da sessão.');
 if(result?.revision)state.revision=Math.max(Number(state.revision)||0,Number(result.revision)||0);
 return result;
}
async function rollLatest(limit=24,afterId=0){
 if(!state.enabled||!state.identity?.id)return [];
 const count=Math.min(50,Math.max(1,Math.trunc(Number(limit)||24)));
 const cursor=Math.max(0,Math.trunc(Number(afterId)||0));
 let query=state.client.from('ae_rolls')
  .select('id,account_name,character_name,sheet_id,kind,label,total,special,hidden,created_at,dice,colors')
  .eq('hidden',false);
 if(cursor)query=query.gt('id',cursor);
 const {data,error}=await query.order('id',{ascending:!!cursor}).limit(count);
 if(error)throw Error('Não foi possível consultar as rolagens recentes: '+error.message);
 return data||[];
}
async function rollHistory(limit=10,offset=0,sheetId=null){
 if(!state.enabled||!state.identity?.id)return {rows:[],total:0};
 const size=Math.max(1,Math.min(30,Math.trunc(Number(limit)||10)));
 const first=Math.max(0,Math.trunc(Number(offset)||0));
 let query=state.client.from('ae_rolls').select('*',{count:'exact'});
 if(sheetId)query=query.eq('sheet_id',sheetId);
 const {data,count,error}=await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(first,first+size-1);
 if(error)throw Error('Não foi possível carregar o histórico: '+error.message);
 return {rows:data||[],total:Number(count)||0};
}
async function clearRolls(){
 if(!state.enabled||state.identity?.kind!=='master')throw Error('Somente o mestre conectado pode apagar o histórico.');
 const result=await rpc('ae_roll_clear');
 if(result!==true)throw Error('O servidor não confirmou a limpeza.');
 return true;
}
async function musicNow(){return rpc('ae_music_now')}
async function musicSet(kind,source,title,playing,position,loop=false){return rpc('ae_music_set',{p_kind:kind,p_source:source,p_title:title,p_playing:playing,p_position:position,p_loop:loop})}
async function uploadMusic(file,onProgress){if(!state.enabled||state.identity?.kind!=='master')throw Error('Somente mestre.');
 const safe=file.name.replace(/[^a-z0-9._-]/gi,'_').slice(-100);const path=Date.now()+'-'+safe;
 const {data:{session},error:sessionError}=await state.client.auth.getSession();if(sessionError||!session)throw Error('Sessão expirada. Entre novamente.');
 await new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('POST',apiUrl+'/storage/v1/object/musica/'+encodeURIComponent(path));
  xhr.setRequestHeader('Authorization','Bearer '+session.access_token);
  xhr.setRequestHeader('apikey',apiKey);xhr.setRequestHeader('Content-Type',file.type||'audio/mpeg');
  xhr.setRequestHeader('x-upsert','false');
  xhr.upload.onprogress=e=>{if(e.lengthComputable&&typeof onProgress==='function')onProgress(e.loaded/e.total*100)};
  xhr.onerror=()=>reject(Error('A conexão caiu durante o envio.'));
  xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300)resolve();else reject(Error('Supabase: '+xhr.status+' '+(xhr.responseText||'Falha no envio.').slice(0,180)))};
  xhr.send(file);
 });
 return {path,url:state.client.storage.from('musica').getPublicUrl(path).data.publicUrl}
}
async function listMusic(){const {data,error}=await state.client.storage.from('musica').list('',{limit:100});if(error)throw Error(error.message);return data||[]}
async function deleteMusic(path){if(state.identity?.kind!=='master')throw Error('Somente mestre.');const {error}=await state.client.storage.from('musica').remove([path]);if(error)throw Error(error.message)}

const mediaSignedCache=new Map();
async function uploadSheetMedia(sheetId,file){
 if(!state.enabled||!state.identity?.id)throw Error('Faça login para enviar imagens.');
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(String(sheetId||'')))throw Error('Identificador de ficha inválido.');
 const ext={'image/gif':'gif','image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file?.type];
 if(!ext)throw Error('Envie um GIF, PNG, JPG ou WebP.');
 if(file.size>15*1024*1024)throw Error('A imagem ultrapassa 15 MB.');
 if(file.size<1)throw Error('Arquivo vazio.');
 const path=sheetId+'/'+crypto.randomUUID()+'.'+ext;
 const {error}=await state.client.storage.from('fichas').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
 if(error)throw Error('Envio não autorizado ou indisponível: '+error.message);
 return 'ae-media://'+path;
}
async function mediaSignedUrl(ref){
 if(!state.enabled)throw Error('Sem conexão online.');
 const path=String(ref||'').replace(/^ae-media:\/\//,'');
 if(!/^[a-zA-Z0-9_-]{1,100}\/[0-9a-f-]{36}\.(gif|png|jpg|jpeg|webp)$/.test(path))throw Error('Referência de imagem inválida.');
 const hit=mediaSignedCache.get(path);
 if(hit&&hit.until>Date.now())return hit.url;
 const {data,error}=await state.client.storage.from('fichas').createSignedUrl(path,1800);
 if(error||!data?.signedUrl)throw Error(error?.message||'Imagem não autorizada.');
 mediaSignedCache.set(path,{url:data.signedUrl,until:Date.now()+24*60*1000});
 return data.signedUrl;
}

window.ARQUIVO_SYNC={state,init,refresh,login,logout,removeAccount,bootstrap,keys,createKey,changeKey,manageKey,push,stripDoc,saveOwnedSheet,playerDirectory,sheetLink,saveAppearance,moveAbility,moveWarehousePost,saveCombos,rollFree,cbbRoll,cbbAction,liveCombatPhase,rollLatest,rollHistory,clearRolls,musicNow,musicSet,uploadMusic,listMusic,deleteMusic,uploadSheetMedia,mediaSignedUrl};
})();