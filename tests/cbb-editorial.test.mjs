import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
function editor(){
 const window={};
 vm.runInNewContext(read('cbb-engine.js'),{window});
 vm.runInNewContext(read('cbb-presentation.js'),{window});
 return window.ARQUIVO_CBB_PRESENTATION;
}
const dice=text=>[...text.matchAll(/[+-]?\d+d(?:4|6|8|10|12|14|20)\b/gi)].map(x=>x[0]).sort();
const resources=text=>[...text.matchAll(/\[(?:barra|contador|marca|sequencia):\d+\/\d+\]/gi)].map(x=>x[0]).sort();

test('gatilho, efeito e duração mantêm cada número e o dado original',()=>{
 const p=editor(),source='Ao receber um ataque que afete sua Vida, aumente em 1 passo sua resistência natural até o término da fase.';
 const updated=p.standardize(source);
 assert.match(updated,/^Gatilho — Ao receber um ataque que afete sua Vida\./);
 assert.match(updated,/^Efeito — Aumente em 1 passo sua resistência natural\./m);
 assert.match(updated,/^Duração — Até o término da fase\./m);
 assert.equal(p.standardize(updated),updated);
 assert.deepEqual(dice(updated),dice(source));
});

test('recursos com listas de atributos não são quebrados na primeira vírgula',()=>{
 const p=editor();
 const source='Possui [barra:3/3] de Reserva. Uma vez por rodada, ao restaurar Vida, Estabilidade ou Alma de um aliado, preencha 1 espaço. Apague os espaços indicados para ativar um efeito.\n\n[barra:1/3] Acrescente 1d6 à recuperação.';
 const result=p.standardize(source);
 assert.match(result,/Gatilho — Ao restaurar Vida, Estabilidade ou Alma de um aliado\./);
 assert.match(result,/Efeito — Preencha 1 espaço\./);
 assert.match(result,/Consumo — Apague os espaços indicados/);
 assert.match(result,/Limite — Uma vez por rodada\./);
 assert.deepEqual(resources(result),resources(source));
 assert.deepEqual(dice(result),dice(source));
 assert.doesNotMatch(result,/Efeito — Estabilidade ou Alma/);
});

test('encantamentos inteiros e exceções de amplificação são preservados',()=>{
 const p=editor();
 const source='>"Ponte sem destino, sino sem voz. A serpente dourada devora o caminho. Sete elos, uma sentença. Que o céu feche suas mãos sobre aquele que ousa escapar!"\n\nUtilize sua ação principal na fase de Distância para realizar um ataque de Manipulação.\n\n**Amplificação:** Ao recitar o encantamento completo, imponha Imobilizado em vez de Agarrado.';
 const result=p.standardize(source);
 assert.ok(result.includes('>"Ponte sem destino, sino sem voz. A serpente dourada devora o caminho. Sete elos, uma sentença. Que o céu feche suas mãos sobre aquele que ousa escapar!"'));
 assert.match(result,/Amplificação — Ao recitar/);
 assert.doesNotMatch(result,/Amplificação — \*\*/);
 assert.deepEqual(dice(result),dice(source));
});

test('limitação e consequência aparecem depois do efeito, mesmo com requisito',()=>{
 const p=editor();
 const source='Uma vez por cena, com a Bankai ativa, utilize sua ação principal na fase de Duelo para realizar um ataque.\n\n> Dano: +2d10\n\nApós o ataque, sofra uma Exposição Ofensiva.';
 const result=p.standardize(source);
 assert.ok(result.indexOf('Requisito —')<result.indexOf('Ativação —'));
 assert.ok(result.indexOf('Ativação —')<result.indexOf('Consequência —'));
 assert.ok(result.indexOf('Consequência —')<result.indexOf('Limite —'));
 assert.deepEqual(dice(result),dice(source));
 assert.ok(result.includes('> Dano: +2d10'));
});

test('a apresentação não duplica dados e limites existentes no cabeçalho',()=>{
 const p=editor(),source={
  name:'Cero',cost:3,libraryType:'habilidade',usage:'Uma vez por cena',
  description:'Gatilho — Ao atacar à Distância.\nEfeito — Acrescente 1d8 ao dano-base.\n\n> Dano: +1d8\n\nLimite — Uma vez por cena.'
 };
 const model=p.model(source);
 assert.match(p.meta(model),/Uso: Uma vez por cena/);
 assert.doesNotMatch(model.description,/Limite — Uma vez por cena/);
 assert.doesNotMatch(model.description,/> Dano: \+1d8/);
 assert.equal(model.dice,'RA + 1d8');
});

test('registros públicos têm um texto normalizado idempotente com os dados intactos',()=>{
 const p=editor(),raw=read('habilidades-armazem.js');
 const list=JSON.parse(raw.slice(raw.indexOf('['),raw.lastIndexOf(']')+1));
 assert.ok(list.length>10);
 for(const entry of list){
  const normalized=p.standardize(entry.content);
  assert.equal(normalized,entry.content,entry.title+': revisão ainda não aplicada no conteúdo fonte');
  assert.deepEqual(dice(normalized),dice(entry.content),entry.title);
  assert.deepEqual(resources(normalized),resources(entry.content),entry.title);
 }
});
