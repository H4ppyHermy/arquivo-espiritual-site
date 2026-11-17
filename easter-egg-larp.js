(() => {
  'use strict';
  const selector='[data-larp-egg]';
  const normal='SUA JORNADA COMEÇA AQUI';
  const secret='SEU LARP COMEÇA AGORA';
  const track='assets/larp-easter-egg.mp3';
  const player=new Audio();
  player.loop=true;
  player.preload='none';
  player.volume=.7;
  let phase=0; // 0: escondido, 1: revelado, 2: tocando
  let clicks=0,previousClick=0,requestId=0;

  function sync(){
    const button=document.querySelector(selector);
    if(!button)return;
    const caption=button.querySelector('.ae-larp-caption');
    const text=phase===0?normal:secret;
    if(caption&&caption.textContent!==text)caption.textContent=text;
    button.classList.toggle('is-armed',phase!==0);
    button.classList.toggle('is-playing',phase===2);
    button.setAttribute('aria-pressed',String(phase===2));
  }

  function stop(){
    ++requestId;
    player.pause();
    try{player.currentTime=0}catch{}
    phase=0;
    clicks=0;
    previousClick=0;
    sync();
  }

  function activate(){
    if(phase===2){stop();return}
    if(phase===0){
      const now=performance.now();
      clicks=previousClick&&now-previousClick<=1400?clicks+1:1;
      previousClick=now;
      if(clicks===3){phase=1;clicks=0;sync()}
      return;
    }
    if(!player.src)player.src=track;
    const id=++requestId;
    phase=2;
    sync();
    try{
      Promise.resolve(player.play()).then(()=>{
        if(id!==requestId&&phase!==2)player.pause();
      },()=>{
        if(id!==requestId||phase!==2)return;
        player.pause();
        phase=1;
        sync();
      });
    }catch{
      if(id===requestId){
        phase=1;
        sync();
      }
    }
  }

  document.addEventListener('click',event=>{
    if(event.target?.closest?.(selector))activate();
  });
  const root=document.getElementById('page');
  // A pagina eh renderizada novamente ao mudar de aba. Preserva o estado.
  if(root&&typeof MutationObserver!=='undefined'){
    new MutationObserver(sync).observe(root,{childList:true});
  }
  sync();
})();
