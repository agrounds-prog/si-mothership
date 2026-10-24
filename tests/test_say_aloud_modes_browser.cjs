/* Say Aloud options — native teacher gameplay only; localhost synthetic roster. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(BASE))
 throw Error('Never point speech-mode regressions at production.');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1250,height:850}});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  assert.equal((await ctx.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  assert.equal((await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000})).status(),200);
  await page.waitForFunction(()=>!!window.MillionStudio&&!!window.SIPixelBatch&&typeof render==='function',
   null,{timeout:20000});
  await page.evaluate(()=>{
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   state.selectedStudent='Alex';state.screen='activities';state.activeApp='pixel';
   state.pixelDraft=defaultPixelDraft();state.activityRun=null;render();
  });
  await page.locator('[data-pixel-answer-mode="verbal"]').click();
  assert.equal(await page.evaluate(()=>state.pixelDraft.answerMode),'verbal');
  await page.locator('#pixelName').fill('Spoken Picture QA');
  await page.locator('#savePixelBtn').click();
  assert.equal(await page.evaluate(()=>loadSavedPixels().find(x=>x.name==='Spoken Picture QA')?.answerMode),'verbal');
  await page.locator('#launchPixelBtn').click();
  await page.evaluate(()=>{state.activityRun.phase='running';render()});
  const pixel=await page.evaluate(()=>{
   const run=state.activityRun;
   const cfg=run.pixelConfig;
   const student=studentMarkup();
   const publicBefore=pixelSharedMarkup(run,true);
   pixelTeacherRecordSpoken('Alex',true);
   const correct=pixelGuessMap(run).Alex;
   pixelTeacherRecordSpoken('Blair',false);
   const wrong=pixelGuessMap(run).Blair;
   const controller=document.querySelector('#activityControllerPanel');
   return {mode:cfg.answerMode,studentPrompt:student.includes('Say It Aloud'),
    noTextEntry:!student.includes('pixelGuessInput'),
    sharedDoesNotRevealAnswer:!publicBefore.includes(cfg.answer),
    teacherButtons:!!controller.querySelector('[data-pixel-spoken-correct]')&&
      !!controller.querySelector('[data-pixel-spoken-wrong]'),
    correct:correct.teacherCorrect,wrong:wrong.teacherCorrect,
    count:pixelSubmittedCount(run),source:correct.source,
    firstCorrect:correct.firstCorrectRemaining};
  });
  assert.equal(pixel.mode,'verbal');
  assert.equal(pixel.studentPrompt,true);
  assert.equal(pixel.noTextEntry,true);
  assert.equal(pixel.sharedDoesNotRevealAnswer,true);
  assert.equal(pixel.teacherButtons,true);
  assert.equal(pixel.correct,true);
  assert.equal(pixel.wrong,false);
  assert.equal(pixel.count,2);
  assert.equal(pixel.source,'verbal');
  assert.ok(pixel.firstCorrect>0);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>networkHydrated===true&&window.SIPixelBatch&&window.MillionStudio,null,{timeout:20000});
  await page.evaluate(()=>{
   state.activityRun=null;state.screen='activities';state.activeApp='pixel';
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   state.selectedStudent='Alex';render();
  });
  await page.locator('.pixel-setup').waitFor();
  const savedCard=page.locator('.pixel-studio-saved-card').filter({hasText:'Spoken Picture QA'});
  await savedCard.locator('[data-pixel-studio-load]').click();
  assert.equal(await page.evaluate(()=>state.pixelDraft.answerMode),'verbal',
   'saved pixel mysteries keep verbal preference after reload');

  // MILLION: five-question sample, saved mode, teacher authority and existing reveal/score.
  await page.evaluate(()=>{
   state.activityRun=null;state.screen='activities';state.activeApp='million';
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   render();
  });
  await page.locator('#msSample').click();
  await page.locator('#msAnswerMode').selectOption('verbal');
  await page.locator('#msSaveGame').click();
  await page.waitForFunction(()=>window.MillionStudio.inspection().saved>=1,null,{timeout:15000});
  await page.locator('#msLaunch').click();
  const million=await page.evaluate(()=>{
   const run=state.activityRun;
   return {mode:run?.millionConfig?.answerMode,phase:run?.phase,
     pilot:run?.million?.pilot,questions:run?.millionConfig?.questions?.length};
  });
  assert.deepEqual(million,{mode:'verbal',phase:'lobby',pilot:'Alex',questions:5});
  const played=await page.evaluate(()=>{
   const run=state.activityRun;run.phase='running';render();
   const before=run.million.ladderLevel;
   const student=millionStudentMarkup(run,{n:'Alex'});
   const controls=document.querySelector('#activityControllerPanel');
   const options=controls.querySelectorAll('[data-million-spoken-choice]').length;
   const correct=run.millionConfig.questions[0].correct;
   millionTeacherApproveSpoken(correct);
   const selected=run.million.lockedAnswer;
   millionResolve(true);
   return {studentCue:student.includes('Say your answer aloud'),
     noButtons:!student.includes('data-million-choice')&&!student.includes('millionLockBtn'),
     options,selected,ladderAdvance:run.million.ladderLevel-before,
     result:run.million.result};
  });
  assert.deepEqual(played,{studentCue:true,noButtons:true,options:4,
    selected:played.selected,ladderAdvance:1,result:'correct'});
  assert.ok('ABCD'.includes(played.selected));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>networkHydrated===true&&window.MillionStudio,null,{timeout:20000});
  await page.evaluate(()=>{state.activityRun=null;state.screen='activities';state.activeApp='million';render()});
  await page.locator('#msAnswerMode').waitFor();
  assert.equal(await page.locator('#msAnswerMode').inputValue(),'verbal',
   'saved MILLION draft keeps spoken mode after reload');
  assert.deepEqual(errors,[],'no page errors');
  console.log('SAY ALOUD MILLION + PIXEL GAMEPLAY AND SAVE/LOAD PASSED');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
