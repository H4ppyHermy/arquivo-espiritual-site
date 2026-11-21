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

test('uma alteração de outra ficha não reconstrói a ficha aberta e agrupa gravações offline',
 {timeout:60000},async t=>{
 const server=http.createServer((req,res)=>{
  const route=decodeURIComponent((req.url||'/').split('?')[0]);
  if(route==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
  if(route==='/configuracao.js'){
   res.writeHead(200,{'content-type':'text/javascript'});
   res.end('window.ARQUIVO_ONLINE_CONFIG={};');return
  }
  const file=path.resolve(root,'.'+route);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);res.end('not found');return;
  }
  const mime=route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':
   route.endsWith('.svg')?'image/svg+xml':route.endsWith('.ttf')?'font/ttf':'application/octet-stream';
  let body=fs.readFileSync(file);
  if(route==='/arquivo-base.css')body=Buffer.from(body.toString().replace(/^@import[^;]+;/,''));
  res.writeHead(200,{'content-type':mime});res.end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>server.close());
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  headless:true,protocolTimeout:15000,args:['--no-sandbox','--disable-dev-shm-usage']});
 t.after(async()=>{try{await browser.close()}catch(e){}});
 const page=await browser.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>console.warn('Performance browser: '+e.message));
 await page.setRequestInterception(true);
 page.on('request',req=>req.url().startsWith('http://127.0.0.1:')?req.continue():req.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await page.evaluate(()=>{
  // O conteúdo público não inclui fichas pessoais; criar apenas uma ficha local
  // para medir o comportamento do app sem acessar os jogadores de produção.
  const db=window.ARQUIVO_INTERNAL.db;
  db.sheets.push({
   id:'performance-e2e',name:'Ficha do teste',subtitle:'Ambiente isolado',level:1,
   image:'',resources:{vida:{current:20,max:20},estabilidade:{current:15,max:15},alma:{current:10,max:10}},
   groups:{Corpo:6,Mente:6,Espírito:6},skills:{Vigor:6,Destreza:6,Precisão:6},
   abilities:[],inventory:{items:[],currencies:[]},conditions:[],notes:'',combat:{scene:1,round:1,phase:'preparacao'}
  });
  window.ARQUIVO_INTERNAL.setPage('sheets');
  document.querySelector('.sheet-entry[data-sheet="performance-e2e"]')?.click();
 });
 await page.waitForSelector('#sheetBody');
 const result=await page.evaluate(async()=>{
  const original=Storage.prototype.setItem;
  let writes=0;
  Storage.prototype.setItem=function(key,value){
   if(key==='arquivo_data')writes++;
   return original.call(this,key,value);
  };
  const before=document.getElementById('sheetBody');
  const source=window.ARQUIVO_INTERNAL.db;
  const snapshot=JSON.parse(JSON.stringify(source));
  snapshot.sheets.push({id:'outro-personagem',name:'Outro personagem',level:1,abilities:[]});
  const start=performance.now();
  for(let i=1;i<=25;i++){
   window.dispatchEvent(new CustomEvent('arquivo-online-snapshot',
    {detail:{data:JSON.parse(JSON.stringify(snapshot)),identity:null,revision:i,keys:[]}}));
  }
  const ms=performance.now()-start;
  const unchanged=before===document.getElementById('sheetBody');
  const updated=JSON.parse(JSON.stringify(snapshot));
  updated.sheets.find(s=>s.id===source.sheets[0].id).conditions=['Atordoado'];
  window.dispatchEvent(new CustomEvent('arquivo-online-snapshot',
   {detail:{data:updated,identity:null,revision:26,keys:[]}}));
  const changed=before!==document.getElementById('sheetBody');
  await new Promise(resolve=>setTimeout(resolve,650));
  window.ARQUIVO_INTERNAL.setPage('library');
  const libraryNode=document.getElementById('page').firstElementChild;
  const librarySnapshot=JSON.parse(JSON.stringify(window.ARQUIVO_INTERNAL.db));
  librarySnapshot.sheets[0].combat.round=2;
  window.dispatchEvent(new CustomEvent('arquivo-online-snapshot',
   {detail:{data:librarySnapshot,identity:null,revision:27,keys:[]}}));
  const libraryUnchanged=libraryNode===document.getElementById('page').firstElementChild;
  return {unchanged,changed,libraryUnchanged,writes,ms};
 });
 console.log('25 snapshots de ficha não relacionada em Chrome: '+result.ms.toFixed(2)+' ms');
 assert.equal(result.unchanged,true,'o DOM da ficha aberta deve ser preservado');
 assert.equal(result.changed,true,'a ficha aberta deve mudar se seus próprios dados mudarem');
 assert.equal(result.libraryUnchanged,true,'a Biblioteca não deve saltar ao receber alterações de combate');
 assert.ok(result.writes<=2,'persistência síncrona deve ser agrupada: '+result.writes);
});
