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
 for(const file of ['racas-armazem.js','classes-armazem.js','habilidades-armazem.js'])
  vm.runInNewContext(read(file),context);
 window.ARQUIVO_SECOES={warehouse:()=>({posts:[
  ...window.ARQUIVO_RACAS_CBB,...window.ARQUIVO_CLASSES_CBB,...window.ARQUIVO_HABILIDADES_CBB]})};
 vm.runInNewContext(read('ficha-origens.js'),context);
 vm.runInNewContext(read('ficha-visual.js'),context);
 return {view:window.ARQUIVO_FICHA_VISUAL,api,context,listeners,seen};
}
const settings=(tab='summary',canEdit=true)=>({tab,groups,canEdit,master:false,links:0,
 style:'--theme-accent:#33d4ef;',body:'<section class="existing-panel">Painel manual preservado</section>',
 history:'<div class="history">Histórico de rolagem existente</div>'});
test('ficha reconstruída preserva hero, retrato, recursos e navegação por dez seções',()=>{
 const {view}=setup(),html=view.render(example(),settings());
 assert.match(html,/ae-ficha-v2/);
 assert.match(html,/ae-ficha-hero/);
 assert.match(html,/Personagem Exemplo/);
 assert.match(html,/https:\/\/example\.org\/portrait\.webp/);
 assert.match(html,/data-tab="summary"/);
 assert.match(html,/data-tab="guide"/);
 const nav=html.slice(html.indexOf('class="ae-ficha-navigation"'));
 assert.ok(nav.indexOf('data-tab="identification"')<nav.indexOf('data-tab="abilities"'));
 assert.equal((html.match(/class="ae-ficha-nav-button/g)||[]).length,10);
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
test('habilidades usam apenas categorias personalizadas ou Gerais, sem tipos antigos',()=>{
 const {view}=setup(),html=view.render(example(),settings('abilities'));
 for(const name of ['GERAIS','Corte Crescente','Instinto Espiritual','Bankai'])
  assert.ok(html.includes(name),name);
 assert.equal((html.match(/class="ae-ficha-ability-card"/g)||[]).length,3);
 assert.match(html,/data-action="editAbilityDirect:0"/);
 assert.match(html,/data-action="exportAbilities"/);
 assert.match(html,/2 ALMA/);
 assert.doesNotMatch(html,/CUSTO INDICADO|ATIVAS|PASSIVAS|OUTRAS HABILIDADES/);
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
 assert.match(app,/window\.ARQUIVO_FICHA_VISUAL\.render\(window\.ARQUIVO_ORIGENS\?\.project\(s\)\|\|s/);
 assert.match(app,/window\.ARQUIVO_FICHA_VISUAL\?\.upgradeEditor\?\.\(\)/);
 assert.match(app,/function saveSheetForm\(/);
 assert.match(app,/function updateDraft\(target\)/);
 assert.match(html,/ficha-visual\.js\?v=16/);
 assert.match(html,/ficha-visual\.css\?v=13/);
 assert.ok(html.indexOf('arquivo-app.js?v=23')<html.indexOf('ficha-visual.js?v=16'));
});

test('cabeçalho não inventa raça e os títulos não recebem numeração',()=>{
 const {view}=setup(),sheet=example();sheet.race='';
 const html=view.render(sheet,settings());
 assert.doesNotMatch(html,/RAÇA NÃO DEFINIDA|Raça não definida/);
 assert.doesNotMatch(html,/class="ae-ficha-race"/);
 assert.match(html,/class="ae-ficha-level">NÍVEL 3/);
 assert.match(html,/GRUPOS/i);
 for(const tab of ['summary','skills','identification','abilities','notes','guide']){
  const content=view.render(sheet,settings(tab));
  assert.doesNotMatch(content,/<span>0[123]<\/span>\s*<h2/);
 }
 assert.match(html,/Vida, Estabilidade &amp; Alma|Vida, Estabilidade & Alma/);
 assert.doesNotMatch(html,/REGISTRO DE PERSONAGEM|REGISTRO ESPIRITUAL|SOUL ARCHIVE|Valores atualizados manualmente/);
});
test('retrato usa área exclusiva e limites responsivos sem invadir o nome',()=>{
 const css=read('ficha-visual.css');
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(185px,25%,330px\)/);
 assert.match(css,/grid-column:1;grid-row:2;align-self:center/);
 assert.match(css,/grid-column:2;grid-row:1\/3;position:relative/);
 assert.match(css,/object-fit:cover;object-position:50% 50%/);
 assert.match(css,/#page \.ae-ficha-art-image\{[\s\S]*?position:absolute;inset:8px;/);
 assert.match(css,/width:calc\(100% - 16px\);height:calc\(100% - 16px\)/);
 assert.match(css,/#page \.ae-ficha-hero-art::before\{[\s\S]*?inset:8px;/);
 assert.doesNotMatch(css,/#page \.ae-ficha-section-title>span\{/);
});
test('ficha mantém dados e ações sem textos auxiliares redundantes',()=>{
 const {view}=setup(),sheet=example();
 for(const tab of ['summary','skills','identification','abilities','guide','notes']){
  const markup=view.render(sheet,settings(tab));
  for(const redundant of ['REGISTRO DE PERSONAGEM','REGISTRO ESPIRITUAL','SOUL ARCHIVE','ANOTAÇÃO RECENTE',
    'Valores atualizados manualmente','Sem rolagem automática','Registros descritivos',
    'Consulta às regras consolidadas','// RESUMO','// PERÍCIAS','BLEACH CBB //']){
   assert.ok(!markup.includes(redundant),tab+' não deve apresentar: '+redundant);
  }
 }
 const summary=view.render(sheet,settings('summary'));
 assert.match(summary,/data-action="editResource:vida"/);
 assert.match(summary,/Acompanhar a história do personagem/);
 const skills=view.render(sheet,settings('skills'));
 assert.match(skills,/Grupos &amp; perícias|Grupos & perícias/);
 const abilities=view.render(sheet,settings('abilities'));
 assert.match(abilities,/2 ALMA/);
 assert.doesNotMatch(abilities,/CUSTO INDICADO/);
 assert.match(abilities,/Descrição com custo de Alma/);
 const guide=view.render(sheet,settings('guide'));
 assert.match(guide,/data-ficha-library/);
});

test('Identificação exibe textos integrais de classe e raça, sem misturar habilidades',()=>{
 const {view}=setup(),sheet=example();
 sheet.race='Arrancar';sheet.className='Coração de Aço';
 sheet.abilities.push(
  {name:'Hierro',category:'active',libraryType:'habilidade',cost:2,description:'Legado',
   origin:{auto:true,kind:'race',name:'Arrancar'}},
  {name:'Têmpera',category:'active',libraryType:'habilidade',cost:0,description:'Legado',
   origin:{auto:true,kind:'class',name:'Coração de Aço'}},
  {name:'Mira Estável',category:'active',libraryType:'tecnica',cost:2,description:'Disparo preparado'}
 );
 const identity=view.render(sheet,settings('identification'));
 for(const value of ['Identificação','Arrancar','Coração de Aço','## Têmpera',
  '[barra:3/3]','Hollows que removeram suas máscaras'])
  assert.ok(identity.includes(value),value);
 assert.doesNotMatch(identity,/Habilidades da raça|Habilidades da classe|ae-ficha-origin-trait|Instinto Primário|Sonído|Hierro|Cero/i,
  'A identificação apresenta a raça e classe, sem repetir habilidades que já estão na ficha');
 const ability=view.render(sheet,settings('abilities'));
 assert.match(ability,/data-ability-kind="Técnicas"/);
 assert.match(ability,/data-ability-filter="Habilidades"/);
 assert.match(ability,/Mira Estável/);
 assert.doesNotMatch(ability,/HABILIDADE RACIAL|HABILIDADE DE CLASSE|Têmpera|Hierro/);
 assert.equal((ability.match(/class="ae-ficha-ability-card"/g)||[]).length,4);
 const summary=view.render(sheet,settings('summary'));
 assert.match(summary,/Recursos de raça e classe/);
 assert.match(summary,/Têmpera/);
 assert.match(summary,/data-action="originMeter:class%3Aclasse-coracao-de-aco%3Atempera:1"/);
 assert.match(summary,/aria-valuemax="3" aria-valuenow="0"/);
 const readonly=view.render(sheet,settings('summary',false));
 assert.doesNotMatch(readonly,/data-action="originMeter:/);
});
test('um controle compacto alterna + e − sem repetir a descrição da habilidade',()=>{
 const {view}=setup(),sheet=example(),html=view.render(sheet,settings('abilities'));
 assert.equal((html.match(/class="ae-ficha-ability-details"/g)||[]).length,3);
 assert.equal((html.match(/class="ae-ficha-expand-plus"/g)||[]).length,3);
 assert.equal((html.match(/class="ae-ficha-expand-minus"/g)||[]).length,3);
 assert.match(html,/Mostrar ou ocultar a descrição de Corte Crescente/);
 assert.match(html,/Mostrar ou ocultar a descrição de Bankai/);
 assert.match(html,/ae-ficha-ability-full sheet-rich/);
 assert.doesNotMatch(html,/LER DESCRIÇÃO COMPLETA|LER TÉCNICA COMPLETA|ae-ficha-ability-teaser/);
 assert.doesNotMatch(read('ficha-visual.js'),/LER DESCRIÇÃO COMPLETA/);
 assert.match(read('ficha-visual.css'),/ae-ficha-ability-details\[open\] \.ae-ficha-expand-minus/);
});

test('expandir uma habilidade não estica o cartão vizinho',()=>{
 const css=read('ficha-visual.css');
 assert.match(css,/#page \.ae-ficha-ability-grid\{[^}]*align-items:start/);
 assert.match(css,/#page \.ae-ficha-ability-entry\{[^}]*align-self:start/);
 assert.match(css,/#page \.ae-ficha-ability-entry>\.ae-ficha-ability-card\{[^}]*height:auto/);
 assert.doesNotMatch(css,/#page \.ae-ficha-ability-entry>\.ae-ficha-ability-card\{flex:1\}/);
 const {view}=setup(),sheet=example(),html=view.render(sheet,settings('abilities'));
 assert.equal((html.match(/class="ae-ficha-ability-entry"/g)||[]).length,3);
 assert.equal((html.match(/class="ae-ficha-ability-details"/g)||[]).length,3);
});

test('mestre cria grupos e organiza técnicas em Ressurreição sem alterar seus tipos',()=>{
 const {view}=setup(),sheet=example();
 sheet.name='Starrk';
 sheet.abilityGroups=[{id:'ressurreicao',name:'Ressurreição'}];
 sheet.abilities[0].groupId='ressurreicao';
 sheet.abilities[2].groupId='ressurreicao';
 const html=view.render(sheet,{...settings('abilities'),master:true});
 assert.match(html,/data-action="abilityGroups"/);
 assert.match(html,/data-action="newAbilityDirect"/);
 assert.match(html,/ae-ficha-ability-group--custom/);
 assert.match(html,/Ressurreição/);
 assert.equal((html.match(/id="ability-0"/g)||[]).length,1);
 assert.equal((html.match(/id="ability-1"/g)||[]).length,1);
 assert.equal((html.match(/id="ability-2"/g)||[]).length,1);
 const group=html.match(/<section class="ae-ficha-ability-group ae-ficha-ability-group--custom"[^>]*>[\s\S]*?<\/section>/)?.[0];
 assert.ok(group);
 assert.match(group,/Corte Crescente/);
 assert.match(group,/Bankai/);
 assert.doesNotMatch(group,/Instinto Espiritual/);
 assert.match(html,/data-ability-kind="Habilidades"/);
});

test('jogador vinculado edita organização e aparência, sem permissão de criar categorias',()=>{
 const {view}=setup(),sheet=example();
 sheet.abilityGroups=[{id:'ressurreicao',name:'Ressurreição'}];
 sheet.abilities[0].groupId='ressurreicao';
 const html=view.render(sheet,{...settings('abilities'),master:false,canEdit:true});
 assert.match(html,/Ressurreição/);
 assert.match(html,/data-action="editAbilityDirect:0"/);
 assert.match(html,/data-action="exportAbilities"/);
 assert.doesNotMatch(html,/data-action="abilityGroups"|data-action="newAbilityDirect"/);
 const restricted=view.render(sheet,{...settings('abilities'),master:false,canEdit:false});
 assert.doesNotMatch(restricted,/data-action="editAbilityDirect:|data-action="abilityGroups"/);
});

test('editor do jogador preserva a descrição, enquanto o Mestre gerencia categorias por ficha',()=>{
 const app=read('arquivo-app.js');
 for(const literal of ['function abilityGroupsDialog()', 'function abilityGroupCreate()',
   'function abilityGroupRename(id)', 'function abilityGroupDelete(id)',
   'data-ability-group-rename', "if(!master()||!sheetPermission())return",
   'function abilityGroupOptions(s,ab,i)', 'data-ability=', "':groupId",
   'function abilityDescriptionField(ab,i)', 'textarea readonly aria-readonly="true"',
   "if((key==='description'||key==='usage')&&!master())return",
   "raw.abilityGroups=clone(old.abilityGroups||[])",
   "ab.description=originals[i].description||''"]){
  assert.ok(app.includes(literal),literal);
 }
 assert.match(app,/case'abilityGroups':abilityGroupsDialog\(\)/);
 assert.match(app,/abilityGroups:\[\]/);
 assert.match(app,/function saveSheetForm\(/);
 assert.doesNotMatch(app,/sectionId/);
});

test('uso e custo são curtos, sem tipos antigos, e categorias antigas não mudam a ficha',()=>{
 const {view}=setup(),sheet=example();
 sheet.abilities[0].usage='Uma vez por fase';
 sheet.abilities[0].category='passive';
 sheet.abilities[0].passive=true;
 const html=view.render(sheet,settings('abilities'));
 assert.match(html,/>2 ALMA<\/span>/);
 assert.match(html,/Uma vez por fase/);
 assert.match(html,/GERAIS/);
 assert.doesNotMatch(html,/ATIVA|PASSIVA|MECÂNICA|LIBERAÇÃO|TRANSFORMAÇÃO|ULTIMATE|CUSTO INDICADO/);
 assert.equal((html.match(/class="ae-ficha-ability-card"/g)||[]).length,3);
});


test('pin ao lado do nome marca uma habilidade e mostra uso rápido no Resumo',()=>{
 const {view}=setup(),s=example();
 s.abilities[0].libraryType='tecnica';
 s.pinnedAbilities=['tecnica:Corte Crescente'];
 const summary=view.render(s,settings());
 assert.match(summary,/Acesso rápido/);
 assert.match(summary,/Corte Crescente/);
 assert.match(summary,/ae-ficha-quick-grid/);
 assert.match(summary,/data-cbb-command="pin" data-cbb-index="0"/);
 assert.match(summary,/aria-pressed="true"/);
 assert.match(summary,/data-tab="abilities"/);
 const abilities=view.render(s,settings('abilities'));
 assert.match(abilities,/class="ae-ficha-ability-title"/);
 assert.match(abilities,/Fixar Instinto Espiritual no resumo/);
 assert.match(abilities,/Desafixar Corte Crescente do resumo/);
 const readOnly=view.render(s,settings('abilities',false));
 assert.doesNotMatch(readOnly,/data-cbb-command="pin"/);
});

test('acesso rápido ignora pins obsoletos e itens automáticos sem duplicar controles',()=>{
 const {view}=setup(),s=example();
 s.pinnedAbilities=['habilidade:Removida','habilidade:Corte Crescente','habilidade:Corte Crescente'];
 const out=view.render(s,settings());
 assert.equal((out.match(/ae-ficha-quick-card"/g)||[]).length,1);
 assert.doesNotMatch(out,/Removida/);
 s.pinnedAbilities=[];
 const empty=view.render(s,settings());
 assert.match(empty,/Use o pin ao lado de uma habilidade/);
 const guest=view.render(s,settings('summary',false));
 assert.doesNotMatch(guest,/ae-ficha-quick-access/);
});
