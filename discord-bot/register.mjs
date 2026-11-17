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

const commands=[
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
const response=await fetch("https://discord.com/api/v10/applications/"+app+"/guilds/"+guild+"/commands",{
 method:"PUT",headers:{Authorization:"Bot "+token,"Content-Type":"application/json"},
 body:JSON.stringify(commands)
});
if(!response.ok)throw Error("Discord rejeitou o cadastro ("+response.status+"): "+(await response.text()).slice(0,400));
const data=await response.json();
console.log("Comandos cadastrados no servidor:",data.map(x=>"/"+x.name).join(", "));
