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
  assert.equal(organized.selected,1);
  assert.ok(organized.accepted.includes('Red apple'));
  assert.ok(organized.size.every(x=>x<200000),'batch uploads compressed for browser save');
  await page.locator('#savePixelBtn').click();
  const saved=await page.evaluate(()=>loadSavedPixels().find(x=>x.name==='Giraffe Mystery'));
  assert.equal(saved?.images?.length,3,'saved activity includes all images');
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
  await page.evaluate(()=>{
   state.screen='activities';state.activeApp='pixel';
   state.pixelDraft=defaultPixelDraft();state.activityRun=null;render();
  });
  await page.locator('.pixel-batch-manager').waitFor();
  assert.equal(await page.locator('.pixel-batch-item').count(),1,
   'legacy single-image draft still works');
  await page.setViewportSize({width:490,height:820});
  const width=await page.evaluate(()=>({
   overflow:document.querySelector('.pixel-batch-manager').scrollWidth-
    document.querySelector('.pixel-batch-manager').clientWidth,
   columns:getComputedStyle(document.querySelector('.pixel-batch-list')).gridTemplateColumns
  }));
  assert.ok(width.overflow<=3,'compact teacher batch organizer has no horizontal overflow');
  assert.deepEqual(errors,[],'no PIXEL REVEAL browser errors');
  console.log('PIXEL batch upload + per-image answers + save/reload + teacher navigation PASSED',
   JSON.stringify({organized,second,first,width}));
 }finally{await context.close();await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
