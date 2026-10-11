/* FOUR IN LINE v1 · bridge into existing Mothership home, activities, teacher and student views.
   No replacement of dashboard markup and no private student secrets. */
(function(){
"use strict";
const ID="four-in-line-game",APP="four-in-line";
function ready(){return typeof FourLine!=="undefined"&&typeof state!=="undefined"&&typeof render==="function"}
function live(){return state?.activityRun?.activityId===ID&&state?.activityRun?.fourInLine}
function ensure(){
 if(!state||!Array.isArray(state.activities))return;
 if(!state.activities.some(a=>a.id===ID))state.activities.push({id:ID,type:APP,name:"FOUR IN LINE",prompt:"Drop discs. Connect four in a row.",description:"Two-player or team strategy game."});
}
function notice(msg){if(typeof toast==="function")toast(msg)}
function showSetup(){
 const root=document.getElementById("activityGrid")||document.querySelector("#activitiesPanel .activity-catalog-grid");
 if(!root)return;
 const title=document.getElementById("activityTitle"),sub=document.getElementById("activitySubtitle"),header=document.getElementById("activityHeader");
 if(title)title.textContent="FOUR IN LINE";
 if(sub)sub.textContent="Cosmic strategy · 2 players or teams · Teacher-managed launch";
 if(header){header.innerHTML='<button id="filBackToLibrary">← Activity Library</button>';header.querySelector("#filBackToLibrary").onclick=()=>{state.activeApp=null;renderActivities()}}
 const joined=typeof connectedStudents==="function"?connectedStudents().map(s=>s.n):[];
 root.innerHTML=FourLine.setupHTML(joined);root.classList.remove("hidden");
 const picker=document.getElementById("savedActivityPicker");if(picker)picker.classList.add("hidden");
 const launch=root.querySelector("#filLaunch");
 if(launch)launch.onclick=()=>{
  const first=root.querySelector("#filOne").value.trim(),second=root.querySelector("#filTwo").value.trim(),mode=root.querySelector("#filMode").value,size=root.querySelector("#filSize").value;
  const seats={};root.querySelectorAll("[data-fil-seat]").forEach(x=>{const seat=Number(x.value);if(seat>=0)seats[x.dataset.filSeat]=seat});
  try{
   const g=FourLine.make([first,second],{mode,size,seats});
   ensure();state.activityRun={activityId:ID,phase:"running",runToken:"fil-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2),fourInLine:g};
   state.activeApp=null;state.ended=false;state.screen="classroom";render();notice("FOUR IN LINE started");
  }catch(err){root.querySelector("#filSetupError").textContent=err.message||"Review game settings"}
 };
 root.querySelectorAll("[data-fil-load]").forEach(btn=>btn.onclick=()=>{
  const game=FourLine.saved()[Number(btn.dataset.filLoad)]?.game;
  if(!game||!confirm("Restore this saved FOUR IN LINE match?"))return;
  ensure();state.activityRun={activityId:ID,phase:"running",runToken:"fil-"+Date.now().toString(36),fourInLine:FourLine.snapshot(game)};
  state.activeApp=null;state.ended=false;state.screen="classroom";render();notice("Saved FOUR IN LINE match loaded");
 });
}
function decorateCatalog(){
 const root=document.querySelector("#activitiesPanel .activity-catalog-grid")||document.getElementById("activityGrid");
 if(!root||root.querySelector(".fil-library-card"))return;
 const selection=document.querySelector("#activitiesPanel .activity-library-filters button.active")?.dataset.activityCategory||"all";
 const search=(document.getElementById("activityLibrarySearch")?.value||"").toLowerCase().trim();
 // The new app participates in the existing library's category and search filters.
 if(selection!=="all"&&selection!=="games")return;
 if(search&&!("four in line connect four strategy game drop discs team battle".includes(search)))return;
 const card=document.createElement("div");
 card.className="activity-card real-app-card fil-library-card si-v86-icon-ready";
 card.dataset.activityCategory="games";
 card.dataset.siV86Accent="cyan";
 card.innerHTML='<span class="app-status">CLASSROOM GAME · LIVE</span><div class="act-icon"><svg class="si-v86-library-glyph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="8"/><path d="M17 6v36M30 6v36M6 18h36M6 31h36" opacity=".45"/><circle cx="11" cy="12" r="5" fill="currentColor"/><circle cx="24" cy="25" r="5" fill="currentColor"/><circle cx="37" cy="37" r="5" fill="currentColor"/></svg></div><h3>FOUR IN LINE</h3><div class="app-meta">Strategy · Team Battle · Mini / Classic / Mega</div><p>Drop glowing discs into a suspended grid. Student devices make moves, while the projector shows the arena.</p><div class="real-app-actions"><button type="button" class="fil-open" data-open-app="four-in-line">Open FOUR IN LINE</button></div>';
 card.querySelector(".fil-open").onclick=()=>{state.activeApp=APP;renderActivities()};
 root.appendChild(card);
}
function drawController(){
 const g=live();if(!g)return false;
 const el=document.getElementById("activityControllerPanel");if(!el)return false;
 el.innerHTML=FourLine.teacherHTML(g);
 el.querySelectorAll("[data-fil-drop]").forEach(btn=>btn.onclick=()=>{
  const result=FourLine.drop(g,g.turn,Number(btn.dataset.filDrop));
  if(result.error){notice(result.error);return}
  render();
 });
 el.querySelectorAll("[data-fil-action]").forEach(btn=>btn.onclick=()=>{
  const action=btn.dataset.filAction;
  if(action==="undo"){if(FourLine.undo(g))render();else notice("No move to undo")}
  if(action==="reset"){if(confirm("Start a fresh match with the same teams?")){FourLine.reset(g);render()}}
  if(action==="save"){const name=prompt("Save FOUR IN LINE game as:",g.players.join(" vs "));if(name?.trim()){FourLine.save(g,name.trim());notice("FOUR IN LINE saved")}}
  if(action==="exit"){if(confirm("Return to classroom?"))returnToClassroom()}
  if(action==="lobby"){if(confirm("Return everyone to the Activity Lobby?"))enterLobby()}
  if(action==="emergency")returnToClassroom("emergency");
 });
 return true;
}
function install(){
 if(!ready()||window.__fourLineBridgeInstalled)return;
 window.__fourLineBridgeInstalled=true;ensure();
 const oldRender=window.render,oldActivities=window.renderActivities,oldController=window.renderActivityController,
   oldShared=window.sharedMarkup,oldStudent=window.studentMarkup,oldPublic=window.renderPublic,oldStudentControls=window.renderStudentControls;
 if(typeof oldRender!=="function"||typeof oldActivities!=="function"||typeof oldController!=="function"||typeof oldShared!=="function"||typeof oldStudent!=="function"||typeof oldPublic!=="function"){return}
 window.render=function(){ensure();return oldRender.apply(this,arguments)};
 window.renderActivities=function(){
  const result=oldActivities.apply(this,arguments);
  if(state?.activeApp===APP)showSetup();
  else if(!state?.activeApp)decorateCatalog();
  return result;
 };
 window.renderActivityController=function(){if(live())return drawController();return oldController.apply(this,arguments)};
 window.sharedMarkup=function(size){const g=live();if(g)return FourLine.publicHTML(g,size==="big");return oldShared.apply(this,arguments)};
 window.studentMarkup=function(){
  const g=live();
  if(g&&typeof studentNeedsJoin==="function"&&!studentNeedsJoin()){
   const student=typeof selectedStudent==="function"?selectedStudent():null;
   return FourLine.studentHTML(g,student?.n||"");
  }
  return oldStudent.apply(this,arguments);
 };
 if(typeof oldStudentControls==="function")window.renderStudentControls=function(){
  const g=live();
  if(g){
   const label=document.getElementById("studentControlLabel"),zone=document.getElementById("studentControls");
   if(label)label.innerHTML="<b>FOUR IN LINE</b><span>Tap a numbered column on your game board.</span>";
   if(zone){zone.innerHTML="";zone.className="student-actions"}
   return;
  }
  return oldStudentControls.apply(this,arguments);
 };
 window.renderPublic=function(){
  const result=oldPublic.apply(this,arguments),g=live();
  if(g){const st=typeof selectedStudent==="function"?selectedStudent():null;FourLine.wireStudent(g,st?.n||"")}
  return result;
 };
 // Extend UI without changing the original shortcut row, home header or activity implementations.
 ensure();try{renderActivities()}catch(err){console.warn("FOUR IN LINE catalog unavailable",err)}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
