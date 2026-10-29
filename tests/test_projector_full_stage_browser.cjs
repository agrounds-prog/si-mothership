/* Phase 4Z — isolated Chromium regression for a true edge-to-edge projector.
 * All tests run against an ephemeral localhost server; never production /data. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8897";
if(!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(BASE))
 throw Error("Projector layout regression is localhost only.");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const projectorCtx=await browser.newContext({viewport:{width:1709,height:897}});
 const teacherCtx=await browser.newContext({viewport:{width:1280,height:800}});
 const teacher=await teacherCtx.newPage(),projector=await projectorCtx.newPage(),errors=[];
 for(const [role,page] of [["teacher",teacher],["projector",projector]])
  page.on("pageerror",err=>errors.push(role+": "+String(err)));
 const sizes=[[1709,897],[1280,720],[1024,768]];
 async function checkFullStage(scene){
  for(const [width,height] of sizes){
   await projector.setViewportSize({width,height});
   const x=await projector.evaluate(()=>{
    const outer=document.querySelector("#shared .shared-screen");
    const content=document.getElementById("sharedContent");
    const top=document.querySelector("#shared .mirror-top");
    const footer=document.querySelector("#shared .mirror-footer");
    const r=content.getBoundingClientRect(),s=outer.getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,
      rootLeft:r.left,rootRight:r.right,rootWidth:r.width,rootHeight:r.height,
      shellWidth:s.width,shellHeight:s.height,shellColumns:getComputedStyle(outer).gridTemplateColumns,
      top:getComputedStyle(top).display,footer:getComputedStyle(footer).display,
      horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
   });
   console.log("PHASE4Z "+scene+" "+width+"x"+height,JSON.stringify(x));
   assert.equal(x.top,"none","The legacy classroom join sidebar must be hidden.");
   assert.equal(x.footer,"none","The legacy status/sidebar footer must be hidden.");
   assert.ok(Math.abs(x.rootLeft)<=1&&Math.abs(x.rootRight-width)<=2,
     "Projector must reach both viewport edges, not reserve a join-code rail: "+JSON.stringify(x));
   assert.ok(Math.abs(x.rootHeight-height)<=2,
     "Projector must occupy full screen height: "+JSON.stringify(x));
   assert.ok(x.horizontalOverflow<=3,"No horizontal projector scrolling: "+JSON.stringify(x));
  }
 }
 try{
  assert.equal((await teacherCtx.request.post(BASE+"/api/teacher/login",
   {data:{key:"5030"}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>networkHydrated===true&&STUDENT_SESSION_ID&&STUDENT_JOIN_CODE,
   null,{timeout:18000});
  const session=await teacher.evaluate(()=>({sid:STUDENT_SESSION_ID,code:STUDENT_JOIN_CODE}));
  assert.ok(session.code,"Teacher can still access join codes");
  await projector.goto(BASE+"/?role=shared&sid="+encodeURIComponent(session.sid),
   {waitUntil:"domcontentloaded",timeout:40000});
  await projector.waitForFunction(()=>networkHydrated===true&&
    !!document.getElementById("sharedContent"),null,{timeout:18000});
  console.log("PHASE5A_LOBBY_DOM",await projector.evaluate(()=>{
    const r=document.getElementById("sharedContent");
    const s=getComputedStyle(r);
    return {html:r.innerHTML.slice(0,9000),cls:r.className,css:{display:s.display,justify:s.justifyContent,align:s.alignItems,padding:s.padding},bodyClass:document.body.className}
  }));
  await checkFullStage("lobby");
  // Real teacher Activity Library command: projector must stay edge-to-edge.
  await teacher.locator('#teacherControlBar [data-control="activities"]').click();
  await teacher.waitForFunction(()=>state.screen==="activities",null,{timeout:10000});
  await projector.waitForFunction(()=>state.screen==="activities",null,{timeout:13000});
  console.log("PHASE5A_ACTIVITIES_DOM",await projector.evaluate(()=>{
    const r=document.getElementById("sharedContent");
    const s=getComputedStyle(r);
    return {html:r.innerHTML.slice(0,9000),cls:r.className,css:{display:s.display,justify:s.justifyContent,align:s.alignItems,padding:s.padding},bodyClass:document.body.className}
  }));
  await checkFullStage("activities");
  // Native rendering of a public game. No private controls or live classroom
  // mutations; the full stage must also work for game/board content.
  await projector.evaluate(()=>{
    const g=FourLine.make(["Blue Crew","Gold Crew"]);
    document.getElementById("sharedContent").innerHTML=FourLine.publicHTML(g,true);
  });
  assert.equal(await projector.locator("#sharedContent .fil-cell").count(),42);
  assert.equal(await projector.locator("#sharedContent [data-fil-drop]").count(),0);
  await checkFullStage("four-in-line");
  assert.deepEqual(errors,[],"No browser exceptions");
  console.log("PHASE 4Z FULL-WIDTH PROJECTOR LAYOUT PASSED");
 }finally{await projectorCtx.close();await teacherCtx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
