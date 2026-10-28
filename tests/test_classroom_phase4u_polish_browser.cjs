/* Phase 4U compact cross-game UI polish and projector text resilience.
   Fixture-based presentation checks use real loaded app CSS on localhost;
   they never submit student responses or mutate live classroom sessions. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE))
 throw Error("Phase 4U regression must use disposable localhost only");
const LONG="Carefully-read-this-unbroken-teacher-authored-question-label-"+
 "so-that-classroom-instructions-remain-readable-and-never-crop-";
const cue=label=>'<section class="si-student-game-cue" data-si-tone="turn">'+
 '<span class="si-cue-app">'+label+'</span>'+
 '<strong class="si-cue-heading">'+LONG+'</strong>'+
 '<span class="si-cue-help">Please follow your teacher\'s directions before choosing.</span></section>';
const fixtures=[
 {name:"MILLION",selector:".million-student-actions button",text:".million-student-choice span",
  html:'<div class="student-prompt million-student command-seat">'+
  '<h2>'+LONG+'</h2><div class="million-student-choices">'+
  '<button class="million-student-choice"><b>A</b><span>'+LONG+'</span></button>'+
  '</div><div class="million-student-actions"><button>LOCK ANSWER</button></div></div>'},
 {name:"COSMIC CARDS",selector:".cc-device-actions button",text:".cc-turn-guide strong",
  html:'<div class="cc-device cc-cinematic"><div class="cc-turn-guide">'+
  '<strong>'+LONG+'</strong><span>Waiting for crew</span></div>'+
  '<div class="cc-device-status"><span>BLUE</span></div>'+
  '<div class="cc-device-actions"><button>DRAW CARD</button></div></div>'},
 {name:"DOMINOES",selector:".dm-device-controls button",text:".dm-device-center h3",
  html:'<div class="dm-device"><div class="dm-device-center"><h3>'+LONG+'</h3>'+
  '</div><div class="dm-device-controls"><button>DRAW</button></div></div>'},
 {name:"FOUR IN LINE",selector:".fil-drop-button",text:".fil-student-status",
  html:'<div class="fil-student"><div class="fil-student-status">'+LONG+'</div>'+
  '<div class="fil-columns" style="--fil-cols:7">'+
  Array.from({length:7},(_,i)=>'<button class="fil-drop-button">'+(i+1)+'</button>').join('')+
  '</div></div>'},
 {name:"SIGNAL SEQUENCE",selector:".ss-touch-key",text:".ss-student-status",
  html:'<div class="ss-student"><div class="ss-student-status">'+LONG+'</div>'+
  '<div class="ss-student-buttons"><button class="ss-touch-key">BLUE</button></div></div>'},
 {name:"CREW SURVEY",selector:".crew-survey-big-buzz",text:".si-cue-heading",
  html:'<div class="student-prompt"><button class="crew-survey-big-buzz">BUZZ IN</button></div>'},
 {name:"STAR WHEEL",selector:".starwheel-main-spin",text:".si-cue-heading",
  html:'<div class="student-prompt"><button class="starwheel-main-spin">SPIN</button>'+
  '<div class="starwheel-student-grid"><button>LETTER</button></div></div>'}
];
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const studentCtx=await browser.newContext({viewport:{width:440,height:780}});
 const teacherCtx=await browser.newContext({viewport:{width:1360,height:860}});
 const sharedCtx=await browser.newContext({viewport:{width:1280,height:720}});
 const student=await studentCtx.newPage(),teacher=await teacherCtx.newPage();
 const shared=await sharedCtx.newPage(),errors=[];
 for(const [name,page] of [["student",student],["teacher",teacher],["shared",shared]])
  page.on("pageerror",e=>errors.push(name+": "+String(e)));
 try{
  assert.equal((await teacherCtx.request.post(BASE+"/api/teacher/login",
     {data:{key:"5030"}})).status(),200);
  await teacher.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  await teacher.waitForFunction(()=>networkHydrated===true&&STUDENT_SESSION_ID,
    null,{timeout:18000});
  const sid=await teacher.evaluate(()=>STUDENT_SESSION_ID);
  await student.goto(BASE+"/?role=student",{waitUntil:"domcontentloaded",timeout:40000});
  await shared.goto(BASE+"/?role=shared&sid="+encodeURIComponent(sid),
    {waitUntil:"domcontentloaded",timeout:40000});
  await student.waitForSelector("#studentContent",{timeout:20000});
  await shared.waitForFunction(()=>networkHydrated===true&&!!window.FourLine,
    null,{timeout:20000});
  const metrics=[];
  for(const [width,height] of [[440,780],[390,670],[330,620]]){
   await student.setViewportSize({width,height});
   for(const example of fixtures){
    const view=await student.evaluate(({cueMarkup,html,selector,textSelector})=>{
     const root=document.querySelector("#studentContent");
     root.innerHTML=cueMarkup+html;
     const button=root.querySelector(selector),label=root.querySelector(textSelector);
     if(!button||!label)throw Error("Fixture selector missing");
     button.focus();
     const rect=x=>x.getBoundingClientRect();
     const r=rect(button),lr=rect(label),focus=getComputedStyle(button);
     return {
       outerOverflow:document.documentElement.scrollWidth-innerWidth,
       rootOverflow:root.scrollWidth-root.clientWidth,
       hitHeight:r.height,hitWidth:r.width,focusWidth:parseFloat(focus.outlineWidth),
       cueWidth:rect(root.querySelector(".si-student-game-cue")).width,
       contentWidth:root.clientWidth,
       longWordOverflow:label.scrollWidth-label.clientWidth,
       labelRight:lr.right,rootRight:rect(root).right
     };
    },{cueMarkup:cue(example.name),html:example.html,
       selector:example.selector,textSelector:example.text});
    assert.ok(view.outerOverflow<=2 && view.rootOverflow<=3,
      example.name+" cropped on "+width+"px: "+JSON.stringify(view));
    assert.ok(view.hitHeight>=44 && view.hitWidth>=28,
      example.name+" principal action is hard to touch: "+JSON.stringify(view));
    assert.ok(view.focusWidth>=3,
      example.name+" focus ring missing: "+JSON.stringify(view));
    assert.ok(view.longWordOverflow<=3 && view.labelRight<=view.rootRight+3,
      example.name+" long teacher text overflow: "+JSON.stringify(view));
    metrics.push({width,game:example.name,touch:Math.round(view.hitHeight)});
   }
  }
  const sharedReadability=await shared.evaluate(label=>{
   // A real Four In Line projector stage, with a long teacher-created team name.
   const game=FourLine.make(["Blue Group","Gold Group"]);
   const root=document.querySelector("#sharedContent");
   root.innerHTML=FourLine.publicHTML(game,true);
   const heading=root.querySelector(".fil-public .fil-info h3")||
     root.querySelector(".fil-public h2");
   if(!heading)throw Error("Four In Line shared heading missing");
   heading.textContent=label;
   const r=heading.getBoundingClientRect();
   return {right:r.right,rootRight:root.getBoundingClientRect().right,
     overflow:document.documentElement.scrollWidth-innerWidth,
     lineHeight:getComputedStyle(heading).lineHeight,
     breakRule:getComputedStyle(heading).overflowWrap};
  },LONG);
  assert.equal(sharedReadability.breakRule,"anywhere",
    "Teacher-written projector labels must wrap rather than widen the slide");
  assert.ok(sharedReadability.overflow<=3,JSON.stringify(sharedReadability));
  assert.deepEqual(errors,[],"no browser scripting errors");
  console.log("PHASE 4U RESPONSIVE CLASSROOM POLISH PASSED",JSON.stringify({
    cases:metrics.length,games:fixtures.length,widths:[440,390,330],
    smallestActionHeight:Math.min(...metrics.map(x=>x.touch)),
    projectorTextWrap:sharedReadability.breakRule
  }));
 }finally{
  await studentCtx.close();await teacherCtx.close();await sharedCtx.close();
  await browser.close();
 }
})().catch(err=>{console.error(err);process.exit(1)});
