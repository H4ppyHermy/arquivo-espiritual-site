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

test('Biblioteca para jogador: consulta manual vazia, guia de combate, livros e celular',
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
 const initial=await page.evaluate(()=>{
  window.ARQUIVO_INTERNAL.setPage('library');
  return {
   tabs:document.querySelectorAll('.ae-library-mode').length,
   guide:!!document.querySelector('.ae-guide-root'),
   lesson:document.querySelector('.ae-field-answer h3')?.textContent?.trim(),
   steps:document.querySelectorAll('.ae-field-card').length,
   chapterSearch:!!document.querySelector('#ruleSearch'),
   glossarySearch:!!document.querySelector('#grimorioSearch'),
   width:Math.round(document.querySelector('.shell').getBoundingClientRect().width)
  };
 });
 assert.equal(initial.tabs,3,'Biblioteca precisa ter três caminhos');
 assert.equal(initial.guide,true,'guia de combate deve ser o acesso inicial enquanto consulta está vazia');
 assert.equal(initial.steps,16);
 assert.match(initial.lesson,/Em que fase eu ajo/);
 assert.equal(initial.chapterSearch,false);
 assert.equal(initial.glossarySearch,false);
 assert.ok(initial.width>=1020);
 const paletteCheck=await page.evaluate(()=>{
  const guide=document.querySelector('.ae-field-guide');
  const toolbar=guide.querySelector('.ae-field-toolbar');
  const badge=guide.querySelector('.ae-field-badge');
  const answer=guide.querySelector('.ae-field-answer');
  const before={
   guide:getComputedStyle(guide).backgroundColor,
   toolbar:getComputedStyle(toolbar).backgroundColor,
   text:getComputedStyle(answer).color
  };
  const palette={
   '--theme-accent':'#b75ce4',
   '--theme-cold':'#4cc1a3',
   '--theme-bg':'#0d1021',
   '--theme-panel':'#242139',
   '--theme-raised':'#372c50',
   '--theme-text':'#f4efff',
   '--theme-structure':'#7a5c9b'
  };
  const old={};
  for(const [key,value] of Object.entries(palette)){
   old[key]=document.body.style.getPropertyValue(key);
   document.body.style.setProperty(key,value);
  }
  const after={
   guide:getComputedStyle(guide).backgroundColor,
   toolbar:getComputedStyle(toolbar).backgroundColor,
   badge:getComputedStyle(badge).backgroundColor,
   text:getComputedStyle(answer).color
  };
  for(const [key,value] of Object.entries(old)){
   if(value)document.body.style.setProperty(key,value);
   else document.body.style.removeProperty(key);
  }
  return {before,after};
 });
 assert.notEqual(paletteCheck.before.toolbar,paletteCheck.after.toolbar);
 assert.notEqual(paletteCheck.before.guide,paletteCheck.after.guide);
 assert.equal(paletteCheck.after.guide,'rgb(36, 33, 57)','painel deve adotar o tema');
 assert.equal(paletteCheck.after.toolbar,'rgb(183, 92, 228)','barra deve usar o acento escolhido');
 assert.equal(paletteCheck.after.badge,'rgb(183, 92, 228)','selo deve usar o acento escolhido');
 assert.equal(paletteCheck.after.text,'rgb(244, 239, 255)','texto deve usar a cor da paleta');
 await page.keyboard.press('/');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'aeGuideSearch','atalho / foca a busca da guia');
 await page.$eval('#aeGuideSearch',el=>{
  el.value='acao completa';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 const searchState=await page.evaluate(()=>({
  matches:document.querySelectorAll('.ae-field-card').length,
  selected:document.querySelector('.ae-field-answer h3')?.textContent,
  focus:document.activeElement?.id
 }));
 assert.equal(searchState.matches,1,'busca deve filtrar enquanto digita');
 assert.match(searchState.selected,/Ação Completa/);
 assert.equal(searchState.focus,'aeGuideSearch','digitar não deve tirar foco');
 await page.$eval('#aeGuideSearch',el=>{
  el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.click('[data-guide-action="group:Defender"]');
 assert.equal((await page.$$('.ae-field-card')).length,3);
 await page.click('[data-guide-action="group:Tudo"]');
 await page.click('[data-guide-action="step:completa"]');
 assert.match(await page.$eval('.ae-field-answer-lead',el=>el.textContent),/Gaste a principal normal/);
 assert.ok(await page.$('.ae-field-answer-actions [data-guide-action^="chapter:"]'));
 await page.click('.ae-field-answer-actions [data-guide-action^="chapter:"]');
 assert.ok(await page.$('.ae-library-chapter.is-open'),'referência deve abrir o capítulo oficial');

 await page.click('[data-action="libraryMode:glossary"]');
 const blank=await page.evaluate(()=>({
  empty:!!document.querySelector('.ae-consulta-empty'),
  hasTerms:!!document.querySelector('.ae-glossary-entry-open'),
  autoDisabled:!document.querySelector('#grimorioAutoInput'),
  text:document.querySelector('.ae-consulta-empty')?.innerText||''
 }));
 assert.equal(blank.empty,true,'glossário deve ser realmente vazio');
 assert.equal(blank.hasTerms,false);
 assert.equal(blank.autoDisabled,true);
 assert.match(blank.text,/nenhum verbete cadastrado/i);

 await page.evaluate(()=>{
  window.ARQUIVO_INTERNAL.db.site.grimorio={schemaVersion:2,visible:true,title:'CONSULTA RÁPIDA',glossary:[
   {id:'manual-test',name:'Exemplo do Mestre',description:'Definição pessoal para uma regra de teste.',
    category:'Testes',chapterId:'cap3',enabled:true}]};
  window.ARQUIVO_INTERNAL.render();
 });
 assert.ok(await page.$('#grimorioSearch'),'verbetes manuais devem permitir busca');
 assert.equal((await page.$$('.ae-grimorio-entry')).length,1);
 assert.match(await page.$eval('#grimorioDetail',el=>el.innerText),/Definição pessoal/);
 await page.$eval('#grimorioSearch',el=>{
  el.value='Exemplo';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.equal((await page.$$('.ae-grimorio-entry')).length,1);
 await page.$eval('#grimorioSearch',el=>{
  el.value='Reação';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.equal((await page.$$('.ae-grimorio-entry')).length,0,'capítulos não devem regenerar a busca');

 await page.click('[data-action="libraryMode:chapters"]');
 assert.ok(await page.$('#ruleSearch'),'capítulos continuam separados e intactos');
 assert.ok(await page.$('.ae-library-chapter'));
 await page.click('[data-action="libraryMode:guide"]');

 await page.setViewport({width:390,height:780});
 const mobile=await page.evaluate(()=>{
  const guide=document.querySelector('.ae-field-guide'),lesson=document.querySelector('.ae-field-answer');
  return {guide:!!guide,lesson:!!lesson,stepCount:document.querySelectorAll('.ae-field-card').length,
   noOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth+3,
   columns:getComputedStyle(document.querySelector('.ae-field-layout')).gridTemplateColumns.split(/\s+/).length};
 });
 assert.equal(mobile.guide,true);
 assert.equal(mobile.lesson,true);
 assert.equal(mobile.stepCount,16);
 assert.equal(mobile.noOverflow,true,'guia não pode causar rolagem horizontal');
 assert.equal(mobile.columns,1,'guia deve empilhar a navegação no celular');

});
