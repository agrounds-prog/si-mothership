/* Game Setup Studio integration regression; isolated localhost classroom ONLY.
   Confirms existing builders, inputs and launch buttons are preserved. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error("Setup regression must not touch a production classroom");
const cases=[
 ["bingo",".bbs-studio","#bbsSaveLaunch"],
 ["match",".mcb-shell","#matchSetName"],
 ["million",".ms-studio","#msName"],
 ["cosmic-cards",".cc-setup","#cosmicLaunchBtn"],
 ["dominoes",".dm-setup","#dmStart"],
 ["word-grid",".wg-setup","#wgStart"],
 ["minefield",".minefield-setup","#launchMinefieldBtn"],
 ["crew-survey",".crew-survey-setup","#launchCrewSurveyBtn"],
 ["scientific-calculator",".calculator-setup-panel","#openCalculatorSelfBtn"],
 ["four-in-line",".fil-setup","#filLaunch"],
 ["signal-sequence",".ss-setup","#ssLaunch"]
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1440,height:950}});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e.stack||e)));
 try{
  assert.equal((await context.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await page.waitForFunction(()=>typeof renderActivities==="function" &&
   window.__siUnifiedTeacherControls?.version==="2E" &&
   networkHydrated===true,null,{timeout:25000});
  await page.evaluate(()=>{
   window.__setupOriginal={screen:state.screen,activeApp:state.activeApp,
    assigningSlot:state.assigningSlot,activityRun:state.activityRun};
   state.screen="activities";state.assigningSlot=null;state.activityRun=null;
   document.querySelector('#activitiesPanel').classList.remove("hidden");
  });
  for(const [width,height] of [[1440,950],[500,790]]){
   await page.setViewportSize({width,height});
   for(const [app,selector,control] of cases){
    const result=await page.evaluate(({app,selector,control})=>{
     const grid=document.querySelector('#activityGrid'),panel=document.querySelector('#activitiesPanel');
     state.activeApp=app;state.activityRun=null;state.assigningSlot=null;
     if(app==="four-in-line"){
      grid.innerHTML=FourLine.setupHTML(["Alex","Blair"]);
     }else if(app==="signal-sequence"){
      grid.innerHTML=SignalSequence.setupHTML(["Alex","Blair"]);
     }else renderActivities();
     const original=grid.querySelector(control);
     if(!original)throw Error('Missing native control '+control+' in '+app);
     const onchange=original.onchange,onclick=original.onclick;
     window.__siUnifiedTeacherControls.syncSetup();
     window.__siUnifiedTeacherControls.syncSetup();
     const guide=panel.querySelector("#siGameSetupGuide");
     const container=grid.querySelector(selector);
     const steps=[...guide?.querySelectorAll('ol > li')||[]].map(x=>x.textContent.trim());
     const rect=guide?.getBoundingClientRect();
     return {
      game:guide?.dataset.siSetupApp,heading:guide?.querySelector('h3')?.textContent,
      stages:steps.length,guideCount:panel.querySelectorAll('#siGameSetupGuide').length,
      block:getComputedStyle(grid).display,
      overflow:guide?guide.scrollWidth-guide.clientWidth:999,
      fit:rect?rect.width<=panel.getBoundingClientRect().width+2:false,
      inputSame:grid.querySelector(control)===original,
      handlersSame:original.onclick===onclick&&original.onchange===onchange,
      gameSame:!!container,
      originalControlVisible:original.getClientRects().length>0
     };
    },{app,selector,control});
    assert.equal(result.game,app,JSON.stringify({width,result}));
    assert.equal(result.guideCount,1,JSON.stringify({width,result}));
    assert.equal(result.stages,3,JSON.stringify({width,result}));
    assert.equal(result.block,"block",JSON.stringify({width,result}));
    assert.ok(result.gameSame&&result.inputSame&&result.handlersSame,
     'Game setup must preserve all original inputs and handlers: '+JSON.stringify({width,result}));
    assert.ok(result.overflow<=3&&result.fit,
     'Setup guide must fit modal width: '+JSON.stringify({width,result}));
    assert.ok(result.originalControlVisible,
     'Native game controls must remain visible: '+JSON.stringify({width,result}));
   }
  }
  const cleaned=await page.evaluate(()=>{
   state.activeApp=null;document.querySelector('#activityGrid').replaceChildren();
   window.__siUnifiedTeacherControls.syncSetup();
   return {banner:document.querySelectorAll('#siGameSetupGuide').length,
    hasSetupClass:document.querySelector('#activitiesPanel').classList.contains('si-setup-view')};
  });
  assert.deepEqual(cleaned,{banner:0,hasSetupClass:false});
  assert.deepEqual(errors,[]);
  console.log("Teacher game setup studio: 11 game builders, native controls, two widths, cleanup PASS");
 }finally{
  await page.evaluate(()=>{
   const prev=window.__setupOriginal;
   if(prev){state.screen=prev.screen;state.activeApp=prev.activeApp;
    state.assigningSlot=prev.assigningSlot;state.activityRun=prev.activityRun;
    renderActivities();window.__siUnifiedTeacherControls?.syncSetup()}
  }).catch(()=>{});
  await context.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
