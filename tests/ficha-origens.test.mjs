import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

function setup(){
 const window={};
 const ctx={window};
 for(const file of ['classes-armazem.js','habilidades-armazem.js']){
  vm.runInNewContext(read(file),ctx);
 }
 const catalog=[...window.ARQUIVO_CLASSES_CBB,...window.ARQUIVO_HABILIDADES_CBB];
 window.ARQUIVO_SECOES={warehouse:()=>({posts:catalog})};
 vm.runInNewContext(read('ficha-origens.js'),ctx);
 return {logic:window.ARQUIVO_ORIGENS,catalog};
}
const sheet=(race='',className='')=>({id:'f1',name:'Exemplo',race,className,abilities:[]});

test('Arrancar recebe Instinto Primário e as habilidades raciais, com custos e origem',()=>{
 const {logic}=setup(),s=sheet('Arrancar');
 assert.equal(logic.reconcile(s),true);
 assert.deepEqual(Array.from(s.abilities,a=>a.name),['Instinto Primário','Hierro','Sonído','Cero']);
 assert.deepEqual(Array.from(s.abilities,a=>a.cost),[2,2,2,3]);
 assert.ok(s.abilities.every(a=>a.origin.auto&&a.origin.kind==='race'));
 assert.ok(s.abilities.every(a=>a.libraryType==='habilidade'));
 assert.equal(logic.reconcile(s),false,'reconciliação idempotente');
 assert.equal(s.abilities.length,4);
 assert.match(s.abilities[0].description,/Falha Crítica em um teste de Instinto/);
});
test('cada classe concede sua mecânica sem exigir código específico',()=>{
 const {logic}=setup();
 const expected=[['Coração de Aço','Têmpera'],['Especialista em Hohō','Rastro'],['Caçador','Emboscada'],['Porta-voz','Manobrista']];
 for(const [className,trait] of expected){
  const s=sheet('',className);
  assert.equal(logic.reconcile(s),true);
  assert.deepEqual(Array.from(s.abilities,a=>a.name),[trait]);
  assert.equal(s.abilities[0].origin.kind,'class');
  assert.equal(s.abilities[0].origin.name,className);
  assert.ok(s.abilities[0].description.length>15);
 }
});
test('troca de raça e classe remove apenas concessões automáticas, preservando manuais',()=>{
 const {logic}=setup(),s=sheet('Arrancar','Coração de Aço');
 s.abilities.push({name:'Técnica Inventada',description:'Original',cost:5,category:'active',libraryType:'tecnica'});
 logic.reconcile(s);
 assert.equal(s.abilities.length,6);
 s.race='Quincy';s.className='Caçador';
 logic.reconcile(s);
 assert.deepEqual(Array.from(s.abilities,a=>a.name),['Técnica Inventada','Emboscada']);
 assert.equal(s.abilities[0].description,'Original');
 s.className='';logic.reconcile(s);
 assert.deepEqual(Array.from(s.abilities,a=>a.name),['Técnica Inventada']);
});
test('habilidades existentes com mesmo nome não são sobrescritas nem duplicadas',()=>{
 const {logic}=setup(),s=sheet('Arrancar');
 s.abilities=[{name:'Hierro',description:'Edição personalizada',category:'passive',cost:0}];
 logic.reconcile(s);
 assert.equal(s.abilities.filter(a=>a.name==='Hierro').length,1);
 assert.equal(s.abilities.find(a=>a.name==='Hierro').description,'Edição personalizada');
 assert.equal(s.abilities.length,4);
});
test('nova raça e classe publicadas são reconhecidas sem alteração no programa',()=>{
 const {logic,catalog}=setup();
 catalog.push({id:'raca-quincy-habilidade',title:'Heilig Pfeil',category:'Habilidades',published:true,
  content:'Flecha espiritual',cost:'2 ALMA',grants:{race:['Quincy'],class:[]}});
 catalog.push({id:'classe-nova',title:'Atirador',category:'Classes',published:true,
  content:'## Identidade\nAtirador.\n\n## Cadência\nPossui [sequencia:3/3] de ritmo.\n\n## Disparo Duplo\nPode atacar dois alvos.'});
 catalog.push({id:'habilidade-aranha',title:'Rede',category:'Habilidades',published:true,
  content:'Tece uma rede',cost:'1 ALMA',grants:{race:[],class:['Atirador']}});
 assert.ok(logic.classes().includes('Atirador'));
 const s=sheet('Quincy','Atirador');
 logic.reconcile(s);
 assert.deepEqual(Array.from(s.abilities,a=>a.name),['Heilig Pfeil','Cadência','Disparo Duplo','Rede']);
 assert.deepEqual(Array.from(s.abilities,a=>a.origin.kind),['race','class','class','class']);
 assert.equal(s.abilities[0].cost,2);
 assert.equal(s.abilities[3].cost,1);
});
test('habilidades despublicadas não são concedidas; grants vazio revoga tags raciais',()=>{
 const {logic,catalog}=setup();
 const hierro=catalog.find(x=>x.title==='Hierro');
 hierro.published=false;
 const s=sheet('Arrancar');
 logic.reconcile(s);
 assert.deepEqual(Array.from(s.abilities,a=>a.name),['Instinto Primário','Sonído','Cero']);
 const sonido=catalog.find(x=>x.title==='Sonído');
 sonido.grants={race:[],class:[]};
 logic.reconcile(s);
 assert.deepEqual(Array.from(s.abilities,a=>a.name),['Instinto Primário','Cero']);
});
test('projeção não modifica dados persistidos até salvar uma ficha',()=>{
 const {logic}=setup(),s=sheet('Arrancar','Porta-voz');
 const original=JSON.stringify(s),projected=logic.project(s);
 assert.equal(JSON.stringify(s),original);
 assert.equal(projected.abilities.length,5);
 assert.equal(s.abilities.length,0);
});
test('interface, edição e registro contêm as integrações dinâmicas',()=>{
 const app=read('arquivo-app.js'),visual=read('ficha-visual.js'),warehouse=read('biblioteca-secoes.js'),html=read('index.html');
 for(const token of ['data-edit="className"','ARQUIVO_ORIGENS?.reconcile(editorDraft)','ARQUIVO_ORIGENS?.project(s)','data-ability="\${i}:libraryType"']){
  assert.ok(app.includes(token),token);
 }
 assert.match(app,/function validateSheet\(/);
 assert.match(visual,/HABILIDADE RACIAL|HABILIDADE DE CLASSE/);
 assert.match(visual,/data-ability-filter/);
 assert.match(warehouse,/warehouseGrantRaces|warehouseGrantClasses/);
 assert.match(html,/ficha-origens\.js\?v=2/);
 assert.ok(html.indexOf('biblioteca-secoes.js')<html.indexOf('ficha-origens.js'));
 assert.ok(html.indexOf('ficha-origens.js')<html.indexOf('ficha-exportar.js'));
});

test('selecionar Artilheiro e depois Arrancar combina Cadência com as habilidades raciais',()=>{
 const {logic,catalog}=setup();
 catalog.push({
  id:'classe-artilheiro',title:'Artilheiro',category:'Classes',published:true,
  content:'## Identidade\nClasse de disparos.\n\n## Cadência\nPossui três níveis de ritmo.'
 });
 const s=sheet('','Artilheiro');
 logic.reconcile(s);
 assert.deepEqual(Array.from(s.abilities,x=>x.name),['Cadência']);
 s.race='Arrancar';
 assert.equal(logic.reconcile(s),true);
 assert.deepEqual(Array.from(s.abilities,x=>x.name),['Instinto Primário','Hierro','Sonído','Cero','Cadência']);
 assert.equal(logic.reconcile(s),false);
});
test('registro antigo sem grants preserva concessão publicada de Arrancar',()=>{
 const {logic,catalog}=setup();
 const index=catalog.findIndex(p=>p.id==='habilidade-hierro');
 catalog[index]={id:'habilidade-hierro',category:'Habilidades',title:'Hierro',published:true,
  tags:'Defesa',content:'Versão personalizada sem metadados de origem',cost:'2 ALMA'};
 const s=sheet('Arrancar');
 logic.reconcile(s);
 assert.ok(s.abilities.some(a=>a.name==='Hierro'&&a.description.includes('personalizada')));
 assert.ok(s.abilities.some(a=>a.name==='Instinto Primário'));
 catalog[index].grants={race:[],class:[]};
 logic.reconcile(s);
 assert.equal(s.abilities.some(a=>a.name==='Hierro'),false,'concessão explicitamente desativada é respeitada');
});
