/* BLEACH CBB — Acervo compartilhado e HUDs manuais.
   Nenhuma publicação executa automaticamente dano, cura ou regras de combate. */
(function(){
 'use strict';
 const api=window.ARQUIVO_INTERNAL;
 if(!api)return;
 const esc=value=>api.esc(value);
 const safeInt=(value,min,max,fallback=min)=>{
  const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;
 };
 const kinds={none:'Sem dado',damage:'Dano',reduction:'Redução de dano',bonus:'Bônus',healing:'Recuperação'};
 const faces=[0,2,4,6,8,10,12,14,16,18,20];
 let selectedPostId='',transferBusy=false;

 function getPost(id){return window.ARQUIVO_SECOES?.getPost(id)||null}
 function barDefs(post){
  return (Array.isArray(post?.bars)?post.bars:[]).slice(0,8).filter(x=>x&&typeof x==='object').map((x,i)=>{
   const max=safeInt(x.max,1,20,1);
   return {id:String(x.id||'barra-'+i).slice(0,70),label:String(x.label||'Barra').slice(0,65),
    max,initial:safeInt(x.initial,0,max,0),reset:x.reset==='scene'?'scene':'manual',
    description:String(x.description||'').slice(0,500)};
  });
 }
 function notation(post){
  const dice=post?.damage;if(!dice||dice.kind==='none')return '';
  const kind=kinds[dice.kind]||'Dado',count=safeInt(dice.count,1,6,1),n=Number(dice.faces);
  return (Number.isInteger(n)&&n>=2?' '+count+'d'+n:' · dado a definir')+' · '+kind+
   (dice.label?' · '+String(dice.label).slice(0,65):'');
 }
 function extraMarkup(post){
  const bars=barDefs(post);
  if(!bars.length&&!post.damage)return '';
  return '<div class="ae-catalog-meta">'+bars.map(b=>
   '<span>'+esc(b.label)+' · '+b.max+' '+(b.max===1?'marca':'marcas')+'</span>').join('')+
   (post.damage&&post.damage.kind!=='none'?'<span>'+esc(notation(post).trim())+'</span>':'')+'</div>';
 }
 function actionMarkup(post){
  if(!api.db.sheets.some(s=>api.canEditSheet(s.id)&&!s.redacted))return '';
  if(post.published===false&&!api.master())return '';
  return '<button type="button" class="btn small ae-catalog-send" data-cat-action="attach:'+encodeURIComponent(post.id)+'" title="Copiar esta publicação para uma ficha que você pode editar">+ ENVIAR À FICHA</button>';
 }
 function barEditorRow(x={},index=0){
  const max=safeInt(x.max,1,20,3),initial=safeInt(x.initial,0,max,0);
  return '<div class="ae-catalog-bar-editor" data-bar-id="'+esc(String(x.id||''))+'">'+
   '<div class="ae-cat-bar-head"><strong>BARRA '+(index+1)+'</strong><button type="button" class="btn small danger" data-cat-action="remove-editor-bar">REMOVER</button></div>'+
   '<div class="ae-catalog-editor-grid">'+
   '<label>Nome<input class="ae-cat-bar-name" maxlength="65" placeholder="Ex.: Têmpera" value="'+esc(x.label||'')+'"></label>'+
   '<label>Máximo<input class="ae-cat-bar-max" type="number" min="1" max="20" step="1" value="'+max+'"></label>'+
   '<label>Valor inicial<input class="ae-cat-bar-initial" type="number" min="0" max="20" step="1" value="'+initial+'"></label>'+
   '<label>Ao começar uma cena<select class="ae-cat-bar-reset"><option value="manual"'+(x.reset==='scene'?'':' selected')+'>Manter valor (manual)</option><option value="scene"'+(x.reset==='scene'?' selected':'')+'>Restaurar valor inicial</option></select></label></div>'+
   '<label>Instruções de uso<textarea class="ae-cat-bar-help" maxlength="500" rows="2" placeholder="Quando ganhar ou gastar marcas e quais são os efeitos.">'+esc(x.description||'')+'</textarea></label></div>';
 }
 function editorFields(post){
  const dice=post?.damage||{},mode=kinds[dice.kind]?dice.kind:'none',configuredFaces=faces.includes(Number(dice.faces))?Number(dice.faces):0;
  return '<section class="ae-catalog-extra-editor" aria-label="Dados e HUD do Armazém">'+
   '<div class="ae-cat-editor-title"><strong>DADOS & MARCADORES</strong><p>Configure referências mecânicas. O site não aplica resultados automaticamente.</p></div>'+
   '<div class="ae-catalog-editor-grid"><label>Tipo de dado<select id="aeCatalogDieKind">'+
   Object.entries(kinds).map(([k,name])=>'<option value="'+k+'"'+(mode===k?' selected':'')+'>'+esc(name)+'</option>').join('')+
   '</select></label><label>Dado<select id="aeCatalogDieFaces">'+faces.map(n=>
   '<option value="'+n+'"'+(configuredFaces===n?' selected':'')+'>'+(n?'d'+n:'A definir')+'</option>').join('')+'</select></label>'+
   '<label>Quantidade<input id="aeCatalogDieCount" type="number" min="1" max="6" value="'+safeInt(dice.count,1,6,1)+'"></label>'+
   '<label>Observação<input id="aeCatalogDieLabel" maxlength="65" value="'+esc(dice.label||'')+'" placeholder="Ex.: reduzir o dano recebido"></label></div>'+
   '<div class="ae-cat-editor-title"><strong>BARRAS PERSONALIZADAS</strong><p>Até 8 barras, cada uma com 1 a 20 espaços, valor inicial e reinício por cena ou manual.</p></div>'+
   '<div id="aeCatalogBarRows" class="ae-cat-bar-list">'+barDefs(post).map(barEditorRow).join('')+'</div>'+
   '<button type="button" class="btn small" data-cat-action="add-editor-bar">+ NOVA BARRA</button>'+
   '<p class="ae-cat-help">Barras são controladas pela ficha com +/−. O mestre decide quando aplicar os efeitos narrativos.</p>'+
   '</section>';
 }
 function readEditorExtra(){
  const kind=document.getElementById('aeCatalogDieKind')?.value||'none';
  const count=Number(document.getElementById('aeCatalogDieCount')?.value||1);
  const d=Number(document.getElementById('aeCatalogDieFaces')?.value||0);
  if(!(kind in kinds))throw Error('Escolha um tipo de dado válido.');
  if(!Number.isInteger(count)||count<1||count>6||!faces.includes(d))throw Error('Dado inválido: escolha faces permitidas e 1–6 unidades.');
  const rows=[...document.querySelectorAll('#aeCatalogBarRows .ae-catalog-bar-editor')];
  if(rows.length>8)throw Error('Máximo de 8 barras por publicação.');
  const ids=new Set(),bars=rows.map((row,i)=>{
   const label=String(row.querySelector('.ae-cat-bar-name')?.value||'').trim(),
    max=Number(row.querySelector('.ae-cat-bar-max')?.value),
    initial=Number(row.querySelector('.ae-cat-bar-initial')?.value);
   if(!label||label.length>65)throw Error('Dê um nome de até 65 caracteres à barra '+(i+1)+'.');
   if(!Number.isInteger(max)||max<1||max>20||!Number.isInteger(initial)||initial<0||initial>max)
    throw Error('Valores inválidos na barra '+label+'. O inicial deve estar entre 0 e o máximo.');
   const id=row.dataset.barId||api.uid();
   if(ids.has(id))throw Error('Identificadores duplicados de barra.');ids.add(id);
   return {id,label,max,initial,reset:row.querySelector('.ae-cat-bar-reset')?.value==='scene'?'scene':'manual',
    description:String(row.querySelector('.ae-cat-bar-help')?.value||'').trim().slice(0,500)};
  });
  return {bars,damage:kind==='none'?null:{kind,count,faces:d,label:String(document.getElementById('aeCatalogDieLabel')?.value||'').trim().slice(0,65)}};
 }
 function sheetEntries(sheet){return Array.isArray(sheet?.catalogEntries)?sheet.catalogEntries:[]}
 function entryPost(entry){
  if(!entry)return null;
  const published=getPost(entry.sourceId);
  return published&&published.published!==false?published:(entry.snapshot||entry);
 }
 function stateKey(id,bar){return id+'/'+bar}
 function valueFor(sheet,post,bar){
  const value=sheet?.inventory?.catalogBars?.[stateKey(post.id,bar.id)];
  return Number.isInteger(Number(value))&&value!==undefined&&value!==null?safeInt(value,0,bar.max,bar.initial):bar.initial;
 }
 function renderBars(sheet,post){
  const bars=barDefs(post),allowed=api.canEditSheet(sheet.id);
  if(!bars.length)return '';
  return '<div class="ae-catalog-bars">'+bars.map(b=>{
   const n=valueFor(sheet,post,b);
   const base='bar:'+encodeURIComponent(post.id)+':'+encodeURIComponent(b.id)+':';
   return '<section class="ae-catalog-bar" aria-label="'+esc(b.label)+'">'+
    '<div class="ae-catalog-bar-heading"><strong>'+esc(b.label)+'</strong><span>'+n+' / '+b.max+'</span></div>'+
    '<div class="ae-catalog-bar-meter" role="meter" aria-label="'+esc(b.label)+'" aria-valuemin="0" aria-valuemax="'+b.max+'" aria-valuenow="'+n+'">'+
    Array.from({length:b.max},(_,i)=>'<span class="'+(i<n?'filled':'')+'" aria-hidden="true"></span>').join('')+'</div>'+
    (b.description?'<p>'+esc(b.description)+'</p>':'')+
    (allowed?'<div class="ae-catalog-bar-actions"><button type="button" class="btn small" data-cat-action="'+base+'-1"'+(!n?' disabled':'')+' aria-label="Gastar uma marca de '+esc(b.label)+'">− GASTAR</button>'+
     '<button type="button" class="btn small" data-cat-action="'+base+'1"'+(n>=b.max?' disabled':'')+' aria-label="Ganhar uma marca de '+esc(b.label)+'">+ GANHAR</button></div>':'')+
    '</section>';
  }).join('')+'</div>';
 }
 function sheetPanel(sheet){
  const entries=sheetEntries(sheet),can=api.canEditSheet(sheet.id);
  const reset=entries.some(e=>barDefs(entryPost(e)).some(b=>b.reset==='scene'));
  return '<section class="ae-catalog-sheet"><div class="panel"><div class="sectionhead"><h2>ACERVO DA FICHA</h2><span class="tag">'+entries.length+' REGISTROS</span></div>'+
   '<p class="subtitle">Registros transferidos do Armazém. O conteúdo e os marcadores são manuais; nenhuma regra antiga é aplicada automaticamente.</p>'+
   '<div class="actions">'+(can?'<button type="button" class="btn small main" data-cat-action="open-warehouse">CONSULTAR ARMAZÉM</button>':'')+
    (can&&reset?'<button type="button" class="btn small" data-cat-action="scene-reset">NOVA CENA · REINICIAR BARRAS</button>':'')+'</div></div>'+
   (entries.length?entries.map(entry=>{
    const p=entryPost(entry),title=String(p.title||entry.title||'Registro'),category=String(p.category||entry.category||'Outros');
    const image=typeof p.image==='string'&&/^https:\/\/[^\s"'<>]+$/.test(p.image)?p.image:'';
    return '<article class="panel ae-catalog-sheet-entry">'+
     '<div class="sectionhead"><div><span class="ae-library-kicker">'+esc(category)+'</span><h2>'+esc(title)+'</h2></div>'+
      (can?'<button type="button" class="btn small danger" data-cat-action="remove:'+encodeURIComponent(entry.sourceId)+'">REMOVER DA FICHA</button>':'')+'</div>'+
     (image?'<img class="ae-catalog-sheet-image" loading="lazy" decoding="async" src="'+esc(image)+'" alt="'+esc(title)+'">':'')+
     (p.summary?'<p class="subtitle">'+esc(p.summary)+'</p>':'')+
     (p.damage?'<div class="ae-catalog-dice-reference">DADO CONFIGURADO · '+esc(notation(p).trim())+' <span>(rolagem manual)</span></div>':'')+
     renderBars(sheet,{...p,id:entry.sourceId})+
     '<details class="ae-catalog-sheet-details"><summary>LER DESCRIÇÃO COMPLETA</summary><div class="book-text ae-library-reading">'+api.formatBook(p.content||'',title)+'</div></details>'+
    '</article>';
   }).join(''):'<section class="panel ae-catalog-sheet-empty"><p>Esta ficha ainda não possui registros do Armazém.</p>'+
    (can?'<button type="button" class="btn main" data-cat-action="open-warehouse">EXPLORAR ARMAZÉM</button>':'')+'</section>')+'</section>';
 }
 function summaryHud(sheet){
  const entries=sheetEntries(sheet).filter(e=>barDefs(entryPost(e)).length);
  if(!entries.length)return '';
  return '<section class="panel ae-catalog-summary"><div class="sectionhead"><h2>BARRAS DO ACERVO</h2>'+
   '<button class="btn small" type="button" data-cat-action="view-sheet-catalog">ABRIR ACERVO</button></div>'+
   entries.map(e=>'<div class="ae-catalog-summary-entry"><strong>'+esc(e.title)+'</strong>'+
    renderBars(sheet,{...entryPost(e),id:e.sourceId})+'</div>').join('')+'</section>';
 }
 function ownedSheets(){
  return (api.db.sheets||[]).filter(s=>s&&!s.redacted&&api.canEditSheet(s.id));
 }
 function selectTarget(id){
  const post=getPost(id);
  if(!post||post.published===false&&!api.master()){api.toast('Registro indisponível','Não é possível transferir esta publicação.',true);return}
  const available=ownedSheets();
  if(!available.length){api.toast('Nenhuma ficha editável','Entre com uma chave vinculada a uma ficha.',true);return}
  selectedPostId=id;
  if(available.length===1){transfer(available[0].id,id);return}
  api.modal('ENVIAR AO PERSONAGEM','<div class="ae-catalog-transfer">'+
   '<p>Escolha a ficha que receberá <b>'+esc(post.title)+'</b>.</p>'+
   '<label>Ficha de destino<select id="aeCatalogTarget">'+available.map(s=>
    '<option value="'+esc(s.id)+'"'+(s.id===api.currentSheet?' selected':'')+'>'+esc(s.name||'Personagem')+'</option>').join('')+
    '</select></label></div>',
    [['ADICIONAR À FICHA','catalog-transfer','main'],['CANCELAR','closeModal','small']]);
 }
 async function transfer(sheetId,postId){
  if(transferBusy)return;
  const post=getPost(postId),source=api.db.sheets.find(s=>s.id===sheetId);
  if(!post||!source||!api.canEditSheet(sheetId)||post.published===false&&!api.master())return;
  if(sheetEntries(source).some(e=>e.sourceId===postId)){api.toast('Já instalado','Esse registro já está na ficha.');return}
  const existingClass=post.category==='Classes'?sheetEntries(source).find(e=>e.category==='Classes'):null;
  if(existingClass){
   api.confirmSite('SUBSTITUIR CLASSE','Esta ficha já possui a classe "'+existingClass.title+'". Substituir por "'+post.title+'"?',
    ()=>applyTransfer(sheetId,postId,existingClass.sourceId));
   return;
  }
  await applyTransfer(sheetId,postId,null);
 }
 async function persistSheet(sheetId,modify){
  const current=api.db.sheets.find(s=>s.id===sheetId);
  if(!current||!api.canEditSheet(sheetId))throw Error('Ficha sem permissão de edição.');
  const next=JSON.parse(JSON.stringify(current));
  modify(next);
  const sync=window.ARQUIVO_SYNC;
  if(sync?.state.enabled&&!api.master()){
   const result=await sync.saveOwnedSheet(next);
   const ix=api.db.sheets.findIndex(s=>s.id===sheetId);
   if(ix>=0)api.db.sheets[ix]=result;
   await sync.refresh(true);
  }else{
   const ix=api.db.sheets.findIndex(s=>s.id===sheetId);
   if(ix>=0)api.db.sheets[ix]=next;
   api.save();
  }
 }
 async function applyTransfer(sheetId,postId,replaceId){
  if(transferBusy)return;
  const post=getPost(postId);if(!post)return;
  transferBusy=true;
  try{
   await persistSheet(sheetId,sheet=>{
    sheet.catalogEntries=sheetEntries(sheet).filter(x=>x.sourceId!==replaceId);
    sheet.inventory??={items:[],currencies:[]};
    sheet.inventory.catalogBars??={};
    if(replaceId)for(const key of Object.keys(sheet.inventory.catalogBars))
     if(key.startsWith(replaceId+'/'))delete sheet.inventory.catalogBars[key];
    const snapshot=JSON.parse(JSON.stringify(post));
    sheet.catalogEntries.push({sourceId:post.id,title:post.title,category:post.category,snapshot});
    for(const bar of barDefs(post))sheet.inventory.catalogBars[stateKey(post.id,bar.id)]=bar.initial;
   });
   api.closeModal();api.goCatalogSheet(sheetId);
   api.toast('Enviado à ficha',post.title+' foi adicionado ao Acervo do personagem.');
  }catch(error){api.toast('Não foi possível transferir',error.message,true)}
  finally{transferBusy=false}
 }
 function adjustBar(id,barId,delta){
  const sheet=api.db.sheets.find(s=>s.id===api.currentSheet);
  if(!sheet||!api.canEditSheet(sheet.id)||![-1,1].includes(delta))return;
  const entry=sheetEntries(sheet).find(e=>e.sourceId===id);
  if(!entry)return;
  const bar=barDefs(entryPost(entry)).find(x=>x.id===barId);
  if(!bar)return;
  sheet.inventory??={items:[],currencies:[]};sheet.inventory.catalogBars??={};
  const old=valueFor(sheet,{id},bar),next=Math.max(0,Math.min(bar.max,old+delta));
  if(next===old)return;
  sheet.inventory.catalogBars[stateKey(id,barId)]=next;
  api.save();api.render();
 }
 function resetScene(){
  const sheet=api.db.sheets.find(s=>s.id===api.currentSheet);
  if(!sheet||!api.canEditSheet(sheet.id))return;
  api.confirmSite('NOVA CENA','Restaurar ao valor inicial somente as barras configuradas para reiniciar a cada cena?',()=>{
   sheet.inventory??={items:[],currencies:[]};sheet.inventory.catalogBars??={};
   for(const entry of sheetEntries(sheet))for(const bar of barDefs(entryPost(entry)))
    if(bar.reset==='scene')sheet.inventory.catalogBars[stateKey(entry.sourceId,bar.id)]=bar.initial;
   api.save();api.render();api.toast('Barras reiniciadas','Nova cena registrada manualmente.');
  });
 }
 function removeFromSheet(id){
  const sheet=api.db.sheets.find(s=>s.id===api.currentSheet);
  if(!sheet||!api.canEditSheet(sheet.id))return;
  const item=sheetEntries(sheet).find(e=>e.sourceId===id);
  if(!item)return;
  api.confirmSite('REMOVER DO ACERVO','Remover "'+item.title+'" desta ficha? Os dados da publicação original não serão alterados.',async()=>{
   transferBusy=true;
   try{
    await persistSheet(sheet.id,next=>{
     next.catalogEntries=sheetEntries(next).filter(e=>e.sourceId!==id);
     if(next.inventory?.catalogBars)for(const key of Object.keys(next.inventory.catalogBars))
      if(key.startsWith(id+'/'))delete next.inventory.catalogBars[key];
    });
    api.render();api.toast('Registro removido',item.title);
   }catch(error){api.toast('Não foi possível remover',error.message,true)}
   finally{transferBusy=false}
  });
 }
 function editorUpdatePreview(){
  const area=document.getElementById('warehouseContentInput');if(!area)return;
  const preview=document.getElementById('aeWarehouseEditorPreview');
  if(preview)preview.innerHTML=api.formatBook(area.value||'');
  const stats=document.getElementById('warehouseEditorStats');
  if(stats)stats.textContent=area.value.length+' caracteres · '+area.value.trim().split(/\s+/).filter(Boolean).length+' palavras';
 }
 function editorInsert(text,placeholder=''){
  const area=document.getElementById('warehouseContentInput');if(!area)return;
  const start=area.selectionStart,end=area.selectionEnd;
  area.setRangeText(text,start,end,'end');area.focus();
  const at=placeholder?text.indexOf(placeholder):-1;
  if(at>=0)area.setSelectionRange(start+at,start+at+placeholder.length);
  area.dispatchEvent(new Event('input',{bubbles:true}));
 }
 function editorFormat(style){
  const area=document.getElementById('warehouseContentInput');if(!area)return;
  const begin=area.selectionStart,end=area.selectionEnd;
  const selected=area.value.slice(begin,end);
  let before='',after='',body=selected||'texto';
  if(style==='bold'){before='**';after='**'}
  else if(style==='italic'){before='*';after='*'}
  else if(style==='heading'){before='\n## ';body=selected||'Novo título'}
  else if(style==='list'){before='\n- ';body=selected||'Novo item'}
  else if(style==='quote'){before='\n> ';body=selected||'Exemplo'}
  else if(style==='color'){
   const color=document.getElementById('warehouseEditorColor')?.value||'#39D6F4';
   if(!/^#[0-9a-f]{6}$/i.test(color))return;
   before='[cor='+color+']';after='[/cor]';
  }else return;
  area.setRangeText(before+body+after,begin,end,'select');
  area.focus();area.setSelectionRange(begin+before.length,begin+before.length+body.length);
  area.dispatchEvent(new Event('input',{bubbles:true}));
 }
 function insertTemplate(){
  const kind=document.getElementById('warehouseEditorTemplate')?.value;
  const blocks={
   ability:'## Identidade\n\n**Ativação:** descreva a ação necessária.\n\n**Custo:** indique o custo de Alma, se houver.\n\n**Teste:** indique grupo + perícia, ou teste próprio.\n\n## Efeito\n\nDescreva o resultado e suas limitações.',
   class:'## Identidade\n\nDescreva a proposta da classe.\n\n## Recurso de classe\n\nExplique quando ganha e gasta marcas.\n\n## Efeitos\n\n- Primeiro efeito\n- Segundo efeito\n\n## Traços e limitações\n\nDescreva os benefícios e as limitações.',
   item:'## Descrição\n\nApresentação do item.\n\n**Uso:** descreva como é utilizado.\n\n**Efeito:** indique o benefício.\n\n**Limites:** explique restrições e consumos.',
   rule:'## Funcionamento\n\nExplique a mecânica.\n\n**Quando usar:** indique a situação.\n\n**Teste:** descreva o procedimento.\n\n**Consequências:** explique os resultados.'
  };
  if(!blocks[kind])return;
  const area=document.getElementById('warehouseContentInput');if(!area)return;
  const before=area.value.slice(0,area.selectionStart),prefix=before&&!before.endsWith('\n\n')?(before.endsWith('\n')?'\n':'\n\n'):'';
  editorInsert(prefix+blocks[kind]+'\n\n','Descreva');
 }
 function insertEditorDie(){
  const faces=Number(document.getElementById('warehouseEditorDie')?.value||6);
  if(![4,6,8,10,12,14,16,18,20].includes(faces))return;
  editorInsert('1d'+faces);
 }
 function use(action){
  const [name,...rest]=action.split(':');
  const decode=x=>{try{return decodeURIComponent(x)}catch{return ''}};
  if(name==='attach'){selectTarget(decode(rest.join(':')));return}
  if(name==='bar'){adjustBar(decode(rest[0]),decode(rest[1]),Number(rest[2]));return}
  if(name==='remove'){removeFromSheet(decode(rest.join(':')));return}
  if(name==='scene-reset'){resetScene();return}
  if(name==='open-warehouse'){window.ARQUIVO_SECOES.select('warehouse');api.setPage('library');return}
  if(name==='view-sheet-catalog'){api.goCatalogSheet(api.currentSheet);return}
  if(name==='format'){editorFormat(rest[0]);return}
  if(name==='insert-template'){insertTemplate();return}
  if(name==='insert-die'){insertEditorDie();return}
  if(name==='add-editor-bar'){
   const root=document.getElementById('aeCatalogBarRows');
   if(!root)return;
   const count=root.querySelectorAll('.ae-catalog-bar-editor').length;
   if(count>=8){api.toast('Limite de barras','Máximo de 8 barras por publicação.',true);return}
   root.insertAdjacentHTML('beforeend',barEditorRow({max:3,initial:0},count));
   root.querySelector('.ae-catalog-bar-editor:last-child .ae-cat-bar-name')?.focus();return;
  }
  if(name==='remove-editor-bar'){return} // Trata o botão usando o alvo do evento.
 }
 document.addEventListener('keydown',event=>{
  if(event.target?.id==='warehouseContentInput'&&(event.ctrlKey||event.metaKey)&&['b','i'].includes(event.key.toLowerCase())){
   event.preventDefault();editorFormat(event.key.toLowerCase()==='b'?'bold':'italic');
  }
 });
 document.addEventListener('input',event=>{
  if(event.target?.id==='warehouseContentInput')editorUpdatePreview();
 });
 document.addEventListener('click',event=>{
  const button=event.target?.closest?.('[data-cat-action]');
  if(button){
   event.preventDefault();event.stopImmediatePropagation();
   if(button.dataset.catAction==='remove-editor-bar'){button.closest('.ae-catalog-bar-editor')?.remove();return}
   use(button.dataset.catAction);return;
  }
  const modalButton=event.target?.closest?.('[data-action]');
  if(!modalButton)return;
  if(modalButton.dataset.action==='catalog-transfer'){
   event.preventDefault();event.stopImmediatePropagation();
   const id=document.getElementById('aeCatalogTarget')?.value||'';
   if(id)transfer(id,selectedPostId);
  }
 },true);
 window.ARQUIVO_CATALOGO={actionMarkup,extraMarkup,editorFields,readEditorExtra,sheetPanel,summaryHud,
  barDefs,notation,getPost,selectTarget};
})();