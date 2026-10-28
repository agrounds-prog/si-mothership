/* Phase 4V — teacher HUD and shared projector readability.
   In-memory game fixtures only, Chromium localhost only. Never saves a
   classroom, scores a game or opens the Railway production service. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
if(!/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(BASE))
  throw Error("Phase 4V tests must target an isolated localhost classroom.");
const LONG="The-Classroom-Team-With-A-Really-Long-Unbroken-Display-Name-"+
  "That-Must-Stay-Readable-On-Every-Teacher-And-Shared-Screen";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const teacherCtx=await browser.newContext({viewport:{width:1360,height:900}});
 const sharedCtx=await browser.newContext({viewport:{width:1280,height:720}});
 const teacher=await teacherCtx.newPage(),shared=await sharedCtx.newPage();
 const errors=[];
 teacher.on("pageerror",e=>errors.push("teacher: "+String(e)));
 shared.on("pageerror",e=>errors.push("shared: "+String(e)));
 try{
  assert.equal((await teacherCtx.request.post(BASE+"/api/teacher/login",
   {data:{key:"5030"}})).status(),200);
  assert.equal((await teacher.goto(BASE+"/?role=teacher",
   {waitUntil:"domcontentloaded",timeout:40000})).status(),200);
  await teacher.waitForFunction(()=>!!window.__siUnifiedTeacherControls&&
   !!window.FourLine&&!!window.Dominoes&&
   !!STUDENT_SESSION_ID,{timeout:20000});
  const sid=await teacher.evaluate(()=>STUDENT_SESSION_ID);
  assert.equal((await shared.goto(BASE+"/?role=shared&sid="+encodeURIComponent(sid),
   {waitUntil:"domcontentloaded",timeout:40000})).status(),200);
  await shared.waitForFunction(()=>!!window.FourLine&&!!window.Dominoes&&
   !!document.getElementById("sharedContent"),{timeout:20000});

  // Native teacher button proxies, score strips and active pilot are composed
  // from one local test run; original handlers are never clicked.
  for(const [width,hostWidth] of [[1360,780],[900,540],[500,360]]){
   await teacher.setViewportSize({width,height:900});
   // An actual keyboard input establishes keyboard focus modality before
   // DOM focus() moves to the first native teacher command.
   await teacher.keyboard.press("Tab");
   const data=await teacher.evaluate(({LONG,hostWidth})=>{
    const host=document.getElementById("activityControllerPanel");
    const original={run:state.activityRun,ended:state.ended,
      html:host.innerHTML,style:host.getAttribute("style"),
      parent:host.parentNode,next:host.nextSibling};
    try{
     // The teacher controller normally lives inside an inactive panel until
     // a real game starts. Move the SAME node into a visible disposable test
     // position, then restore its exact parent/contents in finally.
     document.body.appendChild(host);
     host.style.setProperty("display","block","important");
     host.style.setProperty("position","relative","important");
     host.style.setProperty("visibility","visible","important");
     host.style.width=hostWidth+"px";
     host.style.maxWidth="none";
     state.ended=false;state.activityRun={
      activityId:"four-in-line-game",phase:"running",
      fourInLine:{turn:0,moves:3,cols:7,rows:6,
       players:[LONG,"Gold Crew"],status:"playing"}
     };
     host.innerHTML='<button data-fil-action="save">SAVE</button>'+
       '<button id="sendActivityLobbyBtn">PAUSE</button>'+
       '<button id="returnClassBtn">RETURN</button>';
     window.__siUnifiedTeacherControls.refresh();
     const deck=host.querySelector("#siUnifiedTeacherDeck");
     if(!deck)throw Error("Teacher HUD missing");
     const head=deck.querySelector(".si-utc-head"),title=head.querySelector(".si-utc-title strong"),
      status=head.querySelector(".si-utc-status"),
      turn=deck.querySelector(".si-utc-turn-copy strong"),
      score=deck.querySelector(".si-utc-score-strip"),
      button=deck.querySelector(".si-utc-button"),
      chips=[...deck.querySelectorAll(".si-utc-score")];
     status.textContent=LONG;
     const label=chips.find(x=>x.classList.contains("is-player"))?.querySelector("small")
       ||chips[0]?.querySelector("small");
     if(label)label.textContent=LONG;
     button.focus();
     const bounds=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,width:b.width,height:b.height}};
     const d=bounds(deck),sr=bounds(status);
     return {
      width:deck.clientWidth,outerWidth:bounds(host).width,
      headerColumns:getComputedStyle(head).gridTemplateColumns.split(" ").length,
      status:sr,deck:d,
      statusBreak:getComputedStyle(status).overflowWrap,
      titleBreak:getComputedStyle(title).overflowWrap,
      turnBreak:getComputedStyle(turn).overflowWrap,
      text:turn.textContent, scoreScrollable:score.scrollWidth>=score.clientWidth,
      scoreFits:bounds(score).right<=d.right+3,
      firstChipBreak:getComputedStyle(label).overflowWrap,
      buttons:[...deck.querySelectorAll(".si-utc-button")].map(x=>({
       height:bounds(x).height,disabled:x.disabled})),
      focus:parseFloat(getComputedStyle(button).outlineWidth),
      pointer:button.getAttribute("aria-label")
     };
    }finally{
     state.activityRun=original.run;state.ended=original.ended;
     host.innerHTML=original.html;
     if(original.style===null)host.removeAttribute("style");
     else host.setAttribute("style",original.style);
     original.parent.insertBefore(host,original.next);
    }
   },{LONG,hostWidth});
   assert.ok(data.width>200&&data.width<=data.outerWidth+2,
     "Teacher dock must remain in its host: "+JSON.stringify({width,data}));
   assert.ok(data.status.right<=data.deck.right+3 &&
     data.status.left>=data.deck.left-3,
     "Long game phase label must fit teacher deck: "+JSON.stringify({width,data}));
   assert.equal(data.statusBreak,"anywhere");
   assert.equal(data.turnBreak,"anywhere");
   assert.equal(data.firstChipBreak,"anywhere");
   assert.ok(data.scoreScrollable&&data.scoreFits,
     "Score strip remains independently scrollable inside the dock");
   assert.ok(data.focus>=3&&data.buttons.every(x=>x.height>=44),
     "Teacher retains large buttons with visible keyboard focus: "+
      JSON.stringify({width,data}));
   if(hostWidth<=500)assert.equal(data.headerColumns,2,
     "Compact toolbar separates long status from game name");
   assert.equal(data.text,LONG);
  }

  // The actual production rendering functions are used in the real shared
  // role's container. Only displayed fixture text is changed, not game state.
  const projectorCases=[];
  for(const [width,height] of [[1920,1080],[1280,720],[1024,768]]){
   await shared.setViewportSize({width,height});
   for(const game of ["four","dominoes"]){
    const report=await shared.evaluate(({game,LONG})=>{
      const root=document.getElementById("sharedContent");
      if(game==="four"){
        const g=FourLine.make(["Blue Crew","Gold Crew"]);
        root.innerHTML=FourLine.publicHTML(g,true);
      }else{
        const g=Dominoes.make(["Blue Crew","Gold Crew"]);
        root.innerHTML=Dominoes.tableHTML(g,true);
      }
      const panel=root.querySelector(game==="four"?".fil-public":".dm-public");
      const label=panel.querySelector(game==="four"?".fil-info h3":".dm-turn-banner strong");
      if(!label)throw Error("Missing real projector title for "+game);
      label.textContent=LONG;
      const pb=panel.getBoundingClientRect(),lb=label.getBoundingClientRect();
      return {
        viewport:innerWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,
        panelWidth:pb.width,rootWidth:root.getBoundingClientRect().width,
        panelRight:pb.right,labelRight:lb.right,labelLeft:lb.left,
        breakRule:getComputedStyle(label).overflowWrap,
        labelOverflow:label.scrollWidth-label.clientWidth,
        boardCells:game==="four"?panel.querySelectorAll(".fil-cell").length:0,
        privateControls:panel.querySelectorAll("[data-fil-drop],[data-dm-play]").length
      };
    },{game,LONG});
    assert.equal(report.breakRule,"anywhere",
      "Shared game headings must wrap long teacher-written labels");
    assert.ok(report.panelWidth>240&&report.panelWidth<=report.viewport+4,
      "Projector stage must remain within viewport: "+JSON.stringify({game,width,report}));
    assert.ok(report.labelRight<=report.panelRight+4&&report.labelOverflow<=4,
      "Long name must not cover adjacent stage: "+JSON.stringify({game,width,report}));
    assert.ok(report.pageOverflow<=6,
      "Projected game must not create horizontal page scrolling: "+JSON.stringify({game,width,report}));
    assert.equal(report.privateControls,0,"Projector never shows interactive private moves");
    if(game==="four")assert.equal(report.boardCells,42);
    projectorCases.push({game,width,height,breakRule:report.breakRule});
   }
  }
  assert.deepEqual(errors,[],"No teacher or projector JavaScript errors");
  console.log("PHASE 4V TEACHER + SHARED SCREEN POLISH PASSED",
   JSON.stringify({teacherWidths:[1360,900,500],projectorCases}));
 }finally{
  await teacherCtx.close();await sharedCtx.close();await browser.close();
 }
})().catch(error=>{console.error(error);process.exit(1)});
