import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8')
 .replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>','');

test('ficha, inventário e armazém apresentam efeitos e metadados no mesmo padrão',
 {timeout:65000},async t=>{
 const server=http.createServer((req,res)=>{
  const route=decodeURIComponent((req.url||'/').split('?')[0]);
  if(route==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
  if(route==='/configuracao.js'){
   res.writeHead(200,{'content-type':'text/javascript'});res.end('window.ARQUIVO_ONLINE_CONFIG={};');return;
  }
  const file=path.resolve(root,'.'+route);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);res.end('not found');return;
  }
  const mime=route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':
   route.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
  let body=fs.readFileSync(file);
  if(route==='/arquivo-base.css')body=Buffer.from(body.toString().replace(/^@import[^;]+;/,''));
  res.writeHead(200,{'content-type':mime});res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 t.after(async()=>{try{await browser.close()}catch(e){}});
 const page=await browser.newPage();page.setDefaultTimeout(15000);
 await page.setRequestInterception(true);
 page.on('request',request=>request.url().startsWith('http://127.0.0.1:')?request.continue():request.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 const warehouse=await page.evaluate(()=>{
  window.ARQUIVO_INTERNAL.setPage('library');
  window.ARQUIVO_SECOES.select('warehouse');
  const cards=[...document.querySelectorAll('.ae-wh-ability-post')];
  const heads=cards.map(card=>{
   const header=card.querySelector('.ae-wh-ability-header');
   const title=card.querySelector('.ae-wh-ability-title');
   return {hasTitle:!!title?.textContent?.trim(),hasHeader:!!header,
    hasGradient:!!header&&getComputedStyle(header).backgroundImage.includes('linear-gradient'),
    titleVisible:!!title&&getComputedStyle(title).visibility==='visible'&&
     getComputedStyle(title).display!=='none'&&title.getBoundingClientRect().height>0,
    hasLegacyClass:!!header?.classList.contains('ae-ficha-ability-tag')||
     !!title?.classList.contains('ae-ficha-ability-title')};
  });
  return {count:cards.length,first:cards[0]?.innerText||'',phase:cards[0]?.querySelector('.ae-ability-phase')?.textContent||'',
   cost:!!cards[0]?.querySelector('.ae-ability-cost'),heads,
   structured:cards[0]?.querySelector('.ae-wh-ability-description .ae-book-definition dt')?.textContent?.trim()||'',
   hasPerAbilityExpand:cards.some(c=>!!c.querySelector('[data-warehouse-action^="open:"]'))};
 });
 assert.ok(warehouse.count>=10,'o acervo oficial deve ser renderizado');
 assert.ok(warehouse.phase.startsWith('Fase: '));
 assert.ok(warehouse.cost);
 assert.match(warehouse.structured,/Gatilho|Ativação|Efeito|Recurso/i);
 assert.ok(warehouse.heads.every(h=>h.hasHeader&&h.hasTitle&&h.hasGradient&&h.titleVisible&&!h.hasLegacyClass),
  'os nomes precisam aparecer sobre cabeçalhos de gradiente da paleta em todos os cartões');
 assert.equal(warehouse.hasPerAbilityExpand,false);

 const sheet=await page.evaluate(()=>{
  window.ARQUIVO_INTERNAL.db.sheets.push({
   id:'e2e-universal-card',name:'Personagem de teste',level:1,subtitle:'Teste local',
   locked:false,masterOnly:false,abilities:[{name:'Corte do Teste',cost:2,libraryType:'tecnica',
    usage:'Uma vez por cena',description:'Uma vez por cena, utilize sua ação principal na fase de Duelo para atacar.\\n\\n> Dano: +1d8'}],
   inventory:{items:[{name:'Lâmina do Teste',type:'Equipamento',damageBonus:4,equipped:true,
    description:'Bônus enquanto empunhada.'}],currencies:[]},
   conditions:[],notes:'',groups:{Corpo:6,Mente:6,Espírito:6},
   skills:{Vigor:4},resources:{vida:{current:20,max:20},estabilidade:{current:20,max:20},alma:{current:10,max:10}},
   combat:{scene:1,round:1,phase:'duelo'}
  });
  window.ARQUIVO_INTERNAL.setPage('sheets');
  document.querySelector('[data-sheet="e2e-universal-card"]')?.click();
  document.querySelector('[data-tab="abilities"]')?.click();
  const card=document.querySelector('.ae-ficha-ability-card');
  const body=card?.querySelector('.ae-ficha-ability-full')?.innerText||'';
  const record={found:!!card,phase:card?.querySelector('.ae-ability-phase')?.textContent,
   cost:card?.querySelector('.ae-ability-cost')?.textContent,
   limit:card?.querySelector('.ae-ability-usage')?.textContent,
   body,cardCount:document.querySelectorAll('.ae-ficha-ability-card').length,
   structure:card?.querySelector('.ae-ficha-ability-full .ae-book-definition dt')?.textContent?.trim()||''};
  document.querySelector('[data-tab="inventory"]')?.click();
  record.bonus=document.querySelector('.ae-item-effect strong')?.textContent||'';
  record.status=document.querySelector('.ae-item-state')?.textContent||'';
  return record;
 });
 assert.equal(sheet.found,true);
 assert.equal(sheet.cardCount,1);
 assert.match(sheet.structure,/Ativação|Gatilho|Efeito/i);
 assert.equal(sheet.phase,'Fase: Duelo');
 assert.equal(sheet.cost,'2 ALMA');
 assert.match(sheet.limit,/Uma vez por cena/);
 assert.doesNotMatch(sheet.body,/Uma vez por cena/);
 assert.doesNotMatch(sheet.body,/> Dano: \+1d8/);
 assert.match(sheet.bonus,/\+4 DANO-BASE/);
 assert.match(sheet.status,/BÔNUS ATIVO/);

 const resource=await page.evaluate(()=>{
  window.ARQUIVO_INTERNAL.db.sheets.find(x=>x.id==='e2e-universal-card').abilities.push({
   name:'Têmpera',cost:0,libraryType:'habilidade',
   description:'Recurso — Possui [barra:3/3] de **Têmpera**.\n'+
    'Gatilho — Ao sofrer dano de um ataque inimigo.\n'+
    'Efeito — Ganhe 1 marca, até o máximo de 3.\n'+
    'Efeito — Gaste as marcas indicadas para ativar um efeito.\n\n'+
    '[barra:1/3] **Resistência —** Ao sofrer um ataque, reduza o dano recebido em 1d4.\n\n'+
    '[barra:2/3] **Interposição —** Ao proteger um aliado, receba o golpe em seu lugar.\n'+
    'Condição — Se sofrer dano, ganhe 1 marca normalmente.\n\n'+
    '[barra:3/3] **Persistência —** Quando seria incapacitado, continue lutando até o próximo Desfecho.'
  });
  // A ficha permanece aberta no inventário: apenas retorne à aba Habilidades.
  document.querySelector('[data-tab="abilities"]')?.click();
  const card=[...document.querySelectorAll('.ae-ficha-ability-card')].find(el=>
   el.textContent.toLocaleLowerCase('pt-BR').includes('têmpera'));
  const details=card?.querySelector('.ae-cbb-extras'),button=details?.querySelector('summary');
  const before=details?.open;
  button?.click();
  return {found:!!card,resource:card?.querySelector('.ae-cbb-resource')?.textContent,
   main:card?.querySelector('.ae-ficha-ability-full')?.textContent,
   extraCount:card?.querySelectorAll('.ae-cbb-extra-row')?.length,
   expanded:details?.open,collapsedBefore:before,
   titles:[...(card?.querySelectorAll('.ae-cbb-extra-title')||[])].map(e=>e.textContent),
   firstLabel:card?.querySelector('.ae-cbb-extra-row')?.getAttribute('aria-label'),
   visibleQuantityLabels:card?.querySelectorAll('.ae-cbb-extra-amount').length,
   resourceSymbols:card?.querySelectorAll('.ae-cbb-resource-glyph .ae-inline-resource-segment').length,
   extraSymbols:[...(card?.querySelectorAll('.ae-cbb-extra-row')||[])].map(row=>({
    total:row.querySelectorAll('.ae-inline-resource-segment').length,
    active:row.querySelectorAll('.ae-inline-resource-segment.is-filled').length
   })),
   summaryVisible:!!button&&getComputedStyle(button).display!=='none'&&button.getBoundingClientRect().height>=40};
 });
 assert.equal(resource.found,true,'Têmpera deve aparecer na mesma ficha');
 assert.match(resource.resource,/Têmpera/);
 assert.doesNotMatch(resource.resource,/3 marcas/,'a quantidade não precisa ser repetida em texto');
 assert.equal(resource.extraCount,3);
 assert.equal(resource.collapsedBefore,false,'Extras começa recolhida para reduzir confusão');
 assert.equal(resource.expanded,true,'Extras deve abrir ao clicar');
 assert.equal(resource.summaryVisible,true);
 assert.equal(resource.firstLabel,'1 MARCA · Resistência','a quantidade e o efeito continuam acessíveis por descrição');
 assert.equal(resource.visibleQuantityLabels,0,'os rótulos numéricos não devem duplicar os símbolos');
 assert.equal(resource.resourceSymbols,3,'as três barras originais continuam visíveis no cabeçalho');
 assert.deepEqual(resource.extraSymbols,[{total:3,active:1},{total:3,active:2},{total:3,active:3}],
  'cada Extra mantém o número correto de segmentos visuais');
 assert.deepEqual(resource.titles,['Resistência','Interposição','Persistência']);
 assert.doesNotMatch(resource.main,/\[barra:1\/3\]|Resistência —/);

 const classEntry=await page.evaluate(()=>{
  window.ARQUIVO_INTERNAL.setPage('library');
  window.ARQUIVO_SECOES.select('warehouse');
  const card=document.getElementById('warehousePost-classe-coracao-de-aco');
  card?.querySelector('[data-warehouse-action^="open:"]')?.click();
  const expanded=document.getElementById('warehouseBody-classe-coracao-de-aco');
  return {opened:!!expanded&&!expanded.hidden,resource:expanded?.querySelector('.ae-cbb-resource')?.textContent,
   extras:expanded?.querySelectorAll('.ae-cbb-extra-row')?.length,
   symbols:expanded?.querySelectorAll('.ae-cbb-resource-glyph .ae-inline-resource-segment').length,
   firstExtraSymbols:expanded?.querySelectorAll('.ae-cbb-extra-row:first-child .ae-inline-resource-segment').length};
 });
 assert.equal(classEntry.opened,true);
 assert.doesNotMatch(classEntry.resource,/3 marcas/);
 assert.equal(classEntry.extras,3);
 assert.equal(classEntry.symbols,3);
 assert.equal(classEntry.firstExtraSymbols,3);
});
