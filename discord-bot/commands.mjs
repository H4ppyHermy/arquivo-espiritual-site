// Comandos exclusivos de dados e histórico de rolagens no Discord.
export const COMMANDS=[
 {name:"rolar",description:"Rola dados e registra no Arquivo Espiritual.",type:1,options:[
  {type:3,name:"expressao",description:"Ex.: 2d6+3, 1d20, 2d6+1d4",required:true,min_length:2,max_length:90},
  {type:3,name:"descricao",description:"Descrição opcional da rolagem",required:false,max_length:70}
 ]},
 {name:"historico",description:"Mostra as últimas rolagens públicas do site e Discord.",type:1},
 {name:"ajuda",description:"Mostra os comandos de rolagem de dados.",type:1}
];
