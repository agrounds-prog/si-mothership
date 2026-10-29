/* Phase 5A — isolated Chromium regression for cinematic full-width projector.
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
  async function checkCinematicScene(kind){
   for(const [width,height] of sizes){
    await projector.setViewportSize({width,height});
    const x=await projector.evaluate(kind=>{
     const stage=document.getElementById("sharedContent");
     const panel=kind==="lobby"?stage.querySelector(":scope > .join-lobby"):
       stage.querySelector(":scope > div:has(> .eyebrow)");
     const title=panel?.querySelector("h3");
     const b=panel?.getBoundingClientRect();
     const background=getComputedStyle(stage).backgroundImage;
     return {panel:!!panel,title:title?.textContent,
       width:innerWidth,height:innerHeight,
       left:b?.left,right:b?.right,top:b?.top,bottom:b?.bottom,
       panelWidth:b?.width,panelHeight:b?.height,
       backdrop:background,rounded:parseFloat(getComputedStyle(panel).borderTopLeftRadius),
       overflow:document.documentElement.scrollWidth-innerWidth,
       joinLinks:stage.querySelectorAll(".join-qr-link[href],.join-url a[href]").length,
       qr:stage.querySelector(".join-qr")?.getBoundingClientRect().width||0,
       standbyHeading:kind!=="lobby"?getComputedStyle(title).fontSize:null,
       ornaments:kind!=="lobby"?getComputedStyle(panel,"::before").content:null};
    },kind);
    console.log("PHASE 5A "+kind+" "+width+"x"+height,JSON.stringify(x));
    assert.ok(x.panel,"Cinematic "+kind+" surface exists");
    assert.ok(x.backdrop.includes("gradient"),"Projector has cinematic background");
    assert.ok(x.left>=-2&&x.right<=width+2,
     kind+" remains within horizontal projector bounds: "+JSON.stringify(x));
    assert.ok(x.top>=-2&&x.bottom<=height+2,
     kind+" remains within vertical projector bounds: "+JSON.stringify(x));
    assert.ok(x.rounded>=18,"Stage gets a distinct softened mission panel");
    assert.ok(x.overflow<=3,"No horizontal scroll in "+kind);
    if(kind==="lobby"){
      assert.equal(x.joinLinks,2,"Join QR and student link remain functional");
      assert.ok(x.qr>=145,"QR remains readable at "+width);
    }else{
      assert.match(x.title,/ACTIVITIES/);
      assert.ok(parseFloat(x.standbyHeading)>=52,"Cinematic transition title stays visible");
      assert.notEqual(x.ornaments,"none","Mission ornament is rendered");
    }
   }
  }
  await checkCinematicScene("lobby");
  await checkFullStage("lobby");
  // Real teacher Activity Library command: projector must stay edge-to-edge.
  await teacher.locator('#teacherControlBar [data-control="activities"]').click();
  await teacher.waitForFunction(()=>state.screen==="activities",null,{timeout:10000});
  await projector.waitForFunction(()=>state.screen==="activities",null,{timeout:13000});
  await checkCinematicScene("activities");
  await checkFullStage("activities");
  await projector.waitForFunction(()=>window.__siActivityCinema &&
    !!document.querySelector("#sharedContent .si-cinema-hud"),null,{timeout:7000});
  const animated=await projector.evaluate(()=>{
    const card=document.querySelector("#sharedContent .si-cinema-activities"),
      hud=card?.querySelector(".si-cinema-hud"),
      orbit=card?.querySelector(".si-cinema-orbit");
    return {installed:window.__siActivityCinemaInstalled,scene:window.__siActivityCinema.stageKind(),
      statusCount:hud?.children.length,orbit:!!orbit,
      spin:getComputedStyle(orbit,"::before").animationName,
      nativeTitle:card?.querySelector("h3")?.textContent,
      teacherScoped:document.querySelector("#teacher")?.querySelector(".si-cinema-activities")?.length||0};
  });
  assert.deepEqual({installed:animated.installed,scene:animated.scene,statusCount:animated.statusCount,
    orbit:animated.orbit,nativeTitle:animated.nativeTitle},
    {installed:true,scene:"activities",statusCount:3,orbit:true,nativeTitle:"ACTIVITIES"});
  assert.match(animated.spin,/si5a2-orbit/,"Radar rings rotate in normal-motion mode");
  assert.equal(await teacher.evaluate(()=>!!window.__siActivityCinemaInstalled),false,
    "Teacher Mission Control must not install projector decorator");
  // Native rendering of a public game. No private controls or live classroom
  // mutations; the full stage must also work for game/board content.
  await projector.evaluate(()=>{
    const g=FourLine.make(["Blue Crew","Gold Crew"]);
    state.activityRun={activityId:"four-in-line-game",phase:"running",
      runToken:"phase5a2-local-projector-fixture",fourInLine:g};
    document.getElementById("sharedContent").innerHTML=FourLine.publicHTML(g,true);
  });
  await projector.locator(".si-cinema-launch").waitFor({state:"attached",timeout:5000});
  const warp=await projector.evaluate(()=>{
    const el=document.querySelector(".si-cinema-launch");
    return {pointerEvents:getComputedStyle(el).pointerEvents,
      ariaHidden:el.getAttribute("aria-hidden"),
      title:el.textContent.trim(),
      animation:getComputedStyle(el).animationName};
  });
  assert.equal(warp.pointerEvents,"none","Launch overlay cannot intercept classroom controls");
  assert.equal(warp.ariaHidden,"true","Decorative transition stays out of screen readers");
  assert.match(warp.title,/MISSION LAUNCH/);
  assert.match(warp.animation,/si5a2-launch-out/);
  await projector.locator(".si-cinema-launch").waitFor({state:"detached",timeout:5000});
  assert.equal(await projector.locator(".si-cinema-launch").count(),0,
    "Brief launch overlay cleans itself up, leaving the actual public game");
  assert.equal(await projector.locator("#sharedContent .fil-cell").count(),42);
  assert.equal(await projector.locator("#sharedContent [data-fil-drop]").count(),0);
  await checkFullStage("four-in-line");
  // Exact SI+ media markup must not inherit standby cards, title layout
  // or the QR treatment. This is a synthetic public slide, not a live lesson.
  await projector.evaluate(()=>{
    const root=document.getElementById("sharedContent");
    root.innerHTML='<div class="si-plus-slide-stage"><div class="presentation-public">'+
      '<div class="presentation-media-stack"><img alt="Sample slide" width="640" height="360"></div>'+
      '</div></div>';
  });
  await projector.setViewportSize({width:1280,height:720});
  const slide=await projector.evaluate(()=>{
    const stage=document.getElementById("sharedContent"),card=stage.querySelector(".si-plus-slide-stage");
    return {width:stage.getBoundingClientRect().width,
      standbyCard:!!stage.querySelector(":scope > div:has(> .eyebrow)"),
      stylesheet: getComputedStyle(stage).backgroundImage,
      slide:!!card,
      sideHud:getComputedStyle(document.querySelector("#shared .mirror-top")).display};
  });
  assert.equal(slide.standbyCard,false,"SI+ never becomes a standby card");
  assert.equal(slide.slide,true);
  assert.equal(slide.sideHud,"none");
  assert.ok(slide.width>=1279,"SI+ keeps full projector width");
  await projector.emulateMedia({reducedMotion:"reduce"});
  await projector.evaluate(()=>{
    document.getElementById("sharedContent").innerHTML=
      '<div><span class="eyebrow">CLASSROOM LIVE</span><h3>ACTIVITIES</h3></div>';
  });
  const reduced=await projector.evaluate(()=>{
    const card=document.querySelector("#sharedContent > div:has(> .eyebrow)");
    return card?getComputedStyle(card).animationName:null;
  });
  assert.equal(reduced,"none","Reduced-motion projector users see no entrance animation");
  const reducedCard=await projector.evaluate(()=>{
    const hud=document.querySelector("#sharedContent .si-cinema-hud");
    const orbit=document.querySelector("#sharedContent .si-cinema-orbit");
    return {hud:!!hud,orbit:!!orbit,
      spin:orbit?getComputedStyle(orbit,"::before").animationName:null,
      pulse:hud?getComputedStyle(hud.querySelector("i")).animationName:null};
  });
  assert.equal(reducedCard.hud,true);
  assert.equal(reducedCard.orbit,true);
  assert.equal(reducedCard.spin,"none","Reduced-motion disables orbital spinning");
  assert.equal(reducedCard.pulse,"none","Reduced-motion disables status pulsing");
  await projector.evaluate(()=>{
    const g=FourLine.make(["Blue Crew","Gold Crew"]);
    state.activityRun={activityId:"four-in-line-game",phase:"running",
      runToken:"phase5a2-reduced-fixture",fourInLine:g};
    document.getElementById("sharedContent").innerHTML=FourLine.publicHTML(g,true);
  });
  assert.equal(await projector.locator(".si-cinema-launch").count(),0,
    "Reduced-motion preference prevents launch flash");
  assert.equal(await projector.locator("#sharedContent .fil-cell").count(),42,
    "Reduced motion never replaces game content");
  assert.deepEqual(errors,[],"No browser exceptions");
  console.log("PHASE 5A-2 ANIMATED PROJECTOR ACTIVITIES AND SAFE GAME LAUNCH PASSED");
 }finally{await projectorCtx.close();await teacherCtx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
