/* Phase 2F MATCH authoring smoke test — isolated localhost only.
   Never creates users or writes to the production Railway volume. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error('MATCH workflow regression is restricted to isolated localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1366,height:960}});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  assert.equal((await ctx.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(()=>typeof renderActivities==='function'&&
   typeof matchBuilderWire==='function'&&networkHydrated===true,null,{timeout:25000});
  await page.evaluate(()=>{
   state.screen='activities';state.activeApp='match';state.activityRun=null;
   state.assigningSlot=null;
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   render();
  });
  await page.locator('.mcb-shell').waitFor();
  await page.locator('[data-mcb-mode="quick"]').click();
  await page.locator('#matchSetName').fill('Phase 2F isolated MATCH set');
  await page.locator('#mcbQuickPairs').fill([
   'Cat | Kitten','Dog | Puppy','Cow | Calf','Sheep | Lamb',
   'Horse | Foal','Duck | Duckling','Goat | Kid','Pig | Piglet'
  ].join('\n'));
  await page.waitForFunction(()=>document.querySelector('#mcbPairCount')?.textContent==='8');
  await page.locator('#matchMode').selectOption('individual');
  await page.locator('#matchScoring').selectOption('pairs');
  await page.locator('#matchTurnRule').selectOption('match_go_again');
  const before=await page.evaluate(()=>({
   pairs:matchBuilderPairs().length,mode:matchDraft.editorMode,
   turn:matchLaunchSettings.turnRule,score:matchLaunchSettings.scoring
  }));
  assert.deepEqual(before,{pairs:8,mode:'quick',turn:'match_go_again',score:'pairs'});
  await page.locator('#mcbSave').click();
  await page.waitForFunction(()=>matchSets.some(s=>s.name==='Phase 2F isolated MATCH set'),
   null,{timeout:12000});
  const original=await page.evaluate(()=>{
   const saved=matchSets.find(s=>s.name==='Phase 2F isolated MATCH set');
   return {pairs:saved?.pairs?.length,name:saved?.name};
  });
  assert.equal(original.pairs,8,'all eight pairs saved');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof renderActivities==='function'&&networkHydrated===true,
   null,{timeout:25000});
  await page.evaluate(()=>{
   state.screen='activities';state.activeApp='match';state.activityRun=null;
   state.assigningSlot=null;
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   render();
  });
  await page.locator('.mcb-shell').waitFor();
  const restored=await page.evaluate(()=>matchSets.some(s=>
   s.name==='Phase 2F isolated MATCH set'&&s.pairs.length===8));
  assert.equal(restored,true,'saved sets survive browser reload and remote hydration');
  await page.locator('.mcb-saved-set')
   .filter({hasText:'Phase 2F isolated MATCH set'}).locator('[data-mcb-load]').click();
  assert.equal(await page.locator('#matchSetName').inputValue(),'Phase 2F isolated MATCH set');
  assert.equal(await page.locator('[data-mcb-mode="pairs"]').getAttribute('aria-selected'),'true');
  assert.equal(await page.evaluate(()=>matchBuilderPairs().length),8,'restored pair content editable');
  await page.setViewportSize({width:500,height:850});
  const geometry=await page.evaluate(()=>{
   const root=document.querySelector('.mcb-shell'),grid=document.querySelector('#activityGrid');
   return {viewport:innerWidth,page:document.documentElement.scrollWidth,
    rootWidth:root.getBoundingClientRect().width,gridWidth:grid.getBoundingClientRect().width,
    pairs:root.querySelectorAll('.mcb-pair-row').length,
    controlsVisible:!!root.querySelector('#mcbSaveLaunch')?.getClientRects().length};
  });
  assert.ok(geometry.page<=geometry.viewport+35,'500px MATCH builder should not overflow: '+JSON.stringify(geometry));
  assert.ok(geometry.controlsVisible&&geometry.pairs===8,'all paired editing fields and launch remain accessible');
  await page.locator('#mcbSaveLaunch').click();
  await page.waitForFunction(()=>state.activityRun?.activityId==='match-game',null,{timeout:15000});
  const launched=await page.evaluate(()=>({
   activity:state.activityRun?.activityId,pairs:state.activityRun?.matchConfig?.pairs?.length||
    state.activityRun?.match?.cards?.length/2||0
  }));
  assert.equal(launched.activity,'match-game','saved set launches the native MATCH game');
  assert.deepEqual(errors,[],'no JavaScript runtime errors during MATCH workflow');
  console.log('MATCH Phase 2F create/save/reload/edit/mobile/launch PASS',JSON.stringify({original,geometry,launched}));
 }finally{await ctx.close();await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
