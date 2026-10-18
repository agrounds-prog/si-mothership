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
  await page.locator('#launchCrewSurveyBtn').click();
  console.log('CREW SURVEY VALIDATION DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>({
    status:document.querySelector('#crewSurveySetupStatus')?.textContent||'',
    prompt:crewSurveyDraft.prompt,
    connected:connectedStudents().length,
    run:state.activityRun?.activityId||null,
    show:document.querySelector('#bootErrorText')?.textContent?.slice(0,120)||''
  }))));
  assert.match(await page.locator('#crewSurveySetupStatus').innerText(),/survey prompt/i);
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
  await page.locator('#launchCrewSurveyBtn').click();
  const survey=await page.evaluate(()=>({
   id:state.activityRun?.activityId,phase:state.activityRun?.phase,
   prompt:state.activityRun?.crewSurveyConfig?.prompt,
   count:state.activityRun?.crewSurveyConfig?.answers?.length,
   first:state.activityRun?.crewSurveyConfig?.answers?.[0]?.text,
   scoring:state.activityRun?.crewSurveyConfig?.scoring,
   aac:state.activityRun?.crewSurveyConfig?.aacStudents
  }));
  assert.deepEqual(survey,{id:'crew-survey-game',phase:'lobby',
   prompt:'Which school supplies help us learn?',count:7,first:'Pencils',
   scoring:false,aac:['Alex']});
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
