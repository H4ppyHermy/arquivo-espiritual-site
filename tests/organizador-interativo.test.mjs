import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=()=>fs.readFileSync(new URL('../organizador-interativo.js',import.meta.url),'utf8');
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));

function element(kind,dataset={},parent=null){
 const classes=new Set();
 const self={kind,dataset,parentElement:parent,hidden:false,style:{},textContent:'',
  classList:{add(v){classes.add(v)},remove(v){classes.delete(v)},contains(v){return classes.has(v)}},
  setAttribute(){},removeAttribute(){},remove(){},
  getBoundingClientRect(){return {top:100,height:100,left:20,width:200}},
  closest(selector){
   for(let p=this;p;p=p.parentElement){
    const map={
     '[data-drag-handle]':'handle',
     '.ae-ficha-ability-entry[data-drop-ability-index]':'ability-entry',
     '[data-drop-ability-index]':'ability-entry',
     '[data-drop-ability-group]':'ability-group',
     '.ae-ficha-abilities[data-ability-sheet]':'ability-root',
     '.ae-ficha-abilities':'ability-root',
     '.ae-warehouse-post[data-drag-warehouse-id]':'warehouse-post',
     '[data-drop-warehouse-id]':'warehouse-post',
     '[data-drop-warehouse-category]':'warehouse-category',
     '[data-drag-ghost]':'ghost',
     'button,a,input,textarea,select,summary,details,[contenteditable="true"],[role="button"]':'handle'
    };
    if(p.kind===map[selector]||(selector==='[data-drop-warehouse-category]'&&p.kind==='warehouse-post'))return p;
   }
   return null;
  }
 };
 return self;
}
function harness(kind='ability',master=true){
 const listeners={},timers=[],moves=[],errors=[],state={renderCount:0};
 const a={name:'Dança da Névoa',description:'A',groupId:'g1',libraryType:'tecnica'},
 b={name:'Passo da Aurora',description:'B',groupId:'g2',libraryType:'habilidade'};
 const sheet={id:'sheet-alpha',abilities:[a,b],abilityGroups:[
  {id:'g1',name:'Início'},{id:'g2',name:'Shikai'}]};
 const posts=[{id:'post-a',title:'Armadilha',category:'Habilidades'},
  {id:'post-b',title:'Cristal',category:'Técnicas'}];
 const db={sheets:[sheet],site:{warehouse:{posts,categories:['Habilidades','Técnicas']}}};
 const api={db,page:kind==='ability'?'sheets':'library',currentSheet:sheet.id,
  master:()=>master,render(){state.renderCount++},toast(title,message){errors.push(title+': '+message)}};
 const backend={state:{enabled:true,identity:{kind:'master'}},
  async moveAbility(args){
   moves.push({type:'ability',...args});
   return {sheet:{id:sheet.id,abilities:[{...b},{...a,groupId:args.p_group_id}]}};
  },
  async moveWarehousePost(args){
   moves.push({type:'warehouse',...args});
   return {post:{...posts[0],category:args.p_category},
    posts:[posts[1],{...posts[0],category:args.p_category}]};
  },
  async refresh(){}
 };
 const body={classList:{add(){},remove(){}},appendChild(){}};
 let hit=null;
 const document={body,addEventListener(name,fn){listeners[name]=fn},
  elementFromPoint(){return hit},
  getElementById(){return null},querySelectorAll(){return []},
  createElement(){return element('ghost')}};
 const window={ARQUIVO_INTERNAL:api,ARQUIVO_SYNC:backend,
  scrollBy(){},innerHeight:700};
 const sandbox={window,document,
  setTimeout(fn){timers.push(fn);return timers.length},
  clearTimeout(){},console};
 vm.runInNewContext(read(),sandbox,{filename:'organizador-interativo.js'});
 const root=element('ability-root',{abilitySheet:sheet.id});
 const group1=element('ability-group',{dropAbilityGroup:'g1'},root);
 const group2=element('ability-group',{dropAbilityGroup:'g2'},root);
 const first=element('ability-entry',{dropAbilityIndex:'0'},group1);
 const second=element('ability-entry',{dropAbilityIndex:'1'},group2);
 const handle=element('handle',{dragHandle:'ability',dragIndex:'0'},first);
 const warehouseRoot=element('warehouse-root');
 const firstPost=element('warehouse-post',{dragWarehouseId:'post-a',dropWarehouseId:'post-a',dropWarehouseCategory:'Habilidades'},warehouseRoot);
 const secondPost=element('warehouse-post',{dragWarehouseId:'post-b',dropWarehouseId:'post-b',dropWarehouseCategory:'Técnicas'},warehouseRoot);
 const warehouseHandle=element('handle',{dragHandle:'warehouse'},firstPost);
 const warehouseCategory=element('warehouse-category',{dropWarehouseCategory:'Técnicas'});
 const evt=(target,id='p1')=>({target,button:0,isPrimary:true,pointerId:id,
  pointerType:'touch',clientX:75,clientY:175,cancelable:true,
  preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){}});
 async function gesture(start,end){
  hit=end;
  listeners.pointerdown(evt(start));
  const go=timers[timers.length-1];
  assert.equal(typeof go,'function');
  go(); // simula segurar o cartão por tempo suficiente
  listeners.pointermove(evt(end));
  listeners.pointerup(evt(end));
  for(let i=0;i<5;i++)await nextTurn();
 }
 return {listeners,timers,moves,errors,state,api,backend,window,sheet,posts,
  root,group1,group2,first,second,handle,firstPost,secondPost,warehouseHandle,warehouseCategory,gesture};
}

test('toque prolongado move habilidade para outra categoria sem reenviar o documento',async()=>{
 const x=harness();
 await x.gesture(x.handle,x.second);
 assert.equal(x.moves.length,1);
 assert.equal(x.moves[0].type,'ability');
 assert.equal(x.moves[0].p_from_index,0);
 assert.equal(x.moves[0].p_target_index,1);
 assert.equal(x.moves[0].p_group_id,'g2');
 assert.equal(x.moves[0].p_after,true);
 assert.equal(x.moves[0].p_expected_name,'Dança da Névoa');
 assert.equal(x.state.renderCount,1);
 assert.equal(x.sheet.abilities[1].groupId,'g2');
 assert.deepEqual(x.errors,[]);
});

test('arrastar habilidade para o cabeçalho de uma categoria permite classificá-la sem alvo',async()=>{
 const x=harness();
 await x.gesture(x.handle,x.group2);
 assert.equal(x.moves.length,1);
 assert.equal(x.moves[0].p_target_index,null);
 assert.equal(x.moves[0].p_group_id,'g2');
});

test('publicação pode ser arrastada para uma categoria do Armazém imediatamente',async()=>{
 const x=harness('warehouse');
 await x.gesture(x.warehouseHandle,x.warehouseCategory);
 assert.equal(x.moves.length,1);
 assert.equal(x.moves[0].type,'warehouse');
 assert.equal(x.moves[0].p_post_id,'post-a');
 assert.equal(x.moves[0].p_target_id,null);
 assert.equal(x.moves[0].p_category,'Técnicas');
 assert.equal(x.api.db.site.warehouse.posts[1].category,'Técnicas');
 assert.equal(x.state.renderCount,1);
});

test('sem permissão de mestre não ativa captura nem alteração da ordem',async()=>{
 const x=harness('ability',false);
 x.listeners.pointerdown({target:x.handle,button:0,isPrimary:true,pointerId:'p1',pointerType:'touch',
  clientX:75,clientY:175});
 assert.equal(x.timers.length,0);
 assert.equal(x.moves.length,0);
});

test('teclado mantém alternativa de organização com setas e foco na alça',async()=>{
 const x=harness();
 x.root.querySelectorAll=()=>[x.first,x.second];
 // Colocamos os dois itens no mesmo grupo para a seta encontrar um vizinho.
 x.second.parentElement=x.group1;
 x.listeners.keydown({target:x.handle,key:'ArrowDown',preventDefault(){}});
 for(let i=0;i<4;i++)await nextTurn();
 assert.equal(x.moves.length,1);
 assert.equal(x.moves[0].p_target_index,1);
 assert.equal(x.moves[0].p_after,true);
});
