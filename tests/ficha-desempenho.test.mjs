import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('alteração online de vínculo usa uma única RPC e recebe a ficha confirmada',async()=>{
 const window={ARQUIVO_ONLINE_CONFIG:{}};
 vm.runInNewContext(read('online.js'),{window});
 const api=window.ARQUIVO_SYNC;
 const calls=[];
 api.state.enabled=true;
 api.state.revision=1;
 api.state.pending=Promise.resolve();
 api.state.client={rpc:async(name,args)=>{
  calls.push({name,args});
  return {data:{revision:6,sheet:{id:'f1',linkedKeyIds:['player-a'],ownerKeyId:'player-a',locked:true}},error:null};
 }};
 const result=await api.sheetLink('f1','remove','player-b');
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'ae_sheet_link');
 assert.equal(calls[0].args.p_action,'remove');
 assert.equal(calls[0].args.p_target_key,'player-b');
 assert.equal(result.sheet.id,'f1');
 assert.equal(api.state.revision,6);
});

test('resposta de vínculos não é bloqueada por segunda atualização completa',()=>{
 const app=read('arquivo-app.js');
 const begin=app.indexOf('async function changeSheetLink(action)');
 const end=app.indexOf('function sheetPage()',begin);
 assert.ok(begin>=0&&end>begin);
 const section=app.slice(begin,end);
 assert.doesNotMatch(section,/refresh\(true\)/);
 assert.match(section,/const result=await sync\.sheetLink\(id,action,target\)/);
 assert.match(section,/db\.sheets\[index\]=changed/);
 assert.match(section,/DATASTORE\.save\(db\)/);
 assert.match(section,/SALVANDO\.\.\./);
 assert.match(section,/sheetLinkBusy=true/);
 assert.match(section,/sheetLinkBusy=false/);
});

test('modal de jogadores aparece antes da consulta remota ao diretório',()=>{
 const app=read('arquivo-app.js');
 const start=app.indexOf('function sheetLinks(){');
 const end=app.indexOf('async function changeSheetLink(action)',start);
 assert.ok(start>=0&&end>start);
 const code=app.slice(start,end);
 const modal=code.indexOf("modal('JOGADORES VINCULADOS'");
 const lookup=code.indexOf('sync.playerDirectory().then(');
 assert.ok(modal>=0&&lookup>modal);
 assert.doesNotMatch(code,/await sync\.playerDirectory/);
 assert.match(code,/sheetLinkDirectoryCache\.account!==session/);
});

test('catálogo oficial da ficha contém somente as 17 condições do Livro 1',()=>{
 const app=read('arquivo-app.js');
 const start=app.indexOf('const CONDITIONS_CATALOG='),end=app.indexOf(';',start);
 const section=app.slice(start,end);
 for(const tag of ['Fragilizado','Atordoado','Insensível','Suprimido','Dominado','Derrubado'])
  assert.match(section,new RegExp(tag));
 for(const tag of ['Queimando','Pressionado','Eletrificado','Desmaiado','Morto'])
  assert.doesNotMatch(section,new RegExp(tag));
 assert.match(app,/Consulte o capítulo Condições & Pavor na Biblioteca/);
 assert.doesNotMatch(app,/ABILITY_HEX\.test/);
});
