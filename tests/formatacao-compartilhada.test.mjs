import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('arquivo-app.js');
const bookStart=app.indexOf('function formatBook(');
const bookEnd=app.indexOf('function sheets(',bookStart);
const richStart=app.indexOf('function sheetRich(');
const richEnd=app.indexOf('function wrapColoredSelection(',richStart);
assert.ok(bookStart>=0&&bookEnd>bookStart&&richStart>=0&&richEnd>richStart,
 'Os formatadores centrais devem continuar disponíveis');

function setup(){
 const sandbox={
  window:{},query:'',libraryGlossary:new Map(),
  esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
  libraryTermTone(){return 'rule'},
  markInlineDice(text,markers,prefix){
   return String(text).replace(/\b(\d*)d(4|6|8|10|12|20)\b/gi,(_,count,faces)=>{
    const index=markers.push({sides:Number(faces),count:Number(count)||1})-1;
    return prefix+index+'@@';
   });
  },
  dieShape(faces,kind,count){return '<span class="test-die" data-faces="'+faces+'" data-count="'+count+'"></span>'}
 };
 const ctx=vm.createContext(sandbox);
 vm.runInContext(read('barras-inline.js'),ctx);
 vm.runInContext(read('biblioteca-leitura.js'),ctx);
 vm.runInContext(app.slice(bookStart,bookEnd)+'\n'+app.slice(richStart,richEnd),ctx);
 return {book:value=>ctx.formatBook(value),sheet:(value,inline=false)=>ctx.sheetRich(value,inline)};
}
test('> cria a mesma citação no Armazém e na ficha',()=>{
 const a=setup(),source='> Concentre energia espiritual.\n> **Ataque preparado.**\n\nPróximo texto.';
 for(const html of [a.book(source),a.sheet(source)]){
  assert.match(html,/<blockquote class="book-quote">/);
  assert.match(html,/<strong>Ataque preparado\.<\/strong>/);
  assert.match(html,/<p class="book-paragraph">Próximo texto\.<\/p>/);
  assert.doesNotMatch(html,/&gt; Concentre/);
 }
 assert.match(a.sheet(source),/class="book-text ae-unified-rich"/);
});
test('listas, títulos, divisores e código seguem o mesmo padrão',()=>{
 const a=setup(),fence=String.fromCharCode(96).repeat(3);
 const source='## Objetivo\n\n- Primeiro item\n- Segundo item\n\n---\n\n'+
  fence+'\n> exemplo literal\n'+fence+'\n';
 for(const html of [a.book(source),a.sheet(source)]){
  assert.match(html,/class="ae-book-heading(?:\s|\")/);
  assert.match(html,/<ul class="book-readable-list">/);
  assert.match(html,/<li>Primeiro item<\/li>/);
  assert.match(html,/class="book-divider"/);
  assert.match(html,/class="book-code"/);
  assert.match(html,/&gt; exemplo literal/);
  assert.doesNotMatch(html,/class="book-quote"/);
 }
});
test('dados, barras, cores e HTML malicioso são tratados igualmente',()=>{
 const a=setup();
 const source='> [cor=#FF7A1A]Ataque[/cor]: 1d8 e [barra:2/3]. <img src=x onerror=alert(1)>';
 for(const html of [a.book(source),a.sheet(source)]){
  assert.match(html,/class="book-quote"/);
  assert.match(html,/class="ae-manual-color"/);
  assert.match(html,/class="test-die"/);
  assert.match(html,/ae-inline-resource--barra/);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/<img src=x/);
 }
});
test('dados de grupos e perícias continuam inline',()=>{
 const a=setup();
 const inline=a.sheet('d6',true);
 assert.match(inline,/class="test-die"/);
 assert.doesNotMatch(inline,/<p|<div|<\/p>/);
 assert.match(a.sheet('d6'),/class="book-text ae-unified-rich"/);
 const visual=read('ficha-visual.js');
 assert.match(visual,/api\.sheetRich\('d'\+n,true\)/);
 assert.match(visual,/api\.sheetRich\(description\)/);
});
test('pesquisa na Biblioteca não colore trechos das fichas',()=>{
 const source=read('arquivo-app.js');
 assert.match(source,/options\.highlight===false\?'':query\.trim\(\)/);
 assert.match(source,/formatBook\(text,'',\{highlight:false\}\)/);
});
test('Identificação, notas, guias e habilidades compartilham o mesmo parser',()=>{
 const visual=read('ficha-visual.js'),app=read('arquivo-app.js');
 assert.match(visual,/ae-ficha-origin-prose sheet-rich book-text ae-unified-rich/);
 assert.match(visual,/ae-ficha-guide-modal book-text ae-unified-rich/);
 assert.match(visual,/api\.formatBook\(part\.content,part\.title,\{highlight:false\}\)/);
 assert.match(app,/sheetRich\(s\.notes\|\|'Sem anotações\.'\)/);
 assert.match(app,/sheetRich\(context\)/);
 const css=read('arquivo-base.css');
 assert.match(css,/\.ae-unified-rich \.book-quote/);
 assert.match(css,/border-left:3px solid var\(--theme-cold\)/);
});
