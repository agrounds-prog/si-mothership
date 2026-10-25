/* Phase 3A MATCH visual integration: real teacher + separate projector.
   Runs only against an isolated localhost classroom. Existing game semantics
   stay owned by the native application; this checks visual readability. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8885';
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error('MATCH visual test must use isolated localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const teacherCtx=await browser.newContext({viewport:{width:1440,height:900}});
 const sharedCtx=await browser.newContext({viewport:{width:1920,height:1080}});
 const teacher=await teacherCtx.newPage(),shared=await sharedCtx.newPage();
 const errors=[];for(const [name,page] of [['teacher',teacher],['shared',shared]])
  page.on('pageerror',e=>errors.push(name+': '+String(e.stack||e)));
 try{
  assert.equal((await teacherCtx.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await teacher.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await teacher.waitForFunction(()=>typeof renderActivities==='function'&&networkHydrated===true&&
   typeof matchBuilderWire==='function',null,{timeout:25000});
  await teacher.evaluate(()=>{
   state.screen='activities';state.activeApp='match';state.activityRun=null;
   state.assigningSlot=null;
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   render();
  });
  await teacher.locator('.mcb-shell').waitFor();
  await teacher.locator('[data-mcb-mode="quick"]').click();
  await teacher.locator('#matchSetName').fill('Phase 3A MATCH Visual Layout');
  await teacher.locator('#mcbQuickPairs').fill([
   'Cat | Kitten','Dog | Puppy','Cow | Calf','Sheep | Lamb',
   'Horse | Foal','Duck | Duckling','Goat | Kid','Pig | Piglet'
  ].join('\n'));
  await teacher.waitForFunction(()=>document.querySelector('#mcbPairCount')?.textContent==='8');
  await teacher.locator('#matchMode').selectOption('individual');
  const sid=await teacher.evaluate(()=>window.__SI_SESSION_ID__);
  assert.ok(sid,'isolated classroom session identifier');
  await shared.goto(BASE+'/?role=shared&sid='+encodeURIComponent(sid),{waitUntil:'domcontentloaded',timeout:40000});
  await teacher.locator('#mcbSaveLaunch').click();
  await teacher.waitForFunction(()=>state.activityRun?.activityId==='match-game',null,{timeout:15000});
  await teacher.evaluate(()=>startOrResumeActivityRun());
  await teacher.waitForFunction(()=>state.activityRun?.phase==='running',null,{timeout:15000});
  await shared.waitForFunction(()=>document.querySelector('.ma-present .ma-grid')?.children.length===16,
   null,{timeout:18000});
  const teacherStyle=await teacher.evaluate(()=>{
   const panel=document.querySelector('#activityControllerPanel'),grid=panel?.querySelector('.match-control-grid');
   const buttons=[...grid.querySelectorAll('button')];
   const boxes=buttons.map(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height}});
   const card=panel.querySelector('.match-teacher-card');
   const row=panel.querySelector('.match-current-player');
   return {columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    actions:buttons.length,controls:boxes,
    scoreRows:panel.querySelectorAll('.match-teacher-score>div').length,
    background:getComputedStyle(card).backgroundImage,
    playerFont:parseFloat(getComputedStyle(row).fontSize),
    preview:!!document.querySelector('.ma-compact')};
  });
  assert.equal(teacherStyle.columns,2,'MATCH command deck has two readable button columns');
  assert.ok(teacherStyle.actions>=8&&teacherStyle.controls.every(x=>x.w>95&&x.h>=49),
   'Teacher actions readable and tappable: '+JSON.stringify(teacherStyle));
  assert.ok(teacherStyle.scoreRows>=2&&teacherStyle.playerFont>=20);
  assert.match(teacherStyle.background,/gradient/);
  // Phase 4I: read-only teacher progress, original action buttons, and
  // compact student view. No production classroom or saved games touched.
  const controllerHUD=await teacher.evaluate(()=>{
   const root=document.querySelector('#activityControllerPanel'),bar=root.querySelector('.ma-4i-teacher-track');
   const action=Object.fromEntries(['matchContinueBtn','matchMemoryPreviewBtn',
    'matchLockBtn','matchSkipBtn','matchUndoBtn'].map(id=>[id,
    root.querySelector('#'+id)?.dataset.maActionGroup]));
   return {label:root.querySelector('.ma-4i-teacher-guide-head strong')?.textContent,
    progress:bar?.getAttribute('aria-valuenow'),
    max:bar?.getAttribute('aria-valuemax'),
    help:root.querySelector('.ma-4i-teacher-guidance')?.textContent,
    actions:root.querySelectorAll('.match-control-grid button').length,action};
  });
  assert.deepEqual({progress:controllerHUD.progress,max:controllerHUD.max},
   {progress:'0',max:'8'});
  assert.match(controllerHUD.label,/0 of 8 PAIRS FOUND/);
  assert.match(controllerHUD.help,/matching pairs score automatically/);
  assert.ok(controllerHUD.actions>=8);
  assert.deepEqual(controllerHUD.action,{
   matchContinueBtn:'resolve',matchMemoryPreviewBtn:'assist',
   matchLockBtn:'pause',matchSkipBtn:'next',matchUndoBtn:'correct'
  });

  // Phase 4P-C: next player/next team, repeat turn, miss cue and round finish.
  const turnFlow=await teacher.evaluate(()=>{
   const run=JSON.parse(JSON.stringify(state.activityRun)),m=run.match,ids=m.cards.map(c=>c.id);
   m.pendingResolution={result:'miss',cards:[ids[0],ids[5]],player:'Alex'};
   m.selected=m.pendingResolution.cards.slice();m.locked=true;
   const miss={next:matchArcadeHandoff(run),status:matchArcadeStatus(m,run),markup:matchArcadeStudent(run,{n:'Alex'})};
   run.matchConfig.turnRule='match_go_again';m.pendingResolution.result='match';
   const same=matchArcadeHandoff(run);
   run.matchConfig.mode='teams';run.matchConfig.teamCount=2;
   run.matchConfig.teamAssignments={Alex:0,Blair:1};m.activeTeam=0;
   run.matchConfig.turnRule='one_each';const team=matchArcadeHandoff(run);
   run.matchConfig.turnRule='match_go_again';const sameTeam=matchArcadeHandoff(run);
   m.matched=ids.slice();const final=matchArcadeHandoff(run);
   return {miss,same,team,sameTeam,final};
  });
  assert.equal(turnFlow.miss.next.name,'Blair');
  assert.match(turnFlow.miss.status.detail,/cards 1 and 6/);
  assert.match(turnFlow.miss.markup,/NOT A MATCH/);
  assert.match(turnFlow.miss.markup,/Remember cards 1 and 6/);
  assert.deepEqual([turnFlow.same.name,turnFlow.same.again],['Alex',true]);
  assert.deepEqual([turnFlow.team.name,turnFlow.team.team],['Blair','Red Crew']);
  assert.deepEqual([turnFlow.sameTeam.name,turnFlow.sameTeam.again],['Alex',true]);
  assert.equal(turnFlow.final.complete,true);
  const teacherControls=await teacher.evaluate(()=>{
   const run=state.activityRun,m=run.match,copy=JSON.parse(JSON.stringify(m));
   try{
    m.pendingResolution={result:'miss',cards:[m.cards[0].id,m.cards[5].id],player:'Alex'};
    m.selected=m.pendingResolution.cards.slice();m.locked=true;m.pauseAfterReveal=true;
    renderActivityController();
    const root=document.querySelector('#activityControllerPanel');
    const held={message:root.querySelector('.ma-4i-teacher-guidance')?.textContent,
      next:root.querySelector('.ma-4pc-handoff strong')?.textContent,
      button:root.querySelector('#matchContinueBtn')?.textContent,
      pressed:root.querySelector('#matchPauseRevealBtn')?.getAttribute('aria-pressed'),
      skip:root.querySelector('#matchSkipBtn')?.disabled};
    m.pauseAfterReveal=false;renderActivityController();
    return {held,auto:document.querySelector('#matchContinueBtn')?.textContent};
   }finally{run.match=copy;renderActivityController();}
  });
  assert.match(teacherControls.held.message,/cards 1 and 6/);
  assert.match(teacherControls.held.message,/press CONTINUE/);
  assert.match(teacherControls.held.next,/Blair/);
  assert.match(teacherControls.held.button,/CONTINUE/);
  assert.equal(teacherControls.held.pressed,'true');
  assert.equal(teacherControls.held.skip,true);
  assert.match(teacherControls.auto,/ADVANCE NOW/);

  await teacher.setViewportSize({width:440,height:780});
  const student4i=await teacher.evaluate(()=>{
   state.selectedStudent='Alex';
   const page=document.querySelector('#studentContent');
   const original=page.innerHTML;
   document.body.classList.add('role-student');
   document.querySelector('#teacher')?.classList.remove('active');
   document.querySelector('#student')?.classList.add('active');
   page.innerHTML=matchArcadeStudent(state.activityRun,{n:'Alex',offline:false});
   const panel=page.querySelector('.ma-phase4i-student'),grid=panel.querySelector('.ma-grid');
   const cue=panel.querySelector('.ma-4i-turn-guide');
   const rect=el=>el.getBoundingClientRect();
   const cards=[...grid.querySelectorAll('[data-match-pick]')];
   const result={
    heading:panel.querySelector('.ma-student-heading h2')?.textContent,
    guide:cue.querySelector('strong')?.textContent,
    steps:cue.querySelectorAll('.ma-4i-guide-steps span').length,
    status:panel.querySelectorAll('.ma-student-status>span').length,
    cards:cards.length,enabled:cards.filter(x=>!x.disabled).length,
    cardMinWidth:Math.min(...cards.map(x=>rect(x).width)),
    cardMinHeight:Math.min(...cards.map(x=>rect(x).height)),
    group:grid.getAttribute('role'),
    overflow:page.scrollWidth-page.clientWidth,
    panelOverflow:panel.scrollWidth-panel.clientWidth,
    graphic:getComputedStyle(cue).backgroundImage,
    duplicateFooter:getComputedStyle(panel.querySelector('.ma-device-bottom')).display
   };
   page.innerHTML=original;
   document.body.classList.remove('role-student');
   document.querySelector('#student')?.classList.remove('active');
   document.querySelector('#teacher')?.classList.add('active');
   return result;
  });
  assert.ok(student4i.heading&&student4i.guide);
  assert.equal(student4i.steps,2);
  assert.equal(student4i.status,4,'short student scoreboard replaces repeated status text');
  assert.equal(student4i.cards,16);
  assert.equal(student4i.group,'group');
  assert.ok(student4i.cardMinWidth>=45&&student4i.cardMinHeight>=50,
   'MATCH cards remain large enough in a 440x780 Zoom companion');
  assert.ok(student4i.overflow<=3&&student4i.panelOverflow<=3);
  assert.match(student4i.graphic,/gradient/);
  assert.equal(student4i.duplicateFooter,'none');
  // Phase 4P-B: a newly selected card animates once; ordinary synchronization
  // and a brand-new run never replay old card flips.
  const flips=await teacher.evaluate(()=>{
   const r={runToken:'4pb-a',match:{selected:[]}},view='4pb-fixture';
   const f=()=>[...matchArcadeFreshReveals(r,view)];
   const init=f();r.match.selected=['c1'];const first=f(),steady=f();
   r.match.selected=['c1','c2'];const second=f(),steady2=f();
   r.match.selected=[];const clear=f();r.match.selected=['c1'];const again=f();
   r.runToken='4pb-b';const newRun=f();
   return {init,first,steady,second,steady2,clear,again,newRun};
  });
  assert.deepEqual(flips,{init:[],first:['c1'],steady:[],second:['c2'],
   steady2:[],clear:[],again:['c1'],newRun:[]});
  // Test dense and maximum boards inside the same 440 x 780 mock student.
  const density=await teacher.evaluate(()=>{
   const page=document.querySelector('#studentContent'),before=page.innerHTML;
   document.body.classList.add('role-student');
   document.querySelector('#teacher')?.classList.remove('active');
   document.querySelector('#student')?.classList.add('active');
   const answer=[];
   for(const n of [16,24,40]){
    const r=JSON.parse(JSON.stringify(state.activityRun));
    r.match.cards=Array.from({length:n},(_,i)=>({
     id:'4pb-'+i,pairId:'p'+Math.floor(i/2),content:{type:'text',value:'Card '+(i+1)}
    }));
    page.innerHTML=matchArcadeStudent(r,{n:'Alex'});
    const panel=page.querySelector('.ma-phase4i-student'),grid=panel.querySelector('.ma-grid');
    const cells=[...grid.querySelectorAll('[data-match-pick]')];
    answer.push({n,mode:panel.dataset.maDensity,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
     minWidth:Math.floor(Math.min(...cells.map(x=>x.getBoundingClientRect().width))),
     overflow:Math.max(0,panel.scrollWidth-panel.clientWidth)});
   }
   page.innerHTML=before;
   document.body.classList.remove('role-student');
   document.querySelector('#teacher')?.classList.add('active');
   document.querySelector('#student')?.classList.remove('active');
   return answer;
  });
  assert.deepEqual(density.map(x=>[x.n,x.mode,x.columns]),[
   [16,'standard',4],[24,'dense',5],[40,'maximum',6]
  ]);
  assert.ok(density.every(x=>x.minWidth>=45&&x.overflow<=3),
   '440px MATCH board stays readable: '+JSON.stringify(density));

  await teacher.setViewportSize({width:1440,height:900});
  const layouts=[];
  for(const [width,height] of [[1920,1080],[1366,768],[880,720],[700,500]]){
   await shared.setViewportSize({width,height});
   const g=await shared.evaluate(()=>{
    const root=document.querySelector('.ma-present'),board=root.querySelector('.ma-board-surround'),
      cards=[...root.querySelectorAll('.ma-tile')],wrap=root.querySelector('.ma-board-wrap');
    const br=board.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
    const rr=root.getBoundingClientRect();
    return {viewport:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,
      board:{x:br.left,right:br.right,w:br.width,top:br.top,bottom:br.bottom},
      wrap:{top:wr.top,bottom:wr.bottom},
      root:{w:rr.width,h:rr.height,top:rr.top},
      cards:cards.map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})),
      navigator:!!root.querySelector('.ma-turn-identity'),
      progress:!!root.querySelector('.ma-progress-track'),
      score:!!root.querySelector('.ma-scoreboard'),
      border:getComputedStyle(board).borderTopColor,
      status:getComputedStyle(root.querySelector('.ma-signal')).display};
   });
   layouts.push({size:width+'x'+height,...g});
   assert.ok(g.overflow<=6,'No projector horizontal scroll '+width+': '+JSON.stringify(g));
   assert.equal(g.cards.length,16);
   assert.ok(g.cards.every(x=>x.w>=32&&x.h>=25),'Projected tiles stay visible '+width+': '+JSON.stringify(g));
   assert.ok(g.board.x>=-4&&g.board.right<=width+4);
   assert.ok(g.navigator&&g.progress&&g.score);
  }
  // Cosmetic reveal states are driven by real MATCH render markup, not
  // invented overlays detached from the engine's own match state.
  await teacher.evaluate(()=>{
   const m=state.activityRun.match;
   m.pendingResolution={result:'match'};
   m.message='The crew found a matching pair!';
   render();
  });
  // Capture one coherent projector render. Live synchronization may replace
  // the MATCH subtree between separate wait/evaluate calls.
  const pairHandle=await shared.waitForFunction(()=>{
   const root=document.querySelector('.ma-present');
   if(!root||root.dataset.turnPhase!=='matched'||!root.classList.contains('ma-status-matched'))return false;
   const burst=root.querySelector('.ma-stage-pair'),signal=root.querySelector('.ma-signal'),
    board=root.querySelector('.ma-board-surround');
   if(!burst||!signal||!board)return false;
   return {text:burst.textContent,status:root.classList.contains('ma-status-matched'),
    aria:burst.getAttribute('aria-hidden'),pointer:getComputedStyle(burst).pointerEvents,
    boardPosition:getComputedStyle(board).position,
    animation:getComputedStyle(burst).animationName,
    cards:root.querySelectorAll('.ma-tile').length,
    statusAnnouncement:signal.getAttribute('aria-live')};
  },null,{timeout:18000});
  const pair=await pairHandle.jsonValue();
  assert.equal(pair.status,true);
  // Matched phase and status were verified together in pairHandle above.
  assert.match(pair.text,/PAIR FOUND!/);
  assert.match(pair.text,/AUTOMATIC POINT AWARDED/);
  assert.match(pair.text,/Alex/,'projection shows current navigator');
  assert.equal(pair.pointer,'none');
  assert.equal(pair.aria,'true','native status banner, not decoration, announces the pair');
  assert.equal(pair.statusAnnouncement,'polite');
  assert.equal(pair.cards,16,'celebration must not replace the game board');
  const pairRays=await shared.evaluate(()=>{
   const burst=document.querySelector('.ma-present .ma-stage-pair');
   const streak=burst.querySelector('.ma-pair-streaks i');
   return {count:burst.querySelectorAll('.ma-pair-streaks i').length,
    decorative:burst.querySelector('.ma-pair-streaks')?.getAttribute('aria-hidden'),
    animation:streak?getComputedStyle(streak).animationName:''};
  });
  assert.equal(pairRays.count,5,'pair-found visual has five rays');
  assert.equal(pairRays.decorative,'true','pair graphic is not a duplicate live announcement');
  assert.match(pairRays.animation,/ma3h-pair-rays/);

  // Drive final completion directly on the synthetic local session, never live.
  await teacher.evaluate(()=>{
   const m=state.activityRun.match;
   m.pendingResolution=null;m.complete=true;m.scores={Alex:5,Blair:3};
   m.matched=m.cards.map(card=>card.id);
   m.message='All pairs have been discovered!';render();
  });
  await shared.waitForFunction(()=>!!document.querySelector('.ma-present .ma-stage-victory'),
   null,{timeout:12000});
  const victory=await shared.evaluate(()=>{
   const root=document.querySelector('.ma-present'),banner=root.querySelector('.ma-stage-victory'),
    progress=root.querySelector('.ma-progress-track i'),
    board=root.querySelector('.ma-board-surround');
   const bannerRect=banner.getBoundingClientRect(),boardRect=board.getBoundingClientRect();
   return {text:banner.textContent,aria:banner.getAttribute('aria-hidden'),
    region:banner.getAttribute('role'),label:banner.getAttribute('aria-label'),
    pointer:getComputedStyle(banner).pointerEvents,
    trophy:banner.querySelector('.ma-celebration-trophy')?.textContent,
    matched:root.querySelectorAll('.ma-tile.is-matched').length,
    status:root.classList.contains('ma-status-victory'),
    progressWidth:progress.style.width,animation:getComputedStyle(banner).animationName,
    staysInBoard:bannerRect.left>=boardRect.left-3&&bannerRect.right<=boardRect.right+3};
  });
  assert.equal(victory.status,true);
  assert.equal(await shared.evaluate(()=>document.querySelector('.ma-present')?.dataset.turnPhase),'complete');
  assert.match(victory.text,/MISSION COMPLETE/);
  assert.match(victory.text,/8 OF 8 PAIRS DISCOVERED/);
  assert.equal(victory.matched,16);
  assert.equal(victory.progressWidth,'100%');
  assert.equal(victory.pointer,'none');
  assert.equal(victory.aria,null,'final results must be available to screen readers');
  assert.deepEqual([victory.region,victory.label],['region','MATCH final standings']);
  const finalMetrics=await shared.evaluate(()=>{
   const root=document.querySelector('.ma-present .ma-4pb-final-summary');
   return {label:root?.getAttribute('aria-label'),
    figures:[...root?.querySelectorAll('b')||[]].map(x=>x.textContent)};
  });
  assert.deepEqual(finalMetrics,{label:'MATCH final round statistics',figures:['8 / 8','0']});
  const winnerLights=await shared.evaluate(()=>{
   const root=document.querySelector('.ma-present .ma-stage-victory');
   const halo=root.querySelector('.ma-victory-halo');
   return {stars:halo?.querySelectorAll('i').length,
    aria:halo?.getAttribute('aria-hidden'),
    animation:halo?getComputedStyle(halo).animationName:'',
    finalBg:getComputedStyle(root.querySelector('.ma-final-results')).backgroundImage};
  });
  assert.equal(winnerLights.stars,3,'championship halo lights');
  assert.equal(winnerLights.aria,'true');
  assert.match(winnerLights.animation,/ma3h-halo-entry/);
  assert.match(winnerLights.finalBg,/linear-gradient/);

  const standings=await shared.evaluate(()=>{
    const stage=document.querySelector('.ma-stage-victory .ma-final-results');
    return {mode:stage?.dataset.mode,rows:[...stage.querySelectorAll('.ma-final-row')].map(row=>({
      rank:row.querySelector('.ma-final-rank').textContent,
      name:row.querySelector('.ma-final-name').textContent,
      score:row.querySelector('.ma-final-points').textContent.trim()
    }))};
  });
  assert.equal(standings.mode,'individual');
  assert.deepEqual(standings.rows.map(x=>x.name),['✦ Alex','✦ Blair']);
  assert.deepEqual(standings.rows.map(x=>x.rank),['01','02']);
  assert.deepEqual(standings.rows.map(x=>x.score),['5 PAIRS','3 PAIRS']);
  assert.ok(victory.staysInBoard,'victory graphic stays inside the game card arena');
  // Phase 3C: native team points, shared ranks, score-free crew, and small projector.
  // Fixture-only standings modes are set in the projector browser only.\n  // Avoid teacher-side synthetic renders that can race the shared snapshot.
  await shared.evaluate(()=>{
   const run=state.activityRun;
   run.matchConfig.mode='teams';run.matchConfig.scoring='pairs';run.matchConfig.teamCount=3;
   run.match.teamScores=[4,4,1];renderPublic();
  });
  await shared.waitForFunction(()=>{
   const p=document.querySelector('.ma-present .ma-final-results');
   return p?.dataset.mode==='teams'&&p.querySelectorAll('.ma-final-row').length===3;
  },null,{timeout:12000});
  const teams=await shared.evaluate(()=>[...document.querySelectorAll('.ma-present .ma-final-row')]
   .map(row=>({rank:row.querySelector('.ma-final-rank').textContent,
    score:row.querySelector('.ma-final-points').textContent.trim()})));
  assert.deepEqual(teams.map(x=>x.rank),['01','01','03'],'team ties share first rank');
  assert.deepEqual(teams.map(x=>x.score),['4 PAIRS','4 PAIRS','1 PAIR']);
  await shared.evaluate(()=>{state.activityRun.matchConfig.scoring='no_score';renderPublic()});
  await shared.waitForFunction(()=>document.querySelector('.ma-present .ma-final-results')?.dataset.mode==='memory',null,{timeout:12000});
  const memory=await shared.evaluate(()=>{
   const p=document.querySelector('.ma-present .ma-final-results');
   return {heading:p.querySelector('.ma-final-heading').textContent,
    ranks:[...p.querySelectorAll('.ma-final-rank')].map(x=>x.textContent),
    points:[...p.querySelectorAll('.ma-final-points')].map(x=>x.textContent)};
  });
  assert.equal(memory.heading,'CREW MEMORY MISSION');
  assert.ok(memory.ranks.every(x=>x==='✦')&&memory.points.every(x=>x==='CREW'),
   'no-score mode must never claim a ranking or winner');
  await shared.setViewportSize({width:700,height:500});
  const compactFinal=await shared.evaluate(()=>{
   const p=document.querySelector('.ma-present .ma-stage-victory'),
    board=document.querySelector('.ma-present .ma-board-surround'),
    r=p.getBoundingClientRect(),b=board.getBoundingClientRect();
   return {stage:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
    board:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},
    scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,
    rows:p.querySelectorAll('.ma-final-row').length};
  });
  assert.ok(compactFinal.stage.left>=compactFinal.board.left-4&&
   compactFinal.stage.right<=compactFinal.board.right+4&&
   compactFinal.scrollWidth<=compactFinal.viewport+6,
   'compact MATCH final results stay inside projector: '+JSON.stringify(compactFinal));
  const matchFinalHUD=await teacher.evaluate(()=>{
   const dock=document.querySelector('#siUnifiedTeacherDeck');
   return {finished:dock?.dataset.finished,
    returnText:dock?.querySelector('.si-utc-finish')?.textContent};
  });
  assert.deepEqual(matchFinalHUD,{finished:'true',returnText:'Return to Class'});
  teacher.on('dialog',dialog=>dialog.accept());
  await teacher.locator('#siUnifiedTeacherDeck .si-utc-finish').click();
  await teacher.waitForFunction(()=>!state.activityRun||state.activityRun.activityId!=='match-game',
   null,{timeout:12000});
  await shared.waitForFunction(()=>!document.querySelector('.ma-present .ma-final-results'),null,{timeout:12000});
  assert.deepEqual(errors,[],'No JavaScript errors during teacher and projector play');
  console.log('MATCH Phase 3A teacher controls + projected 16-card board PASS',
   JSON.stringify({pair,victory,teacher:teacherStyle,projectors:layouts.map(({size,overflow,board,cards})=>
    ({size,overflow,board,cards:cards.length,minTile:Math.min(...cards.map(x=>x.w))}))}));
 }finally{await teacherCtx.close();await sharedCtx.close();await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1});
