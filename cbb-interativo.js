/* Mesa CBB — única instância por página, sem temporizadores ou lógica de personagem. */
(function(global){
 'use strict';
 const api=global.ARQUIVO_INTERNAL,engine=global.ARQUIVO_CBB_ENGINE;
 if(!api||!engine)return;
 const E=api.esc,groups=engine.GROUPS,skillNames=Object.values(groups).flat();
 const lastResults=new Map(),lastAttacks=new Map(),resistanceByPhase=new Map(),statusBySheet=new Map(),modeBySheet=new Map(),testBySheet=new Map();
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
 const safeSteps=value=>Math.max(-5,Math.min(5,Number(value)||0));
 const testMemory=s=>{
  const m=testBySheet.get(s.id)||{};
  return {skill:skillNames.includes(m.skill)?m.skill:'Destreza',
   context:['geral','ataque','defesa'].includes(m.context)?m.context:'geral',
   groupSteps:safeSteps(m.groupSteps),skillSteps:safeSteps(m.skillSteps),
   reaction:!!m.reaction,vision:!!m.vision,sense:!!m.sense,otherTarget:!!m.otherTarget};
 };
 function stepper(name,label,value,disabled=false){
  return '<div class="ae-cbb-step-control"><span>'+enc(label)+'</span>'+
   '<div class="ae-cbb-stepper" role="group" aria-label="'+enc(label)+'">'+
   '<button type="button" data-cbb-step="'+name+'" data-cbb-delta="-1" aria-label="Reduzir '+enc(label)+' em um passo"'+(disabled?' disabled':'')+'>−</button>'+
   '<input type="number" data-cbb-field="'+name+'" aria-label="'+enc(label)+'" min="-5" max="5" step="1" value="'+safeSteps(value)+'"'+(disabled?' disabled':'')+'>'+
   '<button type="button" data-cbb-step="'+name+'" data-cbb-delta="1" aria-label="Aumentar '+enc(label)+' em um passo"'+(disabled?' disabled':'')+'>+</button></div></div>';
 }
 function contextualFlags(s,ctx){
  const m=testMemory(s),conds=engine.normalizedConditions(s);
  const choices=[
   ['vision','A ação depende da visão',conds.has('cego')||conds.has('ofuscado')],
   ['sense','A ação depende do sentido afetado',conds.has('insensível')],
   ['otherTarget','Atacar outro alvo',conds.has('provocado')&&m.context==='ataque']
  ].filter(x=>x[2]);
  if(!choices.length)return '';
  return '<div class="ae-cbb-conditional" data-cbb-conditional><strong>Condições dependentes da ação</strong>'+
   '<div class="ae-cbb-conditional-list">'+choices.map(([key,label])=>'<label class="ae-cbb-inline">'+
    '<input type="checkbox" data-cbb-field="'+key+'"'+(m[key]?' checked':'')+(ctx.disabled?' disabled':'')+'> '+enc(label)+'</label>').join('')+'</div></div>';
 }
 function previewMarkup(s,m){
  const p=engine.previewSkill(s,m.skill,m.context,m.groupSteps,m.skillSteps,m);
  const totalG=p.automaticGroup+p.manualGroup,totalS=p.automaticSkill+p.submittedSkill;
  const die=(title,faces,base,steps)=>'<div class="ae-cbb-preview-die"><span>'+title+'</span>'+
   '<strong>d'+faces+'</strong><small>d'+base+(steps?(' · '+(steps>0?'+':'')+steps+' passo'+(Math.abs(steps)===1?'':'s')):'')+'</small></div>';
  const applied=p.reasons.map(r=>'<span class="ae-cbb-auto-effect">'+enc(r.name)+' <b>'+
   (r.steps>0?'+':'')+r.steps+' '+enc(r.target)+'</b></span>').join('');
  const fear=p.hasFear?'<span class="ae-cbb-auto-effect">Amedrontado <b>Dado de Pavor</b></span>':'';
  const alerts=[
   p.conditions.has('atordoado')?'Atordoado: reação indisponível.':'',
   s.combat?.reactionUsed&&Number(s.combat?.cbb?.extraReaction||0)<1&&m.context==='defesa'?
    'Reação já utilizada nesta rodada.':'',
   p.conditions.has('desorientado')||p.conditions.has('exausto')?'Movimentação reduzida pela metade.':'',
   p.conditions.has('imobilizado')?'Imobilizado: deslocamento impedido.':'',
   p.conditions.has('agarrado')?'Agarrado: não pode se afastar de quem o segura.':'',
   p.conditions.has('derrubado')?'Levantar exige metade da movimentação.':'',
   p.conditions.has('silenciado')?'Silenciado: habilidades dependentes da manifestação bloqueada.':'',
   p.conditions.has('fragilizado')?'Fragilizado: proteção mais forte reduzida na Defesa.':''
  ].filter(Boolean);
  return '<div class="ae-cbb-preview-head"><strong>DADOS DO TESTE</strong><span>Atualização automática</span></div>'+
   '<div class="ae-cbb-preview-dice">'+die('GRUPO',p.groupDie,p.baseGroup,totalG)+
    die('PERÍCIA',p.skillDie,p.baseSkill,totalS)+'</div>'+
   (applied||fear?'<div class="ae-cbb-auto-effects">'+applied+fear+'</div>':'')+
   (alerts.length?'<p class="ae-cbb-preview-alert">'+enc(alerts.join(' · '))+'</p>':'');
 }
 function refreshPreview(root,s=sheet()){
  if(!root||!s)return;
  const stored=testMemory(s);
  for(const key of ['skill','context','groupSteps','skillSteps','reaction','vision','sense','otherTarget']){
   const node=field(root,key);
   if(node)stored[key]=node.type==='checkbox'?!!node.checked:node.value;
  }
  stored.groupSteps=safeSteps(stored.groupSteps);stored.skillSteps=safeSteps(stored.skillSteps);
  const p=engine.previewSkill(s,stored.skill,stored.context,stored.groupSteps,stored.skillSteps,stored);
  if(!p.visionApplicable)stored.vision=false;
  if(!p.senseApplicable)stored.sense=false;
  if(!p.otherTargetApplicable)stored.otherTarget=false;
  testBySheet.set(s.id,stored);
  const preview=root.querySelector?.('[data-cbb-preview]');
  if(preview)preview.innerHTML=previewMarkup(s,stored);
  const choices=root.querySelector?.('[data-cbb-conditional-host]');
  if(choices)choices.innerHTML=contextualFlags(s,{disabled:s.automationEnabled===false||!api.canEditSheet(s.id)||!on()});
  const reaction=field(root,'reaction');
  if(reaction){
   const spent=!!s.combat?.reactionUsed&&Number(s.combat?.cbb?.extraReaction||0)<1;
   const blocked=p.reactionBlocked||spent||stored.context!=='defesa';
   if(blocked&&reaction.checked){reaction.checked=false;stored.reaction=false;testBySheet.set(s.id,stored)}
   reaction.disabled=blocked||s.automationEnabled===false||!api.canEditSheet(s.id)||!on();
  }
  return p;
 }
 function abilitySummary(s,ab,index){
  const p=engine.abilityPool(ab);
  if(!p)return '';
  const bonus=p.kind==='dano'?engine.activeDamageBonus(s):0;
  const ra=lastAttacks.get(s.id)?.ra;
  const dice=(p.count>1?p.count:'')+'d'+p.faces;
  const label=p.kind==='dano'?(ra==null?'RA':String(ra))+' + '+dice+
   (bonus?(bonus>0?' + ':' − ')+Math.abs(bonus):''):(p.count>1?p.count:'')+'d'+p.faces;
  return '<div class="ae-ability-roll-note" data-cbb-ability-summary="'+index+
   '" aria-label="'+enc(p.kind==='dano'?'Dano base':'Recuperação')+'"><span aria-hidden="true">⚄</span><strong>'+
   enc(label)+'</strong>'+(bonus?'<small>'+enc(engine.activeDamageEffects(s).map(x=>x.name).join(', '))+'</small>':'')+'</div>';
 }
 function renderSkillQuick(s,ctx={}){
  if(!ctx.canEdit)return '';
  const stored=testMemory(s),disabled=s.automationEnabled===false||!api.canEditSheet(s.id)||!on();
  const disable=disabled?' disabled':'';
  return '<section class="ae-cbb-mesa ae-cbb-quick" data-cbb-sheet="'+enc(s.id)+'" aria-label="Teste de perícia diretamente na ficha">'+
   '<div class="ae-cbb-quick-head"><h3>Rolagem rápida</h3><span>Mesmo teste verificado da Mesa · efeitos automáticos</span></div>'+
   '<div class="ae-cbb-pair"><label>Perícia<select data-cbb-field="skill">'+opts(skillNames.map(n=>[n,n]),stored.skill)+'</select></label>'+
    '<label>Contexto<select data-cbb-field="context">'+opts([['geral','Geral'],['ataque','Ataque'],['defesa','Defesa']],stored.context)+'</select></label></div>'+
   '<div class="ae-cbb-step-row">'+stepper('groupSteps','PASSOS DO GRUPO',stored.groupSteps,disabled)+
    stepper('skillSteps','PASSOS DA PERÍCIA',stored.skillSteps,disabled)+'</div>'+
   '<div class="ae-cbb-live-preview" data-cbb-preview aria-live="polite">'+previewMarkup(s,stored)+'</div>'+
   '<div data-cbb-conditional-host>'+contextualFlags(s,{disabled})+'</div>'+
   '<details class="ae-cbb-advanced"><summary>Dados bônus, DT e reação</summary><div class="ae-cbb-advanced-content">'+
   '<div class="ae-cbb-pair"><label>Dado bônus<select data-cbb-field="bonusFaces">'+opts([['0','Nenhum'],...engine.DIE_FACES.map(n=>[n,'d'+n])],0)+'</select></label>'+
    '<label>Quantidade<input data-cbb-field="bonusCount" type="number" min="0" max="4" value="0"></label></div>'+
   '<label>DT (opcional)<input data-cbb-field="dt" type="number" min="1" max="200" placeholder="Sem DT"></label>'+
   '<label class="ae-cbb-inline"><input data-cbb-field="reaction" type="checkbox"'+(stored.reaction?' checked':'')+
   (stored.context!=='defesa'||engine.normalizedConditions(s).has('atordoado')||disabled?' disabled':'')+'> Usar reação na defesa (RT em vez de RA)</label>'+
   '</div></details>'+
   '<button type="button" class="btn main ae-cbb-action" data-cbb-command="skill"'+disable+'>ROLAR PERÍCIA</button>'+
   '<div class="ae-cbb-result" aria-live="polite"></div><p class="ae-cbb-status" role="status">'+enc(stateText(s))+'</p>'+
   '</section>';
 }
 function refreshDamageSummaries(s=sheet()){
  if(!s)return;
  document.querySelectorAll?.('[data-cbb-ability-summary]').forEach(node=>{
   const ab=s.abilities?.[Number(node.dataset.cbbAbilitySummary)];
   if(ab)node.outerHTML=abilitySummary(s,ab,Number(node.dataset.cbbAbilitySummary));
  });
  document.querySelectorAll?.('[data-cbb-item-bonus]').forEach(node=>{
   const value=engine.activeDamageBonus(s);
   node.textContent=value?((value>0?'+':'')+value+' de equipamento aplicado automaticamente'):'Nenhum bônus de equipamento ativo';
  });
 }
 function abilityActions(ab,index,ctx){
  if(!ctx?.canEdit || !ab || ab.origin?.auto)return '';
  const p=engine.abilityPool(ab),mode=ab.costConfig?.mode;
  const canPay=(Number(ab.cost)>0||mode==='activation') && ab.category!=='passive' && !ab.passive;
  const billingKey=String(ab.abilityId||ab.automation?.id||'legacy:'+index);
  const sh=sheet(),runtime=sh?.abilityRuntime?.billing?.[billingKey],scene=Number(sh?.combat?.scene||1),automationOff=sh?.automationEnabled===false;
  const active=mode==='activation'&&runtime?.active===true&&Number(runtime.scene)===scene;
  const locked=ab.unlock?.mode==='locked'&&!ctx.master;
  const requires=ab.costConfig?.requires||ab.unlock?.requires;
  const prerequisite=requires && !(sh?.abilityRuntime?.billing?.[requires]?.active===true&&Number(sh?.abilityRuntime?.billing?.[requires]?.scene)===scene);
  const out=[];
  if(canPay){
   const cmd=active?'deactivate':'ability';
   const label=active?'ENCERRAR LIBERAÇÃO':mode==='activation'?'ATIVAR · '+(Number(ab.cost)||0)+' ALMA':'UTILIZAR · '+Number(ab.cost)+' ALMA';
   out.push('<button type="button" class="ae-cbb-card-btn" data-cbb-command="'+cmd+'" data-cbb-index="'+index+'"'+(locked||prerequisite||automationOff?' disabled':'')+'>'+enc(locked?'BLOQUEADA':prerequisite?'REQUER LIBERAÇÃO':label)+'</button>');
  }
  if(p)out.push('<button type="button" class="ae-cbb-card-btn ae-cbb-card-btn--secondary" data-cbb-command="abilityPool" data-cbb-index="'+index+'"'+(automationOff?' disabled':'')+'>ROLAR '+(p.kind==='dano'?'DANO':'CURA')+'</button>');
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
  const disabled=!ctx.canEdit||!on()||s.automationEnabled===false;
  const test=testMemory(s),conditions=engine.normalizedConditions(s);
  const stunned=conditions.has('atordoado');
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
   (!ctx.canEdit?'<p class="ae-cbb-hint">Somente leitura: esta ficha não está vinculada à sua chave.</p>':!on()?'<p class="ae-cbb-hint">Conecte uma chave de jogador ou mestre para rolar e alterar a ficha.</p>':s.automationEnabled===false?'<p class="ae-cbb-hint">Automação desativada. Reative no Resumo para usar esta Mesa.</p>':'')+
   '<div class="ae-cbb-status" role="status" aria-live="polite">'+enc(stateText(s))+'</div>'+
   '<div class="ae-cbb-result" role="status" aria-live="polite">'+(result?resultMarkup(result):'<p>Escolha uma ação para começar.</p>')+'</div>'+
   '<div class="ae-cbb-grid">'+
    '<section class="ae-cbb-panel" data-cbb-panel="teste"'+(selectedMode==='teste'?'':' hidden')+'><h3>Teste de perícia</h3>'+
     '<label>Perícia<select data-cbb-field="skill">'+opts(choices,test.skill)+'</select></label>'+
     '<div class="ae-cbb-pair"><label>Contexto<select data-cbb-field="context">'+opts([['geral','Geral'],['ataque','Ataque'],['defesa','Defesa']], test.context)+'</select></label>'+
      '<label>DT (opcional)<input type="number" data-cbb-field="dt" min="1" max="200" placeholder="DT"></label></div>'+
     '<div class="ae-cbb-step-row">'+stepper('groupSteps','PASSOS DO GRUPO',test.groupSteps,disabled)+
      stepper('skillSteps','PASSOS DA PERÍCIA',test.skillSteps,disabled)+'</div>'+
     '<div class="ae-cbb-live-preview" data-cbb-preview aria-live="polite">'+previewMarkup(s,test)+'</div>'+
     '<div data-cbb-conditional-host>'+contextualFlags(s,{disabled})+'</div>'+
     '<details class="ae-cbb-advanced"><summary>DADOS EXTRAS E EFEITOS</summary><div class="ae-cbb-advanced-content">'+
     '<div class="ae-cbb-pair"><label>Dado extra<select data-cbb-field="bonusFaces">'+opts([['0','Nenhum'],...engine.DIE_FACES.map(n=>[n,'d'+n])],0)+'</select></label>'+
      '<label>Quantidade extra<input type="number" data-cbb-field="bonusCount" min="0" max="4" value="0"></label></div>'+
     '<div class="ae-cbb-pair"><label>Pavor<select data-cbb-field="fear">'+opts([['','Automático'],['0','Nenhum'],...engine.DIE_FACES.map(n=>[n,'d'+n])],'')+'</select></label>'+
      '<label>Hollowficação<select data-cbb-field="hollow">'+opts([['','Automática'],['true','Ativa'],['false','Inativa']],'')+'</select></label></div>'+
     '</div></details>'+
     '<label class="ae-cbb-inline"><input type="checkbox" data-cbb-field="reaction"'+(test.reaction?' checked':'')+
       (test.context!=='defesa'||engine.normalizedConditions(s).has('atordoado')||
        (c.reactionUsed&&Number(c.cbb?.extraReaction||0)<1)||disabled?' disabled':'')+
       '> Usar reação na defesa (RT em vez de RA)</label>'+
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
       '<label>Ajuste fixo (manual)<input type="number" data-cbb-field="flat" value="0" min="-500" max="500"></label></div>'+
     '<p class="ae-cbb-pool-hint" data-cbb-item-bonus>'+enc(engine.activeDamageBonus(s)?(engine.activeDamageBonus(s)>0?'+':'')+engine.activeDamageBonus(s)+' de equipamento aplicado automaticamente':'Nenhum bônus de equipamento ativo')+'</p>'+
     '<label class="ae-cbb-inline"><input type="checkbox" data-cbb-field="useAttackRa"'+(last?'':' disabled')+'> Somar RA do último ataque verificado '+(last?'('+enc(last.ra)+')':'(nenhum)')+'</label>'+
     '<label>RA manual (se necessário)<input type="number" data-cbb-field="manualRa" min="0" max="100" value="0"></label>'+
     '<div data-cbb-resist-controls'+(selectedMode==='resistencia'?'':' hidden')+'>'+
      stepper('resistSteps','PASSOS DA RESISTÊNCIA',0,disabled)+
      '<div class="ae-cbb-pool-hint" data-cbb-resist-status aria-live="polite"></div></div>'+
     '<button class="btn main ae-cbb-action" type="button" data-cbb-command="pool"'+lock+'>ROLAR DADOS</button>'+
     ''+
    '</section>'+
    '<section class="ae-cbb-panel" data-cbb-panel="turno"'+(selectedMode==='turno'?'':' hidden')+'><h3>Turno e exposições</h3>'+
     '<div class="ae-cbb-pills">'+pill('CENA',c.scene||1)+pill('RODADA',c.round||1)+pill('FASE',phaseName[phase]||phase)+'</div>'+
     '<div class="ae-cbb-pills">'+pill('PRINCIPAL',c.mainUsed?(c.cbb?.extraMain?'extra':'usada'):'livre')+pill('REAÇÃO',stunned?'bloqueada':c.reactionUsed?(c.cbb?.extraReaction?'extra':'usada'):'livre')+'</div>'+
     (c.cbb?.movementBlocked?'<p class="ae-cbb-hint">Exposição Rítmica: movimentação indisponível nesta rodada.</p>':'')+
     '<div class="ae-cbb-buttons">'+
       '<button class="btn small" type="button" data-cbb-command="main"'+(disabled||(c.mainUsed&&!c.cbb?.extraMain)?' disabled':'')+'>USAR PRINCIPAL</button>'+
       '<button class="btn small" type="button" data-cbb-command="reaction"'+(disabled||stunned||(c.reactionUsed&&!c.cbb?.extraReaction)?' disabled':'')+'>USAR REAÇÃO</button>'+
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
  if(kind==='teste'&&r.groupDie&&r.skillDie)effect.push('Dados utilizados: d'+r.groupDie+' (grupo) + d'+r.skillDie+' (perícia)');
  if(kind==='teste'&&(r.autoGroupSteps||r.autoSkillSteps))
   effect.push('Condições/exposições: '+(r.autoGroupSteps?'grupo '+r.autoGroupSteps+' ':'')+
    (r.autoSkillSteps?'perícia '+r.autoSkillSteps:''));
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
   normalize(number(root,'skillSteps'),-5,5,'passos de perícia');
   const preview=refreshPreview(root,s)||engine.previewSkill(s,args.p_skill,args.p_context,args.p_group_steps,number(root,'skillSteps'));
   args.p_skill_steps=preview.submittedSkill;
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
    const signature=JSON.stringify([s.groups?.[{vida:'Corpo',estabilidade:'Mente',alma:'Espírito'}[args.p_resource]],
     [...engine.normalizedConditions(s)].sort()]);
    const cached=resistanceByPhase.get(key);
    if(cached&&cached.signature===signature){
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
    args.p_flat=normalize(number(root,'flat')+(mode==='dano'?engine.activeDamageBonus(s):0),-500,500,'bônus fixo e itens ativos');
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
  if(args.p_kind==='resistencia')resistanceByPhase.set(s.id+':'+currentPhase(s)+':'+args.p_resource,{
   natural:result,current:result,steps:args.p_group_steps,count:number(root,'poolCount'),
   faces:number(root,'poolFaces'),
   signature:JSON.stringify([s.groups?.[{vida:'Corpo',estabilidade:'Mente',alma:'Espírito'}[args.p_resource]],
    [...engine.normalizedConditions(s)].sort()])});
  responseField(s,result,args.p_kind,dt,clash);
  refreshDamageSummaries(s);
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
  for(const key of ['resources','combat','exposures','abilityRuntime','boss','pinnedAbilities',
   'automationEnabled','conditions','restCount','desgaste']){
    if(Object.hasOwn(response,key))s[key]=response[key];
   }
  if(cmd==='reset'){
   lastResults.delete(s.id);lastAttacks.delete(s.id);modeBySheet.delete(s.id);
   for(const key of resistanceByPhase.keys()){
    if(key.startsWith(s.id+':'))resistanceByPhase.delete(key);
   }
  }
  statusBySheet.set(s.id,cmd==='reset'?'Ficha reiniciada.':cmd==='toggleAutomation'?
   (s.automationEnabled===false?'Automação desativada.':'Automação reativada.'):
   response.info?.chargedCost!==undefined?'Custo: '+response.info.chargedCost+' ALMA':
   cmd==='party'?'Confronto ajustado para '+args.p_value+' jogadores.':
   cmd==='pin'?(response.info?.active?'Habilidade fixada no Resumo.':'Habilidade desafixada.'):
   'Ação registrada.');
  api.render();
  refreshDamageSummaries(s);
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
   const resist=root.querySelector?.('[data-cbb-resist-controls]');
   if(resist)resist.hidden=mode!=='resistencia';
   if(mode==='resistencia'){
    const qty=field(root,'poolCount');if(qty)qty.value='0';
    const src=field(root,'source');if(src)src.value='';
   }
   refreshResistance(root,s);
  }
 }
 async function onClick(event){
  const selectSkill=event.target?.closest?.('[data-cbb-pick-skill]');
  if(selectSkill?.dataset?.cbbPickSkill){
   event.preventDefault();event.stopPropagation();
   const sh=sheet(),root=selectSkill.closest?.('.ae-ficha-skills')?.querySelector('.ae-cbb-quick');
   const input=field(root,'skill'),name=selectSkill.dataset.cbbPickSkill;
   if(!sh||!root||!input||!skillNames.includes(name))return;
   input.value=name;
   const current=testMemory(sh);current.skill=name;testBySheet.set(sh.id,current);
   refreshPreview(root,sh);root.scrollIntoView?.({block:'nearest',behavior:'smooth'});
   input.focus?.({preventScroll:true});
   return;
  }
  const step=event.target?.closest?.('[data-cbb-step]');
  if(step?.dataset?.cbbStep){
   event.preventDefault();event.stopPropagation();
   if(step.disabled||busy)return;
   const root=step.closest?.('.ae-cbb-mesa')||document.querySelector('.ae-cbb-mesa');
   const sh=sheet(),target=field(root,step.dataset.cbbStep);
   if(!sh||!api.canEditSheet(sh.id)||sh.automationEnabled===false||!on()||!target||target.disabled)return;
   target.value=String(safeSteps(Number(target.value||0)+Number(step.dataset.cbbDelta||0)));
   if(step.dataset.cbbStep==='resistSteps')refreshResistance(root,sh);
   else refreshPreview(root,sh);
   return;
  }
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
  if(sh.automationEnabled===false&&!['toggleAutomation','reset','pin'].includes(cmd)){
   api.toast('Automação desativada','Reative a automação no Resumo para usar a Mesa.',true);
   return;
  }
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
  if(cmd==='reset'){
   if(!api.master?.()){
    api.toast('Somente mestre','O reinício integral da ficha é reservado ao mestre.',true);
    return;
   }
   if(typeof api.confirmSite!=='function'){
    api.toast('Confirmação indisponível','Não foi possível confirmar o reinício.',true);
    return;
   }
   api.confirmSite('REINICIAR FICHA?',
    'Restaurar Vida, Estabilidade e ALMA, zerar condições e exposições, encerrar efeitos e voltar à primeira rodada? A construção da ficha e o histórico de rolagens serão preservados.',
    ()=>{
     if(busy)return;
     busy=true;lockResult(b,true);
     executeAction(root,b,cmd).catch(error=>api.toast('Reinício não realizado',String(error?.message||error),true))
      .finally(()=>{busy=false;lockResult(b,false)});
    });
   return;
  }
  busy=true;lockResult(b,true);
  try{
   if(cmd==='skill'||cmd==='pool')await executeRoll(root,cmd);
   else await executeAction(root,b,cmd);
  }catch(error){api.toast('Ação não realizada',String(error?.message||error),true)}
  finally{busy=false;lockResult(b,false)}
 }
 function refreshResistance(root,s=sheet()){
  if(!root||!s)return;
  const target=root.querySelector?.('[data-cbb-resist-status]');
  if(!target)return;
  if(read(root,'poolMode','dano')!=='resistencia'){target.textContent='';return}
  const resource=read(root,'poolResource','vida');
  const group={vida:'Corpo',estabilidade:'Mente',alma:'Espírito'}[resource]||'Corpo';
  const original=Number(s.groups?.[group]||4);
  const steps=safeSteps(read(root,'resistSteps','0'));
  const count=Number(read(root,'poolCount','0'));
  const baseProtection=Number(read(root,'poolFaces','8'));
  const fragile=engine.normalizedConditions(s).has('fragilizado');
  const natural=engine.stepDie(s,original,steps+(fragile&&count===0?-1:0));
  const protection=count>0?' · proteção d'+engine.stepDie(s,baseProtection,fragile?-1:0):'';
  target.textContent='Resistência: '+group+' d'+natural+protection+
   (fragile?' · Fragilizado aplicado':'');
 }
 function onChange(event){
  const target=event.target,key=target?.dataset?.cbbField;
  if(!key)return;
  const root=target.closest?.('.ae-cbb-mesa'),s=sheet();
  if(!root||!s)return;
  if(['groupSteps','skillSteps','resistSteps'].includes(key)&&event.type==='change'){
   const numeric=Number(target.value);
   target.value=String(target.value===''||!Number.isInteger(numeric)?0:safeSteps(numeric));
  }
  if(key==='poolMode'){
   const resist=root.querySelector?.('[data-cbb-resist-controls]');
   if(resist)resist.hidden=target.value!=='resistencia';
  }
  if(key==='poolMode'&&target.value==='resistencia'){
   const qty=field(root,'poolCount');if(qty)qty.value='0';
   const src=field(root,'source');if(src)src.value='';
   const flat=field(root,'flat');if(flat)flat.value='0';
  }
  if(key==='source'){
   const index=Number(target.value);
   if(target.value!==''&&s.abilities?.[index]){
    const pool=engine.abilityPool(s.abilities[index]);
    if(pool){
     const qty=field(root,'poolCount');if(qty)qty.value=String(pool.count);
     const faces=field(root,'poolFaces');if(faces)faces.value=String(pool.faces);
     const mode=field(root,'poolMode');if(mode)mode.value=pool.kind;
    }
   }
  }
  if(['skill','context','groupSteps','skillSteps','reaction','vision','sense','otherTarget'].includes(key))
   refreshPreview(root,s);
  if(['poolMode','poolCount','poolFaces','poolResource','resistSteps','source'].includes(key))
   refreshResistance(root,s);
 }
 function onInput(event){
  if(['groupSteps','skillSteps','resistSteps'].includes(event.target?.dataset?.cbbField))onChange(event);
 }
 document.addEventListener('click',onClick);
 document.addEventListener('change',onChange);
 document.addEventListener('input',onInput);
 global.addEventListener?.('arquivo-online-snapshot',()=>{
  const root=document.querySelector?.('.ae-cbb-mesa');
  if(root?.dataset?.cbbSheet===api.currentSheet){refreshPreview(root);refreshResistance(root)}
  refreshDamageSummaries();
 });
 global.ARQUIVO_CBB_UI=Object.freeze({render,renderSkillQuick,abilityActions,abilitySummary,engine,refreshPreview,refreshResistance,refreshDamageSummaries});
})(window);