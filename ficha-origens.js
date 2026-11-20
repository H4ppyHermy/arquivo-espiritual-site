/* Identificação dinâmica de raças/classes e medidores manuais da ficha.
   Conteúdo de origem vem do Armazém; não automatiza regras de combate. */
(function(){
 'use strict';
 const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
 const text=value=>String(value??'');
 const builtInRaces=['Shinigami','Visored','Hollow','Arrancar','Quincy','Humano','Fullbringer'];
 const TYPES=['barra','marca','contador','sequencia'];
 function values(raw){
  if(Array.isArray(raw))return raw.map(x=>text(x).trim()).filter(Boolean);
  return text(raw).split(/[,;\n]+/g).map(x=>x.trim()).filter(Boolean);
 }
 function posts(){
  const catalog=window.ARQUIVO_SECOES?.warehouse?.().posts||[];
  const defaults=Array.isArray(window.ARQUIVO_HABILIDADES_CBB)?window.ARQUIVO_HABILIDADES_CBB:[];
  const byId=new Map(defaults.filter(x=>x?.id&&x?.grants).map(x=>[x.id,x.grants]));
  return catalog.filter(p=>p&&p.published!==false&&typeof p.title==='string').map(post=>{
   const original=byId.get(post.id);
   if(!original)return post;
   const own=post.grants&&typeof post.grants==='object'?post.grants:{};
   if(Object.hasOwn(own,'race')&&Object.hasOwn(own,'class'))return post;
   return {...post,grants:{...original,...own}};
  });
 }
 function requirements(post){
  const grants=post.grants&&typeof post.grants==='object'?post.grants:{};
  const race=values(grants.race),kind=values(grants.class);
  if(!Object.hasOwn(grants,'race')&&(post.category==='Habilidades'||post.category==='Técnicas')){
   const tags=values(post.tags),racial=tags.some(t=>fold(t)==='racial');
   if(racial)for(const tag of tags){
    if(['racial','livre','habilidade','tecnica'].includes(fold(tag)))continue;
    race.push(tag);
   }
  }
  return {race,class:kind};
 }
 function races(){
  const result=new Map(builtInRaces.map(x=>[fold(x),x]));
  for(const post of posts()){
   if(post.category==='Raças'&&!result.has(fold(post.title)))result.set(fold(post.title),post.title);
   for(const race of requirements(post).race)if(!result.has(fold(race)))result.set(fold(race),race);
  }
  return [...result.values()];
 }
 function classes(){
  const result=new Map();
  for(const post of posts()){
   if(post.category==='Classes'&&!result.has(fold(post.title)))result.set(fold(post.title),post.title);
   for(const name of requirements(post).class)if(!result.has(fold(name)))result.set(fold(name),name);
  }
  return [...result.values()];
 }
 function costNumber(value){
  const match=text(value).match(/(?:^|[^\d])(\d{1,5})\s*ALMA\b/i);
  return match?Number(match[1]):0;
 }
 function coreFeatures(post){
  const body=text(post?.content);
  const blocks=body.split(/(?=^#{2}\s+)/m).map(x=>x.trim()).filter(Boolean),sections=[];
  for(const block of blocks){
   const heading=/^#{2}\s+([^\n]+)(?:\n|$)/.exec(block);
   if(!heading)continue;
   const title=heading[1].replace(/\*\*/g,'').trim();
   if(!title||fold(title)==='identidade')continue;
   const description=block.slice(heading[0].length).trim();
   if(description)sections.push({title,description});
  }
  if(!sections.length&&body.trim())sections.push({title:post.title,description:body.trim()});
  return sections;
 }
 function identity(sheet){
  const catalog=posts();
  const raceName=text(sheet?.race).trim(),className=text(sheet?.className).trim();
  const race=catalog.find(p=>p.category==='Raças'&&fold(p.title)===fold(raceName));
  const kind=catalog.find(p=>p.category==='Classes'&&fold(p.title)===fold(className));
  const traits=catalog.filter(p=>p.category==='Habilidades'||p.category==='Técnicas');
  return {
   race:raceName?{title:raceName,content:text(race?.content).trim(),
    traits:traits.filter(p=>requirements(p).race.some(x=>fold(x)===fold(raceName)))}:null,
   class:className?{title:className,content:text(kind?.content).trim(),
    traits:traits.filter(p=>requirements(p).class.some(x=>fold(x)===fold(className)))}:null
  };
 }
 function meters(sheet){
  const catalog=posts(),chosen=[['race',sheet?.race,'Raças'],['class',sheet?.className,'Classes']];
  const result=[];
  for(const [kind,name,category] of chosen){
   if(!text(name).trim())continue;
   const post=catalog.find(p=>p.category===category&&fold(p.title)===fold(name));
   if(!post)continue;
   let definitions=[];
   if(Array.isArray(post.bars)&&post.bars.length){
    definitions=post.bars.filter(b=>b&&typeof b==='object').map((b,i)=>({
     id:text(b.id||'recurso-'+i),label:text(b.label||b.id||'Recurso'),
     max:Number(b.max),initial:Number(b.initial??0),visual:TYPES.includes(b.visual)?b.visual:'barra',
     description:text(b.description||'')
    }));
   }else{
    for(const feature of coreFeatures(post)){
     const matches=[...feature.description.matchAll(/\[(sequencia|barra|marca|contador)(?::\s*(\d+)(?:\s*\/\s*(\d+))?)?\s*\]/gi)];
     if(!matches.length)continue;
     const type=matches[0][1].toLowerCase();
     const valid=matches.filter(x=>x[1].toLowerCase()===type);
     const max=Math.max(...valid.map(x=>x[3]!==undefined?Number(x[3]):x[2]!==undefined?Number(x[2]):type==='sequencia'?3:1));
     if(!Number.isInteger(max)||max<1||max>100)continue;
     const intro=feature.description.slice(0,250);
     // Inicializações explícitas ("começa cada cena com [contador:1/5]")
     // ou um único uso "por cena" prevalecem sobre o padrão neutro 0.
     const sceneStart=intro.match(/(?:começa|inicia)[^.!?\n]{0,100}?com\s+\[(sequencia|barra|marca|contador):\s*(\d+)(?:\s*\/\s*\d+)?\]/i);
     const perScene=intro.match(/\[(marca|contador|barra):\s*(\d+)(?:\s*\/\s*\d+)?\][^.!?\n]{0,80}?por\s+cena/i);
     const initial=sceneStart&&sceneStart[1].toLowerCase()===type?Number(sceneStart[2]):
      perScene&&perScene[1].toLowerCase()===type?Number(perScene[2]):0;
     definitions.push({id:fold(feature.title).replace(/[^a-z0-9]+/g,'-'),label:feature.title,
      max,initial,visual:type,description:feature.description.slice(0,400)});
    }
   }
   for(const bar of definitions){
    if(!Number.isInteger(bar.max)||bar.max<1||bar.max>100)continue;
    const key=kind+':'+post.id+':'+bar.id;
    const initial=Math.min(bar.max,Math.max(0,Number.isFinite(bar.initial)?Math.trunc(bar.initial):0));
    const saved=sheet?.abilityRuntime?.originMeters?.[key];
    const current=Number.isInteger(saved)?Math.min(bar.max,Math.max(0,saved)):initial;
    result.push({key,label:bar.label,max:bar.max,current,initial,visual:bar.visual,
     kind,source:post.title,description:bar.description});
   }
  }
  return result;
 }
 // Limpa somente concessões antigas geradas pelo sistema anterior.
 // Habilidades manuais nunca são apagadas nem modificadas.
 function reconcile(sheet){
  if(!sheet||typeof sheet!=='object')return false;
  const old=Array.isArray(sheet.abilities)?sheet.abilities:[];
  const next=old.filter(ab=>!ab?.origin?.auto);
  if(next.length===old.length)return false;
  sheet.abilities=next;
  return true;
 }
 function project(sheet){
  const copy={...sheet,abilities:[...(sheet?.abilities||[])]};
  reconcile(copy);
  return copy;
 }
 window.ARQUIVO_ORIGENS=Object.freeze({
  races,classes,requirements,coreFeatures,identity,meters,reconcile,project,costNumber
 });
})();