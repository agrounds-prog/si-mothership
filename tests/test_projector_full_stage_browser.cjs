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
  // Native rendering of a public game. No private controls or live classroom
  // mutations; the full stage must also work for game/board content.
  await projector.evaluate(()=>{
    const g=FourLine.make(["Blue Crew","Gold Crew"]);
    document.getElementById("sharedContent").innerHTML=FourLine.publicHTML(g,true);
  });
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
  assert.deepEqual(errors,[],"No browser exceptions");
  console.log("PHASE 5A SHARED PROJECTOR CINEMATIC EXPERIENCE PASSED");
 }finally{await projectorCtx.close();await teacherCtx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
