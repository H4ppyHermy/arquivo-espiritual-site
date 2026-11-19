/* Vínculos narrativos — sem efeitos de combate automáticos. */
(function(){
 'use strict';
 const api=window.ARQUIVO_INTERNAL;if(!api)return;
 const esc=x=>api.esc(x);
 let editingId='';
 const degree=n=>['','Afinidade I','Vínculo II','Devoção III'][Math.max(1,Math.min(3,Number(n)||1))];
 function render(s){
  const items=Array.isArray(s.bonds)?s.bonds:[],can=api.canEditSheet(s.id),m=api.master();
  return '<section class="panel ae-bonds-simple"><div class="sectionhead"><h2>VÍNCULOS NARRATIVOS</h2>'+
   (can?'<button class="btn small main" type="button" data-bond-action="edit:new">+ ADICIONAR</button>':'')+'</div>'+
   '<p class="subtitle">Relações de personagem preservadas como registros narrativos. Bônus de Afinidade ainda não são aplicados automaticamente.</p>'+
   '<div class="ae-bonds-grid">'+(items.length?items.map(b=>
    '<article class="ae-bond-simple"><div><strong>'+esc(b.name||'Relação sem nome')+'</strong>'+
     '<span class="tag">'+esc(degree(b.grade))+'</span></div>'+
    '<p>'+esc(b.relation||'Sem descrição')+'</p>'+
    (can?'<div class="actions"><button class="btn small" type="button" data-bond-action="edit:'+encodeURIComponent(b.id)+'">EDITAR</button>'+
     '<button class="btn small danger" type="button" data-bond-action="remove:'+encodeURIComponent(b.id)+'">REMOVER</button></div>':'')+
    '</article>').join(''):'<p>Nenhum vínculo cadastrado.</p>')+'</div></section>';
 }
 function edit(id){
  if(!api.canEditSheet(api.currentSheet))return;
  const s=api.db.sheets.find(x=>x.id===api.currentSheet),b=(s?.bonds||[]).find(x=>x.id===id);
  if(id!=='new'&&!b)return;
  editingId=b?.id||'';
  const all=api.db.sheets.filter(x=>!x.redacted&&!x.masterOnly&&x.id!==api.currentSheet);
  api.modal(editingId?'EDITAR VÍNCULO':'NOVO VÍNCULO','<div class="ae-catalog-transfer">'+
   '<label>Pessoa relacionada<input id="aeBondSimpleName" maxlength="100" value="'+esc(b?.name||'')+'"></label>'+
   '<label>Relação<input id="aeBondSimpleRelation" maxlength="200" value="'+esc(b?.relation||'')+'" placeholder="Amizade, rivalidade, lealdade..."></label>'+
   '<label>Ficha relacionada<select id="aeBondSimpleTarget"><option value="">Pessoa ou NPC</option>'+
    all.map(x=>'<option value="'+esc(x.id)+'"'+(b?.targetSheetId===x.id?' selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>'+
   (api.master()?'<label>Grau<select id="aeBondSimpleGrade">'+[1,2,3].map(n=>
    '<option value="'+n+'"'+(Number(b?.grade||1)===n?' selected':'')+'>'+degree(n)+'</option>').join('')+'</select></label>':'')+
   '<p class="subtitle">Atributos e bônus não são alterados ao salvar um vínculo.</p></div>',
   [['SALVAR','bond-simple-save','main'],['CANCELAR','closeModal','small']]);
 }
 function save(){
  const s=api.db.sheets.find(x=>x.id===api.currentSheet);
  if(!s||!api.canEditSheet(s.id))return;
  const name=String(document.getElementById('aeBondSimpleName')?.value||'').trim();
  const relation=String(document.getElementById('aeBondSimpleRelation')?.value||'').trim();
  if(name.length<2||name.length>100){api.toast('Nome inválido','Informe entre 2 e 100 caracteres.',true);return}
  s.bonds??=[];
  if(s.bonds.length>=20&&!editingId){api.toast('Limite de vínculos','Máximo 20 por ficha.',true);return}
  const b=s.bonds.find(x=>x.id===editingId),old=b||{};
  const grade=api.master()?Number(document.getElementById('aeBondSimpleGrade')?.value||1):Number(old.grade)||1;
  const entry={...old,id:b?.id||api.uid(),name,relation:relation.slice(0,200),
   targetSheetId:document.getElementById('aeBondSimpleTarget')?.value||'',grade};
  if(b)Object.assign(b,entry);else s.bonds.push(entry);
  api.save();api.closeModal();api.render();api.toast('Vínculo salvo',name);
 }
 function remove(id){
  const s=api.db.sheets.find(x=>x.id===api.currentSheet);
  if(!s||!api.canEditSheet(s.id))return;
  const b=(s.bonds||[]).find(x=>x.id===id);if(!b)return;
  api.confirmSite('REMOVER VÍNCULO','Remover "'+b.name+'" desta ficha?',()=>{
   s.bonds=s.bonds.filter(x=>x.id!==id);
   api.save();api.render();
  });
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-bond-action],[data-action="bond-simple-save"]');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  const value=b.dataset.bondAction||'save';
  if(value==='save')save();
  if(value.startsWith('edit:')){let id='';try{id=decodeURIComponent(value.slice(5))}catch{return}edit(id)}
  if(value.startsWith('remove:')){let id='';try{id=decodeURIComponent(value.slice(7))}catch{return}remove(id)}
 },true);
 window.ARQUIVO_VINCULOS={render};
})();