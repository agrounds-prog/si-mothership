/* SI+ Spotlight slide: editor regions, persisted slide metadata, live controls.
 * Isolated CI classroom; never modifies production saved presentations.
 */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1450,height:960}});
 const errors=[];
 page.on("pageerror",error=>errors.push(String(error)));
 try{
  assert.equal((await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIPlusSpotlightSlide&&networkHydrated===true,null,{timeout:25000});
  await page.evaluate(()=>{state.activityRun=null;state.screen="classroom";openNewPresentation()});
  const image=await page.evaluate(()=>{
   const cv=document.createElement("canvas");cv.width=960;cv.height=540;
   const ctx=cv.getContext("2d");ctx.fillStyle="#146aa7";ctx.fillRect(0,0,960,540);
   return cv.toDataURL("image/png").split(",")[1];
  });
  await page.locator("#siPlusBatchImages").setInputFiles([{
   name:"Spotlight Slide.png",mimeType:"image/png",buffer:Buffer.from(image,"base64")
  }]);
  await page.waitForFunction(()=>state.presentationEditor?.draft.slides.length===1,null,{timeout:15000});
  await page.waitForSelector("#siPlusSpotlightEditButton",{timeout:12000});
  await page.locator("#siPlusSpotlightEditButton").click();
  await page.waitForSelector("#siPlusSpotlightEditor:not([hidden])");
  const svg=page.locator("#siPlusSpotlightEditor .si-plus-spot-drawing");
  const box=await svg.boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width*.25,box.y+box.height*.25);
  await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.66,{steps:7});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelectorAll("#siPlusSpotlightEditor .si-plus-spot-list button").length===1);
  await page.locator("#siPlusSpotName").fill("Safe Area");
  await page.locator("#siPlusSpotName").dispatchEvent("change");
  await page.locator("#siPlusSpotEffect").selectOption("dim");
  await page.locator("#siPlusSpotColor").selectOption("green");
  await page.locator(".si-plus-spot-save").click();
  const draft=await page.evaluate(()=>state.presentationEditor.draft.slides[0]);
  assert.equal(draft.type,"instruction");
  assert.equal(draft.siSpotlight.enabled,true);
  assert.equal(draft.siSpotlight.zones[0].name,"Safe Area");
  assert.equal(draft.siSpotlight.zones[0].effect,"dim");
  await page.locator("#presentationTitleInput").fill("Integrated Spotlight Regression");
  await page.locator("#savePresentationBtn").click();
  await page.waitForFunction(()=>state.presentationEditor===null,null,{timeout:20000});
  const storage=(await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.presentations.v1"];
  const persisted=JSON.parse(storage).find(x=>x.deckTitle==="Integrated Spotlight Regression");
  assert.ok(persisted,"Saved presentation missing");
  assert.equal(persisted.slides[0].siSpotlight.zones[0].name,"Safe Area");
  // Exercise teacher live controls and keep the native shared-screen content.
  await page.evaluate(id=>{
   const deck=state.activities.find(a=>a.id===id);
   state.activityRun={activityId:id,phase:"running",slideIndex:0,runToken:"si-spotlight-regression",responses:{}};
   state.screen="activity";render();
  },persisted.id);
  await page.waitForSelector("#siPlusSpotlightLiveControls",{timeout:15000});
  await page.locator("#siPlusSpotlightLiveControls .si-plus-spotlight-target").click();
  await page.waitForFunction(()=>state.activityRun?.siSpotlightVisible?.ids?.length===1);
  const live=await page.evaluate(()=>({ids:state.activityRun.siSpotlightVisible.ids,markup:sharedMarkup("big")}));
  assert.equal(live.ids.length,1);
  assert.match(live.markup,/si-plus-viewport-image/);
  await page.waitForFunction(()=>sharedMarkup("big").includes("si-plus-spotlight-inline"),null,{timeout:7000});
  const actual=await page.evaluate(()=>sharedMarkup("big"));
  assert.ok(actual.includes("si-plus-spotlight-inline"),"Projected slide must carry its Spotlight graphics");
  const plain=await page.evaluate(()=>{const deck=state.activities.find(a=>a.id===state.activityRun.activityId);deck.slides.push({...deck.slides[0],id:"plain",siSpotlight:undefined});state.activityRun.slideIndex=1;const text=sharedMarkup("big");state.activityRun.slideIndex=0;deck.slides.pop();return text});
  assert.ok(!plain.includes("si-plus-spotlight-inline"),"Ordinary slides should not show Spotlight");

  const probe=await page.evaluate(()=>{
   const image=document.querySelector("#sharedContent .si-plus-viewport-image");
   const mirror=document.querySelector("#mirrorContent .si-plus-viewport-image");
   const shared=sharedMarkup("big");
   const preview=activitySharedMarkup(true);
   return {
    sharedLength:shared.length,sharedImageCount:(shared.match(/si-plus-viewport-image/g)||[]).length,
    previewLength:preview.length,previewImageCount:(preview.match(/si-plus-viewport-image/g)||[]).length,
    sharedFirst:shared.slice(0,450),sharedLast:shared.slice(-500),
    imageTag:image?.tagName,mirrorTag:mirror?.tagName,
    overlayCount:document.querySelectorAll(".si-plus-spotlight-inline").length,
    parent:image?.parentElement?.className||"",screen:state.screen,
    rendererType:typeof sharedMarkup,
   };
  });
  console.log("SPOTLIGHT RENDER PROBE",JSON.stringify(probe));
  // Verify actual projector overlay and image fit, rather than merely
  // checking that the native shared-screen markup still contains an image.
  await page.evaluate(()=>{
   document.querySelector("#teacher").classList.remove("active");
   document.querySelector("#shared").classList.add("active");
   document.body.classList.add("role-shared");
   renderPublic();
  });
  await page.waitForFunction(()=>{
   const image=document.querySelector("#sharedContent .si-plus-viewport-image > img");
   const overlay=document.querySelector("#sharedContent .si-plus-spotlight-inline");
   const floating=document.querySelector(".si-plus-spotlight-overlay");
   return !!image&&(
      !!overlay?.querySelector("rect[stroke],ellipse[stroke]")||
      !!floating?.querySelector("rect[stroke],ellipse[stroke]"));
  },null,{timeout:12000});
  const projector=await page.evaluate(()=>{
   const img=document.querySelector("#sharedContent .si-plus-viewport-image > img");
   const inline=document.querySelector("#sharedContent .si-plus-spotlight-inline");
   const floating=document.querySelector(".si-plus-spotlight-overlay");
   const ov=inline||floating;
   const image=img.getBoundingClientRect(),layer=ov.getBoundingClientRect();
   return {mode:inline?"inline":"floating",image:{x:image.x,y:image.y,w:image.width,h:image.height},
     overlay:{x:layer.x,y:layer.y,w:layer.width,h:layer.height}};
  });
  assert.ok(Math.abs(projector.image.w-projector.overlay.w)<3,JSON.stringify(projector));
  assert.ok(Math.abs(projector.image.h-projector.overlay.h)<3,JSON.stringify(projector));
  assert.ok(Math.abs(projector.image.x-projector.overlay.x)<3,JSON.stringify(projector));
  assert.ok(Math.abs(projector.image.y-projector.overlay.y)<3,JSON.stringify(projector));
  assert.deepEqual(errors,[]);
  console.log("PASS: Spotlight zones save to SI+ slides and live teacher controls toggle them");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
