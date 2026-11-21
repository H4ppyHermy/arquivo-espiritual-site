import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const asList=name=>{
 const source=read(name);
 return JSON.parse(source.slice(source.indexOf('['),source.lastIndexOf(']')+1));
};
function formatter(){
 const window={};vm.runInNewContext(read('cbb-engine.js'),{window});vm.runInNewContext(read('cbb-presentation.js'),{window});
 return window.ARQUIVO_CBB_PRESENTATION;
}
const values=source=>(String(source).match(/(?:[+-]?\d+d\d+|[+-]?\d+%|\[(?:barra|marca|contador|sequencia):[^\]]+\])/gi)||[]).sort();

test('classes oficiais mantêm identidade, opções e atributos, mas padronizam os blocos das técnicas',()=>{
 const p=formatter(),records=asList('classes-armazem.js'),published=JSON.parse(read('dados.js').split('window.ARQUIVO_PUBLICADO = ')[1].trim().replace(/;$/,''));
 assert.ok(records.length>=4);
 for(const record of records){
  assert.match(record.content,/^## Identidade/m,record.title);
  assert.match(record.content,/^(?:##|###) (?:Têmpera|Rastro|Emboscada|Manobrista)/m,record.title);
  assert.match(record.content,/^(?:Gatilho|Recurso|Ativação|Efeito|Limite) — /m,record.title);
  assert.match(record.content,/^Corpo — /m);
  assert.match(record.content,/^Mente — /m);
  assert.match(record.content,/^Espírito — /m);
  assert.equal(p.standardizeRuleSections(record.content),record.content,record.title);
  const copy=published.site.warehouse.posts.find(x=>x.id===record.id);
  assert.equal(copy?.content,record.content,record.title+': base inicial deve coincidir');
  assert.deepEqual(values(record.content),values(copy.content));
 }
});

test('identidade e atributos raciais não são reescritos sem haver uma técnica destacada',()=>{
 const p=formatter(),race=asList('racas-armazem.js')[0];
 assert.equal(p.standardizeRuleSections(race.content),race.content);
 const source='## Identidade\nNatureza sobrenatural do personagem.\n\n### Poder racial | 2 ALMA\nAo sofrer dano, aumente a resistência em 1 passo.\n\nCorpo — Recebe 3 pontos.';
 const formatted=p.standardizeRuleSections(source);
 assert.match(formatted,/^Gatilho — Ao sofrer dano\./m);
 assert.match(formatted,/^Efeito — Aumente a resistência em 1 passo\./m);
 assert.match(formatted,/^Corpo — Recebe 3 pontos\./m);
 assert.match(formatted,/Natureza sobrenatural do personagem\./);
 assert.deepEqual(values(source),values(formatted));
 assert.equal(p.standardizeRuleSections(formatted),formatted);
});

test('itens distinguem forma selada, Shikai, Bankai e limitações sem alterar bônus',()=>{
 const p=formatter(),input='Espada selada: Precisão, +2 ao dano-base. Shikai +4; Bankai +6. Bônus não acumulam.';
 const formatted=p.standardizeItem(input);
 assert.match(formatted,/^Forma selada — /m);
 assert.match(formatted,/^Shikai — /m);
 assert.match(formatted,/^Bankai — /m);
 assert.match(formatted,/^Restrição — /m);
 assert.deepEqual(values(input),values(formatted));
 assert.equal(p.standardizeItem(formatted),formatted);
});

test('edição de fichas, Armazém e prévias continuam usando a regra editorial compartilhada',()=>{
 const app=read('arquivo-app.js'),store=read('biblioteca-secoes.js'),editor=read('biblioteca-editor.js');
 assert.match(app,/ab\.description=window\.ARQUIVO_CBB_PRESENTATION\?\.standardize/);
 assert.match(app,/standardizeItem\?\.\(it\.description\)/);
 assert.match(store,/entry\.content=window\.ARQUIVO_CBB_PRESENTATION\?\.standardize\?\./);
 assert.match(store,/standardizeRuleSections\?\.\(entry\.content\)/);
 assert.match(editor,/standardizeRuleSections\?\.\(area\.value/);
 assert.match(read('playtest-ux.css'),/ae-book-definition dt/);
 assert.doesNotMatch(read('index.html'),/site-update\.js|site-version\.json/);
});
