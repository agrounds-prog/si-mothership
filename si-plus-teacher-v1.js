/* SI+ Teacher Navigation V1 — visual classes only. */
(()=>{"use strict";
function sync(){
 const root=document.getElementById("teacher");
 if(!root||typeof state==="undefined"||!state)return;
 const on=state.activeApp==="si-plus";
 const editor=on&&!!state.presentationEditor?.draft;
 const library=on&&!!state.presentationLibraryOpen&&!editor&&!state.activityRun;
 const home=on&&state.screen==="activities"&&!library&&!editor&&!state.activityRun;
 const ready=on&&state.screen==="activity"&&!!state.activityRun;
 for(const [id,classes] of [
  ["activitiesPanel",{"si-art-home":home,"si-art-library":library}],
  ["presentationBuilderPanel",{"si-art-builder":editor}],
  ["activityControllerPanel",{"si-art-ready":ready}]
 ]) {
  const el=document.getElementById(id);if(!el)continue;
  for(const [name,enabled] of Object.entries(classes))el.classList.toggle(name,enabled);
  if(!Object.values(classes).some(Boolean))continue;
  el.querySelectorAll("button").forEach(b=>{
   const t=(b.textContent||"").trim().toLowerCase();
   for(const [name,re] of [
    ["si-art-create",/new presentation/],["si-art-load",/load saved|load to classroom/],
    ["si-art-preview",/preview/],["si-art-start",/start presentation/],
    ["si-art-danger",/emergency return/],["si-art-save",/save presentation/]
   ]) b.classList.toggle(name,re.test(t));
  });
  if(library)el.querySelectorAll(".real-app-card").forEach(card=>card.classList.add("si-art-deck"));
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{sync();setInterval(sync,1000)},{once:true});
else{sync();setInterval(sync,1000)}
})();