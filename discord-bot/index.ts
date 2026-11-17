import {rollDiceExpression} from "./dice.mjs";

// Discord application webhook + optional site notifications. No gateway process required.
const env=k=>String(Deno.env.get(k)||"").trim();
const api=()=>env("SUPABASE_URL").replace(/\/+$/,"");
const key=()=>env("SUPABASE_SERVICE_ROLE_KEY");
const txt=(v,n=110)=>String(v??"").replace(/[\r\n<>@]/g," ").trim().slice(0,n);
const j=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store",...extra}});
const say=(content,privateMessage=false)=>({type:4,data:{content:String(content).slice(0,1900),allowed_mentions:{parse:[]},...(privateMessage?{flags:64}:{})}});
const deny=message=>say(message,true);
const user=p=>p.member?.user||p.user||{};
const opt=(p,name)=>p.data?.options?.find(x=>x.name===name)?.value;
const DISCORD_APPLICATION_ID="1572240211268870194";
const DISCORD_ALLOWED_GUILD_ID=env("DISCORD_GUILD_ID")||"1558584341435785307";
const publicGuild=p=>p.guild_id===DISCORD_ALLOWED_GUILD_ID;
function fromHex(value){return typeof value==="string"&&/^[0-9a-f]+$/i.test(value)&&value.length%2===0?Uint8Array.from(value.match(/../g),s=>parseInt(s,16)):null}

async function signed(request,body){
 // A chave de verificação Ed25519 é PÚBLICA. Fallback para a aplicação Bleach CBB.
 // O segredo do bot continua exclusivamente no servidor, nunca no repositório.
 const pub=fromHex(env("DISCORD_PUBLIC_KEY")||"4300ded119c94bd588a1e5657e3299b05d192511d2997d16081387dbe1561b40");
 const sig=fromHex(request.headers.get("x-signature-ed25519"));
 const stamp=request.headers.get("x-signature-timestamp");
 if(pub?.length!==32||sig?.length!==64||!stamp||!/^\d{10}$/.test(stamp)||Math.abs(Date.now()-Number(stamp)*1000)>300000)return false;
 try{
  const k=await crypto.subtle.importKey("raw",pub,{name:"Ed25519"},false,["verify"]);
  return crypto.subtle.verify({name:"Ed25519"},k,sig,new TextEncoder().encode(stamp+body));
 }catch{return false}
}
async function rest(path,method="GET",body=null){
 if(!api()||!key())throw Error("Backend não configurado.");
 const response=await fetch(api()+"/rest/v1/"+path,{method,headers:{apikey:key(),Authorization:"Bearer "+key(),"Content-Type":"application/json",Prefer:"return=representation"},body:body===null?undefined:JSON.stringify(body)});
 if(!response.ok)throw Error("Falha de conexão ao histórico ("+response.status+").");
 const raw=await response.text();return raw?JSON.parse(raw):null;
}
async function findRoll(id){
 const found=await rest("ae_rolls?select=*&id=eq."+encodeURIComponent(id)+"&limit=1");
 return found?.[0]||null;
}
async function sheets(){
 const document=await rest("ae_document?select=data&id=eq.1&limit=1");
 return Array.isArray(document?.[0]?.data?.sheets)?document[0].data.sheets:[];
}
const permittedSheet=s=>!!s&&!s.masterOnly&&!s.locked&&!s.redacted&&!s.private;
function rollText(r){
 const roll=Array.isArray(r.dice)?r.dice:[];
 const values=roll.slice(0,30).map(d=>String(d.value)).join(", ");
 return txt(r.account_name,65)+" · "+txt(r.label,100)+" → ["+values+"] = "+Number(r.total);
}
function rollCard(r){
 const rolls=Array.isArray(r.dice)?r.dice:[];
 const special=String(r.special||"");
 const accent=special==="CRÍTICO"?0xE5B85B:special==="FALHA CRÍTICA"?0xE96A78:0x8166E8;
 const values=rolls.slice(0,30).map(d=>{
  const value=Number(d.value),effect=Number(d.effective??d.value);
  return effect===0||d.canceled===true?"("+value+")":String(value);
 });
 const diceText="["+values.join(", ")+"]";
 const title=txt(r.label||"Rolagem",100);
 const account=txt(r.account_name||"Jogador",70);
 const status=special==="CRÍTICO"?"✦ CRÍTICO · TOTAL DUPLICADO":special==="FALHA CRÍTICA"?"⚠ FALHA CRÍTICA":"RESULTADO";
 const description="## "+Number(r.total)+"  ⟵  "+diceText+
  "\n"+(special?"**"+status+"**\n":"")+
  (r.character_name?"**"+txt(r.character_name,80)+"**\n":"")+
  (rolls.length?rolls.slice(0,16).map(d=>"d"+Number(d.sides)).join(" · "):"");
 const embed={
  color:accent,
  author:{name:account},
  title:"🎲 "+title,
  description:description.slice(0,3900),
  footer:{text:"BLEACH CBB  ·  ARQUIVO ESPIRITUAL"+(r.id?"  ·  #"+r.id:"")}
 };
 const components=r.kind==="discord"&&r.id?[{type:1,components:[{
  type:2,style:2,label:"Re-rolar",emoji:{name:"🔄"},custom_id:"cbb:reroll:"+r.id
 }]}]:[];
 return {embeds:[embed],components,allowed_mentions:{parse:[]}};
}
const rollReply=r=>({type:4,data:rollCard(r)});
async function rollCmd(p,fromRoll=null){
 let rolled;
 const expression=fromRoll?String(fromRoll.label||"").split(" · ")[0]:(opt(p,"expressao")||"1d20");
 try{rolled=rollDiceExpression(expression)}catch(e){return deny(txt(e.message,180))}
 if(!user(p).id)return deny("Usuário desconhecido.");
 const receipt=String(p.id);
 const query="ae_rolls?select=*&discord_interaction_id=eq."+encodeURIComponent(receipt)+"&limit=1";
 const existing=await rest(query);
 if(existing?.[0])return rollReply(existing[0]);
 const caption=fromRoll?"↻ #"+fromRoll.id:txt(opt(p,"descricao"),70);
 const record={
  account_name:"Discord · "+txt(p.member?.nick||user(p).global_name||user(p).username||"Jogador",65),
  kind:"discord",label:rolled.expression+(caption?" · "+caption:""),dice:rolled.dice,total:rolled.total,
  hidden:false,special:rolled.special||"",discord_user_id:String(user(p).id),discord_interaction_id:receipt
 };
 try{
  const inserted=await rest("ae_rolls?select=*","POST",record);
  return rollReply(inserted?.[0]||record);
 }catch(e){
  const duplicate=await rest(query).catch(()=>[]);
  if(duplicate?.[0])return rollReply(duplicate[0]);
  throw e;
 }
}
async function rerollButton(p){
 const match=/^cbb:reroll:([1-9]\d{0,18})$/.exec(String(p.data?.custom_id||""));
 if(!match)return deny("Botão inválido.");
 const previous=await findRoll(match[1]);
 if(!previous||previous.hidden||previous.kind!=="discord")return deny("Rolagem indisponível.");
 if(String(previous.discord_user_id)!==String(user(p).id))return deny("Somente quem fez a rolagem pode re-rolar.");
 return rollCmd(p,previous);
}
async function sheetCmd(p){
 const id=String(opt(p,"id")||"").trim();
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return deny("Informe o ID de uma ficha.");
 const found=(await sheets()).find(s=>s.id===id);
 if(!permittedSheet(found))return deny("Ficha inexistente ou protegida. Solicite acesso ao mestre.");
 const lines=["**"+txt(found.name,80)+"**","ID: "+id,"Nível: "+txt(found.level,10)];
 if(found.race)lines.push("Raça: "+txt(found.race,55));
 if(found.class)lines.push("Classe: "+txt(found.class,55));
 const stats=["vida","estabilidade","alma"].flatMap(k=>{
  const r=found.resources?.[k];
  return r&&Number.isFinite(Number(r.current))&&Number.isFinite(Number(r.max))?[k+": "+r.current+"/"+r.max]:[];
 });
 if(stats.length)lines.push(stats.join(" · "));
 if(/^https:\/\//.test(env("ARQUIVO_SITE_URL"))){try{const link=new URL(env("ARQUIVO_SITE_URL"));link.searchParams.set("ficha",id);lines.push("Abrir ficha no site: "+link.toString())}catch{}}
 return say(lines.join("\n"),true);
}
async function historyCmd(){
 const rows=await rest("ae_rolls?select=id,account_name,sheet_id,label,total,hidden&hidden=eq.false&order=id.desc&limit=30");
 const visible=new Set((await sheets()).filter(permittedSheet).map(s=>s.id));
 const items=(rows||[]).filter(r=>!r.sheet_id||visible.has(r.sheet_id)).slice(0,8);
 if(!items.length)return deny("Sem rolagens públicas registradas.");
 return say("**Histórico compartilhado (site + Discord)**\n"+items.map(r=>"#"+r.id+" · "+txt(r.account_name,32)+" · "+txt(r.label,58)+" = **"+Number(r.total)+"**").join("\n"),true);
}

const COMMANDS=[
 {name:"rolar",description:"Rola dados e registra no Arquivo Espiritual.",type:1,options:[
  {type:3,name:"expressao",description:"Ex.: 2d6+3, 1d20, 2d20kh1",required:true,min_length:2,max_length:90},
  {type:3,name:"descricao",description:"Descrição opcional da rolagem",required:false,max_length:70}
 ]},
 {name:"ficha",description:"Consulta um resumo de ficha pública usando o ID.",type:1,options:[
  {type:3,name:"id",description:"ID da ficha (copiado do Arquivo Espiritual)",required:true,min_length:1,max_length:100}
 ]},
 {name:"historico",description:"Mostra as últimas rolagens públicas do site e Discord.",type:1},
 {name:"ajuda",description:"Lista os comandos do Arquivo Espiritual.",type:1}
];
async function installGuildCommands(){
 const bot=env("DISCORD_BOT_TOKEN");
 if(!bot){console.warn("Discord: DISCORD_BOT_TOKEN ainda não configurado.");return}
 const url="https://discord.com/api/v10/applications/"+DISCORD_APPLICATION_ID+"/guilds/"+DISCORD_ALLOWED_GUILD_ID+"/commands";
 const resp=await fetch(url,{
  method:"PUT",
  headers:{"Authorization":"Bot "+bot,"Content-Type":"application/json"},
  body:JSON.stringify(COMMANDS)
 });
 if(!resp.ok){console.error("Discord: falha ao registrar comandos, HTTP "+resp.status);return}
 console.info("Discord: comandos registrados no servidor autorizado.");
}

async function interaction(req){
 const raw=await req.text();
 if(raw.length>20000)return j({error:"Requisição muito grande."},413);
 if(!await signed(req,raw))return j({error:"Assinatura inválida."},401);
 let p;try{p=JSON.parse(raw)}catch{return j({error:"JSON inválido."},400)}
 if(p.type===1){
  // O Discord envia PING assinado ao validar o endpoint. O registro é isolado
  // em waitUntil para devolver PONG imediatamente e respeitar o prazo de 3s.
  if(typeof EdgeRuntime!=="undefined"&&typeof EdgeRuntime.waitUntil==="function"){
   EdgeRuntime.waitUntil(installGuildCommands().catch(e=>console.error("Discord bootstrap:",e)));
  }
  return j({type:1});
 }
 if(p.type!==2&&p.type!==3)return j(deny("Interação não suportada."));
 if(!publicGuild(p))return j(deny("Bot indisponível neste servidor."));
 try{
  if(p.type===3)return j(await rerollButton(p));
  if(p.data?.name==="rolar")return j(await rollCmd(p));
  if(p.data?.name==="ficha")return j(await sheetCmd(p));
  if(p.data?.name==="historico")return j(await historyCmd());
  if(p.data?.name==="ajuda")return j(say("**Arquivo Espiritual · Comandos**\n/rolar expressao:2d6+3\n/rolar expressao:2d20kh1 (vantagem)\n/rolar expressao:2d20kl1 (desvantagem)\n/ficha id:IDENTIFICADOR\n/historico — rolagens do site e Discord\nAté 30 dados, d1 até d1000.",true));
  return j(deny("Use /ajuda para ver os comandos."));
 }catch{return j(deny("Não foi possível consultar o site. Tente novamente."))}
}
function cors(req){
 // A chamada possui JWT Supabase no Authorization. Não usa cookies nem credenciais
 // do navegador; permite origens HTTPS sem depender de um endereço de site fixo.
 const origin=String(req.headers.get("origin")||"");
 const allowed=/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)?origin:"null";
 return {"Access-Control-Allow-Origin":allowed,
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Access-Control-Allow-Headers":"authorization, apikey, content-type",Vary:"Origin"};
}
async function notify(req){
 const extra=cors(req);
 if(extra["Access-Control-Allow-Origin"]==="null")return j({error:"Origem recusada."},403,extra);
 const auth=req.headers.get("authorization")||"";
 const anon=env("SUPABASE_ANON_KEY")||env("SUPABASE_PUBLISHABLE_KEY")||"sb_publishable_xyUG_qTGBhAnNrKBpphLTw_fu5i6wkg";
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth)||!anon)return j({error:"Autenticação necessária."},401,extra);
 const identity=await fetch(api()+"/auth/v1/user",{headers:{Authorization:auth,apikey:anon}});
 if(!identity.ok)return j({error:"Sessão inválida."},401,extra);
 const u=await identity.json();
 if(!/^[0-9a-f-]{36}$/i.test(u.id||""))return j({error:"Sessão inválida."},401,extra);
 let body;try{body=await req.json()}catch{return j({error:"JSON inválido."},400,extra)}
 const id=Number(body?.rollId);
 if(!Number.isSafeInteger(id)||id<=0)return j({error:"ID inválido."},400,extra);
 const session=await rest("ae_sessions?select=account_id&user_id=eq."+encodeURIComponent(u.id)+"&limit=1");
 const row=await findRoll(id);
 if(!session?.[0]?.account_id||!row||row.account_id!==session[0].account_id||row.hidden||row.kind==="discord")return j({error:"Sem permissão."},403,extra);
 if(row.discord_message_id)return j({ok:true,duplicate:true},200,extra);
 const channel=env("DISCORD_ROLL_CHANNEL_ID")||"1558584343713157152",bot=env("DISCORD_BOT_TOKEN");
 if(!/^\d{17,22}$/.test(channel)||!bot)return j({ok:false,disabled:true},200,extra);
 const sent=await fetch("https://discord.com/api/v10/channels/"+channel+"/messages",{
  method:"POST",headers:{Authorization:"Bot "+bot,"Content-Type":"application/json"},
  body:JSON.stringify({content:"🎲 **Rolagem feita no Arquivo Espiritual**",...rollCard(row)})
 });
 if(!sent.ok){console.warn("Discord notificação falhou",sent.status,await sent.text().catch(()=>""));return j({ok:false,reason:"Discord indisponível."},503,extra)}
 const reply=await sent.json();
 if(reply?.id)await rest("ae_rolls?id=eq."+id,"PATCH",{discord_message_id:String(reply.id)});
 return j({ok:true},200,extra);
}
// Prefixos tradicionais exigem o Gateway do Discord (processo Node separado).
// Este endpoint aceita apenas mensagens encaminhadas por esse worker com o Bot Token.
async function prefixCommand(req){
 const token=env("DISCORD_BOT_TOKEN");
 const supplied=req.headers.get("authorization")||"";
 if(!token||supplied!=="Bot "+token)return j({error:"Acesso não autorizado."},401);
 let body;
 try{body=await req.json()}catch{return j({error:"JSON inválido."},400)}
 if(String(body?.guildId)!==DISCORD_ALLOWED_GUILD_ID)return j({error:"Servidor não autorizado."},403);
 const content=String(body?.content||"").trim().slice(0,300);
 const match=/^CBB(ajuda|rolar|historico|ficha)(?:\s+([\s\S]+))?$/i.exec(content);
 if(!match)return j({error:"Comando desconhecido."},400);
 if(!/^\d{17,22}$/.test(String(body?.userId||""))||!/^\d{17,22}$/.test(String(body?.messageId||"")))return j({error:"Origem inválida."},400);
 const command=match[1].toLowerCase(),args=String(match[2]||"").trim();
 const options=[];
 if(command==="rolar"){
  const split=/^(\S+)(?:\s+([\s\S]+))?$/.exec(args||"1d20");
  options.push({name:"expressao",value:split?.[1]||"1d20"});
  if(split?.[2])options.push({name:"descricao",value:split[2].slice(0,70)});
 }else if(command==="ficha"){
  options.push({name:"id",value:args});
 }
 const payload={
  id:String(body.messageId),type:2,guild_id:DISCORD_ALLOWED_GUILD_ID,
  member:{nick:txt(body.nickname,65),user:{id:String(body.userId),username:txt(body.username,65)}},
  data:{name:command,options}
 };
 try{
  const result=command==="rolar"?await rollCmd(payload):
   command==="ficha"?await sheetCmd(payload):
   command==="historico"?await historyCmd():
   say("**Comandos CBB**\nCBBrolar 2d6+3\nCBBrolar 2d20kh1\nCBBficha ID\nCBBhistorico\nCBBajuda");
  return j(result.data||{content:"Comando indisponível."});
 }catch{return j({content:"Não foi possível executar o comando."},503)}
}

Deno.serve(async req=>{
 const path=new URL(req.url).pathname;
 if(path.endsWith("/prefix")){
  if(req.method!=="POST")return j({error:"Método inválido."},405);
  return prefixCommand(req);
 }
 if(path.endsWith("/notify")){
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST")return j({error:"Método inválido."},405,cors(req));
  try{return await notify(req)}catch{return j({error:"Falha temporária."},503,cors(req))}
 }
 if(req.method!=="POST")return j({error:"Método inválido."},405);
 return interaction(req);
});
