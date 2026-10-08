/* COSMIC CARDS — original color/number matching game for SI Mothership.
 * Game state lives in activityRun.cosmic; teacher owns setup, server owns student actions.
 * Cards intentionally use original Cosmic branding, not official UNO artwork. */
let cosmicSelection = [];
let cosmicRosterKey = '';
let cosmicPendingWild = '';
let cosmicTeacherReveal = false;
const COSMIC_COLORS = ['red','blue','green','yellow'];
const COSMIC_COLOR_NAMES = {red:'RED',blue:'BLUE',green:'GREEN',yellow:'YELLOW',wild:'WILD'};
function cosmicNames(){return connectedStudents().map(s=>s.n).filter(Boolean)}
function cosmicSelectedNames(){
  const names=cosmicNames(),key=names.join('\u0001');
  if(key!==cosmicRosterKey){
    if(names.length<=8)cosmicSelection=names.slice();
    else cosmicSelection=cosmicSelection.filter(n=>names.includes(n)).slice(0,8);
    cosmicRosterKey=key;
  }
  return cosmicSelection;
}
function cosmicSetSelected(name){
  const names=cosmicNames(),chosen=cosmicSelectedNames();
  if(!names.includes(name))return;
  if(chosen.includes(name))cosmicSelection=chosen.filter(n=>n!==name);
  else if(chosen.length<8)cosmicSelection=chosen.concat([name]);
  else return toast('Eight players maximum. Deselect a seat first.');
  renderActivities();
}
function cosmicDeck(){
  const cards=[];
  const add=(color,value,count)=>{for(let i=0;i<count;i++)cards.push({id:'cc-'+cards.length,color,value})};
  COSMIC_COLORS.forEach(color=>{
    add(color,'0',1);
    for(let i=1;i<=9;i++)add(color,String(i),2);
    ['skip','reverse','draw2'].forEach(v=>add(color,v,2));
  });
  add('wild','wild',4);add('wild','wild4',4);
  for(let i=cards.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));const x=cards[i];cards[i]=cards[j];cards[j]=x;
  }
  return cards;
}
function cosmicCardLabel(c){
  if(!c)return '★';
  return ({skip:'⊘',reverse:'⇄',draw2:'+2',wild:'★',wild4:'+4'})[c.value]||c.value;
}
function cosmicPlayer(run=state.activityRun){
  const g=run?.cosmic;return g&&g.players?.length?g.players[g.turn%g.players.length]:null;
}
function cosmicActive(run=state.activityRun){return run?.cosmic||null}
function cosmicCanPlay(g,name,card){
  if(!g||g.status!=='playing'||g.players[g.turn]!==name||g.drawnId&&g.drawnId!==card.id)return false;
  if(card.color==='wild'){
    return card.value!=='wild4'||!(g.hands[name]||[]).some(c=>c.color===g.color);
  }
  const top=g.discard[g.discard.length-1];
  return card.color===g.color||!!top&&card.value===top.value;
}
function cosmicDrawFromDeck(g,n=1){
  const cards=[];
  for(let i=0;i<n;i++){
    if(!g.deck.length&&g.discard.length>1){
      const top=g.discard.pop(),reshuffle=g.discard.splice(0);
      for(let j=reshuffle.length-1;j>0;j--){
        const k=Math.floor(Math.random()*(j+1));const t=reshuffle[j];reshuffle[j]=reshuffle[k];reshuffle[k]=t;
      }
      g.deck=reshuffle;g.discard.push(top);
    }
    if(!g.deck.length)break;
    cards.push(g.deck.pop());
  }
  return cards;
}
function cosmicAdvance(g,steps=1){
  const size=g.players.length;
  g.turn=(g.turn+(g.direction===-1?-1:1)*steps%size+size*8)%size;
  g.drawnId='';
}
function cosmicApplyLocal(type,value='',color='',name=''){
  const g=cosmicActive();if(!g||g.status!=='playing')return false;
  if(!g.players.includes(name))return false;
  const hand=g.hands[name]||[];
  if(type==='cosmic'){
    if(hand.length!==1||g.called[name])return false;
    g.called[name]=true;g.message=name+' called COSMIC! One card left!';return true;
  }
  if(cosmicPlayer()!==name)return false;
  if(type==='pass'){
    if(!g.drawnId)return false;
    g.message=name+' kept the drawn card and passed.';
    cosmicAdvance(g);return true;
  }
  if(type==='draw'){
    if(g.drawnId)return false;
    const drawn=cosmicDrawFromDeck(g,1);
    if(!drawn.length){g.message='The draw pile is empty. Turn passed.';cosmicAdvance(g);return true}
    hand.push(...drawn);
    g.drawnId=drawn[0].id;
    if(!cosmicCanPlay(g,name,drawn[0])){g.message=name+' drew one card. Next player.';cosmicAdvance(g)}
    else g.message=name+' drew a playable card. Play it or pass.';
    return true;
  }
  if(type!=='play')return false;
  const idx=hand.findIndex(c=>c.id===value);if(idx<0)return false;
  const card=hand[idx];if(!cosmicCanPlay(g,name,card))return false;
  if(card.color==='wild'&&!COSMIC_COLORS.includes(color))return false;
  hand.splice(idx,1);g.discard.push(card);g.color=card.color==='wild'?color:card.color;
  g.called[name]=false;g.drawnId='';
  g.message=name+' played '+COSMIC_COLOR_NAMES[card.color]+' '+cosmicCardLabel(card)+'.';
  if(!hand.length){g.status='won';g.winner=name;g.message=name+' wins COSMIC CARDS!';return true}
  if(card.value==='reverse'){
    g.direction*=-1;
    cosmicAdvance(g,g.players.length===2?2:1);
  }else if(card.value==='skip')cosmicAdvance(g,2);
  else if(card.value==='draw2'||card.value==='wild4'){
    cosmicAdvance(g,1);const target=cosmicPlayer();
    g.hands[target].push(...cosmicDrawFromDeck(g,card.value==='draw2'?2:4));
    g.message+=' '+target+' draws '+(card.value==='draw2'?'2':'4')+' and misses a turn.';
    cosmicAdvance(g,1);
  }else cosmicAdvance(g);
  return true;
}
function cosmicLaunch(){
  const names=cosmicSelectedNames().filter(n=>cosmicNames().includes(n)).slice(0,8);
  if(names.length<2)return toast('Select at least two connected players.');
  const deck=cosmicDeck(),hands={};
  names.forEach(n=>{hands[n]=cosmicDrawFromDeck({deck,discard:[]},7)});
  let initial=null;
  while(deck.length){
    const c=deck.pop();if(c.color!=='wild'&&!['skip','reverse','draw2'].includes(c.value)){initial=c;break}
    deck.unshift(c);
  }
  if(!initial)return toast('Could not prepare the deck.');
  state.activityRun={
    activityId:'cosmic-cards-game',runToken:newActivityRunToken(),
    phase:'lobby',responses:{},cosmic:{
      players:names,hands,deck,discard:[initial],color:initial.color,
      turn:0,direction:1,drawnId:'',called:{},winner:null,status:'playing',
      round:1,message:'Players assigned. Start when the class is ready.'
    }
  };
  state.screen='activity';state.promptActive=false;state.assigningSlot=null;
  cosmicPendingWild='';recordActivityLaunch('cosmic-cards','COSMIC CARDS');
  render();toast('COSMIC CARDS loaded — '+names.length+' players, '+Math.max(0,cosmicNames().length-names.length)+' in the audience');
}
function cosmicNewRound(){
  const run=state.activityRun;if(!run||!run.cosmic)return;
  const names=(run.cosmic.players||[]).filter(n=>cosmicNames().includes(n));
  if(names.length<2)return toast('At least two assigned players must be connected.');
  cosmicSelection=names.slice();cosmicRosterKey=cosmicNames().join('\u0001');
  cosmicLaunch();
}
function cosmicReturnToSelection(){
  if(!state.activityRun||activeActivity()?.type!=='cosmic-cards')return;
  cosmicSelection=state.activityRun.cosmic?.players?.filter(n=>cosmicNames().includes(n))||[];
  cosmicRosterKey=cosmicNames().join('\u0001');
  state.activityRun=null;state.activeApp='cosmic-cards';state.screen='activities';render();
}
function cosmicSetupMarkup(){
  const names=cosmicNames(),selected=cosmicSelectedNames(),audience=names.filter(n=>!selected.includes(n));
  const seats=selected.length;
  return '<div class="cc-setup">'+
    '<div class="cc-banner"><span class="app-status">REWARDS ARCADE · INDIVIDUAL MULTIPLAYER</span>'+
    '<h3>✦ COSMIC CARDS</h3><p>Match a color or number. Use action cards to change the game. Be the first to empty your hand!</p></div>'+
    '<div class="cc-setup-summary"><b>'+seats+' / 8 PLAYERS</b><span>'+audience.length+' audience · '+names.length+' connected</span></div>'+
    (names.length>8?'<div class="cc-note">More than eight students are connected. Select 2–8 players below; everyone else watches as the audience.</div>':
      '<div class="cc-note">Everyone can play when eight or fewer students are connected. Select at least two players.</div>')+
    '<div class="cc-roster">'+names.map(n=>
      '<button type="button" class="cc-seat '+(selected.includes(n)?'chosen':'')+'" data-cosmic-seat="'+esc(n)+'">'+
      '<span>'+(selected.includes(n)?'✓':'◉')+'</span><strong>'+esc(n)+'</strong><small>'+(selected.includes(n)?'PLAYER':'AUDIENCE')+'</small></button>'
    ).join('')+'</div>'+
    '<div class="cc-launch-row"><button class="primary-action" id="cosmicLaunchBtn" '+(seats<2?'disabled':'')+'>▶ LAUNCH '+seats+' PLAYER GAME</button>'+
    '<p>Seven cards per player · Private hands · Teacher can change players between rounds.</p></div></div>';
}
function cosmicWireSetup(){
  document.querySelectorAll('[data-cosmic-seat]').forEach(b=>b.onclick=()=>cosmicSetSelected(b.dataset.cosmicSeat));
  const launch=document.querySelector('#cosmicLaunchBtn');if(launch)launch.onclick=cosmicLaunch;
}
function cosmicCardMarkup(c,{disabled=false,small=false,back=false,selected=false}={}){
  if(back)return '<span class="cc-card cc-back'+(small?' small':'')+'"><i>✦</i><b>CC</b></span>';
  if(!c)return '<span class="cc-card cc-back">✦</span>';
  return '<span class="cc-card cc-'+c.color+(small?' small':'')+(disabled?' dim':'')+(selected?' selected':'')+'">'+
    '<small>'+cosmicCardLabel(c)+'</small><b>'+cosmicCardLabel(c)+'</b><small>'+cosmicCardLabel(c)+'</small></span>';
}
function cosmicTableMarkup(run=state.activityRun,big=false){
  const g=cosmicActive(run);if(!g)return '';
  const top=g.discard[g.discard.length-1],current=cosmicPlayer(run);
  const audience=cosmicNames().filter(n=>!g.players.includes(n));
  return '<div class="cc-public">'+
    '<div class="cc-table-head"><span>✦ COSMIC CARDS</span><span>ROUND '+Number(g.round||1)+'</span></div>'+
    (g.status==='won'?'<div class="cc-victory">🏆 '+esc(g.winner)+' WINS!</div>':
      '<div class="cc-turn">IT IS <b>'+esc(current||'—')+'</b>’S TURN</div>')+
    '<div class="cc-table-center"><div class="cc-deck"><span>DRAW PILE · '+g.deck.length+'</span>'+cosmicCardMarkup(null,{back:true})+'</div>'+
    '<div class="cc-live-card"><span>TOP CARD · '+COSMIC_COLOR_NAMES[g.color]+'</span>'+cosmicCardMarkup(top)+'</div></div>'+
    '<p class="cc-game-message">'+esc(g.message||'')+'</p>'+
    '<div class="cc-players">'+g.players.map(n=>'<div class="cc-player '+(n===current&&g.status==='playing'?'active':'')+(n===g.winner?' winner':'')+'">'+
      '<b>'+esc(n)+'</b><span>'+((g.counts&&g.counts[n]!==undefined)?g.counts[n]:(g.hands[n]||[]).length)+' CARDS</span>'+(g.called[n]?' <em>COSMIC!</em>':'')+
      (!cosmicNames().includes(n)?'<small>OFFLINE</small>':'')+'</div>').join('')+'</div>'+
    (audience.length?'<div class="cc-audience"><b>AUDIENCE · '+audience.length+'</b><span>'+audience.map(esc).join(' · ')+'</span></div>':'')+
  '</div>';
}
function cosmicStudentMarkup(s){
  const g=cosmicActive(),name=s?.n||'';
  if(!g)return '';
  if(!g.players.includes(name)){
    return '<div class="cc-device cc-spectator"><span class="eyebrow">COSMIC CARDS · AUDIENCE</span>'+
      '<h2>You are in the audience!</h2><p>Watch the game on the shared screen. Your classmates are playing this round.</p>'+
      '<div class="cc-spectator-info">'+esc(cosmicPlayer()||'—')+' is playing · '+g.players.length+' players</div></div>';
  }
  const hand=g.hands[name]||[],mine=cosmicPlayer()===name&&g.status==='playing';
  const top=g.discard[g.discard.length-1];
  return '<div class="cc-device"><span class="eyebrow">COSMIC CARDS · PRIVATE HAND</span>'+
    '<h2>'+(g.status==='won'?(g.winner===name?'🏆 YOU WIN!':esc(g.winner)+' WINS!'):
      mine?'YOUR TURN, '+esc(name)+'!':'WAITING FOR '+esc(cosmicPlayer()||'—'))+'</h2>'+
    '<div class="cc-device-status"><span>COLOR <b>'+COSMIC_COLOR_NAMES[g.color]+'</b></span>'+
      '<span>TOP '+cosmicCardLabel(top)+'</span><span>'+hand.length+' CARDS</span></div>'+
    '<div class="cc-hand">'+hand.map(c=>{
      const playable=mine&&cosmicCanPlay(g,name,c);
      return '<button type="button" class="cc-hand-button" data-cosmic-card="'+esc(c.id)+'" '+(playable?'':'disabled')+' aria-label="'+esc(COSMIC_COLOR_NAMES[c.color]+' '+cosmicCardLabel(c))+'">'+
        cosmicCardMarkup(c,{disabled:!playable})+'</button>';
    }).join('')+'</div>'+
    (cosmicPendingWild&&mine?
      '<div class="cc-choose-color"><h3>Choose your new color</h3><div>'+
      COSMIC_COLORS.map(c=>'<button type="button" class="cc-color-opt '+c+'" data-cosmic-color="'+c+'">'+COSMIC_COLOR_NAMES[c]+'</button>').join('')+
      '</div><button id="cosmicCancelWild">Cancel</button></div>':'')+
    (g.status==='playing'?'<div class="cc-device-actions">'+
      (mine?'<button id="cosmicDrawBtn" '+(g.drawnId?'disabled':'')+'>＋ DRAW ONE</button>'+
        (g.drawnId?'<button id="cosmicPassBtn">PASS</button>':''):'<span>Watch the shared screen while others take their turns.</span>')+
      (hand.length===1&&!g.called[name]?'<button class="cc-call-btn" id="cosmicCallBtn">✦ COSMIC!</button>':'')+
      '</div>':'')+
    '<p class="cc-help">Match the current color or top card symbol. Wild cards change the color. '+(mine?'Only your highlighted cards can be played.':'Your cards remain private on this device.')+'</p></div>';
}
function cosmicTeacherMarkup(){
  const g=cosmicActive(),run=state.activityRun;if(!g)return '';
  return '<div class="cc-controller"><div class="activity-controller-head"><div><span class="slide-badge instruction">COSMIC CARDS · MISSION CONTROL</span>'+
    '<h2>'+esc(g.status==='won'?(g.winner+' wins!'):'Individual Card Battle')+'</h2>'+
    '<p>'+esc(g.message||'')+'</p></div><div class="controller-stats"><b>'+g.players.length+'</b> players</div></div>'+
    '<div class="cc-teacher-content"><div>'+cosmicTableMarkup(run,false)+'</div><div class="cc-teacher-actions">'+
    '<h3>PLAYER CONTROL</h3><p>Active: <strong>'+esc(cosmicPlayer(run)||'—')+'</strong></p>'+
    '<button id="cosmicSkipBtn" '+(g.status!=='playing'?'disabled':'')+'>⏭ Skip Current Turn</button>'+
    '<button id="cosmicShowHandsBtn">'+(cosmicTeacherReveal?'Hide':'Show')+' Hands (Teacher Only)</button>'+
    (cosmicTeacherReveal?'<div class="cc-teacher-hands">'+g.players.map(n=>'<div><b>'+esc(n)+'</b><span>'+g.hands[n].map(c=>cosmicCardMarkup(c,{small:true})).join('')+'</span></div>').join('')+'</div>':'')+
    '<button class="primary-action" id="cosmicRematchBtn">↻ New Round · Same Players</button>'+
    '<button id="cosmicReselectBtn">♙ Change Player Assignment</button>'+
    '<div class="minefield-safety"><button id="returnClassBtn">✓ Finish & Return</button>'+
    '<button class="minefield-send-lobby" id="sendActivityLobbyBtn">Ⅱ Pause & Keep Progress</button>'+
    '<button class="danger-action" id="emergencyActivityBtn">⚠ Emergency Return</button></div></div></div></div>';
}
function cosmicSend(type,value='',color=''){
  const s=selectedStudent(),name=s?.n||'',run=state.activityRun;
  if(!run||run.phase!=='running'||!name)return;
  const request={id:'cosmic_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),
    runToken:run.runToken,type,value,color,at:Date.now()};
  cosmicPendingWild='';
  if(NETWORK_SYNC&&networkHydrated&&networkSocket&&networkSocket.readyState===WebSocket.OPEN){
    try{networkSocket.send(JSON.stringify({type:'cosmic_action',request,student_name:name,student_token:currentStudentIdentity()?.student_token||''}));return}catch(e){}
  }
  if(cosmicApplyLocal(type,value,color,name))render();
}
function cosmicWireStudent(){
  if(activeActivity()?.type!=='cosmic-cards'||state.activityRun?.phase!=='running')return;
  document.querySelectorAll('[data-cosmic-card]').forEach(b=>b.onclick=()=>{
    const g=cosmicActive(),s=selectedStudent(),card=(g?.hands[s?.n]||[]).find(c=>c.id===b.dataset.cosmicCard);
    if(!card)return;
    if(card.color==='wild'){cosmicPendingWild=card.id;render();return}
    cosmicSend('play',card.id,'');
  });
  document.querySelectorAll('[data-cosmic-color]').forEach(b=>b.onclick=()=>cosmicSend('play',cosmicPendingWild,b.dataset.cosmicColor));
  const cancel=document.querySelector('#cosmicCancelWild');if(cancel)cancel.onclick=()=>{cosmicPendingWild='';render()};
  const draw=document.querySelector('#cosmicDrawBtn');if(draw)draw.onclick=()=>cosmicSend('draw');
  const pass=document.querySelector('#cosmicPassBtn');if(pass)pass.onclick=()=>cosmicSend('pass');
  const call=document.querySelector('#cosmicCallBtn');if(call)call.onclick=()=>cosmicSend('cosmic');
}
function cosmicWireTeacher(){
  const rematch=document.querySelector('#cosmicRematchBtn');if(rematch)rematch.onclick=cosmicNewRound;
  const reselect=document.querySelector('#cosmicReselectBtn');if(reselect)reselect.onclick=cosmicReturnToSelection;
  const hands=document.querySelector('#cosmicShowHandsBtn');if(hands)hands.onclick=()=>{cosmicTeacherReveal=!cosmicTeacherReveal;render()};
  const skip=document.querySelector('#cosmicSkipBtn');if(skip)skip.onclick=()=>{
    const g=cosmicActive();if(!g||g.status!=='playing')return;
    const n=cosmicPlayer();cosmicAdvance(g);g.message='Teacher skipped '+n+'’s turn.';
    render();
  };
}
