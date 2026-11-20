/* Sessão ao Vivo — WebRTC P2P, sinalização privada Supabase.
 * Sem transmitir vídeo pelo documento ou pela API de fichas.
 * Uma instância por navegador; captura somente mediante clique.
 */
(function(global){
'use strict';
const api=()=>global.ARQUIVO_INTERNAL;
const sync=()=>global.ARQUIVO_SYNC;
const validId=/^[a-z0-9-]{20,60}$/i;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const state={
 session:null,participants:[],joined:false,joining:false,connecting:false,
 hudChoices:[],hudChoicesReady:false,hideAllNumbers:false,
 channel:null,peers:new Map(),presence:new Map(),hud:new Map(),pendingSignals:new Map(),
 selfId:null,accountId:null,local:null,
 camera:null,microphone:null,screen:null,screenAudio:null,
 quality:'balanced',sound:true,spotlight:null,status:'',error:'',
 busy:false,lastPresence:0,lobbyBusy:false,
 presenceSignature:'',presenceTimer:null,joinedAt:0,
 lobbyTimer:null,roomTimer:null,hudTimer:null,rtcTimer:null,lastHudAt:0
};
const quality={
 economy:{width:640,height:360,fps:20,camBitrate:400000,screenBitrate:1150000},
 balanced:{width:960,height:540,fps:24,camBitrate:800000,screenBitrate:1650000},
 hd:{width:1280,height:720,fps:30,camBitrate:1550000,screenBitrate:2500000}
};
const device=()=>!!(global.isSecureContext&&navigator.mediaDevices?.getUserMedia&&global.RTCPeerConnection);
const root=()=>document.querySelector('.ae-live-root');
const button=(label,action,extra='')=>'<button type="button" data-live-action="'+action+'" '+extra+'>'+label+'</button>';
const display=()=>state.local?.account_name||sync()?.state.identity?.accountName||'Participante';
const localSheet=()=>state.local?.sheet_id||null;
function status(message,error=false){state.status=message||'';state.error=error?message:'';const el=document.querySelector('.ae-live-message');if(el){el.textContent=state.status;el.classList.toggle('is-error',error)}}
async function rpc(name,params={}){
 const s=sync();
 if(!s?.state?.enabled||!s.state.identity?.id||!s.state.client)throw Error('Entre com sua chave para acessar a sessão.');
 const {data,error}=await s.state.client.rpc(name,params);
 if(error)throw Error(error.message||'Serviço indisponível.');
 return data;
}
function localPresence(){
 return {peerId:state.selfId,accountId:state.accountId,
  name:display().slice(0,80),sheetId:localSheet(),
  master:!!state.local?.is_master,
  camera:!!state.camera,microphone:!!state.microphone,
  screen:!!state.screen,connectedAt:state.joinedAt};
}
async function trackPresence(){
 if(!state.channel||!state.joined)return;
 const data=localPresence();
 const signature=JSON.stringify([data.peerId,data.accountId,data.name,data.sheetId,
  data.master,data.camera,data.microphone,data.screen]);
 if(signature===state.presenceSignature)return;
 const wait=1700-(Date.now()-state.lastPresence);
 if(wait>0){
  if(!state.presenceTimer)state.presenceTimer=setTimeout(()=>{
   state.presenceTimer=null;trackPresence().catch(e=>status('Presença não enviada: '+e.message,true));
  },wait);
  return;
 }
 if(state.presenceTimer){clearTimeout(state.presenceTimer);state.presenceTimer=null}
 state.lastPresence=Date.now();
 try{
  await state.channel.track(data);
  state.presenceSignature=signature;
 }catch(e){state.presenceSignature='';throw e}
}
function setTimer(name,handler,ms){if(state[name])clearInterval(state[name]);state[name]=setInterval(handler,ms)}
function clearTimers(){
 for(const name of ['lobbyTimer','roomTimer','hudTimer','rtcTimer'])if(state[name]){clearInterval(state[name]);state[name]=null}
}
async function refreshState(){
 if(state.lobbyBusy)return;
 state.lobbyBusy=true;
 try{
  const response=await rpc('ae_live_state');
  state.session=response?.session||null;
  state.participants=Array.isArray(response?.participants)?response.participants:[];
  if(state.joined){
   state.local=state.participants.find(p=>p.account_id===state.accountId)||state.local;
   const active=state.participants.some(p=>p.account_id===state.accountId);
   if(!state.session||!active){await leave(false);status('A sessão terminou ou seu acesso foi encerrado.',true);}
  }
  if(!state.joined&&api()?.page==='live')render();
  if(state.joined){presenceSync();renderHudAssignments();}
 }catch(error){if(api()?.page==='live')status(error.message,true)}
 finally{state.lobbyBusy=false}
}
async function refreshHud(){
 if(!state.joined)return;
 try{
  const data=await rpc('ae_live_hud');
  if(!Array.isArray(data))return;
  state.hud=new Map(data.filter(x=>typeof x.id==='string'&&typeof x.accountId==='string').map(x=>[x.accountId,x]));
  state.lastHudAt=Date.now();renderOverlays();
 }catch(e){status('Recursos indisponíveis: '+e.message,true)}
}
async function loadHudChoices(){
 if(!state.local?.is_master)return;
 const data=await rpc('ae_live_hud_choices');
 state.hudChoices=Array.isArray(data)?data.filter(x=>typeof x.id==='string'&&typeof x.name==='string'):[];
 state.hudChoicesReady=true;renderHudAssignments();
}
function renderHudAssignments(){
 if(!state.joined||!state.local?.is_master||api()?.page!=='live')return;
 const panel=document.querySelector('.ae-live-hud-management');
 if(!panel)return;
 const people=state.participants.filter(p=>!p.left_at&&!p.removed_at);
 const signature=JSON.stringify([people.map(p=>[p.account_id,p.account_name,p.sheet_id,p.hud_sheet_id,p.hud_hide_numbers]),
  state.hudChoicesReady,state.hudChoices.map(x=>x.id)]);
 if(panel.dataset.signature===signature)return;
 panel.dataset.signature=signature;
 if(!state.hudChoicesReady){panel.innerHTML='<p>Carregando fichas da sessão...</p>';return}
 panel.innerHTML='<div class="ae-live-hud-management-head"><div><span class="ae-live-eyebrow">CONTROLE DO MESTRE</span>'+
  '<h2>HUD DOS PARTICIPANTES</h2></div><small>Não altera as fichas vinculadas às chaves</small></div>'+
  '<div class="ae-live-hud-management-grid">'+people.map(p=>{
   const acc=esc(p.account_id),shown=String(p.hud_sheet_id||''),original=p.sheet_id||null;
   const options='<option value="">'+(original?'FICHA VINCULADA (PADRÃO)':'SEM PERSONAGEM (PADRÃO)')+'</option>'+
    state.hudChoices.map(sh=>'<option value="'+esc(sh.id)+'"'+(sh.id===shown?' selected':'')+'>'+
     esc(sh.name)+(sh.masterOnly?' · MESTRE':'')+'</option>').join('');
   return '<div class="ae-live-hud-management-person" data-live-hud-account="'+acc+'">'+
    '<div class="ae-live-hud-management-identity"><b>'+esc(p.account_name||'Participante')+'</b>'+
    '<small>'+(p.is_master?'MESTRE':'JOGADOR')+'</small></div>'+
    '<label>PERSONAGEM NO HUD<select data-live-hud-select="'+acc+'" aria-label="Personagem exibido para '+
     esc(p.account_name||'participante')+'">'+options+'</select></label>'+
    '<label class="ae-live-hud-hide"><input type="checkbox" data-live-hud-hidden="'+acc+'"'+
     (p.hud_hide_numbers?' checked':'')+'> OCULTAR VALORES DAS BARRAS</label></div>';
  }).join('')+'</div>';
}
async function assignHud(accountId,sheetId,hideNumbers){
 if(!state.joined||!state.local?.is_master)throw Error('Somente o mestre pode alterar o HUD.');
 const updated=await rpc('ae_live_set_hud',{p_account_id:accountId,
  p_sheet_id:sheetId||null,p_hide_numbers:!!hideNumbers});
 if(!updated||updated.account_id!==accountId)throw Error('O servidor não confirmou o HUD.');
 state.participants=state.participants.map(p=>p.account_id===accountId?updated:p);
 if(state.accountId===accountId)state.local=updated;
 await refreshHud();
 renderPeople();renderHudAssignments();
}
function hudRecord(sheetId,opts={}){
 if(!sheetId)return null;
 const remote=opts.accountId?state.hud.get(opts.accountId):null;
 if(remote?.id===sheetId)return {...remote,appearance:{accent:remote.accent||''}};
 if(opts.hideNumbers)return null;
 const sheet=api()?.db?.sheets?.find(x=>x.id===sheetId);
 if(!sheet||sheet.masterOnly&&!opts.master)return null;
 return sheet;
}
function bar(label,key,data,hideNumbers=false){
 const raw=data?.[key]||{},current=Number(raw.current),max=Number(raw.max);
 const percent=Number(raw.percent);
 const hasTotals=raw.current!==undefined&&raw.max!==undefined&&Number.isFinite(current)&&Number.isFinite(max)&&max>0;
 const hasPercent=raw.percent!==undefined&&Number.isFinite(percent);
 if(!hasTotals&&!hasPercent)return '';
 const pct=Math.max(0,Math.min(100,hasPercent?percent:current/max*100));
 return '<div class="ae-live-meter ae-live-meter-'+key+'"><div class="ae-live-meter-label"><span>'+label+'</span>'+
  (hideNumbers?'':'<b>'+esc(current)+' / '+esc(max)+'</b>')+'</div>'+
  '<div class="ae-live-meter-track" role="img" aria-label="'+label+
  (hideNumbers?'':' '+esc(current)+' de '+esc(max))+'"><i style="width:'+pct.toFixed(2)+'%"></i></div></div>';
}
function overlayFor(sheetId,opts={}){
 const sh=hudRecord(sheetId,opts);
 if(!sh){
  const title=opts.master?'MESTRE':sheetId?'HUD INDISPONÍVEL':'SEM PERSONAGEM NO HUD';
  return '<div class="ae-live-hud ae-live-hud-empty'+(opts.master?' is-master':'')+'"><span>'+title+'</span></div>';
 }
 const conds=Array.isArray(sh.conditions)?sh.conditions.slice(0,3):[];
 const color=String(sh.accent||sh.appearance?.accent||'');
 const safeColor=/^#[0-9a-fA-F]{6}$/.test(color)?' style="--ae-live-accent:'+color+'"':'';
 const hide=opts.hideNumbers||state.hideAllNumbers;
 return '<div class="ae-live-hud"'+safeColor+'><div class="ae-live-hud-head"><b>'+esc(sh.name||'Personagem')+'</b>'+
   (conds.length?'<span>'+esc(conds.join(' · '))+'</span>':'')+'</div>'+
   '<div class="ae-live-meters">'+bar('VIDA','vida',sh.resources,hide)+
   bar('ESTABILIDADE','estabilidade',sh.resources,hide)+bar('ALMA','alma',sh.resources,hide)+'</div></div>';
}
function avatarFor(sheetId,name,opts={}){
 const sh=hudRecord(sheetId,opts);
 const url=sh?.image&&api()?.mediaSrc?.(sh.image);
 return '<div class="ae-live-avatar">'+(url?'<img src="'+esc(url)+'" alt="" loading="lazy">':
  '<span>'+esc((name||'?').trim().slice(0,1).toUpperCase())+'</span>')+'</div>';
}
function getPresenceList(){
 const list=[localPresence(),...Array.from(state.presence.values()).filter(p=>p.peerId!==state.selfId)];
 return list.map(p=>{
  const record=state.participants.find(x=>x.account_id===p.accountId)||
   (p.accountId===state.accountId?state.local:null);
  if(!record)return {...p,hideNumbers:false};
  return {...p,name:record.account_name||p.name,master:record.is_master===true,
   sheetId:record.hud_sheet_id||record.sheet_id||null,
   hideNumbers:record.hud_hide_numbers===true};
 }).sort((a,b)=>(a.peerId===state.selfId?-1:b.peerId===state.selfId?1:0)||a.name.localeCompare(b.name,'pt-BR'));
}
function tileFor(p){
 const self=p.peerId===state.selfId,online=state.peers.get(p.peerId);
 const connection=online?.pc?.connectionState||'new';
 const ready=self||connection==='connected';
 const waitText=connection==='failed'?'CONEXÃO BLOQUEADA · TURN':
  connection==='disconnected'?'RECONEXÃO':
  connection==='connecting'?'ESTABELECENDO LINK':'CONECTANDO';
 const thumbId='ae-live-video-'+p.peerId;
 return '<article class="ae-live-tile'+(self?' is-local':'')+'" data-peer-id="'+esc(p.peerId)+'">'+
  '<div class="ae-live-tile-image">'+
   '<video id="'+esc(thumbId)+'" muted autoplay playsinline class="ae-live-camera-video"'+(p.camera?'':' hidden')+'></video>'+
   (!p.camera?avatarFor(p.sheetId,p.name,p):'')+
   (p.screen?'<span class="ae-live-sharing-badge">TELA ATIVA</span>':'')+
   (!self&&!ready?'<span class="ae-live-connect-badge">'+waitText+'</span>':'')+
   overlayFor(p.sheetId,p)+
  '</div><footer class="ae-live-tile-footer"><div class="ae-live-tile-identity"><strong>'+esc(p.name)+(self?' · VOCÊ':'')+
   '</strong><small>'+esc(p.master?'MESTRE':'JOGADOR')+'</small></div>'+
   '<div class="ae-live-tile-actions">'+
    (p.microphone?'<span class="ae-live-voice-on" title="Microfone ligado">MIC</span>':'<span class="ae-live-voice-off" title="Microfone desligado">MUDO</span>')+
    (!self&&p.screen?button('AMPLIAR','spotlight','data-live-peer="'+esc(p.peerId)+'" data-live-kind="screen"'):'')+
    (!self&&p.camera?button('FOCO','spotlight','data-live-peer="'+esc(p.peerId)+'" data-live-kind="camera"'):'')+
    (!self&&state.local?.is_master?button('REMOVER','kick','data-live-account="'+esc(p.accountId)+'" class="ae-live-kick"'):'')+
   '</div></footer></article>';
}
function renderOverlays(){
 if(!state.joined)return;
 for(const el of document.querySelectorAll('.ae-live-tile[data-peer-id]')){
  const p=getPresenceList().find(x=>x.peerId===el.dataset.peerId);
  if(!p)continue;
  const hud=el.querySelector('.ae-live-hud');
  if(hud)hud.outerHTML=overlayFor(p.sheetId,p);
 }
 const dockHud=document.querySelector('#ae-live-dock .ae-live-hud');
 if(dockHud){
  const focus=dockFocus();
  dockHud.outerHTML=overlayFor(focus?.sheetId,focus||{});
 }
 const spot=document.querySelector('.ae-live-spotlight .ae-live-hud');
 if(spot&&state.spotlight){
  const p=getPresenceList().find(x=>x.peerId===state.spotlight.peerId);
  if(p)spot.outerHTML=overlayFor(p.sheetId,p);
 }
}
function dockFocus(){
 const list=getPresenceList();
 const focus=list.find(p=>p.peerId!==state.selfId&&p.screen)||
  list.find(p=>p.peerId!==state.selfId&&p.camera)||list.find(p=>p.peerId===state.selfId);
 return focus||null;
}
function audioRack(){
 let rack=document.getElementById('ae-live-audio-rack');
 if(!rack){rack=document.createElement('div');rack.id='ae-live-audio-rack';rack.hidden=true;document.body.appendChild(rack)}
 const ids=new Set(state.peers.keys());
 for(const node of Array.from(rack.querySelectorAll('audio[data-peer-id]'))){
  if(!ids.has(node.dataset.peerId))node.remove();
 }
 for(const id of ids){
  let audio=document.getElementById('ae-live-audio-'+id);
  if(!audio){
   audio=document.createElement('audio');audio.id='ae-live-audio-'+id;
   audio.dataset.peerId=id;audio.autoplay=true;audio.playsInline=true;
   rack.appendChild(audio);
  }
  setVideo(audio,state.peers.get(id)?.audioStream,!state.sound);
 }
}
function setVideo(node,stream,muted=true){
 if(!node)return;
 if(node.srcObject!==stream){node.srcObject=stream||null}
 node.muted=muted;
 if(stream&&node.paused)node.play().catch(()=>{});
}
function bindStreams(){
 if(!state.joined)return;
 audioRack();
 for(const p of getPresenceList()){
  const video=document.getElementById('ae-live-video-'+p.peerId);
  const remote=state.peers.get(p.peerId);
  setVideo(video,p.peerId===state.selfId?state.camera:remote?.cameraStream,true);
 }
 const spot=state.spotlight;
 if(spot){
  const p=state.peers.get(spot.peerId);
  const stream=spot.peerId===state.selfId?(spot.kind==='screen'?state.screen:state.camera):
   spot.kind==='screen'?p?.screenStream:p?.cameraStream;
  setVideo(document.getElementById('ae-live-spotlight-video'),stream,true);
 }
}
function renderPeople(){
 if(!state.joined||api()?.page!=='live')return;
 const panel=document.querySelector('.ae-live-people');
 if(panel){
  const peers=getPresenceList();
  const signature=JSON.stringify(peers.map(p=>[p.peerId,p.accountId,p.sheetId,p.hideNumbers,p.camera,p.microphone,p.screen,
   p.master,p.name,p.peerId===state.selfId?'self':state.peers.get(p.peerId)?.pc?.connectionState||'new']));
  if(panel.dataset.liveSignature!==signature){
   panel.innerHTML=peers.map(tileFor).join('');
   panel.dataset.liveSignature=signature;
  }
 }
 const head=document.querySelector('.ae-live-count');if(head)head.textContent=getPresenceList().length+' NA SALA';
 const spotlight=document.querySelector('.ae-live-spotlight');
 if(spotlight){
  const active=state.spotlight&&(state.spotlight.peerId===state.selfId||state.presence.has(state.spotlight.peerId));
  spotlight.hidden=!active;
  if(active){
   const p=getPresenceList().find(x=>x.peerId===state.spotlight.peerId);
   const signature=state.spotlight.peerId+':'+state.spotlight.kind+':'+p?.sheetId+':'+p?.hideNumbers;
   if(spotlight.dataset.liveSignature!==signature){
    spotlight.innerHTML='<div class="ae-live-spotlight-head"><strong>'+esc(p.name)+' · '+(state.spotlight.kind==='screen'?'TELA':'CÂMERA')+
     '</strong>'+button('FECHAR','unspotlight')+'</div><div class="ae-live-spotlight-view">'+
     '<video id="ae-live-spotlight-video" autoplay playsinline muted></video>'+overlayFor(p.sheetId,p)+'</div>';
    spotlight.dataset.liveSignature=signature;
   }
  }
 }
 const cam=document.querySelector('[data-live-action="camera"]');if(cam){cam.classList.toggle('is-on',!!state.camera);cam.textContent=state.camera?'DESLIGAR CÂMERA':'LIGAR CÂMERA'}
 const mic=document.querySelector('[data-live-action="microphone"]');if(mic){mic.classList.toggle('is-on',!!state.microphone);mic.textContent=state.microphone?'SILENCIAR MICROFONE':'ATIVAR MICROFONE'}
 const screen=document.querySelector('[data-live-action="screen"]');if(screen){screen.classList.toggle('is-on',!!state.screen);screen.textContent=state.screen?'PARAR TELA':'COMPARTILHAR TELA'}
 const audio=document.querySelector('[data-live-action="sound"]');if(audio){audio.classList.toggle('is-on',state.sound);audio.textContent=state.sound?'ÁUDIO RECEBIDO: ON':'ÁUDIO RECEBIDO: OFF'}
 bindStreams();
 updateDock();
}
function updateDock(){
 let dock=document.getElementById('ae-live-dock');
 if(!state.joined){dock?.remove();return}
 if(!dock){dock=document.createElement('aside');dock.id='ae-live-dock';dock.className='ae-live-dock';document.body.appendChild(dock)}
 dock.hidden=api()?.page==='live';
 const focus=dockFocus(),remote=state.peers.get(focus?.peerId);
 const kind=focus?.screen?'screen':'camera';
 const stream=focus?.peerId===state.selfId?(kind==='screen'?state.screen:state.camera):
  kind==='screen'?remote?.screenStream:remote?.cameraStream;
 const signature=[focus?.peerId||'',kind,focus?.camera,focus?.screen,getPresenceList().length].join(':');
 if(dock.dataset.liveSignature!==signature){
  dock.innerHTML='<div class="ae-live-dock-preview">'+
   (focus?.camera||focus?.screen?'<video id="ae-live-dock-video" autoplay playsinline muted></video>':avatarFor(focus?.sheetId,focus?.name,focus||{}))+
   overlayFor(focus?.sheetId,focus||{})+'</div>'+
   '<div class="ae-live-dock-controls"><div class="ae-live-dock-title"><span class="ae-live-dock-dot"></span>'+
   '<strong>SESSÃO AO VIVO</strong><small>'+getPresenceList().length+' pessoas</small></div>'+
   '<div class="ae-live-dock-buttons">'+button('ABRIR','open')+
   button('SAIR','leave','class="ae-live-dock-leave"')+'</div></div>';
  dock.dataset.liveSignature=signature;
 }
 setVideo(document.getElementById('ae-live-dock-video'),stream,true);
}
function render(){
 const node=root();if(!node)return;
 if(!sync()?.state?.enabled||!sync()?.state?.identity?.id){
  node.innerHTML='<section class="ae-live-placeholder"><span class="ae-live-eyebrow">SALA PRIVADA</span><h2>ENTRE COM SUA CHAVE</h2>'+
   '<p>Somente mestre e jogadores autenticados podem entrar na sessão.</p></section>';return;
 }
 if(!device()){
  node.innerHTML='<section class="ae-live-placeholder"><h2>TRANSMISSÃO INDISPONÍVEL</h2>'+
   '<p>Use HTTPS e um navegador com suporte a câmera e WebRTC.</p></section>';return;
 }
 const room=state.session;
 const top='<header class="ae-live-header"><div><div class="ae-live-eyebrow">ARQUIVO ESPIRITUAL · COMUNICAÇÃO</div>'+
  '<h1>SESSÃO AO VIVO</h1><p>Câmeras, tela e recursos dos personagens no mesmo lugar.</p></div>'+
  '<span class="ae-live-live-tag">'+(room?'SESSÃO ABERTA':'AGUARDANDO MESTRE')+'</span></header>';
 if(!state.joined){
  node.innerHTML=top+'<section class="ae-live-lobby"><div class="ae-live-lobby-art"><span class="ae-live-orbit"></span><strong>'+
   (room?'SALA DISPONÍVEL':'SALA FECHADA')+'</strong></div><div class="ae-live-lobby-copy"><span class="ae-live-eyebrow">ACESSO POR CHAVE</span>'+
   '<h2>'+esc(room?.title||'Inicie uma sessão com seu grupo')+'</h2>'+
   '<p>'+(room?'O mestre abriu a sala. Entre para assistir, ativar sua câmera ou compartilhar tela.':
    'Quando o mestre iniciar, a sala ficará disponível aos jogadores conectados.')+'</p>'+
   '<div class="ae-live-lobby-buttons">'+(room?button(state.joining?'ENTRANDO...':'ENTRAR NA SESSÃO','join',state.joining?'disabled':''):
    (sync().state.identity?.kind==='master'?button('INICIAR SESSÃO','start'):'<span class="ae-live-waiting">Aguardando início...</span>'))+
    button('ATUALIZAR','refresh')+'</div></div></section>'+
    '<p class="ae-live-message'+(state.error?' is-error':'')+'" role="status">'+esc(state.status)+'</p>';
  return;
 }
 const master=!!state.local?.is_master;
 const qualityOptions=Object.entries({economy:'ECONOMIA',balanced:'EQUILIBRADO',hd:'HD'}).map(([value,label])=>
  '<option value="'+value+'"'+(state.quality===value?' selected':'')+'>'+label+'</option>').join('');
 node.innerHTML=top+'<section class="ae-live-studio">'+
  '<div class="ae-live-session-bar"><div><span class="ae-live-session-pulse"></span><strong>'+esc(room?.title||'Sessão')+
   '</strong><small class="ae-live-count">1 NA SALA</small></div>'+
   '<div class="ae-live-session-actions">'+(master?button('ENCERRAR SESSÃO','end','class="ae-live-danger"'):'')+button('SAIR DA SALA','leave')+'</div></div>'+
  '<div class="ae-live-toolbar">'+button(state.camera?'DESLIGAR CÂMERA':'LIGAR CÂMERA','camera')+
   button(state.microphone?'SILENCIAR MICROFONE':'ATIVAR MICROFONE','microphone')+
   button(state.screen?'PARAR TELA':'COMPARTILHAR TELA','screen')+
   button(state.sound?'ÁUDIO RECEBIDO: ON':'ÁUDIO RECEBIDO: OFF','sound')+
   button(state.hideAllNumbers?'MOSTRAR VALORES':'OCULTAR VALORES','numbers')+
   '<label class="ae-live-quality">QUALIDADE<select id="ae-live-quality">'+qualityOptions+'</select></label></div>'+
  '<div class="ae-live-message'+(state.error?' is-error':'')+'" role="status" aria-live="polite">'+esc(state.status||'Conectado à sessão privada.')+'</div>'+
  '<section class="ae-live-spotlight" hidden></section>'+
  '<div class="ae-live-gallery-head"><h2>PARTICIPANTES</h2><span>HUD SINCRONIZADO COM AS FICHAS</span></div>'+
  '<div class="ae-live-people" aria-label="Câmeras dos participantes"></div>'+
  (master?'<section class="ae-live-hud-management" aria-label="HUDs da sessão"></section>':'')+
  '<details class="ae-live-technical"><summary>Sobre a transmissão</summary><p>Conexão direta e criptografada entre navegadores. Sem gravação automática. A qualidade depende da internet, dos dispositivos e da rede de cada jogador. Para estabilidade e alta definição garantidas com 6–8 câmeras, será necessário um servidor SFU/TURN dedicado.</p></details>'+
  '</section>';
 renderPeople();renderHudAssignments();
}
function peerSet(){
 const entries=[],allowed=new Map(state.participants.map(p=>[p.account_id,p]));
 let unknown=false;
 const channels=state.channel?.presenceState?.()||{};
 for(const value of Object.values(channels))for(const item of (Array.isArray(value)?value:[])){
  if(!item||typeof item.peerId!=='string'||!validId.test(item.peerId)||!validId.test(String(item.accountId||'')))continue;
  if(item.peerId===state.selfId)continue;
  const known=allowed.get(item.accountId);
  if(!known){unknown=true;continue}
  entries.push({peerId:item.peerId,accountId:item.accountId,
   name:String(known.account_name||'Participante').slice(0,80),
   sheetId:typeof known.sheet_id==='string'?known.sheet_id:null,
   camera:item.camera===true,microphone:item.microphone===true,screen:item.screen===true,
   master:known.is_master===true});
 }
 if(unknown&&!state.lobbyBusy&&!state.connecting){
  state.connecting=true;
  queueMicrotask(()=>refreshState().catch(()=>{}).finally(()=>{state.connecting=false}));
 }
 return new Map(entries.map(p=>[p.peerId,p]));
}
function presenceSync(){
 if(!state.joined)return;
 const next=peerSet();state.presence=next;
 if(!state.spotlight){
  const shared=Array.from(next.values()).find(p=>p.screen);
  if(shared)state.spotlight={peerId:shared.peerId,kind:'screen'};
 }
 for(const [id,p] of next)if(!state.peers.has(id)){
  makePeer(p);sendHello(id).catch(()=>{});
 }
 for(const [id,p] of next){
  const queued=state.pendingSignals.get(id);
  if(queued?.length){
   state.pendingSignals.delete(id);
   for(const packet of queued)queueMicrotask(()=>signal(packet).catch(()=>{}));
  }
 }
 for(const id of Array.from(state.peers.keys()))if(!next.has(id))removePeer(id);
 if(state.spotlight&&!next.has(state.spotlight.peerId)&&state.spotlight.peerId!==state.selfId)state.spotlight=null;
 renderPeople();audioRack();updateDock();applyQualityAll();
}
function mediaStream(track){return track?new MediaStream([track]):null}
function bindRemoteTrack(peer,index,track){
 const key=index===0?'audioStream':index===1?'cameraStream':'screenStream';
 peer[key]=mediaStream(track);
 track.addEventListener('unmute',()=>{renderPeople();updateDock()});
 audioRack();
 track.addEventListener('ended',()=>{if(peer[key]?.getTracks().includes(track)){
  peer[key]=null;renderPeople();updateDock()
 }},{once:true});
 renderPeople();updateDock();
}
function rtcConfig(){
 const runtime=global.ARQUIVO_LIVE_ICE;
 const configured=Array.isArray(runtime)&&runtime.length?runtime:global.ARQUIVO_ONLINE_CONFIG?.iceServers;
 const servers=Array.isArray(configured)?configured.filter(item=>item&&typeof item==='object'&&
  (typeof item.urls==='string'||Array.isArray(item.urls))):[];
 return {iceServers:servers.length?servers:[{
  urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']
 }],iceCandidatePoolSize:2};
}
async function sendHello(to=null,ack=false){
 if(!state.channel||!state.joined||!state.selfId)return;
 await state.channel.send({type:'broadcast',event:'peer-hello',
  payload:{from:state.selfId,accountId:state.accountId,to,ack}});
}
async function acceptHello(payload){
 if(!state.joined||!payload||!validId.test(String(payload.from||''))||
  payload.from===state.selfId||payload.to&&payload.to!==state.selfId)return;
 let meta=state.presence.get(payload.from);
 if(!meta){
  await refreshState();
  meta=state.presence.get(payload.from);
 }
 if(!meta||meta.accountId!==payload.accountId)return;
 if(!state.peers.has(meta.peerId))makePeer(meta);
 const peer=state.peers.get(meta.peerId);if(!peer)return;
 peer.ready=true;
 if(!payload.ack)sendHello(meta.peerId,true).catch(()=>{});
 if(peer.initiator)offerPeer(peer).catch(e=>status(e.message,true));
}
async function offerPeer(peer,retry=false,renegotiate=false){
 const pc=peer.pc;
 if(!state.joined||!peer.initiator||!peer.ready||peer.makingOffer||pc.connectionState==='closed')return;
 if(pc.connectionState==='connected'&&!renegotiate)return;
 if(pc.signalingState!=='stable'){
  if(retry&&pc.signalingState==='have-local-offer'&&Date.now()-peer.lastOfferAt>8000){
   try{await pc.setLocalDescription({type:'rollback'})}catch(e){return}
  }else return;
 }
 try{
  peer.makingOffer=true;
  await pc.setLocalDescription();
  peer.lastOfferAt=Date.now();
  await sendSignal(peer.id,'description',pc.localDescription.toJSON());
 }finally{peer.makingOffer=false}
}
function rtcHealth(){
 if(!state.joined)return;
 for(const peer of state.peers.values()){
  if(peer.pc.connectionState==='connected')continue;
  if(peer.pc.connectionState==='failed'){
   try{peer.pc.restartIce()}catch(e){}
  }
  if(!peer.ready&&Date.now()-peer.lastHelloAt>=9500){
   peer.lastHelloAt=Date.now();sendHello(peer.id).catch(()=>{});
  }else if(peer.ready&&peer.initiator)offerPeer(peer,true).catch(()=>{});
 }
 // O servidor pode validar novos participantes antes da chegada do Presence.
 if(state.pendingSignals.size)refreshState().catch(()=>{});
}
function makePeer(meta){
 if(!state.joined||state.peers.has(meta.peerId)||typeof global.RTCPeerConnection!=='function')return;
 const pc=new RTCPeerConnection(rtcConfig());
 const peer={pc,id:meta.peerId,polite:state.selfId>meta.peerId,
  initiator:state.selfId<meta.peerId,ready:false,lastOfferAt:0,makingOffer:false,
  ignoreOffer:false,remoteAnswerPending:false,queue:[],
  senders:[],audioStream:null,cameraStream:null,screenStream:null,
  iceBatch:[],iceFlush:null,lastHelloAt:0};
 state.peers.set(meta.peerId,peer);
 // Só quem inicia cria as três m-lines. No navegador que responde,
 // setRemoteDescription(offer) cria os transceivers receptores;
 // criar outros antes da oferta gerava seis m-lines e vídeo preto no retorno.
 if(peer.initiator){
  const tracks=[['audio',state.microphone],['video',state.camera],['video',state.screen]];
  for(let index=0;index<tracks.length;index++){
   const [kind,stream]=tracks[index];
   const trans=pc.addTransceiver(kind,{direction:'sendrecv'});
   peer.senders[index]=trans.sender;
   const t=stream?.getTracks?.().find(track=>track.kind===kind)||null;
   if(t)trans.sender.replaceTrack(t).catch(()=>{});
  }
 }
 pc.onicecandidate=({candidate})=>{
  if(candidate&&peer.iceBatch.length<80)peer.iceBatch.push(candidate.toJSON());
  if(peer.iceFlush)return;
  peer.iceFlush=setTimeout(()=>{
   peer.iceFlush=null;
   const items=peer.iceBatch.splice(0);
   if(items.length)sendSignal(peer.id,'candidates',items).catch(()=>{});
  },130);
 };
 pc.ontrack=e=>{
  const idx=pc.getTransceivers().indexOf(e.transceiver);
  if(idx>=0&&idx<=2)bindRemoteTrack(peer,idx,e.track);
 };
 pc.onconnectionstatechange=()=>{
  if(pc.connectionState==='failed'){
   try{pc.restartIce()}catch(e){}
   status('Falha na ligação com '+(state.presence.get(peer.id)?.name||'outro participante')+
    '. Em redes restritas, configure um servidor TURN.',true);
  }
  renderPeople();updateDock();
 };
 pc.onnegotiationneeded=()=>{
  if(peer.initiator)offerPeer(peer).catch(e=>status('Negociação: '+e.message,true));
 };
 syncTracks(peer).catch(()=>{});
}
async function syncTracks(peer){
 const tracks=[
  state.microphone?.getAudioTracks?.()[0]||null,
  state.camera?.getVideoTracks?.()[0]||null,
  state.screen?.getVideoTracks?.()[0]||null
 ];
 await Promise.all(tracks.map((track,index)=>peer.senders[index]?.replaceTrack(track)));
 await setOutboundQuality(peer);
}
async function applyQualityAll(){
 await Promise.all(Array.from(state.peers.values()).map(p=>setOutboundQuality(p).catch(()=>{})));
}
async function setOutboundQuality(peer){
 const count=Math.max(1,state.presence.size+1),preset=quality[state.quality]||quality.balanced;
 const factor=count>=7?.54:count>=5?.70:count>=4?.85:1;
 for(const [idx,base] of [[1,preset.camBitrate],[2,preset.screenBitrate]]){
  const sender=peer.senders[idx];if(!sender?.getParameters)return;
  const params=sender.getParameters();
  if(!params.encodings?.length)params.encodings=[{}];
  params.encodings[0].maxBitrate=Math.floor(base*factor);
  params.degradationPreference=idx===2?'maintain-resolution':'balanced';
  try{await sender.setParameters(params)}catch(e){}
 }
}
async function sendSignal(to,type,data){
 if(!state.channel||!state.joined)return;
 await state.channel.send({type:'broadcast',event:'rtc-signal',payload:{
  from:state.selfId,to,type,data}});
}
async function signal(payload){
 if(!state.joined||!payload||payload.to!==state.selfId||payload.from===state.selfId)return;
 if(!validId.test(String(payload.from||'')))return;
 if(!['description','candidate','candidates','renegotiate'].includes(payload.type))return;
 if(!state.presence.has(payload.from)){
  const list=state.pendingSignals.get(payload.from)||[];
  if(list.length<20)list.push(payload);
  state.pendingSignals.set(payload.from,list);
  refreshState().catch(()=>{});
  return;
 }
 if(!state.peers.has(payload.from))makePeer(state.presence.get(payload.from));
 const peer=state.peers.get(payload.from);if(!peer)return;
 const pc=peer.pc;
 try{
  if(payload.type==='renegotiate'){
   if(peer.initiator)await offerPeer(peer,false,true);
   return;
  }
  if(payload.type==='description'){
   const d=payload.data;
   if(!d||!['offer','answer'].includes(d.type)||typeof d.sdp!=='string'||d.sdp.length>95000)return;
   const ready=!peer.makingOffer&&(pc.signalingState==='stable'||peer.remoteAnswerPending);
   const collision=d.type==='offer'&&!ready;
   peer.ignoreOffer=!peer.polite&&collision;
   if(peer.ignoreOffer)return;
   peer.remoteAnswerPending=d.type==='answer';
   await pc.setRemoteDescription(d);
   peer.remoteAnswerPending=false;
   for(const candidate of peer.queue.splice(0))try{await pc.addIceCandidate(candidate)}catch(e){}
   if(d.type==='offer'){
    // Associa as trilhas de saída às m-lines oferecidas, nunca a novos
    // transceivers sem MID; sincroniza antes de criar a resposta SDP.
    const slots=pc.getTransceivers();
    if(slots.length<3)throw Error('Oferta de mídia incompleta.');
    for(let i=0;i<3;i++){
     const trans=slots[i];
     peer.senders[i]=trans.sender;
     if(trans.direction!=='sendrecv')trans.direction='sendrecv';
    }
    await syncTracks(peer);
    await pc.setLocalDescription();
    await sendSignal(peer.id,'description',pc.localDescription.toJSON());
   }
  }else if(payload.type==='candidate'||payload.type==='candidates'){
   const candidates=payload.type==='candidate'?[payload.data]:payload.data;
   if(!Array.isArray(candidates)||candidates.length>80)return;
   for(const c of candidates){
    if(!c||typeof c.candidate!=='string'||c.candidate.length>16000)continue;
    if(!pc.remoteDescription){if(peer.queue.length<200)peer.queue.push(c);continue}
    await pc.addIceCandidate(c);
   }
  }
 }catch(e){if(!peer.ignoreOffer)status('Conexão com '+(state.presence.get(peer.id)?.name||'participante')+': '+e.message,true)}
}
function removePeer(id){
 const peer=state.peers.get(id);if(!peer)return;
 peer.pc.ontrack=null;peer.pc.onnegotiationneeded=null;peer.pc.onicecandidate=null;
 if(peer.iceFlush){clearTimeout(peer.iceFlush);peer.iceFlush=null}
 peer.iceBatch.length=0;
 try{peer.pc.close()}catch(e){}
 state.peers.delete(id);
 audioRack();
}
async function openRoom(){
 const st=sync()?.state;
 if(!state.session?.id||!st?.identity?.id)throw Error('Não existe sessão disponível.');
 state.joining=true;state.status='Entrando na sessão...';render();
 try{
  const self=await rpc('ae_live_join',{p_character_id:st.identity.kind==='player'?st.identity.sheetId||null:null});
  if(!self?.account_id||!self?.session_id)throw Error('A entrada não foi confirmada.');
  state.local=self;state.accountId=self.account_id;
  state.selfId=global.crypto?.randomUUID?.()||'';
  state.joinedAt=Date.now();state.presenceSignature='';state.lastPresence=0;
  if(!validId.test(state.selfId))throw Error('Identificação de conexão indisponível.');
  state.joined=true;state.quality='balanced';state.error='';
  const channel=st.client.channel('ae-video-'+self.session_id,{config:{
   private:true,broadcast:{self:false,ack:true},presence:{key:state.selfId}}});
  state.channel=channel;
  channel.on('presence',{event:'sync'},presenceSync);
  channel.on('broadcast',{event:'rtc-signal'},({payload})=>{signal(payload).catch(()=>{})});
  channel.on('broadcast',{event:'peer-hello'},({payload})=>{acceptHello(payload).catch(()=>{})});
  channel.on('broadcast',{event:'session-end'},()=>leave(false));
  channel.on('broadcast',{event:'hud-updated'},()=>{refreshState().then(()=>refreshHud()).catch(()=>{})});
  channel.on('broadcast',{event:'participant-kicked'},({payload})=>{
   if(payload?.account_id===state.accountId){
    leave(false).then(()=>status('Você foi removido pelo mestre.',true)).catch(()=>{});
   }else refreshState().catch(()=>{});
  });
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('A sala privada não respondeu.')),12000);
   channel.subscribe(async status=>{
    if(status==='SUBSCRIBED'){
     clearTimeout(timeout);
     try{await trackPresence();resolve()}catch(e){reject(e)}
    }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
     clearTimeout(timeout);reject(Error('Sem autorização para entrar no canal de vídeo.'))
    }
   });
  });
  clearTimers();
  setTimer('roomTimer',()=>{pollRoom().catch(()=>{})},14000);
  setTimer('hudTimer',()=>{refreshHud().catch(()=>{})},9000);
  await refreshState();
  await sendHello().catch(()=>{});
  setTimer('rtcTimer',rtcHealth,4500);
  if(state.local?.is_master)await loadHudChoices().catch(e=>status(e.message,true));
  await refreshHud();
  state.status='Conexão pronta. Ative câmera ou microfone quando quiser.';
  render();updateDock();
 }catch(e){
  await leave(true);
  throw e;
 }finally{state.joining=false}
}
async function pollRoom(){
 if(!state.joined)return;
 try{
  const res=await rpc('ae_live_state');
  if(!res?.session||res.session.id!==state.local?.session_id||
    !res?.participants?.some(p=>p.account_id===state.accountId)){
   await leave(false);status('Sessão encerrada ou acesso revogado.',true);return;
  }
  state.session=res.session;state.participants=res.participants;
  const hb=await rpc('ae_live_heartbeat',{p_camera:!!state.camera});
  if(!hb||hb.left_at||hb.removed_at){await leave(false);return}
  state.local=hb;
  if(state.channel)await trackPresence();
  presenceSync();renderHudAssignments();
 }catch(e){if(state.joined)status('Conexão com o servidor: '+e.message,true)}
}
function stopStream(stream){
 if(!stream)return;
 for(const track of stream.getTracks())try{track.stop()}catch(e){}
}
async function replaceTracks(){
 await Promise.all(Array.from(state.peers.values()).map(p=>syncTracks(p).catch(()=>{})));
 await trackPresence().catch(()=>{});
 // replaceTrack em transceivers que começaram sem mídia pode exigir nova SDP.
 await Promise.all(Array.from(state.peers.values()).filter(p=>p.ready).map(p=>
  (p.initiator?offerPeer(p,false,true):sendSignal(p.id,'renegotiate',{})).catch(()=>{})));
 renderPeople();
}
async function toggleCamera(){
 if(!state.joined)return;
 if(state.camera){const old=state.camera;state.camera=null;stopStream(old);await rpc('ae_live_heartbeat',{p_camera:false}).catch(()=>{});await replaceTracks();return}
 const q=quality[state.quality]||quality.balanced;
 const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:q.width},height:{ideal:q.height},
  frameRate:{ideal:q.fps,max:30},facingMode:'user'},audio:false});
 try{
  await rpc('ae_live_heartbeat',{p_camera:true});
  stream.getVideoTracks()[0].contentHint='motion';
  state.camera=stream;
  stream.getVideoTracks()[0].addEventListener('ended',()=>{
   if(state.camera===stream){state.camera=null;replaceTracks().catch(()=>{});rpc('ae_live_heartbeat',{p_camera:false}).catch(()=>{})}
  },{once:true});
  await replaceTracks();
 }catch(e){stopStream(stream);throw e}
}
async function toggleMic(){
 if(!state.joined)return;
 if(state.microphone){const old=state.microphone;state.microphone=null;stopStream(old);await replaceTracks();return}
 const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{
  echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
 state.microphone=stream;
 stream.getAudioTracks()[0]?.addEventListener('ended',()=>{
  if(state.microphone===stream){state.microphone=null;replaceTracks().catch(()=>{})}
 },{once:true});
 await replaceTracks();
}
async function toggleScreen(){
 if(!state.joined)return;
 if(state.screen){const old=state.screen;state.screen=null;
  if(state.spotlight?.peerId===state.selfId&&state.spotlight.kind==='screen')state.spotlight=null;
  stopStream(old);await replaceTracks();return}
 if(!navigator.mediaDevices.getDisplayMedia)throw Error('Compartilhamento de tela indisponível neste navegador.');
 // Solicitar captura diretamente após o clique, para manter a ativação do usuário.
 // Constrangimentos de resolução podem rejeitar getDisplayMedia em alguns navegadores.
 // A captura nativa escolhe a melhor resolução; o bitrate é regulado pelo perfil.
 const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
 if(!state.joined){stopStream(stream);return}
 state.screen=stream;
 state.spotlight={peerId:state.selfId,kind:'screen'};
 const track=stream.getVideoTracks()[0];
 if(track){track.contentHint='detail';track.addEventListener('ended',()=>{
  if(state.screen===stream){state.screen=null;
   if(state.spotlight?.peerId===state.selfId&&state.spotlight.kind==='screen')state.spotlight=null;
   replaceTracks().catch(()=>{})}
 },{once:true})}
 await replaceTracks();
}
async function leave(notify=true){
 clearTimers();
 if(state.presenceTimer){clearTimeout(state.presenceTimer);state.presenceTimer=null}
 state.presenceSignature='';state.lastPresence=0;state.joinedAt=0;
 for(const id of Array.from(state.peers.keys()))removePeer(id);
 const ch=state.channel;state.channel=null;
 if(ch){try{await ch.untrack()}catch(e){}try{await sync()?.state.client?.removeChannel(ch)}catch(e){}}
 const hadJoined=state.joined;
 state.joined=false;state.presence.clear();state.pendingSignals.clear();state.hud.clear();state.hudChoices=[];state.hudChoicesReady=false;
 document.getElementById('ae-live-audio-rack')?.remove();
 stopStream(state.camera);stopStream(state.microphone);stopStream(state.screen);
 state.camera=null;state.microphone=null;state.screen=null;state.spotlight=null;
 state.selfId=null;state.accountId=null;state.local=null;state.joining=false;
 if(notify&&hadJoined)await rpc('ae_live_leave').catch(()=>{});
 state.status='';state.error='';
 updateDock();
 if(api()?.page==='live'){
  try{const response=await rpc('ae_live_state');state.session=response?.session||null;state.participants=response?.participants||[]}
  catch(e){state.session=null;state.participants=[]}
  render();startLobbyPolling();
 }
}
function startLobbyPolling(){
 if(state.joined||state.lobbyTimer||api()?.page!=='live')return;
 setTimer('lobbyTimer',()=>{if(api()?.page==='live'&&!state.joined)refreshState().catch(()=>{})},14000);
}
async function startSession(){
 const title='Mesa de RPG · Bleach CBB';
 const res=await rpc('ae_live_start',{p_title:title});
 state.session=res;state.participants=[];
 await openRoom();
}
async function endSession(){
 await rpc('ae_live_end');
 await leave(false);state.session=null;state.participants=[];render();
}
async function removeAccount(account){
 if(!state.local?.is_master||!validId.test(String(account||'')))throw Error('Remoção indisponível.');
 await rpc('ae_live_kick',{p_account_id:account});
 await refreshState();
}
async function changeQuality(value){
 if(!Object.hasOwn(quality,value))return;
 state.quality=value;
 if(state.camera?.getVideoTracks?.()[0]){
  const p=quality[value];
  try{await state.camera.getVideoTracks()[0].applyConstraints({width:{ideal:p.width},height:{ideal:p.height},frameRate:{ideal:p.fps}})}
  catch(e){status('Seu dispositivo não oferece esta resolução.',true)}
 }
 await applyQualityAll();
}
async function action(name,element){
 if(state.busy&&name!=='open')return;
 if(name==='open'){api()?.setPage?.('live');return}
 if(name==='spotlight'){
  const id=element.dataset.livePeer,kind=element.dataset.liveKind;
  if(id!==state.selfId&&!state.presence.has(id))return;
  if(!['camera','screen'].includes(kind))return;
  state.spotlight={peerId:id,kind};renderPeople();return;
 }
 if(name==='unspotlight'){state.spotlight=null;renderPeople();return}
 if(name==='sound'){state.sound=!state.sound;renderPeople();return}
 if(name==='numbers'){state.hideAllNumbers=!state.hideAllNumbers;renderOverlays();renderPeople();
  const b=document.querySelector('[data-live-action="numbers"]');if(b)b.textContent=state.hideAllNumbers?'MOSTRAR VALORES':'OCULTAR VALORES';return}
 if(['end','kick'].includes(name)){
  const confirmFn=api()?.confirmSite;
  if(typeof confirmFn==='function'){
   confirmFn(name==='end'?'ENCERRAR SESSÃO?':'REMOVER PARTICIPANTE?',
    name==='end'?'Todas as câmeras serão desconectadas.':'A pessoa perderá acesso à sala.',
    ()=>run(name,element));
  }return;
 }
 await run(name,element);
}
async function run(name,el){
 if(state.busy)return;state.busy=true;
 try{
  if(name==='start')await startSession();
  else if(name==='join')await openRoom();
  else if(name==='refresh')await refreshState();
  else if(name==='leave')await leave();
  else if(name==='end')await endSession();
  else if(name==='kick')await removeAccount(el?.dataset?.liveAccount);
  else if(name==='camera')await toggleCamera();
  else if(name==='microphone')await toggleMic();
  else if(name==='screen')await toggleScreen();
  status(state.joined?'Sessão conectada.':'');
  if(api()?.page==='live')render();
 }catch(e){status(e?.message||'Ação não concluída.',true);api()?.toast?.('Sessão ao Vivo',e?.message||'Erro de transmissão.',true)}
 finally{state.busy=false}
}
document.addEventListener('click',event=>{
 const el=event.target.closest?.('[data-live-action]');
 if(!el)return;
 event.preventDefault();event.stopPropagation();
 action(el.dataset.liveAction,el).catch(e=>status(e.message,true));
});
document.addEventListener('change',event=>{
 if(event.target?.id==='ae-live-quality')changeQuality(event.target.value).catch(e=>status(e.message,true));
 const node=event.target,account=node?.dataset?.liveHudSelect||node?.dataset?.liveHudHidden;
 if(account){
  const row=Array.from(document.querySelectorAll('[data-live-hud-account]'))
   .find(x=>x.dataset.liveHudAccount===account);
  const selected=row?.querySelector('[data-live-hud-select]')?.value||'';
  const hide=row?.querySelector('[data-live-hud-hidden]')?.checked===true;
  assignHud(account,selected,hide).catch(e=>{
   status(e.message,true);api()?.toast?.('HUD não atualizado',e.message,true);
   const panel=document.querySelector('.ae-live-hud-management');
   if(panel)panel.dataset.signature='';
   renderHudAssignments();
  });
 }
});
global.addEventListener('arquivo-logged-out',()=>{leave(false).catch(()=>{})});
global.addEventListener('arquivo-online-snapshot',()=>{if(state.joined)renderOverlays()});
global.addEventListener('pagehide',()=>{if(state.joined){stopStream(state.camera);stopStream(state.microphone);stopStream(state.screen)}});

function pageChanged(page){
 if(page==='live'){
  if(!root()?.hasChildNodes())render();else if(state.joined){renderOverlays();updateDock()}
  if(!state.joined){refreshState().catch(()=>{});startLobbyPolling()}
 }else{
  if(state.lobbyTimer){clearInterval(state.lobbyTimer);state.lobbyTimer=null}
  updateDock();
 }
}
global.ARQUIVO_LIVE=Object.freeze({pageChanged,render,refreshState,leave,
 get state(){return state},getPresenceList,overlayFor});
})(window);