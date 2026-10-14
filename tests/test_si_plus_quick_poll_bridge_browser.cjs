/* SI+ v92 live classroom bridge: poll prompt handoff without mutating
 * presentation state; shared-screen poll/slide toggle; live votes persist.
 * Isolated SQLite test classroom, never production. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1366,height:880}});
 const teacher=await ctx.newPage(),errors=[];
 teacher.on("pageerror",e=>errors.push(String(e)));
 try{
  const login=await teacher.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(login.status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>networkHydrated&&typeof render==="function"&&
    window.SIQuickPoll?.openFromSiPlus&&window.SIPlusPollBridge?.refresh,
    null,{timeout:20000});
  await teacher.evaluate(()=>{
    const id="si-lesson-poll-bridge-browser";
    const deck={id,type:"presentation",userCreated:true,name:"Science Lesson",
      deckTitle:"Science Lesson",slides:[
       {id:"intro",type:"instruction",listTitle:"Watch video",title:"Science Video",
         text:"Look closely",image:"",youtube:"https://youtu.be/dQw4w9WgXcQ"},
       {id:"check",type:"question",listTitle:"Understanding Check",
         title:"Which object floats?",text:"Pick one answer.",
         choices:[{key:"A",text:"A cork",image:""},
           {key:"B",text:"A rock",image:""},
           {key:"C",text:"A metal spoon",image:""}],correct:"A",image:"",youtube:""},
       {id:"wrap",type:"instruction",listTitle:"Wrap up",
         title:"Talk with a partner",text:"What did we learn?",image:"",youtube:""}
      ]};
    state.activities.push(deck);
    state.activityRun={activityId:id,phase:"running",slideIndex:1,runToken:"si-lesson-poll-v92",
      showResults:false,revealAnswer:false,
      responses:{"1":{"A Student":"B"}}};
    state.screen="activity";render();
  });
  const original=await teacher.evaluate(()=>JSON.stringify(state.activityRun));
  await teacher.locator("#siPlusPollOpen").waitFor({state:"visible",timeout:15000});
  assert.match(await teacher.locator("#siPlusPollOpen").innerText(),/Poll This Slide/);
  assert.equal(await teacher.locator("#siPlusPollScreen").isVisible(),false);
  await teacher.locator("#siPlusPollOpen").click();
  await teacher.locator("#qpDialog").waitFor({state:"visible",timeout:15000});
  assert.equal(await teacher.locator("#qpTab-create").getAttribute("aria-selected"),"true");
  assert.equal(await teacher.locator("#qpQuestion").inputValue(),"Which object floats?");
  const labels=await teacher.locator("#qpDialog [data-qp-label]").evaluateAll(
    inputs=>inputs.map(el=>el.value));
  assert.deepEqual(labels,["A cork","A rock","A metal spoon"]);
  assert.equal(await teacher.locator("#qpDescription").inputValue(),"Pick one answer.");
  const noCorrect=await teacher.locator("#qpDialog .qp-create-pane").getAttribute("data-correct");
  assert.equal(noCorrect,null,"correct-answer key must not carry over to the public poll");
  assert.equal(await teacher.evaluate(()=>SIQuickPoll.teacherStatus().phase),"none",
    "opening from a slide must only PREPARE the poll");
  assert.equal(await teacher.evaluate(()=>JSON.stringify(state.activityRun)),original,
    "opening a draft must preserve live slide and student answers");
  await teacher.locator("[data-qp-return-slide]").click();
  assert.equal(await teacher.locator("#qpDialog").isVisible(),false);
  assert.equal(await teacher.evaluate(()=>JSON.stringify(state.activityRun)),original);
  await teacher.locator("#siPlusPollOpen").click();
  const editorDiag=await teacher.evaluate(()=>{
    const button=document.querySelector("#qpDialog [data-qp-launch]");
    const modal=document.querySelector("#qpDialog"),window=document.querySelector("#qpDialog .qp-dialog-window");
    const parent=document.querySelector("#qpStudioContent");
    const r=button.getBoundingClientRect(),m=modal.getBoundingClientRect(),w=window.getBoundingClientRect();
    const center={x:r.x+r.width/2,y:r.y+r.height/2};
    const top=document.elementFromPoint(center.x,center.y);
    const shape=el=>{const x=getComputedStyle(el);return {position:x.position,zIndex:x.zIndex,display:x.display,visibility:x.visibility,pointerEvents:x.pointerEvents,transform:x.transform}};
    return {button:{x:r.x,y:r.y,w:r.width,h:r.height},center,top:{tag:top?.tagName,id:top?.id,className:String(top?.className).slice(0,80)},
      viewport:{w:innerWidth,h:innerHeight,scrollY},hitButton:top===button||button.contains(top),
      modal:{x:m.x,y:m.y,w:m.width,h:m.height,style:shape(modal)},window:{x:w.x,y:w.y,w:w.width,h:w.height},
      parent:{scrollTop:parent.scrollTop,scrollHeight:parent.scrollHeight,clientHeight:parent.clientHeight}};
  });
  console.log("SI+ POLL SEND BUTTON GEOMETRY",JSON.stringify(editorDiag));
  assert.equal(editorDiag.hitButton,true,"Quick Poll Send to Class must be above the floating teacher dock");
  await teacher.locator("#qpDialog [data-qp-launch]").click({timeout:6500});
  await teacher.waitForFunction(()=>SIQuickPoll.teacherStatus()?.phase==="open",
    null,{timeout:15000});
  assert.equal(await teacher.evaluate(()=>JSON.stringify(state.activityRun)),original,
    "launching the Quick Poll cannot replace the SI+ activityRun or poll responses");
  assert.equal(await teacher.evaluate(()=>SIQuickPoll.teacherStatus().visible),false,
    "launch starts with slide still on shared screen");
  await teacher.locator("[data-qp-return-slide]").click();
  await teacher.locator("#siPlusPollScreen").waitFor({state:"visible",timeout:10000});
  assert.match(await teacher.locator("#siPlusPollOpen").innerText(),/Manage Live Poll/);
  assert.match(await teacher.locator("#siPlusPollScreen").innerText(),/Show Poll on Screen/);
  await teacher.locator("#siPlusPollScreen").click();
  await teacher.waitForFunction(()=>SIQuickPoll.teacherStatus().visible===true,
    null,{timeout:15000});
  assert.match(await teacher.locator("#siPlusPollScreen").innerText(),/Show SI\+ Slide/);
  assert.equal(await teacher.evaluate(()=>JSON.stringify(state.activityRun)),original);
  // The existing REST endpoint, NOT the SI+ presentation run, owns poll state.
  const query=await teacher.evaluate(()=>new URLSearchParams({
    role:"teacher",sid:__SI_SESSION_ID__,code:__SI_JOIN_CODE__}).toString());
  const stateResponse=await teacher.request.get(BASE+"/api/quick-poll/state?"+query);
  assert.equal(stateResponse.status(),200);
  const active=await stateResponse.json();
  assert.equal(active.poll.question,"Which object floats?");
  assert.equal(active.poll.sharedVisible,true);
  const shared=await ctx.newPage();
  shared.on("pageerror",e=>errors.push(String(e)));
  await shared.goto(BASE+"/?role=shared",{waitUntil:"domcontentloaded",timeout:40000});
  await shared.waitForFunction(()=>document.querySelector("#qpPublicOverlay .qp-v4-projector"),
    null,{timeout:15000});
  assert.match(await shared.locator("#qpPublicOverlay").innerText(),/Which object floats/);
  // Hide the chart again but allow students to continue voting.
  await teacher.locator("#siPlusPollScreen").click();
  await teacher.waitForFunction(()=>SIQuickPoll.teacherStatus().visible===false,
    null,{timeout:15000});
  await shared.evaluate(()=>SIQuickPoll.refresh());
  await shared.waitForFunction(()=>document.querySelector("#qpPublicOverlay")?.hidden===true,
    null,{timeout:12000});
  assert.equal(await teacher.evaluate(()=>SIQuickPoll.teacherStatus().phase),"open");
  // Teacher advances normally and the active poll remains independent.
  await teacher.locator("#nextSlideBtn").click();
  assert.equal(await teacher.evaluate(()=>state.activityRun.slideIndex),2);
  assert.equal(await teacher.evaluate(()=>SIQuickPoll.teacherStatus().phase),"open");
  await teacher.locator("#prevSlideBtn").click();
  assert.equal(await teacher.evaluate(()=>state.activityRun.slideIndex),1);
  assert.deepEqual(await teacher.evaluate(()=>state.activityRun.responses["1"]),{"A Student":"B"});
  // Manage the active poll: do not silently replace it with the slide question.
  await teacher.locator("#siPlusPollOpen").click();
  assert.equal(await teacher.locator("#qpTab-live").getAttribute("aria-selected"),"true");
  await teacher.locator("[data-qp-return-slide]").click();
  await teacher.setViewportSize({width:390,height:780});
  const compact=await teacher.locator("#siPlusPollBridge").evaluate(el=>{
    const b=el.getBoundingClientRect();
    return {width:b.width,right:b.right};
  });
  assert.ok(compact.width>160&&compact.right<=393,JSON.stringify(compact));
  assert.deepEqual(errors,[]);
  console.log("SI+ QUICK POLL BRIDGE and RETURN TO SLIDE PASSED",
    JSON.stringify({choices:labels.length,projectorToggle:true,answersPreserved:true,compact}));
  await shared.close();
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
