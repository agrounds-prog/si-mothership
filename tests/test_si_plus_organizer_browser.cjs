/* SI+ thumbnail organizer: visual previews, drag reorder, accessible touch
   controls, duplication, multi-delete, and durable Railway SQLite saving.
   Executed only on a temporary local test server. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1380,height:940}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  const login=await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}});
  assert.equal(login.status(),200);
  await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(()=>typeof siPlusOrganizerMove==='function'&&networkHydrated===true,null,{timeout:16000});
  await page.evaluate(()=>{state.activityRun=null;state.screen='classroom';openNewPresentation()});
  const screenshots=await page.evaluate(()=>['#62b6ed','#edbd58','#aa85e8'].map((color,index)=>{
   const canvas=document.createElement('canvas');canvas.width=250;canvas.height=160;
   const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,250,160);
   ctx.fillStyle='#111c33';ctx.font='bold 40px sans-serif';ctx.fillText('Slide '+(index+1),35,100);
   return canvas.toDataURL('image/png').split(',')[1];
  }));
  const image=(index,name)=>({name,mimeType:'image/png',buffer:Buffer.from(screenshots[index],'base64')});
  await page.locator('#siPlusBatchImages').setInputFiles([
   image(0,'01 Opening.png'),image(1,'02 Practice.png'),image(2,'03 Finish.png')
  ]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===3&&!siPlusBatchImportBusy,null,{timeout:20000});
  await page.evaluate(()=>{
   const slides=state.presentationEditor.draft.slides;
   const q=freshSlide('question');q.listTitle='Understanding Check';q.title='What is next?';
   const p=freshSlide('poll');p.listTitle='Class Poll';p.title='How was the lesson?';
   slides.push(q,p);renderPresentationBuilder();
  });
  await page.locator('#siOrgToggle').click();
  assert.equal(await page.locator('.si-org-card').count(),5);
  assert.equal(await page.locator('.si-org-thumb img').count(),3);
  await page.waitForSelector('#siOrgBatchImages');
  assert.equal(await page.locator('#siOrgBatchImages').getAttribute('multiple'),'');
  const ratio=await page.locator('.si-org-thumb').first().evaluate(el=>{
    const r=el.getBoundingClientRect();return r.width/r.height;
  });
  assert.ok(Math.abs(ratio-16/9)<0.05,'Slide organizer displays real 16:9 thumbnails');
  await page.locator('[data-org-preview="2"]').click();
  assert.match(await page.locator('.sipreview-count').innerText(),/Slide 3 of 5/);
  assert.match(await page.locator('.sipreview-slide-label').innerText(),/03 Finish/);
  await page.locator('.sipreview-close').click();
  // Explicit value avoids ambiguity with the human-facing label "4".
  await page.locator('[data-org-position="0"]').selectOption({value:'4'});
  assert.deepEqual(await page.evaluate(()=>state.presentationEditor.draft.slides.map(s=>s.listTitle)),[
   '02 Practice','03 Finish','Understanding Check','Class Poll','01 Opening'
  ]);
  await page.locator('[data-org-position="4"]').selectOption('0');
  assert.deepEqual(await page.evaluate(()=>state.presentationEditor.draft.slides.map(s=>s.listTitle)),[
   '01 Opening','02 Practice','03 Finish','Understanding Check','Class Poll'
  ]);
  assert.equal(await page.locator('.si-org-empty').count(),2);
  assert.equal(await page.locator('.builder-layout').evaluate(x=>getComputedStyle(x).display),'none');
  const buttons=await page.evaluate(()=>[...document.querySelectorAll('.si-org-card-actions button')].map(x=>({
   aria:x.getAttribute('aria-label')||x.textContent.trim(),height:x.getBoundingClientRect().height
  })));
  assert.ok(buttons.every(x=>x.height>=42),'Touch reorder and duplicate controls must be at least 42px high');
  await page.locator('[data-org-copy="1"]').click();
  assert.deepEqual(await page.evaluate(()=>state.presentationEditor.draft.slides.map(s=>s.listTitle)),[
   '01 Opening','02 Practice','02 Practice (Copy)','03 Finish','Understanding Check','Class Poll'
  ]);
  await page.locator('[data-org-after="2"]').click();
  assert.deepEqual(await page.evaluate(()=>state.presentationEditor.draft.slides.map(s=>s.listTitle)),[
   '01 Opening','02 Practice','03 Finish','02 Practice (Copy)','Understanding Check','Class Poll'
  ]);
  await page.locator('[data-org-drag="0"]').dragTo(page.locator('[data-org-drag="4"]'));
  assert.deepEqual(await page.evaluate(()=>state.presentationEditor.draft.slides.map(s=>s.listTitle)),[
   '02 Practice','03 Finish','02 Practice (Copy)','Understanding Check','01 Opening','Class Poll'
  ],'Native drag/drop should reorder draft slides');
  // Verify thumbnail organizer also works inside narrow teacher windows.
  await page.setViewportSize({width:390,height:780});
  const responsive=await page.evaluate(()=>{
   const root=document.querySelector('#presentationBuilderPanel');
   const area=root.getBoundingClientRect();
   const grid=root.querySelector('.si-org-grid');
   const card=grid.querySelector('.si-org-card').getBoundingClientRect();
   return {rootWidth:area.width,gridWidth:grid.getBoundingClientRect().width,
    scrollWidth:grid.scrollWidth,cardWidth:card.width};
  });
  assert.ok(responsive.cardWidth>=150,'Thumbnails stay usable at narrow widths');
  assert.ok(responsive.scrollWidth<=responsive.gridWidth+3,'Organizer has no horizontal overflow');
  await page.locator('[data-org-select="1"]').check();
  await page.locator('[data-org-select="2"]').check();
  assert.match(await page.locator('.si-org-bulk strong').innerText(),/2 selected/);
  page.once('dialog',d=>d.accept());
  await page.locator('#siOrgDelete').click();
  assert.deepEqual(await page.evaluate(()=>state.presentationEditor.draft.slides.map(s=>s.listTitle)),[
   '02 Practice','Understanding Check','01 Opening','Class Poll'
  ]);
  await page.locator('#siOrgBatchImages').setInputFiles([image(0,'05 Appendix.png')]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===5&&!siPlusBatchImportBusy,
   null,{timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll('.si-org-card').length===5);
  await page.locator('#siOrgSelectAll').click();
  assert.equal(await page.locator('#siOrgDelete').isDisabled(),true,'cannot delete final remaining slide');
  await page.locator('#siOrgClear').click();
  await page.locator('[data-org-edit="2"]').click();
  assert.equal(await page.locator('.si-org').count(),0);
  assert.equal(await page.locator('#slideListTitle').inputValue(),'01 Opening');
  await page.locator('#slideListTitle').fill('Opening Visual');
  await page.locator('#presentationTitleInput').fill('Organized SI+ Lesson');
  await page.locator('#savePresentationBtn').click();
  await page.waitForFunction(()=>state.presentationEditor===null,null,{timeout:20000});
  const stored=await page.request.get(BASE+'/api/storage');
  assert.equal(stored.status(),200);
  const decks=JSON.parse((await stored.json()).items['siMothership.presentations.v1']);
  const saved=decks.find(d=>d.deckTitle==='Organized SI+ Lesson');
  assert.ok(saved,'organizer changes saved to Railway library');
  assert.deepEqual(saved.slides.map(s=>s.listTitle),[
   '02 Practice','Understanding Check','Opening Visual','Class Poll','05 Appendix'
  ]);
  assert.ok(saved.slides[0].image.startsWith('data:image/'));
  assert.equal(saved.slides[1].type,'question');
  assert.equal(saved.slides[3].type,'poll');
  const reset=await page.request.post(BASE+'/api/session/new',{data:{}});
  assert.equal(reset.status(),200);
  const restored=JSON.parse((await (await page.request.get(BASE+'/api/storage')).json()).items['siMothership.presentations.v1']);
  assert.equal(restored.find(d=>d.deckTitle==='Organized SI+ Lesson').slides.length,5);
  assert.deepEqual(errors,[],'SI+ must not produce client JS errors');
  console.log('SI+ ORGANIZER PASSED',JSON.stringify({slides:saved.slides.map(s=>s.listTitle),responsive,drag:true,duplicate:true,multiDelete:true,reset:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
