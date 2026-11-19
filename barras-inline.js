/* Barra visual inline para a Biblioteca, as fichas e o Armazém.
   Sintaxe: [barra:2] (duas marcas) ou [barra:2/5] (duas de cinco).
   O componente é puramente ilustrativo: não altera recursos ou fichas. */
(function(){
 'use strict';
 const BAR_RE=/\[barra:\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?\s*\]/gi;
 function valid(filled,total){
  return Number.isInteger(filled)&&Number.isInteger(total)&&total>=1&&total<=20&&filled>=0&&filled<=total;
 }
 function mark(text,markers,prefix='@@AEBAR'){
  if(!Array.isArray(markers))return String(text??'');
  return String(text??'').replace(BAR_RE,(whole,a,b)=>{
   const filled=Number(a),total=b===undefined?filled:Number(b);
   if(!valid(filled,total))return whole;
   return prefix+(markers.push({inlineBar:true,filled,total})-1)+'@@';
  });
 }
 function render(marker){
  const filled=Number(marker?.filled),total=Number(marker?.total);
  if(!valid(filled,total))return '';
  const title=filled===total
   ?filled+' '+(filled===1?'marca':'marcas')+' de recurso'
   :filled+' de '+total+' marcas de recurso';
  return '<span class="ae-inline-resource-bar" role="img" aria-label="'+title+'" title="'+title+'">'+
   Array.from({length:total},(_,i)=>'<span class="ae-inline-resource-segment'+(i<filled?' is-filled':'')+'" aria-hidden="true"></span>').join('')+
   '</span>';
 }
 window.ARQUIVO_BARRAS_INLINE=Object.freeze({mark,render,valid});
})();
