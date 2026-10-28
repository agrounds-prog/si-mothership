/* Phase 4W — live teacher/student/projector lobby transitions.
 * Strictly disposable localhost + test SQLite, using native classroom UI.
 * Does not write to production /data or touch real classroom identities. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(BASE))
 throw Error("Classroom transition test requires isolated localhost");
const NAME="Phase 4W Pilot",DECK="phase4w-classroom-transition";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const tc=await browser.newContext({viewport:{width:1380,height:900}});
 const sc=await browser.newContext({viewport:{width:1380,height:900}});
 const pc=await browser.newContext({viewport:{width:1280,height:720}});
 const teacher=await tc.newPage(),student=await sc.newPage(),shared=await pc.newPage(),errors=[];
 for(const [name,page] of [["teacher",teacher],["student",student],["shared",shared]])
  page.on("pageerror",err=>errors.push(name+": "+String(err.stack||err)));
 for(const page of [teacher,student,shared])
  await page.route(/youtube\.com|youtu\.be|ytimg\.com/,r=>r.abort());
 try{
  assert.equal((await tc.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>networkHydrated===true&&STUDENT_JOIN_CODE&&
   STUDENT_SESSION_ID&&window.SIPlusActivityBreak&&!!window.FourLine,
   null,{timeout:22000});
  const room=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  await student.goto(BASE+"/?role=student&code="+encodeURIComponent(room.code)+
   "&sid="+encodeURIComponent(room.sid),{waitUntil:"domcontentloaded",timeout:40000});
  await student.locator("#siStudentLaunchScreen").waitFor({state:"visible",timeout:15000});
  await student.locator("#siStudentLaunchContinue").click();
  await student.locator("#studentContent [data-join-avatar]:visible").first().click();
  await student.locator("#joinStudentName").fill(NAME);
  await student.locator("#joinClassBtn").click();
  await student.waitForFunction(name=>state.selectedStudent===name&&!studentNeedsJoin(),NAME,
   {timeout:18000});
  await student.setViewportSize({width:440,height:780});
  await shared.goto(BASE+"/?role=shared&sid="+encodeURIComponent(room.sid),
   {waitUntil:"domcontentloaded",timeout:40000});
  await shared.waitForFunction(()=>networkHydrated===true,null,{timeout:18000});
  await teacher.waitForFunction(name=>state.students.some(s=>s.n===name),NAME,{timeout:13000});
  const baseline=await teacher.evaluate(()=>({
    members:state.students.filter(s=>s.n===NAME).length,
    session:STUDENT_SESSION_ID
  }));
  assert.equal(baseline.members,1);

  // Teacher starts an actual native multiplayer game from Activity Library.
  await teacher.locator('#teacherControlBar [data-control="activities"]').click();
  await teacher.locator("#activitiesPanel .fil-library-card .fil-open").click();
  await teacher.locator("#filLaunch").waitFor({state:"visible",timeout:15000});
  await teacher.locator("#filOne").fill("Pilot Crew");
  await teacher.locator("#filTwo").fill("Gold Crew");
  await teacher.locator('[data-fil-seat="'+NAME+'"]').selectOption("0");
  await teacher.locator("#filLaunch").click();
  await teacher.waitForFunction(()=>state.activityRun?.activityId==="four-in-line-game"&&
    state.activityRun?.fourInLine?.seats?.["Phase 4W Pilot"]===0,
    null,{timeout:14000});
  await Promise.all([student,shared].map(page=>page.waitForFunction(()=>
    state.activityRun?.activityId==="four-in-line-game",null,{timeout:16000})));
  const runBefore=await teacher.evaluate(()=>({token:state.activityRun.runToken,
   cols:state.activityRun.fourInLine.cols,rows:state.activityRun.fourInLine.rows}));
  await teacher.locator('#activityControllerPanel [data-fil-drop="0"]').click();
  await Promise.all([teacher,student,shared].map(page=>page.waitForFunction(()=>
    state.activityRun?.fourInLine?.moves===1,null,{timeout:16000})));
  const disc=await teacher.evaluate(()=>state.activityRun.fourInLine.board.slice());
  assert.equal(disc.filter(Boolean).length,1);
  assert.equal(await shared.locator("#sharedContent .fil-cell.disc-1").count(),1);

  // Pause via the actual lobby button. Resuming must preserve the one disc,
  // active turn, student identity and public/private view synchronization.
  await teacher.locator("#sendActivityLobbyBtn").click();
  await teacher.waitForFunction(()=>state.activityRun?.activityId==="four-in-line-game"&&
    state.activityRun?.phase==="lobby",null,{timeout:12000});
  await Promise.all([student,shared].map(page=>page.waitForFunction(()=>
    state.activityRun?.phase==="lobby",null,{timeout:14000})));
  await teacher.locator("#startActivityBtn").waitFor({state:"visible",timeout:11000});
  await teacher.locator("#startActivityBtn").click();
  await Promise.all([teacher,student,shared].map(page=>page.waitForFunction(()=>
    state.activityRun?.activityId==="four-in-line-game"&&
    state.activityRun?.phase==="running"&&
    state.activityRun.fourInLine.moves===1,null,{timeout:15000})));
  const resumed=await teacher.evaluate(()=>({
    board:state.activityRun.fourInLine.board,
    token:state.activityRun.runToken,
    turn:state.activityRun.fourInLine.turn
  }));
  assert.deepEqual(resumed.board,disc,"Lobby resume must preserve the exact game board");
  assert.equal(await student.locator("#studentContent [data-fil-drop]:enabled").count(),0,
    "After pilot's move, no controls must become active for the wrong turn");
  assert.equal(await shared.locator("#sharedContent .fil-cell.disc-1").count(),1);
  assert.equal(await shared.locator("#sharedContent [data-fil-drop]").count(),0);
  // Finish the game using the native classroom control, not direct state edits.
  await teacher.locator("#returnClassBtn").click();
  await teacher.waitForFunction(()=>state.activityRun===null,null,{timeout:14000});

  // Start a real SI+ presentation with answer and position already present.
  // The test deck is saved in temporary server storage so browser reload can
  // rehydrate its actual library record just like an existing teacher deck.
  await teacher.evaluate(async()=>{
    const deck={id:DECK,type:"presentation",name:"Phase 4W Lesson",
      deckTitle:"Phase 4W Lesson",userCreated:true,slides:[
      {type:"instruction",title:"Welcome",text:"Let's learn",image:"",youtube:""},
      {type:"question",title:"Helping at School",text:"Choose a friendly response",
       choices:[{key:"A",text:"Offer help",image:""},{key:"B",text:"Walk away",image:""}],
       correct:"A",image:"",youtube:""},
      {type:"instruction",title:"Finish",text:"Great work",image:"",youtube:""}]};
    state.activities.push(deck);
    await persistPresentations();
    if(!state.activities.some(x=>x.id===DECK))state.activities.push(deck);
    state.activityRun={activityId:DECK,runToken:"phase4w-original",phase:"running",
      slideIndex:1,showResults:true,revealAnswer:true,
      responses:{"1":{[NAME]:"A"}}};
    state.screen="activity";render();
  });
  await Promise.all([student,shared].map(page=>page.waitForFunction(id=>
    state.activityRun?.activityId===id&&state.activityRun?.slideIndex===1,
    DECK,{timeout:16000})));
  await teacher.locator("#siPlusActivityBreakLaunch").click();
  await teacher.locator('#siPlusBreakChoices [data-break-app="board"]').click();
  await teacher.locator("#boardNewBlank").waitFor({state:"visible",timeout:14000});
  assert.equal(await teacher.evaluate(()=>SIPlusActivityBreak.parked),true);
  await teacher.locator("#boardNewBlank").click();
  await teacher.waitForFunction(()=>state.activityRun?.activityId==="board-game",null,{timeout:13000});
  await teacher.evaluate(()=>boardAddPage());
  await Promise.all([student,shared].map(page=>page.waitForFunction(()=>
    state.activityRun?.activityId==="board-game",null,{timeout:15000})));
  // Genuine reloads while the slide is parked and a second app is running.
  await Promise.all([teacher,student,shared].map(page=>
    page.reload({waitUntil:"domcontentloaded",timeout:40000})));
  await teacher.waitForFunction(()=>networkHydrated===true&&
    SIPlusActivityBreak.parked===true&&
    state.activityRun?.activityId==="board-game"&&state.activityRun?.board?.pages?.length===2,
    null,{timeout:18000});
  await student.waitForFunction(name=>state.selectedStudent===name&&
    state.activityRun?.activityId==="board-game"&&!studentNeedsJoin(),
    NAME,{timeout:18000});
  await shared.waitForFunction(()=>state.activityRun?.activityId==="board-game",
    null,{timeout:18000});
  assert.deepEqual(await teacher.evaluate(()=>state.siPlusActivityBreak.run.responses["1"]),
    {[NAME]:"A"});
  await teacher.locator("#returnClassBtn").click();
  await Promise.all([teacher,student,shared].map(page=>page.waitForFunction(id=>
    state.activityRun?.activityId===id&&state.activityRun?.slideIndex===1,
    DECK,{timeout:16000})));
  assert.equal(await teacher.evaluate(()=>state.activityRun.phase),"running");
  assert.deepEqual(await teacher.evaluate(()=>state.activityRun.responses["1"]),
    {[NAME]:"A"});
  assert.equal(await teacher.evaluate(()=>SIPlusActivityBreak.parked),false);
  assert.equal(await shared.evaluate(()=>state.activityRun?.slideIndex),1);
  assert.equal(await shared.locator("#sharedContent .presentation-public").count()>0,true);
  const identity=await teacher.evaluate(()=>({
    members:state.students.filter(s=>s.n===NAME).length,
    session:STUDENT_SESSION_ID
  }));
  assert.deepEqual(identity,baseline,"Lobby and SI+ breaks must not duplicate student identities or reset session");
  assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=3));
  assert.deepEqual(errors,[]);
  console.log("PHASE 4W LOBBY AND SI+ MULTI-VIEW RECONNECT PASSED",JSON.stringify({
    views:["teacher","student","projector"],gameMoves:1,
    boardPreserved:true,siPlusSlide:2,answerPreserved:true,
    refreshedAllThree:true,studentIdentityPreserved:true
  }));
 }finally{
  await tc.close();await sc.close();await pc.close();await browser.close();
 }
})().catch(err=>{console.error(err);process.exit(1)});
