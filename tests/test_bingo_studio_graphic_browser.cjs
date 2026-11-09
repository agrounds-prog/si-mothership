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
  assert.match(await page.locator('.bbs-setup-heading h3').innerText(),/BOARD SETUP/);
  assert.match(await page.locator('.bbs-library .bbs-head h3').innerText(),/SELECT YOUR PICTURES/);
  const artFrame=await page.locator('.bbs-board-frame').evaluate(el=>
    getComputedStyle(el,'::after').borderImageSource);
  assert.match(artFrame,/board-stage-rail\.webp/,'Approved illustrated grid frame must be applied');
  const backgrounds=await page.evaluate(()=>{
   const selectors=['.bbs-hero','.bbs-board-panel','.bbs-library','.bbs-saved','.bbs-tile.bbs-empty','#bbsSaveLaunch'];
   return selectors.map(selector=>{
    const node=document.querySelector(selector);return {selector,background:getComputedStyle(node).backgroundImage};
   });
  });
  assert.ok(backgrounds.every(x=>x.background.includes('/bingo-studio-art/')),JSON.stringify(backgrounds));
  for(const name of ['hero-header','bridge-backdrop','board-panel','library-panel','saved-panel',
    'tile-empty','tile-selected','tile-free','button-blue','button-green','button-red','button-slate','board-stage-rail']){
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
  // All four supported grid sizes must stay inside the viewport and keep
  // accessible authoring controls in both large and compact teacher windows.
  for(const width of [1440,780,390]){
   await page.setViewportSize({width,height:930});
   for(const size of [3,4,5,6]){
    await page.locator('#bbsSize').selectOption(String(size));
    const dimensions=await page.evaluate(()=>{
      const board=document.querySelector('.bbs-grid');
      const tiles=[...board.querySelectorAll('.bbs-tile')];
      const shell=document.querySelector('.bbs-board-panel');
      const sr=shell.getBoundingClientRect();
      const br=board.getBoundingClientRect();
      const parent=document.querySelector('#activitiesPanel');
      const headings=[...document.querySelectorAll('.bbs-head h3,.bbs-setup-heading h3')];
      return {size:Number(board.dataset.bbsSize),
        columns:getComputedStyle(board).gridTemplateColumns.split(' ').length,
        count:tiles.length,tiles:tiles.map(t=>t.getBoundingClientRect().width),
        boardRight:br.right,shellRight:sr.right,
        viewport:innerWidth,paneScroll:parent.scrollHeight>parent.clientHeight,
        headings:headings.map(h=>h.innerText)};
    });
    assert.equal(dimensions.size,size);
    assert.equal(dimensions.columns,size,'Incorrect grid columns: '+JSON.stringify(dimensions));
    assert.equal(dimensions.count,size*size);
    assert.ok(dimensions.tiles.every(w=>w>=27),'Tiles too small: '+JSON.stringify(dimensions));
    assert.ok(dimensions.boardRight<=width+3,'Bingo grid outside screen: '+JSON.stringify(dimensions));
    assert.ok(dimensions.shellRight<=width+3,'Bingo studio outside screen: '+JSON.stringify(dimensions));
   }
   await page.locator('#bbsSize').selectOption('4');
   await page.locator('#bbsSave').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('#bbsSave').isVisible(),true,
     'Save Board must remain reachable in a compact teacher window');
   assert.equal(await page.locator('#bbsSaveLaunch').isVisible(),true);
  }
  // New tiles still enter text-edit mode; cosmetic graphics may not intercept clicks.
  await page.setViewportSize({width:1440,height:1000});
  console.log('BINGO_UI_FRAME',JSON.stringify(await page.evaluate(()=>{
    const outer=document.querySelector('#activitiesPanel'),tile=document.querySelector('[data-bbs-tile="0"]');
    const p=outer.getBoundingClientRect(),t=tile.getBoundingClientRect(),cs=getComputedStyle(outer);
    return {outer:{top:p.y,bottom:p.bottom,left:p.x,right:p.right,width:p.width,height:p.height,position:cs.position,transform:cs.transform,overflowY:cs.overflowY,scrollTop:outer.scrollTop,scrollHeight:outer.scrollHeight,clientHeight:outer.clientHeight},
      tile:{top:t.y,bottom:t.bottom,left:t.x,right:t.right},viewport:[innerWidth,innerHeight]};
  })));
  await page.locator('[data-bbs-tile="0"]').evaluate(button=>button.click());
  await page.locator('#bbsTypeText').fill('Graphic Test');
  await page.locator('#bbsTypeSave').evaluate(button=>button.click());
  assert.match(await page.locator('[data-bbs-tile="0"]').innerText(),/Graphic Test/);
  assert.deepEqual(errors,[]);
  console.log('PASS: Bingo illustrated studio assets, layout and teacher tile editing');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
