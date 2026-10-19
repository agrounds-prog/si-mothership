/* Unified teacher controls · Phase 2D. Teacher-only visual HUD; existing actions remain authoritative. */
(()=>{
 "use strict";
 const params=new URLSearchParams(location.search);
 if(location.pathname!=="/teacher"&&params.get("role")!=="teacher")return;
 const game={
  "bingo-game":["BINGO",[["Call Next","#bingoCallNextBtn"]]],
  "match-game":["MATCH",[["Memory Boost","#matchMemoryPreviewBtn"],["Continue","#matchContinueBtn"]]],
  "million-game":["MILLION",[["Reveal Answer",'[data-million-show-action="reveal"]'],["Next Question",'[data-million-show-action="next"]']]],
  "cosmic-cards-game":["COSMIC CARDS",[["Skip Turn","#cosmicSkipBtn"]]],
  "cosmic-cards":["COSMIC CARDS",[["Skip Turn","#cosmicSkipBtn"]]],
  "dominoes-game":["DOMINOES",[["Draw Tile",'[data-dm-teacher="draw"]'],["Pass Turn",'[data-dm-teacher="pass"]'],["Save Game",'[data-dm-teacher="save"]']]],
  "four-in-line-game":["FOUR IN LINE",[["Undo Move",'[data-fil-action="undo"]'],["Save Game",'[data-fil-action="save"]']]],
  "signal-sequence-game":["SIGNAL SEQUENCE",[["Start / Next Round",'[data-ss-action="next"]'],["Retry Run",'[data-ss-action="retry"]'],["Save Game",'[data-ss-action="save"]']]]
 };
 const gameArt={"bingo-game":"▦","match-game":"◇","million-game":"✧","cosmic-cards-game":"✦","cosmic-cards":"✦","dominoes-game":"◈","four-in-line-game":"⦿","signal-sequence-game":"◉"};
 const safety=[
  ["Pause & Keep Progress",["#sendActivityLobbyBtn",'[data-fil-action="lobby"]']],
  ["Finish & Return",["#returnClassBtn",'[data-fil-action="exit"]','[data-ss-action="exit"]']]
 ];
 let panel,observer,key="";
 function run(){
  if(typeof SESSION_ROLE==="undefined"||SESSION_ROLE!=="teacher"||typeof state==="undefined"||state.ended)return null;
  const r=state.activityRun;
  return r&&game[r.activityId]&&["running","lobby"].includes(r.phase)?r:null;
 }
 function lookup(selectors,scope){
  for(const sel of selectors){
   const node=(scope||panel)?.querySelector(sel);
   if(node&&!node.closest("#siUnifiedTeacherDeck"))return node;
  }
  return null;
 }
 function label(r){
  if(r.phase==="lobby")return "LOBBY · READY";
  if(r.activityId==="bingo-game")return (r.bingo?.called||[]).length+" CALLED";
  if(r.activityId==="match-game")return r.match?.complete?"FINAL RESULTS":Math.floor((r.match?.matched||[]).length/2)+" PAIRS FOUND";
  if(r.activityId==="four-in-line-game")return (r.fourInLine?.moves||0)+" MOVES";
  if(r.activityId==="million-game")return r.million?.complete||r.million?.over?"FINAL RESULTS":"QUESTION "+(Number(r.million?.questionIndex||0)+1);
  if(r.activityId==="signal-sequence-game")return "ROUND "+(r.signalSequence?.round||0);
  return "GAME IN PROGRESS";
 }
 // A read-only teacher status model. Missing scores are omitted, not
 // synthesized; no data from this strip is sent to student/projector views.
 function portrait(name){
  const entry=(typeof state!=="undefined"&&Array.isArray(state.students)?state.students:[])
   .find(s=>s.n===name);
  if(!entry)return "◈";
  if(typeof avatarAsset==="function"){
   try{return String(avatarAsset(entry.avatarKey)?.glyph||"◈").slice(0,4)}catch(_){}
  }
  return "◈";
 }
 function statusModel(r){
  const id=r.activityId,bar={person:"",prompt:"CLASSROOM STATUS",metrics:[],progress:null};
  const playing=r.phase==="running";
  const metric=(name,value,active=false,kind="stat")=>bar.metrics.push({
   name:String(name),value:String(value),active:!!active,kind
  });
  const playerMetric=(name,value,active=false)=>metric(name,value,active,"player");
  const progress=(title,value,total)=>{
   const size=Number(total),now=Number(value);
   if(Number.isFinite(size)&&size>0&&Number.isFinite(now))
    bar.progress={title:String(title),value:Math.max(0,Math.min(size,now)),total:size};
  };
  if(id==="four-in-line-game"){
   const g=r.fourInLine||{},turn=Number(g.turn||0),winner=Number(g.winner);
   bar.person=g.status==="won"?(g.players?.[winner]||"Winner"):g.status==="draw"?"Draw game":g.players?.[turn]||"";
   bar.prompt=g.status==="playing"?"CURRENT TURN":"ROUND RESULT";
   (g.players||[]).forEach((n,i)=>playerMetric(n,
    g.status==="won"?(i===winner?"WINNER":"ROUND OVER"):
    g.status==="draw"?"DRAW":i===turn&&playing?"TO MOVE":"WAITING",
    g.status==="won"?i===winner:i===turn&&playing&&g.status==="playing"));
   metric("MOVES",Number(g.moves||0));
   if(g.cols&&g.rows){metric("BOARD",g.cols+" × "+g.rows);progress("BOARD FILLED",g.moves,g.cols*g.rows)}
  }else if(id==="dominoes-game"){
   const g=r.dominoes||{};
   bar.person=g.status==="won"?g.winner||"":g.players?.[Number(g.turn||0)]||"";
   bar.prompt=g.status==="playing"?"CURRENT PLAYER":"ROUND RESULT";
   (g.players||[]).forEach((n,i)=>playerMetric(n,Number(g.scores?.[n]||0)+" PTS",
    playing&&g.status==="playing"&&i===Number(g.turn||0)));
   if(g.winner&&g.status==="won")metric("WINNER",g.winner,true);
   metric("ROUND",Number(g.round||1));
   metric("DRAW PILE",(g.bag||[]).length);
  }else if(id==="cosmic-cards-game"||id==="cosmic-cards"){
   const g=r.cosmic||{};
   bar.person=g.status==="won"?g.winner||"":g.players?.[Number(g.turn||0)]||"";
   bar.prompt=g.status==="playing"?"CURRENT PLAYER":"ROUND RESULT";
   (g.players||[]).forEach((n,i)=>playerMetric(n,(g.hands?.[n]||[]).length+" CARDS",
    playing&&g.status==="playing"&&i===Number(g.turn||0)));
   if(g.winner&&g.status==="won")metric("WINNER",g.winner,true);
   if(g.color)metric("ACTIVE COLOR",String(g.color).toUpperCase());
   metric("DIRECTION",g.direction===-1?"COUNTERCLOCKWISE":"CLOCKWISE");
  }else if(id==="match-game"){
   const m=r.match||{},cfg=r.matchConfig||{};
   let active="";
   if(typeof matchActiveStudent==="function"){
    try{active=matchActiveStudent(r)?.n||""}catch(_){}
   }
   bar.person=m.complete?"All pairs found":active;
   bar.prompt=m.complete?"MISSION COMPLETE":m.pendingResolution?"PAIR REVEAL":"CURRENT NAVIGATOR";
   if(cfg.scoring==="no_score")metric("SCORING","MEMORY MODE");
   else if(cfg.mode==="teams"){
    const count=Math.max(2,Math.min(4,Number(cfg.teamCount||3)));
    for(let i=0;i<count;i++){
     let name="TEAM "+(i+1);
     if(typeof matchTeamMeta==="function"){
      try{name=matchTeamMeta(i)?.name||name}catch(_){}
     }
     playerMetric(name,Number(m.teamScores?.[i]||0)+" PTS",playing&&!m.complete&&Number(m.activeTeam||0)===i);
    }
   }else{
    const values=m.scores||{};
    const names=[...new Set([...(Array.isArray(state.students)?state.students.map(s=>s.n):[]),...Object.keys(values)])].slice(0,8);
    names.forEach(n=>playerMetric(n,Number(values[n]||0)+" PTS",playing&&!m.complete&&n===active));
   }
   metric("PAIRS",Math.floor((m.matched||[]).length/2)+" / "+Math.floor((m.cards||[]).length/2));
   progress("MATCHED PAIRS",Math.floor((m.matched||[]).length/2),Math.floor((m.cards||[]).length/2));
  }else if(id==="signal-sequence-game"){
   const g=r.signalSequence||{};
   const mode=String(g.mode||"classic");
   bar.person=mode==="survival"?"THE CREW":g.pilot||"";
   bar.prompt=g.phase==="success"?"ROUND CLEARED":
    g.phase==="failed"?"RUN COMPLETE":
    g.phase==="input"?(mode==="survival"?"CREW INPUT":"CURRENT NAVIGATOR"):
    g.phase==="watch"?"WATCH THE LIGHTS":"SEQUENCE STATUS";
   metric("MODE",mode.toUpperCase());
   metric("ROUND",Number(g.round||0));
   metric("BEST",Number(g.best||0));
   metric("PHASE",String(g.phase||"READY").toUpperCase());
   if(mode==="survival"){
    const people=Array.isArray(g.participants)?g.participants:[];
    const alive=people.filter(n=>g.entries?.[n]?.status!=="out").length;
    metric("CREW ACTIVE",alive+" / "+people.length);
   }else if(g.phase==="input"){
    metric("INPUT",Number(g.progress||0)+" / "+Number(g.round||0));
    progress("SEQUENCE INPUT",g.progress,g.round);
   }
  }else if(id==="million-game"){
   const m=r.million||{},c=r.millionConfig||{};
   bar.person=m.complete||m.over?"Round complete":m.pilot||m.player||"";
   bar.prompt=m.complete||m.over?"FINAL RESULTS":"QUESTION PROGRESS";
   const total=Number(c.questions?.length||0);
   const index=Number(m.questionIndex||0)+1;
   metric("QUESTION",index+(total?" / "+total:""));
   progress("QUESTION PROGRESS",index,total);
   metric("ANSWER",m.revealed?"REVEALED":m.lockedAnswer?"LOCKED":"AWAITING");
   if(m.complete||m.over){
    const ladder=Array.isArray(c.ladder)?c.ladder:[];
    const level=Math.min(ladder.length,Math.max(0,Number(m.ladderLevel)||0));
    const prize=level?Math.max(0,Number(ladder[level-1])||0):0;
    metric("FINAL POINTS",prize.toLocaleString("en-US")+" PTS");
   }
  }else if(id==="bingo-game"){
   const g=r.bingo||{};
   bar.person="Teacher calling";
   bar.prompt="LIVE CALL BOARD";
   metric("CALLED",(g.called||[]).length);
   if(Array.isArray(g.callOrder)&&g.callOrder.length){
    metric("TOTAL CALLS",g.callOrder.length);
    progress("ITEMS CALLED",(g.called||[]).length,g.callOrder.length);
   }
   metric("CALL ALERTS",g.studentCallAlerts===false?"OFF":"ON");
  }
  if(!playing){
   bar.person="Waiting for players";
   bar.prompt="LOBBY · READY TO START";
   bar.metrics.forEach(item=>item.active=false);
   bar.progress=null;
  }
  return bar;
 }
 function statusSignature(model){
  return [model.person,model.prompt,...model.metrics.map(x=>x.name+":"+x.value+":"+x.active+":"+x.kind),
   model.progress?model.progress.title+":"+model.progress.value+":"+model.progress.total:""].join("|");
 }
 function createStatus(model){
  const box=document.createElement("div");
  box.className="si-utc-live";
  const focus=document.createElement("div");
  focus.className="si-utc-turn";
  focus.setAttribute("role","status");
  focus.setAttribute("aria-live","polite");
  const glyph=document.createElement("span");
  glyph.className="si-utc-avatar";
  glyph.textContent=model.person?portrait(model.person):"◈";
  glyph.setAttribute("aria-hidden","true");
  const words=document.createElement("div");
  words.className="si-utc-turn-copy";
  const kicker=document.createElement("small");
  kicker.textContent=model.prompt;
  const name=document.createElement("strong");
  name.textContent=model.person||"Watch classroom";
  words.append(kicker,name);
  focus.append(glyph,words);
  box.append(focus);
  if(model.metrics.length){
   const scores=document.createElement("div");
   scores.className="si-utc-score-strip";
   scores.setAttribute("aria-label","Live game scores and progress");
   model.metrics.forEach(item=>{
    const chip=document.createElement("span");
    chip.className="si-utc-score"+(item.active?" is-active":"")+(item.kind==="player"?" is-player":"");
    if(item.kind==="player"){
     const avatar=document.createElement("i");
     avatar.className="si-utc-chip-avatar";
     avatar.setAttribute("aria-hidden","true");
     avatar.textContent=portrait(item.name);
     chip.append(avatar);
    }
    const n=document.createElement("small");
    n.textContent=item.name;
    const v=document.createElement("b");
    v.textContent=item.value;
    chip.append(n,v);
    scores.append(chip);
   });
   box.append(scores);
  }
  if(model.progress){
   const {title,value,total}=model.progress;
   const meter=document.createElement("div");meter.className="si-utc-progress";
   const info=document.createElement("div");info.className="si-utc-progress-label";
   const text=document.createElement("small");text.textContent=title;
   const valueText=document.createElement("strong");valueText.textContent=value+" / "+total;
   info.append(text,valueText);
   const track=document.createElement("div");
   track.className="si-utc-progress-track";track.setAttribute("role","progressbar");
   track.setAttribute("aria-label",title);track.setAttribute("aria-valuemin","0");
   track.setAttribute("aria-valuemax",String(total));track.setAttribute("aria-valuenow",String(value));
   const fill=document.createElement("span");fill.className="si-utc-progress-fill";
   fill.style.width=(value/total*100).toFixed(2)+"%";track.append(fill);
   meter.append(info,track);box.append(meter);
  }
  return box;
 }
 function button(title,target,isSafety){
  const el=document.createElement("button");
  el.type="button";
  el.className="si-utc-button"+(isSafety?" si-utc-session":"");
  if(/Finish|Return to Class$/.test(title))el.classList.add("si-utc-finish");
  el.textContent=title;
  el.setAttribute("aria-label",title);
  el.dataset.icon=/Next|Continue|Start/.test(title)?"→":/Save/.test(title)?"▣":/Undo|Retry/.test(title)?"↺":/Pause/.test(title)?"Ⅱ":/Return|Finish/.test(title)?"↩":/Draw/.test(title)?"⊕":/Reveal|Memory/.test(title)?"✧":"◆";
  el.disabled=target.disabled||target.getAttribute("aria-disabled")==="true";
  el.addEventListener("click",()=>{
   if(run()&&target.isConnected&&!target.disabled&&target.getAttribute("aria-disabled")!=="true")
    target.click();
  });
  return el;
 }
 function refresh(){
  const r=run(),now=document.querySelector("#activityControllerPanel");
  if(!r||!now){
   panel?.querySelector("#siUnifiedTeacherDeck")?.remove();
   key="";return;
  }
  panel=now;
  const info=game[r.activityId],gameActions=info[1].map(([title,selector])=>{
   const target=lookup([selector]);return target?{title,target}:null;
  }).filter(Boolean);
  const finished=(r.activityId==="match-game"&&!!r.match?.complete)||
   (r.activityId==="million-game"&&!!(r.million?.complete||r.million?.over));
  const sessionActions=safety.map(([title,selectors])=>{
   if(finished&&title==="Finish & Return")title="Return to Class";
   const target=lookup(selectors);return target?{title,target}:null;
  }).filter(Boolean);
  const lesson=document.querySelector("#siPlusActivityResume");
  if(lesson&&lesson.getClientRects().length&&getComputedStyle(lesson).visibility!=="hidden")
   sessionActions.push({title:"Return to SI+",target:lesson});
  if(!gameActions.length&&!sessionActions.length){
   panel.querySelector("#siUnifiedTeacherDeck")?.remove();key="";return;
  }
  const all=gameActions.concat(sessionActions);
  const model=statusModel(r);
  const stamp=info[0]+"|"+r.phase+"|"+label(r)+"|"+statusSignature(model)+"|"+all.map(a=>a.title+":"+a.target.disabled+":"+a.target.getAttribute("aria-disabled")).join("|");
  let dock=panel.querySelector("#siUnifiedTeacherDeck");
  if(dock&&stamp===key&&dock.__originals?.length===all.length&&all.every((a,i)=>dock.__originals[i]===a.target))return;
  if(!dock){
   dock=document.createElement("section");
   dock.id="siUnifiedTeacherDeck";
   dock.className="si-utc-deck";
   dock.setAttribute("aria-label","Unified teacher quick controls");
   panel.prepend(dock);
  }
  dock.dataset.game=r.activityId;
  dock.dataset.phase=r.phase;
  dock.dataset.finished=finished?"true":"false";
  const header=document.createElement("div");
  header.className="si-utc-head";
  const emblem=document.createElement("span");
  emblem.className="si-utc-emblem";
  emblem.setAttribute("aria-hidden","true");
  emblem.textContent=gameArt[r.activityId]||"✦";
  const title=document.createElement("div");
  title.className="si-utc-title";
  const kicker=document.createElement("small");kicker.textContent="◈ MISSION CONTROL";
  const name=document.createElement("strong");name.textContent=info[0];
  title.append(kicker,name);
  const status=document.createElement("span");
  status.className="si-utc-status";status.textContent=label(r);
  header.append(emblem,title,status);
  const rows=document.createElement("div");rows.className="si-utc-rows";
  function row(label,actions,safe){
   if(!actions.length)return;
   const container=document.createElement("div");
   container.className="si-utc-row";
   const caption=document.createElement("span");
   caption.className="si-utc-caption";caption.textContent=label;
   container.append(caption,...actions.map(a=>button(a.title,a.target,safe)));
   rows.append(container);
  }
  row("GAME",gameActions,false);
  row("CLASSROOM",sessionActions,true);
  if(finished){
   const note=document.createElement("p");
   note.className="si-utc-complete-note";
   note.setAttribute("role","status");
   note.textContent="Game complete · review the results, then return to class.";
   dock.replaceChildren(header,createStatus(model),note,rows);
  }else dock.replaceChildren(header,createStatus(model),rows);
  dock.__originals=all.map(a=>a.target);
  key=stamp;
 }
 // Phase 2E · Shared classroom game setup header. Never changes setup
 // controls, native handlers, game drafts, saved files, or launch behavior.
 // Most games render inside #activityGrid; the Four In Line and Signal
 // Sequence bridges use the same host and are recognized by actual markup.
 const setupGames={
  "bingo":{selector:".bbs-studio",title:"BINGO BOARD STUDIO",icon:"▦",accent:"gold",
   summary:"Upload or choose your pictures, arrange the board, then save and launch.",
   stages:["Choose pictures","Build your board","Save & launch"]},
  "match":{selector:".mcb-shell",title:"MATCH BUILDER",icon:"◇",accent:"violet",
   summary:"Choose matching content, configure the players and launch a memory challenge.",
   stages:["Build pairs","Set game rules","Save & launch"]},
  "million":{selector:".ms-studio",title:"MILLION GAME STUDIO",icon:"✧",accent:"gold",
   summary:"Write your questions, configure lifelines and save a complete game show.",
   stages:["Write questions","Configure the show","Save & launch"]},
  "cosmic-cards":{selector:".cc-setup",title:"COSMIC CARDS",icon:"✦",accent:"pink",
   summary:"Select the crew, choose how turns advance and launch the card game.",
   stages:["Choose turn rule","Select players","Launch game"]},
  "dominoes":{selector:".dm-setup",title:"DOMINOES",icon:"◈",accent:"mint",
   summary:"Select two to four players, decide if the teacher plays and deal the tiles.",
   stages:["Choose players","Assign the teacher","Start game"]},
  "word-grid":{selector:".wg-setup",title:"WORD GRID",icon:"▤",accent:"mint",
   summary:"Create teams, place students and launch your word-building challenge.",
   stages:["Name teams","Assign students","Start game"]},
  "four-in-line":{selector:".fil-setup",title:"FOUR IN LINE",icon:"⦿",accent:"blue",
   summary:"Choose board size and sides, assign students and start the strategy game.",
   stages:["Game settings","Assign crew","Start game"]},
  "signal-sequence":{selector:".ss-setup",title:"SIGNAL SEQUENCE",icon:"◉",accent:"orange",
   summary:"Choose a memory mode, configure the lights and assign the crew.",
   stages:["Choose mode","Assign pilots","Start game"]},
  "minefield":{selector:".minefield-setup",title:"MINEFIELD",icon:"✹",accent:"orange",
   summary:"Choose a classroom mode, set the mission length and clear the map together.",
   stages:["Choose mode","Set difficulty","Launch mission"]},
  "crew-survey":{selector:".crew-survey-setup",title:"CREW SURVEY",icon:"▥",accent:"blue",
   summary:"Write the survey prompt, add hidden answers and choose communication supports.",
   stages:["Write the survey","Set up teams","Launch game"]},
  "scientific-calculator":{selector:".calculator-setup-panel",title:"SCIENTIFIC CALCULATOR",icon:"▣",accent:"blue",
   summary:"Choose number settings, then open or share the calculator with your class.",
   stages:["Choose settings","Preview tool","Open or share"]}
 };
 function syncSetup(){
  if(typeof state==="undefined"||typeof SESSION_ROLE==="undefined"||SESSION_ROLE!=="teacher")return;
  const host=document.getElementById("activitiesPanel"),grid=document.getElementById("activityGrid");
  if(!host||!grid)return;
  let app=String(state.activeApp||""),config=setupGames[app];
  if(!config||state.activityRun||state.assigningSlot!==null||!grid.querySelector(config.selector)){
   app="";config=null;
   // Bridge games can render a native setup before state.activeApp updates.
   if(!state.activityRun&&state.assigningSlot===null){
    for(const [candidate,option] of Object.entries(setupGames)){
     if(grid.querySelector(option.selector)){app=candidate;config=option;break}
    }
   }
  }
  const old=host.querySelector("#siGameSetupGuide");
  if(!config){
   old?.remove();
   host.classList.remove("si-setup-view");
   host.removeAttribute("data-si-setup");
   return;
  }
  host.classList.add("si-setup-view");
  host.dataset.siSetup=app;
  if(old?.dataset.siSetupApp===app)return;
  old?.remove();
  const banner=document.createElement("section");
  banner.id="siGameSetupGuide";banner.className="si-setup-guide";
  banner.dataset.siSetupApp=app;banner.dataset.accent=config.accent;
  banner.setAttribute("aria-label",config.title+" setup instructions");
  const identity=document.createElement("div");identity.className="si-setup-identity";
  const emblem=document.createElement("span");emblem.className="si-setup-emblem";
  emblem.setAttribute("aria-hidden","true");emblem.textContent=config.icon;
  const copy=document.createElement("div");copy.className="si-setup-guide-copy";
  const kicker=document.createElement("small");kicker.textContent="MISSION CONTROL · GAME SETUP";
  const name=document.createElement("h3");name.textContent=config.title;
  const intro=document.createElement("p");intro.textContent=config.summary;
  copy.append(kicker,name,intro);identity.append(emblem,copy);
  const steps=document.createElement("ol");steps.className="si-setup-steps";
  config.stages.forEach((step,i)=>{
   const item=document.createElement("li");
   const number=document.createElement("b");number.textContent=String(i+1).padStart(2,"0");
   const label=document.createElement("span");label.textContent=step;
   item.append(number,label);steps.append(item);
  });
  banner.append(identity,steps);
  grid.before(banner);
 }
 let setupObserver,setupHost;
 function watchSetup(){
  const grid=document.getElementById("activityGrid");
  if(grid&&grid!==setupHost){
   setupObserver?.disconnect();setupHost=grid;
   setupObserver=new MutationObserver(()=>requestAnimationFrame(syncSetup));
   setupObserver.observe(grid,{childList:true});
  }
  syncSetup();
 }
 let pending=false;
 function enqueue(){
  if(pending)return;
  pending=true;
  requestAnimationFrame(()=>{pending=false;refresh()});
 }
 function observe(){
  const next=document.querySelector("#activityControllerPanel");
  if(next&&next!==panel){
   observer?.disconnect();panel=next;key="";
   observer=new MutationObserver(enqueue);
   observer.observe(next,{childList:true,subtree:true,attributes:true,attributeFilter:["disabled","aria-disabled"]});
  }
  enqueue();
 }
 function install(){
  if(typeof SESSION_ROLE==="undefined"||SESSION_ROLE!=="teacher")return;
  observe();watchSetup();setInterval(()=>{observe();watchSetup()},1100);
  window.__siUnifiedTeacherControls={refresh,syncSetup,version:"2E"};
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
 else install();
})();
