/* The Bingo studio art is image-backed, responsive, and leaves the teacher controls alive. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(BASE))
  throw Error('Run graphics smoke tests only against an isolated classroom');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  assert.equal((await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof bbsWire==='function'&&(!NETWORK_SYNC||networkHydrated),null,{timeout:20000});
  await page.evaluate(()=>{state.screen='activities';state.activeApp='bingo';state.activityRun=null;render()});
  await page.waitForSelector('.bbs-studio .bbs-grid .bbs-tile');
  assert.equal(await page.locator('.bbs-grid .bbs-tile').count(),16);
  assert.equal(await page.locator('.bbs-library .bbs-upload').count(),1);
  assert.equal(await page.locator('#bbsSaveLaunch').count(),1);
  const backgrounds=await page.evaluate(()=>{
   const selectors=['.bbs-hero','.bbs-board-panel','.bbs-library','.bbs-saved','.bbs-tile.bbs-empty','#bbsSaveLaunch'];
   return selectors.map(selector=>{
    const node=document.querySelector(selector);return {selector,background:getComputedStyle(node).backgroundImage};
   });
  });
  assert.ok(backgrounds.every(x=>x.background.includes('/bingo-studio-art/')),JSON.stringify(backgrounds));
  for(const name of ['hero-header','bridge-backdrop','board-panel','library-panel','saved-panel',
    'tile-empty','tile-selected','tile-free','button-blue','button-green','button-red','button-slate']){
   const response=await page.request.get(BASE+'/bingo-studio-art/'+name+'.webp');
   assert.equal(response.status(),200,name);
   assert.match(response.headers()['content-type'],/image\/webp/);
   const bytes=await response.body();
   assert.ok(bytes.length>900,name);
  }
  for(const width of [1440,780,390]){
   await page.setViewportSize({width,height:930});
   const geometry=await page.evaluate(()=>{
    const wrap=document.querySelector('#activitiesPanel');
    const rect=wrap.getBoundingClientRect();
    return {width:rect.width,x:rect.x,documentWidth:document.documentElement.scrollWidth,
     viewportWidth:innerWidth,loaded:!!document.querySelector('.bbs-tile')};
   });
   assert.equal(geometry.loaded,true);
   assert.ok(geometry.width<width+5,'Bingo studio exceeds viewport: '+JSON.stringify(geometry));
  }
  // New tiles still enter text-edit mode; cosmetic graphics may not intercept clicks.
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-bbs-tile="0"]').click();
  await page.locator('#bbsTypeText').fill('Graphic Test');
  await page.locator('#bbsTypeSave').evaluate(button=>button.click());
  assert.match(await page.locator('[data-bbs-tile="0"]').innerText(),/Graphic Test/);
  assert.deepEqual(errors,[]);
  console.log('PASS: Bingo illustrated studio assets, layout and teacher tile editing');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
