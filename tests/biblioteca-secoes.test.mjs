import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../biblioteca-secoes.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../arquivo-app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function start(master=false){
 const db={site:{},rules:[{id:'antigo',title:'Fundamentos'},{id:'novo',title:'Criação',book:'book2'}]};
 const api={
  db,master:()=>master,esc,btn:()=>'',headline:(a,b)=>b,
  formatBook:content=>esc(content),save(){},render(){},modal(){},toast(){},
  resetLibraryState(){},closeModal(){},confirmSite(){},uid:()=> 'id-test'
 };
 const document={addEventListener(){},getElementById(){return null}};
 const window={ARQUIVO_INTERNAL:api};
 vm.runInNewContext(source,{window,document,crypto:{randomUUID:()=> 'test-id'},requestAnimationFrame(){}});
 return {sections:window.ARQUIVO_SECOES,db,api};
}

test('seletor mostra os três destinos e preserva o acervo legado',()=>{
 const {sections,db}=start();
 assert.match(sections.shelf(),/LIVRO 1/);
 assert.match(sections.shelf(),/LIVRO 2/);
 assert.match(sections.shelf(),/ARMAZÉM/);
 const before=JSON.stringify(db);
 sections.select('book2');
 assert.equal(sections.active,'book2');
 assert.equal(JSON.stringify(db),before);
 assert.match(sections.shelf(),/aria-current="page"/);
});
test('Armazém sem conteúdo não inventa registros',()=>{
 const {sections,db}=start();
 assert.match(sections.warehousePage(),/ainda não possui publicações/);
 assert.equal(db.site.warehouse,undefined);
});
test('rascunhos não aparecem aos jogadores',()=>{
 const {sections,db}=start();
 db.site.warehouse={categories:['Classes'],posts:[
  {id:'a',title:'Publicação pronta',category:'Classes',content:'Texto',published:true},
  {id:'b',title:'Rascunho oculto',category:'Classes',content:'Texto',published:false}
 ]};
 const page=sections.warehousePage();
 assert.match(page,/Publicação pronta/);
 assert.doesNotMatch(page,/Rascunho oculto/);
 const owner=start(true);
 owner.db.site.warehouse=structuredClone(db.site.warehouse);
 assert.match(owner.sections.warehousePage(),/Rascunho oculto/);
});
test('HTML de títulos é escapado e URL insegura não é renderizada',()=>{
 const {sections,db}=start(true);
 db.site.warehouse={categories:['Outros'],posts:[
  {id:'x',title:'<script>alert(1)</script>',image:'javascript:alert(1)',category:'Outros',content:'Texto'}
 ]};
 const page=sections.warehousePage();
 assert.match(page,/&lt;script&gt;/);
 assert.doesNotMatch(page,/<script>/);
 assert.doesNotMatch(page,/src="javascript:/);
});
test('integração mantém os capítulos originais e carrega recursos em ordem',()=>{
 assert.match(app,/r\.book!=='book2'/);
 assert.match(app,/book:libraryVolume\(\)==='book2'\?'book2':'book1'/);
 assert.match(html,/biblioteca-secoes\.css\?v=4/);
 assert.ok(html.indexOf('arquivo-app.js?v=8')<html.indexOf('biblioteca-secoes.js?v=7'));
});
