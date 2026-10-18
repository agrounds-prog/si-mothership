/* Zoom companion v4: isolated student CSS geometry fixtures.
   No production actions, votes or classroom mutations. Uses real app CSS. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
const cards=Array.from({length:8},(_,i)=>'<button class="cc-hand-button" data-cosmic-card="card'+i+'"><span class="cc-card"><b>'+((i%9)+1)+'</b><small>Card</small></span></button>').join("");
const dominoes=Array.from({length:7},(_,i)=>'<div class="dm-hand-item playable"><span class="dm-tile">'+i+' / '+(i+1)+'</span><div class="dm-pick-actions"><button data-dm-play="'+i+'" data-dm-side="first">▶ PLACE TILE</button>'+(i%3===0?'<button class="dm-rotate" data-dm-rotate="'+i+'">⟳ DOUBLE · HORIZONTAL</button>':'')+'</div></div>').join("");
const samples={
 million:'<div class="student-prompt million-student command-seat"><span class="eyebrow">MILLION · COMMAND SEAT</span><h2>Which choice would keep everyone on the same team?</h2><div class="million-student-choices">'+
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
  assert.deepEqual(errors,[]);
  console.log("ZOOM companion student vote, answer, hand, and domino tile geometry PASS");
 }finally{await context.close();await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
