import test from "node:test";
import assert from "node:assert/strict";
import {parseDiceExpression,rollDiceExpression,evaluateRpgSpecial} from "./dice.mjs";

test("aceita expressões comuns",()=>{
 for(const expression of ["1d1","1d2","1d3","1d20","2d6+3","1d20-2","2d20kh1","2d20kl1","4d6kh3","3d8+1d4+7"]){
  const parsed=parseDiceExpression(expression);assert.ok(parsed.count>=1);
  const rolled=rollDiceExpression(expression);
  assert.equal(rolled.dice.length,parsed.count);
  const base=rolled.dice.reduce((n,d)=>n+d.effective,0);
  assert.equal(rolled.total,(rolled.special==="CRÍTICO"?base*2:base)+parsed.constant);
 }
});
test("vantagem e desvantagem descartam o dado correto",()=>{
 for(let i=0;i<100;i++){
  const advantage=rollDiceExpression("2d20kh1");
  assert.equal(advantage.total,Math.max(...advantage.dice.map(d=>d.value)));
  const disadvantage=rollDiceExpression("2d20kl1");
  assert.equal(disadvantage.total,Math.min(...disadvantage.dice.map(d=>d.value)));
 }
});
test("evita expressão maliciosa, inválida ou excessiva",()=>{
 for(const expression of ["0d6","d0","31d6","2d1001","100d6","20d20+20d20","1d20/2","Math.random()","1d20;drop table","2d20kh3","d6++3","999999",""]){
  assert.throws(()=>parseDiceExpression(expression),expression);
 }
});
test("valor está no intervalo",()=>{
 for(let sides=1;sides<=20;sides++){
  for(let i=0;i<10;i++){
   const rolled=rollDiceExpression("1d"+sides);
   assert.ok(rolled.total>=1&&rolled.total<=sides);
  }
 }
});

test("crítico, falha crítica e dados descartados seguem ae_avaliar_dados",()=>{
 const dice=(...values)=>values.map(value=>({sides:6,value,effective:value}));
 assert.equal(evaluateRpgSpecial(dice(6,6)),"CRÍTICO");
 assert.equal(evaluateRpgSpecial(dice(1,1)),"FALHA CRÍTICA");
 assert.equal(evaluateRpgSpecial(dice(6,5)),"");
 assert.equal(evaluateRpgSpecial([{sides:20,value:6,effective:6},{sides:20,value:6,effective:0}]),"");
});
