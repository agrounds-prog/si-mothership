/* SI Mothership student browser companion: narrow Zoom sidecar + join regression.
   Local isolated server only. No real classroom state is changed. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const teacherContext=await browser.newContext({viewport:{width:1300,height:800}});
 const teacher=await teacherContext.newPage();
 const errors=[];teacher.on("pageerror",e=>errors.push("teacher "+String(e)));
 try{
  assert.equal((await teacher.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>typeof STUDENT_JOIN_CODE!=="undefined"&&typeof STUDENT_SESSION_ID!=="undefined",null,{timeout:15000});
  const session=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  const ctx=await browser.newContext({viewport:{width:1380,height:910}});
  const student=await ctx.newPage();
  student.on("pageerror",e=>errors.push("student "+String(e)));
  await student.goto(BASE+"/?role=student&code="+encodeURIComponent(session.code)+"&sid="+encodeURIComponent(session.sid),{waitUntil:"domcontentloaded",timeout:40000});
  await student.waitForSelector("#studentContent .avatar-select-card",{timeout:15000});
  await student.waitForSelector(".si-student-popout",{timeout:5000});
  assert.equal(await student.locator('link[href^="/student-companion.css"]').count(),1);
  assert.equal(await student.locator('script[src^="/student-companion.js"]').count(),1);

  for(const [width,height] of [[1380,910],[900,730],[440,760],[390,670],[330,680]]){
    await student.setViewportSize({width,height});
    const g=await student.evaluate(()=>{
      const rect=sel=>{const r=document.querySelector(sel)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}:null};
      const grid=document.querySelector("#studentContent .join-avatar-grid");
      return {body:rect("body"),panel:rect("#student .device"),main:rect("#studentContent"),
       join:rect("#studentContent .student-join-card"),tiles:document.querySelectorAll("#studentContent [data-join-avatar]").length,
       cols:getComputedStyle(grid).gridTemplateColumns.split(" ").length,
       docOverflow:document.documentElement.scrollWidth-innerWidth,
       mainScroll:document.querySelector("#studentContent").scrollHeight,
       mainHeight:document.querySelector("#studentContent").clientHeight,
       controlDisplay:getComputedStyle(document.querySelector(".student-control-zone")).display};
    });
    assert.ok(g.panel&&g.join,"device and join remain visible");
    assert.ok(g.panel.width<=Math.min(width,442),JSON.stringify({width,g}));
    assert.ok(g.panel.bottom<=height+2&&g.panel.y>=-2,JSON.stringify({width,height,g}));
    assert.ok(g.docOverflow<=2,JSON.stringify({width,g}));
    assert.ok(g.tiles>=12,"avatar grid remains populated");
    assert.equal(g.cols,width<360?2:3,JSON.stringify({width,g}));
    assert.equal(g.controlDisplay,"none","Join mode hides non-functional controls");
    assert.ok(g.main.height>=200,JSON.stringify({width,height,g}));
    console.log("STUDENT COMPANION join geometry "+JSON.stringify({width,height,device:g.panel,columns:g.cols,mainScroll:g.mainScroll,mainHeight:g.mainHeight}));
  }
  await student.setViewportSize({width:440,height:760});
  await student.locator("#studentContent [data-join-avatar]").first().click();
  await student.waitForSelector("#studentContent #joinClassBtn",{timeout:5000});
  const confirmation=await student.evaluate(()=>({
    header:document.querySelector("#studentContent .confirm-join-card h2")?.textContent,
    overflow:document.documentElement.scrollWidth-innerWidth,
    mainScroll:document.querySelector("#studentContent").scrollHeight,
    mainHeight:document.querySelector("#studentContent").clientHeight
  }));
  assert.match(confirmation.header,/Name|Nickname/);
  assert.ok(confirmation.overflow<=2,JSON.stringify(confirmation));
  await student.locator("#joinStudentName").fill("Zoom Companion Student");
  await student.locator("#joinClassBtn").click();
  await student.waitForFunction(()=>state.selectedStudent==="Zoom Companion Student"&&!studentNeedsJoin(),null,{timeout:12000});
  const joined=await student.evaluate(()=>({
    panel:document.querySelector("#student .device").getBoundingClientRect().width,
    mainHeight:document.querySelector("#studentContent").clientHeight,
    controlsHeight:document.querySelector(".student-control-zone").getBoundingClientRect().height,
    docOverflow:document.documentElement.scrollWidth-innerWidth
  }));
  assert.ok(joined.docOverflow<=2,JSON.stringify(joined));
  assert.ok(joined.controlsHeight<=760*.4,JSON.stringify(joined));
  assert.ok(joined.mainHeight>=180,JSON.stringify(joined));
  assert.equal(await student.locator("#studentConnectionLabel").textContent().then(s=>s.includes("Connected")),true);

  // Pop-out is a separate student window using the actual session URL.
  // It must not change role or lose local student identity.
  await student.setViewportSize({width:1380,height:910});
  const popupWait=student.waitForEvent("popup",{timeout:10000});
  await student.locator(".si-student-popout").click();
  const popup=await popupWait;
  popup.on("pageerror",e=>errors.push("popout "+String(e)));
  await popup.waitForLoadState("domcontentloaded");
  await popup.waitForFunction(()=>document.body.classList.contains("si-student-is-popout")&&state.selectedStudent==="Zoom Companion Student",null,{timeout:15000});
  assert.equal(await popup.locator("button.si-student-popout").count(),0,"popout does not nest popouts");
  assert.match(popup.url(),/role=student/);
  assert.deepEqual(errors,[]);
  console.log("STUDENT COMPANION join -> name -> active controls -> Zoom popout PASSED");
  await ctx.close();
 }finally{await teacherContext.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
