/* Arquivo Espiritual — Leitor de texto acessível, gratuito e independente.
 * Usa apenas a Web Speech API do dispositivo e armazenamento local.
 */
(function setupAccessibleReader(){
 'use strict';
 if(window.ARQUIVO_SPEECH)return;
 const STORE_KEY='arquivo_leitor_flutuante_v1';
 const state={selection:'',queue:[],token:0,active:false,dialog:null,drag:null,issue:''};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const preferences=()=>window.ARQUIVO_INTERNAL?.prefs||{};
 const supported=()=>!!(window.speechSynthesis&&window.SpeechSynthesisUtterance);
 const node=id=>document.getElementById(id);
 const panel=document.createElement('div');
 panel.id='aeSpeechTools';
 panel.className='ae-speech-tools';
 panel.hidden=true;
 panel.setAttribute('role','group');
 panel.setAttribute('aria-label','Leitor de texto flutuante');
 panel.innerHTML=
  '<div class="ae-speech-head">'+
   '<button type="button" class="ae-speech-drag" id="aeSpeechDrag" title="Arraste para mover; setas para mover pelo teclado" aria-label="Mover leitor: arraste, use as setas ou pressione Início para restaurar">⠿ <span>LEITOR DE TEXTO</span></button>'+
   '<div class="ae-speech-sizes" role="group" aria-label="Tamanho do painel">'+
    '<button type="button" id="aeSpeechSmaller" data-reader="smaller" aria-label="Diminuir tamanho do leitor">−</button>'+
    '<button type="button" id="aeSpeechBigger" data-reader="bigger" aria-label="Aumentar tamanho do leitor">+</button>'+
   '</div>'+
  '</div>'+
  '<div class="ae-speech-actions">'+
   '<button type="button" class="ae-speech-primary" id="aeSpeechRead" data-reader="read" aria-describedby="aeSpeechStatus">LER SELEÇÃO</button>'+
   '<button type="button" id="aeSpeechReadDialog" data-reader="dialog" hidden>LER JANELA</button>'+
   '<button type="button" id="aeSpeechStop" data-reader="stop" disabled>PARAR</button>'+
  '</div>'+
  '<span class="ae-speech-status" role="status" aria-live="polite" id="aeSpeechStatus">Selecione um trecho para ouvir.</span>';
 document.body.appendChild(panel);
 const ui=(()=>{try{const v=JSON.parse(localStorage.getItem(STORE_KEY)||'null');return v&&typeof v==='object'?v:{}}catch(e){return {}}})();
 let size=clamp(Number(ui.size)||1,.8,1.5);
 let position=ui.position&&Number.isFinite(Number(ui.position.x))&&Number.isFinite(Number(ui.position.y))
  ?{x:Number(ui.position.x),y:Number(ui.position.y)}:null;
 const saveUI=()=>{try{localStorage.setItem(STORE_KEY,JSON.stringify({size,position}))}catch(e){}};
 const currentDialog=()=>node('dialogRoot')?.querySelector('[role="dialog"]')||null;
 function dialogReadable(){
  const dialog=currentDialog();
  return !!dialog&&!dialog.querySelector('input,textarea,select,[contenteditable="true"]')&&
   !!dialog.querySelector('.ae-mechanic-explanation,.book-text,.rule,.ability-description,p');
 }
 function dialogText(){
  const dialog=currentDialog();
  if(!dialog||!dialogReadable())return '';
  const glossary=dialog.querySelector('.ae-mechanic-explanation');
  const title=dialog.querySelector('h2')?.textContent||'';
  const source=glossary||dialog;
  const text=[title,...Array.from(source.querySelectorAll(glossary?'p:not(.subtitle)':'p,li,blockquote')).
   filter(element=>!element.closest('button,.actions,[aria-hidden="true"]')).
   map(element=>String(element.textContent||'').trim())].
   filter(Boolean).join('. ');
  return text.replace(/\s+/g,' ').trim().slice(0,6000);
 }
 function layout(save=false){
  if(panel.hidden)return;
  panel.style.setProperty('--ae-reader-scale',String(size));
  const width=Math.max(160,window.visualViewport?.width||window.innerWidth);
  const height=Math.max(230,window.visualViewport?.height||window.innerHeight);
  const box=panel.getBoundingClientRect();
  const x=clamp(position?.x??12,8,Math.max(8,width-box.width-8));
  const y=clamp(position?.y??height-box.height-(width<=680?87:94),8,Math.max(8,height-box.height-8));
  panel.style.left=Math.round(x)+'px';panel.style.top=Math.round(y)+'px';
  if(save){position={x:Math.round(x),y:Math.round(y)};saveUI()}
 }
 function refresh(){
  panel.hidden=!preferences().speechEnabled;
  if(panel.hidden){if(state.active)stop();return}
  const available=supported();
  node('aeSpeechRead').disabled=!available||!state.selection;
  node('aeSpeechStop').disabled=!available||!state.active;
  const modalButton=node('aeSpeechReadDialog');
  modalButton.hidden=!dialogReadable();
  modalButton.disabled=!available;
  node('aeSpeechSmaller').disabled=size<=.8;
  node('aeSpeechBigger').disabled=size>=1.5;
  const status=node('aeSpeechStatus');
  status.textContent=!available?'Este navegador não oferece síntese de voz.':state.issue?state.issue:
   state.active?'Lendo em voz alta…':
   state.selection?'Seleção pronta para ouvir.':
   dialogReadable()?'Selecione uma parte ou use LER JANELA.':'Selecione um trecho para ouvir.';
  layout();
 }
 function clear(stopCurrent=false){
  state.selection='';state.issue='';
  if(stopCurrent)stop();else refresh();
 }
 function stop(){
  state.token++;state.queue=[];state.active=false;
  try{window.speechSynthesis?.cancel()}catch(e){}
  refresh();
 }
 function reportIssue(title,description){
  state.issue=description;refresh();
  try{window.ARQUIVO_INTERNAL?.toast?.(title,description,true)}catch(e){}
 }
 function chunk(text){
  const words=String(text||'').replace(/\s+/g,' ').trim().split(/\s+/).filter(Boolean);
  const chunks=[];let current='';
  for(const word of words){
   if(word.length>160){
    if(current){chunks.push(current);current=''}
    for(let i=0;i<word.length;i+=155)chunks.push(word.slice(i,i+155));
   }else{
    if(current&&current.length+1+word.length>160){chunks.push(current);current=word}
    else current=current?current+' '+word:word;
    if(/[.!?;:]$/.test(word)&&current.length>40){chunks.push(current);current=''}
   }
  }
  if(current)chunks.push(current);
  return chunks;
 }
 function speak(text){
  if(!preferences().speechEnabled)return;
  if(!supported()){reportIssue('Leitor indisponível','Este navegador não oferece narração. Experimente um navegador atualizado.');return}
  const content=String(text||'').replace(/\s+/g,' ').trim();
  if(!content){reportIssue('Seleção necessária','Selecione um trecho ou use LER JANELA.');return}
  state.issue='';stop();
  state.queue=chunk(content.slice(0,6000));
  if(!state.queue.length)return;
  state.active=true;
  const generation=++state.token,engine=window.speechSynthesis;
  const next=()=>{
   if(generation!==state.token)return;
   const part=state.queue.shift();
   if(!part){state.active=false;refresh();return}
   const utterance=new SpeechSynthesisUtterance(part);
   utterance.lang='pt-BR';
   utterance.rate=clamp(Number(preferences().speechRate)||1,.5,2);
   const voices=engine.getVoices?.()||[];
   utterance.voice=voices.find(v=>/^pt[-_]BR$/i.test(v.lang))||voices.find(v=>/^pt(?:[-_]|$)/i.test(v.lang))||null;
   utterance.onend=next;
   utterance.onerror=e=>{
    if(generation!==state.token)return;
    stop();
    if(e.error!=='canceled'&&e.error!=='interrupted')reportIssue('Narração interrompida','Verifique se existe uma voz compatível instalada no dispositivo.');
   };
   try{engine.speak(utterance)}catch(e){stop();reportIssue('Falha na narração','Não foi possível iniciar a voz neste navegador.')}
  };
  refresh();next();
 }
 function captureSelection(){
  if(!preferences().speechEnabled||!supported())return;
  const selection=window.getSelection?.();
  if(!selection||selection.isCollapsed)return;
  const anchor=selection.anchorNode?.nodeType===1?selection.anchorNode:selection.anchorNode?.parentElement;
  const focus=selection.focusNode?.nodeType===1?selection.focusNode:selection.focusNode?.parentElement;
  const scope=currentDialog()||node('page');
  if(!scope||!anchor||!focus||!scope.contains(anchor)||!scope.contains(focus))return;
  if(anchor.closest?.('button,input,textarea,select,[contenteditable="true"],#aeSpeechTools')||
     focus.closest?.('button,input,textarea,select,[contenteditable="true"],#aeSpeechTools'))return;
  const selected=selection.toString().replace(/\s+/g,' ').trim();
  if(selected.length<2)return;
  state.selection=selected.slice(0,6000);state.issue='';
  refresh();
 }
 function resize(delta){
  size=Math.round(clamp(size+delta,.8,1.5)*100)/100;
  saveUI();refresh();
 }
 function reset(){
  size=1;position=null;saveUI();refresh();
 }
 function dragStart(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const rect=panel.getBoundingClientRect();
  state.drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
  e.preventDefault();
  try{e.currentTarget.setPointerCapture(e.pointerId)}catch(err){}
 }
 function dragMove(e){
  const d=state.drag;if(!d||d.id!==e.pointerId)return;
  position={x:d.left+e.clientX-d.x,y:d.top+e.clientY-d.y};
  layout();
  e.preventDefault();
 }
 function dragEnd(e){
  if(!state.drag||e.pointerId!==state.drag.id)return;
  state.drag=null;layout(true);
 }
 function dragKey(e){
  if(e.key==='Home'){e.preventDefault();reset();return}
  const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!direction)return;
  e.preventDefault();
  const rect=panel.getBoundingClientRect(),step=e.shiftKey?60:20;
  position={x:rect.left+step*direction[0],y:rect.top+step*direction[1]};
  layout(true);
 }
 panel.addEventListener('click',e=>{
  const button=e.target.closest('[data-reader]');
  if(!button)return;
  e.stopPropagation();
  switch(button.dataset.reader){
   case'read':speak(state.selection);break;
   case'dialog':speak(dialogText());break;
   case'stop':stop();break;
   case'smaller':resize(-.1);break;
   case'bigger':resize(.1);break;
  }
 });
 const handle=node('aeSpeechDrag');
 handle.addEventListener('pointerdown',dragStart);
 handle.addEventListener('keydown',dragKey);
 window.addEventListener('pointermove',dragMove,{passive:false});
 window.addEventListener('pointerup',dragEnd);
 window.addEventListener('pointercancel',dragEnd);
 window.addEventListener('blur',()=>{if(state.drag){state.drag=null;layout(true)}});
 window.addEventListener('resize',()=>layout(),{passive:true});
 window.visualViewport?.addEventListener('resize',()=>layout(),{passive:true});
 document.addEventListener('selectionchange',captureSelection);
 document.addEventListener('pointerup',captureSelection);
 document.addEventListener('keyup',captureSelection);
 const dialogHost=node('dialogRoot');
 if(dialogHost){
  new MutationObserver(()=>{
   const dialog=currentDialog();
   if(dialog!==state.dialog){state.dialog=dialog;state.selection='';}
   refresh();
  }).observe(dialogHost,{childList:true,subtree:true});
 }
 window.ARQUIVO_SPEECH={
  refresh,stop,clear,reset,
  sample:()=>speak('Durante a rodada, leia o efeito da habilidade e escolha sua ação. As regras continuam disponíveis para consulta.'),
  readSelection:()=>speak(state.selection),
  readDialog:()=>speak(dialogText())
 };
 refresh();
})();