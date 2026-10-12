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
  // Test the new Mission Control link in the very same browser context
  // where the student screen and local student data are already active.
  const mission=await ctx.newPage();
  mission.on("pageerror",e=>errors.push("mission control "+String(e)));
  await mission.goto(BASE+"/teacher?role=student&code=OLD",{waitUntil:"domcontentloaded",timeout:40000});
  await mission.waitForFunction(()=>typeof SESSION_ROLE==="string",null,{timeout:15000});
  const missionState=await mission.evaluate(()=>({
    path:location.pathname,role:SESSION_ROLE,
    studentSkin:document.body.classList.contains("role-student"),
    teacherActive:document.querySelector("#teacher").classList.contains("active"),
    studentActive:document.querySelector("#student").classList.contains("active")
  }));
  assert.equal(missionState.path,"/teacher");
  assert.equal(missionState.role,"teacher");
  assert.equal(missionState.teacherActive,true,JSON.stringify(missionState));
  assert.equal(missionState.studentActive,false,JSON.stringify(missionState));
  assert.equal(missionState.studentSkin,false);
  await mission.close();
  assert.equal(await student.locator(".si-student-popout").count(),0,
    "no optional device window button");
  assert.equal(await student.locator("#siStudentDeviceLauncher").count(),0,
    "no secondary device window card");
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

  // Avatar navigation must avoid the former 24-tile vertical scroll.
  // Search and pagination keep all original avatar buttons reachable.
  await student.setViewportSize({width:440,height:760});
  const avatarNav=student.locator("#studentContent .si-avatar-navigator");
  await avatarNav.waitFor({timeout:6000});
  const allChoices=student.locator("#studentContent [data-join-avatar]");
  assert.ok(await allChoices.count()>=12,"full class roster is still present");
  await student.waitForFunction(() => document.querySelectorAll("#studentContent [data-join-avatar]:not([hidden])").length === 9, null, {timeout:5000});
  assert.equal(await student.locator("#studentContent [data-join-avatar]:visible").count(),9,"regular companion uses three rows");
  await avatarNav.locator("[data-si-avatar-next]").click();
  assert.equal(await avatarNav.locator(".si-avatar-page-count").textContent().then(s=>s.trim().startsWith("2 /")),true);
  assert.equal(await student.locator("#studentContent [data-join-avatar]:visible").count(),9);
  await avatarNav.locator("[data-si-avatar-prev]").click();
  const firstAvatarName=await allChoices.first().locator("strong").innerText();
  const avatarSearch=avatarNav.locator("input[type=search]");
  await avatarSearch.fill(firstAvatarName);
  assert.ok(await student.locator("#studentContent [data-join-avatar]:visible").count()>=1,"filter matches a real avatar");
  await avatarSearch.fill("zzzz-unlikely-avatar-99999");
  assert.equal(await student.locator("#studentContent [data-join-avatar]:visible").count(),0);
  assert.equal(await student.locator("#studentContent .si-avatar-no-match").isVisible(),true);
  await avatarSearch.fill("");
  assert.equal(await student.locator("#studentContent [data-join-avatar]:visible").count(),9);
  for(const [w,h,expected] of [[390,670,6],[330,610,6],[320,580,6],[480,610,6],[440,760,9]]){
    await student.setViewportSize({width:w,height:h});
    const g=await student.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-innerWidth,
      main:document.querySelector("#studentContent").clientHeight,
      navigation:[...document.querySelectorAll(".si-avatar-page-buttons button")].map(b=>{
        const r=b.getBoundingClientRect();return {width:r.width,height:r.height};
      })
    }));
    assert.ok(g.overflow<=2&&g.main>150,JSON.stringify({w,h,g}));
    assert.ok(g.navigation.length===2&&g.navigation.every(b=>b.width>=44&&b.height>=44),JSON.stringify({w,h,g}));
    // The viewport resize event can arrive a frame after setViewportSize.
    await student.waitForFunction(n=>document.querySelectorAll("#studentContent [data-join-avatar]:not([hidden])").length===n,expected,{timeout:4000});
    assert.equal(await student.locator("#studentContent [data-join-avatar]:visible").count(),expected,"avatar page size stays compact");
    const first=student.locator("#studentContent [data-join-avatar]:visible").first();
    const box=await first.boundingBox();
    assert.ok(box&&box.width>=80,JSON.stringify({w,h,box}));
  }

  await student.setViewportSize({width:440,height:760});
  await avatarSearch.fill(firstAvatarName);
  // Desktop popups are intentionally not triggered on phone-sized viewports.
  await student.setViewportSize({width:1380,height:910});
  const defaultWindowPromise=student.waitForEvent("popup",{timeout:10000});
  await avatarSearch.press("Enter");
  const launched=await defaultWindowPromise;
  launched.on("pageerror",e=>errors.push("default device "+String(e)));
  await launched.waitForLoadState("domcontentloaded");
  try{
    await launched.waitForSelector("#joinStudentName",{timeout:15000});
  }catch(e){
    console.log("AUTO AVATAR DEBUG",await launched.evaluate(()=>({
      joinStep:typeof joinStep==="undefined"?"unavailable":joinStep,
      hydrated:typeof networkHydrated==="undefined"?"unavailable":networkHydrated,
      needsJoin:typeof studentNeedsJoin==="function"?studentNeedsJoin():null,
      requested:new URLSearchParams(location.search).get("pickAvatar"),
      code:typeof STUDENT_JOIN_CODE==="undefined"?"unavailable":STUDENT_JOIN_CODE,
      codeDraft:typeof joinCodeDraft==="undefined"?"unavailable":joinCodeDraft,
      avatars:document.querySelectorAll("#studentContent [data-join-avatar]").length,
      content:document.querySelector("#studentContent")?.innerText.slice(0,250)
    })));
    throw e;
  }
  const defaultWindow=await launched.evaluate(()=>{
    const rect=document.querySelector("#student .device").getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,deviceWidth:rect.width,
      deviceHeight:rect.height,chosenAvatar:joinAvatarDraft,compact:new URLSearchParams(location.search).get("compact")};
  });
  assert.equal(defaultWindow.compact,"1");
  assert.ok(Math.abs(defaultWindow.width-defaultWindow.deviceWidth)<=2
    &&Math.abs(defaultWindow.height-defaultWindow.deviceHeight)<=2,
    JSON.stringify(defaultWindow));
  assert.ok(defaultWindow.width<=442 &&defaultWindow.height<=782,JSON.stringify(defaultWindow));
  assert.equal(await launched.locator(".si-student-popout").count(),0);
  assert.equal(await launched.locator("#siStudentDeviceLauncher").count(),0);
  assert.equal(await student.locator("#siStudentWindowHandoff").count(),1,
    "original full-size tab must become a handoff instead of a duplicate login");
  assert.match(await student.locator("#siStudentWindowHandoff").innerText(),/Continue in your classroom device/);
  // The original tab must NOT select the avatar or join a second time.
  assert.equal(await student.evaluate(()=>joinStep),"avatar");
  await launched.close();
  await student.bringToFront();
  await student.waitForSelector("#siStudentWindowHandoff",{state:"detached",timeout:5000});
  await student.setViewportSize({width:440,height:760});
  await student.locator("#studentContent [data-join-avatar]:visible").first().click();
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
  // The first avatar action already launched the window. Completing the
  // original join cannot create another unrequested browser window.
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


  // In class, the footer remains reachable for home controls; game screens
  // that place responses above must not reserve an empty footer.
  assert.ok(await student.locator(".student-control-zone").isVisible());
  assert.ok(await student.locator("#studentControls button").count()>0);

  // A student who starts with the standard Join Class code screen
  // also opens a real device window, without any separate pop-out option.
  const freshCtx=await browser.newContext({viewport:{width:1380,height:910}});
  const fresh=await freshCtx.newPage();
  fresh.on("pageerror",e=>errors.push("code student "+String(e)));
  await fresh.goto(BASE+"/?role=student",{waitUntil:"domcontentloaded",timeout:40000});
  await fresh.waitForSelector("#joinCodeInput",{timeout:15000});
  assert.equal(await fresh.locator("#siStudentDeviceLauncher").count(),0);
  await fresh.locator("#joinCodeInput").fill(session.code);
  const codeWindowPromise=fresh.waitForEvent("popup",{timeout:10000});
  await fresh.locator("#joinCodeBtn").click();
  const codeWindow=await codeWindowPromise;
  codeWindow.on("pageerror",e=>errors.push("code device "+String(e)));
  await codeWindow.waitForSelector("#studentContent .avatar-select-card",{timeout:15000});
  assert.equal(await fresh.locator("#siStudentWindowHandoff").count(),1);
  assert.equal(await fresh.evaluate(()=>joinStep),"code",
    "source tab must not continue joining after the popup opens");
  assert.equal(new URL(codeWindow.url()).searchParams.get("code"),session.code);
  assert.equal(new URL(codeWindow.url()).searchParams.get("compact"),"1");
  const codeGeom=await codeWindow.evaluate(()=>{
    const r=document.querySelector("#student .device").getBoundingClientRect();
    return {viewportWidth:innerWidth,viewportHeight:innerHeight,width:r.width,height:r.height};
  });
  assert.ok(Math.abs(codeGeom.viewportWidth-codeGeom.width)<=2
    &&Math.abs(codeGeom.viewportHeight-codeGeom.height)<=2,JSON.stringify(codeGeom));
  await freshCtx.close();
  // Initial QR avatar page: even a first click in the search field
  // launches the compact controller (not just pressing the avatar).
  const quickCtx=await browser.newContext({viewport:{width:1380,height:910}});
  const quick=await quickCtx.newPage();
  quick.on("pageerror",e=>errors.push("quick-start "+String(e)));
  await quick.goto(BASE+"/?role=student&code="+session.code+"&sid="+session.sid,{waitUntil:"domcontentloaded"});
  await quick.waitForSelector("#studentContent .si-avatar-search input");
  const quickWait=quick.waitForEvent("popup",{timeout:10000});
  await quick.locator("#studentContent .si-avatar-search input").click();
  const quickDevice=await quickWait;
  await quickDevice.waitForSelector("#studentContent .si-avatar-search input",{timeout:15000});
  assert.equal(await quick.locator("#siStudentWindowHandoff").count(),1);
  await quickCtx.close();
  assert.deepEqual(errors,[]);
  console.log("STUDENT COMPANION no-install first-click device handoff (avatar/search/code) PASSED");
  await ctx.close();
 }finally{await teacherContext.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
