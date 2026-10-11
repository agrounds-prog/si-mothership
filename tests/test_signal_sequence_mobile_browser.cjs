/* SIGNAL SEQUENCE two-browser mobile touch + real student websocket regression. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage","--no-sandbox"]});
 const tc=await browser.newContext({viewport:{width:1366,height:900}});
 const teacher=await tc.newPage(),errors=[];
 teacher.on("pageerror",e=>errors.push("teacher "+String(e)));
 try{
  const login=await teacher.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(login.status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>!!window.__signalSequenceBridge&&networkHydrated===true,{timeout:15000});
  await teacher.evaluate(()=>{
   state.activityRun=null;state.ended=false;state.screen="activities";state.activeApp=null;
   state.students=[{n:"Signal Pilot",studentToken:"signal-pilot-browser-001",c:"#3ad7e9",avatarKey:"astro",offline:false}];
   render();
  });
  await teacher.locator("#activitiesPanel .ss-library-card .ss-open").click();
  await teacher.waitForSelector("#ssLaunch");
  await teacher.locator("#ssPilot").selectOption("Signal Pilot");
  await teacher.locator("#ssLaunch").click();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.pilot==="Signal Pilot",{timeout:10000});
  const join=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  const sc=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await sc.addInitScript(({code,sid})=>{
   try{localStorage.setItem("siMothership.studentIdentity.v42",JSON.stringify({
    code,sessionId:sid,studentToken:"signal-pilot-browser-001",name:"Signal Pilot",avatarKey:"astro"}))}catch(_){}
  },join);
  const student=await sc.newPage();
  student.on("pageerror",e=>errors.push("student "+String(e)));
  await student.goto(BASE+"/?role=student&code="+encodeURIComponent(join.code)+"&sid="+encodeURIComponent(join.sid),{waitUntil:"domcontentloaded",timeout:40000});
  await student.waitForTimeout(1300);
  console.log("SIGNAL STUDENT JOIN DIAG",JSON.stringify(await student.evaluate(()=>({
    role:SESSION_ROLE,selected:state.selectedStudent,students:state.students.map(s=>({name:s.n,token:!!s.studentToken})),pilot:state.activityRun?.signalSequence?.pilot||"",
    runId:state.activityRun?.activityId||"",socket:networkSocket?.readyState??-1,hydrated:networkHydrated,
    stored:!!readStudentIdentity(),needsJoin:studentNeedsJoin(),bridge:!!window.__signalSequenceBridge,
    boot:document.getElementById("bootErrorText")?.textContent?.slice(0,300)||""
  }))));
  console.log("SIGNAL TEACHER JOIN DIAG",JSON.stringify(await teacher.evaluate(()=>({
    selected:state.selectedStudent,students:state.students.map(s=>({name:s.n,token:!!s.studentToken})),pilot:state.activityRun?.signalSequence?.pilot,runId:state.activityRun?.activityId,socket:networkSocket?.readyState,hydrated:networkHydrated
  }))));
  await student.waitForFunction(()=>state.selectedStudent==="Signal Pilot"&&state.activityRun?.signalSequence?.pilot==="Signal Pilot"&&networkSocket?.readyState===WebSocket.OPEN,null,{timeout:10000});
  const sound=student.locator('#studentContent [data-ss-audio]');
  await sound.tap();
  assert.match(await sound.getAttribute("class"),/ss-audio-ready/);
  await teacher.locator('#activityControllerPanel [data-ss-action="next"]').click();
  await student.waitForFunction(()=>!!document.querySelector("#studentContent .ss-pad.ss-lit"),null,{timeout:8000});
  assert.equal(await student.evaluate(()=>Number(state.activityRun.signalSequence.serverTime)>0),true);
  await teacher.waitForFunction(()=>state.activityRun.signalSequence.phase==="input",{timeout:14000});
  await student.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="input"&&document.querySelectorAll("#studentContent .ss-touch-key").length===4,{timeout:14000});
  const first=await teacher.evaluate(()=>state.activityRun.signalSequence.sequence[0]);
  await student.locator('#studentContent .ss-pad[data-ss-press="'+first+'"]').tap({timeout:9000});
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="success",{timeout:15000});
  assert.equal(await teacher.evaluate(()=>state.activityRun.signalSequence.best),1,"Touching SVG donut counts exactly once");
  await teacher.locator('#activityControllerPanel [data-ss-action="next"]').click();
  await teacher.waitForFunction(()=>state.activityRun.signalSequence.phase==="input",{timeout:14000});
  await student.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="input"&&document.querySelectorAll("#studentContent .ss-touch-key").length===4,{timeout:14000});
  const seq=await teacher.evaluate(()=>state.activityRun.signalSequence.sequence.slice());
  await student.locator('#studentContent .ss-touch-key[data-ss-press="'+seq[0]+'"]').tap({timeout:9000});
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.progress===1,{timeout:12000});
  await student.waitForFunction(()=>state.activityRun?.signalSequence?.progress===1,{timeout:12000});
  await student.locator('#studentContent .ss-pad[data-ss-press="'+seq[1]+'"]').tap({timeout:9000});
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="success"&&state.activityRun?.signalSequence?.best===2,{timeout:12000});
  const stats=await student.evaluate(()=>{
   const target=document.querySelector("#studentContent .ss-student");
   const r=target?.getBoundingClientRect();
   return {width:r?.width,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,status:document.querySelector("#studentContent .ss-student-status")?.textContent||""};
  });
  assert.ok(stats.scrollWidth<=stats.viewport+5,JSON.stringify(stats));
  assert.deepEqual(errors,[]);
  console.log("SIGNAL SEQUENCE mobile SVG touch, large buttons, real websocket, round one and two: PASS",stats);
  await sc.close();
 }finally{await tc.close();await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
