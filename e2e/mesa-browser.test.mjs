import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const here=path.dirname(fileURLToPath(import.meta.url)),parent=path.dirname(here);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('Mesa: passos e condições atualizam a rolagem sem recarregar a ficha',{timeout:60000},async t=>{
 const files={
  '/':fs.readFileSync(path.join(here,'mesa-fixture.html')),
  '/cbb-engine.js':fs.readFileSync(path.join(parent,'cbb-engine.js')),
  '/cbb-interativo.js':fs.readFileSync(path.join(parent,'cbb-interativo.js')),
  '/cbb-interativo.css':fs.readFileSync(path.join(parent,'cbb-interativo.css'))
 };
 const server=http.createServer((req,res)=>{
  const f=files[(req.url||'/').split('?')[0]];
  res.writeHead(f?200:404,{'content-type':req.url?.includes('.js')?'text/javascript':
   req.url?.includes('.css')?'text/css':'text/html'});
  res.end(f||'not found');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>server.close());
 const browser=await puppeteer.launch({
  executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  headless:true,protocolTimeout:15000,
  args:['--no-sandbox','--disable-dev-shm-usage']
 });
 t.after(async()=>{try{await Promise.race([browser.close(),pause(4000)])}catch(e){}browser.process()?.kill()});
 const page=await browser.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>console.log('Mesa página: '+e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 assert.equal(await page.$('[data-cbb-preview]')!==null,true);
 assert.equal(await page.$('[data-cbb-step="groupSteps"]')!==null,true);
 const preview=()=>page.$eval('[data-cbb-preview]',el=>el.innerText);
 const previewData=()=>page.$$eval('.ae-cbb-preview-die strong',els=>els.map(e=>e.textContent));
 assert.deepEqual(await previewData(),['d6','d6']);
 await page.select('[data-cbb-field="skill"]','Raciocínio');
 assert.deepEqual(await previewData(),['d6','d6']); // d8 -1 por Confuso
 assert.match(await preview(),/Confuso/);
 // A personalização fica recolhida para jogadores novos; abra-a antes de alterar passos.
 await page.click('details.ae-cbb-advanced:has([data-cbb-field="skillSteps"]) > summary');
 await page.click('[data-cbb-step="skillSteps"][data-cbb-delta="1"]');
 assert.deepEqual(await previewData(),['d6','d8']);
 assert.equal(await page.$eval('[data-cbb-field="skillSteps"]',e=>e.value),'1');
 await page.select('[data-cbb-field="context"]','ataque');
 assert.deepEqual(await previewData(),['d6','d6']); // +1 manual, -1 Confuso, -1 Exposição
 await page.evaluate(()=>{window.__sheet.conditions.push('Atordoado');
  window.dispatchEvent(new Event('arquivo-online-snapshot'))});
 assert.deepEqual(await previewData(),['d6','d4']);
 assert.match(await preview(),/Atordoado/);
 await page.select('[data-cbb-field="context"]','defesa');
 assert.equal(await page.$eval('[data-cbb-field="reaction"]',e=>e.disabled),true,
  'Atordoado bloqueia reação ao escolher Defesa');
 await page.select('[data-cbb-field="context"]','ataque');
 await page.evaluate(()=>{window.__sheet.conditions.push('Cego');
  window.dispatchEvent(new Event('arquivo-online-snapshot'))});
 assert.equal(await page.$('[data-cbb-field="vision"]')!==null,true);
 await page.click('[data-cbb-field="vision"]');
 assert.match(await preview(),/Cego/);
 await page.click('[data-cbb-command="skill"]');
 await page.waitForFunction(()=>window.__rolls.length===1,{timeout:7000});
 const payload=await page.evaluate(()=>window.__rolls[0]);
 assert.equal(payload.p_skill,'Raciocínio');
 assert.equal(payload.p_context,'ataque');
 assert.equal(payload.p_skill_steps,-1,'Manual +1 e visão -2. Outras condições entram no RPC');
 assert.equal(payload.p_group_steps,0);
 assert.match(await page.$eval('.ae-cbb-result',e=>e.innerText),/TESTE VERIFICADO/);
 await page.evaluate(()=>{window.__sheet.conditions=[''];window.__sheet.exposures={};
  window.dispatchEvent(new Event('arquivo-online-snapshot'))});
 assert.doesNotMatch(await preview(),/Confuso|Atordoado|Cego/);
 assert.deepEqual(await previewData(),['d6','d10'],'Cessada a condição, +1 passo manual permanece');

 // Exposição Espiritual: redução automática nas perícias Espírito e nenhum efeito em Mente.
 await page.evaluate(()=>{
  window.__sheet.exposures.espiritual=2;
  window.dispatchEvent(new Event('arquivo-online-snapshot'));
 });
 await page.select('[data-cbb-field="skill"]','Liberação');
 assert.deepEqual(await previewData(),['d6','d4']);
 assert.match(await preview(),/Exposição Espiritual/);
 await page.evaluate(()=>{
  window.__sheet.exposures={defensiva:0,ofensiva:0,ritmica:0,espiritual:0};
  window.__sheet.resources.alma.current=5;
  window.dispatchEvent(new Event('arquivo-online-snapshot'));
 });
 // Comprometimento recupera ALMA e registra a nova categoria na interface.
 await page.click('[data-cbb-mode="turno"]');
 await page.click('details.ae-cbb-optional-turn > summary');
 await page.select('[data-cbb-field="exposure"]','espiritual');
 await page.click('[data-cbb-command="commit"]');
 await page.waitForFunction(()=>window.__sheet.resources.alma.current===7);
 assert.equal(await page.$eval('.ae-cbb-status',x=>x.textContent.includes('+2 ALMA')),true);
 // Ação Completa exige a ação principal e a reação normais antes de atacar.
 await page.click('[data-cbb-command="complete"]');
 await page.waitForFunction(()=>document.querySelector('[data-cbb-panel="teste"]')?.hidden===false);
 assert.equal(await page.$eval('[data-cbb-field="context"]',x=>x.value),'ataque');
 assert.equal(await page.evaluate(()=>window.__sheet.combat.mainUsed&&window.__sheet.combat.reactionUsed),true);
 const beforeAttack=await page.evaluate(()=>window.__rolls.length);
 await page.click('[data-cbb-command="skill"]');
 await page.waitForFunction(n=>window.__rolls.length>n,{},beforeAttack);
 await page.click('[data-cbb-mode="dano"]');
 assert.equal(await page.$eval('[data-cbb-field="useAttackRa"]',x=>x.checked),true);
 assert.match(await page.$eval('[data-cbb-field="useAttackRa"]',x=>x.closest('label').innerText),/Somar RT/);
 const priorAttack=await page.evaluate(()=>window.__rolls.length);
 await page.click('[data-cbb-command="pool"]');
 await page.waitForFunction(n=>window.__rolls.length>n,{},priorAttack);
 const damage=await page.evaluate(()=>window.__rolls.at(-1));
 assert.equal(damage.p_kind,'dano');
 assert.equal(damage.p_attack_id,priorAttack);
 assert.match(await page.$eval('.ae-cbb-result',el=>el.textContent),/Ação Completa · RT/);
 assert.equal(await page.$eval('[data-cbb-field="useAttackRa"]',x=>x.disabled),true);
});
