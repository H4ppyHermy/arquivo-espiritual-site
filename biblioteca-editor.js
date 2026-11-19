/* Editor textual do Armazém, independente de fichas, combate e automações. */
(function(){
 'use strict';
 const api=window.ARQUIVO_INTERNAL;
 if(!api)return;
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


 function updateTagPreview(){
  const field=document.getElementById('warehouseTagsInput'),target=document.getElementById('warehouseTagPreview');
  if(!field||!target)return;
  const tags=window.ARQUIVO_SECOES?.parseTags(field.value)||[];
  target.innerHTML=tags.map(tag=>'<span>#'+api.esc(tag)+'</span>').join('');
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
 function addResourceBar(){
  const root=document.getElementById('warehouseBarRows');if(!root)return;
  const count=root.querySelectorAll('[data-warehouse-bar]').length;
  if(count>=8){api.toast('Limite de barras','Máximo de 8 recursos informativos.',true);return}
  const markup=window.ARQUIVO_SECOES?.barEditorRow({},count);
  if(!markup)return;
  root.insertAdjacentHTML('beforeend',markup);
  root.querySelector('[data-warehouse-bar]:last-child [data-bar-field="label"]')?.focus();
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
  else if(action==='add-bar')addResourceBar();
  else if(action==='remove-bar')button.closest('[data-warehouse-bar]')?.remove();
  else if(action?.startsWith('add-tag:'))addSuggestedTag(action.slice(8));
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
 });
 window.ARQUIVO_EDITOR_ARMAZEM={refresh:editorUpdatePreview};
})();