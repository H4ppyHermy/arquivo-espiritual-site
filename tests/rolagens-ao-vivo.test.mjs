import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

function fixture(){
 const handlers=new Map(),docHandlers=new Map(),timers=new Map(),messages=[];
 let nextTimer=0,toast=null;
 class CustomEvent{
  constructor(type,options){this.type=type;this.detail=options?.detail}
 }
 const window={
  ARQUIVO_INTERNAL:{db:{sheets:[
   {id:'jogador',name:'Jogador',locked:true,masterOnly:false},
   {id:'chefe',name:'Chefe',locked:false,masterOnly:true}
  ]}},
  ARQUIVO_SYNC:{state:{enabled:true,identity:{id:'usuario',kind:'player'},rollRealtime:'connected'},
   rollLatest:async()=>[]},
  addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn)},
  dispatchEvent(event){if(event.type==='arquivo-roll-public')messages.push(event.detail);for(const fn of handlers.get(event.type)||[])fn(event)}
 };
 const document={
  hidden:false,
  body:{appendChild(el){toast=el}},
  getElementById(id){return toast?.id===id?toast:null},
  createElement(name){return {nodeName:name,hidden:true,innerHTML:'',className:'',
   classList:{add(){},remove(){}},setAttribute(){},offsetWidth:35}},
  addEventListener(name,fn){if(!docHandlers.has(name))docHandlers.set(name,[]);docHandlers.get(name).push(fn)}
 };
 window.document=document;
 const sandbox={window,document,CustomEvent,Date,
  setTimeout(fn,delay=0){const id=++nextTimer;timers.set(id,{fn,delay});return id},
  clearTimeout(id){timers.delete(id)},console:{warn(){}}
 };
 vm.runInNewContext(read('rolagens-ao-vivo.js'),sandbox);
 async function flush(delay){
  const entry=[...timers].find(([,x])=>x.delay===delay);
  assert.ok(entry,'temporizador '+delay+' esperado');
  timers.delete(entry[0]);entry[1].fn();
  for(let i=0;i<9;i++)await Promise.resolve();
 }
 function emit(roll,source='realtime'){window.dispatchEvent(new CustomEvent('arquivo-roll-registered',{detail:{roll,source}}))}
 return {window,document,emit,flush,messages,get toast(){return toast},timers};
}
const roll=(id,extra={})=>({id,account_name:'Jogador',sheet_id:'jogador',kind:'cbb',label:'Teste de Precisão',dice:[{sides:6,value:4},{sides:10,value:8}],total:12,special:'',hidden:false,created_at:'2026-11-22T12:00:00Z',...extra});

test('rolagens de jogadores aparecem na hora, sem duplicar eco do servidor',()=>{
 const ctx=fixture();
 ctx.window.dispatchEvent({type:'arquivo-online-ready'});
 ctx.emit(roll(10),'confirmed');
 assert.equal(ctx.messages.length,1);
 assert.match(ctx.toast.innerHTML,/Teste de Precisão/);
 assert.match(ctx.toast.innerHTML,/ROLAGEM REGISTRADA/);
 assert.match(ctx.toast.innerHTML,/>12</);
 ctx.emit(roll(10));
 assert.equal(ctx.messages.length,1,'realtime e confirmação local não podem duplicar');
 ctx.emit(roll(11,{kind:'discord',account_name:'Discord · Fulano',sheet_id:null,label:'2d6'}));
 assert.equal(ctx.messages.length,2);
 assert.match(ctx.toast.innerHTML,/DISCORD/);
});

test('fichas do mestre, rolagens ocultas e fichas desconhecidas não são divulgadas',()=>{
 const ctx=fixture();
 ctx.window.dispatchEvent({type:'arquivo-online-ready'});
 for(const privateRow of [
  roll(20,{sheet_id:'chefe'}),
  roll(21,{sheet_id:'nao-conhecida'}),
  roll(22,{hidden:true}),
  roll(23,{kind:'shield',sheet_id:null})
 ])ctx.emit(privateRow);
 assert.equal(ctx.messages.length,0);
 assert.equal(ctx.toast,null);
 ctx.emit(roll(24));
 assert.equal(ctx.messages.length,1);
 assert.doesNotMatch(ctx.toast.innerHTML,/chefe|nao-conhecida/i);
});

test('mensagens do Discord são escapadas antes de entrar no aviso',()=>{
 const ctx=fixture();
 ctx.window.dispatchEvent({type:'arquivo-online-ready'});
 ctx.emit(roll(30,{kind:'discord',sheet_id:null,account_name:'<img src=x onerror=alert(1)>',label:'<script>teste</script>'}));
 assert.equal(ctx.messages.length,1);
 assert.match(ctx.toast.innerHTML,/&lt;script&gt;/);
 assert.match(ctx.toast.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(ctx.toast.innerHTML,/<script>|<img src/);
});

test('primeira consulta mostra apenas última rolagem permitida e reconcilia eventos novos',async()=>{
 const ctx=fixture();
 let calls=0;
 ctx.window.ARQUIVO_SYNC.rollLatest=async()=>{
  calls++;
  if(calls===1)return [roll(5,{sheet_id:'chefe'}),roll(4,{kind:'discord',sheet_id:null}),roll(3)];
  return [roll(6,{kind:'discord',sheet_id:null,label:'2d8'})];
 };
 ctx.window.dispatchEvent({type:'arquivo-online-ready'});
 await ctx.flush(0);
 await ctx.flush(0);
 assert.equal(calls,1);
 assert.equal(ctx.window.ARQUIVO_ROLL_LIVE.lastId,5);
 assert.equal(ctx.messages.length,0,'histórico inicial não deve se passar por evento novo');
 assert.match(ctx.toast.innerHTML,/ÚLTIMA ROLAGEM/);
 assert.match(ctx.toast.innerHTML,/DISCORD/);
 await ctx.flush(24000);
 assert.equal(calls,2);
 assert.equal(ctx.messages.length,1);
 assert.match(ctx.toast.innerHTML,/2d8/);
 assert.equal(ctx.window.ARQUIVO_ROLL_LIVE.lastId,6);
});

test('mudança de identidade apaga o último resultado e cancela a consulta da chave anterior',()=>{
 const ctx=fixture();
 ctx.window.dispatchEvent({type:'arquivo-online-ready'});
 ctx.emit(roll(45));
 assert.equal(ctx.messages.length,1);
 ctx.window.ARQUIVO_SYNC.state.identity={id:'outro',kind:'player'};
 ctx.window.dispatchEvent({type:'arquivo-online-snapshot'});
 assert.equal(ctx.window.ARQUIVO_ROLL_LIVE.lastId,0);
 assert.equal(ctx.toast.hidden,true);
 ctx.emit(roll(46));
 assert.equal(ctx.messages.length,2);
});
test('o canal Supabase escuta só inserts não ocultos, com fallback separado do documento',()=>{
 const source=read('online.js');
 assert.match(source,/\bconnectRollChannel\(\)/);
 assert.match(source,/event:'INSERT',schema:'public',table:'ae_rolls',filter:'hidden=eq.false'/);
 assert.match(source,/arquivo-roll-registered/);
 assert.match(source,/async function rollLatest/);
 assert.match(source,/function withDiscordRoll\(promise\)\{/);
 assert.match(source,/localVerifiedRoll\(result\)/);
 assert.match(source,/notifyDiscordRoll\(result\)/);
});
test('a página instala o feed antes do app e tem foco reduzido no uso em sessão',()=>{
 const html=read('index.html');
 assert.match(html,/rolagens-ao-vivo\.js\?v=1/);
 assert.match(html,/rolagens-ao-vivo\.css\?v=1/);
 assert.ok(html.indexOf('rolagens-ao-vivo.js')<html.indexOf('arquivo-app.js'));
 assert.match(read('rolagens-ao-vivo.css'),/prefers-reduced-motion:reduce/);
});
