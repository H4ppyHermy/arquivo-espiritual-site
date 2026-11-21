/* CBB — organização visual da leitura.
   Helpers de apresentação: preservam texto, valores e mecânicas originais. */
(function(global){
 'use strict';
 const clean=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[*_\x60]/g,'').trim();
 const escape=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 // Todas as cores são herdadas da paleta selecionada pelo jogador.
 const glyphs=Object.freeze({
  core:'◆',action:'▸',resource:'◈',test:'◇',effect:'✦',risk:'⚑',limit:'!',neutral:'·'
 });
 function category(title,kind='heading'){
  const x=clean(title).replace(/^[✱✦✧❖▸▹►]\s*/,'');
  if(/^(?:gatilho|ativacao|efeito|resultado|beneficio|consequencia|ao usar|ao sofrer|quando usar)\b/.test(x))
   return kind==='definition'?'effect':'action';
  if(/^(?:custo|consumo|recurso|alma|vida|estabilidade|recuperacao|descanso|meditacao|tratamento|recomposicao)\b/.test(x))
   return 'resource';
  if(/^(?:requisito|limite|restricao|excecao|observacao|duracao)\b/.test(x))
   return 'limit';
  if(/^(?:nivel|exposicao|condicao|debuff|penalidade|desgaste|falha|pavor|critico|morte|desmaiado|acorrentado|pressionado|risco|hollowficacao)\b/.test(x))
   return 'risk';
  if(/^(?:teste|testes|dados|dado|ra\b|rt\b|rb\b|dt\b|dificuldade|rolagem|teste-clash|resistencia|dano-base|dano\b|acerto)\b/.test(x))
   return 'test';
  if(/^(?:fase|fases|acao|acoes|reacao|defesa|ataque|combate|movimentacao|preparacao|distancia|duelo|desfecho)\b/.test(x))
   return 'action';
  if(/^(?:identidade|fundamentos|introducao|visao geral|estrutura|criacao|classes|racas|habilidades|tecnicas)\b/.test(x))
   return 'core';
  return 'neutral';
 }
 function marker(title,kind='heading'){
  const tone=category(title,kind);
  return {tone,symbol:glyphs[tone]};
 }
 const safePrefix=prefix=>String(prefix||'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,85);
 const headingId=(prefix,index)=>'ae-read-'+safePrefix(prefix)+'-'+Number(index);
 const removeMarkdownHeading=x=>String(x||'').replace(/^#{1,6}\s+/,'').replace(/^[✱✦✧❖▸▹►]\s*/,'').trim();
 function headings(source,chapterTitle=''){
  const rows=String(source||'').replace(/\r\n?/g,'\n').split('\n');
  const results=[];let inCode=false,firstNonEmpty=true;
  for(const row of rows){
   const line=row.trim(),heading=line.match(/^(#{1,6})\s+(.+)$/);
   if(line.startsWith(String.fromCharCode(96).repeat(3))){inCode=!inCode;continue}
   if(inCode||!line)continue;
   if(firstNonEmpty){
    firstNonEmpty=false;
    if(clean(removeMarkdownHeading(line))===clean(chapterTitle))continue;
   }
   const named=line.match(/^[✱✦✧❖▸▹►]\s*(.{2,110})$/);
   const upper=line.length<70&&/^[\p{Lu}\p{N}\s&/–—'.-]+$/u.test(line)&&/[\p{Lu}]/u.test(line);
   if(!heading&&!named&&!upper)continue;
   const title=heading?heading[2]:named?named[1]:line;
   const level=heading?Math.min(6,Math.max(2,heading[1].length+1)):3;
   results.push({index:results.length,title,level,...marker(title)});
  }
  return results;
 }
 function outline(source,title,prefix){
  const id=safePrefix(prefix);
  if(!id)return '';
  const entries=headings(source,title).filter(h=>h.level<=5);
  if(entries.length<2)return '';
  return '<details class="ae-book-outline">'+
   '<summary><span class="ae-book-outline-glyph" aria-hidden="true">⌑</span>'+
   '<strong>NESTE CAPÍTULO</strong><span class="ae-book-outline-count">'+entries.length+' tópicos</span>'+
   '<span class="ae-book-outline-chevron" aria-hidden="true">⌄</span></summary>'+
   '<nav class="ae-book-outline-links" aria-label="Ir diretamente a uma seção de '+escape(title)+'">'+
   entries.map(item=>'<a class="ae-book-outline-link ae-book-outline-link--'+item.tone+
    (item.level>=4?' is-nested':'')+'" href="#'+headingId(id,item.index)+'">'+
    '<span class="ae-book-outline-item-symbol" aria-hidden="true">'+item.symbol+'</span>'+
    '<span>'+escape(item.title)+'</span></a>').join('')+
   '</nav></details>';
 }
 global.ARQUIVO_BIBLIOTECA_LEITURA=Object.freeze({category,marker,headings,outline,headingId});
})(window);
