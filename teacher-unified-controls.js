/* Unified teacher controls · Phase 2A. Actions use existing game buttons. */
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
  if(r.activityId==="match-game")return Math.floor((r.match?.matched||[]).length/2)+" PAIRS FOUND";
  if(r.activityId==="four-in-line-game")return (r.fourInLine?.moves||0)+" MOVES";
  if(r.activityId==="million-game")return "QUESTION "+(Number(r.million?.questionIndex||0)+1);
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
  const id=r.activityId,bar={person:"",prompt:"CLASSROOM STATUS",metrics:[]};
  const metric=(name,value,active=false)=>bar.metrics.push({name:String(name),value:String(value),active:!!active});
  if(id==="four-in-line-game"){
   const g=r.fourInLine||{},turn=Number(g.turn||0),winner=Number(g.winner);
   bar.person=g.status==="won"?(g.players?.[winner]||"Winner"):g.status==="draw"?"Draw game":g.players?.[turn]||"";
   bar.prompt=g.status==="playing"?"CURRENT TURN":"ROUND RESULT";
   (g.players||[]).forEach((n,i)=>metric(n,g.status==="won"&&i===winner?"WINNER":i===turn&&g.status==="playing"?"TO MOVE":"WAITING",i===turn&&g.status==="playing"));
   metric("MOVES",Number(g.moves||0));
  }else if(id==="dominoes-game"){
   const g=r.dominoes||{};
   bar.person=g.status==="won"?g.winner||"":g.players?.[Number(g.turn||0)]||"";
   bar.prompt=g.status==="playing"?"CURRENT PLAYER":"ROUND RESULT";
   (g.players||[]).forEach((n,i)=>metric(n,Number(g.scores?.[n]||0)+" PTS",g.status==="playing"&&i===Number(g.turn||0)));
   metric("DRAW PILE",(g.bag||[]).length);
  }else if(id==="cosmic-cards-game"||id==="cosmic-cards"){
   const g=r.cosmic||{};
   bar.person=g.status==="won"?g.winner||"":g.players?.[Number(g.turn||0)]||"";
   bar.prompt=g.status==="playing"?"CURRENT PLAYER":"ROUND RESULT";
   (g.players||[]).forEach((n,i)=>metric(n,(g.hands?.[n]||[]).length+" CARDS",
    g.status==="playing"&&i===Number(g.turn||0)));
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
     metric(name,Number(m.teamScores?.[i]||0)+" PTS",Number(m.activeTeam||0)===i);
    }
   }else{
    const values=m.scores||{};
    const names=[...new Set([...(Array.isArray(state.students)?state.students.map(s=>s.n):[]),...Object.keys(values)])].slice(0,8);
    names.forEach(n=>metric(n,Number(values[n]||0)+" PTS",n===active));
   }
   metric("PAIRS",Math.floor((m.matched||[]).length/2)+" / "+Math.floor((m.cards||[]).length/2));
  }else if(id==="signal-sequence-game"){
   const g=r.signalSequence||{};
   bar.person=g.pilot||"";
   bar.prompt=g.phase==="success"?"ROUND CLEARED":g.phase==="input"?"AWAITING INPUT":"SEQUENCE STATUS";
   metric("ROUND",Number(g.round||0));
   metric("BEST",Number(g.best||0));
   metric("PHASE",String(g.phase||"READY").toUpperCase());
  }else if(id==="million-game"){
   const m=r.million||{},c=r.millionConfig||{};
   bar.person=m.complete||m.over?"Round complete":m.pilot||m.player||"";
   bar.prompt="QUESTION PROGRESS";
   metric("QUESTION",Number(m.questionIndex||0)+1);
   const total=Number(c.questions?.length||0);
   if(total)metric("TOTAL",total);
   metric("ANSWER",m.revealed?"REVEALED":m.lockedAnswer?"LOCKED":"AWAITING");
  }else if(id==="bingo-game"){
   const g=r.bingo||{};
   bar.person="Teacher calling";
   bar.prompt="LIVE CALL BOARD";
   metric("CALLED",(g.called||[]).length);
   metric("CALL ALERTS",g.studentCallAlerts===false?"OFF":"ON");
  }
  return bar;
 }
 function statusSignature(model){
  return [model.person,model.prompt,...model.metrics.map(x=>x.name+":"+x.value+":"+x.active)].join("|");
 }
 function createStatus(model){
  const box=document.createElement("div");
  box.className="si-utc-live";
  const focus=document.createElement("div");
  focus.className="si-utc-turn";
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
    chip.className="si-utc-score"+(item.active?" is-active":"");
    const n=document.createElement("small");
    n.textContent=item.name;
    const v=document.createElement("b");
    v.textContent=item.value;
    chip.append(n,v);
    scores.append(chip);
   });
   box.append(scores);
  }
  return box;
 }
 function button(title,target,isSafety){
  const el=document.createElement("button");
  el.type="button";
  el.className="si-utc-button"+(isSafety?" si-utc-session":"");
  if(/Finish/.test(title))el.classList.add("si-utc-finish");
  el.textContent=title;
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
  const sessionActions=safety.map(([title,selectors])=>{
   const target=lookup(selectors);return target?{title,target}:null;
  }).filter(Boolean);
  const lesson=document.querySelector("#siPlusActivityResume");
  if(lesson&&lesson.getClientRects().length&&getComputedStyle(lesson).visibility!=="hidden")
   sessionActions.push({title:"Return to SI+",target:lesson});
  if(!gameActions.length&&!sessionActions.length)return;
  const all=gameActions.concat(sessionActions);
  const model=statusModel(r);
  const stamp=info[0]+"|"+label(r)+"|"+statusSignature(model)+"|"+all.map(a=>a.title+":"+a.target.disabled+":"+a.target.getAttribute("aria-disabled")).join("|");
  let dock=panel.querySelector("#siUnifiedTeacherDeck");
  if(dock&&stamp===key&&dock.__originals?.length===all.length&&all.every((a,i)=>dock.__originals[i]===a.target))return;
  if(!dock){
   dock=document.createElement("section");
   dock.id="siUnifiedTeacherDeck";
   dock.className="si-utc-deck";
   dock.setAttribute("aria-label","Unified teacher quick controls");
   panel.prepend(dock);
  }
  const header=document.createElement("div");
  header.className="si-utc-head";
  const title=document.createElement("div");
  title.className="si-utc-title";
  const kicker=document.createElement("small");kicker.textContent="◈ MISSION CONTROL";
  const name=document.createElement("strong");name.textContent=info[0];
  title.append(kicker,name);
  const status=document.createElement("span");
  status.className="si-utc-status";status.textContent=label(r);
  header.append(title,status);
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
  dock.replaceChildren(header,createStatus(model),rows);
  dock.__originals=all.map(a=>a.target);
  key=stamp;
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
  observe();setInterval(observe,1100);
  window.__siUnifiedTeacherControls={refresh,version:"2B"};
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
 else install();
})();
