import {rollDiceExpression,parsePrefixMessage} from "./dice.mjs";
import {rollCard,rollText,helpCard} from "./card.mjs";
import {COMMANDS} from "./commands.mjs";

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
async function sheetCmd(){
 // Slash commands never disclose protected sheets. Retrieval uses a linked account and private DM.
 return deny("Para receber sua ficha completa, use bficha ID no servidor. Primeiro, use bvincular para conectar sua conta do site.");
}
async function sheetOwnerCmd(p){
 const id=String(opt(p,"id")||"").trim();
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return {content:"Use bficha ID (exemplo: bficha arquivo-hn9c15m7)."};
 const discordId=String(user(p).id||"");
 const linked=await rest("ae_discord_links?select=account_id,key_id&discord_user_id=eq."+encodeURIComponent(discordId)+"&limit=1");
 if(!linked?.[0])return {content:"Discord não vinculado ao site. Digite bvincular e confira suas DMs."};
 const accountId=linked[0].account_id,keyId=linked[0].key_id;
 const [accounts,keys]=await Promise.all([
  rest("ae_accounts?select=id,key_id&id=eq."+encodeURIComponent(accountId)+"&limit=1"),
  rest("ae_keys?select=id,kind,active&id=eq."+encodeURIComponent(keyId)+"&limit=1")
 ]);
 if(accounts?.[0]?.key_id!==keyId||keys?.[0]?.active!==true||keys?.[0]?.kind!=="player"){
  return {content:"Seu vínculo não está mais ativo. Entre na sua conta do site e vincule novamente usando bvincular."};
 }
 const sheet=(await sheets()).find(s=>s.id===id);
 // Conhecer o ID não dá acesso; coautores não recebem fichas de outros donos.
 if(!sheet||sheet.masterOnly||sheet.ownerKeyId!==keyId){
  return {content:"Ficha não encontrada ou não pertence à sua conta. Confira o ID ou o vínculo no site."};
 }
 return {dmSheet:sheet,content:"Sua ficha completa foi enviada por mensagem privada."};
}
function challengeCode(){
 const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);
 return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
}
async function createLinkChallenge(discordId){
 const code=challengeCode();
 const hashed=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code));
 const digest=[...new Uint8Array(hashed)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const timestamp=new Date();
 const body={
  discord_user_id:discordId,code_hash:digest,
  expires_at:new Date(timestamp.getTime()+10*60*1000).toISOString(),created_at:timestamp.toISOString()
 };
 const response=await fetch(api()+"/rest/v1/ae_discord_link_challenges?on_conflict=discord_user_id",{
  method:"POST",
  headers:{apikey:key(),Authorization:"Bearer "+key(),"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=representation"},
  body:JSON.stringify(body)
 });
 if(!response.ok)throw Error("Não foi possível gerar o código de vínculo ("+response.status+").");
 return code.match(/.{1,4}/g).join("-");
}
async function beginLinkCmd(p){
 const discordId=String(user(p).id||"");
 if(!/^\d{17,22}$/.test(discordId))return {content:"Usuário do Discord inválido."};
 const code=await createLinkChallenge(discordId);
 return {
  dmContent:"**BLEACH CBB · VINCULAR CONTA**\n\n"+
   "Código pessoal: **"+code+"**\n\n"+
   "1. Entre no Arquivo Espiritual com sua chave de jogador.\n"+
   "2. Abra sua ficha e clique em VINCULAR DISCORD.\n"+
   "3. Cole este código e confirme.\n\n"+
   "Expira em 10 minutos. Não compartilhe. Depois use bficha ID no servidor.",
  content:"Enviei as instruções de vinculação por mensagem privada. Confira suas DMs."
 };
}
async function historyCmd(){
 const rows=await rest("ae_rolls?select=id,account_name,sheet_id,label,total,hidden&hidden=eq.false&order=id.desc&limit=30");
 const visible=new Set((await sheets()).filter(permittedSheet).map(s=>s.id));
 const items=(rows||[]).filter(r=>!r.sheet_id||visible.has(r.sheet_id)).slice(0,8);
 if(!items.length)return deny("Sem rolagens públicas registradas.");
 return say("**Histórico compartilhado (site + Discord)**\n"+items.map(r=>"#"+r.id+" · "+txt(r.account_name,32)+" · "+txt(r.label,58)+" = **"+Number(r.total)+"**").join("\n"),true);
}

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
  if(p.data?.name==="ajuda")return j({type:4,data:{...helpCard(),flags:64}});
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
 // Fichas privadas/exclusivas não têm suas rolagens divulgadas no Discord.
 if(row.sheet_id){
  const sheet=(await sheets()).find(item=>item.id===row.sheet_id);
  if(!permittedSheet(sheet))return j({ok:false,privateSheet:true},200,extra);
 }
 const channel=env("DISCORD_ROLL_CHANNEL_ID")||"1558584343713157152",bot=env("DISCORD_BOT_TOKEN");
 if(!/^\d{17,22}$/.test(channel)||!bot)return j({ok:false,disabled:true},200,extra);
 const sent=await fetch("https://discord.com/api/v10/channels/"+channel+"/messages",{
  method:"POST",headers:{Authorization:"Bot "+bot,"Content-Type":"application/json"},
  body:JSON.stringify({content:"🎲 **Rolagem feita no Arquivo Espiritual**",...rollCard(row)})
 });
 if(!sent.ok){
  console.warn("Discord notificação falhou",sent.status,await sent.text().catch(()=>""));
  // Sem permissão para incorporar embeds, ainda entrega uma mensagem de texto.
  if(sent.status===400||sent.status===403){
   const backup=await fetch("https://discord.com/api/v10/channels/"+channel+"/messages",{
    method:"POST",headers:{Authorization:"Bot "+bot,"Content-Type":"application/json"},
    body:JSON.stringify({content:"🎲 "+rollText(row),allowed_mentions:{parse:[]}})
   });
   if(!backup.ok)return j({ok:false,reason:"Discord indisponível."},503,extra);
   const receipt=await backup.json();
   if(receipt?.id)await rest("ae_rolls?id=eq."+id,"PATCH",{discord_message_id:String(receipt.id)});
   return j({ok:true,textFallback:true},200,extra);
  }
  return j({ok:false,reason:"Discord indisponível."},503,extra);
 }
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
 const parsed=parsePrefixMessage(body?.content);
 if(!parsed)return j({error:"Comando desconhecido."},400);
 if(!/^\d{17,22}$/.test(String(body?.userId||""))||!/^\d{17,22}$/.test(String(body?.messageId||"")))return j({error:"Origem inválida."},400);
 if(parsed.error)return j({content:parsed.error,allowed_mentions:{parse:[]}});
 const command=parsed.command,args=parsed.args||"";
 const options=[];
 if(command==="rolar"){
  options.push({name:"expressao",value:parsed.expression});
  if(parsed.description)options.push({name:"descricao",value:parsed.description});
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
   command==="ficha"?{data:await sheetOwnerCmd(payload)}:
   command==="vincular"?{data:await beginLinkCmd(payload)}:
   command==="historico"?await historyCmd():
   {data:helpCard()};
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
