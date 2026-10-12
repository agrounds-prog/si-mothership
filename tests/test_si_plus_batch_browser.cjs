/* SI+ image batch import → image-only slides → Railway SQLite library smoke.
   Uses isolated local server and temporary storage, not classroom production. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.stack||e)));
 try{
  const login=await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(login.status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>typeof openNewPresentation==="function"&&networkHydrated===true,null,{timeout:16000});
  await page.evaluate(()=>{state.activityRun=null;state.screen="classroom";openNewPresentation()});
  await page.waitForSelector("#siPlusBatchImages",{timeout:12000});
  assert.equal(await page.locator("#siPlusBatchImages").getAttribute("multiple"),"");
  const pngs=await page.evaluate(()=>{
   return ["#45aaff","#fdc65b","#58deb2","#ef7fb4"].map(color=>{
    const c=document.createElement("canvas");c.width=96;c.height=64;
    const x=c.getContext("2d");x.fillStyle=color;x.fillRect(0,0,c.width,c.height);
    x.fillStyle="#111b31";x.font="bold 18px sans-serif";x.fillText("SI+ IMG",8,35);
    return c.toDataURL("image/png").split(",")[1];
   });
  });
  const photo=(i,name)=>({name,mimeType:"image/png",buffer:Buffer.from(pngs[i],"base64")});
  await page.locator("#siPlusBatchImages").setInputFiles([
   photo(0,"01 - Opening.png"),photo(1,"02 - Classroom Map.png"),photo(2,"03 - Practice.png")
  ]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===3&&!siPlusBatchImportBusy,null,{timeout:20000});
  const first=await page.evaluate(()=>{
   const d=state.presentationEditor.draft;
   return {names:d.slides.map(x=>x.listTitle),types:d.slides.map(x=>x.type),
    allImages:d.slides.every(x=>x.image.startsWith("data:image/")&&!x.title&&!x.text),
    count:document.querySelectorAll("#presentationBuilderPanel [data-editor-slide]").length,
    status:document.querySelector("#siPlusBatchStatus").textContent};
  });
  assert.deepEqual(first.names,["01 Opening","02 Classroom Map","03 Practice"]);
  assert.deepEqual(first.types,["instruction","instruction","instruction"]);
  assert.equal(first.allImages,true);
  assert.equal(first.count,3,"new presentation should not keep blank starter slide");
  assert.match(first.status,/3 image slides added/);
  // Re-render must not discard the images or reorder them.
  await page.evaluate(()=>renderPresentationBuilder());
  assert.equal(await page.locator("#presentationBuilderPanel .slide-nav-item").count(),3);
  await page.locator("#siPlusBatchImages").setInputFiles([photo(3,"04 - Wrap Up.png")]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===4&&!siPlusBatchImportBusy,null,{timeout:20000});
  const after=await page.evaluate(()=>state.presentationEditor.draft.slides.map(s=>s.listTitle));
  assert.deepEqual(after,["01 Opening","02 Classroom Map","03 Practice","04 Wrap Up"]);
  await page.locator("#presentationTitleInput").fill("Batch Image Lesson");
  await page.locator("#savePresentationBtn").click();
  await page.waitForFunction(()=>state.presentationEditor===null,null,{timeout:18000});
  const saved=await page.request.get(BASE+"/api/storage");
  assert.equal(saved.status(),200);
  const stores=(await saved.json()).items;
  const decks=JSON.parse(stores["siMothership.presentations.v1"]);
  const deck=decks.find(d=>d.deckTitle==="Batch Image Lesson");
  assert.ok(deck,"saved deck available in SQLite-backed library");
  assert.equal(deck.slides.length,4);
  assert.ok(deck.slides.every(s=>s.type==="instruction"&&s.image.startsWith("data:image/")));
  // Playback uses the existing edge-to-edge image-only presentation view.
  const playback=await page.evaluate(()=>{
   const deck=state.activities.find(a=>a.deckTitle==="Batch Image Lesson");
   state.activityRun={activityId:deck.id,phase:"running",slideIndex:0,responses:{},runToken:"batch-import-regression"};
   const opening=sharedMarkup("big");
   state.activityRun.slideIndex=3;
   const ending=sharedMarkup("big");
   return {openingImage:opening.includes('class="si-plus-viewport-image"'),
     endingImage:ending.includes('class="si-plus-viewport-image"'),
     endingData:ending.includes("data:image/")};
  });
  assert.deepEqual(playback,{openingImage:true,endingImage:true,endingData:true});
  const reset=await page.request.post(BASE+"/api/session/new",{data:{}});
  assert.equal(reset.status(),200);
  const persisted=JSON.parse((await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.presentations.v1"]);
  assert.equal(persisted.find(d=>d.deckTitle==="Batch Image Lesson").slides.length,4,
    "batch deck must survive Reset Session");
  assert.deepEqual(errors,[]);
  console.log("SI+ BATCH IMAGE IMPORT PASSED",JSON.stringify({slides:after,save:true,reset:true,playback,errors}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
