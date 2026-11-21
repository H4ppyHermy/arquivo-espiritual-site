import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function setup(){
 const loaded=['script:arquivo-app.js?v=1','link:ficha-visual.css?v=1'];
 let deployed=loaded.slice(),revision='build-a',checks=0;
 const appended=[],handlers={},timers=[],buttons={};
 const element=(tag)=>{
  const node={tagName:tag.toUpperCase(),isConnected:true,attrs:{},event:{},
   setAttribute(name,value){this.attrs[name]=value},
   addEventListener(name,fn){this.event[name]=fn},
   focus(){document.activeElement=this},
   remove(){this.isConnected=false},
   querySelector(selector){
    if(selector==='[data-ae-update-reload]'||selector==='[data-ae-update-later]'){
     if(!buttons[selector])buttons[selector]=element('button');
     return buttons[selector];
    }
    return null;
   },
   querySelectorAll(selector){return selector==='button'?Object.values(buttons):[]}
  };
  return node;
 };
 const loadedNodes=loaded.map(value=>({
  tagName:value.startsWith('script:')?'SCRIPT':'LINK',
  getAttribute:()=>value.slice(value.indexOf(':')+1)
 }));
 const document={
  baseURI:'https://example.com/bleach/',
  readyState:'complete',hidden:false,activeElement:null,
  body:{appendChild(node){appended.push(node);return node}},
  querySelectorAll(){return loadedNodes},
  createElement:element,
  addEventListener(name,fn){handlers[name]=fn},
  removeEventListener(name){delete handlers[name]}
 };
 const window={location:{href:'https://example.com/bleach/',replace(){}},
  addEventListener(name,fn){handlers[name]=fn}};
 const parseFromString=()=>{
  const nodes=deployed.map(value=>({
   tagName:value.startsWith('script:')?'SCRIPT':'LINK',
   getAttribute:()=>value.slice(value.indexOf(':')+1)
  }));
  return {querySelectorAll(){return nodes}};
 };
 const context={window,document,URL,DOMParser:class{parseFromString(){return parseFromString()}},
  fetch:async url=>{
   checks++;
   if(String(url).includes('site-version.json'))return {ok:true,json:async()=>({version:revision})};
   return {ok:true,text:async()=>'<html>teste</html>'};
  },
  setTimeout(fn){timers.push(fn)},setInterval(){},Date};
 vm.runInNewContext(read('site-update.js'),context);
 return {window,document,appended,buttons,timers,handlers,
  deploy(resources,build){deployed=resources;revision=build},
  get checks(){return checks}};
}
test('o cabeçalho de habilidades usa a paleta em vez de fundo branco',()=>{
 const css=read('playtest-ux.css');
 assert.match(css,/#page \.ae-ficha-ability-card \.ae-ficha-ability-tag\{/);
 assert.match(css,/color-mix\(in srgb,var\(--theme-raised\)/);
 assert.match(css,/border-left:4px solid var\(--sheet-accent,var\(--theme-accent\)\)/);
 assert.match(css,/#page \.ae-ficha-ability-tag \.ae-ability-drag-handle/);
});
test('o watcher é carregado globalmente e o manifesto varia por build',()=>{
 const html=read('index.html'),manifest=read('site-version.json');
 assert.match(html,/site-update\.js\?v=1/);
 assert.match(html,/playtest-ux\.css\?v=4/);
 assert.match(manifest,/site\.github\.build_revision/);
 assert.match(manifest,/permalink: \/site-version\.json/);
});
test('mudança de recursos detecta aba desatualizada e abre diálogo de atualização',async()=>{
 const x=setup(),watch=x.window.ARQUIVO_SITE_UPDATE;
 assert.equal(await watch.checkNow(),false);
 assert.equal(x.appended.length,0);
 x.deploy(['script:arquivo-app.js?v=2','link:ficha-visual.css?v=1'],'build-b');
 assert.equal(await watch.checkNow(),true);
 assert.equal(watch.updateAvailable,true);
 const overlay=x.appended[0];
 assert.match(overlay.innerHTML,/ATUALIZE A PÁGINA/);
 assert.match(overlay.innerHTML,/RECARREGAR AGORA/);
 assert.match(overlay.innerHTML,/MAIS TARDE/);
 assert.equal(overlay.attrs['aria-modal'],undefined);
 x.buttons['[data-ae-update-later]'].event.click();
 assert.equal(overlay.isConnected,false);
 assert.ok(x.appended.some(n=>n.className==='ae-site-update-badge'));
});
test('mudança no manifesto avisa mesmo quando os recursos continuam iguais',async()=>{
 const x=setup();
 assert.equal(await x.window.ARQUIVO_SITE_UPDATE.checkNow(),false);
 x.deploy(['script:arquivo-app.js?v=1','link:ficha-visual.css?v=1'],'build-c');
 assert.equal(await x.window.ARQUIVO_SITE_UPDATE.checkNow(),true);
 assert.ok(x.appended.some(node=>node.className==='ae-site-update-overlay'));
});
test('sem alteração de build não há pop-up nem recarregamento compulsório',async()=>{
 const x=setup(),watch=x.window.ARQUIVO_SITE_UPDATE;
 assert.equal(await watch.checkNow(),false);
 assert.equal(await watch.checkNow(),false);
 assert.equal(watch.updateAvailable,false);
 assert.equal(x.appended.length,0);
});
