import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fixture(){
 const sheet={id:'ficha-combos',name:'Teste',abilities:[
  {name:'Golpe',abilityId:'id-golpe',libraryType:'tecnica',cost:3},
  {name:'Liberação',abilityId:'id-lib',libraryType:'habilidade',cost:4,costConfig:{mode:'activation'}},
  {name:'Defesa',libraryType:'habilidade',cost:1},
  {name:'Passiva',libraryType:'habilidade',cost:0,passive:true}
 ],resources:{alma:{current:10,max:10}},combos:[{id:'combo-one',name:'Abertura',description:'Sequência padrão',steps:[
  {abilityId:'id-golpe',name:'Golpe',kind:'tecnica',index:0,note:'Dano primeiro'},
  {abilityId:'id-lib',name:'Liberação',kind:'habilidade',index:1,note:''}
 ]}]};
 const handlers={click:[]},events={},elements={},store=new Map();
 const state={modal:'',rendered:0,saved:0,notice:[],rpc:[]};
 const document={
  addEventListener(name,fn){(handlers[name]??=[]).push(fn)},
  getElementById(id){return elements[id]||null},
  querySelector(){return null},
  querySelectorAll(){return []}
 };
 const api={
  db:{sheets:[sheet]},currentSheet:sheet.id,page:'sheets',role:'player',
  canEditSheet:id=>id===sheet.id,esc:escape,uid:()=> 'arquivo-newcombo',
  modal(_title,body){state.modal=body},closeModal(){},render(){state.rendered++},
  toast(...args){state.notice.push(args)},cacheOnly(){state.saved++},save(){state.saved++},
  confirmSite(_a,_b,callback){callback()},btn:(label,action)=>'<button data-action="'+action+'">'+label+'</button>'
 };
 const window={ARQUIVO_INTERNAL:api,ARQUIVO_CBB_ENGINE:{abilityPhase:()=> 'Duelo'},
  ARQUIVO_CBB_UI:{abilityActions:(ab,index)=>'<button data-cbb-command="ability" data-cbb-index="'+index+'">USAR</button>'},
  document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  ARQUIVO_SYNC:{state:{enabled:true},async saveCombos(id,combos){state.rpc.push({id,combos});return {combos,revision:2}}},
  addEventListener:(name,fn)=>{events[name]=fn},
 };
 vm.runInNewContext(read('ficha-combos.js'),{window,document,Promise,console});
 function click(action){
  const button={dataset:{comboAction:action},disabled:false};
  const event={target:{closest:selector=>selector==='[data-combo-action]'?button:null},preventDefault(){}};
  for(const fn of handlers.click)fn(event);
 }
 return {sheet,api,window,document,elements,state,click,combo:window.ARQUIVO_COMBOS};
}
test('a seção aparece abaixo das notas e antes do histórico no Resumo',()=>{
 const visual=read('ficha-visual.js');
 const atNotes=visual.indexOf('quickAccess(s,ctx)+snapshot(s)');
 const atCombo=visual.indexOf("window.ARQUIVO_COMBOS?.render?.(s,ctx)");
 const atHistory=visual.indexOf("ctx.history?'<section");
 assert.ok(atNotes>0 && atCombo>atNotes && atHistory>atCombo);
 assert.match(read('index.html'),/ficha-combos\.js\?v=2/);
 assert.match(read('index.html'),/ficha-combos\.css\?v=1/);
});
test('os custos do combo são derivados das habilidades atuais e avisam de pré-requisitos',()=>{
 const f=fixture(),c=f.sheet.combos[0];
 const stats=f.combo.totals(f.sheet,c);
 assert.equal(stats.cost,7);assert.equal(stats.conditional,1);assert.equal(stats.missing,0);
 const html=f.combo.render(f.sheet,{canEdit:true});
 assert.match(html,/Abertura/);
 assert.match(html,/7 ALMA PREVISTA/);
 assert.match(html,/Dano primeiro/);
 assert.match(html,/Fase: Duelo/);
 assert.match(html,/INICIAR SEQUÊNCIA/);
 assert.doesNotMatch(html,/custo final verificado/i);
 f.sheet.abilities[0].cost=6;
 assert.equal(f.combo.totals(f.sheet,c).cost,10);
});
test('referências estáveis resistem a reordenação e registram habilidades removidas',()=>{
 const f=fixture(),step=f.sheet.combos[0].steps[0];
 f.sheet.abilities.reverse();
 assert.equal(f.combo.resolve(f.sheet,step).ab.name,'Golpe');
 f.sheet.abilities=f.sheet.abilities.filter(ab=>ab.name!=='Golpe');
 assert.equal(f.combo.totals(f.sheet,f.sheet.combos[0]).missing,1);
 assert.match(f.combo.render(f.sheet,{canEdit:true}),/INDISPONÍVEL/);
});
test('o progresso avança exclusivamente após iniciar e confirmar a etapa correta',()=>{
 const f=fixture();
 f.combo.completeStep(f.sheet.id,'combo-one',0);
 f.click('start:combo-one');
 let html=f.combo.render(f.sheet,{canEdit:true});
 assert.match(html,/1 \/ 2 · PRÓXIMA ETAPA/);
 f.combo.completeStep(f.sheet.id,'combo-one',1);
 assert.match(f.combo.render(f.sheet,{canEdit:true}),/1 \/ 2 · PRÓXIMA ETAPA/);
 f.combo.completeStep(f.sheet.id,'combo-one',0);
 html=f.combo.render(f.sheet,{canEdit:true});
 assert.match(html,/2 \/ 2 · PRÓXIMA ETAPA/);
 f.combo.completeStep(f.sheet.id,'combo-one',1);
 assert.match(f.combo.render(f.sheet,{canEdit:true}),/COMBO CONCLUÍDO/);
});
test('observações e nomes são escapados e não executam HTML',()=>{
 const f=fixture();f.sheet.combos[0].name='<img src=x onerror=alert(1)>';
 f.sheet.combos[0].steps[0].note='<script>alert(1)</script>';
 const html=f.combo.render(f.sheet,{canEdit:true});
 assert.doesNotMatch(html,/<img src=x/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
});
test('o editor cria etapas para Habilidades e Técnicas e mantém a ordem',()=>{
 const f=fixture();f.click('new');
 assert.match(f.state.modal,/NOME DO COMBO/);
 assert.match(f.state.modal,/ADICIONAR HABILIDADE OU TÉCNICA/);
 assert.match(f.state.modal,/Golpe/);
 assert.match(f.state.modal,/Liberação/);
 assert.match(read('ficha-combos.js'),/data-combo-action="move:/);
});
test('sincronização envia só combos via RPC própria, não os recursos do personagem',async()=>{
 const f=fixture(),s=f.sheet;
 f.click('new');
 f.elements.comboName={value:'Duas técnicas'};
 f.elements.comboDescription={value:'Abertura de combate'};
 f.elements.comboAbilityPicker={value:'0'};
 f.click('add');f.elements.comboAbilityPicker.value='1';f.click('add');
 const editorSave=read('ficha-combos.js');
 assert.match(editorSave,/sync\.saveCombos\(s\.id,combos\)/);
 assert.match(editorSave,/api\.cacheOnly\?\.\(\)/);
 assert.match(read('online.js'),/ae_sheet_set_combos/);
 assert.match(read('sql\/ae_sheet_combo_presets.sql'),/ae_sheet_linked\(v_sheet,v_key.id,v_key.sheet_id\)/);
 assert.match(read('cbb-interativo.js'),/completeStep\?\.\(s\.id,comboStep.dataset.comboId/);
 assert.equal(s.resources.alma.current,10);
});

test('etapa com custo nao pode ser marcada sem confirmar a cobrança, mas liberação ativa pode avançar',()=>{
 const f=fixture();
 f.click('start:combo-one');
 f.click('advance:combo-one:0');
 assert.match(f.combo.render(f.sheet,{canEdit:true}),/1 \/ 2 · PRÓXIMA ETAPA/);
 f.combo.completeStep(f.sheet.id,'combo-one',0);
 f.sheet.abilities[1].costConfig={mode:'activation'};
 f.sheet.abilityRuntime={billing:{'id-lib':{active:true,scene:1}}};
 f.sheet.combat={scene:1};
 f.window.ARQUIVO_CBB_UI.abilityActions=()=>'<button data-cbb-command="deactivate">ENCERRAR LIBERAÇÃO</button>';
 const html=f.combo.render(f.sheet,{canEdit:true});
 assert.match(html,/LIBERAÇÃO JÁ ATIVA/);
 assert.doesNotMatch(html,/ENCERRAR LIBERAÇÃO/);
 f.click('advance:combo-one:1');
 assert.match(f.combo.render(f.sheet,{canEdit:true}),/COMBO CONCLUÍDO/);
});
