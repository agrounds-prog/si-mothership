/* Isolated, live-server DOMINOES: real student touch -> server -> teacher -> shared screen.
   Uses the classroom test server and a synthetic student identity, never production data. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
const PILOT="Domino Pilot",TOKEN="domino-live-pilot-token-2026";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const tc=await browser.newContext({viewport:{width:1380,height:900}});
 const teacher=await tc.newPage(),errors=[];
 teacher.on("pageerror",e=>errors.push("teacher "+String(e)));
 teacher.on("dialog",async d=>{if(d.type()==="prompt")await d.accept("Dominoes Shared Test");else await d.accept()});
 try{
  assert.equal((await teacher.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>typeof Dominoes==="object"&&networkHydrated===true,null,{timeout:16000});
  await teacher.evaluate(()=>{
   state.activityRun=null;state.ended=false;state.activeApp=null;state.screen="classroom";
   state.students=[{n:"Domino Pilot",studentToken:"domino-live-pilot-token-2026",
     c:"#4be4ee",avatarKey:"astro",offline:false}];
   render();
  });
  await teacher.locator('#teacherControlBar [data-control="activities"]').click();
  const card=teacher.locator('#activitiesPanel .activity-catalog-grid .real-app-card').filter({has:teacher.locator("h3",{hasText:"DOMINOES"})});
  await card.locator("[data-open-app]").first().click();
  await teacher.waitForSelector("#dmStart",{timeout:10000});
  await teacher.locator("#dmStart").click();
  await teacher.waitForFunction(()=>state.activityRun?.dominoes?.players?.[0]==="Domino Pilot"
     &&state.activityRun?.dominoes?.players?.[1]==="Teacher",null,{timeout:10000});
  // Make the first dealt domino a double without altering its private ID;
  // then publish it through the normal teacher snapshot to the test server.
  const firstId=await teacher.evaluate(()=>{
   const g=state.activityRun.dominoes,t=g.hands["Domino Pilot"][0];
   t.b=t.a;render();return t.id;
  });
  const session=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  const sc=await browser.newContext({viewport:{width:440,height:780},isMobile:true,hasTouch:true});
  await sc.addInitScript(({code,sid})=>{
   localStorage.setItem("siMothership.studentIdentity.v42",JSON.stringify({
    code,sessionId:sid,studentToken:"domino-live-pilot-token-2026",name:"Domino Pilot",avatarKey:"astro"}));
  },session);
  const student=await sc.newPage();
  student.on("pageerror",e=>errors.push("student "+String(e)));
  await student.goto(BASE+"/?role=student&code="+encodeURIComponent(session.code)+"&sid="+encodeURIComponent(session.sid),
     {waitUntil:"domcontentloaded",timeout:40000});
  await student.waitForFunction(id=>state.selectedStudent==="Domino Pilot"
     &&state.activityRun?.dominoes?.hands?.["Domino Pilot"]?.some(t=>t.id===id)
     &&networkSocket?.readyState===WebSocket.OPEN,firstId,{timeout:16000});
  assert.deepEqual(await student.evaluate(()=>Object.keys(state.activityRun.dominoes.hands)),[PILOT],
    "other players' private racks remain hidden");
  assert.equal(await student.locator('#studentContent [data-dm-side="left"]').count(),0);
  assert.equal(await student.locator('#studentContent [data-dm-side="right"]').count(),0);
  const rotate=student.locator('#studentContent [data-dm-rotate="'+firstId+'"]');
  await rotate.tap({timeout:8000});
  assert.equal(await rotate.getAttribute("aria-pressed"),"true");
  // Simulate a classroom-state UI redraw before student commits the tile.
  await student.evaluate(()=>renderPublic());
  assert.equal(await student.locator('#studentContent [data-dm-rotate="'+firstId+'"]').getAttribute("aria-pressed"),"true",
    "rotation choice persists after a student interface refresh");
  for(const [width,height] of [[440,780],[390,670],[330,610]]){
   await student.setViewportSize({width,height});
   const metrics=await student.evaluate(id=>{
    const play=document.querySelector('#studentContent [data-dm-play="'+id+'"]');
    const rot=document.querySelector('#studentContent [data-dm-rotate="'+id+'"]');
    const p=play.getBoundingClientRect(),r=rot.getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth-innerWidth,play:[p.width,p.height],rotate:[r.width,r.height]};
   },firstId);
   assert.ok(metrics.overflow<=2&&metrics.play.every(n=>n>=44)&&metrics.rotate.every(n=>n>=44),
     JSON.stringify({width,height,metrics}));
  }
  await student.setViewportSize({width:440,height:780});
  await student.locator('#studentContent [data-dm-play="'+firstId+'"][data-dm-side="first"]').tap({timeout:8000});
  await teacher.waitForFunction(id=>state.activityRun?.dominoes?.chain?.length===1
     &&state.activityRun.dominoes.chain[0].id===id&&state.activityRun.dominoes.chain[0].vertical===true,
     firstId,{timeout:12000});
  assert.equal(await teacher.locator('#sharedContent .dm-played-tile .dm-tile.double.vertical').count(),1);
  const sharedContext=await browser.newContext({viewport:{width:1200,height:750}});
  const shared=await sharedContext.newPage();shared.on("pageerror",e=>errors.push("shared "+String(e)));
  await shared.goto(BASE+"/?role=shared",{waitUntil:"domcontentloaded",timeout:40000});
  await shared.waitForFunction(()=>state.activityRun?.dominoes?.chain?.length===1,null,{timeout:14000});
  assert.equal(await shared.locator("#sharedContent [data-dm-play]").count(),0);
  assert.equal(await shared.locator("#sharedContent .dm-played-tile .dm-tile.double.vertical").count(),1);
  assert.deepEqual(await shared.evaluate(()=>Object.keys(state.activityRun.dominoes.hands)),[],
    "projector must not receive private hands");
  // Teacher takes the next turn, also choosing vertical rotation.
  const secondId=await teacher.evaluate(()=>{
   const g=state.activityRun.dominoes,t=g.hands.Teacher[0];
   t.a=g.chain[g.chain.length-1].right;t.b=t.a;render();return t.id;
  });
  await teacher.locator('#activityControllerPanel [data-dm-select="'+secondId+'"]').click();
  assert.equal(await teacher.locator('#activityControllerPanel [data-dm-teacher="first"]').count(),0);
  await teacher.locator('#activityControllerPanel [data-dm-teacher="rotate"]').click();
  await teacher.locator('#activityControllerPanel [data-dm-teacher="right"]').click();
  await student.waitForFunction(id=>state.activityRun?.dominoes?.chain?.length===2
    &&state.activityRun.dominoes.chain[1].id===id&&state.activityRun.dominoes.chain[1].vertical===true,
    secondId,{timeout:13000});
  await shared.waitForFunction(()=>state.activityRun?.dominoes?.chain?.length===2,null,{timeout:10000});
  assert.equal(await shared.locator("#sharedContent .dm-played-tile .dm-tile.double.vertical").count(),2);
  // Student/browser reconnect must preserve turn, exact chain and private
  // rack without exposing the teacher's hand to the student or projector.
  await student.reload({waitUntil:"domcontentloaded",timeout:40000});
  await student.waitForFunction(()=>state.selectedStudent==="Domino Pilot"
    &&state.activityRun?.dominoes?.chain?.length===2
    &&networkSocket?.readyState===WebSocket.OPEN,null,{timeout:16000});
  assert.deepEqual(await student.evaluate(()=>({
    turn:state.activityRun.dominoes.turn,
    ids:state.activityRun.dominoes.chain.map(x=>x.id),
    hands:Object.keys(state.activityRun.dominoes.hands)
  })),{turn:0,ids:[firstId,secondId],hands:[PILOT]});
  assert.equal(await teacher.evaluate(()=>state.activityRun.dominoes.chain.length),2,
    "student reconnect cannot replay a Dominoes move");
  assert.deepEqual(await shared.evaluate(()=>Object.keys(state.activityRun.dominoes.hands)),[]);
  console.log("DOMINOES student reconnect and private hand PASSED");
  await teacher.locator('#activityControllerPanel [data-dm-teacher="save"]').click();
  assert.ok(await teacher.evaluate(()=>Dominoes.library().some(x=>x.name==="Dominoes Shared Test")));
  assert.deepEqual(errors,[]);
  console.log("DOMINOES REAL MULTIPLAYER PASSED",JSON.stringify({firstId,secondId,moves:2,views:["teacher","student","shared"],saved:true}));
  await sharedContext.close();await sc.close();
 }finally{await tc.close();await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
