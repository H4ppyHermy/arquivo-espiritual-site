import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const here=path.dirname(fileURLToPath(import.meta.url));
const parent=path.dirname(here);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=20000,step=300){
 const start=Date.now(),sample=[];
 while(Date.now()-start<timeout){
  const v=await fn();
  if(v)return v;
  await wait(step);
 }
 throw Error('Esgotado: '+JSON.stringify(sample));
}
test('navegadores reais recebem quadros de câmera e compartilhamento de tela em ambos os lados',async t=>{
 const files={
  '/':fs.readFileSync(path.join(here,'rtc-fixture.html')),
  '/sala-ao-vivo.js':fs.readFileSync(path.join(parent,'sala-ao-vivo.js'))
 };
 const server=http.createServer((req,res)=>{
  const file=files[(req.url||'/').split('?')[0]];
  if(!file){res.writeHead(404);res.end();return}
  res.writeHead(200,{'content-type':req.url?.includes('.js')?'text/javascript':'text/html'});
  res.end(file);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 t.after(()=>server.close());
 const browser=await puppeteer.launch({
  executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-fake-device-for-media-stream',
   '--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required',
   '--disable-features=WebRtcHideLocalIpsWithMdns']
 });
 t.after(()=>browser.close());
 const ua=await browser.newPage(),ub=await browser.newPage();
 ua.on('console',m=>{if(m.type()==='error')console.log('MASTER CONSOLE '+m.text())});
 ub.on('console',m=>{if(m.type()==='error')console.log('PLAYER CONSOLE '+m.text())});
 ua.on('pageerror',e=>console.log('MASTER PAGE ERROR '+e.message));
 ub.on('pageerror',e=>console.log('PLAYER PAGE ERROR '+e.message));
 const base='http://127.0.0.1:'+port;
 await ua.goto(base+'/?account=11111111-1111-4111-8111-111111111111&master=1',{waitUntil:'load'});
 await ub.goto(base+'/?account=22222222-2222-4222-8222-222222222222&master=0',{waitUntil:'load'});
 await ua.waitForSelector('[data-live-action=join]',{timeout:15000});
 await ub.waitForSelector('[data-live-action=join]',{timeout:15000});
 await ua.click('[data-live-action=join]');
 await ub.click('[data-live-action=join]');
 await until(async()=>{
  const [a,b]=await Promise.all([ua.evaluate(()=>window.__rtcProbe.snapshot()),ub.evaluate(()=>window.__rtcProbe.snapshot())]);
  return a.joined&&b.joined&&a.peers[0]?.connection==='connected'&&b.peers[0]?.connection==='connected';
 },25000);
 await ua.click('[data-live-action=camera]');
 try{
  await until(async()=>{
   const p=await ub.evaluate(()=>window.__rtcProbe.snapshot());
   return p.peers[0]?.frames>=2&&p.peers[0]?.bytes>1000;
  },14000);
 }catch(e){
  console.log('CÂMERA: '+JSON.stringify(await Promise.all([ua.evaluate(()=>window.__rtcProbe.snapshot()),ub.evaluate(()=>window.__rtcProbe.snapshot())])));
  throw e;
 }
 // Verifica o caminho inverso: jogador compartilha a tela e o mestre vê quadros reais.
 await ub.click('[data-live-action=screen]');
 try{
  await until(async()=>{
   const p=await ua.evaluate(()=>window.__rtcProbe.snapshot());
   return p.peers[0]?.hasScreen&&p.peers[0]?.frames>=2&&p.peers[0]?.bytes>1000&&p.spotlight.kind==='screen'&&p.spotlight.width>0;
  },16000);
 }catch(e){
  console.log('TELA: '+JSON.stringify(await Promise.all([ua.evaluate(()=>window.__rtcProbe.snapshot()),ub.evaluate(()=>window.__rtcProbe.snapshot())])));
  throw e;
 }
 const a=await ua.evaluate(()=>window.__rtcProbe.snapshot()),b=await ub.evaluate(()=>window.__rtcProbe.snapshot());
 assert.ok(a.peers[0]?.frames>=2,'mestre recebe quadros de tela do jogador');
 assert.ok(b.peers[0]?.frames>=2,'jogador recebe quadros da câmera do mestre');
 assert.ok(a.spotlight.width>=100,'prévia remota de tela possui vídeo válido');
 console.log('RTCPeerConnection real: '+JSON.stringify({master:a,player:b}));
});
