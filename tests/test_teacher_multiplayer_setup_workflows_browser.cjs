/* Phase 2F: real teacher setup controls, runtime launch, browser-saved resumes.
   Isolated localhost ONLY. Never resets a production session or its data volume. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8880';
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error('Phase 2F setup workflow must use isolated localhost');
const students=()=>[{n:'Alex',offline:false},{n:'Blair',offline:false},{n:'Casey',offline:false}];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1360,height:950}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 page.on('dialog',d=>d.type()==='prompt'?d.accept('Phase 2F Saved Mission'):d.accept());
 const open=async app=>{
  await page.evaluate(({app,roster})=>{
   state.students=roster;state.screen='activities';state.activeApp=app;
   state.assigningSlot=null;state.ended=false;state.activityRun=null;
   render();
  },{app,roster:students()});
  // Native setup controls, not the optional unified-studio badge, determine
  // whether the game is ready. The badge is installed asynchronously and can
  // lag the actual setup after a saved-game page reload.
  const setup={ 'cosmic-cards':'.cc-setup',dominoes:'.dm-setup',
   'four-in-line':'.fil-setup','signal-sequence':'.ss-setup'}[app];
  if(!setup)throw Error('No setup fixture configured for '+app);
  try{
   await page.locator('#activitiesPanel #activityGrid '+setup)
    .waitFor({state:'visible',timeout:16000});
  }catch(error){
   const info=await page.evaluate(()=>({
    screen:state.screen,app:state.activeApp,run:state.activityRun?.activityId||null,
    bridge:!!window.__signalSequenceBridge,hydrated:networkHydrated,
    setup:document.querySelector('#activityGrid')?.querySelector('.ss-setup')?.outerHTML.slice(0,250)||null,
    panel:document.querySelector('#activitiesPanel')?.getAttribute('class'),
    banner:document.querySelector('#activitiesPanel')?.dataset.siSetup||null
   }));
   console.error('Phase 2F setup diagnostic '+app,JSON.stringify(info));
   throw error;
  }
 };
 const fit=async(app,selector)=>{
  await page.setViewportSize({width:500,height:900});
  const result=await page.evaluate(selector=>{
   const panel=document.querySelector('#activitiesPanel'),root=panel?.querySelector(selector);
   if(!root)throw Error('No setup root '+selector);
   const b=panel.getBoundingClientRect(),r=root.getBoundingClientRect();
   return {viewport:innerWidth,documentOverflow:document.documentElement.scrollWidth-innerWidth,
    gridOverflow:document.querySelector('#activityGrid').scrollWidth-document.querySelector('#activityGrid').clientWidth,
    beyondPanel:r.right-b.right,rootWidth:r.width,visible:!!root.getClientRects().length};
  },selector);
  assert.ok(result.visible&&result.gridOverflow<=5&&result.beyondPanel<=5,
   app+' setup must fit teacher modal: '+JSON.stringify(result));
  await page.setViewportSize({width:1360,height:950});
  return result;
 };
 try{
  assert.equal((await context.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(()=>networkHydrated===true&&
   !!window.__fourLineBridgeInstalled&&!!window.__signalSequenceBridge&&
   !!window.Dominoes&&typeof cosmicSetupMarkup==='function',
   null,{timeout:25000});
  // Cosmic Cards: actual turn-rule and roster clicks must feed the launched game.
  await open('cosmic-cards');
  await page.locator('[data-cosmic-rule="continue"]').click();
  await page.locator('[data-cosmic-seat="Casey"]').click();
  assert.equal(await page.locator('[data-cosmic-rule="continue"]').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#cosmicLaunchBtn').innerText(),/2 PLAYER/);
  const cosmicLayout=await fit('cosmic-cards','.cc-setup');
  await page.locator('#cosmicLaunchBtn').click();
  const cosmic=await page.evaluate(()=>({
   id:state.activityRun?.activityId,players:state.activityRun?.cosmic?.players,
   rule:state.activityRun?.cosmic?.turnRule,phase:state.activityRun?.phase
  }));
  assert.equal(cosmic.id,'cosmic-cards-game');
  assert.deepEqual(cosmic.players,['Alex','Blair']);
  assert.equal(cosmic.rule,'continue');
  // Dominoes: two students plus teacher; save and resume after page reload.
  await open('dominoes');
  await page.locator('[data-dm-seat="Casey"]').click();
  await page.locator('[data-dm-teacher-seat]').click();
  const dominoLayout=await fit('dominoes','.dm-setup');
  await page.locator('#dmStart').click();
  const domino=await page.evaluate(()=>({
   id:state.activityRun?.activityId,players:state.activityRun?.dominoes?.players,
   teacher:state.activityRun?.dominoes?.teacherIncluded
  }));
  assert.equal(domino.id,'dominoes-game');
  assert.deepEqual(domino.players,['Alex','Blair','Teacher']);
  assert.equal(domino.teacher,true);
  await page.locator('#activityControllerPanel [data-dm-teacher="save"]').click();
  assert.ok(await page.evaluate(()=>Dominoes.library().length>0));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.Dominoes&&networkHydrated===true,null,{timeout:20000});
  await open('dominoes');
  assert.ok(await page.locator('[data-dm-load]').count());
  await page.locator('[data-dm-load]').first().click();
  assert.deepEqual(await page.evaluate(()=>state.activityRun?.dominoes?.players),domino.players,
   'Saved Dominoes roster must restore after page reload');
  // Four In Line: change original settings, check actual dimensions and game restore.
  await open('four-in-line');
  await page.locator('#filMode').selectOption('teams');
  await page.locator('#filSize').selectOption('mini');
  await page.locator('#filOne').fill('Blue Team');
  await page.locator('#filTwo').fill('Gold Team');
  await page.locator('[data-fil-seat="Alex"]').selectOption('0');
  await page.locator('[data-fil-seat="Blair"]').selectOption('1');
  const fourLayout=await fit('four-in-line','.fil-setup');
  await page.locator('#filLaunch').click();
  const four=await page.evaluate(()=>({
   id:state.activityRun?.activityId,cols:state.activityRun?.fourInLine?.cols,
   rows:state.activityRun?.fourInLine?.rows,mode:state.activityRun?.fourInLine?.mode,
   seats:state.activityRun?.fourInLine?.seats,players:state.activityRun?.fourInLine?.players
  }));
  assert.equal(four.id,'four-in-line-game');
  assert.deepEqual([four.cols,four.rows,four.mode],[5,4,'teams']);
  assert.deepEqual(four.seats,{Alex:0,Blair:1});
  assert.deepEqual(four.players,['Blue Team','Gold Team']);
  await page.locator('#activityControllerPanel [data-fil-action="save"]').click();
  assert.ok(await page.evaluate(()=>FourLine.saved().length>0));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.FourLine&&networkHydrated===true&&window.__fourLineBridgeInstalled===true,null,{timeout:25000});
  await open('four-in-line');
  const fourBoot=await page.evaluate(()=>{
   const err=document.querySelector('#bootError');
   return {display:err?getComputedStyle(err).display:'absent',
    message:(err?.textContent||'').slice(0,1300),
    run:state.activityRun?.activityId||null,
    setup:document.querySelector('#activitiesPanel')?.dataset.siSetup||null};
  });
  console.log('Four In Line post-reload boot diagnostic',JSON.stringify(fourBoot));
  assert.ok(['none','absent'].includes(fourBoot.display),
   'Unexpected boot error overlay after reloading saved Four In Line: '+JSON.stringify(fourBoot));
  await page.locator('[data-fil-load]').first().click();
  assert.deepEqual(await page.evaluate(()=>({
   cols:state.activityRun?.fourInLine?.cols,rows:state.activityRun?.fourInLine?.rows,
   players:state.activityRun?.fourInLine?.players
  })),{cols:5,rows:4,players:['Blue Team','Gold Team']},
  'Saved Four In Line options must restore after reload');
  // Signal Sequence: advanced crew roster, speed, audio preference and restoration.
  await open('signal-sequence');
  await page.locator('#ssMode').selectOption('survival');
  assert.equal(await page.locator('.ss-advanced-crew').isVisible(),true);
  await page.locator('#ssSignals').selectOption('6');
  await page.locator('#ssSpeed').selectOption('slow');
  await page.locator('#ssSound').uncheck();
  await page.locator('[data-ss-member="Casey"]').uncheck();
  const signalLayout=await fit('signal-sequence','.ss-setup');
  await page.locator('#ssLaunch').click();
  const signal=await page.evaluate(()=>({
   id:state.activityRun?.activityId,mode:state.activityRun?.signalSequence?.mode,
   signals:state.activityRun?.signalSequence?.signals,
   speed:state.activityRun?.signalSequence?.speed,
   sound:state.activityRun?.signalSequence?.sound,
   crew:state.activityRun?.signalSequence?.participants
  }));
  assert.equal(signal.id,'signal-sequence-game');
  assert.deepEqual({mode:signal.mode,signals:signal.signals,speed:signal.speed,sound:signal.sound,
   crew:signal.crew},{mode:'survival',signals:6,speed:'slow',sound:false,crew:['Alex','Blair']});
  await page.locator('#activityControllerPanel [data-ss-action="save"]').click();
  assert.ok(await page.evaluate(()=>SignalSequence.readLibrary().length>0));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.SignalSequence&&
   !!window.__signalSequenceBridge&&networkHydrated===true,null,{timeout:20000});
  await open('signal-sequence');
  await page.locator('[data-ss-load]').first().click();
  assert.deepEqual(await page.evaluate(()=>({
   mode:state.activityRun?.signalSequence?.mode,
   signals:state.activityRun?.signalSequence?.signals,
   crew:state.activityRun?.signalSequence?.participants
  })),{mode:'survival',signals:6,crew:['Alex','Blair']},
  'Saved Signal Sequence game mode and roster restore after reload');
  assert.deepEqual(errors,[],'No teacher browser runtime errors');
  console.log('Phase 2F multiplayer setups: Cosmic Cards turn rule, Dominoes save/restore, Four In Line size/restore, Signal Sequence crew/restore PASS',
   JSON.stringify({cosmic,domino,four,signal,layouts:{cosmicLayout,dominoLayout,fourLayout,signalLayout}}));
 }finally{await context.close();await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
