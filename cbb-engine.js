/* CBB — regras universais de interface; sem condicionais por ficha. */
(function(global){
 'use strict';
 const GROUPS=Object.freeze({
  Corpo:['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão'],
  Mente:['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia'],
  Espírito:['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']
 });
 const DIE_FACES=Object.freeze([4,6,8,10,12,14,16,18,20]);
 const groupOf=skill=>Object.keys(GROUPS).find(group=>GROUPS[group].includes(skill))||null;
 const positiveInt=(n,min,max)=>Number.isInteger(Number(n))&&Number(n)>=min&&Number(n)<=max;
 const dieFormula=(text,type='dano')=>{
  const value=String(text||'');
  const search=type==='recuperacao'
   ?/(?:restaurar|recuperar|restaura|recupere)\s+\+?(\d{1,2})\s*d\s*(4|6|8|10|12|14|16|18|20)\b/i
   :/(?:^|\n)\s*>?\s*dano\s*:\s*\+?(\d{1,2})\s*d\s*(4|6|8|10|12|14|16|18|20)\b/i;
  const match=value.match(search);
  return match?{count:Number(match[1]),faces:Number(match[2])}:null;
 };
 const isItemDamageActive=(sheet,item)=>{
  if(!item||item.equipped===false||!Number.isInteger(Number(item.damageBonus))||
      Number(item.damageBonus)===0)return false;
  if(!item.linkedAbility)return true;
  const abilities=Array.isArray(sheet?.abilities)?sheet.abilities:[];
  const index=abilities.findIndex(ab=>String(ab?.abilityId||ab?.automation?.id||ab?.name)===String(item.linkedAbility));
  if(index<0)return false;
  const ab=abilities[index],key=String(ab.abilityId||ab.automation?.id||'legacy:'+index);
  const scene=Number(sheet?.combat?.scene||1);
  const entry=sheet?.abilityRuntime?.billing?.[key];
  return ab.costConfig?.mode==='activation'&&entry?.active===true&&Number(entry.scene)===scene;
 };
 const activeDamageEffects=sheet=>{
  const items=Array.isArray(sheet?.inventory?.items)?sheet.inventory.items:[];
  return items.filter(item=>isItemDamageActive(sheet,item))
   .map(item=>({name:String(item.name||'Equipamento'),amount:Number(item.damageBonus)}));
 };
 const activeDamageBonus=sheet=>activeDamageEffects(sheet).reduce((n,item)=>n+item.amount,0);
 const abilityPhase=ab=>{
  const simplify=str=>String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const labels={preparacao:'Preparação',distancia:'Distância',duelo:'Duelo',desfecho:'Desfecho'};
  const explicit=simplify(ab?.costConfig?.phase||ab?.phase);
  if(labels[explicit])return labels[explicit];
  const prose=simplify(String(ab?.usage||'')+' '+String(ab?.description||''));
  const match=prose.match(/\b(?:fase(?:\s+(?:de|da|do))?\s*:\s*|fase(?:\s+(?:de|da|do))?\s+|ataque\s+de\s+)(preparacao|distancia|duelo|desfecho)\b/);
  return match?labels[match[1]]:'Livre';
 };
 const abilityPool=ab=>{
  const damage=dieFormula(ab?.description,'dano');
  if(damage)return {kind:'dano',...damage};
  const recovery=dieFormula(ab?.description,'recuperacao');
  if(recovery)return {kind:'recuperacao',...recovery};
  return null;
 };
 // Prévia das regras de passo da Mesa; a rolagem final continua sendo calculada no servidor.
 const normalizedConditions=sheet=>new Set((Array.isArray(sheet?.conditions)?sheet.conditions:[])
  .filter(x=>typeof x==='string').map(x=>x.trim().toLocaleLowerCase('pt-BR')));
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function stepDie(sheet,base,delta){
  const idx=DIE_FACES.indexOf(Number(base)),special=(sheet?.abilities||[]).some(a=>a?.name==='Realismo Animista');
  if(idx<0)return 4;
  const max=Math.max(idx,special?5:4);
  return DIE_FACES[clamp(idx+Number(delta||0),0,max)];
 }
 function previewSkill(sheet,skill,context='geral',manualGroup=0,manualSkill=0,flags={}){
  const group=groupOf(skill),baseGroup=Number(sheet?.groups?.[group]||4),baseSkill=Number(sheet?.skills?.[skill]||4);
  const conditions=normalizedConditions(sheet),reasons=[];
  let automaticGroup=0,automaticSkill=0,conditionalSkill=0;
  const add=(name,steps)=>{automaticSkill+=steps;reasons.push({name,steps,target:'pericia'})};
  if(conditions.has('confuso')&&group==='Mente')add('Confuso',-1);
  if(conditions.has('suprimido')&&group==='Espírito')add('Suprimido',-1);
  if(conditions.has('exausto')&&group==='Corpo')add('Exausto',-1);
  if(conditions.has('atordoado'))add('Atordoado',-1);
  if(conditions.has('desorientado')&&['ataque','defesa'].includes(context))add('Desorientado',-1);
  if(conditions.has('derrubado')&&context==='defesa')add('Derrubado',-1);
  const ex=sheet?.exposures||{};
  let exposure=0;
  if(context==='ataque')exposure=clamp(Number(ex.ofensiva)||0,0,3);
  if(context==='defesa'){
   const level=clamp(Number(ex.defensiva)||0,0,3);
   exposure=level===3?2:level===2?1:level===1&&!flags.reaction?1:0;
  }
  if(exposure){
   if(baseSkill===4){
    automaticGroup-=exposure;
    reasons.push({name:context==='ataque'?'Exposição Ofensiva':'Exposição Defensiva',
     steps:-exposure,target:'grupo'});
   }else{
    add(context==='ataque'?'Exposição Ofensiva':'Exposição Defensiva',-exposure);
   }
  }
  // Exposição Espiritual compromete todos os testes do grupo Espírito.
  const espiritual=group==='Espírito'?clamp(Number(ex.espiritual)||0,0,3):0;
  if(espiritual){
   if(baseSkill===4){
    automaticGroup-=espiritual;
    reasons.push({name:'Exposição Espiritual',steps:-espiritual,target:'grupo'});
   }else add('Exposição Espiritual',-espiritual);
  }
  if(flags.vision){
   if(conditions.has('cego')){conditionalSkill-=2;reasons.push({name:'Cego · visão',steps:-2,target:'pericia'})}
   if(conditions.has('ofuscado')){conditionalSkill--;reasons.push({name:'Ofuscado · visão',steps:-1,target:'pericia'})}
  }
  if(flags.sense&&conditions.has('insensível')){
   conditionalSkill--;reasons.push({name:'Insensível · sentido',steps:-1,target:'pericia'});
  }
  if(flags.otherTarget&&context==='ataque'&&conditions.has('provocado')){
   conditionalSkill--;reasons.push({name:'Provocado · outro alvo',steps:-1,target:'pericia'});
  }
  const manualG=clamp(Number(manualGroup)||0,-5,5),manualS=clamp(Number(manualSkill)||0,-5,5);
  // Modificadores condicionais são enviados junto dos passos manuais, sem duplicar
  // os modificadores automáticos já aplicados no RPC.
  const submittedSkill=clamp(manualS+conditionalSkill,-5,5);
  return {
   group,skill,baseGroup,baseSkill,groupDie:stepDie(sheet,baseGroup,automaticGroup+manualG),
   skillDie:stepDie(sheet,baseSkill,automaticSkill+submittedSkill),
   automaticGroup,automaticSkill,manualGroup:manualG,manualSkill:manualS,
   conditionalSkill,submittedSkill,reasons,
   conditions,hasFear:conditions.has('amedrontado'),
   reactionBlocked:conditions.has('atordoado')&&context==='defesa',
   visionApplicable:conditions.has('cego')||conditions.has('ofuscado'),
   senseApplicable:conditions.has('insensível'),
   otherTargetApplicable:conditions.has('provocado')&&context==='ataque'
  };
 }
 function clash(own,opponent,opponentCritical=false,initiator='oponente',reaction=false){
  const self=Number(reaction?own?.rt:own?.ra);
  const other=Number(opponent);
  if(!Number.isFinite(self)||!Number.isFinite(other)||other<0)return null;
  const ownCrit=own?.special==='CRÍTICO MÁXIMO',ownFail=own?.special==='FALHA CRÍTICA';
  if(ownFail)return {win:false,reason:'Falha Crítica'};
  if(ownCrit!==Boolean(opponentCritical))return {win:ownCrit,reason:'Prioridade do Crítico Máximo'};
  if(self===other)return {win:initiator==='voce',reason:'Empate: vence quem iniciou a ação'};
  return {win:self>other,reason:'Maior resultado'};
 }
 function rollSummary(result){
  const die=(result?.dice||[]).map(d=>{
   const actual=Number(d?.effective??d?.value);
   const face=Number(d?.sides);
   return 'd'+face+': '+String(d.value)+(d.canceled?' (anulado)':d.criticalApplied?' → '+actual+' (crítico)':d.maximized?' → '+actual:'');
  });
  return {dice:die,rt:Number(result?.rt??result?.total??0),ra:Number(result?.ra??0),rb:Number(result?.rb??0),
   special:String(result?.special||'')};
 }
 global.ARQUIVO_CBB_ENGINE=Object.freeze({GROUPS,DIE_FACES,groupOf,positiveInt,dieFormula,abilityPool,isItemDamageActive,activeDamageEffects,activeDamageBonus,abilityPhase,clash,rollSummary,previewSkill,stepDie,normalizedConditions});
})(window);