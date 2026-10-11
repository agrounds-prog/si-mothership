/* WORD GRID v1 — original classroom word-tile game for SI Mothership.
   Teacher owns all mutations; student and shared projections only read synced state.
   Dictionary approval intentionally belongs to the teacher. */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.WordGrid=api})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const SIZE=15,POINTS={A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,"?":0};
const DISTRIBUTION={A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1,"?":2};
const TW=new Set([0,7,14,105,119,210,217,224]);
const DW=new Set([16,28,32,42,48,56,64,70,112,154,160,168,176,182,192,196,208]);
const TL=new Set([20,24,76,80,84,88,136,140,144,148,200,204]);
const DL=new Set([3,11,36,38,45,52,59,66,92,96,98,102,108,116,122,126,128,132,158,162,164,168,172,178,186,188,192,213,221]);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const premium=i=>i===112?"center":TW.has(i)?"tw":DW.has(i)?"dw":TL.has(i)?"tl":DL.has(i)?"dl":"";
const cellName=i=>String.fromCharCode(65+i%15)+(Math.floor(i/15)+1);
const pts=t=>t?.blank?0:Number(t?.value||0);
function makeBag(){let n=0;const arr=[];for(const [letter,count] of Object.entries(DISTRIBUTION))for(let i=0;i<count;i++)arr.push({id:"t"+(++n),letter,value:POINTS[letter],blank:letter==="?"});for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr}
function draw(g,p){while(p.rack.length<7&&g.bag.length)p.rack.push(g.bag.pop())}
function make(players=["Crew Alpha","Crew Beta"],options={}){
 const names=(Array.isArray(players)?players:[]).map(n=>String(n||"").trim().slice(0,35)).filter(Boolean);
 if(names.length<2||names.length>4||new Set(names.map(n=>n.toLowerCase())).size!==names.length)throw Error("Choose two to four different players or teams.");
 const assignments={};
 for(const [name,seat] of Object.entries(options.assignments||{})){
   const n=String(name).trim().slice(0,60),slot=Number(seat);
   if(n&&Number.isInteger(slot)&&slot>=0&&slot<names.length)assignments[n]=slot;
 }
 const teacherSeat=options.teacherSeat===null||options.teacherSeat===undefined?null:Number(options.teacherSeat);
 const g={version:2,id:"wg-"+Date.now().toString(36),board:Array(225).fill(null),
  players:names.map(name=>({name,score:0,rack:[]})),assignments,
  teacherSeat:Number.isInteger(teacherSeat)&&teacherSeat>=0&&teacherSeat<names.length?teacherSeat:null,
  hint:null,bag:makeBag(),turn:0,round:1,passes:0,finished:false,lastMove:null,history:[],
  message:"Word Grid ready! First word must pass through the center ★."};
 for(const p of g.players)draw(g,p);return g
}
function assignStudent(g,name,seat){
 const key=String(name||"").trim();if(!key)return false;
 if(!g.assignments||typeof g.assignments!=="object")g.assignments={};
 if(seat===null||seat===""||seat===undefined){delete g.assignments[key];return true}
 const v=Number(seat);if(!Number.isInteger(v)||v<0||v>=g.players.length)return false;
 g.assignments[key]=v;return true;
}
function teamMembers(g,seat){
 const names=Object.entries(g.assignments||{}).filter(([,i])=>Number(i)===seat).map(([name])=>name);
 if(g.teacherSeat===seat)names.push("Teacher");
 return names;
}
function setHint(g,tileId){
 if(g.finished)return false;
 const t=g.players[g.turn]?.rack.find(x=>x.id===tileId);
 if(!t)return false;
 if(g.hint&&g.hint.seat===g.turn&&g.hint.tileId===tileId){g.hint=null;return true}
 g.hint={seat:g.turn,tileId:t.id,letter:t.blank?"BLANK":t.letter};
 return true;
}
function advance(g){g.turn=(g.turn+1)%g.players.length;if(g.turn===0)g.round++}
function isNewMapValid(g,pending){
 const indices=Object.keys(pending||{}).map(Number);if(!indices.length)return {error:"Place one or more letter tiles on the board."};
 if(indices.some(i=>!Number.isInteger(i)||i<0||i>=225||g.board[i]))return {error:"A tile was placed outside the board or over an existing letter."};
 const rack=g.players[g.turn]?.rack||[];const used=new Set();
 for(const i of indices){const t=pending[i];if(!t||!rack.some(a=>a.id===t.id)||used.has(t.id))return {error:"Each tile must come from the active player's rack."};used.add(t.id);if(t.blank&&!/^[A-Z]$/.test(t.as||""))return {error:"Choose a letter for the blank tile."};}
 const rows=new Set(indices.map(i=>Math.floor(i/15))),cols=new Set(indices.map(i=>i%15));
 if(rows.size>1&&cols.size>1)return {error:"Place all tiles in a single row or column."};
 const horizontal=rows.size===1;
 const occupied=i=>g.board[i]||pending[i];
 const group=(index,axis)=>{const out=[];let p=index;const step=axis==="h"?1:15;const sameRow=(a,b)=>Math.floor(a/15)===Math.floor(b/15);while(p-step>=0&&(axis==="v"||sameRow(p-step,p))&&occupied(p-step))p-=step;while(p<225&&occupied(p)){out.push(p);const next=p+step;if(next>=225||(axis==="h"&&!sameRow(p,next)))break;p=next;}return out;};
 const leading=indices[0],line=group(leading,horizontal?"h":"v");
 if(indices.some(i=>!line.includes(i)))return {error:"Leave no empty gaps between the letters of one word."};
 const hasOld=g.board.some(Boolean),overlap=line.some(i=>!!g.board[i]);
 const adjacent=indices.some(i=>{const row=Math.floor(i/15),col=i%15;return [[row-1,col],[row+1,col],[row,col-1],[row,col+1]].some(([r,c])=>r>=0&&r<15&&c>=0&&c<15&&!!g.board[r*15+c])});
 if(!hasOld&&!indices.includes(112))return {error:"The opening word must cover the center star."};
 if(hasOld&&!overlap&&!adjacent)return {error:"Each new word must touch an existing word."};
 let groups=[line];
 for(const i of indices){const cross=group(i,horizontal?"v":"h");if(cross.length>1&&!(cross.length===line.length&&cross.every((x,n)=>x===line[n])))groups.push(cross)}
 if(line.length<2&&groups.length>1)groups=groups.slice(1);
 if(!groups.length||groups.every(w=>w.length<2))return {error:"Play a word of at least two letters."};
 const words=groups.filter(w=>w.length>=2).map(indices=>{
  let sum=0,mult=1;for(const i of indices){const t=occupied(i);let v=pts(t);if(pending[i]){if(premium(i)==="dl")v*=2;if(premium(i)==="tl")v*=3;if(["dw","center"].includes(premium(i)))mult*=2;if(premium(i)==="tw")mult*=3;}sum+=v}
  return {text:indices.map(i=>{const t=occupied(i);return t.blank?t.as:t.letter}).join(""),points:sum*mult,start:cellName(indices[0]),tiles:indices};
 });
 const bonus=indices.length===7?50:0;
 return {words,bonus,score:words.reduce((s,w)=>s+w.points,bonus),placed:indices.length};
}
function snapshot(g){const {history,...rest}=g;return JSON.parse(JSON.stringify(rest))}
function commit(g,pending){if(g.finished)return {error:"The game is finished."};const check=isNewMapValid(g,pending);if(check.error)return check;g.history.push(snapshot(g));if(g.history.length>20)g.history.shift();const p=g.players[g.turn];const who=p.name;const ids=new Set();for(const [key,t] of Object.entries(pending)){const i=Number(key);g.board[i]={...t};ids.add(t.id)}
 p.rack=p.rack.filter(t=>!ids.has(t.id));p.score+=check.score;draw(g,p);g.passes=0;g.lastMove={player:who,...check,at:Date.now()};g.message=who+" scored "+check.score+" points for "+check.words.map(w=>w.text).join(" + ")+".";
 g.hint=null;if(!g.bag.length&&!p.rack.length){g.finished=true;finish(g)}else advance(g);return check;
}
function pass(g){if(g.finished)return;g.history.push(snapshot(g));const who=g.players[g.turn].name;g.hint=null;g.passes++;g.message=who+" passed their turn.";advance(g);if(g.passes>=g.players.length*2){g.finished=true;finish(g)}}
function exchange(g,indices){if(g.finished)return {error:"Game already finished."};const ids=new Set(indices);const p=g.players[g.turn];if(g.bag.length<7)return {error:"At least seven tiles must remain in the bag to exchange."};if(!ids.size)return {error:"Select a tile to exchange."};const picked=p.rack.filter(t=>ids.has(t.id));if(picked.length!==ids.size)return {error:"Choose tiles from the current rack."};g.history.push(snapshot(g));p.rack=p.rack.filter(t=>!ids.has(t.id));const shuffled=picked.map(t=>({...t,as:undefined}));draw(g,p);g.bag.push(...shuffled);for(let i=g.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[g.bag[i],g.bag[j]]=[g.bag[j],g.bag[i]];}g.message=p.name+" exchanged "+picked.length+" tile"+(picked.length===1?"":"s")+".";g.hint=null;g.passes++;advance(g);return {ok:true}}
function finish(g){const finisher=g.players.find(p=>!p.rack.length);let bank=0;for(const p of g.players){const minus=p.rack.reduce((x,t)=>x+pts(t),0);p.score-=minus;bank+=minus}if(finisher)finisher.score+=bank;const lead=[...g.players].sort((a,b)=>b.score-a.score);g.message="Final score: "+lead[0].name+" leads with "+lead[0].score+" points. Game complete!"}
function undo(g){const previous=g.history.pop();if(!previous)return false;const remain=g.history;Object.keys(g).forEach(k=>delete g[k]);Object.assign(g,previous,{history:remain,hint:null,message:"Last turn undone. "+previous.players[previous.turn].name+" is up."});return true}
const boardHTML=(g,editable=false,pending={},selection="")=>'<div class="wg-board" role="grid" aria-label="15 by 15 Word Grid">'+g.board.map((t,i)=>{const p=pending[i],val=p||t,bonus=premium(i),label=val?(val.blank?val.as:val.letter):bonus==="center"?"★":bonus==="tw"?"3W":bonus==="dw"?"2W":bonus==="tl"?"3L":bonus==="dl"?"2L":"";return '<button type="button" role="gridcell" data-wg-cell="'+i+'" aria-label="'+esc(cellName(i)+" "+(val?label+" "+pts(val)+" points":bonus||"empty"))+'" class="wg-cell '+(val?"occupied ":"")+(p?"draft ":"")+(t?"locked ":"")+(bonus||"")+'" '+(!editable||g.finished?'disabled':'')+'><span>'+esc(label)+'</span>'+(val?'<small>'+pts(val)+'</small>':'')+'</button>'}).join("")+'</div>';
const leaderboard=g=>'<div class="wg-scores">'+g.players.map((p,i)=>'<div class="wg-score '+(i===g.turn&&!g.finished?"active":"")+'" style="--wg-player:'+["#71eaff","#ffc979","#c59dff","#7ef2bd"][i]+'"><span class="wg-player-dot"></span><strong>'+esc(p.name)+'</strong><b>'+p.score+'</b>'+(teamMembers(g,i).length?'<span class="wg-score-members">'+esc(teamMembers(g,i).join(" · "))+'</span>':'')+(i===g.turn&&!g.finished?'<small>PLAYING</small>':'')+'</div>').join("")+'</div>';
const info=g=>'<div class="wg-meta"><span>ROUND '+g.round+'</span><span>'+g.bag.length+' TILES IN BAG</span><span>'+g.board.filter(Boolean).length+' ON BOARD</span></div>';
const header=g=>'<div class="wg-heading"><div><span>SI MOTHERSHIP · WORD ARCADE</span><h2>WORD <em>GRID</em></h2></div><b class="wg-phase">'+(g.finished?"GAME COMPLETE":"LIVE MATCH")+'</b></div>';
function sharedHTML(g,big=false){return '<div class="wg-public '+(big?'wg-big':'wg-mirror')+'">'+header(g)+'<div class="wg-public-main">'+boardHTML(g)+ '<aside class="wg-public-side">'+leaderboard(g)+info(g)+'<div class="wg-message">'+esc(g.message)+'</div>'+(g.lastMove?'<div class="wg-last"><span>LAST WORD</span><b>'+esc(g.lastMove.words.map(w=>w.text).join(" · "))+'</b><strong>+'+g.lastMove.score+' PTS</strong></div>':'')+'<div class="wg-premium-legend"><span>3W TRIPLE WORD</span><span>2W DOUBLE WORD</span><span>3L TRIPLE LETTER</span><span>2L DOUBLE LETTER</span></div></aside></div></div>'}
function studentHTML(g,student=null){
 const who=String(student?.n||student?.name||"").trim(),seat=Object.prototype.hasOwnProperty.call(g.assignments||{},who)?Number(g.assignments[who]):-1;
 const mine=seat===g.turn&&!g.finished,player=g.players[seat],hint=mine&&g.hint?.seat===seat?g.hint:null;
 const rack=mine&&player?'<div class="wg-student-rack"><span class="wg-rack-label">YOUR TEAM · LETTER RACK</span><div class="wg-rack">'+player.rack.map(t=>'<span class="wg-tile wg-readonly-tile '+(hint?.tileId===t.id?"wg-highlight":"")+'"><b>'+esc(t.blank?"?":t.letter)+'</b><small>'+pts(t)+'</small></span>').join("")+'</div>'+(hint?'<div class="wg-student-hint">★ TEACHER HINT · LOOK FOR THE GLOWING '+esc(hint.letter)+' TILE</div>':'<p>Your teacher can highlight a helpful letter.</p>')+'</div>':'';
 return '<div class="wg-student">'+header(g)+leaderboard(g)+'<h3>'+esc(g.finished?"Match complete":g.players[g.turn]?.name+"'s turn")+'</h3><p>'+esc(mine?"It's your team's turn! Look at your rack, then share your word with the teacher.":seat>=0?"Watch the board. Your team is up when highlighted.":"Watch the shared board. Ask your teacher to assign you to a team.")+'</p>'+rack+'<div class="wg-student-board">'+boardHTML(g)+'</div><p>'+esc(g.message)+'</p></div>'
}
let draft={},selected="",exchangeMode=false,status="";
function resetDraft(){draft={};selected="";exchangeMode=false;status=""}
const rackButton=(t,g)=>'<button class="wg-tile '+(selected===t.id?"selected ":"")+(g.hint?.seat===g.turn&&g.hint?.tileId===t.id?"wg-highlight":"")+'" data-wg-tile="'+esc(t.id)+'" type="button"><b>'+esc(t.blank?"?":t.letter)+'</b><small>'+pts(t)+'</small></button>';
function teacherHTML(g,roster=[]){const p=g.players[g.turn],used=new Set(Object.values(draft).map(t=>t.id));const available=p.rack.filter(t=>!used.has(t.id));const result=Object.keys(draft).length?isNewMapValid(g,draft):null;return '<div class="wg-teacher">'+header(g)+leaderboard(g)+info(g)+'<div class="wg-teacher-main">'+boardHTML(g,true,draft,selected)+'<aside class="wg-teacher-side"><h3>'+esc(p.name)+' · LETTER RACK</h3><div class="wg-rack">'+available.map(t=>rackButton(t,g)).join("")+'</div><div class="wg-hint-control"><button type="button" data-wg-action="hint" '+(!selected&&!g.hint?'disabled':'')+'>'+((g.hint?.seat===g.turn)?"★ CHANGE / CLEAR HINT":"★ HIGHLIGHT LETTER")+'</button>'+(g.hint?.seat===g.turn?'<span class="wg-hint-live">★ HINT: '+esc(g.hint.letter)+'</span>':'')+'</div><p class="wg-help">Select a letter, then click an empty square. To remove it, click the pending tile on the board. Blank tiles ask for a letter.</p>'+(result?'<div class="wg-validation '+(result.error?"error":"ok")+'">'+(result.error?esc(result.error):'<b>'+result.words.map(w=>esc(w.text)+" ("+w.points+")").join(" · ")+'</b><strong>+'+result.score+' POINTS</strong><small>Teacher confirms spelling before scoring.</small>')+'</div>':'<div class="wg-hint">Place a word through ★ to begin.</div>')+'<div class="wg-actions"><button data-wg-action="commit" class="primary-action" '+(!result||result.error?'disabled':'')+'>✓ APPROVE & SCORE</button><button data-wg-action="clear">↶ CLEAR TILES</button><button data-wg-action="pass">PASS TURN →</button><button data-wg-action="exchange">⇄ EXCHANGE TILES</button><button data-wg-action="undo" '+(!g.history.length?'disabled':'')+'>↶ UNDO LAST TURN</button><button data-wg-action="save">▣ SAVE GAME</button><button data-wg-action="load">▣ LOAD SAVED GAME</button><button data-wg-action="finish" class="wg-danger">■ END MATCH</button></div><p class="wg-status" role="status">'+esc(status||g.message)+'</p></aside></div><div class="controller-safety"><button id="returnClassBtn">✓ Finish & Return</button><button id="sendActivityLobbyBtn">Ⅱ Pause & Keep Progress</button><button id="emergencyActivityBtn" class="danger-action">⚠ Emergency Return</button></div></div>'}
const LIB="siMothership.wordGridLibrary.v1";
function readLibrary(){try{const arr=JSON.parse(localStorage.getItem(LIB)||"[]");return Array.isArray(arr)?arr:[]}catch(_){return []}}
function saveGame(g,name){const arr=readLibrary().filter(x=>x.id!==g.id);arr.unshift({id:g.id,name:String(name||"Word Grid").slice(0,75),savedAt:Date.now(),game:JSON.parse(JSON.stringify(g))});localStorage.setItem(LIB,JSON.stringify(arr.slice(0,25)));return arr.length}
let setupDraft=null;
function setupNames(raw){return String(raw||"").split(/\n|,/).map(s=>s.trim().slice(0,35)).filter(Boolean)}
function ensureSetupDraft(students=[]){
 if(!setupDraft)setupDraft={teams:"Crew Alpha\nCrew Beta",assignments:{},teacherMode:"host"};
 const known=[...new Set((Array.isArray(students)?students:[]).map(n=>String(n||"").trim()).filter(Boolean))].slice(0,60);
 for(const [i,name] of known.entries()){
   if(!Object.prototype.hasOwnProperty.call(setupDraft.assignments,name))setupDraft.assignments[name]=i%2;
 }
 return setupDraft;
}
function seatOptions(names,active){return '<option value="">Watching / not assigned</option>'+names.map((name,i)=>'<option value="'+i+'" '+(Number(active)===i&&active!==""&&active!==null&&active!==undefined?"selected":"")+'>'+esc(name)+'</option>').join("")}
function teacherOptions(names,mode){return '<option value="host" '+(mode==="host"?"selected":"")+'>Teacher hosts (not playing)</option><option value="solo" '+(mode==="solo"?"selected":"")+'>Teacher plays as own player</option>'+names.map((n,i)=>'<option value="team-'+i+'" '+(mode==="team-"+i?"selected":"")+'>Teacher plays on '+esc(n)+'</option>').join("")}
function setupHTML(students=[]){
 const list=readLibrary(),d=ensureSetupDraft(students),names=setupNames(d.teams);
 const roster=[...new Set((Array.isArray(students)?students:[]).map(n=>String(n||"").trim()).filter(Boolean))].slice(0,60);
 return '<div class="wg-setup"><div class="wg-heading"><div><span>MOTHERSHIP · WORD ARCADE</span><h2>WORD <em>GRID</em></h2></div><b class="wg-phase">NEW ACTIVITY</b></div>'+
 '<div class="wg-setup-columns"><div class="wg-setup-card"><span class="wg-setup-step">01 / MATCH SETTINGS</span><h3>Choose teams or players</h3><p>Two to four playable seats. Each seat gets its own letter rack and score. Several students can share a team.</p>'+
 '<label>PLAYER / TEAM NAMES <small>(one per line)</small><textarea id="wgPlayers" rows="4" spellcheck="false">'+esc(d.teams)+'</textarea></label>'+
 '<label>TEACHER PARTICIPATION<select id="wgTeacherMode" class="wg-select">'+teacherOptions(names,d.teacherMode)+'</select></label>'+
 '<p class="wg-setup-note">Choose <strong>Teacher plays</strong> for Teacher vs. Students or assign the teacher to an existing crew.</p>'+
 '<button type="button" class="primary-action" id="wgStart">▶ START WORD GRID</button>'+
 '<div class="wg-setup-error" id="wgSetupStatus" role="status" aria-live="polite"></div></div>'+
 '<div class="wg-setup-card"><span class="wg-setup-step">02 / CREW ASSIGNMENTS</span><h3>Place students on teams</h3>'+
 '<p>Select where each connected student plays. You can change team assignments during the match.</p>'+
 '<div class="wg-assignment-list" id="wgSetupAssignments">'+(roster.length?roster.map(n=>
 '<label class="wg-assign-row"><span class="wg-assign-name">'+esc(n)+'</span><select class="wg-select" data-wg-setup-student="'+esc(n)+'">'+seatOptions(names,d.assignments[n])+'</select></label>').join(""):'<div class="wg-assign-empty">No students connected yet. You can create a game and assign them after joining.</div>')+'</div>'+
 '<div class="wg-team-note">Students on the active team will see that team’s letters on their own devices. Others see only the board.</div></div>'+
 '<div class="wg-setup-card wg-setup-saves"><span class="wg-setup-step">03 / GAME LIBRARY</span><h3>Resume a saved game</h3>'+
 '<div class="wg-save-list">'+(list.length?list.map(a=>'<button type="button" data-wg-load="'+esc(a.id)+'"><b>'+esc(a.name)+'</b><small>'+new Date(a.savedAt).toLocaleDateString()+'</small><span>LOAD →</span></button>').join(""):'<p>No saved games yet. Save a game during play to resume later.</p>')+'</div></div></div></div>'
}
function wireSetup(rootEl,students,onStart,onLoad){
 const d=ensureSetupDraft(students),namesEl=rootEl?.querySelector("#wgPlayers"),teacherEl=rootEl?.querySelector("#wgTeacherMode");
 if(!rootEl||!namesEl||!teacherEl)return;
 const feedback=rootEl.querySelector("#wgSetupStatus"),say=msg=>{if(feedback)feedback.textContent=msg||""};
 const updateOptions=()=>{
   const names=setupNames(namesEl.value);
   const old=teacherEl.value;teacherEl.innerHTML=teacherOptions(names,old);
   if(![...teacherEl.options].some(o=>o.value===old))teacherEl.value="host";
   d.teacherMode=teacherEl.value;
   rootEl.querySelectorAll("[data-wg-setup-student]").forEach(sel=>{
     const person=sel.dataset.wgSetupStudent;
     const prior=d.assignments[person];
     sel.innerHTML=seatOptions(names,prior);
     if(prior!==""&&prior!==null&&prior!==undefined&&prior>=names.length){sel.value="";d.assignments[person]=null}
   })
 };
 namesEl.addEventListener("input",()=>{d.teams=namesEl.value;say("");updateOptions()});
 teacherEl.addEventListener("change",()=>{d.teacherMode=teacherEl.value;say("")});
 rootEl.querySelectorAll("[data-wg-setup-student]").forEach(sel=>sel.addEventListener("change",()=>{
   d.assignments[sel.dataset.wgSetupStudent]=sel.value===""?null:Number(sel.value);say("");
 }));
 rootEl.querySelector("#wgStart").addEventListener("click",()=>{
   const names=setupNames(namesEl.value),teacherMode=teacherEl.value;
   if(names.length<2||names.length>4||new Set(names.map(n=>n.toLowerCase())).size!==names.length){
     say("Enter two to four different player or team names.");namesEl.focus();return;
   }
   const finalNames=[...names],assignments={};
   for(const sel of rootEl.querySelectorAll("[data-wg-setup-student]")){
     if(sel.value!=="")assignments[sel.dataset.wgSetupStudent]=Number(sel.value);
   }
   let teacherSeat=null;
   if(teacherMode==="solo"){
     if(finalNames.length>=4){say("Teacher needs an open fourth player seat. Use two or three teams, or select a team for Teacher.");teacherEl.focus();return}
     teacherSeat=finalNames.length;finalNames.push("Teacher");
   }else if(teacherMode.startsWith("team-")){
     const n=Number(teacherMode.slice(5));if(n>=0&&n<names.length)teacherSeat=n;
   }
   if(new Set(finalNames.map(n=>n.toLowerCase())).size!==finalNames.length){
     say("Teacher is already a team name. Rename that team or choose Teacher joins team.");return;
   }
   try{const game=make(finalNames,{assignments,teacherSeat});game.setupMode=teacherMode;onStart(game)}
   catch(e){say(String(e?.message||e||"Could not start Word Grid."))}
 });
 rootEl.querySelectorAll("[data-wg-load]").forEach(b=>b.addEventListener("click",()=>{
   const item=readLibrary().find(x=>x.id===b.dataset.wgLoad);
   if(item&&confirm("Load "+item.name+"?"))onLoad(item.game);
 }));
}

function wireTeacher(rootEl,g,save,show){if(!rootEl||!g)return;const refresh=()=>{rootEl.innerHTML=teacherHTML(g);wireTeacher(rootEl,g,save,show)};
 rootEl.querySelectorAll("[data-wg-tile]").forEach(b=>b.addEventListener("click",()=>{selected=b.dataset.wgTile;status="Letter selected. Choose an empty square.";refresh()}));
 rootEl.querySelectorAll("[data-wg-cell]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.wgCell);if(g.board[i])return;if(draft[i]){selected=draft[i].id;delete draft[i];status="Tile returned to rack.";refresh();return}const tile=g.players[g.turn].rack.find(x=>x.id===selected);if(!tile)return;const clone={...tile};if(clone.blank){const letter=prompt("Blank tile: what letter does it represent?","A");if(!letter||!/^[A-Z]$/.test(letter.trim().toUpperCase())){status="Blank tile needs a letter A–Z.";refresh();return}clone.as=letter.trim().toUpperCase()}draft[i]=clone;selected="";status="";refresh()}));
 rootEl.querySelectorAll("[data-wg-action]").forEach(b=>b.addEventListener("click",()=>{const action=b.dataset.wgAction;if(action==="clear"){resetDraft();refresh();return}if(action==="commit"){const check=isNewMapValid(g,draft);if(check.error){status=check.error;refresh();return}if(!confirm("Approve "+check.words.map(w=>w.text).join(" + ")+" for "+check.score+" points?"))return;const r=commit(g,draft);resetDraft();if(r.error){status=r.error;refresh()}else save();return}if(action==="pass"){if(!confirm("Pass this turn?"))return;pass(g);resetDraft();save();return}if(action==="exchange"){if(g.bag.length<7){status="At least seven bag tiles required to exchange.";refresh();return}const letters=prompt("Enter letters from your rack to exchange (use ? for blanks).","");if(letters===null)return;const remaining=[...g.players[g.turn].rack],chosen=[];for(const c of letters.toUpperCase().replace(/\s/g,"")){const i=remaining.findIndex(t=>t.letter===c);if(i<0){status="That rack does not contain all selected letters.";refresh();return}chosen.push(...remaining.splice(i,1))}const r=exchange(g,chosen.map(t=>t.id));if(r?.error){status=r.error;refresh()}else{resetDraft();save()}return}if(action==="undo"){if(!confirm("Undo the previous turn?"))return;if(undo(g)){resetDraft();save()}return}if(action==="finish"){if(!confirm("End the Word Grid match and calculate final scores?"))return;g.history.push(snapshot(g));g.finished=true;finish(g);resetDraft();save();return}if(action==="save"){const n=prompt("Save this Word Grid game as:",g.name||"Word Grid · "+new Date().toLocaleDateString());if(n?.trim()){g.name=n.trim();saveGame(g,n.trim());status="Game saved to library.";refresh()}return}if(action==="load"){const list=readLibrary();if(!list.length){status="No saved Word Grid games.";refresh();return}const name=prompt("Type the number of the saved game to load:\n"+list.map((x,i)=>(i+1)+". "+x.name).join("\n"),"1");const idx=Number(name)-1;if(!Number.isInteger(idx)||!list[idx])return;if(!confirm("Replace this active board with "+list[idx].name+"?"))return;show(list[idx].game);return}}));
}
return {make,makeBag,assignStudent,teamMembers,setHint,premium,isNewMapValid,commit,pass,exchange,undo,finish,snapshot,boardHTML,teacherHTML,sharedHTML,studentHTML,setupHTML,wireSetup,wireTeacher,readLibrary,saveGame,resetDraft,LIB,SIZE,POINTS,DISTRIBUTION};
});
