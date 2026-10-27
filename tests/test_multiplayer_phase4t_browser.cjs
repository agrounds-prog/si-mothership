/* Phase 4T: real Chromium teacher + three independent students + projector.
   Exercises the native Four In Line buttons, server-authoritative turns,
   student reconnect, spectator read-only access and synchronized win state.
   STRICTLY localhost with a throwaway Mothership SQLite test server. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8892";
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE))
  throw Error("Phase 4T browser stress must run on isolated localhost");
const crew=[
 {name:"4T Blue",token:"phase4t-chrome-blue"},
 {name:"4T Gold",token:"phase4t-chrome-gold"},
 {name:"4T Viewer",token:"phase4t-chrome-viewer"}
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const teacherContext=await browser.newContext({viewport:{width:1380,height:890}});
 const teacher=await teacherContext.newPage();
 const contexts=[],errors=[];
 teacher.on("pageerror",e=>errors.push("teacher: "+String(e)));
 try{
  assert.equal((await teacherContext.request.post(BASE+"/api/teacher/login",
   {data:{key:"5030"}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>typeof FourLine==="object"&&networkHydrated===true,
   null,{timeout:20000});
  await teacher.evaluate(crew=>{
   state.ended=false;state.screen="activities";state.activeApp=null;state.activityRun=null;
   state.students=crew.map((s,i)=>({n:s.name,studentToken:s.token,
      avatarKey:"astro",c:["#43dcf9","#ffb566","#bfaaff"][i],offline:false}));
   activityLibraryCategory="all";activityLibraryQuery="";
   render();
  },crew);
  await teacher.locator("#activitiesPanel .fil-library-card .fil-open").click();
  await teacher.locator("#filLaunch").waitFor({state:"visible",timeout:15000});
  await teacher.locator('[data-fil-seat="4T Blue"]').selectOption("0");
  await teacher.locator('[data-fil-seat="4T Gold"]').selectOption("1");
  await teacher.locator("#filLaunch").click();
  await teacher.waitForFunction(()=>state.activityRun?.fourInLine?.seats?.["4T Blue"]===0&&
    state.activityRun?.fourInLine?.seats?.["4T Gold"]===1,
    null,{timeout:14000});
  const join=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  async function openStudent(spec){
   const ctx=await browser.newContext({viewport:{width:440,height:780},
     isMobile:true,hasTouch:true});
   contexts.push(ctx);
   await ctx.addInitScript(({code,sid,spec})=>{
    localStorage.setItem("siMothership.studentIdentity.v42",JSON.stringify({
     code,sessionId:sid,studentToken:spec.token,name:spec.name,avatarKey:"astro"}));
   },{...join,spec});
   const page=await ctx.newPage();
   page.on("pageerror",e=>errors.push(spec.name+": "+String(e)));
   await page.goto(BASE+"/?role=student&code="+encodeURIComponent(join.code)+
     "&sid="+encodeURIComponent(join.sid),{waitUntil:"domcontentloaded",timeout:40000});
   await page.waitForFunction(name=>state.selectedStudent===name&&
      !!state.activityRun?.fourInLine&&networkSocket?.readyState===WebSocket.OPEN,
      spec.name,{timeout:18000});
   return page;
  }
  let [blue,gold,viewer]=await Promise.all(crew.map(openStudent));
  const sharedContext=await browser.newContext({viewport:{width:1250,height:800}});
  contexts.push(sharedContext);
  const shared=await sharedContext.newPage();
  shared.on("pageerror",e=>errors.push("shared: "+String(e)));
  await shared.goto(BASE+"/?role=shared&sid="+encodeURIComponent(join.sid),
   {waitUntil:"domcontentloaded",timeout:40000});
  await shared.waitForFunction(()=>state.activityRun?.fourInLine?.moves===0&&networkHydrated===true,
   null,{timeout:15000});
  const initial=await Promise.all([blue,gold,viewer].map(page=>page.evaluate(()=>({
    label:document.querySelector("#studentContent .fil-student-status")?.textContent.trim(),
    enabled:[...document.querySelectorAll("#studentContent [data-fil-drop]")]
      .filter(x=>!x.disabled).length,
    overflow:document.documentElement.scrollWidth-innerWidth
  }))));
  assert.equal(initial[0].enabled,7,JSON.stringify(initial));
  assert.equal(initial[1].enabled,0,JSON.stringify(initial));
  assert.equal(initial[2].enabled,0,JSON.stringify(initial));
  assert.ok(initial.every(x=>x.overflow<=2),JSON.stringify(initial));
  const drops=[0,0,1,1,2,2,3];
  for(let index=0;index<drops.length;index++){
   const active=index%2?gold:blue;
   const inactive=index%2?blue:gold;
   const before=index,after=index+1,column=drops[index];
   assert.equal(await inactive.locator('#studentContent [data-fil-drop="'+column+'"]').isDisabled(),true,
    "out-of-turn player controls stay locked");
   // A rapid second native click is ignored by the in-flight student input
   // guard; server requests are also deduplicated (separately stress-tested).
   await active.locator('#studentContent [data-fil-drop="'+column+'"]').tap({timeout:9000});
   await active.evaluate(col=>{
      const b=document.querySelector('#studentContent [data-fil-drop="'+col+'"]');
      if(b)b.click();
   },column);
   await Promise.all([teacher,shared,blue,gold,viewer].map(page=>
      page.waitForFunction(n=>state.activityRun?.fourInLine?.moves===n,
        after,{timeout:16000})));
   assert.equal(await teacher.evaluate(()=>state.activityRun.fourInLine.moves),after,
     "a rapid double click cannot award a second disc");
   if(index===0){
    // Close/reopen a real student browser after a move. Its identity, turn
    // state and score remain server-owned, not regenerated from local tabs.
    await blue.reload({waitUntil:"domcontentloaded",timeout:40000});
    await blue.waitForFunction(()=>state.selectedStudent==="4T Blue"&&
       state.activityRun?.fourInLine?.moves===1&&networkSocket?.readyState===WebSocket.OPEN,
       null,{timeout:18000});
    assert.equal(await blue.locator('#studentContent [data-fil-drop="0"]').isDisabled(),true);
   }
  }
  const final=await teacher.evaluate(()=>({
    game:state.activityRun.fourInLine,
    roster:state.students.map(x=>x.n),
    runToken:state.activityRun.runToken
  }));
  assert.equal(final.game.status,"won");
  assert.equal(final.game.winner,0);
  assert.equal(final.game.moves,7);
  assert.deepEqual(final.game.winning,[35,36,37,38]);
  assert.equal(await shared.locator("#sharedContent .fil-victory").count(),1);
  assert.equal(await viewer.locator("#studentContent [data-fil-drop]:enabled").count(),0);
  assert.deepEqual(await shared.evaluate(()=>state.students.filter(s=>s.studentToken)
    .map(s=>s.n)),[],"projector must not receive student identity tokens");
  const startIdentity=await blue.evaluate(()=>({
    student:state.selectedStudent,moves:state.activityRun.fourInLine.moves,
    result:state.activityRun.fourInLine.status
  }));
  assert.deepEqual(startIdentity,{student:"4T Blue",moves:7,result:"won"});
  assert.deepEqual(errors,[]);
  console.log("PHASE 4T CHROMIUM MULTI-VIEW STRESS PASSED",
    JSON.stringify({students:3,views:5,moves:7,win:final.game.winner,
      sharedVictory:true,reloadedStudent:true,privateTokensProtected:true}));
 }finally{
  for(const context of contexts)await context.close().catch(()=>{});
  await teacherContext.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
