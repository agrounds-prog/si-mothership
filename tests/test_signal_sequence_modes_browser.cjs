/* SIGNAL SEQUENCE Phase 2: two real student devices, survival, relay, privacy */
const assert=require("node:assert/strict"),{chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:1440,height:900}}),teacher=await ctx.newPage(),errors=[];
 teacher.on("pageerror",e=>errors.push("teacher: "+e));
 const clients=[];
 try{
  assert.equal((await teacher.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  // The previous mobile test uses this same isolated CI server. Reset the
  // local session so the survival/relay checks never inherit a live game.
  assert.equal((await teacher.request.post(BASE+"/api/session/new",{data:{}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>window.__signalSequenceBridge&&networkHydrated===true,null,{timeout:15000});
  await teacher.evaluate(()=>{
   state.activityRun=null;state.ended=false;state.screen="activities";state.activeApp=null;
   state.students=[{n:"Nova",studentToken:"ss-nova-123",c:"#18cfee",offline:false},
    {n:"Orbit",studentToken:"ss-orbit-123",c:"#f2be66",offline:false}];render();
  });
  const join=await teacher.evaluate(()=>({code:STUDENT_JOIN_CODE,sid:STUDENT_SESSION_ID}));
  for(const [name,token] of [["Nova","ss-nova-123"],["Orbit","ss-orbit-123"]]){
   const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await c.addInitScript(({code,sid,name,token})=>localStorage.setItem("siMothership.studentIdentity.v42",JSON.stringify({code,sessionId:sid,studentToken:token,name})),{...join,name,token});
   const p=await c.newPage();p.on("pageerror",e=>errors.push(name+": "+e));
   await p.goto(BASE+"/?role=student&code="+encodeURIComponent(join.code)+"&sid="+encodeURIComponent(join.sid),{waitUntil:"domcontentloaded",timeout:40000});
   await p.waitForFunction(name=>state.selectedStudent===name&&networkSocket?.readyState===WebSocket.OPEN,name,{timeout:15000});
   clients.push({name,page:p,context:c});
  }
  const nova=clients[0].page,orbit=clients[1].page;
  async function setup(mode,count){
   await teacher.evaluate(()=>{state.activityRun=null;state.screen="activities";state.activeApp=null;render()});
   await teacher.locator("#activitiesPanel .ss-library-card .ss-open").click();
   await teacher.locator("#ssMode").selectOption(mode);
   await teacher.locator("#ssSignals").selectOption(String(count));
   await teacher.locator("#ssSpeed").selectOption("fast");
   assert.equal(await teacher.locator("[data-ss-member]:checked").count(),2);
   await teacher.locator("#ssLaunch").click();
   await teacher.waitForFunction(mode=>state.activityRun?.signalSequence?.mode===mode,mode,{timeout:12000});
   for(const {page} of clients)await page.waitForFunction(mode=>state.activityRun?.signalSequence?.mode===mode,mode,{timeout:12000});
  }
  await setup("survival",6);
  assert.equal(await nova.locator("#studentContent .ss-pad").count(),6);
  assert.equal(await orbit.locator("#studentContent .ss-pad").count(),6);
  await teacher.locator('[data-ss-action="next"]').click();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="input",null,{timeout:12000});
  for(const {page} of clients)await page.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="input"&&document.querySelectorAll("#studentContent .ss-touch-key").length===6,null,{timeout:12000});
  // Six colors / Survival in a desktop-sized Zoom companion window.
  for(const {page} of clients){
    await page.setViewportSize({width:440,height:760});
    const ui=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-innerWidth,
      ring:document.querySelector("#studentContent .ss-donut")?.getBoundingClientRect().width,
      keys:[...document.querySelectorAll("#studentContent .ss-touch-key")].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))
    }));
    assert.ok(ui.overflow<=2&&ui.ring>=120&&ui.keys.length===6&&ui.keys.every(k=>k.h>=44&&k.w>=65),JSON.stringify(ui));
  }
  const answer=await teacher.evaluate(()=>state.activityRun.signalSequence.sequence[0]);
  await nova.locator('#studentContent .ss-touch-key[data-ss-press="'+answer+'"]').tap();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.entries?.Nova?.status==="cleared",null,{timeout:12000});
  await orbit.locator('#studentContent .ss-touch-key[data-ss-press="'+((answer+1)%6)+'"]').tap();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="success",null,{timeout:12000});
  assert.equal(await teacher.evaluate(()=>state.activityRun.signalSequence.entries.Orbit.status),"out");
  assert.equal(await orbit.locator("#studentContent [data-ss-press]").count(),0);
  assert.equal(await nova.evaluate(()=>state.activityRun.signalSequence.sequence.length),0,"answer redacted during input");
  assert.equal(await nova.evaluate(()=>state.activityRun.signalSequence.entries.Orbit.progress),undefined,"other student's progress private");
  await teacher.locator('[data-ss-action="next"]').click();
  await nova.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="watch",null,{timeout:12000});
  assert.equal(await orbit.locator("#studentContent [data-ss-press]").count(),0);
  // Stop survival after demonstrating elimination persistence.
  await setup("relay",8);
  assert.equal(await nova.locator("#studentContent .ss-pad").count(),8);
  await teacher.locator('[data-ss-action="next"]').click();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="input",null,{timeout:12000});
  await nova.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="input",null,{timeout:12000});
  // Eight colors / Team Relay: check pilot's complete pad layout.
  const ui8=await nova.evaluate(()=>({
    overflow:document.documentElement.scrollWidth-innerWidth,
    keys:[...document.querySelectorAll("#studentContent .ss-touch-key")].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))
  }));
  assert.ok(ui8.overflow<=2&&ui8.keys.length===8&&ui8.keys.every(k=>k.h>=44&&k.w>=65),JSON.stringify(ui8));
  const one=await teacher.evaluate(()=>state.activityRun.signalSequence.sequence[0]);
  await nova.locator('#studentContent .ss-touch-key[data-ss-press="'+one+'"]').tap();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="success",null,{timeout:12000});
  await teacher.locator('[data-ss-action="next"]').click();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="input",null,{timeout:12000});
  await nova.waitForFunction(()=>document.querySelectorAll("#studentContent .ss-touch-key").length===8,null,{timeout:12000});
  const sequence=await teacher.evaluate(()=>state.activityRun.signalSequence.sequence.slice());
  await nova.locator('#studentContent .ss-touch-key[data-ss-press="'+sequence[0]+'"]').tap();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.pilot==="Orbit"&&state.activityRun?.signalSequence?.progress===1,null,{timeout:12000});
  await orbit.waitForFunction(()=>document.querySelectorAll("#studentContent .ss-touch-key").length===8,null,{timeout:12000});
  assert.equal(await nova.locator("#studentContent [data-ss-press]").count(),0,"first pilot locked after pass");
  await orbit.locator('#studentContent .ss-touch-key[data-ss-press="'+sequence[1]+'"]').tap();
  await teacher.waitForFunction(()=>state.activityRun?.signalSequence?.phase==="success",null,{timeout:12000});
  assert.deepEqual(errors,[]);
  console.log("SIGNAL SEQUENCE Phase 2: 6-color survival, elimination, 8-color relay, two mobile students PASSED");
 }finally{for(const c of clients)await c.context.close();await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
