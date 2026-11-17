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
 * "br 2d6 + 1d4" é a forma principal. Os atalhos "bajuda", "bficha",
 * "bhistorico" e "bvincular" são os únicos comandos sem barra.
 * Use "|" para uma descrição opcional: br 2d6 + 1d4 | Corte do Zangetsu
 */
export function parsePrefixMessage(input){
 const raw=String(input??"").trim();
 if(!raw||raw.length>300)return null;
 const found=/^(br|bajuda|bhistorico|bficha|bvincular)(?=\s|$)(?:\s+([\s\S]*))?$/i.exec(raw);
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

// Mesma regra de ae_avaliar_dados do site: valores iguais >=6 geram CRÍTICO;
// dois valores 1 geram FALHA CRÍTICA. Crítico dobra apenas o subtotal dos dados.
export function evaluateRpgSpecial(dice){
 const active=(Array.isArray(dice)?dice:[]).filter(d=>Number(d.effective??d.value)>0);
 const matching=new Map();let highestFailure=0;
 for(const die of active){
  const value=Number(die.value),sides=Number(die.sides);
  if(value===1)highestFailure=Math.max(highestFailure,sides);
  const key=String(value);
  const group=matching.get(key)||{count:0,highestSides:0};
  group.count++;group.highestSides=Math.max(group.highestSides,sides);
  matching.set(key,group);
 }
 const crit=Math.max(0,...[...matching.entries()].filter(([v,g])=>Number(v)>=6&&g.count>=2).map(([,g])=>g.highestSides));
 const failures=matching.get("1")?.count>=2?highestFailure:0;
 return crit>0&&crit>=failures?"CRÍTICO":failures>0?"FALHA CRÍTICA":"";
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
 const special=evaluateRpgSpecial(dice);
 // O bônus fixo não é multiplicado. Mantém compatibilidade com o critico de 2x do RPG.
 if(special==="CRÍTICO")total=(total-parsed.constant)*2+parsed.constant;
 return {expression:parsed.expression,dice,total,special,breakdown:groups.join(" ").replace(/^\+/,""),count:parsed.count};
}
