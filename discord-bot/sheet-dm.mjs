// Human-readable DMs + exact, lossless JSON export. NEVER send through a server channel.
const primary=0x8B78EF,accent=0xF2BF56;
const clean=(v,n=4000)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/@/g,"@\u200b").trim().slice(0,n);
const escape=(v,n=4000)=>clean(v,n).replace(/([\\`*_~|[\]()])/g,"\\$1");
const val=v=>v===null||v===undefined||v===""?"—":typeof v==="boolean"?(v?"Sim":"Não"):typeof v==="object"?JSON.stringify(v):String(v);
const line=(k,v)=>"**"+escape(k)+":** "+escape(val(v));
const state=(obj)=>obj&&typeof obj==="object"?Object.entries(obj).map(([k,v])=>line(k,v)).join("\n")||"—":"—";
function sections(title,text,color=primary){
 const raw=String(text||"—"),blocks=[];
 for(let i=0;i<raw.length;i+=3400)blocks.push({
  color,title:clean(title,200)+(i?" • CONTINUAÇÃO":""),description:raw.slice(i,i+3400),
  footer:{text:"BLEACH CBB • FICHA PRIVADA • ARQUIVO ESPIRITUAL"}
 });
 return blocks;
}
function list(title,values){
 if(!Array.isArray(values)||!values.length)return sections(title,"—");
 const entries=values.map((item,i)=>{
  if(!item||typeof item!=="object")return "• "+escape(val(item));
  const name=escape(item.name||item.title||"Item "+(i+1));
  const fields=Object.entries(item).filter(([key])=>!["name","title","id","image","description"].includes(key)).map(([key,value])=>line(key,value)).join(" · ");
  return "**"+name+"**"+(fields?"\n"+fields:"")+(item.description?"\n"+escape(item.description):"");
 });
 return sections(title,entries.join("\n\n"));
}
export function renderSheetDM(sheet){
 if(!sheet||typeof sheet!=="object"||!Array.isArray(sheet.abilities))throw Error("Ficha inválida.");
 const name=clean(sheet.name||"Personagem",120),id=clean(sheet.id||"ficha",100);
 const messages=[];
 const add=items=>{for(const embed of items)messages.push({embeds:[embed],allowedMentions:{parse:[]}});};
 add(sections("◈ "+name,[
  sheet.subtitle?escape(sheet.subtitle):"",
  line("ID",id),line("Raça",sheet.race),line("Classe",sheet.className||sheet.class),
  line("Nível",sheet.level),
  "Ficha enviada em privado. O arquivo JSON final inclui **todos** os campos e estados."
 ].filter(Boolean).join("\n"),accent));
 const resources=sheet.resources||{};
 add(sections("RECURSOS",Object.entries(resources).map(([k,r])=>line(k.toUpperCase(),r&&typeof r==="object"?val(r.current)+(r.max!=null?" / "+r.max:""):r)).join("\n")));
 add(sections("ATRIBUTOS",state(sheet.groups)));
 add(sections("PERÍCIAS",state(sheet.skills)));
 add(sections("COMBATE",state(sheet.combat)));
 add(sections("ESTADOS E CONDIÇÕES",Array.isArray(sheet.conditions)&&sheet.conditions.length?sheet.conditions.map(v=>"• "+escape(val(v))).join("\n"):"Nenhum"));
 add(sections("DESGASTE E EXPOSIÇÕES",[line("Desgaste",sheet.desgaste),line("Descansos",sheet.restCount),state(sheet.exposures)].join("\n")));
 add(list("EQUIPAMENTOS",sheet.inventory?.items||[]));
 add(list("MOEDAS E RECURSOS",sheet.inventory?.currencies||[]));
 add(list("VÍNCULOS",sheet.bonds||[]));
 add(sections("ANOTAÇÕES",escape(sheet.notes||"Sem anotações",40000)));
 add(list("IMAGENS DAS NOTAS",sheet.noteImages||[]));
 for(const [i,a] of sheet.abilities.entries()){
  const title="HABILIDADE "+(i+1)+"/"+sheet.abilities.length+" · "+clean(a?.name||"Sem nome",120);
  const extra=Object.entries(a||{}).filter(([key])=>!["name","description"].includes(key))
   .map(([key,value])=>line(key,value)).join("\n");
  const body=[extra,"━━━━━━━━━━━━━━━━",escape(a?.description||"Sem descrição",45000)].filter(Boolean).join("\n");
  add(sections(title,body,["release","transformation","ultimate"].includes(a?.category)?accent:primary));
 }
 if(sheet.abilityRuntime&&Object.keys(sheet.abilityRuntime).length)add(sections("ESTADO DAS HABILIDADES",state(sheet.abilityRuntime)));
 const represented=new Set(["id","name","subtitle","race","className","class","level","abilities","resources","groups","skills","combat","conditions","desgaste","restCount","exposures","inventory","bonds","notes","noteImages","abilityRuntime"]);
 for(const [key,value] of Object.entries(sheet)){
  if(represented.has(key))continue;
  const body=value&&typeof value==="object"?state(value):escape(val(value));
  add(sections("DADOS ADICIONAIS · "+clean(key,150),body));
 }
 const exportName="ficha-"+id.replace(/[^a-z0-9_-]/gi,"_").slice(0,80)+".json";
 return {name,id,messages,attachment:JSON.stringify(sheet,null,2),exportName,abilityCount:sheet.abilities.length};
}
