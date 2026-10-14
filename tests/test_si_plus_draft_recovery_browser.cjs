/* SI+ v90: recover unfinished draft after refresh, then commit to the
 * authoritative Railway-style SQLite library and reopen after a class reset.
 * Test server is isolated; never touches production presentations. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1380,height:900}});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",err=>errors.push(String(err)));
 try{
  assert.equal((await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>typeof SIPlusDraftRecovery==="object"&&networkHydrated===true,
    null,{timeout:18000});
  await page.evaluate(()=>{state.activityRun=null;state.screen="classroom";openNewPresentation()});
  await page.locator("#presentationTitleInput").fill("Recovered Classroom Lesson");
  await page.locator("#slideListTitle").fill("Warm Up");
  await page.locator("#slideTitle").fill("A draft I want to keep");
  await page.locator("#slideText").fill("Discussion prompt that must survive refresh.");
  await page.evaluate(()=>{
   const c=document.createElement("canvas");c.width=320;c.height=180;
   const ctx=c.getContext("2d");ctx.fillStyle="#1b6fa8";ctx.fillRect(0,0,320,180);
   state.presentationEditor.draft.slides[0].image=c.toDataURL("image/png");
   state.presentationEditor.draft.slides.push(freshSlide("question"));
   state.editorSlide=1;renderPresentationBuilder();
  });
  await page.locator("#slideListTitle").fill("Learning Check");
  await page.locator("#slideTitle").fill("Which step comes next?");
  const before=await page.evaluate(async()=>{
   const record=await SIPlusDraftRecovery.flush();
   return {id:record?.draft?.id,title:record?.draft?.deckTitle,
     slides:record?.draft?.slides?.map(s=>({
       type:s.type,listTitle:s.listTitle,title:s.title,image:s.image?.length||0
     })),editorSlide:record?.editorSlide};
  });
  assert.equal(before.title,"Recovered Classroom Lesson");
  assert.equal(before.editorSlide,1);
  assert.equal(before.slides.length,2);
  assert.ok(before.slides[0].image>200,"draft backup retains embedded images");
  assert.equal(before.slides[1].title,"Which step comes next?");
  const originalStore=(await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.presentations.v1"];
  await page.reload({waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>networkHydrated===true&&!!window.SIPlusDraftRecovery,
    null,{timeout:16000});
  await page.evaluate(()=>{state.activityRun=null;state.screen="activities";state.activeApp="si-plus";
    state.presentationEditor=null;state.presentationLibraryOpen=false;render()});
  await page.locator("#siPlusRecoverDraft .si-plus-draft-resume").waitFor({state:"visible",timeout:12000});
  assert.match(await page.locator(".si-plus-draft-caption").innerText(),/Recovered Classroom Lesson/);
  assert.equal((await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.presentations.v1"],
    originalStore,"autosave must NOT modify the server's saved library");
  await page.locator("#siPlusRecoverDraft .si-plus-draft-resume").click();
  const recovered=await page.evaluate(()=>({
   title:state.presentationEditor.draft.deckTitle,
   slides:state.presentationEditor.draft.slides.map(s=>({
     type:s.type,listTitle:s.listTitle,title:s.title,image:s.image?.length||0
   })),
   editorSlide:state.editorSlide
  }));
  assert.deepEqual(recovered,{title:before.title,slides:before.slides,editorSlide:before.editorSlide});
  assert.equal(await page.locator("#slideTitle").inputValue(),"Which step comes next?");
  await page.evaluate(()=>SIPlusDraftRecovery.flush());
  await page.locator("#savePresentationBtn").click();
  await page.waitForFunction(()=>state.presentationEditor===null,null,{timeout:18000});
  const stored=(await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.presentations.v1"];
  const saved=JSON.parse(stored).find(x=>x.deckTitle==="Recovered Classroom Lesson");
  assert.ok(saved&&saved.slides.length===2,"manual save persists recovered draft");
  assert.equal(saved.slides[1].title,"Which step comes next?");
  assert.ok(saved.slides[0].image.length>200);
  await page.waitForFunction(()=>SIPlusDraftRecovery.available===false,null,{timeout:10000});
  assert.equal(await page.locator("#siPlusRecoverDraft").count(),0);
  await page.reload({waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>networkHydrated===true,null,{timeout:17000});
  assert.ok(await page.evaluate(()=>state.activities.some(x=>x.deckTitle==="Recovered Classroom Lesson")),
    "teacher reload hydrates saved SI+ library from server");
  assert.equal((await page.request.post(BASE+"/api/session/new",{data:{}})).status(),200);
  await page.reload({waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>networkHydrated===true,null,{timeout:17000});
  await page.evaluate(()=>{state.activityRun=null;state.screen="activities";state.activeApp="si-plus";
    state.presentationEditor=null;state.presentationLibraryOpen=true;render()});
  const card=page.locator("#savedPresentationPicker .saved-deck").filter({
    has:page.locator('h4:text-is("Recovered Classroom Lesson")')
  });
  await card.waitFor({state:"visible",timeout:10000});
  assert.match(await card.innerText(),/2 slides/);
  await card.locator("[data-edit-saved]").click();
  assert.equal(await page.locator("#presentationTitleInput").inputValue(),"Recovered Classroom Lesson");
  assert.deepEqual(errors,[]);
  console.log("SI+ UNSAVED DRAFT RECOVERY AND RAILWAY RESET PERSISTENCE PASSED",
    JSON.stringify({slides:2,hasImage:true,restored:true,reset:true}));
 }finally{await ctx.close();await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
