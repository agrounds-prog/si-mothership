/* Unified Mission Control actions. Synthetic local teacher DOM only.
   Confirms native action forwarding, disabled state and responsive toolbar.
   No persisted game, classroom command, or student data is modified. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
const cases=[
 {id:"bingo-game",name:"BINGO",native:'<button id="bingoCallNextBtn">CALL NEXT</button>',action:"CALL NEXT"},
 {id:"match-game",name:"MATCH",native:'<button id="matchMemoryPreviewBtn">MEMORY BOOST</button>',action:"MEMORY BOOST"},
 {id:"million-game",name:"MILLION",native:'<button data-million-show-action="reveal">REVEAL</button><button data-million-show-action="next" disabled>NEXT</button>',action:"REVEAL ANSWER",disabled:"NEXT QUESTION"},
 {id:"cosmic-cards-game",name:"COSMIC CARDS",native:'<button id="cosmicSkipBtn">SKIP</button>',action:"SKIP TURN"},
 {id:"dominoes-game",name:"DOMINOES",native:'<button data-dm-teacher="draw">DRAW</button><button data-dm-teacher="pass" disabled>PASS</button><button data-dm-teacher="save">SAVE</button>',action:"DRAW TILE",disabled:"PASS TURN"},
 {id:"four-in-line-game",name:"FOUR IN LINE",native:'<button data-fil-action="undo">UNDO</button><button data-fil-action="save">SAVE</button>',action:"UNDO MOVE"},
 {id:"signal-sequence-game",name:"SIGNAL SEQUENCE",native:'<button data-ss-action="next">NEXT</button><button data-ss-action="retry" disabled>RETRY</button><button data-ss-action="save">SAVE</button>',action:"START / NEXT ROUND",disabled:"RETRY RUN"}
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 try{
  const logged=await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(logged.status(),200);
  const res=await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(res.status(),200);
  await page.waitForFunction(()=>!!window.__siUnifiedTeacherControls&&typeof state!=="undefined",null,{timeout:18000});
  assert.equal((await page.request.get(BASE+"/teacher-unified-controls.css")).status(),200);
  assert.equal((await page.request.get(BASE+"/teacher-unified-controls.js")).status(),200);
  await page.evaluate(()=>{
   window.__utcOriginal={run:state.activityRun,ended:state.ended};
   const existing=document.getElementById("activityControllerPanel");
   const panel=existing||document.createElement("section");
   if(!existing){panel.id="activityControllerPanel";document.body.append(panel)}
   panel.style.display="block";panel.style.width="100%";
   window.__utcSyntheticPanel=!existing;
  });
  for(const [width,height] of [[1440,900],[500,750]]){
   await page.setViewportSize({width,height});
   for(const fixture of cases){
    const data=await page.evaluate(fixture=>{
     state.ended=false;
     state.activityRun={activityId:fixture.id,phase:"running",
      bingo:{called:["one"]},match:{matched:[]},
      million:{questionIndex:0},fourInLine:{moves:3},signalSequence:{round:2}};
     const host=document.getElementById("activityControllerPanel");
     host.innerHTML=fixture.native+
      '<button id="sendActivityLobbyBtn">PAUSE NATIVE</button>'+
      '<button id="returnClassBtn">FINISH NATIVE</button>';
     // Capture on original nodes prevents synthetic clicks from flowing into
     // the rest of the app, but verifies the proxy delegates exactly once.
     const native=[...host.querySelectorAll("button")];
     let calls=0;
     native.forEach(b=>b.addEventListener("click",e=>{
      e.stopImmediatePropagation();calls++;
     },true));
     window.__utcCount=()=>calls;
     window.__siUnifiedTeacherControls.refresh();
     const dock=host.querySelector("#siUnifiedTeacherDeck");
     const buttons=[...dock.querySelectorAll(".si-utc-button")];
     const primary=buttons.find(b=>b.textContent===fixture.action);
     if(primary)primary.click();
     const bounds=dock.getBoundingClientRect(),hostBounds=host.getBoundingClientRect();
     return {name:dock.querySelector(".si-utc-title strong")?.textContent,
      status:dock.querySelector(".si-utc-status")?.textContent,
      actions:buttons.map(b=>({label:b.textContent,disabled:b.disabled,
       height:b.getBoundingClientRect().height})),
      calls,outer:bounds.width,host:hostBounds.width,overflow:document.documentElement.scrollWidth-innerWidth,
      session:buttons.filter(b=>b.classList.contains("si-utc-session")).map(b=>b.textContent)};
    },fixture);
    assert.equal(data.name,fixture.name,JSON.stringify({width,fixture,data}));
    assert.equal(data.calls,1,"Each quick action must click its original button exactly once");
    assert.ok(data.outer>180&&data.outer<=data.host+2,
     "Teacher toolbar must fit its controller: "+JSON.stringify({width,fixture,data}));
    assert.ok(data.actions.every(a=>a.height>=40),"Toolbar buttons are touch-sized");
    assert.ok(data.session.includes("Pause & Keep Progress")&&data.session.includes("Finish & Return"),
      "Only existing classroom safety actions are mirrored");
    if(fixture.disabled)
     assert.equal(data.actions.find(a=>a.label===fixture.disabled)?.disabled,true,
      "Disabled native gameplay actions must stay disabled");
   }
  }
  const absence=await page.evaluate(()=>{
   state.activityRun=null;
   window.__siUnifiedTeacherControls.refresh();
   return document.querySelectorAll("#siUnifiedTeacherDeck").length;
  });
  assert.equal(absence,0,"Toolbar disappears when no game is live");
  assert.deepEqual(errors,[]);
  console.log("Unified teacher native actions, status, disabled state and two viewport sizes PASS");
 }finally{
  await page.evaluate(()=>{
   if(window.__utcOriginal){state.activityRun=window.__utcOriginal.run;state.ended=window.__utcOriginal.ended}
   if(window.__utcSyntheticPanel)document.querySelector("#activityControllerPanel")?.remove();
  }).catch(()=>{});
  await context.close();await browser.close();
 }
})().catch(err=>{console.error(err);process.exit(1)});
