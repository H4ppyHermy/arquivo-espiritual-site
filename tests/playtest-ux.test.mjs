import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const engine=()=>{
 const window={};
 vm.runInNewContext(read('cbb-engine.js'),{window});
 return window.ARQUIVO_CBB_ENGINE;
};
function sheet(){
 const release={name:'Shikai',abilityId:'s1',costConfig:{mode:'activation',phase:'duelo'}};
 return {id:'demo',combat:{scene:1,phase:'duelo'},abilities:[
  release,{name:'Corte',description:'> Dano: +1d8'}
 ],inventory:{items:[
  {name:'Zanpakutō',damageBonus:4,equipped:true,linkedAbility:'s1'},
  {name:'Adorno',damageBonus:2,equipped:false}
 ]},abilityRuntime:{billing:{s1:{active:false,scene:1}}}};
}
test('bônus de equipamento é universal e só funciona com liberação ativa na cena atual',()=>{
 const e=engine(),s=sheet();
 assert.equal(e.activeDamageBonus(s),0);
 s.abilityRuntime.billing.s1.active=true;
 assert.equal(e.activeDamageBonus(s),4);
 assert.deepEqual(JSON.parse(JSON.stringify(e.activeDamageEffects(s))),[{name:'Zanpakutō',amount:4}]);
 s.combat.scene=2;
 assert.equal(e.activeDamageBonus(s),0);
 s.abilityRuntime.billing.s1.scene=2;
 assert.equal(e.activeDamageBonus(s),4);
 s.inventory.items[0].equipped=false;
 assert.equal(e.activeDamageBonus(s),0);
});
test('equipamento sem liberação vinculada e bônus negativo são calculados sem código de personagem',()=>{
 const e=engine(),s=sheet();
 s.inventory.items.push({name:'Selo',damageBonus:-1,equipped:true,linkedAbility:''});
 assert.equal(e.activeDamageBonus(s),-1);
 s.abilityRuntime.billing.s1.active=true;
 assert.equal(e.activeDamageBonus(s),3);
 const another=sheet();another.inventory.items=[];
 assert.equal(e.activeDamageBonus(another),0);
});
test('fases e expressões de dano são deduzidas de metadados genéricos',()=>{
 const e=engine(),s=sheet();
 assert.equal(e.abilityPhase(s.abilities[0]),'Duelo');
 assert.equal(e.abilityPhase({description:'Na fase de preparação, faça um teste.'}),'Preparação');
 assert.equal(e.abilityPhase({description:'Uma técnica sem fase específica'}),'Livre');
 assert.deepEqual(JSON.parse(JSON.stringify(e.abilityPool(s.abilities[1]))),{kind:'dano',count:1,faces:8});
});
test('perícia e dano usam o mesmo motor no painel rápido e na Mesa',()=>{
 const visual=read('ficha-visual.js'),cbb=read('cbb-interativo.js'),app=read('arquivo-app.js');
 assert.match(visual,/data-cbb-pick-skill/);
 assert.match(visual,/renderSkillQuick/);
 assert.match(cbb,/function renderSkillQuick/);
 assert.match(cbb,/data-cbb-field="bonusFaces"/);
 assert.match(cbb,/args\.p_flat=normalize\(number\(root,'flat'\)\+\(mode==='dano'\?engine\.activeDamageBonus\(s\):0\)/);
 assert.match(cbb,/refreshDamageSummaries/);
 assert.match(app,/invLinkedAbility/);
 assert.match(app,/damageBonus:/);
 assert.match(app,/const items=db\.sheets\.filter\(s=>!!s\.masterOnly===onlyMaster&&\(!s\.locked/);
});
