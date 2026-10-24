/* PIXEL REVEAL Phase 4M-F — realistic twelve-image classroom dress rehearsal.
 * Twelve distinct raster files are uploaded through the real teacher picker.
 * Browser/test data is confined to an isolated localhost classroom.
 * Covers save/reload/launch, all rounds, snapshots, compact student, and projector.
 */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error('PIXEL classroom QA is restricted to isolated localhost');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1366,height:920}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 const title='Twelve Image Classroom QA',answers=Array.from({length:12},(_,i)=>
  'Picture '+String(i+1).padStart(2,'0'));
 try{
  assert.equal((await context.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  const response=await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.SIPixelBatch&&typeof renderActivities==='function',
   null,{timeout:20000});
  await page.evaluate(()=>{
   state.screen='activities';state.activeApp='pixel';state.activityRun=null;
   state.pixelDraft=defaultPixelDraft();
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   render();
  });
  await page.locator('.pixel-batch-manager').waitFor();

  // These are actual (small) PNG uploads, not copies of one demo image.
  // Each image contains a unique color, shape, number and pattern.
  const images=await page.evaluate(()=>{
   return Array.from({length:12},(_,i)=>{
    const canvas=document.createElement('canvas');
    canvas.width=480;canvas.height=300;
    const ctx=canvas.getContext('2d');
    const hue=i*30;
    const grad=ctx.createLinearGradient(0,0,480,300);
    grad.addColorStop(0,'hsl('+hue+',68%,46%)');
    grad.addColorStop(1,'hsl('+((hue+95)%360)+',75%,24%)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,480,300);
    ctx.strokeStyle='#ffffff';ctx.lineWidth=7;
    for(let j=0;j<6;j++){
     ctx.globalAlpha=.22+j*.075;
     ctx.strokeRect(20+(i+j)*5,20+j*11,420-j*27,260-j*24);
    }
    ctx.globalAlpha=1;
    ctx.fillStyle='#ffffff';ctx.beginPath();
    const cx=100+(i%4)*70,cy=160+(i%3)*22;
    if(i%2===0)ctx.arc(cx,cy,46,0,Math.PI*2);
    else ctx.rect(cx-45,cy-45,90,90);
    ctx.fill();
    ctx.fillStyle='#09213a';ctx.font='900 82px system-ui';
    ctx.fillText(String(i+1),265,177);
    ctx.font='bold 26px system-ui';ctx.fillText('QA ROUND',252,222);
    return canvas.toDataURL('image/png').split(',')[1];
   });
  });
  assert.equal(new Set(images).size,12,'the source PNGs must all be different');
  await page.locator('#pixelImageFile').setInputFiles(images.map((base64,i)=>({
   name:'mystery-'+String(i+1).padStart(2,'0')+'.png',
   mimeType:'image/png',buffer:Buffer.from(base64,'base64')
  })));
  await page.waitForFunction(()=>state.pixelDraft?.images?.length===12&&
   document.querySelector('.pixel-batch-upload-status')?.textContent.includes('12 images added'),
   null,{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.pixel-batch-item').length===12,
   null,{timeout:15000});
  const uploaded=await page.evaluate(()=>state.pixelDraft.images.map(x=>x.image));
  assert.equal(new Set(uploaded).size,12,'each upload retains distinct raster content');
  assert.ok(uploaded.every(x=>x.startsWith('data:image/jpeg;base64,')&&x.length<200000));
  assert.equal(await page.locator('[data-pixel-inspector-prev]').isDisabled(),true);
  for(let i=0;i<12;i++){
   await page.locator('[data-pixel-batch-select="'+i+'"]').click();
   await page.locator('#pixelAnswer').fill(answers[i]);
   if(i===0||i===11)
    await page.locator('#pixelAcceptedAnswers').fill(answers[i]+'\nAlternate '+(i+1));
  }
  assert.match(await page.locator('.pixel-studio-round-progress strong').innerText(),
   /12 of 12 image answers ready/);
  assert.equal(await page.locator('.pixel-batch-item[data-answer-ready="yes"]').count(),12);
  await page.locator('#pixelName').fill(title);
  await page.locator('#savePixelBtn').click();
  await page.waitForFunction(name=>loadSavedPixels().some(item=>item.name===name&&item.images?.length===12),
   title,{timeout:20000});
  const stored=await page.evaluate(name=>{
   const entry=loadSavedPixels().find(v=>v.name===name);
   return {answers:entry?.images?.map(x=>x.answer),
    unique:new Set(entry?.images?.map(x=>x.image)).size,
    firstAlternate:entry?.images?.[0]?.acceptedAnswers.includes('Alternate 1'),
    lastAlternate:entry?.images?.[11]?.acceptedAnswers.includes('Alternate 12')};
  },title);
  assert.deepEqual(stored,{answers,unique:12,firstAlternate:true,lastAlternate:true},
   'saving twelve individually answered images preserves content and aliases');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SIPixelBatch&&typeof renderActivities==='function',
   null,{timeout:20000});
  await page.evaluate(()=>{state.screen='activities';state.activeApp='pixel';state.activityRun=null;render()});
  const card=page.locator('.pixel-studio-saved-card').filter({hasText:title});
  await card.locator('[data-load-pixel],[data-pixel-studio-load]').first().click();
  assert.deepEqual(await page.evaluate(()=>state.pixelDraft.images.map(x=>x.answer)),answers);
  assert.match(await page.locator('.pixel-studio-inspector-heading').innerText(),/IMAGE 12 OF 12|IMAGE 1 OF 12/);
  await page.locator('#launchPixelBtn').click();
  await page.evaluate(()=>{
   initializePixelRun(state.activityRun);
   state.activityRun.phase='running';
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   render();
  });
  await page.locator('.pixel-batch-live').waitFor();
  assert.equal(await page.evaluate(()=>state.activityRun.pixelConfig.images.length),12);

  // All twelve teacher-selected rounds must reach projector markup, in order,
  // with no teacher answers in the public text before Results is requested.
  for(let i=0;i<12;i++){
   const round=await page.evaluate(n=>{
    window.SIPixelBatch.switchRound(n);
    const run=state.activityRun;
    const wrapper=document.createElement('div');
    wrapper.innerHTML=pixelSharedMarkup(run,true);
    return {index:run.pixelImageIndex,answer:run.pixelConfig.answer,
     image:run.pixelConfig.image,rounds:wrapper.querySelectorAll('.pixel-cinematic-round').length,
     current:wrapper.querySelector('.pixel-cinematic-round.is-current')?.textContent,
     hidden:!wrapper.textContent.includes('Picture '+String(n+1).padStart(2,'0')),
     results:!!wrapper.querySelector('.pixel-cinematic-results'),
     marker:wrapper.textContent.includes('IMAGE '+(n+1)+' / 12')};
   },i);
   assert.deepEqual({index:round.index,answer:round.answer,rounds:round.rounds,
    current:round.current,hidden:round.hidden,results:round.results,marker:round.marker},
   {index:i,answer:answers[i],rounds:12,current:String(i+1),
    hidden:true,results:false,marker:true},
   'teacher + shared screen agree on mystery '+(i+1));
   assert.equal(round.image,uploaded[i],'round '+(i+1)+' has its own correct image');
  }

  // Saved round snapshots should isolate the revealed tiles and private guesses.
  const isolation=await page.evaluate(()=>{
   const run=state.activityRun;
   window.SIPixelBatch.switchRound(0);
   run.pixelRevealed=[0,1,2];run.pixelGuesses={Alex:{guess:'Picture 01',at:10}};
   window.SIPixelBatch.switchRound(11);
   const clean={revealed:run.pixelRevealed.length,guesses:Object.keys(run.pixelGuesses)};
   run.pixelRevealed=[4];run.pixelGuesses={Blair:{guess:'Picture 12',at:11}};
   window.SIPixelBatch.switchRound(0);
   const restored={revealed:[...run.pixelRevealed],guesses:Object.keys(run.pixelGuesses),
    answer:run.pixelConfig.answer};
   window.SIPixelBatch.switchRound(11);
   const final={revealed:[...run.pixelRevealed],guesses:Object.keys(run.pixelGuesses)};
   return {clean,restored,final};
  });
  assert.deepEqual(isolation,{clean:{revealed:0,guesses:[]},
   restored:{revealed:[0,1,2],guesses:['Alex'],answer:answers[0]},
   final:{revealed:[4],guesses:['Blair']}},
   'returning to image rounds restores only their own guesses and reveals');

  // Real shared-screen markup, mounted at 3 practical window sizes.
  for(const [width,height] of [[440,780],[800,600],[1280,720]]){
   await page.setViewportSize({width,height});
   const layout=await page.evaluate(()=>{
    const fixture=document.createElement('section');
    fixture.style.cssText='position:fixed;inset:0;overflow:auto;z-index:999999;background:#061426';
    fixture.innerHTML=pixelSharedMarkup(state.activityRun,true);
    document.body.appendChild(fixture);
    const stage=fixture.querySelector('.pixel-cinematic-public');
    const round=fixture.querySelector('.pixel-cinematic-round.is-current');
    const result={count:fixture.querySelectorAll('.pixel-cinematic-round').length,
      current:round?.textContent,overflow:stage?.scrollWidth-stage?.clientWidth,
      outerOverflow:fixture.scrollWidth-fixture.clientWidth,
      answerHidden:!fixture.textContent.includes('Picture 12')};
    fixture.remove();return result;
   });
   assert.equal(layout.count,12);
   assert.equal(layout.current,'12');
   assert.equal(layout.answerHidden,true);
   assert.ok(layout.overflow<=4&&layout.outerOverflow<=4,
    'shared-screen fits '+width+'x'+height+': '+JSON.stringify(layout));
  }

  // Compact student window uses native guess submission, not an alternate path.
  await page.setViewportSize({width:440,height:780});
  const student=await page.evaluate(()=>{
   const run=state.activityRun;
   run.pixelGuesses={};run.pixelShowResults=false;run.pixelRevealAll=false;
   // Single-submission classroom mode displays a locked receipt after Send.
   run.pixelConfig.allowUpdates=false;
   run.phase='running';state.selectedStudent='Alex';
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   state.screen='activity';
   document.body.classList.add('role-student');
   document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='student'));
   renderPublic();window.SIPixelBatch.enhanceStudent();
   const card=document.querySelector('#studentContent .pixel-student-simple');
   const field=card?.querySelector('#pixelGuessInput');
   const send=card?.querySelector('#sendPixelGuessBtn');
   const before={badge:card?.querySelector('.pixel-student-round')?.textContent,
    heading:card?.querySelector('h2')?.textContent,
    sendVisible:!!send,buttonEnabled:!send?.disabled,
    horizontalOverflow:Math.max(0,card?.scrollWidth-card?.clientWidth||0,
      document.querySelector('#studentContent')?.scrollWidth-
      document.querySelector('#studentContent')?.clientWidth||0)};
   field.value='Picture 12';field.dispatchEvent(new Event('input',{bubbles:true}));
   const enabled=!send.disabled;send.click();
   window.SIPixelBatch.enhanceStudent();
   const after={enabled,guess:run.pixelGuesses?.Alex?.guess,
    confirmation:document.querySelector('#studentContent .pixel-student-locked h2')?.textContent};
   document.body.classList.remove('role-student');
   return {before,after};
  });
  assert.deepEqual(student.before,{badge:'IMAGE 12 / 12',heading:'What do you see?',
   sendVisible:true,buttonEnabled:false,horizontalOverflow:0});
  assert.deepEqual(student.after,{enabled:true,guess:'Picture 12',confirmation:'Guess sent!'},
   'student compact view sends a private guess on the twelfth image');
  assert.deepEqual(errors,[],'no JavaScript errors across 12 classroom images');
  console.log('TWELVE-IMAGE REAL UPLOAD CLASSROOM QA PASSED',
   JSON.stringify({uniqueUploaded:new Set(uploaded).size,rounds:12,stored,
    isolation,student,viewportCount:3}));
 }finally{await context.close();await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
