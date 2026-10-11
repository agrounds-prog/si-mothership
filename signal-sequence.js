/* SIGNAL SEQUENCE v1.0 — teacher-led Classic memory game; no private sequence on answer screens. */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.SignalSequence=api})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const COLORS=[["#ff4266","△","RED"],["#39a8ff","○","BLUE"],["#36e89e","□","GREEN"],["#ffca47","☆","YELLOW"]];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SPEED={slow:1150,normal:850,fast:620};
const LIB="siMothership.signalSequenceGames.v1";
function make({pilot="Teacher",speed="normal",sound=false}={}){
 const name=String(pilot||"Teacher").trim().slice(0,80)||"Teacher";
 return {version:1,id:"ss-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6),
  mode:"classic",pilot:name,speed:SPEED[speed]?speed:"normal",sound:!!sound,
  sequence:[],phase:"ready",round:0,best:0,progress:0,playbackAt:0,playbackEnd:0,lastInput:null,
  message:"Watch the lights. Memorize the sequence, then repeat it."};
}
function interval(g){return SPEED[g.speed]||SPEED.normal}
function startRound(g,{now=Date.now(),random=Math.random}={}){
 if(!g||!["ready","success"].includes(g.phase))return false;
 const raw=Number(random()),n=Math.max(0,Math.min(3,Math.floor((Number.isFinite(raw)?raw:0)*4)));
 g.sequence.push(n);g.round=g.sequence.length;g.phase="watch";g.progress=0;g.lastInput=null;
 g.playbackAt=now+650;g.playbackEnd=g.playbackAt+g.sequence.length*interval(g)+250;
 g.message="WATCH · Remember the pattern. Inputs are locked during playback.";return true;
}
function beginInput(g,now=Date.now()){
 if(g?.phase!=="watch"||now<g.playbackEnd)return false;
 g.phase="input";g.message=(g.pilot==="Teacher"?"Teacher":"Pilot")+" · Repeat "+g.round+" signal"+(g.round===1?"":"s")+".";return true;
}
function press(g,signal,now=Date.now()){
 if(g?.phase!=="input"||!Number.isInteger(signal)||signal<0||signal>3)return {error:"Input is locked."};
 const index=g.progress;
 if(signal!==g.sequence[index]){
  g.phase="failed";g.best=Math.max(g.best,g.round-1);
  g.message="SIGNAL LOST · Reached round "+g.round+". Select Retry Run to start again.";
  g.lastInput={signal,correct:false,at:now};return {ok:true,correct:false,finished:true};
 }
 g.progress++;g.lastInput={signal,correct:true,at:now};
 if(g.progress>=g.sequence.length){g.phase="success";g.best=Math.max(g.best,g.round);g.message="PERFECT REPEAT · Round "+g.round+" complete!";return {ok:true,correct:true,finished:true};}
 g.message="GREAT SIGNAL · "+g.progress+" / "+g.round+" matched.";return {ok:true,correct:true,finished:false};
}
function retry(g){if(!g)return false;const fresh=make({pilot:g.pilot,speed:g.speed,sound:g.sound});const best=g.best||0;Object.assign(g,fresh,{best});return true}
function save(g,name){const all=readLibrary().filter(x=>x.id!==g.id);all.unshift({id:g.id,name:String(name||"Signal Sequence").slice(0,70),savedAt:Date.now(),game:JSON.parse(JSON.stringify(g))});localStorage.setItem(LIB,JSON.stringify(all.slice(0,20)));return all.length}
function readLibrary(){try{const a=JSON.parse(localStorage.getItem(LIB)||"[]");return Array.isArray(a)?a:[]}catch(_){return []}}
function snapshot(g){return JSON.parse(JSON.stringify(g))}
function cue(g,now=Date.now()){
 if(g?.phase!=="watch"||!Array.isArray(g.sequence))return -1;
 const delta=now-Number(g.playbackAt),i=Math.floor(delta/interval(g));
 return delta>=0&&i>=0&&i<g.sequence.length&&(delta%interval(g)<interval(g)*.67)?g.sequence[i]:-1;
}
const polar=(r,a)=>{const v=(a-90)*Math.PI/180;return [200+Math.cos(v)*r,200+Math.sin(v)*r]};
function wedge(i,total=4){const a=i*360/total+3,b=(i+1)*360/total-3;
 const [x1,y1]=polar(175,a),[x2,y2]=polar(175,b),[x3,y3]=polar(84,b),[x4,y4]=polar(84,a);
 return "M"+x1.toFixed(1)+" "+y1.toFixed(1)+" A175 175 0 0 1 "+x2.toFixed(1)+" "+y2.toFixed(1)+" L"+x3.toFixed(1)+" "+y3.toFixed(1)+" A84 84 0 0 0 "+x4.toFixed(1)+" "+y4.toFixed(1)+"Z";
}
function donutHTML(g,{interactive=false,mini=false}={}){
 const pads=COLORS.map(([color,symbol,label],i)=>{
  const [x,y]=polar(129,i*90+45);
  return '<g class="ss-pad ss-pad-'+i+'" data-ss-pad="'+i+'" style="--ss-segment:'+color+'"'+(interactive?' data-ss-press="'+i+'" role="button" tabindex="0" aria-label="'+label+' '+symbol+'"':' aria-hidden="true"')+'><path d="'+wedge(i)+'"/><text x="'+x.toFixed(1)+'" y="'+(y+10).toFixed(1)+'" text-anchor="middle">'+symbol+'</text></g>';
 }).join("");
 const progress=g.phase==="input"||g.phase==="success"?g.progress+" / "+g.round:g.phase==="failed"?"LOST":g.phase==="watch"?"WATCH":g.round||"READY";
 return '<div class="ss-console '+(mini?"ss-console-mini":"")+'"><svg viewBox="0 0 400 400" class="ss-donut" role="img" aria-label="Four-part red triangle, blue circle, green square and yellow star memory controller">'+
 '<defs><radialGradient id="ssCore"><stop stop-color="#193a64"/><stop offset="1" stop-color="#07172c"/></radialGradient></defs><circle cx="200" cy="200" r="190" class="ss-ring"/>'+pads+
 '<circle cx="200" cy="200" r="80" fill="url(#ssCore)" stroke="#8bdfff" stroke-width="4"/><text x="200" y="182" text-anchor="middle" class="ss-core-label">ROUND</text>'+
 '<text x="200" y="231" text-anchor="middle" class="ss-core-round">'+esc(g.round||"0")+'</text></svg>'+
 '<div class="ss-console-caption">'+(g.phase==="watch"?"WATCH THE SIGNAL":g.phase==="input"?"REPEAT THE PATTERN":g.phase==="success"?"ROUND CLEARED":g.phase==="failed"?"SIGNAL LOST":"READY TO LAUNCH")+'</div>'+
 '<div class="ss-progress" aria-label="Input progress">'+esc(String(progress))+'</div></div>';
}
function header(){return '<div class="ss-heading"><div><span>SI MOTHERSHIP · MEMORY ARCADE</span><h2>SIGNAL <em>SEQUENCE</em></h2><p>WATCH · REMEMBER · REPEAT</p></div><div class="ss-heading-emblem" aria-hidden="true">✧</div></div>'}
function badge(g){return '<div class="ss-pilot"><b>✦ '+esc(g.pilot)+'</b><span>'+g.round+' ROUND · BEST '+g.best+'</span></div>'}
function sharedHTML(g,big=false){
 return '<section class="ss-public '+(big?"ss-big":"ss-mirror")+'">'+header()+'<div class="ss-public-main">'+donutHTML(g,{mini:!big})+
 '<aside class="ss-broadcast-side">'+badge(g)+'<div class="ss-status" data-ss-phase="'+esc(g.phase)+'">'+esc(g.phase==="watch"?"MEMORIZE THE LIGHTS":g.phase==="input"?"PILOT REPEATING":g.phase==="success"?"PERFECT ROUND":g.phase==="failed"?"GAME OVER":"READY FOR ROUND ONE")+'</div>'+
 '<p class="ss-message">'+esc(g.message)+'</p><div class="ss-legend">'+COLORS.map(([c,s,label])=>'<span style="--ss-segment:'+c+'"><b>'+s+'</b>'+label+'</span>').join("")+'</div></aside></div></section>';
}
function studentHTML(g,name=""){
 const pilot=String(name||"")===g.pilot,active=pilot&&g.phase==="input";
 return '<section class="ss-student">'+header()+'<div class="ss-student-meta"><strong>'+esc(pilot?"YOUR MISSION": "SPECTATOR MODE")+'</strong><span>'+esc(g.phase==="watch"?"Watch and memorize":active?"Your turn — tap the signals":g.phase==="input"?"Watch the pilot respond":g.message)+'</span></div>'+
 donutHTML(g,{interactive:active})+
 (active?'<div class="ss-student-buttons" aria-label="Large touch controls">'+COLORS.map(([color,symbol,label],i)=>'<button type="button" class="ss-touch-key" data-ss-press="'+i+'" style="--ss-segment:'+color+'" aria-label="'+label+' '+symbol+'"><b aria-hidden="true">'+symbol+'</b><span>'+label+'</span></button>').join("")+'</div>':'')+
 '<div class="ss-student-status" role="status" aria-live="polite">'+(active?'YOUR TURN · TAP THE SIGNALS IN ORDER':esc(g.message))+'</div></section>';
}
function teacherHTML(g){
 const button=(action,label,disabled=false)=>'<button type="button" data-ss-action="'+action+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
 return '<section class="ss-teacher">'+header()+'<div class="ss-teacher-main">'+donutHTML(g,{interactive:g.pilot==="Teacher"&&g.phase==="input"})+'<div class="ss-teacher-side">'+badge(g)+
 '<h3>CLASSIC · FOUR SIGNALS</h3><p>Teacher controls each round. During WATCH, the sequence plays on the projector and student device. When playback ends, the selected pilot repeats it privately.</p>'+
 '<div class="ss-actions">'+button("next",g.round?"▶ NEXT ROUND":"▶ PLAY ROUND ONE",!["ready","success"].includes(g.phase))+
 button("input","✓ OPEN INPUT",g.phase!=="watch"||Date.now()<g.playbackEnd)+
 button("retry","↻ RETRY RUN",g.phase==="ready")+
 button("save","▣ SAVE GAME")+
 button("load","▣ LOAD GAME")+
 button("exit","↩ RETURN TO CLASS")+'</div>'+
 '<div class="ss-teacher-message" role="status">'+esc(g.message)+'</div>'+
 '<div class="ss-teacher-private"><strong>MISSION CONTROL · PRIVATE SEQUENCE</strong><p>'+g.sequence.map(i=>COLORS[i][1]).join(" → ")+'</p></div></div></div></section>';
}
function setupHTML(students=[]){
 const opts=['Teacher',...new Set(students.map(n=>String(n||"").trim()).filter(Boolean))].map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join("");
 const savedGames=readLibrary().slice(0,8);
 return '<section class="ss-setup">'+header()+'<div class="ss-setup-main"><div class="ss-setup-card"><span>01 · CLASSIC GAME</span><h3>Choose your pilot</h3><label>Pilot / student<select id="ssPilot">'+opts+'</select></label><label>Playback speed<select id="ssSpeed"><option value="slow">Slow · extra time</option><option value="normal" selected>Normal</option><option value="fast">Fast · challenge</option></select></label>'+
 '<label class="ss-checkbox"><input id="ssSound" type="checkbox"> Sound cues (optional)</label>'+
 '<p>Four symbols: red triangle, blue circle, green square and yellow star. Teacher starts each round and approves the switch from watching to responding.</p><button id="ssLaunch" class="ss-primary">▶ LAUNCH SIGNAL SEQUENCE</button></div>'+
 '<div class="ss-setup-card"><span>02 · STORED MISSIONS</span><h3>Game library</h3><p>Return to a saved round without resetting any other Mothership activities.</p>'+
 (savedGames.length?savedGames.map((x,i)=>'<button class="ss-saved" data-ss-load="'+i+'">▣ '+esc(x.name)+'</button>').join(""):'<div class="ss-empty">No saved signals yet.</div>')+
 '<div class="ss-next">UP NEXT · Six/eight signals, Crew Survival, Relay and Sprint.</div></div></div></section>';
}
return {make,startRound,beginInput,press,retry,cue,interval,donutHTML,studentHTML,sharedHTML,teacherHTML,setupHTML,save,readLibrary,snapshot,LIB,COLORS,SPEED};
});
