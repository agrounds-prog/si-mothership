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
  const stamp=info[0]+"|"+label(r)+"|"+all.map(a=>a.title+":"+a.target.disabled+":"+a.target.getAttribute("aria-disabled")).join("|");
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
  dock.replaceChildren(header,rows);
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
  window.__siUnifiedTeacherControls={refresh,version:"2A"};
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
 else install();
})();
