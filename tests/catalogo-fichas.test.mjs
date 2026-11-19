import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const load=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup(master=false){
 const listeners={};
 const document={
  addEventListener(name,callback){(listeners[name]??=[]).push(callback)},
  getElementById(){return null},querySelectorAll(){return []}
 };
 const sheet={id:'s1',name:'Ichigo',inventory:{items:[],currencies:[]},catalogEntries:[],abilities:[],resources:{vida:{current:20,max:20},estabilidade:{current:10,max:10},alma:{current:10,max:10}}};
 const db={site:{},rules:[{id:'cap1',title:'Vida'}],sheets:[sheet]};
 const api={
  db,master:()=>master,canEditSheet:id=>id==='s1',currentSheet:'s1',
  esc,formatBook:content=>esc(content),headline:(_,title)=>title,
  btn:()=>'',uid:()=> 'id-test',save(){api.saved++},saved:0,
  closeModal(){},render(){},toast(){},setPage(){},goCatalogSheet(){api.opened=true},
  resetLibraryState(){},confirmSite(_a,_b,callback){callback()},modal(){}
 };
 const window={ARQUIVO_INTERNAL:api};
 const sandbox={window,document,requestAnimationFrame:callback=>callback(),console};
 vm.runInNewContext(load('classes-armazem.js'),sandbox);
 vm.runInNewContext(load('biblioteca-secoes.js'),sandbox);
 vm.runInNewContext(load('biblioteca-fichas.js'),sandbox);
 return {window,document,listeners,db,sheet,api};
}
test('quatro classes disponíveis como publicações do Armazém',()=>{
 const {window}=setup();
 const classes=window.ARQUIVO_CLASSES_CBB;
 assert.equal(classes.length,4);
 assert.deepEqual(Array.from(classes,c=>c.bars[0].max),[3,1,5,1]);
 assert.deepEqual(Array.from(classes,c=>c.bars[0].initial),[0,0,1,1]);
 const page=window.ARQUIVO_SECOES.warehousePage();
 for(const title of ['Coração de Aço','Especialista em Hohō','Caçador','Porta-voz'])assert.ok(page.includes(title),title);
 assert.match(page,/ENVIAR À FICHA/);
});
test('capítulos existentes continuam no Livro 1 e classes não duplicam',()=>{
 const {window,db}=setup();
 db.site.warehouse={posts:[{...window.ARQUIVO_CLASSES_CBB[0],title:'Coração editado'}]};
 const docs=window.ARQUIVO_SECOES.warehouse().posts;
 assert.equal(docs.length,4);
 assert.equal(docs.filter(x=>x.id==='classe-coracao-de-aco').length,1);
 assert.equal(docs[0].title,'Coração editado');
 window.ARQUIVO_SECOES.active='book2';
 assert.match(window.ARQUIVO_SECOES.shelf(),/LIVRO 1/);
 assert.equal(db.rules[0].book,undefined);
});
test('uma classe pode ser transferida em um clique para uma ficha autorizada',async()=>{
 const {window,listeners,sheet,api}=setup();
 const button={dataset:{catAction:'attach:classe-cacador'}};
 const event={
  target:{closest:selector=>selector==='[data-cat-action]'?button:null},
  preventDefault(){},stopImmediatePropagation(){}
 };
 for(const listener of listeners.click)listener(event);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sheet.catalogEntries.length,0); // array local substituído pelo fluxo de gravação
 const saved=api.db.sheets[0];
 assert.equal(saved.catalogEntries.length,1);
 assert.equal(saved.catalogEntries[0].title,'Caçador');
 assert.equal(saved.inventory.catalogBars['classe-cacador/armadilhas'],1);
 assert.equal(api.saved,1);
 assert.equal(api.opened,true);
});
test('HUD da ficha é protegido e atualiza visualmente o estado',()=>{
 const {window,sheet}=setup();
 const p=window.ARQUIVO_CLASSES_CBB[0];
 sheet.catalogEntries=[{sourceId:p.id,title:p.title,category:p.category,snapshot:p}];
 sheet.inventory.catalogBars={'classe-coracao-de-aco/tempera':2};
 const page=window.ARQUIVO_CATALOGO.sheetPanel(sheet);
 assert.match(page,/Têmpera/);
 assert.match(page,/2 \/ 3/);
 assert.match(page,/role="meter"/);
 assert.match(page,/GASTAR/);
 assert.match(window.ARQUIVO_CATALOGO.summaryHud(sheet),/Têmpera/);
});
test('configurador oferece dados de dano e barras por cena',()=>{
 const {window}=setup(true);
 const post=window.ARQUIVO_CLASSES_CBB[2];
 const editor=window.ARQUIVO_CATALOGO.editorFields(post);
 assert.match(editor,/Tipo de dado/);
 assert.match(editor,/Ao começar uma cena/);
 assert.match(editor,/aeCatalogBarRows/);
 assert.match(editor,/Contadores de armadilha/);
});
test('script de combate antigo não é executado na página',()=>{
 const html=load('index.html');
 const app=load('arquivo-app.js');
 assert.doesNotMatch(html,/<script[^>]+src="mecanicas-ficha\.js/);
 assert.doesNotMatch(html,/<script[^>]+src="habilidades-3\.0\.js/);
 assert.doesNotMatch(app,/\['combat','Combate'\]/);
 assert.match(app,/\['catalog','Acervo'\]/);
 assert.ok(html.indexOf('classes-armazem.js')<html.indexOf('biblioteca-secoes.js'));
 assert.ok(html.indexOf('biblioteca-secoes.js')<html.indexOf('biblioteca-fichas.js'));
});
