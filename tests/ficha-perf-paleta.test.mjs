import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('a ficha aplica paleta compartilhada em fundo, cartões, moldura, dados e gradiente',()=>{
 const app=read('arquivo-app.js'),css=read('ficha-visual.css');
 assert.match(app,/--sheet-gradient:\$\{grad\}/);
 assert.match(app,/--sheet-dice-group:\$\{p\.diceGroup\}/);
 assert.match(app,/--sheet-dice-skill:\$\{p\.diceSkill\}/);
 assert.match(app,/--theme-structure:\$\{p\.cold\}/);
 assert.match(app,/function applySheetPaletteLive\(\)/);
 assert.match(css,/border:2px solid var\(--sheet-accent,var\(--theme-accent\)\)/);
 assert.match(css,/background-image:var\(--sheet-gradient,none\)/);
 assert.match(css,/background-color:var\(--theme-panel\)/);
 assert.match(css,/\.ae-ficha-die--group \.die-figure\.ae-inline-die/);
 assert.match(css,/\.ae-ficha-die--skill \.die-figure\.ae-inline-die/);
 const visual=read('ficha-visual.js');
 assert.match(visual,/numberDie\(s\.groups\?\.\[key\],'group'\)/);
 assert.match(visual,/numberDie\(s\.skills\?\.\[name\],'skill'\)/);
});

test('retrato deslocado ao centro, com limites e quadro independente do nome',()=>{
 const css=read('ficha-visual.css');
 assert.match(css,/align-self:center;justify-self:start;width:calc\(100% - clamp\(/);
 assert.match(css,/margin-left:clamp\(-30px,-2vw,-15px\)/);
 assert.match(css,/grid-column:2;grid-row:1\/3;position:relative/);
 assert.match(css,/max-height:280px/);
 assert.match(css,/#page \.ae-ficha-art-image\{[\s\S]*?object-fit:cover;object-position:50% 50%/);
});

test('troca de abas reaproveita hero e navegação existentes sem render global',()=>{
 const callbacks=[];
 const document={
  addEventListener(name,fn){callbacks.push({name,fn})},
  querySelector(){return null},
  createElement(){return {className:'',innerHTML:''}}
 };
 const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const api={
  esc,btn:(label,action)=>'<button data-action="'+esc(action)+'">'+esc(label)+'</button>',
  sheetRich:esc,mediaSrc:x=>x,dataUrlOk:()=>true,
  formatBook:esc,db:{rules:[]}
 };
 const window={ARQUIVO_INTERNAL:api};
 vm.runInNewContext(read('ficha-visual.js'),{window,document});
 const view=window.ARQUIVO_FICHA_VISUAL;
 const sheet={name:'Exemplo',id:'f1',level:1,groups:{Corpo:6,Mente:6,Espírito:6},
  skills:{Vigor:4},resources:{vida:{current:9,max:10},estabilidade:{current:5,max:5},alma:{current:3,max:3}},
  abilities:[],inventory:{items:[]},conditions:[],notes:''};
 const navButton=(tab)=>({
  dataset:{tab},classList:{values:[],toggle(k,on){this.values.push({k,on})}},
  attrs:{},setAttribute(k,v){this.attrs[k]=v}
 });
 const old=navButton('summary'),next=navButton('skills');
 const section={replaceWith(node){section.replacedWith=node}};
 const body={
  attrs:{},
  querySelector(selector){
   if(selector==='.ae-ficha-section-content')return section;
   return null;
  },setAttribute(k,v){this.attrs[k]=v}
 };
 const panel={
  querySelector(selector){
   if(selector==='#sheetBody')return body;
   if(selector==='[data-tab].is-active')return old;
   return null;
  },
  querySelectorAll:()=>[old,next]
 };
 document.querySelector=()=>panel;
 const ok=view.switchTab(sheet,{tab:'skills',groups:{Corpo:['Vigor']},canEdit:true});
 assert.equal(ok,true);
 assert.equal(body.attrs['aria-label'],'Perícias');
 assert.match(section.replacedWith.innerHTML,/ae-ficha-skills/);
 assert.equal(next.attrs['aria-current'],'page');
 assert.equal(old.attrs['aria-current'],'false');
});

test('o app atualiza só a aba, sem recarregar estilos, música, menus e retrato',()=>{
 const app=read('arquivo-app.js');
 const handler=app.slice(app.indexOf("const tb=e.target.closest('[data-tab]')"),app.indexOf("const b=e.target.closest('[data-action]')"));
 assert.match(handler,/view\?\.switchTab\?\.\(window\.ARQUIVO_ORIGENS\?\.project\(sh\)\|\|sh/);
 assert.match(handler,/if\(fast\)\{/);
 assert.match(handler,/render\(\);return/);
 assert.match(app,/if\(page!=='sheets'&&!motionOff\(\)\)/);
 assert.match(app,/if\(!editMode&&!Object\.keys\(overrides\)\.length\)return/);
 assert.match(app,/lastRenderedThemeState/);
 assert.doesNotMatch(app,/function resourcesBlock\(/);
 assert.doesNotMatch(app,/function skillGroups\(/);
 assert.doesNotMatch(app,/function abilityBadge\(/);
});

test('modificar tipo de habilidade e copiar dado não recria o formulário',()=>{
 const app=read('arquivo-app.js');
 const typeBlock=app.slice(app.indexOf("if(key==='category')"),app.indexOf("if(['name','cost','description','image','libraryType','groupId'].includes(key))"));
 assert.match(typeBlock,/input\.disabled=ab\.passive/);
 assert.doesNotMatch(typeBlock,/drawSheetForm\(\)/);
 const applyBlock=app.slice(app.indexOf('function applyGroup(g)'),app.indexOf('function addAbility()',app.indexOf('function applyGroup(g)')));
 assert.match(applyBlock,/field\.value=String\(editorDraft\.groups\[g\]\)/);
 assert.doesNotMatch(applyBlock,/drawSheetForm\(\)/);
 assert.match(read('ficha-visual.js'),/ETAPA '\+\(index\+1\)\+' \/ '\+steps\.length/);
});

test('leitura remota é compartilhada quando duas solicitações acontecem juntas',async()=>{
 const events=[];
 const window={ARQUIVO_ONLINE_CONFIG:{},dispatchEvent:e=>events.push(e.type)};
 class CustomEvent{constructor(type){this.type=type}}
 class Event{constructor(type){this.type=type}}
 vm.runInNewContext(read('online.js'),{window,CustomEvent,Event});
 const api=window.ARQUIVO_SYNC;
 api.state.enabled=true;
 api.state.revision=1;
 let requests=0,respond;
 api.state.client={rpc:async()=>{
  requests++;
  return await new Promise(resolve=>{respond=()=>resolve({data:{revision:2,data:{site:{title:'Teste'}}},error:null})});
 }};
 const first=api.refresh(true);
 const second=api.refresh(false);
 await Promise.resolve();
 assert.equal(requests,1);
 respond();
 await Promise.all([first,second]);
 assert.equal(requests,1);
 assert.equal(api.state.revision,2);
 assert.ok(events.includes('arquivo-online-snapshot'));
});

test('vínculos confirmados atualizam apenas o contador quando acesso não muda',()=>{
 const app=read('arquivo-app.js');
 const fn=app.slice(app.indexOf('async function changeSheetLink(action)'),app.indexOf('function sheetPage()',app.indexOf('async function changeSheetLink(action)')));
 assert.match(fn,/editableBefore=canEditSheet\(id\)/);
 assert.match(fn,/badge\.textContent='JOGADORES VINCULADOS/);
 assert.match(fn,/editableBefore!==canEditSheet\(id\)/);
 assert.match(fn,/render\(\)/);
});

test('estilos da antiga ficha foram eliminados sem remover componentes atuais',()=>{
 const css=read('arquivo-base.css');
 for(const old of ['.sheet-personal .character','.sheet-personal .tabs','.sheet-personal .skill-block','.sheet-personal .resource:nth-child'])
  assert.ok(!css.includes(old),old);
 for(const kept of ['.sheet-personal .panel','.sheet-palette-controls','.die-figure'])
  assert.ok(css.includes(kept),kept);
 const index=read('index.html');
 assert.match(index,/arquivo-base\.css\?v=5/);
});

test('campos da paleta enviados ao servidor permanecem compatíveis com a versão online',()=>{
 const app=read('arquivo-app.js');
 const fields=app.slice(app.indexOf('const SHEET_PALETTE_FIELDS='),app.indexOf('const SHEET_HEX='));
 for(const name of ['accent','panel','raised','cold','text','bg','diceGroup','diceSkill'])
  assert.ok(fields.includes("['"+name+"'"),name);
 assert.ok(!fields.includes("['structure'"));
 assert.match(app,/--theme-structure:\$\{p\.cold\}/);
});
