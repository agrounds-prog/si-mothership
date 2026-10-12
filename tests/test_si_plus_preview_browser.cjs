/* Teacher SI+ preview is projector-matched, local-only and preserves all saved decks. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.stack||e)));
 await page.route(/youtube\.com|youtu\.be|ytimg\.com/,route=>route.abort());
 try{
   assert.equal((await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
   await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
   await page.waitForFunction(()=>typeof SIPlusPresentationPreview==="object"&&networkHydrated===true,null,{timeout:16000});
   const beforeLibrary=(await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.presentations.v1"];
   const initial=await page.evaluate(()=>{
     state.activityRun=null;state.screen="classroom";openNewPresentation();
     const img=document.createElement("canvas");img.width=500;img.height=1000;
     const x=img.getContext("2d");x.fillStyle="#51afc2";x.fillRect(0,0,img.width,img.height);
     const d=state.presentationEditor.draft;d.deckTitle="Private Preview Test";d.name=d.deckTitle;
     const first=d.slides[0];first.image=img.toDataURL("image/png");
     first.title="";first.text="";first.listTitle="Portrait image";
     const q=freshSlide("question");q.title="Test question";q.listTitle="Question";
     q.choices[0].text="Answer one";
     const poll=freshSlide("poll");poll.title="Test poll";poll.listTitle="Poll";
     poll.choices[0].text="Yes";
     const note=freshSlide("instruction");note.title="Closing";note.text="Thank you";
     note.listTitle="Closing";
     d.slides.push(q,poll,note);
     renderPresentationBuilder();
     return {draft:JSON.stringify(d),editorSlide:state.editorSlide,activities:state.activities.length};
   });
   await page.locator("#siPlusPreviewBtn").waitFor();
   await page.locator("#siPlusPreviewBtn").click();
   await page.locator("#siPlusPreviewOverlay .si-plus-slide-stage").waitFor();
   assert.equal(await page.locator(".sipreview-count").innerText(),"Slide 1 of 4");
   assert.equal(await page.locator("#shared .si-plus-slide-stage").count(),0,"preview never launches shared session");
   assert.equal(await page.locator(".sipreview-stage .si-plus-viewport-image img").count(),1);
   const sizes=[];
   for(const [width,height] of [[1920,1080],[1366,768],[1024,768],[390,780]]){
     await page.setViewportSize({width,height});
     const v=await page.evaluate(()=>{
       const box=document.querySelector(".sipreview-stage").getBoundingClientRect();
       const img=document.querySelector(".sipreview-stage img");
       return {w:box.width,h:box.height,x:box.x,y:box.y,
         fit:getComputedStyle(img).objectFit,outer:document.documentElement.scrollWidth,
         vw:innerWidth,vh:innerHeight};
     });
     assert.ok(v.w>0&&v.h>0&&Math.abs(v.w/v.h-16/9)<.015,JSON.stringify(v));
     assert.ok(v.x>=0&&v.y>=0&&v.x+v.w<=width+2&&v.y+v.h<=height+2);
     assert.equal(v.fit,"contain");
     assert.ok(v.outer<=width+2,"no horizontal overflow");
     sizes.push({width,height,w:Math.round(v.w),h:Math.round(v.h)});
   }
   await page.keyboard.press("ArrowRight");
   assert.equal(await page.locator(".sipreview-count").innerText(),"Slide 2 of 4");
   assert.match(await page.locator(".sipreview-stage").innerText(),/Test question/);
   await page.locator('[data-sipreview="next"]').click();
   assert.match(await page.locator(".sipreview-stage").innerText(),/Test poll/);
   await page.keyboard.press("End");
   assert.match(await page.locator(".sipreview-stage").innerText(),/Closing/);
   assert.equal(await page.locator('[data-sipreview="next"]').isDisabled(),true);
   await page.keyboard.press("Home");
   assert.equal(await page.locator('[data-sipreview="prev"]').isDisabled(),true);
   await page.keyboard.press("Escape");
   assert.equal(await page.locator("#siPlusPreviewOverlay").count(),0);
   const after=await page.evaluate(()=>({
     draft:JSON.stringify(state.presentationEditor.draft),editorSlide:state.editorSlide,
     activities:state.activities.length,run:state.activityRun,previewActive:SIPlusPresentationPreview.active
   }));
   assert.deepEqual(after,{...initial,run:null,previewActive:false},"preview must not mutate teacher draft, activity or run");
   const afterLibrary=(await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.presentations.v1"];
   assert.equal(afterLibrary,beforeLibrary,"preview never saves a presentation");
   // Same button works with the organizer and a saved deck reopened for editing.
   await page.locator("#siOrgToggle").click();
   await page.locator("#siPlusPreviewBtn").click();
   assert.equal(await page.locator("#siPlusPreviewOverlay").count(),1);
   await page.locator('[data-sipreview="close"]').click();
   await page.locator("#siOrgToggle").click();
   await page.locator("#savePresentationBtn").click();
   await page.waitForFunction(()=>state.presentationEditor===null,null,{timeout:15000});
   await page.evaluate(()=>{
     const d=state.activities.find(a=>a.deckTitle==="Private Preview Test");
     openEditPresentation(d.id);
   });
   await page.locator("#siPlusPreviewBtn").click();
   assert.equal(await page.locator(".sipreview-count").innerText(),"Slide 1 of 4");
   await page.locator('[data-sipreview="close"]').click();
   assert.deepEqual(errors,[],"no browser JavaScript errors");
   console.log("SI+ TEACHER PREVIEW PASSED",JSON.stringify({sizes,localOnly:true,savedDeck:true,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
