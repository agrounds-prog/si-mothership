/* MILLION classroom show regression: actual local teacher and projector Chromium sessions.
   Synthetic roster only; NEVER accesses live production or persistent /data.
*/
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.LOCAL_URL||'http://127.0.0.1:8877';

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const teacherCtx=await browser.newContext({viewport:{width:1440,height:900}});
 const screenCtx=await browser.newContext({viewport:{width:1920,height:1080}});
 const teacher=await teacherCtx.newPage(),screen=await screenCtx.newPage(),errors=[];
 for(const [role,page] of [['teacher',teacher],['shared',screen]]){
  page.on('pageerror',e=>errors.push(role+': '+String(e.stack||e)));
 }
 try{
  await teacher.goto(base+'/?role=teacher',{waitUntil:'domcontentloaded'});
  await teacher.waitForFunction(()=>!!window.MillionStudio);
  const auth=await teacher.evaluate(async()=>{
   return (await fetch('/api/teacher/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'5030'})})).status;
  });
  assert.equal(auth,200);
  await teacher.reload({waitUntil:'domcontentloaded'});
  await teacher.waitForFunction(()=>!!window.MillionStudio);
  await teacher.evaluate(()=>{
   state.students=[{n:'Pilot',studentToken:'sim-pilot',offline:false},{n:'Crew',studentToken:'sim-crew',offline:false}];
   state.selectedStudent='Pilot';state.activityRun=null;state.screen='activities';state.activeApp='million';render();
  });
  await teacher.locator('.ms-studio').waitFor();
  await teacher.locator('#msFresh').click();
  await teacher.locator('#msName').fill('Simulated classroom five question MILLION');
  await teacher.locator('#msCount').selectOption('5');
  for(let i=0;i<5;i++){
   await teacher.locator('[data-ms-slide="'+i+'"]').click();
   await teacher.locator('#msPrompt').fill('Mission question '+(i+1)+' · What makes a strong crew member?');
   for(let j=0;j<4;j++)
    await teacher.locator('[data-ms-answer="'+j+'"]').fill(['Listen carefully','Stay respectful','Ask for help','Work together'][j]);
   await teacher.locator('#msCorrect').selectOption(['A','B','C','D','A'][i]);
  }
  const sid=await teacher.evaluate(()=>window.__SI_SESSION_ID__);
  assert.ok(sid);
  await screen.goto(base+'/?role=shared&sid='+encodeURIComponent(sid),{waitUntil:'domcontentloaded'});
  await teacher.locator('#msLaunch').click();
  await teacher.waitForFunction(()=>state.activityRun?.activityId==='million-game',{timeout:10000});
  assert.equal(await teacher.evaluate(()=>state.activityRun.millionConfig.questions.length),5);
  await teacher.evaluate(()=>startOrResumeActivityRun());
  await teacher.waitForFunction(()=>state.activityRun?.phase==='running',{timeout:10000});
  await screen.waitForFunction(()=>document.querySelector('.million-public')?.querySelectorAll('.million-choice').length===4,{timeout:12000});
  await screen.waitForFunction(()=>document.querySelector('.million-public.big .million-stakes-amount')?.textContent.includes('PTS'),null,{timeout:8500});
  const first=await screen.evaluate(()=>{
   const root=document.querySelector('.million-public.big')||document.querySelector('.million-public');
   return {rungCount:root.querySelectorAll('.million-rung').length,
    prize:root.querySelector('.million-stakes-amount')?.textContent,
    stageCount:document.querySelectorAll('.million-public').length,
    noKey:state.activityRun.millionConfig.questions.every(q=>!('correct' in q)),role:document.body.className};
  });
  assert.equal(first.rungCount,5);
  await teacher.locator('#activityControllerPanel .million-4o-question-clock').waitFor();
  await screen.locator('.million-public.big .million-4o-question-clock').waitFor();
  const clock=await teacher.evaluate(()=>{
   const run=state.activityRun;
   return {started:run.million.questionStartedAt>0,ended:run.million.questionEndedAt,
    teacherText:document.querySelector('#activityControllerPanel .million-4o-question-clock')?.textContent,
    phase:run.phase};
  });
  assert.equal(clock.started,true,'timer begins when the teacher starts the activity, not during the lobby');
  assert.equal(clock.ended,null);
  assert.equal(clock.phase,'running');
  assert.match(clock.teacherText,/QUESTION ELAPSED · \d+:\d{2}/);
  assert.match(await screen.locator('.million-public.big .million-4o-question-clock').innerText(),
   /QUESTION ELAPSED · \d+:\d{2}/,'the projector shows the same non-expiring question clock');

  const currencyAudit=await screen.evaluate(()=>{
   const b=document.querySelector('.million-public.big');
   const list=['.million-rung','.million-stakes-amount','.ms-million-question-prize'];
   return list.map(sel=>({selector:sel,labels:[...b.querySelectorAll(sel)].map(el=>el.textContent)}));
  });
  assert.ok(currencyAudit.every(section=>section.labels.every(label=>!label.includes('$'))),
   'no currency symbols in MILLION score widgets');
  assert.equal(first.prize,'100 PTS');
  await screen.waitForFunction(()=>!!document.querySelector('.million-public.big .ms-million-ladder-progress')&&
   !!document.querySelector('.million-public.big .ms-million-question-band'),null,{timeout:7000});
  const showProgress=await screen.evaluate(()=>{
   const b=document.querySelector('.million-public.big');
   const band=b.querySelector('.ms-million-question-band'),meter=b.querySelector('.ms-million-ladder-progress');
   return {question:band.querySelector('.ms-million-question-number')?.textContent,
    value:band.querySelector('.ms-million-question-prize')?.textContent,
    progress:meter.querySelector('.ms-million-progress-head strong')?.textContent,
    fill:meter.querySelector('.ms-million-progress-fill')?.style.width,
    final:b.dataset.msFinalQuestion,
    publicOnly:state.activityRun.millionConfig.questions.every(q=>!('correct' in q))};
  });
  assert.deepEqual(showProgress,{question:'QUESTION 01 / 05',value:'ON THE LINE · 100 PTS',
   progress:'0 / 5 SECURED',fill:'0%',final:'false',publicOnly:true},
   'new prize ladder HUD reflects only public state');
  // Phase 3D: the new theme must be visible on the actual projector, not a mockup.
  const showArt=await screen.evaluate(()=>{
   const root=document.querySelector('.million-public.big');
   const h=root.querySelector('.million-stage h3'),choice=root.querySelector('.million-choice'),
    badge=choice.querySelector('b'),ladder=root.querySelector('.million-ladder');
   return {stage:getComputedStyle(root).backgroundImage,
    question:getComputedStyle(h).backgroundImage,questionRadius:getComputedStyle(h).borderTopLeftRadius,
    choice:getComputedStyle(choice).backgroundImage,choiceRadius:getComputedStyle(choice).borderTopLeftRadius,
    badge:getComputedStyle(badge).backgroundImage,ladder:getComputedStyle(ladder).backgroundImage};
  });
  assert.match(showArt.stage,/repeating-radial-gradient/,'quiz stage concentric lighting');
  assert.match(showArt.question,/radial-gradient/,'lit oval question display');
  assert.ok(parseFloat(showArt.questionRadius)>=25,'question displayed in rounded stage frame');
  assert.ok(parseFloat(showArt.choiceRadius)>=100,'pill-shaped game show answers');
  assert.match(showArt.badge,/radial-gradient/,'gold letter medallions');
  assert.match(showArt.ladder,/linear-gradient/,'stage-themed money ladder');
  const phase3Visual=await Promise.all([
   teacher.evaluate(()=>{
     const root=document.querySelector('#activityControllerPanel'),grid=root.querySelector('.million-teacher-grid');
     const reveal=root.querySelector('#millionCorrectBtn'),control=root.querySelector('.million-teacher-card');
     return {columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      revealHeight:reveal.getBoundingClientRect().height,
      revealWidth:reveal.getBoundingClientRect().width,
      revealBackground:getComputedStyle(reveal).backgroundImage,
      actionCount:root.querySelectorAll('.million-teacher-actions button').length,
      lifelines:root.querySelectorAll('.million-teacher-lifelines button').length,
      controlBackground:getComputedStyle(control).backgroundImage};
   }),
   screen.evaluate(()=>{
     const game=document.querySelector('.million-public.big'),q=game.querySelector('.million-stage h3'),
       cards=[...game.querySelectorAll('.million-choice')],ladder=game.querySelector('.million-ladder');
     return {cards:cards.length,questionFont:parseFloat(getComputedStyle(q).fontSize),
      answerFont:parseFloat(getComputedStyle(cards[0].querySelector('span')).fontSize),
      minAnswerHeight:Math.min(...cards.map(x=>x.getBoundingClientRect().height)),
      visibleLadder:ladder.getBoundingClientRect().width,
      stageBackground:getComputedStyle(q).backgroundImage};
   })
  ]);
  assert.equal(phase3Visual[0].columns,2,'Two-panel teacher MILLION command deck');
  assert.ok(phase3Visual[0].revealHeight>=56&&phase3Visual[0].revealWidth>=165,
   'Prominent teacher reveal action: '+JSON.stringify(phase3Visual));
  assert.equal(phase3Visual[0].actionCount,3,'Existing Reveal, Wrong, Next actions remain present');
  assert.ok(phase3Visual[0].lifelines>=8);
  assert.match(phase3Visual[0].controlBackground,/gradient/);
  assert.ok(phase3Visual[1].questionFont>=28&&phase3Visual[1].answerFont>=17&&
   phase3Visual[1].minAnswerHeight>=73&&phase3Visual[1].visibleLadder>=160,
   'Projected MILLION stage, answers, ladder readable: '+JSON.stringify(phase3Visual));
  assert.match(phase3Visual[1].stageBackground,/gradient/);

  // Phase 4J: live teacher controls and synced projector stage.
  await teacher.locator('.million-4j-progress').waitFor();
  await screen.locator('.million-4j-stage-status').waitFor();
  const phase4JTeacher=await teacher.evaluate(()=>{
   const root=document.querySelector('#activityControllerPanel');
   const bar=root.querySelector('.million-4j-progress [role="progressbar"]');
   return {progress:bar?.getAttribute('aria-valuenow'),
    max:bar?.getAttribute('aria-valuemax'),
    controls:[...root.querySelectorAll('.million-teacher-actions button')].map(x=>x.dataset.millionAction),
    lifelines:root.querySelectorAll('.million-4j-lifelines [data-million-teacher-life]').length};
  });
  assert.deepEqual(phase4JTeacher,{progress:'0',max:'5',
   controls:['reveal','signal-lost','advance'],lifelines:4});
  const phase4JScreen=await screen.evaluate(()=>{
   const board=document.querySelector('.million-public.big');
   return {state:board.dataset.million4jPhase,
    label:board.querySelector('.million-4j-stage-status')?.textContent,
    choices:board.querySelectorAll('.million-choice').length};
  });
  assert.deepEqual(phase4JScreen,{state:'ready',label:'WAITING FOR ANSWER',choices:4});


  assert.equal(first.noKey,true);
  const entranceState=await screen.evaluate(()=>{
   const b=document.querySelector('.million-public.big');
   return {phase:b.dataset.msRevealStep,entering:b.dataset.msEntering,
     current:b.querySelector('.ms-million-question-number')?.textContent};
  });
  assert.equal(entranceState.phase,'ready','new MILLION question is ready before locking');
  assert.ok(['true','false'].includes(entranceState.entering),'projector tracks question-entry phase');
  assert.match(entranceState.current,/QUESTION 01/);
  assert.equal(await screen.locator('.ms-studio').count(),0,'game editor is teacher only');

  // Live teacher action must visibly remove exactly two wrong choices on
  // projector and student rendering, not merely disable invisible hit targets.
  await teacher.locator('[data-million-teacher-life="reduce"]').click();
  await teacher.waitForFunction(()=>state.activityRun.million.eliminated.length===2,{timeout:10000});
  await screen.waitForFunction(()=>state.activityRun?.million?.eliminated?.length===2,{timeout:12000});
  const fifty=await screen.evaluate(()=>{
   const root=document.querySelector('.million-public.big')||document.querySelector('.million-public');
   return {removed:root.querySelectorAll('.million-choice.eliminated').length,
    labels:[...root.querySelectorAll('.million-choice.eliminated span')].map(x=>x.textContent),
    banner:root.querySelector('.million-5050-banner')?.textContent||'',
    remaining:[...root.querySelectorAll('.million-choice:not(.eliminated) b')].map(x=>x.textContent),
    noKey:!('correct' in state.activityRun.millionConfig.questions[0])};
  });
  const pilot50=await teacher.evaluate(()=>{
   const shell=document.createElement('div');
   shell.innerHTML=millionStudentMarkup(state.activityRun,studentByName('Pilot'));
   return {removed:shell.querySelectorAll('.million-student-choice.eliminated').length,
    removedText:[...shell.querySelectorAll('.million-student-choice.eliminated span')].map(x=>x.textContent),
    banner:shell.querySelector('.million-5050-banner')?.textContent||'',
    teacherRemoved:document.querySelectorAll('.million-teacher-choices>div.eliminated').length,
    teacherBanner:document.querySelector('.million-teacher-5050-banner')?.textContent||'',
    remainingInventory:state.activityRun.million.inventory.reduce};
  });
  assert.equal(fifty.removed,2,'projector exactly two choices marked removed');
  assert.equal(fifty.remaining.length,2,'two playable choices remain');
  assert.deepEqual(fifty.labels,['SIGNAL REMOVED','SIGNAL REMOVED']);
  assert.match(fifty.banner,/50\/50 ACTIVATED/);
  assert.equal(fifty.noKey,true,'no correct answer leaked to shared screen');
  // Phase 3H: genuine 50/50 inventory consumption triggers a read-only
  // decorative cue. The eliminated cards and answer key remain native.
  await screen.waitForFunction(()=>{
   const flash=document.querySelector('#msMillionLifelineCue');
   return flash?.dataset.lifeline==='reduce'&&flash.classList.contains('is-visible');
  },null,{timeout:7000});
  const lifeCue=await screen.evaluate(()=>{
   const flash=document.querySelector('#msMillionLifelineCue');
   const ring=flash.querySelector('.ms-million-lifeline-ring');
   return {label:flash.textContent,role:flash.getAttribute('role'),
    type:flash.dataset.lifeline,beats:flash.querySelectorAll('.ms-million-lifeline-beats i').length,
    pointer:getComputedStyle(flash).pointerEvents,animation:getComputedStyle(ring).animationName};
  });
  assert.equal(lifeCue.type,'reduce');
  assert.equal(lifeCue.beats,4,'four visible pulse lights on consumed lifeline');
  assert.equal(lifeCue.pointer,'none');
  assert.match(lifeCue.label,/50\/50 ACTIVATED/);
  assert.match(lifeCue.animation,/ms3h-lifeline-entry/);

  const lifelineDrama=await screen.evaluate(()=>{
   const root=document.querySelector('.million-public.big');
   const activated=root.querySelector('.million-5050-banner');
   const ready=root.querySelector('.million-lifelines span.available');
   return {border:activated?parseFloat(getComputedStyle(activated).borderTopWidth):0,
    background:activated?getComputedStyle(activated).backgroundImage:'',
    ready:ready?getComputedStyle(ready).backgroundImage:''};
  });
  assert.ok(lifelineDrama.border>=2,'50/50 announcement gets the show spotlight');
  assert.match(lifelineDrama.background,/linear-gradient/);
  if(lifelineDrama.ready)assert.match(lifelineDrama.ready,/linear-gradient/);

  assert.equal(pilot50.removed,2,'pilot visibly sees eliminated choices');
  assert.deepEqual(pilot50.removedText,['SIGNAL REMOVED','SIGNAL REMOVED']);
  assert.match(pilot50.banner,/50\/50 ACTIVE/);
  assert.equal(pilot50.teacherRemoved,2,'teacher sees removed choices');
  assert.match(pilot50.teacherBanner,/50\/50 ACTIVE/);
  assert.equal(pilot50.remainingInventory,0);
  assert.equal(await teacher.locator('[data-million-teacher-life="reduce"]').isDisabled(),true,'used 50/50 is disabled');

  // Examine a genuine projector role, including 720p-style Zoom layouts.
  const layout=[];
  for(const [width,height] of [[1920,1080],[1366,768],[880,720]]){
   await screen.setViewportSize({width,height});
   await screen.waitForTimeout(80);
   const rect=await screen.evaluate(()=>{
    const root=document.querySelector('.million-public.big')||document.querySelector('.million-public');
    const box=sel=>{const r=root.querySelector(sel)?.getBoundingClientRect();
      return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};
    return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      stage:box('.million-stage'),
      ladder:box('.million-ladder'),
      life:box('.million-lifelines'),
      parent:(()=>{const r=root.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}})(),
      answers:[...root.querySelectorAll('.million-choice')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}})};
   });
   layout.push({size:width+'x'+height,...rect});
   assert.ok(rect.stage&&rect.ladder&&rect.life,'projector main and sidebars present');
   assert.ok(rect.ladder.w>85,'visible money ladder required at '+width+' (width='+rect.ladder.w+')');
   assert.ok(rect.documentWidth<=width+36,'projector horizontal clipping '+width+' '+rect.documentWidth);
   if(width>=1000){
    assert.ok(rect.stage.x>=rect.ladder.right-3,'ladder overlap at '+width);
    assert.ok(rect.life.x>=rect.stage.right-3,'lifeline overlap at '+width);
   }
   assert.ok(rect.answers.every(r=>r.width>=100),'answer cards too narrow '+width);
  }

  for(let i=0;i<5;i++){
   if(i===4){
    await screen.waitForFunction(()=>{
     const game=document.querySelector('.million-public.big');
     return game?.dataset.msFinalQuestion==='true'&&
      game.querySelector('.ms-million-question-prize')?.textContent.includes('1,000,000 PTS');
    },null,{timeout:8500});
    const finalQuestion=await screen.evaluate(()=>{
     const board=document.querySelector('.million-public.big');
     const cue=document.querySelector('#msMillionStageCue');
     const ribbon=board.querySelector('.ms-million-question-band');
     return {label:ribbon.querySelector('strong').textContent,
      border:getComputedStyle(ribbon).borderTopWidth,
      glow:getComputedStyle(board.querySelector('.million-stage h3')).boxShadow,
      cue:cue?.className,
      noKey:state.activityRun.millionConfig.questions.every(q=>!('correct' in q))};
    });
    assert.match(finalQuestion.label,/FINAL QUESTION.*1,000,000 PTS/);
    assert.ok(parseFloat(finalQuestion.border)>=2);
    assert.match(finalQuestion.glow,/rgb/);
    assert.match(finalQuestion.cue,/is-final-question/);
    assert.ok(finalQuestion.noKey);
   }
   await teacher.evaluate(()=>{
    const run=state.activityRun,m=run.million,q=run.millionConfig.questions[m.questionIndex];
    m.selectedAnswer=q.correct;m.lockedAnswer=q.correct;render();
   });
   await screen.waitForFunction(idx=>!!state.activityRun?.million?.lockedAnswer&&state.activityRun.million.questionIndex===idx,i,{timeout:10000});
   if(i===0){
    await screen.waitForFunction(()=>{
     const cue=document.querySelector('#msMillionStageCue');
     return cue?.classList.contains('locked')&&cue.querySelectorAll('.ms-million-cue-sequence i').length===5;
    },null,{timeout:8000});
    const lockedShow=await screen.evaluate(()=>{
     const cue=document.querySelector('#msMillionStageCue');
     const beats=cue.querySelector('.ms-million-cue-sequence i');
     const locked=document.querySelector('.million-public.big .million-choice.locked');
     return {phase:cue.dataset.phase,footer:cue.querySelector('.ms-million-cue-footer')?.textContent,
      beats:cue.querySelectorAll('.ms-million-cue-sequence i').length,
      animation:getComputedStyle(beats).animationName,
      outline:locked?parseFloat(getComputedStyle(locked).outlineWidth):0,
      protected:state.activityRun.millionConfig.questions.every(q=>!('correct' in q))};
    });
    assert.equal(lockedShow.phase,'locked');
    await teacher.waitForFunction(()=>
     document.querySelector('#siUnifiedTeacherDeck')?.dataset.revealStep==='locked'&&
     document.querySelector('#siUnifiedTeacherDeck .si-utc-step-note')?.dataset.step==='locked',
     null,{timeout:9000});
    const controlLock=await teacher.evaluate(()=>{
     const deck=document.querySelector('#siUnifiedTeacherDeck');
     return {prompt:deck.querySelector('.si-utc-step-note')?.textContent,
      focus:[...deck.querySelectorAll('.si-utc-focus-action')].map(el=>el.textContent)};
    });
    assert.match(controlLock.prompt,/Reveal the answer/);
    assert.ok(controlLock.focus.some(x=>x.includes('Reveal Answer')),'teacher highlights native reveal action');
    assert.match(lockedShow.footer,/ANSWER IS IN/);
    assert.equal(lockedShow.beats,5);
    assert.match(lockedShow.animation,/ms3e-suspense/);
    assert.ok(lockedShow.outline>=2&&lockedShow.protected,'dramatic locked answer does not leak private key');
   }
   await teacher.evaluate(()=>millionResolve(true));
   await screen.waitForFunction(idx=>!!state.activityRun?.million?.revealed&&state.activityRun.million.questionIndex===idx,i,{timeout:10000});
   if(i===0){
    await screen.waitForFunction(()=>document.querySelector('#msMillionStageCue')?.dataset.phase==='correct',null,{timeout:8000});
    const awarded=await screen.evaluate(()=>{
     const cue=document.querySelector('#msMillionStageCue');
     return {footer:cue.querySelector('.ms-million-cue-footer')?.textContent,
      beats:cue.querySelectorAll('.ms-million-cue-sequence i').length,
      animation:getComputedStyle(cue.querySelector('.ms-million-cue-sequence i')).animationName,
      prize:cue.textContent,
      hiddenKey:state.activityRun.millionConfig.questions.every(q=>!('correct' in q))};
    });
    assert.equal(awarded.footer,'THE POINT LADDER ADVANCES');
    await teacher.waitForFunction(()=>
     document.querySelector('#siUnifiedTeacherDeck')?.dataset.revealStep==='revealed'&&
     document.querySelector('#siUnifiedTeacherDeck .si-utc-step-note')?.dataset.step==='revealed',
     null,{timeout:9000});
    const controlReveal=await teacher.evaluate(()=>{
     const deck=document.querySelector('#siUnifiedTeacherDeck');
     return {prompt:deck.querySelector('.si-utc-step-note')?.textContent,
      focus:[...deck.querySelectorAll('.si-utc-focus-action')].map(el=>el.textContent)};
    });
    assert.match(controlReveal.prompt,/next question/i);
    assert.ok(controlReveal.focus.some(x=>x.includes('Next Question')),'teacher highlights native next action');
    await screen.waitForFunction(()=>
      document.querySelector('.million-public.big')?.dataset.msRevealStep==='revealed',
      null,{timeout:8000});
    assert.equal(awarded.beats,5);
    assert.match(awarded.animation,/ms3e-burst/);
    assert.match(awarded.prize,/POINTS EARNED: 100 PTS/);
    assert.equal(awarded.hiddenKey,true);
   }
   const result=await screen.evaluate(()=>{
    const root=document.querySelector('.million-public.big')||document.querySelector('.million-public');
    return {correct:root.querySelectorAll('.million-choice.correct').length,
      earned:root.querySelectorAll('.million-rung.earned').length,
      publicCorrect:state.activityRun.million.publicCorrect,
      noKey:state.activityRun.millionConfig.questions.every(q=>!('correct' in q)),
      complete:!!state.activityRun.million.complete,
      stake:root.querySelector('.million-stakes-amount')?.textContent};
   });
   const fx=await screen.evaluate(()=>{
    const root=document.querySelector('.million-public.big')||document.querySelector('.million-public');
    const correct=root.querySelector('.million-choice.correct');
    const earned=root.querySelector('.million-rung.earned');
    return {borderWidth:parseFloat(getComputedStyle(correct).borderTopWidth),
     correctBorder:getComputedStyle(correct).borderTopColor,
     rungColor:earned?getComputedStyle(earned).backgroundImage:'',
     privateKeyProtected:state.activityRun.millionConfig.questions.every(q=>!('correct' in q))};
   });
   assert.ok(fx.borderWidth>=2,'Reveal state must have a strong correct answer border');
   assert.match(fx.rungColor,/gradient/,'Prize milestone is visibly banked');
   assert.equal(fx.privateKeyProtected,true);
   assert.equal(result.correct,1,'answer reveal '+i);
   assert.equal(result.earned,i+1,'earned rung count '+i);
   await screen.waitForFunction(level=>{
    const meter=document.querySelector('.million-public.big .ms-million-ladder-progress');
    return meter?.querySelector('.ms-million-progress-head strong')?.textContent===level+' / 5 SECURED';
   },i+1,{timeout:8000});
   const meter=await screen.evaluate(()=>{
    const meter=document.querySelector('.million-public.big .ms-million-ladder-progress');
    return meter.querySelector('.ms-million-progress-fill').style.width;
   });
   assert.equal(parseFloat(meter),(i+1)*20,'prize bar follows actually earned levels');
   assert.equal(result.noKey,true);
   assert.equal(result.complete,i===4,'completion '+i);
   if(i===4)assert.equal(result.stake,'1,000,000 PTS');
   if(i<4){
    await teacher.evaluate(()=>millionNextQuestion());
    await screen.waitForFunction(next=>{
     const board=document.querySelector('.million-public.big');
     return state.activityRun?.million?.questionIndex===next&&
      board?.dataset.msRevealStep==='ready'&&
      board.querySelector('.ms-million-question-number')?.textContent.includes(String(next+1).padStart(2,'0'));
    },i+1,{timeout:10000});
   }
  }
  assert.equal(await teacher.locator('#millionNextBtn').isDisabled(),true,'no next after million complete');
  await screen.waitForFunction(()=>document.querySelector('#msMillionStageCue')?.classList.contains('complete')===true,{timeout:6000});
  const finale=await screen.evaluate(()=>{
   const game=document.querySelector('.million-public.big')||document.querySelector('.million-public');
   const cue=document.querySelector('#msMillionStageCue');
   const crest=cue?.querySelector('.ms-million-cue-crest');
   const sparks=cue?.querySelector('.ms-million-cue-sparkles');
   const banner=game.querySelector('.million-complete');
   const active=game.querySelector('.million-rung.active');
   return {cue:cue?.className,crest:crest?.textContent,sparks:sparks?.textContent,
    crestAnimated:crest?getComputedStyle(crest).animationName:'',
    aria:crest?.getAttribute('aria-hidden'),
    banner:banner?.textContent||'',
    bannerBorder:banner?parseFloat(getComputedStyle(banner).borderTopWidth):0,
    bannerBackground:banner?getComputedStyle(banner).backgroundImage:'',
    activeBorder:active?getComputedStyle(active).borderTopColor:'',
    earned:game.querySelectorAll('.million-rung.earned').length,
    fourChoices:game.querySelectorAll('.million-choice').length,
    noPrivateKey:state.activityRun.millionConfig.questions.every(q=>!('correct' in q))};
  });
  assert.match(finale.cue,/complete/);
  assert.equal(finale.crest,'🏆');
  const finaleBeats=await screen.evaluate(()=>{
   const cue=document.querySelector('#msMillionStageCue');
   return {phase:cue.dataset.phase,footer:cue.querySelector('.ms-million-cue-footer')?.textContent,
    count:cue.querySelectorAll('.ms-million-cue-sequence i').length};
  });
  assert.deepEqual(finaleBeats,{phase:'complete',footer:'THE GRAND FINALE',count:5});
  const finaleHUD=await screen.evaluate(()=>{
   const board=document.querySelector('.million-public.big');
   const stage=board.querySelector('.million-stage');
   return {finalFlag:board.dataset.msFinalQuestion,
    progress:board.querySelector('.ms-million-ladder-progress')?.dataset.msComplete,
    questionHidden:getComputedStyle(stage.querySelector('.ms-million-question-band')).display};
  });
  assert.deepEqual(finaleHUD,{finalFlag:'false',progress:'true',questionHidden:'none'},
   'jackpot state ends the question spotlight and hides redundant stage header');
  assert.equal(finale.aria,'true');
  const coronation=await screen.evaluate(()=>{
   const board=document.querySelector('.million-public.big .ms-million-final-results');
   const crown=board.querySelector('.ms-million-victory-corona');
   return {champion:board.classList.contains('is-champion'),
    decoration:crown?.getAttribute('aria-hidden'),
    stars:crown?.querySelectorAll('span').length,
    animation:crown?getComputedStyle(crown).animationName:''};
  });
  assert.equal(coronation.champion,true);
  assert.equal(coronation.decoration,'true');
  assert.equal(coronation.stars,5);
  assert.match(coronation.animation,/ms3h-corona-bloom/);

  assert.match(finale.sparks,/✦/);
  assert.match(finale.banner,/MISSION COMPLETE/);
  assert.ok(finale.bannerBorder>=2&&finale.earned===5);
  assert.match(finale.bannerBackground,/gradient/);
  assert.equal(finale.fourChoices,4);
  assert.equal(finale.noPrivateKey,true);
  await screen.emulateMedia({reducedMotion:'reduce'});
  const reduced=await screen.evaluate(()=>{
   const p=document.querySelector('.million-public.big .million-choice.correct');
   return p?getComputedStyle(p).animationName:null;
  });
  assert.equal(reduced,'none','reveal motion respects reduced-motion preference');
  await screen.emulateMedia({reducedMotion:'no-preference'});
  await screen.waitForFunction(()=>!!document.querySelector('.million-public.big .ms-million-final-results'),
    null,{timeout:6500});
  const results=await screen.evaluate(()=>{
    const board=document.querySelector('.million-public.big .ms-million-final-results');
    const metrics=[...board.querySelectorAll('.ms-million-final-metrics strong')].map(x=>x.textContent);
    const rect=board.getBoundingClientRect();
    return {title:board.querySelector('.ms-million-final-header h3')?.textContent,
      value:board.querySelector('.ms-million-final-prize strong')?.textContent,
      metrics,count:document.querySelectorAll('.million-public.big .ms-million-final-results').length,
      rect:{left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width),height:Math.round(rect.height)},viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,stageWidth:Math.round(board.parentElement.getBoundingClientRect().width),inViewport:rect.width>200&&rect.left>=0&&rect.right<=innerWidth+5,
      privateAnswerHidden:!('correct' in state.activityRun.millionConfig.questions[0])};
  });
  assert.deepEqual([results.title,results.value],['MILLION COMPLETE','1,000,000 POINTS']);
  assert.deepEqual(results.metrics,['5 / 5','5 / 5']);
  assert.equal(results.count,1);
  console.log('MILLION FINAL RESULTS GEOMETRY',JSON.stringify(results));
  assert.ok(results.inViewport&&results.privateAnswerHidden);
  await teacher.waitForFunction(()=>!!document.querySelector('#activityControllerPanel .ms-million-final-results'),
    null,{timeout:6500});
  const finishHUD=await teacher.evaluate(()=>{
   const dock=document.querySelector('#siUnifiedTeacherDeck');
   return {finished:dock?.dataset.finished,
    text:dock?.querySelector('.si-utc-finish')?.textContent,
    disabled:dock?.querySelector('.si-utc-finish')?.disabled,
    prize:dock?.textContent.includes('FINAL POINTS')};
  });
  assert.deepEqual(finishHUD,{finished:'true',text:'Return to Class',disabled:false,prize:true},
   'Mission Control displays native postgame return and final prize');


  // Ensure game-over stops after a wrong classic answer instead of silently proceeding.
  await teacher.evaluate(()=>{
   const m=state.activityRun.million,cfg=state.activityRun.millionConfig;
   cfg.risk='classic';m.complete=false;m.over=false;m.revealed=false;m.result='';m.questionIndex=1;
   m.ladderLevel=1;m.lockedAnswer='A';m.selectedAnswer='A';m.publicCorrect='';render();
   millionResolve(false);
  });
  const ended=await teacher.evaluate(()=>{
    const before=state.activityRun.million.questionIndex;
    millionNextQuestion();
    return {before,after:state.activityRun.million.questionIndex,over:state.activityRun.million.over,
      nextDisabled:document.querySelector('#millionNextBtn')?.disabled};
  });
  assert.equal(ended.over,true);
  assert.equal(ended.before,ended.after,'classic risk game cannot advance');
  assert.equal(ended.nextDisabled,true);
  // Phase 3C: read the actual rolled-back checkpoint, not guessed winnings.
  await screen.waitForFunction(()=>document.querySelector('.million-public.big .ms-million-final-results')?.querySelector('.ms-million-final-prize>span')?.textContent==='CHECKPOINT POINTS',null,{timeout:12000});
  const classic=await teacher.evaluate(()=>{
   const m=state.activityRun.million,cfg=state.activityRun.millionConfig;
   return {level:m.ladderLevel,amount:m.ladderLevel?cfg.ladder[m.ladderLevel-1]:0};
  });
  const classicShown=await screen.evaluate(()=>{
   const r=document.querySelector('.million-public.big .ms-million-final-results');
   return {label:r.querySelector('.ms-million-final-prize>span').textContent,
    money:r.querySelector('.ms-million-final-prize>strong').textContent,
    description:r.querySelector('.ms-million-final-description').textContent};
  });
  assert.equal(classicShown.money,Number(classic.amount).toLocaleString('en-US')+' POINTS');
  assert.match(classicShown.description,/Classic mode/);
  const finalSizes=[];
  for(const [width,height] of [[880,720],[700,500]]){
   await screen.setViewportSize({width,height});
   await screen.waitForTimeout(100);
   const g=await screen.evaluate(()=>{
    const panel=document.querySelector('.million-public.big .ms-million-final-results');
    const b=panel.getBoundingClientRect();
    return {viewport:innerWidth,page:document.documentElement.scrollWidth,
     left:b.left,right:b.right,width:b.width,height:b.height,
     amount:panel.querySelector('.ms-million-final-prize strong').textContent,
     hiddenPreview:!!document.querySelector('.million-public:not(.big) .ms-million-final-results')};
   });
   finalSizes.push({size:width+'x'+height,...g});
   assert.ok(g.width>170&&g.left>=-5&&g.right<=width+5&&g.page<=width+36,
    'compact MILLION final results remain horizontally visible: '+JSON.stringify(g));
   assert.equal(g.hiddenPreview,false,'final results must not mount in hidden preview');
  }
  // A new, early classic loss must replace the previous final state with $0.
  await teacher.evaluate(()=>{
   const m=state.activityRun.million;
   Object.assign(m,{complete:false,over:false,revealed:false,result:'',questionIndex:0,
    ladderLevel:0,lockedAnswer:'A',selectedAnswer:'A',publicCorrect:''});
   millionResolve(false);
  });
  const zeroFrame=await screen.waitForFunction(()=>{
   const p=document.querySelector('.million-public.big .ms-million-final-results');
   if(p?.querySelector('.ms-million-final-prize strong')?.textContent!=='0 POINTS')return false;
   return p.querySelector('.ms-million-final-description')?.textContent||false;
  },null,{timeout:12000});
  const zero=await zeroFrame.jsonValue();
  assert.match(zero,/no safe checkpoint/i);
  // Returning to class clears the results; no previously earned prize is cached.
  teacher.on('dialog',dialog=>dialog.accept());
  await teacher.locator('#siUnifiedTeacherDeck .si-utc-finish').click();
  await teacher.waitForFunction(()=>!state.activityRun||state.activityRun.activityId!=='million-game',
   null,{timeout:12000});
  await screen.waitForFunction(()=>!document.querySelector('.million-public.big .ms-million-final-results'),null,{timeout:12000});
  const clearedLifeline=await screen.evaluate(()=>{
   const cue=document.querySelector('#msMillionLifelineCue');
   return !cue||!cue.classList.contains('is-visible');
  });
  assert.equal(clearedLifeline,true,'lifeline visuals clear on return to class');

  assert.equal(errors.length,0,'browser JS errors: '+JSON.stringify(errors));
  console.log(JSON.stringify({test:'MILLION five-question teacher/projector multiplayer, Phase 3A.2 cinematic finale, 50/50 and classic-risk stop',first,phase3Visual,finale,fifty,pilot50,layout,ended,pageErrors:errors}));
  // Leave the isolated app clean so unrelated SI+ and Activity Library smoke
  // tests never inherit a synthetic MILLION session.
  await teacher.evaluate(()=>{state.activityRun=null;state.screen='classroom';state.activeApp=null;render()});
  await teacher.waitForTimeout(350);
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
