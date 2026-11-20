import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('arquivo-app.js');
const begin=app.indexOf('function abilityGroupOptions(s,ab,i){');
const end=app.indexOf('function drawSheetForm(){',begin);
assert.ok(begin>=0&&end>begin,'Funções de categoria presentes no editor');
const code=app.slice(begin,end);

function setup(initialGroups=[]){
 const sheet={id:'starrk',name:'Coyote Starrk',abilityGroups:structuredClone(initialGroups),
  abilities:[{name:'Cero',description:'Técnica de disparo',category:'active',cost:3,groupId:initialGroups[0]?.id||''}]};
 let allowed=true,saveCount=0,renderCount=0,nextId=0,lastModal=null;
 let inputName='',renameValue='';
 const alerts=[];
 const context={
  db:{sheets:[sheet]},currentSheet:sheet.id,
  master:()=>allowed,sheetPermission:()=>true,
  uid:()=>String('grupo-'+(++nextId)),
  esc:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  btn:(label,action)=>'<button data-action="'+action+'">'+label+'</button>',
  el:id=>id==='abilityGroupName'?{value:inputName}:
   id==='dialogRoot'?{querySelectorAll(){return sheet.abilityGroups.map(g=>({dataset:{abilityGroupRename:g.id},value:renameValue}))}}:null,
  save(){saveCount++},render(){renderCount++},
  modal(title,body,buttons){lastModal={title,body,buttons}},
  toast(...args){alerts.push(args)},
  confirmSite(_title,_body,fn){fn()}
 };
 vm.runInNewContext(code,context);
 return {
  sheet,context,alerts,
  setMaster(v){allowed=v},
  setInput(v){inputName=v},
  setRename(v){renameValue=v},
  get lastModal(){return lastModal},
  get saveCount(){return saveCount},
  get renderCount(){return renderCount}
 };
}
test('Mestre cria categorias exclusivas da ficha, sem alterar descrições',()=>{
 const ctx=setup();
 ctx.setInput('Ressurreição');
 ctx.context.abilityGroupCreate();
 assert.equal(ctx.sheet.abilityGroups.length,1);
 assert.equal(ctx.sheet.abilityGroups[0].name,'Ressurreição');
 assert.match(ctx.lastModal.body,/Ressurreição/);
 assert.match(ctx.lastModal.body,/data-ability-group-rename/);
 assert.equal(ctx.saveCount,1);
 assert.equal(ctx.renderCount,1);
 assert.equal(ctx.sheet.abilities[0].description,'Técnica de disparo');
 ctx.setInput('ressurreicao');
 ctx.context.abilityGroupCreate();
 assert.equal(ctx.sheet.abilityGroups.length,1,'Nomes sem acentos não duplicam categorias');
 assert.equal(ctx.saveCount,1);
});
test('Mestre pode renomear ou remover categoria sem apagar habilidades',()=>{
 const ctx=setup([{id:'ress',name:'Ressurreição'}]);
 ctx.setRename('Los Lobos');
 ctx.context.abilityGroupRename('ress');
 assert.equal(ctx.sheet.abilityGroups[0].name,'Los Lobos');
 assert.equal(ctx.sheet.abilities[0].groupId,'ress');
 ctx.context.abilityGroupDelete('ress');
 assert.equal(ctx.sheet.abilityGroups.length,0);
 assert.equal(ctx.sheet.abilities.length,1);
 assert.equal(ctx.sheet.abilities[0].groupId,'');
 assert.equal(ctx.sheet.abilities[0].description,'Técnica de disparo');
 assert.equal(ctx.saveCount,2);
});
test('Jogador não cria, altera ou remove categorias; nome/imagem/tipo continuam editáveis',()=>{
 const ctx=setup([{id:'ress',name:'Ressurreição'}]);
 ctx.setMaster(false);
 ctx.setInput('Habilidades Secretas');
 ctx.context.abilityGroupCreate();
 ctx.context.abilityGroupRename('ress');
 ctx.context.abilityGroupDelete('ress');
 ctx.context.abilityGroupsDialog();
 assert.equal(ctx.sheet.abilityGroups.length,1);
 assert.equal(ctx.saveCount,0);
 assert.equal(ctx.lastModal,null);
 const opts=ctx.context.abilityGroupOptions(ctx.sheet,ctx.sheet.abilities[0],0);
 assert.match(opts,/data-ability="0:groupId"/);
 assert.match(opts,/value="ress" selected/);
 const playerDescription=ctx.context.abilityDescriptionField(ctx.sheet.abilities[0],0);
 assert.match(playerDescription,/textarea readonly aria-readonly="true"/);
 assert.match(playerDescription,/Técnica de disparo/);
 assert.doesNotMatch(playerDescription,/data-ability="0:description"/);
 ctx.setMaster(true);
 const masterDescription=ctx.context.abilityDescriptionField(ctx.sheet.abilities[0],0);
 assert.match(masterDescription,/data-ability="0:description"/);
 assert.doesNotMatch(masterDescription,/readonly/);
});
test('Dados usam groupId já existente nas fichas e preservam descrições do jogador',()=>{
 const src=read('arquivo-app.js'),visual=read('ficha-visual.js');
 for(const statement of [
  "raw.abilityGroups=clone(old.abilityGroups||[])",
  "ab.description=originals[i].description||''",
  "if(key==='description'&&!master())return",
  "if(!master())return;editorDraft.abilities.push",
  "if(!master())return;editorDraft.abilities.splice",
  "view?.switchTab?.(window.ARQUIVO_ORIGENS?.project(sh)||sh,{tab,groups:GROUPS,canEdit:canEditSheet(sh.id),master:master()"
 ])assert.ok(src.includes(statement),statement);
 assert.match(src,/data-ability-group-rename/);
 assert.doesNotMatch(src,/sectionId/);
 assert.match(visual,/ae-ficha-ability-group--custom/);
 assert.match(visual,/ctx.master\?api.btn\('\+ CATEGORIA','abilityGroups'/);
});
