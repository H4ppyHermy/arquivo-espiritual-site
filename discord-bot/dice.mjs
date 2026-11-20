// Expressões de dados do Arquivo Espiritual. Nenhum eval() e nenhum dado confiado ao cliente.
const TOKEN_RE=/^([+-]?)(?:(\d{0,2})d(\d{1,4})|(\d{1,4}))$/i;

export function parseDiceExpression(input){
 const expression=String(input??"").replace(/\s+/g,"").toLowerCase();
 if(/\d+d\d+(?:kh|kl)\d+/i.test(expression))throw new Error("O sistema antigo de vantagem/desvantagem está desativado. Use dados normais, como 2d6 + 1d4.");
 if(!expression||expression.length>90||!/^[\d+d-]+$/.test(expression))throw new Error("Use dados como 2d6+3, 1d20-2 ou 2d6 + 1d4.");
 const chunks=expression.match(/[+-]?[^+-]+/g);
 if(!chunks?.length||chunks.length>12||chunks.join("")!==expression)throw new Error("Expressão muito longa ou inválida.");
 let countTotal=0,constant=0,hasDice=false;
 const terms=chunks.map(chunk=>{
  const m=TOKEN_RE.exec(chunk);
  if(!m)throw new Error("Termo inválido: "+chunk);
  const sign=m[1]==="-"?-1:1;
  if(m[4]!==undefined){
   const number=Number(m[4]);
   constant+=sign*number;
   return {type:"constant",value:sign*number};
  }
  const count=Number(m[2]||1),sides=Number(m[3]);
  if(count<1||count>30||sides<1||sides>1000)throw new Error("Use 1–30 dados por termo, de 1 a 1000 faces.");
  countTotal+=count;
  if(countTotal>30)throw new Error("Máximo de 30 dados na mesma rolagem.");
  hasDice=true;
  return {type:"dice",sign,count,sides};
 });
 if(!hasDice)throw new Error("Inclua pelo menos um dado, como 1d20.");
 if(Math.abs(constant)>10000)throw new Error("Modificadores acima do limite.");
 return {expression,terms,count:countTotal,constant};
}


/**
 * Parser compartilhado pelos processos HTTP e Gateway.
 * "br 2d6 + 1d4" é a forma principal. "bajuda" e "bhistorico"
 * oferecem ajuda e histórico exclusivamente de rolagens.
 * Use "|" para uma descrição opcional: br 2d6 + 1d4 | Corte do Zangetsu
 */
export function parsePrefixMessage(input){
 const raw=String(input??"").trim();
 if(!raw||raw.length>300)return null;
 const found=/^(br|bajuda|bhistorico)(?=\s|$)(?:\s+([\s\S]*))?$/i.exec(raw);
 if(!found)return null;
 const name=found[1].toLowerCase(),args=String(found[2]||"").trim();
 const command=name==="br"?"rolar":name.slice(1);
 if(command!=="rolar")return {command,args};
 if(!args)return {command,error:"Informe os dados. Exemplo: br 2d6 + 1d4"};
 let expression=args,description="";
 const separator=args.indexOf("|");
 if(separator>=0){
  expression=args.slice(0,separator).trim();
  description=args.slice(separator+1).trim().slice(0,70);
 }
 try{
  const parsed=parseDiceExpression(expression);
  return {command,expression:parsed.expression,description};
 }catch(e){
  return {command,error:"Dados inválidos. Use: br 2d6 + 1d4  (descrição: br 2d6 | Ataque)"};
 }
}


function randomDie(faces){
 if(faces===1)return 1;
 const limit=Math.floor(4294967296/faces)*faces;
 const data=new Uint32Array(1);
 let x;
 do{crypto.getRandomValues(data);x=data[0]}while(x>=limit);
 return x%faces+1;
}

// Regras atuais: somente dados do crítico prioritário são duplicados.
export function evaluateCriticalRoll(input){
 const dice=Array.isArray(input)?input:[];
 const groups=new Map(),original=[];
 for(let i=0;i<dice.length;i++){
  const d=dice[i]||{},value=Number(d.value),sides=Number(d.sides);
  const effective=Number(d.effective??d.value);
  const active=d.canceled!==true&&Number.isFinite(effective)&&effective!==0;
  original.push(active?effective:0);
  if(!active||!Number.isInteger(value)||!Number.isInteger(sides)||sides<1)continue;
  if(!groups.has(value))groups.set(value,{value,sides:0,indices:[]});
  const group=groups.get(value);
  group.sides=Math.max(group.sides,sides);group.indices.push(i);
 }
 const candidates=[...groups.values()]
  .filter(group=>group.indices.length>=2&&(group.value===1||group.value>=6))
  .sort((a,b)=>b.sides-a.sides||b.value-a.value);
 const winner=candidates[0]||null;
 const special=winner?(winner.value===1?"FALHA CRÍTICA":"CRÍTICO MÁXIMO"):"";
 const chosen=new Set(winner?.indices||[]);
 const finalDice=dice.map((die,i)=>{
  const d={...die};
  const marked=chosen.has(i)&&special==="CRÍTICO MÁXIMO";
  const failure=chosen.has(i)&&special==="FALHA CRÍTICA";
  if(marked)d.effective=original[i]*2;
  if(marked)d.criticalApplied=true;
  if(failure)d.failureApplied=true;
  return d;
 });
 const base=original.reduce((sum,n)=>sum+n,0);
 const values=finalDice.map((d,i)=>d.canceled===true?0:Number(d.effective??original[i])).filter(n=>Number.isFinite(n)&&n!==0);
 const total=special==="FALHA CRÍTICA"?1:values.reduce((sum,n)=>sum+n,0);
 return {base,total,ra:special==="FALHA CRÍTICA"?1:values.length?Math.max(...values):0,
  rb:special==="FALHA CRÍTICA"?1:values.length?Math.min(...values):0,
  special,prioritySides:winner?.sides||0,priorityValue:winner?.value??null,
  dice:finalDice};
}
export function evaluateRpgSpecial(dice){
 return evaluateCriticalRoll(dice).special;
}

export function rollDiceExpression(input){
 const parsed=parseDiceExpression(input);
 const dice=[],groups=[];
 let total=0;
 for(const term of parsed.terms){
  if(term.type==="constant"){
   total+=term.value;groups.push((term.value>=0?"+":"")+term.value);continue;
  }
  const values=Array.from({length:term.count},()=>randomDie(term.sides));
  total+=values.reduce((sum,value)=>sum+term.sign*value,0);
  for(const value of values)dice.push({sides:term.sides,value,effective:term.sign*value});
  groups.push((term.sign===-1?"-":"+")+values.join(","));
 }
 const evaluated=evaluateCriticalRoll(dice);
 const totalAfter= evaluated.special==="FALHA CRÍTICA"?1:evaluated.total+parsed.constant;
 return {expression:parsed.expression,dice:evaluated.dice,total:totalAfter,
  ra:evaluated.ra,rb:evaluated.rb,base:evaluated.base+parsed.constant,
  special:evaluated.special,breakdown:groups.join(" ").replace(/^\+/,""),count:parsed.count};
}
