/* Phase 4R SI+ position-aware import, lossless type changes and reload.
 * Executed on the isolated localhost classroom only. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1380,height:920}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  assert.equal((await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(()=>networkHydrated===true&&typeof siPlusChangeSlideType==='function'&&window.SIPlusOrganizerParity,null,{timeout:20000});
  await page.evaluate(()=>{state.activityRun=null;state.screen='classroom';openNewPresentation()});
  const pix=await page.evaluate(()=>Array.from({length:4},(_,i)=>{
   const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');
   x.fillStyle=['#64bcee','#fabd66','#a68af6','#87d59c'][i];x.fillRect(0,0,320,180);
   return c.toDataURL('image/png').split(',')[1];
  }));
  const image=(i,name)=>({name,mimeType:'image/png',buffer:Buffer.from(pix[i],'base64')});
  await page.locator('#siPlusBatchImages').setInputFiles([image(0,'01 Start.png'),image(2,'03 Finish.png')]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===2&&!siPlusBatchImportBusy);
  await page.locator('#siPlusBatchInsertPosition').selectOption({value:'1'});
  await page.locator('#siPlusBatchImages').setInputFiles([image(1,'02 Talk.png')]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===3&&!siPlusBatchImportBusy);
  const current=()=>page.evaluate(()=>state.presentationEditor.draft.slides);
  assert.deepEqual((await current()).map(s=>s.listTitle),['01 Start','02 Talk','03 Finish']);
  assert.equal(await page.evaluate(()=>state.editorSlide),1);
  const original=(await current())[1].image;
  await page.locator('#slideYoutube').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.locator('#slideTitle').fill('What did you notice?');
  await page.locator('#siPlusSlideType').selectOption('question');
  await page.locator('[data-choice-text="B"]').fill('A friendly response');
  await page.locator('[data-correct="B"]').click();
  assert.equal((await current())[1].correct,'B');
  await page.locator('#siPlusSlideType').selectOption('poll');
  assert.equal(Object.hasOwn((await current())[1],'correct'),false);
  assert.equal((await current())[1].choices.find(x=>x.key==='B').text,'A friendly response');
  await page.locator('#siPlusSlideType').selectOption('instruction');
  assert.equal((await current())[1].image,original);
  assert.equal((await current())[1].youtube,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.locator('#siPlusSlideType').selectOption('poll');
  await page.locator('#siOrgToggle').click();
  await page.locator('#siOrgInsertPosition').selectOption({value:'0'});
  await page.locator('#siOrgBatchImages').setInputFiles([image(3,'00 Welcome.png')]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===4&&!siPlusBatchImportBusy);
  assert.deepEqual((await current()).map(s=>s.listTitle),['00 Welcome','01 Start','02 Talk','03 Finish']);
  const local=await page.evaluate(()=>SIPlusDraftRecovery.flush());
  assert.equal(local.draft.slides.length,4);
  await page.locator('#presentationTitleInput').fill('SI+ 4R Classroom Test');
  await page.locator('#savePresentationBtn').click();
  await page.waitForFunction(()=>state.presentationEditor===null,null,{timeout:20000});
  const stored=(await (await page.request.get(BASE+'/api/storage')).json()).items['siMothership.presentations.v1'];
  const saved=JSON.parse(stored).find(x=>x.deckTitle==='SI+ 4R Classroom Test');
  assert.ok(saved);
  assert.deepEqual(saved.slides.map(s=>s.listTitle),['00 Welcome','01 Start','02 Talk','03 Finish']);
  assert.equal(saved.slides[2].type,'poll');
  assert.equal(saved.slides[2].image,original);
  assert.equal(Object.hasOwn(saved.slides[2],'correct'),false);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>networkHydrated&&state.activities.some(a=>a.deckTitle==='SI+ 4R Classroom Test'),null,{timeout:20000});
  await page.evaluate(()=>{state.activityRun=null;openEditPresentation(state.activities.find(a=>a.deckTitle==='SI+ 4R Classroom Test').id)});
  await page.locator('#siOrgToggle').click();
  assert.equal(await page.locator('.si-org-card').count(),4);
  await page.locator('[data-org-edit="2"]').click();
  assert.equal(await page.locator('#siPlusSlideType').inputValue(),'poll');
  assert.equal(await page.locator('#slideYoutube').inputValue(),'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  // Multi-select group moves happen in the unsaved draft only; preserve
  // ordering within the group and keep the active edited slide selected.
  await page.locator('#siOrgToggle').click();
  await page.locator('[data-org-select="1"]').check();
  await page.locator('[data-org-select="2"]').check();
  await page.locator('#siOrgGroupMoves [data-org-group="end"]').click();
  assert.deepEqual((await current()).map(s=>s.listTitle),
    ['00 Welcome','03 Finish','01 Start','02 Talk']);
  assert.equal(await page.evaluate(()=>state.presentationEditor.draft.slides[state.editorSlide].listTitle),'02 Talk');
  await page.locator('[data-org-select="2"]').check();
  await page.locator('[data-org-select="3"]').check();
  await page.locator('#siOrgGroupMoves [data-org-group="start"]').click();
  assert.deepEqual((await current()).map(s=>s.listTitle),
    ['01 Start','02 Talk','00 Welcome','03 Finish']);
  assert.equal(await page.evaluate(()=>state.presentationEditor.draft.slides[state.editorSlide].listTitle),'02 Talk');
  assert.deepEqual(await page.evaluate(()=>state.activities.find(a=>a.deckTitle==='SI+ 4R Classroom Test')
    .slides.map(s=>s.listTitle)),['00 Welcome','01 Start','02 Talk','03 Finish'],
    'Organizer changes stay in draft until teacher saves');

  assert.deepEqual(errors,[]);
  console.log('SI+ PHASE 4R POSITION IMPORT / TYPE SWITCH / SAVE AND RELOAD PASSED');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});