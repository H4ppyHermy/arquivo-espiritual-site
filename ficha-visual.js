/* Ficha 2.0 — apresentação editorial inspirada em mangá Bleach.
   Somente visualização e edição explícita; nenhuma automação de mecânicas. */
(function(){
 'use strict';
 const api=window.ARQUIVO_INTERNAL;
 if(!api)return;
 const esc=api.esc,labels={summary:'Resumo',skills:'Perícias',identification:'Identificação',abilities:'Habilidades',bonds:'Vínculos',conditions:'Condições',inventory:'Inventário',notes:'Notas',guide:'Guia rápido'};
 const symbols={summary:'◇',skills:'▦',identification:'◈',abilities:'✦',bonds:'∞',conditions:'◈',inventory:'▣',notes:'≡',guide:'▤'};
 const TYPES={active:'ATIVA',passive:'PASSIVA',mechanic:'MECÂNICA',release:'LIBERAÇÃO',transformation:'TRANSFORMAÇÃO',ultimate:'SUPREMA',item:'ITEM'};
 let editorStep='',abilityKind='Todas',lastAbilitySheet='';
 const resourceDefs=[['vida','VIDA'],['estabilidade','ESTABILIDADE'],['alma','ALMA']];
 const text=(x)=>String(x??'');
 function portrait(value){
  if(!value||!api.dataUrlOk(value))return '';
  const url=api.mediaSrc(value);
  return url?'<img class="ae-ficha-art-image" alt="Retrato do personagem" src="'+esc(url)+'" loading="eager" decoding="async">':'';
 }
 function tabs(active){
  return '<nav class="ae-ficha-navigation" aria-label="Navegação da ficha">'+
   Object.entries(labels).map(([id,name])=>'<button type="button" data-tab="'+id+'" class="ae-ficha-nav-button'+(id===active?' is-active':'')+
   '" aria-current="'+(id===active?'page':'false')+'" aria-label="'+esc(name)+'" title="'+esc(name)+'">'+
   '<span class="ae-ficha-nav-symbol" aria-hidden="true">'+symbols[id]+'</span>'+
   '<span class="ae-ficha-nav-label">'+esc(name)+'</span></button>').join('')+
   '</nav>';
 }
 function header(s){
  const name=esc(s.name||'Personagem'),race=String(s.race||'').trim(),kind=String(s.className||'').trim(),level=esc(s.level||1);
  return '<header class="ae-ficha-hero">'+
   '<div class="ae-ficha-hero-top"><span>ARQUIVO ESPIRITUAL</span></div>'+
   '<div class="ae-ficha-hero-copy">'+
    '<h1>'+name+'</h1>'+
    (s.subtitle?'<p class="ae-ficha-subtitle">'+esc(s.subtitle)+'</p>':'')+
    '<div class="ae-ficha-hero-tags">'+(race?'<span class="ae-ficha-race">'+esc(race)+'</span>':'')+
    (kind?'<span class="ae-ficha-class">'+esc(kind)+'</span>':'')+
    '<span class="ae-ficha-level">NÍVEL '+level+'</span></div>'+
   '</div><div class="ae-ficha-hero-art" aria-label="Retrato">'+
    (portrait(s.image)||'<span class="ae-ficha-art-glyph" aria-hidden="true">魂</span>')+
    '</div>'+
   '<div class="ae-ficha-hero-rule" aria-hidden="true"></div></header>';
 }
 function numberDie(value,type='skill'){
  const n=Number(value)||4;
  return '<span class="ae-ficha-die ae-ficha-die--'+(type==='group'?'group':'skill')+'">'+api.sheetRich('d'+n)+'</span>';
 }
 function attributes(s,ctx){
  const g=ctx.groups||{};
  return '<section class="ae-ficha-attributes" aria-labelledby="aeFichaAttrTitle">'+
   '<div class="ae-ficha-section-title"><h2 id="aeFichaAttrTitle">Grupos</h2></div>'+
   '<div class="ae-ficha-attribute-grid">'+Object.keys(g).map(key=>
     '<div class="ae-ficha-attribute"><span>'+esc(key)+'</span>'+numberDie(s.groups?.[key],'group')+'</div>'
   ).join('')+'</div></section>';
 }
 function resources(s,ctx){
  return '<section class="ae-ficha-resources" aria-labelledby="aeFichaResourceTitle">'+
   '<div class="ae-ficha-section-title"><h2 id="aeFichaResourceTitle">Vida, Estabilidade & Alma</h2></div>'+
   '<div class="ae-ficha-resource-grid">'+resourceDefs.map(([key,label])=>{
    const data=s.resources?.[key]||{},current=Math.max(0,Number(data.current)||0),max=Math.max(0,Number(data.max)||0);
    const pct=max>0?Math.min(100,current/max*100):0,extra=Math.max(0,current-max);
    return '<article class="ae-ficha-resource-card ae-ficha-resource-'+key+'">'+
      '<div class="ae-ficha-resource-head"><span>'+label+'</span><strong>'+
      (ctx.canEdit?'<button type="button" data-action="editResource:'+key+'" title="Editar '+label.toLowerCase()+' manualmente">'+esc(current)+'</button>':esc(current))+
      ' <small>/ '+esc(max)+'</small></strong></div>'+
      '<div class="ae-ficha-resource-track" role="meter" aria-valuemin="0" aria-valuemax="'+Math.max(max,current)+'" aria-valuenow="'+current+'" aria-label="'+label+'">'+
      '<span style="width:'+pct.toFixed(2)+'%"></span></div>'+
      (extra?'<span class="ae-ficha-resource-extra">+'+esc(extra)+' DE RESERVA</span>':'')+
     '</article>';
   }).join('')+'</div></section>';
 }
 function originMeters(s,ctx){
  const meters=window.ARQUIVO_ORIGENS?.meters(s)||[];
  if(!meters.length)return '';
  return '<section class="ae-ficha-origin-resources" aria-labelledby="aeOriginResourceTitle">'+
   '<div class="ae-ficha-section-title"><h2 id="aeOriginResourceTitle">Recursos de raça e classe</h2></div>'+
   '<div class="ae-ficha-origin-resource-grid">'+meters.map(meter=>{
    const percent=Math.min(100,100*meter.current/meter.max).toFixed(2),key=encodeURIComponent(meter.key);
    return '<article class="ae-ficha-resource-card ae-ficha-origin-resource-card" data-origin-meter="'+esc(meter.key)+'">'+
      '<div class="ae-ficha-resource-head"><span>'+esc(meter.label)+'</span>'+
       '<strong>'+meter.current+' <small>/ '+meter.max+'</small></strong></div>'+
      '<div class="ae-ficha-origin-meter-source">'+esc(meter.kind==='race'?'RAÇA':'CLASSE')+' · '+esc(meter.source)+'</div>'+
      '<div class="ae-ficha-resource-track" role="meter" aria-valuemin="0" aria-valuemax="'+meter.max+
       '" aria-valuenow="'+meter.current+'" aria-label="'+esc(meter.label)+'">'+
       '<span style="width:'+percent+'%"></span></div>'+
      '<div class="ae-ficha-origin-meter-levels" aria-hidden="true" data-visual="'+esc(meter.visual)+'">'+
       Array.from({length:meter.max},(_,i)=>'<span class="'+(i<meter.current?'is-active':'')+'"></span>').join('')+
      '</div>'+
      (ctx.canEdit?'<div class="ae-ficha-origin-meter-actions">'+
       '<button type="button" data-action="originMeter:'+key+':-1" aria-label="Diminuir '+esc(meter.label)+
         '"'+(meter.current===0?' disabled':'')+'>−</button>'+
       '<button type="button" data-action="originMeter:'+key+':1" aria-label="Aumentar '+esc(meter.label)+
         '"'+(meter.current===meter.max?' disabled':'')+'>+</button></div>':'')+
     '</article>';
   }).join('')+'</div></section>';
 }
 function identification(s,ctx){
  const data=window.ARQUIVO_ORIGENS?.identity(s)||{};
  const sections=[['race','RAÇA'],['class','CLASSE']];
  const nodes=sections.map(([key,label])=>{
   const part=data[key];if(!part)return '';
   return '<article class="ae-ficha-origin-chapter ae-ficha-origin-chapter--'+key+'">'+
    '<div class="ae-ficha-origin-heading"><span>'+label+'</span><h3>'+esc(part.title)+'</h3></div>'+
    (part.content?'<div class="ae-ficha-origin-prose sheet-rich">'+api.formatBook(part.content,part.title)+'</div>':
     '<p class="ae-ficha-origin-empty">Descrição ainda não cadastrada no Armazém.</p>')+
    '</article>';
  }).filter(Boolean).join('');
  return '<section class="ae-ficha-identification">'+
   '<div class="ae-ficha-section-heading"><div class="ae-ficha-section-title"><h2>Identificação</h2></div>'+
    (ctx.canEdit?api.btn('EDITAR RAÇA E CLASSE','editSheetSection:identity','small'):'')+'</div>'+
   (nodes||'<div class="ae-ficha-empty">Selecione uma raça e uma classe em Editar ficha.</div>')+
   '</section>';
 }
 function snapshot(s){
  const ab=(s.abilities||[]).filter(x=>!x?.origin?.auto).length,cond=(s.conditions||[]).length;
  const inventory=(s.inventory?.items||[]).length;
  return '<section class="ae-ficha-summary-notes"><div class="ae-ficha-section-title"><h2>Arquivo pessoal</h2></div>'+
   '<div class="ae-ficha-record-grid">'+
   '<button type="button" data-tab="abilities"><strong>'+ab+'</strong><span>HABILIDADES</span></button>'+
   '<button type="button" data-tab="conditions"><strong>'+cond+'</strong><span>CONDIÇÕES</span></button>'+
   '<button type="button" data-tab="inventory"><strong>'+inventory+'</strong><span>ITENS</span></button>'+
   '</div>'+
   (s.notes?'<div class="ae-ficha-note-preview"><p>'+esc(text(s.notes).slice(0,220))+
    (text(s.notes).length>220?'…':'')+'</p><button type="button" data-tab="notes">VER NOTAS</button></div>':'')+
   '</section>';
 }
 function summary(s,ctx){
  return '<div class="ae-ficha-summary">'+
    '<div class="ae-ficha-summary-columns">'+attributes(s,ctx)+resources(s,ctx)+'</div>'+
    originMeters(s,ctx)+snapshot(s)+
    (ctx.history?'<section class="ae-ficha-history">'+ctx.history+'</section>':'')+
   '</div>';
 }
 function skills(s,ctx){
  const groups=ctx.groups||{},all=[];
  for(const [group,names] of Object.entries(groups)){
   for(const name of names)all.push({group,name});
  }
  const mid=Math.ceil(all.length/2),columns=[all.slice(0,mid),all.slice(mid)];
  const row=({group,name})=>
   '<div class="ae-ficha-skill-row"><span class="ae-ficha-skill-name">'+esc(name)+'</span>'+
   '<span class="ae-ficha-skill-dice">'+numberDie(s.skills?.[name],'skill')+'<span aria-hidden="true" class="ae-ficha-skill-plus">+</span>'+numberDie(s.groups?.[group],'group')+
   '<small>'+esc(group)+'</small></span></div>';
  return '<section class="ae-ficha-skills" aria-labelledby="aeFichaSkillsTitle">'+
   '<div class="ae-ficha-section-heading"><div class="ae-ficha-section-title"><h2 id="aeFichaSkillsTitle">Grupos & perícias</h2></div>'+
   (ctx.canEdit?api.btn('EDITAR DADOS','editSheetSection:skills','small'):'')+'</div>'+
   '<div class="ae-ficha-skills-grid">'+columns.map((list,index)=>
    '<div class="ae-ficha-skills-col" aria-label="Coluna de perícias '+(index+1)+'">'+list.map(row).join('')+'</div>'
   ).join('')+'</div></section>';
 }
 function abilityCategory(ab){
  if(ab?.passive===true||ab?.category==='passive')return 'passive';
  return TYPES[ab?.category]?ab.category:'active';
 }
 function abilityCard(ab,index,ctx){
  const name=esc(ab.name||'Habilidade sem nome'),type=abilityCategory(ab);
  const description=text(ab.description||'Sem descrição.');
  const image=ab.image&&api.dataUrlOk(ab.image)?api.mediaSrc(ab.image):'';
  const kind=ab.libraryType==='tecnica'?'Técnica':'Habilidade';
  return '<article class="ae-ficha-ability-card" data-ability-kind="'+(kind==='Técnica'?'Técnicas':'Habilidades')+'" id="ability-'+index+'">'+
    '<div class="ae-ficha-ability-tag">'+name+'</div>'+
    '<div class="ae-ficha-ability-meta"><span>'+esc(kind.toUpperCase())+' · '+esc(TYPES[type])+'</span>'+
     (Number(ab.cost)>0?'<span>CUSTO INDICADO · '+esc(ab.cost)+' ALMA</span>':'')+'</div>'+

    '<details class="ae-ficha-ability-details">'+
     '<summary aria-label="Mostrar ou ocultar a descrição de '+name+'" title="Abrir ou fechar descrição">'+
      '<span class="ae-ficha-ability-expand" aria-hidden="true">'+
       '<span class="ae-ficha-expand-plus">+</span><span class="ae-ficha-expand-minus">−</span>'+
      '</span></summary>'+
     '<div class="ae-ficha-ability-full sheet-rich">'+
       (image?'<img alt="Ilustração da habilidade '+name+'" src="'+esc(image)+'" loading="lazy">':'')+
       api.sheetRich(description)+'</div>'+
    '</details>'+
    (ctx.canEdit?'<div class="ae-ficha-ability-tools">'+api.btn('EDITAR','editAbilityDirect:'+index,'small')+'</div>':'')+
   '</article>';
 }
 function abilities(s,ctx){
  if(lastAbilitySheet!==s.id){abilityKind='Todas';lastAbilitySheet=s.id}
  const list=(s.abilities||[]).map((ab,index)=>({ab,index})).filter(x=>!x.ab?.origin?.auto);
  const groups=(Array.isArray(s.abilityGroups)?s.abilityGroups:[]).filter(g=>g&&g.id&&g.name);
  const groupIds=new Set(groups.map(g=>g.id));
  const ungrouped=list.filter(({ab})=>!groupIds.has(ab.groupId));
  const sections=[
   ...groups.map(group=>({name:group.name,items:list.filter(({ab})=>ab.groupId===group.id),custom:true})),
   ...[['active','ATIVAS'],['passive','PASSIVAS'],['other','OUTRAS HABILIDADES']].map(([key,name])=>({
    name,custom:false,items:ungrouped.filter(({ab})=>{
     const type=abilityCategory(ab);
     return key==='other'?!['active','passive'].includes(type):type===key;
    })
   }))
  ];
  const matches=ab=>abilityKind==='Todas'||(ab.libraryType==='tecnica'?'Técnicas':'Habilidades')===abilityKind;
  return '<div class="ae-ficha-abilities" data-ability-view="'+abilityKind+'"><div class="ae-ficha-section-heading"><div class="ae-ficha-section-title"><h2>Habilidades & Técnicas</h2></div>'+
   (ctx.canEdit?'<div class="ae-ficha-ability-create-actions">'+
    (ctx.master?api.btn('+ HABILIDADE','newAbilityDirect','main'):'')+
    api.btn('EXPORTAR','exportAbilities','small')+
    (ctx.master?api.btn('+ CATEGORIA','abilityGroups','small'):'')+
    '</div>':'')+'</div>'+
   '<div class="ae-ficha-ability-filters" role="group" aria-label="Filtrar registros por tipo">'+
   [['Todas','TODAS'],['Técnicas','TÉCNICAS'],['Habilidades','HABILIDADES']].map(([type,label])=>
    '<button type="button" data-ability-filter="'+type+'" aria-pressed="'+(abilityKind===type)+'" class="'+
    (abilityKind===type?'is-active':'')+'">'+label+'</button>').join('')+'</div>'+
   sections.map(section=>{
    const entries=section.items,available=entries.some(({ab})=>matches(ab));
    if(!entries.length&&(!section.custom||!ctx.master))return '';
    return '<section class="ae-ficha-ability-group'+(section.custom?' ae-ficha-ability-group--custom':'')+'"'+
     (available||(!entries.length&&ctx.master)?'':' hidden')+'>'+
     '<div class="ae-ficha-ability-group-head"><h3>'+esc(section.name)+'</h3><span>'+entries.length+'</span></div>'+
     (entries.length?'<div class="ae-ficha-ability-grid">'+entries.map(({ab,index})=>
      '<div class="ae-ficha-ability-entry"'+(matches(ab)?'':' hidden')+'>'+
      abilityCard(ab,index,ctx)+'</div>').join('')+'</div>':
      '<p class="ae-ficha-ability-group-empty">Nenhuma habilidade vinculada. Escolha esta categoria ao editar uma habilidade.</p>')+
     '</section>';
   }).join('')+
   (!list.length&&!groups.length?'<div class="ae-ficha-empty">Nenhuma habilidade registrada nesta ficha.'+
    (ctx.master?'<p>Use + Habilidade para adicionar um registro.</p>':'')+'</div>':'')+
   '</div>';
 }
 function guide(){
  const chapters=(api.db?.rules||[]).filter(x=>x&&x.id).slice(0,40);
  return '<section class="ae-ficha-guide"><div class="ae-ficha-section-title"><h2>Guia rápido</h2></div>'+
   '<div class="ae-ficha-guide-grid">'+chapters.map((chapter,i)=>{
    const body=text(chapter.text||''),preview=body.split('\n').map(x=>x.trim()).filter(Boolean).slice(1,3).join(' ').slice(0,155);
    return '<button type="button" data-ficha-guide="'+esc(chapter.id)+'" class="ae-ficha-guide-item">'+
     '<span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(chapter.title||'Capítulo')+'</strong>'+
     '<small>'+esc(preview)+(preview.length>=155?'…':'')+'</small><i aria-hidden="true">↗</i></button>';
   }).join('')+'</div>'+
   '<button type="button" class="ae-ficha-guide-library" data-ficha-library>ABRIR BIBLIOTECA COMPLETA</button></section>';
 }
 function content(s,selected,ctx){
  return selected==='summary'?summary(s,ctx):selected==='skills'?skills(s,ctx):
   selected==='identification'?identification(s,ctx):
   selected==='abilities'?abilities(s,ctx):selected==='guide'?guide():
   '<section class="ae-ficha-extras"><div class="ae-ficha-section-title"><h2>'+labels[selected]+'</h2></div>'+
    (ctx.body||'')+'</section>';
 }
 function switchTab(s,ctx={}){
  const selected=Object.hasOwn(labels,ctx.tab)?ctx.tab:'summary';
  const panel=document.querySelector('#page .ae-ficha-v2');
  const body=panel?.querySelector('#sheetBody');
  if(!body)return false;
  const previous=panel.querySelector('[data-tab].is-active');
  if(previous?.dataset.tab===selected)return true;
  for(const button of panel.querySelectorAll('.ae-ficha-navigation [data-tab]')){
   const active=button.dataset.tab===selected;
   button.classList.toggle('is-active',active);
   button.setAttribute('aria-current',active?'page':'false');
  }
  const existing=body.querySelector('.ae-ficha-section-content');
  const section=document.createElement('div');
  section.className='ae-ficha-section-content';
  section.innerHTML=content(s,selected,ctx);
  if(existing)existing.replaceWith(section);else body.appendChild(section);
  body.setAttribute('aria-label',labels[selected]);
  return true;
 }
 function render(s,ctx={}){
  const selected=Object.hasOwn(labels,ctx.tab)?ctx.tab:'summary';
  const body=content(s,selected,ctx);
  const actions=api.btn('VOLTAR','backSheets','quiet')+
    (ctx.canEdit?api.btn('EDITAR FICHA','editSheetForm','main'):'')+
    (ctx.master?api.btn('IMAGEM','sheetImage','small')+api.btn('EDITAR JSON','editSheet','small'):'')+
    api.btn('EXPORTAR','exportSheet','small');
  return '<div class="sheet-personal ae-ficha-v2" style="'+esc(ctx.style||'')+'">'+
    '<div class="ae-ficha-actions">'+actions+'</div>'+
    ((ctx.links||ctx.canEdit)?'<div class="ae-ficha-links">'+api.btn('JOGADORES VINCULADOS · '+(ctx.links||0),'sheetLinks','small quiet')+'</div>':'')+
    (ctx.paletteControls?'<div class="sheet-toolbar ae-ficha-palette">'+ctx.paletteControls+'</div>':'')+
    header(s)+
    '<div class="ae-ficha-workspace"><div class="ae-ficha-body" id="sheetBody" aria-label="'+labels[selected]+'">'+
     '<div class="ae-ficha-section-content">'+body+'</div></div>'+tabs(selected)+'</div>'+
   '</div>';
 }
 function upgradeEditor(){
  const root=document.querySelector('#dialogRoot .sheet-form');
  if(!root||root.classList.contains('ae-ficha-editor-v2'))return;
  const scroll=root.querySelector('.sheet-edit-scroll');if(!scroll)return;
  const nodes=Array.from(scroll.children);
  if(!nodes.some(n=>n.tagName==='H3'))return;
  root.classList.add('ae-ficha-editor-v2');
  const tabs=document.createElement('nav');
  tabs.className='ae-ficha-editor-steps';tabs.setAttribute('aria-label','Etapas da edição');
  const fragment=document.createDocumentFragment();
  let section=null,step=0,visibleSteps=[];
  for(const node of nodes){
   if(node.id==='sheetFormError'){fragment.appendChild(node);continue}
   if(node.tagName==='H3'){
    step++;
    section=document.createElement('section');
    section.className='ae-ficha-editor-step';section.dataset.fichaEditorStep=String(step);
    section.dataset.title=node.textContent.trim();
    if(!node.classList.contains('hidden')){
     visibleSteps.push({id:String(step),name:node.textContent.trim()});
    }else section.hidden=true;
    section.appendChild(node);fragment.appendChild(section);
   }else if(section){section.appendChild(node)}
   else fragment.appendChild(node);
  }
  scroll.appendChild(fragment);
  if(visibleSteps.length<2)return;
  for(const {id,name} of visibleSteps){
   const button=document.createElement('button');button.type='button';
   button.dataset.fichaStep=id;button.textContent=name;
   tabs.appendChild(button);
  }
  const progress=document.createElement('span');
  progress.className='ae-ficha-editor-progress';
  progress.setAttribute('role','status');
  progress.setAttribute('aria-live','polite');
  tabs.appendChild(progress);
  root.insertBefore(tabs,scroll);
  const available=visibleSteps.find(x=>x.name===editorStep)||visibleSteps[0];
  selectStep(available.id,root,false);
 }
 function selectStep(id,root=document.querySelector('#dialogRoot .sheet-form'),focus=true){
  if(!root)return;
  const panels=Array.from(root.querySelectorAll('.ae-ficha-editor-step'));
  const choice=panels.find(p=>p.dataset.fichaEditorStep===String(id)&&!p.querySelector('h3.hidden'));
  if(!choice)return;
  editorStep=choice.dataset.title;
  for(const panel of panels)panel.hidden=panel!==choice;
  for(const button of root.querySelectorAll('[data-ficha-step]')){
   const active=button.dataset.fichaStep===String(id);
   button.classList.toggle('is-active',active);button.setAttribute('aria-current',active?'step':'false');
  }
  const steps=[...root.querySelectorAll('[data-ficha-step]')];
  const index=steps.findIndex(b=>b.dataset.fichaStep===String(id));
  const progress=root.querySelector('.ae-ficha-editor-progress');
  if(progress)progress.textContent='ETAPA '+(index+1)+' / '+steps.length;
  if(focus)choice.querySelector('input,select,textarea')?.focus({preventScroll:true});
 }
 document.addEventListener('click',event=>{
  const typeBtn=event.target.closest?.('[data-ability-filter]');
  if(typeBtn){
   event.preventDefault();
   const type=typeBtn.dataset.abilityFilter;
   if(!['Todas','Técnicas','Habilidades'].includes(type))return;
   abilityKind=type;
   const root=typeBtn.closest('.ae-ficha-abilities');
   if(!root)return;
   root.dataset.abilityView=type;
   for(const button of root.querySelectorAll('[data-ability-filter]')){
    const active=button.dataset.abilityFilter===type;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',String(active));
   }
   for(const entry of root.querySelectorAll('.ae-ficha-ability-entry')){
    const card=entry.querySelector('[data-ability-kind]');
    entry.hidden=!!card&&type!=='Todas'&&card.dataset.abilityKind!==type;
   }
   for(const group of root.querySelectorAll('.ae-ficha-ability-group')){
    group.hidden=![...group.querySelectorAll('.ae-ficha-ability-entry')].some(node=>!node.hidden);
   }
   return;
  }
  const step=event.target.closest?.('[data-ficha-step]');
  if(step){event.preventDefault();selectStep(step.dataset.fichaStep);return}
  const library=event.target.closest?.('[data-ficha-library]');
  if(library){event.preventDefault();api.setPage('library');return}
  const guideBtn=event.target.closest?.('[data-ficha-guide]');
  if(!guideBtn)return;
  event.preventDefault();
  const item=(api.db?.rules||[]).find(x=>x.id===guideBtn.dataset.fichaGuide);
  if(item)api.modal(item.title||'Guia rápido','<div class="ae-ficha-guide-modal">'+api.formatBook(item.text||'',item.title||'')+'</div>');
 });
 window.ARQUIVO_FICHA_VISUAL=Object.freeze({render,switchTab,upgradeEditor});
})();