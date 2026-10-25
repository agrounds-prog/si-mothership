/* Independent teacher, student, and shared-screen Chromium sessions.
   Disposable localhost only: never touch Railway or /data. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(BASE))
 throw Error('Three-view regression requires disposable localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const tctx=await browser.newContext({viewport:{width:1366,height:950}});
 const pctx=await browser.newContext({viewport:{width:1280,height:720}});
 const teacher=await tctx.newPage(),shared=await pctx.newPage();
 const errors=[],students=[];
 for(const [name,page] of [['teacher',teacher],['shared',shared]])
   page.on('pageerror',e=>errors.push(name+': '+String(e.stack||e)));
 try{
  assert.equal((await tctx.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await teacher.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await teacher.waitForFunction(()=>networkHydrated===true&&window.MillionStudio&&
    typeof defaultPixelDraft==='function'&&typeof crewSurveyStudentMarkup==='function',
    null,{timeout:25000});
  const session=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  assert.ok(session.code&&session.sid);
  const join=async name=>{
   const ctx=await browser.newContext({viewport:{width:1380,height:910}});
   students.push(ctx);
   const page=await ctx.newPage();
   page.on('pageerror',e=>errors.push(name+': '+String(e.stack||e)));
   await page.goto(BASE+'/?role=student&code='+encodeURIComponent(session.code)+
    '&sid='+encodeURIComponent(session.sid),{waitUntil:'domcontentloaded',timeout:40000});
   await page.locator('#siStudentLaunchScreen').waitFor({state:'visible',timeout:18000});
   await page.locator('#siStudentLaunchContinue').click();
   await page.locator('#studentContent [data-join-avatar]:visible').first().click();
   await page.locator('#joinStudentName').fill(name);
   await page.locator('#joinClassBtn').click();
   await page.waitForFunction(n=>state.selectedStudent===n&&!studentNeedsJoin(),name,{timeout:18000});
   await page.setViewportSize({width:440,height:780});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=3));
   return page;
  };
  const alex=await join('Alex');
  await join('Blair');
  await teacher.waitForFunction(()=>['Alex','Blair'].every(n=>state.students.some(s=>s.n===n)),
   null,{timeout:15000});
  await shared.goto(BASE+'/?role=shared&sid='+encodeURIComponent(session.sid),
   {waitUntil:'domcontentloaded',timeout:40000});

  // PIXEL: teacher selects verbal mode; student receives only a speaking cue.
  await teacher.evaluate(()=>{state.activityRun=null;state.screen='activities';
   state.activeApp='pixel';state.pixelDraft=defaultPixelDraft();render()});
  await teacher.locator('[data-pixel-answer-mode="verbal"]').click();
  await teacher.locator('#launchPixelBtn').click();
  await teacher.evaluate(()=>startOrResumeActivityRun());
  await alex.locator('#studentContent .pixel-verbal-cue').waitFor({timeout:18000});
  await shared.waitForFunction(()=>state.activityRun?.activityId==='pixel-game'&&
   state.activityRun?.phase==='running'&&!!document.querySelector('.pixel-public'),
   null,{timeout:18000});
  assert.equal(await alex.locator('#studentContent #pixelGuessInput').count(),0);
  assert.deepEqual(await shared.evaluate(()=>({
   answer:Object.hasOwn(state.activityRun.pixelConfig,'answer'),
   aliases:Object.hasOwn(state.activityRun.pixelConfig,'acceptedAnswers'),
   guesses:Object.keys(state.activityRun.pixelGuesses||{}).length
  })),{answer:false,aliases:false,guesses:0});
  await teacher.evaluate(()=>{pixelTeacherRecordSpoken('Alex',true);pixelTeacherRecordSpoken('Blair',false)});
  await shared.waitForFunction(()=>Object.keys(state.activityRun?.pixelGuesses||{}).length===2,
   null,{timeout:14000});
  const hidden=await shared.evaluate(()=>({
   guesses:Object.values(state.activityRun.pixelGuesses),
   label:document.querySelector('.pixel-public-head')?.textContent
  }));
  assert.ok(hidden.guesses.every(g=>!('guess' in g)&&!('teacherCorrect' in g)));
  assert.match(hidden.label,/2 \/ 2/);
  await teacher.evaluate(()=>{revealPixelAll();state.activityRun.pixelShowResults=true;render()});
  await shared.waitForFunction(()=>state.activityRun?.pixelShowResults===true&&
   state.activityRun?.pixelRevealAll===true&&!!document.querySelector('.pixel-results'),
   null,{timeout:14000});
  assert.equal(await shared.evaluate(()=>state.activityRun.pixelConfig.answer),'Giraffe');

  // MILLION: the pilot speaks and teacher selects the correct choice.
  await teacher.evaluate(()=>{state.activityRun=null;state.screen='activities';
   state.activeApp='million';render()});
  await teacher.locator('#msSample').click();
  await teacher.locator('#msAnswerMode').selectOption('verbal');
  await teacher.locator('#msLaunch').click();
  await teacher.evaluate(()=>startOrResumeActivityRun());
  await alex.locator('#studentContent .million-verbal-mode').waitFor({timeout:18000});
  await shared.waitForFunction(()=>state.activityRun?.activityId==='million-game'&&
   document.querySelectorAll('.million-public.big .million-choice').length===4,
   null,{timeout:18000});
  assert.equal(await alex.locator('#studentContent [data-million-choice], #studentContent #millionLockBtn').count(),0);
  assert.match(await alex.locator('#studentContent .million-verbal-mode').innerText(),/Say your answer aloud/);
  assert.deepEqual(await shared.evaluate(()=>({
   correct:Object.hasOwn(state.activityRun.millionConfig.questions[0],'correct'),
   next:state.activityRun.millionConfig.questions[1].prompt
  })),{correct:false,next:''});
  const correct=await teacher.evaluate(()=>state.activityRun.millionConfig.questions[0].correct);
  await teacher.locator('[data-million-spoken-choice="'+correct+'"]').click();
  await teacher.locator('#millionCorrectBtn').click();
  await shared.waitForFunction(()=>state.activityRun?.million?.result==='correct'&&
   state.activityRun.million.ladderLevel===1,null,{timeout:15000});

  // Crew Survey: actual student buzzer, spoken cue, teacher approval, public reveal.
  await teacher.evaluate(()=>{state.activityRun=null;state.screen='activities';
   state.activeApp='crew-survey';render()});
  await teacher.locator('#surveyNewBoard').click();
  await teacher.locator('#crewSurveyPrompt').fill('Name a helpful classroom tool.');
  for(let i=0;i<4;i++){
   await teacher.locator('[data-cs-answer-text="'+i+'"]').fill(['Pencil','Notebook','Folder','Calculator'][i]);
   await teacher.locator('[data-cs-answer-value="'+i+'"]').fill(String(40-i*10));
  }
  await teacher.locator('[name="crewSurveyAnswerMode"][value="verbal"]').check();
  await teacher.locator('#surveyPlayDraft').click();
  await alex.locator('#crewSurveyBuzzBtn').waitFor({timeout:18000});
  await shared.waitForFunction(()=>state.activityRun?.activityId==='crew-survey-game'&&
   !!document.querySelector('.crew-survey-public'),null,{timeout:18000});
  assert.equal(await shared.evaluate(()=>state.activityRun.crewSurveyConfig.answers[0].text),'');
  await alex.locator('#crewSurveyBuzzBtn').click();
  await teacher.waitForFunction(()=>state.activityRun?.crewSurvey?.buzzer?.winner==='Alex',
   null,{timeout:15000});
  await alex.locator('#studentContent .crew-survey-speak-cue').waitFor({timeout:13000});
  assert.equal(await alex.locator('#studentContent #crewSurveyAnswerInput').count(),0);
  await teacher.locator('[data-cs-reveal="0"]').click();
  await shared.waitForFunction(()=>state.activityRun?.crewSurvey?.revealed?.includes(0)&&
   document.querySelector('.crew-survey-public')?.textContent.includes('Pencil'),
   null,{timeout:15000});
  assert.equal(await shared.evaluate(()=>state.activityRun.crewSurvey.roundPoints),40);
  await teacher.locator('#crewSurveyStrikeBtn').click();
  await shared.waitForFunction(()=>state.activityRun?.crewSurvey?.strikes?.[0]===1,
   null,{timeout:14000});
  assert.deepEqual(errors,[]);
  console.log('LIVE PIXEL, MILLION AND CREW SURVEY THREE-VIEW VERBAL REGRESSION PASSED');
 }finally{
  for(const ctx of students)await ctx.close().catch(()=>{});
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
