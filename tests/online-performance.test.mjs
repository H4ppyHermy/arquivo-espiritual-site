import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../online.js',import.meta.url),'utf8');

function setup(){
 const events=[],window={ARQUIVO_ONLINE_CONFIG:{},dispatchEvent:e=>events.push(e.type)};
 class Event {constructor(type){this.type=type}}
 class CustomEvent {constructor(type,init){this.type=type;this.detail=init?.detail}}
 vm.runInNewContext(source,{window,Event,CustomEvent});
 const api=window.ARQUIVO_SYNC;
 api.state.enabled=true;
 return {api,events};
}

const sheet={
 id:'personagem',resources:{vida:{current:8},estabilidade:{current:5},alma:{current:3}},
 conditions:[],notes:'',inventory:{items:[],currencies:[]}
};

test('jogador grava somente seu estado sem percorrer ou clonar os livros e outras fichas',async()=>{
 const {api}=setup(),requests=[];
 api.state.client={rpc:async(fn,args)=>{
  requests.push({fn,args});return {data:17,error:null};
 }};
 const doc={
  sheets:[sheet,{get id(){throw Error('O clone acessou uma ficha não relacionada.')}}],
  get site(){throw Error('O clone acessou o catálogo global.')},
  get rules(){throw Error('O clone acessou o livro inteiro.')},
  get keys(){throw Error('O clone acessou as chaves.')},
 };
 await api.push(doc,'player',sheet.id);
 assert.equal(requests.length,1);
 assert.equal(requests[0].fn,'ae_player_update');
 assert.equal(requests[0].args.p_sheet_id,sheet.id);
 assert.deepEqual(JSON.parse(JSON.stringify(requests[0].args.p_state.resources)),
  {vida:{current:8},estabilidade:{current:5},alma:{current:3}});
 assert.equal(api.state.revision,17);
});

test('mestre mantém o contrato completo de publicação e retira chaves do documento',async()=>{
 const {api}=setup(),requests=[];
 api.state.client={rpc:async(fn,args)=>{requests.push({fn,args});return {data:19,error:null}}};
 const doc={site:{title:'Site'},rules:[],sheets:[sheet],
  keys:[{id:'j1',kind:'player',sheetId:sheet.id}],keysChanged:true};
 await api.push(doc,'master',sheet.id);
 assert.equal(requests.length,1);
 assert.equal(requests[0].fn,'ae_master_replace');
 assert.ok(!Object.hasOwn(requests[0].args.p_data,'keys'));
 assert.ok(!Object.hasOwn(requests[0].args.p_data,'keysChanged'));
 assert.equal(requests[0].args.p_assignments[0].sheetId,sheet.id);
});

test('leituras simultâneas, inclusive duas forçadas, usam uma RPC e um snapshot',async()=>{
 const {api,events}=setup();
 let requests=0,resolve;
 api.state.client={rpc:async()=>{
  requests++;
  return new Promise(done=>{resolve=()=>done({data:{
   data:{site:{title:'Site'},sheets:[],rules:[]},revision:4},error:null})});
 }};
 const first=api.refresh(true),second=api.refresh(true),third=api.refresh(false);
 await Promise.resolve();
 assert.equal(requests,1);
 resolve();
 await Promise.all([first,second,third]);
 assert.equal(requests,1);
 assert.equal(events.filter(x=>x==='arquivo-online-snapshot').length,1);
 assert.equal(api.state.revision,4);
});

test('uma falha libera a consulta em andamento para nova tentativa',async()=>{
 const {api}=setup();let attempts=0;
 api.state.client={rpc:async()=>{
  attempts++;
  if(attempts===1)return {data:null,error:{message:'Rede indisponível'}};
  return {data:{revision:3,data:{site:{},sheets:[],rules:[]}},error:null};
 }};
 await assert.rejects(api.refresh(true),/Rede indisponível/);
 await api.refresh(true);
 assert.equal(attempts,2);
});

test('a UI só reconstrói a ficha quando há alteração visível e agrega cache local',()=>{
 const app=fs.readFileSync(new URL('../arquivo-app.js',import.meta.url),'utf8');
 assert.match(app,/const sameVisibleSheet=/);
 assert.match(app,/if\(sameVisibleSheet\)\{onlineStatus\(\);return\}/);
 assert.match(app,/scheduleOnlineCache\(\)/);
 assert.match(app,/window\.addEventListener\('pagehide',flushOnlineCache\)/);
 assert.match(app,/db=\{\.\.\.snap,keys:window\.ARQUIVO_SYNC\.state\.keys\}/);
 assert.doesNotMatch(app,/db=\{\.\.\.clone\(snap\)/);
});
