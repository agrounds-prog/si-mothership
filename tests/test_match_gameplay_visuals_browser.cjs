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
  await shared.waitForFunction(()=>!!document.querySelector('.ma-present .ma-stage-pair'),
   null,{timeout:12000});
  const pair=await shared.evaluate(()=>{
   const root=document.querySelector('.ma-present'),burst=root.querySelector('.ma-stage-pair'),
    signal=root.querySelector('.ma-signal'),board=root.querySelector('.ma-board-surround');
   return {text:burst.textContent,status:root.classList.contains('ma-status-matched'),
    aria:burst.getAttribute('aria-hidden'),pointer:getComputedStyle(burst).pointerEvents,
    boardPosition:getComputedStyle(board).position,
    animation:getComputedStyle(burst).animationName,
    cards:root.querySelectorAll('.ma-tile').length,
    statusAnnouncement:signal.getAttribute('aria-live')};
  });
  assert.equal(pair.status,true);
  assert.match(pair.text,/PAIR FOUND!/);
  assert.match(pair.text,/AUTOMATIC POINT AWARDED/);
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
  assert.match(victory.text,/MISSION COMPLETE/);
  assert.match(victory.text,/8 OF 8 PAIRS DISCOVERED/);
  assert.equal(victory.matched,16);
  assert.equal(victory.progressWidth,'100%');
  assert.equal(victory.pointer,'none');
  assert.equal(victory.aria,null,'final results must be available to screen readers');
  assert.deepEqual([victory.region,victory.label],['region','MATCH final standings']);
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
  await teacher.evaluate(()=>{
   const run=state.activityRun;
   run.matchConfig.mode='teams';run.matchConfig.scoring='pairs';run.matchConfig.teamCount=3;
   run.match.teamScores=[4,4,1];render();
  });
  // Fixture-only mode switches are not broadcast as real game actions. Mirror
  // the synthetic config in the projector browser to test the same native
  // standings renderer deterministically without touching actual sessions.
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
  await teacher.evaluate(()=>{state.activityRun.matchConfig.scoring='no_score';render()});
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
