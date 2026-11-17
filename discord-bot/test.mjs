import test from "node:test";
import assert from "node:assert/strict";
import {parseDiceExpression,rollDiceExpression,evaluateRpgSpecial,parsePrefixMessage} from "./dice.mjs";
import {rollCard,helpCard,classifyHighlightedDice} from "./card.mjs";
import {COMMANDS} from "./commands.mjs";

test("expressões de dados e modificadores",()=>{
 for(const expression of ["1d1","1d2","1d20","2d6+3","1d20-2","3d8+1d4+7"]){
  const parsed=parseDiceExpression(expression),result=rollDiceExpression(expression);
  assert.equal(result.dice.length,parsed.count);
  const base=result.dice.reduce((v,d)=>v+d.effective,0);
  assert.equal(result.total,(result.special==="CRÍTICO"?base*2:base)+parsed.constant);
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
 const row={id:123,kind:"discord",account_name:"Jogador",label:"2d6",dice:[{sides:6,value:6},{sides:6,value:6}],special:"CRÍTICO",total:24};
 assert.equal(evaluateRpgSpecial(row.dice),"CRÍTICO");
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
