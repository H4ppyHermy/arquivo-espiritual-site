import {COMMANDS} from "./commands.mjs";
/**
 * Registra comandos SOMENTE no servidor de teste selecionado.
 * Credenciais lidas do ambiente, nunca gravadas no GitHub.
 *
 * DISCORD_APPLICATION_ID=... DISCORD_GUILD_ID=... DISCORD_BOT_TOKEN=... node register.mjs
 */
const env=name=>String(process.env[name]||"").trim();
const app=env("DISCORD_APPLICATION_ID");
const guild=env("DISCORD_GUILD_ID");
const token=env("DISCORD_BOT_TOKEN");
if(!/^\d{17,22}$/.test(app)||!/^\d{17,22}$/.test(guild)||!token)throw Error("Defina DISCORD_APPLICATION_ID, DISCORD_GUILD_ID e DISCORD_BOT_TOKEN.");

const response=await fetch("https://discord.com/api/v10/applications/"+app+"/guilds/"+guild+"/commands",{
 method:"PUT",headers:{Authorization:"Bot "+token,"Content-Type":"application/json"},
 body:JSON.stringify(COMMANDS)
});
if(!response.ok)throw Error("Discord rejeitou o cadastro ("+response.status+"): "+(await response.text()).slice(0,400));
const data=await response.json();
console.log("Comandos cadastrados no servidor:",data.map(x=>"/"+x.name).join(", "));
