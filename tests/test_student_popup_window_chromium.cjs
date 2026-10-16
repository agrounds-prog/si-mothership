/* Actual headed Chromium window-geometry regression.
   Uses a throwaway local classroom only; NEVER run against production.
   xvfb-run gives Chromium a real desktop window manager/display so this
   checks the browser's OUTER window, not just the responsive device card. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
// Chrome may ignore window-feature restrictions under managed policies, but
// the app must request a fixed, not manually resizable, companion window.
assert.match(fs.readFileSync("student-companion.js","utf8"),/resizable=no/);
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:false,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const teacherCtx=await browser.newContext({viewport:{width:1280,height:850}});
 const ctx=await browser.newContext({viewport:{width:1380,height:910}});
 const teacher=await teacherCtx.newPage();
 const page=await ctx.newPage();
 const errors=[];
 page.on("pageerror",err=>errors.push(String(err)));
 try{
  const login=await teacher.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(login.status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded"});
  await teacher.waitForFunction(()=>typeof STUDENT_JOIN_CODE!=="undefined"&&
    typeof STUDENT_SESSION_ID!=="undefined"&&networkHydrated===true);
  // Previous isolated browser tests may have left the Activities editor open.
  // Start from the classroom as a teacher would after closing the editor.
  await teacher.evaluate(()=>{
    state.screen='classroom';
    state.activeApp=null;
    state.activityRun=null;
    render();
  });
  await teacher.waitForFunction(()=>{
    const button=document.querySelector('#siTeacherStudentDeviceLaunch');
    if(!button)return false;
    const r=button.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    return document.elementFromPoint(x,y)===button||
      button.contains(document.elementFromPoint(x,y));
  },null,{timeout:10000});
  const {code,sid}=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  // Match the actual SI Calculator workflow: click a teacher launcher once
  // and verify a separate compact student popup appears with the LIVE code.
  const teacherLaunch=teacher.locator("#siTeacherStudentDeviceLaunch");
  await teacherLaunch.waitFor({state:"visible",timeout:15000});
  // Simulate an out-of-date QR link while retaining the live code/SID.
  // The teacher launcher must use the current session, not the stale link.
  await teacher.evaluate(()=>{
    window.__siPopupRegressionOldUrl=STUDENT_JOIN_URL;
    STUDENT_JOIN_URL=location.origin+'/?role=student&code=STAL&sid=old-session';
  });
  const teacherPreflight=await teacher.evaluate(()=>({
    code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID,
    staleJoinUrl:STUDENT_JOIN_URL,
    buttonText:document.querySelector('#siTeacherStudentDeviceLaunch')?.textContent,
    display:getComputedStyle(document.querySelector('#siTeacherStudentDeviceLaunch')).display
  }));
  console.log('TEACHER POPUP PREFLIGHT '+JSON.stringify(teacherPreflight));
  let teacherPop=null;
  for(let attempt=1;attempt<=2&&!teacherPop;attempt++){
    const pending=teacher.waitForEvent("popup",{timeout:10000}).catch(()=>null);
    await teacherLaunch.click();
    teacherPop=await pending;
    if(!teacherPop){
      const diagnostic=await teacher.evaluate(()=>({
        joinUrl:STUDENT_JOIN_URL,
        code:STUDENT_JOIN_CODE,
        sid:STUDENT_SESSION_ID,
        label:document.querySelector('#siTeacherStudentDeviceLaunch')?.textContent,
        title:document.querySelector('#siTeacherStudentDeviceLaunch')?.title,
        focus:document.hasFocus(),
        namedWindows:window.name
      }));
      console.log('TEACHER POPUP RETRY '+JSON.stringify({attempt,diagnostic}));
      await teacher.waitForTimeout(250);
    }
  }
  assert.ok(teacherPop,'Teacher student-device click must open an actual popup. '+JSON.stringify(teacherPreflight));
  await teacher.evaluate(()=>{STUDENT_JOIN_URL=window.__siPopupRegressionOldUrl;});
  await teacherPop.waitForLoadState("domcontentloaded");
  await teacherPop.waitForSelector("#studentContent .avatar-select-card",{timeout:15000});
  const teacherOpened=await teacherPop.evaluate(()=>({
    href:location.href,name:window.name,outerWidth,outerHeight,
    role:typeof SESSION_ROLE==="string"?SESSION_ROLE:""
  }));
  console.log("CALCULATOR STYLE TEACHER STUDENT DEVICE "+JSON.stringify(teacherOpened));
  assert.equal(teacherOpened.name,"si_mothership_student_sidecar");
  assert.equal(teacherOpened.role,"student");
  assert.ok(Math.abs(teacherOpened.outerWidth-440)<=16,JSON.stringify(teacherOpened));
  assert.ok(Math.abs(teacherOpened.outerHeight-780)<=16,JSON.stringify(teacherOpened));
  assert.equal(new URL(teacherOpened.href).searchParams.get("compact"),"1");
  assert.equal(new URL(teacherOpened.href).searchParams.get("code"),code);
  assert.equal(new URL(teacherOpened.href).searchParams.get("sid"),sid);
  await teacherPop.close();
  await page.goto(BASE+"/?role=student&code="+encodeURIComponent(code)+"&sid="+encodeURIComponent(sid),
                  {waitUntil:"domcontentloaded"});
  const launcher=page.locator("#siStudentOpenCompact");
  await launcher.waitFor({state:"visible",timeout:15000});
  assert.equal(await page.evaluate(()=>document.querySelector("#student").inert),true);
  // Background taps cannot open unwanted Chrome windows. Only the genuine
  // primary launch button has the browser-trusted activation.
  await page.mouse.click(18,190);
  assert.equal(await page.locator("#siStudentWindowHandoff").count(),0);
  assert.equal(await launcher.isVisible(),true);
  async function verifyCompactPopup(label){
   const pending=page.waitForEvent("popup",{timeout:12000});
   await launcher.click();
   const popup=await pending;
   popup.on("pageerror",err=>errors.push(String(err)));
   await popup.waitForLoadState("domcontentloaded");
   await popup.waitForSelector("#studentContent .si-avatar-search input",{timeout:15000});
   await popup.waitForFunction(()=>document.body.classList.contains("si-student-is-popout"),null,{timeout:5000});
   const outer=await popup.evaluate(()=>({
     name:window.name,
     outerWidth:window.outerWidth,outerHeight:window.outerHeight,
     innerWidth:window.innerWidth,innerHeight:window.innerHeight,
     screenX:window.screenX,screenY:window.screenY,
     deviceWidth:document.querySelector("#student .device").getBoundingClientRect().width,
     deviceHeight:document.querySelector("#student .device").getBoundingClientRect().height
   }));
   const opener=await page.evaluate(()=>({outerWidth,outerHeight}));
   console.log("HEADED CHROME "+label+" "+JSON.stringify({popup:outer,opener}));
   assert.equal(outer.name,"si_mothership_student_sidecar");
   // Playwright's emulated 1380x910 context may report an inner viewport
   // larger than its separately sized native Chrome window. Assert the real
   // outer dimensions directly, not a comparison between two coordinate
   // systems that can disagree under viewport emulation.
   // Check the full Chrome WINDOW, not just its responsive webpage.
   // Window managers add slight differences; the desired OUTER size is 440 × 780.
   assert.ok(Math.abs(outer.outerWidth-440)<=16,
     "Chrome outer window should be pre-cropped to 440 pixels wide: "+JSON.stringify(outer));
   assert.ok(Math.abs(outer.outerHeight-780)<=16,
     "Chrome outer window should be pre-cropped to 780 pixels tall: "+JSON.stringify(outer));
   assert.ok(outer.innerWidth>=320&&outer.innerWidth<=442,JSON.stringify(outer));
   assert.ok(outer.innerHeight>=440&&outer.innerHeight<=782,JSON.stringify(outer));
   assert.ok(Math.abs(outer.deviceWidth-outer.innerWidth)<=2,JSON.stringify(outer));
   assert.ok(Math.abs(outer.deviceHeight-outer.innerHeight)<=2,JSON.stringify(outer));
   assert.ok(opener.outerWidth>outer.outerWidth+150,"popup must be narrower than the original desktop window");
   assert.equal(await page.locator("#siStudentWindowHandoff").count(),1);
   await popup.close();
   await page.bringToFront();
   await page.locator("#siStudentWindowHandoff").waitFor({state:"detached",timeout:5000});
  }
  await verifyCompactPopup("full desktop, single launch button");
  // A copied student URL can already include compact=1. If pasted into an
  // ordinary Chrome tab, it still needs the normal popup/handoff behavior.
  await page.goto(BASE+"/?role=student&code="+encodeURIComponent(code)+
    "&sid="+encodeURIComponent(sid)+"&compact=1",{waitUntil:"domcontentloaded"});
  await launcher.waitFor({state:"visible",timeout:15000});
  await verifyCompactPopup("pasted compact URL in a normal full-sized tab");
  await verifyCompactPopup("full desktop, reopening after close");
  // A Chrome window snapped beside Zoom must not be misclassified as a phone.
  await page.setViewportSize({width:650,height:850});
  await verifyCompactPopup("snapped desktop, single launch button");
  // A student may explicitly stay in their current tab (school popup policy).
  await page.locator("#siStudentLaunchContinue").click();
  assert.equal(await page.locator("#siStudentLaunchScreen").isVisible(),false);
  assert.equal(await page.locator("#studentContent .si-avatar-search input").isVisible(),true);
  assert.equal(await page.evaluate(()=>document.querySelector("#student").inert),false);
  assert.deepEqual(errors,[]);
  console.log("HEADED CHROME real compact window + snapped desktop PASSED");
 }finally{
  await ctx.close();await teacherCtx.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
