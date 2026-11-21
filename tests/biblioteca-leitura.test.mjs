import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

function setup(){
 const app=read('arquivo-app.js');
 const start=app.indexOf('function formatBook('),end=app.indexOf('function sheets(',start);
 assert.ok(start>=0&&end>start);
 const sandbox={
  window:{},query:'',libraryGlossary:new Map(),
  esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  libraryTermTone:()=> 'rule',
  markInlineDice:x=>x,
  dieShape:()=>'<span class="die"></span>'
 };
 const ctx=vm.createContext(sandbox);
 vm.runInContext(read('biblioteca-leitura.js'),ctx);
 vm.runInContext(app.slice(start,end),ctx);
 return {helper:ctx.window.ARQUIVO_BIBLIOTECA_LEITURA,format:(txt,title='',prefix='cap')=>
  ctx.formatBook(txt,title,{headingPrefix:prefix})};
}

test('categorias de leitura distinguem recurso, efeito, ação, testes, riscos e limites',()=>{
 const {helper}=setup();
 for(const [title,expected] of [
  ['ALMA','resource'],['Exposição Espiritual','risk'],['Ação Completa','action'],
  ['TESTE-CLASH','test'],['Gatilho','action'],['Efeito','effect'],
  ['Custo','resource'],['Limite','limit'],['Identidade','core']
 ]){
  const kind=title==='Efeito'? 'definition':'heading';
  assert.equal(helper.marker(title,kind).tone,expected,title);
 }
});

test('índice reconhece títulos convencionais e ▸, nunca inclui código literal ou duplica o capítulo',()=>{
 const {helper,format}=setup(),fence=String.fromCharCode(96).repeat(3);
 const source='# COMBATE\n\n## AÇÃO COMPLETA\nTexto válido.\n\n▸ Exposição Espiritual\n'+
  'Nível Ⅰ: Reduz um passo.\n\n'+fence+'\n## Não é título\n'+fence+'\n\n'+
  '✱ RESISTÊNCIA\nTexto da seção.';
 const original=source.slice();
 const entries=helper.headings(source,'COMBATE');
 assert.deepEqual(Array.from(entries,x=>x.title),['AÇÃO COMPLETA','Exposição Espiritual','RESISTÊNCIA']);
 assert.deepEqual(Array.from(entries,x=>x.index),[0,1,2]);
 const out=helper.outline(source,'COMBATE','cap-rules');
 const html=format(source,'COMBATE','cap-rules');
 for(const row of entries){
  const id=helper.headingId('cap-rules',row.index);
  assert.ok(out.includes('href="#'+id+'"'));
  assert.ok(html.includes('id="'+id+'"'));
 }
 assert.match(html,/ae-book-definition--risk/);
 assert.match(html,/Nível Ⅰ/);
 assert.doesNotMatch(out,/Não é título/);
 assert.doesNotMatch(html,/class="ae-book-heading-label">Não é título/);
 assert.equal((html.match(/class="ae-book-heading ae-book-heading--/g)||[]).length,3);
 assert.equal(source,original);
});

test('rótulos com dois-pontos e travessão usam cartões iguais sem reescrever valores',()=>{
 const {format}=setup();
 const original=[
  'Custo — 2 ALMA para ativar.',
  'Gatilho: Ao sofrer dano de um inimigo.',
  '**Efeito:** Aumente o dano-base em +1d8.',
  '**Limite**: Uma vez por rodada.',
  'Nível Ⅱ: Sofre duas reduções de passo.',
  'Texto normal com 1d4.'
 ].join('\n\n');
 const html=format(original);
 for(const label of ['Custo','Gatilho','Efeito','Limite','Nível Ⅱ']){
  assert.ok(html.includes(label),label);
 }
 assert.match(html,/ae-book-definition--resource/);
 assert.match(html,/ae-book-definition--effect/);
 assert.match(html,/ae-book-definition--limit/);
 assert.match(html,/ae-book-definition--risk/);
 assert.match(html,/2 ALMA/);
 assert.match(html,/\+1d8/);
 assert.match(html,/Uma vez por rodada/);
 assert.match(html,/book-paragraph/);
 assert.match(html,/Texto normal com 1d4/);
});

test('fragmentos inseguros ficam escapados no conteúdo e nos atalhos',()=>{
 const {helper,format}=setup();
 const source='## <img src=x onerror=alert(1)>\n\nCusto — Não abrir <script>alert(1)</script>.';
 const menu=helper.outline(source,'TESTE','cap-"><script>');
 const html=format(source,'TESTE','cap-"><script>');
 assert.doesNotMatch(menu,/<script>|<img/);
 assert.doesNotMatch(html,/<script>|<img/);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/id="[^"]*<script/);
});

test('capítulos não possuem indexação nem vínculos automáticos de palavras',()=>{
 const {helper,format}=setup();
 assert.equal('glossaryIndex' in helper,false,'índice automático foi removido');
 const html=format('A ALMA sustenta técnicas. O Dano-base depende do ataque.');
 assert.match(html,/A ALMA sustenta técnicas/);
 assert.doesNotMatch(html,/data-action="explainRule:/);
 assert.doesNotMatch(read('arquivo-app.js'),/insertGlossaryReferences/);
});

test('renderização sob demanda, escala de leitura e paleta permanecem conectadas',()=>{
 const app=read('arquivo-app.js'),css=read('biblioteca-leitura.css'),index=read('index.html');
 assert.match(app,/chapterReadingMarkup\(r\)/);
 assert.match(app,/chapterReadingMarkup\(rule\)/);
 assert.match(app,/headingPrefix:rule\.id/);
 assert.match(css,/--theme-accent/);
 assert.match(css,/--theme-cold/);
 assert.match(css,/--ae-reading-scale/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(index,/biblioteca-leitura\.css\?v=\d+/);
 assert.ok(index.indexOf('biblioteca-leitura.js?v=4')<index.indexOf('arquivo-app.js?'));
});
