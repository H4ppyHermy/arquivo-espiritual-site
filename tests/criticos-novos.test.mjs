import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {evaluateCriticalRoll,evaluateRpgSpecial} from '../discord-bot/dice.mjs';
import {classifyHighlightedDice} from '../discord-bot/card.mjs';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('arquivo-app.js');
const start=app.indexOf('function avaliarResultadoDados(dice){');
const stop=app.indexOf('function updateFreeDicePreview(){',start);
assert.ok(start!==-1&&stop>start);
const site=vm.runInNewContext(app.slice(start,stop)+'\navaliarResultadoDados;');

const cases=[
 ['Exemplo oficial',[[6,4],[6,6],[6,6]],'CRÍTICO MÁXIMO',28,12,4,[4,12,12]],
 ['Falha com um dado 20',[[20,20],[6,1],[6,1]],'FALHA CRÍTICA',1,1,1,[20,1,1]],
 ['Críticos iguais, maior resultado',[[12,6],[12,6],[12,8],[12,8]],'CRÍTICO MÁXIMO',44,16,6,[6,6,16,16]],
 ['Críticos diferentes, dado maior',[[20,7],[20,7],[8,8],[8,8]],'CRÍTICO MÁXIMO',44,14,8,[14,14,8,8]],
 ['Prioridade da falha pelo d20',[[20,1],[20,1],[6,6],[6,6]],'FALHA CRÍTICA',1,1,1,[1,1,6,6]],
 ['Empate: máximo vence falha',[[8,1],[8,1],[8,6],[8,6]],'CRÍTICO MÁXIMO',26,12,1,[1,1,12,12]],
 ['Sem repetição',[[12,8],[10,6],[4,1]],'',15,8,1,[8,6,1]]
];
for(const [name,rolls,kind,total,ra,rb,effective] of cases){
 test('site/Discord seguem as mesmas regras: '+name,()=>{
  const dice=rolls.map(([sides,value])=>({sides,value}));
  const inSite=site(dice),inDiscord=evaluateCriticalRoll(dice);
  for(const result of [inSite,inDiscord]){
   assert.equal(result.special,kind);
   assert.equal(result.total,total);
   assert.equal(result.ra,ra);
   assert.equal(result.rb,rb);
   assert.deepEqual(Array.from(result.dice,d=>d.effective??d.value),effective);
  }
  assert.equal(evaluateRpgSpecial(dice),kind);
 });
}
test('só a repetição prioritária é destacada no cartão do Discord',()=>{
 const dice=[[12,6],[12,6],[12,8],[12,8]].map(([sides,value])=>({sides,value}));
 const result=evaluateCriticalRoll(dice);
 const row={dice:result.dice,special:result.special,total:result.total};
 assert.deepEqual(classifyHighlightedDice(row),['normal','normal','critical','critical']);
});
test('dados cancelados por Pavor não formam críticos nem falha automática',()=>{
 const dice=[
  {sides:6,value:1,effective:0,canceled:true},
  {sides:6,value:1,effective:0,canceled:true},
  {sides:20,value:7,effective:7}
 ];
 const inSite=site(dice),inDiscord=evaluateCriticalRoll(dice);
 assert.equal(inSite.special,'');assert.equal(inDiscord.special,'');
 assert.equal(inSite.total,7);assert.equal(inDiscord.total,7);
 assert.deepEqual(classifyHighlightedDice({dice,special:''}),['dropped','dropped','normal']);
});
test('modificações de Hollow mantêm dados originais para prioridade e valores efetivos para total',()=>{
 const dice=[
  {sides:12,value:6,effective:12,maximized:true},
  {sides:12,value:6,effective:12,maximized:true},
  {sides:4,value:2,effective:2}
 ];
 const inSite=site(dice),inDiscord=evaluateCriticalRoll(dice);
 assert.equal(inSite.total,50);assert.equal(inDiscord.total,50);
 assert.deepEqual(Array.from(inDiscord.dice,d=>d.effective??d.value),[24,24,2]);
});
test('histórico antigo não é convertido automaticamente nem regravado',()=>{
 assert.match(app,/special==='CRÍTICO'\?/);
 assert.match(app,/CRÍTICO MÁXIMO/);
 assert.doesNotMatch(app,/return \{base,total:special==='CRÍTICO'\?base\*2:base,special\}/);
});
test('SQL do Supabase fixa novas regras para perícias, rolagens livres e Escudo',()=>{
 const sql=read('migracao_13_criticos_atualizados.sql');
 for(const fn of ['ae_avaliar_dados','ae_transform_test','ae_roll_custom','ae_roll_free','ae_roll_free_colored'])
  assert.ok(sql.includes('FUNCTION public.'+fn+'('));
 assert.match(sql,/v_special='FALHA CRÍTICA' THEN v_total=1;v_ra=1;v_rb=1/);
 assert.match(sql,/ORDER BY max\(x.sides\) DESC,x.value DESC/);
 assert.match(sql,/criticalApplied/);
 assert.doesNotMatch(sql,/v_total=v_total\*2/);
});
