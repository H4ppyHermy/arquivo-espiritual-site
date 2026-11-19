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
 assert.ok(html.indexOf('barras-inline.js?v=1')<html.indexOf('arquivo-app.js?v=8'));
 assert.match(html,/barras-inline\.css\?v=1/);
});
test('custos de Têmpera e Armadilhas usam a notação visual sem alterar regras',()=>{
 const classesSource=read('classes-armazem.js');
 const classes=JSON.parse(classesSource.split('window.ARQUIVO_CLASSES_CBB = ')[1].trim().replace(/;$/,''));
 const heart=classes.find(c=>c.id==='classe-coracao-de-aco');
 const hunter=classes.find(c=>c.id==='classe-cacador');
 for(const n of [1,2,3])assert.ok(heart.content.includes('[barra:'+n+'/3]'));
 for(const n of [1,2,3,4,5])assert.ok(hunter.content.includes('[barra:'+n+'/5]'));
 assert.match(heart.content,/1d4/);
 assert.match(hunter.content,/8 metros/);
 assert.doesNotMatch(heart.content,/\*\*[123] espaç(?:o|os):\*\*/);
});
