import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const html=read('index.html');
const app=read('arquivo-app.js');

test('biblioteca tem uma unica fonte de dados',()=>{
 const sandbox={window:{}};
 vm.runInNewContext(read('dados.js'),sandbox);
 assert.ok(Array.isArray(sandbox.window.ARQUIVO_PUBLICADO.rules));
 assert.ok(sandbox.window.ARQUIVO_PUBLICADO.rules.length>5);
 assert.match(app,/keys:\[\],rules:\[\],sheets:\[/);
 assert.match(app,/clone\(DEFAULT\.sheets\[0\]\)/);
});

test('recursos estaticos referenciados existem',()=>{
 const assets=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)]
  .map(match=>match[1].split('?')[0])
  .filter(path=>!/^https?:\/\//.test(path));
 for(const asset of assets){
  assert.ok(fs.existsSync(new URL(asset,root)),'Recurso ausente: '+asset);
 }
});

test('YouTube so carrega ao selecionar essa fonte',()=>{
 assert.doesNotMatch(html,/src="https:\/\/www\.youtube\.com\/iframe_api"/);
 assert.match(app,/function ensureYoutubeApi\(\)/);
 assert.match(app,/if\(kind==='youtube'\)\{ensureYoutubeApi\(\)/);
});
