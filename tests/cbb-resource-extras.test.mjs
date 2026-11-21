import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const create=()=>{
 const window={};
 vm.runInNewContext(read('cbb-engine.js'),{window});
 vm.runInNewContext(read('cbb-presentation.js'),{window});
 return window.ARQUIVO_CBB_PRESENTATION;
};
const records=()=>{
 const src=read('classes-armazem.js');
 return JSON.parse(src.slice(src.indexOf('['),src.lastIndexOf(']')+1));
};

test('Têmpera: capacidade numérica de 3 marcas, efeitos em Extras e gatilho separado',()=>{
 const ui=create();
 const entry={name:'Têmpera',cost:0,description:
  'Recurso — Possui [barra:3/3] de **Têmpera**.\n'+
  'Gatilho — Ao sofrer dano de um ataque inimigo.\n'+
  'Efeito — Ganhe 1 marca, até o máximo de 3.\n'+
  'Efeito — Gaste as marcas indicadas para ativar um efeito.\n\n'+
  '[barra:1/3] **Resistência —** Ao sofrer um ataque, reduza o dano recebido em 1d4.\n'+
  '[barra:2/3] **Interposição —** Quando um aliado próximo se tornar alvo de um ataque, receba-o em seu lugar.\n'+
  'Condição — Se sofrer dano, ganhe 1 marca de Têmpera normalmente.\n'+
  '[barra:3/3] **Persistência —** Quando um ataque o deixaria incapacitado, continue lutando até o Desfecho da rodada seguinte.'};
 const initial=JSON.stringify(entry),model=ui.model(entry);
 assert.equal(model.resource?.capacity,3);
 assert.equal(model.resource?.name,'Têmpera');
 assert.equal(model.resource?.label,'3 marcas');
 assert.equal(model.extras.length,3);
 assert.deepEqual(Array.from(model.extras,x=>x.amount),[1,2,3]);
 assert.deepEqual(Array.from(model.extras,x=>x.title),['Resistência','Interposição','Persistência']);
 assert.match(model.description,/^Gatilho — /m);
 assert.doesNotMatch(model.description,/\[barra:[123]\/3\]/);
 assert.match(model.extras[1].description,/Condição — Se sofrer dano/);
 assert.match(model.extras[2].description,/Desfecho da rodada seguinte/);
 const overview=ui.resourceInfo(model),extras=ui.extrasPanel(model,body=>'<p>'+body+'</p>');
 assert.match(overview,/CAPACIDADE/);
 assert.match(overview,/3 marcas/);
 assert.match(extras,/<details class="ae-cbb-extras">/);
 assert.match(extras,/1 MARCA/);
 assert.match(extras,/2 MARCAS/);
 assert.match(extras,/3 MARCAS/);
 assert.match(extras,/reduza o dano recebido em 1d4/);
 assert.equal(JSON.stringify(entry),initial,'a descrição persistida deve permanecer intacta');
});

test('alternativas repetidas de 1 marca usam nomes distintos, sem impor custo extra',()=>{
 const ui=create(),entry=records().find(p=>p.title==='Especialista em Hohō');
 const source=entry.content.slice(entry.content.indexOf('## Rastro')+10);
 const result=ui.resourceSections(source,'Rastro');
 assert.equal(result.resource?.capacity,1);
 assert.equal(result.resource?.name,'Rastro');
 assert.deepEqual(Array.from(result.extras,o=>o.amount),[1,1,1,1]);
 assert.deepEqual(Array.from(result.extras,o=>o.title),['Defesa','Ataque','Intercepção','Fuga']);
 assert.ok(result.extras.every(o=>o.description.trim()));
 assert.match(result.description,/Sempre que utiliza Hohō/);
});

test('sequência usa níveis, não diz que o recurso é gasto como marca',()=>{
 const ui=create();
 const source='Recurso — Possui [sequencia:3/3] de Cadência.\n'+
  'Gatilho — Ao atacar à distância, ganhe 1 nível.\n\n'+
  '[sequencia:1/3] **Mobilidade —** Desloque-se até metade da movimentação.\n'+
  '[sequencia:2/3] **Pressão —** Reduza em 1 passo o próximo ataque.\n'+
  '[sequencia:3/3] **Disparo Duplo —** Escolha dois alvos.';
 const result=ui.resourceSections(source,'Cadência');
 assert.equal(result.resource?.label,'3 níveis');
 assert.equal(result.extras.length,3);
 assert.match(ui.extrasPanel(result,x=>x),/NÍVEL 1/);
 assert.match(ui.extrasPanel(result,x=>x),/NÍVEL 3/);
 assert.doesNotMatch(ui.extrasPanel(result,x=>x),/3 MARCAS/);
});

test('Caçador: o limite geral não migra para o efeito do último contador',()=>{
 const ui=create(),entry=records().find(p=>p.title==='Caçador');
 const content=entry.content.slice(entry.content.indexOf('## Emboscada')+12);
 const result=ui.resourceSections(content,'Emboscada');
 assert.equal(result.resource?.name,'Armadilhas');
 assert.equal(result.resource?.capacity,5);
 assert.equal(result.extras.length,5);
 assert.match(result.description,/Limite — Uma vez por rodada/);
 assert.doesNotMatch(result.extras[4].description,/Limite — Uma vez por rodada/);
 assert.match(result.extras[4].description,/detonar outra armadilha/);
 assert.match(result.description,/Corpo — /);
 assert.match(result.description,/Mente — /);
 assert.match(result.description,/Espírito — /);
});

test('não altera habilidades comuns ou dados citados sem descrição de recurso',()=>{
 const ui=create(),content='Gatilho — Ao acertar um ataque.\nEfeito — Acrescente 1d8 ao dano-base.\n\n> Dano: +1d8';
 const a=ui.model({name:'Cero',description:content,cost:2});
 assert.equal(a.resource,null);
 assert.equal(a.extras.length,0);
 assert.equal(a.description.includes('1d8'),true);
 assert.equal(ui.resourceInfo(a),'');
 assert.equal(ui.extrasPanel(a,s=>s),'');
 const b=ui.model({name:'Explosão',description:'Efeito — Durante este ataque, receba [marca:3/3] de Cerco.'});
 assert.equal(b.resource,null,'marcador incidental não pode virar automaticamente uma mecânica de classe');
});

test('Armazém: cada classe com recurso recebe o quadro e os Extras em seu próprio capítulo',()=>{
 const ui=create();
 for(const record of records()){
  const markup=ui.renderRuleSections(record.content,x=>'<p>'+x+'</p>');
  assert.match(markup,/ae-cbb-resource/,record.title);
  assert.match(markup,/ae-cbb-extras/,record.title);
  assert.match(markup,/<summary>/,record.title);
  assert.match(markup,/## Identidade/,record.title);
  assert.match(markup,/Corpo — /,record.title);
  assert.match(markup,/Mente — /,record.title);
  assert.match(markup,/Espírito — /,record.title);
 }
});

test('componentes compartilhados entregam Extras na ficha completa, no acesso rápido e no Armazém',()=>{
 const sheet=read('ficha-visual.js'),store=read('biblioteca-secoes.js');
 assert.match(sheet,/presenter\.extrasPanel\(m,body=>api\.sheetRich\(body\)\)/);
 assert.match(sheet,/presentation\.extrasPanel\(details,body=>api\.sheetRich\(body\)\)/);
 assert.match(sheet,/presentation\.resourceInfo\(details\)/);
 assert.match(store,/presenter\.extrasPanel\(display,body=>api\.formatBook\(body,title\)\)/);
 assert.match(store,/renderRuleSections\(post\.content/);
 assert.match(read('playtest-ux.css'),/ae-cbb-extra-amount/);
});
