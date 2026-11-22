import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8')
 .replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>','');

test('ficha flutuante acompanha biblioteca, mantém rolagens e não revela chefes',{timeout:60000},async t=>{
 const server=http.createServer((req,res)=>{
  const route=decodeURIComponent((req.url||'/').split('?')[0]);
  if(route==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
  if(route==='/configuracao.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end('window.ARQUIVO_ONLINE_CONFIG={};');return}
  const file=path.resolve(root,'.'+route);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);res.end('not found');return;
  }
  const mime=route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':route.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
  let body=fs.readFileSync(file);
  if(route==='/arquivo-base.css')body=Buffer.from(body.toString().replace(/^@import[^;]+;/,''));
  res.writeHead(200,{'content-type':mime});res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  headless:true,protocolTimeout:15000,args:['--no-sandbox','--disable-dev-shm-usage']});
 t.after(async()=>{try{await browser.close()}catch(e){}});
 const page=await browser.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>console.log('HUD Chrome: '+e.message));
 await page.setRequestInterception(true);
 page.on('request',req=>req.url().startsWith('http://127.0.0.1:')?req.continue():req.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await page.evaluate(()=>{
  const api=window.ARQUIVO_INTERNAL,sync=window.ARQUIVO_SYNC;
  const identity={id:'hud-player',kind:'player',name:'Jogador',accountName:'Jogador'};
  sync.state.enabled=true;sync.state.identity=identity;sync.state.keys=[identity];
  const skills=Object.fromEntries(['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão',
   'Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia','Presença',
   'Sensibilidade','Integridade','Disciplina','Manipulação','Liberação'].map(n=>[n,6]));
  const sheet={id:'hud-personagem',name:'Personagem Teste HUD',level:3,masterOnly:false,
   locked:true,linkedKeyIds:[identity.id],ownerKeyId:identity.id,
   resources:{vida:{current:24,max:30},estabilidade:{current:16,max:18},alma:{current:9,max:20}},
   groups:{Corpo:6,Mente:6,Espírito:8},skills,conditions:[],exposures:{},abilities:[],
   combat:{scene:1,round:1,phase:'preparacao',mainUsed:false,reactionUsed:false},
   inventory:{items:[],currencies:[]},notes:''};
  const boss={...sheet,id:'boss-hud',name:'BOSS SECRETO',masterOnly:true,linkedKeyIds:[]};
  const snapshot=JSON.parse(JSON.stringify(api.db));
  snapshot.sheets=[sheet,boss];snapshot.rules??=[];snapshot.site??={};
  window.__hudSheet=sheet;
  sync.cbbAction=async args=>{
   if(args.p_action==='main')sheet.combat.mainUsed=true;
   if(args.p_action==='reaction')sheet.combat.reactionUsed=true;
   return {ok:true,resources:sheet.resources,combat:sheet.combat,exposures:sheet.exposures,abilityRuntime:{},info:{}};
  };
  sync.cbbCorrectTurn=async(id,action)=>{
   if(action==='reset_main')sheet.combat.mainUsed=false;
   if(action==='reset_reaction')sheet.combat.reactionUsed=false;
   return {ok:true,combat:sheet.combat};
  };
  sync.joinableSheets=async()=>[{id:'ficha-liberada',name:'Personagem Disponível',level:1,open:true}];
  sync.cbbRoll=async()=>({id:77,kind:'cbb',total:9,rt:9,ra:6,rb:3,dice:[{sides:6,value:3},{sides:6,value:6}],colors:['#ffffff','#ffffff']});
  window.dispatchEvent(new CustomEvent('arquivo-online-snapshot',{detail:{data:snapshot,identity,keys:[identity],revision:8888}}));
  api.setPage('library');
 });
 await page.waitForSelector('#aeQuickSheetRoot:not([hidden]) .ae-quick-launch');
 assert.match(await page.$eval('.ae-quick-launch',e=>e.textContent),/Personagem Teste HUD/);
 await page.click('.ae-quick-launch');
 await page.waitForSelector('.ae-quick-window');
 let text=await page.$eval('.ae-quick-window',e=>e.innerText);
 assert.match(text,/24 \/ 30/);
 assert.match(text,/9 \/ 20/);
 assert.doesNotMatch(text,/BOSS SECRETO/);
 await page.click('[data-quick-tab="mesa"]');
 assert.equal(await page.$$eval('[data-cbb-mode]',els=>els.length),6);
 assert.match(await page.$eval('.ae-cbb-turn-overview',e=>e.innerText),/PRINCIPAL/);
 await page.click('#aeQuickSheetRoot [data-cbb-command="main"]');
 await page.waitForFunction(()=>document.querySelector('#aeQuickSheetRoot [data-cbb-command="resetMain"]')!==null);
 text=await page.$eval('.ae-cbb-turn-overview',e=>e.innerText);
 assert.match(text,/USADA/);
 assert.match(text,/CORRIGIR/);
 await page.click('[data-quick-tab="skills"]');
 assert.match(await page.$eval('#aeQuickSheetRoot .ae-quick-body',e=>e.innerText),/Precisão/);
 await page.setViewport({width:390,height:780});
 const frame=await page.$eval('.ae-quick-window',e=>{
  const r=e.getBoundingClientRect();return {right:r.right,top:r.top,bottom:r.bottom,width:r.width};
 });
 assert.ok(frame.right<=391&&frame.top>=-1&&frame.bottom<=781,'janela não pode sair da tela mobile');
 await page.evaluate(()=>window.ARQUIVO_INTERNAL.setPage('home'));
 assert.equal(await page.$eval('.ae-quick-launch',e=>e.textContent.includes('Personagem Teste HUD')),true,
  'atalho continua disponível na visão geral');
});
