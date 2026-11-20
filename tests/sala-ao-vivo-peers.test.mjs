import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../sala-ao-vivo.js',import.meta.url),'utf8');
const ROOM='65e14c9a-d03f-421d-af34-6af4d2381263';
const ALICE='441dd11d-11d1-4c10-91a1-111111111111';
const BOB='552ee22e-22e2-4c20-92b2-222222222222';
const ALICE_PEER='11111111-1111-4111-8111-111111111111';
const BOB_PEER='22222222-2222-4222-8222-222222222222';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function createHub(){
 const connections=[],participants=new Map(),events=[];
 const session={id:ROOM,title:'Mesa de teste com dois participantes',status:'open'};
 const handlers=new Map();
 function updatePresence(){
  for(const channel of connections.filter(ch=>ch.subscribed)){
   for(const listener of channel.handlers.filter(x=>x.kind==='presence'&&x.filter.event==='sync')){
    queueMicrotask(()=>listener.fn());
   }
  }
 }
 function channel(tab,name,options){
  const ch={tab,name,options,subscribed:false,presence:null,handlers:[],
   on(kind,filter,fn){this.handlers.push({kind,filter,fn});return this},
   subscribe(fn){this.subscribed=true;queueMicrotask(()=>fn('SUBSCRIBED'));return this},
   presenceState(){
    return Object.fromEntries(connections.filter(x=>x.name===name&&x.subscribed&&x.presence)
      .map(x=>[x.presence.peerId,[x.presence]]));
   },
   async track(data){this.presence=data;updatePresence();return 'ok'},
   async send({type,event,payload}){
    assert.equal(type,'broadcast');
    events.push({from:tab.account,event,payload});
    for(const recipient of connections.filter(x=>x!==this&&x.name===name&&x.subscribed)){
     for(const listener of recipient.handlers.filter(x=>x.kind==='broadcast'&&x.filter.event===event)){
      queueMicrotask(()=>listener.fn({payload}));
     }
    }
    return 'ok';
   },
   async untrack(){this.presence=null;updatePresence();return 'ok'}
  };
  connections.push(ch);return ch;
 }
 function createTab(account,peerId,master){
  const listeners=new Map(),nodes=new Map();
  const root={innerHTML:'',hasChildNodes(){return !!this.innerHTML}};
  const makeElement=(tag='div')=>({tagName:tag.toUpperCase(),id:'',dataset:{},innerHTML:'',
   children:[],appendChild(x){this.children.push(x);if(x.id)nodes.set(x.id,x)},
   querySelectorAll(){return []},remove(){nodes.delete(this.id)},play(){return Promise.resolve()}});
  const doc={
   querySelector(selector){if(selector==='.ae-live-root')return root;return null},
   querySelectorAll(){return []},
   getElementById(id){return nodes.get(id)||null},
   createElement:makeElement,
   body:{appendChild(el){nodes.set(el.id,el)}},
   addEventListener(name,fn){listeners.set(name,fn)}
  };
  const name=master?'Mestre Alice':'Jogador Bob';
  const myRecord=()=>({
   session_id:ROOM,account_id:account,user_id:account,account_name:name,
   is_master:master,sheet_id:master?null:'ficha-bob',hud_sheet_id:null,
   hud_hide_numbers:false,joined_at:new Date().toISOString(),left_at:null,removed_at:null
  });
  const rpc=async(name,args={})=>{
   if(name==='ae_live_state')return {session,participants:[...participants.values()]};
   if(name==='ae_live_join'){
    const row=myRecord();participants.set(account,row);return row;
   }
   if(name==='ae_live_heartbeat')return participants.get(account);
   if(name==='ae_live_hud')return [];
   if(name==='ae_live_hud_choices')return [];
   if(name==='ae_live_leave'){participants.delete(account);return true}
   throw new Error('RPC não simulada: '+name);
  };
  let cameraTrack=null;
  function track(kind){
   const t={kind,id:account+kind,contentHint:'',handlers:{},
    addEventListener(type,fn){this.handlers[type]=fn},stop(){this.stopped=true}};
   if(kind==='video')cameraTrack=t;return t;
  }
  const nav={mediaDevices:{
   getUserMedia:async({video,audio})=>{
    const t=track(video?'video':'audio');
    return {getTracks(){return [t]},getVideoTracks(){return video?[t]:[]},getAudioTracks(){return audio?[t]:[]}};
   },
   getDisplayMedia:async()=>{
    const t=track('video');
    return {getTracks(){return [t]},getVideoTracks(){return [t]},getAudioTracks(){return []}};
   }
  }};
  class MockStream{
   constructor(tracks){this._tracks=tracks}
   getTracks(){return this._tracks}
  }
  class MockRTC{
   constructor(){
    this.signalingState='stable';this.connectionState='new';this.localDescription=null;
    this.remoteDescription=null;this.transceivers=[];this.iceConnectionState='new';
   }
   addTransceiver(kind){
    const transceiver={
     kind,sender:{
      track:null,async replaceTrack(track){this.track=track},
      getParameters(){return {encodings:[{}]}},async setParameters(){}
     }
    };
    this.transceivers.push(transceiver);
    queueMicrotask(()=>this.onnegotiationneeded?.());
    return transceiver;
   }
   getTransceivers(){return this.transceivers}
   async setLocalDescription(desc){
    if(desc?.type==='rollback'){this.signalingState='stable';return}
    const type=this.signalingState==='have-remote-offer'?'answer':'offer';
    this.localDescription={type,sdp:'v=0\r\ns=MockRTC-'+account+'\r\n'};
    this.signalingState=type==='offer'?'have-local-offer':'stable';
    if(type==='answer'){this.connectionState='connected';this.onconnectionstatechange?.()}
   }
   async setRemoteDescription(desc){
    this.remoteDescription=desc;
    this.signalingState=desc.type==='offer'?'have-remote-offer':'stable';
    if(desc.type==='answer'){this.connectionState='connected';this.onconnectionstatechange?.()}
   }
   async addIceCandidate(){}
   restartIce(){}
   close(){this.connectionState='closed'}
  }
  const api={page:'live',db:{sheets:[]},setPage(){},toast(){},
   confirmSite(t,m,fn){fn()},mediaSrc(){return ''}};
  const sync={state:{
   enabled:true,identity:{id:account,kind:master?'master':'player',accountName:name,
    sheetId:master?null:'ficha-bob'},
   client:{
    rpc:async(name,args)=>({data:await rpc(name,args),error:null}),
    channel:(name,options)=>channel({account},name,options),
    removeChannel:async()=>{}
   }
  }};
  const window={ARQUIVO_INTERNAL:api,ARQUIVO_SYNC:sync,isSecureContext:true,
   crypto:{randomUUID:()=>peerId},RTCPeerConnection:MockRTC,
   addEventListener(){}};
  const context={window,document:doc,navigator:nav,RTCPeerConnection:MockRTC,
   MediaStream:MockStream,setTimeout,clearTimeout,
   setInterval(){return 1},clearInterval(){},queueMicrotask};
  vm.runInNewContext(source,context,{filename:'sala-ao-vivo.js'});
  async function click(action){
   const node={dataset:{liveAction:action}};
   listeners.get('click')({target:{closest(selector){return selector==='[data-live-action]'?node:null}},
    preventDefault(){},stopPropagation(){}});
   for(let i=0;i<12;i++)await flush();
  }
  return {account,peerId,master,window,click,get cameraTrack(){return cameraTrack}};
 }
 return {events,createTab,connections};
}

test('dois navegadores descobrem seus peers, trocam offer/answer e enxergam a câmera remota',async()=>{
 const hub=createHub();
 const a=hub.createTab(ALICE,ALICE_PEER,true),b=hub.createTab(BOB,BOB_PEER,false);
 a.window.ARQUIVO_LIVE.state.session={id:ROOM,title:'Sessão'};
 b.window.ARQUIVO_LIVE.state.session={id:ROOM,title:'Sessão'};
 await a.click('join');await b.click('join');
 for(let i=0;i<40;i++)await flush();
 const ap=a.window.ARQUIVO_LIVE.state.peers.get(BOB_PEER);
 const bp=b.window.ARQUIVO_LIVE.state.peers.get(ALICE_PEER);
 assert.ok(ap,'mestre identifica jogador remoto');
 assert.ok(bp,'jogador identifica mestre remoto');
 assert.equal(a.window.ARQUIVO_LIVE.getPresenceList().length,2);
 assert.equal(b.window.ARQUIVO_LIVE.getPresenceList().length,2);
 assert.ok(hub.events.some(x=>x.event==='peer-hello'),'handshake presente');
 assert.ok(hub.events.some(x=>x.event==='rtc-signal'&&x.payload.type==='description'&&x.payload.data.type==='offer'),
  'oferta SDR transmitida');
 assert.ok(hub.events.some(x=>x.event==='rtc-signal'&&x.payload.type==='description'&&x.payload.data.type==='answer'),
  'resposta SDR transmitida');
 assert.equal(ap.pc.connectionState,'connected');
 assert.equal(bp.pc.connectionState,'connected');
 await a.click('camera');
 for(let i=0;i<14;i++)await flush();
 const remoteMeta=b.window.ARQUIVO_LIVE.getPresenceList().find(x=>x.peerId===ALICE_PEER);
 assert.equal(remoteMeta?.camera,true,'câmera do mestre visível ao segundo navegador');
 const track=a.cameraTrack;
 assert.ok(track,'câmera local capturada');
 bp.pc.ontrack({track,transceiver:bp.pc.getTransceivers()[1]});
 assert.equal(bp.cameraStream.getTracks()[0].id,track.id,'slot de vídeo remoto recebe fluxo');
});
