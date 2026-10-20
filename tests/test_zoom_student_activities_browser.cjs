/* Zoom companion v4: isolated student CSS geometry fixtures.
   No production actions, votes or classroom mutations. Uses real app CSS. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
const cards=Array.from({length:8},(_,i)=>'<button class="cc-hand-button" data-cosmic-card="card'+i+'"><span class="cc-card"><b>'+((i%9)+1)+'</b><small>Card</small></span></button>').join("");
const dominoes=Array.from({length:7},(_,i)=>'<div class="dm-hand-item playable"><span class="dm-tile">'+i+' / '+(i+1)+'</span><div class="dm-pick-actions"><button data-dm-play="'+i+'" data-dm-side="first">▶ PLACE TILE</button>'+(i%3===0?'<button class="dm-rotate" data-dm-rotate="'+i+'">⟳ DOUBLE · HORIZONTAL</button>':'')+'</div></div>').join("");
const samples={
 million:'<div class="student-prompt million-student command-seat million-4j-student"><span class="eyebrow">MILLION · COMMAND SEAT</span><h2>Which choice would keep everyone on the same team?</h2><div class="million-4j-choice-guide" data-phase="choose"><span class="million-4j-guide-mark">✦</span><strong>Choose your answer</strong><small>Select A, B, C or D.</small></div><div class="million-student-choices">'+
  ["A","B","C","D"].map(k=>'<button class="million-student-choice" data-million-choice="'+k+'"><b>'+k+'</b><span>Choose the strongest answer for your classroom mission</span></button>').join("")+
  '</div><div class="million-student-actions"><button id="millionLockBtn">LOCK ANSWER</button><button id="millionLifeBtn">USE LIFELINE</button></div></div>',
 cosmic:'<div class="cc-device cc-cinematic"><div class="cc-scene-mobile"></div><span class="eyebrow">COSMIC CARDS · PRIVATE HAND</span>'+
  '<h2>YOUR TURN, STUDENT!</h2><div class="cc-device-rule">NEXT PLAYER AFTER MATCH</div>'+
  '<div class="cc-device-status"><span>COLOR <b>BLUE</b></span><span>TOP <b>7</b></span><span>8 CARDS</span></div>'+
  '<div class="cc-hand-heading"><strong>YOUR HAND</strong><span>8 CARDS</span></div><div class="cc-hand cc-hand-dock">'+cards+'</div>'+
  '<div class="cc-device-actions"><button id="cosmicDrawBtn">DRAW ONE</button><button id="cosmicPassBtn">END TURN</button></div>'+
  '<p class="cc-help"><span class="cc-info-mark">i</span><span>Match your card with the color or symbol.</span></p><div class="cc-device-bottom">COSMIC CARDS</div></div>',
 dominoes:'<div class="dm-device"><div class="dm-banner"><div class="dm-brand-row"><div class="dm-mark">⚁</div><div><h2>DOMINOES</h2><p>DRAW · MATCH · CONNECT</p></div></div></div>'+
  '<div class="dm-device-center"><h3>YOUR MOVE</h3><p>Choose a matching tile to play.</p></div><div class="dm-hand-head"><b>YOUR DOMINOES</b><span>7 TILES</span></div>'+
  '<div class="dm-hand">'+dominoes+'</div><div class="dm-device-controls"><button id="dmDraw">DRAW</button><button id="dmPass">PASS</button></div>'+
  '<p class="dm-device-help">Play on left or right.</p></div>'
};
// Mirror the production student status cue sitting beside every live game.
const withCue=(game,html)=>'<section class="si-student-game-cue" id="siTestGameCue" data-si-tone="turn">'+
 '<span class="si-cue-app">'+game.toUpperCase()+'</span>'+
 '<strong class="si-cue-heading">YOUR TURN</strong>'+
 '<span class="si-cue-help">Follow your teacher and use the controls below.</span></section>'+html;
const poll='<div class="qp-voter"><header>🚀 MOTHERSHIP <span>QUICK POLL</span></header>'+
  '<div class="qp-status"><span>VOTING OPEN</span></div><h1>Which activity should the class choose today?</h1>'+
  '<p>Choose your answer.</p><div class="qp-vote-choices">'+
  Array.from({length:6},(_,i)=>'<button class="qp-vote-card" data-qp-choice="'+i+'"><span class="qp-image"></span><strong>Choice '+(i+1)+'</strong></button>').join("")+
  '</div><button class="qp-submit" id="qpSubmitVote">SUBMIT VOTE</button><p class="qp-vote-help">Select one answer.</p></div>';

(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:440,height:760}});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 try{
  const r=await page.goto(BASE+"/?role=student",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(r.status(),200);
  await page.waitForSelector("#studentContent",{timeout:15000});
  await page.waitForFunction(()=>!!document.querySelector('link[href^="/student-companion.css"]'),null,{timeout:6000});
  for(const [w,h] of [[440,760],[390,670],[330,610]]){
   await page.setViewportSize({width:w,height:h});
   for(const [game,html] of Object.entries(samples)){
    const ui=await page.evaluate(({html,game})=>{
     const root=document.querySelector("#studentContent");
     root.innerHTML=html;
     const rect=el=>el?el.getBoundingClientRect():null;
     const main=rect(root),panel=rect(root.querySelector(game==="million"?".million-student":game==="cosmic"?".cc-device":".dm-device"));
     const cue=rect(root.querySelector("#siTestGameCue"));
     const action=rect(root.querySelector(game==="million"?".million-student-choices":game==="cosmic"?".cc-hand":".dm-hand"));
     const selectors=game==="million"?[".million-student-choice",".million-student-actions button"]:
       game==="cosmic"?[".cc-hand-button",".cc-device-actions button"]:
       [".dm-pick-actions button",".dm-device-controls button"];
     const cmd=root.querySelector(game==="million"?"#millionLockBtn":game==="cosmic"?"#cosmicDrawBtn":"#dmDraw");
     const primary=root.querySelector(game==="million"?".million-student-choice span":game==="cosmic"?".cc-device-status>span":".dm-pick-actions button");
     const fontPx=el=>parseFloat(getComputedStyle(el).fontSize);
     const cueBack=getComputedStyle(root.querySelector("#siTestGameCue")).backgroundImage;
     cmd.focus();
     const focusStyle=getComputedStyle(cmd),cmdFont=fontPx(cmd),labelFont=fontPx(primary);
     const focusWidth=focusStyle.outlineWidth,focusColor=focusStyle.outlineColor;
     let selectionContrast=false;
     if(game==="million"){
       const choice=root.querySelector(".million-student-choice");
       const idle=getComputedStyle(choice);
       const before=[idle.borderTopColor,idle.boxShadow,idle.outlineWidth].join("|");
       choice.classList.add("selected");
       const active=getComputedStyle(choice);
       const after=[active.borderTopColor,active.boxShadow,active.outlineWidth].join("|");
       selectionContrast=before!==after;
       choice.classList.remove("selected");
     }
     return {viewport:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
       visual:{cueBack,cmdFont,labelFont,focusWidth,focusColor,selectionContrast},
       mainWidth:main.width,panelWidth:panel.width,
       cue:{y:cue.y,bottom:cue.bottom,h:cue.height,w:cue.width},
       panelY:panel.y,actionWidth:action.width,
       grids:selectors.map(s=>[...root.querySelectorAll(s)].map(el=>({
        w:rect(el).width,h:rect(el).height}))),
       footer:getComputedStyle(document.querySelector(".student-control-zone")).display,
       cols:game==="million"?
        getComputedStyle(root.querySelector(".million-student-choices")).gridTemplateColumns.split(" ").length:
        game==="cosmic"?getComputedStyle(root.querySelector(".cc-hand")).gridTemplateColumns.split(" ").length:
        getComputedStyle(root.querySelector(".dm-hand")).gridTemplateColumns.split(" ").length,
       scene:game==="cosmic"?rect(root.querySelector(".cc-scene-mobile")).height:null};
    },{html:withCue(game,html),game});
    assert.ok(ui.overflow<=2&&ui.panelWidth<=ui.mainWidth+2,JSON.stringify({w,h,game,ui}));
    assert.ok(ui.cue.h<150&&ui.cue.bottom<=ui.panelY+2,
      game+" instructions must sit above, never beside, the board: "+JSON.stringify({w,h,ui}));
    assert.ok(ui.panelWidth>=ui.mainWidth-24&&ui.actionWidth>=ui.mainWidth-58,
      game+" action surface must use student device width: "+JSON.stringify({w,h,ui}));
    assert.equal(ui.footer,"none",game+" has no unused footer");

    // Phase 4K: shared cue hierarchy and game-specific action geometry.
    const style=await page.evaluate(game=>{
      const root=document.querySelector('#studentContent');
      const cue=root.querySelector('#siTestGameCue');
      const card=root.querySelector(game==='million'?'.million-student':game==='cosmic'?'.cc-device':'.dm-device');
      const dock=root.querySelector(game==='cosmic'?'.cc-device-actions':game==='dominoes'?'.dm-device-controls':'.million-student-actions');
      return {cueRadius:parseFloat(getComputedStyle(cue).borderTopLeftRadius),
        cueFont:parseFloat(getComputedStyle(cue.querySelector('.si-cue-heading')).fontSize),
        cardRadius:parseFloat(getComputedStyle(card).borderTopLeftRadius),
        dockBackground:getComputedStyle(dock).backgroundImage,
        horizontal:document.documentElement.scrollWidth-innerWidth};
    },game);
    assert.ok(style.cueRadius>=10&&style.cueFont>=15);
    assert.ok(style.cardRadius>=10&&style.horizontal<=2);
    if(game!=='million')assert.match(style.dockBackground,/gradient/,
      game+' keeps a visually distinct action dock');

    assert.match(ui.visual.cueBack,/gradient/i,game+" has a styled status banner");
    assert.ok(parseFloat(ui.visual.focusWidth)>=3,
      game+" has a high-visibility keyboard outline: "+JSON.stringify({w,h,ui}));
    assert.ok(ui.visual.cmdFont>=12,
      game+" action label remains readable: "+JSON.stringify({w,h,ui}));
    assert.ok(ui.visual.labelFont>=11,
      game+" card/status labels remain readable: "+JSON.stringify({w,h,ui}));
    if(game==="million")assert.ok(ui.visual.selectionContrast,
      "Selected answer has a distinct visual state");
    assert.equal(ui.cols,game==="dominoes"?(w>=410?3:2):game==="cosmic"?3:game==="million"?1:2);
    assert.ok(ui.grids[0].length>=4&&ui.grids[0].every(x=>x.w>=40),JSON.stringify({w,h,game,ui}));
    if(game==="cosmic")assert.ok(ui.grids[1].every(x=>x.h>=44)&&ui.scene<=75,JSON.stringify(ui));
    if(game==="dominoes")assert.ok(ui.grids[0].every(x=>x.h>=44&&x.w>=80)&&ui.grids[1].every(x=>x.h>=44),JSON.stringify(ui));
    if(game==="million")assert.ok(ui.grids[0].every(x=>x.h>=70&&x.w>=190)&&ui.grids[1].every(x=>x.h>=44)&&ui.visual.labelFont>=13,JSON.stringify(ui));
    if(game==="million")assert.ok(ui.visual.selectionContrast&&ui.actionWidth>=ui.mainWidth-58,
      'Phase 4J MILLION answer cards must remain full-width and visibly selected');
    console.log("ZOOM "+game+" "+w+"x"+h+" "+JSON.stringify({columns:ui.cols,buttons:ui.grids[0].length}));
   }
   const pv=await page.evaluate(poll=>{
    const overlay=document.querySelector("#qpPublicOverlay");
    overlay.hidden=false;overlay.innerHTML=poll;
    const rect=sel=>document.querySelector(sel).getBoundingClientRect();
    const voter=rect("#qpPublicOverlay .qp-voter");
    const choice=[...document.querySelectorAll("#qpPublicOverlay .qp-vote-card")].map(el=>el.getBoundingClientRect());
    const submit=rect("#qpSubmitVote");
    const result={overlay:getComputedStyle(overlay).display,voterWidth:voter.width,voterHeight:voter.height,
      overflow:document.documentElement.scrollWidth-innerWidth,submitHeight:submit.height,
      choices:choice.map(r=>({w:r.width,h:r.height})),cols:getComputedStyle(document.querySelector(".qp-vote-choices")).gridTemplateColumns.split(" ").length};
    overlay.hidden=true;overlay.innerHTML="";
    result.hidden=getComputedStyle(overlay).display;
    return result;
   },poll);
   assert.equal(pv.overlay,"flex");
   assert.equal(pv.hidden,"none","closed poll never obscures classroom");
   assert.ok(pv.overflow<=2&&pv.voterWidth<=w+2&&pv.voterHeight<=h+2,JSON.stringify({w,h,pv}));
   assert.equal(pv.cols,2);
   assert.ok(pv.choices.length===6&&pv.choices.every(c=>c.w>=90&&c.h>=100)&&pv.submitHeight>=44,JSON.stringify({w,h,pv}));
   console.log("ZOOM poll "+w+"x"+h+" "+JSON.stringify({choices:pv.choices.length,voteButton:pv.submitHeight}));
  }
  // Phase 3F: exercise the real read-only MILLION companion ribbon at Zoom size.
  await page.setViewportSize({width:330,height:610});
  await page.evaluate(html=>{
   state.activityRun={activityId:'million-game',phase:'running',
    runToken:'local-visual-fixture',
    million:{questionIndex:0,ladderLevel:0,inventory:{poll:2,reduce:1,clue:0,tryAgain:0}},
    millionConfig:{questions:Array.from({length:5},(_,i)=>({prompt:'Question '+i,choices:[]})),
     ladder:[100,200,300,500,1000000]}};
   document.querySelector('#studentContent').innerHTML=html;
  },withCue('million',samples.million));
  await page.waitForFunction(()=>document.querySelector('.ms-million-student-ribbon .ms-million-student-stake')?.textContent==='PLAYING FOR 100 PTS',null,{timeout:8000});
  const ribbon=await page.evaluate(()=>{
   const root=document.querySelector('#studentContent .ms-million-student-ribbon');
   const r=root.getBoundingClientRect();
   return {question:root.querySelector('.ms-million-student-question')?.textContent,
    stake:root.querySelector('.ms-million-student-stake')?.textContent,
    lives:root.querySelector('.ms-million-student-lives')?.textContent,
    background:getComputedStyle(root).backgroundImage,width:r.width,
    documentWidth:document.documentElement.scrollWidth};
  });
  assert.deepEqual([ribbon.question,ribbon.stake,ribbon.lives],
   ['QUESTION 1 / 5','PLAYING FOR 100 PTS','3 CREW LIFELINES LEFT']);
  assert.match(ribbon.background,/linear-gradient/);
  assert.ok(ribbon.width>=220&&ribbon.documentWidth<=332,'compact companion status fits 330px');
  // Phase 3J: pupil progress is a screen-reader-friendly, read-only meter.
  const initialPoints=await page.evaluate(()=>{
   const board=document.querySelector('#studentContent .million-student');
   const meter=board.querySelector('.ms-million-student-points-track');
   return {name:meter?.getAttribute('aria-label'),
    role:meter?.getAttribute('role'),
    min:meter?.getAttribute('aria-valuemin'),
    max:meter?.getAttribute('aria-valuemax'),
    now:meter?.getAttribute('aria-valuenow'),
    text:board.querySelector('.ms-million-student-points-label')?.textContent,
    fill:meter?.querySelector('i')?.style.width};
  });
  assert.deepEqual(initialPoints,{name:'Questions secured',role:'progressbar',
   min:'0',max:'5',now:'0',text:'0 / 5 POINT LEVELS SECURED',fill:'0%'});
  await page.evaluate(()=>{state.activityRun.million.ladderLevel=2;});
  await page.waitForFunction(()=>
   document.querySelector('.ms-million-student-points-track')?.getAttribute('aria-valuenow')==='2',
   null,{timeout:8000});
  for(const [width,height] of [[330,610],[390,670],[440,760]]){
   await page.setViewportSize({width,height});
   const status=await page.evaluate(()=>{
    const student=document.querySelector('#studentContent .million-student');
    const bar=student.querySelector('.ms-million-student-points');
    const meter=bar.querySelector('.ms-million-student-points-track');
    const r=bar.getBoundingClientRect(),outer=student.getBoundingClientRect();
    return {label:bar.querySelector('strong')?.textContent,fill:meter.querySelector('i').style.width,
     barWidth:r.width,studentWidth:outer.width,overflow:document.documentElement.scrollWidth-innerWidth,
     choiceCount:student.querySelectorAll('.million-student-choice').length};
   });
   assert.equal(status.label,'2 / 5 POINT LEVELS SECURED');
   assert.equal(status.fill,'40%');
   assert.equal(status.choiceCount,4);
   assert.ok(status.overflow<=2&&status.barWidth>170&&status.barWidth<=status.studentWidth+1,
    'point meter fits Zoom student window '+width+': '+JSON.stringify(status));
  }
  await page.setViewportSize({width:330,height:610});
  // MILLION must scroll with a wheel/finger over answer cards, not only via
  // programmatically setting scrollTop. The full game stays in the clipped
  // compact device; all four buttons and native lock control remain reachable.
  const beforeScroll=await page.evaluate(()=>{
   const box=document.querySelector('#studentContent');
   const panel=box.querySelector('.million-student');
   const answers=[...panel.querySelectorAll('.million-student-choice')];
   return {client:box.clientHeight,scroll:box.scrollHeight,
    y:box.scrollTop,overflowY:getComputedStyle(box).overflowY,
    touch:getComputedStyle(answers[1]).touchAction,
    sticky:getComputedStyle(panel.querySelector('.million-student-actions')).position};
  });
  assert.ok(beforeScroll.scroll>beforeScroll.client+90,
    'MILLION must create a vertically scrollable compact answer area: '+JSON.stringify(beforeScroll));
  assert.equal(beforeScroll.overflowY,'scroll');
  assert.match(beforeScroll.touch,/pan-y/);
  assert.equal(beforeScroll.sticky,'static');
  const firstAnswer=await page.locator('#studentContent .million-student-choice').first().boundingBox();
  await page.mouse.move(firstAnswer.x+firstAnswer.width/2,firstAnswer.y+firstAnswer.height/2);
  await page.mouse.wheel(0,1200);
  await page.waitForFunction(()=>document.querySelector('#studentContent')?.scrollTop>75,
   null,{timeout:5500});
  await page.mouse.wheel(0,1200);
  await page.waitForFunction(()=>{
   const box=document.querySelector('#studentContent'),button=box?.querySelector('#millionLockBtn');
   if(!button)return false;
   const r=box.getBoundingClientRect(),b=button.getBoundingClientRect();
   return b.top>=r.top-5&&b.bottom<=r.bottom+5;
  },null,{timeout:6000});
  const scrolled=await page.evaluate(()=>{
   const box=document.querySelector('#studentContent'),br=box.getBoundingClientRect();
   const fourth=box.querySelector('.million-student-choice:last-child')?.getBoundingClientRect();
   const lock=box.querySelector('#millionLockBtn')?.getBoundingClientRect();
   return {top:box.scrollTop,limit:box.scrollHeight-box.clientHeight,
    fourthVisible:fourth.top>=br.top-5&&fourth.bottom<=br.bottom+5,
    lockVisible:lock.top>=br.top-5&&lock.bottom<=br.bottom+5,
    overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(scrolled.top>75&&scrolled.limit>100,
    'wheel scrolling over an answer actually moves MILLION content: '+JSON.stringify(scrolled));
  assert.ok(scrolled.fourthVisible&&scrolled.lockVisible,
    'answer D and LOCK ANSWER can both be reached in Zoom: '+JSON.stringify(scrolled));
  assert.ok(scrolled.overflow<=2,'vertical answer scroll must not cause horizontal page scrolling');
  await page.evaluate(()=>{state.activityRun.million.questionIndex=4;});
  await page.waitForFunction(()=>document.querySelector('.ms-million-student-ribbon.is-final .ms-million-student-stake')?.textContent==='★ FINAL QUESTION · 1,000,000 PTS',null,{timeout:8000});
  const finalRibbon=await page.evaluate(()=>{
   const el=document.querySelector('.ms-million-student-ribbon.is-final');
   return {border:parseFloat(getComputedStyle(el).borderTopWidth),
    contents:el.textContent,noKey:state.activityRun.millionConfig.questions.every(q=>!('correct' in q))};
  });
  assert.ok(finalRibbon.border>=2&&finalRibbon.noKey,'final question has a gold border without answer leakage');
  await page.evaluate(()=>{state.activityRun=null;document.querySelector('#studentContent').innerHTML='';});
  assert.equal(await page.locator('.ms-million-student-ribbon').count(),0,
   'classroom return clears MILLION student ribbon');
  assert.deepEqual(errors,[]);
  console.log("ZOOM companion student vote, answer, hand, and domino tile geometry PASS");
 }finally{await context.close();await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
