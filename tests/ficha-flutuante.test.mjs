import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

function fixture(options={}){
 const listeners={},docEvents={},storage=new Map(),calls={joined:[],toggled:[],opened:[]};
 const sheet={
  id:'jogador',name:'Personagem do teste',masterOnly:false,locked:true,linkedKeyIds:['key-player'],
  conditions:['Confuso'],resources:{vida:{current:14,max:20},estabilidade:{current:9,max:12},alma:{current:7,max:10}},
  groups:{Corpo:6,Mente:6,Espírito:8},skills:{Precisão:8},combat:{scene:1,round:2,phase:'duelo',mainUsed:true,reactionUsed:false},
  abilities:[{name:'Golpe',cost:2,libraryType:'tecnica',description:'Causa +1d6 de dano.'}]
 };
 const boss={...sheet,id:'boss',name:'Boss secreto',masterOnly:true,linkedKeyIds:[]};
 const other={...sheet,id:'outro',name:'Outro jogador',linkedKeyIds:[]};
 const api={
  role:options.role||'player',sheetOnPage:null,db:{sheets:[sheet,boss,other]},
  isLinked:s=>s.linkedKeyIds?.includes('key-player'),
  dataUrlOk:()=>false,mediaSrc:x=>x,
  toast(){},render(){},modal(title,body){calls.modal={title,body}},
  closeModal(){calls.closed=true},viewSheet(id){calls.opened.push(id);this.sheetOnPage=id}
 };
 const host={id:'',className:'',hidden:false,innerHTML:'',contains:()=>false,querySelector:()=>null};
 const document={
  body:{appendChild(){}},activeElement:null,querySelector:()=>null,
  getElementById:id=>id==='aeQuickSheetRoot'&&host.id?id===host.id?host:null:null,
  createElement:()=>host,
  addEventListener(name,fn){(docEvents[name]??=[]).push(fn)}
 };
 const sync={
  state:{enabled:true,identity:{id:'key-player',kind:options.role||'player'}},
  async joinableSheets(){return [{id:'outro',name:'Outro jogador',level:2,open:true}]},
  async selfLinkSheet(id,action){
   if(action==='join'){calls.joined.push(id);return {ok:true,sheet:other,revision:3}}
   calls.toggled.push([id,action]);return {ok:true,sheet:{...sheet,selfLinkEnabled:action==='open'},revision:4};
  },
  async refresh(){
   if(calls.joined.length)other.linkedKeyIds=['key-player'];
  }
 };
 const window={
  ARQUIVO_INTERNAL:api,ARQUIVO_SYNC:sync,
  ARQUIVO_CBB_UI:{render:()=>'<div>COMBATE INTERATIVO</div>',renderSkillQuick:()=>'<div>ROLAGEM RÁPIDA</div>'},
  ARQUIVO_CBB_ENGINE:{groupOf:()=>'Corpo'},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  addEventListener(name,fn){(listeners[name]??=[]).push(fn)}
 };
 window.document=document;
 vm.runInNewContext(read('ficha-flutuante.js'),{window,document,console});
 return {api,sync,window,host,calls,docEvents,listener(name,index=0){return docEvents[name]?.[index]}};
}
function click(ctx,dataset){
 const e={target:{closest(selector){
  return selector.includes('data-quick-')?{dataset,setAttribute(){},removeAttribute(){},isConnected:false}:null
 }},preventDefault(){},stopPropagation(){}};
 ctx.listener('click')(e);
}
test('ficha flutuante oferece nome, Vida, ALMA e controle de turno em qualquer aba',()=>{
 const c=fixture();
 assert.equal(c.host.hidden,false);
 assert.match(c.host.innerHTML,/Personagem do teste/);
 assert.match(c.host.innerHTML,/7 ALMA/);
 assert.doesNotMatch(c.host.innerHTML,/Boss secreto/);
 click(c,{quickAction:'toggle'});
 assert.match(c.host.innerHTML,/VIDA/);
 assert.match(c.host.innerHTML,/14 \/ 20/);
 assert.match(c.host.innerHTML,/ESTADO DO TURNO/);
 assert.match(c.host.innerHTML,/USADA/);
 assert.match(c.host.innerHTML,/Confuso/);
 click(c,{quickTab:'mesa'});
 assert.match(c.host.innerHTML,/COMBATE INTERATIVO/);
 click(c,{quickTab:'skills'});
 assert.match(c.host.innerHTML,/ROLAGEM RÁPIDA/);
 click(c,{quickTab:'abilities'});
 assert.match(c.host.innerHTML,/Golpe/);
});
test('seleção de ficha chama apenas a RPC segura e não revela ficha de mestre',async()=>{
 const c=fixture();
 await c.window.ARQUIVO_QUICK_SHEET.openPicker();
 assert.match(c.calls.modal.body,/Outro jogador/);
 assert.doesNotMatch(c.calls.modal.body,/Boss secreto/);
 click(c,{quickJoin:'outro'});
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.deepEqual(c.calls.joined,['outro']);
 assert.equal(c.window.ARQUIVO_QUICK_SHEET.activeId,'outro');
 assert.equal(c.calls.closed,true);
});
test('nenhum jogador vê mini HUD sem estar conectado ou em ficha completa',()=>{
 const c=fixture();c.api.sheetOnPage='jogador';
 c.window.ARQUIVO_QUICK_SHEET.refresh(true);
 assert.equal(c.host.hidden,true);
 c.api.sheetOnPage=null;c.sync.state.identity=null;
 c.window.ARQUIVO_QUICK_SHEET.refresh(true);
 assert.equal(c.host.hidden,true);
});
test('mestre controla autovínculo por RPC sem dar permissão de mestre ao jogador',async()=>{
 const c=fixture({role:'master'});
 await c.window.ARQUIVO_QUICK_SHEET.toggleSelfLink('jogador');
 assert.deepEqual(c.calls.toggled,[['jogador','open']]);
 assert.equal(c.api.db.sheets[0].selfLinkEnabled,true);
 assert.equal(c.host.hidden,true);
});
test('scripts da Mesa e integração de vínculo estão ligados em todas as páginas',()=>{
 const app=read('arquivo-app.js'),online=read('online.js'),html=read('index.html');
 assert.match(app,/selfLinkPicker/);
 assert.match(app,/toggleSelfLink/);
 assert.match(app,/window\.ARQUIVO_QUICK_SHEET\?\.refresh\?\.\(\)/);
 assert.match(online,/ae_sheet_self_link/);
 assert.match(online,/ae_joinable_sheets/);
 assert.match(online,/ae_cbb_correct_turn/);
 assert.match(html,/ficha-flutuante\.js\?v=1/);
 assert.match(html,/ficha-flutuante\.css\?v=1/);
 assert.match(read('sql/ae_mesa_quick_hud_self_link.sql'),/ae_sheet_linked\(v_sheet,v_key\.id,v_key\.sheet_id\)/);
});
