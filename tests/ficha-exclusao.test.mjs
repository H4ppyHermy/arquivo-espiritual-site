import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../arquivo-app.js',import.meta.url),'utf8');
const start=app.indexOf('// Exclusão protegida:');
const end=app.indexOf('async function saveSite()',start);
assert.ok(start>=0&&end>start,'Fluxo de exclusão deve estar presente');
const block=app.slice(start,end);

function setup({allowed=true,online=false}={}){
 const sheet={id:'ficha-starrk',name:'Coyote Starrk',abilities:[{name:'Cero'}]};
 const db={sheets:[sheet]};
 const state={enabled:online,pending:Promise.resolve(),lastPushError:null};
 const modals=[],toasts=[];
 const button={disabled:false};
 const input={value:''};
 const error={textContent:''};
 let saved=0,closed=0,rendered=0,editorDrawn=0;
 let authorized=allowed;
 const ctx={
  db,currentSheet:sheet.id,editorDraft:{...sheet,subtitle:'Modificação não salva'},
  modalDirty:false,window:{ARQUIVO_SYNC:{state}},
  requireMaster:()=>authorized,master:()=>authorized,
  el:id=>id==='dialogRoot'?{querySelector:selector=>
   selector==='[data-action="confirmSheetDeletion"]'?button:null
  }:id==='confirmSheetName'?input:id==='deleteSheetError'?error:null,
  esc:v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
  modal:(title,body,actions)=>{modals.push({title,body,actions})},
  closeModal:()=>{closed++},
  drawSheetForm:()=>{editorDrawn++},
  save:()=>{saved++;return true},
  render:()=>{rendered++},
  toast:(...args)=>toasts.push(args),
  DATASTORE:{save:()=>{}}
 };
 vm.createContext(ctx);
 vm.runInContext(block,ctx);
 return {ctx,sheet,db,modals,toasts,button,input,error,state,
  setAllowed:v=>{authorized=v},get saved(){return saved},get closed(){return closed},
  get rendered(){return rendered},get editorDrawn(){return editorDrawn}};
}
test('editor mostra EXCLUIR FICHA no topo somente ao Mestre para ficha existente',()=>{
 assert.match(app,/master\(\)&&s\.id&&db\.sheets\.some\(x=>x\.id===s\.id\)\?\{label:'EXCLUIR FICHA',action:'deleteSheet'\}:null/);
 assert.match(app,/case'deleteSheet':deleteSheet\(\)/);
 assert.match(app,/case'deleteSheetFinalStep':deleteSheetFinalStep\(\)/);
 assert.match(app,/case'confirmSheetDeletion':void confirmSheetDeletion\(\)/);
 assert.match(app,/event\.target|e\.target\.id==='confirmSheetName'/);
});
test('um clique no botão não apaga a ficha e a primeira confirmação também não',()=>{
 const x=setup();
 vm.runInContext('deleteSheet()',x.ctx);
 assert.equal(x.modals.at(-1).title,'EXCLUIR FICHA?');
 assert.match(x.modals.at(-1).body,/não pode ser desfeita/i);
 assert.equal(x.db.sheets.length,1);
 assert.equal(x.saved,0);
 vm.runInContext('deleteSheetFinalStep()',x.ctx);
 assert.equal(x.modals.at(-1).title,'CONFIRMAÇÃO FINAL');
 assert.equal(x.db.sheets.length,1);
 assert.equal(x.button.disabled,true);
});
test('só a digitação EXATA do nome após duas etapas permite excluir',async()=>{
 const x=setup();
 vm.runInContext('deleteSheet();deleteSheetFinalStep()',x.ctx);
 x.input.value='Starrk';
 await vm.runInContext('confirmSheetDeletion()',x.ctx);
 assert.equal(x.db.sheets.length,1);
 assert.match(x.error.textContent,/nome precisa ser idêntico/i);
 x.input.value='Coyote Starrk';
 await vm.runInContext('confirmSheetDeletion()',x.ctx);
 assert.equal(x.db.sheets.length,0);
 assert.equal(x.saved,1);
 assert.equal(x.closed,1);
 assert.equal(x.rendered,1);
 assert.equal(x.ctx.currentSheet,null);
});
test('cancelar na primeira ou segunda etapa preserva ficha e rascunho da edição',()=>{
 for(const finish of [false,true]){
  const x=setup();
  vm.runInContext('deleteSheet()',x.ctx);
  if(finish)vm.runInContext('deleteSheetFinalStep()',x.ctx);
  vm.runInContext('returnSheetEditor()',x.ctx);
  assert.equal(x.db.sheets.length,1);
  assert.equal(x.saved,0);
  assert.equal(x.editorDrawn,1);
  assert.equal(x.ctx.editorDraft.subtitle,'Modificação não salva');
  assert.equal(x.ctx.modalDirty,true);
 }
});
test('jogador sem permissão e ficha nova não podem acionar exclusão',()=>{
 const x=setup({allowed:false});
 vm.runInContext('deleteSheet()',x.ctx);
 assert.equal(x.modals.length,0);
 x.setAllowed(true);
 x.ctx.editorDraft.id='nova-ficha';
 vm.runInContext('deleteSheet()',x.ctx);
 assert.equal(x.modals.length,0);
 assert.equal(x.db.sheets.length,1);
});
test('falha de sincronização restaura a ficha e não anuncia exclusão',async()=>{
 const x=setup({online:true});
 x.state.lastPushError='Erro de servidor';
 vm.runInContext('deleteSheet();deleteSheetFinalStep()',x.ctx);
 x.input.value='Coyote Starrk';
 await vm.runInContext('confirmSheetDeletion()',x.ctx);
 assert.equal(x.db.sheets.length,1);
 assert.equal(x.ctx.currentSheet,'ficha-starrk');
 assert.equal(x.saved,1);
 assert.equal(x.toasts.at(-1)[0],'Exclusão não concluída');
 assert.equal(x.editorDrawn,1);
});
