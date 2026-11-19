import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const escape=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const groups={
 Corpo:['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão'],
 Mente:['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia'],
 Espírito:['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']
};
const example=()=>({
 id:'ficha-01',name:'Personagem Exemplo',subtitle:'Shinigami substituto',
 race:'Shinigami',level:3,image:'https://example.org/portrait.webp',
 groups:{Corpo:8,Mente:6,Espírito:10},
 skills:Object.fromEntries(Object.values(groups).flat().map(name=>[name,4])),
 resources:{vida:{current:20,max:30},estabilidade:{current:10,max:20},alma:{current:6,max:10}},
 abilities:[
  {name:'Corte Crescente',category:'active',cost:2,description:'Descrição com custo de Alma.'},
  {name:'Instinto Espiritual',category:'passive',cost:0,description:'Passiva sempre disponível.'},
  {name:'Bankai',category:'release',cost:5,description:'Texto detalhado.\nHabilidade descrita manualmente.'}
 ],
 conditions:['Abalado'],inventory:{items:[{name:'Zanpakutō'}]},notes:'Acompanhar a história do personagem.'
});
function setup(){
 const listeners={},seen={modal:null,page:null};
 const document={
  addEventListener(name,fn){(listeners[name]??=[]).push(fn)},
  querySelector(){return null}
 };
 const api={
  esc:escape,
  btn(label,action){return '<button type="button" data-action="'+escape(action)+'">'+escape(label)+'</button>'},
  dataUrlOk(url){return /^(https:\/\/|data:image\/)/.test(String(url||''))},
  mediaSrc(url){return url},
  sheetRich(txt){return '<span class="text-rendered">'+escape(txt)+'</span>'},
  formatBook(text){return '<div class="rule-content">'+escape(text)+'</div>'},
  setPage(page){seen.page=page},
  modal(title,markup){seen.modal={title,markup}},
  db:{rules:[{id:'cap1',title:'VIDA, ESTABILIDADE & ALMA',text:'VIDA, ESTABILIDADE & ALMA\nRegras de recursos.'}]}
 };
 const window={ARQUIVO_INTERNAL:api};
 const context={window,document};
 vm.runInNewContext(read('ficha-visual.js'),context);
 return {view:window.ARQUIVO_FICHA_VISUAL,api,context,listeners,seen};
}
const settings=(tab='summary',canEdit=true)=>({tab,groups,canEdit,master:false,links:0,
 style:'--theme-accent:#33d4ef;',body:'<section class="existing-panel">Painel manual preservado</section>',
 history:'<div class="history">Histórico de rolagem existente</div>'});
test('ficha reconstruída preserva hero, retrato, recursos e navegação por oito seções',()=>{
 const {view}=setup(),html=view.render(example(),settings());
 assert.match(html,/ae-ficha-v2/);
 assert.match(html,/ae-ficha-hero/);
 assert.match(html,/Personagem Exemplo/);
 assert.match(html,/https:\/\/example\.org\/portrait\.webp/);
 assert.match(html,/data-tab="summary"/);
 assert.match(html,/data-tab="guide"/);
 assert.equal((html.match(/class="ae-ficha-nav-button/g)||[]).length,8);
 assert.match(html,/aria-valuenow="20"/);
 assert.match(html,/aria-valuemax="30"/);
 assert.match(html,/data-action="editResource:vida"/);
 assert.match(html,/Histórico de rolagem existente/);
});
test('leitor sem permissão pode consultar, mas não editar os recursos',()=>{
 const {view}=setup(),html=view.render(example(),settings('summary',false));
 assert.match(html,/Vida|VIDA/);
 assert.doesNotMatch(html,/data-action="editResource:/);
 assert.doesNotMatch(html,/data-action="editSheetForm"/);
});
test('perícias permanecem em duas colunas com dados de perícia e grupo',()=>{
 const {view}=setup(),html=view.render(example(),settings('skills'));
 assert.equal((html.match(/class="ae-ficha-skills-col"/g)||[]).length,2);
 assert.equal((html.match(/class="ae-ficha-skill-row"/g)||[]).length,18);
 for(const name of ['Vigor','Fortitude','Destreza','Cultura','Determinação','Manipulação','Liberação'])
  assert.match(html,new RegExp(name));
 assert.match(html,/data-action="editSheetSection:skills"/);
 assert.match(html,/d8/);
});
test('habilidades são separadas por categoria e só contêm ações manuais',()=>{
 const {view}=setup(),html=view.render(example(),settings('abilities'));
 for(const name of ['ATIVAS','PASSIVAS','OUTRAS HABILIDADES','Corte Crescente','Instinto Espiritual','Bankai'])
  assert.ok(html.includes(name),name);
 assert.equal((html.match(/class="ae-ficha-ability-card"/g)||[]).length,3);
 assert.match(html,/data-action="editAbilityDirect:0"/);
 assert.match(html,/CUSTO INDICADO/);
 assert.doesNotMatch(html,/data-action="(?:abilityRoll|useAbility|rollSkill)/);
});
test('as outras seções mantêm o conteúdo e a permissão dos painéis atuais',()=>{
 const {view}=setup();
 for(const tab of ['bonds','conditions','inventory','notes']){
  const html=view.render(example(),settings(tab));
  assert.ok(html.includes('Painel manual preservado'),tab);
  assert.match(html,/ae-ficha-extras/);
 }
});
test('guia rápido usa capítulos reais e abre a regra sem criar novas mecânicas',()=>{
 const {view,listeners,seen}=setup();
 const html=view.render(example(),settings('guide'));
 assert.match(html,/VIDA, ESTABILIDADE &amp; ALMA/);
 assert.match(html,/data-ficha-guide="cap1"/);
 const target={closest(sel){if(sel==='[data-ficha-guide]')return {dataset:{fichaGuide:'cap1'}};return null}};
 let prevented=false;
 for(const fn of listeners.click||[])fn({target,preventDefault(){prevented=true}});
 assert.equal(prevented,true);
 assert.equal(seen.modal?.title,'VIDA, ESTABILIDADE & ALMA');
 assert.match(seen.modal.markup,/Regras de recursos/);
});
test('textos e imagens são escapados e uploads não alteram os dados originais',()=>{
 const sheet=example();sheet.name='<script>alert(1)</script>';
 const before=JSON.stringify(sheet);
 const {view}=setup(),html=view.render(sheet,settings());
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.equal(JSON.stringify(sheet),before);
});
test('o app utiliza nova ficha após controles de acesso e o editor preserva salvamento',()=>{
 const app=read('arquivo-app.js'),html=read('index.html');
 assert.match(app,/if\(s\?\.masterOnly&&!master\(\)\)/);
 assert.match(app,/if\(s\.locked&&\(!canEditSheet\(s\.id\)\|\|s\.redacted\)\)/);
 assert.match(app,/window\.ARQUIVO_FICHA_VISUAL\.render\(s/);
 assert.match(app,/window\.ARQUIVO_FICHA_VISUAL\?\.upgradeEditor\?\.\(\)/);
 assert.match(app,/function saveSheetForm\(/);
 assert.match(app,/function updateDraft\(target\)/);
 assert.match(html,/ficha-visual\.js\?v=1/);
 assert.match(html,/ficha-visual\.css\?v=1/);
 assert.ok(html.indexOf('arquivo-app.js?v=12')<html.indexOf('ficha-visual.js?v=1'));
});
