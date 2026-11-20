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
 const abilityPool=ab=>{
  const damage=dieFormula(ab?.description,'dano');
  if(damage)return {kind:'dano',...damage};
  const recovery=dieFormula(ab?.description,'recuperacao');
  if(recovery)return {kind:'recuperacao',...recovery};
  return null;
 };
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
 global.ARQUIVO_CBB_ENGINE=Object.freeze({GROUPS,DIE_FACES,groupOf,positiveInt,dieFormula,abilityPool,clash,rollSummary});
})(window);