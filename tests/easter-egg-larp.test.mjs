import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../easter-egg-larp.js',import.meta.url),'utf8');

function setup({onPlay}={}){
 let now=1000;
 const events={};
 const attrs={};
 const classes=new Set();
 const caption={textContent:'SUA JORNADA COMEÇA AQUI'};
 const button={
  querySelector:()=>caption,
  classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},
  setAttribute:(name,value)=>{attrs[name]=value}
 };
 const audio={
  src:'',loop:false,preload:'',volume:1,paused:true,currentTime:0,playCount:0,pauseCount:0,
  play(){this.playCount++;this.paused=false;return onPlay?onPlay():Promise.resolve()},
  pause(){this.pauseCount++;this.paused=true}
 };
 let notify;
 class MutationObserver {
  constructor(cb){notify=cb}
  observe(){}
 }
 const document={
  addEventListener(name,callback){events[name]=callback},
  getElementById:()=>({}),
  querySelector:()=>button
 };
 vm.runInNewContext(code,{
  Audio:function(){return audio},
  document,MutationObserver,Promise,
  performance:{now:()=>now}
 });
 const click=(time)=>{now=time;events.click({target:{closest:()=>button}})};
 return {click,caption,classes,attrs,audio,rerender:()=>notify()};
}

test('3 cliques revelam o texto e o quarto inicia audio em loop',async()=>{
 const x=setup();
 x.click(1000);x.click(1200);
 assert.equal(x.caption.textContent,'SUA JORNADA COMEÇA AQUI');
 assert.equal(x.audio.playCount,0);
 x.click(1400);
 assert.equal(x.caption.textContent,'SEU LARP COMEÇA AGORA');
 assert.equal(x.audio.playCount,0);
 x.click(1600);
 assert.equal(x.audio.playCount,1);
 assert.equal(x.audio.loop,true);
 assert.equal(x.audio.src,'assets/larp-easter-egg.mp3');
 assert.equal(x.attrs['aria-pressed'],'true');
 assert.equal(x.classes.has('is-playing'),true);
 await Promise.resolve();
 x.rerender();
 assert.equal(x.caption.textContent,'SEU LARP COMEÇA AGORA');
 x.click(1800);
 assert.equal(x.audio.paused,true);
 assert.equal(x.audio.currentTime,0);
 assert.equal(x.caption.textContent,'SUA JORNADA COMEÇA AQUI');
 assert.equal(x.attrs['aria-pressed'],'false');
});
test('cliques muito distantes nao contam como sequencia',()=>{
 const x=setup();
 x.click(1000);x.click(2600);x.click(4200);
 assert.equal(x.caption.textContent,'SUA JORNADA COMEÇA AQUI');
 assert.equal(x.audio.playCount,0);
 x.click(4300);x.click(4400);
 assert.equal(x.caption.textContent,'SEU LARP COMEÇA AGORA');
});
test('arquivo MP3 existe e preserva assinatura ID3',()=>{
 const p=new URL('../assets/larp-easter-egg.mp3',import.meta.url);
 const bytes=fs.readFileSync(p);
 assert.ok(bytes.length>100000);
 assert.equal(bytes.subarray(0,3).toString(),'ID3');
});

test('promessa antiga nao interrompe uma nova reproducao',async()=>{
 const pending=[];
 const x=setup({onPlay:()=>new Promise(resolve=>pending.push(resolve))});
 x.click(1000);x.click(1100);x.click(1200);x.click(1300);
 assert.equal(x.audio.playCount,1);
 x.click(1400);
 x.click(1500);x.click(1600);x.click(1700);x.click(1800);
 assert.equal(x.audio.playCount,2);
 pending[0]();
 await Promise.resolve();
 assert.equal(x.audio.paused,false);
 pending[1]();
 await Promise.resolve();
 assert.equal(x.audio.paused,false);
});
test('falha de autoplay permite tentar novamente',async()=>{
 let attempts=0;
 const x=setup({onPlay:()=>++attempts===1?Promise.reject(Error('blocked')):Promise.resolve()});
 x.click(1000);x.click(1100);x.click(1200);x.click(1300);
 await Promise.resolve();
 assert.equal(x.classes.has('is-playing'),false);
 assert.equal(x.caption.textContent,'SEU LARP COMEÇA AGORA');
 x.click(1400);
 assert.equal(x.audio.playCount,2);
 assert.equal(x.classes.has('is-playing'),true);
});
