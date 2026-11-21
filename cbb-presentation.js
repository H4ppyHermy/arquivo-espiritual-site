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
   description:compact(body,usage,pool)
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
 global.ARQUIVO_CBB_PRESENTATION=Object.freeze({model,meta,dice,compact,phaseOf});
})(typeof window!=='undefined'?window:globalThis);
