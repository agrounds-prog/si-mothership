/* SIGNAL SEQUENCE v1.0 — isolated Mothership activity bridge. */
(function(){
"use strict";
const ID="signal-sequence-game",APP="signal-sequence";
let watchTimer=null,visualTimer=null,lastToneKey="",audio=null;
let studentPending=null,studentFeedback="",studentFeedbackType="",signalSocket=null,ignoreSyntheticClickUntil=0;
function studentNotice(message,kind=""){
 studentFeedback=String(message||"");studentFeedbackType=kind;
 const node=document.querySelector("#studentContent .ss-student-status");
 if(node){node.textContent=studentFeedback;node.classList.remove("ss-status-sending","ss-status-ok","ss-status-error");if(kind)node.classList.add("ss-status-"+kind)}
}
function socketAck(event){
 let data;try{data=JSON.parse(event.data)}catch(_){return}
 if(!data||data.type!=="signal_sequence_ack"||!studentPending||String(data.id)!==studentPending.id)return;
 if(data.ok){studentPending.acknowledged=true;studentNotice("✓ Signal received. Updating game…","ok")}
 else {studentPending=null;studentNotice("Signal was not accepted. Check that it is your turn and try again.","error")}
}
function watchSignalSocket(){
 if(typeof networkSocket==="undefined"||networkSocket===signalSocket)return;
 if(signalSocket)signalSocket.removeEventListener("message",socketAck);
 signalSocket=networkSocket;
 if(signalSocket)signalSocket.addEventListener("message",socketAck);
}
const live=()=>typeof state!=="undefined"&&state?.activityRun?.activityId===ID&&state.activityRun.signalSequence;
const notice=t=>{if(typeof toast==="function")toast(t)};
function ensure(){
 if(!Array.isArray(state?.activities))return;
 if(!state.activities.some(a=>a.id===ID))state.activities.push({id:ID,type:APP,name:"SIGNAL SEQUENCE",description:"Watch, memorize, repeat the cosmic signal."});
}
function tone(index,g){
 if(!g?.sound||typeof window==="undefined")return;
 try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==="suspended")audio.resume().catch(()=>{});
  const t=audio.currentTime,o=audio.createOscillator(),volume=audio.createGain();
  o.type="sine";o.frequency.value=[285,359,452,570][index];volume.gain.setValueAtTime(.0001,t);volume.gain.exponentialRampToValueAtTime(.055,t+.015);volume.gain.exponentialRampToValueAtTime(.0001,t+.19);
  o.connect(volume);volume.connect(audio.destination);o.start(t);o.stop(t+.22);
 }catch(_){}
}
function visuals(){
 if(visualTimer)clearInterval(visualTimer);
 function tick(){
  const g=live();if(!g)return;
  const signal=SignalSequence.cue(g);
  document.querySelectorAll(".ss-pad[data-ss-pad]").forEach(p=>p.classList.toggle("ss-lit",Number(p.dataset.ssPad)===signal));
  if(signal>=0){const key=g.id+"|"+g.round+"|"+Math.floor((Date.now()-g.playbackAt)/SignalSequence.interval(g));if(key!==lastToneKey){lastToneKey=key;/* browser gesture policies may mute projector audio */ if(document.querySelector("#teacher .ss-teacher"))tone(signal,g)}}
 }
 tick();visualTimer=setInterval(tick,85);
}
function schedule(){
 // Only Mission Control may open an input phase. A student browser must wait
 // for the teacher's server-synchronized change, not advance its local copy.
 if(typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE!=="teacher")return;
 if(watchTimer)clearTimeout(watchTimer);
 const g=live();if(!g||g.phase!=="watch")return;
 const wait=Math.max(0,Number(g.playbackEnd)-Date.now()+70);
 watchTimer=setTimeout(()=>{
  const active=live();
  // Only the teacher may change canonical classroom state.
  if(!active||active.phase!=="watch"||typeof state==="undefined"||state.role==="student")return;
  if(SignalSequence.beginInput(active)){render()}else schedule();
 },Math.min(wait,60000));
}
function showSetup(){
 const root=document.getElementById("activityGrid")||document.querySelector("#activitiesPanel .activity-catalog-grid");
 if(!root)return;
 const title=document.getElementById("activityTitle"),sub=document.getElementById("activitySubtitle"),head=document.getElementById("activityHeader");
 if(title)title.textContent="SIGNAL SEQUENCE";if(sub)sub.textContent="Watch · Remember · Repeat · Classic memory challenge";
 if(head){head.innerHTML='<button type="button" id="ssBack">← Activity Library</button>';head.querySelector("#ssBack").onclick=()=>{state.activeApp=null;renderActivities()}}
 const connected=typeof connectedStudents==="function"?connectedStudents().map(s=>s.n):[];
 root.innerHTML=SignalSequence.setupHTML(connected);root.classList.remove("hidden");
 document.getElementById("savedActivityPicker")?.classList.add("hidden");
 const start=root.querySelector("#ssLaunch");
 if(start)start.onclick=()=>{
  const g=SignalSequence.make({pilot:root.querySelector("#ssPilot").value,speed:root.querySelector("#ssSpeed").value,sound:root.querySelector("#ssSound").checked});
  state.activityRun={activityId:ID,phase:"running",runToken:"ss-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2),signalSequence:g};
  state.activeApp=null;state.ended=false;state.screen="classroom";render();notice("SIGNAL SEQUENCE ready");
 };
 root.querySelectorAll("[data-ss-load]").forEach(btn=>btn.onclick=()=>{
  const g=SignalSequence.readLibrary()[Number(btn.dataset.ssLoad)]?.game;
  if(!g||!confirm("Restore saved SIGNAL SEQUENCE game?"))return;
  state.activityRun={activityId:ID,phase:"running",runToken:"ss-"+Date.now().toString(36),signalSequence:SignalSequence.snapshot(g)};
  state.activeApp=null;state.ended=false;state.screen="classroom";render();
 });
}
function decorateCatalog(){
 const root=document.querySelector("#activitiesPanel .activity-catalog-grid")||document.getElementById("activityGrid");
 if(!root||root.querySelector(".ss-library-card"))return;
 const selection=document.querySelector("#activitiesPanel .activity-library-filters button.active")?.dataset.activityCategory||"all";
 const search=(document.getElementById("activityLibrarySearch")?.value||"").toLowerCase().trim();
 if(selection!=="all"&&selection!=="games")return;
 if(search&&!["signal","sequence","simon","memory","classic","pattern"].some(x=>x.includes(search)||search.includes(x)))return;
 const card=document.createElement("div");
 card.className="activity-card real-app-card ss-library-card si-v86-icon-ready";card.dataset.activityCategory="games";card.dataset.siV86Accent="cyan";
 card.innerHTML='<span class="app-status">CLASSROOM GAME · NEW</span><div class="act-icon"><svg viewBox="0 0 48 48" class="si-v86-library-glyph" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#173357" stroke="#70dfff" stroke-width="2"/><path d="M24 4A20 20 0 0 0 4 24h20Z" fill="#ef4468"/><path d="M24 4a20 20 0 0 1 20 20H24Z" fill="#269cf4"/><path d="M4 24a20 20 0 0 0 20 20V24Z" fill="#21d69c"/><path d="M44 24a20 20 0 0 1-20 20V24Z" fill="#ffce61"/><circle cx="24" cy="24" r="8" fill="#0b1e39" stroke="#e0fbff" stroke-width="2"/></svg></div><h3>SIGNAL SEQUENCE</h3><div class="app-meta">Memory · Pattern · Classic</div><p>Watch the cosmic lights, remember the growing pattern, and repeat it on the matching student controller.</p><div class="real-app-actions"><button type="button" data-open-app="signal-sequence" class="ss-open">Open SIGNAL SEQUENCE</button></div>';
 card.querySelector(".ss-open").onclick=()=>{state.activeApp=APP;renderActivities()};root.appendChild(card);
}
function controller(){
 const g=live(),el=document.getElementById("activityControllerPanel");if(!g||!el)return false;
 if(typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE!=="teacher"){el.innerHTML="";return true}
 el.innerHTML=SignalSequence.teacherHTML(g);
 el.querySelectorAll("[data-ss-action]").forEach(b=>b.onclick=()=>{
  const a=b.dataset.ssAction;
  if(a==="next"&&SignalSequence.startRound(g)){render();schedule()}
  if(a==="input"&&SignalSequence.beginInput(g)){render()}
  if(a==="retry"&&confirm("Retry from round one? Best score is kept.")){SignalSequence.retry(g);render()}
  if(a==="save"){const name=prompt("Save SIGNAL SEQUENCE game as:","Signal Sequence · "+g.pilot);if(name?.trim()){SignalSequence.save(g,name.trim());notice("SIGNAL SEQUENCE saved")}}
  if(a==="load"){const list=SignalSequence.readLibrary();if(!list.length){notice("No saved signals yet");return}const choice=prompt("Load game number:\n"+list.map((x,i)=>(i+1)+". "+x.name).join("\n"),"1");const item=list[Number(choice)-1];if(!item||!confirm("Replace the active SIGNAL SEQUENCE game?"))return;state.activityRun.signalSequence=SignalSequence.snapshot(item.game);render()}
  if(a==="exit"&&confirm("Return to classroom?"))returnToClassroom();
 });
 el.querySelectorAll("[data-ss-press]").forEach(p=>{p.addEventListener("click",()=>{const result=SignalSequence.press(g,Number(p.dataset.ssPress));if(result.ok){tone(Number(p.dataset.ssPress),g);render()}});p.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();p.dispatchEvent(new Event("click"))}})});
 schedule();return true;
}
function wireStudent(){
 const g=live();if(!g||typeof SESSION_ROLE==="undefined"||SESSION_ROLE!=="student")return;
 const pilot=typeof selectedStudent==="function"?selectedStudent()?.n||"":"",zone=document.querySelector("#studentContent");
 if(!zone)return;
 watchSignalSocket();
 // Rendered student markup is replaced on each classroom update. Keep
 // in-flight requests in the bridge until canonical progress advances.
 if(studentPending&&(studentPending.gameId!==g.id||studentPending.round!==g.round||studentPending.progress!==g.progress||g.phase!=="input")){
  studentPending=null;
  studentFeedback=g.phase==="failed"?"Signal missed. Watch Mission Control for a retry.":g.phase==="success"?"✓ Round complete!":"✓ Signal registered.";
  studentFeedbackType=g.phase==="failed"?"error":"ok";
 }
 if(g.phase!=="input"||pilot!==g.pilot){studentPending=null;studentFeedback="";studentFeedbackType=""}
 if(studentPending)studentNotice(studentPending.acknowledged?"✓ Signal received. Updating game…":"Sending signal…","sending");
 else if(studentFeedback)studentNotice(studentFeedback,studentFeedbackType);
 const send=(signal)=>{
  if(g.phase!=="input"||pilot!==g.pilot||studentPending)return;
  if(typeof networkSocket==="undefined"||!networkSocket||networkSocket.readyState!==WebSocket.OPEN){
   studentNotice("Not connected to Mission Control. Reconnect before tapping.","error");return
  }
  const current=typeof currentStudentIdentity==="function"?currentStudentIdentity():null;
  const stored=typeof readStudentIdentity==="function"?readStudentIdentity():null;
  // An existing student entry can temporarily be missing its token when
  // a role-filtered state packet arrives before WebSocket hello.
  const token=current?.student_token||(stored?.name===pilot?stored.studentToken:"")||"";
  if(!token){studentNotice("Student identity is still syncing. Reconnect this device.","error");return}
  const number=Number(signal),req={signal:number,runToken:state.activityRun?.runToken,id:"ssmove-"+Date.now()+"-"+Math.random().toString(36).slice(2)};
  studentPending={id:req.id,signal:number,gameId:g.id,round:g.round,progress:g.progress,acknowledged:false};
  studentNotice("Sending "+SignalSequence.COLORS[number][2]+" signal…","sending");
  try{
   networkSocket.send(JSON.stringify({type:"signal_sequence_action",request:req,student_token:token,student_name:pilot}));
   tone(number,g);
  }catch(_){studentPending=null;studentNotice("Couldn't send. Check your classroom connection.","error")}
 };
 zone.querySelectorAll("[data-ss-press]").forEach(control=>{
  const signal=Number(control.dataset.ssPress),svg=control.tagName.toLowerCase()==="g";
  // touch/pen pointerdown fires before synthetic clicks and before mobile
  // scrolling can interrupt the gesture; mouse and keyboard use click.
  if(svg)control.addEventListener("pointerdown",e=>{
   if(e.pointerType==="mouse")return;
   e.preventDefault();ignoreSyntheticClickUntil=Date.now()+750;
   control.classList.add("ss-pressed");
   send(signal);
  },{passive:false});
  control.addEventListener("click",e=>{
   if(svg&&Date.now()<ignoreSyntheticClickUntil){e.preventDefault();return}
   send(signal);
  });
  if(svg)control.addEventListener("keydown",e=>{
   if(e.key==="Enter"||e.key===" "){e.preventDefault();send(signal)}
  });
 });
}

function install(){
 if(window.__signalSequenceBridge||typeof SignalSequence==="undefined"||typeof state==="undefined"||typeof render!=="function")return;
 window.__signalSequenceBridge=true;ensure();
 // Restored sessions can replace the activity registry with a pre-game snapshot.
 // Reinstall the entry before core renderRosterAlert accesses activeActivity().
 const oldRender=window.render;
 window.render=function(){ensure();return oldRender.apply(this,arguments)};
 const oldActivities=window.renderActivities,oldController=window.renderActivityController,oldShared=window.sharedMarkup,
  oldStudent=window.studentMarkup,oldPublic=window.renderPublic,oldStudentControls=window.renderStudentControls;
 window.renderActivities=function(){const value=oldActivities.apply(this,arguments);if(state?.activeApp===APP)showSetup();else if(!state?.activeApp)decorateCatalog();return value};
 window.renderActivityController=function(){if(live())return controller();return oldController.apply(this,arguments)};
 window.sharedMarkup=function(size){const g=live();if(g)return SignalSequence.sharedHTML(g,size==="big");return oldShared.apply(this,arguments)};
 window.studentMarkup=function(){const g=live();if(g&&typeof studentNeedsJoin==="function"&&!studentNeedsJoin()){const st=typeof selectedStudent==="function"?selectedStudent():null;return SignalSequence.studentHTML(g,st?.n||"")}return oldStudent.apply(this,arguments)};
 if(typeof oldStudentControls==="function")window.renderStudentControls=function(){if(live()){const label=document.getElementById("studentControlLabel"),zone=document.getElementById("studentControls");if(label)label.innerHTML="<b>SIGNAL SEQUENCE</b><span>Watch the lights, then tap the matching donut segments.</span>";if(zone){zone.innerHTML="";zone.className="student-actions"}return}return oldStudentControls.apply(this,arguments)};
 window.renderPublic=function(){const result=oldPublic.apply(this,arguments);if(live()){wireStudent();visuals()}else{studentPending=null;studentFeedback="";studentFeedbackType=""}return result};
 ensure();try{renderActivities()}catch(e){console.warn("SIGNAL SEQUENCE library unavailable",e)}
 // When loading an active game from browser/session storage, the inline app
 // deliberately held the first render until this wrapper became available.
 if(live())render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
