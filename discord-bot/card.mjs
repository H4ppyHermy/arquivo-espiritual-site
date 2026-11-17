/**
 * Apresentação unificada de rolagens da mesa e do Discord.
 * Embeds suportam cor de destaque; marcadores por dado funcionam no mobile.
 */
const COLORS=Object.freeze({normal:0x8b78ef,critical:0xf2bf56,failure:0xee6677});
const tick=String.fromCharCode(96);
const asText=(value,max=100)=>String(value??"").replace(/[\u0000-\u001f\u007f\r\n<>@]/g," ").trim().slice(0,max);
const markdown=(value,max=100)=>asText(value,max).replace(/([\\`*_~|[\]()])/g,"\\$1");
const safeNumber=value=>Number.isFinite(Number(value))?Number(value):0;

export function classifyHighlightedDice(row){
 const dice=Array.isArray(row?.dice)?row.dice:[];
 const special=String(row?.special||"");
 if(special!=="CRÍTICO"&&special!=="FALHA CRÍTICA")return dice.map(d=>d.canceled===true||Number(d.effective??d.value)===0?"dropped":"normal");
 const frequency=new Map();
 for(const d of dice){
  const value=safeNumber(d.value),effective=d.effective===undefined?value:safeNumber(d.effective);
  if(d.canceled===true||effective<=0)continue;
  frequency.set(value,(frequency.get(value)||0)+1);
 }
 return dice.map(d=>{
  const value=safeNumber(d.value),effective=d.effective===undefined?value:safeNumber(d.effective);
  if(d.canceled===true||effective===0)return "dropped";
  if(special==="CRÍTICO"&&value>=6&&(frequency.get(value)||0)>=2)return "critical";
  if(special==="FALHA CRÍTICA"&&value===1&&(frequency.get(1)||0)>=2)return "failure";
  return "normal";
 });
}
function renderDie(die,marker){
 const val=safeNumber(die.value),faces=safeNumber(die.sides),effective=die.effective===undefined?val:safeNumber(die.effective);
 const token=marker==="critical"?"🟡 **"+val+"**":
  marker==="failure"?"🔴 **"+val+"**":
  marker==="dropped"?"◌ ~~"+val+"~~":"**"+val+"**";
 const changed=effective!==val&&marker!=="dropped"?" → "+effective:"";
 return token+" "+tick+"d"+faces+tick+changed;
}
function diceRows(dice,markers){
 const lines=[];
 for(let i=0;i<Math.min(dice.length,30);i+=4){
  lines.push(dice.slice(i,i+4).map((d,j)=>renderDie(d,markers[i+j])).join("   +   "));
 }
 return lines.join("\n").slice(0,1010)||"—";
}
function rollExpression(label){
 const first=String(label||"").split(" · ")[0].trim();
 return /^[\d+dklh-]{2,90}$/i.test(first)?first:null;
}
export function rollText(row){
 const dice=Array.isArray(row?.dice)?row.dice:[];
 const values=dice.slice(0,30).map(d=>safeNumber(d.value)).join(", ");
 const status=row.special==="CRÍTICO"?" · CRÍTICO":row.special==="FALHA CRÍTICA"?" · FALHA CRÍTICA":"";
 return "🎲 "+asText(row.account_name||"Jogador",60)+" — "+asText(row.label||"Rolagem",80)+
  "\n["+values+"] = "+safeNumber(row.total)+status;
}
export function rollCard(row,{reroll=true}={}){
 const dice=Array.isArray(row?.dice)?row.dice:[];
 const special=String(row?.special||"");
 const markers=classifyHighlightedDice(row);
 const critical=special==="CRÍTICO",failure=special==="FALHA CRÍTICA";
 const color=critical?COLORS.critical:failure?COLORS.failure:COLORS.normal;
 const expression=rollExpression(row.label);
 const character=asText(row.character_name,85);
 const stamp=row.created_at?Date.parse(row.created_at):NaN;
 const embed={
  color,
  author:{name:asText(row.account_name||"Jogador",85)},
  title:critical?"✦ ROLAGEM CRÍTICA":failure?"⚠ FALHA CRÍTICA":"🎲 "+markdown(row.label||"Rolagem",110),
  description:
   "## "+safeNumber(row.total)+
   (critical?"  ·  **RESULTADO DUPLICADO**":failure?"  ·  **FALHA CRÍTICA**":"")+
   (critical||failure?"\n**"+markdown(row.label||"Rolagem",100)+"**":"")+
   (character?"\nPersonagem: **"+markdown(character,80)+"**":""),
  fields:[{name:"DADOS • "+dice.length+" lançado"+(dice.length===1?"":"s"),value:diceRows(dice,markers),inline:false}],
  footer:{text:"BLEACH CBB  •  ARQUIVO ESPIRITUAL"+(row.id?"  •  #"+row.id:"")}
 };
 if(Number.isFinite(stamp))embed.timestamp=new Date(stamp).toISOString();
 if(critical)embed.fields.push({name:"✦ EFEITO",value:"Valores repetidos de **6 ou mais**. O subtotal dos dados foi multiplicado por **2**.",inline:false});
 else if(failure)embed.fields.push({name:"⚠ EFEITO",value:"Dois ou mais resultados **1**. Falha crítica registrada.",inline:false});
 else if(expression)embed.fields.push({name:"EXPRESSÃO",value:tick+expression+tick,inline:false});
 const components=reroll&&row.kind==="discord"&&row.id?[{
  type:1,components:[{type:2,style:1,label:"Re-rolar",emoji:{name:"🎲"},custom_id:"cbb:reroll:"+row.id}]
 }]:[];
 return {embeds:[embed],components,allowed_mentions:{parse:[]}};
}
export function helpCard(){
 return {embeds:[{
  color:COLORS.normal,
  title:"◈ BLEACH CBB  |  COMANDOS DE DADOS",
  description:"**Rolagens verificadas e histórico compartilhado com o Arquivo Espiritual.**",
  fields:[
   {name:"ROLAR DADOS",value:tick+"br 2d6 + 1d4"+tick+"\n"+tick+"br 1d20 + 3"+tick+"\n"+tick+"br 2d6 + 1d4 | Golpe espiritual"+tick,inline:false},
   {name:"CONSULTAR ROLAGENS",value:tick+"bajuda"+tick+" — este guia\n"+tick+"bhistorico"+tick+" — últimas rolagens públicas",inline:false},
   {name:"COMANDOS COM /",value:tick+"/rolar"+tick+" · "+tick+"/historico"+tick+" · "+tick+"/ajuda"+tick,inline:false},
   {name:"RESULTADOS ESPECIAIS",value:"🟡 Crítico: dois valores iguais de **6+**\n🔴 Falha crítica: dois valores **1**",inline:false}
  ],
  footer:{text:"BLEACH CBB  •  br = Bleach Rolar"}
 }],allowed_mentions:{parse:[]}};
}
