import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

function setup(){
 const window={},ctx={window};
 for(const file of ['racas-armazem.js','classes-armazem.js','habilidades-armazem.js'])
  vm.runInNewContext(read(file),ctx);
 const catalog=[...window.ARQUIVO_RACAS_CBB,...window.ARQUIVO_CLASSES_CBB,...window.ARQUIVO_HABILIDADES_CBB];
 window.ARQUIVO_SECOES={warehouse:()=>({posts:catalog})};
 vm.runInNewContext(read('ficha-origens.js'),ctx);
 return {logic:window.ARQUIVO_ORIGENS,catalog};
}
const sheet=(race='',className='')=>({id:'f1',name:'Teste',race,className,abilities:[]});
test('Identificação contém texto integral de Arrancar e habilidades raciais, sem adicionar à aba Habilidades',()=>{
 const {logic}=setup(),s=sheet('Arrancar','Coração de Aço');
 const id=logic.identity(s);
 assert.equal(id.race.title,'Arrancar');
 assert.match(id.race.content,/Hollows que removeram suas máscaras/);
 assert.deepEqual(Array.from(id.race.traits,p=>p.title),['Instinto Primário','Hierro','Sonído','Cero']);
 assert.match(id.race.traits[0].content,/Falha Crítica em um teste de Instinto/);
 assert.match(id.race.traits.at(-1).content,/1d8 ao dano-base/);
 assert.equal(id.class.title,'Coração de Aço');
 assert.match(id.class.content,/## Identidade/);
 assert.match(id.class.content,/## Têmpera/);
 assert.match(id.class.content,/\[barra:3\/3\]/);
 assert.equal(s.abilities.length,0);
 assert.equal(logic.reconcile(s),false);
});
test('habilidades automáticas persistidas pelo sistema anterior são removidas sem tocar nas manuais',()=>{
 const {logic}=setup(),s=sheet('Arrancar','Caçador');
 s.abilities=[
  {name:'Hierro',origin:{auto:true,kind:'race'},description:'Legado'},
  {name:'Emboscada',origin:{auto:true,kind:'class'},description:'Legado'},
  {name:'Fogo de Cobertura',category:'active',cost:3,description:'Texto personalizado'}
 ];
 assert.equal(logic.reconcile(s),true);
 assert.deepEqual(Array.from(s.abilities,p=>p.name),['Fogo de Cobertura']);
 assert.equal(s.abilities[0].description,'Texto personalizado');
 assert.equal(logic.reconcile(s),false);
 const projected=logic.project({...s,abilities:[...s.abilities,{name:'Cero',origin:{auto:true}}]});
 assert.deepEqual(Array.from(projected.abilities,p=>p.name),['Fogo de Cobertura']);
 assert.equal(s.abilities.length,1);
});
test('Têmpera, Rastro, Emboscada e Manobrista recebem limites e estados iniciais declarados',()=>{
 const {logic}=setup();
 const expected=[
  ['Coração de Aço','Têmpera',0,3,'barra'],
  ['Especialista em Hohō','Rastro ativo',0,1,'marca'],
  ['Caçador','Contadores de armadilha',1,5,'contador'],
  ['Porta-voz','Manobra coordenada disponível',1,1,'marca']
 ];
 for(const [name,label,initial,max,visual] of expected){
  const arr=logic.meters(sheet('',name));
  assert.equal(arr.length,1,name);
  const meter=arr[0];
  assert.equal(meter.label,label);
  assert.equal(meter.max,max);
  assert.equal(meter.current,initial);
  assert.equal(meter.initial,initial);
  assert.equal(meter.visual,visual);
  assert.match(meter.key,/^class:classe-/);
 }
});
test('o progresso de um medidor é separado da vida e recuperado do estado salvo',()=>{
 const {logic}=setup(),s=sheet('','Caçador');
 const meter=logic.meters(s)[0];
 const originalResources=JSON.stringify(s.resources||null);
 s.abilityRuntime={originMeters:{[meter.key]:4}};
 assert.equal(logic.meters(s)[0].current,4);
 assert.equal(JSON.stringify(s.resources||null),originalResources);
 s.abilityRuntime.originMeters[meter.key]=999;
 assert.equal(logic.meters(s)[0].current,5);
 s.abilityRuntime.originMeters[meter.key]=-2;
 assert.equal(logic.meters(s)[0].current,0);
});
test('novas classes com marcador sequencia criam recursos sem programação específica',()=>{
 const {logic,catalog}=setup();
 catalog.push({id:'classe-artilheiro',category:'Classes',published:true,title:'Artilheiro',
  content:'## Identidade\nClasse de disparos.\n\n## Cadência\nPossui [sequencia:0/3] de Cadência.\n\n[sequencia:1/3] Efeito 1.'});
 const s=sheet('Arrancar','Artilheiro');
 const id=logic.identity(s);
 assert.match(id.class.content,/## Cadência/);
 assert.equal(id.race.traits.length,4);
 const meters=logic.meters(s);
 assert.equal(meters.length,1);
 assert.equal(meters[0].label,'Cadência');
 assert.equal(meters[0].current,0);
 assert.equal(meters[0].max,3);
 assert.equal(meters[0].visual,'sequencia');
 s.abilityRuntime={originMeters:{[meters[0].key]:2}};
 assert.equal(logic.meters(s)[0].current,2);
 assert.equal(s.abilities.length,0);
});
test('raças e classes futuras usam conteúdo e habilidades vinculadas do Armazém',()=>{
 const {logic,catalog}=setup();
 catalog.push({id:'raca-bespoke',title:'Nova Raça',category:'Raças',published:true,
  content:'## Identidade\nTexto completo da nova raça.'});
 catalog.push({id:'classe-bespoke',title:'Vanguarda',category:'Classes',published:true,
  content:'## Identidade\nTexto completo da nova classe.'});
 catalog.push({id:'habilidade-bespoke',title:'Aura',category:'Habilidades',published:true,
  content:'Efeito integral.',cost:'2 ALMA',grants:{race:['Nova Raça'],class:[]}});
 catalog.push({id:'habilidade-bespoke2',title:'Disciplina',category:'Habilidades',published:true,
  content:'Outra regra.',grants:{race:[],class:['Vanguarda']}});
 assert.ok(logic.races().includes('Nova Raça'));
 assert.ok(logic.classes().includes('Vanguarda'));
 const id=logic.identity(sheet('Nova Raça','Vanguarda'));
 assert.match(id.race.content,/Texto completo da nova raça/);
 assert.deepEqual(Array.from(id.race.traits,p=>p.title),['Aura']);
 assert.deepEqual(Array.from(id.class.traits,p=>p.title),['Disciplina']);
});
test('registro personalizado antigo herda somente concessões padrão ausentes',()=>{
 const {logic,catalog}=setup(),index=catalog.findIndex(p=>p.id==='habilidade-hierro');
 catalog[index]={id:'habilidade-hierro',category:'Habilidades',title:'Hierro',
  content:'Efeito personalizado',published:true,tags:''};
 let id=logic.identity(sheet('Arrancar'));
 assert.ok(id.race.traits.some(x=>x.content==='Efeito personalizado'));
 catalog[index].grants={race:[],class:[]};
 id=logic.identity(sheet('Arrancar'));
 assert.equal(id.race.traits.some(x=>x.title==='Hierro'),false);
});
test('recursos da ficha usam estado sincronizável existente sem novos campos SQL',()=>{
 const app=read('arquivo-app.js'),online=read('online.js'),visual=read('ficha-visual.js'),html=read('index.html');
 assert.match(app,/case'originMeter':adjustOriginMeter/);
 assert.match(app,/abilityRuntime\.originMeters\[key\]=next/);
 assert.match(online,/abilityRuntime:s\.abilityRuntime\|\|\{\}/);
 assert.match(visual,/Recursos de raça e classe/);
 assert.match(visual,/ae-ficha-origin-resource-card/);
 assert.match(visual,/identification:'Identificação'/);
 assert.match(visual,/selected==='identification'\?identification/);
 assert.match(html,/racas-armazem\.js\?v=1/);
 assert.match(html,/ficha-origens\.js\?v=5/);
});

test('classes antigas sem metadados reconhecem valores iniciais narrados por cena',()=>{
 const {logic,catalog}=setup();
 for(const name of ['Caçador','Porta-voz','Especialista em Hohō']){
  const post=catalog.find(p=>p.category==='Classes'&&p.title===name);
  delete post.bars;
 }
 const hunter=logic.meters(sheet('','Caçador'))[0];
 const speaker=logic.meters(sheet('','Porta-voz'))[0];
 const hoho=logic.meters(sheet('','Especialista em Hohō'))[0];
 assert.equal(hunter.initial,1);
 assert.equal(hunter.max,5);
 assert.equal(speaker.initial,1);
 assert.equal(speaker.max,1);
 assert.equal(hoho.initial,0);
 assert.equal(hoho.max,1);
});

test('medidor vivo com seção ### é reconhecido sem campos especiais',()=>{
 const {logic,catalog}=setup();
 catalog.push({id:'classe-ao-vivo',title:'Classe ao Vivo',category:'Classes',published:true,
  content:'## Identidade\nClasse.\n\n### Reserva\nPossui [barra:3/3] de Reserva.\n\nCorpo — +1 passo.'});
 const meter=logic.meters(sheet('','Classe ao Vivo'))[0];
 assert.ok(meter);
 assert.equal(meter.label,'Reserva');
 assert.equal(meter.max,3);
 assert.equal(meter.visual,'barra');
 assert.equal(meter.current,0);
});
