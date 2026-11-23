/* SI+ animated GIF: preserve every frame through batch, single upload,
   private preview, saved SQLite library, reopen and live shared projector.
   All test data belongs to an isolated localhost classroom. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(BASE))
  throw Error('GIF regression must use isolated localhost');
const GIF=Buffer.from('R0lGODlhGAAYAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQIMgAAACwAAAAAGAAYAAAIKQABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDPgwIACH5BAgyAAAALAAAAAAYABgAgQAA/wAAAAAAAAAAAAgpAAEIHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEM+DAgAOw==','base64');
const gifFile=(name,mimeType='image/gif')=>({name,mimeType,buffer:GIF});
async function assertAnimated(page,selector){
  await page.locator(selector).waitFor({state:'attached'});
  const samples=await page.evaluate(async selector=>{
    const image=document.querySelector(selector);
    if(!image)return [];
    await image.decode();
    const c=document.createElement('canvas');c.width=1;c.height=1;
    const x=c.getContext('2d',{willReadFrequently:true});
    const colors=[];
    for(let i=0;i<15;i++){
      x.clearRect(0,0,1,1);
      x.drawImage(image,0,0,1,1);
      const rgba=x.getImageData(0,0,1,1).data;
      colors.push(rgba[0]>180&&rgba[2]<80?'red':rgba[2]>180&&rgba[0]<80?'blue':'other');
      await new Promise(resolve=>setTimeout(resolve,120));
    }
    return colors;
  },selector);
  assert.ok(samples.includes('red')&&samples.includes('blue'),
    'GIF must visibly change frames, not a canvas-frozen image: '+JSON.stringify(samples));
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1400,height:900}});
 const teacher=await context.newPage();
 const errors=[];
 teacher.on('pageerror',e=>errors.push(String(e)));
 try{
  assert.equal((await context.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await teacher.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
  await teacher.waitForFunction(()=>networkHydrated&&typeof openNewPresentation==='function',null,{timeout:18000});
  await teacher.evaluate(()=>{state.activityRun=null;state.screen='classroom';openNewPresentation()});
  const png=await teacher.evaluate(()=>{
    const c=document.createElement('canvas');c.width=96;c.height=54;
    c.getContext('2d').fillRect(0,0,96,54);
    return c.toDataURL('image/png').split(',')[1];
  });
  await teacher.locator('#siPlusBatchImages').setInputFiles([
    gifFile('01 Dancing Robot.gif'),
    {name:'02 Static.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}
  ]);
  await teacher.waitForFunction(()=>state.presentationEditor?.draft.slides.length===2&&
    !siPlusBatchImportBusy,null,{timeout:20000});
  const state1=await teacher.evaluate(()=>{
    const d=state.presentationEditor.draft;
    return {titles:d.slides.map(x=>x.listTitle),
      gif:d.slides[0].image,still:d.slides[1].image,
      status:document.querySelector('#siPlusBatchStatus')?.textContent||''};
  });
  assert.deepEqual(state1.titles,['01 Dancing Robot','02 Static']);
  assert.equal(state1.gif,'data:image/gif;base64,'+GIF.toString('base64'),
    'Batch import must preserve every GIF byte and its animation frames');
  assert.match(state1.still,/^data:image\/(webp|png);base64,/);
  assert.match(state1.status,/animated GIF.*kept moving/);
  await assertAnimated(teacher,'#presentationBuilderPanel .editor-media-preview img');

  // The organizer is a true animated image; Preview uses the same source.
  await teacher.locator('#siOrgToggle').click();
  assert.equal(await teacher.locator('.si-plus-gif-badge').count(),1);
  await teacher.locator('[data-org-preview="0"]').click();
  await assertAnimated(teacher,'.sipreview-stage .si-plus-viewport-image img');
  await teacher.locator('.sipreview-close').click();
  await teacher.locator('#siOrgToggle').click();

  // MIME fallback for devices that label a .gif application/octet-stream.
  await teacher.evaluate(()=>{state.editorSlide=1;renderPresentationBuilder()});
  await teacher.locator('#slideImageInput').setInputFiles([
    gifFile('Replacement.gif','application/octet-stream')
  ]);
  await teacher.waitForFunction(()=>state.presentationEditor?.draft.slides[1]?.image?.startsWith('data:image/gif;base64,'));
  assert.equal(await teacher.evaluate(()=>state.presentationEditor.draft.slides[1].image),
    state1.gif,'Single-slide attachment must preserve GIFs despite generic MIME labels');
  assert.match(await teacher.locator('.editor-media-preview').innerText(),/GIF.*Animates/);

  await teacher.locator('#presentationTitleInput').fill('Animated GIF Classroom Lesson');
  await teacher.locator('#savePresentationBtn').click();
  await teacher.waitForFunction(()=>state.presentationEditor===null,null,{timeout:20000});
  const storage=await (await context.request.get(BASE+'/api/storage')).json();
  const saved=JSON.parse(storage.items['siMothership.presentations.v1'])
    .find(d=>d.deckTitle==='Animated GIF Classroom Lesson');
  assert.ok(saved,'Deck saved successfully');
  assert.equal(saved.slides[0].image,state1.gif);
  assert.equal(saved.slides[1].image,state1.gif);
  const deckId=saved.id;
  await teacher.reload({waitUntil:'domcontentloaded'});
  await teacher.waitForFunction(id=>networkHydrated&&
    state.activities.some(x=>String(x.id)===String(id)),deckId,{timeout:20000});
  await teacher.evaluate(id=>openEditPresentation(id),deckId);
  assert.equal(await teacher.evaluate(()=>state.presentationEditor.draft.slides[0].image),
    state1.gif,'Reopened saved GIF must still contain original animated bytes');
  await teacher.locator('#cancelPresentationEdit').click();

  // Actual second-screen route must receive a moving, not frozen, GIF.
  const session=await teacher.evaluate(()=>STUDENT_SESSION_ID);
  await teacher.evaluate(id=>{
    state.activityRun={activityId:id,phase:'running',slideIndex:0,
      runToken:'gif-classroom-test',responses:{},showResults:false,revealAnswer:false};
    state.screen='activity';render();
  },deckId);
  const projector=await context.newPage();
  projector.on('pageerror',e=>errors.push(String(e)));
  await projector.goto(BASE+'/?role=shared&sid='+encodeURIComponent(session),{waitUntil:'domcontentloaded'});
  await projector.waitForFunction(()=>networkHydrated&&
    document.querySelector('#sharedContent .si-plus-viewport-image img')?.src.startsWith('data:image/gif;base64,'),null,{timeout:18000});
  await assertAnimated(projector,'#sharedContent .si-plus-viewport-image img');
  const shape=await projector.locator('#sharedContent .si-plus-slide-stage').evaluate(el=>{
    const r=el.getBoundingClientRect();return r.width/r.height;
  });
  assert.ok(Math.abs(shape-16/9)<.016,'GIF must retain normal widescreen stage geometry');
  assert.deepEqual(errors,[],'No browser JS errors');
  console.log('SI+ GIF ANIMATION SAVE AND PROJECTOR PASS',JSON.stringify({size:GIF.length,
    batch:true,single:true,organizer:true,preview:true,saved:true,reloaded:true,
    secondScreen:true,aspect:shape}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1);});
