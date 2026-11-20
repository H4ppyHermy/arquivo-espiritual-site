import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup({onlinePlayer=false,editable=true}={}){
 const listeners={click:[],input:[],change:[]};
 const sheet={id:'f1',race:'Arrancar',abilities:[]};
 const nodes={
  aeExportAbilityList:{innerHTML:''},aeExportAbilityStatus:{textContent:''},
  aeExportAbilitySelectAll:{disabled:false,textContent:''}
 };
 const button={disabled:false,textContent:''};
 let modal=null,saved=0,closed=0,rendered=0,payload=null;
 const document={
  addEventListener(name,cb){(listeners[name]??=[]).push(cb)},
  getElementById(id){return nodes[id]||null},
  querySelector(query){
   if(query.includes('applyExportAbilities'))return button;
   if(query.includes('.dialog'))return {classList:{add(){}}};
   return null;
  }
 };
 const api={
  db:{sheets:[sheet]},role:onlinePlayer?'player':'master',
  get currentSheet(){return 'f1'},
  canEditSheet(){return editable},
  master(){return !onlinePlayer},
  esc,modal(title,body,buttons){modal={title,body,buttons}},
  closeModal(){closed++},render(){rendered++},save(){saved++;return true},
  toast(){},
 };
 const window={ARQUIVO_INTERNAL:api};
 const context={window,document};
 vm.runInNewContext(read('habilidades-armazem.js'),context);
 window.ARQUIVO_SECOES={warehouse:()=>({posts:window.ARQUIVO_HABILIDADES_CBB})};
 if(onlinePlayer)window.ARQUIVO_SYNC={
  state:{enabled:true},async saveOwnedSheet(sh){payload=sh;return sh},
  async refresh(){}
 };
 vm.runInNewContext(read('ficha-exportar.js'),context);
 const dispatch=(type,target)=>{
  const event={target,preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}};
  for(const fn of listeners[type]||[])fn(event);
 };
 const click=action=>dispatch('click',{closest(query){return query==='[data-action]'?{dataset:{action}}:null}});
 const select=(id,checked)=>dispatch('change',{dataset:{exportAbility:id},checked});
 return {sheet,nodes,button,api,window,click,select,dispatch,
  get modal(){return modal},get saved(){return saved},get closed(){return closed},
  get rendered(){return rendered},get payload(){return payload}};
}
test('o botão Exportar aparece somente para quem edita a ficha',()=>{
 const visual=read('ficha-visual.js');
 const html=read('index.html');
 assert.match(visual,/api\.btn\('EXPORTAR','exportAbilities'/);
 assert.match(visual,/ctx\.canEdit\?'<div class="ae-ficha-ability-create-actions"/);
 assert.match(html,/ficha-exportar\.js\?v=2/);
 assert.ok(html.indexOf('biblioteca-secoes.js')<html.indexOf('ficha-exportar.js'));
 assert.match(read('ficha-visual.css'),/\.ae-export-card/);
});
test('exportador lista técnicas e habilidades com busca e seleção múltipla',()=>{
 const ctx=setup();
 ctx.click('exportAbilities');
 assert.equal(ctx.modal.title,'EXPORTAR DO ARMAZÉM');
 assert.match(ctx.nodes.aeExportAbilityList.innerHTML,/Mira Estável/);
 assert.match(ctx.nodes.aeExportAbilityList.innerHTML,/Hierro/);
 assert.match(ctx.nodes.aeExportAbilityList.innerHTML,/TÉCNICA/);
 assert.match(ctx.nodes.aeExportAbilityList.innerHTML,/2 ALMA/);
 assert.equal(ctx.button.disabled,true);
 ctx.select('tecnica-mira-estavel',true);
 ctx.select('habilidade-hierro',true);
 assert.match(ctx.button.textContent,/2 À FICHA/);
 ctx.dispatch('input',{id:'aeExportAbilitySearch',value:'Cero'});
 assert.match(ctx.nodes.aeExportAbilityList.innerHTML,/Cero/);
 assert.doesNotMatch(ctx.nodes.aeExportAbilityList.innerHTML,/Mira Estável/);
 assert.match(ctx.button.textContent,/2 À FICHA/);
 ctx.click('applyExportAbilities');
 assert.equal(ctx.sheet.abilities.length,2);
 assert.deepEqual(Array.from(ctx.sheet.abilities,a=>a.name),['Mira Estável','Hierro']);
 assert.equal(ctx.sheet.abilities[0].category,'active');
 assert.equal(ctx.sheet.abilities[0].libraryType,'tecnica');
 assert.equal(ctx.sheet.abilities[1].libraryType,'habilidade');
 assert.equal(ctx.sheet.abilities[0].cost,2);
 assert.match(ctx.sheet.abilities[1].description,/resistência de Vida/);
 assert.equal(ctx.saved,1);
 assert.equal(ctx.closed,1);
 assert.equal(ctx.rendered,1);
});
test('não duplica habilidades existentes e preserva os campos já preenchidos',()=>{
 const ctx=setup();
 ctx.sheet.abilities.push({name:'Mira Estável',category:'active',cost:1,description:'Personalizada'});
 ctx.click('exportAbilities');
 assert.match(ctx.nodes.aeExportAbilityList.innerHTML,/JÁ ESTÁ NA FICHA/);
 ctx.select('tecnica-mira-estavel',true);
 assert.equal(ctx.button.disabled,true);
 ctx.select('tecnica-disparo-contencao',true);
 ctx.click('applyExportAbilities');
 assert.equal(ctx.sheet.abilities.length,2);
 assert.equal(ctx.sheet.abilities[0].description,'Personalizada');
 assert.equal(ctx.sheet.abilities[1].name,'Disparo de Contenção');
});
test('cancelar não altera a ficha; permissão negada não abre o seletor',()=>{
 const ctx=setup();
 ctx.click('exportAbilities');
 ctx.select('habilidade-cero',true);
 ctx.click('cancelExportAbilities');
 assert.equal(ctx.sheet.abilities.length,0);
 assert.equal(ctx.saved,0);
 const denied=setup({editable:false});
 denied.click('exportAbilities');
 assert.equal(denied.modal,null);
 assert.equal(denied.saved,0);
});
test('jogador online salva a lista completa pela rotina correta, sem salvar estado incompleto',async()=>{
 const ctx=setup({onlinePlayer:true});
 ctx.click('exportAbilities');
 ctx.select('habilidade-cero',true);
 ctx.select('tecnica-fogo-cobertura',true);
 ctx.click('applyExportAbilities');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ctx.saved,0);
 assert.equal(ctx.payload?.abilities.length,2);
 assert.deepEqual(Array.from(ctx.payload.abilities,a=>a.cost),[3,3]);
 assert.equal(ctx.closed,1);
});
test('código protege títulos e tags contra HTML malicioso e não insere rascunhos do jogador',()=>{
 const ctx=setup({onlinePlayer:true});
 ctx.window.ARQUIVO_HABILIDADES_CBB.push(
  {id:'evil',title:'<img src=x onerror=alert(1)>',category:'Técnicas',content:'Efeito',tags:'<script>x</script>',published:true},
  {id:'private',title:'Rascunho privado',category:'Técnicas',content:'Oculto',published:false}
 );
 ctx.click('exportAbilities');
 const html=ctx.nodes.aeExportAbilityList.innerHTML;
 assert.match(html,/&lt;img/);
 assert.doesNotMatch(html,/<img|<script>/);
 assert.doesNotMatch(html,/Rascunho privado/);
});
