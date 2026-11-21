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

test('Biblioteca para jogador: glossário direto, resposta legível, capítulos independentes e celular',
 {timeout:65000},async t=>{
 const server=http.createServer((req,res)=>{
  const route=decodeURIComponent((req.url||'/').split('?')[0]);
  if(route==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
  if(route==='/configuracao.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end('window.ARQUIVO_ONLINE_CONFIG={};');return}
  const file=path.resolve(root,'.'+route);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);res.end('not found');return;
  }
  const mime=route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':'application/octet-stream';
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
 await page.setViewport({width:1440,height:900});
 await page.setRequestInterception(true);
 page.on('request',request=>request.url().startsWith('http://127.0.0.1:')?request.continue():request.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 const first=await page.evaluate(()=>{
  window.ARQUIVO_INTERNAL.setPage('library');
  const sheet=document.querySelector('.shell'),detail=document.querySelector('#grimorioDetail');
  const result=document.querySelector('.ae-glossary-entry-open');
  return {
   glossary:!!document.querySelector('#grimorioSearch'),
   chapterSearch:!!document.querySelector('#ruleSearch'),
   answer:!!detail?.textContent?.trim(),
   selected:!!result,
   tabs:document.querySelectorAll('.ae-library-mode').length,
   width:Math.round(sheet?.getBoundingClientRect().width||0),
   answerTop:Math.round(detail?.getBoundingClientRect().top||0)
  };
 });
 assert.equal(first.glossary,true,'o glossário deve abrir por padrão');
 assert.equal(first.chapterSearch,false,'não devem existir duas buscas concorrentes');
 assert.equal(first.answer,true,'a definição completa deve aparecer sem modal');
 assert.equal(first.selected,true);
 assert.equal(first.tabs,2);
 assert.ok(first.width>=1020,'desktop deve usar a largura disponível');
 assert.ok(first.answerTop<900,'definição precisa aparecer sem rolagem inicial em desktop');
 await page.keyboard.press('/');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'grimorioSearch','atalho / deve buscar termos');
 const chosen=await page.$eval('.ae-glossary-entry-open strong',el=>el.textContent.trim());
 await page.$eval('#grimorioSearch',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))},chosen);
 assert.ok((await page.$$('[data-action^="grimorioSelect:"]')).length>=1,'busca deve encontrar o termo');
 await page.click('[data-action^="grimorioSelect:"]');
 const selected=await page.$eval('.ae-glossary-detail-heading h3',el=>el.textContent.trim());
 assert.equal(selected,chosen,'o clique deve abrir a definição no mesmo painel');
 await page.click('[data-action="libraryMode:chapters"]');
 assert.ok(await page.$('#ruleSearch'),'capítulos devem ter pesquisa própria');
 assert.ok(await page.$('.ae-library-chapter'),'capítulos devem existir sem esconder regras');
 assert.equal(await page.$('#grimorioSearch'),null,'busca do glossário deve sair no modo capítulos');
 await page.click('[data-action="libraryMode:glossary"]');
 assert.ok(await page.$('#grimorioSearch'));
 await page.setViewport({width:390,height:780});
 const mobile=await page.evaluate(()=>{
  const search=document.querySelector('#grimorioSearch'),detail=document.querySelector('#grimorioDetail');
  return {searchVisible:!!search&&search.getBoundingClientRect().width>120,
   detail:!!detail&&getComputedStyle(detail).display!=='none',
   noOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth+3,
   responsive:getComputedStyle(document.querySelector('.ae-glossary-answer-layout')).gridTemplateColumns.split(/\s+/).length===1};
 });
 assert.equal(mobile.searchVisible,true);
 assert.equal(mobile.detail,true,'o painel de definição deve continuar acessível no celular');
 assert.equal(mobile.noOverflow,true,'sem rolagem horizontal');
 assert.equal(mobile.responsive,true,'lista e definição empilhadas em tela estreita');
});
