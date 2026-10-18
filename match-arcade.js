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
function matchArcadeTile(card,index,match,{student=false,canPick=false,preview=false}={}){
  const matched=(match.matched||[]).includes(card.id);
  const flipped=(match.selected||[]).includes(card.id);
  const visible=matched||flipped||preview;
  const classes=['ma-tile',visible?'is-open':'is-hidden',matched?'is-matched':'',flipped?'is-selected':'',preview&&!matched&&!flipped?'is-preview':''].filter(Boolean).join(' ');
  const label=visible?(matched?'Matched card ':preview?'Memory preview card ':'Revealed card '):'Hidden card ';
  const inside='<span class="ma-tile-face ma-tile-back"><span class="ma-tile-stars" aria-hidden="true">✦</span><b>'+String(index+1)+'</b><small>SECTOR '+String(index+1).padStart(2,'0')+'</small></span>'+
    (visible?'<span class="ma-tile-face ma-tile-front">'+contentMarkup(card.content)+(matched?'<span class="ma-tile-found" aria-hidden="true">✓ MATCH</span>':'')+'</span>':'');
  return student?
    '<button type="button" class="'+classes+'" data-match-pick="'+esc(card.id)+'" aria-label="'+label+String(index+1)+'" '+(!canPick||visible?'disabled':'')+'>'+inside+'</button>':
    '<div class="'+classes+'">'+inside+'</div>';
}
function matchArcadeStatus(match,run){
  if(match.complete)return {type:'victory',title:'ALL SIGNALS MATCHED!',detail:'Every pair has been discovered'};
  if(matchArcadePreviewActive(run))return {type:'preview',title:'MEMORY BOOST',detail:'Study the locations! Cards hide in a moment'};
  if(match.pendingResolution)return match.pendingResolution.result==='match'?
    {type:'matched',title:'PAIR FOUND!',detail:'Excellent memory · Mission success'}:
    {type:'miss',title:'REMEMBER THESE CARDS',detail:'No match · Watch where they return'};
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
  return '<div class="ma-final-results" data-mode="'+(unscored?'memory':cfg.mode==='teams'?'teams':'individual')+'">'+
    '<div class="ma-final-heading">'+(unscored?'CREW MEMORY MISSION':'FINAL STANDINGS')+'</div>'+
    '<div class="ma-final-rows">'+(rows||'<p class="ma-final-more">Crew mission completed.</p>')+'</div>'+more+'</div>';
}
function matchArcadeShared(run=state.activityRun,big=false){
  const m=run?.match||{},cfg=run?.matchConfig||{},cards=m.cards||[],active=matchActiveStudent(run);
  const preview=matchArcadePreviewActive(run),status=matchArcadeStatus(m,run),matched=(m.matched||[]).length/2,pairs=cards.length/2;
  const cols=matchArcadeGridColumns(cards);
  const team=cfg.mode==='teams'?matchTeamMeta(m.activeTeam):null;
  // Decorative, pointer-transparent state accents. The existing status banner
  // remains the accessible announcer and native MATCH retains all scoring.
  const celebration=status.type==='matched'?
    '<div class="ma-stage-celebration ma-stage-pair" aria-hidden="true"><span class="ma-celebration-sparks">✦ &nbsp; ✧ &nbsp; ✦</span><strong>PAIR FOUND!</strong><small>'+ (cfg.scoring==='no_score'?'MEMORY MISSION · WELL DONE':'AUTOMATIC POINT AWARDED') +'</small></div>':
    status.type==='victory'?
    '<div class="ma-stage-celebration ma-stage-victory" role="region" aria-label="MATCH final standings"><span class="ma-celebration-sparks">✦ &nbsp; ★ &nbsp; ✦</span><span class="ma-celebration-trophy">🏆</span><strong>MISSION COMPLETE</strong><small>'+matched+' OF '+pairs+' PAIRS DISCOVERED</small>'+matchArcadeFinalStandings(m,run)+'</div>':'';
  return '<div class="ma-game ma-shared '+(big?'ma-present':'ma-compact')+' ma-status-'+status.type+'">'+
    '<div class="ma-cosmos" aria-hidden="true"><span class="ma-planet ma-planet-one"></span><span class="ma-planet ma-planet-two"></span><span class="ma-space-grid"></span></div>'+
    '<header class="ma-header"><div class="ma-brand"><span class="ma-brand-icon">✦</span><span>MISSION <b>MATCH</b></span></div><span class="ma-round-label">MEMORY CHALLENGE</span></header>'+
    '<div class="ma-topline"><div class="ma-turn-identity">'+matchArcadePlayerArt(active?.n||'',run)+
    '<div><small>CURRENT NAVIGATOR'+(team?' · '+esc(team.name.toUpperCase()):'')+'</small><strong>'+esc(active?.n||'Awaiting player')+'</strong></div></div>'+
    '<div class="ma-counter-strip"><span><b>'+matched+'</b> / '+pairs+' <small>PAIRS FOUND</small></span><span><b>'+Number(m.attempts||0)+'</b> <small>TRIES</small></span></div></div>'+
    '<div class="ma-signal ma-signal-'+status.type+'" aria-live="polite" aria-atomic="true"><span class="ma-signal-icon" aria-hidden="true">'+({victory:'🏆',preview:'◉',matched:'✦',miss:'↶',hold:'Ⅱ',ready:'◇'}[status.type])+'</span><div><strong>'+status.title+'</strong><span>'+status.detail+'</span></div></div>'+
    '<div class="ma-board-wrap"><div class="ma-board-surround"><div class="ma-grid" style="--ma-cols:'+cols+'">'+cards.map((card,i)=>
      matchArcadeTile(card,i,m,{preview})).join('')+'</div>'+celebration+'</div></div>'+
    '<div class="ma-bottomline"><div class="ma-progress"><span>MISSION PROGRESS</span><div class="ma-progress-track"><i style="width:'+(pairs?Math.min(100,Math.round(matched/pairs*100)):0)+'%"></i></div></div>'+
    '<div class="ma-log">⌁ '+esc(m.message||'Find the hidden pairs.')+'</div></div>'+
    '<div class="ma-scoreboard">'+matchArcadeScoreline(m,run)+'</div>'+
    '</div>';
}
function matchArcadeStudent(run=state.activityRun,student=selectedStudent()){
  const m=run?.match||{},cfg=run?.matchConfig||{},cards=m.cards||[],active=matchActiveStudent(run);
  const mine=active?.n===student?.n,preview=matchArcadePreviewActive(run),matched=(m.matched||[]).length/2;
  const status=matchArcadeStatus(m,run),cols=matchArcadeGridColumns(cards);
  const teamIndex=cfg.mode==='teams'?matchTeamIndexForStudent(student?.n,run):-1;
  const earnedPairs=cfg.mode==='teams'?Number(m.teamScores?.[teamIndex]||0):Number(m.scores?.[student?.n]||0);
  const canPick=mine&&!preview&&!m.locked&&!m.complete&&!m.pendingResolution&&(m.selected||[]).length<2;
  const turn= m.complete?'MISSION COMPLETE':preview?'MEMORIZE THE BOARD':mine?'YOUR TURN, '+esc(student?.n||'PILOT')+'!':'WATCH '+esc(active?.n||'THE PLAYER');
  const instruction= m.complete?'Every pair has been found!':preview?'Look closely. The cards will flip back automatically.':
    mine?(m.pendingResolution?'See whether your two cards match.':m.selected?.length===1?'Great! Find the matching card.':'Tap any glowing card to uncover its partner.'):'Watch the shared board and remember card locations.';
  const consult=cfg.crewConsult&&mine&&m.selected?.length===1&&!m.consult?.open?'<button class="ma-consult-btn" id="matchAskCrewBtn">◉ ASK MY CREW</button>':'';
  const consultGroup=m.consult?.open&&cfg.mode==='teams'&&matchTeamIndexForStudent(student?.n,run)===Number(m.activeTeam)&&!mine?
    '<div class="ma-consult-box"><b>CREW CONSULT</b><p>Suggest the second card for '+esc(active?.n||'your teammate')+'</p><div class="ma-consult-grid">'+
    cards.map((card,i)=>'<button data-match-consult-pick="'+esc(card.id)+'" '+((m.matched||[]).includes(card.id)||(m.selected||[]).includes(card.id)?'disabled':'')+'>'+String(i+1)+'</button>').join('')+'</div></div>':'';
  const suggestions=m.consult?.open&&mine?'<div class="ma-consult-box"><b>CREW SUGGESTIONS</b><p>'+esc(matchConsultAggregate(run).map(x=>'Card '+x.number+' ×'+x.count).join(' · ')||'Waiting for your crew…')+'</p><button id="matchCloseConsultBtn">Close Consult</button></div>':'';
  return '<div class="ma-game ma-student ma-status-'+status.type+'">'+
    '<div class="ma-cosmos" aria-hidden="true"><span class="ma-planet ma-planet-one"></span><span class="ma-space-grid"></span></div>'+
    '<div class="ma-student-heading"><div class="ma-student-pilot">'+matchArcadePlayerArt(active?.n||'',run)+'<span>CURRENT NAVIGATOR</span></div><span class="ma-eyebrow">✦ MOTHERSHIP · MATCH</span><h2 aria-live="polite">'+turn+'</h2><p>'+instruction+'</p></div>'+
    '<div class="ma-student-status"><span>◈ <b>'+matched+' / '+(cards.length/2)+'</b> PAIRS</span><span>◎ <b>'+Number(m.attempts||0)+'</b> TRIES</span><span>✦ '+(mine?'ACTIVE PILOT':'CREW OBSERVER')+'</span><span class="ma-student-earned">'+(cfg.scoring==='no_score'?'◈ MEMORY MODE · NO POINTS':'★ <b>'+earnedPairs+'</b> AUTO POINTS')+'</span></div>'+
    '<div class="ma-board-wrap"><div class="ma-board-surround"><div class="ma-grid" style="--ma-cols:'+cols+'">'+
    cards.map((card,i)=>matchArcadeTile(card,i,m,{student:true,canPick,preview})).join('')+'</div></div></div>'+
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
