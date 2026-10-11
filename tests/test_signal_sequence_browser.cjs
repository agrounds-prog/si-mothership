/* SIGNAL SEQUENCE in Mothership Activity Library — isolated local browser regression. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const base=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on("pageerror",err=>errors.push(String(err)));
 page.on("dialog",async d=>{if(d.type()==="prompt")await d.accept("Signal Sequence Browser Test");else await d.accept()});
 try{
  assert.equal((await page.request.post(base+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(base+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>!!window.SignalSequence&&!!window.__signalSequenceBridge,{timeout:15000});
  assert.equal(await page.locator('script[src^="/signal-sequence.js"]').count(),1);
  assert.equal(await page.locator('link[href^="/signal-sequence.css"]').count(),1);
  await page.evaluate(()=>{state.activityRun=null;state.screen="classroom";state.ended=false;state.activeApp=null;render()});
  await page.locator('#teacherControlBar [data-control="activities"]').click();
  const card=page.locator("#activitiesPanel .ss-library-card");
  assert.equal(await card.count(),1);await card.locator(".ss-open").click();
  await page.waitForSelector("#ssLaunch");
  // Old classroom snapshots did not include SIGNAL SEQUENCE. A fresh render
  // must re-register it without touching the selected setup screen.
  await page.evaluate(()=>{state.activities=state.activities.filter(a=>a.id!=="signal-sequence-game");render()});
  assert.equal(await page.evaluate(()=>state.activities.filter(a=>a.id==="signal-sequence-game").length),1);
  assert.equal(await page.locator("#ssLaunch").count(),1);
  await page.locator("#ssPilot").selectOption("Teacher");
  await page.locator("#ssLaunch").click();
  await page.waitForFunction(()=>state.activityRun?.activityId==="signal-sequence-game"&&!!document.querySelector("#activityControllerPanel .ss-console"),{timeout:12000});
  // Recreate the missing-registry state that previously caused "Prototype
  // error" in renderRosterAlert after a remote classroom hydration.
  await page.evaluate(()=>{state.activities=state.activities.filter(a=>a.id!=="signal-sequence-game");render()});
  assert.equal(await page.evaluate(()=>state.activities.filter(a=>a.id==="signal-sequence-game").length),1);
  assert.equal(await page.locator("#bootError").evaluate(el=>getComputedStyle(el).display==="none"),true);
  assert.equal(await page.locator("#activityControllerPanel .ss-console").count(),1);
  assert.equal(await page.locator("#sharedContent .ss-pad").count(),4);
  assert.equal(await page.locator("#mirrorContent .ss-pad").count(),4);
  assert.equal(await page.locator("#sharedContent [data-ss-press]").count(),0);
  await page.locator('#activityControllerPanel [data-ss-action="next"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun.signalSequence.phase),"watch");
  const signal=await page.evaluate(()=>state.activityRun.signalSequence.sequence[0]);
  await page.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="input",{timeout:10000});
  await page.locator('#activityControllerPanel [data-ss-press="'+signal+'"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun.signalSequence.phase),"success");
  assert.equal(await page.evaluate(()=>state.activityRun.signalSequence.best),1);
  await page.locator('#activityControllerPanel [data-ss-action="save"]').click();
  assert.ok(await page.evaluate(()=>SignalSequence.readLibrary().some(x=>x.name==="Signal Sequence Browser Test")));
  for(const [width,height] of [[1280,720],[768,1024],[430,960]]){
   await page.setViewportSize({width,height});
   const result=await page.evaluate(()=>{
    const host=document.createElement("div");host.style.cssText="position:fixed;inset:0;overflow:auto;padding:8px;box-sizing:border-box;z-index:999999";
    host.innerHTML=SignalSequence.sharedHTML(state.activityRun.signalSequence,true);document.body.appendChild(host);
    const over=host.scrollWidth-host.clientWidth,segments=host.querySelectorAll(".ss-pad").length,room=host.clientWidth;host.remove();return {over,segments,room};
   });
   assert.ok(result.over<=5,JSON.stringify({width,...result}));
   assert.equal(result.segments,4);
  }
  // Browser restarts while a game is live must not bootstrap into the generic
  // Prototype error overlay, even if local storage predates the new activity.
  await page.evaluate(()=>{
    const key="siMothership.session.network.v42";
    const snap=JSON.parse(localStorage.getItem(key)||"{}");
    if(snap.activityRun?.activityId==="signal-sequence-game"){
      snap.activities=(snap.activities||[]).filter(a=>a.id!=="signal-sequence-game");
      localStorage.setItem(key,JSON.stringify(snap));
    }
  });
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.__signalSequenceBridge,{timeout:12000});
  assert.equal(await page.locator("#bootError").evaluate(el=>getComputedStyle(el).display==="none"),true);
  assert.equal(await page.evaluate(()=>state.activities.some(a=>a.id==="signal-sequence-game")),true);
  assert.deepEqual(errors,[]);
  console.log("SIGNAL SEQUENCE browser startup, playback, scoring, save and projector passed");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
