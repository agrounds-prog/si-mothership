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
  const first=await screen.evaluate(()=>({
   rungCount:document.querySelectorAll('.million-public .million-rung').length,
   prize:document.querySelector('.million-stakes-amount')?.textContent,
   noKey:state.activityRun.millionConfig.questions.every(q=>!('correct' in q)),
   role:document.body.className
  }));
  assert.equal(first.rungCount,5);
  assert.equal(first.prize,'$100');
  assert.equal(first.noKey,true);
  assert.equal(await screen.locator('.ms-studio').count(),0,'game editor is teacher only');

  // Examine a genuine projector role, including 720p-style Zoom layouts.
  const layout=[];
  for(const [width,height] of [[1920,1080],[1366,768],[880,720]]){
   await screen.setViewportSize({width,height});
   await screen.waitForTimeout(80);
   const rect=await screen.evaluate(()=>{
    const box=sel=>{const r=document.querySelector(sel)?.getBoundingClientRect();
      return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};
    return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      stage:box('.million-public .million-stage'),
      ladder:box('.million-public .million-ladder'),
      life:box('.million-public .million-lifelines'),
      parent:box('.million-public'),
      answers:[...document.querySelectorAll('.million-choice')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}})};
   });
   layout.push({size:width+'x'+height,...rect});
   assert.ok(rect.stage&&rect.ladder&&rect.life,'projector main and sidebars present');
   assert.ok(rect.documentWidth<=width+36,'projector horizontal clipping '+width+' '+rect.documentWidth);
   if(width>=1000){
    assert.ok(rect.stage.x>=rect.ladder.right-3,'ladder overlap at '+width);
    assert.ok(rect.life.x>=rect.stage.right-3,'lifeline overlap at '+width);
   }
   assert.ok(rect.answers.every(r=>r.width>=100),'answer cards too narrow '+width);
  }

  for(let i=0;i<5;i++){
   await teacher.evaluate(()=>{
    const run=state.activityRun,m=run.million,q=run.millionConfig.questions[m.questionIndex];
    m.selectedAnswer=q.correct;m.lockedAnswer=q.correct;render();
   });
   await screen.waitForFunction(idx=>!!state.activityRun?.million?.lockedAnswer&&state.activityRun.million.questionIndex===idx,i,{timeout:10000});
   await teacher.evaluate(()=>millionResolve(true));
   await screen.waitForFunction(idx=>!!state.activityRun?.million?.revealed&&state.activityRun.million.questionIndex===idx,i,{timeout:10000});
   const result=await screen.evaluate(()=>({
    correct:document.querySelectorAll('.million-public .million-choice.correct').length,
    earned:document.querySelectorAll('.million-public .million-rung.earned').length,
    publicCorrect:state.activityRun.million.publicCorrect,
    noKey:state.activityRun.millionConfig.questions.every(q=>!('correct' in q)),
    complete:!!state.activityRun.million.complete,
    stake:document.querySelector('.million-stakes-amount')?.textContent
   }));
   assert.equal(result.correct,1,'answer reveal '+i);
   assert.equal(result.earned,i+1,'earned rung count '+i);
   assert.equal(result.noKey,true);
   assert.equal(result.complete,i===4,'completion '+i);
   if(i===4)assert.equal(result.stake,'$1,000,000');
   if(i<4)await teacher.evaluate(()=>millionNextQuestion());
  }
  assert.equal(await teacher.locator('#millionNextBtn').isDisabled(),true,'no next after million complete');
  await screen.waitForFunction(()=>document.querySelector('#msMillionStageCue')?.classList.contains('complete')===true,{timeout:6000});
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
  assert.equal(errors.length,0,'browser JS errors: '+JSON.stringify(errors));
  console.log(JSON.stringify({test:'MILLION five-question teacher/projector multiplayer and classic-risk stop',first,layout,ended,pageErrors:errors}));
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
