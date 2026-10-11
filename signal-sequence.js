/* SIGNAL SEQUENCE Phase 2 — Classic, Crew Survival and Team Relay. */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.SignalSequence=api})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const COLORS=[["#ff4266","△","RED"],["#39a8ff","○","BLUE"],["#36e89e","□","GREEN"],["#ffca47","☆","YELLOW"],["#ad84ff","◇","PURPLE"],["#ff934a","⬡","ORANGE"],["#32d6d9","✚","CYAN"],["#f4efff","✹","WHITE"]];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SPEED={slow:1150,normal:850,fast:620};
const MODES={classic:"CLASSIC",survival:"CREW SURVIVAL",relay:"TEAM RELAY"};
const LIB="siMothership.signalSequenceGames.v1";
function count(g){return [4,6,8].includes(Number(g?.signals))?Number(g.signals):4}
function modeOf(g){return MODES[g?.mode]?g.mode:"classic"}
function cleanParticipants(names){return [...new Set((Array.isArray(names)?names:[]).map(x=>String(x||"").trim().slice(0,80)).filter(Boolean))].slice(0,32)}
function make({pilot="Teacher",speed="normal",sound=true,signals=4,mode="classic",participants=[]}={}){
 const m=MODES[mode]?mode:"classic",crew=cleanParticipants(participants),name=m==="survival"?"THE CREW":m==="relay"?(crew[0]||"Waiting"):String(pilot||"Teacher").trim().slice(0,80)||"Teacher";
 if(m!=="classic"&&crew.length<2)throw Error("Select at least two students for "+MODES[m]+".");
 return {version:2,id:"ss-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),
  mode:m,pilot:name,participants:crew,signals:[4,6,8].includes(Number(signals))?Number(signals):4,
  speed:SPEED[speed]?speed:"normal",sound:!!sound,sequence:[],phase:"ready",round:0,best:0,progress:0,
  playbackAt:0,playbackEnd:0,lastInput:null,lastIds:[],
  entries:m==="survival"?Object.fromEntries(crew.map(n=>[n,{progress:0,status:"alive",roundsSurvived:0}])):{},
  message:"Watch the lights. Memorize the sequence, then repeat it."};
}
function interval(g){return SPEED[g?.speed]||SPEED.normal}
function members(g){return cleanParticipants(g?.participants)}
function roster(g){return g?.entries&&typeof g.entries==="object"?g.entries:{}}
function alive(g){return members(g).filter(n=>roster(g)[n]&&roster(g)[n].status!=="out")}
function playerProgress(g,name){return modeOf(g)==="survival"?Number(roster(g)[name]?.progress||0):Number(g?.progress||0)}
function canPlay(g,name){
 if(g?.phase!=="input"||!name)return false;
 if(modeOf(g)==="survival")return members(g).includes(name)&&roster(g)[name]?.status==="playing";
 return g.pilot===name;
}
function startRound(g,{now=Date.now(),random=Math.random}={}){
 if(!g||!["ready","success"].includes(g.phase))return false;
 if(modeOf(g)==="survival"&&!alive(g).length)return false;
 if(modeOf(g)==="relay"&&members(g).length<2)return false;
 const raw=Number(random()),n=Math.max(0,Math.min(count(g)-1,Math.floor((Number.isFinite(raw)?raw:0)*count(g))));
 g.sequence.push(n);g.round=g.sequence.length;g.phase="watch";g.progress=0;g.lastInput=null;g.lastIds=[];
 if(modeOf(g)==="relay")g.pilot=members(g)[0];
 if(modeOf(g)==="survival"){
  g.pilot="THE CREW";
  for(const name of members(g)){const e=roster(g)[name];if(e&&e.status!=="out"){e.progress=0;e.status="playing"}}
 }
 g.playbackAt=now+650;g.playbackEnd=g.playbackAt+g.sequence.length*interval(g)+250;
 g.message="WATCH · Remember the pattern. Inputs are locked during playback.";return true;
}
function beginInput(g,now=Date.now()){
 if(g?.phase!=="watch"||now<g.playbackEnd)return false;
 g.phase="input";
 if(modeOf(g)==="survival")g.message="CREW SURVIVAL · Every active student repeats the full sequence.";
 else if(modeOf(g)==="relay")g.message="TEAM RELAY · "+g.pilot+" starts. Pass after every correct signal.";
 else g.message=(g.pilot==="Teacher"?"Teacher":"Pilot")+" · Repeat "+g.round+" signal"+(g.round===1?"":"s")+".";
 return true;
}
function pressFor(g,name,signal,now=Date.now()){
 if(!canPlay(g,name)||!Number.isInteger(signal)||signal<0||signal>=count(g)||!Array.isArray(g.sequence))return {error:"Input is locked."};
 const m=modeOf(g),index=playerProgress(g,name),correct=signal===g.sequence[index];
 g.lastInput={name,signal,correct,at:now};
 if(m==="survival"){
  const entry=roster(g)[name];
  if(!correct){entry.status="out";g.message=name+" lost a signal. "+alive(g).length+" crew members remain.";}
  else{
   entry.progress++;
   if(entry.progress>=g.round){entry.status="cleared";entry.roundsSurvived=g.round;g.message=name+" cleared round "+g.round+"!";}
   else g.message=name+" matched "+entry.progress+"/"+g.round+".";
  }
  if(!members(g).some(n=>roster(g)[n]?.status==="playing")){
   if(alive(g).length){g.phase="success";g.best=Math.max(g.best,g.round);g.message="CREW SURVIVED ROUND "+g.round+" · "+alive(g).length+" remain.";}
   else{g.phase="failed";g.message="CREW SURVIVAL COMPLETE · All pilots eliminated. Select Retry to play again.";}
  }
  return {ok:true,correct,finished:g.phase!=="input"};
 }
 if(!correct){
  g.phase="failed";g.best=Math.max(g.best,g.round-1);
  g.message="SIGNAL LOST · Reached round "+g.round+". Select Retry Run to start again.";
  return {ok:true,correct:false,finished:true};
 }
 g.progress++;
 if(g.progress>=g.round){
  g.phase="success";g.best=Math.max(g.best,g.round);
  g.message=m==="relay"?"RELAY COMPLETE · Round "+g.round+" cleared!":"PERFECT REPEAT · Round "+g.round+" complete!";
  return {ok:true,correct:true,finished:true};
 }
 if(m==="relay"){
  g.pilot=members(g)[g.progress%members(g).length];
  g.message="PASS CONTROL · "+g.pilot+" plays signal "+(g.progress+1)+" of "+g.round+".";
 }else g.message="GREAT SIGNAL · "+g.progress+" / "+g.round+" matched.";
 return {ok:true,correct:true,finished:false};
}
function press(g,signal,now=Date.now()){return pressFor(g,g?.pilot,signal,now)}
function retry(g){if(!g)return false;const fresh=make({pilot:g.mode==="classic"?g.pilot:"Teacher",speed:g.speed,sound:g.sound,signals:count(g),mode:modeOf(g),participants:members(g)});const best=g.best||0;Object.assign(g,fresh,{best});return true}
function save(g,name){const all=readLibrary().filter(x=>x.id!==g.id);all.unshift({id:g.id,name:String(name||"Signal Sequence").slice(0,70),savedAt:Date.now(),game:snapshot(g)});localStorage.setItem(LIB,JSON.stringify(all.slice(0,20)));return all.length}
function readLibrary(){try{const a=JSON.parse(localStorage.getItem(LIB)||"[]");return Array.isArray(a)?a:[]}catch(_){return []}}
function snapshot(g){return JSON.parse(JSON.stringify(g))}
function cue(g,now=Date.now()){
 if(g?.phase!=="watch"||!Array.isArray(g.sequence))return -1;
 const delta=now-Number(g.playbackAt),i=Math.floor(delta/interval(g));
 return delta>=0&&i>=0&&i<g.sequence.length&&(delta%interval(g)<interval(g)*.67)?g.sequence[i]:-1;
}
const polar=(r,a)=>{const v=(a-90)*Math.PI/180;return [200+Math.cos(v)*r,200+Math.sin(v)*r]};
function wedge(i,total){const a=i*360/total+2.5,b=(i+1)*360/total-2.5;
 const [x1,y1]=polar(175,a),[x2,y2]=polar(175,b),[x3,y3]=polar(84,b),[x4,y4]=polar(84,a);
 return "M"+x1.toFixed(1)+" "+y1.toFixed(1)+" A175 175 0 0 1 "+x2.toFixed(1)+" "+y2.toFixed(1)+" L"+x3.toFixed(1)+" "+y3.toFixed(1)+" A84 84 0 0 0 "+x4.toFixed(1)+" "+y4.toFixed(1)+"Z";
}
function donutHTML(g,{interactive=false,mini=false}={}){
 const total=count(g),font=total===8?32:total===6?42:63;
 const pads=COLORS.slice(0,total).map(([color,symbol,label],i)=>{
  const [x,y]=polar(133,(i+.5)*360/total);
  return '<g class="ss-pad ss-pad-'+i+'" data-ss-pad="'+i+'" style="--ss-segment:'+color+'"'+(interactive?' data-ss-press="'+i+'" role="button" tabindex="0" aria-label="'+label+' '+symbol+'"':' aria-hidden="true"')+'><path d="'+wedge(i,total)+'"/><text x="'+x.toFixed(1)+'" y="'+(y+font*.15).toFixed(1)+'" style="font-size:'+font+'px" text-anchor="middle">'+symbol+'</text></g>';
 }).join("");
 const progress=g.phase==="input"||g.phase==="success"?g.progress+" / "+g.round:g.phase==="failed"?"LOST":g.phase==="watch"?"WATCH":g.round||"READY";
 return '<div class="ss-console '+(mini?"ss-console-mini":"")+'"><svg viewBox="0 0 400 400" class="ss-donut" role="img" aria-label="'+total+' colored and symbol-labeled memory controller">'+
 '<defs><radialGradient id="ssCore"><stop stop-color="#193a64"/><stop offset="1" stop-color="#07172c"/></radialGradient></defs><circle cx="200" cy="200" r="190" class="ss-ring"/>'+pads+
 '<circle cx="200" cy="200" r="80" fill="url(#ssCore)" stroke="#8bdfff" stroke-width="4"/><text x="200" y="182" text-anchor="middle" class="ss-core-label">ROUND</text>'+
 '<text x="200" y="231" text-anchor="middle" class="ss-core-round">'+esc(g.round||"0")+'</text></svg>'+
 '<div class="ss-console-caption">'+(g.phase==="watch"?"WATCH THE SIGNAL":g.phase==="input"?"REPEAT THE PATTERN":g.phase==="success"?"ROUND CLEARED":g.phase==="failed"?"SIGNAL LOST":"READY TO LAUNCH")+'</div>'+
 '<div class="ss-progress" aria-label="Input progress">'+esc(String(progress))+'</div></div>';
}
function header(){return '<div class="ss-heading"><div><span>SI MOTHERSHIP · MEMORY ARCADE</span><h2>SIGNAL <em>SEQUENCE</em></h2><p>WATCH · REMEMBER · REPEAT</p></div><div class="ss-heading-emblem" aria-hidden="true">✧</div></div>'}
function badge(g){return '<div class="ss-pilot"><b>✦ '+esc(modeOf(g)==="survival"?"CREW SURVIVAL":g.pilot)+'</b><span>ROUND '+g.round+' · BEST '+g.best+' · '+count(g)+' COLORS</span></div>'}
function crewStatus(g,{privateView=false}={}){
 if(modeOf(g)!=="survival")return "";
 const entries=roster(g),players=members(g);
 return '<div class="ss-crew-board"><div class="ss-crew-title">CREW SURVIVAL · '+alive(g).length+' ACTIVE</div>'+
 players.map(n=>{const e=entries[n]||{},out=e.status==="out",done=e.status==="cleared";return '<div class="ss-crew-member '+(out?'ss-crew-out':done?'ss-crew-cleared':'')+'"><span>'+esc(n)+'</span><strong>'+(out?'ELIMINATED':done?'CLEARED':e.status==="playing"?'PLAYING':'READY')+'</strong>'+(privateView?'<small>'+Number(e.progress||0)+'/'+g.round+'</small>':'')+'</div>'}).join("")+'</div>';
}
function sharedHTML(g,big=false){
 return '<section class="ss-public '+(big?"ss-big":"ss-mirror")+'">'+header()+'<div class="ss-public-main">'+donutHTML(g,{mini:!big})+
 '<aside class="ss-broadcast-side">'+badge(g)+(big&&g.sound?'<button type="button" class="ss-enable-sound ss-projector-sound" data-ss-audio>♫ Enable sound on projector</button>':'')+
 '<div class="ss-status" data-ss-phase="'+esc(g.phase)+'">'+esc(g.phase==="watch"?"MEMORIZE THE LIGHTS":g.phase==="input"?modeOf(g)==="survival"?"CREW RESPONDING":modeOf(g)==="relay"?"RELAY · "+g.pilot:"PILOT REPEATING":g.phase==="success"?"ROUND CLEAR":g.phase==="failed"?"GAME OVER":"READY FOR ROUND ONE")+'</div>'+
 '<p class="ss-message">'+esc(g.message)+'</p>'+crewStatus(g)+'<div class="ss-legend">'+COLORS.slice(0,count(g)).map(([c,s,label])=>'<span style="--ss-segment:'+c+'"><b>'+s+'</b>'+label+'</span>').join("")+'</div></aside></div></section>';
}
function studentHTML(g,name=""){
 const mine=canPlay(g,String(name||"")),m=modeOf(g),part=members(g).includes(name),out=m==="survival"&&roster(g)[name]?.status==="out";
 const spectator=m==="survival"?!part||out:m==="relay"?!part:String(name||"")!==g.pilot;
 const current=m==="survival"?roster(g)[name]?.status==="cleared"?"Round complete — watch your crew.":out?"Eliminated — you can watch the rest of the game.":"Repeat the full sequence!":m==="relay"?"Waiting for "+g.pilot+" to pass the signal.":"Watch the pilot respond.";
 const playing=g.phase==="watch"?"Watch and memorize":mine?"Your turn — tap the signals":g.phase==="input"?current:g.message;
 return '<section class="ss-student">'+header()+'<div class="ss-student-meta"><strong>'+esc(out?"SPECTATING":m==="survival"&&part?"SURVIVAL PILOT":mine?"YOUR MISSION":spectator?"SPECTATOR MODE":"TEAM RELAY")+'</strong><span>'+esc(playing)+'</span></div>'+
 donutHTML(g,{interactive:mine})+
 (g.sound?'<div class="ss-audio-dock"><button type="button" class="ss-enable-sound" data-ss-audio aria-live="polite">♫ Enable synchronized sound</button><span class="ss-sound-help">Tap once before playback to hear the same tones as the projector.</span></div>':'')+
 (mine?'<div class="ss-student-buttons" aria-label="Large touch controls">'+COLORS.slice(0,count(g)).map(([color,symbol,label],i)=>'<button type="button" class="ss-touch-key" data-ss-press="'+i+'" style="--ss-segment:'+color+'" aria-label="'+label+' '+symbol+'"><b aria-hidden="true">'+symbol+'</b><span>'+label+'</span></button>').join("")+'</div>':'')+
 (m==="survival"?'<div class="ss-personal-progress">YOUR INPUT · '+playerProgress(g,name)+' / '+g.round+'</div>':'')+
 '<div class="ss-student-status" role="status" aria-live="polite">'+esc(mine?'YOUR TURN · TAP THE SIGNALS IN ORDER':playing)+'</div></section>';
}
function teacherHTML(g){
 const button=(action,label,disabled=false)=>'<button type="button" data-ss-action="'+action+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
 return '<section class="ss-teacher">'+header()+'<div class="ss-teacher-main">'+donutHTML(g,{interactive:modeOf(g)==="classic"&&g.pilot==="Teacher"&&g.phase==="input"})+
 '<div class="ss-teacher-side">'+badge(g)+'<h3>'+MODES[modeOf(g)]+' · '+count(g)+' SIGNALS</h3>'+
 '<p>Start each round. During WATCH, synchronized light-and-sound cues play on the projector and student devices. The server verifies every student input.</p>'+crewStatus(g,{privateView:true})+
 (modeOf(g)==="relay"?'<div class="ss-relay-order">RELAY ORDER · '+members(g).map(esc).join(' → ')+'</div>':'')+
 '<div class="ss-actions">'+button("next",g.round?"▶ NEXT ROUND":"▶ PLAY ROUND ONE",!["ready","success"].includes(g.phase))+
 button("input","✓ OPEN INPUT",g.phase!=="watch"||Date.now()<g.playbackEnd)+
 button("retry","↻ RETRY RUN",g.phase==="ready")+
 button("save","▣ SAVE GAME")+button("load","▣ LOAD GAME")+button("exit","↩ RETURN TO CLASS")+'</div>'+
 '<div class="ss-teacher-message" role="status">'+esc(g.message)+'</div>'+
 '<div class="ss-teacher-private"><strong>MISSION CONTROL · PRIVATE SEQUENCE</strong><p>'+g.sequence.map(i=>COLORS[i]?.[1]||"").join(" → ")+'</p></div></div></div></section>';
}
function setupHTML(students=[]){
 const joined=cleanParticipants(students);
 const opts=['Teacher',...joined].map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join("");
 const savedGames=readLibrary().slice(0,8);
 return '<section class="ss-setup">'+header()+'<div class="ss-setup-main"><div class="ss-setup-card"><span>01 · MISSION SETTINGS</span><h3>Configure your signals</h3>'+
 '<label>Game mode<select id="ssMode"><option value="classic">Classic · One Pilot</option><option value="survival">Crew Survival · Everyone plays</option><option value="relay">Team Relay · Pass after each signal</option></select></label>'+
 '<label>Signal controller<select id="ssSignals"><option value="4">4 Colors · Classic</option><option value="6">6 Colors · Advanced</option><option value="8">8 Colors · Expert</option></select></label>'+
 '<label class="ss-classic-pilot">Pilot / student<select id="ssPilot">'+opts+'</select></label>'+
 '<div class="ss-advanced-crew" hidden><span class="ss-roster-title">CREW ROSTER · Choose 2 or more students</span><div class="ss-roster-list">'+joined.map(n=>'<label><input type="checkbox" data-ss-member="'+esc(n)+'" checked> '+esc(n)+'</label>').join("")+'</div>'+(joined.length<2?'<p>Invite at least two students before starting Survival or Relay.</p>':'')+'</div>'+
 '<label>Playback speed<select id="ssSpeed"><option value="slow">Slow · Extra Time</option><option value="normal" selected>Normal</option><option value="fast">Fast · Challenge</option></select></label>'+
 '<label class="ss-checkbox"><input id="ssSound" type="checkbox" checked> Synchronized sound cues</label>'+
 '<p>Every signal has its own symbol and color. Crew Survival checks responses privately; Team Relay passes input to the next pilot.</p><button id="ssLaunch" class="ss-primary">▶ LAUNCH SIGNAL SEQUENCE</button><div id="ssSetupError" class="ss-setup-error" role="status"></div></div>'+
 '<div class="ss-setup-card"><span>02 · STORED MISSIONS</span><h3>Game library</h3><p>Saved Classic, Survival, and Relay games can be resumed without changing any other activity.</p>'+
 (savedGames.length?savedGames.map((x,i)=>'<button class="ss-saved" data-ss-load="'+i+'">▣ '+esc(x.name)+'</button>').join(""):'<div class="ss-empty">No saved signals yet.</div>')+
 '<div class="ss-next">CLASSROOM MODES · 4 / 6 / 8 SIGNALS · SURVIVAL · RELAY</div></div></div></section>';
}
return {make,startRound,beginInput,press,pressFor,retry,cue,interval,donutHTML,studentHTML,sharedHTML,teacherHTML,setupHTML,save,readLibrary,snapshot,LIB,COLORS,SPEED,MODES,count,modeOf,members,alive,canPlay,playerProgress};
});