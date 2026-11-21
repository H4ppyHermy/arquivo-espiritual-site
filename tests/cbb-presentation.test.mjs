import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
function setup(){
 const window={};
 vm.runInNewContext(read('cbb-engine.js'),{window});
 vm.runInNewContext(read('cbb-presentation.js'),{window});
 return {engine:window.ARQUIVO_CBB_ENGINE,ui:window.ARQUIVO_CBB_PRESENTATION};
}
test('metadados universais: fase, custo e tipo da ficha e do Armazém',()=>{
 const {ui}=setup();
 const sheet=ui.model({name:'Mão do Carrasco',libraryType:'tecnica',cost:3,
  description:'Com Tenken liberada, utilize sua ação principal na fase de Duelo para realizar um Teste-Clash.'});
 assert.equal(sheet.kind,'Técnica');
 assert.equal(sheet.cost,'3 ALMA');
 assert.equal(sheet.phase,'Duelo');
 const warehouse=ui.model({category:'Técnicas',cost:'2 Alma',content:'Ao realizar um ataque à distância, aumente um passo.'},{warehouse:true});
 assert.equal(warehouse.cost,'2 ALMA');
 assert.equal(warehouse.phase,'Distância');
 assert.equal(warehouse.kind,'Técnica');
 const explicit=ui.model({costConfig:{phase:'preparacao'},description:'Ao realizar um ataque de Duelo, ataque.'});
 assert.equal(explicit.phase,'Preparação');
});
test('tempo de duração não é confundido com fase de execução',()=>{
 const {ui}=setup();
 const m=ui.model({cost:2,description:'Quando um aliado sofrer dano, proteja-o até o próximo Desfecho.'});
 assert.equal(m.phase,'Conforme efeito');
 assert.equal(m.phaseSource,'unknown');
 assert.match(ui.meta(m),/Fase: Conforme efeito/);
 assert.doesNotMatch(ui.meta(m),/Fase: Desfecho/);
 const before=ui.model({description:'Aplique o efeito durante a fase de Preparação.'});
 assert.equal(before.phase,'Preparação');
});
test('limite repetido no início não ocupa duas vezes a habilidade, sem mudar o registro original',()=>{
 const {ui}=setup();
 const entry={name:'Proteção',cost:2,usage:'Uma vez por cena',
  description:'Uma vez por cena, utilize sua ação principal na fase de Preparação para proteger um aliado.'};
 const original=JSON.stringify(entry);
 const m=ui.model(entry);
 assert.equal(m.usage,'Uma vez por cena');
 assert.match(ui.meta(m),/Uso: Uma vez por cena/);
 assert.equal(m.description,'Utilize sua ação principal na fase de Preparação para proteger um aliado.');
 assert.equal(JSON.stringify(entry),original,'não alterar dados, exportação ou regras de origem');
});
test('dano destacado não é repetido em uma linha idêntica, mas detalhes condicionais são preservados',()=>{
 const {ui}=setup();
 const m=ui.model({cost:2,description:'Ao realizar um ataque, amplifique seu golpe.\n\n> Dano: +1d8'});
 assert.equal(m.dice,'RA + 1d8');
 assert.match(ui.dice(m),/RA \+ 1d8/);
 assert.doesNotMatch(m.description,/Dano:/);
 const condition=ui.model({description:'Ataque seu inimigo.\n\n> Dano: +1d10 no primeiro acerto, +1d20 no segundo'});
 assert.match(condition.description,/Dano: \+1d10 no primeiro acerto, \+1d20 no segundo/);
});
test('textos com etiquetas perigosas sempre são escapados como texto, não como HTML',()=>{
 const {ui}=setup();
 const m=ui.model({cost:0,usage:'<img src=x>',description:'Texto'});
 assert.match(ui.meta(m),/&lt;img src=x&gt;/);
 assert.doesNotMatch(ui.meta(m),/<img src=x>/);
});
test('bônus ativo distingue equipamentos com nomes iguais e respeita liberação',()=>{
 const {engine}=setup();
 const first={id:'a',name:'Zanpakutō',damageBonus:4,equipped:true,linkedAbility:'shikai'},
 second={id:'b',name:'Zanpakutō',damageBonus:4,equipped:false,linkedAbility:'shikai'};
 const sheet={abilities:[{name:'Shikai',abilityId:'shikai',costConfig:{mode:'activation'}}],
  combat:{scene:1},abilityRuntime:{billing:{shikai:{scene:1,active:true}}},inventory:{items:[first,second]}};
 assert.equal(engine.isItemDamageActive(sheet,first),true);
 assert.equal(engine.isItemDamageActive(sheet,second),false);
 assert.equal(engine.activeDamageBonus(sheet),4);
 sheet.combat.scene=2;
 assert.equal(engine.activeDamageBonus(sheet),0);
});
test('cartões das fichas e armazém usam o mesmo modelo com textos preservados',()=>{
 const sheet=read('ficha-visual.js'),warehouse=read('biblioteca-secoes.js'),editor=read('biblioteca-editor.js'),app=read('arquivo-app.js');
 assert.match(sheet,/window\.ARQUIVO_CBB_PRESENTATION/);
 assert.match(sheet,/presentation\.meta\(details\)/);
 assert.match(warehouse,/presenter\.meta\(display,\{warehouse:true\}\)/);
 assert.match(warehouse,/presenter\.dice\(display\)/);
 assert.doesNotMatch(warehouse,/ae-wh-ability-teaser|LER TÉCNICA COMPLETA|LER EFEITO COMPLETO/);
 assert.match(editor,/warehousePhaseInput/);
 assert.match(app,/function inventoryToggleEquipped\(i\)/);
 assert.match(app,/function inventoryItemRow\(s,it,i,can\)/);
 assert.doesNotMatch(app,/ae-item-bonus/);
});
