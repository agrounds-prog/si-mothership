/* SI+ v93: park live lesson, launch existing BOARD and ORBIT,
 * automatically restore slide/answers after Finish; manual return and
 * emergency safety. Isolated classroom server only, never production. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1380,height:880}});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",err=>errors.push(String(err.stack||err)));
 await page.route(/youtube\.com|youtu\.be|ytimg\.com/,r=>r.abort());
 try{
  assert.equal((await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>networkHydrated===true&&window.SIPlusActivityBreak&&
    typeof finishActiveActivity==="function",null,{timeout:22000});
  await page.evaluate(async()=>{
   const id="si-v93-intermission-test";
   const deck={id,type:"presentation",name:"Life Skills Lesson",
     deckTitle:"Life Skills Lesson",userCreated:true,slides:[
     {type:"instruction",title:"Warm-up",text:"Talk together",image:"",youtube:""},
     {type:"question",title:"Which one is safe?",text:"Pick A or B",
       listTitle:"Check-In",choices:[{key:"A",text:"A",image:""},{key:"B",text:"B",image:""}],
       correct:"A",image:"",youtube:""},
     {type:"instruction",title:"Next Steps",text:"Try independently",image:"",youtube:""}]};
   state.activities.push(deck);
   // Real lessons exist in the Railway-backed presentation library; saving
   // this isolated test deck prevents teacher hydration from losing it.
   await persistPresentations();
   state.activityRun={activityId:id,runToken:"si-v93-original",phase:"running",
     slideIndex:1,showResults:true,revealAnswer:true,
     responses:{"1":{"Student A":"B","Student B":"A"}}};
   state.screen="activity";render();
  });
  const original=await page.evaluate(()=>({
    deck:state.activityRun.activityId,slide:state.activityRun.slideIndex,
    answers:structuredClone(state.activityRun.responses),showResults:state.activityRun.showResults,
    revealAnswer:state.activityRun.revealAnswer
  }));
  await page.locator("#siPlusActivityBreakLaunch").waitFor({state:"visible",timeout:12000});
  await page.locator("#siPlusActivityBreakLaunch").click();
  const modal=page.locator("#siPlusActivityBreakDialog");
  await modal.waitFor({state:"visible"});
  assert.ok(await page.locator("#siPlusBreakChoices [data-break-app]").count()>=10);
  assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),1,
    "opening picker alone must not interrupt slideshow");
  await page.keyboard.press("Escape");
  assert.equal(await modal.isVisible(),false);
  assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),1);
  // Break into the ACTUAL board app, including its standard setup and
  // independent activity run. No clone/alternate game implementation.
  await page.locator("#siPlusActivityBreakLaunch").click();
  await page.locator('#siPlusBreakChoices [data-break-app="board"]').click();
  await page.locator("#boardNewBlank").waitFor({state:"visible",timeout:14000});
  assert.equal(await page.evaluate(()=>state.activityRun),null);
  assert.equal(await page.evaluate(()=>state.activeApp),"board");
  assert.equal(await page.evaluate(()=>SIPlusActivityBreak.parked),true);
  assert.equal(await page.evaluate(()=>state.siPlusActivityBreak.run.slideIndex),1);
  assert.deepEqual(await page.evaluate(()=>state.siPlusActivityBreak.run.responses),original.answers);
  await page.locator("#siPlusActivityReturn").waitFor({state:"visible"});
  assert.match(await page.locator("#siPlusParkedSummary").innerText(),/Slide 2/);
  await page.locator("#boardNewBlank").click();
  assert.equal(await page.evaluate(()=>state.activityRun.activityId),"board-game");
  assert.equal(await page.evaluate(()=>state.activityRun.phase),"running");
  await page.evaluate(()=>boardAddPage());
  assert.equal(await page.evaluate(()=>state.activityRun.board.pages.length),2);
  await page.locator("#returnClassBtn").waitFor({state:"visible",timeout:13000});
  await page.locator("#returnClassBtn").click();
  console.log("SI+ ACTIVITY BREAK FINISH DEBUG",JSON.stringify(await page.evaluate(()=>({
    run:state.activityRun?.activityId||null,screen:state.screen,
    parked:!!state.siPlusActivityBreak,
    deckAvailable:state.activities.some(a=>a.id==="si-v93-intermission-test"),
    toast:document.querySelector("#toast")?.textContent
  }))));
  await page.waitForFunction(()=>state.activityRun?.activityId==="si-v93-intermission-test",
    null,{timeout:13000});
  const restored=await page.evaluate(()=>({
    id:state.activityRun.activityId,slide:state.activityRun.slideIndex,
    responses:state.activityRun.responses,phase:state.activityRun.phase,
    revealAnswer:state.activityRun.revealAnswer,showResults:state.activityRun.showResults,
    token:state.activityRun.runToken,parked:state.siPlusActivityBreak
  }));
  assert.equal(restored.id,original.deck);
  assert.equal(restored.slide,original.slide);
  assert.deepEqual(restored.responses,original.answers);
  assert.equal(restored.revealAnswer,original.revealAnswer);
  assert.equal(restored.showResults,original.showResults);
  assert.equal(restored.phase,"running");
  assert.notEqual(restored.token,"si-v93-original","resumption should use fresh response token");
  assert.equal(restored.parked,null);
  await page.locator("#siPlusActivityBreakLaunch").waitFor({state:"visible"});
  assert.equal(await page.locator("#siPlusActivityReturn").count(),0);
  // Continue original presentation normally.
  await page.locator("#nextSlideBtn").click();
  assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),2);
  await page.locator("#prevSlideBtn").click();
  assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),1);
  assert.deepEqual(await page.evaluate(()=>state.activityRun.responses),original.answers);
  // Second intermission opens ORBIT through the normal authoring screen.
  await page.locator("#siPlusActivityBreakLaunch").click();
  await page.locator('#siPlusBreakChoices [data-break-app="orbit"]').click();
  await page.locator("#launchOrbitBtn").waitFor({state:"visible"});
  await page.locator("#launchOrbitBtn").click();
  assert.equal(await page.evaluate(()=>state.activityRun.activityId),"orbit-game");
  await page.locator("#startActivityBtn").waitFor({state:"visible"});
  await page.locator("#startActivityBtn").click();
  assert.equal(await page.evaluate(()=>state.activityRun.phase),"running");
  // The manual return button covers games with bespoke end/setup actions.
  page.once("dialog",d=>d.accept());
  await page.locator("#siPlusActivityResume").click();
  await page.waitForFunction(()=>state.activityRun?.activityId==="si-v93-intermission-test",
    null,{timeout:12000});
  assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),1);
  assert.deepEqual(await page.evaluate(()=>state.activityRun.responses),original.answers);
  // Browse library and recover saved place without starting another app.
  await page.locator("#siPlusActivityBreakLaunch").click();
  await page.locator('[data-break-app="library"]').click();
  assert.equal(await page.evaluate(()=>state.screen),"activities");
  assert.equal(await page.evaluate(()=>state.activeApp),null);
  assert.equal(await page.locator("#siPlusActivityReturn").isVisible(),true);
  await page.locator("#siPlusActivityResume").click();
  assert.equal(await page.evaluate(()=>state.activityRun.activityId),original.deck);
  // No automatic recovery is allowed during an emergency return.
  await page.locator("#siPlusActivityBreakLaunch").click();
  await page.locator('#siPlusBreakChoices [data-break-app="board"]').click();
  await page.locator("#boardNewBlank").click();
  await page.evaluate(()=>returnToClassroom("emergency"));
  assert.equal(await page.evaluate(()=>state.activityRun),null);
  assert.equal(await page.evaluate(()=>state.screen),"brb");
  assert.equal(await page.evaluate(()=>state.siPlusActivityBreak),null);
  assert.equal(await page.locator("#siPlusActivityReturn").count(),0);
  assert.deepEqual(errors,[]);
  console.log("SI+ CLASSROOM ACTIVITY BREAK AND EXACT-SLIDE RETURN PASSED",
    JSON.stringify({slide:original.slide+1,answersPreserved:true,
      realBoard:true,realOrbit:true,libraryFallback:true,emergencySafe:true}));
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
