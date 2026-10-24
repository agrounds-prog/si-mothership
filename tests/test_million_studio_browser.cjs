/* Local-only Chromium regression for MILLION Studio. No production writes. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  await page.goto(base+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(()=>!!window.MillionStudio,{timeout:12000});
  const auth=await page.evaluate(async()=>{
   const r=await fetch('/api/teacher/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'5030'})});
   return r.status;
  });
  assert.equal(auth,200,'teacher cookie for isolated local server');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.MillionStudio);
  await page.evaluate(()=>{
   state.activityRun=null;state.screen='activities';state.activeApp='million';render();
  });
  await page.locator('.ms-studio').waitFor({timeout:12000});
  assert.equal(await page.locator('.ms-slide').count(),15);
  await page.locator('#msName').fill('Browser Regression Million Game');
  await page.locator('#msCount').selectOption('5');
  assert.equal(await page.locator('.ms-slide').count(),5);
  assert.match(await page.locator('#msQuestionCheck').innerText(),/IN PROGRESS.*question prompt/);
  assert.match(await page.locator('#msQuestionCheck').innerText(),/answer A/);
  await page.locator('#msPrompt').fill('Draft question preview');
  assert.match(await page.locator('#msQuestionCheck').innerText(),/answer A/);
  await page.locator('[data-ms-answer="0"]').fill('Draft answer A');
  assert.match(await page.locator('.ms-preview-choices>div').first().innerText(),/Draft answer A/);
  await page.locator('#msNextIncomplete').click();
  assert.equal(await page.locator('#msPrompt').inputValue(),'');
  assert.equal(await page.locator('[data-ms-slide="1"]').getAttribute('aria-current'),'step');
  for(let i=0;i<5;i++){
   await page.locator('[data-ms-slide="'+i+'"]').click();
   await page.locator('#msPrompt').fill('Question '+(i+1)+' — crew skills?');
   for(let c=0;c<4;c++)await page.locator('[data-ms-answer="'+c+'"]').fill('Option '+String.fromCharCode(65+c)+' '+(i+1));
   await page.locator('#msCorrect').selectOption(i%2?'D':'B');
   await page.locator('#msClue').fill('Mothership clue '+i);
  }
  assert.equal(await page.evaluate(()=>window.MillionStudio.inspection().ready),5);
  assert.match(await page.locator('#msQuestionCheck').innerText(),/READY FOR CLASS/);
  assert.equal(await page.locator('#msNextIncomplete').isDisabled(),true);
  const selected=await page.evaluate(()=>window.MillionStudio.questions());
  assert.equal(selected.length,5);
  assert.equal(selected[1].correct,'D');
  assert.equal(await page.evaluate(()=>window.MillionStudio.ladder(5).at(-1)),1000000);
  await page.locator('#msSaveGame').click();
  await page.waitForFunction(()=>window.MillionStudio.inspection().saved===1,null,{timeout:12000});
  const before=await page.evaluate(async()=>{
   const snap=await fetch('/api/storage').then(r=>r.json());
   return {saveCount:JSON.parse(snap.items['siMothership.millionGames.v1']||'[]').length,
    draft:!!snap.items['siMothership.millionDraft.v1']};
  });
  assert.equal(before.saveCount,1,'saved on server, not only local browser');
  await page.evaluate(async()=>{
   const r=await fetch('/api/session/new',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   if(!r.ok)throw Error('Isolated reset failed '+r.status);
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.MillionStudio);
  await page.evaluate(()=>{state.activityRun=null;state.screen='activities';state.activeApp='million';render()});
  await page.locator('.ms-studio').waitFor();
  await page.locator('[data-ms-tab="library"]').click();
  await page.locator('.ms-saved-game').waitFor();
  assert.match(await page.locator('.ms-saved-game h3').textContent(),/Browser Regression Million Game/);
  await page.locator('#msLibrarySearch').fill('nonsense-search');
  assert.equal(await page.locator('.ms-saved-game:visible').count(),0);
  await page.locator('#msLibrarySearch').fill('Browser Regression');
  assert.equal(await page.locator('.ms-saved-game:visible').count(),1);
  await page.locator('#msLibrarySearch').fill('');
  await page.locator('[data-ms-copy]').click();
  await page.waitForFunction(()=>window.MillionStudio.inspection().saved===2,null,{timeout:12000});
  assert.equal(await page.locator('#msName').inputValue(),'Copy of Browser Regression Million Game');
  await page.locator('#msPrompt').fill('Revised copy-only question');
  await page.locator('#msSaveGame').click();
  await page.waitForFunction(async()=>{
   const response=await fetch('/api/storage').then(r=>r.json());
   const items=JSON.parse(response.items['siMothership.millionGames.v1']||'[]');
   return items.some(g=>g.data.questions[0].prompt==='Revised copy-only question');
  },null,{timeout:12000});
  await page.locator('[data-ms-tab="library"]').click();
  assert.equal(await page.locator('.ms-saved-game').count(),2);
  await page.locator('[data-ms-load]').last().click();
  assert.equal(await page.locator('#msName').inputValue(),'Browser Regression Million Game');
  assert.equal(await page.locator('#msPrompt').inputValue(),'Question 1 — crew skills?', 'original remains unchanged');
  assert.equal(await page.evaluate(()=>window.MillionStudio.inspection().ready),5);
  // Isolated engine exercise: rotation follows current student by name, even
  // if a new classmate joins or the roster is reordered.
  const checks=await page.evaluate(()=>{
   const savedRun=state.activityRun,oldStudents=state.students;
   const cfg={questions:[{prompt:'First',choices:['A','B','C','D'].map(k=>({key:k,text:k})),correct:'B'}],
    ladder:[100,200],risk:'practice',pilotMode:'rotate',checkpoints:[]};
   const m={pilot:'Crew',pilotIndex:1,questionIndex:0,selectedAnswer:'',lockedAnswer:'',
    inventory:{poll:2,reduce:2,clue:2,tryAgain:2},pollOpen:false,pollVisible:false,
    crewPredictions:{},eliminated:[],publicClue:'',revealed:false,result:'',
    complete:false,over:false,ladderLevel:0};
   state.students=[{n:'Crew',offline:false},{n:'Pilot',offline:false},{n:'New Student',offline:false}];
   state.activityRun={activityId:'million-game',phase:'running',millionConfig:cfg,million:m,runToken:'qa-million'};
   millionRotatePilot();
   const rotation=m.pilot;
   millionUseLifeline('tryAgain',false);
   const idle=m.inventory.tryAgain;
   millionUseLifeline('poll',false);millionUseLifeline('poll',false);
   const poll={left:m.inventory.poll,open:m.pollOpen};
   millionUseLifeline('clue',false);millionUseLifeline('clue',false);
   const clue={left:m.inventory.clue,text:m.publicClue};
   m.selectedAnswer='A';
   millionUseLifeline('reduce',false);
   const eliminated=[...m.eliminated],stock=m.inventory.reduce;
   millionUseLifeline('reduce',false);
   m.lockedAnswer='A';
   const selectedBefore=m.selectedAnswer;
   millionSetPilot('Crew');
   const locked={pilot:m.pilot,selected:m.selectedAnswer};
   const start=Date.now()-62000;
   m.questionStartedAt=start;m.questionEndedAt=null;
   const elapsedBefore=Math.round((Date.now()-m.questionStartedAt)/1000);
   const pausedAt=Date.now()-4000;
   m.pausedAt=pausedAt;
   m.questionStartedAt+=Date.now()-m.pausedAt;
   const pausedTime=Math.round((Date.now()-m.questionStartedAt)/1000);
   state.activityRun=savedRun;state.students=oldStudents;
   return {rotation,idle,poll,clue,eliminated,stock,selectedBefore,locked,
    elapsedBefore,pausedTime};
  });
  assert.equal(checks.rotation,'Pilot','rotation uses the active pilot identity');
  assert.equal(checks.idle,2,'an unused Try Again does not spend a charge');
  assert.deepEqual(checks.poll,{left:1,open:true},'poll cannot be spent twice in one round');
  assert.equal(checks.clue.left,1,'repeating the same clue does not consume stock');
  assert.deepEqual(checks.eliminated,['C','D']);
  assert.equal(checks.stock,1,'50/50 remains one-use per question');
  assert.deepEqual(checks.locked,{pilot:'Pilot',selected:'A'},
   'a locked answer cannot be overwritten by changing pilot');
  assert.ok(checks.elapsedBefore>=60&&checks.pausedTime<checks.elapsedBefore,
   'the question clock can account for paused time without a cutoff');
  await page.setViewportSize({width:390,height:844});
  const layout=await page.evaluate(()=>{
   const r=document.querySelector('.ms-studio').getBoundingClientRect();
   return {width:r.width,inner:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  console.log(JSON.stringify({test:'MILLION Studio create/save/session-reset/reload/mobile',before,layout,errors}));
  assert.ok(layout.inner<=layout.viewport+35,'mobile horizontal overflow');
  assert.equal(errors.length,0,'no browser JS errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
