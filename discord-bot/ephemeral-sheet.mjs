// Discord ephemeral-only sheet browser. No sheet content is ever posted in a guild message.
// Token is a random 96-bit session reference, not a credential or a substitute for ownership.
import {renderSheetDM} from "./sheet-dm.mjs";
export function sheetPages(sheet){
 const all=renderSheetDM(sheet).messages.flatMap(m=>m.embeds||[]);
 const pages=[];
 let current=[],size=0;
 for(const embed of all){
  const length=String(embed.title||"").length+String(embed.description||"").length+
    String(embed.footer?.text||"").length;
  if(current.length&&(current.length>=5||size+length>5200)){
   pages.push(current);current=[];size=0;
  }
  current.push(embed);size+=length;
 }
 if(current.length)pages.push(current);
 return pages;
}
export function sheetPagerData(sheet,token,pageIndex=0){
 const pages=sheetPages(sheet);
 const page=Math.max(0,Math.min(pages.length-1,Math.trunc(pageIndex)||0));
 const count=pages.length;
 const buttons=[];
 if(page>0)buttons.push({type:2,style:2,label:"Anterior",emoji:{name:"◀️"},custom_id:"ae:f:"+token+":"+(page-1)});
 if(page<count-1)buttons.push({type:2,style:1,label:"Próxima",emoji:{name:"▶️"},custom_id:"ae:f:"+token+":"+(page+1)});
 buttons.push({type:2,style:2,label:"JSON completo",emoji:{name:"📄"},custom_id:"ae:x:"+token});
 const data={
  flags:64,content:"**FICHA PRIVADA · VISÍVEL APENAS PARA VOCÊ**\n"+
   "Personagem: **"+String(sheet.name||"Personagem").replace(/[@\r\n<>*_~]/g," ").slice(0,100)+"**"+
   " · Página **"+(page+1)+"/"+count+"**\n"+
   "Esta visualização é temporária. O acesso é verificado novamente a cada página.",
  embeds:pages[page],
  components:[{type:1,components:buttons}],
  allowed_mentions:{parse:[]}
 };
 return data;
}
export function sheetExportResponse(sheet){
 const sheetId=String(sheet.id||"ficha").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,80);
 const name="ficha-"+sheetId+".json";
 const form=new FormData();
 form.append("payload_json",JSON.stringify({
  type:4,
  data:{
   flags:64,
   content:"**EXPORTAÇÃO PRIVADA** · "+String(sheet.name||"Personagem").replace(/[@\r\n<>*_~]/g," ").slice(0,100)+
    "\nArquivo completo da ficha. Somente você pode ver e baixar este anexo.",
   attachments:[{id:0,filename:name,description:"Exportação completa da sua ficha"}],
   allowed_mentions:{parse:[]}
  }
 }));
 form.append("files[0]",new Blob([JSON.stringify(sheet,null,2)],{type:"application/json"}),name);
 return new Response(form,{status:200,headers:{"cache-control":"no-store"}});
}
