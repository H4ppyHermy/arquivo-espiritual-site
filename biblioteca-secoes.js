/* Arquivo Espiritual — Livros e Armazém.
   Os capítulos antigos continuam em db.rules; o Armazém usa db.site.warehouse.
   Nenhum dado de conteúdo é alterado ao trocar de seção. */
(function(){
 'use strict';
 const api=window.ARQUIVO_INTERNAL;
 if(!api)return;
 const BASE_CATEGORIES=['Classes','Habilidades','Técnicas','Itens','Outros'];
 let active='book1',selectedCategory='Todas',search='',openedPost=null;
 const text=x=>String(x??'');
 const esc=x=>api.esc(x);
 const action=(label,key,style='small')=>'<button type="button" class="btn '+style+'" data-warehouse-action="'+key+'">'+label+'</button>';
 const posts=()=>warehouse().posts;
 function warehouse(){
  const w=api.db.site?.warehouse;
  const defaults=Array.isArray(window.ARQUIVO_CLASSES_CBB)?window.ARQUIVO_CLASSES_CBB:[];
  const custom=Array.isArray(w?.posts)?w.posts.filter(p=>p&&typeof p==='object'&&!Array.isArray(p)):[];
  const hidden=new Set(Array.isArray(w?.hiddenPosts)?w.hiddenPosts:[]);
  const merged=new Map(defaults.filter(p=>p&&p.id&&!hidden.has(p.id)).map(p=>[p.id,p]));
  for(const post of custom)if(post.id)merged.set(post.id,post);
  const result=[...custom,...merged.values()].filter((p,i,arr)=>arr.findIndex(x=>x.id===p.id)===i&&!hidden.has(p.id));
  const categories=Array.isArray(w?.categories)&&w.categories.length?w.categories.filter(x=>typeof x==='string'&&x.trim()).slice(0,25):BASE_CATEGORIES.slice();
  for(const post of result)if(!categories.includes(post.category)&&categories.length<25)categories.push(post.category);
  return {categories,posts:result};
 }
 function writable(){
  api.db.site??={};
  let w=api.db.site.warehouse;
  if(!w||typeof w!=='object'||Array.isArray(w))w=api.db.site.warehouse={};
  if(!Array.isArray(w.categories)||!w.categories.length)w.categories=[...BASE_CATEGORIES];
  if(!Array.isArray(w.posts))w.posts=[];
  if(!Array.isArray(w.hiddenPosts))w.hiddenPosts=[];
  return w;
 }
 function warehouseAllowsImage(category){
  return !['habilidades','habilidade','itens','item','técnicas','técnica','tecnicas','tecnica']
    .includes(text(category).trim().toLocaleLowerCase('pt-BR'));
 }
 function isPublished(p){return p.published!==false||api.master()}
 function safeImage(v){
  v=text(v).trim();
  return v.length<=1200&&/^https:\/\/[^\s"'<>]+$/i.test(v)?v:'';
 }
 function visible(){
  const term=search.toLocaleLowerCase('pt-BR').trim();
  return posts().filter(p=>isPublished(p)&&(selectedCategory==='Todas'||p.category===selectedCategory)&&
   (!term||[p.title,p.summary,p.content,p.category,p.tags].join(' ').toLocaleLowerCase('pt-BR').includes(term)));
 }
 function shelf(){
  const volumes=[
   ['book1','01','LIVRO 1','Fundamentos do sistema',api.db.rules.filter(r=>r.book!=='book2').length+' capítulos'],
   ['book2','02','LIVRO 2','Criação de personagem',api.db.rules.filter(r=>r.book==='book2').length+' capítulos'],
   ['warehouse','03','ARMAZÉM','Classes, habilidades e arquivos',posts().filter(isPublished).length+' publicações']
  ];
  return '<aside class="ae-library-shelf panel" aria-labelledby="aeShelfTitle">'+
   '<div class="ae-shelf-heading"><span class="ae-library-kicker">ACERVO</span><h2 id="aeShelfTitle">ESCOLHA UMA SEÇÃO</h2>'+
   '<p>Livros e registros da campanha.</p></div>'+
   '<nav class="ae-shelf-options" aria-label="Livros e Armazém">'+volumes.map(([id,number,name,description,total])=>
   '<button type="button" data-library-section="'+id+'" class="ae-shelf-option'+(active===id?' is-active':'')+'"'+
   (active===id?' aria-current="page"':'')+' aria-label="'+name+' — '+description+'">'+
   '<span class="ae-shelf-number">'+number+'</span><span class="ae-shelf-copy"><strong>'+name+'</strong><small>'+description+'</small>'+
   '<em>'+total+'</em></span><span class="ae-shelf-arrow" aria-hidden="true">›</span></button>').join('')+
   '</nav></aside>';
 }
 function select(section){
  if(!['book1','book2','warehouse'].includes(section)||active===section)return;
  active=section;search='';selectedCategory='Todas';openedPost=null;
  api.resetLibraryState();
  api.render();
 }
 function categoryMarkup(){
  const w=warehouse();
  return ['Todas',...w.categories].map(name=>{
   const n=w.posts.filter(p=>isPublished(p)&&(name==='Todas'||p.category===name)).length;
   return '<button type="button" class="ae-warehouse-category'+(selectedCategory===name?' is-active':'')+'" data-warehouse-action="category:'+encodeURIComponent(name)+'"'+
    (selectedCategory===name?' aria-current="true"':'')+'><span>'+esc(name)+'</span><small>'+n+'</small></button>';
  }).join('');
 }
 function cards(){
  const found=visible();
  if(!found.length){
   const empty=!search.trim()&&selectedCategory==='Todas';
   return '<div class="ae-warehouse-empty" role="status"><strong>'+
    (empty?'O Armazém ainda não possui publicações.':'Nenhuma publicação encontrada.')+'</strong><p>'+
    (empty&&api.master()?'Crie uma publicação e organize-a por categoria.':'Experimente outra pesquisa ou categoria.')+'</p>'+
    (empty&&api.master()?action('+ NOVA PUBLICAÇÃO','edit:new','main'):'')+'</div>';
  }
  return found.map(p=>{
   const id=text(p.id),opened=openedPost===id,photo=warehouseAllowsImage(p.category)?safeImage(p.image):'',summary=text(p.summary).trim(),cost=text(p.cost).trim();
   const tags=text(p.tags).split(',').map(x=>x.trim()).filter(Boolean).slice(0,5);
   return '<article class="ae-warehouse-post'+(opened?' is-open':'')+'" id="warehousePost-'+esc(id)+'">'+
    '<div class="ae-warehouse-post-head"><div><span class="ae-library-kicker">'+esc(p.category||'Outros')+'</span>'+
    '<h3>'+esc(p.title||'Sem título')+'</h3></div>'+(cost?'<span class="ae-warehouse-cost">'+esc(cost)+'</span>':'')+'</div>'+
    (photo?'<figure class="ae-warehouse-image"><img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+esc(photo)+'" alt="'+esc(p.title||'Imagem da publicação')+'"></figure>':'')+
    (summary?'<p class="ae-warehouse-summary">'+esc(summary)+'</p>':'')+
    (tags.length?'<div class="ae-warehouse-tags">'+tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>':'')+
    (p.published===false&&api.master()?'<p class="ae-warehouse-draft">RASCUNHO · OCULTO NA INTERFACE DO JOGADOR</p>':'')+
    '<div class="ae-warehouse-actions">'+action(opened?'RECOLHER':'LER PUBLICAÇÃO','open:'+encodeURIComponent(id))+
    (api.master()?action('EDITAR','edit:'+encodeURIComponent(id))+action('↑','move:'+encodeURIComponent(id)+':-1')+
     action('↓','move:'+encodeURIComponent(id)+':1'):'')+'</div>'+
    '<div class="ae-warehouse-reading book-text ae-library-reading" id="warehouseBody-'+esc(id)+'" role="region" aria-label="Conteúdo de '+esc(p.title)+'"'+(opened?'':' hidden')+'>'+
    (opened?api.formatBook(p.content||'',p.title||''):'')+'</div></article>';
  }).join('');
 }
 function warehousePage(){
  const count=visible().length,w=warehouse();
  return api.headline('ACERVO','ARMAZÉM','Classes, habilidades e outros registros da campanha.',
   api.master()?action('+ NOVA PUBLICAÇÃO','edit:new','main'):'')+
   '<div class="library-layout ae-library-layout ae-warehouse-layout">'+
   '<aside class="panel ae-library-index ae-warehouse-index" aria-labelledby="warehouseCategoriesTitle">'+
   '<div class="ae-library-index-heading"><div><span class="ae-library-kicker">NAVEGAÇÃO</span><h2 id="warehouseCategoriesTitle">CATEGORIAS</h2></div></div>'+
   '<p class="ae-lib-aside-help">Filtre os registros disponíveis.</p>'+
   '<nav id="warehouseCategoryList" aria-label="Categorias do Armazém">'+categoryMarkup()+'</nav>'+
   (api.master()?action('EDITAR CATEGORIAS','categories'):'')+'</aside>'+
   '<section class="library-body ae-warehouse-main" aria-label="Publicações do Armazém">'+
   '<div class="panel ae-library-search-panel ae-warehouse-search" role="search">'+
   '<div class="ae-library-search-header"><label for="warehouseSearch">Pesquisar no Armazém</label><span class="ae-library-search-shortcut" aria-hidden="true">/</span></div>'+
   '<div class="ae-library-search-row"><input id="warehouseSearch" type="search" autocomplete="off" placeholder="Buscar classes, habilidades ou títulos" value="'+esc(search)+'"></div>'+
   '<p id="warehouseMatches" class="ae-library-search-count" role="status" aria-live="polite">'+count+' '+(count===1?'publicação encontrada':'publicações encontradas')+'</p>'+
   '<div class="ae-warehouse-mobile-categories"><label for="warehouseCategorySelect">Categoria</label>'+
   '<select id="warehouseCategorySelect"><option value="Todas">Todas</option>'+w.categories.map(name=>'<option value="'+esc(name)+'"'+(selectedCategory===name?' selected':'')+'>'+esc(name)+'</option>').join('')+'</select></div>'+
   (api.master()?'<div class="ae-warehouse-mobile-manage">'+action('EDITAR CATEGORIAS','categories')+'</div>':'')+'</div>'+
   '<div class="ae-warehouse-posts" id="warehousePosts">'+cards()+'</div></section>'+shelf()+'</div>';
 }
 function refresh(){
  const root=document.getElementById('warehousePosts');if(root)root.innerHTML=cards();
  const nav=document.getElementById('warehouseCategoryList');if(nav)nav.innerHTML=categoryMarkup();
  const count=document.getElementById('warehouseMatches');if(count){const n=visible().length;count.textContent=n+' '+(n===1?'publicação encontrada':'publicações encontradas')}
  const select=document.getElementById('warehouseCategorySelect');if(select)select.value=selectedCategory;
 }
 function edit(raw){
  if(!api.master())return;
  let id='';try{id=raw==='new'?'':decodeURIComponent(raw)}catch{return}
  const w=warehouse(),found=w.posts.find(p=>p.id===id);
  if(id&&!found)return;
  const p=found||{title:'',category:w.categories[0],summary:'',content:'',image:'',cost:'',tags:'',published:true};
  api.modal(id?'EDITAR PUBLICAÇÃO':'NOVA PUBLICAÇÃO','<div class="ae-warehouse-editor">'+
   '<p class="subtitle">Registros publicados ou rascunhos ocultos na interface dos jogadores. Rascunhos ainda fazem parte dos dados sincronizados.</p>'+
   '<label>Título<input id="warehouseTitleInput" maxlength="100" required value="'+esc(p.title)+'" placeholder="Ex.: Shunpō"></label>'+
   '<div class="ae-warehouse-editor-row"><label>Categoria<select id="warehouseCategoryInput">'+w.categories.map(c=>'<option value="'+esc(c)+'"'+(p.category===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>'+
   '<label>Custo (opcional)<input id="warehouseCostInput" maxlength="45" value="'+esc(p.cost)+'" placeholder="Ex.: 2 ALMA"></label></div>'+
   '<label>Resumo<input id="warehouseSummaryInput" maxlength="280" value="'+esc(p.summary)+'" placeholder="Uma frase sobre a publicação"></label>'+
   '<div class="ae-warehouse-image-field" id="warehouseImageField"'+(warehouseAllowsImage(p.category)?'':' hidden')+'><label>Imagem (URL HTTPS)<input id="warehouseImageInput" type="url" maxlength="1200" value="'+esc(p.image||'')+'" placeholder="https://..."></label></div>'+
   '<label>Marcadores separados por vírgula<input id="warehouseTagsInput" maxlength="120" value="'+esc(p.tags)+'" placeholder="Mobilidade, Shinigami"></label>'+
   '<section class="ae-warehouse-compose" aria-label="Editor da publicação"><div class="ae-warehouse-compose-heading">'+
    '<strong>CONTEÚDO DA PUBLICAÇÃO</strong><small>Formatação e prévia ao vivo</small></div>'+
    '<div class="ae-warehouse-editor-toolbar" role="toolbar" aria-label="Formatar publicação">'+
    '<button type="button" data-warehouse-editor="format:bold" title="Negrito (Ctrl+B)"><b>B</b></button>'+
    '<button type="button" data-warehouse-editor="format:italic" title="Itálico (Ctrl+I)"><em>I</em></button>'+
    '<button type="button" data-warehouse-editor="format:heading">TÍTULO</button>'+
    '<button type="button" data-warehouse-editor="format:list">LISTA</button>'+
    '<button type="button" data-warehouse-editor="format:quote">CITAÇÃO</button>'+
    '<label>COR <input id="warehouseEditorColor" type="color" value="#39D6F4" aria-label="Cor do trecho selecionado"></label>'+
    '<button type="button" data-warehouse-editor="format:color">COLORIR</button></div>'+
    '<div class="ae-warehouse-compose-templates"><label>ESTRUTURA PRONTA<select id="warehouseEditorTemplate">'+
    '<option value="ability">Habilidade / técnica</option><option value="class">Classe</option>'+
    '<option value="item">Item</option><option value="rule">Regra / mecânica</option></select></label>'+
    '<button type="button" class="btn small" data-warehouse-editor="insert-template">INSERIR BLOCO</button>'+
    '<label>DADO<select id="warehouseEditorDie">'+[4,6,8,10,12,14,16,18,20].map(n=>'<option value="'+n+'">d'+n+'</option>').join('')+'</select></label>'+
    '<button type="button" class="btn small" data-warehouse-editor="insert-die">INSERIR DADO</button></div>'+
    '<div class="ae-warehouse-compose-grid"><div class="ae-warehouse-compose-source">'+
    '<label for="warehouseContentInput">Escrever conteúdo<textarea id="warehouseContentInput" rows="16" maxlength="20000" spellcheck="false" aria-describedby="warehouseEditorHint" placeholder="## Descrição\n\nExplique a classe, habilidade ou técnica.">'+esc(p.content)+'</textarea></label>'+
    '<p id="warehouseEditorHint" class="ae-cat-help">Selecione palavras e use os botões acima. Ctrl+B e Ctrl+I também funcionam.</p></div>'+
    '<div class="ae-warehouse-compose-preview"><strong>PRÉ-VISUALIZAÇÃO</strong>'+
    '<div class="book-text ae-library-reading" id="aeWarehouseEditorPreview" aria-live="polite">'+api.formatBook(p.content||'')+'</div></div></div>'+
    '<p class="ae-warehouse-editor-status" id="warehouseEditorStats" role="status">'+String(p.content||'').length+' caracteres · '+String(p.content||'').trim().split(/\s+/).filter(Boolean).length+' palavras</p>'+
    '</section>'+
   '<label class="ae-warehouse-publish"><input type="checkbox" id="warehousePublishedInput"'+(p.published===false?'':' checked')+'> Publicar para jogadores</label>'+'</div>',
   [['SALVAR','warehouse-save','main'],...(found?[['EXCLUIR','warehouse-delete','danger']]:[]),['CANCELAR','closeModal','small']]);
  document.getElementById('dialogRoot').dataset.warehouseId=id;
  /* Os botões do modal são criados pelo aplicativo; redirecionamento no capturador abaixo. */
 }
 function savePost(){
  if(!api.master())return;
  const id=document.getElementById('dialogRoot').dataset.warehouseId||'',w=writable();
  const get=id=>text(document.getElementById(id)?.value).trim();
  const title=get('warehouseTitleInput'),content=get('warehouseContentInput'),category=get('warehouseCategoryInput');
  const previous=w.posts.find(p=>p.id===id),defaultPost=warehouse().posts.find(p=>p.id===id);
  const image=warehouseAllowsImage(category)?get('warehouseImageInput'):text(previous?.image??defaultPost?.image??'');
  if(!title||title.length>100){api.toast('Título obrigatório','Informe até 100 caracteres.',true);return}
  if(!content){api.toast('Conteúdo obrigatório','Escreva o conteúdo da publicação.',true);return}
  if(!w.categories.includes(category)){api.toast('Categoria inválida','Selecione uma categoria ativa.',true);return}
  if(image&&!safeImage(image)){api.toast('Imagem inválida','Informe um endereço HTTPS direto.',true);return}
  if(!id&&w.posts.length>=300){api.toast('Limite do Armazém','Máximo de 300 publicações.',true);return}
  if(id&&!previous&&!defaultPost)return;
  const entry={...(defaultPost||{}),...(previous||{}),id:previous?.id||defaultPost?.id||api.uid(),title,category,
   summary:get('warehouseSummaryInput').slice(0,280),image,cost:get('warehouseCostInput').slice(0,45),
   tags:get('warehouseTagsInput').slice(0,120),content:content.slice(0,20000),
   published:!!document.getElementById('warehousePublishedInput')?.checked};
  if(previous)Object.assign(previous,entry);else w.posts.unshift(entry);
  w.hiddenPosts=w.hiddenPosts.filter(key=>key!==entry.id);
  openedPost=entry.id;selectedCategory='Todas';search='';
  api.save();api.closeModal();api.render();api.toast('Publicação salva',title);
 }
 function removePost(){
  if(!api.master())return;
  const id=document.getElementById('dialogRoot').dataset.warehouseId||'',found=posts().find(p=>p.id===id);if(!found)return;
  api.confirmSite('EXCLUIR PUBLICAÇÃO','Remover "'+found.title+'" do Armazém? A exclusão não pode ser desfeita.',()=>{
   const w=writable();w.posts=w.posts.filter(p=>p.id!==id);
   if((window.ARQUIVO_CLASSES_CBB||[]).some(p=>p.id===id)&&!w.hiddenPosts.includes(id))w.hiddenPosts.push(id);
   if(openedPost===id)openedPost=null;
   api.save();api.render();api.toast('Publicação excluída');
  });
 }
 function move(raw,direction){
  if(!api.master()||![-1,1].includes(direction))return;
  let id='';try{id=decodeURIComponent(raw)}catch{return}
  const w=writable();if(!w.posts.some(p=>p.id===id))w.posts=warehouse().posts.map(x=>({...x}));
  const i=w.posts.findIndex(p=>p.id===id),j=i+direction;
  if(i<0||j<0||j>=w.posts.length)return;
  [w.posts[i],w.posts[j]]=[w.posts[j],w.posts[i]];
  api.save();refresh();
 }
 function categories(){
  if(!api.master())return;
  api.modal('CATEGORIAS DO ARMAZÉM','<div class="ae-warehouse-editor">'+
   '<p class="subtitle">Uma categoria por linha. Para excluir uma categoria, primeiro reclassifique suas publicações.</p>'+
   '<label>Categorias<textarea id="warehouseCategoriesInput" rows="9" maxlength="1000">'+esc(warehouse().categories.join('\n'))+'</textarea></label></div>',
   [['SALVAR CATEGORIAS','warehouse-save-categories','main'],['CANCELAR','closeModal','small']]);
 }
 function saveCategories(){
  if(!api.master())return;
  const items=text(document.getElementById('warehouseCategoriesInput')?.value).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!items.length||items.length>25||items.some(x=>x.length>30)){
   api.toast('Categorias inválidas','De 1 a 25 categorias, com até 30 caracteres cada.',true);return;
  }
  if(new Set(items.map(s=>s.toLocaleLowerCase('pt-BR'))).size!==items.length||items.some(x=>x.toLocaleLowerCase('pt-BR')==='todas')){
   api.toast('Nome duplicado','Não repita nomes nem use "Todas".',true);return;
  }
  const used=new Set(posts().map(p=>p.category).filter(Boolean));
  const blocked=[...used].filter(name=>!items.includes(name));
  if(blocked.length){api.toast('Categorias em uso','Reclassifique antes de remover: '+blocked.join(', '),true);return}
  writable().categories=items;selectedCategory='Todas';
  api.save();api.closeModal();api.render();api.toast('Categorias atualizadas');
 }
 function use(action){
  const [type,...parts]=action.split(':');
  if(type==='edit')edit(parts.join(':'));
  if(type==='save')savePost();
  if(type==='delete')removePost();
  if(type==='move')move(parts[0],Number(parts[1]));
  if(type==='categories')categories();
  if(type==='save-categories')saveCategories();
  if(type==='category'){
   let value='';try{value=decodeURIComponent(parts.join(':'))}catch{return}
   if(value!=='Todas'&&!warehouse().categories.includes(value))return;
   selectedCategory=value;openedPost=null;refresh();
  }
  if(type==='open'){
   let value='';try{value=decodeURIComponent(parts.join(':'))}catch{return}
   if(!visible().some(p=>p.id===value))return;
   openedPost=openedPost===value?null:value;refresh();
   if(openedPost)requestAnimationFrame(()=>document.getElementById('warehousePost-'+value)?.scrollIntoView({block:'nearest',behavior:'smooth'}));
  }
 }
 document.addEventListener('click',event=>{
  const shelf=event.target.closest('[data-library-section]');
  if(shelf){event.preventDefault();select(shelf.dataset.librarySection);return}
  const button=event.target.closest('[data-warehouse-action]');
  if(button){event.preventDefault();use(button.dataset.warehouseAction);return}
 },true);
 /* Os modais do aplicativo despacham data-action e precisam ser interceptados antes do tratamento genérico. */
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');
  if(!button)return;
  if(button.dataset.action==='warehouse-save'||button.dataset.action==='warehouse-delete'||button.dataset.action==='warehouse-save-categories'){
   event.preventDefault();event.stopImmediatePropagation();
   use(button.dataset.action.replace(/^warehouse-/,'')); // save, delete ou save-categories
  }
 },true);
 document.addEventListener('input',event=>{
  if(event.target.id==='warehouseSearch'){search=event.target.value;refresh()}
 });
 document.addEventListener('change',event=>{
  if(event.target.id==='warehouseCategorySelect'){
   selectedCategory=event.target.value;openedPost=null;refresh();
  }
  if(event.target.id==='warehouseCategoryInput'){
   const field=document.getElementById('warehouseImageField');
   if(field)field.hidden=!warehouseAllowsImage(event.target.value);
  }
 });
 window.ARQUIVO_SECOES={get active(){return active},set active(value){if(['book1','book2','warehouse'].includes(value))active=value},shelf,warehousePage,select,warehouse,getPost:id=>posts().find(p=>p.id===id),refresh};
})();