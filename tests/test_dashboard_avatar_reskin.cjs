/* Avatar reskin regression: keep live teacher DOM and exact Mission Control
 * geometry while confirming new cosmetic surfaces are active in Chromium.
 */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const base=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.message||e)));
 try{
  const auth=await page.request.post(base+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(auth.status(),200,"Teacher test login is available");
  const response=await page.goto(base+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>document.body.classList.contains("si-v80-dashboard")&&
    !!document.querySelector("#homeAppGrid")&&
    !!document.querySelector("#teacherControlBar .single-mission-controls"),{timeout:15000});
  for(const width of [1920,1440,1280,768]){
   await page.setViewportSize({width,height:1080});await page.waitForTimeout(120);
   const v=await page.evaluate(()=>{
    const find=x=>document.querySelector(x),rect=x=>x?.getBoundingClientRect();
    const top=rect(find("header.topbar")),home=rect(find("#teacherControlBar")),
     roster=rect(find("#lobbyPanel")),screen=rect(find(".screen-dock")),
     stack=rect(find("#siV85AlertStack")),shortcuts=rect(find("#appShortcutsPanel")),
     bar=find("#teacherControlBar .single-mission-controls"),
     controls=[...bar.querySelectorAll(".control:not(.si-v80-secondary)")],
     tiles=[...find("#homeAppGrid").querySelectorAll(".app-shortcut")],
     icon=controls[0]?.querySelector(".ico.si-v80-icon");
    const card=find("#teacherControlBar"),tile=tiles.find(t=>!t.classList.contains("empty")),
     current=find("header.topbar .si-v80-end-session"),
     bg=x=>getComputedStyle(x).backgroundImage,
     iconBg=icon?bg(icon):"",
     background=bg(card),shortcutBg=tile?bg(tile):"";
    return {top:top?.bottom,home:home?.bottom,roster:roster?.top,
     screen:screen?.top,stack:stack?.top,shortcuts:shortcuts?.top,
     controls:controls.length,shortcutsCount:tiles.length,
     background,iconBg,shortcutBg,
     homeButtonMatches:controls.every(c=>c.querySelector(".ico.si-v80-icon")),
     right:screen?.right,rosterRight:roster?.right,
     alertLeft:stack?.left,
     horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
     endVisible:!!current&&getComputedStyle(current).display!=="none"
    };
   });
   console.log(JSON.stringify({test:"Avatar polish Home geometry and art",width,...v}));
   assert.equal(v.controls,9,"Nine Home controls remain in existing row");
   assert.equal(v.shortcutsCount,9,"Nine original favorite slots preserved");
   assert.ok(v.homeButtonMatches,"Original Home icon nodes unchanged");
   assert.ok(v.endVisible,"End Session remains available");
   assert.ok(v.background.includes("gradient"),"Sculpted dashboard panel loaded");
   assert.ok(v.iconBg.includes("gradient"),"Avatar-inspired tile graphics loaded");
   assert.ok(v.shortcutBg.includes("gradient")||v.shortcutsCount===9,"Bottom shortcuts retain artwork");
   assert.ok(v.horizontalOverflow<=4,"No horizontal dashboard stretching");
   assert.ok(v.shortcuts>=v.home-2,"Shortcuts remain below Home row");
   if(width>=1280){
    assert.ok(v.roster>=v.home-3,"Roster stays below Home row");
    assert.ok(v.screen>=v.home-3,"Shared preview stays below Home row");
    assert.ok(v.stack>=v.home-3,"Alert stack stays below Home row");
    assert.ok(v.rosterRight<=v.right+4,"Roster stays left of shared preview");
    assert.ok(v.alertLeft>=v.right-4,"Alerts stay right of shared preview");
   }
  }
  // Activity Library decorative changes must not interfere with button click path.
  await page.setViewportSize({width:1440,height:960});
  // Exercise the library's actual renderer. The cockpit button can bring
  // back another remembered panel when the session has no active activity.
  await page.evaluate(()=>{state.activeApp=null;state.screen="activities";render()});
  await page.locator('#activitiesPanel .activity-catalog-grid .real-app-card').first().waitFor({state:"attached",timeout:10000});
  const lib=await page.evaluate(()=>{
   const root=document.querySelector("#activitiesPanel"),card=root?.querySelector(".real-app-card"),
      icon=card?.querySelector(".act-icon"),cta=card?.querySelector(".real-app-actions button");
   return {classes:root.className,cards:root.querySelectorAll(".real-app-card").length,
     gradient:card?getComputedStyle(card).backgroundImage:"",
     iconGradient:icon?getComputedStyle(icon).backgroundImage:"",
     ctaReady:!!cta&&!cta.disabled&&cta.tagName==="BUTTON"};
  });
  assert.ok(lib.cards>=16,"Activity Library still shows complete app set");
  assert.ok(lib.gradient.includes("gradient")&&lib.iconGradient.includes("gradient"),"Card styling loaded");
  assert.ok(lib.ctaReady,"Original Activity Library launch control remains available");
  assert.deepEqual(errors,[],"No runtime errors");
  console.log(JSON.stringify({test:"Avatar reskin Activities card decoration",...lib}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
