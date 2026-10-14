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
   // The previous browser test resets the isolated classroom. Its pending
   // state hydration can replace teacher activities while the async library
   // upload completes. Reconcile the just-persisted deck before first render.
   if(!state.activities.some(x=>x.id===id))state.activities.push(deck);
   if(!state.activities.some(x=>x.id===id&&x.type==="presentation"))
     throw new Error("fixture deck must exist in the live classroom before activity start");
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
  assert.match(await page.locator("#siPlusParkedContext").innerText(),/^Now: /);
  await page.locator("#siPlusActivityCollapse").click();
  assert.equal(await page.locator("#siPlusActivityReturn").evaluate(el=>el.classList.contains("is-collapsed")),true);
  assert.equal(await page.locator("#siPlusActivityResume").isVisible(),true,
    "minimizing must never hide Return to SI+");
  assert.equal(await page.locator("#siPlusActivityDiscard").isVisible(),false);
  await page.locator("#siPlusActivityCollapse").click();
  assert.equal(await page.locator("#siPlusActivityDiscard").isVisible(),true);
  await page.locator("#boardNewBlank").click();
  assert.equal(await page.evaluate(()=>state.activityRun.activityId),"board-game");
  assert.equal(await page.evaluate(()=>state.activityRun.phase),"running");
  await page.evaluate(()=>boardAddPage());
  assert.equal(await page.evaluate(()=>state.activityRun.board.pages.length),2);
  // An unexpected refresh during a REAL running game must recover both
  // the active game and the teacher-only parked SI+ slide from the current
  // server-backed classroom snapshot. Do not require a manual re-save.
  await page.reload({waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>networkHydrated===true&&
    window.SIPlusActivityBreak?.parked===true&&
    state.activityRun?.activityId==="board-game"&&
    state.activityRun?.board?.pages?.length===2,
    null,{timeout:18000});
  assert.equal(await page.evaluate(()=>state.siPlusActivityBreak.run.slideIndex),1);
  assert.deepEqual(await page.evaluate(()=>state.siPlusActivityBreak.run.responses),original.answers);
  await page.locator("#siPlusActivityResume").waitFor({state:"visible",timeout:12000});
  console.log("SI+ ACTIVITY BREAK REFRESH DURING LIVE GAME PASSED");
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
  assert.deepEqual(await page.evaluate(()=>state.activityRun.responses["1"]),original.answers["1"]);
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
  assert.deepEqual(await page.evaluate(()=>state.activityRun.responses["1"]),original.answers["1"]);
  // Verify the shared launch/return contract across several other real
  // registered activities, without changing their bespoke gameplay/setup.
  await page.locator("#siPlusActivityBreakLaunch").click();
  const extraApps=await page.locator("#siPlusBreakChoices [data-break-app]")
    .evaluateAll(buttons=>buttons.map(b=>b.dataset.breakApp)
      .filter(id=>!["board","orbit","library"].includes(id)).slice(0,4));
  assert.equal(extraApps.length,4,"four additional activity launchers expected");
  await page.keyboard.press("Escape");
  for(const appId of extraApps){
    await page.locator("#siPlusActivityBreakLaunch").click();
    await page.locator('#siPlusBreakChoices [data-break-app="'+appId+'"]').click();
    assert.equal(await page.evaluate(()=>SIPlusActivityBreak.parked),true,
      appId+" should preserve the original lesson in the classroom session");
    assert.deepEqual(await page.evaluate(()=>state.siPlusActivityBreak.run.responses["1"]),
      original.answers["1"],appId+" must retain submitted student responses");
    await page.locator("#siPlusActivityResume").click();
    assert.equal(await page.evaluate(()=>state.activityRun?.activityId),original.deck,
      appId+" should manually return to the same SI+ lesson");
    assert.equal(await page.evaluate(()=>state.activityRun.slideIndex),original.slide);
    assert.deepEqual(await page.evaluate(()=>state.activityRun.responses["1"]),
      original.answers["1"],appId+" must restore student submissions");
  }
  console.log("SI+ FOUR MORE APP SETUP/RETURN HANDOFFS PASSED",extraApps.join(","));
  // Browse library and recover saved place without starting another app.
  await page.locator("#siPlusActivityBreakLaunch").click();
  await page.locator('[data-break-app="library"]').click();
  assert.equal(await page.evaluate(()=>state.screen),"activities");
  assert.equal(await page.evaluate(()=>state.activeApp),null);
  assert.equal(await page.locator("#siPlusActivityReturn").isVisible(),true);
  // Also recover the parked lesson after reloading the activity library,
  // before a game has been chosen or started.
  await page.reload({waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>networkHydrated===true&&SIPlusActivityBreak.parked===true,
    null,{timeout:17000});
  await page.locator("#siPlusActivityResume").waitFor({state:"visible",timeout:11000});
  assert.equal(await page.evaluate(()=>state.siPlusActivityBreak.run.slideIndex),1);
  await page.setViewportSize({width:420,height:740});
  await page.locator("#siPlusParkedContext").waitFor({state:"visible"});
  const controls=await page.locator("#siPlusActivityReturn").boundingBox();
  const quickPoll=await page.locator("#qpLauncher").boundingBox();
  assert.ok(controls&&controls.x>=0&&controls.x+controls.width<=421,
    "return strip must stay inside narrow teacher viewport");
  if(quickPoll)assert.ok(controls.y+controls.height<=quickPoll.y,
    "paused lesson controls must not overlap the Quick Poll launcher");
  await page.locator("#siPlusActivityCollapse").click();
  assert.equal(await page.locator("#siPlusActivityResume").isVisible(),true);
  await page.locator("#siPlusActivityCollapse").click();
  await page.locator("#siPlusActivityResume").click();
  await page.setViewportSize({width:1380,height:880});
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
      realBoard:true,realOrbit:true,extraAppHandoffs:extraApps,compactControls:true,
    libraryFallback:true,emergencySafe:true}));
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
