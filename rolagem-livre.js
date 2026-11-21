/* Expressões de dados e atalhos locais da Mesa de Dados.
 * Sem eval/Function: a árvore sintática limita quantidade de dados e operações.
 * A matemática é independente dos críticos/regras dos testes CBB.
 */
(function(root){
 'use strict';
 const KEY='ae_free_roll_shortcuts_v1', MAX_DICE=30, MAX_FACES=1000, MAX_LENGTH=160;
 const defaults=[4,6,8,10,12,20].map(n=>({name:'d'+n,formula:'1d'+n}));
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let draft='1d4 + 1d6*2',editing=-1;
 function safeStorage(){try{return root.localStorage||null}catch(e){return null}}
 function validShortcut(s){return s&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.trim().length<=24&&typeof s.formula==='string'&&s.formula.trim().length<=MAX_LENGTH}
 function loadShortcuts(){try{const raw=safeStorage()?.getItem(KEY);if(raw===null||raw===undefined)return defaults.map(x=>({...x}));const data=JSON.parse(raw);if(Array.isArray(data)&&data.length<=16&&data.every(validShortcut))return data.map(x=>({name:x.name.trim(),formula:x.formula.trim()}))}catch(e){}return defaults.map(x=>({...x}))}
 let shortcuts=loadShortcuts();
 function persist(){try{const s=safeStorage();if(!s)return false;s.setItem(KEY,JSON.stringify(shortcuts));return true}catch(e){return false}}
 function fail(message){throw Error(message)}
 function parse(raw){
  const source=String(raw??'').trim().replace(/[×]/g,'*').replace(/[÷]/g,'/').replace(/[−]/g,'-').replace(/(\d),(\d)/g,'$1.$2');
  if(!source)fail('Escreva uma fórmula antes de rolar.');
  if(source.length>MAX_LENGTH)fail('A fórmula aceita até '+MAX_LENGTH+' caracteres.');
  const tokens=[];let i=0;
  while(i<source.length){
   if(/\s/.test(source[i])){i++;continue}
   const rest=source.slice(i),die=/^(\d*)[dD](\d+)(?![\d\p{L}])/u.exec(rest);
   if(die){
    const count=die[1]===''?1:Number(die[1]),faces=Number(die[2]);
    if(!Number.isSafeInteger(count)||count<1||count>MAX_DICE)fail('Cada termo aceita de 1 a 30 dados.');
    if(!Number.isSafeInteger(faces)||faces<2||faces>MAX_FACES)fail('Use dados com 2 a 1.000 faces.');
    tokens.push({type:'die',count,faces});i+=die[0].length;continue;
   }
   const num=/^(?:\d+(?:\.\d+)?|\.\d+)/.exec(rest);
   if(num){const n=Number(num[0]);if(!Number.isFinite(n)||Math.abs(n)>1e9)fail('Número muito grande.');tokens.push({type:'number',value:n});i+=num[0].length;continue}
   if('+-*/()'.includes(source[i])){tokens.push({type:source[i]});i++;continue}
   fail('Símbolo não reconhecido perto de "'+source.slice(i,i+12)+'".');
  }
  if(tokens.length>100)fail('Fórmula muito longa.');
  const terms=[];let pos=0;
  function match(type){if(tokens[pos]?.type===type){pos++;return true}return false}
  function primary(){
   const t=tokens[pos];
   if(!t)fail('Fórmula incompleta.');
   if(match('(')){const v=expression();if(!match(')'))fail('Falta fechar um parêntese.');return v}
   if(t.type==='die'){pos++;const node={type:'die',count:t.count,faces:t.faces,values:[]};terms.push(node);return node}
   if(t.type==='number'){pos++;return {type:'number',value:t.value}}
   fail('Esperava um número, dado ou parêntese.');
  }
  function unary(){if(match('+'))return unary();if(match('-'))return {type:'negative',child:unary()};return primary()}
  function product(){let node=unary();while(tokens[pos]&&['*','/'].includes(tokens[pos].type)){const op=tokens[pos++].type;node={type:'binary',op,left:node,right:unary()}}return node}
  function expression(){let node=product();while(tokens[pos]&&['+','-'].includes(tokens[pos].type)){const op=tokens[pos++].type;node={type:'binary',op,left:node,right:product()}}return node}
  const ast=expression();if(pos!==tokens.length)fail('Verifique os operadores e parênteses da fórmula.');
  const count=terms.reduce((sum,term)=>sum+term.count,0);
  if(count>MAX_DICE)fail('Uma rolagem permite até '+MAX_DICE+' dados somados em todos os termos.');
  return {source,ast,terms,count};
 }
 function calculate(node){
  if(node.type==='number')return {total:node.value,detail:String(node.value)};
  if(node.type==='die'){
   const sum=node.values.reduce((n,v)=>n+v,0);
   return {total:sum,detail:node.count+'d'+node.faces+' ['+node.values.join(', ')+']'};
  }
  if(node.type==='negative'){
   const value=calculate(node.child);return {total:-value.total,detail:'-('+value.detail+')'};
  }
  const a=calculate(node.left),b=calculate(node.right);
  if(node.op==='/'&&b.total===0)fail('Divisão por zero. Altere a fórmula e tente novamente.');
  let total;
  switch(node.op){case '+':total=a.total+b.total;break;case '-':total=a.total-b.total;break;case '*':total=a.total*b.total;break;case '/':total=a.total/b.total;break}
  if(!Number.isFinite(total)||Math.abs(total)>1e9)fail('Resultado fora do limite de um bilhão.');
  return {total,detail:'('+a.detail+' '+node.op+' '+b.detail+')'};
 }
 async function evaluate(plan,rollBatch){
  // Agrupa faces iguais para minimizar chamadas ao servidor, sem perder a ordem dos termos.
  const pools=new Map();for(const term of plan.terms)pools.set(term.faces,(pools.get(term.faces)||0)+term.count);
  const batches=await Promise.all([...pools].map(async ([faces,count])=>{
   const rolled=await rollBatch(count,faces);
   const dice=Array.isArray(rolled)?rolled:rolled?.dice;
   if(!Array.isArray(dice)||dice.length!==count)fail('A rolagem não retornou todos os dados.');
   const values=dice.map(d=>Number(d.value));
   if(values.some(n=>!Number.isInteger(n)||n<1||n>faces))fail('O servidor retornou um dado inválido.');
   return [faces,values];
  }));
  const remaining=new Map(batches.map(([faces,values])=>[faces,values.slice()]));
  const dice=[];
  for(const term of plan.terms){
   const values=remaining.get(term.faces).splice(0,term.count);term.values=values;
   dice.push(...values.map(value=>({sides:term.faces,value})));
  }
  const result=calculate(plan.ast);
  return {total:result.total,detail:result.detail,dice};
 }
 function chips(){return shortcuts.map((item,i)=>'<span class="ae-free-shortcut"><button type="button" class="ae-free-chip" data-free-action="shortcut:'+i+'" title="Rolar '+escape(item.formula)+'">'+escape(item.name)+'</button><button type="button" class="ae-free-shortcut-edit" data-free-action="edit:'+i+'" aria-label="Editar atalho '+escape(item.name)+'" title="Editar atalho">✎</button></span>').join('')+
  (shortcuts.length<16?'<button type="button" class="ae-free-chip ae-free-add" data-free-action="new">+ ATALHO</button>':'');}
 function keypad(){
  return ['7','8','9','/','4','5','6','*','1','2','3','-','0','(',')','+','d','⌫','C','.'].map(ch=>{
   const action=ch==='⌫'?'backspace':ch==='C'?'clear':'key:'+encodeURIComponent(ch);
   return '<button type="button" class="ae-free-key" data-free-action="'+action+'" aria-label="'+(ch==='⌫'?'Apagar último caractere':ch==='C'?'Limpar fórmula':ch)+'">'+escape(ch)+'</button>';
  }).join('');
 }
 function markup(options){
  const online=!!options.online;
  return '<div class="ae-free-layout"><section class="panel ae-free-panel">'+
   '<div class="sectionhead"><h2>CALCULADORA DE DADOS</h2><span class="tag">LIVRE · INDEPENDENTE</span></div>'+
   '<label class="ae-free-expression-label" for="freeExpression">EXPRESSÃO DA ROLAGEM</label>'+
   '<input type="text" id="freeExpression" class="ae-free-expression" autocomplete="off" spellcheck="false" inputmode="text" maxlength="'+MAX_LENGTH+'" value="'+escape(draft)+'" placeholder="Ex.: 1d4 + 1d6*2" aria-describedby="freeExpressionHelp freeDicePreview">'+
   '<p id="freeExpressionHelp" class="ae-free-help">Use d4, 2d6, números, +, −, ×, ÷ e parênteses. A multiplicação precede a soma. Até 30 dados e 1.000 faces.</p>'+
   '<div class="ae-free-calculator" role="group" aria-label="Teclado da calculadora">'+keypad()+'</div>'+
   '<div class="ae-free-preview" id="freeDicePreview" role="status" aria-live="polite"></div>'+
   '<button type="button" class="btn main ae-free-submit" data-action="freeRoll">ROLAR EXPRESSÃO</button>'+
   '<div id="freeResult" aria-live="polite">'+(options.result||'')+'</div>'+
   '<div class="ae-free-quick"><div class="ae-free-shortcut-title"><span class="eyebrow">ATALHOS DESTE NAVEGADOR</span><button type="button" class="btn small quiet" data-free-action="manage">GERENCIAR</button></div><div id="freeShortcutChips" class="ae-free-chips">'+chips()+'</div></div>'+
   '<div id="freeShortcutEditor" class="ae-free-shortcut-editor" hidden><h3 id="freeShortcutHeading">EDITAR ATALHO</h3><div class="ae-free-shortcut-fields"><label>NOME<input type="text" id="freeShortcutName" maxlength="24" placeholder="Ex.: Ataque"></label><label>FÓRMULA<input type="text" id="freeShortcutFormula" maxlength="'+MAX_LENGTH+'" placeholder="2d8 + 4"></label></div><p id="freeShortcutError" role="alert"></p><div class="actions"><button type="button" class="btn main small" data-free-action="save">SALVAR</button><button type="button" class="btn danger small" data-free-action="delete" id="freeShortcutDelete">EXCLUIR</button><button type="button" class="btn small" data-free-action="cancel">CANCELAR</button></div></div>'+
   '<p class="subtitle">'+(online?'Os dados são verificados e registrados no servidor; a conta matemática da fórmula é calculada neste navegador.':'Sem conexão, resultados são locais e não verificados.')+' Os atalhos ficam salvos apenas neste navegador.</p></section>'+
   '<section class="panel ae-free-history"><div class="sectionhead"><h2>HISTÓRICO DE ROLAGENS</h2></div>'+(options.composites||'')+(options.history||'')+'</section></div>';
 }
 function preview(){
  const input=root.document?.getElementById('freeExpression'),node=root.document?.getElementById('freeDicePreview');
  if(!input||!node)return;
  draft=input.value;
  const submit=root.document.querySelector('.ae-free-submit');
  try{const plan=parse(draft);node.innerHTML='<span>EXPRESSÃO VÁLIDA · '+(plan.count?plan.count+' DADO'+(plan.count>1?'S':''):'CÁLCULO PURO')+'</span><strong>'+escape(plan.source)+'</strong>';input.removeAttribute('aria-invalid');if(submit)submit.disabled=false}
  catch(e){node.innerHTML='<span>AJUSTE A FÓRMULA</span><strong>'+escape(e.message)+'</strong>';input.setAttribute('aria-invalid','true');if(submit)submit.disabled=true}
 }
 function insert(value){
  const field=root.document?.getElementById('freeExpression');if(!field)return;
  const from=field.selectionStart??field.value.length,to=field.selectionEnd??from;
  if(value==='backspace'){if(from===to&&from>0){field.setRangeText('',from-1,to,'end')}else field.setRangeText('',from,to,'end')}
  else if(value==='clear'){field.value=''}
  else{field.setRangeText(value,from,to,'end')}
  field.focus();preview();
 }
 function edit(index){
  const box=root.document?.getElementById('freeShortcutEditor');if(!box)return;
  editing=index;
  const item=index>=0?shortcuts[index]:null;
  const heading=root.document.getElementById('freeShortcutHeading'),name=root.document.getElementById('freeShortcutName'),formula=root.document.getElementById('freeShortcutFormula');
  heading.textContent=item?'EDITAR ATALHO':'NOVO ATALHO';name.value=item?.name||'';formula.value=item?.formula||draft;
  root.document.getElementById('freeShortcutDelete').hidden=!item;root.document.getElementById('freeShortcutError').textContent='';box.hidden=false;name.focus();
 }
 function closeEditor(){const box=root.document?.getElementById('freeShortcutEditor');if(box)box.hidden=true;editing=-1}
 function redraw(){const el=root.document?.getElementById('freeShortcutChips');if(el)el.innerHTML=chips()}
 function save(){const name=root.document.getElementById('freeShortcutName')?.value.trim(),formula=root.document.getElementById('freeShortcutFormula')?.value.trim();const error=root.document.getElementById('freeShortcutError');
  try{
   const shortcut={name,formula};if(!validShortcut(shortcut))fail('Nome e fórmula são obrigatórios (nome com até 24 caracteres).');parse(formula);
   if(editing<0){if(shortcuts.length>=16)fail('O limite é de 16 atalhos.');shortcuts.push(shortcut)}else shortcuts[editing]=shortcut;
   const persisted=persist();redraw();if(persisted)closeEditor();else if(error){error.textContent='Armazenamento bloqueado: o atalho não será mantido após atualizar.';if(editing<0)editing=shortcuts.length-1;}
  }catch(e){if(error)error.textContent=e.message}
 }
 function remove(){if(editing<0)return;shortcuts.splice(editing,1);persist();redraw();closeEditor()}
 function choose(index){const item=shortcuts[index];const field=root.document?.getElementById('freeExpression');if(!item||!field)return;field.value=item.formula;preview();root.document.querySelector('.ae-free-submit')?.click()}
 function handleClick(e){
  const b=e.target.closest?.('[data-free-action]');if(!b)return;
  const [name,arg]=b.dataset.freeAction.split(':');
  if(name==='shortcut')choose(Number(arg));else if(name==='edit')edit(Number(arg));else if(name==='new')edit(-1);
  else if(name==='manage')edit(shortcuts.length?0:-1);
  else if(name==='save')save();else if(name==='delete')remove();else if(name==='cancel')closeEditor();
  else if(name==='backspace')insert('backspace');else if(name==='clear')insert('clear');else if(name==='key')insert(decodeURIComponent(arg||''));
 }
 if(root.document){
  root.document.addEventListener('click',handleClick);
  root.document.addEventListener('input',e=>{if(e.target?.id==='freeExpression')preview()});
  root.document.addEventListener('keydown',e=>{if(e.target?.id==='freeExpression'&&e.key==='Enter'&&!e.isComposing){e.preventDefault();root.document.querySelector('.ae-free-submit:not(:disabled)')?.click()}});
 }
 root.ARQUIVO_FREE_ROLL={parse,evaluate,markup,preview,shortcuts:()=>shortcuts.map(x=>({...x})),getDraft:()=>draft};
})(typeof window!=='undefined'?window:globalThis);
