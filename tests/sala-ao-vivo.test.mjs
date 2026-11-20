import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const MASTER='123e4567-e89b-42d3-a456-426614174000';
const ROOM='123e4567-e89b-42d3-a456-426614174001';
const PEER='123e4567-e89b-42d3-a456-426614174002';
const SHEET='test-sheet';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function harness(){
 const handlers={},rpcCalls=[],channels=[],captures={camera:0,mic:0,screen:0,stopped:0},nodes={};
 const root={innerHTML:'',hasChildNodes(){return this.innerHTML.length>0}};
 const message={textContent:'',classList:{toggle(){}}};
 const makeNode=(tag='div')=>({tagName:tag.toUpperCase(),id:'',dataset:{},innerHTML:'',hidden:false,
  children:[],appendChild(child){this.children.push(child);if(child.id)nodes[child.id]=child},
  querySelectorAll(){return []},remove(){delete nodes[this.id]},play(){return Promise.resolve()}});
 const document={
  querySelector(selector){if(selector==='.ae-live-root')return root;if(selector==='.ae-live-message')return message;return null},
  querySelectorAll(){return []},
  getElementById(id){return nodes[id]||null},
  createElement:makeNode,
  addEventListener(name,handler){handlers[name]=handler},
  body:{appendChild(child){if(child.id)nodes[child.id]=child}}
 };
 const session={id:ROOM,title:'Sessão de teste',status:'open'};
 const me={session_id:ROOM,account_id:MASTER,account_name:'Mestre de Teste',sheet_id:null,is_master:true};
 const rpc=async(name,args)=>{
  rpcCalls.push({name,args});
  if(name==='ae_live_state')return {session,participants:[me]};
  if(name==='ae_live_start')return session;
  if(name==='ae_live_join')return me;
  if(name==='ae_live_hud')return [];
  if(name==='ae_live_hud_choices')return [{id:SHEET,name:'Personagem de Teste',masterOnly:false}];
  if(name==='ae_live_set_hud')return {...me,hud_sheet_id:args.p_sheet_id,hud_hide_numbers:args.p_hide_numbers};
  if(name==='ae_live_heartbeat')return me;
  if(name==='ae_live_leave')return true;
  throw Error('Unexpected RPC: '+name);
 };
 const channel={
  listeners:[],trackCalls:[],private:null,
  on(kind,filter,handler){this.listeners.push({kind,filter,handler});return this},
  subscribe(fn){fn('SUBSCRIBED');return this},
  track(payload){this.trackCalls.push(payload);return Promise.resolve()},
  untrack(){return Promise.resolve()},
  presenceState(){return {}},
  send(payload){return Promise.resolve()}
 };
 const sync={state:{
  enabled:true,identity:{id:MASTER,accountName:'Mestre de Teste',kind:'master',sheetId:null},
  client:{rpc:async(name,args)=>({data:await rpc(name,args),error:null}),
   channel(name,options){channels.push({name,options});return channel},
   removeChannel(){return Promise.resolve()}}
 }};
 function media(kind){
  const track={kind,addEventListener(){},stop(){captures.stopped++},contentHint:''};
  return {getTracks(){return [track]},getVideoTracks(){return kind==='video'?[track]:[]},
   getAudioTracks(){return kind==='audio'?[track]:[]}};
 }
 const navigator={mediaDevices:{
  getUserMedia:async({video,audio})=>{if(video){captures.camera++;return media('video')}
   if(audio){captures.mic++;return media('audio')}throw Error('No source')},
  getDisplayMedia:async()=>{captures.screen++;return media('video')}
 }};
 const api={page:'live',db:{sheets:[{
  id:SHEET,name:'<script>Falha</script>',image:'',
  appearance:{accent:'#234abc'},conditions:['Confuso'],
  resources:{vida:{current:22,max:40},estabilidade:{current:10,max:20},alma:{current:5,max:10}}
 }]},mediaSrc:()=>'',setPage(){},
  toast(){},confirmSite(title,message,fn){fn()}};
 const listeners={};
 const win={ARQUIVO_INTERNAL:api,ARQUIVO_SYNC:sync,crypto:{randomUUID:()=>PEER},
  isSecureContext:true,RTCPeerConnection:function(){},addEventListener(name,fn){listeners[name]=fn}};
 const ctx={window:win,document,navigator,setInterval(){return 1},clearInterval(){},setTimeout,
  clearTimeout,queueMicrotask,MediaStream:class{},RTCPeerConnection:win.RTCPeerConnection};
 vm.runInNewContext(read('sala-ao-vivo.js'),ctx);
 async function click(action,other={}){
  const button={dataset:{liveAction:action,...other}};
  handlers.click({target:{closest(selector){return selector==='[data-live-action]'?button:null}},
   preventDefault(){},stopPropagation(){}});
  for(let i=0;i<6;i++)await flush();
 }
 return {win,handlers,rpcCalls,channels,captures,root,nodes,api,sync,click,channel};
}

test('a aba Sessão ao Vivo está ligada a menu e ao código de sessão isolado',()=>{
 const html=read('index.html'),app=read('arquivo-app.js'),src=read('sala-ao-vivo.js');
 assert.ok(html.includes('sala-ao-vivo.js?v=3'));
 assert.ok(html.includes('sala-ao-vivo.css?v=2'));
 assert.match(app,/\['live','Sessão ao vivo','video'\]/);
 assert.match(app,/ARQUIVO_LIVE\?\.pageChanged\(page\)/);
 assert.match(src,/private:true/);
 assert.match(src,/rtc-signal/);
 assert.match(src,/ae_live_join/);
 assert.match(src,/ae_live_heartbeat/);
 assert.match(src,/ae_live_hud/);
 assert.doesNotMatch(src,/ae_master_replace|ae_player_update|save\(\s*db/);
});

test('HUD obedece Vida, Estabilidade, ALMA e escapa caracteres perigosos',()=>{
 const x=harness(),s=x.win.ARQUIVO_LIVE;
 const overlay=s.overlayFor(SHEET);
 assert.match(overlay,/VIDA/);
 assert.match(overlay,/ESTABILIDADE/);
 assert.match(overlay,/ALMA/);
 assert.match(overlay,/22 \/ 40/);
 assert.match(overlay,/style="width:55\.00%"/);
 assert.match(overlay,/&lt;script&gt;Falha&lt;\/script&gt;/);
 assert.doesNotMatch(overlay,/<script>/);
 assert.match(overlay,/--ae-live-accent:#234abc/);
 assert.match(s.overlayFor('sheet-desconhecida'),/HUD INDISPONÍVEL/);
});

test('iniciar e entrar não captura câmera ou tela sem clique',async()=>{
 const x=harness();
 x.win.ARQUIVO_LIVE.pageChanged('live');
 await flush();
 await x.click('start');
 assert.equal(x.win.ARQUIVO_LIVE.state.joined,true);
 assert.equal(x.captures.camera,0);
 assert.equal(x.captures.screen,0);
 assert.equal(x.captures.mic,0);
 assert.equal(x.channels.length,1);
 assert.equal(x.channels[0].options.config.private,true);
 assert.equal(x.channels[0].name,'ae-video-'+ROOM);
 assert.ok(x.channel.trackCalls.length>=1);
 assert.ok(x.rpcCalls.some(r=>r.name==='ae_live_join'));
 assert.ok(x.rpcCalls.some(r=>r.name==='ae_live_hud'));
});

test('câmera, microfone e tela funcionam de maneira independente e podem ser parados',async()=>{
 const x=harness();
 x.win.ARQUIVO_LIVE.state.session={id:ROOM,title:'Sessão'};
 await x.click('join');
 await x.click('camera');
 assert.equal(x.captures.camera,1);
 assert.ok(x.win.ARQUIVO_LIVE.state.camera);
 assert.equal(x.win.ARQUIVO_LIVE.state.screen,null);
 assert.ok(x.rpcCalls.some(r=>r.name==='ae_live_heartbeat'&&r.args.p_camera===true));
 await x.click('microphone');
 assert.equal(x.captures.mic,1);
 assert.ok(x.win.ARQUIVO_LIVE.state.microphone);
 await x.click('screen');
 assert.equal(x.captures.screen,1);
 assert.ok(x.win.ARQUIVO_LIVE.state.screen);
 assert.ok(x.win.ARQUIVO_LIVE.state.spotlight?.kind==='screen');
 await x.click('screen');
 assert.equal(x.win.ARQUIVO_LIVE.state.screen,null);
 await x.click('leave');
 assert.equal(x.win.ARQUIVO_LIVE.state.joined,false);
 assert.equal(x.win.ARQUIVO_LIVE.state.microphone,null);
 assert.equal(x.win.ARQUIVO_LIVE.state.camera,null);
 assert.ok(x.captures.stopped>=3);
 assert.ok(x.rpcCalls.some(r=>r.name==='ae_live_leave'));
});

test('o vídeo permanece conectado quando o usuário navega para outra ficha',async()=>{
 const x=harness();x.win.ARQUIVO_LIVE.state.session={id:ROOM,title:'Sessão'};
 await x.click('join');
 await x.click('camera');
 x.api.page='sheets';
 x.win.ARQUIVO_LIVE.pageChanged('sheets');
 assert.equal(x.win.ARQUIVO_LIVE.state.joined,true);
 assert.ok(x.nodes['ae-live-dock']);
 assert.equal(x.nodes['ae-live-dock'].hidden,false);
 assert.equal(x.captures.stopped,0);
 assert.equal(x.win.ARQUIVO_LIVE.state.camera?.getVideoTracks().length,1);
});


test('mestre sem personagem vê identidade de MESTRE, não aviso de vínculo faltante',()=>{
 const x=harness(),v=x.win.ARQUIVO_LIVE;
 const result=v.overlayFor(null,{master:true,name:'Mestre de Teste'});
 assert.match(result,/MESTRE/);
 assert.doesNotMatch(result,/SEM FICHA VINCULADA/);
});

test('HUD de chefe recebe apenas percentuais e nunca revela Vida ou ALMA por atributos',()=>{
 const x=harness(),v=x.win.ARQUIVO_LIVE;
 v.state.hud.set(MASTER,{accountId:MASTER,id:SHEET,name:'Chefe de Teste',
  accent:'#d02244',conditions:[],
  resources:{vida:{percent:44.5},estabilidade:{percent:80},alma:{percent:10}}});
 const out=v.overlayFor(SHEET,{accountId:MASTER,hideNumbers:true,master:true});
 assert.match(out,/Chefe de Teste/);
 assert.match(out,/width:44\.50%/);
 assert.match(out,/width:80\.00%/);
 assert.match(out,/width:10\.00%/);
 assert.doesNotMatch(out,/NaN|undefined| \/ |de \d/);
 assert.equal((out.match(/ae-live-meter-track/g)||[]).length,3);
});

test('ficha de exibição do mestre não substitui a ficha vinculada',()=>{
 const x=harness(),v=x.win.ARQUIVO_LIVE;
 v.state.joined=true;v.state.selfId=PEER;v.state.accountId=MASTER;
 v.state.local={account_id:MASTER,account_name:'Mestre',sheet_id:null,
  hud_sheet_id:SHEET,hud_hide_numbers:true,is_master:true};
 v.state.participants=[v.state.local];
 const people=v.getPresenceList();
 assert.equal(people[0].sheetId,SHEET);
 assert.equal(people[0].hideNumbers,true);
 assert.equal(v.state.local.sheet_id,null);
 const sh=v.overlayFor(people[0].sheetId,people[0]);
 assert.match(sh,/MESTRE|HUD INDISPONÍVEL/);
});

test('controle geral de valores ocultos não impede as barras do HUD',async()=>{
 const x=harness(),v=x.win.ARQUIVO_LIVE;
 x.win.ARQUIVO_LIVE.state.session={id:ROOM,title:'Sessão'};
 await x.click('join');
 assert.equal(v.state.hideAllNumbers,false);
 await x.click('numbers');
 assert.equal(v.state.hideAllNumbers,true);
 const out=v.overlayFor(SHEET);
 assert.match(out,/ae-live-meter-track/);
 assert.doesNotMatch(out,/22 \/ 40/);
 await x.click('numbers');
 assert.equal(v.state.hideAllNumbers,false);
});
