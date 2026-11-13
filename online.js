(function(){
'use strict';
const config=window.ARQUIVO_ONLINE_CONFIG||{};
const apiUrl=String(config.url||'').trim().replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
const apiKey=String(config.anonKey||'').replace(/\s/g,'');
const isSecret=apiKey.startsWith('sb_secret_')||(/^[^.]+\.[^.]+\.[^.]+$/.test(apiKey)&&(()=>{try{return JSON.parse(atob(apiKey.split('.')[1])).role==='service_role'}catch(e){return false}})());
const ready=/^https:\/\/[^ ]+\.supabase\.co$/.test(apiUrl) && !isSecret && /^(sb_publishable_|eyJ)/.test(apiKey);
const state={configured:ready,enabled:false,connecting:false,error:isSecret?'Chave secreta recusada. Use a chave pública.':!apiUrl?'Configuração ausente: falta a URL.':!apiKey?'Configuração ausente: falta a chave pública.':!ready?'Chave pública inválida ou URL incorreta.':'',client:null,identity:null,revision:0,keys:[],pending:Promise.resolve(),saving:false,busyUntil:0,appliedOnce:false};
function stripDoc(db){const c=JSON.parse(JSON.stringify(db));delete c.keys;delete c.keysChanged;return c}
function assignments(db){return (db.keys||[]).filter(k=>k.kind==='player').map(k=>({id:k.id,sheetId:k.sheetId||''}))}
function stateOnly(s){return {resources:Object.fromEntries(['vida','estabilidade','alma'].map(k=>[k,{current:s.resources[k].current}])),conditions:s.conditions||[],notes:s.notes||'',noteImages:s.noteImages||[],inventory:s.inventory||{items:[],currencies:[]},restCount:s.restCount||0,desgaste:s.desgaste||0,exposures:s.exposures||{}}}
async function rpc(fn,args={}){const {data,error}=await state.client.rpc(fn,args);if(error)throw Error(error.message||'Erro de conexão');return data}
async function init(){if(!ready)return false;
 if(!window.supabase?.createClient){state.error='Biblioteca de conexão indisponível. Verifique a internet.';return false}
 state.connecting=true;
 try{
  state.client=window.supabase.createClient(apiUrl,apiKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let {data:{session},error}=await state.client.auth.getSession();if(error)throw error;
  if(!session){const res=await state.client.auth.signInAnonymously();if(res.error)throw res.error}
  state.identity=await rpc('ae_session_info');if(!state.identity?.id)state.identity=null;
  state.enabled=true;await refresh(true);
  setInterval(()=>{if(state.enabled&&document.visibilityState==='visible')refresh(false).catch(e=>{state.error=e.message;window.dispatchEvent(new CustomEvent('arquivo-sync-error',{detail:e.message}))})},5000);
  window.dispatchEvent(new Event('arquivo-online-ready'));
  return true;
 }catch(e){state.error=e.message;state.enabled=false;window.dispatchEvent(new CustomEvent('arquivo-sync-error',{detail:e.message}));return false}
 finally{state.connecting=false}
}
async function refresh(force=false){if(!state.enabled)return;
 if(!force&&(state.saving||Date.now()<state.busyUntil))return;
 const data=await rpc('ae_read_document');
 if(!data)return;
 if(!force && state.revision===data.revision)return;
 state.revision=data.revision;
 if(Object.keys(data.data||{}).length===0){window.dispatchEvent(new CustomEvent('arquivo-online-empty'));return}
 window.dispatchEvent(new CustomEvent('arquivo-online-snapshot',{detail:{data:data.data,identity:state.identity,keys:state.keys,revision:state.revision}}));
 state.appliedOnce=true;
}
async function login(name,code){mediaSignedCache.clear();if(!state.enabled)throw Error('A conexão online não está ativa.');state.identity=await rpc('ae_login',{p_name:name,p_code:code});await keys();await refresh(true);return state.identity}
async function bootstrap(token,code,name){mediaSignedCache.clear();if(!state.enabled)throw Error('A conexão online não está ativa.');state.identity=await rpc('ae_bootstrap_master',{p_token:token,p_code:code,p_name:name});await keys();return state.identity}
async function logout(){mediaSignedCache.clear();if(state.enabled)await rpc('ae_logout');state.identity=null;state.keys=[];await refresh(true);window.dispatchEvent(new Event('arquivo-logged-out'))}
async function removeAccount(id){return rpc('ae_master_remove_account',{p_id:id})}
async function keys(){if(state.identity?.kind==='master')state.keys=await rpc('ae_master_keys');else if(state.identity)state.keys=[state.identity];else state.keys=[];return state.keys}
async function createKey(name,kind,sheetId){const created=await rpc('ae_master_create_key',{p_name:name,p_kind:kind,p_sheet_id:sheetId||null});await keys();return created}
async function changeKey(id,action){await rpc('ae_master_change_key',{p_id:id,p_action:action});await keys()}
async function manageKey(id,action,name=null,sheetId=null){const result=await rpc('ae_master_manage_key',{p_id:id,p_action:action,p_name:name,p_sheet_id:sheetId});await keys();return result}
function push(db,role,sheetId){if(!state.enabled)return;
 state.busyUntil=Date.now()+1700;
 const snapshot=stripDoc(db), links=assignments(db), sheet=snapshot.sheets.find(s=>s.id===sheetId), payload=sheet?stateOnly(sheet):null;
 state.pending=state.pending.catch(()=>{}).then(async()=>{
  state.saving=true;
  try{
   if(role==='master')state.revision=await rpc('ae_master_replace',{p_data:snapshot,p_assignments:links});
   else if(role==='player' && payload)state.revision=await rpc('ae_player_update',{p_sheet_id:sheetId,p_state:payload});
  }catch(e){state.error=e.message;window.dispatchEvent(new CustomEvent('arquivo-sync-error',{detail:'Alteração NÃO sincronizada: '+e.message}));}
  finally{state.saving=false;state.busyUntil=Date.now()+800}
 });
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
async function saveOwnedSheet(sheet){if(!state.enabled||state.identity?.kind!=='player')throw Error('Entre com uma chave de jogador.');return rpc('ae_player_save_sheet',{p_sheet:sheet})}
async function useAbility(sheetId,abilityIndex){if(!state.enabled)throw Error('Conexão online indisponível.');return rpc('ae_use_ability',{p_sheet_id:sheetId,p_ability_index:abilityIndex})}
async function rollSkill(sheetId,skill,abilityIndex=null){return rpc('ae_roll_skill_colored',{p_sheet_id:sheetId,p_skill:skill,p_ability_index:Number.isInteger(abilityIndex)?abilityIndex:null})}
async function rerollSkill(previousId){if(!Number.isSafeInteger(previousId)||previousId<1)throw Error('Rolagem original inválida.');return rpc('ae_reroll_skill',{p_previous_id:previousId})}
async function rollFree(count,faces,hidden=false,colors=[]){return rpc('ae_roll_free_colored',{p_count:count,p_faces:faces,p_hidden:hidden,p_colors:Array.isArray(colors)?colors:[]})}
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

window.ARQUIVO_SYNC={state,init,refresh,login,logout,removeAccount,bootstrap,keys,createKey,changeKey,manageKey,push,stripDoc,saveOwnedSheet,saveAppearance,useAbility,rollSkill,rerollSkill,rollFree,rollHistory,clearRolls,musicNow,musicSet,uploadMusic,listMusic,deleteMusic,uploadSheetMedia,mediaSignedUrl};
})();