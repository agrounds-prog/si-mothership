/* SI Mothership · cinematic projector activity transitions.
 * Purely visual. Never publishes state, modifies a game run or student data,
 * intercepts classroom input, or changes the teacher's lobby workflow. */
(()=>{
"use strict";
if(!document.body?.classList.contains("role-shared"))return;
if(window.__siActivityCinemaInstalled)return;
window.__siActivityCinemaInstalled=true;
const root=document.getElementById("sharedContent");
const shell=document.querySelector("#shared .shared-screen");
if(!root||!shell)return;
const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
let previous="";
let overlay=null;
const animationHTML='<div class="si-cinema-orbit" aria-hidden="true"><span></span></div>'+
 '<div class="si-cinema-hud" aria-hidden="true">'+
 '<span><i></i> SYSTEMS ONLINE</span>'+
 '<span>CHOOSE YOUR NEXT MISSION</span>'+
 '<span><i></i> READY TO LAUNCH</span>'+
 '</div>';
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
function launchEffect(){
 if(reduced())return;
 removeOverlay();
 const layer=document.createElement("div");
 layer.className="si-cinema-launch";
 layer.setAttribute("aria-hidden","true");
 layer.innerHTML='<span class="si-cinema-launch-ring"></span>'+
   '<span class="si-cinema-launch-title">MISSION LAUNCH</span>';
 layer.addEventListener("animationend",event=>{
   if(event.target===layer)removeOverlay();
 },{once:true});
 shell.appendChild(layer);
 overlay=layer;
}
function sync(){
 const kind=stageKind();
 if(kind==="activities"){
   const card=root.firstElementChild;
   if(!card.classList.contains("si-cinema-activities")){
     card.classList.add("si-cinema-activities");
     card.insertAdjacentHTML("beforeend",animationHTML);
   }else if(!card.querySelector(".si-cinema-hud")){
     card.insertAdjacentHTML("beforeend",animationHTML);
   }
 }
 // Launch only when leaving the teacher's Activities standby for a real
 // running activity. A projector reconnect, lobby return or slide repaint
 // must never replay a launch animation.
 if(previous==="activities"&&kind==="other" &&
    typeof state!=="undefined" &&
    state.activityRun?.phase==="running" &&
    !!state.activityRun?.activityId)launchEffect();
 if(kind==="activities"||kind==="lobby")removeOverlay();
 previous=kind;
}
const observer=new MutationObserver(sync);
observer.observe(root,{childList:true});
sync();
window.addEventListener("pagehide",()=>{observer.disconnect();removeOverlay()},{once:true});
window.__siActivityCinema={stageKind,version:"5A-2"};
})();
