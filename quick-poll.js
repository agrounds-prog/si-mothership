/* SI Mothership Quick Poll — additive class-session overlay, no activityRun edits. */
(()=>{
"use strict";
if(window.SIQuickPoll)return;
const role=new URLSearchParams(location.search).get("role")||"teacher";
// Session identity changes after Reset Session without reloading each open screen.
let sid=window.__SI_SESSION_ID__||"",code=window.__SI_JOIN_CODE__||"";
let lastSessionCheck=0,sessionCheck=null;
const colors=["#5ce8ff","#89ef9c","#bc87ff","#ffb96b","#ff79a4","#ffe180"];
const styles={cards:"Image Leaderboard",bars:"Bar Chart",donut:"Donut Chart",showdown:"Two-Sided Showdown"};
const graphicVersion="SHOW GRAPHICS 4.3";
const styleArt={
 bars:'<span class="qp-style-art qp-style-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>',
 donut:'<span class="qp-style-art qp-style-donut" aria-hidden="true"><i></i></span>',
 showdown:'<span class="qp-style-art qp-style-versus" aria-hidden="true"><b>A</b><em>VS</em><b>B</b></span>',
 cards:'<span class="qp-style-art qp-style-cards" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'
};
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
let draft=fresh(),poll=null,library=[],selected=[],open=false,list=false,busy=false,loading=false,previousStudent="",serverOffset=0,studioTab="create";
let root=null,dialog=null,launcher=null,notice="",fromSiPlus=false;
let sharedRenderedSignature="",teacherPreview=null,teacherPreviewMode="live",teacherPreviewSignature="";
/* The existing shared screen stays open when Reset Session rotates its ID.
   Re-check the authoritative session only when a stale-ID request is rejected.
   Old student identity is NEVER promoted to a new class: the server still
   validates both the new session and the student's current roster token. */
async function reconcileSession(){
 const now=Date.now();
 if(sessionCheck)return sessionCheck;
 // Protect the endpoint if a student has not joined the new class.
 if(now-lastSessionCheck<5000)return false;
 lastSessionCheck=now;
 sessionCheck=(async()=>{
  try{
   const r=await fetch("/api/session/info",{cache:"no-store"});
   if(!r.ok)return false;
   const info=await r.json();
   const newSid=String(info.session_id||""),newCode=String(info.code||"");
   if(!newSid||!newCode||(newSid===sid&&newCode===code))return false;
   sid=newSid;code=newCode;
   poll=null;selected=[];previousStudent="";
   if(root){root.hidden=true;root.innerHTML="";root.dataset.qpSignature="";sharedRenderedSignature="";}
   if(role==="teacher"){updateLive();syncMirror();}
   return true;
  }catch{return false;}
 })();
 try{return await sessionCheck;}finally{sessionCheck=null;}
}
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
 const r=await fetch(path,opts);
 const body=await r.text();
 let value=null;
 try{value=JSON.parse(body);}catch{}
 if(!r.ok){
  const serverMessage=(typeof value?.error==="string"&&value.error)
   ||(typeof value?.message==="string"&&value.message)
   ||(body&&!body.trimStart().startsWith("<")?body:"");
  const fallback=r.status===401?"Teacher login required. Sign in again, then reopen Quick Poll."
   :r.status===403?"Class connection expired. Rejoin the current classroom."
   :"Quick Poll request failed";
  throw Error(String(serverMessage||fallback).trim().slice(0,200)+" ("+r.status+")");
 }
 return value;
}
const remaining=p=>p?.phase==="open"&&p.endAt!=null?Math.max(0,Math.ceil(p.endAt-Date.now()/1000-serverOffset)):null;
function timer(){
 if(!poll)return;
 const n=remaining(poll),label=n===null?(poll.phase==="open"?"NO TIMER":"CLOSED"):String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
 document.querySelectorAll("[data-quick-poll-timer]").forEach(el=>{if(el.textContent!==label)el.textContent=label;});
}
const pct=(n,d)=>d?Math.round(n/d*100):0;
function pollVizData(p){
 const voters=Math.max(0,Number(p.voters)||0);
 const values=p.choices.map((c,i)=>({c,i,n:Math.max(0,Number(p.counts?.[c.id])||0)}));
 const selections=values.reduce((n,v)=>n+v.n,0);
 const top=Math.max(0,...values.map(v=>v.n));
 const leaders=top>0?values.filter(v=>v.n===top):[];
 values.forEach(v=>{v.percent=pct(v.n,voters);v.share=pct(v.n,selections);v.isLeader=top>0&&v.n===top});
 return {values,voters,selections,top,leaders};
}

/* Self-contained vector artwork: no external asset, tracking, or image upload. */
const qpV6Paths=[
 '<circle cx="50" cy="49" r="23"/><ellipse cx="50" cy="49" rx="41" ry="13" transform="rotate(-22 50 49)"/><circle cx="73" cy="20" r="4" fill="currentColor" stroke="none"/>',
 '<path d="M50 13 Q72 32 68 60 L50 77 32 60 Q28 32 50 13Z"/><circle cx="50" cy="42" r="9"/><path d="M33 53 19 68 35 65 M67 53 81 68 65 65 M44 80 50 93 56 80"/>',
 '<path d="M52 8 23 53 H45 L36 91 80 41 H55 Z" fill="currentColor" fill-opacity=".32"/>',
 '<ellipse cx="50" cy="50" rx="39" ry="18"/><ellipse cx="50" cy="50" rx="39" ry="18" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="39" ry="18" transform="rotate(120 50 50)"/><circle cx="50" cy="50" r="8" fill="currentColor" stroke="none"/>',
 '<path d="M50 12 61 38 89 50 61 61 50 89 39 61 11 50 39 38 Z"/><circle cx="50" cy="50" r="11"/><path d="M24 20 30 14 M76 80 82 86"/>',
 '<path d="M50 10 82 29 82 71 50 90 18 71 18 29Z"/><circle cx="50" cy="50" r="25"/><path d="M50 25 62 50 50 75 38 50Z" fill="currentColor" fill-opacity=".24"/>'
];
const qpV6Icon=i=>'<span class="qp-v6-emblem" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false" fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round">'+qpV6Paths[i%6]+'</svg></span>';
const qpV6Crest=()=>'<svg class="qp-v6-crest" viewBox="0 0 60 60" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linejoin="round"><path d="M10 21 19 30 30 14 41 30 50 21 44 45H16Z" fill="currentColor" fill-opacity=".16"/><path d="M16 49H44"/><path d="M25 35H35"/></svg>';
function qpV6Turnout(voters,eligible){
 const total=Math.max(0,Number(eligible)||0);
 const value=Math.min(100,Math.max(0,total?Math.round(voters/total*100):0));
 return '<div class="qp-v6-participation" role="group" aria-label="'+value+' percent classroom participation">'+
  '<span class="qp-v6-turnout-wheel" aria-hidden="true"><svg viewBox="0 0 52 52" focusable="false">'+
  '<circle cx="26" cy="26" r="21" fill="none" stroke="#1d425f" stroke-width="5"/>'+
  '<circle cx="26" cy="26" r="21" pathLength="100" fill="none" stroke="#66f0d4" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+value+' 100" transform="rotate(-90 26 26)"/></svg>'+
  '<b>'+value+'<small>%</small></b></span>'+
  '<span class="qp-v6-participation-copy"><strong>CREW TURNOUT</strong><small>'+voters+' OF '+total+' CHECKED IN</small></span></div>';
}

const media=(c,i)=>'<div class="qp-image" style="--qp-color:'+colors[i%6]+'">'+
 (c.image?'<img alt="'+esc(c.label)+'" src="'+c.image+'">':qpV6Icon(i))+'</div>';
const badge=p=>'<div class="qp-status"><strong>'+(p.phase==="open"?"● VOTING OPEN":"✓ VOTING CLOSED")+'</strong><b data-quick-poll-timer>—</b><span>'+(p.voters==null?"PRIVATE":p.voters+" of "+(p.eligible??0))+' VOTED</span></div>';
function results(p){
 if(!p.counts)return '<div class="qp-secret qp-v4-secret"><div class="qp-v4-secret-orbit"><span>◈</span></div><small>RESULTS SEALED</small><h2>Waiting for the reveal</h2><p>Votes are coming in. Mission Control will reveal the results.</p><div class="qp-v4-secret-bars"><i></i><i></i><i></i><i></i><i></i></div></div>';
 const {values,voters,selections,leaders}=pollVizData(p);
 const sub=p.multiple?'Percentages show the share of students selecting each answer.':'Percentages show the share of students voting.';
 const winner=leaders.length===1?'LEADING SIGNAL · '+esc(leaders[0].c.label):leaders.length>1?'TIED LEAD · '+leaders.length+' ANSWERS':selections?'RESULTS LIVE':'AWAITING FIRST VOTE';
 const ribbon='<div class="qp-v4-results-heading"><div class="qp-v6-title-block"><span class="qp-v4-overline">◈ LIVE DATA VISUALIZATION · MISSION CONTROL</span><strong>'+esc(styles[p.display]||'Results')+'</strong></div>'+qpV6Turnout(voters,p.eligible)+'<div class="qp-v4-heading-totals"><b>'+voters+'</b><span>STUDENTS VOTED</span></div></div>';
 const footer='<div class="qp-v4-data-footer"><span>'+sub+'</span><b>'+selections+' TOTAL '+(selections===1?'SELECTION':'SELECTIONS')+'</b></div>';
 if(p.display==='bars'){
  const rows=values.map((v)=>'<div class="qp-v4-bar-row '+(v.isLeader?'is-leader':'')+'" style="--qp-color:'+colors[v.i%6]+'">'+
    '<div class="qp-v4-bar-meta"><span class="qp-v4-bar-index">'+String(v.i+1).padStart(2,'0')+'</span>'+
    '<div class="qp-v4-bar-symbol">'+(v.c.image?'<img src="'+v.c.image+'" alt="">':qpV6Icon(v.i))+'</div>'+
    '<div class="qp-v4-bar-title"><strong>'+esc(v.c.label)+'</strong><span>'+(v.isLeader?'✦ CURRENT LEADER':v.n+' '+(v.n===1?'VOTE':'VOTES'))+'</span></div>'+(v.isLeader?'<span class="qp-v6-bar-laurel" aria-label="Current leading answer">'+qpV6Crest()+'</span>':'')+
    '<b class="qp-v4-bar-percent">'+v.percent+'<small>%</small></b></div>'+
    '<div class="qp-v4-bar-rail" role="img" aria-label="'+esc(v.c.label)+': '+v.percent+' percent, '+v.n+' votes"><div class="qp-v4-bar-fill" style="width:'+v.percent+'%"></div><span class="qp-v4-bar-value">'+v.n+' VOTES</span></div></div>').join('');
  return '<section class="qp-v4-stage qp-v4-bars">'+ribbon+'<div class="qp-v4-bar-list">'+rows+'</div><div class="qp-v4-leadline qp-v6-leader-banner '+(leaders.length===1?'has-winner':leaders.length>1?'has-tie':'pending')+'">'+(leaders.length?qpV6Crest():'<span class="qp-v6-wait-icon">◉</span>')+'<strong>'+winner+'</strong><span class="qp-v6-leader-line"></span></div>'+footer+'</section>';
 }
 if(p.display==='donut'){
  let from=0;
  const stops=values.map(v=>{
   const share=selections?v.n/selections*100:0,begin=from,finish=from+share;from=finish;
   const gap=share>1.5?0.65:0;
   return colors[v.i%6]+' '+(begin+gap).toFixed(3)+'% '+Math.max(begin+gap,finish-gap).toFixed(3)+'%';
  });
  // Keep slices numerically accurate; a .65% seam simply separates colored
  // sections visually, while the legend always uses the actual vote totals.
  const bg=selections?'conic-gradient(from -90deg,'+stops.join(',')+')':'conic-gradient(#24445f 0% 100%)';
  const legend=values.map(v=>'<div class="qp-v4-legend-row '+(v.isLeader?'is-leader':'')+'" style="--qp-color:'+colors[v.i%6]+'">'+
   '<span class="qp-v4-legend-dot"></span><div><strong>'+esc(v.c.label)+'</strong><small>'+v.n+' '+(v.n===1?'selection':'selections')+'</small></div>'+
   '<b>'+v.share+'<small>%</small></b></div>').join('');
  return '<section class="qp-v4-stage qp-v4-donut">'+ribbon+'<div class="qp-v4-donut-composition">'+
   '<div class="qp-v4-ring-frame"><div class="qp-v4-ring-glow"></div><div class="qp-v6-ring-deco" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="qp-v4-ring" role="img" aria-label="Vote share donut chart, '+selections+' selections" style="background:'+bg+'"><div class="qp-v4-ring-hole"><small>CREW RESPONSES</small><b>'+selections+'</b><span>TOTAL SELECTIONS</span></div></div><span class="qp-v4-ring-annotation">◇ SIGNAL BREAKDOWN</span></div>'+
   '<div class="qp-v4-legend"><div class="qp-v4-legend-head"><strong>THE CREW CHOSE</strong><span>SHARE OF SELECTIONS</span></div>'+legend+
   '<div class="qp-v4-legend-summary qp-v6-legend-banner">'+(leaders.length?qpV6Crest():'<span>◉</span>')+'<span>'+winner+'</span></div></div></div>'+footer+'</section>';
 }
 if(p.display==='showdown'&&values.length===2){
  const a=values[0],b=values[1],isTie=a.n===b.n,leading=a.n>b.n?a:b;
  const sides=values.map((v,i)=>'<div class="qp-v4-versus-side '+(v.isLeader?'is-leader':'')+'" style="--qp-color:'+colors[v.i%6]+'">'+
   '<div class="qp-v4-vs-corner"><span>'+(['ALPHA','BRAVO'][i])+' SIGNAL</span><strong>'+(v.isLeader?(isTie&&v.n?'TIED LEAD':'IN THE LEAD'):'CREW PICK')+'</strong></div>'+(v.isLeader?'<div class="qp-v6-vs-winner">'+qpV6Crest()+'</div>':'')+
   '<div class="qp-v4-vs-art">'+media(v.c,v.i)+'</div><h2>'+esc(v.c.label)+'</h2>'+
   '<div class="qp-v4-vs-score"><b>'+v.percent+'</b><span>%</span></div>'+
   '<div class="qp-v4-vs-votes"><b>'+v.n+'</b> '+(v.n===1?'VOTE':'VOTES')+'</div></div>').join('<span class="qp-v4-versus-medal" aria-hidden="true"><em>VS</em></span>');
  const split=selections?
   '<div class="qp-v4-vs-meter" role="img" aria-label="'+esc(a.c.label)+': '+a.n+'; '+esc(b.c.label)+': '+b.n+' votes"><span style="width:'+(a.n/selections*100)+'%;background:'+colors[a.i%6]+'"></span><span style="width:'+(b.n/selections*100)+'%;background:'+colors[b.i%6]+'"></span></div>':
   '<div class="qp-v4-vs-meter qp-v4-vs-empty"><span>AWAITING VOTES</span></div>';
  return '<section class="qp-v4-stage qp-v4-versus">'+ribbon+'<div class="qp-v4-versus-tiles">'+sides+'</div>'+
   '<div class="qp-v4-vs-bottom"><div><span>HEAD-TO-HEAD</span><strong>'+(!selections?'AWAITING FIRST VOTE':isTie?'NECK AND NECK':esc(leading.c.label)+' LEADS BY '+Math.abs(a.n-b.n))+'</strong></div>'+split+'</div>'+footer+'</section>';
 }
 const cards=values.map(v=>'<div class="qp-v4-choice-tile '+(v.isLeader?'is-leader':'')+'" style="--qp-color:'+colors[v.i%6]+'">'+
  '<div class="qp-v4-choice-header"><span>CHOICE '+String(v.i+1).padStart(2,'0')+'</span>'+(v.isLeader?'<b class="qp-v6-card-winner">'+qpV6Crest()+' '+(leaders.length>1?'TIED LEAD':'TOP CHOICE')+'</b>':'<b>CREW SIGNAL</b>')+'</div>'+
  '<div class="qp-v4-choice-art">'+media(v.c,v.i)+'</div><strong class="qp-v4-choice-name">'+esc(v.c.label)+'</strong>'+
  '<div class="qp-v4-choice-numbers"><div><b>'+v.percent+'<small>%</small></b><span>OF VOTERS</span></div><div><b>'+v.n+'</b><span>VOTES</span></div></div>'+
  '<div class="qp-v4-choice-meter"><span style="width:'+v.percent+'%"></span></div></div>').join('');
 return '<section class="qp-v4-stage qp-v4-cards">'+ribbon+'<div class="qp-v4-cards-grid qp-v4-count-'+values.length+'">'+cards+'</div>'+footer+'</section>';
}
/* Compact, accurate chart rendering for the teacher's existing Shared Screen
   preview. The full projector view uses sharedView() on ?role=shared. */
function mirrorResults(p){
 if(!p.counts)return '<div class="qp-mirror-private">◈ RESULTS SEALED · WAITING FOR REVEAL</div>';
 const {values,voters,selections,leaders}=pollVizData(p);
 if(p.display==='bars'){
  return '<div class="qp-mirror-bars qp-v4-mirror-bars">'+values.map(v=>'<div class="qp-mirror-bar" style="--qp-color:'+colors[v.i%6]+'">'+
   '<span>'+esc(v.c.label)+'</span><div class="qp-mirror-track"><i style="width:'+v.percent+'%;background:var(--qp-color)"></i></div>'+
   '<b>'+v.percent+'%</b></div>').join('')+'</div>';
 }
 if(p.display==='donut'){
  let from=0;const stops=values.map(v=>{const t=from+(selections?v.n/selections*100:0),css=colors[v.i%6]+' '+from+'% '+t+'%';from=t;return css;});
  return '<div class="qp-mirror-donut-layout qp-v4-mirror-donut"><div class="qp-mirror-donut" style="background:'+
   (selections?'conic-gradient(from -90deg,'+stops.join(',')+')':'#24445f')+'"><span>'+selections+'<small>selections</small></span></div>'+
   '<div class="qp-mirror-legend">'+values.map(v=>'<div><i style="background:'+colors[v.i%6]+'"></i><b>'+esc(v.c.label)+'</b><span>'+v.share+'%</span></div>').join('')+'</div></div>';
 }
 if(p.display==='showdown'&&values.length===2){
  return '<div class="qp-mirror-showdown qp-v4-mirror-vs">'+values.map((v,i)=>'<div style="--qp-color:'+colors[v.i%6]+'">'+
   '<b>'+esc(v.c.label)+'</b><strong>'+v.percent+'%</strong><span>'+v.n+' votes</span></div>'+
   (i===0?'<em>VS</em>':'')).join('')+'</div>';
 }
 return '<div class="qp-mirror-cards qp-v4-mirror-cards">'+values.map(v=>'<div style="--qp-color:'+colors[v.i%6]+'">'+
  (v.c.image?'<img src="'+v.c.image+'" alt="">':'<i>✦</i>')+'<b>'+esc(v.c.label)+'</b><strong>'+v.percent+'% <small>· '+v.n+' votes</small></strong></div>').join('')+'</div>';
}
function mirrorView(p){
 return '<div class="qp-mirror-scene"><div class="qp-mirror-heading"><span>✦ QUICK POLL</span><b>'+esc(styles[p.display]||styles.cards)+'</b></div>'+
 '<h3>'+esc(p.question)+'</h3>'+mirrorResults(p)+
 '<footer>'+esc(p.phase==="open"?"VOTING OPEN":"VOTING CLOSED")+' · '+Number(p.voters||0)+' voted · Round '+Number(p.round||1)+'</footer></div>';
}
function syncMirror(){
 if(role!=="teacher")return;
 const mirror=$("#mirrorContent")?.closest(".mirror-screen");
 if(!mirror)return;
 let preview=$("#qpMirrorPreview",mirror);
 if(!preview){
  preview=document.createElement("div");preview.id="qpMirrorPreview";
  preview.hidden=true;preview.setAttribute("aria-label","Quick Poll shared-screen preview");
  mirror.appendChild(preview);
 }
 const visible=!!poll?.sharedVisible;
 preview.hidden=!visible;
 if(visible){
  const signature=JSON.stringify([poll.id,poll.phase,poll.question,poll.display,poll.voters,poll.counts,poll.round,poll.visibility,poll.before]);
  if(preview.dataset.qpSignature!==signature){
   preview.innerHTML=mirrorView(poll);
   preview.dataset.qpSignature=signature;
  }
 }
}
function sharedView(p,flash=false){
 const comparison=p.before&&p.counts?'<aside class="qp-v4-comparison"><div class="qp-v4-comparison-head"><span>◉ TWO-ROUND COMPARISON</span><strong>BEFORE → AFTER</strong></div><div class="qp-v4-comparison-items">'+p.choices.map((c,i)=>{
  const before=Math.max(0,Number(p.before[c.id])||0),after=Math.max(0,Number(p.counts[c.id])||0),delta=after-before;
  return '<div class="qp-v4-comparison-item" style="--qp-color:'+colors[i%6]+'"><b>'+esc(c.label)+'</b><span>'+before+'</span><i>→</i><strong>'+after+'</strong><em class="'+(delta>=0?'positive':'negative')+'">'+(delta>=0?'+':'')+delta+'</em></div>';
 }).join('')+'</div></aside>':'';
 return '<div class="qp-projector qp-v4-projector qp-v6-broadcast '+(flash?'qp-v6-new-signal':'')+'"><span class="qp-v6-background-beam" aria-hidden="true"></span><header class="qp-v4-header"><div class="qp-v4-brand"><span class="qp-v4-brand-orbit"><span class="qp-v6-beacon-core">✦</span><i></i><i></i></span><div><small>SI MOTHERSHIP / LIVE CLASSROOM</small><b>QUICK <em>POLL</em></b></div></div><div class="qp-v4-header-right"><span class="qp-v4-header-live">◉ '+(p.phase==='open'?'LIVE RESULTS':'POLL CLOSED')+'</span><small>ASK · VOTE · CONNECT</small></div></header>'+
 '<div class="qp-v4-question"><span class="qp-v6-question-label">◇ <i></i> THE BIG QUESTION <i></i> ◇</span><h1>'+esc(p.question)+'</h1>'+(p.description?'<p>'+esc(p.description)+'</p>':'')+'</div>'+
 badge(p)+results(p)+comparison+
 '<footer class="qp-v4-footer"><span>◈ EVERY VOICE COUNTS</span><strong>ROUND '+Number(p.round||1)+'</strong><span>MOTHERSHIP · CLASSROOM LIVE</span></footer></div>';
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
function legacyEditorHtml(){
 const gallery=list?'<div class="qp-library"><strong>QUICK TEMPLATES</strong><div>'+sample.map((t,i)=>'<button type="button" data-qp-template="'+i+'">'+esc(t[0])+'</button>').join("")+'</div><strong>YOUR SAVED PROMPTS</strong>'+
 (library.length?'<div>'+library.map(t=>'<span><button type="button" data-qp-load="'+esc(t.id)+'">'+esc(t.name)+'</button><button type="button" class="qp-del" data-qp-delete="'+esc(t.id)+'">×</button></span>').join("")+'</div>':'<p>No saved prompts yet.</p>')+'</div>':"";
 return '<div class="qp-teacher"><header><div><small>🚀 MOTHERSHIP</small><h2>QUICK <em>POLL</em></h2><span>Ask · Vote · See · Discuss · Repeat</span></div><button type="button" data-qp-close aria-label="Close Poll Studio">×</button></header>'+
 '<div class="qp-teacher-scroll"><div id="qpTopError" class="qp-editor-notice" role="alert" '+(notice?'':'hidden')+'>'+esc(notice)+'</div><section id="qpTeacherLive"></section>'+
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

function createPaneHtml(){
 // Reuse every existing input, choice, setting and upload handler unchanged.
 const source=document.createElement("div");
 source.innerHTML=legacyEditorHtml();
 const pane=source.querySelector(".qp-teacher-scroll");
 pane.querySelector("#qpTeacherLive")?.remove();
 pane.querySelector(".qp-actionbar")?.remove();
 pane.querySelector(".qp-library")?.remove();
 const question=pane.querySelector("#qpQuestion")?.closest(".qp-field");
 const directions=pane.querySelector("#qpDescription")?.closest(".qp-field");
 const headings=[...pane.querySelectorAll(".qp-subhead")];
 const choices=pane.querySelector(".qp-edit-grid");
 const settings=pane.querySelector(".qp-settings");
 const checks=pane.querySelector(".qp-checks");
 const maximum=pane.querySelector("#qpLimit")?.closest(".qp-field");
 const warning=pane.querySelector("#qpTopError");
 const bottomError=pane.querySelector("#qpError");
 const sendbar=pane.querySelector(".qp-sendbar");
 const wrap=(title,note,klass,nodes)=>{
  const section=document.createElement("section");
  section.className="qp-studio-section "+klass;
  section.innerHTML='<div class="qp-section-heading"><b>'+title+'</b><span>'+note+'</span></div>';
  nodes.forEach(node=>{if(node)section.appendChild(node);});
  return section;
 };
 const questionSection=wrap("01 · YOUR QUESTION","What should the crew answer?","qp-question-section",[question,directions]);
 const choiceSection=wrap("02 · ANSWER CHOICES","Select 2–6 answers","qp-choice-section",[headings[0],choices]);
 const settingsSection=wrap("03 · POLL SETTINGS","Voting and presentation","qp-settings-section",[settings,checks,maximum]);
 headings[1]?.remove();
 if(headings[0])headings[0].classList.add("qp-choices-toolbar");
 if(sendbar)sendbar.classList.add("qp-studio-footer");
 pane.replaceChildren();
 [warning,questionSection,choiceSection,settingsSection,sendbar,bottomError].forEach(node=>{if(node)pane.appendChild(node);});
 return '<section class="qp-studio-pane qp-create-pane">'+
  '<div class="qp-pane-heading"><div><span class="qp-eyebrow">DESIGN YOUR NEXT QUESTION</span>'+
  '<h3>Create Poll</h3><p>Build a question, choose answers, and send it to the current class.</p></div>'+
  '<button type="button" data-qp-gallery>▣ Browse Library</button></div>'+
  pane.innerHTML+'</section>';
}
function libraryPaneHtml(){
 const starters=sample.map((item,i)=>
  '<button type="button" class="qp-template-card" data-qp-template="'+i+'">'+
  '<span class="qp-template-symbol">'+["✦","✓","♡","⌁","◉"][i]+'</span>'+
  '<span class="qp-template-copy"><small>QUICK STARTER '+(i+1)+'</small><b>'+esc(item[0])+'</b>'+
  '<em>'+esc(item[1])+'</em></span><span class="qp-template-arrow">↗</span></button>').join("");
 const saved=library.length?library.map(item=>
  '<div class="qp-saved-card"><span class="qp-saved-icon">▣</span>'+
  '<div class="qp-saved-copy"><small>SAVED PROMPT</small><b>'+esc(item.name)+'</b>'+
  '<span>'+esc(item.poll?.question||"Ready to edit")+'</span></div>'+
  '<div class="qp-saved-actions"><button type="button" data-qp-load="'+esc(item.id)+'">Load & Edit</button>'+
  '<button type="button" class="qp-del" data-qp-delete="'+esc(item.id)+'" aria-label="Delete '+esc(item.name)+'">×</button></div></div>').join(""):
  '<div class="qp-library-empty"><span>▣</span><b>No saved prompts yet</b>'+
  '<p>Create a poll and use Save Prompt to keep it for another class.</p>'+
  '<button type="button" data-qp-tab="create">Create a Poll</button></div>';
 return '<section class="qp-studio-pane qp-library-pane"><div class="qp-pane-heading">'+
  '<div><span class="qp-eyebrow">YOUR TEACHING TOOLS</span><h3>Poll Library</h3>'+
  '<p>Reuse a starter or open a saved question without interrupting the live poll.</p></div>'+
  '<button type="button" data-qp-new>＋ New Poll</button></div>'+
  '<div class="qp-library-section"><div class="qp-section-heading"><b>QUICK STARTERS</b><span>5 customizable prompts</span></div>'+
  '<div class="qp-template-grid">'+starters+'</div></div>'+
  '<div class="qp-library-section"><div class="qp-section-heading"><b>SAVED PROMPTS</b><span>'+library.length+' saved</span></div>'+
  '<div class="qp-saved-grid">'+saved+'</div></div></section>';
}
function livePaneHtml(){
 return '<section class="qp-studio-pane qp-live-pane"><div class="qp-pane-heading">'+
  '<div><span class="qp-eyebrow">MISSION CONTROL · LIVE RESULTS</span><h3>Live Poll</h3>'+
  '<p>Control voting, chart styles and the shared-screen presentation.</p></div>'+
  '<button type="button" data-qp-new>＋ New Poll</button></div>'+
  '<div id="qpTeacherLive">'+liveHtml(poll)+'</div></section>';
}
function editorHtml(){
 const items=[["live","◉","Live Poll"],["create","✎","Create Poll"],["library","▣","Poll Library"]];
 const tabs=items.map(([id,glyph,label])=>
  '<button type="button" role="tab" id="qpTab-'+id+'" data-qp-tab="'+id+'" '+
  'aria-selected="'+(studioTab===id)+'" aria-controls="qpStudioContent" class="qp-studio-tab '+
  (studioTab===id?"active":"")+'"><span class="qp-tab-icon">'+glyph+'</span><span>'+label+'</span>'+
  (id==="live"&&poll?.phase==="open"?'<i class="qp-tab-live-dot"></i>':"")+'</button>').join("");
 const pane=studioTab==="live"?livePaneHtml():studioTab==="library"?libraryPaneHtml():createPaneHtml();
 return '<div class="qp-teacher qp-studio-v2"><header><div>'+
  '<small>🚀 MOTHERSHIP · MISSION CONTROL</small><h2>QUICK <em>POLL</em></h2>'+
  '<span>Ask · Vote · See · Discuss · Repeat</span></div>'+
  '<button type="button" data-qp-close aria-label="Close Poll Studio">×</button></header>'+
  '<nav class="qp-studio-tabs" role="tablist" aria-label="Quick Poll Studio views">'+tabs+'</nav>'+
  '<div class="qp-studio-context"><span class="qp-context-pulse '+(poll?.phase==="open"?"live":"")+'"></span>'+
  '<b id="qpStudioStatus">'+(poll?.phase==="open"?"VOTING OPEN":poll?"POLL CLOSED":"NO ACTIVE POLL")+'</b>'+
  '<span id="qpStudioCurrentQuestion">'+esc(poll?.question||"Ready for a new question")+'</span>'+
  '<span class="qp-context-link" id="qpStudioScreenState">'+(poll?.sharedVisible?"● SHARED SCREEN LIVE":"Shared screen idle")+'</span></div>'+
  '<div class="qp-teacher-scroll" id="qpStudioContent" role="tabpanel" aria-labelledby="qpTab-'+studioTab+'">'+pane+'</div></div>';
}


// Teacher-only chart showcase. Never writes to the poll API, the shared screen,
// or student votes. The sample is explicitly labeled as DEMO on the overlay.
function previewSamplePoll(p){
 const model=clone(p),choiceCount=p.choices.length;
 const samples={
  2:[12,8],3:[10,6,4],4:[9,6,3,2],
  5:[8,5,3,2,2],6:[7,5,3,2,2,1]
 };
 const amounts=samples[choiceCount]||[12,8];
 model.counts=Object.fromEntries(model.choices.map((c,i)=>[c.id,amounts[i]||0]));
 model.voters=20;model.eligible=24;model.before=null;model.endAt=null;
 model.phase="open";
 return model;
}
function closeTeacherPreview(){
 if(teacherPreview){teacherPreview.remove();teacherPreview=null;}
 teacherPreviewSignature="";
}
function syncTeacherPreview(force=false){
 if(role!=="teacher"||!teacherPreview)return;
 if(!poll){closeTeacherPreview();return;}
 const demo=teacherPreviewMode==="demo";
 const sig=JSON.stringify([poll.id,poll.question,poll.description,poll.display,poll.phase,
  poll.choices,poll.voters,poll.counts,poll.eligible,poll.multiple,poll.round,poll.before,demo]);
 if(!force&&teacherPreviewSignature===sig)return;
 teacherPreviewSignature=sig;
 const view=demo?previewSamplePoll(poll):poll;
 teacherPreview.innerHTML='<div class="qp-v5-preview-toolbar">'+
  '<div class="qp-v5-preview-identity"><span class="qp-v5-preview-icon">◈</span>'+
   '<div><b>QUICK POLL · SCREEN PREVIEW</b><small>TEACHER ONLY · NEVER SENT TO STUDENTS</small></div></div>'+
  '<div class="qp-v5-preview-modes" role="group" aria-label="Preview result data">'+
   '<button type="button" data-qp-preview-mode="live" aria-pressed="'+(!demo)+'" class="'+(!demo?'active':'')+'">◉ Actual Results</button>'+
   '<button type="button" data-qp-preview-mode="demo" aria-pressed="'+demo+'" class="'+(demo?'active':'')+'">✦ Demo Results</button></div>'+
  '<button type="button" class="qp-v5-preview-close" data-qp-preview-close aria-label="Close preview">× <span>CLOSE</span></button>'+
 '</div>'+
 '<div class="qp-v5-preview-note '+(demo?'demo':'actual')+'">'+
  (demo?'✦ DEMONSTRATION · SAMPLE COUNTS ONLY · NO LIVE VOTES CHANGED':
   '◉ LIVE CLASSROOM DATA · TEACHER PREVIEW · NOT PROJECTED')+
 '</div>'+
 sharedView(view);
 timer();
}
function openTeacherPreview(){
 if(role!=="teacher"||!poll)return;
 closeTeacherPreview();
 teacherPreviewMode=poll.voters?"live":"demo";
 teacherPreview=document.createElement("div");
 teacherPreview.id="qpPublicOverlay";
 teacherPreview.className="qp-v5-preview-mode";
 teacherPreview.setAttribute("role","dialog");
 teacherPreview.setAttribute("aria-modal","true");
 teacherPreview.setAttribute("aria-label","Teacher-only Quick Poll full-screen preview");
 teacherPreview.addEventListener("click",e=>{
  const b=e.target.closest("button");
  if(!b)return;
  if(b.hasAttribute("data-qp-preview-close")){closeTeacherPreview();return;}
  if(b.dataset.qpPreviewMode){
   teacherPreviewMode=b.dataset.qpPreviewMode==="demo"?"demo":"live";
   syncTeacherPreview(true);
  }
 });
 document.body.append(teacherPreview);
 syncTeacherPreview(true);
 const close=teacherPreview.querySelector("[data-qp-preview-close]");
 if(close)close.focus({preventScroll:true});
}

function liveHtml(p){
 if(!p)return '<div class="qp-teacher-live qp-nopoll">Create and send a question to your existing classroom session.</div>';
 return '<div class="qp-teacher-live"><div><b>'+esc(p.question)+'</b><span>'+(p.phase==="open"?"VOTING OPEN":"POLL CLOSED")+'</span></div>'+
 '<p>'+p.voters+' of '+p.eligible+' voted · Round '+p.round+'</p><div class="qp-mini-results">'+p.choices.map(c=>'<span>'+esc(c.label)+' <b>'+Number(p.counts?.[c.id]||0)+'</b></span>').join("")+'</div>'+
 '<div class="qp-display-hint qp-v4-graphics-label"><strong>◈ SHOW GRAPHICS 4.3</strong><span>SELECT A PROJECTOR PRESENTATION</span></div>'+
 '<div class="qp-display-buttons qp-v4-display-gallery">'+Object.entries(styles).filter(([k])=>k!=="showdown"||p.choices.length===2).map(([k,l])=>'<button type="button" class="qp-v4-display-tile '+(p.display===k?"on":"")+'" data-qp-display="'+k+'" aria-label="'+esc(l)+' projector view" aria-pressed="'+(p.display===k)+'">'+styleArt[k]+'<span class="qp-style-info"><b>'+esc(l)+'</b><small>'+(k==="bars"?"Big glowing vote bars":k==="donut"?"Live circular breakdown":k==="showdown"?"Two-team face-off":"Illustrated answer leaderboard")+'</small></span>'+(p.display===k?'<span class="qp-style-picked">✓ ACTIVE</span>':'')+'</button>').join("")+'</div>'+
 '<div class="qp-v5-preview-cta"><div><b>◈ SEE THE FULL EXPERIENCE</b><span>Preview this chart on your screen. Try demo votes without changing the classroom.</span></div>'+
 '<button type="button" data-qp-preview-open>▣ PREVIEW FULL SCREEN <span>↗</span></button></div>'+
 '<div class="qp-share-row"><button type="button" data-qp-share="'+(p.sharedVisible?"hide":"show")+'" class="'+(p.sharedVisible?"qp-share-on":"qp-share-off")+'">'+
 (p.sharedVisible?"◼ Hide from Shared Screen":"↗ Show on Shared Screen")+'</button>'+
 '<span class="qp-share-status '+(p.sharedVisible?"live":"")+'">'+(p.sharedVisible?"● LIVE ON SHARED SCREEN":"○ Preview only · Not displayed to class")+'</span></div>'+
 '<div class="qp-live-actions">'+(p.phase==="open"?'<button type="button" data-qp-control="close">■ Close & Reveal</button>':'<button type="button" data-qp-control="reopen">↻ Reopen</button>')+
 '<button type="button" data-qp-control="revote">↻ Revote</button><button type="button" class="qp-red" data-qp-control="dismiss">Dismiss</button></div>'+
 (p.identifiedVotes?'<details><summary>Teacher-only responses</summary>'+p.identifiedVotes.map(v=>'<p>'+esc(v.name)+': '+esc(v.choices.map(id=>p.choices.find(c=>c.id===id)?.label||"").join(", "))+'</p>').join("")+'</details>':"")+'</div>';
}
function updateLive(){
 if(role!=="teacher")return;
 const box=$("#qpTeacherLive");
 if(box){
  const sig=poll?JSON.stringify([poll.id,poll.phase,poll.question,poll.display,poll.voters,
   poll.eligible,poll.choices,poll.counts,poll.round,poll.sharedVisible,poll.identifiedVotes]):"none";
  // Preserve the currently focused chart button, scroll position, and input
  // while API polling reports unchanged state every 2.2 seconds.
  if(box.dataset.qpLiveSignature!==sig){
   box.innerHTML=liveHtml(poll);
   box.dataset.qpLiveSignature=sig;
  }
 }
 const status=$("#qpStudioStatus",dialog),heading=$("#qpStudioCurrentQuestion",dialog),screen=$("#qpStudioScreenState",dialog);
 if(status)status.textContent=poll?.phase==="open"?"VOTING OPEN":poll?"POLL CLOSED":"NO ACTIVE POLL";
 if(heading)heading.textContent=poll?.question||"Ready for a new question";
 if(screen)screen.textContent=poll?.sharedVisible?"● SHARED SCREEN LIVE":"Shared screen idle";
 if(launcher)launcher.classList.toggle("active",poll?.phase==="open");
 emitTeacherStatus();
 syncTeacherPreview();
}
function renderEditor(){
 if(role!=="teacher")return;
 if(!dialog){
  dialog=document.createElement("div");dialog.id="qpDialog";dialog.innerHTML='<div class="qp-dialog-window" role="dialog" aria-modal="true" aria-label="Quick Poll Studio"></div>';
  document.body.append(dialog);
  dialog.addEventListener("click",event=>{Promise.resolve(teacherClick(event)).catch(error);});
  dialog.addEventListener("input",event=>{try{teacherInput(event);}catch(err){error(err);}});
  dialog.addEventListener("change",event=>{try{teacherChange(event);}catch(err){error(err);}});
 }
 dialog.hidden=!open;
 if(open){
  $(".qp-dialog-window",dialog).innerHTML=editorHtml();
  if(fromSiPlus){
    const header=$(".qp-teacher header",dialog);
    const close=header?.querySelector("[data-qp-close]");
    if(close){
      const back=document.createElement("button");
      back.type="button";back.className="qp-si-plus-return";
      back.setAttribute("data-qp-return-slide","");
      back.textContent="← Back to SI+ Slides";
      back.title="Close Poll Studio. Any live poll keeps running.";
      header.insertBefore(back,close);
    }
  }
  updateLive();
 }
 if(launcher)launcher.setAttribute("aria-expanded",String(open));
}
function error(e){
 notice=String(e?.message||e).slice(0,200);
 const top=dialog?$("#qpTopError",dialog):null,bottom=dialog?$("#qpError",dialog):null;
 if(top){top.textContent=notice;top.hidden=false;top.scrollIntoView({block:"start",behavior:"auto"});}
 if(bottom)bottom.textContent=notice;
}
function clearError(){
 notice="";
 const top=dialog?$("#qpTopError",dialog):null,bottom=dialog?$("#qpError",dialog):null;
 if(top){top.textContent="";top.hidden=true;}
 if(bottom)bottom.textContent="";
}
function validateDraft(){
 const question=$("#qpQuestion",dialog);
 if(!draft.question.trim()){
  error(Error("Enter your question before sending Quick Poll."));
  if(question){question.classList.add("qp-invalid");question.focus();question.scrollIntoView({block:"center"});}
  return false;
 }
 for(let i=0;i<draft.choices.length;i++){
  if(!draft.choices[i].label.trim()){
   error(Error("Enter a label for choice "+(i+1)+" before sending."));
   const input=$('[data-qp-label="'+i+'"]',dialog);
   if(input){input.classList.add("qp-invalid");input.focus();input.scrollIntoView({block:"center"});}
   return false;
  }
 }
 if(draft.choices.length<2||draft.choices.length>6){
  error(Error("Quick Poll needs 2 to 6 choices."));
  return false;
 }
 clearError();
 return true;
}
function teacherInput(e){
 const t=e.target;
 if(t.id==="qpQuestion")draft.question=t.value;
 if(t.id==="qpDescription")draft.description=t.value;
 if(t.dataset.qpLabel!==undefined)draft.choices[Number(t.dataset.qpLabel)].label=t.value;
 if(t.matches("input,textarea"))t.classList.remove("qp-invalid");
 if(notice)clearError();
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
async function post(url,body){
 if(busy)return false;
 busy=true;clearError();
 try{
  await api(url,body);
  // Even if the regular background poll is in flight, the next tick will
  // reconcile the state. Don't lose errors or silently discard the request.
  await refresh(true);
  if(url==="/api/quick-poll/launch"){studioTab="live";renderEditor();}
  return true;
 }catch(e){error(e);return false;}
 finally{busy=false;}
}
async function teacherClick(e){
 const b=e.target.closest("button");if(!b)return;
 if(b.dataset.qpTab!==undefined){
  if(["live","create","library"].includes(b.dataset.qpTab)){studioTab=b.dataset.qpTab;clearError();renderEditor();}
  return;
 }
 if(b.hasAttribute("data-qp-return-slide")){
  open=false;fromSiPlus=false;renderEditor();return;
 }
 if(b.hasAttribute("data-qp-close")){open=false;renderEditor();return;}
 if(b.hasAttribute("data-qp-new")){draft=fresh();studioTab="create";clearError();renderEditor();return;}
 if(b.hasAttribute("data-qp-gallery")){studioTab="library";clearError();renderEditor();return;}
 if(b.hasAttribute("data-qp-add")){if(draft.choices.length<6){draft.choices.push({label:"",image:""});renderEditor();}return;}
 if(b.dataset.qpRemove!==undefined){if(draft.choices.length>2){draft.choices.splice(Number(b.dataset.qpRemove),1);draft.limit=Math.min(draft.limit,draft.choices.length);if(draft.choices.length!==2&&draft.display==="showdown")draft.display="cards";renderEditor();}return;}
 if(b.dataset.qpClearImage!==undefined){draft.choices[Number(b.dataset.qpClearImage)].image="";renderEditor();return;}
 if(b.dataset.qpTemplate!==undefined){const t=sample[Number(b.dataset.qpTemplate)];draft={...fresh(),question:t[1],choices:t[2].map(label=>({label,image:""})),sensitive:t[3],visibility:t[3]?"reveal":"live"};studioTab="create";clearError();renderEditor();return;}
 if(b.dataset.qpLoad!==undefined){const t=library.find(x=>x.id===b.dataset.qpLoad);if(t){draft={...fresh(),...clone(t.poll)};studioTab="create";clearError();renderEditor();}return;}
 if(b.dataset.qpDelete!==undefined){if(confirm("Delete this saved Quick Poll prompt?")){await post("/api/quick-poll/templates/delete",{id:b.dataset.qpDelete});await libraryLoad();}return;}
 if(b.hasAttribute("data-qp-save")){
  if(!validateDraft())return;
  const name=prompt("Save prompt as:",draft.question||"New Poll");
  if(name?.trim()&&await post("/api/quick-poll/templates",{name:name.trim(),poll:clone(draft)}))await libraryLoad();
  return;
 }
 if(b.hasAttribute("data-qp-launch")){
  if(!validateDraft())return;
  if(poll?.phase==="open"&&!confirm("Replace the live Quick Poll? Current votes will be cleared."))return;
  await post("/api/quick-poll/launch",clone(draft));
  return;
 }
 if(b.hasAttribute("data-qp-preview-open")){openTeacherPreview();return;}
 if(b.dataset.qpDisplay!==undefined){await post("/api/quick-poll/control",{action:"display",display:b.dataset.qpDisplay});return;}
 if(b.dataset.qpShare!==undefined){await post("/api/quick-poll/control",{action:"share",visible:b.dataset.qpShare==="show"});return;}
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
  if(role==="teacher"){updateLive();syncMirror();}
  else{
   root.hidden=!poll||(role==="shared"&&!poll.sharedVisible);
   if(poll){if(role==="shared"){if(poll.sharedVisible){
      const signature=JSON.stringify([poll.id,poll.phase,poll.display,poll.question,poll.description,poll.voters,poll.eligible,poll.counts,poll.round,poll.visibility,poll.before,poll.choices,poll.multiple]);
      if(force||sharedRenderedSignature!==signature){
       const freshVotes=!!old&&old.id===poll.id&&Number(poll.voters)>Number(old.voters)&&!!poll.counts;
       root.innerHTML=sharedView(poll,freshVotes);
       sharedRenderedSignature=signature;root.dataset.qpSignature=signature;
      }
     }}
     else renderStudent(force||!old||old.id!==poll.id);}
   else previousStudent="";
  }
  timer();
 }catch(e){
  const forbidden=String(e.message).includes("(403)");
  if(forbidden&&role!=="teacher"){
   // Never keep the old classroom's chart or vote panel visible after reset.
   if(root){root.hidden=true;root.innerHTML="";}
   poll=null;selected=[];previousStudent="";
   // Shared screens will recover automatically. Student devices cannot vote
   // until their current roster token is accepted by the new session.
   if(await reconcileSession()&&role==="shared")setTimeout(()=>refresh(true),0);
  }else if(role==="teacher"&&open)error(e);
  else if(role==="student"&&root&&!root.hidden){
   const msg=$("#qpVoteError",root);if(msg)msg.textContent="Reconnecting — please wait before submitting again.";
  }
 }finally{loading=false;}
}
function init(){
 if(!["teacher","student","shared"].includes(role))return;
 if(role==="teacher"){
  launcher=document.createElement("button");launcher.id="qpLauncher";launcher.innerHTML="⚡ QUICK POLL";
  launcher.title="Create, launch or manage a Quick Poll";launcher.setAttribute("aria-expanded","false");
  launcher.onclick=()=>{try{if(!open)studioTab=poll?"live":"create";open=!open;renderEditor();}catch(err){open=false;error(err);}};
  document.body.append(launcher);libraryLoad();
  window.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&teacherPreview){closeTeacherPreview();e.preventDefault();return;}
    if(open&&e.key==="Escape"){open=false;renderEditor();}
   });
  syncMirror();
 }else{
  root=document.createElement("div");root.id="qpPublicOverlay";root.hidden=true;document.body.append(root);
  if(role==="student")root.addEventListener("click",event=>{
    Promise.resolve(studentClick(event)).catch(err=>{
      const box=$("#qpVoteError",root);if(box)box.textContent=String(err?.message||err);
    });
  });
 }
 refresh();setInterval(refresh,2200);setInterval(timer,500);
}
/* SI+ integration: slide prompts are drafts, NEVER sent to students until
   the teacher selects the existing SEND TO CLASS button. Live polls cannot
   be overwritten by a presentation shortcut. */
function openFromSiPlus(source){
 if(role!=="teacher")return {mode:"unavailable"};
 fromSiPlus=true;
 if(poll?.phase==="open"){
  studioTab="live";open=true;renderEditor();
  return {mode:"live",pollId:String(poll.id||"")};
 }
 if(!source||typeof source!=="object"){studioTab=poll?"live":"create";open=true;renderEditor();return {mode:"studio"};}
 const question=String(source.question||"").trim().slice(0,240);
 const choices=Array.isArray(source.choices)?source.choices.slice(0,6).map(c=>({
  label:String(c?.label||"").trim().slice(0,100),
  image:typeof c?.image==="string"&&/^data:image\/(png|jpeg|webp);base64,/.test(c.image)
    &&c.image.length<160000?c.image:""
 })).filter(c=>c.label):[];
 if(!question||choices.length<2){studioTab="create";open=true;renderEditor();return {mode:"studio"};}
 draft={...fresh(),question,description:String(source.description||"").trim().slice(0,350),
   choices,display:choices.length===2?"showdown":"bars",limit:1};
 clearError();studioTab="create";open=true;renderEditor();
 return {mode:"prepared",choices:choices.length};
}
async function setSharedVisible(visible){
 if(role!=="teacher"||!poll)return false;
 if(busy)return false;
 busy=true;
 try{
  await api("/api/quick-poll/control",{action:"share",visible:!!visible});
  await refresh(true);
  return true;
 }catch(e){error(e);return false}
 finally{busy=false}
}
function teacherStatus(){
 if(role!=="teacher")return null;
 return {phase:poll?.phase||"none",visible:!!poll?.sharedVisible,
   voters:Math.max(0,Number(poll?.voters||0))};
}
let previousStatusSignature="";
function emitTeacherStatus(){
 if(role!=="teacher")return;
 const status=teacherStatus(),sig=JSON.stringify(status);
 if(previousStatusSignature===sig)return;
 previousStatusSignature=sig;
 window.dispatchEvent(new CustomEvent("si:quick-poll-status",{detail:status}));
}
window.SIQuickPoll={refresh,
 open:()=>{if(role==="teacher"){studioTab=poll?"live":"create";open=true;renderEditor();}},
 openFromSiPlus,teacherStatus,setSharedVisible};

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();