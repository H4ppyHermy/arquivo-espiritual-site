// Expressões de dados do Arquivo Espiritual. Nenhum eval() e nenhum dado confiado ao cliente.
const TOKEN_RE=/^([+-]?)(?:(\d{0,2})d(\d{1,4})(?:(kh|kl)(\d{1,2}))?|(\d{1,4}))$/i;

export function parseDiceExpression(input){
 const expression=String(input??"").replace(/\s+/g,"").toLowerCase();
 if(!expression||expression.length>90||!/^[\d+dklh-]+$/.test(expression))throw new Error("Use dados como 2d6+3, 1d20-2 ou 2d20kh1.");
 const chunks=expression.match(/[+-]?[^+-]+/g);
 if(!chunks?.length||chunks.length>12||chunks.join("")!==expression)throw new Error("Expressão muito longa ou inválida.");
 let countTotal=0,constant=0,hasDice=false;
 const terms=chunks.map(chunk=>{
  const m=TOKEN_RE.exec(chunk);
  if(!m)throw new Error("Termo inválido: "+chunk);
  const sign=m[1]==="-"?-1:1;
  if(m[6]!==undefined){
   const number=Number(m[6]);
   constant+=sign*number;
   return {type:"constant",value:sign*number};
  }
  const count=Number(m[2]||1),sides=Number(m[3]),mode=m[4]||null,keep=m[5]===undefined?null:Number(m[5]);
  if(count<1||count>30||sides<1||sides>1000||(!mode&&keep!==null)||(mode&&(keep<1||keep>count)))throw new Error("Use 1–30 dados por termo, de 1 a 1000 faces.");
  countTotal+=count;
  if(countTotal>30)throw new Error("Máximo de 30 dados na mesma rolagem.");
  hasDice=true;
  return {type:"dice",sign,count,sides,mode,keep};
 });
 if(!hasDice)throw new Error("Inclua pelo menos um dado, como 1d20.");
 if(Math.abs(constant)>10000)throw new Error("Modificadores acima do limite.");
 return {expression,terms,count:countTotal,constant};
}

function randomDie(faces){
 if(faces===1)return 1;
 const limit=Math.floor(4294967296/faces)*faces;
 const data=new Uint32Array(1);
 let x;
 do{crypto.getRandomValues(data);x=data[0]}while(x>=limit);
 return x%faces+1;
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
  let kept=new Set(values.map((_,i)=>i));
  if(term.mode){
   const sorted=values.map((value,i)=>({value,i})).sort((a,b)=>term.mode==="kh"?b.value-a.value:a.value-b.value);
   kept=new Set(sorted.slice(0,term.keep).map(x=>x.i));
  }
  const contribution=values.reduce((sum,value,index)=>sum+(kept.has(index)?term.sign*value:0),0);
  total+=contribution;
  for(let i=0;i<values.length;i++)dice.push({sides:term.sides,value:values[i],effective:kept.has(i)?term.sign*values[i]:0});
  groups.push((term.sign===-1?"-":"+")+values.map((v,i)=>kept.has(i)?String(v):"("+v+")").join(","));
 }
 return {expression:parsed.expression,dice,total,breakdown:groups.join(" ").replace(/^\+/,""),count:parsed.count};
}
