/* Cosmic Cards visual/role regression — synthetic in-memory hands only.
 * Exercises the actual production markup and CSS; never starts a live round
 * or sends any classroom actions to the server. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const base=process.env.LOCAL_URL||"http://127.0.0.1:8877";
function fixture(){
 const alex=[
  {id:"a-red",color:"red",value:"3"},
  {id:"private-sapphire-special",color:"blue",value:"skip"},
  {id:"a-wild",color:"wild",value:"wild"}
 ];
 const blair=[{id:"secret-blair-card",color:"yellow",value:"8"}];
 return {activityId:"cosmic-cards-game",runToken:"cosmic-fixture",phase:"running",
  cosmic:{players:["Alex","Blair"],hands:{Alex:alex,Blair:blair},
   deck:Array.from({length:12},(_,i)=>({id:"deck-"+i,color:"green",value:"5"})),
   discard:[{id:"top-red",color:"red",value:"9"}],color:"red",
   turn:0,direction:1,drawnId:"",chainOpen:false,turnRule:"next",
   called:{},status:"playing",winner:null,round:1,
   message:"Waiting for the current pilot.",avatarImages:{}}};
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const students=await browser.newContext({viewport:{width:440,height:780}});
 const classroom=await browser.newContext({viewport:{width:1366,height:768}});
 const student=await students.newPage(),teacher=await classroom.newPage();
 const errors=[];
 student.on("pageerror",e=>errors.push("student: "+String(e)));
 teacher.on("pageerror",e=>errors.push("teacher: "+String(e)));
 try{
  for(const [page,role] of [[student,"student"],[teacher,"teacher"]]){
   const response=await page.goto(base+"/?role="+role,{waitUntil:"domcontentloaded",timeout:40000});
   assert.equal(response.status(),200);
   await page.waitForFunction(()=>typeof cosmicStudentMarkup==="function"&&
      typeof cosmicTeacherMarkup==="function"&&typeof cosmicTableMarkup==="function",null,{timeout:15000});
   assert.equal((await page.request.get(base+"/cosmic-cards.css")).status(),200);
  }
  for(const width of [330,390,440]){
   await student.setViewportSize({width,height:780});
   const s=await student.evaluate(({run,width})=>{
    state.students=[{n:"Alex",offline:false},{n:"Blair",offline:false}];
    state.activityRun=run;
    const root=document.querySelector("#student");
    if(!root)throw Error("The student view is missing");
    root.innerHTML='<div class="device" style="width:100%;max-width:100%">'+
      '<div class="device-main">'+cosmicStudentMarkup({n:"Alex"})+'</div></div>';
    root.style.display="block";root.style.width="100%";
    root.style.maxWidth="100%";root.style.position="relative";
    root.style.margin="0";root.style.padding="0";
    const read=()=>{const device=root.querySelector(".cc-device");
      const frame=device.getBoundingClientRect();
      const guide=device.querySelector(".cc-turn-guide");
      const cards=[...device.querySelectorAll(".cc-hand-button")];
      return {heading:device.querySelector("h2")?.textContent,
       cue:guide?.textContent,cueState:guide?.dataset.turnState,
       handText:device.querySelector(".cc-hand-heading")?.textContent,
       playable:cards.filter(b=>b.classList.contains("cc-playable")).length,
       disabled:cards.filter(b=>b.disabled).length,
       markers:device.querySelectorAll(".cc-playable-label").length,
       cardRects:cards.map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height}}),
       width:frame.width,overflow:document.documentElement.scrollWidth-innerWidth,
       otherFace:device.innerHTML.includes("secret-blair-card")};
    };
    const active=read();
    state.activityRun.cosmic.turn=1;root.querySelector(".device-main").innerHTML=cosmicStudentMarkup({n:"Alex"});
    const waiting=read();
    state.activityRun.cosmic.turn=0;state.activityRun.cosmic.drawnId="a-red";
    root.querySelector(".device-main").innerHTML=cosmicStudentMarkup({n:"Alex"});
    const drawn=read(),hasPass=!!root.querySelector("#cosmicPassBtn");
    state.activityRun.cosmic.drawnId="";state.activityRun.cosmic.chainOpen=true;
    root.querySelector(".device-main").innerHTML=cosmicStudentMarkup({n:"Alex"});
    const chain=read(),endTurn=!!root.querySelector("#cosmicPassBtn");
    return {width,active,waiting,drawn,hasPass,chain,endTurn};
   },{run:fixture(),width});
   assert.match(s.active.heading,/YOUR TURN/i);
   assert.equal(s.active.cueState,"active");
   assert.match(s.active.cue,/2 PLAYABLE CARDS/i);
   assert.equal(s.active.playable,2);
   assert.equal(s.active.disabled,1);
   assert.equal(s.active.markers,2);
   assert.equal(s.active.otherFace,false,"A student must not see another hand");
   assert.ok(s.active.cardRects.every(r=>r.w>=43&&r.h>=65),
      "Cards remain touch-sized at "+width);
   assert.ok(s.active.width<=width+2&&s.active.width>200,
      "Student game must fit compact window "+JSON.stringify(s.active));
   assert.equal(s.waiting.cueState,"waiting");
   assert.equal(s.waiting.disabled,3,"Non-current players cannot play a card");
   assert.equal(s.drawn.cueState,"drawn");
   assert.equal(s.drawn.playable,1,"Only the drawn card can be played after drawing");
   assert.equal(s.hasPass,true,"Existing Pass action remains available");
   assert.equal(s.chain.cueState,"chain");
   assert.equal(s.endTurn,true,"Existing End Turn action remains available");
  }
  // Teacher receives a private controller; public/teacher preview never reveal
  // player hands unless the existing Show Hands teacher toggle is used.
  const teacherState=await teacher.evaluate(run=>{
   state.students=[{n:"Alex",offline:false},{n:"Blair",offline:false}];
   state.activityRun=run;
   cosmicTeacherReveal=false;
   const shell=document.createElement("div");
   shell.innerHTML=cosmicTeacherMarkup();
   const text=shell.querySelector(".cc-teacher-turn")?.textContent||"";
   const publicHTML=shell.querySelector(".cc-public")?.innerHTML||"";
   return {text,handShown:!!shell.querySelector(".cc-teacher-hands"),
    publicHasSecret:publicHTML.includes("secret-blair-card"),
    gameControls:["#cosmicSkipBtn","#cosmicRematchBtn","#cosmicReselectBtn",
      "#sendActivityLobbyBtn","#returnClassBtn"].every(id=>!!shell.querySelector(id)),
    sharedTurn:shell.querySelector(".cc-turn-hint")?.textContent||"",
    current:shell.querySelector(".cc-player.active .cc-player-name b")?.textContent};
  },fixture());
  assert.equal(teacherState.handShown,false,"Teacher-only Show Hands stays opt-in");
  assert.equal(teacherState.publicHasSecret,false,"Projector never exposes private hand ids");
  assert.equal(teacherState.gameControls,true,"Original teacher actions must remain");
  assert.equal(teacherState.current,"Alex");
  assert.match(teacherState.text,/CURRENT TURN.*Alex.*MATCH THE COLOR/i);
  assert.match(teacherState.sharedTurn,/MATCH THE COLOR OR SYMBOL/);
  // Test the real shared markup's playable surface and visible current-turn cue
  // without sending state across classrooms or mutating saved games.
  const publicState=await teacher.evaluate(run=>{
   state.activityRun=run;
   const root=document.createElement("div");
   root.innerHTML=cosmicTableMarkup(run,true);
   const table=root.querySelector(".cc-public");
   const content=table.textContent||"";
   return {turn:table.querySelector(".cc-turn")?.textContent,
    active:table.querySelector(".cc-player.active .cc-player-name b")?.textContent,
    count:table.querySelectorAll(".cc-player").length,
    discard:table.querySelector(".cc-live-card .cc-card b")?.textContent,
    cards:[...table.querySelectorAll(".cc-player-count strong")].map(c=>c.textContent),
    hidden:root.innerHTML.includes("secret-blair-card"),
    color:table.querySelector(".cc-reactor b")?.textContent,
    turnGuide:!!table.querySelector(".cc-turn-hint")};
  },fixture());
  assert.equal(publicState.active,"Alex");
  assert.match(publicState.turn,/MATCH THE COLOR OR SYMBOL/);
  assert.equal(publicState.hidden,false);
  assert.equal(publicState.count,2);
  assert.equal(publicState.discard,"9");
  assert.equal(publicState.color,"RED");
  assert.equal(publicState.turnGuide,true);
  assert.deepEqual(publicState.cards,["3 CARDS","1 CARDS"]);
  assert.deepEqual(errors,[],"Browser scripts should remain error-free");
  console.log("COSMIC CARDS POLISH PASS",JSON.stringify({teacher:teacherState,public:publicState,
   studentWidths:[330,390,440],errors}));
 }finally{
  await students.close();await classroom.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
