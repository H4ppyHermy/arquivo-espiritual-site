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
  window.ARQUIVO_INTERNAL.setPage('sheets');
  document.querySelector('.sheet-entry[data-sheet]')?.click();
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
  return {unchanged,changed,writes,ms};
 });
 console.log('25 snapshots de ficha não relacionada em Chrome: '+result.ms.toFixed(2)+' ms');
 assert.equal(result.unchanged,true,'o DOM da ficha aberta deve ser preservado');
 assert.equal(result.changed,true,'a ficha aberta deve mudar se seus próprios dados mudarem');
 assert.ok(result.writes<=2,'persistência síncrona deve ser agrupada: '+result.writes);
});
