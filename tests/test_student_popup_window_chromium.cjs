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
  await teacher.waitForFunction(()=>typeof STUDENT_JOIN_CODE!=="undefined"&&typeof STUDENT_SESSION_ID!=="undefined");
  const {code,sid}=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  await page.goto(BASE+"/?role=student&code="+encodeURIComponent(code)+"&sid="+encodeURIComponent(sid),
                  {waitUntil:"domcontentloaded"});
  const search=page.locator("#studentContent .si-avatar-search input");
  await search.waitFor({timeout:15000});
  async function verifyCompactPopup(label){
   const pending=page.waitForEvent("popup",{timeout:12000});
   // The screenshot regression: start on a maximized browser with the
   // compact controller centered, then click EMPTY background (not a
   // button/search field). It must still launch a real small Chrome window.
   await page.mouse.click(18,190);
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
  await verifyCompactPopup("full desktop, blank background click");
  // A Chrome window snapped beside Zoom must not be misclassified as a phone.
  await page.setViewportSize({width:650,height:850});
  await verifyCompactPopup("snapped desktop, blank background click");
  assert.deepEqual(errors,[]);
  console.log("HEADED CHROME real compact window + snapped desktop PASSED");
 }finally{
  await ctx.close();await teacherCtx.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
