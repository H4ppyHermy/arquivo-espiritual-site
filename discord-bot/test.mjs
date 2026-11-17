import test from "node:test";
import assert from "node:assert/strict";
import {parseDiceExpression,rollDiceExpression,evaluateRpgSpecial,parsePrefixMessage} from "./dice.mjs";
import {rollCard,helpCard,classifyHighlightedDice} from "./card.mjs";

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


test("br aceita espaços em expressões e aliases antigos continuam funcionais",()=>{
 const cases=[
  ["br 2d6 + 1d4","rolar","2d6+1d4"],
  ["BR 1d20 + 3","rolar","1d20+3"],
  ["br 2d20kh1","rolar","2d20kh1"],
  ["br 2d6 + 1d4 | Zangetsu","rolar","2d6+1d4"],
  ["CBBrolar 2d6 Ataque","rolar","2d6"],
  ["CBBajuda","ajuda",null],
  ["CBBficha ficha_01","ficha",null],
  ["CBBhistorico","historico",null]
 ];
 for(const [input,command,expression] of cases){
  const p=parsePrefixMessage(input);
  assert.equal(p.command,command,input);
  if(expression)assert.equal(p.expression,expression,input);
 }
 assert.equal(parsePrefixMessage("br 2d6 | Corte espiritual").description,"Corte espiritual");
 for(const input of ["brasil","braço","brown 2d6","CBBrolando 2d6","/rolar 2d6"])assert.equal(parsePrefixMessage(input),null,input);
 for(const input of ["br","br 2d6 +","br 100d2000"])assert.ok(parsePrefixMessage(input).error,input);
});
test("cartões destacam apenas os dados responsáveis pelo crítico",()=>{
 const row={
  id:123,kind:"discord",account_name:"Ichigo",label:"2d6+1d4",
  dice:[{sides:6,value:6},{sides:6,value:6},{sides:4,value:2}],
  special:"CRÍTICO",total:28
 };
 assert.deepEqual(classifyHighlightedDice(row),["critical","critical","normal"]);
 const result=rollCard(row);
 assert.equal(result.embeds[0].color,0xf2bf56);
 assert.match(result.embeds[0].fields[0].value,/🟡 \*\*6\*\*/);
 assert.ok(result.components[0].components[0].custom_id.includes("123"));
 assert.ok(result.embeds[0].fields.every(f=>f.value.length<=1024));
 const failure=rollCard({...row,special:"FALHA CRÍTICA",dice:[{sides:6,value:1},{sides:6,value:1}]});
 assert.equal(failure.embeds[0].color,0xee6677);
 assert.match(failure.embeds[0].fields[0].value,/🔴 \*\*1\*\*/);
 const site=rollCard({...row,kind:"skill"});
 assert.equal(site.components.length,0);
});
test("cartões de 30 dados e ajuda respeitam limites do Discord",()=>{
 const thirty=rollCard({
  id:456,kind:"discord",account_name:"Mestre",label:"30d1000",
  dice:Array.from({length:30},()=>({sides:1000,value:1000})),total:30000
 });
 const field=thirty.embeds[0].fields[0];
 assert.ok(field.value.length<=1024);
 assert.equal(thirty.components.length,1);
 const help=helpCard();
 assert.ok(help.embeds[0].fields.length<=25);
 for(const f of help.embeds[0].fields)assert.ok(f.value.length<=1024);
});
