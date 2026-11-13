(function setupAELive(){
 'use strict';
 const tileRenderCache=new Map();
 const htmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const value=(key,defaultVal)=>{try{const v=JSON.parse(localStorage.getItem('ae_live_'+key));return v===null?defaultVal:v}catch(e){return defaultVal}};
 const config={layout:value('layout','grid'),hud:value('hud','below'),density:value('density','normal'),lateralSide:value('lateralSide','right'),opacity:value('opacity',75),position:value('position','bottom'),scale:value('scale','medium'),quality:value('quality','standard'),mirror:value('mirror',true),camera:value('camera',''),notification:value('notification',false),alertSound:value('alertSound',true),receivePaused:value('receivePaused',false)};
 const live={session:null,participants:[],joined:false,room:null,noticeChannel:null,noticeId:null,sessionId:null,polling:false,peers:new Map(),remotes:new Map(),stream:null,preview:null,transmitting:false,selected:'',focused:'',drawer:true,history:[],rollSeen:null,rollBanner:null,serverSheets:[],lastBeat:0,channelReady:false,alertedId:null,closedMessage:'',lastCamera:false,lastResources:new Map(),resourceFx:new Map()};
 const host=()=>window.ARQUIVO_SYNC;
 const client=()=>host()?.state?.client;
 const identity=()=>host()?.state?.identity;
 const logged=()=>!!host()?.state?.enabled&&!!identity()?.id;
 const isMaster=()=>logged()&&identity().kind==='master';
 const me=()=>String(identity()?.id||'');
 const opts=(items,current)=>items.map(([v,t])=>'<option value="'+htmlEscape(v)+'"'+(v===current?' selected':'')+'>'+htmlEscape(t)+'</option>').join('');
 const pref=(key,v)=>{config[key]=v;try{localStorage.setItem('ae_live_'+key,JSON.stringify(v))}catch(e){}applyPresentation()};
 const rpc=async(fn,args={})=>{const c=client();if(!c)throw Error('Entre com sua chave para usar a sessão.');const {data,error}=await c.rpc(fn,args);if(error)throw Error(error.message);return data};
 const warn=(t,msg)=>{if(typeof window.toast==='function')window.toast(t,msg,true);else console.warn(t,msg)};
 const tell=(t,msg)=>{if(typeof window.toast==='function')window.toast(t,msg);else console.info(t,msg)};
 const formatDate=x=>x?new Date(x).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'';
 const duration=()=>{if(!live.session?.started_at)return '00:00';const sec=Math.max(0,Math.floor((Date.now()-new Date(live.session.started_at).getTime())/1000));return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(x=>String(x).padStart(2,'0')).slice(sec>=3600?0:1).join(':')};
 const myParticipant=()=>live.participants.find(p=>String(p.account_id)===me()&&!p.left_at&&!p.removed_at);
 const sheetFor=p=>live.serverSheets.find(s=>s.id===p?.sheet_id);
 const cameraCount=()=>live.participants.filter(p=>p.camera_on).length;
 const quality=()=>cameraCount()>5?'economy':config.quality;
 const videoProfile=()=>{
  const q=quality();
  return q==='high'?{width:1280,height:720,frameRate:24,bitrate:850000}:q==='economy'?{width:426,height:240,frameRate:15,bitrate:150000}:{width:640,height:360,frameRate:15,bitrate:300000};
 };
 const resource=(s,k)=>{const v=s?.resources?.[k]||{};return {cur:Number(v.current)||0,max:Number(v.max)||0}};
 const statusFor=s=>{if(!s)return '';if(resource(s,'vida').cur<=0||resource(s,'alma').cur<=0)return 'DESMAIADO';if(resource(s,'estabilidade').cur<=0)return 'ACORRENTADO';return ''};
 const getArt=s=>{const v=s?.image;if(typeof v!=='string')return '';if(/^https:\/\//i.test(v)||/^data:image\/(png|jpeg|webp|gif);base64,/i.test(v))return v;return window.mediaSrc?.(v)||''};
 function hud(p,mode){
  if(p.is_master)return '<div class="ae25-master-mark">MESTRE</div>';
  const s=sheetFor(p);if(!s)return '<div class="ae25-unbound">SEM FICHA VINCULADA</div>';
  const density=mode==='cinema'?'minimal':mode==='only'?'full':config.density;
  const compact=config.hud==='compact'&&mode!=='only';
  const bars=[['vida','VIDA','heart'],['estabilidade','ESTABILIDADE','brain'],['alma','ALMA','zap']].map(([k,n,ic])=>{
   const r=resource(s,k),pct=r.max>0?Math.max(0,Math.min(100,r.cur/r.max*100)):0;
   return compact?'<div class="ae25-circle" tabindex="0" aria-label="'+n+' '+r.cur+' de '+r.max+'" style="--pct:'+pct+'%;--tone:var(--'+k+'-color)"><b>'+n[0]+'</b><span>'+r.cur+'/'+r.max+'</span></div>':
    '<div class="ae25-resource"><div class="ae25-resource-label"><span>'+n+(r.max&&r.cur/r.max<.25?' · BAIXO':'')+'</span>'+(density!=='minimal'?'<strong>'+r.cur+' / '+r.max+'</strong>':'')+'</div><div class="ae25-track" role="progressbar" aria-label="'+n+'" aria-valuenow="'+r.cur+'" aria-valuemax="'+r.max+'"><i class="ae25-'+k+'" style="width:'+pct+'%"></i></div></div>';
  }).join('');
  const st=statusFor(s);
  const conditions=density==='full'?(s.conditions||[]).map(x=>'<span class="ae25-condition">'+htmlEscape(typeof x==='string'?x:x.name||x.label||'Condição')+'</span>').join(''):'';
  const last=density==='full'?live.history.find(x=>x.sheet_id===s.id):null;
  return '<div class="ae25-hud-inner">'+(compact?'<div class="ae25-circles">'+bars+'</div>':bars)+(st?'<strong class="ae25-zero">'+st+'</strong>':'')+conditions+(last?'<div class="ae25-last">ÚLTIMA ROLAGEM: '+Number(last.total)+'</div>':'')+'</div>';
 }
 function tile(p){
  const own=String(p.account_id)===me(),s=sheetFor(p),id=String(p.account_id),video=(own?live.transmitting:p.camera_on)&&config.hud!=='only'&&(own||!config.receivePaused);
  const art=getArt(s);
  const focused=live.focused===id?' focused':'';
  const mode=config.hud;
  const status=statusFor(s),r=live.remotes.get(id);
  const banner=live.rollBanner?.account_id===id&&Date.now()<live.rollBanner.until?live.rollBanner:null;const effect=live.resourceFx.get(id);
  return '<article class="ae25-tile ae25-hud-'+htmlEscape(mode)+(focused?' ae25-focused':'')+(status?' ae25-incapacitated':'')+(config.position==='top'?' ae25-pos-top':'')+(config.lateralSide==='left'?' ae25-side-left':'')+(effect&&effect.until>Date.now()?' ae25-impact-'+effect.type:'')+'" data-tile="'+htmlEscape(id)+'" style="--ae25-hud-opacity:'+(config.opacity/100)+';--ae25-scale:'+(config.scale==='large'?1.16:config.scale==='small'?.85:1)+'">'+
  '<div class="ae25-tile-media">'+(video?'<video data-peer-video="'+htmlEscape(id)+'" autoplay muted playsinline '+(own&&config.mirror?'class="ae25-mirror"':'')+'></video>':
   '<div class="ae25-character-card">'+(art?'<img src="'+htmlEscape(art)+'" alt="">':'<span>魂</span>')+'</div>')+
   (banner?'<div class="ae25-roll-banner '+(banner.special==='CRÍTICO'?'ae25-roll-critical':banner.special==='FALHA CRÍTICA'?'ae25-roll-failure':'')+'" role="status">'+htmlEscape(banner.text)+'</div>':'')+
   '<span class="ae25-avatar">'+(art?'<img src="'+htmlEscape(art)+'" alt="">':'魂')+'</span>'+
   (mode==='overlay'||mode==='cinema'||mode==='compact'||mode==='lateral'?'<div class="ae25-hud-overlay">'+hud(p,mode)+'</div>':'')+'</div>'+
   '<div class="ae25-person-head"><b>'+htmlEscape(p.account_name)+'</b><span>'+htmlEscape(p.is_master?'Mestre':p.character_name||'Sem personagem')+'</span><em>'+(p.camera_on?'● TRANSMITINDO':r?.connectionState==='connecting'?'RECONECTANDO':'SEM CÂMERA')+'</em></div>'+
   ((mode==='below'||mode==='only')?'<div class="ae25-hud-below">'+hud(p,mode)+'</div>':'')+
   '<div class="ae25-tile-tools"><button data-ae25="select" data-id="'+htmlEscape(id)+'" aria-label="Abrir ficha rápida">FICHA</button><button data-ae25="focus" data-id="'+htmlEscape(id)+'" aria-label="Fixar este bloco">FIXAR</button><button data-ae25="tileFull" data-id="'+htmlEscape(id)+'" aria-label="Tela cheia deste bloco">⛶</button></div></article>';
 }
 const button=(name,action,extra='')=>'<button type="button" class="btn '+extra+'" data-ae25="'+action+'">'+name+'</button>';
 function sessionPage(){
  if(!logged())return '<div class="panel"><h2>SESSÃO</h2><p>Entre com sua chave para acessar a sessão.</p></div>';
  const ses=live.session,join=live.joined&&live.sessionId===ses?.id;
  if(!ses)return '<div class="panel ae25-start"><h1>SESSÃO</h1><p>'+htmlEscape(live.closedMessage||'Nenhuma sessão em andamento.')+'</p>'+
   (isMaster()?'<div class="field"><label for="ae25Title">Título da sessão (opcional)</label><input id="ae25Title" maxlength="90" placeholder="Ex.: Arena de Karakura"></div>'+button('INICIAR SESSÃO','start','main'):'<p>Aguardando o mestre iniciar.</p>')+'</div>';
  const all=live.participants.length,scene=window.ARQUIVO_INTERNAL?.db?.site?.session?.scene;
  return '<div class="ae25-screen" id="ae25Room" data-session="'+htmlEscape(ses.id)+'"><header class="ae25-room-head"><div><span class="eyebrow">SESSÃO AO VIVO</span><h1>'+htmlEscape(ses.title)+'</h1><p>Iniciada por '+htmlEscape(ses.master_name)+' · <time id="ae25Timer">'+duration()+'</time> · '+all+' participante(s)</p></div>'+
    '<div class="ae25-head-actions"><span id="ae25Quality">ENVIO '+quality().toUpperCase()+'</span><span id="ae25Connection" role="status">CONEXÃO: '+(live.channelReady?'OK':'CONECTANDO')+'</span>'+button('⛶','fullscreen','small')+(join?button('SAIR DA SESSÃO','leave','danger'):'')+
    (isMaster()?button('ENCERRAR','end','danger'):'')+'</div></header>'+
    (!join?'<section class="panel"><p>Entrar não liga sua câmera. Você poderá assistir sem transmitir.</p>'+button('ENTRAR NA SESSÃO','join','main')+'</section>':
    '<div class="ae25-layout"><section class="ae25-stage ae25-layout-'+htmlEscape(config.layout)+'">'+
      (live.participants.length?live.participants.map(tile).join(''):'<p>Esperando participantes...</p>')+'</section>'+
      (live.drawer?'<aside class="ae25-drawer"><div class="sectionhead"><h2>PARTICIPANTES</h2>'+button('RECOLHER','drawer','small')+'</div><div class="ae25-people">'+live.participants.map(p=>
       '<div class="ae25-person"><button data-ae25="select" data-id="'+htmlEscape(p.account_id)+'">'+htmlEscape(p.account_name)+' · '+htmlEscape(p.character_name||'')+' '+(p.camera_on?'◉':'○')+'</button>'+
       (isMaster()&&!p.is_master?'<button data-ae25="kick" data-id="'+htmlEscape(p.account_id)+'" class="btn danger small">REMOVER</button>':'')+'</div>').join('')+'</div>'+
       '<div id="ae25Quick"></div><h3>ROLAGENS PÚBLICAS</h3><div id="ae25History">'+historyHtml()+'</div></aside>':
       '<div class="ae25-drawer-collapsed">'+button('PARTICIPANTES','drawer','small')+'</div>')+'</div>'+
    '<footer class="ae25-controls">'+button(live.transmitting?'DESLIGAR CÂMERA':'LIGAR CÂMERA','camera',live.transmitting?'danger':'main')+
    '<label>DISPOSITIVO<select id="ae25CameraSelect"><option value="">Câmera padrão</option></select></label>'+
    '<label>QUALIDADE<select data-ae25-pref="quality">'+opts([['economy','Economia 240p'],['standard','Padrão 360p'],['high','Alta 720p']],config.quality)+'</select></label>'+
    button(config.mirror?'ESPELHO: SIM':'ESPELHO: NÃO','mirror','small')+
    button(config.receivePaused?'RETOMAR VÍDEOS':'PAUSAR VÍDEOS','pauseReceive','small')+
    '<label>LAYOUT<select data-ae25-pref="layout">'+opts([['grid','Grade'],['focus','Foco'],['cinema','Cinema']],config.layout)+'</select></label>'+
    '<label>HUD<select data-ae25-pref="hud">'+opts([['overlay','Sobre a câmera'],['below','Embaixo'],['lateral','Lateral'],['cinema','Terço inferior'],['compact','Compacto'],['only','Só HUD']],config.hud)+'</select></label>'+
    button('⛶ TELA CHEIA','fullscreen','small')+'</footer>')+
    (scene?'<section class="ae25-scene"><img src="'+htmlEscape(scene)+'" alt="Imagem do cenário compartilhada"></section>':'')+
    (isMaster()?'<div class="ae25-master-panel"><h3>CONTROLES DO MESTRE</h3><p>O aviso só chega a quem está com o site aberto. Quem não estiver precisa ser chamado no Discord.</p>'+
     '<input id="sessionSceneInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>'+button('ENVIAR CENÁRIO','scene','small')+button('REMOVER CENÁRIO','removeScene','small')+'</div>':'')+
    '<p class="ae25-privacy">Vídeo entre participantes via WebRTC. Não solicitamos microfone. Nenhum vídeo é gravado nem passa por servidor próprio. Sem TURN, certas redes móveis podem impedir a conexão.</p></div>';
 }
 function historyHtml(){return live.history.slice(0,10).map(x=>{
  const p=live.participants.find(p=>p.account_id===x.account_id);
  const dice=Array.isArray(x.dice)?x.dice:[];
  return '<div class="ae25-history-item"><b>'+htmlEscape(x.account_name||p?.account_name||'')+'</b> · '+htmlEscape(x.label)+'<br>'+dice.map(d=>'d'+d.sides+' ('+d.value+')').join(' + ')+' = <strong>'+Number(x.total)+'</strong>'+(x.special?' · '+htmlEscape(x.special):'')+'</div>';
 }).join('')||'<p class="subtitle">Sem rolagens nesta sessão.</p>'}
 function quickSheet(){
  const selected=live.participants.find(p=>String(p.account_id)===live.selected)||live.participants[0],s=sheetFor(selected);
  const quick=document.getElementById('ae25Quick');if(!quick)return;
  const previousMarkup=quick.innerHTML;
  const newMarkup='<h3>FICHA RÁPIDA</h3>'+(selected?'<p><b>'+htmlEscape(selected.account_name)+'</b></p>':'')+
    (s?'<p>'+htmlEscape(s.name)+'</p>'+hud(selected,'only')+
    ((String(selected.account_id)===me()||isMaster())?button('ABRIR FICHA','openSheet','small'):'<p class="subtitle">Somente leitura</p>'):
    '<p class="subtitle">Sem ficha vinculada.</p>');
  if(newMarkup!==previousMarkup)quick.innerHTML=newMarkup;
 }
 function applyPresentation(){
  document.documentElement.style.setProperty('--ae25-opacity',config.opacity/100);
  if(window.ARQUIVO_INTERNAL?.page==='session')window.render();
  else updateBadges();
 }
 function updateBadges(){
  if(!logged()||isMaster()){document.getElementById('ae25TopBadge')?.remove();return}
  const toolbar=document.querySelector('.toolbar-right'),old=document.getElementById('ae25TopBadge');
  if(live.session&&toolbar&&!old){const node=document.createElement('button');node.id='ae25TopBadge';node.textContent='● Sessão em andamento · ENTRAR';node.className='ae25-top-badge';node.setAttribute('data-ae25','joinFromBadge');toolbar.prepend(node)}
  if(!live.session&&old)old.remove();
  const nav=[...document.querySelectorAll('[data-page]')].find(x=>x.dataset.page==='session');
  if(nav){nav.classList.toggle('ae25-nav-live',!!live.session);const tag=nav.querySelector('.ae25-live-mark');
   if(live.session&&!tag){const span=document.createElement('span');span.className='ae25-live-mark';span.textContent='● AO VIVO';nav.append(span)}
   else if(!live.session&&tag)tag.remove();}
 }
 function showInvite(){
  if(!logged()||isMaster()||!live.session||live.joined)return;
  const id=live.session.id;
  if(sessionStorage.getItem('ae-live-dismiss-'+id)==='1'||live.alertedId===id||document.getElementById('ae25Invite'))return;
  live.alertedId=id;
  const node=document.createElement('section');node.id='ae25Invite';node.className='ae25-invite';node.setAttribute('aria-live','polite');
  node.innerHTML='<b>● SESSÃO INICIADA</b><p>'+htmlEscape(live.session.title)+' · '+htmlEscape(live.session.master_name)+'</p>'+
   button('ENTRAR AGORA','joinNow','main')+button('AINDA NÃO','later','small');
  document.body.append(node);
  if(document.hidden){
   document.title='● SESSÃO ABERTA';
   if(config.alertSound&&!window.ARQUIVO_INTERNAL?.prefs?.effectsMuted&&typeof window.sound==='function')window.sound('click');
   if(config.notification&&window.Notification?.permission==='granted')try{new Notification('Sessão iniciada',{body:live.session.title})}catch(e){}
  }
 }
 function dismissInvite(silent=false){
  document.getElementById('ae25Invite')?.remove();
  if(live.session)sessionStorage.setItem('ae-live-dismiss-'+live.session.id,'1');
  document.title=originalTitle;
  if(!silent)updateBadges();
 }
 const originalTitle=document.title;
 function connectNotice(){
  if(!logged()||live.noticeChannel)return;
  const c=client();if(!c)return;
  const ch=c.channel('ae-live-notify',{config:{private:true}});
  live.noticeChannel=ch;
  ch.on('broadcast',{event:'session-start'},()=>{poll().catch(()=>{})})
    .on('broadcast',{event:'session-end'},()=>{poll().catch(()=>{})})
    .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Avisos Realtime indisponíveis; continuando por consulta periódica.')});
 }
 async function poll(){
  if(live.polling||!logged())return;
  connectNotice();
  live.polling=true;
  try{
   const data=await rpc('ae_live_state'),old=live.session?.id,previousParticipants=new Set(live.participants.map(p=>String(p.account_id)));
   const s=data?.session||null;
   live.session=s;live.participants=Array.isArray(data?.participants)?data.participants:[];
   if(old===s?.id&&live.joined){
    const nowPeople=new Set(live.participants.map(p=>String(p.account_id))),aria=document.getElementById('ae25Announce');
    const entered=live.participants.find(p=>!previousParticipants.has(String(p.account_id)));
    const left=[...previousParticipants].find(id=>!nowPeople.has(id));
    if(aria&&entered)aria.textContent=entered.account_name+' entrou na sessão.';
    else if(aria&&left)aria.textContent='Um participante saiu da sessão.';
   }
   if(old!==s?.id){live.alertedId=null;live.rollSeen=null;live.history=[];if(old)await cleanup('Sessão encerrada');}
   if(s&&live.joined&&live.sessionId===s.id&&!myParticipant()){await cleanup('Você saiu ou foi removido da sessão.');}
   if(s&&!isMaster())showInvite();
   if(!s)document.title=originalTitle;
   if(live.joined&&s?.id===live.sessionId){
    const now=Date.now();
    if(now-live.lastBeat>12000){live.lastBeat=now;try{await rpc('ae_live_heartbeat',{p_camera:live.transmitting})}catch(e){warn('Falha de presença',e.message);await cleanup('Conexão da sessão encerrada.');}}
    if(live.channelReady)syncPeers();
   }
   await updateServerData();
   if(window.ARQUIVO_INTERNAL?.page==='session'&&!document.activeElement?.matches('input,select,textarea')){
    const area=document.getElementById('ae25Room'),phase=area?.dataset?.session;
    if(!area||area.dataset.session!==s?.id){window.render();refreshTiles()}
    else{refreshTiles();const timer=document.getElementById('ae25Timer');if(timer)timer.textContent=duration();}
   }
   updateBadges();
  }catch(e){console.warn('Sessão: sincronização temporariamente indisponível',e)}
  finally{live.polling=false}
 }
 async function updateServerData(){
  const st=client();if(!st||!live.session)return;
  try{
   const [{data:doc,error:err},{data:rows,error:historyErr}]=await Promise.all([
    st.rpc('ae_live_hud'),
    st.from('ae_rolls').select('id,account_id,account_name,character_name,sheet_id,label,dice,total,special,created_at,hidden')
     .eq('hidden',false).gte('created_at',live.session.started_at).order('created_at',{ascending:false}).limit(10)
   ]);
   if(!err&&Array.isArray(doc)){
    for(const p of live.participants){
     const sheet=doc.find(s=>s.id===p.sheet_id);
     if(!sheet)continue;
     const previous=live.lastResources.get(sheet.id),now=sheet.resources;
     if(previous){
      const before=Number(previous?.vida?.current),after=Number(now?.vida?.current);
      if(Number.isFinite(before)&&Number.isFinite(after)&&before!==after){
       live.resourceFx.set(String(p.account_id),{type:after<before?'damage':'heal',until:Date.now()+1000});
      }
      for(const [key,stateText] of [['vida','DESMAIADO'],['estabilidade','ACORRENTADO'],['alma','DESMAIADO']]){
       if(Number(previous?.[key]?.current)>0&&Number(now?.[key]?.current)===0){
        const aria=document.getElementById('ae25Announce');
        if(aria)aria.textContent=(sheet.name||'Personagem')+' entrou no estado '+stateText;
       }
      }
     }
     live.lastResources.set(sheet.id,now);
    }
    live.serverSheets=doc;
   }
   if(!historyErr&&Array.isArray(rows)){
    const newest=rows[0];
    if(newest&&live.rollSeen!==null&&newest.id!==live.rollSeen){
     const line=newest.dice.map(d=>'d'+d.sides+' ('+d.value+')').join(' + ')+' = '+newest.total;
     live.rollBanner={account_id:newest.account_id,text:line+(newest.special?' · '+newest.special:''),special:newest.special,until:Date.now()+4000};
    }
    if(newest)live.rollSeen=newest.id;live.history=rows;
   }
  }catch(e){console.warn('Leitura de HUD indisponível',e)}
 }
 function refreshTiles(){
  if(window.ARQUIVO_INTERNAL?.page!=='session')return;
  const stage=document.querySelector('.ae25-stage');if(!stage)return;
  stage.className='ae25-stage ae25-layout-'+config.layout;
  // Preserva os elementos <video> quando os dados não mudam:
  // recriar vídeos a cada 2,6 s provoca congelamentos e reconexões visuais.
  const expected=new Set(live.participants.map(p=>String(p.account_id)));
  for(const node of [...stage.querySelectorAll(':scope > [data-tile]')]){
   if(!expected.has(node.dataset.tile))node.remove();
  }
  for(let i=0;i<live.participants.length;i++){
   const p=live.participants[i],id=String(p.account_id),markup=tile(p);
   let existing=[...stage.children].find(node=>node.dataset?.tile===id);
   if(!existing||tileRenderCache.get(id)!==markup){
    const holder=document.createElement('div');holder.innerHTML=markup;
    const next=holder.firstElementChild;
    if(!next)continue;
    if(existing)existing.replaceWith(next);else stage.appendChild(next);
    existing=next;tileRenderCache.set(id,markup);
   }
   if(stage.children[i]!==existing)stage.insertBefore(existing,stage.children[i]||null);
   const video=existing.querySelector('[data-peer-video]');
   if(video){
    const stream=id===me()?live.stream:live.remotes.get(id)?.stream;
    if(stream&&video.srcObject!==stream){
     video.srcObject=stream;video.muted=true;video.playsInline=true;
     video.play().catch(()=>{});
    }
   }
  }
  for(const key of tileRenderCache.keys())if(!expected.has(key))tileRenderCache.delete(key);
  // Histórico e ficha rápida não precisam ser recriados quando o conteúdo é idêntico.
  quickSheet();
  const history=document.getElementById('ae25History');
  if(history){const markup=historyHtml();if(history.innerHTML!==markup)history.innerHTML=markup}
  const connection=document.getElementById('ae25Connection');
  if(connection){
   const failing=[...live.peers.values()].some(p=>['disconnected','failed'].includes(p.pc.connectionState));
   const connecting=[...live.peers.values()].some(p=>['connecting','new'].includes(p.pc.connectionState));
   const status='CONEXÃO: '+(failing?'RECONECTANDO':connecting?'CONECTANDO':live.channelReady?'OK':'INDISPONÍVEL');
   if(connection.textContent!==status)connection.textContent=status;
  }
  if(config.hud==='compact')stage.querySelectorAll('.ae25-circle').forEach(x=>{if(!x.title)x.title=x.getAttribute('aria-label')});
 }
 async function enter(){
  if(!live.session)return warn('Sessão indisponível','O mestre ainda não iniciou.');
  try{
   const sheet=window.ARQUIVO_INTERNAL?.db?.sheets?.find(x=>!x.masterOnly&&window.canEditSheet?.(x.id))?.id||null;
   window.stopSessionCamera?.();await rpc('ae_live_join',{p_character_id:isMaster()?null:sheet});
   live.joined=true;live.sessionId=live.session.id;live.closedMessage='';dismissInvite(true);
   await pollForce();
   await connectChannel();
   window.setPage('session');
  }catch(e){warn('Não foi possível entrar',e.message)}
 }
 async function pollForce(){live.polling=false;const data=await rpc('ae_live_state');live.session=data.session;live.participants=data.participants||[];await updateServerData();}
 async function start(){
  if(!isMaster())return warn('Somente mestre','Apenas o mestre inicia sessões.');
  const title=document.getElementById('ae25Title')?.value||'Sessão';
  try{await rpc('ae_live_start',{p_title:title});await pollForce();tell('SESSÃO INICIADA','A sala está aberta.');await enter();}
  catch(e){warn('Não foi possível iniciar',e.message)}
 }
 async function finish(){
  if(!isMaster())return;
  window.confirmSite('ENCERRAR SESSÃO','Encerrar a sessão de todos os participantes?',async()=>{
   try{await rpc('ae_live_end');await cleanup('Sessão encerrada.');live.session=null;live.participants=[];dismissInvite(true);window.render();tell('SESSÃO ENCERRADA','Conexões e câmeras finalizadas.')}catch(e){warn('Falha ao encerrar',e.message)}
  });
 }
 async function kick(id){
  if(!isMaster()||!id)return;
  window.confirmSite('REMOVER PARTICIPANTE','Desconectar este participante?',async()=>{
   try{await rpc('ae_live_kick',{p_account_id:id});await pollForce();refreshTiles();}catch(e){warn('Remoção falhou',e.message)}
  });
 }
 async function leave(){
  try{if(live.joined)await rpc('ae_live_leave');}catch(e){}
  await cleanup('Você saiu da sessão.');
  window.render();
 }
 async function cleanup(message='Sessão encerrada'){
  if(live.preview){live.preview.getTracks().forEach(t=>t.stop());live.preview=null;}
  await stopCamera(false);
  window.stopSessionCamera?.();for(const peer of live.peers.values())try{peer.pc.close()}catch(e){}
  live.peers.clear();live.remotes.clear();tileRenderCache.clear();
  if(live.room){try{await client()?.removeChannel(live.room)}catch(e){}live.room=null}
  live.joined=false;live.sessionId=null;live.channelReady=false;live.closedMessage=message;live.lastBeat=0;
 }
 const send=(type,to,data={})=>live.room?.send({type:'broadcast',event:'signal',payload:{type,to,from:me(),...data}}).catch(()=>{});
 async function connectChannel(){
  if(!client()||!live.sessionId||live.room)return;
  const name='ae-video-'+live.sessionId;
  const channel=client().channel(name,{config:{private:true,presence:{key:me()},broadcast:{self:false}}});
  live.room=channel;
  channel.on('broadcast',{event:'signal'},({payload})=>handleSignal(payload))
   .on('presence',{event:'sync'},()=>syncPeers())
   .subscribe(async(status)=>{
    if(status==='SUBSCRIBED'){
     live.channelReady=true;
     try{await channel.track({id:me(),camera:false})}catch(e){}
     syncPeers();
    }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){live.channelReady=false;warn('Rede de vídeo','Não foi possível entrar no canal privado. Verifique o Realtime do Supabase.')}
   });
 }
 function syncPeers(){
  if(!live.joined||!live.channelReady)return;
  const people=new Set(live.participants.filter(p=>p.account_id!==me()).map(p=>String(p.account_id)));
  for(const id of live.peers.keys())if(!people.has(id))removePeer(id);
  for(const id of people)if(!live.peers.has(id))makePeer(id);
  if(cameraCount()>5&&live.stream)applyCameraQuality();
 }
 function removePeer(id){const peer=live.peers.get(id);if(peer){try{peer.pc.close()}catch(e){}live.peers.delete(id)}live.remotes.delete(id)}
 function makePeer(id){
  if(live.peers.has(id))return live.peers.get(id);
  const ice=window.ARQUIVO_ONLINE_CONFIG?.iceServers||[{urls:'stun:stun.l.google.com:19302'}];
  const pc=new RTCPeerConnection({iceServers:ice}),initiator=me()<id;
  const transceiver=pc.addTransceiver('video',{direction:config.receivePaused?'inactive':'recvonly'});
  const peer={pc,transceiver,initiator,stream:null,makingOffer:false};
  live.peers.set(id,peer);
  pc.ontrack=e=>{let stream=e.streams?.[0];if(!stream){stream=live.remotes.get(id)?.stream||new MediaStream();stream.addTrack(e.track)}live.remotes.set(id,{stream,connectionState:pc.connectionState});refreshTiles()};
  pc.onicecandidate=e=>{if(e.candidate)send('ice',id,{candidate:e.candidate.toJSON()})};
  pc.onconnectionstatechange=()=>{
   const remote=live.remotes.get(id)||{};remote.connectionState=pc.connectionState;live.remotes.set(id,remote);
   if(['disconnected','failed'].includes(pc.connectionState)){try{pc.restartIce()}catch(e){}if(initiator)negotiate(id)}
   refreshTiles();
  };
  pc.onnegotiationneeded=()=>{if(initiator)negotiate(id);else send('renegotiate',id)};
  if(live.stream){transceiver.sender.replaceTrack(live.stream.getVideoTracks()[0]).then(()=>{transceiver.direction=config.receivePaused?'sendonly':'sendrecv';capBitrate(peer)}).catch(()=>{})}
  return peer;
 }
 async function negotiate(id){
  const peer=live.peers.get(id);if(!peer||peer.makingOffer||peer.pc.signalingState!=='stable')return;
  try{peer.makingOffer=true;await peer.pc.setLocalDescription(await peer.pc.createOffer());send('description',id,{description:peer.pc.localDescription.toJSON()})}
  catch(e){console.warn('Oferta de vídeo falhou',e)}finally{peer.makingOffer=false}
 }
 async function handleSignal(payload){
  if(!live.joined||!live.channelReady||!payload||payload.to!==me()||!payload.from)return;
  const id=String(payload.from);
  if(id===me()||!live.participants.some(p=>String(p.account_id)===id))return;
  const peer=live.peers.get(id)||makePeer(id),pc=peer.pc;
  try{
   if(payload.type==='renegotiate'){if(peer.initiator)await negotiate(id);return}
   if(payload.type==='description'){
    const description=payload.description;
    if(!description||!['offer','answer'].includes(description.type))return;
    if(description.type==='offer'&&pc.signalingState!=='stable'){await pc.setLocalDescription({type:'rollback'})}
    await pc.setRemoteDescription(description);
    if(description.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());send('description',id,{description:pc.localDescription.toJSON()})}
   }else if(payload.type==='ice'&&payload.candidate){await pc.addIceCandidate(payload.candidate)}
  }catch(e){console.warn('Sinalização WebRTC falhou',e)}
 }
 function capBitrate(peer){
  const sender=peer.transceiver.sender,params=sender.getParameters();
  params.encodings=params.encodings?.length?params.encodings:[{}];
  params.encodings[0].maxBitrate=videoProfile().bitrate;
  sender.setParameters(params).catch(()=>{});
 }
 function setReceivePaused(paused){
  pref('receivePaused',paused);
  for(const [id,peer] of live.peers){
   try{peer.transceiver.direction=paused?(live.stream?'sendonly':'inactive'):(live.stream?'sendrecv':'recvonly');
   if(!peer.initiator)send('renegotiate',id)}catch(e){}
  }
  refreshTiles();
 }
 async function applyCameraQuality(){
  if(!live.stream)return;
  const p=videoProfile(),track=live.stream.getVideoTracks()[0];
  if(!track)return;
  try{await track.applyConstraints({width:{ideal:p.width},height:{ideal:p.height},frameRate:{ideal:p.frameRate,max:p.frameRate}})}catch(e){}
  for(const peer of live.peers.values())capBitrate(peer);
 }
 async function camera(){
  if(live.transmitting){await stopCamera();return}
  if(!live.joined)return;
  if(!navigator.mediaDevices?.getUserMedia)return warn('Câmera indisponível','Abra o site em HTTPS e permita a câmera.');
  try{
   const p=videoProfile(),device=config.camera;
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:p.width},height:{ideal:p.height},frameRate:{ideal:p.frameRate},...(device?{deviceId:{ideal:device}}:{})},audio:false});
   live.preview=stream;
   window.modal('PRÉVIA DA CÂMERA','<p>A câmera ainda NÃO está sendo transmitida. Confira a imagem e confirme para começar.</p>'+
     '<video id="ae25Preview" muted playsinline autoplay style="width:100%;max-height:310px;background:#000"></video>'+
     '<p class="subtitle">O áudio do microfone nunca será solicitado.</p>',
     [['LIGAR E TRANSMITIR','ae25Confirm','main'],['CANCELAR','ae25Cancel']]);
   const v=document.getElementById('ae25Preview');v.srcObject=stream;v.play().catch(()=>{});
   await listCameras();
  }catch(e){warn('Câmera não disponível',e.name==='NotAllowedError'?'Permissão negada. Habilite a câmera no navegador.':e.name==='NotReadableError'?'Câmera em uso por outro aplicativo.':e.message)}
 }
 async function confirmCamera(){
  if(!live.preview||!live.joined)return;
  try{
   await rpc('ae_live_heartbeat',{p_camera:true});
   live.stream=live.preview;live.preview=null;live.transmitting=true;
   const t=live.stream.getVideoTracks()[0];if(t)t.onended=()=>stopCamera();
   for(const [id,peer] of live.peers){await peer.transceiver.sender.replaceTrack(t);peer.transceiver.direction=config.receivePaused?'sendonly':'sendrecv';capBitrate(peer);if(!peer.initiator)send('renegotiate',id)}
   await applyCameraQuality();window.closeModal();tell('TRANSMITINDO','Câmera ligada, sem microfone.');
   refreshTiles();window.render();
  }catch(e){warn('Não foi possível transmitir',e.message);cancelPreview()}
 }
 function cancelPreview(){live.preview?.getTracks().forEach(t=>t.stop());live.preview=null;window.closeModal()}
 async function stopCamera(doHeartbeat=true){
  live.preview?.getTracks().forEach(t=>t.stop());live.preview=null;
  if(live.stream){for(const t of live.stream.getTracks())t.stop();live.stream=null}
  live.transmitting=false;
  for(const [id,peer] of live.peers){try{await peer.transceiver.sender.replaceTrack(null);peer.transceiver.direction=config.receivePaused?'inactive':'recvonly';if(!peer.initiator)send('renegotiate',id)}catch(e){}}
  if(doHeartbeat&&live.joined)rpc('ae_live_heartbeat',{p_camera:false}).catch(()=>{});
  refreshTiles();
 }
 async function listCameras(){
  try{const devices=await navigator.mediaDevices.enumerateDevices(),select=document.getElementById('ae25CameraSelect');if(!select)return;
   select.innerHTML='<option value="">Câmera padrão</option>'+devices.filter(d=>d.kind==='videoinput').map((d,i)=>
   '<option value="'+htmlEscape(d.deviceId)+'"'+(config.camera===d.deviceId?' selected':'')+'>'+htmlEscape(d.label||'Câmera '+(i+1))+'</option>').join('');
  }catch(e){}
 }
 function selectedSheet(){
  const p=live.participants.find(x=>String(x.account_id)===live.selected)||myParticipant();
  return sheetFor(p);
 }
 function settingsExtra(){
  return '<section class="panel ae25-prefs"><div class="sectionhead"><h2>SESSÃO</h2><button class="btn small" data-ae25="reset">RESTAURAR</button></div>'+
  '<div class="grid2">'+
  '<label>LAYOUT<select data-ae25-pref="layout">'+opts([['grid','Grade'],['focus','Foco'],['cinema','Cinema']],config.layout)+'</select></label>'+
  '<label>HUD<select data-ae25-pref="hud">'+opts([['overlay','Sobre a câmera'],['below','Embaixo'],['lateral','Lateral'],['cinema','Terço inferior'],['compact','Compacto'],['only','Só HUD']],config.hud)+'</select></label>'+
  '<label>DENSIDADE<select data-ae25-pref="density">'+opts([['minimal','Mínima'],['normal','Padrão'],['full','Completa']],config.density)+'</select></label>'+
  '<label>LADO (HUD LATERAL)<select data-ae25-pref="lateralSide">'+opts([['right','Direita'],['left','Esquerda']],config.lateralSide)+'</select></label>'+'<label>POSIÇÃO<select data-ae25-pref="position">'+opts([['top','Cima'],['bottom','Baixo']],config.position)+'</select></label>'+
  '<label>ESCALA<select data-ae25-pref="scale">'+opts([['small','Pequena'],['medium','Média'],['large','Grande']],config.scale)+'</select></label>'+
  '<label>QUALIDADE<select data-ae25-pref="quality">'+opts([['economy','Economia 240p'],['standard','Padrão 360p'],['high','Alta 720p']],config.quality)+'</select></label>'+
  '<label>OPACIDADE: '+config.opacity+'%<input type="range" data-ae25-pref="opacity" min="30" max="100" step="5" value="'+config.opacity+'"></label>'+
  '<label><input type="checkbox" data-ae25-pref="mirror" '+(config.mirror?'checked':'')+'> Espelhar minha câmera</label>'+
  '<label><input type="checkbox" data-ae25-pref="notification" '+(config.notification?'checked':'')+'> Avisos do navegador (opcional)</label>'+
  '<label><input type="checkbox" data-ae25-pref="alertSound" '+(config.alertSound?'checked':'')+'> Som de sessão iniciada</label></div></section>';
 }
 const originalSettings=window.settings,originalNav=window.navRender,originalSetPage=window.setPage;
 window.sessionPage=sessionPage;
 window.settings=function(){return originalSettings()+settingsExtra()};
 window.navRender=function(){originalNav();updateBadges();for(const node of document.querySelectorAll('[data-page="session"]')){node.hidden=!logged();node.style.display=logged()?'':'none'}};
 window.setPage=function(p){if(p==='session'&&!logged())return warn('Sessão restrita','Entre com sua chave para acessar.');originalSetPage(p);if(p==='session'){refreshTiles();listCameras()}};
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-ae25],button,a,select,input'))return;
  const tile=e.target.closest('[data-tile]');if(!tile)return;
  live.selected=tile.dataset.tile;quickSheet();
 },true);
 document.addEventListener('click',async e=>{
  const node=e.target.closest('[data-ae25]');if(!node)return;
  e.preventDefault();e.stopImmediatePropagation();
  const action=node.dataset.ae25,id=node.dataset.id;
  if(action==='start')await start();else if(action==='join'||action==='joinNow'||action==='joinFromBadge'){dismissInvite(true);if(live.joined)window.setPage('session');else await enter();}
  else if(action==='later'){dismissInvite();}
  else if(action==='end')finish();else if(action==='leave')leave();else if(action==='kick')kick(id);
  else if(action==='camera')camera();else if(action==='mirror')pref('mirror',!config.mirror);
  else if(action==='pauseReceive'){setReceivePaused(!config.receivePaused)}
  else if(action==='scene')document.getElementById('sessionSceneInput')?.click();
  else if(action==='removeScene')window.removeSessionScene?.();
  else if(action==='drawer'){live.drawer=!live.drawer;window.render();refreshTiles()}
  else if(action==='select'){live.selected=id;quickSheet()}
  else if(action==='focus'){live.focused=id;pref('layout','focus')}
  else if(action==='fullscreen'){document.getElementById('ae25Room')?.requestFullscreen?.().catch(()=>{})}
  else if(action==='tileFull'){document.querySelector('[data-tile="'+id+'"]')?.requestFullscreen?.().catch(()=>{})}
  else if(action==='openSheet'){const s=selectedSheet();if(s&&(String(live.selected)===me()||isMaster()))window.viewSheet(s.id)}
  else if(action==='reset'){for(const key of Object.keys(config))try{localStorage.removeItem('ae_live_'+key)}catch(e){}Object.assign(config,{layout:'grid',hud:'below',density:'normal',opacity:75,lateralSide:'right',position:'bottom',scale:'medium',quality:'standard',mirror:true,camera:'',notification:false,alertSound:true,receivePaused:false});applyPresentation()}
  else if(action==='notify'){if('Notification'in window){const permission=await Notification.requestPermission();pref('notification',permission==='granted')}}
 },true);
 document.addEventListener('change',async e=>{
  const node=e.target;if(node.id==='ae25CameraSelect'){pref('camera',node.value);if(live.transmitting){await stopCamera();tell('Câmera alterada','Ative a câmera novamente para escolher o novo dispositivo.')}return}
  const key=node.dataset.ae25Pref;if(!key)return;
  const val=node.type==='checkbox'?node.checked:node.type==='range'?Number(node.value):node.value;
  if(key==='notification'&&val&&'Notification'in window){
   try{pref(key,(await Notification.requestPermission())==='granted')}catch(e){pref(key,false)}
  }else pref(key,val);
  if(key==='quality')await applyCameraQuality();
 },true);
 // Existing modal buttons are handled by the generic router; intercept only new camera actions.
 document.addEventListener('click',e=>{
  const a=e.target.closest('[data-action]')?.dataset.action;
  if(a==='ae25Confirm'){e.preventDefault();e.stopImmediatePropagation();confirmCamera()}
  if(a==='ae25Cancel'){e.preventDefault();e.stopImmediatePropagation();cancelPreview()}
  if(a==='closeModal'&&live.preview){live.preview.getTracks().forEach(t=>t.stop());live.preview=null}
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&live.preview){live.preview.getTracks().forEach(t=>t.stop());live.preview=null}},{capture:true});
 window.addEventListener('pagehide',()=>{live.stream?.getTracks().forEach(t=>t.stop());live.preview?.getTracks().forEach(t=>t.stop());for(const p of live.peers.values())p.pc.close()});
 window.addEventListener('arquivo-logged-out',()=>{if(live.noticeChannel){client()?.removeChannel(live.noticeChannel).catch(()=>{});live.noticeChannel=null}cleanup();live.session=null;live.participants=[];document.getElementById('ae25Invite')?.remove();updateBadges()});
 setInterval(()=>{poll();if(window.ARQUIVO_INTERNAL?.page==='session'){const timer=document.getElementById('ae25Timer');if(timer)timer.textContent=duration();if(live.rollBanner&&Date.now()>live.rollBanner.until){live.rollBanner=null;refreshTiles()}}},2600);
 setTimeout(poll,500);
 if(!document.getElementById('ae25Announce')){const liveNode=document.createElement('div');liveNode.id='ae25Announce';liveNode.setAttribute('role','status');liveNode.setAttribute('aria-live','polite');liveNode.className='ae25-sr-only';document.body.append(liveNode)}
 window.ARQUIVO_LIVE={state:live,poll,leave,camera,stopCamera,config};
})();
