/* Concessão dinâmica de habilidades por raça e classe.
   Regras são lidas do Armazém: metadados grants e seções de classes.
   Sem execução automática de efeitos ou cálculos de combate. */
(function(){
 'use strict';
 const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
 const text=value=>String(value??'');
 const builtInRaces=['Shinigami','Visored','Hollow','Arrancar','Quincy','Humano','Fullbringer'];
 function posts(){return window.ARQUIVO_SECOES?.warehouse?.().posts||[]}
 function values(raw){
  if(Array.isArray(raw))return raw.map(x=>text(x).trim()).filter(Boolean);
  return text(raw).split(/[,;\n]+/g).map(x=>x.trim()).filter(Boolean);
 }
 function requirements(post){
  const grants=post.grants&&typeof post.grants==='object'?post.grants:{};
  const race=values(grants.race),kind=values(grants.class);
  // Acervos anteriores a grants ainda podem sinalizar "Racial, Arrancar" por tags.
  if(!Object.prototype.hasOwnProperty.call(grants,'race')&&(post.category==='Habilidades'||post.category==='Técnicas')){
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
  for(const post of posts())if(post?.published!==false){
   for(const race of requirements(post).race)if(!result.has(fold(race)))result.set(fold(race),race);
  }
  return [...result.values()];
 }
 function classes(){
  const result=new Map();
  for(const post of posts())if(post?.published!==false&&post?.title){
   if(post.category==='Classes'&&!result.has(fold(post.title)))result.set(fold(post.title),post.title);
   for(const kind of requirements(post).class)if(!result.has(fold(kind)))result.set(fold(kind),kind);
  }
  return [...result.values()];
 }
 function costNumber(value){
  const match=text(value).match(/(?:^|[^\d])(\d{1,5})\s*ALMA\b/i);
  return match?Number(match[1]):0;
 }
 function abilityFrom(post,origin){
  return {
   name:text(post.title).trim().slice(0,100),
   description:text(post.content).trim().slice(0,20000),
   cost:costNumber(post.cost),
   category:'active',
   libraryType:post.category==='Técnicas'?'tecnica':'habilidade',
   origin
  };
 }
 function coreFeatures(post){
  const body=text(post.content);
  const blocks=body.split(/(?=^#{2}\s+)/m).map(x=>x.trim()).filter(Boolean);
  const sections=[];
  for(const block of blocks){
   const heading=/^#{2}\s+([^\n]+)(?:\n|$)/.exec(block);
   if(!heading)continue;
   const title=heading[1].replace(/\*\*/g,'').trim();
   if(!title||fold(title)==='identidade')continue;
   const description=block.slice(heading[0].length).trim();
   if(!description)continue;
   sections.push({title,description});
  }
  // Uma classe personalizada sem seções ainda fornece sua identidade mecânica.
  if(!sections.length&&body.trim())sections.push({title:post.title,description:body.trim()});
  return sections;
 }
 function desired(sheet){
  const race=fold(sheet?.race),kind=fold(sheet?.className);
  const available=posts().filter(p=>p&&p.published!==false&&p.id&&p.title);
  const result=[];
  for(const post of available){
   if(post.category==='Classes'){
    if(!kind||fold(post.title)!==kind)continue;
    for(const feature of coreFeatures(post)){
     result.push({
      name:feature.title.slice(0,100),description:feature.description.slice(0,20000),
      cost:0,category:'active',libraryType:'habilidade',
      origin:{auto:true,kind:'class',name:post.title,sourceId:post.id,feature:feature.title}
     });
    }
   }else if(post.category==='Habilidades'||post.category==='Técnicas'){
    const req=requirements(post);
    const raceHit=race&&req.race.some(x=>fold(x)===race);
    const classHit=kind&&req.class.some(x=>fold(x)===kind);
    if(raceHit)result.push(abilityFrom(post,{auto:true,kind:'race',name:sheet.race,sourceId:post.id}));
    else if(classHit)result.push(abilityFrom(post,{auto:true,kind:'class',name:sheet.className,sourceId:post.id}));
   }
  }
  return result;
 }
 function reconcile(sheet){
  if(!sheet||typeof sheet!=='object')return false;
  const before=Array.isArray(sheet.abilities)?sheet.abilities:[];
  const manual=before.filter(x=>!x?.origin?.auto);
  const already=new Set(manual.map(a=>fold(a.name)).filter(Boolean));
  const automatic=[];
  for(const grant of desired(sheet)){
   const key=fold(grant.name);
   if(!key||already.has(key))continue;
   already.add(key);
   automatic.push(grant);
  }
  const next=[...manual,...automatic];
  const changed=JSON.stringify(before)!==JSON.stringify(next);
  if(changed||!Array.isArray(sheet.abilities))sheet.abilities=next;
  return changed;
 }
 function project(sheet){
  const copy={...sheet,abilities:[...(sheet?.abilities||[])]};
  reconcile(copy);
  return copy;
 }
 window.ARQUIVO_ORIGENS=Object.freeze({races,classes,requirements,coreFeatures,desired,reconcile,project,costNumber});
})();