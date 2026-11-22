import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function fixture(){
 const skillNames=['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão',
  'Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia',
  'Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação'];
 const s={
  id:'personagem-1',name:'Personagem',abilities:[],conditions:[],
  resources:{vida:{current:12,max:20},estabilidade:{current:15,max:20},alma:{current:10,max:10}},
  skills:Object.fromEntries(skillNames.map(n=>[n,4])),groups:{Corpo:6,Mente:6,Espírito:6},
  combat:{scene:1,round:2,phase:'duelo'},inventory:{items:[]}
 };
 const calls={sync:[],render:0};
 const listeners={};
 const db={site:{},sheets:[s]};
 const document={
  addEventListener(name,fn){listeners[name]=fn},
  querySelector(){return null},querySelectorAll(){return []}
 };
 const api={
  db,currentSheet:s.id,canEditSheet:()=>true,master:()=>true,render(){calls.render++},
  esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  toast(){}
 };
 const sync={
  state:{enabled:true,identity:{id:'master',kind:'master'}},
  async liveCombatPhase(action,sheetId,phase){
   calls.sync.push({action,sheetId,phase});
   const value=action==='disable'?null:{enabled:true,phase:phase||'duelo',scene:1,round:2,sessionId:'session'};
   return {ok:true,liveCombat:value,combat:s.combat};
  },
  async refresh(){return true}
 };
 const window={ARQUIVO_INTERNAL:api,ARQUIVO_SYNC:sync,addEventListener(){}};
 const context={window,document};
 vm.runInNewContext(read('cbb-engine.js'),context);
 vm.runInNewContext(read('cbb-interativo.js'),context);
 return {s,db,ui:window.ARQUIVO_CBB_UI,window,calls,listeners};
}
test('Mesa organiza seis ações explícitas sem duplicar avanço de fase',()=>{
 const f=fixture(),html=f.ui.render(f.s,{canEdit:true,master:true});
 assert.equal((html.match(/data-cbb-mode="/g)||[]).length,3);
 for(const label of ['TESTE / ATAQUE','DANO','DEFESA','CURA','AÇÕES','RECURSOS'])assert.match(html,new RegExp(label));
 assert.match(html,/data-cbb-field="poolMode"/);
 assert.match(html,/data-cbb-field="manageMode"/);
 assert.match(html,/data-cbb-command="liveEnable"/);
 assert.equal((html.match(/data-cbb-command="phase"/g)||[]).length,1);
 assert.match(html,/AJUSTAR PASSOS DO TESTE/);
 assert.match(html,/SEU TURNO/);
 assert.match(html,/A ficha aplica automaticamente condições e exposições/);
 assert.match(html,/ae-cbb-result" role="status" aria-live="polite"><\/div>/);
});
test('jogadores com fase sincronizada veem a fase mestre sem botão de avanço',()=>{
 const f=fixture();
 f.db.site.liveCombat={enabled:true,phase:'desfecho',round:3,scene:2};
 const player=f.ui.render(f.s,{canEdit:true,master:false});
 assert.match(player,/FASE CONTROLADA PELO MESTRE/);
 assert.match(player,/DESFECHO|Desfecho/);
 assert.doesNotMatch(player,/data-cbb-command="phase"|data-cbb-command="round"|data-cbb-command="liveAdvance"/);
 const master=f.ui.render(f.s,{canEdit:true,master:true});
 for(const command of ['liveAdvance','liveSet','liveDisable'])assert.ok(master.includes('data-cbb-command="'+command+'"'));
 assert.match(master,/data-cbb-field="livePhase"/);
});
test('ativação da fase mestre usa um único comando de backend, sem chamadas por ficha no navegador',async()=>{
 const f=fixture();
 const button={dataset:{cbbCommand:'liveEnable'},disabled:false,
  closest(){return null},setAttribute(){}};
 await f.listeners.click({target:{closest(sel){return sel==='[data-cbb-command]'?button:null}},
  preventDefault(){},stopPropagation(){}});
 assert.equal(f.calls.sync.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls.sync[0])),{action:'enable',sheetId:f.s.id,phase:null});
 assert.equal(f.db.site.liveCombat.enabled,true);
 assert.ok(f.calls.render>=1);
});
test('sessão ao vivo e servidor compartilham a mesma origem de fase, sem timers extras',()=>{
 const online=read('online.js'),live=read('sala-ao-vivo.js'),sql=read('sql/ae_live_cbb_phase.sql');
 assert.match(online,/function liveCombatPhase\(/);
 assert.match(live,/function phasePanel\(/);
 assert.match(live,/phaseEnable:'enable'/);
 assert.match(live,/renderPhasePanel\(\)/);
 assert.match(sql,/public\.ae_is_master\(\)/);
 assert.match(sql,/public\.ae_cbb_action\(v_id,v_rpc\)/);
 assert.match(sql,/current_setting\(''ae\.live_phase_global''/);
 assert.match(sql,/ae_live_join/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.ae_live_cbb_phase/);
 assert.doesNotMatch(live,/setInterval\(.*phase/i);
});
