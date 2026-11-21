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
});
