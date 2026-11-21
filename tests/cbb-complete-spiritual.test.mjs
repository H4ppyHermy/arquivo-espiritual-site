import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const groups=['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação'];
function setup(){
 const win={};
 vm.runInNewContext(read('cbb-engine.js'),{window:win});
 return win.ARQUIVO_CBB_ENGINE;
}
const sheet=(face=8)=>({
 id:'personagem',abilities:[],conditions:[],
 groups:{Corpo:8,Mente:8,Espírito:8},
 skills:{Liberação:face,Vigor:8},
 exposures:{defensiva:0,ofensiva:0,ritmica:0,espiritual:2},
 combat:{round:1,scene:1,phase:'duelo',mainUsed:false,reactionUsed:false,cbb:{}},
 resources:{alma:{current:5,max:10}}
});

test('Exposição Espiritual reduz dados de todas as perícias de Espírito',()=>{
 const engine=setup(),s=sheet(8);
 for(const skill of groups){
  s.skills[skill]=8;
  const p=engine.previewSkill(s,skill,'geral');
  assert.equal(p.automaticSkill,-2,skill);
  assert.equal(p.skillDie,4,skill);
  assert.match(JSON.stringify(p.reasons),/Exposição Espiritual/);
 }
 assert.equal(engine.previewSkill(s,'Vigor','geral').automaticSkill,0);
});
test('perícia d4 transfere a penalidade espiritual para seu grupo sem cair abaixo de d4',()=>{
 const engine=setup(),s=sheet(4);s.exposures.espiritual=3;
 const p=engine.previewSkill(s,'Liberação','ataque');
 assert.equal(p.automaticGroup,-3);
 assert.equal(p.groupDie,4);
 assert.equal(p.skillDie,4);
 assert.ok(p.reasons.some(r=>r.name==='Exposição Espiritual'&&r.target==='grupo'));
});
test('ofensiva e espiritual acumulam separadamente, mas o limite mínimo do dado permanece',()=>{
 const engine=setup(),s=sheet(10);s.exposures.ofensiva=1;s.exposures.espiritual=2;
 const p=engine.previewSkill(s,'Liberação','ataque');
 assert.equal(p.automaticSkill,-3);
 assert.equal(p.skillDie,4);
 assert.ok(p.reasons.some(r=>r.name==='Exposição Espiritual'));
 assert.ok(p.reasons.some(r=>r.name==='Exposição Ofensiva'));
});
test('o SQL autenticado exige principal e reação disponíveis e consome cada bônus RT uma única vez',()=>{
 const sql=read('sql/ae_cbb_complete_spiritual_exposure.sql');
 assert.match(sql,/p_action='complete'/);
 assert.match(sql,/completePending.*true/);
 assert.match(sql,/mainUsed',true,'reactionUsed',true/);
 assert.match(sql,/completeAttackId/);
 assert.match(sql,/completeDamageUsed/);
 assert.match(sql,/complete_attack=true/);
 assert.match(sql,/attack_ra=prev\.total;complete_damage=true/);
 assert.match(sql,/completeDamageUsed'\)::boolean,false/);
 assert.match(sql,/prev\.label LIKE '% · COMPLETA'/);
 assert.match(sql,/p_sheet_id AND account_id=ac_id/);
 assert.match(sql,/IF complete_attack OR complete_damage THEN/);
 assert.match(sql,/completeScene/);
 assert.match(sql,/completeRound/);
 assert.doesNotMatch(sql,/p_attack_id\s*=\s*p_manual_ra/);
});
test('comprometimento espiritual restaura até duas ALMA, respeitando teto e sem recuperação em ajustes manuais',()=>{
 const sql=read('sql/ae_cbb_complete_spiritual_exposure.sql');
 assert.match(sql,/p_exposure='espiritual'/);
 assert.match(sql,/max_resource-current_alma/);
 assert.match(sql,/least\(max_resource,current_alma\+2\)/);
 assert.match(sql,/IF current_alma>=max_resource THEN RAISE EXCEPTION/);
 assert.match(sql,/exposure_level=exposure_level\+1/);
 assert.match(sql,/p_exposure NOT IN \('defensiva','ofensiva','ritmica','espiritual'\)/);
 assert.match(sql,/IF grp='Espírito' THEN/);
 assert.match(sql,/IF sdie=4 THEN gstep=gstep-expo/);
});
test('Mesa tem controles, estados e resumo compatíveis em qualquer ficha',()=>{
 const ui=read('cbb-interativo.js');
 assert.match(ui,/data-cbb-command="complete"/);
 assert.match(ui,/AÇÃO COMPLETA · RT/);
 assert.match(ui,/Exposição Espiritual/);
 assert.match(ui,/Somar '\+\(last\?\.complete\?'RT':'RA'\)/);
 assert.match(ui,/result\.complete_attack/);
 assert.match(ui,/result\.complete_damage/);
 assert.match(ui,/lastAttacks\.delete\(s\.id\)/);
});
