/* Representações visuais genéricas para recursos.
   [barra:2/3] = segmentos, [marca:1] = marca, [contador:3/5] = fichas redondas.
   Não executa regras nem altera recursos de personagens. */
(function(){
 'use strict';
 const TYPES=Object.freeze({barra:'barra',marca:'marca',contador:'contador'});
 const RESOURCE_RE=/\[(barra|marca|contador):\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?\s*\]/gi;
 function valid(filled,total,kind='barra'){
  return Object.hasOwn(TYPES,kind)&&
   Number.isInteger(filled)&&Number.isInteger(total)&&
   total>=1&&total<=20&&filled>=0&&filled<=total;
 }
 function mark(text,markers,prefix='@@AEBAR'){
  if(!Array.isArray(markers))return String(text??'');
  return String(text??'').replace(RESOURCE_RE,(whole,type,a,b)=>{
   const kind=type.toLowerCase(),filled=Number(a);
   const total=b===undefined?(kind==='marca'?1:filled):Number(b);
   if(!valid(filled,total,kind))return whole;
   return prefix+(markers.push({inlineBar:true,kind,filled,total})-1)+'@@';
  });
 }
 function titleFor(kind,filled,total){
  const label=kind==='contador'?'contador':kind==='marca'?'marca':'marca';
  const plural=kind==='contador'?'contadores':'marcas';
  if(kind==='marca'&&total===1)return filled?'Marca disponível':'Marca indisponível';
  return filled===total
   ?filled+' '+(filled===1?label:plural)+' de recurso'
   :filled+' de '+total+' '+plural+' de recurso';
 }
 function render(marker){
  const kind=marker?.kind||'barra',filled=Number(marker?.filled),total=Number(marker?.total);
  if(!valid(filled,total,kind))return '';
  const title=titleFor(kind,filled,total);
  return '<span class="ae-inline-resource-bar ae-inline-resource--'+kind+'" role="img" aria-label="'+title+'" title="'+title+'">'+
   Array.from({length:total},(_,i)=>'<span class="ae-inline-resource-segment'+(i<filled?' is-filled':'')+'" aria-hidden="true"></span>').join('')+
   '</span>';
 }
 window.ARQUIVO_BARRAS_INLINE=Object.freeze({mark,render,valid,types:Object.freeze(['barra','marca','contador'])});
})();
