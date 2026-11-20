/* Arquivo Espiritual — Livros e Armazém.
   Os capítulos antigos continuam em db.rules; o Armazém usa db.site.warehouse.
   Nenhum dado de conteúdo é alterado ao trocar de seção. */
(function(){
 'use strict';
 const api=window.ARQUIVO_INTERNAL;
 if(!api)return;
 const BASE_CATEGORIES=['Classes','Habilidades','Técnicas','Itens','Outros'];
 let active='book1',selectedCategory='Todas',selectedTag='',search='',openedPost=null;
 const text=x=>String(x??'');
 const esc=x=>api.esc(x);
 const action=(label,key,style='small')=>'<button type="button" class="btn '+style+'" data-warehouse-action="'+key+'">'+label+'</button>';
 const posts=()=>warehouse().posts;
 // Compatibilidade com cópias antigas publicadas ou sincronizadas desta classe.
 // Corrige apenas trechos conhecidos; preserva edições personalizadas e não grava dados.
 function alignLegacyPortaVoz(post){
  if(post.id!=='classe-porta-voz')return post;
  let content=text(post.content);
  const original=content;
  const changes=[
   ['escolha dois aliados com quem tenha pelo menos Afinidade',
    'escolha dois aliados com os quais possua um Vínculo de grau I ou superior'],
   ['conforme o grau de relação com o Porta-voz',
    'conforme o grau de Vínculo de cada aliado com o Porta-voz (I: 1d6; II: 1d8; III: 1d12)'],
   ['O dado tem −1 passo e seu resultado',
    'O dado correspondente ao grau de Vínculo de cada aliado tem −1 passo e seu resultado'],
   ['Os aliados recebem um dado adicional na próxima defesa contra ataque inimigo.',
    'Os aliados recebem um dado adicional correspondente ao seu grau de Vínculo com o Porta-voz na próxima defesa contra ataque inimigo.'],
   ['\n\n> O valor do dado por grau de Afinidade depende das regras de criação de personagem ainda em desenvolvimento.','']
  ];
  for(const [from,to] of changes)content=content.replace(from,to);
  const staleLabel=post.damage?.label==='Dado de Afinidade (valor não definido)';
  if(content===original&&!staleLabel)return post;
  return {...post,content,...(staleLabel?
   {damage:{...post.damage,label:'Dado de Vínculo (grau I: d6; II: d8; III: d12)'}}:{})};
 }
 function warehouse(){
  const w=api.db.site?.warehouse;
  const defaults=[...(Array.isArray(window.ARQUIVO_CLASSES_CBB)?window.ARQUIVO_CLASSES_CBB:[]),
   ...(Array.isArray(window.ARQUIVO_HABILIDADES_CBB)?window.ARQUIVO_HABILIDADES_CBB:[])];
  const custom=Array.isArray(w?.posts)?w.posts.filter(p=>p&&typeof p==='object'&&!Array.isArray(p)):[];
  const hidden=new Set(Array.isArray(w?.hiddenPosts)?w.hiddenPosts:[]);
  const merged=new Map(defaults.filter(p=>p&&p.id&&!hidden.has(p.id)).map(p=>[p.id,p]));
  for(const post of custom)if(post.id)merged.set(post.id,post);
  const result=[...custom,...merged.values()].filter((p,i,arr)=>arr.findIndex(x=>x.id===p.id)===i&&!hidden.has(p.id)).map(alignLegacyPortaVoz);
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
 function warehouseAllowsImage(){return true;}
 function isPublished(p){return p.published!==false||api.master()}
 function safeImage(v){
  v=text(v).trim();
  return ((v.length<=1200&&/^https:\/\/[^\s"'<>]+$/i.test(v))||
   (v.length<=340000&&/^data:image\/(?:gif|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(v)))?v:'';
 }

 const fold=x=>text(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 function parseTags(raw){
  const seen=new Set(),items=Array.isArray(raw)?raw:text(raw).split(/[,;\n]/);
  return items.map(t=>text(t).trim().replace(/\s+/g,' ').slice(0,28)).filter(t=>{
   const key=fold(t);if(!key||seen.has(key))return false;seen.add(key);return true;
  }).slice(0,8);
 }
 function hiddenTagSet(post){return new Set((Array.isArray(post?.hiddenTags)?post.hiddenTags:[]).map(fold))}
 function visibleTags(post){
  const tags=parseTags(post?.tags);
  if(api.master())return tags;
  const hidden=hiddenTagSet(post);
  return tags.filter(tag=>!hidden.has(fold(tag)));
 }
 function tagIsHidden(post,tag){return hiddenTagSet(post).has(fold(tag))}
 function popularTags(){
  const map=new Map();
  for(const p of posts().filter(isPublished))for(const tag of visibleTags(p)){
   const key=fold(tag),value=map.get(key)||{tag,count:0};value.count++;map.set(key,value);
  }
  return [...map.values()].sort((a,b)=>b.count-a.count||a.tag.localeCompare(b.tag,'pt-BR')).slice(0,12);
 }
 function tagFilters(){
  const tags=popularTags(),hasFilter=!!search.trim()||!!selectedTag||selectedCategory!=='Todas';
  return '<div class="ae-wh-tag-filter"><div class="ae-wh-tag-filter-heading"><span>TAGS EM DESTAQUE</span>'+
   (hasFilter?'<button type="button" class="ae-wh-clear" data-warehouse-action="clear-filters">LIMPAR FILTROS</button>':'')+'</div>'+
   (tags.length?'<div class="ae-wh-tag-options" aria-label="Filtrar por tags">'+tags.map(({tag,count})=>
   '<button type="button" class="ae-wh-tag-option'+(fold(selectedTag)===fold(tag)?' is-active':'')+
   '" aria-pressed="'+(fold(selectedTag)===fold(tag))+'" data-warehouse-action="tag:'+encodeURIComponent(tag)+'">#'+esc(tag)+
   '<small>'+count+'</small></button>').join('')+'</div>':'<p class="ae-wh-tags-help">As tags das publicações aparecerão aqui.</p>')+'</div>';
 }
 function postDetail(post){
  return '<div class="ae-wh-detail-text">'+
   '<div class="ae-wh-detail-eyebrow">DESCRIÇÃO & FUNCIONAMENTO</div>'+
   '<div class="book-text ae-library-reading ae-warehouse-reading">'+
   api.formatBook(post.content||'',post.title||'Registro')+'</div></div>';
 }
 function visible(){
  const terms=fold(search).split(/\s+/).filter(Boolean);
  return posts().filter(p=>isPublished(p)&&(selectedCategory==='Todas'||p.category===selectedCategory)&&
   (!selectedTag||visibleTags(p).some(t=>fold(t)===fold(selectedTag)))&&
   (!terms.length||terms.every(term=>fold([p.title,p.summary,p.content,p.category,...visibleTags(p)].join(' ')).includes(term))));
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
  active=section;search='';selectedCategory='Todas';selectedTag='';openedPost=null;
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
 function isAbilityPost(post){return post.category==='Habilidades'||post.category==='Técnicas'}
 function abilityPlain(raw){
  return text(raw).replace(/\[\/?cor(?:=#[0-9a-f]{6})?\]/gi,'')
   .replace(/\[(?:barra|marca|contador|sequencia)(?::[^\]]*)?\]/gi,'[recurso]')
   .replace(/!\[([^\]]*)\]\([^)]+\)/g,'$1').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
   .replace(/[#>*_~\u0060]/g,'').replace(/\s+/g,' ').trim();
 }
 function abilityCard(post,opened){
  const id=text(post.id||''),category=text(post.category),title=text(post.title||'Sem título');
  const cost=text(post.cost).trim(),tags=visibleTags(post);
  const content=text(post.content||'Sem descrição.'),plain=abilityPlain(content);
  // Uma única habilidade: a descrição curta é exibida inteira; textos extensos
  // revelam um único efeito completo, sem segunda cópia do resumo.
  const long=plain.length>225||content.includes('\n');
  const preview=abilityPlain(post.summary)||plain;
  const teaser=preview.slice(0,230)+(preview.length>230?'…':'');
  const type=category==='Técnicas'?'TÉCNICA':'HABILIDADE';
  const readLabel=category==='Técnicas'?'LER TÉCNICA COMPLETA':'LER EFEITO COMPLETO';
  return '<article class="ae-warehouse-post ae-wh-ability-post'+(opened?' is-open':'')+'" id="warehousePost-'+esc(id)+'">'+
   '<div class="ae-wh-ability-main">'+
   '<h3 class="ae-wh-ability-title">'+esc(title)+'</h3>'+
   '<div class="ae-wh-ability-meta"><span>'+type+'</span>'+
   (cost?'<span>CUSTO / USO · '+esc(cost)+'</span>':'')+'</div>'+
   (long&&!opened?'<p class="ae-wh-ability-teaser">'+esc(teaser)+'</p>':'')+
   (!long||opened?'<div class="book-text ae-library-reading ae-wh-ability-description"'+
    (long?' id="warehouseBody-'+esc(id)+'"':'')+'>'+
    api.formatBook(content,title)+'</div>':
    '<div id="warehouseBody-'+esc(id)+'" hidden></div>')+
   '</div>'+
   (tags.length?'<div class="ae-warehouse-tags ae-wh-ability-tags" aria-label="Tags">'+tags.map(tag=>
    '<button type="button" class="'+(tagIsHidden(post,tag)?'is-hidden-tag':'')+'" data-warehouse-action="tag:'+encodeURIComponent(tag)+'" title="'+(tagIsHidden(post,tag)?'Tag oculta para jogadores: ':'Filtrar por ')+esc(tag)+'">#'+esc(tag)+(tagIsHidden(post,tag)?'<small> · SÓ MESTRE</small>':'')+'</button>').join('')+'</div>':'')+
   (post.published===false&&api.master()?'<p class="ae-warehouse-draft">RASCUNHO · OCULTO PARA JOGADORES</p>':'')+
   (long||api.master()?'<div class="ae-warehouse-actions ae-wh-ability-actions">':'')+
   (long?'<button type="button" class="ae-wh-ability-read" data-warehouse-action="open:'+encodeURIComponent(id)+
    '" aria-expanded="'+opened+'" aria-controls="warehouseBody-'+esc(id)+'">'+
    (opened?'RECOLHER DESCRIÇÃO':readLabel)+' <span aria-hidden="true">'+(opened?'−':'+')+'</span></button>':'')+
   (api.master()?action('EDITAR','edit:'+encodeURIComponent(id))+
    '<button type="button" class="btn small ae-wh-move" data-warehouse-action="move:'+encodeURIComponent(id)+':-1" aria-label="Mover '+esc(title)+' para cima" title="Mover para cima">↑</button>'+
    '<button type="button" class="btn small ae-wh-move" data-warehouse-action="move:'+encodeURIComponent(id)+':1" aria-label="Mover '+esc(title)+' para baixo" title="Mover para baixo">↓</button>':'')+
   (long||api.master()?'</div>':'')+'</article>';
 }
 function cards(){
  const found=visible();
  if(!found.length){
   const empty=!search.trim()&&selectedCategory==='Todas'&&!selectedTag;
   return '<div class="ae-warehouse-empty" role="status"><strong>'+
    (empty?'O Armazém ainda não possui publicações.':'Nenhuma publicação encontrada.')+'</strong><p>'+
    (empty&&api.master()?'Crie a primeira publicação e organize o acervo.':'Experimente outra tag, categoria ou pesquisa.')+'</p>'+
    (empty&&api.master()?action('+ NOVA PUBLICAÇÃO','edit:new','main'):'')+
    (!empty?action('LIMPAR FILTROS','clear-filters','small'):'')+'</div>';
  }
  return found.map((p,index)=>{
   const id=text(p.id||''),opened=openedPost===id,photo=safeImage(p.image);
   const summary=text(p.summary).trim(),cost=text(p.cost).trim(),tags=visibleTags(p);
   const category=text(p.category||'Outros');
   if(isAbilityPost(p))return abilityCard(p,opened);
   const abbr=({Classes:'CL',Itens:'IT'})[category]||'AR';
   return '<article class="ae-warehouse-post'+(opened?' is-open':'')+'" id="warehousePost-'+esc(id)+'">'+
    '<div class="ae-wh-post-accent" aria-hidden="true"></div>'+
    '<div class="ae-wh-post-heading"><div class="ae-wh-post-id"><span class="ae-wh-number">'+String(index+1).padStart(2,'0')+'</span>'+
    '<span class="ae-wh-kind">'+esc(category)+'</span></div>'+
    (cost?'<span class="ae-warehouse-cost">'+esc(cost)+'</span>':'')+'</div>'+
    '<div class="ae-wh-post-showcase">'+
    (photo?'<figure class="ae-warehouse-image"><img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+esc(photo)+'" alt="'+esc(p.title||'Imagem da publicação')+'"></figure>':
    '<div class="ae-wh-emblem" aria-hidden="true"><span>'+abbr+'</span><small>魂</small></div>')+
    '<div class="ae-wh-post-copy"><span class="ae-wh-file-label">ARQUIVO ESPIRITUAL / '+esc(category.toLocaleUpperCase('pt-BR'))+'</span>'+
    '<h3>'+esc(p.title||'Sem título')+'</h3>'+
    (summary?'<p class="ae-warehouse-summary">'+esc(summary)+'</p>':'<p class="ae-warehouse-summary ae-wh-summary-muted">Abra para consultar a descrição completa.</p>')+
    '</div></div>'+
    (tags.length?'<div class="ae-warehouse-tags" aria-label="Tags">'+tags.map(tag=>
    '<button type="button" class="'+(tagIsHidden(p,tag)?'is-hidden-tag':'')+'" data-warehouse-action="tag:'+encodeURIComponent(tag)+'" title="'+(tagIsHidden(p,tag)?'Tag oculta para jogadores: ':'Filtrar por ')+esc(tag)+'">#'+esc(tag)+(tagIsHidden(p,tag)?'<small> · SÓ MESTRE</small>':'')+'</button>').join('')+'</div>':'')+
    (p.published===false&&api.master()?'<p class="ae-warehouse-draft">RASCUNHO · OCULTO PARA JOGADORES</p>':'')+
    '<div class="ae-warehouse-actions"><button type="button" class="btn small ae-wh-read-btn" data-warehouse-action="open:'+encodeURIComponent(id)+
    '" aria-expanded="'+opened+'" aria-controls="warehouseBody-'+esc(id)+'">'+(opened?'RECOLHER REGISTRO':'CONSULTAR REGISTRO')+
    '<span aria-hidden="true">'+(opened?'−':'+')+'</span></button>'+
    (api.master()?action('EDITAR','edit:'+encodeURIComponent(id))+
     '<button type="button" class="btn small ae-wh-move" data-warehouse-action="move:'+encodeURIComponent(id)+':-1" aria-label="Mover '+esc(p.title)+' para cima" title="Mover para cima">↑</button>'+
     '<button type="button" class="btn small ae-wh-move" data-warehouse-action="move:'+encodeURIComponent(id)+':1" aria-label="Mover '+esc(p.title)+' para baixo" title="Mover para baixo">↓</button>':'')+'</div>'+
    '<section id="warehouseBody-'+esc(id)+'" class="ae-wh-expanded" aria-label="Detalhes de '+esc(p.title||'Publicação')+'"'+(opened?'':' hidden')+'>'+
    (opened?postDetail(p):'')+'</section></article>';
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
   '<div id="warehouseTagFilters">'+tagFilters()+'</div><div class="ae-warehouse-posts" id="warehousePosts">'+cards()+'</div></section>'+shelf()+'</div>';
 }
 function refresh(){
  const root=document.getElementById('warehousePosts');if(root)root.innerHTML=cards();
  const nav=document.getElementById('warehouseCategoryList');if(nav)nav.innerHTML=categoryMarkup();
  const count=document.getElementById('warehouseMatches');if(count){const n=visible().length;count.textContent=n+' '+(n===1?'publicação encontrada':'publicações encontradas')}
  const select=document.getElementById('warehouseCategorySelect');if(select)select.value=selectedCategory;
  const tags=document.getElementById('warehouseTagFilters');if(tags)tags.innerHTML=tagFilters();
 }

 function editorTagSuggestions(current){
  const used=new Set(parseTags(current).map(fold));
  const suggestions=popularTags().filter(({tag})=>!used.has(fold(tag))).slice(0,8);
  return '<div class="ae-wh-editor-suggest"><span>ADICIONAR RAPIDAMENTE</span><div>'+
   (suggestions.length?suggestions.map(({tag})=>
    '<button type="button" data-warehouse-editor="add-tag:'+encodeURIComponent(tag)+'">+ '+esc(tag)+'</button>').join(''):
    '<small>Digite as tags separadas por vírgulas.</small>')+'</div></div>';
 }

 function edit(raw){
  if(!api.master())return;
  let id='';try{id=raw==='new'?'':decodeURIComponent(raw)}catch{return}
  const w=warehouse(),found=w.posts.find(p=>p.id===id);
  if(id&&!found)return;
  const p=found||{title:'',category:w.categories[0],summary:'',content:'',image:'',cost:'',tags:'',published:true};
  const single=isAbilityPost(p),technique=p.category==='Técnicas';
  api.modal(id?'EDITAR PUBLICAÇÃO':'NOVA PUBLICAÇÃO',
   '<div class="ae-warehouse-editor ae-wh-simple-editor">'+
    '<div class="ae-wh-editor-intro"><span>EDIÇÃO DO ACERVO</span><strong>'+ (id?'Atualize os detalhes do registro':'Crie um novo registro')+'</strong>'+
    '<p>Preencha a identidade, a descrição e os detalhes opcionais da publicação.</p></div>'+
    '<section class="ae-wh-editor-section" aria-label="Informações principais"><div class="ae-wh-editor-section-title"><span>01</span><strong>IDENTIDADE</strong></div>'+
    '<label>Nome da publicação<input id="warehouseTitleInput" maxlength="100" required autofocus value="'+esc(p.title||'')+'" placeholder="Ex.: Especialista em Hohō"></label>'+
    '<div class="ae-warehouse-editor-row"><label>Categoria<select id="warehouseCategoryInput">'+w.categories.map(c=>
     '<option value="'+esc(c)+'"'+(p.category===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>'+
    '<label>Visibilidade<select id="warehouseVisibilityInput"><option value="published"'+(p.published===false?'':' selected')+'>Publicado para jogadores</option>'+
    '<option value="draft"'+(p.published===false?' selected':'')+'>Rascunho do mestre</option></select></label></div>'+
    '<label><span id="warehouseSummaryLabel">'+(single?'Prévia curta (opcional)':'Resumo para o cartão')+'</span>'+
     '<input id="warehouseSummaryInput" maxlength="280" value="'+esc(p.summary||'')+'" placeholder="'+
     (single?'Usada apenas quando a descrição precisar ser expandida':'O que esta publicação faz?')+'"></label>'+
    '<div class="ae-wh-editor-grants" id="warehouseGrantFields"'+(single?'':' hidden')+'>'+
     '<strong>CONCESSÃO AUTOMÁTICA</strong><p>Indique quais raças ou classes recebem esta habilidade automaticamente. Separe múltiplos nomes por vírgula.</p>'+
     '<div class="ae-wh-editor-grants-grid"><label>Raças contempladas<input id="warehouseGrantRaces" maxlength="300" value="'+
      esc((window.ARQUIVO_ORIGENS?.requirements?.(p).race||p.grants?.race||[]).join(', '))+'" placeholder="Ex.: Arrancar"></label>'+
     '<label>Classes contempladas<input id="warehouseGrantClasses" maxlength="300" value="'+
      esc((window.ARQUIVO_ORIGENS?.requirements?.(p).class||p.grants?.class||[]).join(', '))+'" placeholder="Ex.: Coração de Aço"></label></div></div>'+
    '<div class="ae-wh-editor-tags"><label>Tags <span class="ae-wh-field-helper">Separe por vírgulas · máximo de 8</span>'+
     '<input id="warehouseTagsInput" maxlength="220" value="'+esc(p.tags||'')+'" placeholder="Ex.: Mobilidade, Defesa, Hohō"></label>'+
    '<div id="warehouseTagPreview" class="ae-wh-editor-tag-preview">'+parseTags(p.tags).map(t=>
     '<button type="button" data-warehouse-editor="toggle-tag:'+encodeURIComponent(t)+'">#'+esc(t)+
     ' <small>'+(tagIsHidden(p,t)?'OCULTA':'VISÍVEL')+'</small></button>').join('')+'</div>'+
    '<p class="ae-wh-tag-visibility-help">Clique em uma tag para alternar entre visível e oculta aos jogadores.</p>'+
    editorTagSuggestions(p.tags)+'</div></section>'+
    '<section class="ae-wh-editor-section" aria-label="Descrição"><div class="ae-wh-editor-section-title"><span>02</span><strong>DESCRIÇÃO</strong></div>'+
    '<div class="ae-warehouse-compose" aria-label="Editor da publicação">'+
     '<div class="ae-warehouse-compose-heading"><strong id="warehouseContentHeading">'+
      (single?(technique?'DESCRIÇÃO DA TÉCNICA':'DESCRIÇÃO DA HABILIDADE'):'CONTEÚDO DA PUBLICAÇÃO')+
      '</strong><small>Escrita e pré-visualização</small></div>'+
     '<div class="ae-warehouse-editor-toolbar" role="toolbar" aria-label="Formatar publicação">'+
     '<button type="button" data-warehouse-editor="format:bold" title="Negrito (Ctrl+B)"><b>B</b></button>'+
     '<button type="button" data-warehouse-editor="format:italic" title="Itálico (Ctrl+I)"><em>I</em></button>'+
     '<button type="button" data-warehouse-editor="format:heading">TÍTULO</button>'+
     '<button type="button" data-warehouse-editor="format:list">LISTA</button>'+
     '<button type="button" data-warehouse-editor="format:quote">CITAÇÃO</button>'+
     '<label>COR <input id="warehouseEditorColor" type="color" value="#39D6F4" aria-label="Cor do trecho selecionado"></label>'+
     '<button type="button" data-warehouse-editor="format:color">COLORIR</button></div>'+
     '<div class="ae-warehouse-compose-templates"><label>MODELO<select id="warehouseEditorTemplate">'+
      '<option value="ability">Habilidade / técnica</option><option value="class">Classe</option>'+
      '<option value="item">Item</option><option value="rule">Regra / mecânica</option></select></label>'+
     '<button type="button" class="btn small" data-warehouse-editor="insert-template">INSERIR MODELO</button>'+
     '<label>DADO<select id="warehouseEditorDie">'+[4,6,8,10,12,14,16,18,20].map(n=>
       '<option value="'+n+'">d'+n+'</option>').join('')+'</select></label>'+
     '<button type="button" class="btn small" data-warehouse-editor="insert-die">INSERIR DADO</button>'+
     '<label>TIPO<select id="warehouseEditorResourceKind" aria-label="Tipo de representação"><option value="barra">Barra</option><option value="marca">Marca</option><option value="contador">Contador</option><option value="sequencia">Sequência</option></select></label>'+
      '<label>MARCAS<input id="warehouseEditorBarFilled" type="number" min="0" max="20" step="1" value="1" aria-label="Marcas preenchidas"></label>'+
     '<label>DE<input id="warehouseEditorBarTotal" type="number" min="1" max="20" step="1" value="3" aria-label="Total de marcas"></label>'+
     '<button type="button" class="btn small" data-warehouse-editor="insert-bar" title="Insere barra, marca, contador ou sequência visual no texto">INSERIR RECURSO</button></div>'+
     '<div class="ae-warehouse-compose-grid"><div class="ae-warehouse-compose-source">'+
     '<label for="warehouseContentInput"><span id="warehouseContentLabel">'+
      (single?(technique?'Descrição da técnica':'Descrição da habilidade'):'Texto completo')+'</span>'+
      '<textarea id="warehouseContentInput" rows="14" maxlength="20000" spellcheck="false" aria-describedby="warehouseEditorHint" placeholder="'+
      (single?'Descreva a ativação, os custos, o teste e o efeito desta única '+(technique?'técnica':'habilidade')+'.':
       '## Descrição\n\nExplique o funcionamento da publicação.')+'">'+esc(p.content||'')+'</textarea></label>'+
     '<p id="warehouseEditorHint" class="ae-cat-help">Selecione o texto para aplicar formatação. Ctrl+B e Ctrl+I também funcionam.</p></div>'+
     '<div class="ae-warehouse-compose-preview"><strong id="warehousePreviewHeading">'+
      (single?(technique?'EFEITO DA TÉCNICA':'EFEITO DA HABILIDADE'):'COMO SERÁ EXIBIDO')+'</strong>'+
     '<div class="book-text ae-library-reading" id="aeWarehouseEditorPreview" aria-live="polite">'+api.formatBook(p.content||'')+'</div></div></div>'+
     '<p class="ae-warehouse-editor-status" id="warehouseEditorStats" role="status">'+text(p.content||'').length+' caracteres · '+
      text(p.content||'').trim().split(/\s+/).filter(Boolean).length+' palavras</p></div></section>'+
    '<details class="ae-wh-editor-advanced"'+((p.cost||p.image)?' open':'')+'><summary><span class="ae-wh-adv-number">03</span>'+
     '<span><strong>DETALHES ADICIONAIS</strong><small id="warehouseAdvancedHint">'+
      (single?'Opcional · custo':'Opcional · custo e imagem')+'</small></span>'+
     '<span class="ae-wh-advanced-chevron" aria-hidden="true">⌄</span></summary>'+
     '<div class="ae-wh-editor-advanced-body"><label>Custo ou referência (opcional)<input id="warehouseCostInput" maxlength="45" value="'+esc(p.cost||'')+'" placeholder="Ex.: 2 Alma ou Sem custo"></label>'+
     '<div class="ae-warehouse-image-field" id="warehouseImageField"'+(single?' hidden':'')+'>'+
      '<div class="ae-wh-image-editor"><div class="ae-wh-image-thumbnail" id="warehouseImagePreview" aria-live="polite">'+
       (safeImage(p.image)?'<img src="'+esc(safeImage(p.image))+'" alt="Miniatura atual" loading="lazy">':'<span>CL</span>')+
       '</div><div class="ae-wh-image-fields"><label>Foto ou GIF para o quadrado pequeno'+
       '<input id="warehouseImageFile" type="file" accept="image/gif,image/png,image/jpeg,image/webp"></label>'+
       '<p>GIF animado até 200 KB; fotos serão reduzidas para a miniatura.</p>'+
       '<label>Ou cole uma URL HTTPS<input id="warehouseImageInput" type="url" maxlength="1200" value="'+esc(/^https:\/\//.test(p.image||'')?p.image:'')+
       '" placeholder="https://.../imagem.gif"></label>'+
       '<button type="button" class="btn small" data-warehouse-editor="remove-image">REMOVER ILUSTRAÇÃO</button>'+
       '</div></div></div>'+
     '</div></details></div>',
   [['SALVAR PUBLICAÇÃO','warehouse-save','main'],...(found?[['EXCLUIR','warehouse-delete','danger']]:[]),['CANCELAR','closeModal','small']]);
  document.getElementById('dialogRoot').dataset.warehouseId=id;
  window.ARQUIVO_EDITOR_ARMAZEM?.beginEdit?.(p);
  /* Os botões do modal são criados pelo aplicativo; redirecionamento no capturador abaixo. */
 }
 function savePost(){
  if(!api.master())return;
  const id=document.getElementById('dialogRoot').dataset.warehouseId||'',w=writable();
  const get=id=>text(document.getElementById(id)?.value).trim();
  const title=get('warehouseTitleInput'),content=get('warehouseContentInput'),category=get('warehouseCategoryInput');
  const previous=w.posts.find(p=>p.id===id),defaultPost=warehouse().posts.find(p=>p.id===id);
  const selectedImage=isAbilityPost({category})?'':window.ARQUIVO_EDITOR_ARMAZEM?.imageValue?.();
  const image=selectedImage===undefined?(get('warehouseImageInput')||text(previous?.image??defaultPost?.image??'')):selectedImage;
  if(image===null){api.toast('Imagem em processamento','Conclua a seleção da miniatura antes de salvar.',true);return}
  if(!title||title.length>100){api.toast('Título obrigatório','Informe até 100 caracteres.',true);return}
  if(!content){api.toast('Conteúdo obrigatório','Escreva o conteúdo da publicação.',true);return}
  if(!w.categories.includes(category)){api.toast('Categoria inválida','Selecione uma categoria ativa.',true);return}
  if(image&&!safeImage(image)){api.toast('Imagem inválida','Use uma URL HTTPS ou uma foto/GIF de tamanho reduzido.',true);return}
  if(!id&&w.posts.length>=300){api.toast('Limite do Armazém','Máximo de 300 publicações.',true);return}
  if(id&&!previous&&!defaultPost)return;
  const tags=parseTags(get('warehouseTagsInput'));
  const joinedTags=tags.join(', ');
  const hiddenTags=window.ARQUIVO_EDITOR_ARMAZEM?.readHiddenTags?.(tags)||
   (Array.isArray(previous?.hiddenTags)?previous.hiddenTags:[]).filter(x=>tags.some(t=>fold(t)===fold(x)));
  if(joinedTags.length>200){api.toast('Tags extensas','Reduza os nomes ou o número de tags.',true);return}
  const selectedVisibility=document.getElementById('warehouseVisibilityInput')?.value;
  const published=selectedVisibility?selectedVisibility==='published':!!document.getElementById('warehousePublishedInput')?.checked;
  let entry={...(defaultPost||{}),...(previous||{}),id:previous?.id||defaultPost?.id||api.uid(),title,category,
   summary:get('warehouseSummaryInput').slice(0,280),image,cost:get('warehouseCostInput').slice(0,45),
   tags:joinedTags,hiddenTags,content:content.slice(0,20000),published};
  if(isAbilityPost(entry)){
   const parseGrants=value=>value.split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean).slice(0,15);
   entry.grants={race:parseGrants(get('warehouseGrantRaces')),class:parseGrants(get('warehouseGrantClasses'))};
  }else delete entry.grants;
  entry=alignLegacyPortaVoz(entry);
  // Não levar o esquema aposentado do HUD para publicações editadas.
  delete entry.bars;
  if(previous){Object.assign(previous,entry);delete previous.bars}
  else w.posts.unshift(entry);
  w.hiddenPosts=w.hiddenPosts.filter(key=>key!==entry.id);
  openedPost=entry.id;selectedCategory='Todas';selectedTag='';search='';
  api.save();api.closeModal();api.render();api.toast('Publicação salva',title);
 }
 function removePost(){
  if(!api.master())return;
  const id=document.getElementById('dialogRoot').dataset.warehouseId||'',found=posts().find(p=>p.id===id);if(!found)return;
  api.confirmSite('EXCLUIR PUBLICAÇÃO','Remover "'+found.title+'" do Armazém? A exclusão não pode ser desfeita.',()=>{
   const w=writable();w.posts=w.posts.filter(p=>p.id!==id);
   if([...(window.ARQUIVO_CLASSES_CBB||[]),...(window.ARQUIVO_HABILIDADES_CBB||[])].some(p=>p.id===id)&&!w.hiddenPosts.includes(id))w.hiddenPosts.push(id);
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
  if(type==='clear-filters'){
   selectedCategory='Todas';selectedTag='';search='';openedPost=null;api.render();return;
  }
  if(type==='tag'){
   let value='';try{value=decodeURIComponent(parts.join(':'))}catch{return}
   selectedTag=fold(selectedTag)===fold(value)?'':value;openedPost=null;refresh();return;
  }
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
 window.ARQUIVO_SECOES={get active(){return active},set active(value){if(['book1','book2','warehouse'].includes(value))active=value},shelf,warehousePage,select,warehouse,getPost:id=>posts().find(p=>p.id===id),refresh,parseTags};
})();