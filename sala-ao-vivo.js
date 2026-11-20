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
 channel:null,peers:new Map(),presence:new Map(),hud:new Map(),
 selfId:null,accountId:null,local:null,
 camera:null,microphone:null,screen:null,screenAudio:null,
 quality:'balanced',sound:true,spotlight:null,status:'',error:'',
 busy:false,lastPresence:0,lobbyBusy:false,
 lobbyTimer:null,roomTimer:null,hudTimer:null,lastHudAt:0
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
  screen:!!state.screen,connectedAt:Date.now()};
}
async function trackPresence(){
 if(!state.channel||!state.joined)return;
 await state.channel.track(localPresence());
}
function setTimer(name,handler,ms){if(state[name])clearInterval(state[name]);state[name]=setInterval(handler,ms)}
function clearTimers(){
 for(const name of ['lobbyTimer','roomTimer','hudTimer'])if(state[name]){clearInterval(state[name]);state[name]=null}
}
async function refreshState(){
 if(state.lobbyBusy)return;
 state.lobbyBusy=true;
 try{
  const response=await rpc('ae_live_state');
  state.session=response?.session||null;
  state.participants=Array.isArray(response?.participants)?response.participants:[];
  if(state.joined){
   const active=state.participants.some(p=>p.account_id===state.accountId);
   if(!state.session||!active){await leave(false);status('A sessão terminou ou seu acesso foi encerrado.',true);}
  }
  if(!state.joined&&api()?.page==='live')render();
  if(state.joined)renderPeople();
 }catch(error){if(api()?.page==='live')status(error.message,true)}
 finally{state.lobbyBusy=false}
}
async function refreshHud(){
 if(!state.joined||state.busy)return;
 try{
  const data=await rpc('ae_live_hud');
  if(!Array.isArray(data))return;
  state.hud=new Map(data.filter(x=>typeof x.id==='string').map(x=>[x.id,x]));
  state.lastHudAt=Date.now();renderOverlays();
 }catch(e){status('Recursos indisponíveis: '+e.message,true)}
}
function hudRecord(sheetId){
 if(!sheetId)return null;
 const remote=state.hud.get(sheetId);
 const sheet=api()?.db?.sheets?.find(x=>x.id===sheetId);
 if(!remote&&!sheet)return null;
 if(remote)return {...remote,appearance:sheet?.appearance||{}};
 return sheet?.masterOnly?null:sheet;
}
function bar(label,key,data){
 const raw=data?.[key]||{},current=Number(raw.current),max=Number(raw.max);
 if(!Number.isFinite(current)||!Number.isFinite(max)||max<=0)return '';
 const pct=Math.max(0,Math.min(100,current/max*100));
 return '<div class="ae-live-meter ae-live-meter-'+key+'"><div class="ae-live-meter-label"><span>'+label+'</span><b>'+esc(current)+' / '+esc(max)+'</b></div>'+
  '<div class="ae-live-meter-track"><i style="width:'+pct.toFixed(2)+'%"></i></div></div>';
}
function overlayFor(sheetId){
 const sh=hudRecord(sheetId);
 if(!sh)return '<div class="ae-live-hud ae-live-hud-empty"><span>SEM FICHA VINCULADA</span></div>';
 const conds=Array.isArray(sh.conditions)?sh.conditions.slice(0,3):[];
 const color=String(sh.appearance?.accent||'');
 const safeColor=/^#[0-9a-fA-F]{6}$/.test(color)?' style="--ae-live-accent:'+color+'"':'';
 return '<div class="ae-live-hud"'+safeColor+'><div class="ae-live-hud-head"><b>'+esc(sh.name||'Personagem')+'</b>'+
   (conds.length?'<span>'+esc(conds.join(' · '))+'</span>':'')+'</div>'+
   '<div class="ae-live-meters">'+bar('VIDA','vida',sh.resources)+bar('ESTABILIDADE','estabilidade',sh.resources)+bar('ALMA','alma',sh.resources)+'</div></div>';
}
function avatarFor(sheetId,name){
 const sh=hudRecord(sheetId);
 const url=sh?.image&&api()?.mediaSrc?.(sh.image);
 return '<div class="ae-live-avatar">'+(url?'<img src="'+esc(url)+'" alt="" loading="lazy">':
  '<span>'+esc((name||'?').trim().slice(0,1).toUpperCase())+'</span>')+'</div>';
}
function getPresenceList(){
 const list=[localPresence(),...Array.from(state.presence.values()).filter(p=>p.peerId!==state.selfId)];
 return list.sort((a,b)=>(a.peerId===state.selfId?-1:b.peerId===state.selfId?1:0)||a.name.localeCompare(b.name,'pt-BR'));
}
function tileFor(p){
 const self=p.peerId===state.selfId,online=state.peers.get(p.peerId);
 const ready=self||online?.pc?.connectionState==='connected';
 const thumbId='ae-live-video-'+p.peerId;
 return '<article class="ae-live-tile'+(self?' is-local':'')+'" data-peer-id="'+esc(p.peerId)+'">'+
  '<div class="ae-live-tile-image">'+
   '<video id="'+esc(thumbId)+'" muted autoplay playsinline class="ae-live-camera-video"'+(p.camera?'':' hidden')+'></video>'+
   (!p.camera?avatarFor(p.sheetId,p.name):'')+
   (p.screen?'<span class="ae-live-sharing-badge">TELA ATIVA</span>':'')+
   (!self&&!ready?'<span class="ae-live-connect-badge">CONECTANDO</span>':'')+
   overlayFor(p.sheetId)+
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
  const p=el.dataset.peerId===state.selfId?localPresence():state.presence.get(el.dataset.peerId);
  if(!p)continue;
  const hud=el.querySelector('.ae-live-hud');
  if(hud)hud.outerHTML=overlayFor(p.sheetId);
 }
 const spot=document.querySelector('.ae-live-spotlight .ae-live-hud');
 if(spot&&state.spotlight){
  const p=state.spotlight.peerId===state.selfId?localPresence():state.presence.get(state.spotlight.peerId);
  if(p)spot.outerHTML=overlayFor(p.sheetId);
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
 for(const p of getPresenceList()){
  const video=document.getElementById('ae-live-video-'+p.peerId);
  const remote=state.peers.get(p.peerId);
  setVideo(video,p.peerId===state.selfId?state.camera:remote?.cameraStream,true);
  if(remote){
   const audio=document.getElementById('ae-live-audio-'+p.peerId);
   setVideo(audio,remote.audioStream,!state.sound);
  }
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
  panel.innerHTML=peers.map(tileFor).join('')+
   peers.filter(p=>p.peerId!==state.selfId).map(p=>'<audio id="ae-live-audio-'+esc(p.peerId)+'" autoplay playsinline></audio>').join('');
 }
 const head=document.querySelector('.ae-live-count');if(head)head.textContent=getPresenceList().length+' NA SALA';
 const spotlight=document.querySelector('.ae-live-spotlight');
 if(spotlight){
  const active=state.spotlight&&(state.spotlight.peerId===state.selfId||state.presence.has(state.spotlight.peerId));
  spotlight.hidden=!active;
  if(active){
   const p=state.spotlight.peerId===state.selfId?localPresence():state.presence.get(state.spotlight.peerId);
   spotlight.innerHTML='<div class="ae-live-spotlight-head"><strong>'+esc(p.name)+' · '+(state.spotlight.kind==='screen'?'TELA':'CÂMERA')+
    '</strong>'+button('FECHAR','unspotlight')+'</div><div class="ae-live-spotlight-view">'+
    '<video id="ae-live-spotlight-video" autoplay playsinline muted></video>'+overlayFor(p.sheetId)+'</div>';
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
 dock.innerHTML='<span class="ae-live-dock-dot"></span><strong>SESSÃO AO VIVO</strong><span>'+getPresenceList().length+' pessoas</span>'+
  button('ABRIR','open')+button('SAIR','leave','class="ae-live-dock-leave"');
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
   '<label class="ae-live-quality">QUALIDADE<select id="ae-live-quality">'+qualityOptions+'</select></label></div>'+
  '<div class="ae-live-message'+(state.error?' is-error':'')+'" role="status" aria-live="polite">'+esc(state.status||'Conectado à sessão privada.')+'</div>'+
  '<section class="ae-live-spotlight" hidden></section>'+
  '<div class="ae-live-gallery-head"><h2>PARTICIPANTES</h2><span>HUD SINCRONIZADO COM AS FICHAS</span></div>'+
  '<div class="ae-live-people" aria-label="Câmeras dos participantes"></div>'+
  '<details class="ae-live-technical"><summary>Sobre a transmissão</summary><p>Conexão direta e criptografada entre navegadores. Sem gravação automática. A qualidade depende da internet, dos dispositivos e da rede de cada jogador. Para estabilidade e alta definição garantidas com 6–8 câmeras, será necessário um servidor SFU/TURN dedicado.</p></details>'+
  '</section>';
 renderPeople();
}
function peerSet(){
 const entries=[];
 const channels=state.channel?.presenceState?.()||{};
 for(const value of Object.values(channels))for(const item of (Array.isArray(value)?value:[])){
  if(!item||typeof item.peerId!=='string'||!validId.test(item.peerId)||!validId.test(String(item.accountId||'')))continue;
  if(item.peerId===state.selfId)continue;
  entries.push({peerId:item.peerId,accountId:item.accountId,name:String(item.name||'Participante').slice(0,80),
   sheetId:typeof item.sheetId==='string'?item.sheetId:null,
   camera:item.camera===true,microphone:item.microphone===true,screen:item.screen===true,
   master:item.master===true});
 }
 // Uma instância por conta na sala; presença duplicada é tratada pelo peerId.
 const unique=new Map();for(const p of entries)unique.set(p.peerId,p);
 return unique;
}
function presenceSync(){
 if(!state.joined)return;
 const next=peerSet();state.presence=next;
 for(const [id,p] of next)if(!state.peers.has(id))makePeer(p);
 for(const id of Array.from(state.peers.keys()))if(!next.has(id))removePeer(id);
 if(state.spotlight&&!next.has(state.spotlight.peerId)&&state.spotlight.peerId!==state.selfId)state.spotlight=null;
 renderPeople();applyQualityAll();
}
function mediaStream(track){return track?new MediaStream([track]):null}
function bindRemoteTrack(peer,index,track){
 const key=index===0?'audioStream':index===1?'cameraStream':'screenStream';
 peer[key]=mediaStream(track);
 track.addEventListener('ended',()=>{if(peer[key]?.getTracks().includes(track)){peer[key]=null;renderPeople()}},{once:true});
 renderPeople();
}
function rtcConfig(){
 const external=global.ARQUIVO_LIVE_ICE;
 if(Array.isArray(external)&&external.length)return {iceServers:external,iceCandidatePoolSize:2};
 return {iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}],iceCandidatePoolSize:2};
}
function makePeer(meta){
 if(!state.joined||state.peers.has(meta.peerId)||typeof global.RTCPeerConnection!=='function')return;
 const pc=new RTCPeerConnection(rtcConfig());
 const peer={pc,id:meta.peerId,polite:state.selfId>meta.peerId,makingOffer:false,
  ignoreOffer:false,remoteAnswerPending:false,queue:[],
  senders:[],audioStream:null,cameraStream:null,screenStream:null};
 state.peers.set(meta.peerId,peer);
 const tracks=[['audio',state.microphone],['video',state.camera],['video',state.screen]];
 for(let index=0;index<tracks.length;index++){
  const [kind,stream]=tracks[index];
  const trans=pc.addTransceiver(kind,{direction:'sendrecv'});
  peer.senders[index]=trans.sender;
  const t=stream?.getTracks?.().find(track=>track.kind===kind)||null;
  if(t)trans.sender.replaceTrack(t).catch(()=>{});
 }
 pc.onicecandidate=({candidate})=>{if(candidate)sendSignal(peer.id,'candidate',candidate.toJSON()).catch(()=>{})};
 pc.ontrack=e=>{
  const idx=pc.getTransceivers().indexOf(e.transceiver);
  if(idx>=0&&idx<=2)bindRemoteTrack(peer,idx,e.track);
 };
 pc.onconnectionstatechange=()=>{
  if(pc.connectionState==='failed')try{pc.restartIce()}catch(e){}
  renderPeople();
 };
 pc.onnegotiationneeded=async()=>{
  try{
   peer.makingOffer=true;
   await pc.setLocalDescription();
   await sendSignal(peer.id,'description',pc.localDescription.toJSON());
  }catch(e){if(state.joined)status('Falha na negociação WebRTC: '+e.message,true)}
  finally{peer.makingOffer=false}
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
 if(!state.presence.has(payload.from))return;
 if(!['description','candidate'].includes(payload.type))return;
 if(!state.peers.has(payload.from))makePeer(state.presence.get(payload.from));
 const peer=state.peers.get(payload.from);if(!peer)return;
 const pc=peer.pc;
 try{
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
    await pc.setLocalDescription();
    await sendSignal(peer.id,'description',pc.localDescription.toJSON());
   }
  }else if(payload.type==='candidate'){
   const c=payload.data;
   if(!c||typeof c.candidate!=='string'||c.candidate.length>16000)return;
   if(!pc.remoteDescription){if(peer.queue.length<200)peer.queue.push(c);return}
   await pc.addIceCandidate(c);
  }
 }catch(e){if(!peer.ignoreOffer)status('Conexão com '+(state.presence.get(peer.id)?.name||'participante')+': '+e.message,true)}
}
function removePeer(id){
 const peer=state.peers.get(id);if(!peer)return;
 peer.pc.ontrack=null;peer.pc.onnegotiationneeded=null;peer.pc.onicecandidate=null;
 try{peer.pc.close()}catch(e){}
 state.peers.delete(id);
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
  if(!validId.test(state.selfId))throw Error('Identificação de conexão indisponível.');
  state.joined=true;state.quality='balanced';state.error='';
  const channel=st.client.channel('ae-video-'+self.session_id,{config:{
   private:true,broadcast:{self:false,ack:true},presence:{key:state.selfId}}});
  state.channel=channel;
  channel.on('presence',{event:'sync'},presenceSync);
  channel.on('broadcast',{event:'rtc-signal'},({payload})=>{signal(payload)});
  channel.on('broadcast',{event:'session-end'},()=>leave(false));
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
  await refreshHud();
  state.status='Conexão pronta. Ative câmera ou microfone quando quiser.';
  render();updateDock();
 }catch(e){
  await leave(false);
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
 }catch(e){if(state.joined)status('Conexão com o servidor: '+e.message,true)}
}
function stopStream(stream){
 if(!stream)return;
 for(const track of stream.getTracks())try{track.stop()}catch(e){}
}
async function replaceTracks(){
 await Promise.all(Array.from(state.peers.values()).map(p=>syncTracks(p).catch(()=>{})));
 await trackPresence().catch(()=>{});
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
 if(state.screen){const old=state.screen;state.screen=null;stopStream(old);await replaceTracks();return}
 if(!navigator.mediaDevices.getDisplayMedia)throw Error('Compartilhamento de tela indisponível neste navegador.');
 // Solicitar captura diretamente após o clique, para manter a ativação do usuário.
 const stream=await navigator.mediaDevices.getDisplayMedia({video:{
  width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:20,max:30}},audio:false});
 if(!state.joined){stopStream(stream);return}
 state.screen=stream;
 const track=stream.getVideoTracks()[0];
 if(track){track.contentHint='detail';track.addEventListener('ended',()=>{
  if(state.screen===stream){state.screen=null;replaceTracks().catch(()=>{})}
 },{once:true})}
 await replaceTracks();
}
async function leave(notify=true){
 clearTimers();
 for(const id of Array.from(state.peers.keys()))removePeer(id);
 const ch=state.channel;state.channel=null;
 if(ch){try{await ch.untrack()}catch(e){}try{await sync()?.state.client?.removeChannel(ch)}catch(e){}}
 const hadJoined=state.joined;
 state.joined=false;state.presence.clear();state.hud.clear();
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