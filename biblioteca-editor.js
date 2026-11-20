/* Editor textual do Armazém, independente de fichas, combate e automações. */
(function(){
 'use strict';
 const api=window.ARQUIVO_INTERNAL;
 if(!api)return;

 let editActive=false,hiddenDraft=new Set(),imageDraft='',imageBusy=false;
 const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
 function beginEdit(post={}){
  editActive=true;
  hiddenDraft=new Set((Array.isArray(post.hiddenTags)?post.hiddenTags:[]).map(fold));
  imageDraft=String(post.image||'');
  imageBusy=false;
  updateTagPreview();updateImagePreview();updateCategoryForm();
 }
 function readHiddenTags(tags){
  if(!editActive)return undefined;
  return (Array.isArray(tags)?tags:[]).filter(tag=>hiddenDraft.has(fold(tag)));
 }
 function imageValue(){
  if(!editActive)return undefined;
  if(imageBusy)return null;
  const url=String(document.getElementById('warehouseImageInput')?.value||'').trim();
  return url||imageDraft;
 }
 function updateImagePreview(){
  const target=document.getElementById('warehouseImagePreview');if(!target)return;
  const src=imageValue()||'';
  const valid=/^https:\/\/[^\s"'<>]+$/i.test(src)||
    /^data:image\/(?:gif|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(src);
  target.innerHTML=valid?'<img alt="Miniatura selecionada" src="'+api.esc(src)+'">':'<span>CL</span>';
 }
 function toggleTag(raw){
  let name='';try{name=decodeURIComponent(raw)}catch{return}
  const tags=window.ARQUIVO_SECOES?.parseTags(document.getElementById('warehouseTagsInput')?.value)||[];
  const tag=tags.find(t=>fold(t)===fold(name));if(!tag)return;
  const key=fold(tag);
  if(hiddenDraft.has(key))hiddenDraft.delete(key);
  else hiddenDraft.add(key);
  updateTagPreview();
 }
 async function readImageFile(file){
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Use JPG, PNG, WebP ou GIF.');
  if(!file.size||file.size>8*1024*1024)throw Error('O arquivo precisa ter até 8 MB.');
  if(file.type==='image/gif'&&file.size>200000)throw Error('Para preservar a animação, escolha um GIF de até 200 KB.');
  const raw=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result||''));
   reader.onerror=()=>reject(Error('Falha ao ler a imagem.'));
   reader.readAsDataURL(file);
  });
  if(file.type==='image/gif')return raw;
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Imagem inválida.'));img.src=raw});
  if(!img.naturalWidth||!img.naturalHeight)throw Error('A imagem não possui dimensões válidas.');
  const scale=Math.min(1,320/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Processamento de imagem indisponível.');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let result=canvas.toDataURL('image/webp',.74);
  if(!result.startsWith('data:image/webp'))result=canvas.toDataURL('image/jpeg',.72);
  return result;
 }
 async function setPhotoFile(file){
  if(!file)return;
  if(imageBusy)return;
  imageBusy=true;
  const previous=imageDraft;
  try{
   const data=await readImageFile(file);
   if(data.length>340000)throw Error('A miniatura excede o limite. Escolha uma imagem menor.');
   imageDraft=data;
   const input=document.getElementById('warehouseImageInput');if(input)input.value='';
   api.toast('Miniatura selecionada','Foto ou GIF será incluído ao salvar a publicação.');
  }catch(error){
   imageDraft=previous;
   api.toast('Falha na miniatura',error.message,true);
  }finally{imageBusy=false;updateImagePreview()}
 }
 function removeImage(){
  imageDraft='';
  const input=document.getElementById('warehouseImageInput');if(input)input.value='';
  const file=document.getElementById('warehouseImageFile');if(file)file.value='';
  updateImagePreview();
 }

 function updateCategoryForm(){
  const category=document.getElementById('warehouseCategoryInput')?.value||'';
  const single=category==='Habilidades'||category==='Técnicas',technique=category==='Técnicas';
  const field=document.getElementById('warehouseImageField');
  if(field)field.hidden=single;
  const grants=document.getElementById('warehouseGrantFields');
  if(grants)grants.hidden=!single;
  const change=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=value};
  change('warehouseSummaryLabel',single?'Prévia curta (opcional)':'Resumo para o cartão');
  change('warehouseContentHeading',single?(technique?'DESCRIÇÃO DA TÉCNICA':'DESCRIÇÃO DA HABILIDADE'):'CONTEÚDO DA PUBLICAÇÃO');
  change('warehouseContentLabel',single?(technique?'Descrição da técnica':'Descrição da habilidade'):'Texto completo');
  change('warehousePreviewHeading',single?(technique?'EFEITO DA TÉCNICA':'EFEITO DA HABILIDADE'):'COMO SERÁ EXIBIDO');
  change('warehouseAdvancedHint',single?'Opcional · custo':'Opcional · custo e imagem');
  const summary=document.getElementById('warehouseSummaryInput');
  if(summary)summary.placeholder=single?'Usada apenas quando a descrição precisar ser expandida':'O que esta publicação faz?';
  const area=document.getElementById('warehouseContentInput');
  if(area)area.placeholder=single?
   'Descreva a ativação, os custos, o teste e o efeito desta única '+(technique?'técnica':'habilidade')+'.':
   '## Descrição\n\nExplique o funcionamento da publicação.';
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
 function insertEditorBar(){
  const kind=document.getElementById('warehouseEditorResourceKind')?.value||'barra';
  const filled=Number(document.getElementById('warehouseEditorBarFilled')?.value);
  const total=Number(document.getElementById('warehouseEditorBarTotal')?.value);
  if(!window.ARQUIVO_BARRAS_INLINE?.valid(filled,total,kind)){
   api.toast('Recurso inválido','Use até 20 unidades e não ultrapasse o total.',true);return;
  }
  const notation=kind==='marca'&&total===1?'[marca:'+filled+']':'['+kind+':'+filled+'/'+total+']';
  editorInsert(notation);
 }
 function insertEditorDie(){
  const faces=Number(document.getElementById('warehouseEditorDie')?.value||6);
  if(![4,6,8,10,12,14,16,18,20].includes(faces))return;
  editorInsert('1d'+faces);
 }


 function updateTagPreview(){
  const field=document.getElementById('warehouseTagsInput'),target=document.getElementById('warehouseTagPreview');
  if(!field||!target)return;
  const tags=window.ARQUIVO_SECOES?.parseTags(field.value)||[];
  target.innerHTML=tags.map(tag=>{
   const hidden=hiddenDraft.has(fold(tag));
   return '<button type="button" class="'+(hidden?'is-hidden-tag':'')+
    '" data-warehouse-editor="toggle-tag:'+encodeURIComponent(tag)+'" aria-pressed="'+hidden+
    '" title="'+(hidden?'Mostrar aos jogadores':'Ocultar dos jogadores')+'">#'+api.esc(tag)+
    '<small>'+ (hidden?'OCULTA':'VISÍVEL')+'</small></button>';
  }).join('');
 }
 function addSuggestedTag(raw){
  let tag='';try{tag=decodeURIComponent(raw)}catch{return}
  const field=document.getElementById('warehouseTagsInput');if(!field)return;
  const split=window.ARQUIVO_SECOES?.parseTags;
  if(!split)return;
  const items=split(field.value),lower=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  if(!tag||items.some(x=>lower(x)===lower(tag)))return;
  if(items.length>=8){api.toast('Limite de tags','Máximo de 8 tags por publicação.',true);return}
  const next=[...items,tag].join(', ');
  if(next.length>200){api.toast('Tags extensas','Reduza o tamanho dos marcadores.',true);return}
  field.value=next;field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();
 }
 document.addEventListener('click',event=>{
  const button=event.target?.closest?.('[data-warehouse-editor]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const action=button.dataset.warehouseEditor;
  if(action?.startsWith('format:'))editorFormat(action.slice(7));
  else if(action==='insert-template')insertTemplate();
  else if(action==='insert-die')insertEditorDie();
  else if(action==='insert-bar')insertEditorBar();
  else if(action?.startsWith('add-tag:'))addSuggestedTag(action.slice(8));
  else if(action?.startsWith('toggle-tag:'))toggleTag(action.slice(11));
  else if(action==='remove-image')removeImage();
 },true);
 document.addEventListener('keydown',event=>{
  if(event.target?.id==='warehouseContentInput'&&(event.ctrlKey||event.metaKey)&&['b','i'].includes(event.key.toLowerCase())){
   event.preventDefault();
   editorFormat(event.key.toLowerCase()==='b'?'bold':'italic');
  }
 });
 document.addEventListener('input',event=>{
  if(event.target?.id==='warehouseContentInput')editorUpdatePreview();
  if(event.target?.id==='warehouseTagsInput')updateTagPreview();
  if(event.target?.id==='warehouseImageInput')updateImagePreview();
 });
 document.addEventListener('change',event=>{
  if(event.target?.id==='warehouseCategoryInput')updateCategoryForm();
  if(event.target?.id==='warehouseImageFile')setPhotoFile(event.target.files?.[0]);
  if(event.target?.id==='warehouseEditorResourceKind'&&['marca','sequencia'].includes(event.target.value)){
   const total=document.getElementById('warehouseEditorBarTotal');
   const filled=document.getElementById('warehouseEditorBarFilled');
   const max=event.target.value==='marca'?1:3;
   if(total)total.value=String(max);
   if(filled&&Number(filled.value)>max)filled.value=String(max);
  }
 });
 window.ARQUIVO_EDITOR_ARMAZEM={refresh:editorUpdatePreview,beginEdit,readHiddenTags,imageValue};
})();