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
  {id:'dan',title:'DANO & RESISTÊNCIA',text:'Dano'}
 ]};
 let saves=0,modalContent='',opened='';
 const api={
  db,esc,master:()=>master,render(){},
  formatBook:txt=>'<div>'+esc(txt)+'</div>',toast(){},closeModal(){},
  save(){saves++;return true},
  modal:(title,html)=>{modalContent=html},
  confirmSite:(_a,_b,fn)=>fn(),
  openGuideChapter:id=>{opened=id}
 };
 const document={
  addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn),
  getElementById:id=>fields[id]||null
 };
 const sandbox={window:{ARQUIVO_INTERNAL:api},document};
 vm.runInNewContext(read('guia-combate.js'),sandbox);
 const guide=sandbox.window.ARQUIVO_GUIA_COMBATE;
 function click(action){
  const event={target:{closest:selector=>selector==='[data-guide-action]'?{dataset:{guideAction:action}}:null}};
  (handlers.click||[]).forEach(fn=>fn(event));
 }
 function search(term){
  (handlers.input||[]).forEach(fn=>fn({target:{id:'aeGuideSearch',value:term}}));
 }
 return {guide,db,fields,click,search,modal:()=>modalContent,opened:()=>opened,saves:()=>saves};
}
test('a cola oferece respostas curtas com acesso aos capítulos sem alterar as regras',()=>{
 const ctx=setup(),original=JSON.stringify(ctx.db.rules),html=ctx.guide.render();
 assert.equal(ctx.guide.sections().length,16);
 assert.match(html,/COLA DE/);
 assert.match(html,/COMBATE/);
 assert.match(html,/QUAL É A DÚVIDA/);
 assert.match(html,/aeGuideResults/);
 assert.match(html,/aeGuideSearch/);
 assert.match(html,/RESPOSTA RÁPIDA/);
 assert.match(html,/REGRA COMPLETA: COMBATE &amp; MOVIMENTAÇÃO/);
 assert.match(html,/EXEMPLO \/ QUANDO USAR/);
 assert.match(html,/ATENÇÃO/);
 assert.ok(ctx.guide.sections().every(s=>s.lead.length<165),'resposta inicial deve caber em uma frase');
 assert.ok(ctx.guide.sections().every(s=>s.text.length<650),'cada tópico deve ser breve');
 assert.equal(JSON.stringify(ctx.db.rules),original);
 assert.equal(ctx.saves(),0);
});
test('filtrar por assunto e buscar aceitam palavras sem acento',()=>{
 const ctx=setup();
 ctx.search('reacao');
 let html=ctx.guide.render();
 assert.match(html,/Preciso gastar reação para defender/);
 assert.doesNotMatch(html,/Como calculo o dano/);
 ctx.search('acao completa');
 html=ctx.guide.render();
 assert.match(html,/Como funciona a Ação Completa/);
 assert.doesNotMatch(html,/Como funciona a resistência/);
 ctx.search('');
 ctx.click('group:Arriscar');
 html=ctx.guide.render();
 assert.match(html,/Qual Exposição eu escolho/);
 assert.doesNotMatch(html,/Quanto posso andar/);
 ctx.click('clear');
 html=ctx.guide.render();
 assert.match(html,/Em que fase eu ajo/);
 assert.match(html,/Como funciona a resistência/);
});
test('abrir outra dúvida muda a resposta, sem mudar capítulos nem gravar dados',()=>{
 const ctx=setup(),original=JSON.stringify(ctx.db.rules);
 ctx.click('step:completa');
 const html=ctx.guide.render();
 assert.match(html,/Gaste a principal normal \+ a reação normal/);
 ctx.click('chapter:cap5');
 assert.equal(ctx.opened(),'cap5');
 ctx.click('step:critico');
 assert.match(ctx.guide.render(),/Deu crítico/);
 assert.equal(ctx.saves(),0);
 assert.equal(JSON.stringify(ctx.db.rules),original);
});
test('o mestre pode editar ou restaurar uma resposta sem mexer no livro',()=>{
 const ctx=setup(true),before=JSON.stringify(ctx.db.rules);
 ctx.click('edit:fases');
 assert.match(ctx.modal(),/aeGuideEdittext/);
 assert.match(ctx.modal(),/RESTAURAR TEXTO PADRÃO/);
 for(const [key,value] of Object.entries({
  title:'Pergunta revisada',lead:'Resposta curta',text:'- Passo 1\n- Passo 2',tip:'Exemplo',risk:'Cuidado'
 }))ctx.fields['aeGuideEdit'+key]={value};
 ctx.click('save:fases');
 assert.equal(ctx.saves(),1);
 assert.equal(ctx.db.site.combatGuide.overrides.fases.lead,'Resposta curta');
 assert.match(ctx.guide.render(),/Pergunta revisada/);
 assert.equal(JSON.stringify(ctx.db.rules),before);
 ctx.click('restore:fases');
 assert.equal(ctx.saves(),2);
 assert.match(ctx.guide.render(),/Em que fase eu ajo/);
});
test('jogador não recebe edição, e conteúdo personalizado é escapado',()=>{
 const player=setup(),master=setup(true);
 assert.doesNotMatch(player.guide.render(),/EDITAR RESPOSTA/);
 player.click('edit:fases');player.click('save:fases');player.click('restore:fases');
 assert.equal(player.saves(),0);
 master.db.site.combatGuide={version:2,overrides:{fases:{
  title:'<script>alert(1)</script>',lead:'<img src=x onerror=1>',text:'Texto seguro',tip:'Exemplo',risk:'Cuidado'
 }}};
 const html=master.guide.render();
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;img src=x onerror=1&gt;/);
 assert.doesNotMatch(html,/<script>|<img src=x/);
});
