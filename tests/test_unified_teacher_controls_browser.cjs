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
      bingo:{called:["one"],studentCallAlerts:false},
      match:{matched:["a1","a2"],cards:[{id:"a1"},{id:"a2"},{id:"b1"},{id:"b2"}],
       scores:{"Alex":2,"Blair":1},teamScores:{"0":2,"1":3},activeTeam:1},
      matchConfig:{mode:"teams",teamCount:2},
      million:{questionIndex:0,lockedAnswer:"B"},millionConfig:{questions:[{},{}]},
      fourInLine:{moves:3,turn:0,players:["Blue Crew","Gold Crew"],status:"playing"},
      dominoes:{turn:1,players:["Alex","Blair"],status:"playing",bag:[{}],
       scores:{"Alex":4,"Blair":7}},
      cosmic:{turn:1,players:["Alex","Blair"],status:"playing",
       hands:{"Alex":[{},{}],"Blair":[{}]}},
      signalSequence:{round:2,pilot:"Alex",phase:"input",best:1}};
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
     const primary=buttons.find(b=>b.textContent.toUpperCase()===fixture.action.toUpperCase());
     if(primary)primary.click();
     const focus=dock.querySelector(".si-utc-turn");
     const scores=[...dock.querySelectorAll(".si-utc-score")].map(chip=>({
      name:chip.querySelector("small")?.textContent,
      value:chip.querySelector("b")?.textContent,
      active:chip.classList.contains("is-active")
     }));
     const originalScore=state.activityRun.dominoes.scores.Blair;
     state.activityRun.dominoes.scores.Blair=9;
     window.__siUnifiedTeacherControls.refresh();
     const rerendered=host.querySelector("#siUnifiedTeacherDeck");
     const updatedScore=[...rerendered.querySelectorAll(".si-utc-score")]
      .find(chip=>chip.querySelector("small")?.textContent==="Blair")?.querySelector("b")?.textContent;
     state.activityRun.dominoes.scores.Blair=originalScore;
     const bounds=dock.getBoundingClientRect(),hostBounds=host.getBoundingClientRect();
     return {name:dock.querySelector(".si-utc-title strong")?.textContent,
      turn:focus?.querySelector("strong")?.textContent,
      cue:focus?.querySelector("small")?.textContent,
      scores,updatedScore,
      status:dock.querySelector(".si-utc-status")?.textContent,
      actions:[...rerendered.querySelectorAll(".si-utc-button")].map(b=>({
       label:b.textContent,disabled:b.disabled,height:b.getBoundingClientRect().height
      })),
      calls,outer:bounds.width,host:hostBounds.width,overflow:document.documentElement.scrollWidth-innerWidth,
      session:buttons.filter(b=>b.classList.contains("si-utc-session")).map(b=>b.textContent)};
    },fixture);
    assert.equal(data.name,fixture.name,JSON.stringify({width,fixture,data}));
    assert.equal(data.calls,1,"Each quick action must click its original button exactly once");
    assert.ok(data.cue&&data.scores.length>0&&data.scores.every(x=>x.name&&x.value),
      "Teacher must see a live turn/status and score/progress strip: "+JSON.stringify({width,fixture,data}));
    assert.ok(data.turn,"Current player or appropriate classroom state should be visible");
    if(fixture.id==="four-in-line-game"){
      assert.equal(data.turn,"Blue Crew");
      assert.ok(data.scores.some(x=>x.name==="Gold Crew"&&x.value==="WAITING"));
    }
    if(fixture.id==="dominoes-game"){
      assert.equal(data.turn,"Blair");
      assert.ok(data.scores.some(x=>x.name==="Blair"&&x.value==="7 PTS"&&x.active));
      assert.equal(data.updatedScore,"9 PTS","Score changes refresh without gameplay mutations");
    }
    if(fixture.id==="cosmic-cards-game"){
      assert.equal(data.turn,"Blair");
      assert.ok(data.scores.some(x=>x.name==="Alex"&&x.value==="2 CARDS"));
    }
    if(fixture.id==="bingo-game"){
      assert.ok(data.scores.some(x=>x.name==="CALLED"&&x.value==="1"));
      assert.ok(data.scores.some(x=>x.name==="CALL ALERTS"&&x.value==="OFF"));
    }
    if(fixture.id==="match-game"){
      assert.ok(data.scores.some(x=>x.name==="PAIRS"&&x.value==="1 / 2"));
      assert.ok(data.scores.some(x=>x.value==="3 PTS"));
    }
    if(fixture.id==="signal-sequence-game"){
      assert.equal(data.turn,"Alex");
      assert.ok(data.scores.some(x=>x.name==="ROUND"&&x.value==="2"));
    }
    if(fixture.id==="million-game"){
      assert.ok(data.scores.some(x=>x.name==="ANSWER"&&x.value==="LOCKED"));
    }
    assert.ok(data.outer>180&&data.outer<=data.host+2,
     "Teacher toolbar must fit its controller: "+JSON.stringify({width,fixture,data}));
    assert.ok(data.actions.every(a=>a.height>=40),"Toolbar buttons are touch-sized");
    assert.ok(data.session.includes("Pause & Keep Progress")&&data.session.includes("Finish & Return"),
      "Only existing classroom safety actions are mirrored");
    if(fixture.disabled)
     assert.equal(data.actions.find(a=>a.label.toUpperCase()===fixture.disabled.toUpperCase())?.disabled,true,
      "Disabled native gameplay actions must stay disabled");
   }
  }
  // The overlay reflects actual game phases and winners, not placeholder
  // scoring. Synthetic only: these state edits never publish to a classroom.
  const summaries=await page.evaluate(()=>{
   const host=document.querySelector('#activityControllerPanel');
   function inspect(id,phase,data){
    state.activityRun={activityId:id,phase,...data};
    host.innerHTML='<button id="returnClassBtn">RETURN</button>';
    window.__siUnifiedTeacherControls.refresh();
    const dock=host.querySelector('#siUnifiedTeacherDeck');
    return {person:dock.querySelector('.si-utc-turn strong')?.textContent,
     phase:dock.querySelector('.si-utc-turn small')?.textContent,
     status:dock.querySelector('.si-utc-status')?.textContent,
     chips:[...dock.querySelectorAll('.si-utc-score')].map(x=>({
      key:x.querySelector('small')?.textContent,value:x.querySelector('b')?.textContent,
      active:x.classList.contains('is-active')
     }))};
   }
   return {
    waiting:inspect('four-in-line-game','lobby',{fourInLine:{
     status:'playing',turn:1,players:['Blue Crew','Gold Crew'],moves:0,cols:7,rows:6}}),
    win:inspect('four-in-line-game','running',{fourInLine:{
     status:'won',turn:1,players:['Blue Crew','Gold Crew'],winner:0,moves:7}}),
    draw:inspect('four-in-line-game','running',{fourInLine:{
     status:'draw',turn:1,players:['Blue Crew','Gold Crew'],moves:42}}),
    dominoWin:inspect('dominoes-game','running',{dominoes:{
     status:'won',turn:1,players:['Alex','Blair'],winner:'Alex',round:3,
     scores:{Alex:25,Blair:12},bag:[]}}),
    cosmicWin:inspect('cosmic-cards-game','running',{cosmic:{
     status:'won',turn:1,players:['Alex','Blair'],winner:'Blair',
     hands:{Alex:[{},{}],Blair:[]},color:'green',direction:-1}}),
    survival:inspect('signal-sequence-game','running',{signalSequence:{
     phase:'input',mode:'survival',pilot:'THE CREW',round:3,best:2,
     participants:['Alex','Blair','Casey'],
     entries:{Alex:{status:'playing'},Blair:{status:'out'},Casey:{status:'playing'}}}}),
    relay:inspect('signal-sequence-game','running',{signalSequence:{
     phase:'input',mode:'relay',pilot:'Blair',round:5,progress:2,best:4}}),
    bingo:inspect('bingo-game','running',{bingo:{
     called:['i1','i2'],callOrder:['i1','i2','i3'],studentCallAlerts:true}}),
    million:inspect('million-game','running',{million:{
     questionIndex:1,revealed:false,lockedAnswer:''},millionConfig:{questions:[{},{},{}]}})
   };
  });
  assert.equal(summaries.waiting.person,'Waiting for players');
  assert.match(summaries.waiting.phase,/LOBBY/);
  assert.ok(summaries.waiting.chips.every(x=>!x.active),
   'Lobby must not present a live student turn');
  assert.equal(summaries.win.person,'Blue Crew');
  assert.ok(summaries.win.chips.some(x=>x.key==='Blue Crew'&&x.value==='WINNER'&&x.active));
  assert.ok(summaries.win.chips.some(x=>x.key==='Gold Crew'&&x.value==='ROUND OVER'));
  assert.equal(summaries.draw.person,'Draw game');
  assert.ok(summaries.draw.chips.every(x=>!x.active));
  assert.equal(summaries.dominoWin.person,'Alex');
  assert.ok(summaries.dominoWin.chips.some(x=>x.key==='WINNER'&&x.value==='Alex'));
  assert.ok(summaries.dominoWin.chips.some(x=>x.key==='ROUND'&&x.value==='3'));
  assert.equal(summaries.cosmicWin.person,'Blair');
  assert.ok(summaries.cosmicWin.chips.some(x=>x.key==='ACTIVE COLOR'&&x.value==='GREEN'));
  assert.ok(summaries.cosmicWin.chips.some(x=>x.key==='DIRECTION'&&x.value==='COUNTERCLOCKWISE'));
  assert.equal(summaries.survival.person,'THE CREW');
  assert.ok(summaries.survival.chips.some(x=>x.key==='CREW ACTIVE'&&x.value==='2 / 3'));
  assert.ok(summaries.relay.chips.some(x=>x.key==='INPUT'&&x.value==='2 / 5'));
  assert.equal(summaries.relay.person,'Blair');
  assert.ok(summaries.bingo.chips.some(x=>x.key==='TOTAL CALLS'&&x.value==='3'));
  assert.ok(summaries.million.chips.some(x=>x.key==='QUESTION'&&x.value==='2 / 3'));
  // A dormant controller without game-native actions must never retain
  // controls from a previous game.
  const cleared=await page.evaluate(()=>{
    state.activityRun={activityId:'bingo-game',phase:'running',bingo:{called:[]}};
    const host=document.getElementById('activityControllerPanel');
    host.innerHTML='<button id="bingoCallNextBtn">CALL</button>';
    window.__siUnifiedTeacherControls.refresh();
    host.querySelector('#bingoCallNextBtn').remove();
    window.__siUnifiedTeacherControls.refresh();
    return !!host.querySelector('#siUnifiedTeacherDeck');
  });
  assert.equal(cleared,false,'Missing original buttons clear stale teacher shortcuts');
  console.log('Teacher live HUD: lobby, result, relay, survival and all seven game summaries PASS');
  // UI strings must be rendered as text, never parsed as teacher markup.
  const safe=await page.evaluate(()=>{
    state.activityRun={activityId:"four-in-line-game",phase:"running",
     fourInLine:{moves:1,turn:0,status:"playing",players:['<img src=x onerror=alert(1)>',"Other"]}};
    const host=document.getElementById("activityControllerPanel");
    host.innerHTML='<button data-fil-action="save">SAVE</button>';
    window.__siUnifiedTeacherControls.refresh();
    return {content:host.querySelector(".si-utc-turn strong")?.textContent,
      injected:!!host.querySelector(".si-utc-deck img")};
  });
  assert.equal(safe.content,'<img src=x onerror=alert(1)>');
  assert.equal(safe.injected,false,"Student/team names must be displayed safely");
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
