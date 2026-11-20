import test from "node:test";
import assert from "node:assert/strict";
import {parseDiceExpression,rollDiceExpression,evaluateRpgSpecial,evaluateCriticalRoll,parsePrefixMessage} from "./dice.mjs";
import {rollCard,helpCard,classifyHighlightedDice} from "./card.mjs";
import {COMMANDS} from "./commands.mjs";

test("expressões de dados e modificadores",()=>{
 for(const expression of ["1d1","1d2","1d20","2d6+3","1d20-2","3d8+1d4+7"]){
  const parsed=parseDiceExpression(expression),result=rollDiceExpression(expression);
  assert.equal(result.dice.length,parsed.count);
  const base=result.dice.reduce((v,d)=>v+d.effective,0);
  assert.equal(result.total,result.special==="FALHA CRÍTICA"?1:base+parsed.constant);
  assert.ok(["","CRÍTICO MÁXIMO","FALHA CRÍTICA"].includes(result.special));
 }
});
test("expressões inválidas e vantagem antiga são recusadas",()=>{
 for(const expression of ["0d6","31d6","2d1001","1d20/2","Math.random()","1d20;drop table","2d20kh1","2d20kl1","d6++3",""]){
  assert.throws(()=>parseDiceExpression(expression));
 }
});
test("prefixos liberados são exclusivamente os de dados",()=>{
 for(const [input,command] of [["br 2d6 + 1d4","rolar"],["BR 1d20 + 3","rolar"],["bajuda","ajuda"],["BAJUDA","ajuda"],["bhistorico","historico"]])
  assert.equal(parsePrefixMessage(input)?.command,command,input);
 assert.equal(parsePrefixMessage("br 2d6 | Corte espiritual").description,"Corte espiritual");
 for(const input of ["bficha id","bvincular","BFiChA xyz","CBBficha id","/ficha id","/vincular","brasil","bhistoricos"]){
  assert.equal(parsePrefixMessage(input),null,input);
 }
 for(const input of ["br","br 2d6 +","br 100d2000","br 2d20kh1"])assert.ok(parsePrefixMessage(input)?.error);
});
test("resultados especiais e cartões",()=>{
 const row={id:123,kind:"discord",account_name:"Jogador",label:"2d6",dice:[{sides:6,value:6},{sides:6,value:6}],special:"CRÍTICO MÁXIMO",total:24};
 assert.equal(evaluateRpgSpecial(row.dice),"CRÍTICO MÁXIMO");
 assert.equal(evaluateRpgSpecial([{sides:6,value:1},{sides:6,value:1}]),"FALHA CRÍTICA");
 assert.deepEqual(classifyHighlightedDice(row),["critical","critical"]);
 assert.equal(rollCard(row).embeds[0].color,0xf2bf56);
 assert.equal(rollCard({...row,kind:"skill"}).components.length,0);
 const help=JSON.stringify(helpCard());
 assert.doesNotMatch(help,/(?:ficha|vincular|acesso secreto)/i);
});
test("comandos de barra não consultam fichas",()=>{
 assert.deepEqual(COMMANDS.map(x=>x.name),["rolar","historico","ajuda"]);
 assert.ok(COMMANDS.every(x=>x.type===1));
});

test("cartões de rolagem nunca expõem informações internas de fichas",()=>{
 const row={id:420,kind:"skill",account_name:"Jogador",label:"2d6",dice:[{sides:6,value:2},{sides:6,value:4}],total:6,character_name:"NOME_PRIVADO_DO_PERSONAGEM",sheet_id:"ID_PRIVADO_DA_FICHA",abilities:[{name:"HABILIDADE_SECRETA"}]};
 const payload=JSON.stringify(rollCard(row));
 assert.doesNotMatch(payload,/NOME_PRIVADO_DO_PERSONAGEM|ID_PRIVADO_DA_FICHA|HABILIDADE_SECRETA/);
 assert.equal(rollCard(row).components.length,0);
});

test("exemplo oficial: 4, 6, 6 vira RT 28, RA 12, RB 4",()=>{
 const r=evaluateCriticalRoll([{sides:6,value:4},{sides:6,value:6},{sides:6,value:6}]);
 assert.equal(r.special,"CRÍTICO MÁXIMO");
 assert.equal(r.base,16);assert.equal(r.total,28);
 assert.equal(r.ra,12);assert.equal(r.rb,4);
 assert.deepEqual(r.dice.map(d=>d.effective??d.value),[4,12,12]);
 assert.deepEqual(r.dice.map(d=>d.criticalApplied===true),[false,true,true]);
});
test("o crítico prioritário é determinado pelo tamanho e depois maior face repetida",()=>{
 let r=evaluateCriticalRoll([
  {sides:12,value:6},{sides:12,value:6},{sides:12,value:8},{sides:12,value:8}]);
 assert.equal(r.priorityValue,8);
 assert.deepEqual(r.dice.map(d=>d.effective??d.value),[6,6,16,16]);
 assert.equal(r.total,44);
 r=evaluateCriticalRoll([
  {sides:20,value:7},{sides:20,value:7},{sides:8,value:8},{sides:8,value:8}]);
 assert.equal(r.priorityValue,7);
 assert.deepEqual(r.dice.map(d=>d.effective??d.value),[14,14,8,8]);
 assert.equal(r.total,44);
});
test("dois resultados 1 reduzem RT, RA, RB a 1 e vencem um crítico de dado menor",()=>{
 const r=evaluateCriticalRoll([
  {sides:20,value:1},{sides:20,value:1},{sides:6,value:6},{sides:6,value:6}]);
 assert.equal(r.special,"FALHA CRÍTICA");
 assert.equal(r.total,1);assert.equal(r.ra,1);assert.equal(r.rb,1);
 assert.ok(r.dice[0].failureApplied&&r.dice[1].failureApplied);
 assert.ok(r.dice.every(d=>d.criticalApplied!==true));
});
test("crítico máximo ganha de falha do mesmo tamanho e falha não surge por cancelamento",()=>{
 const r=evaluateCriticalRoll([
  {sides:8,value:1},{sides:8,value:1},{sides:8,value:6},{sides:8,value:6}]);
 assert.equal(r.special,"CRÍTICO MÁXIMO");
 assert.deepEqual(r.dice.map(d=>d.effective??d.value),[1,1,12,12]);
 const canceled=evaluateCriticalRoll([
  {sides:6,value:1,effective:0,canceled:true},
  {sides:6,value:1,effective:0,canceled:true}]);
 assert.equal(canceled.special,"");assert.equal(canceled.total,0);
});
test("críticos alteram apenas resultados prioritários nos cartões e no histórico",()=>{
 const r=evaluateCriticalRoll([
  {sides:12,value:8},{sides:12,value:8},{sides:6,value:6},{sides:6,value:6}]);
 const row={id:2,kind:"discord",label:"4d12",dice:r.dice,special:r.special,total:r.total};
 assert.deepEqual(classifyHighlightedDice(row),["critical","critical","normal","normal"]);
 const embed=rollCard(row).embeds[0];
 assert.match(JSON.stringify(embed),/CRÍTICO MÁXIMO/);
 assert.match(JSON.stringify(embed),/RT \*\*/);
 assert.doesNotMatch(JSON.stringify(embed),/subtotal dos dados foi multiplicado/);
 const fail=evaluateCriticalRoll([{sides:20,value:20},{sides:4,value:1},{sides:4,value:1}]);
 const failEmbed=rollCard({...row,special:fail.special,dice:fail.dice,total:fail.total}).embeds[0];
 assert.match(JSON.stringify(failEmbed),/RA e RB passam a 1/);
});
test("rolagens antigas continuam no histórico sem recalcular o valor salvo",()=>{
 const row={special:"CRÍTICO",total:24,dice:[{sides:6,value:6},{sides:6,value:6}]};
 assert.equal(rollCard(row).embeds[0].description.includes("CRÍTICO ANTIGO"),true);
});
