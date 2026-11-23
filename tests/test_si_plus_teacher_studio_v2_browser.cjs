/* SI+ Teacher Studio V2 geometry and real controls on isolated localhost.
   No existing deck is modified; temporary slide edits stay unsaved. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(BASE))
 throw Error('Studio visual test is localhost only');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [width,height] of [[1440,900],[1024,800],[390,780]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   assert.equal((await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
   await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>networkHydrated===true&&typeof openNewPresentation==='function',null,{timeout:22000});
   await page.evaluate(()=>{state.activityRun=null;state.screen='classroom';openNewPresentation()});
   await page.waitForSelector('#presentationBuilderPanel.si-art-builder .si-studio-pulse',{timeout:12000});
   const d=await page.evaluate(()=>{
     const a=state.presentationEditor.draft;
     a.slides=[freshSlide('instruction'),freshSlide('question'),freshSlide('poll')];
     a.slides[0].listTitle='Welcome';a.slides[1].listTitle='Discuss';a.slides[2].listTitle='Vote';
     state.editorSlide=1;renderPresentationBuilder();
   });
   await page.waitForFunction(()=>document.querySelector('.si-studio-pulse-item strong')?.textContent==='2 of 3');
   const layout=await page.evaluate(()=>{
     const root=document.querySelector('#presentationBuilderPanel');
     const grid=root.querySelector('.builder-layout');
     const col=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean);
     const rects=[...grid.children].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,right:r.right}});
     const r=root.getBoundingClientRect();
     return {columns:col.length,panelWidth:r.width,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,rects,
       previews:root.querySelectorAll('.slide-nav-item .si-studio-rail-thumb').length,
       position:root.querySelector('.si-studio-pulse-item strong')?.textContent,
       type:root.querySelectorAll('.si-studio-pulse-item strong')[1]?.textContent};
   });
   assert.equal(layout.position,'2 of 3');
   assert.equal(layout.type,'Question');
   assert.equal(layout.previews,3,'Filmstrip reflects each draft slide');
   assert.equal(await page.locator('.si-studio-rail-header span').innerText(),'3 SLIDES');
   assert.deepEqual(await page.locator('.slide-nav-item .si-studio-rail-number').allInnerTexts(),
     ['01','02','03'],'Filmstrip shows ordered slide numbers');
   assert.deepEqual(await page.locator('.slide-nav-item .si-studio-rail-meta').allInnerTexts(),
     ['INSTRUCTION','QUESTION','POLL'],'Filmstrip identifies slide types');
   assert.equal(await page.locator('.slide-nav-item[aria-current="step"]').count(),1,
     'Exactly one current slide is exposed to keyboard and screen-reader users');
   assert.match(await page.locator('.si-studio-pulse-summary').innerText(),/2 questions \/ polls/);
   await page.locator('.slide-nav-item').nth(2).click();
   await page.waitForFunction(()=>state.editorSlide===2&&
     document.querySelector('.si-studio-pulse-item strong')?.textContent==='3 of 3');
   assert.equal(await page.locator('.slide-nav-item[aria-current="step"]').count(),1);
   assert.equal(await page.locator('.slide-nav-item[aria-current="step"] .si-studio-rail-meta').innerText(),'POLL');

   assert.ok(layout.scrollWidth<=layout.clientWidth+8,'Editor must not overflow horizontally: '+JSON.stringify(layout));
   assert.equal(layout.columns,width<=800?1:2,'Builder must prioritize wide editor');
   if(width>800&&layout.rects.length>=3){
     assert.ok(layout.rects[1].left>layout.rects[0].left,
       'Main slide editor must sit to the right of filmstrip');
     assert.ok(layout.rects[2].top>=layout.rects[0].top,
       'Slide creation must remain reachable');
   }
   assert.equal(await page.locator('#siPlusPreviewBtn').count(),1);
   assert.equal(await page.locator('#savePresentationBtn').count(),1);
   assert.equal(await page.locator('#siOrgToggle').count(),1);
   await page.locator('#siOrgToggle').click();
   await page.waitForFunction(()=>document.querySelectorAll('.si-org-card').length===3);
   const thumbs=await page.locator('.si-org-thumb').first().evaluate(el=>{
     const r=el.getBoundingClientRect();return {w:r.width,h:r.height};
   });
   assert.ok(Math.abs(thumbs.w/thumbs.h-16/9)<.06,'Organizer thumbnails keep 16:9');
   await page.locator('#siOrgToggle').click();
   await page.locator('#siPlusPreviewBtn').click();
   await page.locator('#siPlusPreviewOverlay').waitFor();
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#siPlusPreviewOverlay').count(),0,'Private preview closes');
   assert.deepEqual(errors,[],'No JavaScript exceptions from teacher studio');
   console.log('PASS Studio v2',JSON.stringify({viewport:[width,height],layout,thumbs}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
