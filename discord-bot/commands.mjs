// Definições compartilhadas para os comandos de barra do Discord.
export const COMMANDS=[
 {name:"rolar",description:"Rola dados e registra no Arquivo Espiritual.",type:1,options:[
  {type:3,name:"expressao",description:"Ex.: 2d6+3, 1d20, 2d6+1d4",required:true,min_length:2,max_length:90},
  {type:3,name:"descricao",description:"Descrição opcional da rolagem",required:false,max_length:70}
 ]},
 {name:"ficha",description:"Consulta um resumo de ficha pública usando o ID.",type:1,options:[
  {type:3,name:"id",description:"ID da ficha (copiado do Arquivo Espiritual)",required:true,min_length:1,max_length:100}
 ]},
 {name:"historico",description:"Mostra as últimas rolagens públicas do site e Discord.",type:1},
 {name:"ajuda",description:"Lista os comandos do Arquivo Espiritual.",type:1}
];
