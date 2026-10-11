/* FOUR IN LINE v1 — Mothership classroom strategy game. */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.FourLine=api})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SIZES={"mini":[5,4],"classic":[7,6],"mega":[9,7]};
const COLORS=["#64e0ff","#ffb566"];
function make(players=["Blue Crew","Gold Crew"],options={}){
 const size=SIZES[options.size]||SIZES.classic,cols=size[0],rows=size[1],names=players.map(x=>String(x||"").trim().slice(0,35));
 if(names.length!==2||!names[0]||!names[1]||names[0].toLowerCase()===names[1].toLowerCase())throw Error("Choose two distinct players or teams.");
 return {version:1,id:"fil-"+Date.now().toString(36),size:options.size||"classic",cols,rows,players:names,
   seats:{...(options.seats||{})},mode:options.mode==="teams"?"teams":"classic",
   board:Array(cols*rows).fill(0),turn:0,status:"playing",winner:null,winning:[],moves:0,history:[],
   lastMove:null,message:names[0]+" begins. Drop a disc into any open column."};
}
function seatOf(g,name){const v=g?.seats?.[String(name||"")];return Number.isInteger(v)&&v>=0&&v<=1?v:-1}
function at(g,row,col){return g.board[row*g.cols+col]}
function findWin(g,row,col,seat){
 const who=seat+1,dirs=[[0,1],[1,0],[1,1],[1,-1]];
 for(const [dr,dc] of dirs){
  const line=[[row,col]];
  for(const sign of [-1,1]){let r=row+dr*sign,c=col+dc*sign;while(r>=0&&r<g.rows&&c>=0&&c<g.cols&&at(g,r,c)===who){if(sign<0)line.unshift([r,c]);else line.push([r,c]);r+=dr*sign;c+=dc*sign}}
  if(line.length>=4)return line.map(([r,c])=>r*g.cols+c);
 }
 return [];
}
function legal(g,col){return g?.status==="playing"&&Number.isInteger(col)&&col>=0&&col<g.cols&&!g.board[col]}
function drop(g,seat,col){
 if(!g||!Array.isArray(g.board)||g.board.length!==g.cols*g.rows||seat!==g.turn)return {error:"Not your turn."};
 col=Number(col);if(!legal(g,col))return {error:"That column is full or unavailable."};
 let row=g.rows-1;while(row>=0&&g.board[row*g.cols+col])row--;
 if(row<0)return {error:"Column full."};
 const before={board:g.board.slice(),turn:g.turn,status:g.status,winner:g.winner,winning:g.winning.slice(),moves:g.moves,lastMove:g.lastMove,message:g.message};
 g.history.push(before);if(g.history.length>40)g.history.shift();
 g.board[row*g.cols+col]=seat+1;g.moves++;
 g.lastMove={row,col,seat,at:Date.now()};
 const line=findWin(g,row,col,seat);
 if(line.length){g.status="won";g.winner=seat;g.winning=line;g.message=g.players[seat]+" connected FOUR!";}
 else if(g.moves===g.rows*g.cols){g.status="draw";g.message="Grid complete — a draw!";}
 else{g.turn=1-seat;g.message=g.players[g.turn]+"'s turn. Drop the next disc."}
 return {ok:true,row,col,win:g.status==="won",draw:g.status==="draw"};
}
function undo(g){const prev=g?.history?.pop();if(!prev)return false;Object.assign(g,prev,{history:g.history});return true}
function reset(g){if(!g)return false;const newGame=make(g.players,{size:g.size,mode:g.mode,seats:g.seats});Object.assign(g,newGame);return true}
function snapshot(g){return JSON.parse(JSON.stringify(g))}
const LIB="siMothership.fourInLineGames.v1";
function saved(){try{const a=JSON.parse(localStorage.getItem(LIB)||"[]");return Array.isArray(a)?a:[]}catch(_){return []}}
function save(g,name){const a=saved().filter(x=>x.id!==g.id);a.unshift({id:g.id,name:String(name||"Four In Line").slice(0,75),at:Date.now(),game:snapshot(g)});localStorage.setItem(LIB,JSON.stringify(a.slice(0,20)))}
const mark=seat=>seat===0?"◆":"✦";
function boardHTML(g,{big=false,student=false,teacher=false,name=""}={}){
 const active=seatOf(g,name)===g.turn&&g.status==="playing";
 const board='<div class="fil-board" role="grid" aria-label="'+g.cols+' column by '+g.rows+' row four in line board" style="--fil-cols:'+g.cols+'">'+
 g.board.map((disc,i)=>'<div class="fil-cell '+(disc?"fil-disc disc-"+disc:"empty")+(g.winning.includes(i)?" win-line":"")+(g.lastMove&&Date.now()-Number(g.lastMove.at)<1100&&g.lastMove.row*g.cols+g.lastMove.col===i?" last-disc":"")+'" role="gridcell" aria-label="Row '+(Math.floor(i/g.cols)+1)+' column '+(i%g.cols+1)+' '+(disc?g.players[disc-1]:"empty")+'">'+(disc?'<span>'+mark(disc-1)+'</span>':'<i></i>')+'</div>').join("")+'</div>';
 const controls=Array.from({length:g.cols},(_,i)=>{
  const enabled=(teacher||active)&&legal(g,i);
  return '<button type="button" class="fil-drop-button" data-fil-drop="'+i+'" '+(enabled?'':'disabled')+' aria-label="Drop disc in column '+(i+1)+'">'+(i+1)+'</button>'
 }).join("");
 return '<div class="fil-arena">'+board+((teacher||student)?'<div class="fil-columns" style="--fil-cols:'+g.cols+'">'+controls+'</div>':'')+'</div>';
}
function avatars(g,students=[]){
 return g.players.map((name,i)=>'<div class="fil-team '+(g.turn===i&&g.status==="playing"?"active ":"")+(g.winner===i?"victor":"")+'" style="--fil-team:'+COLORS[i]+'"><span class="fil-team-icon">'+mark(i)+'</span><div><strong>'+esc(name)+'</strong><small>'+(g.status==="won"&&g.winner===i?"CHAMPION":g.turn===i&&g.status==="playing"?"YOUR MOVE":g.status==="playing"?"STANDBY":"MATCH COMPLETE")+'</small></div></div>').join("");
}
function publicHTML(g,big=false){
 const title=g.status==="won"?esc(g.players[g.winner])+" WINS!":g.status==="draw"?"DRAW GAME":esc(g.players[g.turn])+" TO MOVE";
 return '<section class="fil-public '+(big?"fil-big":"fil-mini")+'"><div class="fil-space"></div><div class="fil-title"><span>SI MOTHERSHIP · COSMIC STRATEGY</span><h2>FOUR <em>IN LINE</em></h2><p>DROP · CONNECT · WIN</p></div><div class="fil-score-strip">'+avatars(g)+'</div><div class="fil-screen-stage"><div class="fil-board-wrap">'+boardHTML(g,{big})+'</div><aside class="fil-info"><div class="fil-signal">'+(g.status==="won"?"✦ FOUR CONNECTED ✦":g.status==="draw"?"GRID COMPLETE":"NOW PLAYING")+'</div><h3>'+title+'</h3><p>'+esc(g.message)+'</p><div class="fil-stats"><span>'+g.moves+' MOVES</span><span>'+g.cols+' × '+g.rows+' GRID</span></div></aside></div>'+(big&&g.status==="won"?'<div class="fil-victory" role="status"><span>✦ FOUR CONNECTED ✦</span><strong>'+esc(g.players[g.winner])+' WINS</strong></div>':big&&g.status==="draw"?'<div class="fil-victory" role="status"><strong>DRAW MATCH</strong></div>':'')+'</section>';
}
function studentHTML(g,name){
 const seat=seatOf(g,name),mine=seat===g.turn&&g.status==="playing",watch=seat<0;
 return '<section class="fil-student"><div class="fil-title"><span>SI MOTHERSHIP · YOUR CONTROLLER</span><h2>FOUR <em>IN LINE</em></h2></div><div class="fil-student-status">'+(g.status==="won"?esc(g.players[g.winner])+" won the match!":g.status==="draw"?"It is a draw!":watch?"SPECTATOR · Watch the match":mine?"YOUR TURN · Choose a column":"WATCH · "+esc(g.players[g.turn])+" is moving")+'</div>'+avatars(g)+boardHTML(g,{student:true,name})+'<p>Tap a numbered column once to drop your disc. Connect four in a row to win.</p></section>';
}
function teacherHTML(g){
 return '<section class="fil-teacher"><div class="fil-teacher-head"><div><span>SI MOTHERSHIP · GAME CONTROL</span><h2>FOUR IN LINE</h2><p>'+esc(g.message)+'</p></div><b>'+g.moves+' MOVES</b></div><div class="fil-teacher-grid">'+boardHTML(g,{teacher:true})+'<aside class="fil-teacher-side">'+avatars(g)+'<p>Teacher may place a disc for the active player using the numbered columns.</p><div class="fil-actions"><button data-fil-action="undo" '+(!g.history.length?'disabled':'')+'>↶ Undo Move</button><button data-fil-action="reset">↻ New Match</button><button data-fil-action="save">▣ Save Game</button><button data-fil-action="exit">↩ Return to Class</button></div><div class="fil-controller-safety"><button data-fil-action="lobby">Ⅱ Activity Lobby</button><button class="fil-danger" data-fil-action="emergency">⚠ Emergency Return</button></div></aside></div></section>';
}
function setupHTML(students=[]){
 const clean=students.map(x=>String(x||"").trim()).filter(Boolean),options='<option value="">Teacher / spectator</option>'+clean.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join("");
 return '<section class="fil-setup"><div class="fil-title"><span>MOTHERSHIP · NEW CLASSROOM GAME</span><h2>FOUR <em>IN LINE</em></h2><p>Drop. Connect. Win.</p></div><div class="fil-setup-cards"><div class="fil-setup-card"><h3>01 · Game Settings</h3><label>Mode<select id="filMode"><option value="classic">Classic · 1 vs 1</option><option value="teams">Team Battle · Crew vs Crew</option></select></label><label>Board Size<select id="filSize"><option value="classic">Classic · 7 × 6</option><option value="mini">Mini · 5 × 4</option><option value="mega">Mega · 9 × 7</option></select></label><label>Blue Side<input id="filOne" maxlength="35" value="Blue Crew"></label><label>Gold Side<input id="filTwo" maxlength="35" value="Gold Crew"></label><p>Play with students, teacher, or two classroom teams. You can always place discs from Mission Control.</p><button class="fil-primary" id="filLaunch">▶ START FOUR IN LINE</button><div class="fil-setup-error" id="filSetupError" role="status"></div></div><div class="fil-setup-card"><h3>02 · Assign Crew</h3><p>Each connected student may control one side; unassigned students safely spectate. Teams can have several students.</p><div class="fil-setup-crew">'+clean.map(name=>'<label class="fil-crew-row"><span>'+esc(name)+'</span><select data-fil-seat="'+esc(name)+'"><option value="-1">Spectator</option><option value="0">Blue Side</option><option value="1">Gold Side</option></select></label>').join("")+(clean.length?'':'<p>Students can join before the next match.</p>')+'</div></div></div><div class="fil-saves">'+saved().slice(0,8).map((x,i)=>'<button data-fil-load="'+i+'">▣ '+esc(x.name)+' · '+new Date(x.at).toLocaleDateString()+'</button>').join("")+'</div></section>';
}
let pendingDrop=null;
function wireStudent(g,name){
 if(typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE!=="student")return;
 const zone=document.querySelector("#studentContent");if(!zone)return;
 const seat=seatOf(g,name),key=g.id+"|"+g.moves+"|"+g.turn;
 // A successful move invalidates the previous pending request automatically.
 if(pendingDrop&&pendingDrop.key!==key)pendingDrop=null;
 const status=zone.querySelector(".fil-student-status");
 if(pendingDrop&&Date.now()-pendingDrop.at>3500)pendingDrop=null;
 if(pendingDrop&&status)status.textContent="Dropping disc in column "+(pendingDrop.col+1)+"…";
 const controls=[...zone.querySelectorAll("[data-fil-drop]")];
 if(pendingDrop)controls.forEach(b=>b.disabled=true);
 controls.forEach(button=>button.onclick=()=>{
  const col=Number(button.dataset.filDrop);
  if(pendingDrop||seat!==g.turn||!legal(g,col))return;
  const ident=typeof currentStudentIdentity==="function"?currentStudentIdentity():null;
  if(typeof networkSocket==="undefined"||networkSocket?.readyState!==WebSocket.OPEN){
   if(status)status.textContent="Not connected. Reconnect before dropping.";return;
  }
  pendingDrop={key,col,at:Date.now()};
  controls.forEach(b=>b.disabled=true);
  button.classList.add("fil-dropping");
  if(status)status.textContent="Dropping disc in column "+(col+1)+"…";
  try{
   networkSocket.send(JSON.stringify({
    type:"four_in_line_action",
    request:{column:col,runToken:state.activityRun?.runToken,id:"move-"+Date.now()+"-"+Math.random().toString(36).slice(2)},
    student_token:ident?.student_token||"",student_name:name
   }));
  }catch(_){
   pendingDrop=null;controls.forEach(b=>b.disabled=!legal(g,Number(b.dataset.filDrop)));
   button.classList.remove("fil-dropping");
   if(status)status.textContent="Couldn't send. Tap a column to try again.";
   return;
  }
  // A rejected/dropped packet should not permanently lock student input.
  setTimeout(()=>{
   if(pendingDrop?.key!==key||pendingDrop?.col!==col)return;
   pendingDrop=null;
   const visible=document.querySelector("#studentContent .fil-student-status");
   if(visible)visible.textContent="No move update yet. Tap a column to try again.";
   document.querySelectorAll("#studentContent [data-fil-drop]").forEach(b=>{
    b.disabled=!legal(g,Number(b.dataset.filDrop));
    b.classList.remove("fil-dropping");
   });
  },3500);
 });
}

return {make,drop,undo,reset,legal,findWin,seatOf,boardHTML,teacherHTML,studentHTML,publicHTML,setupHTML,wireStudent,save,saved,snapshot,LIB,SIZES};
});
