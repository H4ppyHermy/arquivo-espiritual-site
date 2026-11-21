/* Detecta builds novos do GitHub Pages sem recarregar fichas durante o combate. */
(function(){
 'use strict';
 if(window.ARQUIVO_SITE_UPDATE)return;

 const home=new URL('./',document.baseURI);
 const indexUrl=new URL('index.html',home);
 const buildUrl=new URL('site-version.json',home);
 const pollInterval=90000;
 let installedSignature='';
 let installedRevision='';
 let lastCheck=0;
 let checking=false;
 let updateAvailable=false;
 let overlay=null;
 let badge=null;
 let priorFocus=null;

 // Assinatura dos recursos carregados nesta aba, independente do conteúdo mutável da ficha.
 function assetSignature(root){
  return Array.from(root.querySelectorAll('script[src],link[rel="stylesheet"][href]'))
   .map(node=>{
    const name=node.tagName.toLowerCase();
    const raw=node.getAttribute(name==='script'?'src':'href')||'';
    return name+':'+raw;
   }).join('\n');
 }
 installedSignature=assetSignature(document);

 function hideModal(){
  if(!overlay)return;
  overlay.remove();overlay=null;
  document.removeEventListener('keydown',onModalKeydown,true);
  if(priorFocus?.isConnected&&typeof priorFocus.focus==='function')priorFocus.focus({preventScroll:true});
 }
 function onModalKeydown(event){
  if(!overlay)return;
  const actions=Array.from(overlay.querySelectorAll('button'));
  if(event.key==='Escape'){event.preventDefault();dismiss();return}
  if(event.key!=='Tab'||!actions.length)return;
  const first=actions[0],last=actions[actions.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }
 function reloadFresh(){
  const url=new URL(window.location.href);
  url.searchParams.set('ae_updated',Date.now().toString(36));
  window.location.replace(url.toString());
 }
 function dismiss(){
  hideModal();
  if(badge)return;
  badge=document.createElement('button');badge.type='button';
  badge.className='ae-site-update-badge';badge.textContent='ATUALIZAÇÃO DISPONÍVEL';
  badge.setAttribute('aria-label','Abrir aviso de atualização do site');
  badge.addEventListener('click',showModal);
  document.body.appendChild(badge);
 }
 function showModal(){
  if(overlay||!document.body)return;
  badge?.remove();badge=null;
  priorFocus=document.activeElement;
  overlay=document.createElement('div');overlay.className='ae-site-update-overlay';
  overlay.innerHTML=
   '<section class="ae-site-update-modal" role="dialog" aria-modal="true" aria-labelledby="ae-update-title" aria-describedby="ae-update-description">'+
    '<span class="ae-site-update-kicker">NOVA VERSÃO DISPONÍVEL</span>'+
    '<h2 id="ae-update-title">ATUALIZE A PÁGINA</h2>'+
    '<p id="ae-update-description">O site recebeu uma atualização enquanto esta aba estava aberta. Recarregue para usar a versão mais recente. Salve alterações em andamento antes de atualizar.</p>'+
    '<div class="ae-site-update-actions">'+
      '<button class="ae-site-update-reload" type="button" data-ae-update-reload>RECARREGAR AGORA</button>'+
      '<button type="button" data-ae-update-later>MAIS TARDE</button>'+
    '</div></section>';
  overlay.querySelector('[data-ae-update-reload]').addEventListener('click',reloadFresh);
  overlay.querySelector('[data-ae-update-later]').addEventListener('click',dismiss);
  document.body.appendChild(overlay);
  document.addEventListener('keydown',onModalKeydown,true);
  overlay.querySelector('[data-ae-update-reload]').focus({preventScroll:true});
 }
 function announce(){
  if(updateAvailable)return;
  updateAvailable=true;
  showModal();
 }
 async function readCurrentPage(){
  try{
   const url=new URL(indexUrl.href);
   url.searchParams.set('_version_check',Date.now().toString(36));
   const response=await fetch(url.href,{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)return null;
   const html=await response.text();
   if(!/<!doctype html|<html/i.test(html))return null;
   const remote=new DOMParser().parseFromString(html,'text/html');
   return assetSignature(remote);
  }catch(e){return null}
 }
 async function readBuildRevision(){
  try{
   const url=new URL(buildUrl.href);
   url.searchParams.set('_version_check',Date.now().toString(36));
   const response=await fetch(url.href,{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)return '';
   const value=await response.json();
   return typeof value?.version==='string'&&value.version.length<120?value.version:'';
  }catch(e){return ''}
 }
 async function checkNow(){
  if(checking||updateAvailable||document.hidden)return false;
  checking=true;lastCheck=Date.now();
  try{
   const [remoteSignature,remoteRevision]=await Promise.all([readCurrentPage(),readBuildRevision()]);
   if(remoteSignature&&remoteSignature!==installedSignature){announce();return true}
   if(remoteRevision){
    if(installedRevision&&installedRevision!==remoteRevision){announce();return true}
    if(!installedRevision)installedRevision=remoteRevision;
   }
   return false;
  }finally{checking=false}
 }
 function onReturn(){
  if(document.hidden||Date.now()-lastCheck<20000)return;
  checkNow().catch(()=>{});
 }
 function start(){
  if(!installedSignature)return;
  // Uma aba servida por cache antigo é detectada logo após abrir.
  setTimeout(()=>{checkNow().catch(()=>{})},4500);
  setInterval(()=>{checkNow().catch(()=>{})},pollInterval);
  document.addEventListener('visibilitychange',onReturn);
  window.addEventListener('focus',onReturn);
  window.addEventListener('online',onReturn);
 }
 window.ARQUIVO_SITE_UPDATE=Object.freeze({checkNow,get updateAvailable(){return updateAvailable}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})(window);
