/* Live SI+ classroom navigation: stage transition only on slide changes,
 * keyboard and jump controls share native changeSlide logic. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1366,height:880}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.stack||e)));
 await page.route(/youtube\.com|youtu\.be|ytimg\.com/,r=>r.abort());
 try{
   const login=await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
   assert.equal(login.status(),200);
   await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
   await page.waitForFunction(()=>networkHydrated===true&&
     window.SIPlusLiveNavigation&&typeof changeSlide==="function",null,{timeout:17000});
   const initial=await page.evaluate(()=>{
     const id="si-plus-navigation-browser-test";
     const slides=[
       {id:"nav-video",type:"instruction",listTitle:"Welcome video",
        title:"Video Example",text:"Watch the video",
        youtube:"https://www.youtube.com/watch?v=dQw4w9WgXcQ",image:""},
       {id:"nav-image",type:"instruction",listTitle:"Picture discussion",
        title:"Picture",text:"What can you see?",
        image:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1c7692"/></svg>'),youtube:""},
       {id:"nav-question",type:"question",listTitle:"Understanding check",
        title:"What happened next?",text:"Pick an answer",
        choices:[{key:"A",text:"First",image:""},{key:"B",text:"Second",image:""}],correct:"A"}
     ];
     state.activities.push({id,type:"presentation",name:"SI+ Navigation Test",
       deckTitle:"SI+ Navigation Test",slides,userCreated:true});
     state.activityRun={activityId:id,runToken:"si-plus-nav-v91",phase:"running",
       slideIndex:0,showResults:false,revealAnswer:false,responses:{}};
     state.screen="activity";render();
     return {n:slides.length};
   });
   assert.equal(initial.n,3);
   await page.locator("#siPlusSlideJump").waitFor({state:"visible",timeout:12000});
   assert.equal(await page.locator("#siPlusSlideJump option").count(),3);
   assert.equal(await page.locator("#siPlusSlideJump").inputValue(),"0");
   assert.equal(await page.locator("#prevSlideBtn").isDisabled(),true);
   assert.equal(await page.locator("#nextSlideBtn").isDisabled(),false);
   assert.equal(await page.locator("#sharedContent iframe").count(),1);
   const stable=await page.evaluate(()=>{
      const iframe=document.querySelector("#sharedContent iframe");
      iframe.__navVideoMarker="playing";
      state.students.push({n:"Presenter test student",c:"#59bedb",readyResponse:""});
      render();
      const next=document.querySelector("#sharedContent iframe");
      const stage=document.querySelector("#sharedContent .si-plus-slide-stage");
      return {same:next===iframe,marker:next?.__navVideoMarker,
        unexpectedTransition:stage?.classList.contains("si-plus-slide-enter")};
   });
   assert.equal(stable.same,true,"same slide must retain YouTube iframe across roster render");
   assert.equal(stable.marker,"playing");
   assert.equal(stable.unexpectedTransition,false,"roster update must not replay slide entrance");
   // Native Next remains available and triggers a single opacity-only arrival.
   await page.locator("#nextSlideBtn").click();
   await page.waitForFunction(()=>state.activityRun?.slideIndex===1&&
     document.querySelector("#sharedContent .si-plus-slide-stage")?.classList.contains("si-plus-slide-enter"),
     null,{timeout:10000});
   assert.equal(await page.locator("#sharedContent iframe").count(),0);
   assert.equal(await page.locator("#siPlusSlideJump").inputValue(),"1");
   assert.equal(await page.locator("#sharedContent img").count(),1);
   // The full-size #sharedContent is deliberately hidden inside a teacher
   // tab. Check animation on that node but 16:9 geometry on the VISIBLE mirror.
   const slideBounds=await page.evaluate(()=>{
     const projector=document.querySelector("#sharedContent .si-plus-slide-stage");
     const mirror=document.querySelector("#mirrorContent .si-plus-slide-stage");
     const r=mirror.getBoundingClientRect(),style=getComputedStyle(projector);
     return {w:r.width,h:r.height,animation:style.animationName,transform:style.transform};
   });
   assert.ok(slideBounds.w>0 && slideBounds.h>0 && Math.abs(slideBounds.w/slideBounds.h-16/9)<.015,
     JSON.stringify(slideBounds));
   assert.equal(slideBounds.transform,"none","new slide must not scale or jump");
   assert.match(slideBounds.animation,/siPlusSlideArrive91/);
   // Classroom status and other same-slide updates cannot trigger another entrance.
   await page.evaluate(()=>{
     const host=document.querySelector("#sharedContent");
     host.querySelector(".si-plus-slide-stage").classList.remove("si-plus-slide-enter");
     state.students.push({n:"Second roster update",c:"#5cf0a1",readyResponse:""});
     render();
   });
   await page.waitForTimeout(50);
   assert.equal(await page.locator("#sharedContent .si-plus-slide-enter").count(),0);
   // Keyboard navigation cannot hijack a focused text field.
   await page.evaluate(()=>{
     const input=document.createElement("input");
     input.id="siPlusKeySafety";input.value="typing";document.body.appendChild(input);
   });
   await page.locator("#siPlusKeySafety").focus();
   await page.keyboard.press("ArrowRight");
   assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),1);
   await page.locator("#siPlusKeySafety").evaluate(el=>el.remove());
   await page.locator("#siPlusSlideJump").selectOption("2");
   assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),2);
   assert.equal(await page.locator("#nextSlideBtn").isDisabled(),true);
   assert.equal(await page.locator("#siPlusSlideJump").inputValue(),"2");
   // Native selectors retain focus; blur before testing global shortcuts.
   await page.locator("#siPlusSlideJump").evaluate(el=>el.blur());
   await page.keyboard.press("Home");
   assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),0);
   assert.equal(await page.locator("#prevSlideBtn").isDisabled(),true);
   await page.keyboard.press("PageDown");
   assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),1);
   await page.keyboard.press("ArrowLeft");
   assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),0);
   // Return to video and do one more same-slide render after keyboard navigation.
   const after=await page.evaluate(()=>{
     const iframe=document.querySelector("#sharedContent iframe");
     iframe.__navVideoMarker="again";
     renderPublic();
     return {same:document.querySelector("#sharedContent iframe")===iframe,
       marker:document.querySelector("#sharedContent iframe")?.__navVideoMarker};
   });
   assert.deepEqual(after,{same:true,marker:"again"});
   // Menu must also work in a narrow teacher window without spilling the pane.
   await page.setViewportSize({width:390,height:780});
   const narrow=await page.locator("#siPlusSlideJumpBlock").evaluate(el=>{
     const r=el.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right};
   });
   assert.ok(narrow.width>=155 && narrow.right<=390+3,JSON.stringify(narrow));
   assert.deepEqual(errors,[]);
   console.log("SI+ LIVE NAVIGATION, VIDEO STABILITY AND SLIDE TRANSITIONS PASSED",
     JSON.stringify({slideBounds,keyboard:true,jump:true,narrow,videoPreserved:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
