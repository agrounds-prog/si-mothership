/* Reproduce SI+ bouncing slides from stale teacher/shared-screen packets.
 * All data remains on a fresh localhost classroom, never production. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(BASE))
  throw Error('SI+ slide synchronization tests require localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1400,height:900}});
 const teacher=await ctx.newPage(),projector=await ctx.newPage(),errors=[];
 for(const pg of [teacher,projector])pg.on('pageerror',e=>errors.push(String(e.stack||e)));
 try{
  const login=await ctx.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}});
  assert.equal(login.status(),200);
  await teacher.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
  await teacher.waitForFunction(()=>networkHydrated&&typeof changeSlide==='function'&&
   window.SIPlusLiveNavigation&&networkSocket?.readyState===WebSocket.OPEN,null,{timeout:20000});
  const sid=await teacher.evaluate(()=>STUDENT_SESSION_ID);
  const id='si-navigation-stale-echo-regression';
  await teacher.evaluate(id=>{
   const slides=Array.from({length:5},(_,i)=>({
    id:'stable'+i,type:'instruction',title:'Stable Slide '+(i+1),
    listTitle:'Stable Slide '+(i+1),text:'Keep this slide visible '+i,image:'',youtube:''
   }));
   state.activities.push({id,type:'presentation',name:'Navigation Stale Echo',
    deckTitle:'Navigation Stale Echo',slides,userCreated:true});
   state.activityRun={activityId:id,runToken:'si-stable-echo-run',
    phase:'running',slideIndex:0,siPlusNavRevision:0,
    responses:{},showResults:false,revealAnswer:false};
   state.screen='activity';render();
  },id);
  await projector.goto(BASE+'/?role=shared&sid='+encodeURIComponent(sid),{waitUntil:'domcontentloaded'});
  await projector.waitForFunction(id=>networkHydrated&&state.activityRun?.activityId===id&&
   state.activityRun.slideIndex===0,id,{timeout:20000});
  const stale=await projector.evaluate(()=>sharedStateSnapshot());
  assert.equal(stale.activityRun.siPlusNavRevision,0);
  // Normal teacher button, both windows must advance exactly once.
  await teacher.locator('#nextSlideBtn').click();
  await teacher.waitForFunction(()=>state.activityRun?.slideIndex===1&&state.activityRun.siPlusNavRevision===1);
  await projector.waitForFunction(()=>state.activityRun?.slideIndex===1&&
   state.activityRun.siPlusNavRevision===1,null,{timeout:12000});
  const displayed=async()=>projector.evaluate(()=>({
    index:state.activityRun?.slideIndex,revision:state.activityRun?.siPlusNavRevision,
    text:document.querySelector('#sharedContent')?.textContent||''
  }));
  assert.match((await displayed()).text,/Stable Slide 2/);
  // A lagging projector can emit an old BroadcastChannel/storage snapshot.
  // Neither may change the current teacher or projected slide.
  await projector.evaluate(snapshot=>{
   const channel=new BroadcastChannel('si-mothership-v42-session');
   channel.postMessage({type:'state',state:snapshot,at:Date.now()});
   channel.close();
   localStorage.setItem('siMothership.session.network.v42',JSON.stringify(snapshot));
  },stale);
  await teacher.waitForTimeout(250);
  assert.deepEqual(await teacher.evaluate(()=>[state.activityRun.slideIndex,state.activityRun.siPlusNavRevision]),[1,1]);
  assert.deepEqual(await projector.evaluate(()=>[state.activityRun.slideIndex,state.activityRun.siPlusNavRevision]),[1,1]);
  // A second teacher tab sending a delayed whole-state packet must be refused
  // at the server, even if its socket is authenticated as teacher.
  await teacher.evaluate(snapshot=>networkSocket.send(JSON.stringify({
   type:'state',role:'teacher',state:snapshot
  })),stale);
  await teacher.waitForTimeout(400);
  assert.deepEqual(await teacher.evaluate(()=>[state.activityRun.slideIndex,state.activityRun.siPlusNavRevision]),[1,1]);
  assert.equal((await displayed()).index,1);
  // Next, Previous, and direct Jump are all deliberate teacher changes;
  // the revision moves forward even when the slide number moves backward.
  await teacher.locator('#nextSlideBtn').click();
  await projector.waitForFunction(()=>state.activityRun?.slideIndex===2&&
    state.activityRun.siPlusNavRevision===2,null,{timeout:12000});
  const prevSnapshot=await teacher.evaluate(()=>sharedStateSnapshot());
  await teacher.locator('#prevSlideBtn').click();
  await projector.waitForFunction(()=>state.activityRun?.slideIndex===1&&
    state.activityRun.siPlusNavRevision===3,null,{timeout:12000});
  await teacher.locator('#siPlusSlideJump').selectOption('4');
  await projector.waitForFunction(()=>state.activityRun?.slideIndex===4&&
    state.activityRun.siPlusNavRevision===4,null,{timeout:12000});
  // Both a lower revision and a same-revision conflicting slide are stale.
  await teacher.evaluate(old=>networkSocket.send(JSON.stringify({
   type:'state',role:'teacher',state:old
  })),prevSnapshot);
  const equalConflict=await teacher.evaluate(()=>{
   const snapshot=sharedStateSnapshot();
   snapshot.activityRun.slideIndex=2;
   return snapshot;
  });
  await teacher.evaluate(old=>networkSocket.send(JSON.stringify({
   type:'state',role:'teacher',state:old
  })),equalConflict);
  await teacher.waitForTimeout(350);
  assert.deepEqual(await teacher.evaluate(()=>[state.activityRun.slideIndex,state.activityRun.siPlusNavRevision]),[4,4]);
  assert.deepEqual(await projector.evaluate(()=>[state.activityRun.slideIndex,state.activityRun.siPlusNavRevision]),[4,4]);
  assert.match((await displayed()).text,/Stable Slide 5/);
  // The server must also retain slide 5: a newly connected projector should
  // restore the latest canonical slide rather than the stale one.
  await projector.reload({waitUntil:'domcontentloaded'});
  await projector.waitForFunction(()=>networkHydrated&&state.activityRun?.slideIndex===4&&
   state.activityRun.siPlusNavRevision===4,null,{timeout:15000});
  assert.match((await displayed()).text,/Stable Slide 5/);
  assert.deepEqual(errors,[]);
  console.log('PASS: SI+ Next/Previous/Jump and stale teacher, storage, projector, WebSocket, and reload packets');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
