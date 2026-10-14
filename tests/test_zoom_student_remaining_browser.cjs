/* Zoom companion v5 — MATCH, WORD GRID, MINEFIELD.
   Isolated browser geometry, hint privacy, swipeable Minefield sector binding.
   No production writes, live session mutation, or real classroom activity. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
const matchFixture='<section class="si-student-game-cue" data-si-tone="turn" id="matchStudentCue">'+
 '<span class="si-cue-app">MATCH</span><strong class="si-cue-heading">FIND A PAIR</strong>'+
 '<span class="si-cue-help">Tap two cards to find a match.</span></section>'+
 '<div class="ma-game ma-student">'+
 '<div class="ma-student-heading"><div class="ma-student-pilot"><span class="ma-avatar">✦</span><span>CURRENT NAVIGATOR</span></div>'+
 '<span class="ma-eyebrow">MOTHERSHIP · MATCH</span><h2>YOUR TURN, ZOOM PILOT!</h2><p>Tap two cards to find a match.</p></div>'+
 '<div class="ma-student-status"><span><b>0 / 12</b> PAIRS</span><span><b>0</b> TRIES</span><span>ACTIVE PILOT</span><span class="ma-student-earned">★ <b>2</b> AUTO POINTS</span></div>'+
 '<div class="ma-board-wrap"><div class="ma-board-surround"><div class="ma-grid" style="--ma-cols:6">'+
 Array.from({length:24},(_,i)=>'<button type="button" data-match-pick="'+i+'" class="ma-tile is-hidden"><span class="ma-tile-face ma-tile-back"><b>'+(i+1)+'</b><small>SECTOR</small></span></button>').join('')+
 '</div></div></div><div class="ma-device-tip">Remember the signals.</div><div class="ma-device-bottom">MATCH</div></div>';
const minefieldFixture=(cols=8)=>{
 const header='<div class="minefield-axis corner">•</div>'+Array.from({length:cols},(_,c)=>'<div class="minefield-axis col">'+String.fromCharCode(65+c)+'</div>').join('');
 const body=Array.from({length:cols},(_,r)=>'<div class="minefield-axis row">'+(r+1)+'</div>'+
  Array.from({length:cols},(_,c)=>'<button type="button" class="minefield-cell unknown selectable" data-mf-cell="'+r+','+c+'">·</button>').join('')).join('');
 return '<div class="student-prompt response-device"><span class="eyebrow">MINEFIELD · NAVIGATOR</span>'+
  '<div class="minefield-turn-banner">YOUR TURN — SELECT A SECTOR</div><h2>Zoom Pilot, choose any sector</h2>'+
  '<div class="minefield-narrator"><div class="minefield-narrator-head"><b>MISSION NARRATOR</b></div>'+
  '<div class="minefield-narrator-latest">Choose a hidden square.</div></div>'+
  '<div class="minefield-board minefield-student-board" style="grid-template-columns:22px repeat('+cols+',1fr)">'+header+body+'</div>'+
  '<div class="prompt-caption">Choose a hidden square, then confirm below.</div></div>';
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:440,height:760}});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 try{
  const response=await page.goto(BASE+"/?role=student",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.WordGrid&&!!document.querySelector("#studentContent"),null,{timeout:15000});
  for(const [width,height] of [[440,760],[390,670],[330,610]]){
   await page.setViewportSize({width,height});
   // Reset synthetic Minefield controls between simulated device sizes.
   await page.evaluate(()=>{
     document.querySelector("#studentControls").innerHTML="";
     document.querySelector(".student-control-zone").dataset.app="home";
   });
   const match=await page.evaluate(markup=>{
    const root=document.querySelector("#studentContent");
    root.innerHTML=markup;
    const grid=root.querySelector(".ma-grid"),tiles=[...root.querySelectorAll("[data-match-pick]")];
    return {overflow:document.documentElement.scrollWidth-innerWidth,
      main:root.clientWidth,frame:root.querySelector(".ma-student").getBoundingClientRect().width,
      cue:(()=>{const r=root.querySelector("#matchStudentCue").getBoundingClientRect();return {y:r.y,bottom:r.bottom,w:r.width,h:r.height};})(),
      board:(()=>{const r=root.querySelector(".ma-board-surround").getBoundingClientRect();return {y:r.y,w:r.width};})(),
      score:root.querySelector(".ma-student-earned")?.textContent,
      columns:getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      tiles:tiles.map(t=>({w:t.getBoundingClientRect().width,h:t.getBoundingClientRect().height})),
      footer:getComputedStyle(document.querySelector(".student-control-zone")).display};
   },matchFixture);
   assert.ok(match.overflow<=2&&match.frame<=match.main+2,JSON.stringify({width,height,match}));
   assert.ok(match.cue.h<155&&match.cue.bottom<=match.board.y+2,
     "MATCH cue must be ABOVE the board, not beside it: "+JSON.stringify({width,height,match}));
   assert.ok(match.frame>=match.main-24&&match.board.w>=match.main-48,
     "MATCH board should use the phone width: "+JSON.stringify({width,height,match}));
   assert.match(match.score,/2.*AUTO POINTS/);
   assert.equal(match.columns,4,"24 cards use touchable four-column layout");
   assert.ok(match.tiles.length===24&&match.tiles.every(t=>t.w>=54&&t.h>=50),JSON.stringify({width,height,match}));
   assert.equal(match.footer,"none");
   const word=await page.evaluate(()=>{
    const g=WordGrid.make(["Blue Crew","Gold Crew"],{assignments:{"Zoom Pilot":0}});
    const id=g.players[0].rack[0].id;
    WordGrid.setHint(g,id);
    const own=WordGrid.studentHTML(g,{n:"Zoom Pilot"});
    const spectator=WordGrid.studentHTML(g,{n:"Other Student"});
    const root=document.querySelector("#studentContent");
    root.innerHTML=own;
    const wrap=root.querySelector(".wg-student-board"),board=wrap.querySelector(".wg-board");
    const rack=[...root.querySelectorAll(".wg-student-rack .wg-tile")];
    const before=wrap.scrollLeft;wrap.scrollLeft=160;
    return {overflow:document.documentElement.scrollWidth-innerWidth,
      main:root.clientWidth,frame:root.firstElementChild.getBoundingClientRect().width,
      boardCells:root.querySelectorAll(".wg-student-board [data-wg-cell]").length,
      boardWidth:board.getBoundingClientRect().width,viewWidth:wrap.clientWidth,
      scrolled:wrap.scrollLeft>before,rack:rack.map(t=>({w:t.getBoundingClientRect().width,h:t.getBoundingClientRect().height})),
      hasHint:!!root.querySelector(".wg-tile.wg-highlight"),
      privacy:!spectator.includes("wg-student-rack"),footer:getComputedStyle(document.querySelector(".student-control-zone")).display};
   });
   assert.ok(word.overflow<=2&&word.frame<=word.main+2,JSON.stringify({width,height,word}));
   assert.equal(word.boardCells,225);
   assert.ok(word.boardWidth>=450&&word.boardWidth>word.viewWidth&&word.scrolled,JSON.stringify(word));
   assert.ok(word.rack.length===7&&word.rack.every(t=>t.w>=35&&t.h>=43),JSON.stringify(word));
   assert.ok(word.hasHint&&word.privacy,"teacher hint appears only for active assigned team");
   assert.equal(word.footer,"none");
   await page.evaluate(html=>{
    const root=document.querySelector("#studentContent");root.innerHTML=html;
    // The real Minefield response uses the separate footer to confirm a square.
    // Emulate that control so the unjoined fixture does not hide an empty footer.
    const footer=document.querySelector(".student-control-zone");
    footer.dataset.app="minefield";
    document.querySelector("#studentControls").innerHTML='<button id="si-mf-test-confirm" type="button">Confirm sector</button>';
    window.__siMinefieldSelections=0;
    root.querySelectorAll("[data-mf-cell]").forEach(b=>b.addEventListener("click",()=>window.__siMinefieldSelections++));
   },minefieldFixture(8));
   await page.waitForFunction(()=>!!document.querySelector("#studentContent .si-mf-scroll"),null,{timeout:6000});
   const mine=await page.evaluate(()=>{
    const root=document.querySelector("#studentContent");
    const wrapper=root.querySelector(".si-mf-scroll");
    const board=root.querySelector(".minefield-student-board");
    const targets=[...board.querySelectorAll("[data-mf-cell]")];
    const start=wrapper.scrollLeft;wrapper.scrollLeft=200;
    return {overflow:document.documentElement.scrollWidth-innerWidth,
     viewportWidth:wrapper.clientWidth,scrollWidth:wrapper.scrollWidth,
     scrolled:wrapper.scrollLeft>start,columns:board.querySelectorAll(".minefield-axis.col").length,
     touches:targets.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),
     footer:getComputedStyle(document.querySelector(".student-control-zone")).display,
     label:wrapper.getAttribute("aria-label")};
   });
   assert.ok(mine.overflow<=2&&mine.columns===8&&mine.scrolled,JSON.stringify({width,height,mine}));
   assert.ok(mine.scrollWidth>mine.viewportWidth&&mine.touches.length===64,JSON.stringify(mine));
   assert.ok(mine.touches.every(t=>t.w>=44&&t.h>=44),JSON.stringify({width,height,mine}));
   assert.notEqual(mine.footer,"none","Minefield requires its separate confirmation controls");
   assert.match(mine.label,/Swipe/);
   await page.evaluate(()=>{
     document.querySelector('#studentContent [data-mf-cell="3,7"]').click();
   });
   assert.equal(await page.evaluate(()=>window.__siMinefieldSelections),1,"enhancement must preserve sector button listeners");
   assert.deepEqual(errors,[]);
   console.log("Zoom remaining student UI "+width+"x"+height+" MATCH 24 · WORD GRID 225 · MINEFIELD 64: PASS");
  }
  console.log("Zoom companion v5 board, rack, safe scroll and original Minefield handlers PASSED");
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
