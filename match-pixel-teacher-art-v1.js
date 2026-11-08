/* MATCH + PIXEL REVEAL teacher artwork V1
   Adds visual classes only; never rewires buttons, changes game state, or
   touches teacher/student sync. Works in the main and pop-out teacher window. */
(()=>{"use strict";
 const teacher=()=>document.querySelector("#teacher");
 const rootState=()=>typeof state!=="undefined"&&state?state:null;
 function sync(){
   const root=teacher(),s=rootState();
   if(!root||!s)return;
   const role=typeof SESSION_ROLE!=="undefined"?SESSION_ROLE:"teacher";
   if(role!=="teacher")return;
   const studio=document.getElementById("activitiesPanel");
   const live=document.getElementById("activityControllerPanel");
   const setup=s.screen==="activities"&&!s.activityRun;
   const matchSetup=setup&&s.activeApp==="match"&&!!studio?.querySelector(".mcb-shell");
   const pixelSetup=setup&&s.activeApp==="pixel-reveal"&&!!studio?.querySelector(".pixel-setup");
   studio?.classList.toggle("si-mp-match-studio",matchSetup);
   studio?.classList.toggle("si-mp-pixel-studio",pixelSetup);
   const run=s.activityRun;
   const activity=run&&Array.isArray(s.activities)?
     s.activities.find(x=>String(x.id)===String(run.activityId)):null;
   const matchLive=!!run&&s.screen==="activity"&&
     (s.activeApp==="match"||activity?.type==="match");
   const pixelLive=!!run&&s.screen==="activity"&&
     (s.activeApp==="pixel-reveal"||activity?.type==="pixel-reveal");
   live?.classList.toggle("si-mp-match-live",matchLive);
   live?.classList.toggle("si-mp-pixel-live",pixelLive);
   live?.classList.toggle("si-mp-ready",(matchLive||pixelLive)&&!!live?.querySelector(".lobby-controller"));
 }
 let queued=false;
 function schedule(){
   if(queued)return;
   queued=true;
   requestAnimationFrame(()=>{queued=false;sync()});
 }
 function init(){
   sync();
   const panels=["activitiesPanel","activityControllerPanel"].map(id=>document.getElementById(id)).filter(Boolean);
   for(const el of panels)new MutationObserver(schedule).observe(el,{subtree:true,childList:true});
   setInterval(sync,1000);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();
