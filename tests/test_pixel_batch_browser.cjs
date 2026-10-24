/* PIXEL REVEAL multi-image regression — isolated localhost only.
   Tests batch upload, per-image answer editing, saved draft restoration,
   round-specific private guesses, teacher navigation and legacy compatibility. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error('PIXEL batch browser tests are restricted to isolated localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1366,height:920}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 const setup=async()=>{
  await page.evaluate(()=>{
   state.screen='activities';state.activeApp='pixel';state.activityRun=null;
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   render();
  });
  await page.locator('.pixel-batch-manager').waitFor();
 };
 try{
  assert.equal((await context.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  assert.equal((await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000})).status(),200);
  await page.waitForFunction(()=>window.SIPixelBatch&&typeof launchPixel==='function',null,{timeout:20000});
  await setup();
  assert.equal(await page.locator('#pixelImageFile').getAttribute('multiple'),'');
  const data=await page.evaluate(()=>{
   return ['#ed3b53','#41baff','#f5c14e'].map(color=>{
    const c=document.createElement('canvas');c.width=96;c.height=64;
    const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,96,64);
    x.fillStyle='#ffffff';x.fillRect(10,10,22,22);
    return c.toDataURL('image/png').split(',')[1];
   });
  });
  await page.locator('#pixelImageFile').setInputFiles(data.map((base64,i)=>({
   name:['apple.png','boat.png','train.png'][i],mimeType:'image/png',buffer:Buffer.from(base64,'base64')
  })));
  await page.waitForFunction(()=>state.pixelDraft?.images?.length===3,null,{timeout:20000});
  await page.locator('.pixel-batch-item').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('.pixel-batch-upload-status')?.textContent?.includes('3 images added'),null,{timeout:10000});
  assert.match(await page.locator('.pixel-batch-upload-status').innerText(),/3 of 12 rounds ready/,
   'teacher sees an accurate upload result and remaining image capacity');
  assert.equal(await page.locator('#pixelImageFile').inputValue(),'',
   'teacher can retry the same selected files after an upload');
  assert.equal(await page.locator('.pixel-batch-item').count(),3);
  assert.equal(await page.locator('.pixel-studio-inspector-art img').count(),1,
   'the teacher has a large selected-image preview');
  assert.match(await page.locator('.pixel-studio-inspector-heading').innerText(),/IMAGE 1 OF 3/);
  await page.locator('[data-pixel-inspector-next]').click();
  assert.equal(await page.evaluate(()=>state.pixelDraft.imageIndex),1,
   'large preview Next control edits the following image');
  assert.match(await page.locator('.pixel-studio-inspector-heading').innerText(),/IMAGE 2 OF 3/);
  await page.locator('[data-pixel-inspector-prev]').click();
  assert.equal(await page.evaluate(()=>state.pixelDraft.imageIndex),0,
   'large preview Previous returns to the original image');
  assert.equal(await page.locator('[data-pixel-inspector-prev]').isDisabled(),true);

  assert.match(await page.locator('.pixel-studio-round-progress strong').innerText(),
   /0 of 3 image answers ready/,'fresh images show missing answers');
  assert.equal(await page.locator('.pixel-batch-item[data-answer-ready="no"]').count(),3,
   'all uploaded images are flagged as requiring a main answer');
  await page.locator('[data-pixel-next-missing]').click();
  assert.equal(await page.evaluate(()=>state.pixelDraft.imageIndex),1,
   'next missing answer shortcut selects the next unanswered image');
  assert.match(await page.locator('#pixel-studio-answer-help').innerText(),/Image 2 of 3/);
  await page.locator('[data-pixel-batch-select="0"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pixel-batch-pick[aria-pressed="true"]').length===1,null,{timeout:12000});
  assert.equal(await page.locator('.pixel-batch-pick[aria-pressed="true"]').count(),1);
  await page.locator('#pixelAnswer').fill('Apple');
  await page.locator('#pixelAcceptedAnswers').fill('Apple\nRed apple');
  await page.locator('[data-pixel-batch-select="1"]').click();
  await page.locator('#pixelAnswer').fill('Boat');
  await page.locator('[data-pixel-batch-select="2"]').click();
  await page.locator('#pixelAnswer').fill('Train');
  await page.locator('[data-pixel-batch-left="2"]').click();
  const organized=await page.evaluate(()=>({
   answers:state.pixelDraft.images.map(x=>x.answer),
   selected:state.pixelDraft.imageIndex,
   accepted:state.pixelDraft.images[0].acceptedAnswers,
   size:state.pixelDraft.images.map(x=>x.image.length)
  }));
  assert.deepEqual(organized.answers,['Apple','Train','Boat']);
  assert.equal(await page.locator('.pixel-batch-item[data-answer-ready="yes"]').count(),3,
   'each image thumbnail reflects its configured answer');
  assert.match(await page.locator('.pixel-studio-round-progress strong').innerText(),
   /3 of 3 image answers ready/);
  assert.equal(await page.locator('[data-pixel-next-missing]').isDisabled(),true,
   'the next-missing shortcut becomes disabled when all images are answered');
  assert.equal(organized.selected,1);
  assert.match(await page.locator('.pixel-studio-inspector-answer').innerText(),/Train/,
   'large preview follows the selected image and shows only the teacher its answer');
  const previewImage=await page.locator('.pixel-studio-inspector-art img').getAttribute('src');
  assert.equal(previewImage,await page.evaluate(()=>state.pixelDraft.images[1].image),
   'large teacher preview uses the correctly reordered image');

  assert.ok(organized.accepted.includes('Red apple'));
  assert.ok(organized.size.every(x=>x<200000),'batch uploads compressed for browser save');
  await page.locator('#savePixelBtn').click();
  await page.locator('.pixel-studio-saved-card').first().waitFor();
  assert.match(await page.locator('.pixel-studio-library-head').innerText(),/SAVED ACTIVITIES/);
  assert.equal(await page.locator('.pixel-studio-saved-card img').count(),1,
   'saved card shows an actual mystery image thumbnail');
  assert.match(await page.locator('.pixel-studio-saved-card small').first().innerText(),
   /3 images .* 3\/3 answers set/,
   'saved card summarizes multiple rounds and completed answers');
  assert.equal(await page.locator('[data-load-pixel]').first().innerText(),'Edit / Load',
   'saved activity opens through the native edit/load control');
  assert.equal(await page.locator('#launchPixelBtn').innerText(),'▶ Launch game',
   'launch remains a distinct native action');
  assert.match(await page.locator('.pixel-studio-save-state').innerText(),/Saved in this browser/);
  assert.equal(await page.locator('#pixelStudioSearch').count(),1);
  await page.locator('#pixelStudioSearch').fill('does not exist');
  assert.equal(await page.locator('.pixel-studio-saved-card:visible').count(),0,
   'saved-activity search hides nonmatching cards without deleting them');
  await page.locator('#pixelStudioSearch').fill('Giraffe Mystery');
  assert.equal(await page.locator('.pixel-studio-saved-card:visible').count(),1,
   'saved-activity search finds the matching mystery');
  await page.locator('#pixelStudioSearch').fill('');
  const saved=await page.evaluate(()=>loadSavedPixels().find(x=>x.name==='Giraffe Mystery'));
  assert.equal(saved?.images?.length,3,'saved activity includes all images');
  assert.ok(saved.images[1].acceptedAnswers.includes('Train'),
   'native save preserves the current image primary answer as accepted');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SIPixelBatch&&typeof render==='function',null,{timeout:20000});
  await setup();
  await page.locator('[data-load-pixel]').first().click();
  const restored=await page.evaluate(()=>state.pixelDraft.images.map(x=>x.answer));
  assert.deepEqual(restored,['Apple','Train','Boat'],'save and reload retains image order and answers');
  await page.locator('#launchPixelBtn').click();
  await page.evaluate(()=>{
   initializePixelRun(state.activityRun);
   state.activityRun.phase='running';
   render();
  });
  await page.locator('.pixel-batch-live').waitFor();
  assert.match(await page.locator('.pixel-batch-live').innerText(),/IMAGE 1 OF 3/);
  // Teacher Mission Control: responsive, high-contrast, and still wired to
  // native reveal/navigation, guess correction, and session actions.
  await page.locator('.pixel-teacher-progress').waitFor();
  const teacherPanel=await page.evaluate(()=>{
   const root=document.querySelector('#activityControllerPanel');
   const grid=root.querySelector('.pixel-controller-grid');
   const prog=root.querySelector('.pixel-teacher-progress-track');
   const buttons=[...root.querySelectorAll('.pixel-reveal-buttons button')];
   return {
    enhanced:grid.dataset.pixelTeacherEnhanced,
    heading:root.querySelector('.pixel-teacher-command-kicker')?.textContent.trim(),
    preview:root.querySelector('.pixel-teacher-preview-head')?.textContent,
    progress:prog?.getAttribute('aria-valuenow'),
    total:prog?.getAttribute('aria-valuemax'),
    buttonCount:buttons.length,
    actionCount:root.querySelectorAll('.pixel-control-side .board-global-actions button').length,
    revealBackground:getComputedStyle(buttons[0]).backgroundImage,
    columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    hiddenResult:root.querySelector('#pixelResultsBtn').disabled
   };
  });
  assert.equal(teacherPanel.enhanced,'true');
  assert.match(teacherPanel.heading,/MISSION OPERATIONS/);
  assert.match(teacherPanel.preview,/MISSION VISUAL/);
  assert.equal(teacherPanel.progress,'0');
  assert.ok(Number(teacherPanel.total)>0);
  assert.equal(teacherPanel.buttonCount,4);
  assert.equal(teacherPanel.actionCount,3);
  assert.equal(teacherPanel.hiddenResult,true);
  assert.match(teacherPanel.revealBackground,/gradient/);
  assert.equal(teacherPanel.columns,2);
  await page.locator('[data-pixel-reveal="1"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun.pixelRevealed.length),1,
   'polished reveal button still calls native PIXEL REVEAL action');
  assert.equal(await page.locator('.pixel-teacher-progress-track').getAttribute('aria-valuenow'),'1',
   'live progress meter tracks the actual revealed tile count');
  await page.setViewportSize({width:1049,height:797});
  const modalWidth=await page.evaluate(()=>{
   const g=document.querySelector('.pixel-controller-grid');
   return {grid:g.scrollWidth-g.clientWidth,side:g.querySelector('.pixel-control-side').scrollWidth-
    g.querySelector('.pixel-control-side').clientWidth};
  });
  assert.ok(modalWidth.grid<=3&&modalWidth.side<=3,
   'teacher panel fits the 1049px laptop/screenshot viewport');
  await page.setViewportSize({width:790,height:850});
  const tablet=await page.evaluate(()=>{
   const g=document.querySelector('.pixel-controller-grid');
   return {columns:getComputedStyle(g).gridTemplateColumns.split(' ').length,
    overflow:g.scrollWidth-g.clientWidth};
  });
  assert.equal(tablet.columns,1,'tablet teacher controls stack below the mystery board');
  assert.ok(tablet.overflow<=3);
  await page.setViewportSize({width:1366,height:920});
  await page.evaluate(()=>{
   state.activityRun.pixelGuesses={Alex:{guess:'Apple',at:10,firstCorrectRemaining:24}};
   state.activityRun.pixelRevealed=[0,1,2];
   render();
  });
  await page.locator('[data-pixel-round-next]').click();
  const second=await page.evaluate(()=>({
   index:state.activityRun.pixelImageIndex,
   answer:state.activityRun.pixelConfig.answer,
   guesses:Object.keys(state.activityRun.pixelGuesses),
   revealed:state.activityRun.pixelRevealed.length,
   badge:pixelSharedMarkup(state.activityRun,true).includes('IMAGE 2 / 3')
  }));
  assert.deepEqual(second,{index:1,answer:'Train',guesses:[],revealed:0,badge:true});
  await page.evaluate(()=>{
   state.activityRun.pixelGuesses={Blair:{guess:'Train',at:20}};
   render();
  });
  await page.locator('[data-pixel-round-prev]').click();
  const first=await page.evaluate(()=>({
   index:state.activityRun.pixelImageIndex,
   answer:state.activityRun.pixelConfig.answer,
   guess:state.activityRun.pixelGuesses.Alex?.guess,
   tiles:state.activityRun.pixelRevealed.length
  }));
  assert.deepEqual(first,{index:0,answer:'Apple',guess:'Apple',tiles:3},
   'returning to an earlier image restores its guesses and reveal state');
  // Phase 4E: render actual shared-screen markup in a visible isolated
  // classroom fixture, without touching live Railway or storing test data.
  const initialCinema=await page.evaluate(()=>{
   // Simulate reopening a previously played image under a fresh local
   // visual identity; native submission/round data stays the same.
   state.activityRun.runToken='pixel-phase4e-reopened-fixture';
   const mount=document.createElement('section');
   mount.id='pixelCinematicTestStage';
   mount.style.cssText='width:100%;max-width:1120px;margin:auto';
   mount.innerHTML=pixelSharedMarkup(state.activityRun,true);
   document.body.append(mount);
   window.SIPixelBatch.enhanceCinematic(); // seed the already-revealed tiles
   const progress=mount.querySelector('.pixel-cinematic-track');
   return {
    stage:mount.querySelectorAll('.pixel-cinematic-public').length,
    progress:progress?.getAttribute('aria-valuenow'),
    max:progress?.getAttribute('aria-valuemax'),
    imageRounds:mount.querySelectorAll('.pixel-cinematic-round').length,
    current:mount.querySelector('.pixel-cinematic-round.is-current')?.textContent,
    existingAnimated:mount.querySelectorAll('.pixel-cinematic-dissolve').length,
    concealed:!mount.textContent.includes('Apple'),
    grid:mount.querySelector('.pixel-cover-grid')?.children.length
   };
  });
  assert.equal(initialCinema.stage,1,'shared-screen cinematic mystery is rendered');
  assert.equal(initialCinema.progress,'3','public meter reflects native reveal state');
  assert.ok(Number(initialCinema.max)>=3);
  assert.equal(initialCinema.imageRounds,3);
  assert.equal(initialCinema.current,'1');
  assert.equal(initialCinema.existingAnimated,0,
   'reopened or previously revealed tiles never replay entrance effects');
  assert.equal(initialCinema.concealed,true,'public progress must never leak the mystery answer');
  assert.ok(initialCinema.grid>=9,'all grid cover tiles remain available');

  const newTile=await page.evaluate(()=>{
   state.activityRun.pixelRevealed.push(3);
   const mount=document.querySelector('#pixelCinematicTestStage');
   mount.innerHTML=pixelSharedMarkup(state.activityRun,true);
   window.SIPixelBatch.enhanceCinematic();
   const tile=mount.querySelectorAll('.pixel-cover')[3];
   const progress=mount.querySelector('.pixel-cinematic-track');
   return {fourth:tile?.classList.contains('pixel-cinematic-dissolve'),
    css:getComputedStyle(tile).animationName,
    progress:progress?.getAttribute('aria-valuenow'),
    answerHidden:!mount.textContent.includes('Apple')};
  });
  assert.deepEqual([newTile.fourth,newTile.progress,newTile.answerHidden],[true,'4',true]);
  assert.match(newTile.css,/pixel-cinematic-tile-dissolve/,
   'newly revealed tiles have a luminous one-off animation');
  await page.waitForTimeout(1180);
  const noReplay=await page.evaluate(()=>{
   const mount=document.querySelector('#pixelCinematicTestStage');
   mount.innerHTML=pixelSharedMarkup(state.activityRun,true);
   window.SIPixelBatch.enhanceCinematic();
   return mount.querySelectorAll('.pixel-cinematic-dissolve').length;
  });
  assert.equal(noReplay,0,'periodic classroom rerenders never replay old tile animations');

  const roundCinema=await page.evaluate(()=>{
   window.SIPixelBatch.switchRound(1);
   const mount=document.querySelector('#pixelCinematicTestStage');
   mount.innerHTML=pixelSharedMarkup(state.activityRun,true);
   window.SIPixelBatch.enhanceCinematic();
   const current=mount.querySelector('.pixel-cinematic-round.is-current');
   const progress=mount.querySelector('.pixel-cinematic-track');
   return {current:current?.textContent,rounds:mount.querySelectorAll('.pixel-cinematic-round').length,
    entered:!!mount.querySelector('.pixel-cinematic-arriving'),
    progress:progress?.getAttribute('aria-valuenow'),
    noRevealed:mount.querySelectorAll('.pixel-cover.revealed').length,
    hiddenAnswer:!mount.textContent.includes('Train')};
  });
  assert.deepEqual(roundCinema,{current:'2',rounds:3,entered:true,
   progress:'0',noRevealed:0,hiddenAnswer:true},
   'switching image rounds animates arrival while resetting only that round');
  const restoredCinema=await page.evaluate(()=>{
   window.SIPixelBatch.switchRound(0);
   const mount=document.querySelector('#pixelCinematicTestStage');
   mount.innerHTML=pixelSharedMarkup(state.activityRun,true);
   window.SIPixelBatch.enhanceCinematic();
   return {index:state.activityRun.pixelImageIndex,
    revealed:state.activityRun.pixelRevealed.length,
    newTiles:mount.querySelectorAll('.pixel-cinematic-dissolve').length};
  });
  assert.deepEqual(restoredCinema,{index:0,revealed:4,newTiles:0},
   'returning to a previous image restores its exact state without replaying reveals');

  const finalCinema=await page.evaluate(()=>{
   revealPixelAll();
   const mount=document.querySelector('#pixelCinematicTestStage');
   mount.innerHTML=pixelSharedMarkup(state.activityRun,true);
   window.SIPixelBatch.enhanceCinematic();
   const status=mount.querySelector('.pixel-cinematic-acquired');
   return {status:status?.textContent.trim(),
    celebrating:!!mount.querySelector('.pixel-cinematic-celebrating'),
    progress:mount.querySelector('.pixel-cinematic-track')?.getAttribute('aria-valuenow'),
    all:mount.querySelectorAll('.pixel-cover:not(.revealed)').length,
    noAnswer:!mount.textContent.includes('Apple'),
    resultsHidden:!state.activityRun.pixelShowResults};
  });
  assert.match(finalCinema.status,/SIGNAL ACQUIRED/);
  assert.equal(finalCinema.celebrating,true);
  assert.equal(finalCinema.progress,String(initialCinema.max));
  assert.equal(finalCinema.all,0);
  assert.equal(finalCinema.noAnswer,true,
   'unlocking an image does not reveal the answer until teacher selects Results');
  assert.equal(finalCinema.resultsHidden,true);
  const resultCinema=await page.evaluate(()=>{
   state.activityRun.pixelShowResults=true;
   const mount=document.querySelector('#pixelCinematicTestStage');
   mount.innerHTML=pixelSharedMarkup(state.activityRun,true);
   return {result:!!mount.querySelector('.pixel-cinematic-results'),
    answer:mount.querySelector('.pixel-results>h3')?.textContent,
    rounds:mount.querySelectorAll('.pixel-cinematic-round').length};
  });
  assert.deepEqual(resultCinema,{result:true,answer:'Apple',rounds:3},
   'native teacher-controlled result reveal still works with the cinematic stage');
  // Focus mode and reduced motion must be as usable as the tile mode.
  const focusCinema=await page.evaluate(()=>{
   const run={...state.activityRun,pixelConfig:{
    ...state.activityRun.pixelConfig,revealStyle:'focus'
   },pixelFocusStage:4,pixelRevealAll:false,pixelShowResults:false};
   const mount=document.querySelector('#pixelCinematicTestStage');
   mount.innerHTML=pixelSharedMarkup(run,true);
   return {focus:!!mount.querySelector('.pixel-cinematic-public .pixel-focus-board'),
    progress:mount.querySelector('.pixel-cinematic-track')?.getAttribute('aria-valuenow'),
    full:mount.querySelector('.pixel-cinematic-track')?.getAttribute('aria-valuemax')};
  });
  assert.deepEqual(focusCinema,{focus:true,progress:'4',full:'10'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>{
   const mount=document.querySelector('#pixelCinematicTestStage');
   const board=mount.querySelector('.pixel-focus-board');
   board.classList.add('pixel-cinematic-focus-up');
   const animation=getComputedStyle(board).animationName;
   const r=mount.getBoundingClientRect();
   return {animation,overflow:mount.scrollWidth-mount.clientWidth,
    width:r.width};
  });
  assert.equal(reduced.animation,'none','reduced motion disables cinematic effects');
  assert.ok(reduced.overflow<=3,'cinematic shared screen stays within its viewport');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>document.querySelector('#pixelCinematicTestStage')?.remove());
  console.log('PIXEL Phase 4E cinematic HUD, one-shot tile dissolves, multi-round transition, focus and result privacy PASSED',
   JSON.stringify({initialCinema,newTile,roundCinema,restoredCinema,finalCinema,reduced}));
  // Student PIXEL viewport check: native button lives beside the input.
  await page.setViewportSize({width:390,height:844});
  const studentCompact=await page.evaluate(()=>{
    state.selectedStudent='Alex';state.students=[{n:'Alex',offline:false}];
    state.activityRun.pixelGuesses={};state.activityRun.pixelShowResults=false;
    state.activityRun.pixelRevealAll=false;state.activityRun.phase='running';
    state.screen='activity';
    document.body.classList.add('role-student');
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='student'));
    renderPublic();window.SIPixelBatch.enhanceStudent();
    const card=document.querySelector('#studentContent .pixel-student-simple');
    const button=card?.querySelector('#sendPixelGuessBtn');
    const input=card?.querySelector('#pixelGuessInput');
    const result={card:!!card,button:!!button,
      header:card?.querySelector('h2')?.textContent,
      gap:button&&input?button.getBoundingClientRect().top-input.getBoundingClientRect().bottom:999,
      disabled:button?.disabled,
      overflow:Math.max(0,
        document.querySelector('#student .device').scrollWidth-document.querySelector('#student .device').clientWidth,
        document.querySelector('#studentContent').scrollWidth-document.querySelector('#studentContent').clientWidth,
        card.scrollWidth-card.clientWidth)};
    document.body.classList.remove('role-student');
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='teacher'));
    return result;
  });
  assert.equal(studentCompact.header,'What do you see?');
  assert.equal(studentCompact.button,true);
  assert.equal(studentCompact.disabled,true);
  // Reusing a compact student panel must never leave an outdated round badge.
  const badgeRefresh=await page.evaluate(()=>{
    const card=document.querySelector('#studentContent .pixel-student-simple');
    const badge=card?.querySelector('.pixel-student-round');
    document.body.classList.add('role-student');
    state.activityRun.pixelImageIndex=1;
    window.SIPixelBatch.enhanceStudent();
    const updated=badge?.textContent;
    const aria=badge?.getAttribute('aria-label');
    state.activityRun.pixelImageIndex=0;
    window.SIPixelBatch.enhanceStudent();
    document.body.classList.remove('role-student');
    return {updated,aria,restored:badge?.textContent};
  });
  assert.deepEqual(badgeRefresh,{updated:'IMAGE 2 / 3',aria:'Image 2 of 3',
   restored:'IMAGE 1 / 3'},'student counter updates when a reused panel switches images');

  assert.ok(studentCompact.gap>=0&&studentCompact.gap<=23);
  assert.ok(studentCompact.overflow<=3);
  const studentSent=await page.evaluate(()=>{
    state.activityRun.pixelConfig.allowUpdates=false;
    document.body.classList.add('role-student');
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='student'));
    renderPublic();window.SIPixelBatch.enhanceStudent();
    const input=document.querySelector('#studentContent #pixelGuessInput');
    input.value='Apple';input.dispatchEvent(new Event('input',{bubbles:true}));
    const send=document.querySelector('#studentContent #sendPixelGuessBtn');
    const enabled=!send.disabled;send.click();
    window.SIPixelBatch.enhanceStudent();
    const result={
      enabled,stored:state.activityRun.pixelGuesses?.Alex?.guess,
      confirmation:document.querySelector('#studentContent .pixel-student-locked h2')?.textContent,
      privateLabel:document.querySelector('#studentContent .pixel-student-confirmation p')?.textContent
    };
    document.body.classList.remove('role-student');
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='teacher'));
    return result;
  });
  assert.equal(studentSent.enabled,true);
  assert.equal(studentSent.stored,'Apple');
  assert.equal(studentSent.confirmation,'Guess sent!');
  assert.match(studentSent.privateLabel,/teacher can see/);
  await page.setViewportSize({width:1366,height:920});
  await page.evaluate(()=>{
   state.screen='activities';state.activeApp='pixel';
   state.pixelDraft=defaultPixelDraft();state.activityRun=null;render();
  });
  await page.locator('.pixel-batch-manager').waitFor();
  assert.equal(await page.locator('.pixel-batch-item').count(),1,
   'legacy single-image draft still works');
  // Test all twelve real organizer cards without uploading large classroom
  // images. Each entry reuses a tiny isolated fixture picture.
  await page.evaluate(()=>{
   const d=state.pixelDraft,base=d.images[0].image;
   d.images=Array.from({length:12},(_,i)=>({image:base,
    answer:'Picture '+(i+1),acceptedAnswers:['Picture '+(i+1)]}));
   d.imageIndex=0;d.image=base;d.answer='Picture 1';d.acceptedAnswers=['Picture 1'];
   renderActivities();
  });
  await page.waitForFunction(()=>document.querySelectorAll('.pixel-batch-item').length===12,null,{timeout:12000});
  assert.equal(await page.locator('.pixel-batch-item').count(),12);
  assert.equal(await page.locator('.pixel-studio-round-progress [role="progressbar"]').getAttribute('aria-valuemax'),'12');
  await page.locator('[data-pixel-batch-select="11"]').click();
  assert.match(await page.locator('.pixel-studio-inspector-heading').innerText(),/IMAGE 12 OF 12/);
  assert.equal(await page.locator('[data-pixel-inspector-next]').isDisabled(),true);
  const twelveDesktop=await page.evaluate(()=>{
   const el=document.querySelector('.pixel-batch-list');
   return {cols:getComputedStyle(el).gridTemplateColumns.split(' ').length,overflow:el.scrollWidth-el.clientWidth};
  });
  assert.equal(twelveDesktop.cols,4,'desktop organizes twelve images in four visible columns');
  assert.ok(twelveDesktop.overflow<=3);
  await page.setViewportSize({width:440,height:780});
  const twelveCompact=await page.evaluate(()=>{
   const panel=document.querySelector('.pixel-batch-manager');
   const list=panel.querySelector('.pixel-batch-list');
   const inspector=panel.querySelector('.pixel-studio-inspector');
   return {cols:getComputedStyle(list).gridTemplateColumns.split(' ').length,
    overflow:panel.scrollWidth-panel.clientWidth,
    inspectorOverflow:inspector.scrollWidth-inspector.clientWidth};
  });
  assert.equal(twelveCompact.cols,2);
  assert.ok(twelveCompact.overflow<=3&&twelveCompact.inspectorOverflow<=3,
   'all twelve editable rounds and large preview fit the compact teacher viewport');
  await page.setViewportSize({width:1366,height:920});

  await page.setViewportSize({width:490,height:820});
  const width=await page.evaluate(()=>({
   overflow:document.querySelector('.pixel-batch-manager').scrollWidth-
    document.querySelector('.pixel-batch-manager').clientWidth,
   columns:getComputedStyle(document.querySelector('.pixel-batch-list')).gridTemplateColumns
  }));
  assert.ok(width.overflow<=3,'compact teacher batch organizer has no horizontal overflow');
  // Saved activities beyond the eight native preview cards remain accessible.
  await page.evaluate(()=>{
   const source=loadSavedPixels()[0];
   const older=Array.from({length:11},(_,i)=>({...source,
    savedId:'pixel_fixture_'+i,name:'Archived Mystery '+i}));
   localStorage.setItem(PIXEL_STORE,JSON.stringify(older));
   renderActivities();
  });
  await page.locator('.pixel-studio-more summary').click();
  await page.locator('#pixelStudioSearch').fill('Archived Mystery 10');
  assert.equal(await page.locator('.pixel-studio-saved-card:visible').count(),1,
   'saved-activity search includes older activities and expands matching results');
  assert.equal(await page.locator('.pixel-studio-more').getAttribute('open'),'',
   'older results open automatically during search');
  await page.locator('#pixelStudioSearch').fill('');
  
  assert.equal(await page.locator('[data-pixel-studio-load]').count(),3,
   'all eleven saved records remain accessible beyond the first eight');
  await page.locator('[data-pixel-studio-load]').last().click();
  assert.equal(await page.evaluate(()=>state.pixelDraft.name),'Archived Mystery 10',
   'older saved activities load through the same teacher editor');
  await page.locator('#pixelName').fill('Edited Archived Mystery');
  assert.match(await page.locator('.pixel-studio-save-state').innerText(),/Changes not saved/);
  assert.ok((await page.locator('.pixel-setup').evaluate(e=>e.scrollWidth-e.clientWidth))<=3,
   'compact saved-library and studio actions do not overflow');
  assert.deepEqual(errors,[],'no PIXEL REVEAL browser errors');
  console.log('PIXEL batch upload + per-image answers + save/reload + teacher navigation PASSED',
   JSON.stringify({organized,second,first,width}));
 }finally{await context.close();await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
