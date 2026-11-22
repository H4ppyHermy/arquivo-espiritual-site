import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files={
 '/rolagens-ao-vivo.js':fs.readFileSync(path.join(root,'rolagens-ao-vivo.js')),
 '/rolagens-ao-vivo.css':fs.readFileSync(path.join(root,'rolagens-ao-vivo.css'))
};
const fixture=[
 '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<style>:root{--theme-accent:#b066f0;--theme-cold:#7de8eb;--theme-bg:#09141e;--theme-panel:#182732;--theme-raised:#294150;--theme-text:#eefcff;--theme-structure:#567180}</style>',
 '<link rel="stylesheet" href="/rolagens-ao-vivo.css"></head><body style="margin:0;background:var(--theme-bg);color:var(--theme-text)">',
 '<main style="min-height:150vh;padding:24px"><h1>Teste da Mesa</h1></main>',
 '<script>',
 'window.ARQUIVO_INTERNAL={db:{sheets:[{id:"jogador",masterOnly:false,locked:true},{id:"chefe",masterOnly:true,locked:true},{id:"outro",name:"FICHA DESCONHECIDA",masterOnly:false,locked:true,redacted:true}]}};',
 'window.ARQUIVO_SYNC={state:{enabled:true,identity:{id:"usuario",kind:"player"},rollRealtime:"connected"},rollLatest:async()=>[]};',
 'window.__seen=[];',
 'window.addEventListener("arquivo-roll-public",e=>window.__seen.push(e.detail.roll.id));',
 'window.__roll=(id,opts={})=>window.dispatchEvent(new CustomEvent("arquivo-roll-registered",{detail:{source:"realtime",roll:{',
 'id,account_name:"Fulano",sheet_id:"jogador",kind:"cbb",label:"Ataque de Liberação",hidden:false,total:12,',
 'dice:[{sides:6,value:5},{sides:8,value:7}],created_at:new Date().toISOString(),...opts',
 '}}}));',
 '</script><script src="/rolagens-ao-vivo.js"></script></body></html>'
].join('');

test('rolagens públicas aparecem imediatamente no topo e respeitam privacidade',{timeout:40000},async t=>{
 const server=http.createServer((req,res)=>{
  const route=(req.url||'/').split('?')[0],file=files[route];
  res.writeHead(file?200:route==='/'?200:404,{'content-type':route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':'text/html; charset=utf-8'});
  res.end(file||(route==='/'?fixture:'not found'));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 t.after(async()=>{try{await browser.close()}catch(e){}});
 const page=await browser.newPage();page.setDefaultTimeout(8000);
 await page.setViewport({width:1440,height:900});
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await page.evaluate(()=>window.dispatchEvent(new Event('arquivo-online-ready')));
 await page.evaluate(()=>window.__roll(10));
 await page.waitForSelector('#aeRollToast:not([hidden])');
 let detail=await page.evaluate(()=>({text:document.getElementById('aeRollToast').innerText,ids:window.__seen,
  top:getComputedStyle(document.getElementById('aeRollToast')).position}));
 assert.match(detail.text,/Ataque de Liberação/);
 assert.match(detail.text,/12/);
 assert.equal(detail.top,'fixed');
 assert.deepEqual(detail.ids,[10]);
 await page.evaluate(()=>{window.__roll(10);window.__roll(11,{sheet_id:'chefe',label:'SEGREDO DO CHEFE'});});
 detail=await page.evaluate(()=>({text:document.getElementById('aeRollToast').innerText,ids:window.__seen}));
 assert.deepEqual(detail.ids,[10]);
 assert.doesNotMatch(detail.text,/SEGREDO DO CHEFE/);
 await page.evaluate(()=>window.__roll(12,{sheet_id:'outro',character_name:'Outro jogador',label:'Teste aliado'}));
 assert.match(await page.$eval('#aeRollToast',el=>el.innerText),/Teste aliado/);
 await page.evaluate(()=>window.__roll(13,{kind:'discord',sheet_id:null,account_name:'Discord · Jogador',label:'2d6'}));
 detail=await page.evaluate(()=>({text:document.getElementById('aeRollToast').innerText,ids:window.__seen}));
 assert.deepEqual(detail.ids,[10,12,13]);
 assert.match(detail.text,/DISCORD/);
 assert.match(detail.text,/2d6/);
 await page.click('.ae-roll-live-close');
 assert.equal(await page.$eval('#aeRollToast',e=>e.hidden),true);
 await page.evaluate(()=>window.__roll(14));
 assert.equal(await page.$eval('#aeRollToast',e=>e.hidden),false,'novo dado deve reaparecer sem cooldown');
 await page.setViewport({width:390,height:780});
 const mobile=await page.evaluate(()=>{
  const b=document.getElementById('aeRollToast').getBoundingClientRect();
  return {width:b.width,right:b.right,viewport:innerWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2};
 });
 assert.ok(mobile.width>=250&&mobile.right<=mobile.viewport+1,'avisos devem caber em celular');
 assert.equal(mobile.overflow,false);
});
