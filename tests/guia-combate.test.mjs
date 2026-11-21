import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup(master=false){
 const handlers={},fields={};
 const db={site:{},rules:[
  {id:'cap5',title:'COMBATE & MOVIMENTAÇÃO',text:'# COMBATE'},
  {id:'cap3',title:'TESTES & DADOS',text:'## DADOS'},
  {id:'dan',title:'DANO & RESISTÊNCIA',text:'Dano'},
 ]};
 let renders=0,saves=0,modalContent='',opened='';
 const api={
  db,esc,master:()=>master,render(){renders++},
  formatBook:txt=>'<div>'+esc(txt)+'</div>',toast(){},closeModal(){},
  save(){saves++;return true},
  modal:(title,html)=>{modalContent=html},
  confirmSite:(_a,_b,fn)=>fn(),
  openGuideChapter:id=>{opened=id},
 };
 const document={
  addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn),
  getElementById:id=>fields[id]||null,
 };
 const sandbox={window:{ARQUIVO_INTERNAL:api},document,matchMedia:()=>({matches:false})};
 vm.runInNewContext(read('guia-combate.js'),sandbox);
 const guide=sandbox.window.ARQUIVO_GUIA_COMBATE;
 function click(action){
  const event={target:{closest:selector=>selector==='[data-guide-action]'?{dataset:{guideAction:action}}:null}};
  handlers.click.forEach(fn=>fn(event));
 }
 return {guide,db,api,fields,click,modal:()=>modalContent,opened:()=>opened,saves:()=>saves,renders:()=>renders};
}
test('guia funciona como terceiro modo e possui oito aulas que não alteram regras',()=>{
 const ctx=setup(),before=JSON.stringify(ctx.db.rules),html=ctx.guide.render();
 assert.equal(ctx.guide.sections().length,8);
 assert.match(html,/GUIA DE COMBATE|GUIA|DA PRIMEIRA DECISÃO/);
 assert.match(html,/ROTEIRO DE COMBATE/);
 assert.match(html,/ETAPA 01 \/ 08/);
 assert.match(html,/LER REGRA ORIGINAL: COMBATE &amp; MOVIMENTAÇÃO/);
 assert.match(html,/DECISÃO EFICIENTE/);
 assert.match(html,/EVITE ESTE ERRO/);
 assert.match(html,/LISTA TÁTICA DE CONFERÊNCIA/);
 assert.equal(JSON.stringify(ctx.db.rules),before);
 assert.equal(ctx.saves(),0);
});
test('navegação entre etapas e capítulo fonte não modifica o documento',()=>{
 const ctx=setup();
 ctx.click('step:completa');
 assert.match(ctx.guide.render(),/Quando usar a Ação Completa/);
 assert.match(ctx.guide.render(),/troque/i);
 ctx.click('chapter:cap5');
 assert.equal(ctx.opened(),'cap5');
 ctx.click('next');
 assert.match(ctx.guide.render(),/Acelere sem destruir/);
 ctx.click('previous');
 assert.match(ctx.guide.render(),/Quando usar a Ação Completa/);
 assert.equal(ctx.saves(),0);
});
test('apenas mestre edita texto de tutorial, sem alterar capítulos originais',()=>{
 const ctx=setup(true),old=JSON.stringify(ctx.db.rules);
 ctx.click('edit:objetivo');
 assert.match(ctx.modal(),/aeGuideEdittext/);
 assert.match(ctx.modal(),/RESTAURAR TEXTO PADRÃO/);
 for(const [field,value] of Object.entries({
  title:'Objetivo revisado',lead:'Novo resumo',text:'**Texto atualizado**',tip:'Decisão boa',risk:'Evite erros'
 }))ctx.fields['aeGuideEdit'+field]={value};
 ctx.click('save:objetivo');
 assert.equal(ctx.saves(),1);
 assert.equal(ctx.db.site.combatGuide.overrides.objetivo.title,'Objetivo revisado');
 assert.match(ctx.guide.render(),/Objetivo revisado/);
 assert.equal(JSON.stringify(ctx.db.rules),old);
 ctx.click('restore:objetivo');
 assert.equal(ctx.saves(),2);
 assert.match(ctx.guide.render(),/Ganhe a cena antes de ganhar o duelo/);
});
test('jogador não recebe ferramentas de edição e nem consegue forçar gravação',()=>{
 const ctx=setup(false);
 assert.doesNotMatch(ctx.guide.render(),/EDITAR ESTA ETAPA/);
 ctx.click('edit:objetivo');ctx.click('save:objetivo');ctx.click('restore:objetivo');
 assert.equal(ctx.saves(),0);
 assert.equal(ctx.db.site.combatGuide,undefined);
});
test('editor e leitor escapam texto perigoso recebido dos dados',()=>{
 const ctx=setup(true);
 ctx.db.site.combatGuide={version:1,overrides:{objetivo:{
  title:'<script>alert(1)</script>',lead:'<img src=x onerror=1>',text:'<b>Injeção</b>',tip:'Teste',risk:'Teste'
 }}};
 const html=ctx.guide.render();
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;img src=x onerror=1&gt;/);
 assert.doesNotMatch(html,/<script>|<img src=x/);
});
