/* SI Mothership · Shared Screen cinematic transitions.
 * Presentation-only. Never writes game state, touches persistent storage,
 * intercepts a student's input, or changes the teacher's lobby workflow. */
(()=>{
"use strict";
if(!document.body?.classList.contains("role-shared"))return;
if(window.__siActivityCinemaInstalled)return;
window.__siActivityCinemaInstalled=true;
const root=document.getElementById("sharedContent");
const shell=document.querySelector("#shared .shared-screen");
if(!root||!shell)return;
const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
const gameTitles=Object.freeze({
 "bingo-game":{key:"bingo",title:"BINGO",subtitle:"WATCH · LISTEN · MARK YOUR CARD",kicker:"CLASSROOM CHALLENGE"},
 "million-game":{key:"million",title:"MILLION",subtitle:"THE NEXT QUESTION AWAITS",kicker:"THE GRAND CHALLENGE"},
 "match-game":{key:"match",title:"MATCH",subtitle:"FIND THE CONNECTION",kicker:"MEMORY MISSION"},
 "pixel-game":{key:"pixel",title:"PIXEL REVEAL",subtitle:"UNCOVER THE UNKNOWN",kicker:"IMAGE DISCOVERY"},
 "orbit-game":{key:"orbit",title:"ORBIT",subtitle:"EXPLORE THE GALAXY TOGETHER",kicker:"SOLAR SYSTEM MISSION"},
 "cosmic-cards-game":{key:"cosmic",title:"COSMIC CARDS",subtitle:"PLAY YOUR HAND · RULE THE STARS",kicker:"GALACTIC CARD CHALLENGE"},
 "dominoes-game":{key:"dominoes",title:"DOMINOES",subtitle:"CONNECT THE TILES · BUILD THE CHAIN",kicker:"CREW CONNECTION"},
 "four-in-line-game":{key:"four",title:"FOUR IN LINE",subtitle:"MAKE YOUR MOVE · CONNECT FOUR",kicker:"GALACTIC GRID SHOWDOWN"}
});
const icons=Object.freeze({
 bingo:'<rect x="10" y="10" width="11" height="11" rx="2"/><rect x="27" y="10" width="11" height="11" rx="2"/><rect x="10" y="27" width="11" height="11" rx="2"/><path d="m29 32 4 4 7-10"/>',
 million:'<path d="M24 4 32 16 44 24 32 32 24 44 16 32 4 24 16 16Z"/><path d="M24 15v18M17 21h14M17 29h14"/>',
 match:'<rect x="5" y="10" width="18" height="23" rx="4"/><rect x="25" y="15" width="18" height="23" rx="4"/><path d="m10 21 5 5 6-9M30 26l4 4 6-9"/>',
 pixel:'<rect x="5" y="5" width="18" height="18" rx="2"/><rect x="25" y="5" width="18" height="18" rx="2"/><rect x="5" y="25" width="18" height="18" rx="2"/><path d="m28 34 5 5 10-13"/>',
 orbit:'<circle cx="24" cy="24" r="9"/><ellipse cx="24" cy="24" rx="21" ry="9" transform="rotate(-27 24 24)"/><circle cx="7" cy="27" r="3" fill="currentColor"/><circle cx="35" cy="9" r="2.5" fill="currentColor"/>',
 cosmic:'<rect x="6" y="9" width="23" height="31" rx="4" transform="rotate(-13 17 24)"/><rect x="19" y="6" width="23" height="31" rx="4" transform="rotate(9 30 21)"/><path d="m30 13 3 5 6 1-4.5 4 1 6-5.5-3-5 3 1-6-4-4 6-.8Z"/>',
 dominoes:'<rect x="10" y="4" width="28" height="40" rx="5"/><path d="M10 24h28"/><circle cx="20" cy="14" r="2" fill="currentColor"/><circle cx="29" cy="33" r="2" fill="currentColor"/><circle cx="20" cy="33" r="2" fill="currentColor"/>',
 four:'<rect x="6" y="8" width="36" height="32" rx="4"/><circle cx="15" cy="16" r="3" fill="currentColor"/><circle cx="24" cy="16" r="3" fill="currentColor"/><circle cx="33" cy="16" r="3" fill="currentColor"/><circle cx="15" cy="25" r="3" fill="currentColor"/><circle cx="24" cy="25" r="3" fill="currentColor"/><circle cx="33" cy="25" r="3"/><path d="M15 35h18" stroke-width="4"/>'
});
const decoration='<div class="si-cinema-orbit" aria-hidden="true"><span></span></div>'+
 '<div class="si-cinema-hud" aria-hidden="true">'+
 '<span><i></i> SYSTEMS ONLINE</span>'+
 '<span>CHOOSE YOUR NEXT MISSION</span>'+
 '<span><i></i> READY TO LAUNCH</span>'+
 '</div>';
let previous="";
let armed=false;
let overlay=null;
const alreadyLaunched=new Set();
function stageKind(){
 const first=root.firstElementChild;
 if(!first||root.children.length!==1)return "other";
 if(first.classList.contains("join-lobby"))return "lobby";
 const eyebrow=first.querySelector(":scope > .eyebrow");
 const heading=first.querySelector(":scope > h3");
 if(eyebrow?.textContent?.trim()==="CLASSROOM LIVE" &&
    heading?.textContent?.trim()==="ACTIVITIES")return "activities";
 return "other";
}
function removeOverlay(){
 overlay?.remove();overlay=null;
}
function activeRun(){
 return typeof state==="undefined"?null:state.activityRun;
}
function launchEffect(activityId){
 if(reduced())return;
 removeOverlay();
 const scene=gameTitles[activityId]||null;
 const layer=document.createElement("div");
 layer.className="si-cinema-launch"+(scene?" si-cinema-launch--branded":"");
 layer.setAttribute("aria-hidden","true");
 if(scene){
   layer.dataset.game=scene.key;
   // Only hardcoded app metadata is inserted. No student or teacher text.
   layer.innerHTML='<span class="si-cinema-launch-ring"></span>'+
     '<span class="si-cinema-launch-kicker">'+scene.kicker+'</span>'+
     '<span class="si-cinema-launch-icon"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+icons[scene.key]+'</svg></span>'+
     '<strong class="si-cinema-launch-game-title">'+scene.title+'</strong>'+
     '<span class="si-cinema-launch-subtitle">'+scene.subtitle+'</span>';
 }else{
   layer.innerHTML='<span class="si-cinema-launch-ring"></span>'+
     '<span class="si-cinema-launch-title">MISSION LAUNCH</span>';
 }
 layer.addEventListener("animationend",event=>{
   if(event.target===layer&&overlay===layer)removeOverlay();
 },{once:true});
 shell.appendChild(layer);
 overlay=layer;
}
function sync(){
 const kind=stageKind();
 const run=activeRun();
 if(kind==="activities"){
   armed=true;
   const card=root.firstElementChild;
   if(!card.classList.contains("si-cinema-activities")){
     card.classList.add("si-cinema-activities");
     card.insertAdjacentHTML("beforeend",decoration);
   }else if(!card.querySelector(".si-cinema-hud")){
     card.insertAdjacentHTML("beforeend",decoration);
   }
 }
 // The projector must see a local activity-selection scene before a launch.
 // This prevents a tab opened/reloaded midway through a running game from
 // replaying a title, and skips ordinary board/slide redraws.
 if(armed&&kind==="other"&&run?.phase==="running"&&run.activityId){
   const launchKey=String(run.activityId)+"|"+String(run.runToken||run.startedAt||"");
   if(!alreadyLaunched.has(launchKey)){
     launchEffect(run.activityId);
     alreadyLaunched.add(launchKey);
     if(alreadyLaunched.size>24)alreadyLaunched.delete(alreadyLaunched.values().next().value);
   }
   armed=false;
 }
 if(kind==="activities"||kind==="lobby")removeOverlay();
 if(kind==="lobby")armed=false;
 previous=kind;
}
const observer=new MutationObserver(sync);
observer.observe(root,{childList:true});
sync();
window.addEventListener("pagehide",()=>{observer.disconnect();removeOverlay()},{once:true});
window.__siActivityCinema={stageKind,version:"5A-4",gameTitles};
})();