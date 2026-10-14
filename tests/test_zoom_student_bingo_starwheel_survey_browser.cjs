/* Student Zoom Companion v6: isolated Bingo, Starwheel, Crew Survey geometry.
   No live session, API mutation, student identity, or production actions. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
const fixture={
 bingo:(size=5)=>'<section class="si-student-game-cue" id="siTestBingoCue" data-si-tone="turn">'+
  '<span class="si-cue-app">BINGO</span><strong class="si-cue-heading">CHECK YOUR CARD</strong>'+
  '<span class="si-cue-help">Mark called items. Tap BINGO when you win.</span></section>'+
  '<div class="student-game-foundation"><div class="student-game-card"><span class="eyebrow">MOTHERSHIP · BINGO</span><h2>Pilot Private Card</h2><p>Mark the item if called.</p>'+
  '<div class="bingo-student-board" style="grid-template-columns:repeat('+size+',1fr)">'+
  Array.from({length:size*size},(_,i)=>'<button type="button" class="bingo-student-cell '+(i===0?"marked":"")+'" data-bingo-mark="'+i+'">'+
     (i%3===0?'KITCHEN ITEM':String(i+1))+'</button>').join("")+'</div>'+
  '<div class="prompt-caption">3 marked · 6 calls</div><button id="studentBingoClaimBtn" class="bingo-claim-button">BINGO!</button></div></div>',
 letter:()=>'<div class="student-prompt response-device"><span class="eyebrow">STARWHEEL · ACTIVE PILOT</span>'+
  '<h2>Pilot, you have the controls</h2><p>Pick a consonant.</p><div class="submitted-banner">Current score <b>500</b></div>'+
  '<div class="starwheel-turn-instruction letter">SPIN COMPLETE · CHOOSE A CONSONANT</div>'+
  '<div class="starwheel-pilot-banner"><span>CORE VALUE</span><strong>400</strong></div><h3>Choose one non-vowel letter</h3>'+
  '<div class="starwheel-student-grid">'+('BCDFGHJKLMNPQRSTVWXYZ').split("").map(s=>'<button data-starwheel-letter="'+s+'">'+s+'</button>').join("")+'</div>'+
  '<div class="starwheel-solve-box"><input id="starwheelSolveInput" placeholder="Solve full signal"><button id="starwheelSendSolve">SOLVE SIGNAL</button></div>'+
  '<div class="prompt-caption">Submissions are private.</div></div>',
 ready:()=>'<div class="student-prompt response-device"><span class="eyebrow">STARWHEEL · ACTIVE PILOT</span>'+
  '<h2>Pilot, you have the controls</h2><p>Spin or buy vowel.</p><div class="starwheel-turn-instruction ready">YOUR TURN · SPIN OR BUY A VOWEL</div>'+
  '<button class="starwheel-main-spin" data-starwheel-spin>✦ SPIN STARWHEEL</button><h3>Or buy a vowel · 250 energy</h3>'+
  '<div class="starwheel-student-grid starwheel-vowels">'+('AEIOU').split("").map(s=>'<button data-starwheel-vowel="'+s+'">'+s+'</button>').join("")+'</div>'+
  '<div class="starwheel-solve-box"><input id="starwheelSolveInput" placeholder="Solve full signal"><button id="starwheelSendSolve">SOLVE SIGNAL</button></div>'+
  '<div class="prompt-caption">The teacher checks your solve.</div></div>',
 buzzer:()=>'<div class="student-prompt crew-survey-student active-buzzer"><span class="eyebrow">CREW SURVEY · FACE-OFF</span>'+
  '<h2>It is your turn to buzz!</h2><button class="crew-survey-big-buzz" id="crewSurveyBuzzBtn">ϟ<span>BUZZ</span></button>'+
  '<p>First valid signal wins.</p></div>',
 answer:()=>'<div class="student-prompt crew-survey-student"><span class="eyebrow">CREW SURVEY · YOUR TURN</span>'+
  '<h2>Give your best answer</h2><p>Name a place to find a book.</p><div class="crew-survey-aac">'+
  ['Library','Bookstore','School','At home','Community center','Classroom'].map(s=>'<button data-cs-aac="'+s+'">'+s+'</button>').join("")+
  '</div><div class="crew-survey-type"><input id="crewSurveyAnswerInput" placeholder="Type an answer"><button id="crewSurveyAnswerSend">Send</button></div>'+
  '<div class="submitted-banner">Sent privately</div></div>'
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:440,height:760}});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 try{
  const nav=await page.goto(BASE+"/?role=student",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(nav.status(),200);
  await page.waitForSelector("#studentContent",{timeout:15000});
  await page.waitForFunction(()=>!!document.querySelector('link[href^="/student-companion.css"]'),null,{timeout:6000});
  for(const [width,height] of [[440,760],[390,670],[330,610]]){
   await page.setViewportSize({width,height});
   for(const [name,html] of Object.entries({bingo4:fixture.bingo(4),bingo5:fixture.bingo(5),
      letter:fixture.letter(),ready:fixture.ready(),buzzer:fixture.buzzer(),answer:fixture.answer()})){
    const data=await page.evaluate(({name,html})=>{
      const root=document.getElementById("studentContent"),footer=document.querySelector(".student-control-zone");
      footer.dataset.app="home";document.getElementById("studentControls").innerHTML="";
      root.innerHTML=html;
      // Keep only fixture event handlers; click tests assert original buttons were not replaced.
      const buttons=[...root.querySelectorAll('button')];
      window.__zoomFixtureClicks=0;
      for(const btn of buttons)btn.addEventListener("click",()=>window.__zoomFixtureClicks++);
      const bounds=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,bottom:r.bottom,right:r.right}};
      const take=sel=>[...root.querySelectorAll(sel)].map(bounds);
      const columns=sel=>root.querySelector(sel)?getComputedStyle(root.querySelector(sel)).gridTemplateColumns.split(" ").length:0;
      return {overflow:document.documentElement.scrollWidth-innerWidth,
        frame:bounds(root.firstElementChild),main:root.clientWidth,
        cue:bounds(root.querySelector("#siTestBingoCue")),
        foundation:bounds(root.querySelector(".student-game-foundation")),
        card:bounds(root.querySelector(".student-game-card")),
        board:bounds(root.querySelector(".bingo-student-board")),
        buttons:take(name.startsWith("bingo")?".bingo-student-cell":name==="letter"||name==="ready"?".starwheel-student-grid button":name==="buzzer"?"#crewSurveyBuzzBtn":".crew-survey-aac button"),
        action:take(name.startsWith("bingo")?"#studentBingoClaimBtn":name==="letter"||name==="ready"?"#starwheelSendSolve":name==="buzzer"?"#crewSurveyBuzzBtn":"#crewSurveyAnswerSend"),
        grid:columns(name.startsWith("bingo")?".bingo-student-board":name==="letter"||name==="ready"?".starwheel-student-grid":".crew-survey-aac"),
        input:take(name==="letter"||name==="ready"?"#starwheelSolveInput":name==="answer"?"#crewSurveyAnswerInput":"never-match"),
        spin:take(".starwheel-main-spin"),
        footer:getComputedStyle(footer).display};
    },{name,html});
    assert.ok(data.overflow<=2&&data.frame.w<=data.main+2,JSON.stringify({width,height,name,data}));
    const minimum=name.startsWith("bingo")?44:name==="buzzer"?185:44;
    assert.ok(data.buttons.length>0&&data.buttons.every(b=>b.w>=minimum&&b.h>=minimum),
       JSON.stringify({width,height,name,data}));
    assert.ok(data.action.every(b=>b.w>=44&&b.h>=44),JSON.stringify({width,height,name,data}));
    assert.equal(data.footer,"none",name+" should not have duplicate or empty footer");
    if(name.startsWith("bingo")){
      const size=Number(name.slice(-1));assert.equal(data.grid,size);
      assert.equal(data.buttons.length,size*size);
      assert.ok(data.cue&&data.foundation&&data.board&&data.card,JSON.stringify({width,height,name,data}));
      assert.ok(data.cue.h<155&&data.cue.bottom<=data.foundation.y+2,
        "Bingo instructions must be a compact banner ABOVE the card: "+JSON.stringify({width,height,data}));
      assert.ok(data.foundation.w>=data.main-30&&data.card.w>=data.main-30&&
        data.board.w>=data.main-60,
        "Bingo private card should use phone width: "+JSON.stringify({width,height,data}));
    }else if(name==="letter"||name==="ready"){
      assert.equal(data.grid,5);
      assert.equal(data.buttons.length,name==="letter"?21:5);
      assert.ok(data.input.length===1&&data.input[0].h>=44);
      if(name==="ready")assert.ok(data.spin.length===1&&data.spin[0].h>=58);
    }else if(name==="answer"){
      assert.equal(data.grid,2);assert.equal(data.buttons.length,6);
      assert.ok(data.input.length===1&&data.input[0].h>=44);
    }
    await page.evaluate(()=>document.querySelector("#studentContent button:not(:disabled)")?.click());
    assert.equal(await page.evaluate(()=>window.__zoomFixtureClicks),1,name+" original click listener still works");
    console.log("ZOOM v6 "+name+" "+width+"x"+height+" OK");
   }
   assert.deepEqual(errors,[]);
  }
  console.log("Bingo, Starwheel and Crew Survey student browser size and click tests PASSED");
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
