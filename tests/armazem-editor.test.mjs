import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setup(master=true){
 const handlers={click:[],input:[],change:[],keydown:[]},elements={dialogRoot:{dataset:{}}};
 let modalMarkup='',saved=0;
 const document={
  getElementById:id=>elements[id]||null,
  addEventListener:(event,fn)=>(handlers[event]??=[]).push(fn)
 };
 const db={site:{warehouse:{categories:['Classes','Habilidades','Técnicas','Itens','Outros'],posts:[]}},
  rules:[{id:'rule1',title:'Vida'}],sheets:[{id:'sheet1',name:'Personagem',catalogEntries:[{sourceId:'legacy',title:'Antigo'}]}]};
 const api={
  db,esc,master:()=>master,uid:()=> 'new-id',formatBook:x=>'<p>'+esc(x)+'</p>',
  headline:(_k,title)=>title,resetLibraryState(){},render(){},save(){saved++;return true},
  modal:(_title,markup)=>{modalMarkup=markup},closeModal(){},confirmSite(_a,_b,fn){fn()},toast(){}
 };
 const window={ARQUIVO_INTERNAL:api};
 const sandbox={window,document,console,requestAnimationFrame:callback=>callback(),
  Event:class{constructor(type){this.type=type;}}};
 vm.runInNewContext(file('classes-armazem.js'),sandbox);
 vm.runInNewContext(file('biblioteca-secoes.js'),sandbox);
 vm.runInNewContext(file('biblioteca-editor.js'),sandbox);
 function dispatch(type,id,action='',extra={}){
  const target={
   id,value:extra.value,
   closest(selector){
    if(selector==='[data-warehouse-action]'&&type==='click'&&extra.kind==='warehouse')
     return {dataset:{warehouseAction:action}};
    if(selector==='[data-action]'&&type==='click'&&extra.kind==='modal')
     return {dataset:{action}};
    if(selector==='[data-warehouse-editor]'&&type==='click'&&extra.kind==='editor')
     return {dataset:{warehouseEditor:action}};
    return null;
   }
  };
  const ev={target,preventDefault(){},stopImmediatePropagation(){},key:'',ctrlKey:false,metaKey:false};
  for(const fn of handlers[type]||[])fn(ev);
 }
 return {window,document,db,api,handlers,elements,dispatch,modal:()=>modalMarkup,saves:()=>saved};
}

test('livros e quatro classes permanecem disponíveis, mas sem conexão com a ficha',()=>{
 const {window,db}=setup();
 assert.equal(window.ARQUIVO_SECOES.warehouse().posts.length,4);
 const html=window.ARQUIVO_SECOES.warehousePage();
 for(const name of ['Coração de Aço','Especialista em Hohō','Caçador','Porta-voz'])
  assert.ok(html.includes(name),name);
 assert.doesNotMatch(html,/ENVIAR À FICHA|data-cat-action|ae-catalog-bar|ae-catalog-dice-reference/i);
 assert.equal(db.sheets[0].catalogEntries[0].title,'Antigo');
});

test('imagem de Classe permanece, mas imagens de Habilidade, Técnica e Item não aparecem',()=>{
 const ctx=setup();
 const {db,window}=ctx;
 db.site.warehouse.posts.push(
  {id:'skill',title:'Habilidade teste',category:'Habilidades',content:'Regra',image:'https://example.com/skill.png',published:true},
  {id:'tech',title:'Técnica teste',category:'Técnicas',content:'Regra',image:'https://example.com/tech.png',published:true},
  {id:'item',title:'Item teste',category:'Itens',content:'Regra',image:'https://example.com/item.png',published:true});
 const html=window.ARQUIVO_SECOES.warehousePage();
 assert.doesNotMatch(html,/src="https:\/\/example\.com\/(skill|tech|item)\.png"/);
 assert.match(html,/src="https:\/\/media\.discordapp\.net/);
 ctx.dispatch('click','','edit:item',{kind:'warehouse'});
 assert.match(ctx.modal(),/id="warehouseImageField" hidden/);
 ctx.dispatch('click','','edit:classe-cacador',{kind:'warehouse'});
 assert.match(ctx.modal(),/id="warehouseImageField"/);
 assert.doesNotMatch(ctx.modal(),/id="warehouseImageField" hidden/);
});

test('trocar a categoria esconde e reexibe o campo de imagem',()=>{
 const ctx=setup();
 ctx.elements.warehouseImageField={hidden:false};
 ctx.dispatch('change','warehouseCategoryInput','',{value:'Itens'});
 assert.equal(ctx.elements.warehouseImageField.hidden,true);
 ctx.dispatch('change','warehouseCategoryInput','',{value:'Habilidades'});
 assert.equal(ctx.elements.warehouseImageField.hidden,true);
 ctx.dispatch('change','warehouseCategoryInput','',{value:'Classes'});
 assert.equal(ctx.elements.warehouseImageField.hidden,false);
});

test('salvar item preserva imagem e metadados anteriores sem executar automações',()=>{
 const ctx=setup();
 const old={id:'item',title:'Espada',category:'Itens',image:'https://example.com/item.png',content:'Antigo',
  published:true,bars:[{id:'original',max:5,initial:1}],damage:{kind:'damage',count:1,faces:6}};
 ctx.db.site.warehouse.posts.push(old);
 ctx.elements.dialogRoot.dataset.warehouseId='item';
 const fields={
  warehouseTitleInput:{value:'Espada revisada'},warehouseContentInput:{value:'Novo texto'},
  warehouseCategoryInput:{value:'Itens'},warehouseImageInput:{value:''},
  warehouseCostInput:{value:'1 ALMA'},warehouseSummaryInput:{value:'Resumo'},
  warehouseTagsInput:{value:'Arma'},warehousePublishedInput:{checked:true}
 };
 Object.assign(ctx.elements,fields);
 ctx.dispatch('click','','warehouse-save',{kind:'modal'});
 const next=ctx.db.site.warehouse.posts.find(p=>p.id==='item');
 assert.equal(next.title,'Espada revisada');
 assert.equal(next.content,'Novo texto');
 assert.equal(next.image,old.image);
 assert.equal(next.bars[0].max,5);
 assert.equal(next.damage.faces,6);
 assert.equal(ctx.saves(),1);
 assert.equal(ctx.db.sheets[0].catalogEntries.length,1);
});

test('editor textual continua com modelos, prévia e atalhos, sem controles de automação',()=>{
 const ctx=setup();
 ctx.dispatch('click','','edit:new',{kind:'warehouse'});
 const html=ctx.modal();
 assert.match(html,/warehouseContentInput/);
 assert.match(html,/warehouseEditorTemplate/);
 assert.match(html,/aeWarehouseEditorPreview/);
 assert.doesNotMatch(html,/aeCatalogBarRows|aeCatalogDieKind|ENVIAR À FICHA/);
 ctx.elements.warehouseContentInput={value:'**Texto**'};
 ctx.elements.aeWarehouseEditorPreview={innerHTML:''};
 ctx.elements.warehouseEditorStats={textContent:''};
 ctx.dispatch('input','warehouseContentInput');
 assert.equal(ctx.elements.aeWarehouseEditorPreview.innerHTML,'<p>**Texto**</p>');
 assert.match(ctx.elements.warehouseEditorStats.textContent,/1 palavras/);
});

test('interface de fichas não apresenta a aba Acervo nem executa o módulo anterior',()=>{
 const html=file('index.html'),app=file('arquivo-app.js');
 assert.doesNotMatch(html,/biblioteca-fichas\.(css|js)/);
 assert.match(html,/biblioteca-editor\.js/);
 assert.ok(html.indexOf('biblioteca-secoes.js')<html.indexOf('biblioteca-editor.js'));
 assert.doesNotMatch(app,/\['catalog','Acervo'\]/);
 assert.doesNotMatch(app,/ARQUIVO_CATALOGO/);
 assert.doesNotMatch(app,/window\.ARQUIVO_V3\?\.costQuote\(s,ab,i\)/);
 assert.match(app,/if\(tab==='catalog'\)tab='summary'/);
 assert.doesNotMatch(html,/<script[^>]+src="habilidades-3\.0\.js/);
});


test('um registro expandido apresenta HUD informativo, dados e descrição sem alterar fichas',()=>{
 const ctx=setup();
 const before=JSON.stringify(ctx.db.sheets);
 ctx.elements.warehousePosts={innerHTML:''};
 ctx.dispatch('click','','open:classe-coracao-de-aco',{kind:'warehouse'});
 const html=ctx.elements.warehousePosts.innerHTML;
 assert.match(html,/HUD DE REFERÊNCIA/);
 assert.match(html,/Têmpera/);
 assert.match(html,/BARRAS DE RECURSO/);
 assert.match(html,/role="meter"/);
 assert.match(html,/aria-valuemax="3"/);
 assert.match(html,/REDUÇÃO/);
 assert.match(html,/1d4/);
 assert.match(html,/Referência visual/);
 assert.doesNotMatch(html,/GASTAR|GANHAR|ENVIAR À FICHA/);
 assert.equal(JSON.stringify(ctx.db.sheets),before);
});

test('tags dos registros são clicáveis, pesquisáveis e não diferenciam acentos ou caixa',()=>{
 const ctx=setup(),{window}=ctx;
 const list=window.ARQUIVO_SECOES.parseTags('Defesa, defesa, Hohō, HOHO, Corpo');
 assert.deepEqual(Array.from(list),['Defesa','Hohō','Corpo']);
 ctx.elements.warehousePosts={innerHTML:''};
 ctx.elements.warehouseMatches={textContent:''};
 ctx.elements.warehouseTagFilters={innerHTML:''};
 ctx.dispatch('click','','tag:Defesa',{kind:'warehouse'});
 assert.match(ctx.elements.warehousePosts.innerHTML,/Coração de Aço/);
 assert.doesNotMatch(ctx.elements.warehousePosts.innerHTML,/Porta-voz/);
 assert.match(ctx.elements.warehouseTagFilters.innerHTML,/aria-pressed="true"/);
 assert.match(ctx.elements.warehouseMatches.textContent,/1 publicação encontrada/);
 ctx.dispatch('click','','tag:Defesa',{kind:'warehouse'});
 assert.match(ctx.elements.warehousePosts.innerHTML,/Porta-voz/);
 ctx.dispatch('input','warehouseSearch','',{value:'hoho'});
 assert.match(ctx.elements.warehousePosts.innerHTML,/Especialista em Hohō/);
 assert.doesNotMatch(ctx.elements.warehousePosts.innerHTML,/Coração de Aço/);
});

test('editor mostra identidade, descrição, detalhes opcionais e barras de leitura',()=>{
 const ctx=setup();
 ctx.dispatch('click','','edit:classe-cacador',{kind:'warehouse'});
 const html=ctx.modal();
 assert.match(html,/IDENTIDADE/);
 assert.match(html,/DESCRIÇÃO/);
 assert.match(html,/DETALHES & HUD DE RECURSOS/);
 assert.match(html,/warehouseVisibilityInput/);
 assert.match(html,/warehouseTagPreview/);
 assert.match(html,/add-tag:/);
 assert.match(html,/id="warehouseBarRows"/);
 assert.match(html,/data-bar-field="max"/);
 assert.match(html,/Contadores de armadilha/);
 assert.match(html,/ADICIONAR BARRA/);
 assert.doesNotMatch(html,/ENVIAR À FICHA/);
});

test('o mestre pode salvar tags deduplicadas e barras informativas sem afetar ficha',()=>{
 const ctx=setup(),before=JSON.stringify(ctx.db.sheets);
 ctx.elements.dialogRoot.dataset.warehouseId='';
 Object.assign(ctx.elements,{
  warehouseTitleInput:{value:'Passo Sereno'},warehouseContentInput:{value:'Descrição do recurso'},
  warehouseCategoryInput:{value:'Habilidades'},warehouseVisibilityInput:{value:'draft'},
  warehouseSummaryInput:{value:'Mobilidade defensiva'},warehouseTagsInput:{value:'Defesa, defesa, Hohō'},
  warehouseImageInput:{value:''},warehouseCostInput:{value:'1 ALMA'},
  warehouseBarRows:{querySelectorAll(selector){
   assert.equal(selector,'[data-warehouse-bar]');
   const fields={label:{value:'Energia'},max:{value:'5'},initial:{value:'2'},reset:{value:'manual'},description:{value:'Gastável narrativamente'}};
   return [{dataset:{barId:''},querySelector(key){
    const m=/\[data-bar-field="([^"]+)"\]/.exec(key);return fields[m?.[1]]||null;
   }}];
  }}
 });
 ctx.dispatch('click','','warehouse-save',{kind:'modal'});
 const post=ctx.db.site.warehouse.posts[0];
 assert.equal(post.title,'Passo Sereno');
 assert.equal(post.tags,'Defesa, Hohō');
 assert.equal(post.published,false);
 assert.equal(post.bars.length,1);
 assert.equal(post.bars[0].initial,2);
 assert.equal(post.bars[0].max,5);
 assert.equal(JSON.stringify(ctx.db.sheets),before);
});
