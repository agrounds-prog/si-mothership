/* Phase 4X — real four-game lobby/restore/reconnect reliability.
   Disposable localhost only: neither production classrooms nor /data are
   accessed. Native teacher controls and server-synchronized role views. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8895";
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(BASE))
 throw Error("Phase 4X may only run against an isolated local classroom.");
const NAMES=["4X Pilot","4X Crew"];
const TYPES=[
 {app:"dominoes",name:"DOMINOES",id:"dominoes-game"},
 {app:"cosmic-cards",name:"COSMIC CARDS",id:"cosmic-cards-game"},
 {app:"million",name:"MILLION",id:"million-game"},
 {app:"match",name:"MATCH",id:"match-game"}
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const tc=await browser.newContext({viewport:{width:1380,height:900}});
 const pc=await browser.newContext({viewport:{width:1280,height:720}});
 const sctx=await Promise.all(NAMES.map(()=>browser.newContext({viewport:{width:1380,height:900}})));
 const teacher=await tc.newPage(),shared=await pc.newPage(),
   students=await Promise.all(sctx.map(ctx=>ctx.newPage())),errors=[];
 for(const [name,page] of [["teacher",teacher],["projector",shared],
   ...students.map((p,i)=>[NAMES[i],p])]){
  page.on("pageerror",e=>errors.push(name+": "+String(e.stack||e)));
  await page.route(/youtube\.com|youtu\.be|ytimg\.com/,route=>route.abort());
 }
 const all=[teacher,shared,...students];
 const waitAll=async(id,phase)=>Promise.all(all.map(page=>page.waitForFunction(
  ({id,phase})=>state.activityRun?.activityId===id&&
   (!phase||state.activityRun.phase===phase),
  {id,phase},{timeout:17000})));
 const checksum=async(type,page=teacher)=>page.evaluate(type=>{
  const run=state.activityRun;
  if(type==="dominoes")return {turn:run.dominoes.turn,
   chain:run.dominoes.chain.map(t=>({id:t.id,left:t.left,right:t.right})),
   scores:run.dominoes.scores};
  if(type==="cosmic-cards")return {turn:run.cosmic.turn,
   direction:run.cosmic.direction,color:run.cosmic.color,
   count:run.cosmic.discard.length,
   hands:Object.fromEntries(Object.entries(run.cosmic.hands||{})
    .map(([n,h])=>[n,h.length]))};
  if(type==="million")return {index:run.million.questionIndex,
   eliminated:run.million.eliminated||[],
   inventory:run.million.inventory,
   lockedAnswer:run.million.lockedAnswer,
   ladderLevel:run.million.ladderLevel};
  if(type==="match")return {selected:run.match.selected||[],
   matched:run.match.matched||[],turn:run.match.activeStudentIndex,
   scores:run.match.scores||{},teamScores:run.match.teamScores||{}};
 },type);
 try{
  assert.equal((await tc.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  teacher.on("dialog",d=>d.type()==="prompt"?d.accept("Phase 4X Game Save"):d.accept());
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>networkHydrated===true&&STUDENT_JOIN_CODE&&
    STUDENT_SESSION_ID&&window.Dominoes&&typeof cosmicSetupMarkup==="function"&&
    !!window.MillionStudio&&typeof matchBuilderWire==="function",null,{timeout:25000});
  const session=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  for(let i=0;i<students.length;i++){
   const page=students[i];
   await page.goto(BASE+"/?role=student&code="+encodeURIComponent(session.code)+
    "&sid="+encodeURIComponent(session.sid),{waitUntil:"domcontentloaded",timeout:40000});
   await page.locator("#siStudentLaunchScreen").waitFor({state:"visible",timeout:17000});
   await page.locator("#siStudentLaunchContinue").click();
   await page.locator("#studentContent [data-join-avatar]:visible").first().click();
   await page.locator("#joinStudentName").fill(NAMES[i]);
   await page.locator("#joinClassBtn").click();
   await page.waitForFunction(n=>state.selectedStudent===n&&!studentNeedsJoin(),
    NAMES[i],{timeout:17000});
   await page.setViewportSize({width:440,height:780});
  }
  await shared.goto(BASE+"/?role=shared&sid="+encodeURIComponent(session.sid),
   {waitUntil:"domcontentloaded",timeout:40000});
  await shared.waitForFunction(()=>networkHydrated===true,null,{timeout:17000});
  await teacher.waitForFunction(names=>names.every(n=>state.students.some(s=>s.n===n)),
    NAMES,{timeout:15000});
  const classBaseline=await teacher.evaluate(()=>({sid:STUDENT_SESSION_ID,
   members:state.students.filter(s=>s.n.startsWith("4X ")).map(s=>s.n).sort()}));

  async function openGame(type){
   // Use native teacher Activity Library navigation and its existing launcher.
   await teacher.locator('#teacherControlBar [data-control="activities"]').click();
   await teacher.waitForFunction(()=>state.screen==="activities",null,{timeout:9000});
   const card=teacher.locator('#activitiesPanel .activity-catalog-grid .real-app-card')
    .filter({has:teacher.locator("h3",{hasText:type.name})});
   await card.locator("[data-open-app]").first().click();
   await teacher.waitForFunction(app=>state.activeApp===app,type.app,{timeout:9000});
  }
  const results=[];
  for(const type of TYPES){
   await openGame(type);
   if(type.app==="dominoes"){
    await teacher.locator("#dmStart").waitFor({state:"visible"});
    await teacher.locator("#dmStart").click();
   }else if(type.app==="cosmic-cards"){
    await teacher.locator("#cosmicLaunchBtn").waitFor({state:"visible"});
    await teacher.locator("#cosmicLaunchBtn").click();
   }else if(type.app==="million"){
    await teacher.locator(".ms-studio").waitFor({state:"visible"});
    await teacher.locator("#msSample").click();
    await teacher.locator("#msLaunch").click();
   }else if(type.app==="match"){
    await teacher.locator(".mcb-shell").waitFor({state:"visible"});
    await teacher.locator('[data-mcb-mode="quick"]').click();
    await teacher.locator("#matchSetName").fill("Phase 4X Multi-View Matching");
    await teacher.locator("#mcbQuickPairs").fill([
     "Sun | Solar","Moon | Lunar","Earth | Planet","Mars | Red",
     "Cat | Kitten","Dog | Puppy","Cow | Calf","Duck | Duckling"].join("\n"));
    await teacher.waitForFunction(()=>document.querySelector("#mcbPairCount")?.textContent==="8",
     null,{timeout:8000});
    await teacher.locator("#matchMode").selectOption("individual");
    await teacher.locator("#mcbSaveLaunch").click();
   }
   await teacher.waitForFunction(id=>state.activityRun?.activityId===id,
    type.id,{timeout:14000});
   if(await teacher.evaluate(()=>state.activityRun?.phase==="lobby")){
    await teacher.locator("#startActivityBtn").waitFor({state:"visible",timeout:8000});
    await teacher.locator("#startActivityBtn").click();
   }
   await waitAll(type.id,"running");
   let milestone="launched";
   if(type.app==="dominoes"){
    await teacher.locator('#activityControllerPanel [data-dm-select]').first().click();
    await teacher.locator('#activityControllerPanel [data-dm-teacher="first"]').click();
    await teacher.waitForFunction(()=>state.activityRun?.dominoes?.chain?.length===1,
     null,{timeout:11000});
    milestone="one tile played";
   }else if(type.app==="cosmic-cards"){
    await teacher.locator("#cosmicSkipBtn").click();
    await teacher.waitForFunction(()=>state.activityRun?.cosmic?.turn===1,
     null,{timeout:11000});
    milestone="teacher skipped first turn";
   }else if(type.app==="million"){
    await teacher.locator('[data-million-teacher-life="reduce"]').click();
    await teacher.waitForFunction(()=>state.activityRun?.million?.eliminated?.length===2,
     null,{timeout:10000});
    milestone="one 50/50 lifeline used";
   }else{
    await teacher.locator("#matchSkipBtn").click();
    milestone="teacher next-player control used";
   }
   const before=await checksum(type.app);
   // Each of these four games exposes the same native lobby safeguard.
   await teacher.locator("#sendActivityLobbyBtn").waitFor({state:"visible",timeout:9000});
   await teacher.locator("#sendActivityLobbyBtn").click();
   await waitAll(type.id,"lobby");
   // The live lobby is also used from controller-only game layouts; when
   // it has no inline Start button, invoke the same native resume handler.
   if(await teacher.locator("#startActivityBtn").isVisible())
     await teacher.locator("#startActivityBtn").click();
   else await teacher.evaluate(()=>startOrResumeActivityRun());
   await waitAll(type.id,"running");
   assert.deepEqual(await checksum(type.app),before,
    type.name+" must not rewind or replay its game progress after lobby resume.");
   // Force three independently connected browser windows to rehydrate from
   // the server after the teacher has resumed the round.
   await Promise.all([shared,...students].map(p=>p.reload({waitUntil:"domcontentloaded",timeout:40000})));
   await Promise.all(students.map((p,i)=>p.waitForFunction(name=>
    state.selectedStudent===name&&!studentNeedsJoin()&&networkHydrated===true,
    NAMES[i],{timeout:17000})));
   await waitAll(type.id,"running");
   const teacherState=await checksum(type.app);
   assert.deepEqual(teacherState,before,
     type.name+" browser reconnections must not restart game state.");
   if(type.app==="cosmic-cards"||type.app==="dominoes"){
    const privacy=await shared.evaluate(type=>{
     const run=state.activityRun;
     return type==="dominoes"?Object.keys(run.dominoes.hands||[]).length:
      Object.values(run.cosmic?.hands||{}).reduce((n,h)=>n+h.length,0);
    },type.app);
    assert.equal(privacy,0,type.name+" projector must hide private hands");
   }
   assert.ok(await students[0].evaluate(()=>document.documentElement.scrollWidth-innerWidth<=4),
    type.name+" compact student device must not have horizontal overflow");
   await teacher.locator("#returnClassBtn").waitFor({state:"visible",timeout:9000});
   await teacher.locator("#returnClassBtn").click();
   await Promise.all(all.map(p=>p.waitForFunction(()=>state.activityRun===null,
    null,{timeout:16000})));
   results.push({game:type.name,milestone,resumed:true,roles:4,reconnected:true});
  }
  const after=await teacher.evaluate(()=>({sid:STUDENT_SESSION_ID,
   members:state.students.filter(s=>s.n.startsWith("4X ")).map(s=>s.n).sort()}));
  assert.deepEqual(after,classBaseline,"Transitions never reset the session or duplicate students");
  assert.deepEqual(errors,[],"No teacher/student/projector JS exceptions");
  console.log("PHASE 4X FOUR-GAME LOBBY / RESTORE / RECONNECT PASSED",JSON.stringify(results));
 }finally{
  for(const ctx of [...sctx,pc,tc])await ctx.close().catch(()=>{});
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
