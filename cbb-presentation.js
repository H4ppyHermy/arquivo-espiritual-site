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
    const matches=[...s.matchAll(/,\s*(?=(?:aumente|reduza|role|ignore|imponha|receba|preencha|utilize|permita|escolha|realize|desloque|restaure|ganhe|perca|aplique|conceda|prolongue|encerre|dobre|acrescente|faça|sofra|mantenha|continue|pode|interrompa|consuma|marque|apague|torne|concentre|amplifique|atravesse|diminua|interponha|manifeste|libere|seu próximo ataque|seus ataques|o próximo ataque|o alvo|os alvos)\b)/giu)];
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


 // Conjuntos de regras de classes/raças: somente o bloco da técnica recebe
 // o modelo editorial; identidade e modificadores de grupos não são reescritos.
 function standardizeRuleSections(content){
  const source=String(content||'').replace(/\r\n?/g,'\n');
  const lines=source.split('\n'),out=[];
  let i=0;
  while(i<lines.length){
   const head=lines[i].match(/^(#{2,3})\s+(.+)$/);
   if(!head){out.push(lines[i++]);continue}
   const heading=head[2].trim();
   out.push(lines[i++]);
   if(/^identidade$/i.test(heading))continue;
   const parts=[];
   while(i<lines.length&&!/^#{2,3}\s+/.test(lines[i])&&!/^(?:Corpo|Mente|Espírito)\s+—\s+/i.test(lines[i]))parts.push(lines[i++]);
   const raw=parts.join('\n').trim();
   const cleaned=raw?standardize(raw):'';
   if(cleaned){out.push('',cleaned,'')}
  }
  return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
 }
 // Itens usam o mesmo padrão de consequência/efeito, com estados da arma
 // explícitos quando fornecidos pelo texto original.
 function standardizeItem(content){
  const original=String(content||'').trim();
  if(!original||STANDARD_LINE.test(original)||/^(?:Descrição|Forma selada|Shikai|Bankai)\s+—\s+/im.test(original))return original;
  const base=standardize(original);
  return base.split('\n').flatMap(line=>{
   const match=line.match(/^Efeito — (.*)$/);
   if(!match)return [line];
   const text=match[1];
   if(/;\s*(?=(?:Shikai|Bankai)\b)/i.test(text))return text.split(/;\s*(?=(?:Shikai|Bankai)\b)/i).map(part=>/^(?:Shikai|Bankai)\b/i.test(part)?part.match(/^(Shikai|Bankai)/i)[1]+' — '+part:'Efeito — '+part);
   if(/^(?:Os bônus não|Esses bônus não|Bônus não|Não acumulam|Os bônus se substituem|Não se acumulam)/i.test(text))
    return ['Restrição — '+text];
   if(/^(?:Forma selada|Em (?:sua )?forma selada|Em estado selado|Espada selada|Espadas seladas|Lâminas seladas)/i.test(text))
    return ['Forma selada — '+text];
   if(/^(?:Com a Shikai|Com Shikai|Shikai\b|Durante a Shikai)/i.test(text))
    return ['Shikai — '+text];
   if(/^(?:Com a Bankai|Com Bankai|Bankai\b|Durante a Bankai)/i.test(text))
    return ['Bankai — '+text];
   if(/^(?:Traje |Vestuário|Camisa |Sua própria|Objeto de afeto|Zanpakutō de |Espada de |Vestuário de |Quatro usos|Um traje)/i.test(text))
    return [(text.startsWith('Quatro usos')?'Recurso':'Descrição')+' — '+text];
   return [line];
  }).join('\n').trim();
 }


 // Recursos de classe: o cabeçalho comunica capacidade, enquanto as opções
 // identificadas por marcadores continuam como regras independentes em Extras.
 // A transformação ocorre somente na apresentação; o texto original não muda.
 const RESOURCE_TOKEN=/\[(barra|marca|contador|sequencia)\s*:\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?\s*\]/i;
 const RESOURCE_OPTION=/^\s*\[(barra|marca|contador|sequencia)\s*:\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?\s*\]\s*(.*)$/i;
 const resourceUnit=(kind,amount)=>{
  if(kind==='contador')return amount===1?'contador':'contadores';
  if(kind==='sequencia')return amount===1?'nível':'níveis';
  return amount===1?'marca':'marcas';
 };
 function resourceSections(content,fallbackName=''){
  const original=String(content||'').replace(/\r\n?/g,'\n');
  // A representação numérica deve substituir SOMENTE os marcadores que
  // descrevem o recurso. Marcadores dentro de efeitos preservam seu significado.
  const lines=original.replace(/([.!?])\s+(?=\[(?:barra|marca|contador|sequencia)\s*:\s*\d)/gi,'$1\n').split('\n');
  const firstIndex=lines.findIndex(line=>{
   const m=line.match(RESOURCE_TOKEN);
   return !!m&&!RESOURCE_OPTION.test(line)&&
    /^(?:\s*(?:Recurso|Efeito)\s+—\s*)?(?:Possui|Cada adversário pode acumular|Você possui|O personagem possui)/i.test(line);
  });
  const item=firstIndex>=0?lines[firstIndex].match(RESOURCE_TOKEN):null;
  if(!item){
   return {description:original.trim(),resource:null,extras:[]};
  }
  const kind=item[1].toLowerCase(),max=Number(item[3]||item[2]);
  if(!Number.isInteger(max)||max<1||max>20)return {description:original.trim(),resource:null,extras:[]};
  const header=lines[firstIndex];
  const after=header.slice(header.indexOf(item[0])+item[0].length);
  const named=after.match(/^\s+de\s+(?:\*\*)?([^\n.;]+?)(?:\*\*)?(?:[.;]|$)/i);
  const name=(named?named[1].replace(/\*\*/g,'').replace(/\s+por\s+(?:cena|rodada)$/i,'').trim():String(fallbackName||'').trim())||'Recurso';
  const resource={name,kind,capacity:max,label:max+' '+resourceUnit(kind,max)};
  const main=[],extras=[];
  let current=null;
  for(let i=0;i<lines.length;i++){
   const line=lines[i];
   const option=line.match(RESOURCE_OPTION);
   if(option){
    const optionKind=option[1].toLowerCase(),amount=Number(option[2]),total=Number(option[3]||max);
    // Não confundir marcadores de outra regra com as opções do recurso.
    if(optionKind===kind&&amount>=1&&amount<=20&&total>=amount&&total<=20){
     const body=option[4].trim();
     const namedOption=body.match(/^\*\*([^*]+?)\s+—\*\*\s*(.*)$/);
     const title=namedOption?namedOption[1].trim():'';
     current={kind,amount,total,title,description:namedOption?namedOption[2].trim():body};
     extras.push(current);
     continue;
    }
   }
   if(current&&/^\s*(?:#{2,3}\s+|(?:Corpo|Mente|Espírito)\s+—\s+)/i.test(line))current=null;
   if(current){
    current.description+=(current.description?'\n':'')+line;
   }else if(i===firstIndex){
    // Linha introdutória pura (Possui [barra:3/3] de Têmpera) já está
    // representada no quadro de capacidade. Conservar qualquer outra regra.
    const simple=/^\s*(?:Recurso\s+—\s*)?Possui\s+\[(?:barra|marca|contador|sequencia):\s*\d+(?:\s*\/\s*\d+)?\]\s+de\s+(?:\*\*)?[^.;\n]+(?:\*\*)?\.?\s*$/i.test(line);
    if(!simple){
     main.push(line.replace(item[0],'**'+resource.label+'**'));
    }
   }else{
    main.push(line);
   }
  }
  // Por segurança, não segmentar quando não existe nenhuma opção.
  const clean=main.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  return {description:clean||(!extras.length?original.trim():''),resource,extras:extras.map(o=>({
    ...o,description:o.description.replace(/\n{3,}/g,'\n\n').trim()
  }))};
 }
 function resourceInfo(m){
  const r=m?.resource;
  if(!r)return '';
  return '<div class="ae-cbb-resource" role="group" aria-label="Capacidade do recurso">'+
   '<span class="ae-cbb-resource-label">RECURSO</span>'+
   '<strong class="ae-cbb-resource-name">'+escape(r.name)+'</strong>'+
   '<span class="ae-cbb-resource-capacity"><small>CAPACIDADE</small><b>'+escape(r.label)+'</b></span>'+
   '</div>';
 }
 function extrasPanel(m,format){
  const list=m?.extras||[];
  if(!list.length||typeof format!=='function')return '';
  return '<details class="ae-cbb-extras">'+
   '<summary><strong>EXTRAS</strong><small>'+list.length+' '+(list.length===1?'opção':'opções')+' de recurso</small>'+
   '<span class="ae-cbb-extras-arrow" aria-hidden="true">⌄</span></summary>'+
   '<div class="ae-cbb-extra-list">'+list.map((entry,i)=>{
    const label=entry.kind==='sequencia'?'NÍVEL '+entry.amount:
     entry.amount+' '+resourceUnit(entry.kind,entry.amount).toLocaleUpperCase('pt-BR');
    const title=entry.title?'<strong class="ae-cbb-extra-title">'+escape(entry.title)+'</strong>':'';
    return '<div class="ae-cbb-extra-row" role="group" aria-label="'+escape(label+(entry.title?' · '+entry.title:''))+'">'+
     '<span class="ae-cbb-extra-amount">'+escape(label)+'</span>'+
     '<div class="ae-cbb-extra-rule">'+title+
      (entry.description?'<div class="ae-cbb-extra-effect">'+format(entry.description)+'</div>':'')+
     '</div></div>';
   }).join('')+'</div></details>';
 }
 function renderRuleSections(content,format){
  if(typeof format!=='function')return '';
  const source=standardizeRuleSections(content);
  const matches=[...source.matchAll(/^#{2,3}\s+[^\n]+/gm)];
  if(!matches.length)return format(source);
  let output='',cursor=0;
  for(let i=0;i<matches.length;i++){
   const start=matches[i].index,end=i+1<matches.length?matches[i+1].index:source.length;
   if(start>cursor)output+=format(source.slice(cursor,start));
   const section=source.slice(start,end),split=section.indexOf('\n');
   if(split<0){output+=format(section);cursor=end;continue;}
   const head=section.slice(0,split),details=section.slice(split+1);
   const model=resourceSections(details,head.replace(/^#{2,3}\s+/,''));
   output+=format(head+'\n'+model.description)+resourceInfo(model)+extrasPanel(model,format);
   cursor=end;
  }
  if(cursor<source.length)output+=format(source.slice(cursor));
  return output;
 }

 function model(entry,{warehouse=false}={}){
  const body=String((warehouse?entry?.content:entry?.description)||'');
  const pool=poolOf(body);
  const phase=phaseOf(entry,body);
  const usage=String(entry?.usage||'').trim();
  const arranged=resourceSections(standardize(compact(body,usage,pool)),entry?.name||entry?.title||'');
  return {
   ...arranged,
   kind:kindOf(entry,warehouse),
   cost:costOf(entry,warehouse),
   phase:phase.label,phaseSource:phase.source,
   usage, pool,
   dice:pool?(pool.kind==='dano'?'RA + ':'')+
    (pool.count===1?'1':pool.count)+'d'+pool.faces:'',
   description:arranged.description
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
 global.ARQUIVO_CBB_PRESENTATION=Object.freeze({model,meta,dice,compact,standardize,standardizeRuleSections,standardizeItem,resourceSections,resourceInfo,extrasPanel,renderRuleSections,phaseOf});
})(typeof window!=='undefined'?window:globalThis);
