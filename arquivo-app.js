
'use strict';
const DEFAULT={site:{title:'Arquivo Espiritual',subtitle:'O seu universo. As suas regras.',accent:'#4CC9F0',cover:''},keys:[],rules:[],sheets:[{id:'demo-ichigo',name:'Ichigo Kurosaki',subtitle:'Shinigami Substituto · Ficha ilustrativa',level:3,image:'',resources:{vida:{current:65,max:65},estabilidade:{current:60,max:60},alma:{current:15,max:15}},groups:{Corpo:10,Mente:8,'Espírito':10},skills:{Vigor:8,Fortitude:8,Destreza:10,Atenção:8,Sigilo:4,Precisão:8,Cultura:4,Determinação:8,Raciocínio:6,Tática:6,Instinto:8,'Lábia':4,Presença:8,Sensibilidade:8,Integridade:6,Disciplina:8,Manipulação:6,'Liberação':10},abilities:[{name:'Getsuga Tenshō',cost:4,description:'Exemplo ilustrativo de habilidade. Defina efeitos e dano conforme a ficha oficial.'}],notes:'Ficha de exemplo — valores ilustrativos, não oficiais.'}]};
const GROUPS={Corpo:['Vigor','Fortitude','Destreza','Atenção','Sigilo','Precisão'],Mente:['Cultura','Determinação','Raciocínio','Tática','Instinto','Lábia'],Espírito:['Presença','Sensibilidade','Integridade','Disciplina','Manipulação','Liberação']};
const VALID_DICE=[4,6,8,10,12,20],PAGES=[['home','Visão geral','home'],['library','Biblioteca','book'],['sheets','Fichas','user'],['rolls','Rolagens','dice'],['live','Sessão ao vivo','video'],['settings','Configurações','settings'],['admin','Painel do mestre','shield']];
const ICONS={video:'<rect x="2.5" y="5" width="14" height="14" rx="2"/><path d="m16.5 10 5-3v10l-5-3"/>',home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',book:'<path d="M4 4h15v16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M4 16h15M7 8h8M7 11h7"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',dice:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="16" r="1"/><circle cx="12" cy="12" r="1"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',shield:'<path d="m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6z"/><path d="m9 12 2 2 4-4"/>',play:'<path d="m8 5 12 7-12 7z"/>',pause:'<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>',speaker:'<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 9a4 4 0 0 1 0 6"/>',mute:'<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="m16 9 5 6m0-6-5 6"/>',spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',heart:'<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',brain:'<path d="M12 5a4 4 0 0 0-7.5 2 4 4 0 0 0-1 7A4 4 0 0 0 9 20h3zM12 5a4 4 0 0 1 7.5 2 4 4 0 0 1 1 7A4 4 0 0 1 15 20h-3z"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',back:'<path d="M20 12H4m7 7-7-7 7-7"/>',upload:'<path d="M12 17V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',edit:'<path d="m4 20 4-.8L20 7l-3-3L5 16z"/>',download:'<path d="M12 3v14m-5-5 5 5 5-5M4 20h16"/>',close:'<path d="M5 5l14 14M19 5 5 19"/>',check:'<path d="m4 12 6 6 10-12"/>',trash:'<path d="M4 7h16m-13 0 1 14h8l1-14M9 7V4h6v3"/>'};
function icon(n,cls=''){return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||ICONS.spark}</svg>`}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));const el=id=>document.getElementById(id),uid=()=>('arquivo-'+Math.random().toString(36).slice(2,10)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function safeStore(kind){try{const s=window[kind];const k='__arquivo_probe__';s.setItem(k,'ok');s.removeItem(k);return s}catch(e){return null}}
const DATASTORE={local:safeStore('localStorage'),session:safeStore('sessionStorage'),blocked:false,load(){const base=clone(window.ARQUIVO_PUBLICADO||DEFAULT);if(!this.local){this.blocked=true;return base}try{const raw=this.local.getItem('arquivo_data')||this.local.getItem('c'+'bb_data');if(!raw)return base;const saved=JSON.parse(raw);if(!saved.site||!Array.isArray(saved.sheets)||!Array.isArray(saved.rules))return base;if(!this.local.getItem('arquivo_data'))this.local.setItem('arquivo_data',raw);if(!Array.isArray(saved.keys)){this.local.setItem('arquivo_owner_device','sim');return saved}if(this.getRole()==='master'||this.local.getItem('arquivo_owner_device')==='sim')return saved;for(const s of base.sheets){const local=saved.sheets.find(x=>x.id===s.id);if(!local)continue;for(const k of ['vida','estabilidade','alma'])if(local.resources?.[k])s.resources[k].current=clamp(local.resources[k].current,0,s.resources[k].max);s.conditions=local.conditions||[];s.notes=local.notes??s.notes;s.restCount=local.restCount||0;s.desgaste=local.desgaste||0;s.exposures=local.exposures||{}}return base}catch(e){this.blocked=true;return base}},save(data){if(!this.local){this.blocked=true;storageWarning();return false}try{this.local.setItem('arquivo_data',JSON.stringify(data));return true}catch(e){this.blocked=true;storageWarning();return false}},getRole(){try{return this.session?.getItem('arquivo_role')||'guest'}catch(e){return 'guest'}},getKeyId(){try{return this.session?.getItem('arquivo_key_id')||''}catch(e){return ''}},setRole(r,id=''){try{this.session?.setItem('arquivo_role',r);this.session?.setItem('arquivo_key_id',id);if(r==='master')this.local?.setItem('arquivo_owner_device','sim')}catch(e){this.blocked=true;storageWarning()}},clearRole(){try{this.session?.removeItem('arquivo_role');this.session?.removeItem('arquivo_key_id')}catch(e){}}};
let db=DATASTORE.load(),role=DATASTORE.getRole(),page='home',currentSheet=null,tab='summary',query='',rollHistory=[],lastRoll=null,musicOn=false,soundOn=true,musicMuted=false,audioContext=null,noticeShown=false,pendingAction=null,keyOwnerId=DATASTORE.getKeyId(),adminSection='content',editorDraft=null,libraryExpandedChapters=new Set(),libraryActiveChapterId=null,grimorioOpen=false,grimorioQuery='',grimorioCategory='Todos',grimorioLetter='Todas',grimorioFavoritesOnly=false,playerPreviewActive=false,brandPressCount=0,brandPressTime=0;
/* Catálogo central das cores. O seletor e o editor usam os mesmos identificadores. */
const PALETTES={
 padrao:{bg:'#090708',panel:'#17100F',raised:'#291A15',structure:'#99522F',cold:'#F1E2D2',text:'#FFF8F1',accent:'#FF791B',pressed:'#C6510D',outline:'#030202'},
 zangetsu:{bg:'#061219',panel:'#0B2630',raised:'#123A48',structure:'#22788D',cold:'#FF942E',text:'#F1FBFF',accent:'#39D6F4',pressed:'#119CBE',outline:'#02090D'},
 ulquiorra:{bg:'#07100C',panel:'#112219',raised:'#1B3326',structure:'#477A5C',cold:'#B4DBC3',text:'#EEFDF2',accent:'#6EE5A6',pressed:'#2FA56D',outline:'#040806'},
 renji:{bg:'#10080B',panel:'#251018',raised:'#341922',structure:'#935168',cold:'#F6AEC7',text:'#FFF0F5',accent:'#F45469',pressed:'#B93350',outline:'#070307'},
 yoruichi:{bg:'#100B1D',panel:'#211631',raised:'#342447',structure:'#85669C',cold:'#E9B95E',text:'#F9F1FF',accent:'#F5C96F',pressed:'#BA903A',outline:'#09050F'},
 'zangetsu-prata':{bg:'#0A0C0F',panel:'#191D22',raised:'#292E34',structure:'#59646D',cold:'#ABB4BD',text:'#F6F8FA',accent:'#D0D5DB',pressed:'#89949F',outline:'#050506'},
 // Chad: Camel, Attractive Brown, Native Wine, Husk, Dark Sage e Cod Gray.
 // Texto marfim derivado da família Camel para garantir contraste sobre o marrom.
 chad:{bg:'#0B0A0A',panel:'#483139',raised:'#77483A',structure:'#758159',cold:'#B8A35A',text:'#F7E9D7',accent:'#C3966D',pressed:'#77483A',outline:'#0B0A0A'},
 // Rukia: Stygian, Country White, Taylor e Anna.
 rukia:{bg:'#1E1F25',panel:'#292932',raised:'#595080',structure:'#595080',cold:'#EBEBE8',text:'#EBEBE8',accent:'#F0CBBB',pressed:'#595080',outline:'#121217'},
 // Uryu: Cute Silver, Cool Blue, Sporty Navy, Comet e Bianchi Green.
 uryu:{bg:'#282A47',panel:'#444974',raised:'#343658',structure:'#6F8DB3',cold:'#B5FFF6',text:'#E4E7EB',accent:'#B5FFF6',pressed:'#6F8DB3',outline:'#191A2C'},
 shinji:{bg:'#14120E',panel:'#251F15',raised:'#372D1A',structure:'#987B33',cold:'#FF7881',text:'#FFF9E7',accent:'#FFD44B',pressed:'#CFA731',outline:'#080704'}
};
// Ordem exibida em Configurações. Rukia vem após Uryu, já que não
// foi indicada na sequência enviada.
const PALETTE_CHOICES=[
 ['zangetsu','Velho Zangetsu','Ciano e laranja sobre azul profundo.'],
 ['padrao','Ichigo','Laranja intenso e tons escuros.'],
 ['chad','Chad','Camel, marrom, vinho escuro, dourado envelhecido e verde-sálvia.'],
 ['uryu','Uryu','Prata, azul, marinho e verde-água.'],
 ['rukia','Rukia','Preto azulado, branco, rosa-claro e violeta.'],
 ['renji','Renji','Vermelho, preto e rosa.'],
 ['yoruichi','Yoruichi','Roxo noturno e dourado.'],
 ['shinji','Shinji','Amarelo, branco e vermelho · Sakanade: textos invertidos.'],
 ['ulquiorra','Ulquiorra','Verde espiritual sobre preto.'],
 ['zangetsu-prata','Zangetsu','Prata, grafite e preto.']
];
const PALETTE_IDS=PALETTE_CHOICES.map(([id])=>id);
const PALETTE_COLOR_KEYS=['bg','panel','raised','structure','cold','text','accent','pressed','outline'];
const validPaletteColor=value=>typeof value==='string'&&/^#[0-9A-Fa-f]{6}$/.test(value);
function paletteName(id){return id==='personalizado'?'Personalizada':PALETTE_CHOICES.find(([key])=>key===id)?.[1]||'Velho Zangetsu'}
function paletteDescription(id){return PALETTE_CHOICES.find(([key])=>key===id)?.[2]||'Cores escolhidas por você.'}

const DEVICE_DEFAULT={preset:'zangetsu',custom:null,fontSize:100,interfaceScale:100,customFont:false,spacing:false,speechEnabled:true,speechRate:1,performanceMode:false,reduceMotion:null,grain:true,energy:true,masterVolume:100,masterMuted:false,musicVolume:20,effectsVolume:35,musicMuted:false,effectsMuted:false,noSheetMotion:false,rollImpacts:true,sheetColors:{},hudMinimized:true};
const PREFSSTORE={load(){try{const v=DATASTORE.local?.getItem('arquivo_preferencias');if(!v)return {...DEVICE_DEFAULT};const saved=JSON.parse(v);delete saved.dyslexiaMode;delete saved.easyFont;return {...DEVICE_DEFAULT,...saved}}catch(e){return {...DEVICE_DEFAULT}}},save(){try{DATASTORE.local?.setItem('arquivo_preferencias',JSON.stringify(prefs))}catch(e){DATASTORE.blocked=true;storageWarning()}}};
let prefs=PREFSSTORE.load();if(!PALETTE_IDS.includes(prefs.preset)&&prefs.preset!=='personalizado'){
 prefs.preset='zangetsu';PREFSSTORE.save();
}
if(Number(prefs.paletteDefaultVersion)<3){prefs.paletteDefaultVersion=3;PREFSSTORE.save()}
const ACCESS_TEXT_SIZES=[50,75,100,125,150,175,200];
const ACCESS_UI_SCALES=Array.from({length:16},(_,i)=>50+i*10);
if(!ACCESS_UI_SCALES.includes(Number(prefs.interfaceScale))){
 const previous=Number(prefs.interfaceScale);
 prefs.interfaceScale=Number.isFinite(previous)?Math.max(50,Math.min(200,Math.round(previous/10)*10)):100;
 PREFSSTORE.save();
}
if(!ACCESS_TEXT_SIZES.includes(Number(prefs.fontSize))){
 const prior=Number(prefs.fontSize)||100;
 prefs.fontSize=ACCESS_TEXT_SIZES.reduce((best,next)=>Math.abs(next-prior)<Math.abs(best-prior)?next:best,100);
 PREFSSTORE.save();
}
const SITE_THEME=()=>PALETTES[db.site.defaultPalette]||PALETTES.zangetsu;
function currentPalette(){
 if(prefs.preset!=='personalizado')return PALETTES[prefs.preset]||PALETTES.zangetsu;
 const source=prefs.custom&&typeof prefs.custom==='object'?prefs.custom:{};
 return Object.fromEntries(PALETTE_COLOR_KEYS.map(key=>
  [key,validPaletteColor(source[key])?source[key]:PALETTES.zangetsu[key]]
 ));
}

function clampAudio(value){return Math.max(0,Math.min(100,Number(value)||0))}
function effectiveMusicVolume(){return prefs.masterMuted||prefs.musicMuted?0:clampAudio(prefs.masterVolume)*clampAudio(prefs.musicVolume)/100}
function effectiveEffectsVolume(){return prefs.masterMuted||prefs.effectsMuted?0:clampAudio(prefs.masterVolume)*clampAudio(prefs.effectsVolume)/100}
function ensureCustomPalette(){
 if(prefs.preset!=='personalizado'){const old=currentPalette();prefs.custom={...old};prefs.preset='personalizado'}
 else if(!prefs.custom)prefs.custom={...PALETTES.zangetsu};
}
function paletteEditorStatus(){
 return prefs.preset==='personalizado'?'PERSONALIZADA · ALTERAÇÕES SALVAS':paletteName(prefs.preset).toLocaleUpperCase('pt-BR')+' · PALETA BASE';
}
function updatePaletteEditorUi(){
 const state=el('paletteEditingState');if(state)state.textContent=paletteEditorStatus();
 const w=el('contrastWarning'),p=currentPalette();
 if(w)w.textContent=contrast(p.text,p.bg)<4.5||contrast(p.text,p.panel)<4.5?'Contraste insuficiente para leitura. Ajuste Texto ou Fundo.':'Contraste de leitura adequado.';
 const prev=el('paletteLivePreview');if(prev)prev.style.background=prefs.globalGradient&&!prefs.performanceMode?'linear-gradient(135deg, '+p.panel+', '+(prefs.globalGradientEnd||p.raised)+')':p.panel;
}
function changeCustomPaletteColor(key,value){
 if(!PALETTE_COLOR_KEYS.includes(key)||!validPaletteColor(value))return;
 ensureCustomPalette();prefs.custom[key]=value;PREFSSTORE.save();applyPrefs();updatePaletteEditorUi();
}
function changeCustomGradient(key,value){
 ensureCustomPalette();
 if(key==='toggle')prefs.globalGradient=!!value;
 else if(key==='end'&&/^#[0-9a-fA-F]{6}$/.test(value))prefs.globalGradientEnd=value;
 else return;
 PREFSSTORE.save();applyPrefs();updatePaletteEditorUi();
}

function sheetMotionOff(){return motionOff()||(prefs.noSheetMotion&&page==='sheets')}
function motionOff(){return !!prefs.performanceMode||prefs.reduceMotion===true||(prefs.reduceMotion===null&&matchMedia('(prefers-reduced-motion: reduce)').matches)}
function applyPrefs(){const root=document.documentElement,p=currentPalette();for(const [k,v] of Object.entries(p))root.style.setProperty('--theme-'+k,v);root.style.setProperty('--accent-ink',contrast('#000000',p.accent)>=contrast('#FFFFFF',p.accent)?'#000000':'#FFFFFF');root.style.setProperty('--optional-panel-gradient',prefs.globalGradient&&!prefs.performanceMode?`linear-gradient(135deg, ${p.panel}, ${prefs.globalGradientEnd||p.raised})`:'none');root.classList.toggle('global-gradient',!!prefs.globalGradient&&!prefs.performanceMode);root.classList.toggle('performance-mode',!!prefs.performanceMode);root.style.setProperty('--ae-reading-scale',String(Math.max(.5,Math.min(2,Number(prefs.fontSize||100)/100))));root.style.setProperty('--ae-interface-scale',String((ACCESS_UI_SCALES.includes(Number(prefs.interfaceScale))?Number(prefs.interfaceScale):100)/100));document.body.dataset.palette=prefs.preset;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',p.bg);document.body.classList.toggle('theme-ichigo',prefs.preset==='padrao');document.body.classList.toggle('theme-zangetsu',prefs.preset==='zangetsu');root.style.fontSize=prefs.fontSize+'%';root.classList.toggle('reduce-motion',motionOff());root.classList.toggle('no-sheet-motion',!!prefs.noSheetMotion&&page==='sheets');root.classList.toggle('no-grain',!prefs.grain||!!prefs.performanceMode);root.classList.toggle('no-energy',!prefs.energy||motionOff());root.classList.toggle('custom-font',!!prefs.customFont);root.classList.toggle('wide-spacing',!!prefs.spacing);window.ARQUIVO_SPEECH?.refresh();if(el('musicVolume'))el('musicVolume').value=prefs.musicVolume;try{el('audio').volume=effectiveMusicVolume()/100}catch(e){}musicMuted=!!(prefs.musicMuted||prefs.masterMuted);soundOn=effectiveEffectsVolume()>0;applyExternalMusicVolume();updateMusicUi();document.querySelectorAll('input[type=range]').forEach(updateRangeTrack);updateSettingsVolumeSliders();window.__refreshBackground?.()}
function contrast(hex1,hex2){function lum(h){const a=h.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2]}const a=lum(hex1),b=lum(hex2);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}

function paletteEditor(){
 const p=currentPalette();
 const groups=[
  ['CORES PRINCIPAIS','As cores mais visíveis durante a navegação.',[
   ['Cor principal','accent','Botões e ações em destaque'],
   ['Cor secundária','cold','Detalhes e destaques de apoio'],
   ['Cor do texto','text','Títulos e textos do site']
  ]],
  ['FUNDOS','As superfícies onde as informações aparecem.',[
   ['Cor de fundo','bg','Fundo geral da página'],
   ['Cor dos painéis','panel','Janelas e painéis principais'],
   ['Cor dos cartões','raised','Blocos e áreas elevadas']
  ]],
  ['DETALHES','Ajustes finos para bordas e interações.',[
   ['Cor das bordas','structure','Linhas e divisões'],
   ['Cor ao pressionar','pressed','Botões ao serem pressionados'],
   ['Cor dos contornos','outline','Traços e molduras de destaque']
  ]]
 ];
 const fields=groups.map(([title,description,colors])=>
  '<section class="ae-palette-group" aria-label="'+title+'">'+
  '<div class="ae-palette-group-heading"><h3>'+title+'</h3><p>'+description+'</p></div>'+
  '<div class="ae-palette-editor-grid">'+colors.map(([label,key,hint])=>
   '<label class="ae-palette-color"><span class="ae-palette-color-copy"><strong>'+label+'</strong><small>'+hint+'</small></span>'+
   '<input type="color" data-palette="'+key+'" value="'+p[key]+'" aria-label="'+label+'" title="Alterar '+label.toLocaleLowerCase('pt-BR')+'"></label>'
  ).join('')+'</div></section>'
 ).join('');
 const body='<div class="ae-palette-editor">'+
 '<p class="ae-settings-muted">Escolha as cores de cada parte do site. As mudanças são salvas automaticamente neste dispositivo.</p>'+
 '<div class="ae-palette-state" id="paletteEditingState">'+paletteEditorStatus()+'</div>'+
 fields+
 '<section class="ae-palette-group ae-palette-gradient-group"><div class="ae-palette-group-heading"><h3>GRADIENTE</h3><p>Opcional: combine duas cores no fundo dos painéis.</p></div>'+
 '<div class="ae-palette-gradient"><label class="ae-settings-check"><input type="checkbox" id="globalGradient" '+(prefs.globalGradient?'checked':'')+'> Usar gradiente nos painéis</label>'+
 '<label class="ae-palette-gradient-color">Cor final do gradiente<input type="color" id="globalGradientEnd" value="'+(prefs.globalGradientEnd||p.raised)+'" aria-label="Cor final do gradiente"></label></div></section>'+
 '<div class="ae-palette-live-preview" id="paletteLivePreview" aria-label="Prévia das cores"><span>PRÉVIA</span><strong>Exemplo de texto</strong><span class="ae-palette-preview-action">BOTÃO DE AÇÃO</span></div>'+
 '<p class="ae-palette-warning" id="contrastWarning"></p></div>';
 modal('PERSONALIZAR PALETA',body,[['CONCLUÍDO','closeModal','main']]);
 const dialog=el('dialogRoot')?.querySelector('.dialog');dialog?.classList.add('ae-palette-dialog');
 updatePaletteEditorUi();
}
function settingsVolumeRow(label,id,value,description,muted){
 return '<div class="ae-volume-row'+(muted?' is-muted':'')+'"><div class="ae-volume-row-heading"><label for="'+id+'">'+label+'</label><output for="'+id+'" aria-live="off">'+(muted?0:value)+'%</output></div>'+
 '<input type="range" id="'+id+'" min="0" max="100" step="1" value="'+(muted?0:value)+'" '+(muted?'disabled ':'')+'aria-label="'+label+(muted?' (silenciado)':'')+'"><p>'+description+'</p></div>';
}
function updateSettingsVolumeSliders(){
 const controls=[
  ['settingsMaster','masterVolume',!!prefs.masterMuted,'Volume geral'],
  ['settingsMusic','musicVolume',!!(prefs.masterMuted||prefs.musicMuted),'Música'],
  ['settingsEffects','effectsVolume',!!(prefs.masterMuted||prefs.effectsMuted),'Efeitos sonoros']
 ];
 for(const [id,key,muted,label] of controls){
  const node=el(id);if(!node)continue;
  node.disabled=muted;
  node.value=muted?'0':String(clampAudio(prefs[key]));
  const output=node.closest('.ae-volume-row')?.querySelector('output');
  if(output)output.textContent=(muted?0:clampAudio(prefs[key]))+'%';
  node.setAttribute('aria-label',label+(muted?' (silenciado)':''));
  node.closest('.ae-volume-row')?.classList.toggle('is-muted',muted);
  updateRangeTrack(node);
 }
}
function settings(){
 const p=currentPalette();
 const paletteSwatches={
 chad:['bg','panel','raised','structure','cold','accent'],
 rukia:['bg','text','accent','structure'],
 uryu:['text','structure','panel','bg','accent']
 };
 const swatches=(paletteSwatches[prefs.preset]||['bg','panel','structure','cold','accent','text']).map(k=>
  '<span aria-hidden="true" style="background:'+p[k]+'"></span>').join('');
 return headline('PREFERÊNCIAS DO DISPOSITIVO','CONFIGURAÇÕES','Personalize sua experiência. As preferências são salvas neste dispositivo.')+
 '<div class="ae-settings-stack">'+
 '<section class="panel ae-settings-panel" aria-labelledby="settingsSoundTitle">'+
 '<div class="ae-settings-heading"><div><span class="ae-settings-index">ÁUDIO</span><h2 id="settingsSoundTitle">SOM</h2><p>Ajuste o volume da experiência sem alterar os demais jogadores.</p></div>'+btn('RESTAURAR','resetSettings:som','small')+'</div>'+
 '<div class="ae-settings-volume-list">'+
 settingsVolumeRow('Volume geral','settingsMaster',clampAudio(prefs.masterVolume),'Controla a intensidade total da música e dos efeitos.',!!prefs.masterMuted)+
 settingsVolumeRow('Música','settingsMusic',clampAudio(prefs.musicVolume),'Volume do player local e do YouTube integrado.',!!(prefs.masterMuted||prefs.musicMuted))+
 settingsVolumeRow('Efeitos sonoros','settingsEffects',clampAudio(prefs.effectsVolume),'Cliques, rolagens, habilidades e impactos.',!!(prefs.masterMuted||prefs.effectsMuted))+
 '</div><div class="ae-settings-muted-grid">'+
 '<label class="ae-settings-check"><input type="checkbox" id="settingsMuteMaster" '+(prefs.masterMuted?'checked':'')+'> Silenciar tudo</label>'+
 '<label class="ae-settings-check"><input type="checkbox" id="settingsMuteMusic" '+(prefs.musicMuted?'checked':'')+'> Silenciar música</label>'+
 '<label class="ae-settings-check"><input type="checkbox" id="settingsMuteEffects" '+(prefs.effectsMuted?'checked':'')+'> Silenciar efeitos</label>'+
 '</div><div class="ae-settings-footer">'+btn('TESTAR EFEITOS','testSound','main')+
 '<p>O áudio incorporado do Spotify é controlado pelo próprio player ou dispositivo.</p></div></section>'+
 '<section class="panel ae-settings-panel ae-settings-palette" aria-labelledby="settingsPaletteTitle">'+
 '<div class="ae-settings-heading"><div><span class="ae-settings-index">APARÊNCIA</span><h2 id="settingsPaletteTitle">PALETA</h2><p>Escolha uma base ou ajuste cada cor separadamente.</p></div>'+btn('RESTAURAR','resetSettings:paleta','small')+'</div>'+
 '<div class="ae-palette-chooser"><div class="ae-palette-chooser-main"><label for="presetChoice">Paleta de cores</label><div class="ae-palette-select-row"><select id="presetChoice">'+
 PALETTE_CHOICES.map(([id,label])=>'<option value="'+id+'" '+(prefs.preset===id?'selected':'')+'>'+label+'</option>').join('')+
 '<option value="personalizado" '+(prefs.preset==='personalizado'?'selected':'')+'>Personalizada</option>'+
 '</select><button class="ae-palette-gear" type="button" data-action="paletteEditor" title="Personalizar paleta" aria-label="Abrir editor de paleta">'+icon('settings')+'</button></div>'+
 '<div class="ae-palette-swatches" aria-label="Cores da paleta">'+swatches+'</div><small class="ae-palette-caption">'+paletteDescription(prefs.preset)+'</small></div></div>'+
 '</section>'+
 '<section class="panel ae-settings-panel" aria-labelledby="settingsAccessTitle">'+
 '<div class="ae-settings-heading"><div><span class="ae-settings-index">LEITURA</span><h2 id="settingsAccessTitle">ACESSIBILIDADE</h2><p>Personalize a leitura e a navegação.</p></div>'+btn('RESTAURAR','resetSettings:acesso','small')+'</div>'+
 '<div class="ae-settings-access-grid">'+
 '<div class="field ae-access-size-field"><label for="sizeChoice">Tamanho do texto</label><select id="sizeChoice">'+[50,75,100,125,150,175,200].map(v=>'<option value="'+v+'" '+(prefs.fontSize===v?'selected':'')+'>'+v+'%</option>').join('')+'</select></div>'+
 '<div class="field ae-access-size-field"><label for="interfaceScaleChoice">Escala da interface</label><select id="interfaceScaleChoice" aria-label="Escala da interface">'+ACCESS_UI_SCALES.map(v=>'<option value="'+v+'" '+(Number(prefs.interfaceScale)===v?'selected':'')+'>'+v+'%</option>').join('')+'</select></div></div>'+
 '<div class="ae-settings-muted-grid ae-access-reading-options">'+
 '<label class="ae-settings-check ae-access-option"><input type="checkbox" data-setting="customFont" '+(prefs.customFont?'checked':'')+'><span><strong>Usar fonte personalizada</strong><small>Aplica a fonte CBB aos textos do site.</small></span></label>'+
 '<label class="ae-settings-check ae-access-option"><input type="checkbox" data-setting="spacing" '+(prefs.spacing?'checked':'')+'><span><strong>Espaçamento ampliado</strong><small>Mais espaço entre textos e elementos da interface.</small></span></label></div>'+

 '<div class="ae-speech-settings">'+
 '<label class="ae-settings-check ae-access-option ae-access-wide"><input type="checkbox" data-setting="speechEnabled" '+(prefs.speechEnabled?'checked':'')+'><span><strong>Leitura em voz alta</strong><small>Selecione textos nas regras, fichas ou glossários para ouvir no painel móvel.</small></span></label>'+
 '<div class="ae-speech-controls"><div class="field"><label for="speechRateChoice">Velocidade da narração</label><select id="speechRateChoice" '+(!prefs.speechEnabled?'disabled':'')+'>'+[[0.5,'Muito lenta · 0,5×'],[0.75,'Lenta · 0,75×'],[1,'Normal · 1×'],[1.25,'Ágil · 1,25×'],[1.5,'Rápida · 1,5×'],[1.7,'Muito rápida · 1,7×'],[2,'Máxima · 2×']].map(([v,n])=>'<option value="'+v+'" '+(Number(prefs.speechRate)===v?'selected':'')+'>'+n+'</option>').join('')+'</select></div>'+
 '<div class="ae-speech-buttons"><button type="button" class="btn small" data-action="speechSample" '+(!prefs.speechEnabled?'disabled':'')+'>OUVIR EXEMPLO</button><button type="button" class="btn small" data-action="speechResetPanel" '+(!prefs.speechEnabled?'disabled':'')+'>RESTAURAR PAINEL</button></div></div>'+
 '<p class="ae-access-helper">Arraste o leitor pelo título; use + ou − para alterar o tamanho.</p></div>'+
 '<div class="ae-access-performance"><label class="ae-settings-check ae-access-option ae-access-wide"><input type="checkbox" data-setting="performanceMode" '+(prefs.performanceMode?'checked':'')+'><span><strong>Modo desempenho</strong><small>Desativa animações e efeitos visuais sem comprometer as funções do site.</small></span></label></div>'+

 '</section>'+
 '</div>';
}
function updateRangeTrack(node){if(!node)return;const lo=Number(node.min||0),hi=Number(node.max||100),v=Number(node.value);const pct=hi>lo?Math.min(100,Math.max(0,(v-lo)/(hi-lo)*100)):0;node.style.setProperty('--range-pct',pct+'%')}
function changeSetting(id,value){
 if(id==='presetChoice'){
  if(value==='personalizado')ensureCustomPalette();
  else if(PALETTE_IDS.includes(value)){prefs.preset=value;prefs.globalGradient=false;prefs.globalGradientEnd=null}
  else return;
  PREFSSTORE.save();applyPrefs();render();return;
 }
 if(id==='sizeChoice'){const selected=Number(value);if(![50,75,100,125,150,175,200].includes(selected))return;prefs.fontSize=selected;}
 else if(id==='interfaceScaleChoice'){const selected=Number(value);if(!ACCESS_UI_SCALES.includes(selected))return;prefs.interfaceScale=selected;}
 else if(id==='speechRateChoice'){const rate=Number(value);if(![0.5,0.75,1,1.25,1.5,1.7,2].includes(rate))return;prefs.speechRate=rate;}
 else if(id==='performanceMode')prefs.performanceMode=!!value;
 else if(id==='settingsMaster'){if(prefs.masterMuted)return;prefs.masterVolume=clampAudio(value)}
 else if(id==='settingsMusic'||id==='musicVolume'){if(id==='settingsMusic'&&(prefs.masterMuted||prefs.musicMuted))return;prefs.musicVolume=clampAudio(value)}
 else if(id==='settingsEffects'){if(prefs.masterMuted||prefs.effectsMuted)return;prefs.effectsVolume=clampAudio(value)}
 else if(id==='settingsMuteMaster')prefs.masterMuted=!!value;
 else if(id==='settingsMuteMusic')prefs.musicMuted=!!value;
 else if(id==='settingsMuteEffects')prefs.effectsMuted=!!value;
 else if(id==='speechEnabled'){prefs.speechEnabled=!!value;if(!prefs.speechEnabled)window.ARQUIVO_SPEECH?.stop();}
 else if(['grain','energy','spacing','customFont','noSheetMotion','rollImpacts'].includes(id))prefs[id]=value;
 else return;
 PREFSSTORE.save();applyPrefs();
 if(id==='speechEnabled')render();
}
function resetSettings(section){if(section==='som')Object.assign(prefs,{masterVolume:100,masterMuted:false,musicVolume:20,effectsVolume:35,musicMuted:false,effectsMuted:false});if(section==='paleta')Object.assign(prefs,{preset:'zangetsu',globalGradient:false,globalGradientEnd:null});if(section==='acesso'){Object.assign(prefs,{fontSize:100,interfaceScale:100,customFont:false,spacing:false,speechEnabled:true,speechRate:1,performanceMode:false,reduceMotion:null,grain:true,energy:true,noSheetMotion:false,rollImpacts:true});window.ARQUIVO_SPEECH?.reset()}PREFSSTORE.save();applyPrefs();render()}


function storageWarning(){if(noticeShown)return;noticeShown=true;setTimeout(()=>toast('Armazenamento indisponível','O site continua funcionando em memória. Faça um backup: alterações podem desaparecer ao fechar a página.',true),300)}
function ownerIsMaster(){return role==='master'&&Array.isArray(db.keys)&&db.keys.some(k=>k.id===keyOwnerId&&k.active&&k.kind==='master')}
function isPlayerPreview(){return playerPreviewActive&&ownerIsMaster()}
function master(){return ownerIsMaster()&&!playerPreviewActive}
function player(){return role==='player'||ownerIsMaster()}
function save(){
 if(isPlayerPreview()){toast('Modo de teste','Gravações de fichas e conteúdo não são permitidas nesta prévia.',true);return false}
 // Se existe gravação remota agendada, a edição local mais recente tem prioridade.
 if(onlineCacheTimer){clearTimeout(onlineCacheTimer);onlineCacheTimer=null}
 DATASTORE.save(db);
 if(window.ARQUIVO_SYNC?.state.enabled){
  window.ARQUIVO_SYNC.push(db,role,currentSheet||db.sheets.find(s=>s.id===currentSheet)?.id||'');
 }
 return true;
}
function previewMasterKey(){
 if(!ownerIsMaster()){brandPressCount=0;return}
 const now=Date.now();
 brandPressCount=now-brandPressTime<=2400?brandPressCount+1:1;
 brandPressTime=now;
 if(brandPressCount!==3)return;
 brandPressCount=0;
 if(el('dialogRoot')?.querySelector('[role="dialog"]')){
  toast('Feche a janela','Finalize ou cancele a edição antes de alternar a visualização.');
  return;
 }
 playerPreviewActive=!playerPreviewActive;
 if(playerPreviewActive){
  if(typeof editMode!=='undefined'&&editMode){editMode=false;syncEditModeExit()}
  if(page==='admin')page='home';
  currentSheet=null;
 }
 window.ARQUIVO_SPEECH?.clear(true);
 render();
 toast(playerPreviewActive?'Visualização de jogador':'Visualização de mestre',
  playerPreviewActive?'Prévia de jogador: edições bloqueadas. A autenticação do mestre permanece intacta.':'Permissões de mestre restauradas.');
}
function linkedIds(sh){
 if(!sh)return [];
 if(Array.isArray(sh.linkedKeyIds))return [...new Set(sh.linkedKeyIds.filter(x=>typeof x==='string'&&x))];
 const ids=[];
 if(sh.ownerKeyId)ids.push(sh.ownerKeyId);
 for(const k of db.keys||[])if(k.kind==='player'&&k.sheetId===sh.id&&!ids.includes(k.id))ids.push(k.id);
 return ids;
}
function isLinked(sh){return role==='player'&&!!keyOwnerId&&linkedIds(sh).includes(keyOwnerId)}
function canEditSheet(id){
 const sh=db.sheets.find(s=>s.id===id);
 if(!sh||sh.redacted)return false;
 if(master())return true;
 return isLinked(sh);
}
function sheetPermission(){if(canEditSheet(currentSheet))return true;toast('Somente leitura','Você só pode alterar fichas vinculadas à sua chave.',true);return false}function bearer(){return window.ARQUIVO_SYNC?.state.enabled?(window.ARQUIVO_SYNC.state.identity?.accountName||''):db.keys?.find?.(k=>k.id===keyOwnerId&&k.active)?.name||''}
function toast(title,detail='',error=false){const node=document.createElement('div');node.className='toast'+(error?' error':'');node.setAttribute('role','status');node.innerHTML=`<b>${esc(title)}</b><span>${esc(detail)}</span>`;el('toastRoot').prepend(node);setTimeout(()=>node.remove(),error?9000:5500)}
function modal(title,body,buttons=[['SAIR','closeModal']],topAction=null){
 const normalizedButtons=buttons.map(([label,action,cls=''])=>[
  ['closeModal','returnModal','returnVerifiedSkill'].includes(action)&&/^(voltar|cancelar|fechar|sair)$/i.test(String(label).trim())?'SAIR':label,
  action,cls
 ]);
 const hasFooterExit=normalizedButtons.some(([,action])=>['closeModal','returnModal','returnVerifiedSkill'].includes(action));
 const showHeaderAction=!!topAction||!hasFooterExit;
 const headerMarkup=showHeaderAction?`<button type="button" class="modal-exit ${topAction?'modal-configure':''}" data-action="${esc(topAction?.action||'closeModal')}" aria-label="${esc(topAction?.label||'Sair da janela')}">${esc(topAction?.label||'SAIR')}</button>`:'';
 modalOrigin=document.activeElement;modalDirty=false;el('dialogRoot').innerHTML=`<div class="modal-backdrop" id="modalBackground"><section role="dialog" aria-modal="true" aria-label="${esc(title)}" class="dialog ${showHeaderAction?'':'ae-modal-footer-exit'}">${headerMarkup}<h2>${esc(title)}</h2>${body}${normalizedButtons.length?`<div class="actions">${normalizedButtons.map(([label,action,cls=''])=>`<button type="button" class="btn ${esc(cls)}" data-action="${esc(action)}">${esc(label)}</button>`).join('')}</div>`:''}</section></div>`;const first=el('dialogRoot').querySelector('input,textarea,button');if(first)first.focus()}
let modalDirty=false,modalGuard=false,modalSaved=null;
function hasModalChanges(){return modalDirty&&!modalGuard}
function requestModalClose(){if(hasModalChanges()){
 modalSaved=el('dialogRoot').firstElementChild;modalGuard=true;
 modal('DESCARTAR ALTERAÇÕES?',`<p>As alterações não salvas serão perdidas.</p>`,[['DESCARTAR','discardModal','danger'],['SAIR','returnModal','small']]);
 return;}closeModal();}
function discardModal(){modalGuard=false;modalDirty=false;modalSaved=null;closeModal()}
function returnModal(){if(modalSaved){el('dialogRoot').replaceChildren(modalSaved);modalDirty=true;modalSaved=null;modalGuard=false;el('dialogRoot').querySelector('input,textarea,select,button')?.focus()}}
let modalOrigin=null;function closeModal(){const paletteClosed=!!el('dialogRoot')?.querySelector('.ae-palette-dialog');el('dialogRoot').innerHTML='';modalDirty=false;modalGuard=false;modalSaved=null;pendingAction=null;modalOrigin?.focus?.();modalOrigin=null;if(paletteClosed&&page==='settings')render();queueMicrotask(flushPendingOnlineSnapshot)}function confirmSite(title,detail,callback){pendingAction=callback;modal(title,`<p>${esc(detail)}</p>`,[['Confirmar','confirmPending','alert'],['Cancelar','closeModal']])}function confirmPending(){const fn=pendingAction;closeModal();if(fn)fn()}

const signedSheetMedia=new Map(),pendingMediaSigns=new Set();
function sheetMediaRef(value){return typeof value==='string'&&/^ae-media:\/\/[a-zA-Z0-9_-]{1,100}\/[0-9a-f-]{36}\.(gif|png|jpg|jpeg|webp)$/.test(value)}
function mediaSrc(value){
 if(!sheetMediaRef(value))return dataUrlOk(value)?value:'';
 const cached=signedSheetMedia.get(value);if(cached&&cached.until>Date.now())return cached.url;if(cached)signedSheetMedia.delete(value);
 const sync=window.ARQUIVO_SYNC;
 if(sync?.state.enabled&&!pendingMediaSigns.has(value)){
  pendingMediaSigns.add(value);
  sync.mediaSignedUrl(value).then(url=>{signedSheetMedia.set(value,{url,until:Date.now()+22*60*1000});window.dispatchEvent(new Event('arquivo-media-loaded'))})
   .catch(()=>{signedSheetMedia.set(value,'')}).finally(()=>pendingMediaSigns.delete(value));
 }
 return '';
}
window.addEventListener('arquivo-media-loaded',()=>{if(!el('dialogRoot')?.querySelector('[role="dialog"]'))render()});
window.addEventListener('arquivo-logged-out',()=>{signedSheetMedia.clear()});
const CLEAR_IMAGE='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
function acceptedImage(file){if(!file||!['image/gif','image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Aceitos apenas GIF, JPG, PNG e WebP.');if(file.size>15*1024*1024)throw Error('Limite: 15 MB por arquivo.');if(!file.size)throw Error('Arquivo vazio.');if(!window.ARQUIVO_SYNC?.state.enabled)throw Error('É necessária conexão online para enviar imagens de até 15 MB.')}
function dataUrlOk(s){return sheetMediaRef(s)||(typeof s==='string'&&(/^(https?:\/\/|data:image\/(webp|jpeg|png|gif);base64,|blob:)/i.test(s)))}
function imgStyle(url){const resolved=mediaSrc(url);return resolved?`background-image:url('${encodeURI(resolved).replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29')}')`:''}
function setMobileMore(open){
 const menu=el('mobileMoreMenu'),back=el('mobileMoreBackdrop');
 const show=!!open&&matchMedia('(max-width:680px)').matches;
 if(menu)menu.hidden=!show;if(back)back.hidden=!show;
 const b=el('mobileMoreButton');if(b)b.setAttribute('aria-expanded',String(show));
 document.body.classList.toggle('ae-mobile-more-open',show);
}
function navRender(){
 const entries=PAGES.filter(p=>p[0]!=='admin'||master());
 const secondary=['live','settings','admin'];
 el('navigation').innerHTML=entries.map(([id,name,ic])=>
  `<button type="button" data-page="${id}" class="${page===id?'active':''} ${secondary.includes(id)?'ae-nav-secondary':''}" aria-label="${name}" aria-current="${page===id?'page':'false'}">${icon(ic)}<span class="ae-nav-desktop-name">${name}</span><span class="ae-nav-mobile-name">${id==='home'?'Início':id==='rolls'?'Dados':name}</span></button>`
 ).join('')+
 `<button type="button" id="mobileMoreButton" class="ae-mobile-more-button ${secondary.includes(page)?'active':''}" data-action="mobileMoreToggle" aria-controls="mobileMoreMenu" aria-expanded="${!el('mobileMoreMenu')?.hidden}" aria-label="Mais opções"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg><span class="ae-nav-mobile-name">Mais</span></button>`;
 const mobileAudio=el('mobileAudioButton');if(mobileAudio)mobileAudio.setAttribute('aria-expanded',String(!el('music')?.classList.contains('compact-hud')));
 const links=el('mobileMoreLinks');if(links)links.innerHTML=entries.filter(([id])=>secondary.includes(id)).map(([id,name,ic])=>
  `<button type="button" data-page="${id}" class="${page===id?'active':''}" aria-current="${page===id?'page':'false'}">${icon(ic)}<span>${name}</span></button>`
 ).join('');
const name=db.site.title||'Bleach CBB';el('brandTitle').textContent=name;el('mobileTitle').textContent=name;const tag=isPlayerPreview()?'JOGADOR · TESTE':master()?'MESTRE':role==='player'?'JOGADOR':'VISITANTE';el('rolePill').textContent=bearer()||'VISITANTE';el('roleText').textContent='ACESSO // '+tag;document.body.classList.toggle('ae-master-preview',isPlayerPreview());const mark=el('masterPreviewMark');if(mark){mark.disabled=!ownerIsMaster();mark.setAttribute('aria-pressed',String(isPlayerPreview()));}const out=el('logoutTop');if(out)out.classList.toggle('hidden',!window.ARQUIVO_SYNC?.state.identity);el('storageText').textContent=DATASTORE.blocked?'Sem armazenamento: memória temporária':'Dados locais deste dispositivo';el('headerStatus').textContent=PAGES.find(x=>x[0]===page)?.[1]||'Visão geral'}
let lastRenderedThemeState='';
function applyTheme(){
 const key=JSON.stringify([page,prefs]);
 if(lastRenderedThemeState!==key){lastRenderedThemeState=key;applyPrefs()}
 document.title=(db.site.title||'Bleach CBB')+' · Bleach CBB';
 const title=el('musicName'),musicName=db.site.musicName||'AMBIENTE';
 if(title&&title.textContent!==musicName)title.textContent=musicName;
}
function setPage(p){window.ARQUIVO_SPEECH?.clear(true);setMobileMore(false);if(p==='masterSheets')p='sheets';if(p==='admin'&&!master()){toast('Acesso restrito','Somente o mestre pode usar esse painel.',true);return}page=p;currentSheet=null;tab='summary';render();window.scrollTo({top:0,behavior:'instant'})}

let editMode=false,editingTextKey='',lastOnlineWarning='';
function syncEditModeExit(){
 let node=document.getElementById('editModeExit');
 if(editMode&&master()){
  if(!node){node=document.createElement('button');node.id='editModeExit';node.type='button';node.dataset.action='toggleEditText';node.className='btn danger ae-edit-exit';node.textContent='ENCERRAR EDIÇÃO DE TEXTOS';node.setAttribute('aria-label','Encerrar edição de textos e voltar à navegação');document.body.appendChild(node)}
 }else node?.remove();
}

function legacyTextKey(node,root){
 let bits=[],p=node;
 while(p&&p!==root){const parent=p.parentElement;if(!parent)break;bits.unshift(p.tagName.toLowerCase()+':'+[...parent.children].indexOf(p));p=parent}
 return (root.id||'shell')+'|'+(root.id==='page'?page+'|'+(currentSheet||'')+'|'+tab+'|':'')+bits.join('/');
}
function textKey(node,root){
 const rootName=root.id||(root.classList?.contains('brand')?'brand':root.classList?.contains('toolbar')?'toolbar':'shell');
 const scope=rootName+'|'+(root.id==='page'?page+'|'+(currentSheet||'')+'|'+tab+'|':'');
 let p=node,relative=[];
 while(p&&p!==root){
  const parent=p.parentElement;if(!parent)break;
  const stable=p.id?'id:'+p.id:p.dataset?.action?'action:'+p.dataset.action:
   p.dataset?.page?'page:'+p.dataset.page:
   p.dataset?.open?'open:'+p.dataset.open:p.dataset?.tab?'tab:'+p.dataset.tab:
   p.dataset?.sheet?'sheet:'+p.dataset.sheet:null;
  if(stable)return scope+stable+(relative.length?'|'+relative.join('/'):'');
  relative.unshift(p.tagName.toLowerCase()+':'+[...parent.children].indexOf(p));
  p=parent;
 }
 return legacyTextKey(node,root);
}
function applyTextOverrides(){
 document.body.classList.toggle('editing-text',editMode&&master());syncEditModeExit();
 const overrides=db.site.textOverrides||{};
 if(!editMode&&!Object.keys(overrides).length)return;
 for(const root of [el('navigation'),el('page'),document.querySelector('.brand'),document.querySelector('.toolbar')]){
  if(!root)continue;
  const all=[...root.querySelectorAll('*')].filter(n=>n.children.length===0&&n.textContent.trim()&&
    !['SCRIPT','STYLE','SVG','PATH','INPUT','TEXTAREA','OPTION','SELECT','CODE'].includes(n.tagName)&&
    !n.closest('.dice,.history,.roll-number,.resources,.progress,.character-art,.music,.key-row,.ae-glossary-link,[role=dialog],[data-action="toggleEditText"]'));
  for(const n of all){
    const k=textKey(n,root),legacy=legacyTextKey(n,root),original=n.textContent;
    n.dataset.editText=k;n.dataset.originalText=original;
    if(Object.prototype.hasOwnProperty.call(overrides,k))n.textContent=overrides[k];
    else if(Object.prototype.hasOwnProperty.call(overrides,legacy))n.textContent=overrides[legacy];
  }
 }
 // Mantém os títulos de identidade consistentes quando o nome da marca foi
 // personalizado pelo editor de texto. Respeita overrides individuais existentes.
 const brandName=el('brandTitle')?.textContent?.trim();
 if(brandName){
  const candidates=[el('mobileTitle'),page==='home'?el('page')?.querySelector('.hrow h1'):null];
  for(const node of candidates){
   if(!node||!node.textContent?.trim())continue;
   const root=node.closest('#page')||node.closest('.toolbar');
   const k=node.dataset.editText;
   const legacy=root?legacyTextKey(node,root):'';
   if((k&&Object.prototype.hasOwnProperty.call(overrides,k))||(legacy&&Object.prototype.hasOwnProperty.call(overrides,legacy)))continue;
   node.textContent=brandName;
  }
  document.title=brandName+' · Arquivo Espiritual';
 }
}
function editTextDialog(key,original){if(!master())return;editingTextKey=key;const override=db.site.textOverrides||{};const current=Object.prototype.hasOwnProperty.call(override,key)?override[key]:original;
 modal('EDITAR TEXTO',`<p>O texto pode ser restaurado individualmente.</p><div class="field"><label>Conteúdo<textarea id="textEditorValue" rows="5">${esc(current)}</textarea></label></div>`,[['SALVAR','saveEditedText','main'],['RESTAURAR ORIGINAL','restoreEditedText'],['CANCELAR','closeModal']]);
}
async function saveEditedText(){
 if(!requireMaster())return;
 const value=el('textEditorValue')?.value??'';
 db.site.textOverrides??={};db.site.textOverrides[editingTextKey]=value;
 pendingOnlineSnapshot=null;save();closeModal();render();
 const sync=window.ARQUIVO_SYNC;
 if(!sync?.state.enabled){toast('Texto salvo localmente','Não sincronizado com os jogadores.',true);return}
 await sync.state.pending;
 if(sync.state.lastPushError){toast('Texto não publicado',sync.state.lastPushError,true);return}
 toast('Texto publicado','Jogadores conectados receberão a alteração.');
}
async function restoreEditedText(){
 if(!requireMaster())return;
 delete (db.site.textOverrides||{})[editingTextKey];pendingOnlineSnapshot=null;save();closeModal();render();
 const sync=window.ARQUIVO_SYNC;
 if(!sync?.state.enabled){toast('Texto restaurado localmente','Sem sincronização online.',true);return}
 await sync.state.pending;
 if(sync.state.lastPushError){toast('Restauração não publicada',sync.state.lastPushError,true);return}
 toast('Texto original publicado');
}
async function forceOnlineSync(){
 const st=window.ARQUIVO_SYNC;
 if(!st?.state.enabled){toast('Sem conexão','Conecte-se ao servidor para sincronizar.',true);return}
 try{
  await st.state.pending;
  await st.refresh(true);
  if(pendingOnlineSnapshot)toast('Sincronização recebida','A atualização será exibida quando você terminar de editar o campo aberto.');
  else toast('Sincronização concluída','Conteúdo atualizado com o servidor.');
 }catch(e){toast('Falha de sincronização',e.message,true)}
}
function onlineStatus(){
 const indicator=el('onlineStatus');if(!indicator)return;
 const st=window.ARQUIVO_SYNC?.state;
 const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
 const connecting=!offline&&!!st?.connecting;
 const connected=!offline&&!connecting&&!!st?.enabled&&!st?.error;
 const phase=connected?'connected':connecting?'connecting':'disconnected';
 const labels={connected:'CONECTADO',connecting:'CONECTANDO',disconnected:'DESCONECTADO'};
 indicator.dataset.connection=phase;
 indicator.classList.toggle('connected',connected);
 indicator.classList.toggle('connecting',connecting);
 indicator.classList.toggle('disconnected',phase==='disconnected');
 indicator.textContent=labels[phase];
 const mobile=el('mobileConnectionStatus');if(mobile){mobile.dataset.connection=phase;mobile.textContent=labels[phase];}const mobileMore=el('mobileMoreButton');if(mobileMore){mobileMore.dataset.connection=phase;mobileMore.title='Conexão: '+labels[phase].toLowerCase();}
 indicator.setAttribute('role','status');
 indicator.setAttribute('aria-label','Conexão: '+labels[phase].toLowerCase());
 indicator.title=offline?'Sem acesso à internet':connecting?'Conectando ao servidor':connected?'Sincronização ativa':st?.error||'Sem conexão ativa';
 const banner=el('connectionBanner');
 if(banner){
  const reason=offline?'Dispositivo sem internet':st?.error||'Sem conexão com o servidor';
  banner.textContent=connected||connecting?'':('SEM SINCRONIZAÇÃO · '+reason+(master()?' As alterações não chegam aos outros jogadores.':''));
  banner.classList.toggle('hidden',connected||connecting);
 }
}
function onlineApplyIdentity(identity){if(keyOwnerId!==(identity?.id||'')||role!==(identity?.kind||'guest')){playerPreviewActive=false;brandPressCount=0;signedSheetMedia.clear();historyEpoch++;historyStates.clear();localHistoryPage=1;}role=identity?.kind||'guest';keyOwnerId=identity?.id||'';if(page==='masterSheets')page='sheets';const sync=window.ARQUIVO_SYNC;db.keys=sync?.state.keys||[];
 if(identity&&!db.keys.some(k=>k.id===identity.id))db.keys.push({id:identity.id,kind:identity.kind,name:identity.name,active:true,sheetId:identity.sheetId||''});
 DATASTORE.clearRole();}
function onlineBootstrapDialog(){modal('ATIVAR PRIMEIRO MESTRE',`<p>Use o código do arquivo CODIGO_INICIAL_PRIVADO.txt. Ele funciona apenas uma vez.</p>
 <div class="field"><label>Código de ativação<input id="bootstrapToken" type="password" autocomplete="off"></label></div>
 <div class="field"><label>Seu nome<input id="bootstrapName" value="Mestre"></label></div>
 <div class="field"><label>Nova chave do mestre (12 caracteres ou mais)<input id="bootstrapCode" autocomplete="off" placeholder="ABCD-EFGH-JKLM"></label></div>`,[['ATIVAR MESTRE','onlineBootstrapSave','main'],['CANCELAR','closeModal']])}
async function onlineBootstrapSave(){const st=window.ARQUIVO_SYNC;if(!st?.state.enabled)return;
 try{const identity=await st.bootstrap(el('bootstrapToken').value,el('bootstrapCode').value,el('bootstrapName').value);
  onlineApplyIdentity(identity);closeModal();render();toast('Mestre inicial criado','Salvando o conteúdo atual no servidor.');save();
 }catch(e){toast('Não foi possível ativar',e.message,true)}}
let pendingOnlineSnapshot=null,appliedOnlineRevision=-1,onlineCacheTimer=null;
function flushOnlineCache(){
 if(onlineCacheTimer){clearTimeout(onlineCacheTimer);onlineCacheTimer=null;DATASTORE.save(db)}
}
function scheduleOnlineCache(){
 // LocalStorage é síncrono; em combate não serializar o livro inteiro a cada evento.
 if(onlineCacheTimer)return;
 onlineCacheTimer=setTimeout(()=>{onlineCacheTimer=null;DATASTORE.save(db)},450);
}
window.addEventListener('pagehide',flushOnlineCache);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushOnlineCache()});
function onlineSnapshotIsBlocked(){
 const active=document.activeElement;
 return !!(active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName)&&active.closest('#page'))
  ||!!el('dialogRoot')?.querySelector('[role="dialog"]');
}
function flushPendingOnlineSnapshot(){
 if(!pendingOnlineSnapshot||onlineSnapshotIsBlocked())return;
 const detail=pendingOnlineSnapshot;pendingOnlineSnapshot=null;
 applyOnlineSnapshot(detail);
}
function applyOnlineSnapshot(detail){
 const snap=detail?.data;
 if(!snap?.site||!Array.isArray(snap.sheets)||!Array.isArray(snap.rules))return;
 const revision=Number(detail.revision||0);
 if(revision<appliedOnlineRevision)return;
 if(onlineSnapshotIsBlocked()){
  if(!pendingOnlineSnapshot||revision>=Number(pendingOnlineSnapshot.revision||0))pendingOnlineSnapshot=detail;
  return;
 }
 pendingOnlineSnapshot=null;appliedOnlineRevision=revision;
 // Uma alteração de outra ficha não deve destruir e reconstruir a ficha visível.
 const sameIdentity=role===(detail.identity?.kind||'guest')&&keyOwnerId===(detail.identity?.id||'')&&
  JSON.stringify(db.keys)===JSON.stringify(window.ARQUIVO_SYNC.state.keys);
 const activeSheet=page==='sheets'&&currentSheet?
  db.sheets.find(s=>s.id===currentSheet):null;
 const incomingSheet=activeSheet?snap.sheets.find(s=>s.id===currentSheet):null;
 // Só comparar partes usadas pela área visível. Nunca reconstruir Biblioteca,
 // Visão Geral ou Rolagens por dano de outra ficha que ninguém está vendo.
 const sameSite=sameIdentity&&JSON.stringify(db.site)===JSON.stringify(snap.site);
 const sameRules=()=>JSON.stringify(db.rules)===JSON.stringify(snap.rules);
 const sameVisibleSheet=!!activeSheet&&!!incomingSheet&&sameSite&&
  JSON.stringify(activeSheet)===JSON.stringify(incomingSheet)&&sameRules();
 const sameVisiblePage=sameIdentity&&(
  sameVisibleSheet||
  (page==='library'&&sameSite&&sameRules())||
  (page==='home'&&sameSite&&db.rules.length===snap.rules.length&&db.sheets.length===snap.sheets.length)||
  (page==='rolls'&&sameSite)||
  (page==='live'&&sameSite));
 const oldPrefs=prefs;
 // Supabase já entrega uma árvore JSON nova. Evitar uma segunda clonagem integral.
 db={...snap,keys:window.ARQUIVO_SYNC.state.keys};
 onlineApplyIdentity(detail.identity);prefs=oldPrefs;
 scheduleOnlineCache();
 if(sameVisiblePage){onlineStatus();return}
 render();
}
document.addEventListener('focusout',()=>queueMicrotask(flushPendingOnlineSnapshot),true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)flushPendingOnlineSnapshot()});
setInterval(()=>{if(pendingOnlineSnapshot&&!document.hidden)flushPendingOnlineSnapshot()},1200);
window.addEventListener('arquivo-online-ready',async()=>{
 const st=window.ARQUIVO_SYNC;try{const inf=st.state.identity;
  if(inf?.kind==='master')await st.keys();else if(inf)await st.keys();
  onlineApplyIdentity(inf);await st.refresh(true);render();if(inf)loadVerifiedHistory();
  if(inf?.kind==='master'&&!st.state.appliedOnce)toast('Banco vazio','No painel do mestre, salve a identidade para publicar o conteúdo inicial.');
  else if(!inf)toast('Online conectado','Use sua chave online. Chaves locais não valem no servidor.');
 }catch(e){toast('Falha ao sincronizar',e.message,true)}
});
window.addEventListener('arquivo-online-snapshot',e=>applyOnlineSnapshot(e.detail));
// Música mantém seu ritmo, sem consultas excessivas de histórico ou autenticação.
let lastIdentityCheck=0,identityCheckBusy=false;
setInterval(async()=>{
 if(document.hidden)return;
 syncSharedMusic();
 const st=window.ARQUIVO_SYNC;
 if(!st?.state.enabled||identityCheckBusy||Date.now()-lastIdentityCheck<15000)return;
 lastIdentityCheck=Date.now();identityCheckBusy=true;
 try{
  const identity=await st.state.client.rpc('ae_session_info');
  if(identity.error)return;
  const info=identity.data?.id?identity.data:null;
  if(st.state.identity?.id&&!info){await st.logout();return}
  if(info?.id)st.state.identity=info;
 }catch(e){}finally{identityCheckBusy=false}
},3000);
window.addEventListener('arquivo-sync-error',e=>{const msg=e.detail||'';if(msg!==lastOnlineWarning){lastOnlineWarning=msg;toast('Sincronização',msg,true)}onlineStatus()});
window.addEventListener('arquivo-online-empty',()=>onlineStatus());
window.addEventListener('arquivo-online-connecting',onlineStatus);
window.addEventListener('arquivo-online-state',onlineStatus);
window.addEventListener('online',onlineStatus);
window.addEventListener('offline',onlineStatus);

function render(){if(page==='masterSheets')page='sheets';document.body.classList.toggle('home-view',page==='home');navRender();applyTheme();if(page==='home')el('page').innerHTML=home();else if(page==='library')el('page').innerHTML=library();else if(page==='sheets')el('page').innerHTML=currentSheet?sheetPage():sheets();else if(page==='rolls')el('page').innerHTML=rolls();else if(page==='live'){
 if(!el('page').querySelector('.ae-live-root'))el('page').innerHTML='<section class="ae-live-root" aria-label="Sessão ao vivo"></section>';
}else if(page==='settings')el('page').innerHTML=settings();else if(page==='admin')el('page').innerHTML=master()?admin():home();document.documentElement.classList.toggle('no-sheet-motion',!!prefs.noSheetMotion&&page==='sheets');const entries=el('page').children;for(let i=0;i<entries.length;i++){if(page!=='sheets'&&!motionOff()){entries[i].classList.add('fade-in');entries[i].style.animationDelay=(i*40)+'ms'}} applyTextOverrides();if(page==='rolls')window.ARQUIVO_FREE_ROLL?.preview();window.ARQUIVO_LIVE?.pageChanged(page);document.querySelectorAll('input[type=range]').forEach(updateRangeTrack);updateSettingsVolumeSliders();onlineStatus();if(window.ARQUIVO_SYNC?.state.enabled&&document.querySelector('[data-history-scope]'))Promise.resolve().then(()=>loadVerifiedHistory());}
function headline(k,t,s,buttons=''){return `<div class="hrow"><div><div class="eyebrow">${esc(k)}</div><h1>${esc(t)}</h1><p class="subtitle">${esc(s)}</p></div><div class="actions">${buttons}</div></div>`}
function btn(text,act,cls=''){return `<button type="button" class="btn ${cls}" data-action="${act}">${text}</button>`}
function home(){
 const cover=imgStyle(db.site.cover);
 return `<section class="ae-home" aria-label="Página inicial">
  <div class="ae-home-path"><span class="ae-home-path-stripe" aria-hidden="true"></span>ARQUIVO ESPIRITUAL <i>/</i> VISÃO GERAL</div>
  <section class="ae-home-hero" aria-labelledby="ae-home-headline">
   <div class="ae-home-hero-copy">
    <button type="button" class="ae-home-overline ae-larp-trigger" data-larp-egg aria-pressed="false"><span class="ae-home-diamond" aria-hidden="true">✦</span><span class="ae-larp-caption">SUA JORNADA COMEÇA AQUI</span></button>
    <h1 id="ae-home-headline">UM NOVO<br><em>CAPÍTULO</em><br>TE AGUARDA.</h1>
    <p>Suas escolhas moldam a história. Prepare sua ficha e consulte as regras da aventura.</p>
    <button type="button" class="ae-home-play" data-page="sheets"><span>▶</span> ABRIR FICHAS ${icon('arrow')}</button>
   </div>
   <div class="ae-home-art ${cover?'has-image':''}" style="${cover}" aria-hidden="true"><span class="ae-home-glyph"><img src="assets/bleach-flame.svg" alt="" width="500" height="500" decoding="async"></span></div>
  </section>
  <div class="ae-home-sectionhead"><div><span>ACESSO RÁPIDO</span><h2>SEU CENTRO DE OPERAÇÕES</h2></div></div>
  <div class="ae-home-tiles" role="group" aria-label="Acessos rápidos">
   <button type="button" class="ae-home-tile ae-home-tile-library" data-page="library" aria-label="Abrir biblioteca">
    <span class="ae-home-tile-title"><span class="ae-home-icon">${icon('book')}</span><strong>BIBLIOTECA</strong></span>
    <span class="ae-home-tile-desc">Capítulos, mecânicas e referências.</span>
    <span class="ae-home-tile-bottom"><span>${db.rules.length} documentos</span><b>CONSULTAR</b></span>
   </button>
   <button type="button" class="ae-home-tile ae-home-tile-characters" data-page="sheets" aria-label="Abrir fichas">
    <span class="ae-home-tile-title"><span class="ae-home-icon">${icon('user')}</span><strong>FICHAS</strong></span>
    <span class="ae-home-tile-desc">Personagens, atributos e habilidades.</span>
    <span class="ae-home-tile-bottom"><span>${db.sheets.length} fichas disponíveis</span><b>ACESSAR</b></span>
   </button>
   <button type="button" class="ae-home-tile ae-home-tile-rolls" data-page="rolls" aria-label="Abrir mesa de dados">
    <span class="ae-home-tile-title"><span class="ae-home-icon">${icon('dice')}</span><strong>ROLAGENS</strong></span>
    <span class="ae-home-tile-desc">Dados, resultados e histórico.</span>
    <span class="ae-home-tile-bottom"><span>Mesa de dados</span><b>ROLAR</b></span>
   </button>
  </div>
 </section>`;
}
/* Os capítulos legados sem campo book pertencem ao Livro 1. */
function libraryVolume(){return window.ARQUIVO_SECOES?.active||'book1'}
function libraryRules(){return db.rules.filter(r=>libraryVolume()==='book2'?r.book==='book2':r.book!=='book2')}
/* Biblioteca: estado e filtros compartilhados entre índice, pesquisa e capítulos. */
function libraryVisibleRules(){
 const term=query.trim().toLocaleLowerCase('pt-BR');
 const rules=libraryRules();return term?rules.filter(r=>(String(r.title||'')+' '+String(r.text||'')).toLocaleLowerCase('pt-BR').includes(term)):rules;
}
function librarySearchCount(){
 const term=query.trim().toLocaleLowerCase('pt-BR');
 if(!term)return 0;
 return libraryRules().reduce((sum,r)=>{
  const combined=(String(r.title||'')+' '+String(r.text||'')).toLocaleLowerCase('pt-BR');
  return sum+combined.split(term).length-1;
 },0);
}
function librarySearchSummary(visible){
 const count=visible.length,total=libraryRules().length;
 if(!query.trim())return count+' '+(count===1?'capítulo disponível':'capítulos disponíveis');
 const matches=librarySearchCount();
 return count+' '+(count===1?'capítulo encontrado':'capítulos encontrados')+' · '+matches+' '+(matches===1?'ocorrência':'ocorrências');
}
function libraryIndexMarkup(visible){
 return visible.map(r=>{
  const index=libraryRules().indexOf(r)+1,active=libraryActiveChapterId===r.id;
  return '<button type="button" class="ae-lib-index-link'+(active?' is-active':'')+'" '+
   'data-action="openChapter:'+esc(r.id)+'"'+(active?' aria-current="location"':'')+
   ' aria-label="Abrir capítulo '+index+': '+esc(r.title)+'">'+
   '<span class="ae-lib-index-num">'+String(index).padStart(2,'0')+'</span>'+
   '<span class="ae-lib-index-title">'+esc(r.title)+'</span>'+
   '<span class="ae-lib-index-indicator" aria-hidden="true"></span></button>';
 }).join('')||'<p class="ae-library-index-empty">'+(query.trim()?'Nenhum capítulo encontrado.':'Nenhum capítulo cadastrado.')+'</p>';
}
function libraryMobileOptions(){
 return libraryRules().map(r=>'<option value="'+esc(r.id)+'"'+(r.id===libraryActiveChapterId?' selected':'')+'>'+esc(r.title)+'</option>').join('');
}
function library(){
 rebuildLibraryGlossary();
 if(libraryVolume()==='warehouse')return window.ARQUIVO_SECOES.warehousePage();
 const visible=libraryVisibleRules();
 const number=libraryRules().length;
 const second=libraryVolume()==='book2';
 return headline('CONHECIMENTO',second?'LIVRO 2':'BIBLIOTECA',second?'Criação de personagem · novos capítulos do CBB.':'Livro 1 · fundamentos e regras do sistema.',master()?btn('+ NOVO CAPÍTULO','newRule','main'):'')+
 '<div class="library-layout ae-library-layout">'+
 '<aside class="chapter-index panel ae-library-index" aria-labelledby="libraryIndexTitle">'+
 '<div class="ae-library-index-heading"><div><span class="ae-library-kicker">NAVEGAÇÃO</span>'+
 '<h2 id="libraryIndexTitle">ÍNDICE DE CAPÍTULOS</h2></div>'+
 '<span class="ae-library-index-count" aria-label="'+number+' capítulos">'+String(number).padStart(2,'0')+'</span></div>'+
 '<p class="ae-lib-aside-help">Escolha um capítulo para começar a leitura.</p>'+
 '<nav id="libraryChapterIndex" aria-label="Índice de capítulos">'+libraryIndexMarkup(visible)+'</nav></aside>'+
 '<section class="library-body" aria-label="Conteúdo da biblioteca">'+
 '<div class="panel ae-library-search-panel" role="search" aria-label="Pesquisar na biblioteca">'+
 '<div class="ae-library-search-header"><label for="ruleSearch">Pesquisar capítulos e regras</label>'+
 '<span class="ae-library-search-shortcut" aria-hidden="true">/</span></div>'+
 '<div class="ae-library-search-row"><input id="ruleSearch" type="text" inputmode="search" enterkeyhint="search" value="'+esc(query)+'"'+
 ' autocomplete="off" spellcheck="false" placeholder="Buscar no sistema" aria-keyshortcuts="/ Escape" aria-describedby="ruleMatches">'+
 '<button class="ae-library-clear" id="libraryClearSearch" data-action="clearLibrarySearch" type="button" aria-label="Limpar pesquisa"'+(!query?' hidden':'')+'>LIMPAR</button></div>'+
 '<p id="ruleMatches" class="ae-library-search-count" role="status" aria-live="polite">'+librarySearchSummary(visible)+'</p>'+
 '<div class="ae-library-toolbar"><span>Clique nas palavras do glossário para ver a definição. Os símbolos distinguem os tipos de regra.</span>'+
 '<details class="ae-book-key"><summary>LEGENDA VISUAL</summary>'+
 '<div class="ae-book-key-items"><span><b aria-hidden="true">◆</b> Conceito</span><span><b aria-hidden="true">▸</b> Ação</span>'+
 '<span><b aria-hidden="true">◈</b> Recurso</span><span><b aria-hidden="true">◇</b> Teste</span>'+
 '<span><b aria-hidden="true">✦</b> Efeito</span><span><b aria-hidden="true">⚑</b> Risco</span>'+
 '<span><b aria-hidden="true">!</b> Limite</span></div></details>'+
 '<div class="actions">'+btn('FECHAR TODOS','closeAllChapters','small')+btn('ABRIR TODOS','openAllChapters','small')+(master()?btn('GERENCIAR GLOSSÁRIO','manageGrimorio','small'):'')+'</div></div>'+
 '<div class="mobile-chapter"><label for="chapterJump">Ir ao capítulo</label>'+
 '<select id="chapterJump"><option value="">Selecione um capítulo</option>'+libraryMobileOptions()+'</select></div>'+
 '</div>'+
 '<div id="libraryGrimorioArea" class="ae-library-grimorio-area">'+grimorioBanner()+'</div>'+
 '<div id="ruleResults" class="ae-library-results" aria-label="Capítulos">'+ruleItems(visible)+'</div>'+ 
 '</section>'+(window.ARQUIVO_SECOES?.shelf()||'')+'</div>';
}
function libraryRefreshResults(){
 const root=el('ruleResults');if(!root)return;
 const visible=libraryVisibleRules();
 root.innerHTML=ruleItems(visible);
 const nav=el('libraryChapterIndex');if(nav)nav.innerHTML=libraryIndexMarkup(visible);
 const count=el('ruleMatches');if(count)count.textContent=librarySearchSummary(visible);
 const clear=el('libraryClearSearch');if(clear)clear.hidden=!query;
 const jump=el('chapterJump');if(jump)jump.value=visible.some(r=>r.id===libraryActiveChapterId)?libraryActiveChapterId:'';
}
function libraryClearSearch(){
 query='';
 const field=el('ruleSearch');if(field){field.value='';field.focus()}
 libraryRefreshResults();
}
function librarySyncActiveIndex(){
 const nav=el('libraryChapterIndex');
 if(nav)nav.querySelectorAll('[data-action^="openChapter:"]').forEach(button=>{
  const active=button.dataset.action.slice('openChapter:'.length)===libraryActiveChapterId;
  button.classList.toggle('is-active',active);
  if(active)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');
 });
 const jump=el('chapterJump');if(jump)jump.value=libraryActiveChapterId||'';
}
/* GRIMÓRIO: dados editáveis persistidos em db.site e sincronizados pelo documento do mestre. */
const GRIMORIO_CATEGORIES=['Recursos','Testes','Combate','Condições','Recuperação','Outros'];
const GRIMORIO_DEFAULTS={visible:true,title:'CONSULTAR GRIMÓRIO',subtitle:'Explore as mecânicas e encontre rapidamente o que procura.',autoGlossary:true,glossary:[],disabledTerms:[]};
function grimorioSettings(){
 const saved=db.site?.grimorio;
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return {...GRIMORIO_DEFAULTS};
 const {showIcons,showDiceIcons,diceEmoji,...rest}=saved;
 return {...GRIMORIO_DEFAULTS,...rest,
  glossary:Array.isArray(saved.glossary)?saved.glossary.map(item=>{
   if(!item||typeof item!=='object'||Array.isArray(item))return item;
   const {icon,...clean}=item;
   return clean;
  }):[],
  disabledTerms:Array.isArray(saved.disabledTerms)?saved.disabledTerms:[]};
}
function grimorioStored(){
 db.site??={};
 if(!db.site.grimorio||typeof db.site.grimorio!=='object'||Array.isArray(db.site.grimorio))db.site.grimorio={};
 const settings=grimorioSettings();
 db.site.grimorio=settings;
 return settings;
}
function glossaryKey(name){return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ')}
function glossaryCategory(name){
 const term=glossaryKey(name);
 if(/vida|alma|estabilidade|energia/.test(term))return 'Recursos';
 if(/dado|pericia|grupo|teste|dificuldade|modificador/.test(term))return 'Testes';
 if(/recuper|descanso|tratamento|meditac|recompos/.test(term))return 'Recuperação';
 if(/estado|condic|morto|desmaiado|acorrentado|pressionado/.test(term))return 'Condições';
 if(/acao|reacao|combate|movimenta|dano|resistencia|cobertura|posicionamento|terreno/.test(term))return 'Combate';
 return 'Outros';
}
function glossarySuggestions(){
 const results=new Map();
 for(const chapter of db.rules||[]){
  for(const line of String(chapter.text||'').split(/\r?\n/)){
   const found=line.trim().match(/^([^—\n]{2,55})\s+—\s+(.{15,})$/);
   if(!found)continue;
   const name=found[1].trim(),key=glossaryKey(name);
   if(!key||results.has(key))continue;
   results.set(key,{name,description:found[2].trim(),chapterId:chapter.id,chapterTitle:chapter.title,category:glossaryCategory(name),icon:'',source:'automatic'});
  }
 }
 return results;
}
function glossaryAllEntries(){
 const options=grimorioSettings(),disabled=new Set(options.disabledTerms.map(glossaryKey));
 const suggestions=glossarySuggestions(),entries=new Map();
 if(options.autoGlossary!==false){
  for(const [key,item] of suggestions){
   if(LIBRARY_HELP_TERMS.some(term=>glossaryKey(term)===key)&&!disabled.has(key)){
    const canonical=LIBRARY_HELP_TERMS.find(term=>glossaryKey(term)===key);
    entries.set(key,{...item,name:canonical||item.name});
   }
  }
 }
 for(const item of options.glossary){
  if(!item||typeof item!=='object')continue;
  const name=String(item.name||'').trim(),key=glossaryKey(name);
  if(!key)continue;
  if(item.enabled===false){entries.delete(key);continue}
  const chapter=db.rules.find(r=>r.id===item.chapterId);
  entries.set(key,{
   id:String(item.id||''),name:name.slice(0,75),description:String(item.description||'').slice(0,6000),related:Array.isArray(item.related)?item.related:[],
   chapterId:chapter?.id||'',chapterTitle:chapter?.title||'',
   category:GRIMORIO_CATEGORIES.includes(item.category)?item.category:glossaryCategory(name),
   source:'manual'
  });
 }
 for(const key of disabled)if(!options.glossary.some(i=>glossaryKey(i.name)===key&&i.enabled!==false))entries.delete(key);
 return [...entries.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
/* O catálogo mostra definições detectadas e verbetes ativos criam links discretos. */
function grimorioCatalogEntries(){
 const cfg=grimorioSettings(),hidden=new Set(cfg.disabledTerms.map(glossaryKey)),items=new Map();
 for(const item of cfg.autoGlossary!==false?glossarySuggestions().values():[]){
  const key=glossaryKey(item.name);
  if(!hidden.has(key)){
   const canonical=LIBRARY_HELP_TERMS.find(term=>glossaryKey(term)===key);
   items.set(key,{...item,name:canonical||item.name});
  }
 }
 for(const item of cfg.glossary){
  if(!item||typeof item!=='object')continue;
  const key=glossaryKey(item.name);if(!key)continue;
  if(item.enabled===false){items.delete(key);continue}
  const chapter=db.rules.find(r=>r.id===item.chapterId);
  items.set(key,{
   id:item.id,name:String(item.name||'').slice(0,75),related:Array.isArray(item.related)?item.related:[],
   description:String(item.description||'').slice(0,6000),
   category:GRIMORIO_CATEGORIES.includes(item.category)?item.category:glossaryCategory(item.name),
   chapterId:chapter?.id||'',chapterTitle:chapter?.title||'',
   source:'manual'
  });
 }
 return [...items.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
/* Navegação do glossário: filtros combináveis e favoritos exclusivamente locais. */
const GRIMORIO_FAVORITES_KEY='ae_grimorio_favoritos_v1';
function grimorioFavoritesLoad(){
 try{
  const saved=JSON.parse(DATASTORE.local?.getItem(GRIMORIO_FAVORITES_KEY)||'[]');
  return new Set(Array.isArray(saved)?saved.filter(x=>typeof x==='string').slice(0,500):[]);
 }catch(e){return new Set()}
}
let grimorioFavorites=grimorioFavoritesLoad();
function toggleGrimorioFavorite(raw){
 let decoded='';try{decoded=decodeURIComponent(raw)}catch(e){return}
 const entry=grimorioCatalogEntries().find(item=>glossaryKey(item.name)===glossaryKey(decoded));if(!entry)return;
 const key=glossaryKey(entry.name);
 if(grimorioFavorites.has(key))grimorioFavorites.delete(key);else grimorioFavorites.add(key);
 try{DATASTORE.local?.setItem(GRIMORIO_FAVORITES_KEY,JSON.stringify([...grimorioFavorites]))}catch(e){}
 grimorioRefreshResults();
}
function grimorioFilteredEntries(catalog=grimorioCatalogEntries()){
 const term=glossaryKey(grimorioQuery);
 return catalog.filter(item=>
  (grimorioCategory==='Todos'||item.category===grimorioCategory)&&
  (grimorioLetter==='Todas'||glossaryKey(item.name).charAt(0).toLocaleUpperCase('pt-BR')===grimorioLetter)&&
  (!grimorioFavoritesOnly||grimorioFavorites.has(glossaryKey(item.name)))&&
  (!term||glossaryKey([item.name,item.description,item.chapterTitle,item.category].join(' ')).includes(term)));
}
function grimorioFilterChips(items=grimorioCatalogEntries()){
 const all=[['Todos','TODOS'],...GRIMORIO_CATEGORIES.map(c=>[c,c.toUpperCase()])];
 return '<div class="ae-glossary-filter-label"><strong>EXPLORAR POR ASSUNTO</strong><span>Escolha o tipo de regra</span></div>'+
  '<div class="ae-glossary-categories" role="group" aria-label="Assuntos do glossário">'+all.map(([category,label])=>{
   const n=category==='Todos'?items.length:items.filter(item=>item.category===category).length;
   return '<button type="button" data-action="grimorioCategoryFilter:'+encodeURIComponent(category)+'"'+
    ' class="ae-glossary-category'+(grimorioCategory===category?' is-active':'')+'"'+
    ' aria-pressed="'+(grimorioCategory===category)+'">'+esc(label)+' <small>'+n+'</small></button>';
  }).join('')+'</div>';
}
function grimorioLettersMarkup(catalog=grimorioCatalogEntries()){
 const all=catalog.filter(item=>grimorioCategory==='Todos'||item.category===grimorioCategory);
 const letters=[...new Set(all.map(item=>glossaryKey(item.name).charAt(0).toLocaleUpperCase('pt-BR')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const values=['Todas',...letters];
 return '<div class="ae-glossary-letters" role="group" aria-label="Filtrar por letra inicial">'+
  '<span>ÍNDICE A–Z</span><div>'+values.map(letter=>
   '<button type="button" data-action="grimorioLetter:'+encodeURIComponent(letter)+'"'+
   ' class="'+(grimorioLetter===letter?'is-active':'')+'" aria-pressed="'+(grimorioLetter===letter)+'"'+
   ' aria-label="'+(letter==='Todas'?'Todas as letras':'Letra '+esc(letter))+'">'+(letter==='Todas'?'TODAS':esc(letter))+'</button>'
  ).join('')+'</div></div>';
}
function grimorioResultsMarkup(items=grimorioFilteredEntries()){
 if(!items.length)return '<div class="ae-grimorio-empty" role="status"><strong>Nenhum verbete encontrado.</strong>'+
  '<span>Tente um termo mais amplo ou remova os filtros.</span>'+
  '<button type="button" data-action="grimorioReset">LIMPAR BUSCA E FILTROS</button></div>';
 return items.map(item=>{
  const favorite=grimorioFavorites.has(glossaryKey(item.name));
  const description=String(item.description||'').replace(/\s+/g,' ').trim().slice(0,170);
  const type=item.source==='manual'?'GUIA DO MESTRE':'REGRA DO SISTEMA';
  return '<article class="ae-grimorio-entry'+(favorite?' is-favorite':'')+'">'+
   '<button type="button" class="ae-glossary-entry-open" data-action="explainRule:'+encodeURIComponent(item.name)+'" aria-label="Consultar '+esc(item.name)+'">'+
   '<span class="ae-grimorio-entry-copy"><span class="ae-glossary-entry-kicker">'+esc(item.category)+' <span>·</span> '+type+'</span>'+
   '<strong>'+esc(item.name)+'</strong>'+
   (description?'<span class="ae-glossary-entry-description">'+esc(description)+(String(item.description||'').length>170?'…':'')+'</span>':'')+
   '<small>'+(item.chapterTitle?'CAPÍTULO · '+esc(item.chapterTitle):'DEFINIÇÃO DO GLOSSÁRIO')+'</small></span>'+
   '<span class="ae-grimorio-arrow" aria-hidden="true">↗</span></button>'+
   '<button type="button" class="ae-glossary-favorite'+(favorite?' is-active':'')+'" data-action="grimorioFavorite:'+encodeURIComponent(item.name)+'"'+
   ' aria-pressed="'+favorite+'" title="'+(favorite?'Remover dos favoritos':'Salvar nos favoritos')+'"'+
   ' aria-label="'+(favorite?'Remover ':'Favoritar ')+esc(item.name)+'">'+(favorite?'★':'☆')+'</button></article>';
 }).join('');
}
function grimorioPanel(){
 const catalog=grimorioCatalogEntries(),count=catalog.length,favoriteCount=catalog.filter(item=>grimorioFavorites.has(glossaryKey(item.name))).length;
 return '<section class="ae-grimorio-panel ae-glossary-workspace" aria-label="Catálogo do Grimório">'+
  '<div class="ae-grimorio-toolbar"><div><span class="ae-grimorio-kicker">GLOSSÁRIO DO SISTEMA · GUIAS E DEFINIÇÕES</span>'+
  '<h3>ENCONTRE A REGRA QUE PROCURA</h3><p>'+count+' '+(count===1?'verbete':'verbetes')+' para consultar · '+favoriteCount+' salvo(s) neste navegador</p></div>'+
  (master()?'<div class="actions ae-grimorio-quick-actions">'+btn('+ NOVA PÁGINA','editGlossary:new','small')+btn('GERENCIAR PÁGINAS','manageGrimorio','small')+'</div>':'')+'</div>'+
  '<div class="ae-glossary-onboarding"><span aria-hidden="true">⌕</span><p><strong>Como usar:</strong> pesquise uma palavra ou um trecho da explicação, escolha um assunto ou percorra o índice. Abra o verbete para ler a regra completa, suas conexões e o capítulo de origem.</p></div>'+
  '<div class="ae-grimorio-search" role="search" aria-label="Buscar verbetes">'+
  '<label for="grimorioSearch">O que você quer entender?</label><label for="grimorioCategory">Filtrar categoria</label>'+
  '<input id="grimorioSearch" type="search" autocomplete="off" spellcheck="false" value="'+esc(grimorioQuery)+'" placeholder="Ex.: reação, ALMA, dano-base, condições..." aria-describedby="grimorioCount">'+
  '<select id="grimorioCategory">'+['Todos',...GRIMORIO_CATEGORIES].map(v=>'<option value="'+esc(v)+'"'+(grimorioCategory===v?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></div>'+
  '<div class="ae-glossary-suggestions" aria-label="Buscas rápidas"><span>CONSULTAR:</span>'+
  [['Alma','ALMA'],['Resistência','RESISTÊNCIA'],['Ação','AÇÕES'],['Condições','CONDIÇÕES']].map(([term,label])=>
   '<button type="button" data-action="grimorioQuick:'+encodeURIComponent(term)+'">'+label+'</button>').join('')+'</div>'+
  '<div id="grimorioFilters">'+grimorioFilterChips(catalog)+'</div>'+
  '<div id="grimorioLetters">'+grimorioLettersMarkup(catalog)+'</div>'+
  '<div class="ae-glossary-result-heading"><p class="ae-grimorio-count" id="grimorioCount" aria-live="polite">'+grimorioFilteredEntries(catalog).length+' resultado(s)</p>'+
  '<button type="button" class="ae-glossary-fav-filter'+(grimorioFavoritesOnly?' is-active':'')+'" data-action="grimorioOnlyFavorites" aria-pressed="'+grimorioFavoritesOnly+'">'+
  '☆ '+(grimorioFavoritesOnly?'MOSTRANDO FAVORITOS':'SOMENTE FAVORITOS')+'</button></div>'+
  '<div class="ae-grimorio-results" id="grimorioResults">'+grimorioResultsMarkup(grimorioFilteredEntries(catalog))+'</div></section>';
}
function grimorioBanner(){
 const opts=grimorioSettings(),total=grimorioCatalogEntries().length;
 if(opts.visible===false&&!master())return '';
 return '<section class="ae-grimorio-portal" aria-label="Entrada do Grimório">'+
  '<div class="ae-grimorio-portal-symbol" aria-hidden="true">✧</div>'+
  '<div class="ae-grimorio-portal-copy"><span class="ae-grimorio-kicker">ARQUIVO DE CONHECIMENTO</span>'+
  '<h2>'+esc(String(opts.title||GRIMORIO_DEFAULTS.title).slice(0,75))+'</h2>'+
  '<p>'+esc(String(opts.subtitle||GRIMORIO_DEFAULTS.subtitle).slice(0,180))+'</p>'+
  '<small>'+total+' '+(total===1?'mecânica catalogada':'mecânicas catalogadas')+(opts.visible===false?' · OCULTO PARA JOGADORES':'')+'</small></div>'+
  '<div class="ae-grimorio-portal-actions"><button type="button" class="ae-grimorio-portal-button" data-action="toggleGrimorio" aria-expanded="'+grimorioOpen+'" aria-controls="libraryGrimorioMount">'+
  (grimorioOpen?'FECHAR GRIMÓRIO':'CONSULTAR GRIMÓRIO')+' <span aria-hidden="true">↗</span></button>'+
  (master()?'<button type="button" class="ae-grimorio-edit-button" data-action="manageGrimorio">CONFIGURAR</button>':'')+'</div></section>'+
  '<div id="libraryGrimorioMount">'+(grimorioOpen?grimorioPanel():'')+'</div>';
}
function toggleGrimorio(){
 grimorioOpen=!grimorioOpen;
 const area=el('libraryGrimorioArea');if(!area)return;
 area.innerHTML=grimorioBanner();
 if(grimorioOpen){requestAnimationFrame(()=>{el('libraryGrimorioMount')?.scrollIntoView({behavior:motionOff()?'auto':'smooth',block:'start'});el('grimorioSearch')?.focus({preventScroll:true})})}
}
function grimorioRefreshResults(){
 const catalog=grimorioCatalogEntries(),filtered=grimorioFilteredEntries(catalog);
 const root=el('grimorioResults');if(root)root.innerHTML=grimorioResultsMarkup(filtered);
 const count=el('grimorioCount');if(count)count.textContent=filtered.length+' resultado(s)';
 const category=el('grimorioFilters');if(category)category.innerHTML=grimorioFilterChips(catalog);
 const letters=el('grimorioLetters');if(letters)letters.innerHTML=grimorioLettersMarkup(catalog);
 const fav=el('libraryGrimorioMount')?.querySelector('.ae-glossary-fav-filter');
 if(fav){fav.classList.toggle('is-active',grimorioFavoritesOnly);fav.setAttribute('aria-pressed',String(grimorioFavoritesOnly));fav.textContent='☆ '+(grimorioFavoritesOnly?'MOSTRANDO FAVORITOS':'SOMENTE FAVORITOS')}
}
function saveGrimorioOptions(){
 if(!requireMaster())return;
 const opts=grimorioStored();
 const title=String(el('grimorioTitleInput')?.value||'').trim(),subtitle=String(el('grimorioSubtitleInput')?.value||'').trim();
 if(!title){toast('Título obrigatório','Informe o título do Grimório.',true);return}
 opts.title=title.slice(0,75);
 opts.subtitle=subtitle.slice(0,180);
 opts.visible=!!el('grimorioVisibleInput')?.checked;
 opts.autoGlossary=!!el('grimorioAutoInput')?.checked;
 save();rebuildLibraryGlossary();closeModal();render();toast('Grimório atualizado');
}
function manageGrimorio(){
 if(!requireMaster())return;
 rebuildLibraryGlossary();
 const opts=grimorioSettings(),suggestions=glossarySuggestions();
 const known=new Set(opts.glossary.map(i=>glossaryKey(i.name)));
 const hidden=new Set(opts.disabledTerms.map(glossaryKey));
 const entries=[
  ...opts.glossary.filter(i=>i&&i.name).map(item=>({...item,source:'manual'})),
  ...[...suggestions.values()].filter(item=>!known.has(glossaryKey(item.name))).map(item=>({...item,enabled:!hidden.has(glossaryKey(item.name))&&opts.autoGlossary!==false&&LIBRARY_HELP_TERMS.some(t=>glossaryKey(t)===glossaryKey(item.name)),source:'automatic'}))
 ].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const row=item=>{
  const key=encodeURIComponent(item.name),enabled=item.enabled!==false;
  return '<div class="ae-grimorio-manage-row"><div><strong>'+esc(item.name)+'</strong><small>'+
   (item.source==='manual'?'PERSONALIZADO':'DETECTADO NO SISTEMA')+' · '+(enabled?'ATIVO':'INATIVO')+'</small></div>'+
   '<div class="ae-grimorio-manage-actions"><button type="button" data-action="editGlossary:'+key+'">EDITAR</button>'+
   '<button type="button" data-action="toggleGlossaryTerm:'+key+'">'+(enabled?'DESATIVAR':'ATIVAR')+'</button></div></div>';
 };
 modal('GERENCIAR GRIMÓRIO','<div class="ae-grimorio-manager">'+
  '<p class="subtitle">Personalize o catálogo e os termos clicáveis da Biblioteca. Somente o mestre pode salvar.</p>'+
  '<div class="ae-grimorio-config-grid">'+
   '<label>Título do botão<input id="grimorioTitleInput" maxlength="75" value="'+esc(opts.title)+'"></label>'+
   '<label>Descrição<textarea id="grimorioSubtitleInput" maxlength="180" rows="2">'+esc(opts.subtitle)+'</textarea></label></div>'+
  '<div class="ae-grimorio-toggles">'+
   '<label><input id="grimorioVisibleInput" type="checkbox"'+(opts.visible?' checked':'')+'> Mostrar Grimório aos jogadores</label>'+
   '<label><input id="grimorioAutoInput" type="checkbox"'+(opts.autoGlossary?' checked':'')+'> Catalogar definições encontradas nos capítulos</label></div>'+
  '<div class="ae-grimorio-manager-head"><h3>VERBETES E GUIAS</h3>'+
   '<button type="button" data-action="editGlossary:new">+ NOVO VERBETE</button></div>'+
  '<div class="ae-grimorio-manage-list">'+entries.map(row).join('')+'</div></div>',
  [['SALVAR CONFIGURAÇÕES','saveGrimorioOptions','main'],['FECHAR','closeModal','small']]);
}
function confirmGrimorioNavigation(action,message){
 if(!hasModalChanges()){action();return}
 modalSaved=el('dialogRoot').firstElementChild;
 modalGuard=true;
 pendingAction=action;
 modal('DESCARTAR ALTERAÇÕES?', '<p>'+esc(message)+'</p>',
  [['DESCARTAR E CONTINUAR','confirmGrimorioNavigation','danger'],
   ['CONTINUAR EDITANDO','cancelGrimorioNavigation','small']]);
}
function confirmGrimorioNavigationAction(){
 const next=pendingAction;
 pendingAction=null;modalSaved=null;modalGuard=false;modalDirty=false;
 if(typeof next==='function')next();
}
function cancelGrimorioNavigation(){pendingAction=null;returnModal()}
function openGlossaryEditor(key){
 if(el('grimorioTitleInput')){
  confirmGrimorioNavigation(()=>editGlossaryEntry(key),'As configurações do Grimório ainda não foram salvas.');
  return;
 }
 editGlossaryEntry(key);
}
function backToGrimorioManager(){
 if(el('glossaryTermInput')){
  confirmGrimorioNavigation(()=>manageGrimorio(),'As alterações neste verbete ainda não foram salvas.');
  return;
 }
 manageGrimorio();
}
function editGlossaryEntry(key){
 if(!requireMaster())return;
 let name='';try{name=key==='new'?'':decodeURIComponent(key)}catch(e){return}
 const settings=grimorioSettings(),previous=settings.glossary.find(i=>glossaryKey(i.name)===glossaryKey(name));
 const auto=glossarySuggestions().get(glossaryKey(name));
 const item=previous||auto||{name:'',description:'',chapterId:'',category:'Outros',enabled:true};
 const options=db.rules.map(r=>'<option value="'+esc(r.id)+'"'+(r.id===item.chapterId?' selected':'')+'>'+esc(r.title)+'</option>').join('');
 const category=GRIMORIO_CATEGORIES.map(c=>'<option value="'+esc(c)+'"'+(c===item.category?' selected':'')+'>'+esc(c)+'</option>').join('');
 const relatedTitles=Array.isArray(item.related)?item.related.filter(x=>typeof x==='string'):[];
 const catalog=grimorioCatalogEntries().filter(entry=>entry.name!==item.name);
 const connections=[...catalog.map(entry=>({name:entry.name,category:entry.category,missing:false})),...relatedTitles.filter(name=>!catalog.some(entry=>entry.name===name)).map(name=>({name,category:'Página não encontrada',missing:true}))];
 connections.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const connectionsHtml=connections.map(entry=>'<label class="ae-glossary-connection" data-connection-title="'+esc(entry.name)+'">'+
  '<input type="checkbox" data-glossary-connection value="'+esc(entry.name)+'"'+(relatedTitles.includes(entry.name)?' checked':'')+'>'+
  '<span><strong>'+esc(entry.name)+'</strong><small>'+esc(entry.category)+'</small></span></label>').join('');
 modal(name?'EDITAR GUIA DO GLOSSÁRIO':'NOVO GUIA DO GLOSSÁRIO','<div class="ae-glossary-editor">'+
 '<p class="subtitle">Crie uma página independente e conecte-a a outras usando os títulos exatos.</p>'+
 '<label>Palavra ou expressão<input id="glossaryTermInput" maxlength="75" value="'+esc(item.name||'')+'" required></label>'+
 '<label>Conteúdo da página<textarea id="glossaryDescriptionInput" maxlength="6000" rows="7" required>'+esc(item.description||'')+'</textarea></label>'+
 '<label>Categoria<select id="glossaryCategoryInput">'+category+'</select></label>'+ 
 '<section class="ae-glossary-relations" aria-label="Relacionar páginas"><div class="ae-glossary-relations-header"><strong>CONEXÕES DIRETAS</strong><small>Selecione as páginas relacionadas. Os títulos devem corresponder exatamente.</small></div>'+
 '<input type="search" id="glossaryConnectionsSearch" autocomplete="off" placeholder="Buscar página para conectar" aria-label="Buscar páginas para conectar">'+
 '<div class="ae-glossary-relations-list" id="glossaryConnectionList">'+(connectionsHtml||'<p class="subtitle">Crie mais páginas no Grimório para adicionar conexões.</p>')+'</div></section>'+
 '<label>Capítulo vinculado<select id="glossaryChapterInput"><option value="">Sem capítulo vinculado</option>'+options+'</select></label>'+
 '<label class="ae-grimorio-editor-check"><input type="checkbox" id="glossaryEnabledInput"'+(item.enabled===false?'':' checked')+'> Verbete ativo</label>'+
 '</div>',
 [['SALVAR VERBETE','saveGlossaryEntry','main'],...(previous?[['APAGAR VERBETE','deleteGlossaryEntry','danger']]:[]),['VOLTAR','backGrimorioManager','small']]);
 el('dialogRoot').dataset.glossaryOldName=name;
}
function saveGlossaryEntry(){
 if(!requireMaster())return;
 const name=String(el('glossaryTermInput')?.value||'').trim(),description=String(el('glossaryDescriptionInput')?.value||'').trim();
 if(name.length<2||!description){toast('Preencha o verbete','Informe uma palavra e sua explicação.',true);return}
 const opts=grimorioStored(),old=el('dialogRoot').dataset.glossaryOldName||'';
 if(opts.glossary.some(item=>glossaryKey(item.name)===glossaryKey(name)&&glossaryKey(item.name)!==glossaryKey(old))){
  toast('Palavra duplicada','Este termo já possui um verbete personalizado.',true);return
 }
 const item={
  id:opts.glossary.find(i=>glossaryKey(i.name)===glossaryKey(old))?.id||uid(),
  name:name.slice(0,75),description:description.slice(0,6000),
  category:GRIMORIO_CATEGORIES.includes(el('glossaryCategoryInput')?.value)?el('glossaryCategoryInput').value:'Outros',
  chapterId:String(el('glossaryChapterInput')?.value||''),
  related:[...new Set([...document.querySelectorAll('#glossaryConnectionList input[data-glossary-connection]:checked')].map(input=>input.value))].filter(x=>x!==name).slice(0,100),
  enabled:!!el('glossaryEnabledInput')?.checked
 };
 opts.glossary=opts.glossary.filter(i=>glossaryKey(i.name)!==glossaryKey(old));
 opts.glossary.push(item);
 opts.disabledTerms=opts.disabledTerms.filter(t=>glossaryKey(t)!==glossaryKey(name));
 save();rebuildLibraryGlossary();closeModal();render();toast('Verbete salvo',name);
}
function toggleGlossaryTerm(key){
 if(!requireMaster())return;
 if(el('grimorioTitleInput')){
  if(hasModalChanges()){confirmGrimorioNavigation(()=>toggleGlossaryTerm(key),'Salve as configurações antes de alterar a disponibilidade dos verbetes.');return}
 }
 let name='';try{name=decodeURIComponent(key)}catch(e){return}
 const opts=grimorioStored(),term=glossaryKey(name),manual=opts.glossary.find(item=>glossaryKey(item.name)===term);
 if(manual)manual.enabled=manual.enabled===false;
 else{
  const suggestion=glossarySuggestions().get(term);
  const classical=opts.autoGlossary!==false&&LIBRARY_HELP_TERMS.some(t=>glossaryKey(t)===term);
  if(suggestion&&!classical){
   opts.glossary.push({
    id:uid(),name:suggestion.name,description:suggestion.description,
    chapterId:suggestion.chapterId,category:suggestion.category,enabled:true
   });
   opts.disabledTerms=opts.disabledTerms.filter(t=>glossaryKey(t)!==term);
  }else{
   const has=opts.disabledTerms.some(t=>glossaryKey(t)===term);
   if(has)opts.disabledTerms=opts.disabledTerms.filter(t=>glossaryKey(t)!==term);
   else opts.disabledTerms.push(name);
  }
 }
 save();rebuildLibraryGlossary();render();manageGrimorio();
}
function deleteGlossaryEntry(){
 if(!requireMaster())return;
 const name=el('dialogRoot').dataset.glossaryOldName||'';
 confirmSite('APAGAR VERBETE','Remover a explicação personalizada? Uma definição automática poderá voltar a aparecer.',()=>{
  const opts=grimorioStored();
  opts.glossary=opts.glossary.filter(item=>glossaryKey(item.name)!==glossaryKey(name));
  save();rebuildLibraryGlossary();render();manageGrimorio();
 });
}

const LIBRARY_HELP_TERMS=['Vida','Estabilidade','Alma','Desmaiado','Acorrentado','Morto','Pressionado','Grupos','Perícias','Dificuldade','Modificadores','Rodada','Fases','Ação Principal','Reação','Movimentação','Dano-base','Resistência','Estados','Condições','Recuperação Natural','Recuperação Especializada','Descanso Breve','Descanso Completo','Tratamento','Recomposição','Meditação','Cobertura','Ocultação','Posicionamento','Terreno','Conjuração Completa','Conjuração Abreviada','Ruptura da Máscara','Resistência Hollow','Domínio'];
let libraryGlossary=new Map();
function rebuildLibraryGlossary(){
 libraryGlossary=new Map();
 for(const entry of glossaryAllEntries())if(entry.enabled!==false)libraryGlossary.set(entry.name,entry);
}
function showLibraryMechanic(key){
 let decoded='';try{decoded=decodeURIComponent(key)}catch(e){return}
 rebuildLibraryGlossary();
 const item=libraryGlossary.get(decoded)||grimorioCatalogEntries().find(entry=>entry.name===decoded);
 if(!item)return;
 const source=item.source==='manual'?'Guia personalizado pelo mestre.':'Definição extraída das próprias regras do sistema.';
 const chapter=db.rules.find(r=>r.id===item.chapterId);
 const linked=(item.related||[]).map(name=>grimorioCatalogEntries().find(entry=>entry.name===name)).filter(Boolean);
 modal('O QUE É '+item.name.toLocaleUpperCase('pt-BR')+'?',
  '<div class="ae-mechanic-explanation"><div class="eyebrow">GLOSSÁRIO · '+esc(chapter?.title||item.category||'GRIMÓRIO')+'</div>'+
  '<p>'+esc(item.description)+'</p>'+(linked.length?'<div class="ae-glossary-related"><strong>PÁGINAS RELACIONADAS</strong><div>'+linked.map(entry=>'<button type="button" data-action="explainRule:'+encodeURIComponent(entry.name)+'">'+esc(entry.name)+'</button>').join('')+'</div></div>':'')+'<p class="subtitle">'+source+'</p></div>',
  [...(chapter?[['VER CAPÍTULO','goMechanicChapter:'+encodeURIComponent(chapter.id),'main']]:[]),
   ...(master()?[['EDITAR VERBETE','editGlossary:'+encodeURIComponent(item.name),'small']]:[]),
   ['FECHAR','closeModal','small']]);
}
function goLibraryMechanicChapter(code){
 let id='';try{id=decodeURIComponent(code)}catch(e){return}
 closeModal();openLibraryChapter(id);
}
/* Capítulos são renderizados sob demanda; o texto original permanece intocado. */
function chapterReadingMarkup(rule){
 const helper=window.ARQUIVO_BIBLIOTECA_LEITURA;
 return (helper?.outline?.(rule.text,rule.title,rule.id)||'')+
  formatBook(rule.text,rule.title,{headingPrefix:rule.id});
}
function ruleItems(rules){
 if(!rules.length)return query.trim()?
  '<div class="ae-library-empty" role="status"><strong>Nenhum capítulo encontrado</strong><p>Experimente outro termo de pesquisa ou limpe a busca.</p><button type="button" class="btn small" data-action="clearLibrarySearch">LIMPAR BUSCA</button></div>':
  '<div class="ae-library-empty" role="status"><strong>Nenhum capítulo disponível</strong><p>A biblioteca ainda não possui capítulos cadastrados.</p></div>';
 return rules.map(r=>{
  const opened=libraryExpandedChapters.has(r.id);
  const chapterNumber=String(libraryRules().indexOf(r)+1).padStart(2,'0');
  const bodyId='chapterBody-'+r.id,headingId='chapterHeading-'+r.id;
  return '<article class="rule chapter ae-library-chapter'+(opened?' is-open':'')+'" id="'+esc(r.id)+'">'+
   '<div class="sectionhead"><h3 id="'+esc(headingId)+'">'+
   '<button class="chapter-toggle" type="button" data-action="toggleChapter:'+esc(r.id)+'"'+
   ' aria-controls="'+esc(bodyId)+'" aria-expanded="'+opened+'"'+
   ' aria-label="'+(opened?'Recolher':'Expandir')+' capítulo '+chapterNumber+': '+esc(r.title)+'">'+
   '<span class="ae-chapter-heading"><span class="ae-chapter-num">'+chapterNumber+'</span>'+
   '<span class="ae-chapter-title">'+esc(r.title)+'</span></span>'+
   '<span class="ae-chapter-toggle-icon" aria-hidden="true">'+(opened?'−':'+')+'</span></button></h3>'+
   (master()?btn('EDITAR','editRule:'+r.id,'small'):'')+'</div>'+
   '<div id="'+esc(bodyId)+'" class="book-text ae-library-reading" role="region"'+
   ' aria-labelledby="'+esc(headingId)+'"'+(opened?'':' hidden')+'>'+
   (opened?chapterReadingMarkup(r):'')+'</div></article>';
 }).join('');
}
function toggleLibraryChapter(id){
 const rule=db.rules.find(r=>r.id===id),article=el(id);if(!rule||!article)return;
 const content=article.querySelector('.book-text'),toggle=article.querySelector('.chapter-toggle'),icon=article.querySelector('.ae-chapter-toggle-icon');
 const open=!libraryExpandedChapters.has(id);
 if(open){
  libraryExpandedChapters.add(id);
  libraryActiveChapterId=id;
  if(content){content.innerHTML=chapterReadingMarkup(rule);content.hidden=false}
 }else{
  libraryExpandedChapters.delete(id);
  if(libraryActiveChapterId===id)libraryActiveChapterId=null;
  if(content){content.hidden=true;content.replaceChildren()}
 }
 article.classList.toggle('is-open',open);
 if(toggle){
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',(open?'Recolher':'Expandir')+' capítulo '+(db.rules.indexOf(rule)+1)+': '+rule.title);
 }
 if(icon)icon.textContent=open?'−':'+';
 librarySyncActiveIndex();
}
function openLibraryChapter(id){
 const rule=db.rules.find(r=>r.id===id);
 if(!rule)return;
 if(window.ARQUIVO_SECOES)window.ARQUIVO_SECOES.active=rule.book==='book2'?'book2':'book1';
 const visible=libraryVisibleRules().some(r=>r.id===id);
 libraryActiveChapterId=id;
 if(page!=='library'||!visible){
  query='';
  page='library';
  libraryExpandedChapters.add(id);
  render();
 }else if(!el(id)){
  libraryExpandedChapters.add(id);
  render();
 }else if(!libraryExpandedChapters.has(id)){
  toggleLibraryChapter(id);
 }else librarySyncActiveIndex();
 requestAnimationFrame(()=>el(id)?.scrollIntoView({behavior:motionOff()?'auto':'smooth',block:'start'}));
}
function setAllLibraryChapters(open){
 const visible=libraryVisibleRules();
 for(const rule of visible){
  if(open)libraryExpandedChapters.add(rule.id);
  else libraryExpandedChapters.delete(rule.id);
 }
 if(!open&&visible.some(r=>r.id===libraryActiveChapterId))libraryActiveChapterId=null;
 libraryRefreshResults();
 librarySyncActiveIndex();
}
function libraryTermTone(name){
 const x=String(name||'').toLocaleLowerCase('pt-BR');
 if(['vida','estabilidade','alma','recuperação natural','recuperação especializada','descanso breve','descanso completo','meditação','tratamento','recomposição'].includes(x))return 'resource';
 if(['desmaiado','acorrentado','morto','pressionado','ruptura da máscara','resistência hollow'].includes(x))return 'risk';
 return 'rule';
}
function formatBook(source,chapterTitle='',options={}){
 const rows=String(source||'').replace(/\r\n?/g,'\n').split('\n');
 const searchText=options.highlight===false?'':query.trim(),search=searchText?new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'):null;
 const sharedIndex=window.ARQUIVO_BIBLIOTECA_LEITURA?.glossaryIndex?.(libraryGlossary);
 const names=sharedIndex?.names||[...libraryGlossary.keys()].filter(Boolean).sort((a,b)=>b.length-a.length);
 const namesByInitial=sharedIndex?.byInitial||new Map();
 if(!sharedIndex)for(const name of names){
  const initial=name[0];
  if(!namesByInitial.has(initial))namesByInitial.set(initial,[]);
  namesByInitial.get(initial).push(name);
 }
 const letterOrNumber=/[\p{L}\p{N}]/u;
 // Correspondência literal: jamais normalizar acentos, caixa ou grafia na leitura.
 function insertGlossaryReferences(source,markers){
  const original=String(source||'');
  if(!names.length)return original;
  let output='',position=0;
  while(position<original.length){
   let title=null;
   if(position===0||!letterOrNumber.test(original[position-1])){
    for(const candidate of namesByInitial.get(original[position])||[]){
     if(!original.startsWith(candidate,position))continue;
     const next=original[position+candidate.length]||'';
     if(!next||!letterOrNumber.test(next)){title=candidate;break}
    }
   }
   if(title){
    const id=markers.push({name:title,display:title})-1;
    output+='@@AEGLOSS'+id+'@@';
    position+=title.length;
   }else{
    output+=original[position];
    position++;
   }
  }
  return output;
 }
 function inline(text){
  const markers=[];
  let raw=window.ARQUIVO_BARRAS_INLINE?.mark(text,markers)??String(text||'');
  raw=insertGlossaryReferences(raw,markers);
  raw=markInlineDice(raw,markers,'@@AEGLOSS');
  let t=esc(raw)
    .replace(/\[cor=(#[0-9a-f]{6})\]([\s\S]*?)\[\/cor\]/gi,(_,color,content)=>'<span class="ae-manual-color" style="color:'+color+'">'+content+'</span>')
    .replace(/\\([*_~`])/g,'$1')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/__([^_]+)__/g,'<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g,'<del>$1</del>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
  if(search)t=t.split(/(<[^>]*>)/g).map(segment=>segment.startsWith('<')?segment:segment.replace(search,match=>'<mark>'+match+'</mark>')).join('');
  return t.replace(/@@(?:AEGLOSS|AEBAR)(\d+)@@/g,(_,index)=>{
   const marker=markers[Number(index)];
   if(!marker)return '';
   if(marker.inlineBar)return window.ARQUIVO_BARRAS_INLINE?.render(marker)||'';
   if(marker.sides)return dieShape(marker.sides,'ae-inline-die',marker.count);
   return '<span class="ae-glossary-link" role="link" tabindex="0" data-action="explainRule:'+encodeURIComponent(marker.name)+'" aria-label="Consultar '+esc(marker.name)+' no glossário">'+esc(marker.display)+'</span>';
  });
 }
 const reader=window.ARQUIVO_BIBLIOTECA_LEITURA;
 const headingPrefix=options.headingPrefix||'';
 let headingIndex=0;
 let html='',paragraph=[],listType=null,code=[],table=[],quote=[],defs=[];
 function flushPara(){if(paragraph.length){html+='<p class="book-paragraph">'+paragraph.map(inline).join(' ')+'</p>';paragraph=[]}}
 function flushList(){if(listType){html+='</'+listType+'>';listType=null}}
 function flushCode(){if(code.length){html+='<pre class="book-code"><code>'+esc(code.join('\n'))+'</code></pre>';code=[]}}
 function flushTable(){if(!table.length)return;html+='<div class="book-table-wrap"><table class="book-table">';
  table.forEach((cells,i)=>{const tag=i===0&&table.length>1?'th':'td';html+='<tr>'+cells.map(c=>'<'+tag+'>'+inline(c.trim())+'</'+tag+'>').join('')+'</tr>'});
  html+='</table></div>';table=[]}
 function flushQuote(){if(quote.length){html+='<blockquote class="book-quote">'+quote.map(x=>'<p>'+inline(x)+'</p>').join('')+'</blockquote>';quote=[]}}
 function flushDefs(){
  if(!defs.length)return;
  html+='<dl class="ae-book-definitions">'+defs.map(([key,desc])=>{
   const visual=reader?.marker?.(key,'definition')||{tone:'neutral',symbol:'·'};
   return '<div class="ae-book-definition ae-book-definition--'+visual.tone+'">'+
    '<dt class="ae-def-'+libraryTermTone(key)+'">'+
    '<span class="ae-book-def-symbol" aria-hidden="true">'+visual.symbol+'</span>'+
    '<span class="ae-book-def-label">'+inline(key)+'</span></dt>'+
    '<dd>'+inline(desc)+'</dd></div>';
  }).join('')+'</dl>';defs=[];
 }
 function closeBlocks(){flushPara();flushList();flushTable();flushQuote();flushDefs()}
 let inCode=false,firstNonEmpty=true;
 for(const row of rows){
  const line=row.trim(),heading=line.match(/^(#{1,6})\s+(.+)$/);
  if(line.startsWith('```')){closeBlocks();if(inCode)flushCode();inCode=!inCode;continue}
  if(inCode){code.push(row);continue}
  if(!line){closeBlocks();continue}
  if(firstNonEmpty){
   firstNonEmpty=false;
   if((reader?String(line).replace(/^#{1,6}\s+/,'').replace(/^[✱✦✧❖▸▹►]\s*/,''):line).toLocaleUpperCase('pt-BR')===
      String(chapterTitle).trim().toLocaleUpperCase('pt-BR'))continue;
  }
  if(/^\|/.test(line)&&line.includes('|',1)){
   flushPara();flushList();flushQuote();flushDefs();
   if(/^\|?[\s:|\-]+\|?$/.test(line))continue;
   table.push(line.replace(/^\||\|$/g,'').split('|'));continue;
  }
  flushTable();
  const namedSection=line.match(/^[✱✦✧❖▸▹►]\s*(.{2,110})$/);
  const upper=line.length<70&&/^[\p{Lu}\p{N}\s&/–—'.-]+$/u.test(line)&&/[\p{Lu}]/u.test(line);
  if(heading||namedSection||upper){
   closeBlocks();
   const level=heading?Math.min(6,Math.max(2,heading[1].length+1)):3;
   const title=heading?heading[2]:namedSection?namedSection[1]:line;
   const visual=reader?.marker?.(title)||{tone:'neutral',symbol:'·'};
   const anchor=headingPrefix&&reader?.headingId?' id="'+esc(reader.headingId(headingPrefix,headingIndex))+'"':'';
   headingIndex++;
   html+='<h'+level+' class="ae-book-heading ae-book-heading--'+visual.tone+'"'+anchor+'>'+
    '<span class="ae-book-heading-symbol" aria-hidden="true">'+visual.symbol+'</span>'+
    '<span class="ae-book-heading-label">'+inline(title)+'</span></h'+level+'>';
   continue;
  }
  if(/^[-=_]{3,}$/.test(line)){closeBlocks();html+='<hr class="book-divider">';continue}
  if(/^>\s?/.test(line)){flushPara();flushList();flushDefs();quote.push(line.replace(/^>\s?/,''));continue}
  flushQuote();
  const list=line.match(/^(\s*)([-*+]|[0-9]+[.)])\s+(.+)$/);
  if(list){flushPara();flushDefs();const type=/^\d/.test(list[2])?'ol':'ul';if(listType!==type){flushList();html+='<'+type+' class="book-readable-list">';listType=type}html+='<li>'+inline(list[3])+'</li>';continue}
  flushList();
  const definition=line.match(/^([^—\n]{2,65})\s+—\s+(.{12,})$/)||
   line.match(/^\*\*([^*:\n]{2,65})(?::\*\*|\*\*:)\s+(.{8,})$/)||
   line.match(/^(Gatilho|Recurso|Custo|Consumo|Ativação|Efeito|Condição|Duração|Limite|Restrição|Requisito|Observação|Fase|Consequência|Exemplo):\s+(.{8,})$/i)||
   line.match(/^(Nível\s+(?:I{1,3}|Ⅰ|Ⅱ|Ⅲ)):\s+(.{8,})$/i);
  if(definition){flushPara();defs.push([definition[1].trim(),definition[2].trim()]);continue}
  flushDefs();paragraph.push(line);
 }
 closeBlocks();flushCode();
 return html||'<p class="book-paragraph">Sem conteúdo neste capítulo.</p>';
}
function sheets(onlyMaster=false){if(onlyMaster&&!master())return headline('ACESSO RESTRITO','SOMENTE MESTRES','');const items=db.sheets.filter(s=>!!s.masterOnly===onlyMaster&&(master()||(!s.redacted&&(!s.locked||canEditSheet(s.id)))));if(window.ARQUIVO_SYNC?.state.connecting)return headline('FICHAS','CONECTANDO','Carregando permissões do servidor.');return headline(onlyMaster?'ARQUIVO RESTRITO':'ARQUIVO DE PERSONAGENS',onlyMaster?'FICHAS DO MESTRE':'FICHAS',onlyMaster?'Personagens e inimigos visíveis exclusivamente para mestres.':'Escolha um personagem para visualizar ou jogar.',onlyMaster?btn('+ NOVA FICHA DO MESTRE','newMasterSheet','main'):(player()?btn('+ NOVA FICHA','newSheet','main')+btn('IMPORTAR JSON','import'):''))+`<div class="panel"><div class="sectionhead"><h2>${onlyMaster?'FICHAS EXCLUSIVAS':'PERSONAGENS CADASTRADOS'}</h2><span class="tag">${items.length} ${items.length===1?'REGISTRO':'REGISTROS'}</span></div><div class="grid2">${items.map(s=>`<article class="sheet-entry" data-sheet="${esc(s.id)}"><div class="thumb ${s.image?'hasimage':''}" style="${imgStyle(s.image)}"></div><div><div class="eyebrow">NÍVEL ${esc(s.level)}</div><h3>${esc(s.name)}</h3><p>${esc(s.subtitle||'Personagem')}</p><span class="tag">${isLinked(s)?'VINCULADA · ':''}ABRIR FICHA ${icon('arrow','pill-icon')}</span></div></article>`).join('')}</div>${!items.length?`<p class="empty">${onlyMaster?'Nenhuma ficha exclusiva cadastrada.':'Nenhuma ficha cadastrada.'}</p>`:''}</div>`+(master()&&!onlyMaster?`<div class="master-below">${sheets(true)}</div>`:'')}
function viewSheet(id){const target=db.sheets.find(s=>s.id===id);if(target?.masterOnly&&!master()){toast('Acesso restrito','Esta ficha é exclusiva do mestre.',true);return;}if(target?.locked&&(!canEditSheet(id)||target.redacted)){toast('Acesso restrito','Esta ficha não está disponível para sua chave.',true);return;}currentSheet=id;tab='summary';page='sheets';render();window.scrollTo({top:0,behavior:'instant'})}
let rollingBusy=false;
let rollingFeedbackButton=null;
function beginRollFeedback(button){
 if(rollingBusy||!button||rollingFeedbackButton)return;
 rollingFeedbackButton=button;button.classList.add('ae-roll-pending');
 button.setAttribute('aria-busy','true');button.setAttribute('data-roll-pending','ROLANDO...');
 const live=el('rollLive');if(live)live.textContent='Dados em movimento · aguardando confirmação do servidor...';
}
function finishRollFeedback(){
 const b=rollingFeedbackButton;rollingFeedbackButton=null;
 if(!b)return;b.classList.remove('ae-roll-pending');b.removeAttribute('aria-busy');b.removeAttribute('data-roll-pending');
}
function historyDiceColors(x){const safe=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)?c:null;return (Array.isArray(x.colors)?x.colors:[]).map(safe)}
function historyDie(d,i,colors){const color=colors[i],sides=Number(d.sides),value=Number(d.value),eff=d.effective===undefined?value:Number(d.effective);return `<span class="history-die" ${color?`style="--history-die:${color}"`:''} aria-label="d${sides}, resultado ${value}, efetivo ${eff}"><span class="history-die-faces">d${sides}</span><b class="history-die-value">${value}${value!==eff?' → '+eff:''}</b></span>`}
function historyRollCard(x,unverified=false){
 const dice=Array.isArray(x.dice)?x.dice:[],colors=historyDiceColors(x),base=dice.reduce((a,d)=>a+Number(d.effective??d.value??0),0),special=x.special||'',critical=['CRÍTICO','CRÍTICO MÁXIMO'].includes(special),failure=special==='FALHA CRÍTICA';
 const total=Number(x.total??base),account=x.account_name||'',character=x.character_name||'',kind=x.kind||'',label=x.label||'';
 const head=account?`${esc(account)}${character?' ('+esc(character)+')':''}`:(character?esc(character):'Rolagem local');
 const date=x.created_at?`<time datetime="${esc(x.created_at)}">${new Date(x.created_at).toLocaleString('pt-BR')}</time>`:'';
 const badge=special?`<span class="history-special">${critical?'✦ ': '⚠ '}${esc(special)}</span>`:'';
 const rerolled=/^↻ RERROLOU #\d+ · /u.test(label),configured=/^⚙ CONFIGUROU #\d+ · /u.test(label);const title=esc(label||((kind==='shield')?'Escudo':'Rolagem'));
 const pieces=dice.map((d,i)=>historyDie(d,i,colors)).join('<span class="history-operator" aria-hidden="true">'+(x.expression?'·':'+')+'</span>');
 const visibleEquation=x.expression?'<span class="history-formula">'+esc(x.expression)+'</span>':pieces;
 const activeResults=dice.filter(d=>d.canceled!==true&&Number(d.effective??d.value)!==0)
  .map(d=>Number(d.effective??d.value)).filter(Number.isFinite);
 const ra=failure?1:activeResults.length?Math.max(...activeResults):0;
 const rb=failure?1:activeResults.length?Math.min(...activeResults):0;
 const resultDetails=special==='CRÍTICO MÁXIMO'||special==='FALHA CRÍTICA'
  ?`<div class="history-critical-metrics">RT ${total} · RA ${ra} · RB ${rb}</div>`:'';

 const allColors=colors.filter(Boolean),totalColor=allColors.length?(allColors[allColors.length-1]):null;
 return `<article class="history-card ${critical?'critical':failure?'failure':''}" ${totalColor&&!special?`style="--history-total:${totalColor}"`:''}>
 <div class="history-card-head"><span class="history-identity">${head}</span><span class="history-label">${title}</span>${rerolled?'<span class="history-rerolled">↻ RERROLOU</span>':''}${configured?'<span class="history-configured">⚙ CONFIGUROU</span>':''}${x.hidden?'<span class="history-hidden">OCULTA · MESTRE</span>':''}${unverified?'<span class="history-unverified">'+(x.clientCalculated?'TOTAL LOCAL':'NÃO VERIFICADA')+'</span>':''}</div>
 <div class="history-equation">${visibleEquation}<span class="history-operator" aria-hidden="true">=</span>${special==='CRÍTICO'?`<span class="history-base">${base} × 2</span><span class="history-operator" aria-hidden="true">=</span>`:''}<strong class="history-total">${total}</strong>${badge}</div>
 ${x.expression&&dice.length?`<div class="history-dice-list"><span>DADOS ROLADOS</span>${pieces}</div>`:''}${resultDetails}${date?`<div class="history-date">${date}</div>`:''}</article>`;
}
function formatVerifiedRoll(x){return historyRollCard(x,false)}

const HISTORY_PAGE_SIZE=10,historyStates=new Map();let historyEpoch=0,localHistoryPage=1;
function historyScope(sheet=false){return sheet&&currentSheet?'sheet:'+currentSheet:'all'}
function historyState(scope){if(!historyStates.has(scope))historyStates.set(scope,{page:1,total:0,rows:[],loaded:false,loading:false,stamp:0,error:''});return historyStates.get(scope)}
function historyPager(scope,page,total){
 const pages=Math.max(1,Math.ceil(total/HISTORY_PAGE_SIZE)),now=Math.max(1,Math.min(page,pages));
 const act=(action,label,disabled)=>`<button type="button" class="history-page-btn" data-action="historyNav:${encodeURIComponent(scope)}:${action}" ${disabled?'disabled':''} aria-label="${label}" title="${label}">${label}</button>`;
 return `<nav class="history-pagination" aria-label="Paginação de rolagens"><div class="history-pagination-buttons">${act('first','« Primeira',now===1)}${act('prev','‹ Anterior',now===1)}${act('next','Próxima ›',now>=pages)}${act('last','Última »',now>=pages)}</div><div class="history-page-picker"><label>Página <input type="number" inputmode="numeric" min="1" max="${pages}" value="${now}" data-history-page-input="${esc(scope)}" aria-label="Escolher página"></label><span>de ${pages}</span>${act('go','IR',false)}</div><span class="history-page-count">${total} registro${total===1?'':'s'}</span></nav>`;
}
function historyContents(scope){
 if(scope==='local'){
  const total=rollHistory.length,pages=Math.max(1,Math.ceil(total/HISTORY_PAGE_SIZE));localHistoryPage=Math.min(Math.max(1,localHistoryPage),pages);
  const rows=rollHistory.slice((localHistoryPage-1)*HISTORY_PAGE_SIZE,localHistoryPage*HISTORY_PAGE_SIZE);
  return (rows.map(x=>historyRollCard(x,true)).join('')||'<p class="history-empty">Nenhuma rolagem local registrada.</p>')+historyPager(scope,localHistoryPage,total);
 }
 const st=historyState(scope),pages=Math.max(1,Math.ceil(st.total/HISTORY_PAGE_SIZE));
 const cards=st.loading&&!st.loaded?'<p class="history-empty">Carregando histórico...</p>':st.error?'<p class="history-empty history-error">'+esc(st.error)+'</p>':st.rows.map(formatVerifiedRoll).join('')||'<p class="history-empty">Nenhuma rolagem verificada.</p>';
 return cards+historyPager(scope,Math.min(st.page,pages),st.total);
}
function refreshHistoryPanels(scope){document.querySelectorAll('[data-history-scope]').forEach(box=>{if(box.dataset.historyScope!==scope)return;const focus=document.activeElement;if(focus&&box.contains(focus)&&focus.matches('input'))return;box.innerHTML=historyContents(scope)})}
async function loadHistoryScope(scope,force=false){
 const sync=window.ARQUIVO_SYNC;if(document.hidden||!sync?.state.enabled||!sync.state.identity?.id||scope==='local'||!document.querySelector('[data-history-scope]'))return;
 const st=historyState(scope),now=Date.now();if(st.loading||(!force&&st.loaded))return;
 st.loading=true;st.error='';refreshHistoryPanels(scope);
 const epoch=historyEpoch,page=st.page;
 try{
  const response=await sync.rollHistory(HISTORY_PAGE_SIZE,(page-1)*HISTORY_PAGE_SIZE,scope.startsWith('sheet:')?scope.slice(6):null);
  if(epoch!==historyEpoch)return;
  st.total=response.total;st.rows=response.rows;st.loaded=true;st.stamp=Date.now();
  const pages=Math.max(1,Math.ceil(st.total/HISTORY_PAGE_SIZE));
  if(page>pages){st.page=pages;const result=await sync.rollHistory(HISTORY_PAGE_SIZE,(pages-1)*HISTORY_PAGE_SIZE,scope.startsWith('sheet:')?scope.slice(6):null);if(epoch!==historyEpoch)return;st.rows=result.rows;st.total=result.total}
 }catch(e){if(epoch===historyEpoch){st.error=e.message;st.loaded=true;st.rows=[];toast('Histórico indisponível',e.message,true)}}
 finally{st.loading=false;if(epoch===historyEpoch)refreshHistoryPanels(scope)}
}
let rollHistoryRefreshPending=false;
function refreshRollHistorySoon(){
 if(rollHistoryRefreshPending)return;
 rollHistoryRefreshPending=true;
 setTimeout(()=>{
  rollHistoryRefreshPending=false;
  if(document.querySelector('[data-history-scope]'))loadVerifiedHistory(true).catch(()=>{});
 },100);
}
async function loadVerifiedHistory(force=false){
 if(document.hidden)return;
 const scopes=[...new Set([...document.querySelectorAll('[data-history-scope]')].map(box=>box.dataset.historyScope))];
 await Promise.all(scopes.filter(scope=>scope!=='local').map(scope=>loadHistoryScope(scope,force)));
}
// Histórico unificado: atualiza enquanto aberto, inclusive rolagens vindas do Discord.
// Carregamento leve; não busca nada quando a aba ou o histórico estiverem ocultos.
setInterval(()=>{
 if(document.hidden||!window.ARQUIVO_SYNC?.state.enabled)return;
 if(!document.querySelector('[data-history-scope]:not([data-history-scope="local"])'))return;
 loadVerifiedHistory(true).catch(()=>{});
},8000);
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&window.ARQUIVO_SYNC?.state.enabled&&document.querySelector('[data-history-scope]:not([data-history-scope="local"])'))
  loadVerifiedHistory(true).catch(()=>{});
});
async function historyNavigate(scope,action){
 const local=scope==='local',st=local?null:historyState(scope),total=local?rollHistory.length:st.total;
 const pages=Math.max(1,Math.ceil(total/HISTORY_PAGE_SIZE)),page=local?localHistoryPage:st.page;
 const input=[...document.querySelectorAll('[data-history-page-input]')].find(e=>e.dataset.historyPageInput===scope);
 const target=action==='first'?1:action==='prev'?page-1:action==='next'?page+1:action==='last'?pages:Number(input?.value);
 if(!Number.isInteger(target)||target<1||target>pages){toast('Página inválida','Escolha um número entre 1 e '+pages,true);return}
 if(local){localHistoryPage=target;refreshHistoryPanels(scope);return}
 st.page=target;st.loaded=false;st.stamp=0;refreshHistoryPanels(scope);await loadHistoryScope(scope,true);
}
function onlineHistoryHtml(sheet=false){const scope=historyScope(sheet);return `<div class="history-list" data-history-scope="${esc(scope)}">${historyContents(scope)}</div>`}
function historyHtml(){const online=!!window.ARQUIVO_SYNC?.state.enabled;return `<div class="history"><span class="eyebrow">${online?'ROLAGENS VERIFICADAS':'ROLAGENS LOCAIS'}</span>${online?onlineHistoryHtml(page==='sheets'):`<div data-history-scope="local">${historyContents('local')}</div>`}</div>`}
const CONDITIONS_CATALOG=['Derrubado','Agarrado','Imobilizado','Atordoado','Exausto','Fragilizado','Ofuscado','Cego','Insensível','Desorientado','Iludido','Amedrontado','Confuso','Provocado','Silenciado','Suprimido','Dominado'];
const SHEET_PALETTE_FIELDS=[['accent','Destaque'],['panel','Painel'],['raised','Painel elevado'],['cold','Ícones e linhas'],['text','Texto'],['bg','Fundo da ficha'],['diceGroup','Dados de grupo'],['diceSkill','Dados de perícia']];
const SHEET_HEX=/^#[0-9a-f]{6}$/i;
function sheetThemeRecord(id){return db.sheets.find(s=>s.id===id)?.appearance||{}}
function sheetPalette(id){const base=currentPalette(),custom=sheetThemeRecord(id),values={};for(const [key] of SHEET_PALETTE_FIELDS){const value=custom[key];const fallback=key==='diceGroup'?base.accent:key==='diceSkill'?base.cold:base[key];values[key]=SHEET_HEX.test(value||'')?value:fallback}return values}
function sheetPaletteStyle(id){const p=sheetPalette(id),extra=sheetThemeRecord(id);const grad=extra.gradient===true&&SHEET_HEX.test(extra.gradientEnd||'')?`linear-gradient(135deg, ${p.panel}, ${extra.gradientEnd})`:'none';return `--sheet-gradient:${grad};--sheet-accent:${p.accent};--sheet-dice-group:${p.diceGroup};--sheet-dice-skill:${p.diceSkill};--theme-accent:${p.accent};--orange:${p.accent};--theme-panel:${p.panel};--theme-raised:${p.raised};--theme-structure:${p.cold};--theme-outline:${p.cold};--theme-cold:${p.cold};--theme-text:${p.text};--text:${p.text};--theme-bg:${p.bg};--cyan:${p.cold};--line:${p.cold};--muted:${p.cold};`}
function applySheetPaletteLive(){const panel=document.querySelector('.sheet-personal');if(panel){panel.style.cssText=sheetPaletteStyle(currentSheet);const c=sheetPalette(currentSheet).accent;panel.style.setProperty('--sheet-ink',contrast('#000000',c)>=contrast('#FFFFFF',c)?'#000000':'#FFFFFF')}}
let appearanceTimer=null,appearanceLocalTimer=null;
function appearanceChanged(){
 if(!currentSheet)return;
 const s=db.sheets.find(x=>x.id===currentSheet);
 if(!s)return;
 applySheetPaletteLive();
 if(appearanceLocalTimer)clearTimeout(appearanceLocalTimer);
 appearanceLocalTimer=setTimeout(()=>{appearanceLocalTimer=null;DATASTORE.save(db)},150);
 if(appearanceTimer)clearTimeout(appearanceTimer);
 appearanceTimer=setTimeout(async()=>{
  appearanceTimer=null;
  const st=window.ARQUIVO_SYNC;
  if(st?.state.enabled){
   try{
    await st.saveAppearance(s.id,s.appearance||{});
    toast('PALETA SINCRONIZADA','As cores desta ficha agora são compartilhadas.');
   }catch(e){
    toast('PALETA NÃO SALVA',e.message,true);
    await st.refresh(true).catch(()=>{});
   }
  }
 },650);
}
function setSheetPalette(key,value){if(!currentSheet||!canEditSheet(currentSheet)||!SHEET_PALETTE_FIELDS.some(([k])=>k===key)||!SHEET_HEX.test(value))return;const s=db.sheets.find(x=>x.id===currentSheet);s.appearance={...(s.appearance||{}),[key]:value};appearanceChanged()}
function setSheetGradient(key,value){if(!currentSheet||!canEditSheet(currentSheet))return;if(key==='gradientEnd'&&!SHEET_HEX.test(value))return;const s=db.sheets.find(x=>x.id===currentSheet);s.appearance={...(s.appearance||{}),[key]:value};appearanceChanged()}
function resetSheetColor(){if(!currentSheet||!canEditSheet(currentSheet))return;const s=db.sheets.find(x=>x.id===currentSheet);s.appearance={};appearanceChanged();render()}
function importOldSheetColors(){if(!currentSheet||!canEditSheet(currentSheet))return;const old=prefs.sheetColors?.[currentSheet];if(!old)return;const s=db.sheets.find(x=>x.id===currentSheet);const obj=typeof old==='string'?{accent:old}:old;s.appearance={...(s.appearance||{}),...Object.fromEntries(Object.entries(obj).filter(([key,v])=>key==='gradient'?typeof v==='boolean':SHEET_HEX.test(v)))};appearanceChanged();render()}
function sheetPaletteControls(id){if(!canEditSheet(id))return '';const values=sheetPalette(id),saved=sheetThemeRecord(id);return `<details class="sheet-palette-editor"><summary>Personalizar paleta compartilhada da ficha</summary><div class="sheet-palette-controls">${SHEET_PALETTE_FIELDS.map(([k,label])=>`<label>${label}<input type="color" data-sheet-palette="${k}" value="${values[k]}" aria-label="${label} da ficha"></label>`).join('')}</div><div class="grad-row"><label><input type="checkbox" data-sheet-gradient="toggle" ${saved.gradient?'checked':''}> Usar gradiente nos painéis</label><label>Cor final do gradiente<input type="color" data-sheet-gradient="end" value="${saved.gradientEnd||values.raised}" aria-label="Cor final do gradiente"></label></div><p class="color-hint">As cores e o gradiente são aplicados na hora e sincronizados com os outros jogadores. Os dados de Grupo e Perícia têm cores independentes.</p><div class="actions">${btn('RESTAURAR PALETA','resetSheetColor','small')}${prefs.sheetColors?.[id]?btn('IMPORTAR CORES ANTIGAS DESTE DISPOSITIVO','importOldSheetColors','small'):''}</div></details>`}
const DICE_POLYGONS={4:'12,2 2,21 22,21',6:'4,4 20,4 20,20 4,20',8:'12,2 22,12 12,22 2,12',10:'12,2 21,8 18,18 12,23 6,18 3,8',12:'12,2 21,7 21,17 12,22 3,17 3,7',20:'12,2 21,6 23,15 17,22 7,22 1,15 3,6'};

const DICE_GEOMETRIES=[4,6,8,10,12,20];
const DICE_NOTATION_RE=/(^|[^\p{L}\p{N}])((?:[1-9]\d?)?[dD](?:[1-9]|1\d|20))(?![\p{L}\p{N}])/gu;
function diceNotationParts(notation){
 const found=/^(?:([1-9]\d?))?[dD]([1-9]|1\d|20)$/.exec(notation);
 if(!found)return null;
 const count=Number(found[1]||1),sides=Number(found[2]);
 return count>=1&&count<=99&&sides>=1&&sides<=20?{count,sides}:null;
}
function markInlineDice(text,markers,tokenPrefix){
 return String(text||'').replace(DICE_NOTATION_RE,(match,prefix,notation)=>{
  const parsed=diceNotationParts(notation);
  if(!parsed)return match;
  const index=markers.push(parsed)-1;
  return prefix+tokenPrefix+index+'@@';
 });
}

function dieShape(n,kind='',count=1){
 n=Number(n);count=Number(count)||1;
 const geometry=DICE_GEOMETRIES.find(size=>size>=n);
 if(!geometry)return '<span>d'+esc(n)+'</span>';
 const facets={
  4:'<path d="M12 2 2 21h20L12 2M12 2v12M2 21l10-7 10 7"/>',
  6:'<path d="M4 4 7 2h13l2 3v15l-3 2H6l-2-3V4M4 4h16v16H4M20 4l2 1M20 20l-1 2"/>',
  8:'<path d="M12 2 2 12l10 10 10-10L12 2M2 12h20M12 2v20"/>',
  10:'<path d="M12 2 21 8l-3 10-6 5-6-5L3 8 12 2M12 2v21M3 8l9 6 9-6M6 18l6-4 6 4"/>',
  12:'<path d="M12 2 21 7v10l-9 5-9-5V7l9-5M12 2l4 5-4 4-5-4 5-5M3 7l4 0-2 8-2 2M21 7l-5 0 3 8 2 2M5 15l7-4 7 4-7 7-7-7"/>',
  20:'<path d="M12 2 21 6l2 9-6 7H7l-6-7 2-9 9-4M12 2l-5 8h10l-5-8M3 6l4 4-6 5M21 6l-4 4 6 5M7 10l5 10 5-10M1 15l11 5 11-5M7 22l5-2 5 2"/>'
 };
 return '<span class="die-figure '+esc(kind)+'" data-count="'+count+'" title="'+(count>1?count+' dados de ':'Dado de ')+n+' lados"><svg viewBox="0 0 24 24" role="img" aria-label="'+(count>1?count+' dados de ':'Dado de ')+n+' lados"><polygon points="'+DICE_POLYGONS[geometry]+'"></polygon><g fill="none" stroke="currentColor" stroke-width=".8" opacity=".55">'+facets[geometry]+'</g><text x="12" y="13">'+n+'</text></svg>'+(count>1?'<small class="ae-die-count" aria-hidden="true">×'+count+'</small>':'')+'</span>';
}
// Fonte única de formatação: o mesmo Markdown do Armazém também na ficha.
// O único caso inline é o dado no cabeçalho da perícia, sem blocos HTML.
function sheetRich(text,inlineOnly=false){
 const html=formatBook(text,'',{highlight:false});
 if(inlineOnly){
  const match=/^<p class="book-paragraph">([\s\S]*)<\/p>$/.exec(html);
  return match?match[1]:html;
 }
 return '<div class="book-text ae-unified-rich">'+html+'</div>';
}
function wrapColoredSelection(textareaId,colorId){const t=el(textareaId),c=el(colorId);if(!t||!c)return;const start=t.selectionStart,end=t.selectionEnd,value=t.value;const before=value.slice(0,start),mid=value.slice(start,end)||'texto colorido',after=value.slice(end);t.value=before+'[cor='+c.value+']'+mid+'[/cor]'+after;t.focus();t.setSelectionRange(start+5+c.value.length,start+5+c.value.length+mid.length);t.dispatchEvent(new Event('input',{bubbles:true}))}

async function noteImageUpload(input){
 if(!sheetPermission())return;
 const sheet=db.sheets.find(x=>x.id===currentSheet),files=[...(input.files||[])];if(!sheet||!files.length)return;
 const st=window.ARQUIVO_SYNC;sheet.noteImages??=[];let done=0;
 for(const f of files){if(sheet.noteImages.length>=4){toast('Limite de anexos','Máximo de quatro imagens por ficha.',true);break}
  try{acceptedImage(f);const ref=await st.uploadSheetMedia(sheet.id,f);sheet.noteImages.push(ref);done++}
  catch(e){toast('Anexo não salvo',e.message,true)}
 }
 if(done){save();render();toast('Anexos enviados',done+' arquivo(s) salvo(s) fora do banco da ficha.')}
}
function noteImageUrlDialog(){if(!sheetPermission())return;modal('LINK DE IMAGEM OU GIF','<label>Endereço HTTPS da imagem<input type="url" id="noteImageUrl" placeholder="https://..."></label>',[['ADICIONAR','noteImageUrlSave','main'],['CANCELAR','closeModal']])}
function noteImageUrlSave(){if(!sheetPermission())return;const src=el('noteImageUrl')?.value.trim()||'',sheet=db.sheets.find(x=>x.id===currentSheet);if(!/^https:\/\/[^\s]+$/i.test(src)){toast('Link inválido','Informe um link HTTPS direto.',true);return}sheet.noteImages??=[];if(sheet.noteImages.length>=4){toast('Limite de anexos','Máximo de quatro.',true);return}sheet.noteImages.push(src);save();closeModal();render()}
function removeNoteImage(i){if(!sheetPermission())return;const sheet=db.sheets.find(x=>x.id===currentSheet);if(!sheet?.noteImages)return;sheet.noteImages.splice(i,1);save();render()}
async function abilityImageUpload(input){
 if(!requirePlayer())return;
 const index=Number(input.dataset.abilityImage),file=input.files?.[0],ability=editorDraft?.abilities?.[index];if(!file||!ability)return;
 try{
  acceptedImage(file);
  if(!editorDraft?.id||!db.sheets.some(s=>s.id===editorDraft.id)){pendingAbilityImages.set(ability,file);toast('GIF preparado','Será enviado quando você salvar a nova ficha.');return}
  mediaUploadsInFlight++;let ref;try{ref=await window.ARQUIVO_SYNC.uploadSheetMedia(editorDraft.id,file)}finally{mediaUploadsInFlight--}ability.image=ref;drawSheetForm();toast('GIF / imagem enviada','O arquivo fica salvo separadamente. Salve a ficha para vincular.');
 }catch(e){toast('Imagem inválida',e.message,true)}
}
function removeAbilityImage(index){if(!requirePlayer()||!editorDraft?.abilities?.[index])return;pendingAbilityImages.delete(editorDraft.abilities[index]);editorDraft.abilities[index].image='';drawSheetForm()}
function conditionInfo(index){const s=db.sheets.find(x=>x.id===currentSheet);const name=s?.conditions?.[index];if(!name)return;const found=db.rules.find(x=>x.title.toLocaleLowerCase('pt-BR').includes('condiç'));const text=found?.text||'';const idx=text.toLocaleLowerCase('pt-BR').indexOf(name.toLocaleLowerCase('pt-BR'));let context=idx>=0?text.slice(idx,idx+850).split(/\n\s*\n/).slice(0,2).join('\n\n'):'Não há uma descrição específica dessa condição na biblioteca.';modal('REGRA · '+name,`<div class="sheet-rich">${sheetRich(context)}</div><p class="color-hint">Consulte o capítulo Condições & Pavor na Biblioteca para o texto integral.</p>`,[['FECHAR','closeModal']])}


function inventoryItemHasQuantity(it){return it?.quantity!==null&&it?.quantity!==undefined&&it?.quantity!==''}
function inventoryOf(s){s.inventory??={items:[],currencies:[]};s.inventory.items??=[];s.inventory.currencies??=[];return s.inventory}

function inventoryItemRow(s,it,i,can){
 const name=esc(it?.name||'Item'),type=String(it?.type||'Item');
 const bonus=Number(it?.damageBonus||0);
 const tracked=type==='Equipamento'||(Number.isFinite(bonus)&&bonus!==0);
 const equipped=it?.equipped!==false;
 const isActive=!!window.ARQUIVO_CBB_ENGINE?.isItemDamageActive?.(s,it);
 const quantity=inventoryItemHasQuantity(it)?Number(it.quantity):null;
 const count=quantity!==null?'<span class="ae-item-count">'+esc(quantity)+' '+(quantity===1?'unidade':'unidades')+'</span>':
  (type==='Consumível'?'<span class="ae-item-count">Sem limite definido</span>':'');
 const linked=(s.abilities||[]).find(a=>String(a?.abilityId||a?.automation?.id||a?.name)===String(it?.linkedAbility||''))?.name;
 const status=bonus!==0?
  (isActive?'BÔNUS ATIVO':!equipped?'GUARDADO':it.linkedAbility?'AGUARDANDO LIBERAÇÃO':'INATIVO'):
  (tracked?(equipped?'EQUIPADO':'GUARDADO'):'');
 const effect=Number.isInteger(bonus)&&bonus!==0?
  '<div class="ae-item-effect'+(isActive?' is-active':'')+'">'+
    '<strong>'+esc(bonus>0?'+':'')+esc(bonus)+' DANO-BASE</strong>'+
    '<span>'+(it.linkedAbility?'Vinculado a '+esc(linked||'uma liberação'):'Enquanto equipado')+'</span>'+
   '</div>':'';
 return '<article class="inventory-row inventory-item-card'+(isActive?' is-effect-active':'')+'" data-inventory-index="'+i+'">'+
  (it.image&&dataUrlOk(it.image)?'<div class="inventory-art"><img src="'+esc(mediaSrc(it.image)||CLEAR_IMAGE)+
   '" alt="Ilustração de '+name+'" loading="lazy"></div>':'')+
  '<div class="inventory-item-body">'+
   '<div class="inventory-item-title"><b>'+name+'</b></div>'+
   '<div class="ae-item-meta"><span class="ae-item-type">'+esc(type)+'</span>'+count+
    (status?'<span class="ae-item-state'+(isActive?' is-active':'')+'">'+status+'</span>':'')+'</div>'+
   effect+
   (it.description?'<div class="inventory-item-description sheet-rich">'+sheetRich(window.ARQUIVO_CBB_PRESENTATION?.standardizeItem?.(it.description)||String(it.description))+'</div>':'')+
  '</div>'+
  (can?'<div class="actions ae-item-actions">'+
   (tracked?btn(equipped?'GUARDAR':'EQUIPAR','inventoryToggleEquipped:'+i,'small'):'')+
   btn('EDITAR','inventoryEditItem:'+i,'small')+
   btn('REMOVER','inventoryDeleteItem:'+i,'small danger')+
   '</div>':'')+'</article>';
}
function inventoryPanel(s){
 const inv=inventoryOf(s),can=canEditSheet(s.id);
 const entries=inv.items.map((item,index)=>({item,index}));
 const equipped=entries.filter(({item})=>item?.type==='Equipamento'||Number(item?.damageBonus||0)!==0);
 const regular=entries.filter(({item})=>item?.type!=='Equipamento'&&Number(item?.damageBonus||0)===0);
 const rows=group=>(group.map(({item,index})=>inventoryItemRow(s,item,index,can)).join(''));
 const items='<section class="panel ae-inventory-panel"><div class="sectionhead"><h2>ITENS E EQUIPAMENTOS</h2>'+
  (can?btn('+ ITEM','inventoryAddItem','main'):'')+'</div>'+
  (!entries.length?'<p class="inventory-empty">Nenhum item cadastrado.</p>':
  (equipped.length?'<div class="ae-inventory-group"><h3>EQUIPAMENTOS & EFEITOS</h3>'+
    '<div class="inventory-list">'+rows(equipped)+'</div></div>':'')+
   (regular.length?'<div class="ae-inventory-group"><h3>OUTROS ITENS</h3>'+
    '<div class="inventory-list">'+rows(regular)+'</div></div>':''))+'</section>';
 const money='<section class="panel ae-inventory-panel" style="margin-top:14px">'+
  '<div class="sectionhead"><h2>MOEDAS E VALORES</h2>'+(can?btn('+ VALOR','inventoryAddCurrency','main'):'')+'</div>'+
  '<div class="inventory-list">'+(inv.currencies.length?inv.currencies.map((cur,i)=>
   '<div class="inventory-row"><div><b>'+esc(cur.name||'Moeda')+'</b> <span class="tag">'+esc(cur.amount??0)+'</span></div>'+
   (can?'<div class="actions">'+btn('EDITAR','inventoryEditCurrency:'+i,'small')+
    btn('REMOVER','inventoryDeleteCurrency:'+i,'small danger')+'</div>':'')+'</div>').join(''):
   '<p class="inventory-empty">Nenhum valor registrado.</p>')+'</div></section>';
 return items+money;
}
function inventoryToggleEquipped(i){
 if(!sheetPermission())return;
 const sh=db.sheets.find(x=>x.id===currentSheet),item=inventoryOf(sh).items[i];
 if(!item)return;
 if(item.type!=='Equipamento'&&Number(item.damageBonus||0)===0)return;
 item.equipped=item.equipped===false;
 save();render();
}
let inventoryEditing=-1,inventoryKind='',inventoryImageDraft='',inventoryImagePending=null,inventoryPreviewObjectUrl='',inventoryUploadBusy=false;
function inventoryCleanupPreview(){if(inventoryPreviewObjectUrl){URL.revokeObjectURL(inventoryPreviewObjectUrl);inventoryPreviewObjectUrl=''}}
function inventoryImagePreview(){const box=el('invImagePreview');if(!box)return;const url=inventoryImagePending?inventoryPreviewObjectUrl:mediaSrc(inventoryImageDraft);box.innerHTML=inventoryImagePending?`<div class="inventory-upload-note">Arquivo selecionado · ${esc(inventoryImagePending.name)} · será enviado ao salvar</div>`:inventoryImageDraft?'<span class="inventory-upload-note">Imagem vinculada ao item</span>':'<span class="inventory-upload-note">Sem imagem anexada</span>';if(url){const img=document.createElement('img');img.src=url;img.alt='Prévia da ilustração do item';img.className='inventory-preview-img';box.prepend(img)}}
function inventoryItemDialog(i){if(!sheetPermission())return;const it=inventoryOf(db.sheets.find(x=>x.id===currentSheet)).items[i]||{name:'',type:'Item',quantity:1,description:'',image:''};inventoryEditing=i;inventoryKind='item';inventoryImageDraft=it.image||'';inventoryImagePending=null;inventoryCleanupPreview();modal(i<0?'ADICIONAR ITEM':'EDITAR ITEM',`<div class="field"><label>Nome<input id="invName" maxlength="120" value="${esc(it.name)}"></label></div><div class="field"><label>Categoria<select id="invType">${['Item','Equipamento','Consumível','Outro'].map(x=>`<option value="${x}" ${it.type===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="field"><label>Quantidade (opcional)<input type="number" min="0" max="999999" id="invQuantity" value="${esc(it.quantity??'')}" placeholder="Vazio = sem limite"></label></div><div class="field"><label>Descrição<textarea id="invDescription" maxlength="3000" rows="4">${esc(it.description||'')}</textarea></label></div><div class="ae-inventory-effects"><h3>EFEITOS AUTOMÁTICOS</h3><div class="field"><label>Bônus fixo no dano-base<input id="invDamageBonus" type="number" min="-100" max="100" step="1" value="${esc(it.damageBonus??0)}"></label></div><div class="field"><label>Ativar bônus ao usar uma liberação<select id="invLinkedAbility"><option value="">Enquanto equipado</option>${(db.sheets.find(x=>x.id===currentSheet)?.abilities||[]).filter(a=>a?.costConfig?.mode==='activation').map(a=>{const id=String(a.abilityId||a.automation?.id||a.name);return `<option value="${esc(id)}" ${it.linkedAbility===id?'selected':''}>${esc(a.name)}</option>`}).join('')}</select></label></div><label class="ae-item-equip-check"><input id="invEquipped" type="checkbox"${it.equipped===false?'':' checked'}> Item equipado / efeito habilitado</label><p class="color-hint">O bônus entra automaticamente nas rolagens quando o item estiver ativo.</p></div><div class="inventory-media-editor"><div class="field"><label>Imagem / GIF · até 15 MB<input id="invImageFile" type="file" accept="image/gif,image/png,image/jpeg,image/webp"></label></div><div class="field"><label>OU LINK DIRETO DA IMAGEM<input id="invImageUrl" type="url" placeholder="https://..." value="${esc(inventoryImageDraft.startsWith('https://')?inventoryImageDraft:'')}"></label></div><div id="invImagePreview" class="inventory-preview" aria-live="polite"></div>${btn('REMOVER IMAGEM','inventoryRemoveImage','small danger')}</div>`,[['SALVAR','inventorySaveItem','main'],['CANCELAR','closeModal']]);inventoryImagePreview()}
function inventoryChooseImage(input){if(inventoryKind!=='item'||!input.files?.[0])return;try{acceptedImage(input.files[0]);inventoryCleanupPreview();inventoryImagePending=input.files[0];inventoryPreviewObjectUrl=URL.createObjectURL(inventoryImagePending);const link=el('invImageUrl');if(link)link.value='';inventoryImagePreview()}catch(e){input.value='';toast('Imagem inválida',e.message,true)}}
function inventoryLinkImage(url){if(inventoryKind!=='item')return;inventoryCleanupPreview();inventoryImagePending=null;inventoryImageDraft=(url||'').trim();const f=el('invImageFile');if(f)f.value='';inventoryImagePreview()}
function inventoryRemoveImage(){if(inventoryKind!=='item')return;inventoryCleanupPreview();inventoryImagePending=null;inventoryImageDraft='';const file=el('invImageFile');if(file)file.value='';const link=el('invImageUrl');if(link)link.value='';inventoryImagePreview()}
async function inventorySaveItem(){if(!sheetPermission()||inventoryKind!=='item'||inventoryUploadBusy)return;const name=el('invName')?.value.trim()||'',rawQuantity=el('invQuantity')?.value.trim()??'',quantity=rawQuantity===''?null:Number(rawQuantity),link=el('invImageUrl')?.value.trim()||'';if(!name||(quantity!==null&&(!Number.isInteger(quantity)||quantity<0||quantity>999999))){toast('Dados inválidos','Informe nome e quantidade.',true);return}if(link&&(!link.startsWith('https://')||link.includes(' '))){toast('Link inválido','Use um endereço HTTPS direto da imagem.',true);return}const inv=inventoryOf(db.sheets.find(x=>x.id===currentSheet));if(inventoryEditing<0&&inv.items.length>=100){toast('Limite','Máximo 100 itens.',true);return}inventoryUploadBusy=true;try{let image=link||inventoryImageDraft;if(inventoryImagePending){const st=window.ARQUIVO_SYNC;if(!st?.state.enabled)throw Error('Conecte-se para enviar imagens.');image=await st.uploadSheetMedia(currentSheet,inventoryImagePending)}if(!sheetPermission())throw Error('Sem permissão para alterar a ficha.');const value={id:inventoryEditing<0?crypto.randomUUID():(inv.items[inventoryEditing]?.id||crypto.randomUUID()),name,type:el('invType').value,quantity,description:el('invDescription').value.trim(),image,damageBonus:Number(el('invDamageBonus')?.value||0),linkedAbility:String(el('invLinkedAbility')?.value||''),equipped:!!el('invEquipped')?.checked};if(!Number.isInteger(value.damageBonus)||Math.abs(value.damageBonus)>100){throw Error('Bônus de dano deve estar entre -100 e +100.');}if(inventoryEditing<0)inv.items.push(value);else inv.items[inventoryEditing]={...inv.items[inventoryEditing],...value};inventoryCleanupPreview();inventoryImagePending=null;inventoryKind='';save();closeModal();render();toast('Inventário atualizado','Item e ilustração salvos.')}catch(e){toast('Não foi possível salvar',e.message,true)}finally{inventoryUploadBusy=false}}
function inventoryDeleteItem(i){if(!sheetPermission())return;confirmSite('REMOVER ITEM','Remover este item?',()=>{inventoryOf(db.sheets.find(x=>x.id===currentSheet)).items.splice(i,1);save();render()})}
function inventoryCurrencyDialog(i){if(!sheetPermission())return;const cur=inventoryOf(db.sheets.find(x=>x.id===currentSheet)).currencies[i]||{name:'',amount:0};inventoryEditing=i;inventoryKind='currency';modal(i<0?'ADICIONAR VALOR':'EDITAR VALOR',`<div class="field"><label>Nome<input id="invCurrencyName" maxlength="120" value="${esc(cur.name)}"></label></div><div class="field"><label>Quantidade<input id="invAmount" type="number" min="0" max="999999999" value="${esc(cur.amount)}"></label></div>`,[['SALVAR','inventorySaveCurrency','main'],['CANCELAR','closeModal']])}
function inventorySaveCurrency(){if(!sheetPermission()||inventoryKind!=='currency')return;const name=el('invCurrencyName').value.trim(),amount=Number(el('invAmount').value);if(!name||!Number.isInteger(amount)||amount<0||amount>999999999){toast('Valor inválido','Informe nome e quantidade.',true);return}const inv=inventoryOf(db.sheets.find(x=>x.id===currentSheet));if(inventoryEditing<0&&inv.currencies.length>=30){toast('Limite','Máximo 30 valores.',true);return}const v={name,amount};if(inventoryEditing<0)inv.currencies.push(v);else inv.currencies[inventoryEditing]=v;save();closeModal();render();toast('Valores atualizados')}
function inventoryDeleteCurrency(i){if(!sheetPermission())return;confirmSite('REMOVER VALOR','Remover este valor?',()=>{inventoryOf(db.sheets.find(x=>x.id===currentSheet)).currencies.splice(i,1);save();render()})}
function sheetTabs(s){if(tab==='bonds')return window.ARQUIVO_VINCULOS?.render(s)||'<p>Vínculos indisponíveis.</p>';if(tab==='inventory')return inventoryPanel(s);if(tab==='conditions')return `<div class="panel"><div class="sectionhead"><h2>ESTADOS & CONDIÇÕES</h2>${canEditSheet(s.id)?btn('+ ADICIONAR','conditionAdd','main'):''}</div><div class="actions">${(s.conditions||[]).length?s.conditions.map((c,i)=>`<span class="tag warn condition-pill">${esc(c)} ${CONDITIONS_CATALOG.some(x=>x.toLowerCase()===String(c).toLowerCase())?`<button class="rule-lookup" data-action="conditionInfo:${i}" aria-label="Ver regra de ${esc(c)}">?</button>`:''} ${canEditSheet(s.id)?`<button class="btn small quiet" data-action="conditionRemove:${i}" title="Remover condição">${icon('close','pill-icon')}</button>`:''}</span>`).join(''):'<span class="subtitle">Nenhuma condição aplicada.</span>'}</div></div>`;
return `<div class="panel"><div class="sectionhead"><h2>NOTAS</h2>${canEditSheet(s.id)?btn('EDITAR NOTAS','editNotes','small'):''}</div><div class="rule"><div class="prose sheet-rich">${sheetRich(s.notes||'Sem anotações.')}</div></div>${s.noteImages?.length?`<div class="note-gallery">${s.noteImages.map((image,i)=>`<figure><img src="${esc(mediaSrc(image)||CLEAR_IMAGE)}" alt="Anexo ${i+1} das notas" loading="lazy">${canEditSheet(s.id)?btn('REMOVER ANEXO','removeNoteImage:'+i,'small danger'):''}</figure>`).join('')}</div>`:''}${canEditSheet(s.id)?`<div class="field"><label>ANEXAR IMAGENS OU GIFS (até 4 · 15 MB cada)<input id="noteImagesInput" type="file" accept="image/gif,image/png,image/jpeg,image/webp" multiple></label>${btn('ADICIONAR POR LINK','noteImageUrlDialog','small')}</div>`:''}</div>`}
const sheetLinkDirectoryCache={account:'',entries:[],updated:0,pending:null};
let sheetLinkBusy=false;
function sheetLinks(){
 const sh=db.sheets.find(x=>x.id===currentSheet);
 if(!sh||!player())return;
 const session=String(keyOwnerId||'')+':'+(master()?'master':'player');
 if(sheetLinkDirectoryCache.account!==session){
  sheetLinkDirectoryCache.account=session;
  sheetLinkDirectoryCache.entries=[];
  sheetLinkDirectoryCache.updated=0;
  sheetLinkDirectoryCache.pending=null;
 }
 const local=(db.keys||[]).filter(k=>k?.kind==='player');
 const fromSync=(window.ARQUIVO_SYNC?.state.keys||[]).filter(k=>k?.kind==='player');
 const directory=[...local,...fromSync,...sheetLinkDirectoryCache.entries]
  .filter((k,i,all)=>k?.id&&all.findIndex(x=>x?.id===k.id)===i);
 const ids=linkedIds(sh),own=isLinked(sh);
 const canManage=master()||(own&&sh.ownerKeyId===keyOwnerId);
 const claimable=!sh.locked&&!ids.length&&role==='player';
 const nameFor=id=>directory.find(k=>k.id===id)?.name||(id===keyOwnerId?'Você':'Jogador vinculado');
 const members=ids.length?ids.map(id=>'<span class="tag">'+esc(nameFor(id))+(id===keyOwnerId?' · VOCÊ':'')+'</span>').join(''):
  '<span class="subtitle">Nenhum jogador vinculado.</span>';
 const options=directory.filter(k=>!ids.includes(k.id)).map(k=>
  '<option value="'+esc(k.id)+'">'+esc(k.name)+'</option>').join('');
 const removable=ids.filter(id=>master()||id!==keyOwnerId);
 const removeOptions=removable.map(id=>'<option value="'+esc(id)+'">'+esc(nameFor(id))+'</option>').join('');
 const body='<div class="ae-sheet-links-dialog" data-sheet-links-panel="'+esc(sh.id)+'">'+
  '<p class="subtitle">Somente jogadores vinculados podem editar esta ficha. O mestre mantém acesso administrativo.</p>'+
  '<div class="sheet-link-members">'+members+'</div>'+
  (claimable?btn('VINCULAR À MINHA CHAVE','claimSheet','small main'):'')+
  (own?btn('DESVINCULAR MINHA CHAVE','leaveSheet','small quiet'):'')+
  (canManage&&options?'<div class="field"><label>Adicionar jogador<select id="linkPlayerTarget">'+options+
     '</select></label>'+btn('VINCULAR JOGADOR','addSheetLink','small')+'</div>':'')+
  (canManage&&removeOptions?'<div class="field"><label>Remover jogador<select id="unlinkPlayerTarget">'+removeOptions+
     '</select></label>'+btn('REMOVER VÍNCULO','removeSheetLink','small quiet')+'</div>':'')+
  (ids.length&&!own&&!master()?'<p class="color-hint">Solicite acesso a um jogador vinculado.</p>':'')+
  '</div>';
 modal('JOGADORES VINCULADOS',body,[['FECHAR','closeModal']]);
 const sync=window.ARQUIVO_SYNC;
 if(sync?.state.enabled&&!sheetLinkDirectoryCache.pending&&Date.now()-sheetLinkDirectoryCache.updated>60000){
  sheetLinkDirectoryCache.pending=sync.playerDirectory().then(list=>{
   if(sheetLinkDirectoryCache.account!==session)return;
   sheetLinkDirectoryCache.entries=Array.isArray(list)?list.filter(k=>k?.id):[];
   sheetLinkDirectoryCache.updated=Date.now();
   const dialog=el('dialogRoot')?.querySelector('[data-sheet-links-panel]');
   if(dialog?.dataset.sheetLinksPanel===sh.id&&!sheetLinkBusy&&!dialog.querySelector('select:focus,input:focus')){
    sheetLinks();
   }
  }).catch(error=>{
   sheetLinkDirectoryCache.updated=Date.now();
   if(!directory.length)toast('Lista de jogadores indisponível',error.message,true);
  }).finally(()=>{sheetLinkDirectoryCache.pending=null});
 }
}
async function changeSheetLink(action){
 const id=currentSheet,sh=db.sheets.find(x=>x.id===id);
 if(!sh||!player()||sheetLinkBusy)return;
 const editableBefore=canEditSheet(id);
 const target=action==='add'?el('linkPlayerTarget')?.value:action==='remove'?el('unlinkPlayerTarget')?.value:null;
 if(['add','remove'].includes(action)&&!target){toast('Selecione um jogador','Nenhuma chave escolhida.',true);return}
 if(action==='leave'&&!confirm('Desvincular esta ficha da sua chave? Se for a última chave, a ficha ficará pública e disponível para novo vínculo.'))return;
 sheetLinkBusy=true;
 const controls=[...(el('dialogRoot')?.querySelectorAll('.ae-sheet-links-dialog button')||[])];
 const labels=controls.map(b=>b.textContent);
 const actionName=({claim:'claimSheet',leave:'leaveSheet',add:'addSheetLink',remove:'removeSheetLink'})[action];
 const active=controls.find(b=>b.dataset.action===actionName);
 controls.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true')});
 if(active)active.textContent='SALVANDO...';
 try{
  const sync=window.ARQUIVO_SYNC;
  if(sync?.state.enabled){
   const result=await sync.sheetLink(id,action,target);
   const changed=result?.sheet;
   if(!changed||changed.id!==id)throw Error('O servidor não confirmou o novo vínculo.');
   const index=db.sheets.findIndex(x=>x.id===id);
   if(index<0)throw Error('A ficha alterada não está mais disponível.');
   db.sheets[index]=changed;
  }else{
   let ids=linkedIds(sh);
   if(action==='claim'&&ids.length===0&&!sh.locked){ids=[keyOwnerId];sh.ownerKeyId=keyOwnerId}
   else if(action==='leave'&&ids.includes(keyOwnerId)){ids=ids.filter(x=>x!==keyOwnerId)}
   else if(action==='add'&&canEditSheet(id)&&target&&!ids.includes(target))ids.push(target);
   else if(action==='remove'&&canEditSheet(id)&&ids.includes(target))ids=ids.filter(x=>x!==target);
   else throw Error('Vínculo não autorizado.');
   sh.linkedKeyIds=ids;
   if(!ids.length){sh.locked=false;sh.ownerKeyId=''}
   else if(!ids.includes(sh.ownerKeyId))sh.ownerKeyId=ids[0];
  }
  DATASTORE.save(db);
  closeModal();
  const updated=db.sheets.find(x=>x.id===id);
  if(!master()&&!isLinked(updated)&&updated?.locked)currentSheet=null;
  const badge=document.querySelector('#page .ae-ficha-links [data-action="sheetLinks"]');
  if(!currentSheet||editableBefore!==canEditSheet(id)||!badge)render();
  else badge.textContent='JOGADORES VINCULADOS · '+linkedIds(updated).length;
  toast('VÍNCULOS ATUALIZADOS');
 }catch(error){toast('Vínculo não alterado',error.message,true)}
 finally{
  sheetLinkBusy=false;
  controls.forEach((b,i)=>{if(b.isConnected){b.disabled=false;b.removeAttribute('aria-busy');b.textContent=labels[i]}});
 }
}
function sheetPage(){if(tab==='catalog')tab='summary';const s=db.sheets.find(x=>x.id===currentSheet);if(s?.masterOnly&&!master())return headline('ACESSO RESTRITO','SOMENTE MESTRES','');if(!s){currentSheet=null;return sheets()}if(s.locked&&(!canEditSheet(s.id)||s.redacted))return headline('ACESSO RESTRITO','FICHA DESCONHECIDA','Você não tem permissão para visualizar esta ficha.',btn('VOLTAR','backSheets'));
 
  const editable=canEditSheet(s.id),isMaster=master();
  const paletteStyle=sheetPaletteStyle(s.id)+'--sheet-ink:'+
   (contrast('#000000',sheetPalette(s.id).accent)>=contrast('#FFFFFF',sheetPalette(s.id).accent)?'#000000':'#FFFFFF')+';';
  if(!window.ARQUIVO_FICHA_VISUAL?.render)return headline('FICHA INDISPONÍVEL','ATUALIZE A PÁGINA','O módulo visual ainda não foi carregado.');
  return window.ARQUIVO_FICHA_VISUAL.render(window.ARQUIVO_ORIGENS?.project(s)||s,{
   tab,groups:GROUPS,canEdit:editable,master:isMaster,
   links:player()&&!s.redacted?linkedIds(s).length:0,
   style:paletteStyle,
   paletteControls:sheetPaletteControls(s.id),
   body:['bonds','conditions','inventory','notes'].includes(tab)?sheetTabs(s):'',
   history:tab==='summary'?historyHtml():''
  });
}

function rolls(){
 const online=!!window.ARQUIVO_SYNC?.state.enabled;
 const composites=online?'<div class="ae-free-composites"><span class="eyebrow">FÓRMULAS DA SESSÃO · TOTAL CALCULADO LOCALMENTE</span><div id="freeCompositeList">'+rollHistory.slice(0,6).map(x=>historyRollCard(x,true)).join('')+'</div></div>':'';
 const layout=window.ARQUIVO_FREE_ROLL?.markup({online,history:historyHtml(),composites,result:lastRoll?rollStage(lastRoll):''});
 return headline('MESA DE DADOS','ROLAGEM LIVRE','Escreva expressões como 1d4 + 1d6*2, use a calculadora ou crie atalhos para este navegador.')+(layout||'<p class="panel">A calculadora não foi carregada. Atualize a página.</p>');
}

let activeRollImpact=null,rollImpactTimeout=null;
function showRollImpact(special){
 if(!prefs.rollImpacts||motionOff()||!['CRÍTICO','CRÍTICO MÁXIMO','FALHA CRÍTICA'].includes(special))return;
 if(activeRollImpact){activeRollImpact.remove();clearTimeout(rollImpactTimeout)}
 const node=document.createElement('div');node.className='roll-impact '+(['CRÍTICO','CRÍTICO MÁXIMO'].includes(special)?'good':'bad');node.setAttribute('aria-hidden','true');
 if(['CRÍTICO','CRÍTICO MÁXIMO'].includes(special))node.innerHTML='<svg viewBox="0 0 1000 700" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M500 345 L450 240 360 138 275 0 M500 345 L590 258 670 141 755 0 M500 345 L700 315 870 251 1000 225 M500 345 L651 452 764 545 1000 670 M500 345 L453 482 394 608 359 700 M500 345 L350 372 176 421 0 530 M500 345 L369 283 230 214 0 162"/><path class="fine" d="M450 240 L531 166 548 35 M360 138 L280 168 180 144 M590 258 L661 265 713 314 M670 141 L633 65 603 0 M700 315 L774 372 844 367 M651 452 L610 543 629 700 M764 545 L759 633 785 700 M453 482 L335 491 275 578 M394 608 L476 663 490 700 M350 372 L297 293 216 300 M176 421 L149 564 114 700 M369 283 L391 188 351 61"/><path d="M500 345 l-22 -38 17 -40 -29 -43 M500 345 l32 -22 22 6 35 -27 M500 345 l14 43 34 24 12 42 M500 345 l-46 9 -22 37 -46 15"/></svg>';
 document.body.appendChild(node);activeRollImpact=node;rollImpactTimeout=setTimeout(()=>{node.remove();if(activeRollImpact===node)activeRollImpact=null},1150)
}
function rollStage(r){return `<div class="roll-stage ${['CRÍTICO','CRÍTICO MÁXIMO'].includes(r.special)?'critical':r.special==='FALHA CRÍTICA'?'failure':''}"><span class="eyebrow">${esc(r.label)} ${r.special?'// '+esc(r.special):''}</span><div class="roll-number" data-counter="${r.total}">${r.total}</div><div class="dice">${r.dice.map((d,i)=>`<div class="die ${sheetMotionOff()?'':'spin'}" data-sides="${d.sides}" style="animation-delay:${i*60}ms;${r.colors?.[i]&&SHEET_HEX.test(r.colors[i])?'--roll-die:'+r.colors[i]:''}"><small>d${d.sides}</small><b>${d.value}${d.effective!==undefined&&Number(d.effective)!==Number(d.value)?` <small>→ ${d.effective}</small>`:''}</b></div>`).join('')}</div><p class="subtitle">${esc(r.summary)}</p></div>`}
let sharedMusic=null,musicReady=false,musicSoundUnlocked=false,ytPlayer=null,ytLastId='',musicBusy=false;
function parseMusicLink(url){let u;try{u=new URL(url)}catch(e){return null}if(!['https:','http:'].includes(u.protocol))return null;
 const host=u.hostname.toLowerCase();
 if(host==='youtu.be'||host.endsWith('.youtube.com')||host==='youtube.com'){
  const id=host==='youtu.be'?u.pathname.slice(1):u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:u.searchParams.get('v');
  return id&&/^[\w-]{11}$/.test(id)?{kind:'youtube',source:id}:null}
 if(host==='open.spotify.com'){
  const m=u.pathname.match(/^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?(track|album|playlist)\/([A-Za-z0-9]{22})(?:\/|$)/i);
  return m?{kind:'spotify',source:m[1]+'/'+m[2]}:null}
 return {kind:'direct',source:u.href}}
async function adminMusicFiles(){if(!window.ARQUIVO_SYNC?.state.enabled||!master())return;try{const files=await window.ARQUIVO_SYNC.listMusic(),node=el('musicFiles');if(!node)return;
 node.innerHTML=files.filter(f=>f.name&&!f.name.startsWith('.')).map(f=>`<div class="key-row"><b>${esc(f.name)}</b><div class="actions">${btn('TOCAR','playUpload:'+encodeURIComponent(f.name),'small')}${btn('APAGAR','deleteUpload:'+encodeURIComponent(f.name),'danger')}</div></div>`).join('')||'<p>Nenhuma faixa enviada.</p>'
 }catch(e){toast('Arquivos indisponíveis',e.message,true)}}
function adminMusicSection(){return `<section class="panel"><h2>MÚSICA COMPARTILHADA</h2><p>Somente o mestre altera a reprodução da mesa. Mudo e volume são individuais.</p>
 <div class="field"><label>Fonte<select id="musicKind"><option value="direct">Link direto</option><option value="youtube">YouTube</option><option value="spotify">Spotify</option></select></label></div>
 <div class="field"><label>Link da faixa<input id="musicLink" type="url" placeholder="https://..." value=""></label></div>
 <div class="field"><label>Título<input id="sharedMusicTitle" maxlength="180" placeholder="Música da mesa"></label></div>
 <div class="actions">${btn('ESCOLHER FAIXA','chooseMusic','main')}${btn('TOCAR','musicMasterPlay')}${btn('PAUSAR','musicMasterPause')}${btn('REPETIR','musicMasterLoop')}</div>
 <div class="field"><label>Posição (segundos)<input type="number" min="0" id="musicSeek" value="0"></label>${btn('IR PARA POSIÇÃO','musicMasterSeek','small')}</div>
 <p>Arquivo e YouTube seguem o estado compartilhado. Spotify usa o player oficial: a faixa pode tocar só uma prévia. Para tentar a faixa completa, entre numa conta Spotify Premium neste navegador e clique no botão de reprodução dentro do próprio player do Spotify (não no botão do site). Em navegadores com cookies de terceiros bloqueados, até o Premium pode aparecer como prévia. O Spotify não disponibiliza controle de volume/mudo externo nem sincronização completa entre jogadores. Para música completa com volume individual e sincronização, envie um arquivo de áudio autorizado.</p>
 <hr><h3>ENVIAR ÁUDIO</h3><input id="sharedUpload" aria-label="Selecionar arquivo de áudio" type="file" accept=".mp3,.ogg,.m4a,.wav,audio/*"><p id="uploadProgress" role="status">Limite gratuito por arquivo: até 50 MB, sujeito ao limite global do projeto.</p>
 <div id="musicFiles"><p>Carregando faixas...</p></div></section>`}
async function chooseMusic(){if(!master()||!window.ARQUIVO_SYNC?.state.enabled)return;
 const parsed=parseMusicLink(el('musicLink')?.value.trim()||'');if(!parsed){toast('Link inválido','Use YouTube, Spotify ou um endereço direto de áudio.',true);return}
 const kind=el('musicKind')?.value;if(kind&&kind!==parsed.kind){toast('Tipo incompatível','Escolha a fonte correspondente ao link.',true);return}
 try{await window.ARQUIVO_SYNC.musicSet(parsed.kind,parsed.source,el('sharedMusicTitle')?.value.trim()||'Faixa da mesa',false,0,false);await syncSharedMusic(true);toast('Faixa compartilhada')}catch(e){toast('Música não salva',e.message,true)}}
async function sharedMusicCommand(kind,source,title,playing,position,loop){if(!master())return;try{await window.ARQUIVO_SYNC.musicSet(kind,source,title,playing,position,loop);await syncSharedMusic(true)}catch(e){toast('Erro na música',e.message,true)}}
function musicCurrentPosition(){if(!sharedMusic)return 0;const a=el('audio');if(sharedMusic.kind==='file'||sharedMusic.kind==='direct')return Number(a.currentTime)||0;
 if(sharedMusic.kind==='youtube'&&ytPlayer?.getCurrentTime){try{return ytPlayer.getCurrentTime()}catch(e){}}return Number(sharedMusic.position_seconds)||0}
function musicMasterCommand(action){if(!sharedMusic||!master())return;if(sharedMusic.kind==='spotify'&&['play','pause','seek','loop'].includes(action)){const wrap=el('music');wrap.classList.add('expanded');const t=el('musicExpand');if(t){t.textContent='FECHAR SPOTIFY';t.setAttribute('aria-expanded','true')}toast('Spotify','Reproduza e pause diretamente no player do Spotify. O site compartilha a faixa, não o áudio.');return}
 let pos=musicCurrentPosition();if(action==='seek')pos=Math.max(0,Number(el('musicSeek')?.value)||0);
 const playing=action==='play'?true:action==='pause'?false:!!sharedMusic.playing;
 sharedMusicCommand(sharedMusic.kind,sharedMusic.source,sharedMusic.title,playing,pos,action==='loop'?!sharedMusic.loop_enabled:!!sharedMusic.loop_enabled)}
async function uploadSharedAudio(file){if(!file||!master())return;
 if(!/\.(mp3|ogg|m4a|wav)$/i.test(file.name)||!file.type.startsWith('audio/')){toast('Formato inválido','Envie MP3, OGG, M4A ou WAV.',true);return}
 if(file.size>50*1024*1024){toast('Arquivo muito grande','O plano gratuito admite até 50 MB por arquivo.',true);return}
 const progress=el('uploadProgress');if(progress)progress.textContent=`Enviando ${file.name} (${(file.size/1048576).toFixed(1)} MB)...`;
 try{const uploaded=await window.ARQUIVO_SYNC.uploadMusic(file,p=>{const e=el('uploadProgress');if(e)e.textContent='Enviando: '+Math.round(p)+'%'});
 await window.ARQUIVO_SYNC.musicSet('file',uploaded.url,file.name,false,0,false);
 toast('Áudio enviado',file.name);await syncSharedMusic(true);await adminMusicFiles();if(el('uploadProgress'))el('uploadProgress').textContent='Envio concluído.'
 }catch(e){toast('Falha no envio',e.message,true);if(progress)progress.textContent='Falha: '+e.message}}
async function deleteUploaded(path){if(!master())return;try{await window.ARQUIVO_SYNC.deleteMusic(path);toast('Arquivo apagado');adminMusicFiles()}catch(e){toast('Erro',e.message,true)}}
function ensureYoutubeApi(){
 if(window.YT?.Player||document.querySelector('script[data-ae-youtube-api]'))return;
 const script=document.createElement('script');
 script.src='https://www.youtube.com/iframe_api';
 script.async=true;
 script.dataset.aeYoutubeApi='';
 document.head.appendChild(script);
}
function musicEmbed(kind,source){const box=el('musicEmbed');if(!box)return;box.replaceChildren();ytPlayer=null;ytLastId='';const wrap=el('music');wrap.classList.toggle('shared-embed',kind==='youtube'||kind==='spotify');wrap.classList.remove('expanded');const toggle=el('musicExpand');if(toggle){toggle.hidden=!(kind==='youtube'||kind==='spotify');toggle.textContent=kind==='spotify'?'ABRIR SPOTIFY':'ABRIR PLAYER';toggle.setAttribute('aria-expanded','false')}
 if(kind==='spotify'){const i=document.createElement('iframe');i.title='Spotify';i.allow='autoplay; encrypted-media; fullscreen';i.src='https://open.spotify.com/embed/'+source;i.loading='lazy';box.append(i)}
 if(kind==='youtube'){ensureYoutubeApi();const div=document.createElement('div');div.id='youtubePlayer';box.append(div);ytLastId=source;
 if(window.YT?.Player){ytPlayer=new window.YT.Player('youtubePlayer',{width:'350',height:'84',videoId:source,playerVars:{controls:1,playsinline:1,origin:location.origin},events:{onReady:()=>{applyExternalMusicVolume();if(sharedMusic)applyMusicState(sharedMusic,true)},onStateChange:e=>{if(e.data===0&&sharedMusic?.loop_enabled){ytPlayer.seekTo(0,true);ytPlayer.playVideo()}}}})}
 else {const i=document.createElement('iframe');i.title='YouTube';i.loading='lazy';i.src='https://www.youtube.com/embed/'+source+'?enablejsapi=1';i.allow='autoplay; encrypted-media; fullscreen';box.replaceChildren(i)} }
}
function applyExternalMusicVolume(){
 if(sharedMusic?.kind==='youtube'&&ytPlayer){
  try{if(effectiveMusicVolume()===0){ytPlayer.mute()}else{ytPlayer.unMute();ytPlayer.setVolume(effectiveMusicVolume())}}catch(e){}
 }
}
function musicExpectedPosition(m){return Math.max(0,Number(m.position_seconds||0)+(m.playing?Math.max(0,Number(m.server_now||0)-Number(m.changed_epoch||0)):0))}
function applyMusicState(m,force=false){const a=el('audio'),kind=m.kind||'direct',source=m.source||'';
 const changing=!sharedMusic||sharedMusic.kind!==kind||sharedMusic.source!==source;
 sharedMusic=m;el('musicName').textContent=m.title||'MÚSICA DA MESA';
 if(changing){musicEmbed(kind,source);if(['file','direct'].includes(kind)){try{a.pause();a.src=source||'musica.mp3';a.load()}catch(e){}}}
 let pos=musicExpectedPosition(m);if((kind==='file'||kind==='direct')&&m.loop_enabled&&Number.isFinite(a.duration)&&a.duration>0){pos%=a.duration}a.loop=!!m.loop_enabled;
 if(['file','direct'].includes(kind)){
  if((force||Math.abs((a.currentTime||0)-pos)>2)&&Number.isFinite(pos)){try{a.currentTime=pos}catch(e){}}
  if(m.playing&&musicSoundUnlocked){a.play().then(()=>{musicOn=true;updateMusicUi()}).catch(()=>{el('music').classList.add('requires-gesture')})}
  else{a.pause();musicOn=false;updateMusicUi();if(m.playing)el('music').classList.add('requires-gesture')}
 }
 if(kind==='youtube'&&ytPlayer?.getCurrentTime){try{applyExternalMusicVolume();
  const current=ytPlayer.getCurrentTime();if(Math.abs(current-pos)>2)ytPlayer.seekTo(pos,true);
  if(m.playing&&musicSoundUnlocked)ytPlayer.playVideo();else ytPlayer.pauseVideo();
 }catch(e){}}
 if(kind==='spotify'){el('music').classList.remove('requires-gesture');musicOn=false;updateMusicUi();el('musicPlay').title='Spotify: abra o player e clique para reproduzir';}
}
async function syncSharedMusic(force=false){const st=window.ARQUIVO_SYNC;if(!st?.state.enabled)return;
 try{const m=await st.musicNow();if(!m)return;applyMusicState(m,force)}catch(e){/* migração de música ainda não instalada */}}
window.onYouTubeIframeAPIReady=()=>{if(sharedMusic?.kind==='youtube')musicEmbed('youtube',sharedMusic.source)};

function clearRollHistory(){
 if(!master()||!window.ARQUIVO_SYNC?.state.enabled){toast('Acesso indisponível','Entre como mestre e conecte-se ao servidor para limpar o histórico.',true);return}
 confirmSite('APAGAR HISTÓRICO DE TESTES','Todas as rolagens verificadas serão removidas do servidor, inclusive testes ocultos. Essa ação não pode ser desfeita.',async()=>{
  try{
   const sync=window.ARQUIVO_SYNC;
   await sync.clearRolls();
   historyEpoch++;historyStates.clear();localHistoryPage=1;rollHistory=[];lastRoll=null;
   render();
   await loadVerifiedHistory(true);
   toast('Histórico apagado','Todos os registros de rolagens foram removidos.');
  }catch(e){toast('Não foi possível apagar',e.message,true)}
 });
}
function adminRollsSection(){return `${!window.ARQUIVO_SYNC?.state.enabled?'<p class="tag warn">SEM CONEXÃO: ROLAGENS NÃO VERIFICADAS</p>':''}<div class="grid2"><section class="panel"><div class="sectionhead"><h2>HISTÓRICO</h2>${btn('APAGAR HISTÓRICO','clearRolls','danger')}</div>${onlineHistoryHtml()}</section><section class="panel"><h2>ESCUDO DE MESTRE</h2><p>Resultado oculto para jogadores.</p><label>Quantidade<input type="number" id="shieldCount" value="1" min="1" max="12"></label><label>Faces<select id="shieldFaces">${VALID_DICE.map(v=>`<option value="${v}" ${v===20?'selected':''}>d${v}</option>`).join('')}</select></label>${btn('ROLAR EM SEGREDO','shieldRoll','main')}<div id="shieldResult"></div></section></div>`}
function admin(){return headline('CONTROLE','PAINEL DO MESTRE','Gerencie todo o conteúdo publicado.',btn(editMode?'DESATIVAR EDIÇÃO DE TEXTOS':'ATIVAR EDIÇÃO DE TEXTOS','toggleEditText',editMode?'alert':'main'))+`<div class="panel edit-line"><span class="tag">${window.ARQUIVO_SYNC?.state.enabled?'SINCRONIZAÇÃO ONLINE ATIVA':'DADOS LOCAIS · SEM SINCRONIZAÇÃO'}</span><span class="tag">${window.ARQUIVO_SYNC?.state.documentRealtime==='connected'?'AVISOS EM TEMPO REAL · ATIVOS':window.ARQUIVO_SYNC?.state.enabled?'AVISOS EM TEMPO REAL · RECONEXÃO / CONSULTA':'AVISOS EM TEMPO REAL · INDISPONÍVEIS'}</span>${btn('SINCRONIZAR AGORA','forceSync','small')}<p>Ao ativar, clique no texto que deseja modificar. O botão Restaurar devolve o original. Para voltar à navegação normal, desative o modo.</p></div><div class="tabs">${[['content','CONTEÚDO'],['keys','CHAVES'],['rolls','ROLAGENS'],['music','MÚSICA'],['publish','PUBLICAÇÃO']].map(([k,n])=>`<button data-action="adminTab:${k}" class="${adminSection===k?'active':''}">${n}</button>`).join('')}</div>`+(adminSection==='rolls'?adminRollsSection():adminSection==='music'?adminMusicSection():adminSection==='keys'?`<section class="panel"><h2>CHAVES</h2><p>${window.ARQUIVO_SYNC?.state.enabled?'As chaves são armazenadas no servidor e funcionam entre dispositivos.':'As chaves criadas só existem neste dispositivo até você gerar o pacote de publicação.'}</p><div class="actions">${btn('+ MESTRE','newKey:master','main')}${btn('+ JOGADOR','newKey:player')}</div>${db.keys.map(k=>`<div class="key-row"><div><b>${esc(k.name)}</b><p>${k.kind==='master'?'MESTRE':'JOGADOR'} · ${k.active?'ATIVA':'INATIVA'} ${k.sheetId?'· '+esc(db.sheets.find(s=>s.id===k.sheetId)?.name||'Sem ficha'):''}</p>${(k.accounts||[]).map(a=>`<p>${esc(a.name)} · ${new Date(a.lastSeen).toLocaleString('pt-BR')} ${btn('REMOVER CONTA','removeAccount:'+a.id,'small')}</p>`).join('')}</div><div class="actions">${k.protected?'<span class="tag">PERMANENTE</span>':btn('GERENCIAR','manageKey:'+k.id,'small')+btn(k.active?'DESATIVAR':'ATIVAR','toggleKey:'+k.id,'small')+btn('APAGAR','removeKey:'+k.id,'danger')}</div></div>`).join('')}<p class="subtitle">As chaves locais não oferecem segurança real sem um servidor.</p></section>`:adminSection==='publish'?`<section class="panel"><h2>PUBLICAR</h2><p>Baixe dados.js e publique com index.html na mesma pasta.</p>${btn('GERAR DADOS.JS','publishData','main')} ${btn('BACKUP','backup')}<p>${window.ARQUIVO_SYNC?.state.enabled?'As alterações são sincronizadas automaticamente.':'Alterações feitas em dispositivos diferentes não são sincronizadas.'}</p></section>`:`<div class="grid2"><section class="panel ae-master-clean"><h2>GERENCIAMENTO DO CONTEÚDO</h2><p>Fichas, regras e rolagens possuem áreas próprias. Utilize os atalhos abaixo, sem controles duplicados.</p><div class="actions">${btn('ABRIR FICHAS','navSheets','main')}${btn('ABRIR BIBLIOTECA','navLibrary')}${btn('VER ROLAGENS','navRolls')}</div></section><section class="panel ae-master-clean"><h2>CAPA DA CAMPANHA</h2><p>Altere a imagem ilustrativa da página inicial. O nome da campanha é Bleach CBB.</p><div class="field"><label for="coverFile">IMAGEM DE CAPA</label><input type="file" id="coverFile" accept="image/png,image/jpeg,image/webp,image/gif"></div><p class="subtitle">Para editar textos visíveis, use o botão Edição de textos acima.</p></section></div>`)}
function requireMaster(){if(!master()){toast('Acesso restrito','Esta ação exige a chave do mestre.',true);return false}return true}
function requirePlayer(){if(isPlayerPreview()){toast('Modo de teste','Esta visualização é somente leitura para proteger seus dados.',true);return false}if(!player()){toast('Chave necessária','Entre com a chave de jogador ou mestre.',true);return false}return true}
async function logoutSite(){try{if(window.ARQUIVO_SYNC?.state.enabled){await window.ARQUIVO_SYNC.logout();onlineApplyIdentity(null)}else{playerPreviewActive=false;brandPressCount=0;role='guest';keyOwnerId='';DATASTORE.clearRole()}closeModal();render();toast('Você saiu da conta')}catch(e){toast('Não foi possível sair',e.message,true)}}
window.addEventListener('arquivo-logged-out',()=>{onlineApplyIdentity(null);render();toast('Conta desconectada','Sua conta foi desconectada.')});
function showAccess(){
 const setup=!!window.ARQUIVO_SYNC?.state.enabled&&!window.ARQUIVO_SYNC.state.appliedOnce
  ?'<details class="ae-login-first-setup"><summary>Primeira configuração do servidor?</summary><button type="button" data-action="onlineBootstrapDialog">ATIVAR MESTRE INICIAL</button></details>':'';
 const body=[
  '<div class="ae-login-content">',
  '<p class="ae-login-description">Informe seu nome e chave de jogador ou mestre.</p>',
  '<div class="field ae-login-field"><label for="loginName">Nome</label><input type="text" id="loginName" maxlength="24" autocomplete="nickname" required></div>',
  '<div class="field ae-login-field"><label for="keyInput">Chave</label>',
  '<div class="ae-login-key-control">',
  '<input type="password" id="keyInput" autocomplete="off" placeholder="XXXX-XXXX-XXXX" spellcheck="false" autocapitalize="none">',
  '<button type="button" id="toggleLoginKey" class="ae-login-key-toggle" data-action="toggleLoginKey" aria-controls="keyInput" aria-pressed="false" aria-label="Mostrar chave" title="Mostrar chave">',
  '<svg class="ae-eye-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  '<svg class="ae-eye-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3 21 21M10.4 5.2A11.2 11.2 0 0 1 12 5c6.4 0 10 7 10 7a15 15 0 0 1-4.1 4.6M6 6.6C3.5 8.4 2 12 2 12s3.6 7 10 7a10.1 10.1 0 0 0 4.1-.9"/><path d="M10 10a3 3 0 0 0 4 4"/></svg>',
  '</button></div></div>',setup,'</div>'
 ].join('');
 modal('ACESSO AO ARQUIVO',body,[['ENTRAR','submitKey','main'],['SAIR','closeModal','danger']]);
 el('dialogRoot').querySelector('.dialog')?.classList.add('ae-login-dialog');
 el('loginName')?.focus();
}
function toggleLoginKeyVisibility(){
 const field=el('keyInput'),button=el('toggleLoginKey');
 if(!field||!button)return;
 const revealed=field.type==='password';
 field.type=revealed?'text':'password';
 button.setAttribute('aria-pressed',String(revealed));
 button.setAttribute('aria-label',revealed?'Ocultar chave':'Mostrar chave');
 button.title=revealed?'Ocultar chave':'Mostrar chave';
 field.focus({preventScroll:true});
}
async function submitKey(){const code=el('keyInput')?.value.trim(),loginName=el('loginName')?.value.trim();if(!loginName||loginName.length<2||loginName.length>24){toast('Nome inválido','Informe entre 2 e 24 caracteres.',true);return}if(!code){toast('Chave vazia','Digite sua chave.',true);return}if(window.ARQUIVO_SYNC?.state.enabled){try{const identity=await window.ARQUIVO_SYNC.login(loginName,code);onlineApplyIdentity(identity);closeModal();render();toast('Conectado',identity.name);onlineStatus()}catch(e){toast('Chave inválida',e.message,true)}return;}let k=null;for(const entry of db.keys){if(entry.active&&(await hashKey(entry.salt,code))===entry.hash){k=entry;break}}if(!k){toast('Chave inválida','Confira o código.',true);return}playerPreviewActive=false;brandPressCount=0;role=k.kind;keyOwnerId=k.id;DATASTORE.setRole(role,keyOwnerId);closeModal();render();toast('Acesso autorizado',k.name);if(k.demo&&k.kind==='master')forceKeys()}
function forceKeys(){modal('TROCAR CHAVE DE DEMONSTRAÇÃO',`<p>Gere sua primeira chave definitiva de mestre. As chaves de demonstração serão apagadas.</p><div class="field"><label>Nome do mestre<input id="firstName" value="Mestre"></label></div>`,[['GERAR','firstKeys','main']])}
async function firstKeys(){const name=el('firstName')?.value.trim()||'Mestre',{entry,code}=await buildKey('master',name,'');db.keys=db.keys.filter(k=>!k.demo);db.keys.push(entry);db.keysChanged=true;role='master';keyOwnerId=entry.id;DATASTORE.setRole(role,keyOwnerId);save();render();generated(code,name)}
function validKeys(){return true}
function saveKeys(){adminTab('keys')}
function sha256js(ascii){const data=new TextEncoder().encode(ascii),len=data.length*8,bytes=Array.from(data);bytes.push(128);while(bytes.length%64!==56)bytes.push(0);for(let i=7;i>=0;i--)bytes.push(Math.floor(len/2**(8*i))&255);const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2],H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];const rr=(v,n)=>(v>>>n)|(v<<(32-n));for(let pos=0;pos<bytes.length;pos+=64){const w=new Array(64);for(let i=0;i<16;i++){const x=pos+4*i;w[i]=((bytes[x]<<24)|(bytes[x+1]<<16)|(bytes[x+2]<<8)|bytes[x+3])>>>0}for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rr(x,7)^rr(x,18)^(x>>>3))+w[i-7]+(rr(y,17)^rr(y,19)^(y>>>10)))>>>0}let [a,b,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){const x=(h+(rr(e,6)^rr(e,11)^rr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0,y=((rr(a,2)^rr(a,13)^rr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+x)>>>0;d=c;c=b;b=a;a=(x+y)>>>0}for(const [i,v] of [a,b,c,d,e,f,g,h].entries())H[i]=(H[i]+v)>>>0}return H.map(x=>x.toString(16).padStart(8,'0')).join('')}
let cryptoWarned=false;async function hashKey(salt,code){const plain=salt+':'+code;try{if(crypto?.subtle){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(plain));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch(e){}if(!cryptoWarned){cryptoWarned=true;toast('WebCrypto indisponível','SHA-256 calculado localmente por compatibilidade.',true)}return sha256js(plain)}
function randomCode(){const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=new Uint8Array(12);try{crypto.getRandomValues(b)}catch(e){for(let i=0;i<12;i++)b[i]=Math.random()*256;toast('Aleatoriedade limitada','Este navegador não oferece o gerador seguro.',true)}return Array.from(b,v=>abc[v%abc.length]).join('').match(/.{4}/g).join('-')}
async function buildKey(kind,name,sheetId){const code=randomCode(),salt=randomCode().replaceAll('-','');return {code,entry:{id:uid(),name,kind,hash:await hashKey(salt,code),salt,active:true,sheetId:kind==='player'?sheetId:null}}}
function generated(code,name){modal('CÓDIGO GERADO',`<p>Copie agora a chave de ${esc(name)}. Ela só será exibida uma vez.</p><div class="code-once"><code id="generatedCode">${esc(code)}</code></div>`,[['COPIAR','copyGenerated','main'],['FECHAR','closeModal']])}
function copyGenerated(){copyText(el('generatedCode')?.textContent||'','CÓDIGO DA CHAVE')}
function adminTab(id){adminSection=id;render();if(id==='music')adminMusicFiles();if(id==='rolls')loadVerifiedHistory()}
async function removeAccountSite(id){try{await window.ARQUIVO_SYNC.removeAccount(id);await window.ARQUIVO_SYNC.keys();db.keys=window.ARQUIVO_SYNC.state.keys;render();toast('Conta removida')}catch(e){toast('Não foi possível remover',e.message,true)}}
function newKey(kind){if(!requireMaster())return;modal('CRIAR CHAVE · '+kind.toUpperCase(),`<div class="field"><label>Nome do portador<input id="keyName"></label></div>${kind==='player'?`<div class="field"><label>Ficha vinculada<select id="keySheet"><option value="">Sem ficha</option>${db.sheets.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label></div>`:''}`,[['GERAR','createKey:'+kind,'main'],['Cancelar','closeModal']])}
async function createKey(kind){if(!requireMaster())return;const name=el('keyName')?.value.trim();if(!name){toast('Nome obrigatório','Informe o nome do portador.',true);return}if(window.ARQUIVO_SYNC?.state.enabled){try{const obj=await window.ARQUIVO_SYNC.createKey(name,kind,el('keySheet')?.value||'');db.keys=window.ARQUIVO_SYNC.state.keys;save();render();generated(obj.code,name)}catch(e){toast('Erro na chave',e.message,true)}return;}const {entry,code}=await buildKey(kind,name,el('keySheet')?.value||'');db.keys.push(entry);save();render();generated(code,name)}
function manageKey(id){
 if(!requireMaster())return;
 const k=db.keys.find(v=>v.id===id);if(!k)return;
 if(k.protected){toast('Chave protegida','A chave permanente não pode ser modificada.',true);return}
 modal('GERENCIAR CHAVE',`<p>Edite o nome de referência e a ficha vinculada. A chave antiga não pode ser exibida: ela é armazenada somente como hash.</p>
 <div class="field"><label>Nome do portador<input id="manageKeyName" maxlength="100" value="${esc(k.name)}"></label></div>
 ${k.kind==='player'?`<div class="field"><label>Ficha vinculada<select id="manageKeySheet"><option value="">Sem ficha</option>${db.sheets.map(v=>`<option value="${esc(v.id)}" ${k.sheetId===v.id?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label></div>`:''}
 <p class="subtitle">Se o jogador esqueceu o código, gere uma nova chave. A anterior deixará de funcionar e todas as sessões dessa chave serão desconectadas.</p>
 ${btn('GERAR NOVA CHAVE','rotateManagedKey:'+id,'danger')}`,[['SALVAR ALTERAÇÕES','saveManagedKey:'+id,'main'],['CANCELAR','closeModal']]);
}
async function saveManagedKey(id){
 if(!requireMaster())return;
 const k=db.keys.find(v=>v.id===id);if(!k||k.protected)return;
 const name=el('manageKeyName')?.value.trim()||'';
 if(name.length<2||name.length>100){toast('Nome inválido','Informe entre 2 e 100 caracteres.',true);return}
 const sheet=k.kind==='player'?(el('manageKeySheet')?.value||''):null;
 try{
  if(window.ARQUIVO_SYNC?.state.enabled){await window.ARQUIVO_SYNC.manageKey(id,'edit',name,sheet);db.keys=window.ARQUIVO_SYNC.state.keys}
  else{k.name=name;if(k.kind==='player')k.sheetId=sheet;save()}
  closeModal();render();toast('Chave atualizada','Nome e vínculo salvos.');
 }catch(e){toast('Não foi possível salvar',e.message,true)}
}
function rotateManagedKey(id){
 if(!requireMaster())return;
 const k=db.keys.find(v=>v.id===id);if(!k||k.protected)return;
 confirmSite('SUBSTITUIR CHAVE','A chave anterior deixará de funcionar e as sessões ligadas a ela serão encerradas. Continuar?',async()=>{
  try{
   let code;
   if(window.ARQUIVO_SYNC?.state.enabled){const result=await window.ARQUIVO_SYNC.manageKey(id,'rotate');code=result.code;db.keys=window.ARQUIVO_SYNC.state.keys}
   else{const next=await buildKey(k.kind,k.name,k.sheetId);k.hash=next.entry.hash;k.salt=next.entry.salt;code=next.code;save()}
   render();generated(code,k.name);
  }catch(e){toast('Não foi possível gerar a nova chave',e.message,true)}
 });
}
async function toggleKey(id){if(!requireMaster())return;if(window.ARQUIVO_SYNC?.state.enabled){try{const k=db.keys.find(k=>k.id===id);await window.ARQUIVO_SYNC.changeKey(id,k.active?'deactivate':'activate');db.keys=window.ARQUIVO_SYNC.state.keys;render();toast('Chave atualizada')}catch(e){toast('Alteração negada',e.message,true)}return;}const k=db.keys.find(k=>k.id===id);if(!k)return;if(k.kind==='master'&&k.active&&db.keys.filter(x=>x.active&&x.kind==='master').length<=1){toast('Chave obrigatória','Não é possível desativar a última chave de mestre.',true);return}k.active=!k.active;save();render()}
function removeKey(id){if(!requireMaster())return;if(window.ARQUIVO_SYNC?.state.enabled){const k=db.keys.find(k=>k.id===id);if(!k)return;confirmSite('EXCLUIR CHAVE','Excluir a chave de '+k.name+'?',async()=>{try{await window.ARQUIVO_SYNC.changeKey(id,'delete');db.keys=window.ARQUIVO_SYNC.state.keys;render();toast('Chave excluída')}catch(e){toast('Alteração negada',e.message,true)}});return;}const k=db.keys.find(k=>k.id===id);if(!k)return;if(k.kind==='master'&&k.active&&db.keys.filter(x=>x.active&&x.kind==='master').length<=1){toast('Chave obrigatória','Não é possível apagar a última chave de mestre ativa.',true);return}confirmSite('EXCLUIR CHAVE','Deseja excluir a chave de '+k.name+'?',()=>{db.keys=db.keys.filter(k=>k.id!==id);save();render()})}
function downloadText(filename,body){const url=URL.createObjectURL(new Blob([body],{type:'text/javascript;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800)}
function publishData(){if(!requireMaster())return;downloadText('dados.js','window.ARQUIVO_PUBLICADO = '+JSON.stringify(db,null,2)+';\n');toast('Arquivo pronto','Envie dados.js junto do index.html para o Netlify.')}
async function migrateLegacyKeys(){if(Array.isArray(db.keys))return;const old=db.keys||{},items=[];for(const [kind,name] of [['master','Mestre antigo'],['player','Jogador antigo']]){if(typeof old[kind]!=='string')continue;const salt=randomCode().replaceAll('-','');items.push({id:'legacy-'+kind,kind,name,hash:await hashKey(salt,old[kind]),salt,active:true,sheetId:kind==='player'?(db.sheets[0]?.id||''):null,demo:!db.keysChanged})}db.keys=items.length?items:clone(DEFAULT.keys);save()}

// Regra unificada com Supabase/Discord: repetição de resultado >= 6 ou 1.
function avaliarResultadoDados(dice){
 const faces=Array.isArray(dice)?dice:[],groups=new Map();
 const original=faces.map(d=>{
  const value=Number(d.effective??d.value);
  return d.canceled===true||!Number.isFinite(value)?0:value;
 });
 faces.forEach((die,i)=>{
  const value=Number(die.value),sides=Number(die.sides);
  if(!original[i]||!Number.isInteger(value)||!Number.isInteger(sides)||sides<1)return;
  if(!groups.has(value))groups.set(value,{value,sides:0,indices:[]});
  const group=groups.get(value);group.sides=Math.max(group.sides,sides);group.indices.push(i);
 });
 const winners=[...groups.values()].filter(x=>x.indices.length>=2&&(x.value===1||x.value>=6))
  .sort((a,b)=>b.sides-a.sides||b.value-a.value);
 const winner=winners[0],special=winner?(winner.value===1?'FALHA CRÍTICA':'CRÍTICO MÁXIMO'):'';
 const priority=new Set(winner?.indices||[]);
 const result=faces.map((die,i)=>{
  const updated={...die};
  if(special==='CRÍTICO MÁXIMO'&&priority.has(i)){
   updated.effective=original[i]*2;updated.criticalApplied=true;
  }
  if(special==='FALHA CRÍTICA'&&priority.has(i))updated.failureApplied=true;
  return updated;
 });
 const values=result.map((d,i)=>d.canceled===true?0:Number(d.effective??original[i]))
  .filter(x=>Number.isFinite(x)&&x!==0);
 const base=original.reduce((n,x)=>n+x,0);
 return {base,total:special==='FALHA CRÍTICA'?1:values.reduce((n,x)=>n+x,0),
  ra:special==='FALHA CRÍTICA'?1:values.length?Math.max(...values):0,
  rb:special==='FALHA CRÍTICA'?1:values.length?Math.min(...values):0,
  dice:result,special};
}
function updateFreeDicePreview(){window.ARQUIVO_FREE_ROLL?.preview()}
async function freeRoll(hidden=false){
 if(!hidden){
  if(rollingBusy)return;
  const engine=window.ARQUIVO_FREE_ROLL;let plan;
  try{
   if(!engine)throw Error('O módulo da calculadora não foi carregado.');
   plan=engine.parse(el('freeExpression')?.value||'');
  }catch(e){toast('Fórmula inválida',e.message,true);finishRollFeedback();return}
  const online=!!window.ARQUIVO_SYNC?.state.enabled,verified=online&&plan.count>0;
  rollingBusy=true;
  try{
   const result=await engine.evaluate(plan,(count,faces)=>{
    if(online)return window.ARQUIVO_SYNC.rollFree(count,faces,false,Array.from({length:count},()=>currentPalette().cold));
    return Array.from({length:count},()=>({sides:faces,value:randomDie(faces)}));
   });
   const values=result.dice.map(d=>Number(d.value)),ra=values.length?Math.max(...values):0,rb=values.length?Math.min(...values):0;
   const total=Number(result.total.toFixed(6));
   const r={label:plan.source,expression:plan.source,total,special:'',ra,rb,dice:result.dice,
    clientCalculated:online,summary:(verified?'DADOS VERIFICADOS · TOTAL CALCULADO LOCALMENTE':online?'CÁLCULO LOCAL':'NÃO VERIFICADA')+' · '+result.detail,
    colors:result.dice.map(()=>currentPalette().cold)};
   lastRoll=r;rollHistory.unshift(r);if(rollHistory.length>120)rollHistory.length=120;
   localHistoryPage=1;
   sound('dice');
   const output=el('freeResult');if(output)output.innerHTML=rollStage(r);
   const live=el('rollLive');if(live)live.textContent='Rolagem livre: '+plan.source+' = '+total+(verified?' (dados verificados, total local)':' (local)');
   if(online){
    refreshRollHistorySoon();
    const list=el('freeCompositeList');if(list)list.innerHTML=rollHistory.slice(0,6).map(x=>historyRollCard(x,true)).join('');
   }else{
    const list=el('page')?.querySelector('[data-history-scope="local"]');
    if(list)list.innerHTML=historyContents('local');
   }
  }catch(e){toast('Não foi possível calcular a rolagem',e.message,true)}
  finally{rollingBusy=false;finishRollFeedback()}
  return;
 }

 const rawCount=Number(el(hidden?'shieldCount':'diceCount')?.value);
 const rawFaces=Number(el(hidden?'shieldFaces':'diceFaces')?.value);
 const valid=Number.isInteger(rawCount)&&rawCount>=1&&rawCount<=(hidden?12:30)&&Number.isInteger(rawFaces)&&
 (hidden?[4,6,8,10,12,20].includes(rawFaces):rawFaces>=2&&rawFaces<=1000);
 if(!valid){toast('Dados inválidos',hidden?'Use de 1 a 12 dados oficiais do Escudo.':'Escolha de 1 a 30 dados e de 2 a 1000 faces.',true);finishRollFeedback();return}
 const n=rawCount,d=rawFaces;
 if(window.ARQUIVO_SYNC?.state.enabled){if(rollingBusy)return;rollingBusy=true;
 try{const x=await window.ARQUIVO_SYNC.rollFree(n,d,hidden,Array.from({length:n},()=>hidden?currentPalette().accent:currentPalette().cold));const baseTotal=x.dice.reduce((a,v)=>a+Number(v.value),0);
 const calculated=avaliarResultadoDados(x.dice),actualDice=x.dice.some(v=>v.criticalApplied)?x.dice:calculated.dice;
 const values=actualDice.map(v=>Number(v.effective??v.value)).filter(Number.isFinite);
 const ra=x.special==='FALHA CRÍTICA'?1:values.length?Math.max(...values):0;
 const rb=x.special==='FALHA CRÍTICA'?1:values.length?Math.min(...values):0;
 const r={label:x.label,total:x.total,special:x.special||'',dice:actualDice,ra,rb,
 summary:'VERIFICADA · RT '+x.total+' · RA '+ra+' · RB '+rb+(x.special?' · '+x.special:'')};
 r.colors=Array.isArray(x.colors)?x.colors:[];lastRoll=r;showRollImpact(r.special);sound('dice');refreshRollHistorySoon();if(!hidden){el('rollLive').textContent='Rolagem verificada: '+r.total;const area=el('freeResult');if(area)area.innerHTML=rollStage(r)}else{const a=el('shieldResult');if(a)a.innerHTML=rollStage(r)}
 }catch(e){toast('Rolagem não registrada',e.message,true)}finally{rollingBusy=false;finishRollFeedback()}return;}
 if(hidden){toast('Escudo requer conexão online.','',true);finishRollFeedback();return}
 const dice=Array.from({length:n},()=>({sides:d,value:randomDie(d)}));
 const {base:baseTotal,special,total,ra,rb,dice:changedDice}=avaliarResultadoDados(dice);
 const r={label:`${n}d${d}`,total,special,ra,rb,dice:changedDice,
 summary:`NÃO VERIFICADA · RT ${total} · RA ${ra} · RB ${rb}${special?' · '+special:''}`};
 r.colors=dice.map(()=>currentPalette().cold);lastRoll=r;rollHistory.unshift(r);showRollImpact(special);sound('dice');el('rollLive').textContent=`Rolagem NÃO VERIFICADA: ${total}`;const area=el('freeResult');if(area)area.innerHTML=rollStage(r);finishRollFeedback()}


function resourceSetCurrent(k,value){
 if(!sheetPermission()||!requirePlayer())return;
 const s=db.sheets.find(x=>x.id===currentSheet),r=s?.resources?.[k];if(!r)return;
 if(!Number.isFinite(value)||value<0||value>100000000||Math.abs(value*100-Math.round(value*100))>0.00001){
  toast('Valor inválido','Informe até duas casas decimais.',true);return}
 const old=Number(r.current)||0;
 r.current=Math.round(value*100)/100;
 save();render();if(old!==r.current)sound('click');
}
function adjustOriginMeter(encoded,step){
 if(!sheetPermission()||!requirePlayer())return;
 const key=decodeURIComponent(encoded);
 const sheet=db.sheets.find(s=>s.id===currentSheet);
 const meter=window.ARQUIVO_ORIGENS?.meters(sheet).find(item=>item.key===key);
 if(!sheet||!meter||![1,-1].includes(step))return;
 const next=Math.min(meter.max,Math.max(0,meter.current+step));
 if(next===meter.current)return;
 sheet.abilityRuntime??={};
 sheet.abilityRuntime.originMeters??={};
 sheet.abilityRuntime.originMeters[key]=next;
 save();render();
}
function editResource(k){if(!sheetPermission()||!requirePlayer())return;const s=db.sheets.find(x=>x.id===currentSheet),r=s?.resources?.[k];if(!r)return;modal('VALOR X · '+k.toUpperCase(),`<p>Valor atual livre, inclusive decimal e acima do máximo da ficha. Valores excedentes ficam em cinza na barra.</p><div class="field"><label>Valor desejado (ex.: 27,5)<input type="text" inputmode="decimal" value="${esc(r.current)}" id="resValue" autocomplete="off"></label></div><p class="subtitle">Mínimo: 0. Máximo técnico: 100 milhões. Até 2 casas decimais.</p>`,[['SALVAR','setResource','main'],['Cancelar','closeModal']]);el('dialogRoot').dataset.resource=k}
function setResource(){if(!sheetPermission())return;const k=el('dialogRoot').dataset.resource,raw=String(el('resValue')?.value||'').trim().replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(raw)){toast('Valor inválido','Use um número positivo com até duas casas decimais.',true);return}const value=Number(raw);if(!Number.isFinite(value)||value>100000000){toast('Valor inválido','Limite de 100 milhões.',true);return}closeModal();resourceSetCurrent(k,value)}
function addCondition(){if(!sheetPermission()||!requirePlayer())return;modal('ADICIONAR ESTADO OU CONDIÇÃO',`<div class="field"><label>Condições do sistema<select id="conditionPreset"><option value="">Escolha uma condição…</option>${CONDITIONS_CATALOG.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}<option value="__custom">Outra condição (personalizada)</option></select></label></div><div class="field"><label>Condição personalizada<input id="conditionName" placeholder="Digite apenas para condição extra" maxlength="70"></label></div>`,[['ADICIONAR','confirmCondition','main'],['Cancelar','closeModal']])}
function confirmCondition(){
 if(!sheetPermission())return;
 const preset=el('conditionPreset')?.value||'',custom=el('conditionName')?.value.trim()||'';
 const name=preset&&preset!=='__custom'?preset:custom;
 if(!name||name.length>70){toast('Condição inválida','Informe uma condição de até 70 caracteres.',true);return}
 const s=db.sheets.find(x=>x.id===currentSheet);s.conditions??=[];
 if(!s.conditions.some(x=>String(x).toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))s.conditions.push(name);
 save();closeModal();render();
}
function removeCondition(i){
 if(!sheetPermission()||!requirePlayer())return;
 const s=db.sheets.find(x=>x.id===currentSheet);if(!s?.conditions?.[i])return;
 s.conditions.splice(i,1);save();render();
}
function editNotes(){if(!sheetPermission())return;const s=db.sheets.find(x=>x.id===currentSheet);modal('EDITAR NOTAS',`<div class="field"><label>Notas do personagem</label><textarea rows="10" id="notesField">${esc(s.notes||'')}</textarea></div><div class="sheet-toolbar"><label>Cor do trecho <input type="color" id="noteColorPicker" value="#FF7A1A"></label>${btn('COLORIR SELEÇÃO','colorNote','small')}</div><p class="color-hint">Selecione o texto antes de clicar em Colorir. **negrito** também funciona.</p>`,[['SALVAR','saveNotes','main'],['Cancelar','closeModal']])}
function saveNotes(){if(!sheetPermission())return;const s=db.sheets.find(x=>x.id===currentSheet);s.notes=el('notesField').value;save();closeModal();render()}
function ruleEditor(id){
 if(!requireMaster())return;
 const rule=db.rules.find(r=>r.id===id)||{title:'',text:''};
 const button=(action,label,title)=>'<button type="button" data-action="libraryFormat:'+action+'" title="'+title+'">'+label+'</button>';
 const toolbar=
  '<div class="ae-library-editor-toolbar" role="toolbar" aria-label="Formatação do texto">'+
  button('bold','<b>B</b>','Negrito (Ctrl+B)')+
  button('italic','<em>I</em>','Itálico (Ctrl+I)')+
  button('heading','TÍTULO','Inserir título')+
  button('list','LISTA','Inserir item de lista')+
  button('quote','CITAÇÃO','Inserir citação')+
  button('code','CÓDIGO','Destacar código')+
  '<label class="ae-library-editor-color">COR <input type="color" id="libraryEditorColor" value="#39D6F4" aria-label="Cor do texto selecionado"></label>'+
  button('color','APLICAR COR','Aplicar a cor escolhida')+'</div>';
 const templateOptions=[
  ['','Selecione um bloco pronto'],['rule','Regra ou mecânica'],['test','Teste e resultado'],
  ['condition','Condição ou estado'],['definition','Definição de termo'],
  ['example','Exemplo prático'],['table','Tabela de referência']
 ].map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
 const diceOptions=Array.from({length:20},(_,i)=>'<option value="'+(i+1)+'"'+(i===5?' selected':'')+'>1d'+(i+1)+'</option>').join('');
 const tools=
  '<div class="ae-library-editor-insert" aria-label="Inserir conteúdo pronto">'+
  '<div class="ae-library-editor-insert-group"><label for="libraryEditorTemplate">BLOCO PRONTO</label>'+
  '<div class="ae-library-editor-insert-controls"><select id="libraryEditorTemplate">'+templateOptions+'</select>'+
  '<button type="button" data-action="libraryInsertTemplate" title="Insere uma estrutura editável na posição do cursor">INSERIR BLOCO</button></div></div>'+
  '<div class="ae-library-editor-insert-group ae-library-editor-die"><label for="libraryEditorDice">DADO</label>'+
  '<div class="ae-library-editor-insert-controls"><select id="libraryEditorDice">'+diceOptions+'</select>'+
  '<button type="button" data-action="libraryInsertDie" title="Insere um dado como 1d3 ou 1d20">INSERIR DADO</button></div></div>'+
  '<div class="ae-library-editor-insert-group ae-library-editor-bar"><label for="libraryEditorBarFilled">RECURSO VISUAL</label>'+
  '<div class="ae-library-editor-insert-controls"><select id="libraryEditorResourceKind" aria-label="Tipo de representação">'+
  '<option value="barra">Barra</option><option value="marca">Marca</option><option value="contador">Contador</option><option value="sequencia">Sequência</option></select></div>'+
  '<div class="ae-library-editor-insert-controls"><input id="libraryEditorBarFilled" type="number" min="0" max="20" value="1" aria-label="Marcas preenchidas">'+
  '<span aria-hidden="true">/</span><input id="libraryEditorBarTotal" type="number" min="1" max="20" value="3" aria-label="Total de marcas">'+
  '<button type="button" data-action="libraryInsertBar" title="Insere barra, marca, contador ou sequência no texto">INSERIR RECURSO</button></div></div>'+
  '</div>';
 const stats=libraryEditorStats(String(rule.text||''));
 modal(id?'EDITAR CAPÍTULO':'NOVO CAPÍTULO',
  '<div class="ae-library-editor">'+
  '<label for="ruleTitle">Título do capítulo</label><input id="ruleTitle" value="'+esc(rule.title)+'" maxlength="150" placeholder="Ex.: Combate, Recursos ou Progressão">'+
  '<div class="ae-library-editor-grid"><section class="ae-library-editor-compose" aria-label="Editor de conteúdo">'+
  '<div class="ae-library-editor-top"><strong>CONTEÚDO</strong><span>Selecione palavras para aplicar a formatação</span></div>'+
  toolbar+tools+'<label for="ruleText" class="sr-only">Conteúdo do capítulo</label>'+
  '<textarea rows="18" id="ruleText" spellcheck="false" aria-describedby="ruleEditorHelp ruleEditorStats" placeholder="Escreva o capítulo aqui ou insira um bloco pronto para começar.">'+esc(rule.text)+'</textarea>'+
  '<div class="ae-library-editor-status"><span id="ruleEditorStats" role="status">'+stats+'</span>'+
  '<span id="ruleEditorState" aria-live="polite">Pronto para editar</span></div>'+
  '<p class="ae-library-editor-help" id="ruleEditorHelp">Os blocos prontos são exemplos totalmente editáveis. A prévia não salva automaticamente. Use Ctrl+S para salvar, ou Ctrl+B e Ctrl+I para formatar a seleção.</p>'+
  '</section><section class="ae-library-editor-preview" aria-label="Prévia da formatação">'+
  '<div class="ae-library-editor-top"><strong>PRÉ-VISUALIZAÇÃO</strong><span>Atualização automática</span></div>'+
  '<div id="rulePreview" class="book-text ae-library-reading">'+formatBook(rule.text)+'</div></section></div>'+
  '<div class="ae-library-editor-footer">'+
  (id?'<div class="actions">'+btn('DUPLICAR','duplicateRuleDraft','small')+btn('↑ SUBIR','moveRule:-1','small')+btn('↓ DESCER','moveRule:1','small')+'</div>':'')+
  '<span>Alterações no capítulo só entram em vigor após SALVAR.</span></div></div>',
  [['SALVAR','saveRule','main'],...(id?[['APAGAR','deleteRule','danger']]:[]),['CANCELAR','closeModal','small']]);
 el('dialogRoot').dataset.ruleId=id||'';
}
function libraryEditorStats(value){
 const text=String(value||'');
 return text.trim().split(/\s+/).filter(Boolean).length+' palavras · '+text.length+' caracteres · '+(text.split('\n').length)+' linhas';
}
function libraryEditorRefresh(){
 const field=el('ruleText');if(!field)return;
 const preview=el('rulePreview');if(preview)preview.innerHTML=formatBook(field.value);
 const stats=el('ruleEditorStats');if(stats)stats.textContent=libraryEditorStats(field.value);
 const status=el('ruleEditorState');if(status)status.textContent='Alterações não salvas';
}
function libraryEditorInsertText(text,selectPlaceholder=''){
 if(!requireMaster())return;
 const field=el('ruleText');if(!field)return;
 const from=field.selectionStart,to=field.selectionEnd;
 const before=field.value.slice(0,from),after=field.value.slice(to);
 const prefix=before&& !before.endsWith('\n\n')?(before.endsWith('\n')?'\n':'\n\n'):'';
 const suffix=after&& !after.startsWith('\n')?'\n\n':'';
 const insertion=prefix+text+suffix;
 field.setRangeText(insertion,from,to,'end');
 field.focus();
 const at=selectPlaceholder?insertion.indexOf(selectPlaceholder):-1;
 if(at>=0)field.setSelectionRange(from+at,from+at+selectPlaceholder.length);
 field.dispatchEvent(new Event('input',{bubbles:true}));
}
function libraryInsertTemplate(){
 if(!requireMaster())return;
 const field=el('ruleText'),kind=el('libraryEditorTemplate')?.value;
 if(!field||!kind){toast('Selecione um bloco','Escolha o bloco que deseja inserir.',true);return}
 const selection=field.value.slice(field.selectionStart,field.selectionEnd).trim();
 const title=selection||'Nome da mecânica';
 const templates={
  rule:{text:'## '+title+'\n\nDescreva o efeito e quando esta mecânica pode ser utilizada.\n\n- Requisito: informe o requisito.\n- Custo: informe o custo.\n- Resultado: explique o efeito.',placeholder:title},
  test:{text:'## '+(selection||'Nome do teste')+'\n\n**Quando realizar:** descreva a situação.\n\n**Dado:** 1d6\n\n**Sucesso:** descreva o resultado.\n\n**Falha:** descreva a consequência.',placeholder:selection||'Nome do teste'},
  condition:{text:'## '+(selection||'Nome da condição')+'\n\n**Efeito:** descreva a condição.\n\n**Duração:** informe até quando permanece ativa.\n\n**Remoção:** explique como encerrá-la.',placeholder:selection||'Nome da condição'},
  definition:{text:(selection||'Nome do termo')+' — Explique o significado desta expressão e seu uso nas regras.',placeholder:selection||'Nome do termo'},
  example:{text:'> Exemplo: '+(selection||'descreva uma situação prática que demonstre como aplicar a regra.'),placeholder:selection||'descreva uma situação prática que demonstre como aplicar a regra.'},
  table:{text:'| Situação | Resultado |\n| --- | --- |\n| Exemplo | Descreva o resultado |\n| Outra situação | Outro resultado |',placeholder:'Exemplo'}
 };
 const template=templates[kind];if(!template)return;
 libraryEditorInsertText(template.text,template.placeholder);
}
function libraryInsertDie(){
 if(!requireMaster())return;
 const n=Number(el('libraryEditorDice')?.value);
 if(!Number.isInteger(n)||n<1||n>20)return;
 const field=el('ruleText');if(!field)return;
 field.setRangeText('1d'+n,field.selectionStart,field.selectionEnd,'end');
 field.focus();
 field.dispatchEvent(new Event('input',{bubbles:true}));
}
function libraryInsertBar(){
 if(!requireMaster())return;
 const field=el('ruleText'),kind=el('libraryEditorResourceKind')?.value||'barra';
 const filled=Number(el('libraryEditorBarFilled')?.value),total=Number(el('libraryEditorBarTotal')?.value);
 if(!field)return;
 if(!window.ARQUIVO_BARRAS_INLINE?.valid(filled,total,kind)){
  toast('Recurso inválido','Use até 20 unidades e não ultrapasse o total.',true);return;
 }
 const code=kind==='marca'&&total===1?'[marca:'+filled+']':'['+kind+':'+filled+'/'+total+']';
 field.setRangeText(code,field.selectionStart,field.selectionEnd,'end');
 field.focus();field.dispatchEvent(new Event('input',{bubbles:true}));
}
function libraryInsertFormat(style){
 if(!requireMaster())return;
 const field=el('ruleText');if(!field)return;
 const start=field.selectionStart,end=field.selectionEnd;
 const selected=field.value.slice(start,end);
 let before='',after='',content=selected||'texto';
 switch(style){
  case'bold':before='**';after='**';break;
  case'italic':before='*';after='*';break;
  case'heading':before='\n## ';content=selected||'Novo título';break;
  case'list':before='\n- ';content=selected||'Novo item';break;
  case'quote':before='\n> ';content=selected||'Citação';break;
  case'code':before=String.fromCharCode(96);after=before;break;
  case'color':{
   const color=el('libraryEditorColor')?.value||'#39D6F4';
   if(!/^#[0-9a-f]{6}$/i.test(color))return;
   before='[cor='+color+']';after='[/cor]';break;
  }
  default:return;
 }
 field.setRangeText(before+content+after,start,end,'select');
 field.focus();
 field.setSelectionRange(start+before.length,start+before.length+content.length);
 field.dispatchEvent(new Event('input',{bubbles:true}));
}
function duplicateRuleDraft(){
 if(!requireMaster())return;
 const title=String(el('ruleTitle')?.value||'').trim(),text=String(el('ruleText')?.value||'');
 ruleEditor();
 const titleInput=el('ruleTitle'),textInput=el('ruleText');
 if(!titleInput||!textInput)return;
 titleInput.value=title?title+' (cópia)':'Cópia do capítulo';
 textInput.value=text;
 libraryEditorRefresh();
 titleInput.focus();titleInput.select();
}
function moveRule(d){
 if(!requireMaster())return;
 const id=el('dialogRoot').dataset.ruleId,i=db.rules.findIndex(r=>r.id===id);
 if(i<0)return;
 const siblings=db.rules.filter(r=>db.rules[i].book==='book2'?r.book==='book2':r.book!=='book2');
 const next=siblings[siblings.findIndex(r=>r.id===id)+d];if(!next)return;
 const j=db.rules.findIndex(r=>r.id===next.id);
 const draftTitle=el('ruleTitle')?.value||'',draftText=el('ruleText')?.value||'';
 const changed=draftTitle!==db.rules[i].title||draftText!==db.rules[i].text;
 [db.rules[i],db.rules[j]]=[db.rules[j],db.rules[i]];
 save();closeModal();render();ruleEditor(id);
 if(changed&&el('ruleTitle')&&el('ruleText')){
  el('ruleTitle').value=draftTitle;el('ruleText').value=draftText;
  libraryEditorRefresh();modalDirty=true;
 }
}
function saveRule(){if(!requireMaster())return;const id=el('dialogRoot').dataset.ruleId,title=el('ruleTitle').value.trim(),text=el('ruleText').value;if(!title){toast('Título obrigatório','Informe um nome para esta regra.',true);return}const rule=db.rules.find(r=>r.id===id);if(rule){rule.title=title;rule.text=text}else db.rules.push({id:uid(),title,text,book:libraryVolume()==='book2'?'book2':'book1'});save();closeModal();render();toast('Regra salva')}
function deleteRule(){if(!requireMaster())return;const id=el('dialogRoot').dataset.ruleId;confirmSite('EXCLUIR REGRA','Esta regra será removida da biblioteca.',()=>{db.rules=db.rules.filter(r=>r.id!==id);save();render()})}
const SHEET_SAMPLE=clone(DEFAULT.sheets[0]);
function cleanJsonInput(input){return input.trim().replace(/^```(?:json|JSON)?\s*\n?/,'').replace(/\n?```\s*$/,'').trim()}
function validationError(i,field,msg){throw Error(`Ficha ${i}: campo "${field}" ${msg}.`)}
function validateSheet(raw,i){if(!raw||typeof raw!=='object'||Array.isArray(raw))validationError(i,'ficha','deve ser um objeto JSON');const s=clone(raw);if(typeof s.name!=='string'||!s.name.trim())validationError(i,'name','deve ser um texto não vazio');if(!Number.isInteger(s.level)||s.level<1)validationError(i,'level','deve ser um número inteiro maior ou igual a 1');if(s.race!==undefined&&(typeof s.race!=='string'||s.race.length>40))validationError(i,'race','deve ser texto com até 40 caracteres');if(s.className!==undefined&&(typeof s.className!=='string'||s.className.length>100))validationError(i,'className','deve ser texto com até 100 caracteres');if(s.subtitle!==undefined&&typeof s.subtitle!=='string')validationError(i,'subtitle','deve ser texto');if(s.image!==undefined&&typeof s.image!=='string')validationError(i,'image','deve ser texto com URL ou imagem');if(s.notes!==undefined&&typeof s.notes!=='string')validationError(i,'notes','deve ser texto');if(!s.resources||typeof s.resources!=='object')validationError(i,'resources','deve existir como objeto');for(const k of ['vida','estabilidade','alma']){const v=s.resources[k];if(!v||typeof v!=='object')validationError(i,'resources.'+k,'deve conter current e max');if(!Number.isInteger(v.max)||v.max<0)validationError(i,'resources.'+k+'.max','deve ser inteiro não negativo');if(typeof v.current!=='number'||!Number.isFinite(v.current)||v.current<0||v.current>100000000||Math.abs(v.current*100-Math.round(v.current*100))>0.00001)validationError(i,'resources.'+k+'.current','deve ser um número de 0 a 100 milhões com até duas casas decimais')}if(!s.groups||typeof s.groups!=='object')validationError(i,'groups','deve existir');for(const g of Object.keys(GROUPS))if(!VALID_DICE.includes(s.groups[g]))validationError(i,'groups.'+g,'deve ser um dos dados d4, d6, d8, d10, d12 ou d20 (número sem d)');if(!s.skills||typeof s.skills!=='object')validationError(i,'skills','deve existir');for(const k of Object.values(GROUPS).flat())if(!VALID_DICE.includes(s.skills[k]))validationError(i,'skills.'+k,'deve ser um dos números 4, 6, 8, 10, 12 ou 20');if(s.abilityGroups!==undefined&&(!Array.isArray(s.abilityGroups)||s.abilityGroups.length>24))validationError(i,'abilityGroups','deve ser uma lista de até 24 categorias');s.abilityGroups??=[];const groupIds=new Set(),groupNames=new Set();for(const group of s.abilityGroups){if(!group||typeof group.id!=='string'||!group.id.trim()||group.id.length>100||typeof group.name!=='string'||!group.name.trim()||group.name.length>60)validationError(i,'abilityGroups','cada categoria precisa de ID e nome válidos');const id=group.id.trim(),name=group.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(groupIds.has(id)||groupNames.has(name))validationError(i,'abilityGroups','categorias duplicadas');groupIds.add(id);groupNames.add(name)}if(s.abilities!==undefined&&!Array.isArray(s.abilities))validationError(i,'abilities','deve ser uma lista');s.abilities??=[];for(let j=0;j<s.abilities.length;j++){const ab=s.abilities[j];if(!ab||typeof ab.name!=='string'||!ab.name.trim())validationError(i,`abilities[${j}].name`,'deve ser texto');if(!Number.isInteger(ab.cost)||ab.cost<0)validationError(i,`abilities[${j}].cost`,'deve ser inteiro não negativo');if(ab.noTest!==undefined&&typeof ab.noTest!=='boolean')validationError(i,`abilities[${j}].noTest`,'deve ser verdadeiro ou falso');delete ab.category;delete ab.passive;if(ab.groupId!==undefined&&(typeof ab.groupId!=='string'||ab.groupId.length>100))validationError(i,`abilities[${j}].groupId`,'a categoria personalizada deve ser um identificador válido');if(ab.libraryType!==undefined&&!['habilidade','tecnica'].includes(ab.libraryType))validationError(i,`abilities[${j}].libraryType`,'deve ser Habilidade ou Técnica');if(ab.origin!==undefined&&(!ab.origin||typeof ab.origin!=='object'||typeof ab.origin.auto!=='boolean'))validationError(i,`abilities[${j}].origin`,'deve ser uma origem automática válida');if(ab.inventoryItemId!==undefined&&(typeof ab.inventoryItemId!=='string'||ab.inventoryItemId.length>100))validationError(i,`abilities[${j}].inventoryItemId`,'deve ser um identificador de item ou texto vazio');if(ab.description!==undefined&&typeof ab.description!=='string')validationError(i,`abilities[${j}].description`,'deve ser texto');if(ab.usage!==undefined&&(typeof ab.usage!=='string'||ab.usage.length>120))validationError(i,`abilities[${j}].usage`,'deve ser texto com até 120 caracteres');}if(s.linkedKeyIds!==undefined&&(!Array.isArray(s.linkedKeyIds)||s.linkedKeyIds.some(x=>typeof x!=='string')))validationError(i,'linkedKeyIds','deve ser uma lista de vínculos');s.locked=typeof s.locked==='boolean'?s.locked:true;if(s.noteImages!==undefined&&(!Array.isArray(s.noteImages)||s.noteImages.some(v=>typeof v!=='string'||!dataUrlOk(v))))validationError(i,'noteImages','deve ser lista de imagens');if(s.noteImages?.length>4)validationError(i,'noteImages','permite até quatro imagens');s.noteImages??=[];s.inventory??={items:[],currencies:[]};if(!Array.isArray(s.inventory.items)||!Array.isArray(s.inventory.currencies))validationError(i,'inventory','deve ter listas items e currencies');for(const it of s.inventory.items){if(!it.id)it.id=crypto.randomUUID()}if(s.abilities.some(ab=>ab.image!==undefined&&(typeof ab.image!=='string'||(ab.image&&!dataUrlOk(ab.image)))))validationError(i,'abilities.image','deve conter imagem válida');if(s.conditions!==undefined&&(!Array.isArray(s.conditions)||s.conditions.some(c=>typeof c!=='string')))validationError(i,'conditions','deve ser uma lista de textos');s.conditions??=[];s.id=typeof s.id==='string'&&s.id.trim()?s.id:uid();s.subtitle??='';s.className??='';s.abilityGroups??=[];s.notes??='';s.image??='';return s}
function importDialog(prefill=''){if(!requirePlayer())return;modal('IMPORTAR FICHAS POR CÓDIGO',`<p>Cole um objeto JSON, uma lista de fichas ou código cercado por <b>\`\`\`json</b> e <b>\`\`\`</b>.</p><div class="field"><label>Código JSON</label><textarea id="importInput" rows="13" placeholder='{"name":"Zaraki Kenpachi", "level":3, ...}'>${esc(prefill)}</textarea></div><p class="subtitle">Se houver um erro, o campo será indicado em português. Você pode criar fichas e atualizar apenas as suas. IDs de outras pessoas não serão substituídos.</p><div class="actions">${btn('COPIAR INSTRUÇÃO PARA IA','copyInstruction','small')}</div>`,[['IMPORTAR','saveImport','main'],['Cancelar','closeModal']])}
async function saveImport(){if(!requirePlayer())return;let raw;try{raw=JSON.parse(cleanJsonInput(el('importInput').value))}catch(e){toast('JSON inválido','Revise aspas, vírgulas e colchetes. '+e.message,true);return}const items=Array.isArray(raw)?raw:Array.isArray(raw.sheets)?raw.sheets:[raw];if(!items.length){toast('Lista vazia','Informe ao menos uma ficha.',true);return}let parsed;try{parsed=items.map((s,i)=>validateSheet(s,i+1))}catch(e){toast('Erro na ficha',e.message,true);return}if(!master()&&window.ARQUIVO_SYNC?.state.enabled){
  try{
   let done=0;
   for(const s of parsed){
    const result=await window.ARQUIVO_SYNC.saveOwnedSheet(s);
    const ix=db.sheets.findIndex(x=>x.id===result.id);
    if(ix>=0)db.sheets[ix]=result;else db.sheets.push(result);
    done++;
   }
   await window.ARQUIVO_SYNC.refresh(true);closeModal();render();toast('IMPORTAÇÃO CONCLUÍDA',`${done} ficha(s) importada(s).`);
  }catch(e){await window.ARQUIVO_SYNC.refresh(true).catch(()=>{});toast('Não foi possível importar',e.message,true)}
  return;
 }
 for(const sh of parsed){if(!master()){
  sh.masterOnly=false;
  const existing=db.sheets.find(x=>x.id===sh.id);
  if(existing&&!canEditSheet(existing.id)){toast('Sem permissão','Você não pode substituir a ficha de outro jogador.',true);return}
  sh.ownerKeyId=keyOwnerId;
 }
 const idx=db.sheets.findIndex(x=>x.id===sh.id);if(idx>=0)db.sheets[idx]=sh;else db.sheets.push(sh)}
 if(master())save();else DATASTORE.save(db);closeModal();render();toast('IMPORTAÇÃO CONCLUÍDA',`${parsed.length} ficha(s) importada(s).`)}
function copySheetId(){const sheet=db.sheets.find(s=>s.id===currentSheet);if(sheet)copyText(sheet.id,'ID DA FICHA')}
function sheetExport(){const s=db.sheets.find(x=>x.id===currentSheet);if(!s)return;const text=JSON.stringify(s,null,2);copyText(text,'CÓDIGO DA FICHA')}
function copyText(text,label){const fallback=()=>modal(label,`<p>Copie o conteúdo abaixo manualmente.</p><textarea rows="14" readonly id="copyFallback">${esc(text)}</textarea>`,[['Fechar','closeModal']]);try{if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(()=>toast('Copiado para a área de transferência')).catch(fallback)}else fallback()}catch(e){fallback()}}
function copyInstruction(){const sample=clone(SHEET_SAMPLE);sample.id='';sample.image='';sample.conditions=[];const message=`Crie uma ficha para o RPG Arquivo Espiritual em JSON puro, sem explicação. Modelo:\n${JSON.stringify(sample,null,2)}\nObrigatório: name texto, level inteiro >=1, resources.vida/estabilidade/alma com current e max inteiros 0..max; groups Corpo, Mente, Espírito com valores numéricos 4,6,8,10,12,20; skills com as 18 perícias de Corpo (Vigor, Fortitude, Destreza, Atenção, Sigilo, Precisão), Mente (Cultura, Determinação, Raciocínio, Tática, Instinto, Lábia), Espírito (Presença, Sensibilidade, Integridade, Disciplina, Manipulação, Liberação), valores 4,6,8,10,12,20. abilities lista com name, cost (inteiro não negativo) e description. subtitle, image, notes e conditions são opcionais. Não invente regras não fornecidas; quando faltar referência, identifique habilidades como ilustrativas. Para múltiplas fichas, devolva array JSON. Não inclua comentários no JSON.`;copyText(message,'INSTRUÇÃO PARA IA')}
// Exclusão protegida: aviso inicial e confirmação final digitando o nome da ficha.
let pendingSheetDeletion=null;
function deleteSheet(){
 if(!requireMaster())return;
 const sheet=db.sheets.find(x=>x.id===currentSheet);
 if(!sheet||!editorDraft||editorDraft.id!==sheet.id){
  toast('Ficha não encontrada','Abra uma ficha existente para excluí-la.',true);return;
 }
 pendingSheetDeletion={id:sheet.id,name:sheet.name,step:1};
 modal('EXCLUIR FICHA?',
  '<p>Você está prestes a excluir <strong>'+esc(sheet.name)+
  '</strong> do arquivo. As alterações não salvas serão perdidas e os jogadores vinculados perderão acesso.</p>'+
  '<p>Esta ação não pode ser desfeita. Será necessário confirmar digitando o nome do personagem.</p>',
  [['CONTINUAR','deleteSheetFinalStep','danger'],['VOLTAR AO EDITOR','returnSheetEditor','small']]);
}
function deleteSheetFinalStep(){
 const pending=pendingSheetDeletion;
 if(!master()||!pending||pending.step!==1||currentSheet!==pending.id||
  !db.sheets.some(x=>x.id===pending.id)){pendingSheetDeletion=null;closeModal();return}
 pending.step=2;
 modal('CONFIRMAÇÃO FINAL',
  '<p>Para excluir definitivamente a ficha <strong>'+esc(pending.name)+
  '</strong>, digite o nome exatamente como aparece abaixo:</p>'+
  '<p class="ae-delete-sheet-name">'+esc(pending.name)+'</p>'+
  '<label>Nome da ficha<input type="text" id="confirmSheetName" autocomplete="off" '+
  'spellcheck="false" maxlength="150" placeholder="Digite o nome para confirmar"></label>'+
  '<p id="deleteSheetError" role="status" class="warning"></p>',
  [['EXCLUIR DEFINITIVAMENTE','confirmSheetDeletion','danger'],['VOLTAR AO EDITOR','returnSheetEditor','small']]);
 const button=el('dialogRoot')?.querySelector('[data-action="confirmSheetDeletion"]');
 if(button)button.disabled=true;
}
function returnSheetEditor(){
 const pending=pendingSheetDeletion;
 pendingSheetDeletion=null;
 if(pending&&master()&&editorDraft?.id===pending.id&&
  db.sheets.some(x=>x.id===pending.id)){drawSheetForm();modalDirty=true;return}
 closeModal();
}
async function confirmSheetDeletion(){
 const pending=pendingSheetDeletion;
 if(!master()||!pending||pending.step!==2||currentSheet!==pending.id)return;
 if((el('confirmSheetName')?.value||'')!==pending.name){
  const error=el('deleteSheetError');
  if(error)error.textContent='O nome precisa ser idêntico ao da ficha.';
  return;
 }
 if(!db.sheets.some(x=>x.id===pending.id)){pendingSheetDeletion=null;closeModal();toast('Ficha não encontrada','Exclusão cancelada.',true);return}
 const previous=db.sheets.slice(),oldCurrent=currentSheet;
 pendingSheetDeletion=null;
 db.sheets=db.sheets.filter(x=>x.id!==pending.id);
 currentSheet=null;
 const sync=window.ARQUIVO_SYNC;
 try{
  if(save()===false)throw Error('Não foi possível salvar a exclusão.');
  if(sync?.state?.enabled){
   await sync.state.pending;
   if(sync.state.lastPushError)throw Error(sync.state.lastPushError);
  }
  editorDraft=null;closeModal();render();
  toast('Ficha excluída','O personagem foi removido do arquivo.');
 }catch(error){
  db.sheets=previous;currentSheet=oldCurrent;DATASTORE.save(db);
  render();toast('Exclusão não concluída',error.message,true);
  if(editorDraft?.id===pending.id)drawSheetForm();
 }
}
async function saveSite(){
 if(!requireMaster())return;
 const title=el('siteTitle')?.value.trim()||'Arquivo Espiritual';
 const subtitle=el('siteSubtitle')?.value||'';
 const palette=el('siteDefaultPalette')?.value||'zangetsu';
 db.site.title=title;db.site.subtitle=subtitle;db.site.defaultPalette=palette;
 pendingOnlineSnapshot=null;save();applyPrefs();render();
 const sync=window.ARQUIVO_SYNC;
 if(!sync?.state.enabled){toast('Identidade salva localmente','Conecte-se para publicar aos jogadores.',true);return}
 await sync.state.pending;
 if(sync.state.lastPushError){toast('Publicação não concluída',sync.state.lastPushError,true);return}
 toast('Identidade publicada','A atualização foi enviada aos jogadores conectados.');
}
async function compressImage(file){if(!file||!file.type.startsWith('image/'))throw Error('Escolha um arquivo de imagem.');if(file.type==='image/gif'){if(file.size>320000)throw Error('GIF acima de 320 KB: use um GIF menor para preservar a animação.');return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Falha ao ler GIF.'));r.onload=()=>resolve(r.result);r.readAsDataURL(file)})}if(file.size>18000000)throw Error('A imagem deve ter até 18 MB.');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Não foi possível ler a imagem'));r.onload=()=>resolve(r.result);r.readAsDataURL(file)});const im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('Imagem inválida'));im.src=src});const width=Math.min(1200,im.naturalWidth),height=Math.max(1,Math.round(im.naturalHeight*width/im.naturalWidth));const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0,width,height);let data;try{data=c.toDataURL('image/webp',.78);if(!data.startsWith('data:image/webp'))throw Error('') }catch(e){data=c.toDataURL('image/jpeg',.78)}return data}
async function imageFile(input,field){if(!requireMaster())return;const f=input.files?.[0];if(!f)return;try{let image;if(field==='sheet'){acceptedImage(f);image=await window.ARQUIVO_SYNC.uploadSheetMedia(currentSheet,f)}else image=await compressImage(f);if(field==='cover'){db.site.cover=image}else if(field==='sheet'){const s=db.sheets.find(x=>x.id===currentSheet);if(s)s.image=image}save();closeModal();render();toast('Imagem salva','Arquivo externo vinculado à ficha.')}catch(e){toast('Erro na imagem',e.message,true)}}
function imageDialog(){if(!requireMaster())return;modal('IMAGEM DO PERSONAGEM',`<p>Escolha JPG, PNG, WebP ou GIF de até 15 MB. O arquivo será salvo separadamente no Storage privado.</p><div class="field"><label>Arquivo de imagem</label><input type="file" id="sheetImageFile" accept="image/gif,image/png,image/jpeg,image/webp"></div>`,[['Fechar','closeModal']])}
function exportBackup(){if(!requireMaster())return;const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='arquivo-espiritual-backup.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup iniciado')}
function restoreDialog(){if(!requireMaster())return;modal('RESTAURAR BACKUP',`<p>A restauração substituirá os dados atuais. Faça uma cópia antes.</p><div class="field"><label>Arquivo JSON</label><input id="restoreFile" type="file" accept=".json,application/json"></div>`,[['CONTINUAR','restoreCheck','alert'],['Cancelar','closeModal']])}
async function restoreCheck(){if(!requireMaster())return;const file=el('restoreFile')?.files?.[0];if(!file){toast('Arquivo ausente','Selecione um backup JSON.',true);return}try{const obj=JSON.parse(await file.text());if(!obj.site||!obj.keys||!Array.isArray(obj.rules)||!Array.isArray(obj.sheets))throw Error('Estrutura incompatível');obj.sheets.forEach((s,i)=>validateSheet(s,i+1));confirmSite('CONFIRMAR RESTAURAÇÃO','Todos os dados locais serão substituídos pelo backup.',()=>{db=obj;save();render();toast('Backup restaurado')})}catch(e){toast('Backup inválido',e.message,true)}}
function blankSheet(){const skills={};for(const k of Object.values(GROUPS).flat())skills[k]=4;return {name:'',subtitle:'',race:'',className:'',level:1,image:'',resources:{vida:{current:20,max:20},estabilidade:{current:20,max:20},alma:{current:10,max:10}},groups:{Corpo:4,Mente:4,Espírito:4},skills,abilities:[],abilityGroups:[],notes:'',noteImages:[],inventory:{items:[],currencies:[]},conditions:[],ownerKeyId:role==='player'?keyOwnerId:'',linkedKeyIds:role==='player'?[keyOwnerId]:[],locked:true,masterOnly:false}}
let editorScope='all',editorAbilityOnly=null;function newSheet(){if(!requirePlayer())return;openSheetForm()}
function editSheetSection(scope){if(!sheetPermission())return;openSheetForm(currentSheet,false,scope)}
function editAbilityDirect(index){if(!sheetPermission())return;openSheetForm(currentSheet,false,'abilities');editorAbilityOnly=index;drawSheetForm()}
function newAbilityDirect(){if(!master()||!sheetPermission())return;openSheetForm(currentSheet,false,'abilities');editorDraft.abilities.push({name:'',libraryType:'habilidade',cost:0,description:'',usage:''});editorAbilityOnly=editorDraft.abilities.length-1;drawSheetForm()}
function newMasterSheet(){if(!requireMaster())return;openSheetForm(null,true)}
function editSheetForm(){if(!sheetPermission())return;openSheetForm(currentSheet)}
function picker(field,label,value){return `<label>${esc(label)}<select data-edit="${esc(field)}">${VALID_DICE.map(d=>`<option value="${d}" ${Number(value)===d?'selected':''}>d${d}</option>`).join('')}</select></label>`}
let pendingSheetImage=null,pendingAbilityImages=new WeakMap(),sheetFormSaving=false,mediaUploadsInFlight=0;function openSheetForm(id,onlyMaster=false,scope='all'){pendingSheetImage=null;pendingAbilityImages=new WeakMap();editorScope=scope;editorAbilityOnly=null;editorDraft=clone((id&&db.sheets.find(s=>s.id===id))||blankSheet());if(!id)editorDraft.masterOnly=!!onlyMaster;window.ARQUIVO_ORIGENS?.reconcile(editorDraft);drawSheetForm()}
function abilityGroupOptions(s,ab,i){
 const groups=Array.isArray(s.abilityGroups)?s.abilityGroups:[];
 return '<label>Categoria na ficha<select data-ability="'+i+':groupId"><option value="">Sem categoria personalizada</option>'+
  groups.map(g=>'<option value="'+esc(g.id)+'"'+(ab.groupId===g.id?' selected':'')+'>'+esc(g.name)+'</option>').join('')+
  '</select></label>';
}
function abilityDescriptionField(ab,i){
 if(master())return '<label>Descrição (aceita [cor=#FF7A1A]texto[/cor])<textarea data-ability="'+i+
  ':description" placeholder="Quando se aplica, o que acontece e quais são os limites.">'+esc(ab.description||'')+'</textarea></label>';
 return '<label>Descrição · somente o mestre pode editar<textarea readonly aria-readonly="true" class="ae-ficha-ability-readonly-description"'+
  ' aria-label="Descrição da habilidade, somente leitura">'+esc(ab.description||'')+'</textarea></label>';
}
function abilityGroupsDialog(){
 if(!master()||!sheetPermission())return;
 const s=db.sheets.find(x=>x.id===currentSheet);if(!s)return;
 const groups=Array.isArray(s.abilityGroups)?s.abilityGroups:[];
 const rows=groups.map(g=>'<div class="ae-ability-group-editor-row">'+
   '<input type="text" maxlength="60" data-ability-group-rename="'+esc(g.id)+'" value="'+esc(g.name)+'"'+
   ' aria-label="Nome da categoria '+esc(g.name)+'">'+
   btn('RENOMEAR','abilityGroupRename:'+g.id,'small')+
   btn('REMOVER','abilityGroupDelete:'+g.id,'small danger')+'</div>').join('');
 modal('CATEGORIAS DE HABILIDADES',
  '<div class="ae-ability-group-editor"><p>Organize as habilidades desta ficha por categorias, como Ressurreição. A criação e o gerenciamento são exclusivos do mestre.</p>'+
  '<label>Nova categoria<input id="abilityGroupName" maxlength="60" placeholder="Ex.: Ressurreição"></label>'+
  '<p class="ae-ability-group-helper">'+groups.length+' de 24 categorias criadas</p>'+
  (rows?'<div class="ae-ability-group-editor-list">'+rows+'</div>':'')+'</div>',
  [['CRIAR CATEGORIA','abilityGroupCreate','main'],['FECHAR','closeModal','small']]);
}
function abilityGroupPersist(sheet){
 if(!master())return;
 save();render();abilityGroupsDialog();
}
function abilityGroupCreate(){
 if(!master()||!sheetPermission())return;
 const sh=db.sheets.find(s=>s.id===currentSheet),name=el('abilityGroupName')?.value.trim()||'';
 if(!sh||!name||name.length>60){toast('Nome inválido','Informe um nome com até 60 caracteres.',true);return}
 sh.abilityGroups??=[];
 const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(sh.abilityGroups.length>=24){toast('Limite de categorias','Máximo de 24 categorias por ficha.',true);return}
 if(sh.abilityGroups.some(g=>g.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===key)){
  toast('Categoria existente','Já existe uma categoria com este nome.',true);return;
 }
 sh.abilityGroups.push({id:uid(),name});abilityGroupPersist(sh);
}
function abilityGroupRename(id){
 if(!master()||!sheetPermission())return;
 const sh=db.sheets.find(s=>s.id===currentSheet),group=sh?.abilityGroups?.find(g=>g.id===id);
 const input=[...(el('dialogRoot')?.querySelectorAll('[data-ability-group-rename]')||[])].find(x=>x.dataset.abilityGroupRename===id);
 const name=input?.value.trim()||'';
 if(!group||!name||name.length>60){toast('Nome inválido','Informe um nome válido para esta categoria.',true);return}
 const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(sh.abilityGroups.some(g=>g.id!==id&&g.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===key)){
  toast('Categoria existente','Este nome já é usado por outra categoria.',true);return
 }
 group.name=name;abilityGroupPersist(sh);
}
function abilityGroupDelete(id){
 if(!master()||!sheetPermission())return;
 const sh=db.sheets.find(s=>s.id===currentSheet),g=sh?.abilityGroups?.find(v=>v.id===id);if(!g)return;
 confirmSite('REMOVER CATEGORIA','As habilidades serão movidas para suas seções padrão. Nenhuma habilidade será apagada.',()=>{
  sh.abilityGroups=sh.abilityGroups.filter(v=>v.id!==id);
  for(const ab of sh.abilities||[])if(ab.groupId===id)ab.groupId='';
  abilityGroupPersist(sh);
 });
}
function drawSheetForm(){const s=editorDraft;modal('EDITOR DE FICHA',`<div class="sheet-form"><div class="sheet-edit-scroll"><h3>IDENTIDADE</h3><label>Nome<input data-edit="name" value="${esc(s.name)}"></label><label>Subtítulo<input data-edit="subtitle" value="${esc(s.subtitle||'')}"></label><label>Raça<select data-edit="race"><option value="">Não definida</option>${[...new Set([...(window.ARQUIVO_ORIGENS?.races()||['Shinigami','Visored','Hollow','Arrancar','Quincy','Humano','Fullbringer']),s.race].filter(Boolean))].map(r=>`<option value="${esc(r)}" ${s.race===r?'selected':''}>${esc(r)}</option>`).join('')}</select></label><label>Classe<select data-edit="className"><option value="">Não definida</option>${[...new Set([...(window.ARQUIVO_ORIGENS?.classes()||[]),s.className].filter(Boolean))].map(c=>`<option value="${esc(c)}" ${s.className===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Nível<input type="number" min="1" data-edit="level" value="${s.level}"></label><label>Imagem / GIF até 15 MB<input type="file" id="formImage" accept="image/gif,image/png,image/jpeg,image/webp"></label><label>Ou link direto da imagem<input data-edit="image" type="url" placeholder="https://..." value="${esc(/^https?:\/\//i.test(s.image||'')?s.image:'')}"></label><label class="${master()?'':'hidden'}">Jogador responsável<select data-edit="ownerKeyId"><option value="">Sem responsável</option>${db.keys.filter(k=>k.kind==='player').map(k=>`<option value="${esc(k.id)}" ${s.ownerKeyId===k.id?'selected':''}>${esc(k.name)}</option>`).join('')}</select></label>${master()?`<label class="private-sheet-setting"><input type="checkbox" data-edit="masterOnly" ${s.masterOnly?'checked':''}> <b>FICHA EXCLUSIVA DO MESTRE</b><small>Aparece apenas na seção reservada aos mestres dentro de Fichas; jogadores e visitantes não conseguem acessar os dados nem as rolagens.</small></label><label class="private-sheet-setting"><input type="checkbox" data-edit="locked" ${s.locked?'checked':''}> <b>TRAVAR FICHA</b><small>Somente o mestre e jogadores associados podem ver o conteúdo. Para os demais, a ficha não aparece na lista.</small></label>`:''}${!master()&&role==='player'?`<label class="private-sheet-setting"><input type="checkbox" data-edit="locked" ${s.locked?'checked':''}> <b>TRAVAR FICHA</b><small>Ativada por padrão. Apenas jogadores vinculados e o mestre poderão visualizar fichas trancadas.</small></label>`:''}<h3>GRUPOS</h3><div class="form-grid">${Object.keys(GROUPS).map(g=>picker('groups.'+g,g,s.groups[g])).join('')}</div><h3>PERÍCIAS</h3>${Object.entries(GROUPS).map(([g,skills])=>`<h4>${g} ${btn('COPIAR DADO DO GRUPO','applyGroup:'+g,'small')}</h4><div class="form-grid">${skills.map(sk=>picker('skills.'+sk,sk,s.skills[sk])).join('')}</div>`).join('')}<h3>RECURSOS MÁXIMOS</h3><div class="form-grid">${['vida','estabilidade','alma'].map(k=>`<label>${k}<input type="number" min="0" data-edit="resources.${k}.max" value="${s.resources[k].max}"></label>`).join('')}</div><h3>HABILIDADES</h3><p class="color-hint">Descreva o efeito uma vez. Custo, fase e limite aparecem automaticamente no cartão da ficha.</p>${s.abilities.map((ab,i)=>`<div class="ability-edit"><label>Nome<input data-ability="${i}:name" value="${esc(ab.name)}"></label><label>Origem do registro<select data-ability="${i}:libraryType"><option value="habilidade" ${ab.libraryType==='tecnica'?'':'selected'}>Habilidade</option><option value="tecnica" ${ab.libraryType==='tecnica'?'selected':''}>Técnica</option></select></label>${abilityGroupOptions(s,ab,i)}<label>Custo de Alma<input type="number" min="0" data-ability="${i}:cost" value="${ab.cost}"></label><label>Limite de uso (opcional)<input maxlength="120" data-ability="${i}:usage" placeholder="Ex.: Uma vez por fase" value="${esc(ab.usage||'')}" ${master()?'':'readonly'}></label>${master()?`<div class="ae-ability-mechanics-editor"><label>Funcionamento da habilidade<select data-ability="${i}:abilityMode"><option value="use" ${ab.costConfig?.mode==='activation'?'':'selected'}>Uso normal / instantâneo</option><option value="activation" ${ab.costConfig?.mode==='activation'?'selected':''}>Liberação / efeito ativável</option></select></label><label>Fase de uso<select data-ability="${i}:abilityPhase"><option value="">Detectar pelo efeito</option>${[['preparacao','Preparação'],['distancia','Distância'],['duelo','Duelo'],['desfecho','Desfecho']].map(([val,label])=>`<option value="${val}" ${ab.costConfig?.phase===val?'selected':''}>${label}</option>`).join('')}</select></label><p class="color-hint">Liberações podem ativar bônus de itens enquanto estiverem ativas. A ficha e a Mesa compartilham o mesmo efeito.</p></div>`:''}${abilityDescriptionField(ab,i)}<label>Imagem / GIF até 15 MB<input type="file" data-ability-image="${i}" accept="image/gif,image/png,image/jpeg,image/webp"></label><label>OU LINK DIRETO DA IMAGEM<input type="url" data-ability="${i}:image" placeholder="https://..." value="${esc(/^https?:\/\//i.test(ab.image||'')?ab.image:'')}"></label>${ab.image?`<p class="color-hint">Imagem anexada ${btn('REMOVER IMAGEM','removeAbilityImage:'+i,'small danger')}</p>`:''}<div class="actions">${master()?btn('↑','moveAbility:'+i+':-1','small')+btn('↓','moveAbility:'+i+':1','small')+btn('EXCLUIR','removeAbility:'+i,'small danger'):''}</div></div>`).join('')}${master()?btn('+ HABILIDADE','addAbility','small'):''}<h3>CONDIÇÕES INICIAIS</h3><label>Separadas por vírgula<input data-edit="conditionText" value="${esc((s.conditions||[]).join(', '))}"></label><h3>NOTAS</h3><label>Notas<textarea data-edit="notes" rows="5">${esc(s.notes||'')}</textarea></label><p id="sheetFormError" role="status" class="warning"></p></div><aside class="sheet-preview"><div class="preview-art" id="previewArt" style="${imgStyle(s.image)}">${s.image?'':'魂'}</div><h2 id="previewName">${esc(s.name||'Novo personagem')}</h2><p id="previewSubtitle">Nível ${s.level} · ${esc(s.subtitle||'')}</p><div id="previewResources">${['vida','estabilidade','alma'].map(k=>`<p>${k}: ${s.resources[k].max}</p>`).join('')}</div></aside></div>`,[['SALVAR','saveSheetForm','main'],['CANCELAR','cancelSheetForm']],master()&&s.id&&db.sheets.some(x=>x.id===s.id)?{label:'EXCLUIR FICHA',action:'deleteSheet'}:null);el('dialogRoot').querySelector('.dialog').classList.add('wide-dialog');const scroll=el('dialogRoot').querySelector('.sheet-edit-scroll');if(editorScope!=='all'&&scroll){const keep=editorScope==='skills'?['GRUPOS','PERÍCIAS']:editorScope==='identity'?['IDENTIDADE']:editorScope==='resources'?['RECURSOS MÁXIMOS']:editorScope==='abilities'?['HABILIDADES']:editorScope==='conditions'?['CONDIÇÕES INICIAIS']:['NOTAS'];let visible=false;for(const child of scroll.children){if(child.tagName==='H3')visible=keep.includes(child.textContent.trim());if(child.id==='sheetFormError')visible=true;if(!visible)child.classList.add('hidden')}if(editorScope==='abilities'&&editorAbilityOnly!==null)scroll.querySelectorAll('.ability-edit').forEach((node,i)=>node.classList.toggle('hidden',i!==editorAbilityOnly));el('dialogRoot').querySelector('.dialog h2').textContent='EDITOR · '+editorScope.toUpperCase()}
 window.ARQUIVO_FICHA_VISUAL?.upgradeEditor?.();}
function updateDraft(target){
 const field=target.dataset.edit;
 if(field){
  const value=(field==='locked'||field==='masterOnly')?target.checked:target.value;
  if(field==='conditionText')editorDraft.conditions=value.split(',').map(x=>x.trim()).filter(Boolean);
  else{
   const path=field.split('.');let object=editorDraft;
   for(let i=0;i<path.length-1;i++)object=object[path[i]];
   object[path.at(-1)]=field==='level'||field.startsWith('groups.')||field.startsWith('skills.')||field.startsWith('resources.')?Number(value):value;
  }
  if(field==='race'||field==='className'){
   const changed=window.ARQUIVO_ORIGENS?.reconcile(editorDraft);
   if(changed){drawSheetForm();modalDirty=true;return}
  }
 }
 if(target.dataset.ability){
  const [index,key]=target.dataset.ability.split(':');
  const ab=editorDraft.abilities[Number(index)];if(!ab)return;
  if((key==='description'||key==='usage')&&!master())return;
  if((key==='abilityMode'||key==='abilityPhase')&&!master())return;
  if(key==='abilityMode'){
   ab.costConfig={...(ab.costConfig&&typeof ab.costConfig==='object'?ab.costConfig:{}),mode:target.value==='activation'?'activation':'use'};
   if(target.value==='activation'&&!ab.abilityId)ab.abilityId=uid();
   return;
  }
  if(key==='abilityPhase'){
   if(!['','preparacao','distancia','duelo','desfecho'].includes(target.value))return;
   ab.costConfig={...(ab.costConfig&&typeof ab.costConfig==='object'?ab.costConfig:{}),phase:target.value};
   return;
  }
  if(key==='groupId'&&target.value&&!(editorDraft.abilityGroups||[]).some(g=>g.id===target.value))return;
  if(['name','cost','description','usage','image','libraryType','groupId'].includes(key))
   ab[key]=key==='cost'?Number(target.value):target.value;
 }
 const name=el('previewName'),subtitle=el('previewSubtitle'),resources=el('previewResources');
 if(name)name.textContent=editorDraft.name||'Novo personagem';
 if(subtitle)subtitle.textContent='Nível '+editorDraft.level+' · '+(editorDraft.subtitle||'');
 if(resources)resources.innerHTML=['vida','estabilidade','alma'].map(k=>'<p>'+k+': '+editorDraft.resources[k].max+'</p>').join('');
}
function applyGroup(g){
 if(!editorDraft||!Object.hasOwn(GROUPS,g))return;
 for(const name of GROUPS[g]){
  editorDraft.skills[name]=editorDraft.groups[g];
  const field=el('dialogRoot')?.querySelector('[data-edit="skills.'+name+'"]');
  if(field)field.value=String(editorDraft.groups[g]);
 }
 toast('PERÍCIAS ATUALIZADAS','Os dados do grupo foram aplicados sem fechar o editor.');
}
function addAbility(){if(!master())return;editorDraft.abilities.push({name:'',libraryType:'habilidade',cost:0,description:'',usage:''});if(editorScope==='abilities')editorAbilityOnly=editorDraft.abilities.length-1;drawSheetForm()}
function removeAbility(i){if(!master())return;editorDraft.abilities.splice(i,1);editorAbilityOnly=null;drawSheetForm()}
function moveAbility(i,d){if(!master())return;const j=i+d;if(j<0||j>=editorDraft.abilities.length)return;[editorDraft.abilities[i],editorDraft.abilities[j]]=[editorDraft.abilities[j],editorDraft.abilities[i]];drawSheetForm()}
function cancelSheetForm(){confirmSite('DESCARTAR ALTERAÇÕES','Sair sem salvar a ficha?',()=>{editorDraft=null;closeModal()})}
async function saveSheetForm(){
 if(!requirePlayer()||sheetFormSaving)return;
 if(mediaUploadsInFlight){toast('Envio em andamento','Conclua o envio da imagem antes de salvar a ficha.',true);return}
 sheetFormSaving=true;
 try{
  window.ARQUIVO_ORIGENS?.reconcile(editorDraft);
  const raw=clone(editorDraft),old=db.sheets.find(s=>s.id===raw.id),st=window.ARQUIVO_SYNC;
  if(!master()&&old){
   const originals=(old.abilities||[]).filter(ab=>!ab?.origin?.auto);
   if(raw.abilities.length!==originals.length)throw Error('Somente o mestre pode criar ou excluir habilidades manualmente.');
   raw.abilities.forEach((ab,i)=>{ab.description=originals[i].description||'';ab.usage=originals[i].usage||''});
   raw.abilityGroups=clone(old.abilityGroups||[]);
  }
  // Escrita consistente também ao editar diretamente uma habilidade da ficha.
  // Jogadores não alteram os textos do mestre.
  if(master())for(const ab of raw.abilities||[]){
   if(typeof ab.description==='string'&&ab.description.trim())
    ab.description=window.ARQUIVO_CBB_PRESENTATION?.standardize?.(ab.description)||ab.description;
  }
  const queued=editorDraft.abilities.map((ab,i)=>({i,file:pendingAbilityImages.get(ab)})).filter(x=>x.file);
  const hasUploads=!!pendingSheetImage||queued.length>0;
  for(const k of ['vida','estabilidade','alma'])raw.resources[k].current=old?old.resources[k].current:raw.resources[k].max;
  let sheet=validateSheet(raw,1);
  if(!master()){
   if(old?.masterOnly)throw Error('Ficha exclusiva do mestre.');
   sheet.masterOnly=false;
   sheet.locked=raw.locked!==false;
   if(db.sheets.some(x=>x.id===sheet.id)&&!canEditSheet(sheet.id))throw Error('Você não pode alterar a ficha de outro jogador.');
   sheet.ownerKeyId=old?.ownerKeyId||keyOwnerId;sheet.linkedKeyIds=old?linkedIds(old):[keyOwnerId];
  }else{sheet.ownerKeyId=raw.ownerKeyId||'';sheet.linkedKeyIds=linkedIds(sheet);if(sheet.ownerKeyId&&!sheet.linkedKeyIds.includes(sheet.ownerKeyId))sheet.linkedKeyIds.push(sheet.ownerKeyId)}
  if(hasUploads){
   if(!st?.state.enabled)throw Error('Conecte-se ao Supabase para salvar anexos de até 15 MB.');
   if(!old){
    if(master()){
     db.sheets.push(sheet);
     save();
     await st.state.pending;
     const confirmation=await st.state.client.rpc('ae_read_document');
     if(confirmation.error||!confirmation.data?.data?.sheets?.some(x=>x.id===sheet.id))throw Error('A ficha não foi registrada no servidor antes do envio.');
    }else sheet=await st.saveOwnedSheet(sheet);
    editorDraft.id=sheet.id;
   }
   if(pendingSheetImage)sheet.image=await st.uploadSheetMedia(sheet.id,pendingSheetImage);
   for(const entry of queued)sheet.abilities[entry.i].image=await st.uploadSheetMedia(sheet.id,entry.file);
  }
  if(!master()&&st?.state.enabled)sheet=await st.saveOwnedSheet(sheet);
  const i=db.sheets.findIndex(s=>s.id===sheet.id);
  if(i>=0)db.sheets[i]=sheet;else db.sheets.push(sheet);
  if(master()&&sheet.ownerKeyId){
   const key=db.keys.find(k=>k.id===sheet.ownerKeyId&&k.kind==='player');
   if(key)key.sheetId=sheet.id;
  }
  if(master())save();
  else if(st?.state.enabled)await st.refresh(true);
  else DATASTORE.save(db);
  pendingSheetImage=null;pendingAbilityImages=new WeakMap();editorDraft=null;editorScope='all';editorAbilityOnly=null;
  closeModal();page='sheets';currentSheet=sheet.id;render();toast('Ficha salva',sheet.name);
 }catch(e){const node=el('sheetFormError');if(node)node.textContent=e.message;toast('Ficha não concluída',e.message,true)}
 finally{sheetFormSaving=false}
}
async function imageForForm(input){const file=input.files?.[0];if(!file)return;try{acceptedImage(file);if(!editorDraft?.id||!db.sheets.some(s=>s.id===editorDraft.id)){pendingSheetImage=file;const elPreview=el('previewArt');if(elPreview){elPreview.style.backgroundImage='url('+URL.createObjectURL(file)+')';elPreview.textContent=''}toast('GIF preparado','Será enviado quando você salvar a nova ficha.');return}mediaUploadsInFlight++;let ref;try{ref=await window.ARQUIVO_SYNC.uploadSheetMedia(editorDraft.id,file)}finally{mediaUploadsInFlight--}editorDraft.image=ref;const node=el('previewArt');if(node){node.style.backgroundImage='url('+URL.createObjectURL(file)+')';node.textContent=''}toast('Arquivo enviado','Salve a ficha para vincular o novo anexo.')}catch(e){toast('Erro na imagem',e.message,true)}}

function editSheet(){if(!requireMaster())return;const s=db.sheets.find(x=>x.id===currentSheet);if(s)importDialog(JSON.stringify(s,null,2))}
function saveMusic(){if(!requireMaster())return;const url=el('musicUrl')?.value.trim()||'';if(url&&!/^https?:\/\//i.test(url)){toast('URL inválida','Utilize um endereço http ou https direto de arquivo de áudio.',true);return}db.site.musicUrl=url;db.site.musicName=url?'Faixa do mestre':'AMBIENTE';save();setMusicSource();toast('Música atualizada')}
function setMusicSource(){const a=el('audio');try{a.pause();a.src=db.site.musicUrl||'musica.mp3';a.volume=effectiveMusicVolume()/100;a.load();el('musicName').textContent=db.site.musicName||'musica.mp3';musicOn=false;updateMusicUi()}catch(e){toast('Áudio indisponível','O navegador pode ter bloqueado áudio neste ambiente.',true)}}
function updateMusicUi(){if(!el('musicPlay'))return;
 const external=sharedMusic?.kind==='spotify';const hint=el('spotifyMusicHint');if(hint)hint.hidden=!external;
 for(const id of ['musicVolume','musicMute']){
  const node=el(id);if(!node)continue;node.disabled=external;
  node.title=external?'Spotify não permite controlar o volume pelo site. Ajuste o som no dispositivo ou no Spotify.':'';
  node.setAttribute('aria-label',external?'Volume indisponível no Spotify incorporado':id==='musicMute'?'Silenciar música':'Volume da música');
 }
 const p=el('musicPlay');if(p&&external)p.title='Abra o player Spotify e clique no botão próprio de reprodução';
el('musicPlay').innerHTML=icon(musicOn?'pause':'play');el('musicMute').innerHTML=icon(musicMuted?'mute':'speaker');el('soundButton').style.opacity=soundOn?'1':'.35';el('soundButton').innerHTML=icon('speaker')+'<span class="sound-caption">FX</span>'}
async function musicToggle(){if(window.ARQUIVO_SYNC?.state.enabled&&sharedMusic?.kind==='spotify'){const wrap=el('music');wrap.classList.add('expanded');const t=el('musicExpand');if(t){t.textContent='FECHAR SPOTIFY';t.setAttribute('aria-expanded','true')}toast('Spotify','Clique em reproduzir no player do Spotify.');return}if(window.ARQUIVO_SYNC?.state.enabled){if(!musicSoundUnlocked){musicSoundUnlocked=true;await syncSharedMusic(true);el('music').classList.remove('requires-gesture');return}if(master())musicMasterCommand(sharedMusic?.playing?'pause':'play');else toast('Música compartilhada','Somente o mestre controla a reprodução da mesa.');return}const a=el('audio');try{if(musicOn){a.pause();musicOn=false}else{await a.play();musicOn=true}updateMusicUi()}catch(e){musicOn=false;updateMusicUi();toast('Música não encontrada','Coloque musica.mp3 ao lado do index.html ou informe uma URL direta no painel do mestre.',true)}}
function criticalImpactSound(ctx){
 const t=ctx.currentTime,v=effectiveEffectsVolume()/100;
 const bus=ctx.createDynamicsCompressor();bus.threshold.value=-18;bus.ratio.value=6;bus.attack.value=.005;bus.release.value=.24;bus.connect(ctx.destination);
 for(const voice of [{a:88,b:42,d:.4,g:.15,w:'sawtooth'},{a:230,b:92,d:.25,g:.12,w:'triangle'},{a:430,b:830,d:.55,g:.08,w:'sine'},{a:650,b:1080,d:.7,g:.05,w:'sine'}]){
 const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=voice.w;osc.frequency.setValueAtTime(voice.a,t);osc.frequency.exponentialRampToValueAtTime(voice.b,t+voice.d);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,voice.g*v),t+.02);gain.gain.exponentialRampToValueAtTime(.0001,t+voice.d);osc.connect(gain);gain.connect(bus);osc.start(t);osc.stop(t+voice.d+.02)}
 const count=Math.ceil(ctx.sampleRate*.13),buffer=ctx.createBuffer(1,count,ctx.sampleRate),samples=buffer.getChannelData(0);
 for(let i=0;i<count;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*.028));
 const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=buffer;filter.type='highpass';filter.frequency.value=920;gain.gain.value=.20*v;src.connect(filter);filter.connect(gain);gain.connect(bus);src.start(t);src.stop(t+.13);
 // Fragmentos de vidro em sequência: estalos metálicos distintos do efeito grave.
 for(const [offset,frequency,length,loudness] of [[0,1780,.16,.19],[.045,2450,.20,.13],[.095,3170,.24,.095],[.15,1320,.27,.08]]){
  const osc=ctx.createOscillator(),envelope=ctx.createGain(),time=t+offset;
  osc.type='sine';osc.frequency.setValueAtTime(frequency,time);osc.frequency.exponentialRampToValueAtTime(frequency*.76,time+length);
  envelope.gain.setValueAtTime(.0001,time);envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,loudness*v),time+.004);envelope.gain.exponentialRampToValueAtTime(.0001,time+length);
  osc.connect(envelope);envelope.connect(bus);osc.start(time);osc.stop(time+length+.01);
 }
}
let rollAudioNeedsPermission=false;
function prepareRollAudio(){
 if(effectiveEffectsVolume()===0)return;
 try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  audioContext??=new C();
  if(audioContext.state==='suspended')audioContext.resume().then(()=>{rollAudioNeedsPermission=false}).catch(()=>{rollAudioNeedsPermission=true});
 }catch(e){rollAudioNeedsPermission=true}
}
// Som clássico da Beta 2.5.1, exclusivo para mudanças de Vida/Estabilidade/Alma.
function sound(type='click'){
 if(!soundOn||effectiveEffectsVolume()===0)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  audioContext??=new C();
  if(audioContext.state==='suspended'){
   audioContext.resume().then(()=>{if(type==='critical')criticalImpactSound(audioContext)}).catch(()=>{});
   if(type==='critical')return;
  }
  if(type==='critical'){criticalImpactSound(audioContext);return}
  const t=audioContext.currentTime,volume=effectiveEffectsVolume()/100;
  // Cliques positivos, leves e com transiente curto; os alertas ficam distintos.
  const sequence=type==='ultimate'?[[142,280,.26,.09],[320,770,.41,.092],[720,1380,.64,.075]]:
   type==='release'?[[210,450,.18,.052],[470,980,.33,.05]]:
   type==='dice'?[[560,790,.085,.045],[850,1130,.13,.032]]:
   type==='damage'?[[240,160,.14,.06]]:
   type==='success'?[[760,1080,.09,.032],[1070,1370,.14,.025]]:
   [[620,900,.075,.028]];
  for(const [initial,final,duration,level] of sequence){
   const osc=audioContext.createOscillator(),gain=audioContext.createGain();
   osc.type=type==='ultimate'||type==='release'?'triangle':'sine';
   osc.frequency.setValueAtTime(initial,t);osc.frequency.exponentialRampToValueAtTime(final,t+duration);
   gain.gain.setValueAtTime(.0001,t);
   gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level*volume),t+.009);
   gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
   osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+duration+.01);
  }
 }catch(e){}
}
function bindEvents(){document.addEventListener('keydown',event=>{
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&el('ruleText')&&el('ruleTitle')&&el('dialogRoot')?.querySelector('.ae-library-editor')){
  event.preventDefault();saveRule();return;
 }
 const term=event.target?.closest?.('.ae-library-reading .ae-glossary-link[role="link"]');
 if(term&&(event.key==='Enter'||event.key===' ')){
  event.preventDefault();term.click();return;
 }
 if(el('ruleText')&&document.activeElement===el('ruleText')&&(event.ctrlKey||event.metaKey)&&['b','i'].includes(event.key.toLowerCase())){
  event.preventDefault();libraryInsertFormat(event.key.toLowerCase()==='b'?'bold':'italic');return
 }
 if(page!=='library'||event.altKey||event.ctrlKey||event.metaKey)return;
 if(event.key==='/'&&!event.target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')){
  const search=grimorioOpen&&libraryVolume()!=='warehouse'&&el('grimorioSearch')?el('grimorioSearch'):(el('ruleSearch')||el('warehouseSearch'));if(search){event.preventDefault();search.focus();search.select()}
 }
 if(event.key==='Escape'&&document.activeElement?.id==='grimorioSearch'&&grimorioQuery){
  event.preventDefault();grimorioQuery='';document.activeElement.value='';grimorioRefreshResults();
 }
 if(event.key==='Escape'&&document.activeElement?.id==='ruleSearch'&&query){
  event.preventDefault();libraryClearSearch();
 }
 if(event.key==='Escape'&&document.activeElement?.id==='warehouseSearch'){
  event.preventDefault();document.activeElement.value='';document.activeElement.dispatchEvent(new Event('input',{bubbles:true}));
 }
});window.addEventListener('resize',()=>{if(window.innerWidth>680)setMobileMore(false)},{passive:true});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el('mobileMoreMenu')?.hidden){setMobileMore(false);e.preventDefault()}});document.addEventListener('pointerdown',e=>{const action=e.target.closest('[data-action]')?.dataset.action?.split(':')[0];if(['freeRoll','shieldRoll','testSound'].includes(action))prepareRollAudio()},{passive:true,capture:true});document.addEventListener('click',e=>{const t=e.target.closest('[data-action=musicExpand]');if(!t)return;e.stopImmediatePropagation();const m=el('music'),expanded=m.classList.toggle('expanded');t.textContent=expanded?(sharedMusic?.kind==='spotify'?'FECHAR SPOTIFY':'FECHAR PLAYER'):(sharedMusic?.kind==='spotify'?'ABRIR SPOTIFY':'ABRIR PLAYER');t.setAttribute('aria-expanded',String(expanded))},true);let backdropStart=false;document.addEventListener('pointerdown',e=>{backdropStart=e.target.id==='modalBackground'});document.addEventListener('pointerup',e=>{if(backdropStart&&e.target.id==='modalBackground'&&!el('dialogRoot').querySelector('input,textarea,select'))requestModalClose();backdropStart=false});document.addEventListener('click',async e=>{if(editMode&&master()){const target=e.target.closest('[data-edit-text]');if(target&&!e.target.closest('#dialogRoot')&&!e.target.closest('[data-action="toggleEditText"]')&&!e.target.closest('#editModeExit')){e.preventDefault();e.stopPropagation();editTextDialog(target.dataset.editText,target.dataset.originalText||'');return}}if(e.target.id==='modalBackground'){if(e.target===e.currentTarget)return;return}const nav=e.target.closest('[data-page]');if(nav){sound();setPage(nav.dataset.page);return}const open=e.target.closest('[data-open]');if(open){sound();setPage(open.dataset.open);return}const sheet=e.target.closest('[data-sheet]');if(sheet){sound();viewSheet(sheet.dataset.sheet);return}const tb=e.target.closest('[data-tab]');if(tb){
 tab=tb.dataset.tab;sound();
 const sh=page==='sheets'&&currentSheet?db.sheets.find(x=>x.id===currentSheet):null;
 const view=window.ARQUIVO_FICHA_VISUAL;
 const fast=sh&&view?.switchTab?.(window.ARQUIVO_ORIGENS?.project(sh)||sh,{tab,groups:GROUPS,canEdit:canEditSheet(sh.id),master:master(),
  body:['bonds','conditions','inventory','notes'].includes(tab)?sheetTabs(sh):'',
  history:tab==='summary'?historyHtml():''});
 if(fast){
  if(editMode&&master())applyTextOverrides();
  if(tab==='summary'&&window.ARQUIVO_SYNC?.state.enabled)Promise.resolve().then(()=>loadVerifiedHistory());
  return;
 }
 render();return
}const b=e.target.closest('[data-action]');if(!b)return;const parts=b.dataset.action.split(':'),a=parts[0];if(a==='previewMasterKey'){previewMasterKey();return}if(['freeRoll','shieldRoll','testSound'].includes(a))prepareRollAudio();if(['freeRoll','shieldRoll'].includes(a)&&!rollingBusy)beginRollFeedback(b);if(!['resource','skill','freeRoll','shieldRoll','useAbility','rerollVerifiedSkill','rollConfiguredSkill','abilityRoll'].includes(a))sound();switch(a){case'mobileMoreToggle':setMobileMore(el('mobileMoreMenu')?.hidden);break;case'hudToggle':{const m=el('music'),small=m.classList.toggle('compact-hud');const t=el('hudToggle'),side=el('sidebarAudio');t.textContent=small?'▴':'▾';t.setAttribute('aria-expanded',String(!small));t.title=small?'Expandir player':'Minimizar player';if(side){side.setAttribute('aria-expanded',String(!small));side.title=small?'Abrir música':'Minimizar música'}prefs.hudMinimized=small;PREFSSTORE.save();const mobileAudio=el('mobileAudioButton');if(mobileAudio)mobileAudio.setAttribute('aria-expanded',String(!small));setMobileMore(false);break}case'resetSheetColor':resetSheetColor();break;case'importOldSheetColors':importOldSheetColors();break;case'colorNote':wrapColoredSelection('notesField','noteColorPicker');break;case'removeAbilityImage':removeAbilityImage(Number(parts[1]));break;case'removeNoteImage':removeNoteImage(Number(parts[1]));break;case'noteImageUrlDialog':noteImageUrlDialog();break;case'noteImageUrlSave':noteImageUrlSave();break;case'conditionInfo':conditionInfo(Number(parts[1]));break;case'forceSync':forceOnlineSync();break;case'toggleEditText':if(!master())break;editMode=!editMode;syncEditModeExit();render();toast(editMode?'Edição ativada · botão fixo para encerrar':'Edição desativada');break;case'saveEditedText':saveEditedText();break;case'restoreEditedText':restoreEditedText();break;case'onlineBootstrapDialog':onlineBootstrapDialog();break;case'onlineBootstrapSave':onlineBootstrapSave();break;case'resetSettings':resetSettings(parts[1]);break;case'paletteEditor':paletteEditor();break;case'testSound':prepareRollAudio();sound('critical');break;case'speechSample':window.ARQUIVO_SPEECH?.sample();break;case'speechRead':window.ARQUIVO_SPEECH?.readSelection();break;case'speechReadDialog':window.ARQUIVO_SPEECH?.readDialog();break;case'speechStop':window.ARQUIVO_SPEECH?.stop();break;case'speechResetPanel':window.ARQUIVO_SPEECH?.reset();break;case'access':showAccess();break;case'logout':logoutSite();break;case'submitKey':submitKey();break;case'toggleLoginKey':toggleLoginKeyVisibility();break;case'closeModal':requestModalClose();break;case'discardModal':discardModal();break;case'returnModal':returnModal();break;case'confirmPending':confirmPending();break;case'firstKeys':firstKeys();break;case'adminTab':adminTab(parts[1]);break;case'newKey':newKey(parts[1]);break;case'createKey':createKey(parts[1]);break;case'copyGenerated':copyGenerated();break;case'manageKey':manageKey(parts[1]);break;case'saveManagedKey':saveManagedKey(parts[1]);break;case'rotateManagedKey':rotateManagedKey(parts[1]);break;case'toggleKey':toggleKey(parts[1]);break;case'removeKey':removeKey(parts[1]);break;case'removeAccount':removeAccountSite(parts[1]);break;case'publishData':publishData();break;case'saveKeys':saveKeys();break;case'navSheets':setPage('sheets');break;case'navRolls':setPage('rolls');break;case'newSheet':newSheet();break;case'editSheetSection':editSheetSection(parts[1]);break;case'abilityGroups':abilityGroupsDialog();break;case'abilityGroupCreate':abilityGroupCreate();break;case'abilityGroupRename':abilityGroupRename(parts[1]);break;case'abilityGroupDelete':abilityGroupDelete(parts[1]);break;case'editAbilityDirect':editAbilityDirect(Number(parts[1]));break;case'newAbilityDirect':newAbilityDirect();break;case'inventoryAddItem':inventoryItemDialog(-1);break;case'inventoryEditItem':inventoryItemDialog(Number(parts[1]));break;case'inventoryToggleEquipped':inventoryToggleEquipped(Number(parts[1]));break;case'inventorySaveItem':inventorySaveItem();break;case'inventoryDeleteItem':inventoryDeleteItem(Number(parts[1]));break;case'inventoryRemoveImage':inventoryRemoveImage();break;case'inventoryAddCurrency':inventoryCurrencyDialog(-1);break;case'inventoryEditCurrency':inventoryCurrencyDialog(Number(parts[1]));break;case'inventorySaveCurrency':inventorySaveCurrency();break;case'inventoryDeleteCurrency':inventoryDeleteCurrency(Number(parts[1]));break;case'newMasterSheet':newMasterSheet();break;case'editSheetForm':editSheetForm();break;case'sheetLinks':sheetLinks();break;case'claimSheet':changeSheetLink('claim');break;case'leaveSheet':changeSheetLink('leave');break;case'addSheetLink':changeSheetLink('add');break;case'removeSheetLink':changeSheetLink('remove');break;case'saveSheetForm':saveSheetForm();break;case'cancelSheetForm':cancelSheetForm();break;case'applyGroup':applyGroup(parts[1]);break;case'addAbility':addAbility();break;case'removeAbility':removeAbility(+parts[1]);break;case'moveAbility':moveAbility(+parts[1],+parts[2]);break;case'moveRule':moveRule(+parts[1]);break;case'toggleChapter':toggleLibraryChapter(parts[1]);break;case'openChapter':openLibraryChapter(parts[1]);break;case'openAllChapters':setAllLibraryChapters(true);break;case'closeAllChapters':setAllLibraryChapters(false);break;case'clearLibrarySearch':libraryClearSearch();break;case'toggleGrimorio':toggleGrimorio();break;case'grimorioCategoryFilter':{let category='';try{category=decodeURIComponent(parts.slice(1).join(':'))}catch{}if(['Todos',...GRIMORIO_CATEGORIES].includes(category)){grimorioCategory=category;grimorioLetter='Todas';const field=el('grimorioCategory');if(field)field.value=category;grimorioRefreshResults()}break}case'grimorioLetter':{let letter='';try{letter=decodeURIComponent(parts.slice(1).join(':'))}catch{}if(letter==='Todas'||/^[A-Z0-9]$/.test(letter)){grimorioLetter=letter;grimorioRefreshResults()}break}case'grimorioFavorite':toggleGrimorioFavorite(parts.slice(1).join(':'));break;case'grimorioOnlyFavorites':grimorioFavoritesOnly=!grimorioFavoritesOnly;grimorioRefreshResults();break;case'grimorioQuick':{let value='';try{value=decodeURIComponent(parts.slice(1).join(':'))}catch{}grimorioQuery=value;grimorioCategory='Todos';grimorioLetter='Todas';const field=el('grimorioSearch');if(field)field.value=value;const cat=el('grimorioCategory');if(cat)cat.value='Todos';grimorioRefreshResults();el('grimorioSearch')?.focus();break}case'grimorioReset':grimorioQuery='';grimorioCategory='Todos';grimorioLetter='Todas';grimorioFavoritesOnly=false;{const f=el('grimorioSearch');if(f){f.value='';f.focus()}const cat=el('grimorioCategory');if(cat)cat.value='Todos'}grimorioRefreshResults();break;case'manageGrimorio':manageGrimorio();break;case'saveGrimorioOptions':saveGrimorioOptions();break;case'editGlossary':openGlossaryEditor(parts.slice(1).join(':'));break;case'backGrimorioManager':backToGrimorioManager();break;case'confirmGrimorioNavigation':confirmGrimorioNavigationAction();break;case'cancelGrimorioNavigation':cancelGrimorioNavigation();break;case'saveGlossaryEntry':saveGlossaryEntry();break;case'toggleGlossaryTerm':toggleGlossaryTerm(parts.slice(1).join(':'));break;case'deleteGlossaryEntry':deleteGlossaryEntry();break;case'explainRule':showLibraryMechanic(parts[1]);break;case'goMechanicChapter':goLibraryMechanicChapter(parts[1]);break;case'navLibrary':setPage('library');break;case'newRule':ruleEditor();break;case'editRule':ruleEditor(parts.slice(1).join(':'));break;case'libraryFormat':libraryInsertFormat(parts[1]);break;case'libraryInsertTemplate':libraryInsertTemplate();break;case'libraryInsertDie':libraryInsertDie();break;case'libraryInsertBar':libraryInsertBar();break;case'duplicateRuleDraft':duplicateRuleDraft();break;case'saveRule':saveRule();break;case'deleteRule':deleteRule();break;case'import':importDialog();break;case'saveImport':saveImport();break;case'copyInstruction':copyInstruction();break;case'backSheets':currentSheet=null;render();break;case'copySheetId':copySheetId();break;case'exportSheet':sheetExport();break;case'editSheet':editSheet();break;case'deleteSheet':deleteSheet();break;case'deleteSheetFinalStep':deleteSheetFinalStep();break;case'returnSheetEditor':returnSheetEditor();break;case'confirmSheetDeletion':void confirmSheetDeletion();break;case'sheetImage':imageDialog();break;case'freeRoll':freeRoll();break;case'freeFaces':if(el('diceFaces')){el('diceFaces').value=String(Number(parts[1]));updateFreeDicePreview()}break;case'shieldRoll':freeRoll(true);break;case'historyNav':historyNavigate(decodeURIComponent(parts[1]),parts[2]);break;case'chooseMusic':chooseMusic();break;case'musicMasterPlay':musicMasterCommand('play');break;case'musicMasterPause':musicMasterCommand('pause');break;case'musicMasterLoop':musicMasterCommand('loop');break;case'musicMasterSeek':musicMasterCommand('seek');break;case'playUpload':{const path=decodeURIComponent(parts.slice(1).join(':'));const st=window.ARQUIVO_SYNC;const u=st.state.client.storage.from('musica').getPublicUrl(path).data.publicUrl;sharedMusicCommand('file',u,path,true,0,false);break}case'deleteUpload':deleteUploaded(decodeURIComponent(parts.slice(1).join(':')));break;case'musicAccess':musicSoundUnlocked=true;el('music').classList.remove('requires-gesture');syncSharedMusic(true);break;case'clearRolls':clearRollHistory();break;case'originMeter':adjustOriginMeter(parts[1],Number(parts[2]));break;case'editResource':editResource(parts[1]);break;case'setResource':setResource();break;case'conditionAdd':addCondition();break;case'confirmCondition':confirmCondition();break;case'conditionRemove':removeCondition(Number(parts[1]));break;case'editNotes':editNotes();break;case'saveNotes':saveNotes();break;case'saveSite':saveSite();break;case'backup':exportBackup();break;case'restore':restoreDialog();break;case'restoreCheck':restoreCheck();break;case'saveMusic':saveMusic();break;case'musicToggle':musicToggle();break;case'mute':prefs.musicMuted=!prefs.musicMuted;PREFSSTORE.save();applyPrefs();break;case'soundToggle':prefs.effectsMuted=!prefs.effectsMuted;PREFSSTORE.save();applyPrefs();break;}});document.addEventListener('input',e=>{if(e.target.id==='confirmSheetName'){const pending=pendingSheetDeletion;const button=el('dialogRoot')?.querySelector('[data-action="confirmSheetDeletion"]');if(button)button.disabled=!pending||pending.step!==2||e.target.value!==pending.name;const error=el('deleteSheetError');if(error)error.textContent='';return}if(['diceCount','diceFaces'].includes(e.target.id))updateFreeDicePreview();if(e.target.id==='invImageUrl')inventoryLinkImage(e.target.value);if(e.target.closest('#dialogRoot')&&!modalGuard&&!e.target.closest('.ae-palette-dialog'))modalDirty=true;if(e.target.id==='ruleSearch'){query=e.target.value;libraryRefreshResults()}if(e.target.id==='grimorioSearch'){grimorioQuery=e.target.value;grimorioRefreshResults()}if(e.target.id==='glossaryConnectionsSearch'){const needle=glossaryKey(e.target.value);el('glossaryConnectionList')?.querySelectorAll('[data-connection-title]').forEach(row=>{row.hidden=!glossaryKey(row.dataset.connectionTitle).includes(needle)})}if(['settingsMaster','settingsMusic','settingsEffects'].includes(e.target.id)){changeSetting(e.target.id,e.target.value)}if(e.target.dataset.palette)changeCustomPaletteColor(e.target.dataset.palette,e.target.value);if((e.target.dataset.edit||e.target.dataset.ability||e.target.dataset.abilityDie)&&editorDraft)updateDraft(e.target);if(e.target.id==='ruleText')libraryEditorRefresh();if(e.target.id==='ruleTitle'&&el('ruleEditorState'))el('ruleEditorState').textContent='Alterações não salvas';if(e.target.dataset.sheetPalette)setSheetPalette(e.target.dataset.sheetPalette,e.target.value);if(e.target.id==='globalGradientEnd')changeCustomGradient('end',e.target.value);if(e.target.dataset.sheetGradient==='end')setSheetGradient('gradientEnd',e.target.value);if(e.target.matches('input[type=range]'))updateRangeTrack(e.target);if(e.target.id==='musicVolume'){try{changeSetting('musicVolume',e.target.value)}catch(e){}}});document.addEventListener('change',e=>{if(e.target.id==='libraryEditorResourceKind'&&['marca','sequencia'].includes(e.target.value)){
 const count=el('libraryEditorBarTotal'),filled=el('libraryEditorBarFilled');
 const max=e.target.value==='marca'?1:3;
 if(count)count.value=String(max);
 if(filled&&Number(filled.value)>max)filled.value=String(max);
}if(e.target.id==='invImageFile')inventoryChooseImage(e.target);if(e.target.id==='globalGradient')changeCustomGradient('toggle',e.target.checked);if(e.target.dataset.sheetGradient==='toggle')setSheetGradient('gradient',e.target.checked);if(['presetChoice','sizeChoice','interfaceScaleChoice','speechRateChoice'].includes(e.target.id))changeSetting(e.target.id,e.target.value);if(['settingsMuteMaster','settingsMuteMusic','settingsMuteEffects'].includes(e.target.id))changeSetting(e.target.id,e.target.checked);if(e.target.dataset.setting)changeSetting(e.target.dataset.setting,e.target.checked);if(e.target.id==='chapterJump'&&e.target.value)openLibraryChapter(e.target.value);if(e.target.id==='grimorioCategory'){grimorioCategory=e.target.value;grimorioLetter='Todas';grimorioRefreshResults()}if(e.target.id==='formImage')imageForForm(e.target);if(e.target.dataset.abilityImage!==undefined)abilityImageUpload(e.target);if(e.target.id==='noteImagesInput')noteImageUpload(e.target);if(e.target.id==='coverFile')imageFile(e.target,'cover');if(e.target.id==='sheetImageFile')imageFile(e.target,'sheet');if(e.target.id==='sharedUpload'&&e.target.files[0])uploadSharedAudio(e.target.files[0])});document.addEventListener('keydown',e=>{const dialog=el('dialogRoot').querySelector('[role=dialog]');if(!dialog)return;if(e.key==='Escape'){if(!el('firstPlayerKey')){if(modalGuard)returnModal();else requestModalClose()}e.preventDefault()}if(e.key==='Tab'){const fs=[...dialog.querySelectorAll('button,input,textarea,select,[tabindex]')].filter(x=>!x.disabled&&x.tabIndex!==-1);if(!fs.length)return;const first=fs[0],last=fs[fs.length-1];if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault()}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault()}}});let heroMotionFrame=0,heroMotionInput=null;
document.addEventListener('pointermove',e=>{
 const hero=e.target.closest?.('#character');
 if(!hero||sheetMotionOff())return;
 heroMotionInput={hero,x:e.clientX,y:e.clientY};
 // Leia o layout e escreva as variáveis uma só vez por frame, mesmo com mouse de 240 Hz.
 if(heroMotionFrame)return;
 heroMotionFrame=requestAnimationFrame(()=>{
  heroMotionFrame=0;
  const state=heroMotionInput;
  if(!state?.hero?.isConnected||sheetMotionOff())return;
  const rect=state.hero.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const dx=(state.x-rect.left)/rect.width-.5,dy=(state.y-rect.top)/rect.height-.5;
  state.hero.style.setProperty('--tilty',dx*7+'deg');
  state.hero.style.setProperty('--tiltx',-dy*6+'deg');
 });
},{passive:true});
document.addEventListener('pointerout',e=>{
 const hero=e.target.closest?.('#character');
 if(hero&&!hero.contains(e.relatedTarget)){
  if(heroMotionFrame){cancelAnimationFrame(heroMotionFrame);heroMotionFrame=0}
  heroMotionInput=null;
  hero.style.setProperty('--tilty','0deg');
  hero.style.setProperty('--tiltx','0deg');
 }
})}
function background(){
 const canvas=el('energy');if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 let w=0,h=0,t=0,items=[],lastDraw=0,wasVisible=false,frameId=0,lastPaletteRead=0,cold='#4CC9F0',warm='#FF7A1A';
 function resize(){
  const d=Math.min(devicePixelRatio||1,1.5);
  w=innerWidth;h=innerHeight;canvas.width=Math.floor(w*d);canvas.height=Math.floor(h*d);
  ctx.setTransform(d,0,0,d,0,0);
  items=Array.from({length:Math.min(24,Math.floor(w/45))},(_,i)=>({
   x:Math.random()*w,y:Math.random()*h,v:.25+Math.random()*.6,r:Math.random()*1.4+.25,orange:i%5===0
  }));
 }
 function active(){return !document.hidden&&page!=='home'&&prefs.energy&&!motionOff()}
 function refresh(){
  if(!active()){
   if(frameId){cancelAnimationFrame(frameId);frameId=0}
   if(wasVisible){ctx.clearRect(0,0,w,h);wasVisible=false}
   return;
  }
  if(!frameId)frameId=requestAnimationFrame(frame);
 }
 function frame(now){
  frameId=0;
  if(!active()){refresh();return}
  frameId=requestAnimationFrame(frame);
  if(now-lastDraw<1000/(page==='sheets'?12:24))return;
  lastDraw=now;wasVisible=true;t++;
  ctx.clearRect(0,0,w,h);
  if(now-lastPaletteRead>750){
   const style=getComputedStyle(document.documentElement);
   cold=style.getPropertyValue('--theme-cold').trim()||'#4CC9F0';
   warm=style.getPropertyValue('--theme-accent').trim()||'#FF7A1A';
   lastPaletteRead=now;
  }
  for(const p of items){
   p.y-=p.v;if(p.y<-8){p.y=h+8;p.x=Math.random()*w}
   ctx.beginPath();ctx.fillStyle=p.orange?warm:cold;ctx.globalAlpha=p.orange?.72:.22;
   ctx.arc(p.x+Math.sin(t*.007+p.y*.012)*12,p.y,p.r,0,7);ctx.fill();
  }
  ctx.globalAlpha=.13;ctx.strokeStyle=cold;ctx.lineWidth=.7;
  for(let i=0;i<4;i++){
   ctx.beginPath();
   for(let x=0;x<w+20;x+=16){
    const y=h*(.15+i*.22)+Math.sin(x*.007+t*.007+i)*18;
    if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)
   }
   ctx.stroke();
  }
  ctx.globalAlpha=1;
 }
 window.addEventListener('resize',()=>{resize();refresh()},{passive:true});
 document.addEventListener('visibilitychange',refresh);
 try{matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',refresh)}catch(e){}
 window.__refreshBackground=refresh;
 resize();refresh();
}
async function init(){await migrateLegacyKeys();db.site??={};db.site.defaultPalette??='zangetsu';db.rules??=[];db.sheets??=[];db.sheets.forEach(s=>{s.conditions??=[];s.abilities??=[];s.inventory??={items:[],currencies:[]}});if(role!=='guest'&&!db.keys.some(k=>k.id===keyOwnerId&&k.active)){role='guest';keyOwnerId='';DATASTORE.clearRole()}soundOn=effectiveEffectsVolume()>0;musicMuted=!!(prefs.musicMuted||prefs.masterMuted);applyPrefs();try{setMusicSource()}catch(e){}if(prefs.hudMinimized){el('music').classList.add('compact-hud');const b=el('hudToggle');b.textContent='▴';b.setAttribute('aria-expanded','false')}const audioTab=el('sidebarAudio');if(audioTab)audioTab.setAttribute('aria-expanded',String(!prefs.hudMinimized));bindEvents();render();background();if(DATASTORE.blocked)storageWarning();el('audio').addEventListener('ended',()=>{musicOn=false;updateMusicUi()});el('audio').addEventListener('error',()=>{if(musicOn){musicOn=false;updateMusicUi()}})}
window.ARQUIVO_INTERNAL={setPage,get page(){return page},get db(){return db},get prefs(){return prefs},get currentSheet(){return currentSheet},get role(){return isPlayerPreview()?'player':role},get editorDraft(){return editorDraft},canEditSheet,master,save,cacheOnly:()=>DATASTORE.save(db),render,toast,redrawSheetForm:drawSheetForm,modal,historyHtml,dataUrlOk,mediaSrc,sheetRich,formatBook,esc,btn,headline,closeModal,confirmSite,uid,resetLibraryState:()=>{query='';libraryActiveChapterId=null},conditionsCatalog:CONDITIONS_CATALOG};
init();
if(window.ARQUIVO_SYNC?.state.configured)window.ARQUIVO_SYNC.init();
