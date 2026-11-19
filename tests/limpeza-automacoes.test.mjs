import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const at=filename=>new URL('../'+filename,import.meta.url);
const read=filename=>fs.readFileSync(at(filename),'utf8');
const app=read('arquivo-app.js');
const sections=read('biblioteca-secoes.js');
const client=read('online.js');

test('Registro Técnico não repete danos já descritos na publicação',()=>{
 assert.doesNotMatch(sections,/function diceReference\(/);
 assert.doesNotMatch(sections,/diceReference\(post\)/);
 assert.match(sections,/function resourceBars\(/);
 assert.match(sections,/RECURSOS VISUAIS/);
 assert.match(sections,/visibleTags\(post\)/);
});
test('scripts extintos de combate realmente foram excluídos',()=>{
 for(const name of ['mecanicas-ficha.js','habilidades-3.0.js'])
  assert.equal(fs.existsSync(at(name)),false,name);
 const html=read('index.html');
 assert.doesNotMatch(html,/src="(?:mecanicas-ficha|habilidades-3\.0)\.js/);
});
test('editor de personagem mantém registros e não oferece automação antiga',()=>{
 assert.match(app,/<h3>HABILIDADES<\/h3>/);
 assert.match(app,/data-ability="\$\{i\}:description"/);
 assert.match(app,/Registros manuais: descreva o efeito/);
 assert.match(app,/function saveSheetForm\(/);
 assert.match(app,/function newSheet\(/);
 assert.doesNotMatch(app,/data-ability="\$\{i\}:testMode"/);
 assert.doesNotMatch(app,/data-ability="\$\{i\}:testSkill"/);
 assert.doesNotMatch(app,/data-ability-die/);
 assert.doesNotMatch(app,/customDiceEditor\(/);
 assert.doesNotMatch(app,/window\.ARQUIVO_V3/);
});
test('descanso e habilidades não executam mecânicas ou consomem inventário',()=>{
 assert.doesNotMatch(app,/function (?:useAbility|restDialog|rest|reconcileRecoveryStates|stepDown|changeResource|resourceBoundary)\(/);
 assert.doesNotMatch(app,/case'(?:useAbility|restShort|restFull|resourceMin|resourceMax|abilityRoll)'/);
 assert.doesNotMatch(app,/inventoryItemCanUse/);
 assert.doesNotMatch(app,/inventoryItemAbilityLabel/);
 assert.doesNotMatch(app,/data-action="resource:\$\{k\}:/);
 assert.match(app,/function resourceSetCurrent\(/);
 assert.match(app,/function editResource\(/);
 assert.match(app,/case'editResource'/);
});
test('rolagem livre continua disponível sem rolagens vinculadas às fichas',()=>{
 assert.match(app,/function freeRoll\(/);
 assert.match(app,/function avaliarResultadoDados\(/);
 assert.match(app,/function historyHtml\(/);
 assert.doesNotMatch(app,/function (?:skillRoll|rerollVerifiedSkill|configureVerifiedSkill|rollConfiguredSkill|fichaLocalTest)\(/);
 for(const name of ['ae_use_ability','ae_roll_skill_colored','ae_reroll_skill','ae_configure_skill_roll'])
  assert.doesNotMatch(client,new RegExp(name));
 assert.match(client,/async function rollFree\(/);
 assert.match(client,/async function rollHistory\(/);
});
test('CSS não mantém o mecanismo antigo de combate e habilidades',()=>{
 const css=read('arquivo-recursos.css');
 assert.doesNotMatch(css,/\.ae3-(?:ability|progress|shinji|book|automation)/);
 assert.doesNotMatch(css,/\.ae32-(?:impact|halo|spark)/);
 assert.match(css,/\.ae-home/);
 assert.match(read('biblioteca-secoes.css'),/\.ae-wh-resource/);
});
