import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function fixture(){
 const listeners={},calls={roll:[],action:[]},state={rendered:0,errors:[]};
 const ab={name:'Golpe Genérico',cost:3,libraryType:'tecnica',description:'Ao acertar um golpe.\n\n> Dano: +2d8'};
 const skills=Object.fromEntries(['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão','Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia','Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação'].map(n=>[n,4]));
 const s={id:'ficha-generica',name:'Personagem',level:3,race:'Fullbringer',className:'Artilheiro',
  abilities:[ab],groups:{Corpo:6,Mente:6,Espírito:6},skills,resources:{vida:{current:20,max:30},estabilidade:{current:18,max:18},alma:{current:16,max:24}},
  combat:{scene:1,round:1,phase:'preparacao',mainUsed:false,reactionUsed:false},exposures:{},abilityRuntime:{billing:{}}};
 const fields={},result={innerHTML:''};
 const document={
  addEventListener(name,fn){listeners[name]=fn},
  querySelector(selector){if(selector.includes('ae-cbb-result'))return result;return null}
 };
 const sync={state:{enabled:true,identity:{id:'my-account'}},
  async cbbRoll(payload){calls.roll.push(payload);return {id:101,rt:12,ra:8,rb:4,dice:[{sides:6,value:4},{sides:8,value:8}],special:'',attack_ra:0,colors:['#7c61ef','#5ad8da']}},
  async cbbAction(payload){calls.action.push(payload);return {ok:true,revision:3,
   resources:{...s.resources,alma:{current:13,max:24}},combat:{...s.combat,mainUsed:true},exposures:s.exposures,abilityRuntime:s.abilityRuntime,
   info:{chargedCost:3}}}
 };
 const api={db:{sheets:[s]},currentSheet:s.id,canEditSheet:()=>true,master:()=>true,
  esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  render(){state.rendered++},toast(...args){state.errors.push(args)}};
 const window={ARQUIVO_INTERNAL:api,ARQUIVO_SYNC:sync};
 const ctx={window,document};
 vm.runInNewContext(read('cbb-engine.js'),ctx);
 vm.runInNewContext(read('cbb-interativo.js'),ctx);
 return {window,s,calls,state,listeners,result,fields};
}

test('motor geral respeita as 18 perícias e lê dano e cura sem fichas específicas',()=>{
 const x=fixture(),e=x.window.ARQUIVO_CBB_ENGINE;
 assert.equal(e.groupOf('Destreza'),'Corpo');
 assert.equal(e.groupOf('Manipulação'),'Espírito');
 assert.equal(e.groupOf('Lábia'),'Mente');
 assert.equal(e.groupOf('Talento'),null);
 assert.deepEqual(JSON.parse(JSON.stringify(e.abilityPool(x.s.abilities[0]))),{kind:'dano',count:2,faces:8});
 assert.deepEqual(JSON.parse(JSON.stringify(e.abilityPool({description:'Utilize a habilidade para restaurar 1d6 de Vida.'}))),{kind:'recuperacao',count:1,faces:6});
 assert.equal(e.abilityPool({description:'Aplique Confuso até o próximo Desfecho.'}),null);
 for(const name of ['cbb-engine.js','cbb-interativo.js']){
  assert.doesNotMatch(read(name),/arquivo-shinji|arquivo-tsukishima|arquivo-komamura|Shinji Hirako|Ichigo Kurosaki/);
  assert.doesNotMatch(read(name),/setInterval\(/);
 }
});

test('Teste-Clash aplica RA ou RT e prioridade de críticos e iniciador',()=>{
 const c=fixture().window.ARQUIVO_CBB_ENGINE.clash;
 assert.equal(c({ra:6,rt:14},8,false,'oponente',false).win,false);
 assert.equal(c({ra:6,rt:14},8,false,'oponente',true).win,true);
 assert.equal(c({ra:8},8,false,'oponente',false).win,false);
 assert.equal(c({ra:8},8,false,'voce',false).win,true);
 assert.equal(c({ra:6,special:'CRÍTICO MÁXIMO'},16,false,'oponente',false).win,true);
 assert.equal(c({ra:1,special:'FALHA CRÍTICA'},1,false,'voce',false).win,false);
});

test('painel inclui Pressão, Desfecho, comprometimentos, dados e recursos',()=>{
 const x=fixture(),ui=x.window.ARQUIVO_CBB_UI;
 const html=ui.render(x.s,{canEdit:true,master:true});
 for(const label of ['ROLAR TESTE','ROLAR DADOS','REGISTRAR ACERTO SOFRIDO','COMPROMETER','CONTENÇÃO','APLICAR À MINHA FICHA','PRÓXIMA FASE','NOVA CENA'])
  assert.ok(html.includes(label),label);
 const controls=ui.abilityActions(x.s.abilities[0],0,{canEdit:true,master:false});
 assert.match(controls,/data-cbb-command="ability"/);
 assert.match(controls,/data-cbb-command="abilityPool"/);
 assert.equal(ui.abilityActions(x.s.abilities[0],0,{canEdit:false}), '');
 assert.deepEqual(Object.keys(x.listeners),['click','change']);
});

test('ativação genérica cobra ALMA uma vez sem enviar instantâneo completo do banco',async()=>{
 const x=fixture();
 const button={dataset:{cbbCommand:'ability',cbbIndex:'0'},disabled:false,closest(){return null},setAttribute(){}};
 await x.listeners.click({target:{closest(){return button}},preventDefault(){},stopPropagation(){}});
 assert.equal(x.calls.action.length,1);
 assert.equal(x.calls.action[0].p_action,'ability');
 assert.equal(x.calls.action[0].p_ability_index,0);
 assert.equal(x.calls.action[0].p_sheet_id,x.s.id);
 assert.equal(x.s.resources.alma.current,13);
 assert.equal(x.calls.roll.length,0);
 assert.equal(x.state.rendered,1);
});

test('teste de perícia envia um pedido ao servidor e mostra RT RA RB',async()=>{
 const x=fixture();
 const config={skill:'Vigor',context:'ataque',groupSteps:'0',skillSteps:'1',bonusCount:'0',bonusFaces:'0',fear:'',hollow:'',dt:'10',opponentRa:'',initiator:'voce'};
 const fields=Object.fromEntries(Object.entries(config).map(([key,value])=>[key,{value,checked:false}]));
 const root={querySelector(q){const match=q.match(/data-cbb-field="([^"]+)"/);return fields[match?.[1]]||null}};
 const button={dataset:{cbbCommand:'skill'},disabled:false,closest(){return root},setAttribute(){}};
 await x.listeners.click({target:{closest(){return button}},preventDefault(){},stopPropagation(){}});
 assert.equal(x.calls.roll.length,1);
 const payload=x.calls.roll[0];
 assert.equal(payload.p_skill,'Vigor');
 assert.equal(payload.p_context,'ataque');
 assert.equal(payload.p_skill_steps,1);
 assert.equal(x.calls.action.length,0);
 assert.equal(x.s.resources.alma.current,16);
 assert.match(x.result.innerHTML,/RT/);
 assert.match(x.result.innerHTML,/DT 10: sucesso/);
});

test('scripts e duas RPCs universais estão ligados sem reativar código por personagem',()=>{
 const html=read('index.html'),online=read('online.js'),visual=read('ficha-visual.js');
 for(const file of ['cbb-engine.js?v=1','cbb-interativo.js?v=6','cbb-interativo.css?v=3'])
  assert.ok(html.includes(file),file);
 assert.ok(visual.includes("mesa:'Mesa'"));
 assert.match(visual,/ARQUIVO_CBB_UI\?\.render/);
 assert.match(visual,/ARQUIVO_CBB_UI\?\.abilityActions/);
 assert.match(online,/async function cbbRoll\(/);
 assert.match(online,/async function cbbAction\(/);
 assert.match(online,/await state\.pending\.catch/);
 const rollSql=read('sql/ae_cbb_universal_roll.sql');
 const actSql=read('sql/ae_cbb_universal_action.sql');
 assert.match(rollSql,/public\.ae_avaliar_dados\(result_dice\)/);
 assert.match(rollSql,/public\.ae_sheet_linked/);
 assert.match(actSql,/public\.ae_ability_cost_preview/);
 assert.match(actSql,/public\.ae_ability_cost_commit/);
 assert.match(actSql,/public\.ae_sheet_linked/);
 assert.doesNotMatch(actSql,/arquivo-shinji|arquivo-tsukishima|arquivo-komamura/);
});


test('proteção adicional usa rolagem verificada separada e preserva resistência natural',async()=>{
 const x=fixture();
 let nextId=101;
 x.window.ARQUIVO_SYNC.cbbRoll=async payload=>{
  x.calls.roll.push(payload);
  if(payload.p_kind==='resistencia')return {id:nextId++,rt:4,ra:4,rb:4,dice:[{sides:6,value:4}],special:''};
  if(payload.p_kind==='protecao')return {id:nextId++,rt:5,ra:5,rb:5,dice:[{sides:8,value:5}],special:''};
  throw Error('Tipo não esperado');
 };
 const settings={poolMode:'resistencia',poolResource:'vida',poolCount:'0',poolFaces:'8',flat:'0',manualRa:'0',resistSteps:'0'};
 const fields=Object.fromEntries(Object.entries(settings).map(([k,value])=>[k,{value,checked:false}]));
 const root={querySelector(q){const match=q.match(/data-cbb-field="([^"]+)"/);return fields[match?.[1]]||null}};
 const click=async()=>{
  const b={dataset:{cbbCommand:'pool'},disabled:false,closest(){return root},setAttribute(){}};
  await x.listeners.click({target:{closest(){return b}},preventDefault(){},stopPropagation(){}});
 };
 await click();
 assert.equal(x.calls.roll.length,1);
 assert.equal(x.calls.roll[0].p_kind,'resistencia');
 assert.match(x.result.innerHTML,/REGISTRO #101/);
 fields.poolCount.value='1';
 await click();
 assert.equal(x.calls.roll.length,2);
 assert.equal(x.calls.roll[1].p_kind,'protecao');
 assert.equal(x.calls.roll[1].p_pool[0].faces,8);
 assert.match(x.result.innerHTML,/REGISTRO #101 \+ #102/);
 assert.match(x.result.innerHTML,/RT[\s\S]*9/);
 await click();
 assert.equal(x.calls.roll.length,2,'A mesma proteção deve ser reaproveitada');
 fields.poolCount.value='0';
 await click();
 assert.equal(x.calls.roll.length,2,'Retirar a proteção não deve rolar novamente');
 assert.match(x.result.innerHTML,/RT[\s\S]*4/);
});


test('fixar habilidade executa um único toggle remoto e atualiza a ficha',async()=>{
 const x=fixture();
 x.window.ARQUIVO_SYNC.cbbAction=async payload=>{
  x.calls.action.push(payload);
  return {ok:true,revision:11,pinnedAbilities:['tecnica:Golpe Genérico'],
   resources:x.s.resources,combat:x.s.combat,exposures:x.s.exposures,abilityRuntime:x.s.abilityRuntime,
   info:{pin:'tecnica:Golpe Genérico',active:true}};
 };
 const b={dataset:{cbbCommand:'pin',cbbIndex:'0'},disabled:false,closest(){return null},setAttribute(){}};
 await x.listeners.click({target:{closest(){return b}},preventDefault(){},stopPropagation(){}});
 assert.equal(x.calls.action.length,1);
 assert.equal(x.calls.action[0].p_action,'pin');
 assert.equal(x.calls.action[0].p_ability_index,0);
 assert.deepEqual(x.s.pinnedAbilities,['tecnica:Golpe Genérico']);
 assert.equal(x.calls.roll.length,0);
 assert.equal(x.state.rendered,1);
});

test('resultado apresenta RT grande, dados coloridos e bloqueia CSS de cores inválidas',async()=>{
 const x=fixture();
 const values={skill:'Vigor',context:'ataque',groupSteps:'0',skillSteps:'0',
  bonusCount:'0',bonusFaces:'0',fear:'',hollow:'',dt:'10',opponentRa:''};
 const fields=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value,checked:false}]));
 const root={querySelector(q){const m=q.match(/data-cbb-field="([^"]+)"/);return fields[m?.[1]]||null}};
 const b={dataset:{cbbCommand:'skill'},disabled:false,closest(){return root},setAttribute(){}};
 await x.listeners.click({target:{closest(){return b}},preventDefault(){},stopPropagation(){}});
 assert.match(x.result.innerHTML,/ae-cbb-roll-layout/);
 assert.match(x.result.innerHTML,/ae-cbb-total/);
 assert.match(x.result.innerHTML,/--cbb-die-color:#7c61ef/);
 assert.match(x.result.innerHTML,/--cbb-die-color:#5ad8da/);
 x.window.ARQUIVO_SYNC.cbbRoll=async()=>{
  return {id:102,rt:8,ra:5,rb:3,dice:[{sides:6,value:3},{sides:8,value:5}],
   special:'',colors:['red;--evil:1','#5ad8da']};
 };
 await x.listeners.click({target:{closest(){return b}},preventDefault(){},stopPropagation(){}});
 assert.doesNotMatch(x.result.innerHTML,/--evil/);
 assert.match(x.result.innerHTML,/--cbb-die-color:var\(--sheet-dice-group/);
});
