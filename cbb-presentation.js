/* Apresentação única de habilidades, técnicas e seus dados, em fichas e Armazém.
   Dados originais são preservados. A compactação só remove duplicações estritas. */
(function(global){
 'use strict';
 const labels=Object.freeze({preparacao:'Preparação',distancia:'Distância',duelo:'Duelo',desfecho:'Desfecho'});
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clean=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const regexEscape=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const phaseOf=(entry,body)=>{
  const explicit=clean(entry?.costConfig?.phase||entry?.phase||'').trim();
  if(labels[explicit])return {label:labels[explicit],source:'explicit'};
  const beginning=clean(String(body||'').slice(0,460).replace(/[\n\r]/g,' '));
  // Reconhecer somente o momento da ação. "Até o próximo Desfecho" é duração,
  // não a fase em que se utiliza a técnica.
  const phase=beginning.match(/(?:\b(?:na|durante a|no inicio da|ao inicio da)\s+fase\s+(?:de\s+|da\s+|do\s+)?|\bfase\s*:\s*|\bataque(?:s)?\s+(?:de|a)\s+)(preparacao|distancia|duelo|desfecho)\b/);
  if(phase)return {label:labels[phase[1]],source:'text'};
  if(/\bataque(?:s)?\s+a\s+distancia\b/.test(beginning)||
     /\b(?:atacar|disparar)\s+a\s+distancia\b/.test(beginning))
   return {label:'Distância',source:'text'};
  return {label:'Conforme efeito',source:'unknown'};
 };
 const poolOf=body=>global.ARQUIVO_CBB_ENGINE?.abilityPool?.({description:body})||null;
 const costOf=(entry,isWarehouse)=>{
  const raw=isWarehouse?String(entry?.cost||'').trim():Number(entry?.cost||0);
  if(!isWarehouse)return Number.isFinite(raw)&&raw>0?raw+' ALMA':'SEM CUSTO';
  if(!raw)return 'NÃO INFORMADO';
  if(/^\d+\s*alma$/i.test(raw))return raw.replace(/\s*alma$/i,' ALMA');
  return raw;
 };
 const kindOf=(entry,isWarehouse)=>isWarehouse?
  (entry?.category==='Técnicas'?'Técnica':'Habilidade'):
  (entry?.libraryType==='tecnica'?'Técnica':'Habilidade');
 function compact(body,usage,pool){
  const original=String(body||'').trim(),limit=String(usage||'').trim();
  let output=original;
  if(limit&&limit.length<=100){
   const match=new RegExp('^\\s*'+regexEscape(limit)+'\\s*[,;:]\\s*','i');
   if(match.test(output)){
    output=output.replace(match,'');
    output=output.replace(/^[a-zà-ÿ]/,letter=>letter.toLocaleUpperCase('pt-BR'));
   }
  }
  // O limite já aparece no cartão em um indicador separado. Uma linha
  // editorial idêntica não precisa aparecer novamente na leitura.
  if(limit){
   const escaped=regexEscape(limit.replace(/\.$/,''));
   const duplicate=new RegExp('(?:^|\\n)Limite\\s+—\\s*'+escaped+'\\.?\\s*(?=\\n|$)','i');
   output=output.replace(duplicate,'').replace(/^\s*\n/,'').trim();
  }
  // Somente linhas que não dizem nada além do mesmo dado destacado no cabeçalho.
  if(pool?.kind==='dano'){
   const lines=output.split(/\r?\n/);
   const count=String(pool.count)+'d'+String(pool.faces);
   if(lines.some(line=>line.trim()&&!/^\s*>?\s*dano\s*:/i.test(line))){
    output=lines.filter(line=>{
     const m=line.match(/^\s*>?\s*(?:\*\*)?dano(?:\*\*)?\s*:\s*\+?\s*(\d{1,2}\s*d\s*\d{1,2})\s*$/i);
     return !m||m[1].replace(/\s/g,'').toLowerCase()!==count.toLowerCase();
    }).join('\n').replace(/\n\s*\n\s*\n/g,'\n\n').trim();
   }
  }
  return output||original;
 }

 // O mesmo padrão editorial vale para conteúdos oficiais, personalizados e novos.
 // Não interpreta valores, não altera mecânicas e não remove ressalvas do texto.
 const STANDARD_LINE=/^(?:Requisito|Gatilho|Ativação|Efeito|Recurso|Consumo|Condição|Consequência|Limite|Restrição|Duração|Observação|Amplificação|Encantamento|Arte escolhida|Comando de liberação)\s+—\s+/im;
 function standardize(source){
  const original=String(source??'').replace(/\r\n?/g,'\n').trim();
  if(!original||STANDARD_LINE.test(original))return original;
  const segments=[];
  const limits=[];
  const sentenceSplit=/(?<=[.!?])\s+(?=(?:[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]|[>]|(?:\[(?:barra|contador|marca|sequencia):)))/u;
  const capitalize=t=>String(t||'').trim().replace(/^([a-zà-ÿ])/u,ch=>ch.toLocaleUpperCase('pt-BR'));
  const push=(type,text)=>{
   const value=capitalize(text);
   if(!value)return;
   // Somente uma duração terminal inequívoca vira linha própria; durações
   // múltiplas ou cláusulas encadeadas permanecem junto à regra original.
   const duration=/(.+?)\s+(até (?:o término da fase|o fim da fase|o próximo Desfecho|o segundo Desfecho após (?:o ataque|o confronto|a utilização|o acerto)|o fim da cena|o término da cena|o fim da sessão|o término da sessão|o Desfecho da rodada seguinte|a próxima rodada|a próxima fase))\.$/i.exec(value);
   if(duration&&['Efeito','Ativação','Condição','Consequência'].includes(type)){
    segments.push(type+' — '+duration[1].replace(/[.,;:]$/,'')+'.');
    segments.push('Duração — '+capitalize(duration[2])+'.');
    return;
   }
   segments.push(type+' — '+value);
  };
  function process(text,depth=0,first=false){
   let s=String(text||'').trim();
   if(!s||depth>7)return;
   // Linhas de dados, encantamentos e opções não são reescritas.
   if(/^(?:>|[-*]\s|\[(?:barra|contador|marca|sequencia):|[IVX]{1,4}\s+[—-])/i.test(s)){
    segments.push(s);return;
   }
   const existing=s.match(/^(?:\*\*)?(Amplificação|Encantamento|Comando de liberação|Arte escolhida)(?::\*\*|\*\*:|:)\s*(.+)$/i);
   if(existing){
    push(existing[1],existing[2]);return;
   }
   const limit=s.match(/^(Uma vez por (?:rodada|cena|sessão|turno|fase|Hollowficação)|Uma vez a cada [^,]{2,35})\s*,\s*(.+)$/i);
   if(limit){
    limits.push(capitalize(limit[1])+'.');
    process(limit[2],depth+1,first);return;
   }
   const requires=s.match(/^((?:Com\s+[^,]{2,110}|Somente se\s+[^,]{2,110}|Durante a Hollowficação|Durante o Descontrole))\s*,\s*(.+)$/i);
   if(requires&&/^(?:com|somente se|durante)/i.test(requires[1])){
    push('Requisito',requires[1]+'.');
    process(requires[2],depth+1,first);return;
   }
   if(/^(?:Caso|Se|Em caso)\b/i.test(s)){push('Condição',s);return}
   if(/^(?:Após|Depois|Ao término|Ao fim|Ao final|Quando terminar)\b/i.test(s)){push('Consequência',s);return}
   if(/^(?:Limite de|No máximo|Máximo de|Não gaste mais)\b/i.test(s)){push('Limite',s);return}
   if(/^(?:Não pode|Não causa|Esse deslocamento não|Bloquead[oa]|Recurso narrativo indisponível|Somente o mestre|Não impede|Não ignora)\b/i.test(s)){push('Restrição',s);return}
   if(/^(?:Esse dado|Esses valores|As relações|A sequência|Os benefícios|Isso não)\b/i.test(s)){push('Observação',s);return}
   if(/^(?:Possui\s+\[(?:barra|contador|marca|sequencia):|Cada adversário pode acumular)\b/i.test(s)){
    push('Recurso',s);return;
   }
   if(/^(?:Ao|Quando|Sempre que|No início|No começo|Na abertura)\b/i.test(s)){
    // Uma lista de recursos pode conter vírgulas: dividir apenas quando
    // a parte seguinte começa por um verbo de efeito, não no primeiro item.
    const matches=[...s.matchAll(/,\s*(?=(?:aumente|reduza|role|ignore|imponha|receba|preencha|utilize|permita|escolha|realize|desloque|restaure|ganhe|perca|aplique|conceda|prolongue|encerre|dobre|acrescente|faça|sofra|mantenha|continue|pode|interrompa|consuma|marque|apague|torne|concentre|amplifique|atravesse|diminua|interponha|manifeste|libere|o alvo|os alvos)\b)/giu)];
    const comma=matches.length?matches[matches.length-1].index:-1;
    if(comma>8&&comma<210&&s.length-comma>10){
     push('Gatilho',s.slice(0,comma).replace(/[.,;:]$/,'')+'.');
     process(s.slice(comma+1),depth+1,false);
    }else push('Gatilho',s);
    return;
   }
   if(/^(?:Utilize sua (?:ação principal|reação)|Na fase de (?:Preparação|Distância|Duelo|Desfecho)|Gaste \d+|Apague os espaços)\b/i.test(s)){
    push(/^Gaste|^Apague/i.test(s)?'Consumo':'Ativação',s);return;
   }
   if(/^(?:Enquanto|Durante esse período|Durante a manifestação)\b/i.test(s)){push('Efeito',s);return}
   push('Efeito',s);
  }
  const paragraphs=original.split(/\n\s*\n/);
  for(const [i,paragraph] of paragraphs.entries()){
   const lines=paragraph.split('\n').map(l=>l.trim()).filter(Boolean);
   if(i&&segments.length&&segments[segments.length-1]!=='')segments.push('');
   for(const line of lines){
    // Encantamentos, falas e dados entre aspas não devem ser segmentados.
    const quoted=/^>|^(?:\*\*)?Encantamento\s*:/i.test(line);
    const parts=quoted?[line]:line.split(sentenceSplit);
    for(const part of parts)process(part,0,i===0);
   }
  }
  if(limits.length){
   if(segments.length&&segments[segments.length-1]!=='')segments.push('');
   for(const l of limits)push('Limite',l);
  }
  return segments.join('\n').replace(/\n{3,}/g,'\n\n').trim()||original;
 }

 function model(entry,{warehouse=false}={}){
  const body=String((warehouse?entry?.content:entry?.description)||'');
  const pool=poolOf(body);
  const phase=phaseOf(entry,body);
  const usage=String(entry?.usage||'').trim();
  return {
   kind:kindOf(entry,warehouse),
   cost:costOf(entry,warehouse),
   phase:phase.label,phaseSource:phase.source,
   usage, pool,
   dice:pool?(pool.kind==='dano'?'RA + ':'')+
    (pool.count===1?'1':pool.count)+'d'+pool.faces:'',
   description:standardize(compact(body,usage,pool))
  };
 }
 function meta(m,{warehouse=false}={}){
  return '<div class="ae-ficha-ability-meta ae-unified-ability-meta">'+
   '<span class="ae-unified-kind">'+escape(m.kind.toLocaleUpperCase('pt-BR'))+'</span>'+
   '<strong class="ae-ability-cost'+(m.cost==='NÃO INFORMADO'?' is-unspecified':'')+'">'+escape(m.cost)+'</strong>'+
   '<span class="ae-ability-phase" title="'+(m.phaseSource==='unknown'?'Esta habilidade não especifica uma fase fixa.':'Fase indicada pelo efeito ou pelo mestre.')+'">Fase: '+escape(m.phase)+'</span>'+
   (m.usage?'<span class="ae-ability-usage">Uso: '+escape(m.usage)+'</span>':'')+'</div>';
 }
 function dice(m){
  if(!m.pool)return '';
  const label=m.pool.kind==='dano'?'Dano':'Recuperação';
  return '<div class="ae-ability-roll-note ae-unified-ability-dice" aria-label="'+label+'">'+
   '<span aria-hidden="true">⚄</span><strong>'+escape(m.dice)+'</strong>'+
   '<small>'+label+(m.pool.kind==='dano'?' adicional':'')+'</small></div>';
 }
 global.ARQUIVO_CBB_PRESENTATION=Object.freeze({model,meta,dice,compact,standardize,phaseOf});
})(typeof window!=='undefined'?window:globalThis);
