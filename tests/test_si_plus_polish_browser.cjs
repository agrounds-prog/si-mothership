/* SI+ presentation editor & projected video regression.
 * Runs on isolated local Mothership, never production content. */
const assert=require("node:assert/strict"),{chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.message||e)));
 await page.route(/youtube\.com|youtu\.be|ytimg\.com/,r=>r.abort());
 try{
  const login=await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(login.status(),200);
  const response=await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.__siPlusMediaPolish88===true&&typeof renderPresentationBuilder==="function",{timeout:12000});
  await page.waitForFunction(()=>!NETWORK_SYNC||networkHydrated,{timeout:15000});
  assert.equal(await page.locator('script[src^="/si-plus-polish.js"]').count(),1);
  assert.equal(await page.locator('link[href^="/si-plus-polish.css"]').count(),1);
  await page.evaluate(()=>{
   state.presentationEditor={draft:{id:"si-plus-polish-test",name:"Video Lesson",
     deckTitle:"Video Lesson",type:"presentation",slides:[{
      id:"slide-test",type:"instruction",title:"Watch This",listTitle:"Video",
      text:"Video teaching example",image:"",youtube:"",choices:[]
     }]},originalId:null};
   state.editorSlide=0;
   renderPresentationBuilder();
  });
  await page.waitForFunction(()=>!!document.querySelector("#siPlusPasteVideo")&&!!document.querySelector("#siPlusClearVideo"),{timeout:9000});
  const empty=await page.evaluate(()=>{
   const root=document.querySelector("#presentationBuilderPanel");
   return {hasPaste:!!root.querySelector("#siPlusPasteVideo"),
    hasClear:!!root.querySelector("#siPlusClearVideo"),
    clearDisabled:root.querySelector("#siPlusClearVideo").disabled,
    previewRatio:getComputedStyle(root.querySelector("#siPlusVideoPreview")).aspectRatio,
    copy:root.querySelector("#siPlusVideoSupport").textContent};
  });
  assert.equal(empty.hasPaste,true);assert.equal(empty.clearDisabled,true);
  assert.match(empty.copy,/Optional video/);assert.match(empty.previewRatio,/16\s*\/\s*9/);
  await page.evaluate(()=>{
   const input=document.querySelector("#slideYoutube");
   input.value="not-a-video";
   input.dispatchEvent(new Event("input",{bubbles:true}));
  });
  const invalid=await page.locator("#siPlusVideoSupport").getAttribute("data-state");
  assert.equal(invalid,"invalid");
  await page.evaluate(()=>{
   Object.defineProperty(navigator,"clipboard",{configurable:true,value:{readText:async()=> "https://youtu.be/dQw4w9WgXcQ"}});
   document.querySelector("#siPlusPasteVideo").click();
  });
  await page.waitForFunction(()=>document.querySelector("#siPlusVideoSupport")?.dataset.state==="valid",{timeout:5000});
  const pasted=await page.evaluate(()=>({
    input:document.querySelector("#slideYoutube").value,
    model:state.presentationEditor.draft.slides[0].youtube,
    img:!!document.querySelector("#siPlusVideoPreview .si-plus-video-thumb img"),
    clear:!document.querySelector("#siPlusClearVideo").disabled
  }));
  assert.equal(pasted.input,"https://youtu.be/dQw4w9WgXcQ");assert.equal(pasted.model,pasted.input);
  assert.equal(pasted.img,true);assert.equal(pasted.clear,true);
  await page.evaluate(()=>document.querySelector("#siPlusClearVideo").click());
  assert.equal(await page.locator("#slideYoutube").inputValue(),"");
  assert.equal(await page.evaluate(()=>state.presentationEditor.draft.slides[0].youtube),"");
  await page.evaluate(()=>{
   document.querySelector("#slideYoutube").value="https://youtu.be/dQw4w9WgXcQ";
   document.querySelector("#slideYoutube").dispatchEvent(new Event("input",{bubbles:true}));
   const deck=JSON.parse(JSON.stringify(state.presentationEditor.draft));
   state.activities=[deck,...state.activities.filter(x=>x.id!==deck.id)];
   state.presentationEditor=null;
   state.activityRun={activityId:deck.id,phase:"running",slideIndex:0,runToken:"si-plus-88-video",responses:{}};
   state.screen="activity";render();
  });
  const sizes=[];
  for(const [width,height] of [[1920,1080],[1280,720],[768,1024]]){
   await page.setViewportSize({width,height});
   const dims=await page.evaluate(()=>{
    // Teacher's shared output tab is hidden by default. Render the *same* live
    // sharedMarkup inside a visible temporary projector shell to measure layout.
    const shell=document.createElement("div");
    shell.style.cssText="position:fixed;inset:0;z-index:999999;background:#061629;padding:12px;box-sizing:border-box;overflow:auto";
    const content=document.createElement("div");content.id="sharedContent";
    content.style.cssText="display:block;width:100%;height:auto";
    content.innerHTML=sharedMarkup("big");shell.appendChild(content);document.body.appendChild(shell);
    const frame=content.querySelector(".presentation-public .si-plus-video-frame");
    const video=frame?.querySelector("iframe");
    if(!frame||!video){shell.remove();return {exists:false};}
    const f=frame.getBoundingClientRect(),v=video.getBoundingClientRect();
    const result={exists:true,width:f.width,height:f.height,videoWidth:v.width,
      ratio:f.height?f.width/f.height:0,fullscreen:video.hasAttribute("allowfullscreen"),
      overflow:Math.max(0,content.scrollWidth-content.clientWidth)};
    shell.remove();return result;
   });
   console.log(JSON.stringify({test:"SI+ shared video layout",width,height,...dims}));
   assert.equal(dims.exists,true);
   assert.ok(dims.width>=210,"Projector shows a readable video");
   assert.ok(Math.abs(dims.ratio-16/9)<.08,"Video must keep 16:9 geometry");
   assert.ok(Math.abs(dims.width-dims.videoWidth)<4,"Video occupies media frame");
   assert.equal(dims.fullscreen,true);
   assert.ok(dims.overflow<=4,"Projector must not overflow horizontally");
   sizes.push(dims);
  }
  const before=await page.evaluate(()=>{
   const f=document.querySelector("#sharedContent iframe");f.__siPlusPersistent88=true;
   state.students=[...(state.students||[]),{n:"Extra Classmate",c:"#82eaff"}];
   render();
   return !!document.querySelector("#sharedContent iframe")?.__siPlusPersistent88;
  });
  assert.equal(before,true,"An unrelated classroom update must not restart YouTube");
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({test:"SI+ media editor paste/clear/feedback, responsive YouTube projector, and iframe stability",empty,pasted,sizes,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
