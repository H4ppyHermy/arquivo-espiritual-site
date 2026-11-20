/* Mesa CBB — única instância por página, sem temporizadores ou lógica de personagem. */
(function(global){
 'use strict';
 const api=global.ARQUIVO_INTERNAL,engine=global.ARQUIVO_CBB_ENGINE;
 if(!api||!engine)return;
 const E=api.esc,groups=engine.GROUPS,skillNames=Object.values(groups).flat();
 const lastResults=new Map(),lastAttacks=new Map(),resistanceByPhase=new Map(),statusBySheet=new Map(),modeBySheet=new Map();
 const phaseName={preparacao:'Preparação',distancia:'Distância',duelo:'Duelo',desfecho:'Desfecho'};
 let busy=false;
 const sheet=()=>api.db.sheets.find(s=>s.id===api.currentSheet)||null;
 const enc=(s)=>E(String(s??''));
 const field=(root,name)=>root?.querySelector('[data-cbb-field="'+name+'"]');
 const read=(root,name,otherwise='')=>field(root,name)?.value??otherwise;
 const number=(root,name,otherwise=0)=>Number(read(root,name,otherwise));
 const opts=(entries,value)=>entries.map(([id,label])=>'<option value="'+enc(id)+'"'+(String(id)===String(value)?' selected':'')+'>'+enc(label)+'</option>').join('');
 const on=()=>!!global.ARQUIVO_SYNC?.state?.enabled&&!!global.ARQUIVO_SYNC?.state?.identity?.id;
 const stateText=s=>statusBySheet.get(s.id)||'Pronto para a próxima ação.';
 function abilityActions(ab,index,ctx){
  if(!ctx?.canEdit || !ab || ab.origin?.auto)return '';
  const p=engine.abilityPool(ab),mode=ab.costConfig?.mode;
  const canPay=(Number(ab.cost)>0||mode==='activation') && ab.category!=='passive' && !ab.passive;
  const billingKey=String(ab.abilityId||ab.automation?.id||'legacy:'+index);
  const sh=sheet(),runtime=sh?.abilityRuntime?.billing?.[billingKey],scene=Number(sh?.combat?.scene||1);
  const active=mode==='activation'&&runtime?.active===true&&Number(runtime.scene)===scene;
  const locked=ab.unlock?.mode==='locked'&&!ctx.master;
  const requires=ab.costConfig?.requires||ab.unlock?.requires;
  const prerequisite=requires && !(sh?.abilityRuntime?.billing?.[requires]?.active===true&&Number(sh?.abilityRuntime?.billing?.[requires]?.scene)===scene);
  const out=[];
  if(canPay){
   const cmd=active?'deactivate':'ability';
   const label=active?'ENCERRAR LIBERAÇÃO':mode==='activation'?'ATIVAR · '+(Number(ab.cost)||0)+' ALMA':'UTILIZAR · '+Number(ab.cost)+' ALMA';
   out.push('<button type="button" class="ae-cbb-card-btn" data-cbb-command="'+cmd+'" data-cbb-index="'+index+'"'+(locked||prerequisite?' disabled':'')+'>'+enc(locked?'BLOQUEADA':prerequisite?'REQUER LIBERAÇÃO':label)+'</button>');
  }
  if(p)out.push('<button type="button" class="ae-cbb-card-btn ae-cbb-card-btn--secondary" data-cbb-command="abilityPool" data-cbb-index="'+index+'">ROLAR '+(p.kind==='dano'?'DANO':'CURA')+'</button>');
  return out.length?'<div class="ae-cbb-card-actions">'+out.join('')+'</div>':'';
 }
 function bossPanel(s,ctx){
  const b=s.boss;if(!b||!ctx.master)return '';
  const party=b.party||{},current=Number(party.current??party.base??7),scenario=b.scenario||{};
  const extra=Number(b.tempo?.extraMain||0);
  return '<section class="ae-cbb-boss" aria-label="Confronto de chefe">'+
   '<div class="ae-cbb-boss-head"><span class="ae-cbb-overline">ANDAR '+enc(b.floor||'?')+' · CONFRONTO</span>'+
    '<strong>'+enc(b.title||s.name)+'</strong>'+
    '<span class="ae-cbb-mini">'+(extra?'+'+extra+' ação principal/rodada':'Ação principal padrão')+'</span></div>'+
   '<div class="ae-cbb-boss-bar"><div><span class="ae-cbb-micro">JOGADORES</span><div class="ae-cbb-party">'+
     [6,7,8].map(n=>'<button type="button" data-cbb-command="party" data-cbb-party="'+n+'" class="'+(n===current?'is-active':'')+'" aria-pressed="'+(n===current)+'"'+(!on()?' disabled':'')+'>'+n+'</button>').join('')+
    '</div></div><div class="ae-cbb-boss-status"><span class="ae-cbb-micro">VIDA DO CHEFE</span><strong>'+enc(s.resources?.vida?.current)+' / '+enc(s.resources?.vida?.max)+'</strong></div></div>'+
   (scenario.name?'<details class="ae-cbb-boss-scenario"><summary>'+enc(scenario.name)+
    (scenario.trigger?' <small>· '+enc(scenario.trigger)+'</small>':'')+'</summary><p>'+enc(scenario.description||'')+'</p></details>':'')+
   '</section>';
 }
 function pill(label,value){return '<span class="ae-cbb-pill">'+enc(label)+' <b>'+enc(value)+'</b></span>'}
 function render(s,ctx={}){
  const c=s.combat||{},ex=s.exposures||{},phase=c.phase||'preparacao',res=s.resources||{},selectedMode=modeBySheet.get(s.id)||'teste';
  const disabled=!ctx.canEdit||!on();
  const lock=disabled?' disabled':'';
  const choices=skillNames.map(n=>[n,n+' · '+engine.groupOf(n)+' d'+(s.groups?.[engine.groupOf(n)]||4)+' + d'+(s.skills?.[n]||4)]);
  const abilityRolls=(s.abilities||[]).map((a,i)=>({a,i,p:engine.abilityPool(a)})).filter(x=>x.p);
  const abilityChoices=[['','Dado manual'],...abilityRolls.map(({a,i,p})=>[String(i),a.name+' · '+p.count+'d'+p.faces])];
  const result=lastResults.get(s.id);
  const last=lastAttacks.get(s.id);
  const resourceChoices=[['vida','Vida'],['estabilidade','Estabilidade'],['alma','Alma']];
  return '<section class="ae-cbb-mesa" aria-label="Mesa universal CBB" data-cbb-sheet="'+enc(s.id)+'">'+
   '<div class="ae-ficha-section-heading"><div class="ae-ficha-section-title"><h2>Mesa</h2></div><span class="ae-cbb-mode">CBB</span></div>'+
   bossPanel(s,ctx)+
   '<div class="ae-cbb-turnbar">'+pill('CENA',c.scene||1)+pill('RODADA',c.round||1)+pill('FASE',phaseName[phase]||phase)+
    '<button type="button" class="btn small" data-cbb-command="'+(phase==='desfecho'?'round':'phase')+'"'+lock+'>'+(phase==='desfecho'?'PRÓXIMA RODADA':'AVANÇAR FASE')+'</button></div>'+
   '<nav class="ae-cbb-modes" role="group" aria-label="Escolher modo da mesa">'+
    [['teste','TESTE'],['dano','DANO'],['resistencia','DEFESA'],['recuperacao','CURA'],['turno','TURNO'],['recursos','RECURSOS']].map(([mode,label])=>
     '<button type="button" data-cbb-mode="'+mode+'" aria-pressed="'+(selectedMode===mode)+'" class="'+(selectedMode===mode?'is-active':'')+'">'+label+'</button>').join('')+'</nav>'+
   (!ctx.canEdit?'<p class="ae-cbb-hint">Somente leitura: esta ficha não está vinculada à sua chave.</p>':!on()?'<p class="ae-cbb-hint">Conecte uma chave de jogador ou mestre para rolar e alterar a ficha.</p>':'')+
   '<div class="ae-cbb-status" role="status" aria-live="polite">'+enc(stateText(s))+'</div>'+
   '<div class="ae-cbb-result" role="status" aria-live="polite">'+(result?resultMarkup(result):'<p>Escolha uma ação para começar.</p>')+'</div>'+
   '<div class="ae-cbb-grid">'+
    '<section class="ae-cbb-panel" data-cbb-panel="teste"'+(selectedMode==='teste'?'':' hidden')+'><h3>Teste de perícia</h3>'+
     '<label>Perícia<select data-cbb-field="skill">'+opts(choices,'Destreza')+'</select></label>'+
     '<div class="ae-cbb-pair"><label>Contexto<select data-cbb-field="context">'+opts([['geral','Geral'],['ataque','Ataque'],['defesa','Defesa']], 'geral')+'</select></label>'+
      '<label>DT (opcional)<input type="number" data-cbb-field="dt" min="1" max="200" placeholder="DT"></label></div>'+
     '<details class="ae-cbb-advanced"><summary>MODIFICADORES E DADOS EXTRAS</summary><div class="ae-cbb-advanced-content">'+
     '<div class="ae-cbb-pair"><label>Passos de grupo<input type="number" data-cbb-field="groupSteps" value="0" min="-5" max="5"></label>'+
       '<label>Passos de perícia<input type="number" data-cbb-field="skillSteps" value="0" min="-5" max="5"></label></div>'+
     '<div class="ae-cbb-pair"><label>Dado extra<select data-cbb-field="bonusFaces">'+opts([['0','Nenhum'],...engine.DIE_FACES.map(n=>[n,'d'+n])],0)+'</select></label>'+
      '<label>Quantidade extra<input type="number" data-cbb-field="bonusCount" min="0" max="4" value="0"></label></div>'+
     '<div class="ae-cbb-pair"><label>Pavor<select data-cbb-field="fear">'+opts([['','Automático'],['0','Nenhum'],...engine.DIE_FACES.map(n=>[n,'d'+n])],'')+'</select></label>'+
      '<label>Hollowficação<select data-cbb-field="hollow">'+opts([['','Automática'],['true','Ativa'],['false','Inativa']],'')+'</select></label></div>'+
     '</div></details>'+
     '<label class="ae-cbb-inline"><input type="checkbox" data-cbb-field="reaction"> Usar reação na defesa (RT em vez de RA)</label>'+
     '<details class="ae-cbb-advanced"><summary>CONFRONTO DIRETO</summary><div class="ae-cbb-advanced-content">'+
     '<div class="ae-cbb-pair"><label>RA do oponente<input type="number" data-cbb-field="opponentRa" min="0" max="200" placeholder="Confronto"></label>'+
      '<label>Iniciativa<select data-cbb-field="initiator">'+opts([['oponente','Oponente iniciou'],['voce','Você iniciou']],'oponente')+'</select></label></div>'+
     '<label class="ae-cbb-inline"><input type="checkbox" data-cbb-field="opponentCritical"> Oponente obteve Crítico Máximo</label>'+
     '</div></details>'+
     '<button class="btn main ae-cbb-action" type="button" data-cbb-command="skill"'+lock+'>ROLAR TESTE</button>'+
     ''+
    '</section>'+
    '<section class="ae-cbb-panel" data-cbb-panel="pool"'+(['dano','resistencia','recuperacao'].includes(selectedMode)?'':' hidden')+'><h3>Dados de combate</h3>'+
     '<label>Tipo<select data-cbb-field="poolMode">'+opts([['dano','Dano-base'],['resistencia','Resistência'],['recuperacao','Recuperação']],(['dano','resistencia','recuperacao'].includes(selectedMode)?selectedMode:'dano'))+'</select></label>'+
     '<label>Habilidade com dados explícitos<select data-cbb-field="source">'+opts(abilityChoices,'')+'</select></label>'+
     '<div class="ae-cbb-pair"><label>Quantidade<input type="number" min="0" max="20" data-cbb-field="poolCount" value="1"></label>'+
       '<label>Faces<select data-cbb-field="poolFaces">'+opts(engine.DIE_FACES.map(n=>[n,'d'+n]),8)+'</select></label></div>'+
     '<div class="ae-cbb-pair"><label>Recurso<select data-cbb-field="poolResource">'+opts(resourceChoices,'vida')+'</select></label>'+
       '<label>Ajuste fixo<input type="number" data-cbb-field="flat" value="0" min="-500" max="500"></label></div>'+
     '<label class="ae-cbb-inline"><input type="checkbox" data-cbb-field="useAttackRa"'+(last?'':' disabled')+'> Somar RA do último ataque verificado '+(last?'('+enc(last.ra)+')':'(nenhum)')+'</label>'+
     '<div class="ae-cbb-pair"><label>RA manual (se necessário)<input type="number" data-cbb-field="manualRa" min="0" max="100" value="0"></label>'+
       '<label>Passos resistência<input type="number" data-cbb-field="resistSteps" min="-5" max="5" value="0"></label></div>'+
     '<button class="btn main ae-cbb-action" type="button" data-cbb-command="pool"'+lock+'>ROLAR DADOS</button>'+
     ''+
    '</section>'+
    '<section class="ae-cbb-panel" data-cbb-panel="turno"'+(selectedMode==='turno'?'':' hidden')+'><h3>Turno e exposições</h3>'+
     '<div class="ae-cbb-pills">'+pill('CENA',c.scene||1)+pill('RODADA',c.round||1)+pill('FASE',phaseName[phase]||phase)+'</div>'+
     '<div class="ae-cbb-pills">'+pill('PRINCIPAL',c.mainUsed?(c.cbb?.extraMain?'extra':'usada'):'livre')+pill('REAÇÃO',c.reactionUsed?(c.cbb?.extraReaction?'extra':'usada'):'livre')+'</div>'+
     (c.cbb?.movementBlocked?'<p class="ae-cbb-hint">Exposição Rítmica: movimentação indisponível nesta rodada.</p>':'')+
     '<div class="ae-cbb-buttons">'+
       '<button class="btn small" type="button" data-cbb-command="main"'+(disabled||(c.mainUsed&&!c.cbb?.extraMain)?' disabled':'')+'>USAR PRINCIPAL</button>'+
       '<button class="btn small" type="button" data-cbb-command="reaction"'+(disabled||(c.reactionUsed&&!c.cbb?.extraReaction)?' disabled':'')+'>USAR REAÇÃO</button>'+
       '<button class="btn small" type="button" data-cbb-command="'+(phase==='desfecho'?'round':'phase')+'"'+lock+'>'+(phase==='desfecho'?'PRÓXIMA RODADA':'PRÓXIMA FASE')+'</button>'+
       (ctx.master?'<button class="btn small quiet" type="button" data-cbb-command="scene"'+lock+'>NOVA CENA</button>':'')+
     '</div>'+
     '<h4>Pressão e exposições</h4><div class="ae-cbb-pills">'+
      pill('PRESSIONADO',c.cbb?.pressured?'sim':'não')+pill('ACERTOS',c.pressureHits||0)+'</div>'+
     '<div class="ae-cbb-buttons"><button class="btn small" data-cbb-command="hit" type="button"'+lock+'>REGISTRAR ACERTO SOFRIDO</button></div>'+
     '<div class="ae-cbb-pills">'+
      ['defensiva','ofensiva','ritmica'].map(n=>pill(n.toUpperCase(),String(ex[n]||0)+'/3')).join('')+'</div>'+
     '<div class="ae-cbb-pair"><label>Tipo<select data-cbb-field="exposure">'+opts([['defensiva','Defensiva'],['ofensiva','Ofensiva'],['ritmica','Rítmica']],'ofensiva')+'</select></label>'+
      '<label>Comprometer<select data-cbb-field="commitResource">'+opts([['main','Ação principal extra'],['reaction','Reação extra']],'main')+'</select></label></div>'+
     '<div class="ae-cbb-buttons"><button type="button" class="btn small" data-cbb-command="commit"'+lock+'>COMPROMETER</button>'+
      '<button type="button" class="btn small" data-cbb-command="expose" data-cbb-delta="1"'+lock+'>+ EXPOSIÇÃO</button>'+
      '<button type="button" class="btn small" data-cbb-command="contain"'+lock+'>CONTENÇÃO</button></div>'+
     ''+
    '</section>'+
    '<section class="ae-cbb-panel" data-cbb-panel="recursos"'+(selectedMode==='recursos'?'':' hidden')+'><h3>Vida, Estabilidade e Alma</h3>'+
     '<div class="ae-cbb-pills">'+resourceChoices.map(([k,t])=>pill(t,String(res[k]?.current??0)+' / '+String(res[k]?.max??0))).join('')+'</div>'+
     '<label>Recurso<select data-cbb-field="adjustResource">'+opts(resourceChoices,'vida')+'</select></label>'+
     '<label>Variação (+ recuperação, − dano)<input data-cbb-field="adjustDelta" type="number" value="-1" min="-100000" max="100000"></label>'+
     '<button type="button" class="btn main ae-cbb-action" data-cbb-command="adjust"'+lock+'>APLICAR À MINHA FICHA</button>'+
     ''+
    '</section>'+
   '</div></section>';
 }
 function resultMarkup(data){
  const r=data.result,calc=engine.rollSummary(r),kind=data.mode;
  const dice=Array.isArray(r.dice)?r.dice:[],colors=Array.isArray(r.colors)?r.colors:[];
  const label=kind==='teste'?'TESTE VERIFICADO':kind==='dano'?'DANO-BASE':kind==='resistencia'?'RESISTÊNCIA':'RECUPERAÇÃO';
  const critical=calc.special==='CRÍTICO MÁXIMO'||calc.special==='CRÍTICO';
  const failure=calc.special==='FALHA CRÍTICA';
  const tokens=dice.map((d,i)=>{
   const size=Number(d?.sides)||4,raw=Number(d?.value)||0,effective=Number(d?.effective??raw);
   const verifiedColor=typeof colors[i]==='string'&&/^#[0-9a-fA-F]{6}$/.test(colors[i])?colors[i]:null;
   const fallback=i===0?'var(--sheet-dice-group,var(--theme-accent))':'var(--sheet-dice-skill,var(--theme-cold))';
   const isModified=raw!==effective;
   const status=d?.canceled?' ANULADO':d?.criticalApplied?' CRÍTICO':d?.maximized?' MAXIMIZADO':'';
   return '<div class="ae-cbb-die'+(d?.canceled?' is-canceled':d?.criticalApplied?' is-critical':'')+
    '" data-sides="'+size+'" style="--cbb-die-color:'+(verifiedColor||fallback)+'" title="Dado de '+size+' faces'+status+'">'+
    '<span class="ae-cbb-die-kind">d'+size+'</span><strong>'+raw+'</strong>'+
    (isModified?'<span class="ae-cbb-die-mod">→ '+effective+'</span>':'')+
    (status?'<span class="ae-cbb-die-status">'+status.trim()+'</span>':'')+'</div>';
  }).join('');
  const header='<div class="ae-cbb-result-head"><strong>'+enc(label)+'</strong><small>REGISTRO #'+enc(r.id||'')+
   (r.protectionId?' + #'+enc(r.protectionId):'')+'</small></div>';
  const figures='<div class="ae-cbb-roll-layout"><div class="ae-cbb-total"><span>RT</span><strong>'+enc(calc.rt)+
   '</strong></div><div class="ae-cbb-roll-secondary">'+pill('RA',calc.ra)+pill('RB',calc.rb)+
   (calc.special?pill('CRÍTICO',calc.special):'')+'</div></div>';
  const effect=[];
  if(r.fearDie)effect.push('Pavor d'+r.fearDie+': '+r.fearRoll+(r.fearClear?' · superado':''));
  if(r.hollowDie)effect.push('Hollowficação d6: '+r.hollowRoll+(r.hollowLost?' · Falha Crítica: perda de controle':''));
  if(data.dt!==null && kind==='teste')effect.push('DT '+data.dt+': '+(calc.special==='CRÍTICO MÁXIMO'||calc.rt>=data.dt?'sucesso':'falha'));
  if(data.clash)effect.push('Teste-Clash: '+(data.clash.win?'vitória':'derrota')+' · '+data.clash.reason);
  if(kind==='dano')effect.push('RA incorporada ao dano: '+(r.attack_ra||0)+'. Confirme o acerto antes de aplicar.');
  if(kind==='resistencia')effect.push('Reutilize esta resistência contra ataques ao mesmo recurso nesta fase.');
  return '<div class="ae-cbb-result-shell'+(critical?' is-critical':failure?' is-failure':'')+'">'+header+figures+
   '<div class="ae-cbb-dice">'+tokens+'</div>'+
   (effect.length?'<p class="ae-cbb-result-message">'+enc(effect.join(' · '))+'</p>':'')+'</div>';
 }
 const responseField=(s,result,mode,dt,clash)=>{lastResults.set(s.id,{result,mode,dt,clash});const node=document.querySelector('.ae-cbb-mesa .ae-cbb-result');if(node)node.innerHTML=resultMarkup({result,mode,dt,clash});};
 const lockResult=(button,locked)=>{if(button){button.disabled=locked;button.setAttribute('aria-busy',String(locked));}};
 const normalize=(num,min,max,label)=>{if(!engine.positiveInt(num,min,max))throw Error('Valor inválido: '+label);return Number(num);};
 const currentPhase=s=>[Number(s.combat?.scene||1),Number(s.combat?.round||1),s.combat?.phase||'preparacao'].join(':');
 async function executeRoll(root,cmd){
  const s=sheet(),sync=global.ARQUIVO_SYNC;if(!s||!api.canEditSheet(s.id)||!sync?.cbbRoll)throw Error('Faça login com a chave da ficha.');
  const args={p_sheet_id:s.id,p_kind:'teste',p_skill:null,p_context:'geral',p_reaction:false,
   p_group_steps:0,p_skill_steps:0,p_pool:[],p_resource:null,p_flat:0,p_attack_id:null,p_manual_ra:0,p_fear:null,p_hollow:null};
  let dt=null,clash=null;
  if(cmd==='skill'){
   args.p_skill=read(root,'skill');args.p_context=read(root,'context','geral');
   args.p_reaction=!!field(root,'reaction')?.checked;
   if(args.p_reaction && args.p_context!=='defesa')throw Error('Reação somente em testes de defesa.');
   args.p_group_steps=normalize(number(root,'groupSteps'),-5,5,'passos de grupo');
   args.p_skill_steps=normalize(number(root,'skillSteps'),-5,5,'passos de perícia');
   const bonus=number(root,'bonusCount'),bonusFace=number(root,'bonusFaces');
   normalize(bonus,0,4,'dados extras');
   if(bonus){if(!engine.DIE_FACES.includes(bonusFace))throw Error('Escolha a face dos dados extras.');args.p_pool=[{count:bonus,faces:bonusFace}];}
   const fear=read(root,'fear');if(fear!=='')args.p_fear=Number(fear);
   const hollow=read(root,'hollow');if(hollow!=='')args.p_hollow=hollow==='true';
   const input=read(root,'dt');if(input!=='')dt=normalize(input,1,200,'DT');
  }else{
   const mode=read(root,'poolMode','dano');
   if(!['dano','resistencia','recuperacao'].includes(mode))throw Error('Tipo de rolagem inválido.');
   args.p_kind=mode;
   args.p_resource=read(root,'poolResource','vida');
   const count=number(root,'poolCount'),faces=number(root,'poolFaces');
   normalize(count,0,20,'quantidade');if(count&&!engine.DIE_FACES.includes(faces))throw Error('Dado inválido.');
   if(mode==='resistencia'&&count>1)throw Error('Use no máximo um dado de proteção adicional.');
   if(mode==='resistencia'){
    const key=s.id+':'+currentPhase(s)+':'+args.p_resource;
    args.p_group_steps=normalize(number(root,'resistSteps'),-5,5,'passos de resistência');
    const cached=resistanceByPhase.get(key);
    if(cached){
     if(cached.steps!==args.p_group_steps)throw Error('A resistência natural já foi rolada nesta fase; seus passos ficam fixos.');
     if(cached.count===count && (!count||cached.faces===faces)){
      responseField(s,cached.current,'resistencia',null,null);
      statusBySheet.set(s.id,'Resistência da fase reaproveitada.');
      const node=document.querySelector('.ae-cbb-status');if(node)node.textContent=stateText(s);
      return;
     }
     const original=cached.natural.dice[0];
     let updated={...cached.natural,dice:[original],rt:Number(original.value),
      ra:Number(original.value),rb:Number(original.value),protectionId:null};
     if(count){
      const extra=await sync.cbbRoll({...args,p_kind:'protecao',p_group_steps:0,p_pool:[{count:1,faces}]});
      if(!extra?.id||!Array.isArray(extra.dice)||extra.dice.length!==1)throw Error('Proteção adicional não confirmada.');
      const second=extra.dice[0];
      updated={...updated,dice:[original,second],rt:Number(original.value)+Number(second.value),
       ra:Math.max(Number(original.value),Number(second.value)),
       rb:Math.min(Number(original.value),Number(second.value)),protectionId:extra.id,
       colors:[...(cached.natural.colors||[]),...(extra.colors||[])]};
     }
     cached.count=count;cached.faces=faces;cached.current=updated;
     responseField(s,updated,'resistencia',null,null);
     statusBySheet.set(s.id,count?'Proteção adicional atualizada.':'Resistência natural reaproveitada.');
     const node=document.querySelector('.ae-cbb-status');if(node)node.textContent=stateText(s);
     return;
    }
   }else{
    args.p_flat=normalize(number(root,'flat'),-500,500,'bônus fixo');
    if(mode==='dano'&&field(root,'useAttackRa')?.checked){
     const previous=lastAttacks.get(s.id);if(!previous?.id)throw Error('Role primeiro um ataque.');
     args.p_attack_id=Number(previous.id);
    }else if(mode==='dano')args.p_manual_ra=normalize(number(root,'manualRa'),0,100,'RA manual');
   }
   if(count)args.p_pool=[{count,faces}];
  }
  const result=await sync.cbbRoll(args);
  if(!result?.id||!Array.isArray(result.dice))throw Error('O servidor não confirmou a rolagem.');
  if(args.p_kind==='teste'){
   if(args.p_context==='ataque'&&result.special!=='FALHA CRÍTICA')lastAttacks.set(s.id,{id:result.id,ra:result.ra});
   const enemy=read(root,'opponentRa');
   if(enemy!==''){
    const enemyRA=normalize(enemy,0,200,'RA do oponente');
    clash=engine.clash(result,enemyRA,!!field(root,'opponentCritical')?.checked,read(root,'initiator','oponente'),args.p_reaction);
   }
   if(args.p_reaction){s.combat??={};s.combat.reactionUsed=true;}
  }
  if(args.p_kind==='resistencia')resistanceByPhase.set(s.id+':'+currentPhase(s)+':'+args.p_resource,{natural:result,current:result,steps:args.p_group_steps,count:number(root,'poolCount'),faces:number(root,'poolFaces')});
  responseField(s,result,args.p_kind,dt,clash);
  const hazard=s.boss?.scenario;
  if(hazard?.critical===result.special && hazard.skill===args.p_skill && args.p_kind==='teste'){
   statusBySheet.set(s.id,hazard.name+': crítico confirmado. Selecione os alvos no alcance e aplique '+(hazard.effect||'o efeito')+'.');
  }else statusBySheet.set(s.id,'Rolagem verificada.');
  const notice=document.querySelector('.ae-cbb-mesa .ae-cbb-status');
  if(notice)notice.textContent=stateText(s);
 }
 async function executeAction(root,button,cmd){
  const s=sheet(),sync=global.ARQUIVO_SYNC;if(!s||!api.canEditSheet(s.id)||!sync?.cbbAction)throw Error('Chave sem permissão de edição.');
  const args={p_sheet_id:s.id,p_action:cmd,p_ability_index:null,p_resource:null,p_value:null,p_exposure:null};
  if(cmd==='ability'||cmd==='deactivate'||cmd==='pin')args.p_ability_index=normalize(button.dataset.cbbIndex,0,99,'índice da habilidade');
  if(cmd==='party')args.p_value=normalize(button.dataset.cbbParty,6,8,'jogadores');
  if(cmd==='adjust'){
   args.p_resource=read(root,'adjustResource','vida');
   args.p_value=normalize(number(root,'adjustDelta'),-100000,100000,'ajuste');
   if(args.p_value===0)throw Error('Informe um valor diferente de zero.');
  }
  if(['expose','contain','commit'].includes(cmd)){
   args.p_exposure=read(root,'exposure','ofensiva');
   if(cmd==='expose')args.p_value=Number(button.dataset.cbbDelta||1);
   if(cmd==='commit')args.p_resource=read(root,'commitResource','main');
  }
  const response=await sync.cbbAction(args);
  if(!response?.ok)throw Error('O servidor não confirmou a ação.');
  for(const key of ['resources','combat','exposures','abilityRuntime','boss','pinnedAbilities'])if(response[key])s[key]=response[key];
  statusBySheet.set(s.id,response.info?.chargedCost!==undefined?'Custo: '+response.info.chargedCost+' ALMA':cmd==='party'?'Confronto ajustado para '+args.p_value+' jogadores.':cmd==='pin'?(response.info?.active?'Habilidade fixada no Resumo.':'Habilidade desafixada.'):'Ação registrada.');
  api.render();
 }
 function switchMode(s,mode,root){
  if(!['teste','dano','resistencia','recuperacao','turno','recursos'].includes(mode))return;
  modeBySheet.set(s.id,mode);
  if(!root)return;
  const panelMode=['dano','resistencia','recuperacao'].includes(mode)?'pool':mode;
  for(const item of root.querySelectorAll('[data-cbb-panel]'))item.hidden=item.dataset.cbbPanel!==panelMode;
  for(const item of root.querySelectorAll('[data-cbb-mode]')){
   const active=item.dataset.cbbMode===mode;
   item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));
  }
  if(panelMode==='pool'){
   const kind=field(root,'poolMode');if(kind)kind.value=mode;
   if(mode==='resistencia'){
    const qty=field(root,'poolCount');if(qty)qty.value='0';
    const src=field(root,'source');if(src)src.value='';
   }
  }
 }
 async function onClick(event){
  const mode=event.target?.closest?.('[data-cbb-mode]');
  if(mode?.dataset?.cbbMode){
   event.preventDefault();event.stopPropagation();
   const sh=sheet();if(sh)switchMode(sh,mode.dataset.cbbMode,mode.closest('.ae-cbb-mesa'));
   return;
  }
  const b=event.target?.closest?.('[data-cbb-command]');if(!b)return;
  event.preventDefault();event.stopPropagation();
  if(busy)return;
  const cmd=b.dataset.cbbCommand,sh=sheet();if(!sh)return;
  if(cmd==='abilityPool'){
   const index=Number(b.dataset.cbbIndex),ab=sh.abilities?.[index],pool=engine.abilityPool(ab);
   if(!pool)return;
   modeBySheet.set(sh.id,pool.kind);
   const nav=document.querySelector('.ae-ficha-navigation [data-tab="mesa"]');
   if(nav)nav.click();
   const root=document.querySelector('.ae-cbb-mesa');
   if(root){
    field(root,'poolMode').value=pool.kind;
    field(root,'poolCount').value=String(pool.count);
    field(root,'poolFaces').value=String(pool.faces);
    field(root,'source').value=String(index);
   }
   statusBySheet.set(sh.id,'Dados carregados de '+ab.name+'. Confirme modificadores antes de rolar.');
   const status=root?.querySelector('.ae-cbb-status');if(status)status.textContent=stateText(sh);
   return;
  }
  if(!on()){api.toast('Conexão necessária','Entre com uma chave para registrar ações e rolagens.',true);return;}
  const root=b.closest('.ae-cbb-mesa')||document.querySelector('.ae-cbb-mesa');
  busy=true;lockResult(b,true);
  try{
   if(cmd==='skill'||cmd==='pool')await executeRoll(root,cmd);
   else await executeAction(root,b,cmd);
  }catch(error){api.toast('Ação não realizada',String(error?.message||error),true)}
  finally{busy=false;lockResult(b,false)}
 }
 function onChange(event){
  const target=event.target;
  if(!['source','poolMode'].includes(target?.dataset?.cbbField))return;
  const root=target.closest('.ae-cbb-mesa'),s=sheet();
  if(target.dataset.cbbField==='poolMode'){
   if(root&&target.value==='resistencia'){
    field(root,'poolCount').value='0';
    field(root,'source').value='';
    field(root,'flat').value='0';
   }
   return;
  }
  const index=Number(target.value);
  if(!root||!s||target.value===''||!s.abilities?.[index])return;
  const pool=engine.abilityPool(s.abilities[index]);if(!pool)return;
  field(root,'poolCount').value=String(pool.count);
  field(root,'poolFaces').value=String(pool.faces);
  field(root,'poolMode').value=pool.kind;
 }
 document.addEventListener('click',onClick);
 document.addEventListener('change',onChange);
 global.ARQUIVO_CBB_UI=Object.freeze({render,abilityActions,engine});
})(window);