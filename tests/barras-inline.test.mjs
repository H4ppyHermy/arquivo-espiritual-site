import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function load(){
 const window={};
 vm.runInNewContext(read('barras-inline.js'),{window});
 return window.ARQUIVO_BARRAS_INLINE;
}
function replace(source){
 const api=load(),markers=[];
 const annotated=api.mark(source,markers);
 return annotated.replace(/@@AEBAR(\d+)@@/g,(_,index)=>api.render(markers[Number(index)]));
}
test('barra curta representa quantas marcas são necessárias',()=>{
 const output=replace('Custo: [barra:2].');
 assert.equal((output.match(/ae-inline-resource-segment is-filled/g)||[]).length,2);
 assert.equal((output.match(/ae-inline-resource-segment/g)||[]).length,2);
 assert.match(output,/aria-label="2 marcas de recurso"/);
 assert.doesNotMatch(output,/\[barra:/);
});
test('barra de capacidade mostra preenchidas e vazias, como o HUD',()=>{
 const output=replace('[barra:1/3] [barra:2/3] [barra:3/3] [barra:0/3]');
 assert.equal((output.match(/ae-inline-resource-segment/g)||[]).length,12);
 assert.equal((output.match(/ae-inline-resource-segment is-filled/g)||[]).length,6);
 assert.match(output,/aria-label="1 de 3 marcas de recurso"/);
 assert.match(output,/aria-label="0 de 3 marcas de recurso"/);
 assert.equal((output.match(/role="img"/g)||[]).length,4);
});
test('marcações inválidas continuam texto literal e não criam HTML',()=>{
 const source='[barra:4/3] [barra:0] [barra:21] [barra:1/0] [barra:-1/3]';
 const output=replace(source);
 assert.equal(output,source);
 assert.doesNotMatch(output,/ae-inline-resource-bar/);
});
test('parser não transforma palavras comuns nem dados e suporta espaços',()=>{
 const output=replace('1 espaço, 2 espaços e dado 1d4. [barra: 1 / 5]');
 assert.match(output,/1 espaço, 2 espaços e dado 1d4/);
 assert.match(output,/aria-label="1 de 5 marcas de recurso"/);
});
test('a leitura dos capítulos e das fichas utiliza o mesmo parser',()=>{
 const app=read('arquivo-app.js'),html=read('index.html');
 assert.match(app,/ARQUIVO_BARRAS_INLINE\?\.mark\(text,markers\)/);
 assert.match(app,/ARQUIVO_BARRAS_INLINE\?\.render\(marker\)/);
 assert.match(app,/function libraryInsertBar\(/);
 assert.match(app,/case'libraryInsertBar':libraryInsertBar\(\)/);
 assert.match(read('biblioteca-editor.js'),/function insertEditorBar\(/);
 assert.match(read('biblioteca-secoes.js'),/data-warehouse-editor="insert-bar"/);
 assert.match(read('biblioteca-secoes.js'),/warehouseEditorResourceKind/);
 assert.ok(html.indexOf('barras-inline.js?v=3')<html.indexOf('arquivo-app.js?v=22'));
 assert.match(html,/barras-inline\.css\?v=3/);
});
test('custos de Têmpera e Armadilhas usam a notação visual sem alterar regras',()=>{
 const classesSource=read('classes-armazem.js');
 const classes=JSON.parse(classesSource.split('window.ARQUIVO_CLASSES_CBB = ')[1].trim().replace(/;$/,''));
 const heart=classes.find(c=>c.id==='classe-coracao-de-aco');
 const hunter=classes.find(c=>c.id==='classe-cacador');
 for(const n of [1,2,3])assert.ok(heart.content.includes('[barra:'+n+'/3]'));
 for(const n of [1,2,3,4,5])assert.ok(hunter.content.includes('[contador:'+n+'/5]'));
 assert.match(heart.content,/1d4/);
 assert.match(hunter.content,/8 metros/);
 assert.doesNotMatch(heart.content,/\*\*[123] espaç(?:o|os):\*\*/);
});

test('marca é uma unidade genérica, sem vínculo ao nome da classe',()=>{
 const output=replace('Rastro [marca:1] e indisponível [marca:0].');
 assert.match(output,/ae-inline-resource--marca/);
 assert.match(output,/Marca disponível/);
 assert.match(output,/Marca indisponível/);
 assert.equal((output.match(/ae-inline-resource-segment/g)||[]).length,2);
 assert.doesNotMatch(output,/\[marca:/);
});
test('contador utiliza fichas redondas e respeita limites',()=>{
 const output=replace('[contador:3/5]');
 assert.match(output,/ae-inline-resource--contador/);
 assert.match(output,/aria-label="3 de 5 contadores de recurso"/);
 assert.equal((output.match(/ae-inline-resource-segment/g)||[]).length,5);
 assert.equal((output.match(/ae-inline-resource-segment is-filled/g)||[]).length,3);
 assert.equal(replace('[contador:21/21]'),'[contador:21/21]');
 assert.equal(replace('[marca:3/2]'),'[marca:3/2]');
});
test('as classes reutilizam tipos genéricos, sem códigos específicos de habilidade',()=>{
 const src=read('classes-armazem.js');
 const records=JSON.parse(src.split('window.ARQUIVO_CLASSES_CBB = ')[1].trim().replace(/;$/,''));
 const kinds=records.map(item=>item.bars[0].visual);
 assert.deepEqual(kinds,['barra','marca','contador','marca']);
 assert.ok(records.find(p=>p.id==='classe-especialista-hoho').content.includes('[marca:1]'));
 assert.ok(records.find(p=>p.id==='classe-porta-voz').content.includes('[marca:1]'));
 assert.ok(records.find(p=>p.id==='classe-cacador').content.includes('[contador:5/5]'));
 assert.doesNotMatch(records.map(x=>x.content).join('\n'),/\[(?:rastro|armadilha|voz):/i);
});

test('sequência mostra níveis cumulativos e usa o mesmo renderer da Biblioteca e ficha',()=>{
 const api=load();
 assert.ok(api.types.includes('sequencia'));
 for(let n=0;n<=3;n++){
  const output=replace('[sequencia:'+n+'/3]');
  assert.match(output,/ae-inline-resource--sequencia/);
  assert.match(output,new RegExp('aria-label="Sequência: nível '+n+' de 3"'));
  assert.equal((output.match(/ae-inline-resource-segment/g)||[]).length,3);
  assert.equal((output.match(/ae-inline-resource-segment is-filled/g)||[]).length,n);
  assert.ok(!output.includes('[sequencia:'));
 }
 const shorthand=replace('[sequencia]');
 assert.match(shorthand,/Sequência: nível 0 de 3/);
 assert.equal((shorthand.match(/ae-inline-resource-segment/g)||[]).length,3);
 assert.equal(replace('[sequencia: 2 / 3]').includes('nível 2 de 3'),true);
 assert.match(read('barras-inline.css'),/ae-inline-resource--sequencia/);
 assert.doesNotMatch(read('biblioteca-secoes.css'),/ae-wh-resource-slots--sequencia/);
});
test('sequência inválida permanece literal e não modifica regras de combate',()=>{
 const source='[sequencia:4/3] [sequencia:0/0] [sequencia:21/21] [sequencia:-1/3]';
 assert.equal(replace(source),source);
 assert.equal(replace('[barra] [marca] [contador]'),'[barra] [marca] [contador]');
 assert.match(read('arquivo-app.js'),/option value="sequencia">Sequência/);
 assert.match(read('biblioteca-secoes.js'),/option value="sequencia">Sequência/);
 assert.doesNotMatch(read('biblioteca-secoes.js'),/resourceBars\(|barEditorRow\(/);
 assert.match(read('ficha-visual.js'),/api\.sheetRich\(description\)/);
});

test('Porta-voz usa os graus oficiais de Vínculos em ambas as fontes',()=>{
 const records=JSON.parse(read('classes-armazem.js').split('window.ARQUIVO_CLASSES_CBB = ')[1].trim().replace(/;$/,''));
 const published=JSON.parse(read('dados.js').split('window.ARQUIVO_PUBLICADO = ')[1].trim().replace(/;$/,''));
 const source=records.find(x=>x.id==='classe-porta-voz');
 const copy=published.site.warehouse.posts.find(x=>x.id==='classe-porta-voz');
 const rule=published.rules.find(x=>x.id==='cap8')?.text||'';
 assert.equal(source.content,copy.content);
 assert.equal(source.damage.label,copy.damage.label);
 assert.match(source.content,/Vínculo de grau I ou superior/);
 assert.match(source.content,/I: 1d6; II: 1d8; III: 1d12/);
 assert.match(source.content,/grau de Vínculo de cada aliado/);
 assert.match(source.damage.label,/grau I: d6; II: d8; III: d12/);
 assert.doesNotMatch(source.content,/grau de Afinidade|regras de criação de personagem ainda em desenvolvimento|pelo menos Afinidade/i);
 assert.doesNotMatch(source.damage.label,/não definido|Dado de Afinidade/i);
 for(const [name,die] of [['Afinidade','d6'],['Vínculo','d8'],['Devoção','d12']]){
  assert.ok(rule.includes(name),name);
  assert.ok(rule.includes('+1'+die),die);
 }
 assert.match(read('vinculos-simples.js'),/Benefícios dos Vínculos não são aplicados automaticamente/);
});
