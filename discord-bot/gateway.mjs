/**
 * Prefixos permitidos: br, bajuda, bhistorico, bficha e bvincular.
 * Necessita de um processo Node 22+ sempre ligado. Não interfere nos slash commands.
 * Instalar: npm install
 * Usar: DISCORD_BOT_TOKEN=... node gateway.mjs
 * Discord Portal > Bot > Privileged Gateway Intents > Message Content Intent: ON
 */
import { Client, GatewayIntentBits, AttachmentBuilder } from "discord.js";
import { renderSheetDM } from "./sheet-dm.mjs";
import { parsePrefixMessage } from "./dice.mjs";
import { COMMANDS } from "./commands.mjs";

const token=String(process.env.DISCORD_BOT_TOKEN||"").trim();
const guildId=String(process.env.DISCORD_GUILD_ID||"1558584341435785307").trim();
const endpoint=String(process.env.CBB_PREFIX_ENDPOINT||"https://cxoqifiewqtxsvylfhco.supabase.co/functions/v1/ae-discord-bot/prefix").trim();
if(!token||!/^\d{17,22}$/.test(guildId)||!/^https:\/\//.test(endpoint)){
 throw new Error("Configure DISCORD_BOT_TOKEN, DISCORD_GUILD_ID e CBB_PREFIX_ENDPOINT.");
}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
client.once("clientReady",()=>{
 console.log("Comandos b ativos no Discord: "+client.user.tag);
 // Sincroniza descrições dos comandos / com a versão atual do bot.
 // O registro é feito uma vez a cada conexão, sem bloquear o Gateway.
 const applicationId=String(client.application?.id||client.user?.id||"");
 if(!/^\d{17,22}$/.test(applicationId)){
  console.warn("Discord: ID da aplicação indisponível; comandos / mantidos.");
  return;
 }
 fetch("https://discord.com/api/v10/applications/"+applicationId+"/guilds/"+guildId+"/commands",{
  method:"PUT",
  headers:{Authorization:"Bot "+token,"Content-Type":"application/json"},
  body:JSON.stringify(COMMANDS),
  signal:AbortSignal.timeout(10000)
 }).then(response=>{
  if(!response.ok)console.warn("Discord: atualização de comandos / recusada (HTTP "+response.status+").");
  else console.log("Comandos / sincronizados no servidor.");
 }).catch(error=>console.warn("Discord: registro de comandos / indisponível:",error?.message||error));
});
client.on("messageCreate",async m=>{
 if(m.author.bot||m.guildId!==guildId||m.content.length>300)return;
 const command=parsePrefixMessage(m.content);
 if(!command)return;
 if(command.error){
  await m.reply({content:command.error,allowedMentions:{parse:[],repliedUser:false}}).catch(()=>{});
  return;
 }
 try{
  await m.channel.sendTyping();
  const res=await fetch(endpoint,{
   method:"POST",
   headers:{Authorization:"Bot "+token,"Content-Type":"application/json"},
   body:JSON.stringify({
    guildId:m.guildId,
    channelId:m.channelId,
    messageId:m.id,
    userId:m.author.id,
    username:m.author.username,
    nickname:m.member?.displayName||m.author.globalName||"",
    content:m.content
   }),
   signal:AbortSignal.timeout(12000)
  });
  if(!res.ok){
   console.warn("Comando b recusado pelo servidor:",res.status);
   await m.reply({content:"Não foi possível executar o comando.",allowedMentions:{parse:[],repliedUser:false}});
   return;
  }
  const data=await res.json();
  // Never echo protected sheet data or pairing codes into the guild channel.
  if(data.dmContent){
   try{
    await m.author.send({content:String(data.dmContent).slice(0,1900),allowedMentions:{parse:[]}});
    await m.reply({content:"Código enviado por DM. Abra sua ficha no site e clique em VINCULAR DISCORD.",allowedMentions:{parse:[],repliedUser:false}});
   }catch{
    await m.reply({content:"Não consegui abrir sua DM. Habilite mensagens privadas do servidor e tente bvincular novamente.",allowedMentions:{parse:[],repliedUser:false}});
   }
   return;
  }
  if(data.dmSheet){
   try{
    const sheet=renderSheetDM(data.dmSheet);
    // Pack up to 8 embeds and 5.5k characters per message, under Discord API limits.
    const packs=[];
    let group=[],length=0;
    for(const item of sheet.messages){
     for(const embed of item.embeds||[]){
      const n=String(embed.title||"").length+String(embed.description||"").length+String(embed.footer?.text||"").length;
      if(group.length&&(group.length>=8||length+n>5400)){
       packs.push(group);group=[];length=0;
      }
      group.push(embed);length+=n;
     }
    }
    if(group.length)packs.push(group);
    const exportBytes=Buffer.from(sheet.attachment,"utf8");
    if(exportBytes.length>7*1024*1024)throw Error("Ficha muito grande para exportar via Discord.");
    for(let i=0;i<packs.length;i++){
     const packet={embeds:packs[i],allowedMentions:{parse:[]}};
     if(i===0)packet.files=[new AttachmentBuilder(exportBytes,{name:sheet.exportName})];
     await m.author.send(packet);
    }
    await m.reply({content:"Ficha completa enviada por mensagem privada. Consulte os cartões e o arquivo JSON anexado.",allowedMentions:{parse:[],repliedUser:false}});
   }catch(error){
    console.warn("Discord: não foi possível entregar ficha por DM:",error?.message||error);
    await m.reply({content:"Não consegui entregar sua ficha por DM. Verifique suas configurações de privacidade e tente novamente.",allowedMentions:{parse:[],repliedUser:false}});
   }
   return;
  }
  const safe={allowedMentions:{parse:[],repliedUser:false}};
  if(data.content)safe.content=String(data.content).slice(0,1900);
  if(Array.isArray(data.embeds))safe.embeds=data.embeds.slice(0,2);
  if(Array.isArray(data.components))safe.components=data.components.slice(0,2);
  await m.reply(safe);
 }catch(e){
  console.warn("Gateway CBB:",e?.message||e);
 }
});
client.on("error",error=>console.error("Discord gateway:",error.message));
await client.login(token);
