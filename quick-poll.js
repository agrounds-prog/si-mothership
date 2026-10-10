/* SI Mothership Quick Poll — additive class-session overlay, no activityRun edits. */
(()=>{
"use strict";
if(window.SIQuickPoll)return;
const role=new URLSearchParams(location.search).get("role")||"teacher";
const sid=window.__SI_SESSION_ID__||"",code=window.__SI_JOIN_CODE__||"";
const colors=["#5ce8ff","#89ef9c","#bc87ff","#ffb96b","#ff79a4","#ffe180"];
const styles={cards:"Image Leaderboard",bars:"Bar Chart",donut:"Donut Chart",showdown:"Two-Sided Showdown"};
const sample=[
 ["This or That","Which do you prefer?",["Option A","Option B"],false],
 ["Understanding Check","How well do you understand?",["Got it","Almost","Need help"],true],
 ["Emotion Check","How are you feeling?",["Happy 😊","Okay 🙂","Worried 😟","Upset 😢"],true],
 ["Prediction","What will happen next?",["Prediction A","Prediction B","Prediction C"],false],
 ["Number Scale","How confident are you?",["1","2","3","4","5"],false]
];
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const clone=v=>JSON.parse(JSON.stringify(v));
const fresh=()=>({question:"",description:"",choices:[{label:"Yes",image:""},{label:"No",image:""}],identity:"anonymous",visibility:"live",allowChange:true,multiple:false,limit:2,duration:0,display:"cards",sensitive:false});
let draft=fresh(),poll=null,library=[],selected=[],open=false,list=false,busy=false,loading=false,previousStudent="",serverOffset=0;
let root=null,dialog=null,launcher=null,notice="";
const params=()=>{
 const q=new URLSearchParams({role,sid,code});
 if(role==="student"){
  const st=typeof selectedStudent==="function"?selectedStudent():null;
  if(!st?.studentToken)return null;
  q.set("token",st.studentToken);
 }
 return q;
};
async function api(path,data){
 const opts=data===undefined?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),cache:"no-store"};
 const r=await fetch(path,opts);let value=null;
 try{value=await r.json();}catch{}
 if(!r.ok)throw Error((value?.error||value?.message||"Quick Poll request failed")+" ("+r.status+")");
 return value;
}
const remaining=p=>p?.phase==="open"&&p.endAt!=null?Math.max(0,Math.ceil(p.endAt-Date.now()/1000-serverOffset)):null;
function timer(){
 if(!poll)return;
 const n=remaining(poll),label=n===null?(poll.phase==="open"?"NO TIMER":"CLOSED"):String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
 document.querySelectorAll("[data-quick-poll-timer]").forEach(el=>{if(el.textContent!==label)el.textContent=label;});
}
const pct=(n,d)=>d?Math.round(n/d*100):0;
const media=(c,i)=>'<div class="qp-image" style="--qp-color:'+colors[i%6]+'">'+
 (c.image?'<img alt="'+esc(c.label)+'" src="'+c.image+'">':'<span aria-hidden="true">'+["✦","◈","◆","✿","⬡","◉"][i%6]+'</span>')+'</div>';
const badge=p=>'<div class="qp-status"><strong>'+(p.phase==="open"?"● VOTING OPEN":"✓ VOTING CLOSED")+'</strong><b data-quick-poll-timer>—</b><span>'+(p.voters==null?"PRIVATE":p.voters+" of "+(p.eligible??0))+' VOTED</span></div>';
function results(p){
 if(!p.counts)return '<div class="qp-secret"><span>◈</span><h2>Waiting for the reveal</h2><p>Students are voting. The teacher will reveal the results.</p></div>';
 const total=p.voters||0,values=p.choices.map((c,i)=>({c,i,n:Number(p.counts[c.id]||0),percent:pct(p.counts[c.id]||0,total)}));
 const top=Math.max(0,...values.map(v=>v.n));
 if(p.display==="donut"){
  // In multiple-choice polls the pie measures selections, not participants.
  const selectedTotal=values.reduce((n,v)=>n+v.n,0);
  let from=0;const parts=values.map(v=>{const to=from+(selectedTotal?v.n/selectedTotal*100:0),s=colors[v.i%6]+" "+from+"% "+to+"%";from=to;return s;});
  return '<div class="qp-donut-area"><div class="qp-donut" style="background:'+(selectedTotal?"conic-gradient("+parts.join(",")+")":"#24445d")+'"><span><b>'+total+'</b> students</span></div><div class="qp-legend">'+values.map(v=>'<div><i style="background:'+colors[v.i%6]+'"></i><span>'+esc(v.c.label)+'</span><b>'+pct(v.n,selectedTotal)+'%</b></div>').join("")+'</div></div>';
 }
 if(p.display==="bars"){
  return '<div class="qp-bar-chart">'+[...values].sort((a,b)=>b.n-a.n).map(v=>'<div class="qp-chart-row">'+(v.c.image?'<img src="'+v.c.image+'" alt="">':'<span style="background:'+colors[v.i%6]+'">✦</span>')+
   '<strong>'+esc(v.c.label)+'</strong><div class="qp-track"><i style="width:'+v.percent+'%;background:'+colors[v.i%6]+'"></i></div><b>'+v.percent+'% ('+v.n+')</b></div>').join("")+'</div>';
 }
 if(p.display==="showdown"&&values.length===2)return '<div class="qp-showdown">'+values.map(v=>'<div class="qp-show-side" style="--qp-color:'+colors[v.i%6]+'">'+media(v.c,v.i)+'<strong>'+esc(v.c.label)+'</strong><b>'+v.percent+'%</b><span>'+v.n+' votes</span></div>').join('<span class="qp-vs">VS</span>')+'</div>';
 return '<div class="qp-results">'+values.map(v=>'<div class="qp-result '+(v.n===top&&top>0?"qp-top":"")+'" style="--qp-color:'+colors[v.i%6]+'">'+
 (v.n===top&&top>0?'<span class="qp-star" title="Leading answer">★</span>':"")+media(v.c,v.i)+'<strong>'+esc(v.c.label)+'</strong>'+
 '<b>'+v.n+' <small>VOTES</small></b><em>'+v.percent+'%</em><div class="qp-track"><i style="width:'+v.percent+'%"></i></div></div>').join("")+'</div>';
}
function sharedView(p){
 const comparison=p.before&&p.counts?'<aside class="qp-comparison"><b>BEFORE → AFTER</b>'+p.choices.map(c=>'<span>'+esc(c.label)+': '+(p.before[c.id]||0)+' → '+(p.counts[c.id]||0)+'</span>').join("")+'</aside>':"";
 return '<div class="qp-projector"><header><b>🚀 MOTHERSHIP <span>QUICK POLL</span></b><small>ASK • VOTE • SEE • DISCUSS</small></header>'+
 '<h1>'+esc(p.question)+'</h1>'+(p.description?'<p>'+esc(p.description)+'</p>':"")+badge(p)+results(p)+comparison+
 '<footer>Same Mothership. New ways to listen. <span>ROUND '+p.round+'</span></footer></div>';
}
function studentView(p){
 const readonly=!!p.ownVote&&!p.allowChange||p.phase!=="open";
 const cards=p.choices.map((c,i)=>'<button type="button" data-qp-choice="'+c.id+'" style="--qp-color:'+colors[i%6]+'" class="qp-vote-card '+(selected.includes(c.id)?"selected":"")+'" aria-pressed="'+selected.includes(c.id)+'" '+(readonly?"disabled":"")+'>'
 +media(c,i)+'<strong>'+esc(c.label)+'</strong></button>').join("");
 return '<div class="qp-voter"><header>🚀 MOTHERSHIP <span>QUICK POLL</span></header>'+badge(p)+'<h1>'+esc(p.question)+'</h1>'+
 (p.description?'<p>'+esc(p.description)+'</p>':"")+
 (p.phase!=="open"&&!p.ownVote?'<p class="qp-closed">Voting has closed. Watch the classroom display.</p>':'<div class="qp-vote-choices">'+cards+'</div>')+
 (p.phase==="open"&&!readonly?'<button id="qpSubmitVote" class="qp-submit" '+(!selected.length?"disabled":"")+'>➤ '+(p.ownVote?"CHANGE MY VOTE":"SUBMIT VOTE")+'</button>':"")+
 (p.ownVote?'<div class="qp-received"><b>✓ VOTE RECEIVED</b><p>'+esc(p.ownVote.map(id=>p.choices.find(c=>c.id===id)?.label||"").join(", "))+'</p>'+
 (p.allowChange&&p.phase==="open"?"You may change your answer until voting closes.":"Your response is saved.")+'</div>':"")+
 '<p class="qp-vote-help">'+(p.multiple?"Choose up to "+p.limit+" answers.":"Choose one answer.")+'</p><div id="qpVoteError" role="alert"></div></div>';
}
async function studentClick(event){
 const btn=event.target.closest("button");if(!btn||!poll)return;
 if(btn.dataset.qpChoice!==undefined){
  const id=btn.dataset.qpChoice;
  if(poll.multiple){
   if(selected.includes(id))selected=selected.filter(v=>v!==id);
   else if(selected.length<poll.limit)selected.push(id);
  }else selected=[id];
  renderStudent(true);return;
 }
 if(btn.id!=="qpSubmitVote"||busy||!selected.length)return;
 const student=typeof selectedStudent==="function"?selectedStudent():null;
 if(!student?.studentToken){$("#qpVoteError").textContent="Join the class first.";return;}
 busy=true;btn.disabled=true;
 try{
  await api("/api/quick-poll/vote",{sid,code,token:student.studentToken,pollId:poll.id,choices:selected});
  previousStudent="";await refresh(true);
 }catch(e){const box=$("#qpVoteError");if(box)box.textContent=e.message;}
 finally{busy=false;}
}
function renderStudent(force=false){
 if(!root||!poll)return;
 const sig=poll.id+"|"+poll.phase+"|"+poll.round+"|"+JSON.stringify(poll.ownVote)+"|"+poll.allowChange;
 const changed=sig!==previousStudent;
 if(!force&&!changed)return;
 previousStudent=sig;
 // Rehydrate only when the authoritative vote/poll changes. Don't discard
 // a student's new local selection while they are choosing a revised vote.
 if(changed)selected=poll.ownVote?[...poll.ownVote]:[];
 root.innerHTML=studentView(poll);
 timer();
}
function field(label,html){return '<label class="qp-field"><span>'+label+'</span>'+html+'</label>';}
const options=(items,chosen)=>items.map(([id,label])=>'<option value="'+esc(id)+'" '+(String(chosen)===String(id)?"selected":"")+'>'+esc(label)+'</option>').join("");
function editChoice(c,i){
 return '<div class="qp-edit-choice"><div><b>CHOICE '+(i+1)+'</b><button type="button" data-qp-remove="'+i+'" '+(draft.choices.length<=2?"disabled":"")+' aria-label="Remove choice">×</button></div>'+
 media(c,i)+field("Answer label",'<input data-qp-label="'+i+'" maxlength="100" value="'+esc(c.label)+'" placeholder="Enter choice text">')+
 '<label class="qp-upload">↑ '+(c.image?"Replace":"Add")+' picture<input type="file" accept="image/png,image/jpeg,image/webp" data-qp-image="'+i+'"></label>'+
 (c.image?'<button type="button" data-qp-clear-image="'+i+'">Remove picture</button>':"")+'</div>';
}
function editorHtml(){
 const gallery=list?'<div class="qp-library"><strong>QUICK TEMPLATES</strong><div>'+sample.map((t,i)=>'<button type="button" data-qp-template="'+i+'">'+esc(t[0])+'</button>').join("")+'</div><strong>YOUR SAVED PROMPTS</strong>'+
 (library.length?'<div>'+library.map(t=>'<span><button type="button" data-qp-load="'+esc(t.id)+'">'+esc(t.name)+'</button><button type="button" class="qp-del" data-qp-delete="'+esc(t.id)+'">×</button></span>').join("")+'</div>':'<p>No saved prompts yet.</p>')+'</div>':"";
 return '<div class="qp-teacher"><header><div><small>🚀 MOTHERSHIP</small><h2>QUICK <em>POLL</em></h2><span>Ask · Vote · See · Discuss · Repeat</span></div><button type="button" data-qp-close aria-label="Close Poll Studio">×</button></header>'+
 '<div class="qp-teacher-scroll"><section id="qpTeacherLive"></section>'+
 '<div class="qp-actionbar"><button type="button" data-qp-gallery>▣ '+(list?"Hide":"Open")+' Prompt Library</button><button type="button" data-qp-new>＋ New Poll</button></div>'+gallery+
 field("1. YOUR QUESTION",'<input id="qpQuestion" maxlength="240" value="'+esc(draft.question)+'" placeholder="What should our crew choose?">')+
 field("Optional directions",'<textarea id="qpDescription" rows="2" maxlength="350" placeholder="Add context…">'+esc(draft.description)+'</textarea>')+
 '<div class="qp-subhead"><b>2. CHOICES (2–6)</b><button type="button" data-qp-add '+(draft.choices.length>=6?"disabled":"")+'>＋ Choice</button></div>'+
 '<div class="qp-edit-grid">'+draft.choices.map(editChoice).join("")+'</div><div class="qp-subhead"><b>3. SETTINGS</b></div>'+
 '<div class="qp-settings">'+
 field("Identity",'<select id="qpIdentity" '+(draft.sensitive?"disabled":"")+'>'+options([["anonymous","Anonymous"],["identified","Identified (teacher only)"]],draft.identity)+'</select>')+
 field("Results",'<select id="qpVisibility" '+(draft.sensitive?"disabled":"")+'>'+options([["live","Live"],["reveal","Hide until reveal"]],draft.visibility)+'</select>')+
 field("Timer",'<select id="qpDuration">'+options([[0,"None"],[15,"15 seconds"],[30,"30 seconds"],[60,"1 minute"],[120,"2 minutes"],[300,"5 minutes"]],draft.duration)+'</select>')+
 field("Display",'<select id="qpDisplay">'+options(Object.entries(styles).filter(([k])=>k!=="showdown"||draft.choices.length===2),draft.display)+'</select>')+'</div>'+
 '<div class="qp-checks"><label><input id="qpChange" type="checkbox" '+(draft.allowChange?"checked":"")+'> Vote changes</label>'+
 '<label><input id="qpMulti" type="checkbox" '+(draft.multiple?"checked":"")+'> Multiple answers</label>'+
 '<label><input id="qpSensitive" type="checkbox" '+(draft.sensitive?"checked":"")+'> Private check-in</label></div>'+
 (draft.multiple?field("Maximum answers",'<select id="qpLimit">'+options([1,2,3,4].filter(n=>n<=draft.choices.length).map(n=>[n,String(n)]),draft.limit)+'</select>'):"")+
 '<div class="qp-sendbar"><button type="button" data-qp-save>▣ Save Prompt</button><button type="button" class="qp-green" data-qp-launch>➤ SEND TO CLASS</button></div>'+
 '<div id="qpError" role="alert">'+esc(notice)+'</div></div></div>';
}
function liveHtml(p){
 if(!p)return '<div class="qp-teacher-live qp-nopoll">Create and send a question to your existing classroom session.</div>';
 return '<div class="qp-teacher-live"><div><b>'+esc(p.question)+'</b><span>'+(p.phase==="open"?"VOTING OPEN":"POLL CLOSED")+'</span></div>'+
 '<p>'+p.voters+' of '+p.eligible+' voted · Round '+p.round+'</p><div class="qp-mini-results">'+p.choices.map(c=>'<span>'+esc(c.label)+' <b>'+Number(p.counts?.[c.id]||0)+'</b></span>').join("")+'</div>'+
 '<div class="qp-display-buttons">'+Object.entries(styles).filter(([k])=>k!=="showdown"||p.choices.length===2).map(([k,l])=>'<button type="button" class="'+(p.display===k?"on":"")+'" data-qp-display="'+k+'">'+esc(l)+'</button>').join("")+'</div>'+
 '<div class="qp-live-actions">'+(p.phase==="open"?'<button type="button" data-qp-control="close">■ Close & Reveal</button>':'<button type="button" data-qp-control="reopen">↻ Reopen</button>')+
 '<button type="button" data-qp-control="revote">↻ Revote</button><button type="button" class="qp-red" data-qp-control="dismiss">Dismiss</button></div>'+
 (p.identifiedVotes?'<details><summary>Teacher-only responses</summary>'+p.identifiedVotes.map(v=>'<p>'+esc(v.name)+': '+esc(v.choices.map(id=>p.choices.find(c=>c.id===id)?.label||"").join(", "))+'</p>').join("")+'</details>':"")+'</div>';
}
function updateLive(){if(role!=="teacher")return;const box=$("#qpTeacherLive");if(box)box.innerHTML=liveHtml(poll);if(launcher)launcher.classList.toggle("active",poll?.phase==="open");}
function renderEditor(){
 if(role!=="teacher")return;
 if(!dialog){
  dialog=document.createElement("div");dialog.id="qpDialog";dialog.innerHTML='<div class="qp-dialog-window" role="dialog" aria-modal="true" aria-label="Quick Poll Studio"></div>';
  document.body.append(dialog);dialog.addEventListener("click",teacherClick);dialog.addEventListener("input",teacherInput);dialog.addEventListener("change",teacherChange);
 }
 dialog.hidden=!open;
 if(open){$(".qp-dialog-window",dialog).innerHTML=editorHtml();updateLive();}
 if(launcher)launcher.setAttribute("aria-expanded",String(open));
}
function error(e){notice=String(e?.message||e).slice(0,160);const box=$("#qpError");if(box)box.textContent=notice;}
function teacherInput(e){
 const t=e.target;if(t.id==="qpQuestion")draft.question=t.value;
 if(t.id==="qpDescription")draft.description=t.value;
 if(t.dataset.qpLabel!==undefined)draft.choices[Number(t.dataset.qpLabel)].label=t.value;
}
function teacherChange(e){
 const t=e.target;
 if(t.dataset.qpImage!==undefined){imageUpload(t.files?.[0],Number(t.dataset.qpImage)).catch(error);return;}
 const map={qpIdentity:"identity",qpVisibility:"visibility",qpDuration:"duration",qpDisplay:"display",qpChange:"allowChange",qpMulti:"multiple",qpSensitive:"sensitive",qpLimit:"limit"};
 const key=map[t.id];if(!key)return;
 draft[key]=t.type==="checkbox"?t.checked:("duration"===key||"limit"===key?Number(t.value):t.value);
 if(draft.sensitive){draft.identity="anonymous";draft.visibility="reveal";}
 if(key==="multiple"||key==="sensitive")renderEditor();
}
async function imageUpload(file,index){
 if(!file)return;
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>6*1024*1024)throw Error("Choose a PNG/JPG/WebP image smaller than 6 MB.");
 const url=URL.createObjectURL(file);
 try{
  const pic=new Image();await new Promise((resolve,reject)=>{pic.onload=resolve;pic.onerror=()=>reject(Error("Image could not be opened."));pic.src=url;});
  const scale=Math.min(1,560/Math.max(pic.width,pic.height)),canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(pic.width*scale));canvas.height=Math.max(1,Math.round(pic.height*scale));
  canvas.getContext("2d").drawImage(pic,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL("image/jpeg",.70);
  if(data.length>170000)throw Error("Please choose a smaller picture.");
  draft.choices[index].image=data;renderEditor();
 }finally{URL.revokeObjectURL(url);}
}
async function libraryLoad(){try{library=(await api("/api/quick-poll/templates")).templates||[];if(open)renderEditor();}catch(e){error(e);}}
async function post(url,body){if(busy)return;busy=true;notice="";try{await api(url,body);await refresh(true);}catch(e){error(e);}finally{busy=false;}}
async function teacherClick(e){
 const b=e.target.closest("button");if(!b)return;
 if(b.hasAttribute("data-qp-close")){open=false;renderEditor();return;}
 if(b.hasAttribute("data-qp-new")){draft=fresh();renderEditor();return;}
 if(b.hasAttribute("data-qp-gallery")){list=!list;renderEditor();return;}
 if(b.hasAttribute("data-qp-add")){if(draft.choices.length<6){draft.choices.push({label:"",image:""});renderEditor();}return;}
 if(b.dataset.qpRemove!==undefined){if(draft.choices.length>2){draft.choices.splice(Number(b.dataset.qpRemove),1);draft.limit=Math.min(draft.limit,draft.choices.length);if(draft.choices.length!==2&&draft.display==="showdown")draft.display="cards";renderEditor();}return;}
 if(b.dataset.qpClearImage!==undefined){draft.choices[Number(b.dataset.qpClearImage)].image="";renderEditor();return;}
 if(b.dataset.qpTemplate!==undefined){const t=sample[Number(b.dataset.qpTemplate)];draft={...fresh(),question:t[1],choices:t[2].map(label=>({label,image:""})),sensitive:t[3],visibility:t[3]?"reveal":"live"};renderEditor();return;}
 if(b.dataset.qpLoad!==undefined){const t=library.find(x=>x.id===b.dataset.qpLoad);if(t){draft={...fresh(),...clone(t.poll)};list=false;renderEditor();}return;}
 if(b.dataset.qpDelete!==undefined){if(confirm("Delete this saved Quick Poll prompt?")){await post("/api/quick-poll/templates/delete",{id:b.dataset.qpDelete});await libraryLoad();}return;}
 if(b.hasAttribute("data-qp-save")){const name=prompt("Save prompt as:",draft.question||"New Poll");if(name?.trim()){await post("/api/quick-poll/templates",{name:name.trim(),poll:draft});await libraryLoad();}return;}
 if(b.hasAttribute("data-qp-launch")){if(poll?.phase==="open"&&!confirm("Replace the live Quick Poll? Current votes will be cleared."))return;await post("/api/quick-poll/launch",draft);return;}
 if(b.dataset.qpDisplay!==undefined){await post("/api/quick-poll/control",{action:"display",display:b.dataset.qpDisplay});return;}
 if(b.dataset.qpControl!==undefined){const action=b.dataset.qpControl;
  if(["dismiss","revote"].includes(action)&&!confirm(action==="dismiss"?"Dismiss Quick Poll and restore the classroom?":"Save this round's tally and begin a revote?"))return;
  await post("/api/quick-poll/control",{action});return;
 }
}
async function refresh(force=false){
 if(loading)return;
 if(role==="student"&&(!params()||typeof studentNeedsJoin==="function"&&studentNeedsJoin())){poll=null;if(root)root.hidden=true;previousStudent="";return;}
 loading=true;
 try{
  const query=params();if(!query)return;
  const data=await api("/api/quick-poll/state?"+query.toString());
  const old=poll;poll=data.active?data.poll:null;
  serverOffset=poll?.serverTime?poll.serverTime-Date.now()/1000:0;
  if(role==="teacher"){updateLive();}
  else{
   root.hidden=!poll;
   if(poll){if(role==="shared")root.innerHTML=sharedView(poll);else renderStudent(force||!old||old.id!==poll.id);}
   else previousStudent="";
  }
  timer();
 }catch(e){
  if(role==="teacher"&&open)error(e);
  if(role==="student"&&root&&String(e.message).includes("(403)")){
    // A new class session invalidates the previous poll and voting access.
    root.hidden=true;poll=null;previousStudent="";
  }else if(role==="student"&&root&&!root.hidden){
    const msg=$("#qpVoteError",root);if(msg)msg.textContent="Reconnecting — please wait before submitting again.";
  }
 }finally{loading=false;}
}
function init(){
 if(!["teacher","student","shared"].includes(role))return;
 if(role==="teacher"){
  launcher=document.createElement("button");launcher.id="qpLauncher";launcher.innerHTML="⚡ QUICK POLL";
  launcher.title="Create, launch or manage a Quick Poll";launcher.setAttribute("aria-expanded","false");
  launcher.onclick=()=>{open=!open;renderEditor();};
  document.body.append(launcher);libraryLoad();
  window.addEventListener("keydown",e=>{if(open&&e.key==="Escape"){open=false;renderEditor();}});
 }else{
  root=document.createElement("div");root.id="qpPublicOverlay";root.hidden=true;document.body.append(root);
  if(role==="student")root.addEventListener("click",studentClick);
 }
 refresh();setInterval(refresh,2200);setInterval(timer,500);
}
window.SIQuickPoll={refresh,open:()=>{if(role==="teacher"){open=true;renderEditor();}}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();