/* FOUR IN LINE one-tap real-student mobile regression. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8878";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const tc=await browser.newContext({viewport:{width:1440,height:900}}),teacher=await tc.newPage(),errors=[];
 teacher.on("pageerror",e=>errors.push("teacher "+String(e)));
 try{
  assert.equal((await teacher.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>!!window.__fourLineBridgeInstalled&&networkHydrated===true,{timeout:15000});
  await teacher.evaluate(()=>{
    state.activityRun=null;state.ended=false;state.screen="classroom";state.activeApp=null;
    state.students=[{n:"Column Pilot",studentToken:"fil-mobile-pilot-token-01",c:"#49dcec",avatarKey:"astro",offline:false}];render();
  });
  await teacher.locator('#teacherControlBar [data-control="activities"]').click();
  await teacher.locator("#activitiesPanel .fil-library-card .fil-open").click();
  await teacher.waitForSelector("#filLaunch");
  await teacher.locator('[data-fil-seat="Column Pilot"]').selectOption("0");
  await teacher.locator("#filLaunch").click();
  await teacher.waitForFunction(()=>state.activityRun?.fourInLine?.seats?.["Column Pilot"]===0,{timeout:10000});
  const join=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  const sc=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await sc.addInitScript(({code,sid})=>{
   localStorage.setItem("siMothership.studentIdentity.v42",JSON.stringify({
     code,sessionId:sid,studentToken:"fil-mobile-pilot-token-01",name:"Column Pilot",avatarKey:"astro"}));
  },join);
  const student=await sc.newPage();
  student.on("pageerror",e=>errors.push("student "+String(e)));
  await student.goto(BASE+"/?role=student&code="+encodeURIComponent(join.code)+"&sid="+encodeURIComponent(join.sid),
   {waitUntil:"domcontentloaded",timeout:40000});
  await student.waitForFunction(()=>state.selectedStudent==="Column Pilot"&&state.activityRun?.fourInLine?.moves===0&&networkSocket?.readyState===WebSocket.OPEN,
   null,{timeout:16000});
  assert.equal(await student.locator("#studentContent [data-fil-confirm],#studentContent [data-fil-cancel]").count(),0);
  // Zoom-sized popout: large one-tap numbered columns must precede board.
  for(const [w,h] of [[440,760],[390,670],[330,610]]){
    await student.setViewportSize({width:w,height:h});
    const g=await student.evaluate(()=>{
      const board=document.querySelector("#studentContent .fil-board").getBoundingClientRect();
      const columns=document.querySelector("#studentContent .fil-columns").getBoundingClientRect();
      const keys=[...document.querySelectorAll("#studentContent .fil-drop-button")];
      return {overflow:document.documentElement.scrollWidth-innerWidth,boardTop:board.top,controlsTop:columns.top,
        sizes:keys.map(b=>[b.getBoundingClientRect().width,b.getBoundingClientRect().height]),
        footer:getComputedStyle(document.querySelector(".student-control-zone")).display};
    });
    assert.ok(g.overflow<=2&&g.controlsTop<g.boardTop,JSON.stringify({w,h,g}));
    assert.ok(g.sizes.length===7&&g.sizes.every(s=>s[0]>=44&&s[1]>=44),JSON.stringify(g));
    assert.equal(g.footer,"none");
  }
  await student.setViewportSize({width:390,height:844});
  await student.locator('#studentContent [data-fil-drop="3"]').tap({timeout:8000});
  await teacher.waitForFunction(()=>state.activityRun?.fourInLine?.moves===1,null,{timeout:11000});
  const result=await teacher.evaluate(()=>({
   moves:state.activityRun.fourInLine.moves,
   turn:state.activityRun.fourInLine.turn,
   center:state.activityRun.fourInLine.board[5*7+3]
  }));
  assert.deepEqual(result,{moves:1,turn:1,center:1});
  await student.waitForFunction(()=>state.activityRun?.fourInLine?.moves===1,null,{timeout:8000});
  assert.equal(await student.locator('#studentContent [data-fil-drop="3"]').isDisabled(),true);
  assert.equal(await student.locator('#studentContent [data-fil-confirm]').count(),0);
  await student.reload({waitUntil:'domcontentloaded',timeout:40000});
  await student.waitForFunction(()=>state.selectedStudent==='Column Pilot' && state.activityRun?.fourInLine?.moves===1 && networkSocket?.readyState===WebSocket.OPEN,null,{timeout:18000});
  assert.equal(await student.locator('#studentContent [data-fil-drop="3"]').isDisabled(),true);
  assert.deepEqual(await student.evaluate(()=>({moves:state.activityRun.fourInLine.moves,turn:state.activityRun.fourInLine.turn,cell:state.activityRun.fourInLine.board[5*7+3]})),{moves:1,turn:1,cell:1});
  assert.equal(await teacher.evaluate(()=>state.activityRun.fourInLine.moves),1);
  console.log('FOUR IN LINE real student reload and turn lock PASSED');
  assert.deepEqual(errors,[]);
  console.log("FOUR IN LINE student one-tap mobile drop and server turn change PASSED",result);
  await sc.close();
 }finally{await tc.close();await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
