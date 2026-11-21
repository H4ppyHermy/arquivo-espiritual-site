import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../rolagem-livre.js',import.meta.url),'utf8');
function fixture(preloaded=null){
 const store=new Map(preloaded===null?[]:[['ae_free_roll_shortcuts_v1',JSON.stringify(preloaded)]]);
 const window={localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)}};
 vm.runInNewContext(source,{window});
 return {api:window.ARQUIVO_FREE_ROLL,store};
}
test('mistura dados e operadores com precedência matemática',async()=>{
 const {api}=fixture(),p=api.parse('1d4 + 1d6*2');
 const batches=[];
 const r=await api.evaluate(p,(n,faces)=>{batches.push([n,faces]);return [{sides:faces,value:faces===4?3:5}]});
 assert.equal(r.total,13);
 assert.deepEqual(batches,[[1,4],[1,6]]);
 assert.match(r.detail,/1d4 \[3\]/);
 assert.match(r.detail,/1d6 \[5\]/);
});
test('agrupa dados de faces iguais em uma única chamada e conserva a posição',async()=>{
 const {api}=fixture(),p=api.parse('2d6 + d4*2 - d6');
 let calls=0;
 const r=await api.evaluate(p,(count,faces)=>{
  calls++;
  return faces===6?{dice:[{value:1},{value:2},{value:3}]}:{dice:[{value:4}]};
 });
 assert.equal(calls,2);
 assert.equal(r.total,(1+2)+4*2-3);
 assert.deepEqual(Array.from(r.dice,d=>d.value),[1,2,4,3]);
});
test('parênteses, negação e calculadora pura funcionam sem chamar servidor',async()=>{
 const {api}=fixture();
 assert.equal((await api.evaluate(api.parse('-(d8+2)/2'),()=>[{value:4}])).total,-3);
 assert.equal((await api.evaluate(api.parse('4 + 5*(3-1)'),()=>{throw Error('não deve rolar dados')})).total,14);
 assert.equal((await api.evaluate(api.parse('1,5 + d6'),()=>[{value:3}])).total,4.5);
});
test('não executa código nem aceita dados inválidos ou rolagens grandes',()=>{
 const {api}=fixture();
 for(const input of ['1d6 + alert(1)','d1','d1001','20d6+11d4','d6**2','1d6 +','1d6 + (2d4', '999999999999d6'])
  assert.throws(()=>api.parse(input),undefined,input);
});
test('resultados inválidos e divisão por zero são rejeitados',async()=>{
 const {api}=fixture();
 await assert.rejects(api.evaluate(api.parse('d6/0'),()=>[{value:4}]),/Divisão por zero/);
 await assert.rejects(api.evaluate(api.parse('2d6'),()=>[{value:1}]),/não retornou todos os dados/);
 await assert.rejects(api.evaluate(api.parse('d6'),()=>[{value:999}]),/dado inválido/);
});
test('atalhos são específicos do armazenamento do navegador e dados escapados',()=>{
 const {api}=fixture([{name:'Ataque',formula:'2d8+4'}]);
 assert.equal(api.shortcuts()[0].name,'Ataque');
 const html=api.markup({online:true,history:'<div>histórico</div>',result:'<b>resultado</b>'});
 assert.match(html,/CALCULADORA DE DADOS/);
 assert.match(html,/data-free-action="shortcut:0"/);
 assert.match(html,/data-action="freeRoll"/);
 assert.match(html,/calculada neste navegador/);
 assert.match(html,/<div>histórico<\/div>/);
 const more=fixture([{name:'<script>',formula:'d6'}]);
 assert.match(more.api.markup({online:false}),/&lt;script&gt;/);
 assert.doesNotMatch(more.api.markup({online:false}),/<script>/);
});
