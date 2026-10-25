/* MATCH ARCADE v1: classroom-friendly holographic memory board.
   Rendering only, except teacher-authorized Memory Boost preview. */
function matchArcadePreviewActive(run=state.activityRun){
  return Number(run?.match?.previewUntil||0)>Date.now();
}
function matchArcadePlayerArt(name,run=state.activityRun){
  const st=connectedStudents().find(x=>x.n===name);
  const snapshot=run?.match?.avatarImages?.[name]||'';
  if(!st&&!snapshot)return '<span class="ma-avatar">✦</span>';
  const a=st?avatarAsset(st.avatarKey):null;
  const key=String(st?.avatarKey||''),custom=key.startsWith('custom_');
  const image=snapshot||(custom?a?.image:'');
  const valid=typeof image==='string'&&/^data:image\/(?:webp|png|jpeg);base64,/.test(image)&&image.length<430000;
  const art=valid?'<img src="'+esc(image)+'" alt="">':esc(a?.glyph||'🤖');
  return '<span class="ma-avatar" style="--ma-avatar-color:'+esc(a?.color||st?.c||'#6de4ff')+'" aria-hidden="true">'+art+'</span>';
}
function matchArcadeAvatarSnapshot(students){
  const images={};
  students.forEach(st=>{
    const key=String(st.avatarKey||'');
    if(!key.startsWith('custom_'))return;
    const source=customAvatarAssets.find(a=>a.key===key)?.image||'';
    if(/^data:image\/(?:webp|png|jpeg);base64,/.test(source)&&source.length<430000)images[st.n]=source;
  });
  return images;
}
function matchArcadeGridColumns(cards){
  const n=(cards||[]).length;
  return n<=8?4:n<=16?4:n<=20?5:6;
}
/* Local-only display state: flip entrances play once when an actual selection
   changes, never on periodic synchronized rerenders. New runs reset the key. */
const matchArcadeFlipHistory=new Map();
function matchArcadeFreshReveals(run,view){
 const token=String(run?.runToken||''),selected=new Set(run?.match?.selected||[]);
 const before=matchArcadeFlipHistory.get(view);
 matchArcadeFlipHistory.set(view,{token,selected});
 if(!before||before.token!==token)return new Set();
 return new Set([...selected].filter(id=>!before.selected.has(id)));
}
function matchArcadeTile(card,index,match,{student=false,canPick=false,preview=false,freshReveals=null}={}){
  const matched=(match.matched||[]).includes(card.id);
  const flipped=(match.selected||[]).includes(card.id);
  const visible=matched||flipped||preview;
  const classes=['ma-tile',visible?'is-open':'is-hidden',matched?'is-matched':'',flipped?'is-selected':'',
    preview&&!matched&&!flipped?'is-preview':'',flipped&&freshReveals?.has(card.id)?'is-fresh-flip':''].filter(Boolean).join(' ');
  const label=visible?(matched?'Matched card ':preview?'Memory preview card ':'Revealed card '):'Hidden card ';
  const inside='<span class="ma-tile-face ma-tile-back"><span class="ma-tile-stars" aria-hidden="true">✦</span><b>'+String(index+1)+'</b><small>SECTOR '+String(index+1).padStart(2,'0')+'</small></span>'+
    (visible?'<span class="ma-tile-face ma-tile-front">'+contentMarkup(card.content)+(matched?'<span class="ma-tile-found" aria-hidden="true">✓ MATCH</span>':'')+'</span>':'');
  return student?
    '<button type="button" class="'+classes+'" data-match-pick="'+esc(card.id)+'" aria-label="'+label+String(index+1)+'" '+(!canPick||visible?'disabled':'')+'>'+inside+'</button>':
    '<div class="'+classes+'">'+inside+'</div>';
}
/* Phase 4P-C: upcoming turn is read-only and follows the native rotation. */
function matchArcadeHandoff(run=state.activityRun){
 const m=run?.match||{},cfg=run?.matchConfig||{},crew=connectedStudents();
 const p=m.pendingResolution;
 const complete=!!(m.complete||p?.result==='match'&&(m.cards||[]).length>0&&
   (m.matched||[]).length>=(m.cards||[]).length);
 if(!p||complete||!crew.length)return {name:'',team:'',again:false,complete};
 if(p.result==='match'&&cfg.turnRule==='match_go_again')
  return {name:matchActiveStudent(run)?.n||'',team:cfg.mode==='teams'?matchTeamMeta(m.activeTeam).name:'',
   again:true,complete:false};
 if(cfg.mode!=='teams'){
  const i=((Number(m.activeStudentIndex||0)+1)%crew.length+crew.length)%crew.length;
  return {name:crew[i]?.n||'',team:'',again:false,complete:false};
 }
 const count=Math.max(2,Math.min(4,Number(cfg.teamCount||3))),current=((Number(m.activeTeam||0)%count)+count)%count;
 for(let step=1;step<=count;step++){
  const team=(current+step)%count,members=matchTeamMembers(team,run);
  if(!members.length)continue;
  const i=Number(m.teamPlayerIndexes?.[team]||0)+(team===current?1:0);
  return {name:members[i%members.length]?.n||'',team:matchTeamMeta(team).name,again:false,complete:false};
 }
 return {name:'',team:'',again:false,complete:false};
}
function matchArcadeMissCards(m){
 const cards=m?.cards||[],ids=m?.pendingResolution?.cards||[];
 const nums=ids.map(id=>cards.findIndex(c=>c.id===id)+1).filter(n=>n>0);
 return nums.length===2?'cards '+nums[0]+' and '+nums[1]:'both cards';
}
function matchArcadeStatus(match,run){
  if(match.complete)return {type:'victory',title:'ALL SIGNALS MATCHED!',detail:'Every pair has been discovered'};
  if(matchArcadePreviewActive(run))return {type:'preview',title:'MEMORY BOOST',detail:'Study the locations! Cards hide in a moment'};
  if(match.pendingResolution){
  const turn=matchArcadeHandoff(run);
  const next=turn.complete?'Last pair':turn.again?'Same player goes again':turn.name?'Next: '+turn.name:'Next turn';
  return match.pendingResolution.result==='match'?
   {type:'matched',title:'PAIR FOUND!',detail:
    (run?.matchConfig?.scoring==='no_score'?'Great memory':'Point added automatically')+' · '+next}:
   {type:'miss',title:'REMEMBER THESE CARDS',detail:
    'No match · remember '+matchArcadeMissCards(match)+' · '+next};
 }
 if(match.locked)return {type:'hold',title:'MISSION CONTROL HOLD',detail:'The teacher has paused selections'};
  return {type:'ready',title:'FIND THE MATCH',detail:'Flip two cards and remember their locations'};
}
function matchArcadeScoreline(match,run){
  const cfg=run.matchConfig||{};
  if(cfg.scoring==='no_score')return '<span class="ma-score-chip">◈ CREW MEMORY · NO POINTS</span>';
  if(cfg.mode==='teams')return Array.from({length:Number(cfg.teamCount||3)},(_,i)=>
    '<span class="ma-score-chip '+(i===Number(match.activeTeam||0)?'active':'')+'">'+matchTeamMeta(i).icon+' '+esc(matchTeamMeta(i).name)+' <b>'+Number(match.teamScores?.[i]||0)+'</b></span>').join('');
  return connectedStudents().slice(0,8).map(st=>
    '<span class="ma-score-chip">'+esc(st.n)+' <b>'+Number(match.scores?.[st.n]||0)+'</b></span>').join('');
}
/* End-of-round standings are derived from MATCH's authoritative scores.
   No-score mode displays participants rather than inventing a winner. */
function matchArcadeFinalStandings(match,run){
  const cfg=run?.matchConfig||{},unscored=cfg.scoring==='no_score';
  let entries=[];
  if(cfg.mode==='teams'){
    const count=Math.max(2,Math.min(4,Number(cfg.teamCount||3)));
    entries=Array.from({length:count},(_,i)=>({
      label:String(matchTeamMeta(i).name||'Team '+(i+1)),
      symbol:String(matchTeamMeta(i).icon||'✦'),
      score:Math.max(0,Number(match.teamScores?.[i]||0)||0)
    }));
  }else{
    const names=[...new Set([...connectedStudents().map(x=>String(x.n||'')),
      ...Object.keys(match.scores||{})].filter(Boolean))];
    entries=names.map(name=>({label:name,symbol:'✦',
      score:Math.max(0,Number(match.scores?.[name]||0)||0)}));
  }
  if(!unscored)entries.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
  const top=entries.slice(0,5);
  let previous=null,position=0;
  const rows=top.map((entry,i)=>{
    if(!unscored&&entry.score!==previous)position=i+1;
    previous=entry.score;
    return '<div class="ma-final-row '+(!unscored&&position===1?'is-leading':'')+'">'+
      '<span class="ma-final-rank">'+(unscored?'✦':String(position).padStart(2,'0'))+'</span>'+
      '<span class="ma-final-name">'+esc(entry.symbol)+' '+esc(entry.label)+'</span>'+
      '<span class="ma-final-points">'+(unscored?'CREW':' '+entry.score+' '+(entry.score===1?'PAIR':'PAIRS'))+'</span></div>';
  }).join('');
  const more=entries.length>top.length?
    '<p class="ma-final-more">+'+(entries.length-top.length)+(unscored?' additional crew members':' more · full results on teacher scoreboard')+'</p>':'';
  const total=Math.floor((match.cards||[]).length/2),found=Math.floor((match.matched||[]).length/2);
  const tries=Math.max(0,Number(match.attempts||0));
  const metrics='<div class="ma-4pb-final-summary" aria-label="MATCH final round statistics">'+
   '<span><b>'+found+' / '+total+'</b> PAIRS FOUND</span>'+
   '<span><b>'+tries+'</b> ATTEMPTS</span></div>';
  return '<div class="ma-final-results" data-mode="'+(unscored?'memory':cfg.mode==='teams'?'teams':'individual')+'">'+
    '<div class="ma-final-heading">'+(unscored?'CREW MEMORY MISSION':'FINAL STANDINGS')+'</div>'+
    metrics+'<div class="ma-final-rows">'+(rows||'<p class="ma-final-more">Crew mission completed.</p>')+'</div>'+more+'</div>';
}
/* Phase 3I visual phase is derived exclusively from native MATCH state. */
function matchArcadePresentationPhase(m,run){
 if(m.complete)return 'complete';
 if(matchArcadePreviewActive(run))return 'preview';
 if(m.pendingResolution)return m.pendingResolution.result==='match'?'matched':'miss';
 if(m.locked)return 'hold';
 return (m.selected||[]).length===1?'second-card':'choose';
}
function matchArcadeShared(run=state.activityRun,big=false){
  const m=run?.match||{},cfg=run?.matchConfig||{},cards=m.cards||[],active=matchActiveStudent(run);
  const preview=matchArcadePreviewActive(run),status=matchArcadeStatus(m,run),matched=(m.matched||[]).length/2,pairs=cards.length/2;
  const cols=matchArcadeGridColumns(cards);
  const freshReveals=matchArcadeFreshReveals(run,big?'projector':'teacher-preview');
  const team=cfg.mode==='teams'?matchTeamMeta(m.activeTeam):null;
  // Decorative, pointer-transparent state accents. The existing status banner
  // remains the accessible announcer and native MATCH retains all scoring.
  const celebration=status.type==='matched'?
    '<div class="ma-stage-celebration ma-stage-pair" aria-hidden="true"><span class="ma-pair-streaks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="ma-celebration-sparks">✦ &nbsp; ✧ &nbsp; ✦</span><strong>PAIR FOUND!</strong><small>'+ (cfg.scoring==='no_score'?'MEMORY MISSION · WELL DONE':'AUTOMATIC POINT AWARDED') +'</small><span class="ma-4pb-pair-credit">'+esc(m.pendingResolution?.player||active?.n||'THE CREW')+'</span></div>':
    status.type==='victory'?
    '<div class="ma-stage-celebration ma-stage-victory" role="region" aria-label="MATCH final standings"><span class="ma-victory-halo" aria-hidden="true"><i></i><i></i><i></i></span><span class="ma-celebration-sparks">✦ &nbsp; ★ &nbsp; ✦</span><span class="ma-celebration-trophy">🏆</span><strong>MISSION COMPLETE</strong><small>'+matched+' OF '+pairs+' PAIRS DISCOVERED</small>'+matchArcadeFinalStandings(m,run)+'</div>':'';
  return '<div class="ma-game ma-shared '+(big?'ma-present':'ma-compact')+' ma-status-'+status.type+' ma-phase4i" data-turn-phase="'+matchArcadePresentationPhase(m,run)+'">'+
    '<div class="ma-cosmos" aria-hidden="true"><span class="ma-planet ma-planet-one"></span><span class="ma-planet ma-planet-two"></span><span class="ma-space-grid"></span></div>'+
    '<header class="ma-header"><div class="ma-brand"><span class="ma-brand-icon">✦</span><span>MISSION <b>MATCH</b></span></div><span class="ma-round-label">MEMORY CHALLENGE</span></header>'+
    '<div class="ma-topline"><div class="ma-turn-identity">'+matchArcadePlayerArt(active?.n||'',run)+
    '<div><small>CURRENT NAVIGATOR'+(team?' · '+esc(team.name.toUpperCase()):'')+'</small><strong>'+esc(active?.n||'Awaiting player')+'</strong></div></div>'+
    '<div class="ma-counter-strip"><span><b>'+matched+'</b> / '+pairs+' <small>PAIRS FOUND</small></span><span><b>'+Number(m.attempts||0)+'</b> <small>TRIES</small></span></div></div>'+
    '<div class="ma-signal ma-signal-'+status.type+'" aria-live="polite" aria-atomic="true"><span class="ma-signal-icon" aria-hidden="true">'+({victory:'🏆',preview:'◉',matched:'✦',miss:'↶',hold:'Ⅱ',ready:'◇'}[status.type])+'</span><div><strong>'+esc(status.title)+'</strong><span>'+esc(status.detail)+'</span></div></div>'+
    '<div class="ma-board-wrap"><div class="ma-board-surround"><div class="ma-grid" role="group" aria-label="Memory board" style="--ma-cols:'+cols+'">'+cards.map((card,i)=>
      matchArcadeTile(card,i,m,{preview,freshReveals})).join('')+'</div>'+celebration+'</div></div>'+
    '<div class="ma-bottomline"><div class="ma-progress"><span>MISSION PROGRESS</span><div class="ma-progress-track"><i style="width:'+(pairs?Math.min(100,Math.round(matched/pairs*100)):0)+'%"></i></div></div>'+
    '<div class="ma-log">⌁ '+esc(m.message||'Find the hidden pairs.')+'</div></div>'+
    '<div class="ma-scoreboard">'+matchArcadeScoreline(m,run)+'</div>'+
    '</div>';
}
function matchArcadeStudent(run=state.activityRun,student=selectedStudent()){
  const m=run?.match||{},cfg=run?.matchConfig||{},cards=m.cards||[],active=matchActiveStudent(run);
  const mine=active?.n===student?.n,preview=matchArcadePreviewActive(run),matched=(m.matched||[]).length/2;
  const status=matchArcadeStatus(m,run),cols=matchArcadeGridColumns(cards);
  const freshReveals=matchArcadeFreshReveals(run,'student-'+String(student?.n||'anonymous'));
  const density=cards.length<=16?'standard':cards.length<=32?'dense':'maximum';
  // Legacy compact CSS forces four columns !important. Give large sets one
  // scoped inline override so the 440px student companion stays usable.
  // Small windows retain wider tap targets instead of squeezing six cards.
  const studentCols=cards.length<=16?cols:
    innerWidth<350?4:innerWidth<390?5:cards.length<=32?5:6;
  const studentGridStyle='--ma-cols:'+cols+';'+(cards.length>16?
    'grid-template-columns:repeat('+studentCols+',minmax(0,1fr))!important;':'');
  const teamIndex=cfg.mode==='teams'?matchTeamIndexForStudent(student?.n,run):-1;
  const teamName=cfg.mode==='teams'?matchTeamMeta(m.activeTeam).name:'';
  const viewerTeam=cfg.mode==='teams'&&teamIndex>=0?matchTeamMeta(teamIndex).name:'';
  const handoff=matchArcadeHandoff(run),missCards=matchArcadeMissCards(m);
  const nextCue=handoff.complete?'Round complete':handoff.again?'Same player goes again':
    handoff.name?'Next: '+handoff.name:'Waiting for next player';
  const earnedPairs=cfg.mode==='teams'?Number(m.teamScores?.[teamIndex]||0):Number(m.scores?.[student?.n]||0);
  const canPick=mine&&!preview&&!m.locked&&!m.complete&&!m.pendingResolution&&(m.selected||[]).length<2;
  const turn=m.complete?'MISSION COMPLETE':preview?'MEMORIZE THE BOARD':
   m.pendingResolution?.result==='miss'?'NOT A MATCH':
   m.pendingResolution?.result==='match'?'PAIR FOUND!':
   mine?'YOUR TURN, '+esc(student?.n||'PILOT')+'!':'WATCH '+esc(active?.n||'THE PLAYER');
  const instruction=m.complete?'Every pair has been found!':preview?'Look closely. The cards will flip back automatically.':
   m.pendingResolution?.result==='match'?(cfg.scoring==='no_score'?'Great memory!':'Point added automatically!')+' '+nextCue+'.':
   m.pendingResolution?.result==='miss'?'Remember '+missCards+'. '+nextCue+'.':
   mine?(m.selected?.length===1?'Find the second card.':'Choose your first card.'):
   cfg.mode==='teams'&&viewerTeam===teamName?'Watch and support your teammate.':
   'Watch the current navigator and remember card locations.';
  const chosen=(m.selected||[]).length;
  const guideText=m.complete?'All pairs found':preview?'Study the locations':
   m.pendingResolution?.result==='match'?(cfg.scoring==='no_score'?'✓ Pair found!':'✓ Pair found · +1 automatically'):
   m.pendingResolution?.result==='miss'?'Different cards · remember '+missCards:
   m.locked?'Wait for your teacher':
   m.consult?.open&&cfg.mode==='teams'&&viewerTeam===teamName&&!mine?'Suggest a card for your team':
   mine?(chosen===1?'Pick your second card':'Pick your first card'):
   cfg.mode==='teams'&&viewerTeam===teamName?'Support your teammate':'Watch the current player';
  const turnGuide='<div class="ma-4i-turn-guide" role="status" aria-live="polite">'+
   '<div><span class="ma-4i-guide-icon" aria-hidden="true">'+
    (mine&&!m.complete&&!m.locked?'✦':'◉')+'</span>'+
    '<strong>'+guideText+'</strong></div>'+
   '<div class="ma-4i-guide-steps" aria-label="'+chosen+' cards chosen">'+
    '<span class="'+(chosen>=1?'is-done':'')+'" aria-hidden="true">1</span>'+
    '<i aria-hidden="true"></i><span class="'+(chosen>=2?'is-done':'')+'" aria-hidden="true">2</span></div></div>';
  const consult=cfg.crewConsult&&mine&&m.selected?.length===1&&!m.consult?.open?'<button class="ma-consult-btn" id="matchAskCrewBtn">◉ ASK MY CREW</button>':'';
  const consultGroup=m.consult?.open&&cfg.mode==='teams'&&matchTeamIndexForStudent(student?.n,run)===Number(m.activeTeam)&&!mine?
    '<div class="ma-consult-box"><b>CREW CONSULT</b><p>Suggest the second card for '+esc(active?.n||'your teammate')+'</p><div class="ma-consult-grid">'+
    cards.map((card,i)=>'<button data-match-consult-pick="'+esc(card.id)+'" '+((m.matched||[]).includes(card.id)||(m.selected||[]).includes(card.id)?'disabled':'')+'>'+String(i+1)+'</button>').join('')+'</div></div>':'';
  const suggestions=m.consult?.open&&mine?'<div class="ma-consult-box"><b>CREW SUGGESTIONS</b><p>'+esc(matchConsultAggregate(run).map(x=>'Card '+x.number+' ×'+x.count).join(' · ')||'Waiting for your crew…')+'</p><button id="matchCloseConsultBtn">Close Consult</button></div>':'';
  return '<div class="ma-game ma-student ma-phase4i-student ma-status-'+status.type+'" data-ma-density="'+density+'" data-turn-phase="'+matchArcadePresentationPhase(m,run)+'">'+
    '<div class="ma-cosmos" aria-hidden="true"><span class="ma-planet ma-planet-one"></span><span class="ma-space-grid"></span></div>'+
    '<div class="ma-student-heading"><div class="ma-student-pilot">'+matchArcadePlayerArt(active?.n||'',run)+'<span>CURRENT NAVIGATOR'+(cfg.mode==='teams'?' · '+esc(teamName.toUpperCase()):'')+'</span></div><span class="ma-eyebrow">✦ MOTHERSHIP · MATCH</span><h2 aria-live="polite">'+turn+'</h2><p>'+instruction+'</p></div>'+
    '<div class="ma-student-status"><span class="ma-phase-pill" aria-hidden="true">'+
      ({complete:'★ COMPLETE',preview:'◉ PREVIEW',matched:'✦ MATCH',miss:'↶ TRY AGAIN',hold:'Ⅱ ON HOLD','second-card':mine?'◇ SECOND CARD':'◉ WATCH',choose:mine?'◇ YOUR TURN':'◉ WATCH'}[matchArcadePresentationPhase(m,run)])+'</span><span class="ma-4i-pairs">◈ <b>'+matched+' / '+(cards.length/2)+'</b> PAIRS</span><span class="ma-4i-attempts">◎ <b>'+Number(m.attempts||0)+'</b> TRIES</span><span class="ma-student-earned">'+(cfg.scoring==='no_score'?'◈ MEMORY MODE':cfg.mode==='teams'?'★ <b>'+earnedPairs+'</b> TEAM PAIRS':'★ <b>'+earnedPairs+'</b> EARNED')+'</span></div>'+turnGuide+
    '<div class="ma-board-wrap"><div class="ma-board-surround"><div class="ma-grid" role="group" aria-label="MATCH cards" style="'+studentGridStyle+'">'+
    cards.map((card,i)=>matchArcadeTile(card,i,m,{student:true,canPick,preview,freshReveals})).join('')+'</div></div></div>'+
    (m.complete?'<div class="ma-student-final" role="status"><strong>✦ ALL '+matched+' PAIRS FOUND</strong><span>'+
      (cfg.scoring==='no_score'?'Crew memory challenge complete. Great teamwork.':cfg.mode==='teams'?
      esc(matchTeamMeta(teamIndex).name)+' · '+earnedPairs+' team '+(earnedPairs===1?'pair':'pairs'):
      esc(student?.n||'Crew member')+' · '+earnedPairs+' '+(earnedPairs===1?'pair':'pairs')+' found')+
      '</span></div>':'')+
    '<div class="ma-device-tip"><span class="ma-info-dot">i</span><span>'+esc(m.message||'Match the hidden signals.')+'</span></div>'+
    consult+consultGroup+suggestions+
    '<div class="ma-device-bottom">'+(cfg.mode==='teams'?esc(matchTeamMeta(teamIndex).name):'INDIVIDUAL ROTATION')+' · '+
    (cfg.scoring==='no_score'?'MEMORY MISSION':earnedPairs+' PAIRS FOUND')+'</div></div>';
}
let matchArcadeTimer=null,matchArcadeExpiry=0;
function matchArcadeRefreshAtExpiry(){
  const run=state.activityRun,until=run?.activityId==='match-game'?Number(run.match?.previewUntil||0):0;
  if(until<=Date.now()){
    if(matchArcadeTimer){clearTimeout(matchArcadeTimer);matchArcadeTimer=null;}
    matchArcadeExpiry=0;return;
  }
  if(until===matchArcadeExpiry&&matchArcadeTimer)return;
  if(matchArcadeTimer)clearTimeout(matchArcadeTimer);
  matchArcadeExpiry=until;
  matchArcadeTimer=setTimeout(()=>{
    matchArcadeTimer=null;matchArcadeExpiry=0;
    if(state.activityRun?.activityId==='match-game'&&Number(state.activityRun.match?.previewUntil||0)===until){
      renderPublic();if(SESSION_ROLE==='teacher')renderActivityController();
    }
  },Math.max(75,until-Date.now()+100));
}
function matchArcadeWireTeacher(){
  const panel=document.querySelector('#activityControllerPanel'),run=typeof state!=='undefined'?state.activityRun:null;
  if(panel&&run?.activityId==='match-game'){
   const card=panel.querySelector('.match-teacher-card'),grid=card?.querySelector('.match-control-grid');
   const m=run.match||{},total=(m.cards||[]).length/2,found=(m.matched||[]).length/2;
   if(card&&grid){
    card.classList.add('ma-4i-teacher');
    let hud=card.querySelector('.ma-4i-teacher-guide');
    if(!hud){
     hud=document.createElement('div');hud.className='ma-4i-teacher-guide';
     hud.innerHTML='<div class="ma-4i-teacher-guide-head"><span>MISSION PROGRESS</span><strong></strong></div>'+
      '<div class="ma-4i-teacher-track" role="progressbar" aria-label="Pairs matched" aria-valuemin="0"><i></i></div>'+
      '<div class="ma-4i-teacher-guidance" role="status"></div>';
     grid.before(hud);
    }
    hud.querySelector('strong').textContent=found+' of '+total+' PAIRS FOUND';
    const track=hud.querySelector('[role="progressbar"]');
    track.setAttribute('aria-valuemax',String(total));
    track.setAttribute('aria-valuenow',String(found));
    track.firstElementChild.style.width=(total?Math.round(found/total*100):0)+'%';
    const pending=m.pendingResolution,rotation=matchArcadeHandoff(run),held=!!m.pauseAfterReveal;
     const next=rotation.complete?'LAST PAIR · ROUND COMPLETE':
       rotation.again?'GO AGAIN · '+rotation.name:
       rotation.name?'UP NEXT · '+rotation.name+(rotation.team?' · '+rotation.team:''):'WAITING FOR PLAYERS';
     hud.querySelector('.ma-4i-teacher-guidance').textContent=m.complete?'All pairs found · choose what happens next':
       pending?.result==='match'?(run.matchConfig?.scoring==='no_score'?'✓ Correct pair · memory mode':'✓ Correct pair · +1 automatically')+
         (held?' · teacher-held reveal':' · auto-advance active'):
       pending?.result==='miss'?'No match · remember '+matchArcadeMissCards(m)+
         (held?' · press CONTINUE when ready':' · cards hide automatically'):
       m.teacherLocked?'Board locked · resume to allow selections':
       (m.selected||[]).length===1?'First card revealed · waiting for the second card':
       'Students select two cards · matching pairs score automatically';
     hud.dataset.maScorePhase=pending?.result==='match'?'matched':pending?.result==='miss'?'miss':
       m.complete?'complete':'ready';
     let handoff=hud.querySelector('.ma-4pc-handoff');
     if(!handoff){
      handoff=document.createElement('div');handoff.className='ma-4pc-handoff';
      handoff.innerHTML='<span>TURN HANDOFF</span><strong></strong>';hud.appendChild(handoff);
     }
     handoff.hidden=!pending&&!m.complete;
     handoff.querySelector('strong').textContent=m.complete?'MISSION COMPLETE':next;
     handoff.dataset.maHold=held?'held':'automatic';
    for(const [id,group] of Object.entries({
     matchContinueBtn:'resolve',matchMemoryPreviewBtn:'assist',
     matchLockBtn:'pause',matchPauseRevealBtn:'pause',
     matchUndoBtn:'correct',matchRetryBtn:'correct',matchReturnPairBtn:'correct',
     matchSkipBtn:'next',matchNextTeamBtn:'next'
    })){
     const b=grid.querySelector('#'+id);if(b)b.dataset.maActionGroup=group;
    }
   }
  }
  if(panel&&run?.activityId==='match-game'){
    const grid=panel.querySelector('.match-control-grid'),m=run.match||{};
    const pending=m.pendingResolution,continueBtn=grid?.querySelector('#matchContinueBtn');
    if(continueBtn){
      continueBtn.textContent=pending?(m.pauseAfterReveal?'▶ CONTINUE · NEXT TURN':'▶ ADVANCE NOW'):'CONTINUE';
      continueBtn.title=pending?(m.pauseAfterReveal?'Release held cards and continue':
        'Advance now or let MATCH advance automatically'):'Available after two revealed cards';
    }
    const pauseBtn=grid?.querySelector('#matchPauseRevealBtn');
    if(pauseBtn){
      pauseBtn.setAttribute('aria-pressed',m.pauseAfterReveal?'true':'false');
      pauseBtn.title=m.pauseAfterReveal?'Wait for CONTINUE after each pair':
        'Automatically advance after each pair unless paused';
    }
    for(const id of ['matchSkipBtn','matchNextTeamBtn']){
      const b=grid?.querySelector('#'+id);
      if(b&&pending){b.disabled=true;b.title='Wait for this pair to resolve';}
    }
  }
  const preview=document.querySelector('#matchMemoryPreviewBtn');
  if(preview)preview.onclick=()=>teacherMatchAction(matchArcadePreviewActive()?'preview_stop':'preview');
  // Valid matching pairs are already detected and scored by the server.
  // Retire the old manual MARK MATCH control so the same pair cannot be
  // credited twice from Mission Control while a reveal is resolving.
  const manual=document.querySelector('#matchMarkBtn');
  if(manual){
    const parent=manual.parentElement;
    manual.remove();
    if(parent&&!parent.querySelector('.ma-auto-score-indicator')){
      const badge=document.createElement('span');
      badge.className='ma-auto-score-indicator';
      badge.setAttribute('role','status');
      parent.appendChild(badge);
    }
  }
  const badge=document.querySelector('#activityControllerPanel .ma-auto-score-indicator');
  if(badge){
    const noScore=state.activityRun?.matchConfig?.scoring==='no_score';
    badge.textContent=noScore?'◈ MEMORY MODE · NO POINTS':'★ MATCHED PAIRS · AUTO +1 POINT';
    badge.title=noScore?'This activity is in no-score mode':
      'Every correct pair automatically adds one point to the student and their team (if enabled).';
  }
}
