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
 vm.runInNewContext(file('habilidades-armazem.js'),sandbox);
 vm.runInNewContext(file('biblioteca-secoes.js'),sandbox);
 vm.runInNewContext(file('biblioteca-editor.js'),sandbox);
 function dispatch(type,id,action='',extra={}){
  const target={
   id,value:extra.value,files:extra.files,
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
 return {window,document,db,api,handlers,elements,dispatch,sandbox,modal:()=>modalMarkup,saves:()=>saved};
}

test('livros e quatro classes permanecem disponíveis, mas sem conexão com a ficha',()=>{
 const {window,db}=setup();
 assert.equal(window.ARQUIVO_SECOES.warehouse().posts.length,11);
 const html=window.ARQUIVO_SECOES.warehousePage();
 for(const name of ['Coração de Aço','Especialista em Hohō','Caçador','Porta-voz'])
  assert.ok(html.includes(name),name);
 assert.doesNotMatch(html,/ENVIAR À FICHA|data-cat-action|ae-catalog-bar|ae-catalog-dice-reference/i);
 assert.equal(db.sheets[0].catalogEntries[0].title,'Antigo');
});

test('habilidades e técnicas usam cartão textual sem quadrado de imagem, itens preservam foto',()=>{
 const ctx=setup();
 const {db,window}=ctx;
 db.site.warehouse.posts.push(
  {id:'skill',title:'Habilidade teste',category:'Habilidades',content:'Efeito único',image:'https://example.com/skill.gif',published:true,cost:'2 Alma'},
  {id:'tech',title:'Técnica teste',category:'Técnicas',content:'Movimento breve',published:true},
  {id:'item',title:'Item teste',category:'Itens',content:'Regra',image:'https://example.com/item.png',published:true});
 const html=window.ARQUIVO_SECOES.warehousePage();
 const skill=html.match(/<article class="ae-warehouse-post ae-wh-ability-post" id="warehousePost-skill">[\s\S]*?<\/article>/)?.[0];
 const tech=html.match(/<article class="ae-warehouse-post ae-wh-ability-post" id="warehousePost-tech">[\s\S]*?<\/article>/)?.[0];
 assert.ok(skill&&tech,'habilidade e técnica devem possuir cartões específicos');
 assert.match(skill,/ae-wh-ability-title|CUSTO \/ USO · 2 Alma/);
 assert.match(skill,/Efeito único/);
 assert.match(tech,/Movimento breve/);
 assert.doesNotMatch(skill+tech,/ae-wh-emblem|ae-warehouse-image|魂|src="https:\/\/example.com\/skill.gif"|ae-wh-read-btn/);
 assert.doesNotMatch(skill,/LER EFEITO COMPLETO/);
 assert.match(html,/src="https:\/\/example\.com\/item\.png"/);
 ctx.dispatch('click','','edit:item',{kind:'warehouse'});
 assert.match(ctx.modal(),/id="warehouseImageFile"/);
 assert.doesNotMatch(ctx.modal(),/id="warehouseImageField" hidden/);
 ctx.dispatch('click','','edit:skill',{kind:'warehouse'});
 assert.match(ctx.modal(),/id="warehouseImageField" hidden/);
 assert.match(ctx.modal(),/Descrição da habilidade/);
 assert.match(ctx.modal(),/EFEITO DA HABILIDADE/);
 assert.doesNotMatch(ctx.modal(),/Texto completo<textarea/);
});

test('salvar item mantém atributos válidos e descarta metadados do HUD antigo',()=>{
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
 assert.equal(Object.hasOwn(next,'bars'),false);
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


test('tags de jogabilidade das quatro classes foram resumidas',()=>{
 const {window}=setup();
 const arr=window.ARQUIVO_CLASSES_CBB;
 assert.deepEqual(Array.from(arr,p=>p.tags),['Tanque','Combatente, Mobilidade','Controle','Suporte']);
});

test('tags ocultas não aparecem, não filtram e não entram na busca do jogador',()=>{
 const owner=setup(true),guest=setup(false);
 const post={id:'segredo',title:'Classe teste',category:'Classes',content:'Um efeito simples',
  summary:'Classe experimental',tags:'Tanque, Estratégia',hiddenTags:['Estratégia'],published:true};
 owner.db.site.warehouse.posts.push(post);
 guest.db.site.warehouse.posts.push({...post});
 const masterHtml=owner.window.ARQUIVO_SECOES.warehousePage();
 assert.match(masterHtml,/Estratégia/);
 assert.match(masterHtml,/SÓ MESTRE/);
 const guestHtml=guest.window.ARQUIVO_SECOES.warehousePage();
 assert.match(guestHtml,/Tanque/);
 assert.doesNotMatch(guestHtml,/Estratégia/);
 guest.elements.warehousePosts={innerHTML:''};
 guest.elements.warehouseMatches={textContent:''};
 guest.dispatch('input','warehouseSearch','',{value:'Estratégia'});
 assert.doesNotMatch(guest.elements.warehousePosts.innerHTML,/Classe teste/);
 assert.match(guest.elements.warehousePosts.innerHTML,/Nenhuma publicação encontrada/);
});

test('mestre alterna visibilidade individual sem alterar outros marcadores',()=>{
 const ctx=setup(true);
 const item={id:'segredo2',title:'Treino',category:'Classes',content:'Regras',tags:'Tanque, Defesa',hiddenTags:[],published:true};
 ctx.db.site.warehouse.posts.push(item);
 ctx.dispatch('click','','edit:segredo2',{kind:'warehouse'});
 ctx.elements.warehouseTagsInput={value:'Tanque, Defesa'};
 ctx.elements.warehouseTagPreview={innerHTML:''};
 ctx.dispatch('click','','toggle-tag:Defesa',{kind:'editor'});
 assert.match(ctx.elements.warehouseTagPreview.innerHTML,/OCULTA/);
 assert.match(ctx.elements.warehouseTagPreview.innerHTML,/VISÍVEL/);
 ctx.elements.dialogRoot.dataset.warehouseId='segredo2';
 Object.assign(ctx.elements,{
  warehouseTitleInput:{value:'Treino'},warehouseContentInput:{value:'Regras'},
  warehouseCategoryInput:{value:'Classes'},warehouseVisibilityInput:{value:'published'},
  warehouseCostInput:{value:''},warehouseSummaryInput:{value:'Resumo'},
  warehouseImageInput:{value:''}
 });
 ctx.dispatch('click','','warehouse-save',{kind:'modal'});
 const saved=ctx.db.site.warehouse.posts.find(p=>p.id==='segredo2');
 assert.deepEqual(Array.from(saved.hiddenTags),['Defesa']);
 assert.equal(saved.tags,'Tanque, Defesa');
});

test('GIF local pequeno pode ser preparado como miniatura animada',async()=>{
 const ctx=setup(true);
 ctx.dispatch('click','','edit:new',{kind:'warehouse'});
 const sample='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
 // Mock do leitor de arquivo; GIF é mantido sem conversão para imagem estática.
 class Reader{
  readAsDataURL(){this.result=sample;this.onload?.()}
 }
 ctx.elements.warehouseImageInput={value:''};
 ctx.elements.warehouseImagePreview={innerHTML:''};
 ctx.elements.warehouseImageFile={value:'teste.gif'};
 ctx.sandbox.FileReader=Reader;
 ctx.dispatch('change','warehouseImageFile','',{files:[{type:'image/gif',size:60}]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(ctx.elements.warehouseImagePreview.innerHTML,/data:image\/gif;base64/);
 assert.equal(ctx.window.ARQUIVO_EDITOR_ARMAZEM.imageValue(),sample);
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


test('publicação expandida exibe somente a descrição, sem o painel técnico',()=>{
 const ctx=setup();
 const before=JSON.stringify(ctx.db.sheets);
 ctx.elements.warehousePosts={innerHTML:''};
 ctx.dispatch('click','','open:classe-coracao-de-aco',{kind:'warehouse'});
 const html=ctx.elements.warehousePosts.innerHTML;
 assert.match(html,/DESCRIÇÃO & FUNCIONAMENTO/);
 assert.match(html,/Têmpera/);
 assert.match(html,/1d4/);
 assert.match(html,/class="ae-wh-detail-text"/);
 assert.doesNotMatch(html,/REGISTRO TÉCNICO|RECURSOS VISUAIS|Referência visual|ae-wh-detail-hud|ae-wh-resource-slots|role="meter"/);
 assert.equal(JSON.stringify(ctx.db.sheets),before);
});

test('tags dos registros são clicáveis, pesquisáveis e não diferenciam acentos ou caixa',()=>{
 const ctx=setup(),{window}=ctx;
 const list=window.ARQUIVO_SECOES.parseTags('Defesa, defesa, Hohō, HOHO, Corpo');
 assert.deepEqual(Array.from(list),['Defesa','Hohō','Corpo']);
 ctx.elements.warehousePosts={innerHTML:''};
 ctx.elements.warehouseMatches={textContent:''};
 ctx.elements.warehouseTagFilters={innerHTML:''};
 ctx.dispatch('click','','tag:Tanque',{kind:'warehouse'});
 assert.match(ctx.elements.warehousePosts.innerHTML,/Coração de Aço/);
 assert.doesNotMatch(ctx.elements.warehousePosts.innerHTML,/Porta-voz/);
 assert.match(ctx.elements.warehouseTagFilters.innerHTML,/aria-pressed="true"/);
 assert.match(ctx.elements.warehouseMatches.textContent,/1 publicação encontrada/);
 ctx.dispatch('click','','tag:Tanque',{kind:'warehouse'});
 assert.match(ctx.elements.warehousePosts.innerHTML,/Porta-voz/);
 ctx.dispatch('input','warehouseSearch','',{value:'hoho'});
 assert.match(ctx.elements.warehousePosts.innerHTML,/Especialista em Hohō/);
 assert.doesNotMatch(ctx.elements.warehousePosts.innerHTML,/Coração de Aço/);
});

test('editor exibe identidade, descrição e detalhes úteis sem recursos do HUD',()=>{
 const ctx=setup();
 ctx.dispatch('click','','edit:classe-cacador',{kind:'warehouse'});
 const html=ctx.modal();
 assert.match(html,/IDENTIDADE|DESCRIÇÃO/);
 assert.match(html,/DETALHES ADICIONAIS/);
 assert.match(html,/warehouseVisibilityInput|warehouseTagPreview/);
 assert.match(html,/warehouseEditorResourceKind/);
 assert.match(html,/data-warehouse-editor="insert-bar"/);
 assert.doesNotMatch(html,/HUD DE RECURSOS|BARRAS DE RECURSO|warehouseBarRows|ADICIONAR BARRA|data-bar-field/);
});

test('o mestre pode salvar tags deduplicadas sem recriar metadados do HUD',()=>{
 const ctx=setup(),before=JSON.stringify(ctx.db.sheets);
 ctx.elements.dialogRoot.dataset.warehouseId='';
 Object.assign(ctx.elements,{
  warehouseTitleInput:{value:'Passo Sereno'},warehouseContentInput:{value:'[marca:1] Descrição do recurso'},
  warehouseCategoryInput:{value:'Habilidades'},warehouseVisibilityInput:{value:'draft'},
  warehouseSummaryInput:{value:'Mobilidade defensiva'},warehouseTagsInput:{value:'Defesa, defesa, Hohō'},
  warehouseImageInput:{value:''},warehouseCostInput:{value:'1 ALMA'}
 });
 ctx.dispatch('click','','warehouse-save',{kind:'modal'});
 const post=ctx.db.site.warehouse.posts[0];
 assert.equal(post.title,'Passo Sereno');
 assert.equal(post.tags,'Defesa, Hohō');
 assert.equal(post.published,false);
 assert.equal(post.content,'[marca:1] Descrição do recurso');
 assert.equal(Object.hasOwn(post,'bars'),false);
 assert.equal(JSON.stringify(ctx.db.sheets),before);
});

test('classes com metadados legados não exibem recursos técnicos duplicados',()=>{
 const ctx=setup(true);
 ctx.elements.warehousePosts={innerHTML:''};
 for(const id of ['classe-cacador','classe-especialista-hoho']){
  ctx.dispatch('click','','open:'+id,{kind:'warehouse'});
  const markup=ctx.elements.warehousePosts.innerHTML;
  assert.match(markup,/DESCRIÇÃO & FUNCIONAMENTO/);
  assert.doesNotMatch(markup,/ae-wh-detail-hud|ae-wh-resource-slots|role="meter"|RECURSOS VISUAIS/);
 }
});

test('metadados legados de Sequência são ignorados e descartados ao editar',()=>{
 const ctx=setup(true);
 ctx.db.site.warehouse.posts.push({
  id:'sequencia-teste',title:'Cadência',category:'Classes',published:true,
  content:'[sequencia:2/3] Recurso cumulativo.',
  bars:[{id:'cadencia',label:'Cadência',visual:'sequencia',max:3,initial:2,reset:'manual'}]
 });
 ctx.elements.warehousePosts={innerHTML:''};
 ctx.dispatch('click','','open:sequencia-teste',{kind:'warehouse'});
 const html=ctx.elements.warehousePosts.innerHTML;
 assert.match(html,/\[sequencia:2\/3\]/);
 assert.doesNotMatch(html,/ae-wh-detail-hud|ae-wh-resource-slots|RECURSOS VISUAIS/);
 ctx.dispatch('click','','edit:sequencia-teste',{kind:'warehouse'});
 assert.doesNotMatch(ctx.modal(),/warehouseBarRows|ADICIONAR BARRA/);
 const before=JSON.stringify(ctx.db.sheets);
 ctx.elements.dialogRoot.dataset.warehouseId='sequencia-teste';
 Object.assign(ctx.elements,{
  warehouseTitleInput:{value:'Cadência'},warehouseContentInput:{value:'[sequencia:3/3] Cadência plena'},
  warehouseCategoryInput:{value:'Classes'},warehouseVisibilityInput:{value:'published'},
  warehouseSummaryInput:{value:'Níveis cumulativos'},warehouseTagsInput:{value:'Artilharia'},
  warehouseImageInput:{value:''},warehouseCostInput:{value:''}
 });
 ctx.dispatch('click','','warehouse-save',{kind:'modal'});
 const saved=ctx.db.site.warehouse.posts.find(x=>x.id==='sequencia-teste');
 assert.equal(saved?.content,'[sequencia:3/3] Cadência plena');
 assert.equal(Object.hasOwn(saved,'bars'),false);
 assert.equal(JSON.stringify(ctx.db.sheets),before);
});

test('Porta-voz em cache ou documento online recebe termos atuais sem perder edições',()=>{
 const ctx=setup(true);
 const old={
  id:'classe-porta-voz',title:'Porta-voz',category:'Classes',published:true,
  tags:'Suporte, Campanha',summary:'Versão personalizada pelo mestre',
  content:'## Manobrista\nAo utilizar Auxílio, escolha dois aliados com quem tenha pelo menos Afinidade. '+
    'O dado é usado conforme o grau de relação com o Porta-voz. '+
    'O dado tem −1 passo e seu resultado é reduzido à metade. '+
    'Os aliados recebem um dado adicional na próxima defesa contra ataque inimigo.\n\n'+
    '> O valor do dado por grau de Afinidade depende das regras de criação de personagem ainda em desenvolvimento.\n\n'+
    'Parágrafo exclusivo do mestre.',
  damage:{kind:'bonus',count:1,faces:0,label:'Dado de Afinidade (valor não definido)'}
 };
 ctx.db.site.warehouse.posts.push(old);
 const stored=JSON.stringify(old);
 const post=ctx.window.ARQUIVO_SECOES.warehouse().posts.find(p=>p.id==='classe-porta-voz');
 assert.match(post.content,/Vínculo de grau I ou superior/);
 assert.match(post.content,/I: 1d6; II: 1d8; III: 1d12/);
 assert.match(post.content,/Parágrafo exclusivo do mestre/);
 assert.doesNotMatch(post.content,/ainda em desenvolvimento|pelo menos Afinidade|grau de relação com o Porta-voz/);
 assert.match(post.damage.label,/Dado de Vínculo/);
 assert.equal(post.summary,'Versão personalizada pelo mestre');
 assert.equal(JSON.stringify(old),stored,'a leitura não pode sobrescrever o registro salvo');
 ctx.elements.warehousePosts={innerHTML:''};
 ctx.dispatch('click','','open:classe-porta-voz',{kind:'warehouse'});
 const markup=ctx.elements.warehousePosts.innerHTML;
 assert.match(markup,/Vínculo de grau I ou superior/);
 assert.doesNotMatch(markup,/ainda em desenvolvimento/);
 ctx.dispatch('click','','edit:classe-porta-voz',{kind:'warehouse'});
 assert.match(ctx.modal(),/I: 1d6; II: 1d8; III: 1d12/);
 assert.doesNotMatch(ctx.modal(),/ainda em desenvolvimento/);
 ctx.elements.dialogRoot.dataset.warehouseId='classe-porta-voz';
 Object.assign(ctx.elements,{
  warehouseTitleInput:{value:'Porta-voz'},warehouseContentInput:{value:post.content},
  warehouseCategoryInput:{value:'Classes'},warehouseVisibilityInput:{value:'published'},
  warehouseSummaryInput:{value:post.summary},warehouseTagsInput:{value:post.tags},
  warehouseImageInput:{value:''},warehouseCostInput:{value:'1 uso por cena'}
 });
 ctx.dispatch('click','','warehouse-save',{kind:'modal'});
 assert.match(old.content,/Vínculo de grau I ou superior/);
 assert.match(old.damage.label,/Dado de Vínculo/);
 assert.doesNotMatch(old.content,/ainda em desenvolvimento|pelo menos Afinidade/);
 assert.equal(old.summary,'Versão personalizada pelo mestre');
});

test('efeito extenso abre sem duplicar a prévia; descrição é uma única habilidade',()=>{
 const ctx=setup(false);
 ctx.db.site.warehouse.posts.push({
  id:'tecnica-longa',title:'Passo da Sombra',category:'Técnicas',published:true,
  summary:'Uma investida silenciosa',content:'## Ativação\nDeslocamento de 4 metros.\n\n## Efeito\nConcede +1d6 ao teste.'
 });
 ctx.elements.warehousePosts={innerHTML:''};
 let html=ctx.window.ARQUIVO_SECOES.warehousePage();
 assert.match(html,/LER TÉCNICA COMPLETA/);
 assert.match(html,/Uma investida silenciosa/);
 assert.match(html,/id="warehouseBody-tecnica-longa" hidden/);
 assert.doesNotMatch(html,/<p>## Ativação/);
 ctx.dispatch('click','','open:tecnica-longa',{kind:'warehouse'});
 html=ctx.elements.warehousePosts.innerHTML;
 assert.match(html,/RECOLHER DESCRIÇÃO/);
 assert.match(html,/id="warehouseBody-tecnica-longa"/);
 assert.match(html,/<p>## Ativação/);
 assert.doesNotMatch(html,/Uma investida silenciosa/);
 assert.doesNotMatch(html,/DESCRIÇÃO & FUNCIONAMENTO/);
 const technique=html.match(/<article class="ae-warehouse-post ae-wh-ability-post is-open" id="warehousePost-tecnica-longa">[\s\S]*?<\/article>/)?.[0];
 assert.ok(technique);
 assert.doesNotMatch(technique,/ae-wh-emblem|ae-warehouse-image/);
});

test('editor atualiza campos e não salva imagem em habilidade ou técnica',()=>{
 const ctx=setup(true);
 const labels=['warehouseContentLabel','warehouseSummaryLabel','warehouseContentHeading','warehousePreviewHeading','warehouseAdvancedHint'];
 for(const key of labels)ctx.elements[key]={textContent:''};
 ctx.elements.warehouseImageField={hidden:false};
 ctx.elements.warehouseCategoryInput={value:'Habilidades'};
 ctx.elements.warehouseSummaryInput={value:'Prévia'};
 ctx.elements.warehouseContentInput={value:'Efeito de uma técnica'};
 ctx.dispatch('change','warehouseCategoryInput','',{value:'Habilidades'});
 assert.equal(ctx.elements.warehouseImageField.hidden,true);
 assert.equal(ctx.elements.warehouseContentLabel.textContent,'Descrição da habilidade');
 assert.equal(ctx.elements.warehouseAdvancedHint.textContent,'Opcional · custo');
 ctx.elements.warehouseCategoryInput.value='Técnicas';
 ctx.dispatch('change','warehouseCategoryInput','',{value:'Técnicas'});
 assert.equal(ctx.elements.warehouseContentLabel.textContent,'Descrição da técnica');
 ctx.elements.warehouseCategoryInput.value='Itens';
 ctx.dispatch('change','warehouseCategoryInput','',{value:'Itens'});
 assert.equal(ctx.elements.warehouseImageField.hidden,false);
 ctx.elements.warehouseCategoryInput.value='Habilidades';
 ctx.elements.dialogRoot.dataset.warehouseId='';
 Object.assign(ctx.elements,{
  warehouseTitleInput:{value:'Golpe'},warehouseContentInput:{value:'Efeito direto'},
  warehouseVisibilityInput:{value:'published'},
  warehouseSummaryInput:{value:'Prévia'},warehouseTagsInput:{value:'Ofensivo'},
  warehouseCostInput:{value:'2 Alma'},
  warehouseImageInput:{value:'https://example.com/nao-deve-salvar.png'}
 });
 ctx.dispatch('click','','warehouse-save',{kind:'modal'});
 const post=ctx.db.site.warehouse.posts[0];
 assert.equal(post.category,'Habilidades');
 assert.equal(post.content,'Efeito direto');
 assert.equal(post.image,'');
});

test('três técnicas livres e três habilidades raciais constam do Armazém sem imagens',()=>{
 const ctx=setup();
 const source=ctx.window.ARQUIVO_HABILIDADES_CBB;
 const expected=[
  ['Mira Estável','Técnicas','2 ALMA','Ao realizar um ataque à distância sem ter se movimentado na rodada, aumente em 1 passo o dado da perícia utilizada no ataque.'],
  ['Disparo de Contenção','Técnicas','2 ALMA','Ao acertar um ataque à distância, reduza a movimentação do alvo pela metade até o próximo Desfecho.'],
  ['Fogo de Cobertura','Técnicas','3 ALMA','Quando um aliado dentro do alcance de seus disparos for alvo de um ataque, utilize sua reação para realizar um Teste-Clash de Precisão contra o agressor. Caso vença, interrompe o ataque inimigo.'],
  ['Instinto Primário','Habilidades','2 ALMA','Sua perícia Instinto passa a ser d10. Durante a criação da ficha, escolha três perícias que poderão ser substituídas por Instinto. Ao obter uma Falha Crítica em um teste de Instinto, perde sua reação da rodada. Caso já tenha utilizado sua reação, perde a da rodada seguinte.'],
  ['Hierro','Habilidades','2 ALMA','Ao sofrer um ataque que afete sua Vida, acrescente 1d6 à resistência de Vida até o término da fase. Esse dado é considerado uma proteção adicional.'],
  ['Sonído','Habilidades','2 ALMA','Ao se movimentar, dobre a distância percorrida e ignore bloqueios formados por criaturas durante o deslocamento.'],
  ['Cero','Habilidades','3 ALMA','Utilize sua ação principal na fase de Distância para realizar um ataque de Liberação, concentrando sua energia espiritual em um disparo. Ao acertar, acrescente 1d8 ao dano-base.']
 ];
 assert.equal(source.length,7);
 const ids=new Set();
 const published=ctx.window.ARQUIVO_SECOES.warehouse().posts;
 for(const [title,category,cost,description] of expected){
  const post=source.find(x=>x.title===title);
  assert.ok(post,title);
  assert.equal(post.category,category);
  assert.equal(post.cost,cost);
  assert.equal(post.content,description);
  assert.equal(post.summary,'');
  assert.equal(post.image,'');
  assert.equal(post.published,true);
  assert.equal(published.filter(x=>x.id===post.id).length,1);
  assert.ok(!ids.has(post.id),'IDs não podem repetir');
  ids.add(post.id);
  const markup=ctx.window.ARQUIVO_SECOES.warehousePage();
  const start=markup.indexOf('<article class="ae-warehouse-post ae-wh-ability-post" id="warehousePost-'+post.id+'">');
  const end=markup.indexOf('</article>',start);
  const card=start<0||end<0?'':markup.slice(start,end+10);
  assert.ok(card,'Cartão especial não encontrado: '+title);
  assert.doesNotMatch(card,/ae-wh-emblem|ae-warehouse-image|魂/);
  assert.ok(card.includes('CUSTO / USO'));
 }
 assert.equal(ctx.db.sheets.length,1,'Não deve alterar fichas de jogadores');
});

test('registro oficial pode ser editado, ocultado e substituído sem reaparecer em duplicidade',()=>{
 const ctx=setup(true);
 const id='tecnica-mira-estavel';
 ctx.db.site.warehouse.posts.push({id,title:'Mira Estável personalizada',category:'Técnicas',
  content:'Descrição editada pelo mestre',published:true,cost:'1 ALMA'});
 const records=ctx.window.ARQUIVO_SECOES.warehouse().posts.filter(x=>x.id===id);
 assert.equal(records.length,1);
 assert.equal(records[0].title,'Mira Estável personalizada');
 ctx.elements.dialogRoot.dataset.warehouseId=id;
 ctx.dispatch('click','','warehouse-delete',{kind:'modal'});
 assert.equal(ctx.window.ARQUIVO_SECOES.warehouse().posts.some(x=>x.id===id),false);
 assert.ok(ctx.db.site.warehouse.hiddenPosts.includes(id));
});

test('cadastro permite vincular habilidades a múltiplas raças e classes sem código especial',()=>{
 const ctx=setup(true);
 ctx.elements.dialogRoot.dataset.warehouseId='';
 Object.assign(ctx.elements,{
  warehouseTitleInput:{value:'Energia da Lua'},
  warehouseCategoryInput:{value:'Habilidades'},
  warehouseContentInput:{value:'Acrescenta uma energia a ataques espirituais.'},
  warehouseSummaryInput:{value:''},warehouseTagsInput:{value:'Espiritual'},
  warehouseVisibilityInput:{value:'published'},warehouseCostInput:{value:'2 ALMA'},
  warehouseImageInput:{value:''},warehouseGrantRaces:{value:'Arrancar, Quincy'},
  warehouseGrantClasses:{value:'Coração de Aço; Atirador'}
 });
 ctx.dispatch('click','','warehouse-save',{kind:'modal'});
 const post=ctx.db.site.warehouse.posts[0];
 assert.deepEqual(Array.from(post.grants.race),['Arrancar','Quincy']);
 assert.deepEqual(Array.from(post.grants.class),['Coração de Aço','Atirador']);
 assert.equal(post.category,'Habilidades');
 assert.equal(post.image,'');
 ctx.dispatch('click','','edit:'+encodeURIComponent(post.id),{kind:'warehouse'});
 assert.match(ctx.modal(),/warehouseGrantFields/);
 assert.match(ctx.modal(),/Arrancar, Quincy/);
 assert.match(ctx.modal(),/Coração de Aço, Atirador/);
});
