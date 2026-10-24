/* Phase 2F remaining native teacher studios — localhost data only.
   Tests settings, validation, save/reload and live launch for four activities.
   Never points at Railway or modifies the real teacher classroom. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8883';
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error('Teacher setup regression may run only on isolated localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:950}});
 const errors=[],roster=['Alex','Blair','Casey'].map(n=>({n,offline:false}));
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 page.on('dialog',d=>d.type()==='prompt'?d.accept('Phase 2F Mission Preset'):d.accept());
 const launchSetup=async app=>{
  await page.evaluate(({app,roster})=>{
   state.students=roster;state.screen='activities';state.activeApp=app;
   state.assigningSlot=null;state.ended=false;state.activityRun=null;
   state.calculatorLaunch=null;render();
  },{app,roster});
  await page.locator('#activitiesPanel.si-setup-view[data-si-setup="'+app+'"]').waitFor();
 };
 const reload=async()=>{
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>networkHydrated===true&&window.__siUnifiedTeacherControls?.version==='2E',
   null,{timeout:23000});
 };
 const layout=async(app,selector)=>{
  await page.setViewportSize({width:500,height:930});
  const g=await page.evaluate(selector=>{
   const el=document.querySelector('#activityGrid '+selector),grid=document.querySelector('#activityGrid'),
    panel=document.querySelector('#activitiesPanel');
   const r=el.getBoundingClientRect(),b=panel.getBoundingClientRect();
   return {root:Math.round(r.width),gridOverflow:grid.scrollWidth-grid.clientWidth,
    panelOverhang:Math.round(r.right-b.right),visible:!!el.getClientRects().length};
  },selector);
  assert.ok(g.visible&&g.gridOverflow<=5&&g.panelOverhang<=5,
   app+' does not overflow narrow teacher modal: '+JSON.stringify(g));
  await page.setViewportSize({width:1366,height:950});return g;
 };
 try{
  assert.equal((await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  assert.equal((await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000})).status(),200);
  await page.waitForFunction(()=>networkHydrated===true&&!!window.WordGrid&&
   !!window.__siUnifiedTeacherControls,null,{timeout:23000});
  // Word Grid: native team edit and teacher seat actually reach game engine.
  await launchSetup('word-grid');
  await page.locator('#wgPlayers').fill('Comets\nPlanets');
  await page.locator('#wgTeacherMode').selectOption('solo');
  await page.locator('[data-wg-setup-student="Alex"]').selectOption('0');
  await page.locator('[data-wg-setup-student="Blair"]').selectOption('1');
  await page.locator('[data-wg-setup-student="Casey"]').selectOption('');
  const wordLayout=await layout('word-grid','.wg-setup');
  await page.locator('#wgStart').click();
  const word=await page.evaluate(()=>({
   id:state.activityRun?.activityId,teams:state.activityRun?.wordGrid?.players?.map(p=>p.name),
   assignments:state.activityRun?.wordGrid?.assignments,teacherSeat:state.activityRun?.wordGrid?.teacherSeat
  }));
  assert.equal(word.id,'word-grid-game');
  assert.deepEqual(word.teams,['Comets','Planets','Teacher']);
  assert.equal(word.assignments?.Alex,0);assert.equal(word.assignments?.Blair,1);
  assert.equal(word.assignments?.Casey,undefined);
  await page.locator('#activityControllerPanel [data-wg-action="save"]').click();
  assert.ok(await page.evaluate(()=>WordGrid.readLibrary().length>0));
  await reload();await launchSetup('word-grid');
  assert.ok(await page.locator('[data-wg-load]').count(),'Word Grid saved game persists after reload');
  await page.locator('[data-wg-load]').first().click();
  assert.deepEqual(await page.evaluate(()=>state.activityRun?.wordGrid?.players?.map(p=>p.name)),
   word.teams,'Word Grid saved team settings restore');
  // Minefield: persist actual game preset, load it from its native setup card.
  await launchSetup('minefield');
  await page.locator('[data-mf-mode="teams"]').click();
  await page.locator('[data-mf-team-count="3"]').click();
  await page.locator('[data-mf-length="epic"]').click();
  const minefieldLayout=await layout('minefield','.minefield-setup');
  await page.locator('#saveMinefieldPresetBtn').click();
  assert.ok(await page.evaluate(()=>loadActivityPresets().some(p=>p.appId==='minefield')));
  await reload();await launchSetup('minefield');
  assert.ok(await page.locator('[data-mf-preset-load]').count(),
   'Minefield presents saved presets directly on setup page after reload');
  await page.locator('[data-mf-preset-load]').first().click();
  assert.equal(await page.locator('[data-mf-mode="teams"]').getAttribute('class')
   .then(s=>s.includes('active')),true);
  assert.equal(await page.locator('[data-mf-team-count="3"]').getAttribute('class')
   .then(s=>s.includes('active')),true);
  assert.equal(await page.locator('[data-mf-length="epic"]').getAttribute('class')
   .then(s=>s.includes('active')),true);
  await page.locator('#launchMinefieldBtn').click();
  assert.equal(await page.evaluate(()=>state.activityRun?.phase),'lobby');
  await page.locator('#activityControllerPanel #startActivityBtn').click();
  const minefield=await page.evaluate(()=>({
   id:state.activityRun?.activityId,phase:state.activityRun?.phase,
   mode:state.activityRun?.minefieldMode,count:state.activityRun?.mfTeams?.length,
   size:state.activityRun?.mfTeams?.[0]?.size
  }));
  assert.deepEqual(minefield,{id:'minefield-game',phase:'running',mode:'teams',count:3,size:7});
  // Crew Survey: visible validation, teacher-local save draft, reload, launch.
  await launchSetup('crew-survey');
  await page.locator('#crewSurveyPrompt').fill('');
  await page.locator('#surveyPlayDraft').click();
  assert.match(await page.locator('#surveyLaunchStatus').innerText(),/question.*at least four answers/i);
  assert.equal(await page.evaluate(()=>state.activityRun),null);
  await page.locator('#crewSurveyPrompt').fill('Which school supplies help us learn?');
  await page.locator('[data-cs-answer-text="0"]').fill('Pencils');
  await page.locator('[data-cs-answer-value="0"]').fill('40');
  await page.locator('#crewSurveyScoring').uncheck();
  await page.locator('[data-cs-aac-student="Alex"]').check();
  await page.locator('#crewSurveyAacVocab').fill('Pencil, Notebook, Calculator');
  await page.locator('#crewSurveyAddAnswer').click();
  await page.locator('[data-cs-answer-text="6"]').fill('Paper');
  const surveyLayout=await layout('crew-survey','.crew-survey-setup');
  await page.locator('#crewSurveySaveDraftBtn').click();
  assert.match(await page.locator('#crewSurveySetupStatus').innerText(),/draft saved/i);
  await reload();await launchSetup('crew-survey');
  assert.equal(await page.locator('#crewSurveyPrompt').inputValue(),'Which school supplies help us learn?');
  assert.equal(await page.locator('[data-cs-answer-text="0"]').inputValue(),'Pencils');
  assert.equal(await page.locator('[data-cs-answer-value="0"]').inputValue(),'40');
  assert.equal(await page.locator('[data-cs-answer-text="6"]').inputValue(),'Paper');
  assert.equal(await page.locator('#crewSurveyScoring').isChecked(),false);
  assert.equal(await page.locator('[data-cs-aac-student="Alex"]').isChecked(),true);
  await page.locator('#surveyPlayDraft').click();
  const survey=await page.evaluate(()=>({
   id:state.activityRun?.activityId,phase:state.activityRun?.phase,
   prompt:state.activityRun?.crewSurveyConfig?.prompt,
   count:state.activityRun?.crewSurveyConfig?.answers?.length,
   first:state.activityRun?.crewSurveyConfig?.answers?.[0]?.text,
   scoring:state.activityRun?.crewSurveyConfig?.scoring,
   aac:state.activityRun?.crewSurveyConfig?.aacStudents
  }));
  assert.deepEqual(survey,{id:'crew-survey-game',phase:'running',
   prompt:'Which school supplies help us learn?',count:7,first:'Pencils',
   scoring:false,aac:['Alex']});
  // Launch must arm the actual face-off, not merely render its board.
  // Previously both students saw a waiting card until teachers armed it.
  const faceoff=await page.evaluate(()=>{
   const run=state.activityRun,cs=run.crewSurvey;
   const eligible=cs.buzzer.eligible;
   return {armed:cs.buzzer.armed,eligible,stage:cs.stage,
    firstHasBuzzer:crewSurveyStudentMarkup(run,{n:eligible[0]}).includes('id="crewSurveyBuzzBtn"'),
    secondHasBuzzer:crewSurveyStudentMarkup(run,{n:eligible[1]}).includes('id="crewSurveyBuzzBtn"'),
    spectatorBuzzer:crewSurveyStudentMarkup(run,{n:'Casey'}).includes('id="crewSurveyBuzzBtn"')};
  });
  assert.deepEqual(faceoff,{armed:true,eligible:['Alex','Blair'],stage:'faceoff',
   firstHasBuzzer:true,secondHasBuzzer:true,spectatorBuzzer:false},
   'playing a Survey must immediately show the buzzer on both contestants devices');
  await page.locator('#crewSurveyResetBuzzBtn').click();
  assert.equal(await page.evaluate(()=>state.activityRun.crewSurvey.buzzer.armed),false,
   'teacher may still reset the face-off without auto-rearming');
  await page.locator('#crewSurveyArmBtn').click();
  assert.equal(await page.evaluate(()=>state.activityRun.crewSurvey.buzzer.armed),true,
   'teacher can manually re-arm a reset face-off');
  // Phase 4N-A: a complete face-off, steal, and award using the actual
  // teacher engine; no real classroom data is modified by this localhost test.
  const flow=await page.evaluate(()=>{
   const cs=state.activityRun.crewSurvey,run=state.activityRun;
   crewSurveySetContestant(0,'Casey');
   const selection={eligible:[...cs.buzzer.eligible],turn:cs.activeIndexes[0],armed:cs.buzzer.armed};
   crewSurveyArmBuzzers();
   const buzzers={casey:crewSurveyStudentMarkup(run,{n:'Casey'}).includes('id="crewSurveyBuzzBtn"'),
    alex:crewSurveyStudentMarkup(run,{n:'Alex'}).includes('id="crewSurveyBuzzBtn"'),
    blair:crewSurveyStudentMarkup(run,{n:'Blair'}).includes('id="crewSurveyBuzzBtn"')};
   cs.buzzer.winner='Casey';cs.buzzer.armed=false;cs.message='Casey buzzed first.';render();
   const firstAnswer=crewSurveyStudentMarkup(run,{n:'Casey'}).includes('id="crewSurveyAnswerSend"');
   run.crewSurveyConfig.scoring=true;crewSurveyReveal(0);
   const play={team:cs.controlTeam,stage:cs.stage,points:cs.roundPoints,
    selected:crewSurveyStudentMarkup(run,{n:'Casey'}).includes('id="crewSurveyAnswerSend"'),
    former:crewSurveyStudentMarkup(run,{n:'Alex'}).includes('id="crewSurveyAnswerSend"')};
   crewSurveyReveal(0);const duplicateReveal=cs.roundPoints;
   crewSurveyStrike();crewSurveyStrike();crewSurveyStrike();
   const steal={stage:cs.stage,control:cs.controlTeam,strikes:[...cs.strikes],
    canAnswer:crewSurveyStudentMarkup(run,{n:'Blair'}).includes('id="crewSurveyAnswerSend"')};
   crewSurveyStrike();const duplicateStrike=[...cs.strikes];
   crewSurveyAwardRound(1);
   const award={stage:cs.stage,scores:[...cs.scores],points:cs.roundPoints,
    casey:crewSurveyStudentMarkup(run,{n:'Casey'}).includes('id="crewSurveyAnswerSend"'),
    blair:crewSurveyStudentMarkup(run,{n:'Blair'}).includes('id="crewSurveyAnswerSend"')};
   crewSurveyAwardRound(1);crewSurveyReveal(1);crewSurveyStrike();crewSurveyNextPlayer();
   const closed={scores:[...cs.scores],points:cs.roundPoints,strikes:[...cs.strikes],stage:cs.stage};
   return {selection,buzzers,firstAnswer,play,duplicateReveal,steal,duplicateStrike,award,closed};
  });
  assert.deepEqual(flow.selection,{eligible:['Casey','Blair'],turn:1,armed:false},
   'changing Blue contestant preserves the Red contestant and selects the correct first turn');
  assert.deepEqual(flow.buzzers,{casey:true,alex:false,blair:true},
   'only the current contestants see the buzzer');
  assert.equal(flow.firstAnswer,true,'first buzzer winner receives the answer form');
  assert.deepEqual(flow.play,{team:0,stage:'play',points:40,selected:true,former:false},
   'revealing an answer grants control to the winning contestant');
  assert.equal(flow.duplicateReveal,40,'a repeated reveal does not score twice');
  assert.deepEqual(flow.steal,{stage:'steal',control:1,strikes:[3,0],canAnswer:true},
   'three strikes open the opposing team steal');
  assert.deepEqual(flow.duplicateStrike,[3,0],'no additional strike after a steal');
  assert.deepEqual(flow.award,{stage:'roundwon',scores:[0,40],points:40,casey:false,blair:false},
   'awarding points closes both student answer forms');
  assert.deepEqual(flow.closed,{scores:[0,40],points:40,strikes:[3,0],stage:'roundwon'},
   'a closed round ignores duplicate awards, reveals, strikes and turn changes');
  // Phase 4N-B: verify the screen's animations follow transitions only.
  // A cloned run avoids modifying the live browser test's local classroom.
  const cinematic=await page.evaluate(()=>{
   const r=structuredClone(state.activityRun);r.runToken='cs4nb_visual_fixtures';
   r.crewSurvey.stage='faceoff';r.crewSurvey.buzzer={armed:true,eligible:['Casey','Blair'],winner:null};
   r.crewSurvey.scores=[0,0];r.crewSurvey.strikes=[0,0];r.crewSurvey.revealed=[];r.crewSurvey.controlTeam=null;
   crewSurveySharedMarkup(r,false);crewSurveySharedMarkup(r,true);
   r.crewSurvey.buzzer.winner='Casey';r.crewSurvey.buzzer.armed=false;
   const first=crewSurveySharedMarkup(r,false);
   const big=crewSurveySharedMarkup(r,true);
   const stable=crewSurveySharedMarkup(r,false);
   r.crewSurvey.stage='play';r.crewSurvey.controlTeam=0;
   r.crewSurvey.revealed=[0];
   const reveal=crewSurveySharedMarkup(r,false);
   r.crewSurvey.strikes=[3,0];r.crewSurvey.stage='steal';r.crewSurvey.controlTeam=1;
   const steal=crewSurveySharedMarkup(r,false);
   r.crewSurvey.stage='roundwon';r.crewSurvey.scores=[0,40];r.crewSurvey.roundPoints=40;
   const award=crewSurveySharedMarkup(r,false);
   const persistent=crewSurveySharedMarkup(r,false);
   r.crewSurveyRoundIndex=1;r.crewSurveyTotal=3;r.runToken='cs4nb_next_round';
   r.crewSurvey.stage='faceoff';r.crewSurvey.controlTeam=null;
   r.crewSurvey.buzzer={armed:true,eligible:['Casey','Blair'],winner:null};
   r.crewSurvey.revealed=[];r.crewSurvey.strikes=[0,0];r.crewSurvey.roundPoints=0;
   const next=crewSurveySharedMarkup(r,false);
   const el=document.createElement('div');el.innerHTML=award;
   const strip=el.querySelector('.cs-round-winner');
   return {
    firstFlash:first.includes('class="cs-buzz-flash"'),
    bigFlash:big.includes('class="cs-buzz-flash"'),
    stableFlash:stable.includes('class="cs-buzz-flash"'),
    persistentWinner:stable.includes('cs-buzz-winner-strip'),
    answerFlips:reveal.includes('cs-new-reveal'),
    stealCue:steal.includes('cs-steal-enter'),
    scorePulse:award.includes('cs-score-pop'),
    awardTransition:award.includes('cs-award-enter'),
    roundWinner:strip?.textContent,
    persistentScorePop:persistent.includes('cs-score-pop'),
    persistentRoundWinner:persistent.includes('cs-round-winner'),
    freshRound:next.includes('cs-round-intro'),
    noPrematureAnswer:first.includes('Pencils')
   };
  });
  assert.deepEqual(cinematic,{
    firstFlash:true,bigFlash:true,stableFlash:false,persistentWinner:true,
    answerFlips:true,stealCue:true,scorePulse:true,awardTransition:true,
    roundWinner:'★ BOARD 1 AWARDED ★RED CREW WINS THE ROUND40 ROUND POINTS',
    persistentScorePop:false,persistentRoundWinner:true,freshRound:true,
    noPrematureAnswer:false
  },'Crew Survey projected and teacher animations only trigger on state changes');
  await page.emulateMedia({reducedMotion:'reduce'});
  const calm=await page.evaluate(()=>{
   const style=document.createElement('style');
   const root=document.createElement('div');
   root.innerHTML='<div class="crew-survey-public cs-showtime"><div class="cs-buzz-flash"></div></div>';
   document.body.appendChild(root);
   const flash=root.querySelector('.cs-buzz-flash');
   const result=getComputedStyle(flash).display;
   root.remove();return result;
  });
  assert.equal(calm,'none','reduced-motion devices do not show an obstructing buzz flash');
  await page.emulateMedia({reducedMotion:'no-preference'});


  // Calculator: QR and share URL update immediately when settings change.
  await launchSetup('scientific-calculator');
  await page.locator('#calculatorAngleMode').selectOption('rad');
  await page.locator('#calculatorNumberFormat').selectOption('scientific');
  await page.locator('#showCalculatorQrBtn').click();
  const calc=await page.evaluate(()=>({
   mode:state.calculatorSettings.angle,format:state.calculatorSettings.format,
   label:document.querySelector('#calculatorQrWrap .calculator-share-url')?.textContent,
   img:document.querySelector('#calculatorQrWrap img')?.src,
   hidden:document.querySelector('#calculatorQrWrap')?.classList.contains('hidden')
  }));
  assert.equal(calc.mode,'rad');assert.equal(calc.format,'scientific');
  assert.equal(calc.hidden,false);
  assert.match(calc.label,/angle=rad/);assert.match(calc.label,/format=scientific/);
  assert.ok(calc.img.includes('angle%3Drad')&&calc.img.includes('format%3Dscientific'),
   'QR must contain the updated, not stale, calculator preferences');
  const calcLayout=await layout('scientific-calculator','.calculator-setup-panel');
  await page.evaluate(()=>{window.open=()=>({focus(){}})});
  await page.locator('#launchCalculatorClassBtn').click();
  const liveCalc=await page.evaluate(()=>({
   angle:state.calculatorLaunch?.settings?.angle,
   format:state.calculatorLaunch?.settings?.format,
   screen:state.screen
  }));
  assert.deepEqual(liveCalc,{angle:'rad',format:'scientific',screen:'classroom'});
  await page.locator('#calculatorWorkflowEnd').click();
  assert.equal(await page.evaluate(()=>state.calculatorLaunch),null);
  assert.deepEqual(errors,[],'No browser JS errors');
  console.log('Phase 2F remaining setup workflow PASS',
   JSON.stringify({word,minefield,survey,calc:{mode:calc.mode,format:calc.format,liveCalc},
    mobile:{wordLayout,minefieldLayout,surveyLayout,calcLayout},errors}));
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
