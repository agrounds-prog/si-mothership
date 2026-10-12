/* SI Mothership DOMINOES — original double-six Draw Dominoes classroom game.
 * The server verifies student moves and redacts private hands. Teacher is host.
 * Original cosmic-themed domino graphics; no external images or libraries.
 */
(function(root,factory){const x=factory();if(typeof module!=="undefined"&&module.exports)module.exports=x;root.Dominoes=x})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DOTS={0:[],1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
let selectedNames=[],teacherIncluded=false,revealHands=false,selectedTile="",doubleVertical=false;
const escID=x=>esc(x);
function makeBag(){const tiles=[];for(let a=0;a<=6;a++)for(let b=a;b<=6;b++)tiles.push({id:"d-"+a+"-"+b,a,b});for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]]}return tiles}
function pips(t){return Number(t?.a||0)+Number(t?.b||0)}
function make(players=["Crew Alpha","Crew Beta"],options={}){
 let names=players.map(x=>String(x||"").trim().slice(0,35)).filter(Boolean);
 if(names.length<2||names.length>4||new Set(names.map(n=>n.toLowerCase())).size!==names.length)throw Error("Select two to four different players.");
 const bag=makeBag(),hands={};names.forEach(n=>{hands[n]=[];for(let k=0;k<7;k++)hands[n].push(bag.pop())});
 return {version:1,id:"dom-"+Date.now().toString(36),players:names,hands,bag,chain:[],turn:0,round:1,
  counts:null,consecutivePasses:0,status:"playing",winner:null,scores:Object.fromEntries(names.map(n=>[n,0])),
  teacherIncluded:!!options.teacherIncluded,avatarImages:options.avatarImages||{},
  lastPlay:null,lastAction:null,message:"Dominoes ready! Match a number at either end of the chain.",
  history:[],lastRequestIds:[]}
}
function active(g){return g.players?.[g.turn]||""}
function ends(g){if(!g.chain?.length)return {left:null,right:null};return {left:g.chain[0].left,right:g.chain[g.chain.length-1].right}}
function canPlay(g,name,tile,side="any"){if(!g||g.status!=="playing"||name!==active(g)||!tile)return false;if(!g.chain.length)return true;const e=ends(g);if(side==="left")return tile.a===e.left||tile.b===e.left;if(side==="right")return tile.a===e.right||tile.b===e.right;return tile.a===e.left||tile.b===e.left||tile.a===e.right||tile.b===e.right}
function playable(g,name){return (g?.hands?.[name]||[]).some(t=>canPlay(g,name,t))}
function advance(g){g.turn=(g.turn+1)%g.players.length;if(g.turn===0)g.round++}
function winner(g,who,blocked=false){
 g.status="won";g.winner=who;g.lastAction={kind:"win",at:Date.now(),player:who,blocked};
 const other=g.players.filter(n=>n!==who).reduce((n,player)=>n+(g.hands[player]||[]).reduce((x,t)=>x+pips(t),0),0);
 g.scores[who]=(g.scores[who]||0)+other;g.message=who+" wins "+(blocked?"the blocked round":"the round")+"! +"+other+" pips.";
}
function checkBlocked(g){if(g.consecutivePasses<g.players.length||g.bag.length)return false;let scores=g.players.map(name=>({name,p:(g.hands[name]||[]).reduce((s,t)=>s+pips(t),0)}));scores.sort((a,b)=>a.p-b.p);winner(g,scores[0].name,true);return true}
function apply(g,name,type,id="",side="right",vertical=false){
 if(!g||g.status!=="playing"||active(g)!==name)return {error:"It is not this player's turn."};
 const hand=g.hands[name];if(!Array.isArray(hand))return {error:"No hand assigned."};
 if(type==="play"){
  const k=hand.findIndex(t=>t.id===id);if(k<0)return {error:"That tile is not in the active player's hand."};
  const t=hand[k],first=!g.chain.length;if(!["left","right","first"].includes(side)||(!first&&side==="first"))return {error:"Select the left or right end."};
  if(!canPlay(g,name,t,side))return {error:"The tile must match the open number at that end."};
  const e=ends(g),left=side==="left"&&!first,match=left?e.left:e.right;
  const face=!g.chain.length?{left:t.a,right:t.b}:
    left?(t.a===match?{left:t.b,right:t.a}:{left:t.a,right:t.b}):
    (t.a===match?{left:t.a,right:t.b}:{left:t.b,right:t.a});
  hand.splice(k,1);const placed={id:t.id,a:t.a,b:t.b,...face,vertical:t.a===t.b?vertical===true:false};
  if(left)g.chain.unshift(placed);else g.chain.push(placed);
  g.consecutivePasses=0;g.lastPlay={tileId:t.id,player:name,side,at:Date.now()};g.lastAction={kind:"play",at:Date.now(),player:name};
  g.message=name+" placed "+t.a+" · "+t.b+(first?" to start the chain.":" on the "+(left?"left":"right")+" end.");
  if(!hand.length)winner(g,name);else advance(g);
  return {ok:true,played:placed};
 }
 if(type==="draw"){
  if(playable(g,name))return {error:"Play a matching tile from your hand before drawing."};
  if(!g.bag.length)return {error:"The draw pile is empty. Pass your turn."};
  const t=g.bag.pop();hand.push(t);g.lastAction={kind:"draw",at:Date.now(),player:name};g.message=name+" drew a domino.";
  return {ok:true,drawn:t};
 }
 if(type==="pass"){
  if(playable(g,name))return {error:"Play a matching tile before passing."};
  if(g.bag.length)return {error:"Draw a tile before passing."};
  g.consecutivePasses++;g.message=name+" passed. No matching tiles remain.";g.lastAction={kind:"pass",at:Date.now(),player:name};
  if(!checkBlocked(g))advance(g);
  return {ok:true};
 }
 return {error:"Unknown action."}
}
function snapshot(g){return JSON.parse(JSON.stringify(g))}
function count(g,n){const arr=g.hands?.[n];return Array.isArray(arr)?arr.length:Number(g.counts?.[n]||0)}
function tileHTML(t,opt={}){
 const a=Number(t?.left??t?.a??0),b=Number(t?.right??t?.b??0);
 const side=(n)=>'<span class="dm-face dm-face-'+n+'" aria-label="'+n+' dots"><span class="dm-pip-matrix">'+Array.from({length:9},(_,i)=>'<i class="'+(DOTS[n]?.includes(i)?"dot":"")+'"></i>').join("")+'</span></span>';
 return '<span class="dm-tile '+(opt.small?"small ":"")+(opt.newest?"latest ":"")+(a===b?"double ":"")+(a===b&&t?.vertical!==false&&!opt.small?"vertical ":"")+'" aria-hidden="true">'+side(a)+'<i class="dm-divider"></i>'+side(b)+'</span>';
}
function scene(){return '<div class="dm-space" aria-hidden="true"><div class="dm-stars"></div><div class="dm-orbit"></div><div class="dm-planet"></div><div class="dm-horizon"></div></div>'}
function avatar(n,i,g){
 const label=esc(String(n||"?").slice(0,2).toUpperCase());
 const icon=typeof cosmicPlayerAvatarMarkup==="function"?
   cosmicPlayerAvatarMarkup(n,i):'<span class="dm-avatar-fallback">'+label+'</span>';
 return '<span class="dm-avatar" style="--dm-seat-color:'+["#8feaff","#fdd199","#b4a3ff","#7af1c7"][i%4]+'">'+icon+'</span>';
}
function row(g,n,i,shared=true){const mine=active(g)===n&&g.status==="playing";return '<div class="dm-player '+(mine?"active ":"")+(g.winner===n?"winner":"")+'">'+avatar(n,i,g)+'<span class="dm-player-name"><b>'+esc(n)+'</b><small>'+(mine?"● YOUR TURN":g.status==="won"&&g.winner===n?"★ WINNER":count(g,n)+" DOMINOES")+'</small></span><strong>'+Number(g.scores?.[n]||0)+'</strong></div>'}
function banner(g,context="shared"){return '<div class="dm-banner"><span class="dm-kicker">SI MOTHERSHIP · COSMIC TABLETOP</span><div class="dm-brand-row"><div class="dm-mark">⚁</div><div><h2>DOMINOES</h2><p>DRAW · MATCH · CONNECT</p></div></div></div>'}
function chainHTML(g,large=false){
 const left=ends(g).left,right=ends(g).right;
 return '<div class="dm-board-shell"><div class="dm-chain-head"><span class="dm-end-chip">◂ LEFT <b>'+(left===null?"—":left)+'</b></span><span>CONNECTED DOMINO CHAIN · '+g.chain.length+' PLAYED</span><span class="dm-end-chip">RIGHT ▸ <b>'+(right===null?"—":right)+'</b></span></div><div class="dm-chain '+(g.chain.length?"filled":"empty")+'">'+(g.chain.length?g.chain.map(t=>'<span class="dm-played-tile">'+tileHTML(t,{newest:g.lastPlay?.tileId===t.id})+'</span>').join(""):'<div class="dm-first"><b>PLACE THE FIRST DOMINO</b><span>Choose any domino to start. No left/right selection needed.</span></div>')+'</div></div>'
}
function tableHTML(g,big=false){const live=g.status==="playing";const players=g.players||[],current=active(g);return '<div class="dm-public '+(big?"dm-big":"dm-preview")+'">'+scene()+banner(g)+'<div class="dm-public-body">'+
 '<div class="dm-table-main"><div class="dm-turn-banner">'+(live?'<span>◉ CURRENT TURN</span><strong>'+esc(current)+'</strong>':'<span>✦ ROUND COMPLETE</span><strong>'+esc(g.winner||"Complete")+' WINS!</strong>')+'</div>'+chainHTML(g,big)+'<div class="dm-transmission"><span>◉ TRANSMISSION</span><p>'+esc(g.message)+'</p></div></div>'+
 '<aside class="dm-table-sidebar"><div class="dm-sidebar-heading">MISSION ROSTER</div><div class="dm-player-list">'+players.map((n,i)=>row(g,n,i)).join("")+'</div><div class="dm-bag-count"><span>DRAW PILE</span><b>'+g.bag.length+'</b><small>DOMINOES REMAINING</small></div>'+
 (g.status==="won"?'<div class="dm-victory">✦ '+esc(g.winner)+' WINS THIS ROUND ✦</div>':'')+'</aside></div></div>'}
function studentHTML(g,student){
 const name=String(student?.n||student?.name||"");if(!g.players?.includes(name))return '<div class="dm-device dm-observer">'+scene()+banner(g)+'<div class="dm-device-center"><span class="dm-kicker">MISSION OBSERVER</span><h3>WATCH THE TABLE</h3><p>You are in the audience for this round. Cheer on your classmates!</p></div></div>';
 const mine=active(g)===name&&g.status==="playing",hand=g.hands?.[name]||[],e=ends(g);
 return '<div class="dm-device">'+scene()+banner(g)+'<div class="dm-device-center"><span class="dm-kicker">'+(mine?"YOUR TURN":"PRIVATE HAND")+'</span><h3>'+(g.status==="won"?(g.winner===name?"✦ YOU WIN!":esc(g.winner)+" WINS!"):mine?"YOUR MOVE, "+esc(name):"WAIT FOR "+esc(active(g)))+'</h3><p>'+esc(g.message)+'</p></div>'+
 '<div class="dm-hand-head"><b>YOUR DOMINOES</b><span>'+hand.length+' TILES</span></div><div class="dm-hand">'+hand.map(t=>{const first=!g.chain.length,left=mine&&canPlay(g,name,t,"left"),right=mine&&canPlay(g,name,t,"right");return '<div class="dm-hand-item '+((left||right)?"playable":"locked")+'">'+tileHTML(t)+'<div class="dm-pick-actions">'+(first?'<button data-dm-play="'+escID(t.id)+'" data-dm-side="first" '+(!mine?'disabled':'')+'>▶ PLACE TILE</button>':'<button data-dm-play="'+escID(t.id)+'" data-dm-side="left" '+(!left?'disabled':'')+'>◂ LEFT</button><button data-dm-play="'+escID(t.id)+'" data-dm-side="right" '+(!right?'disabled':'')+'>RIGHT ▸</button>')+(t.a===t.b?'<button type="button" class="dm-rotate" data-dm-rotate="'+escID(t.id)+'">⟳ ROTATE DOUBLE</button>':'')+'</div></div>'}).join("")+'</div>'+
 '<div class="dm-device-controls">'+(mine?'<button id="dmDraw" '+(playable(g,name)||!g.bag.length?"disabled":"")+'>＋ DRAW DOMINO</button><button id="dmPass" '+(playable(g,name)||g.bag.length?"disabled":"")+'>PASS TURN →</button>':'<span>Only the active player can play or draw.</span>')+'</div>'+
 '<div class="dm-device-help">First tile: tap PLACE. Later, match left or right. Rotate doubles if desired. If none match, draw a domino until you can play—or pass when the pile is empty.</div></div>'
}
function teacherHTML(g,roster=[]){
 const player=active(g),hand=g.hands?.[player]||[],latest=g.lastPlay?.tileId;
 return '<div class="dm-teacher">'+banner(g)+
 '<div class="dm-teacher-columns"><div>'+tableHTML(g,false)+'</div><aside class="dm-teacher-controls"><span class="dm-kicker">MISSION CONTROL · DOMINOES</span><h3>'+esc(g.status==="won"?g.winner+" WINS!":player+"'s TURN")+'</h3><p>'+esc(g.message)+'</p>'+
 '<div class="dm-instructions">Teacher can play a tile for any student when assistance is needed. Students may also play independently on their devices.</div>'+
 '<div class="dm-teacher-hand"><b>ACTIVE PLAYER HAND</b><div class="dm-teacher-rack">'+hand.map(t=>'<button type="button" class="dm-teacher-pick '+(selectedTile===t.id?"selected":"")+'" data-dm-select="'+escID(t.id)+'">'+tileHTML(t,{small:true})+'</button>').join("")+'</div></div>'+
 '<div class="dm-teacher-moves">'+(!g.chain.length?'<button data-dm-teacher="first" '+(!selectedTile?'disabled':'')+'>▶ PLACE TILE</button>':'<button data-dm-teacher="left" '+(!selectedTile||!canPlay(g,player,hand.find(t=>t.id===selectedTile),"left")?'disabled':'')+'>◂ PLAY LEFT</button><button data-dm-teacher="right" '+(!selectedTile||!canPlay(g,player,hand.find(t=>t.id===selectedTile),"right")?'disabled':'')+'>PLAY RIGHT ▸</button>')+(hand.find(t=>t.id===selectedTile)?.a===hand.find(t=>t.id===selectedTile)?.b?'<button data-dm-teacher="rotate">⟳ DOUBLE: '+(doubleVertical?"VERTICAL":"HORIZONTAL")+'</button>':'')+'<button data-dm-teacher="draw" '+(playable(g,player)||!g.bag.length||g.status!=="playing"?"disabled":"")+'>＋ DRAW</button><button data-dm-teacher="pass" '+(playable(g,player)||g.bag.length||g.status!=="playing"?"disabled":"")+'>PASS →</button></div>'+
 '<button data-dm-teacher="reveal" class="dm-secondary">'+(revealHands?"HIDE":"SHOW")+' ALL HANDS · TEACHER ONLY</button>'+
 (revealHands?'<div class="dm-all-hands">'+g.players.map(n=>'<div><strong>'+esc(n)+'</strong><span>'+((g.hands[n]||[]).map(t=>tileHTML(t,{small:true})).join("")||"No tiles")+'</span></div>').join("")+'</div>':'')+
 '<button data-dm-teacher="rematch" class="dm-secondary">↻ NEW ROUND · SAME PLAYERS</button><button data-dm-teacher="reselect" class="dm-secondary">♙ CHANGE PLAYERS</button>'+
 '<button data-dm-teacher="save" class="dm-secondary">▣ SAVE GAME</button><button data-dm-teacher="load" class="dm-secondary">▣ LOAD SAVED GAME</button>'+
 '<div class="controller-safety"><button id="returnClassBtn">✓ Finish & Return</button><button id="sendActivityLobbyBtn">Ⅱ Pause & Keep Progress</button><button id="emergencyActivityBtn" class="danger-action">⚠ Emergency Return</button></div>'+
 '</aside></div></div>'
}
const LIB="siMothership.dominoesGames.v1";
function library(){try{const x=JSON.parse(localStorage.getItem(LIB)||"[]");return Array.isArray(x)?x:[]}catch{return []}}
function saveGame(g,name){const x=library().filter(a=>a.id!==g.id);x.unshift({id:g.id,name:String(name||"Dominoes").slice(0,64),at:Date.now(),game:snapshot(g)});localStorage.setItem(LIB,JSON.stringify(x.slice(0,20)));}
function setupHTML(students=[]){
 const names=[...new Set(students.map(x=>String(x||"").trim()).filter(Boolean))];
 selectedNames=selectedNames.filter(x=>names.includes(x));
 if(!selectedNames.length)selectedNames=names.slice(0,Math.min(3,names.length));
 const seats=selectedNames.length+(teacherIncluded?1:0);
 return '<div class="dm-setup">'+scene()+banner({})+
 '<div class="dm-setup-intro"><div><span class="dm-kicker">COSMIC TABLETOP · 2–4 PLAYER DRAW DOMINOES</span><h3>CONNECT THE NUMBERS</h3><p>A classic double-six set. Play from your own private hand, connect matching ends, draw when you cannot play, and clear your hand to win.</p></div><div class="dm-display-tiles">'+tileHTML({a:6,b:6})+tileHTML({a:2,b:4})+tileHTML({a:0,b:5})+'</div></div>'+
 '<div class="dm-setup-status"><strong>'+seats+' / 4 PLAYERS SELECTED</strong><span>'+Math.max(0,names.length-selectedNames.length)+' spectators · '+names.length+' connected</span></div>'+
 '<div class="dm-setup-rule"><b>CLASSROOM GAME MODE</b><p>Just like Cosmic Cards, connected students play privately; everyone else watches the shared table. The teacher can observe or join as a player.</p>'+
 '<button class="dm-seat '+(teacherIncluded?"chosen":"")+'" data-dm-teacher-seat="1"><span>'+(teacherIncluded?"✓":"◉")+'</span><b>TEACHER PLAYS</b><small>'+(teacherIncluded?"Included in game":"Host only")+'</small></button></div>'+
 '<div class="dm-seats">'+(names.length?names.map(n=>'<button class="dm-seat '+(selectedNames.includes(n)?"chosen":"")+'" data-dm-seat="'+esc(n)+'"><span>'+(selectedNames.includes(n)?"✓":"◉")+'</span><b>'+esc(n)+'</b><small>'+(selectedNames.includes(n)?"PLAYER":"AUDIENCE")+'</small></button>').join(""):'<p class="dm-empty">No students connected. You can start a two-player practice match from Mission Control.</p>')+'</div>'+
 '<div class="dm-setup-footer"><button class="dm-primary" id="dmStart">▶ START '+Math.max(2,seats)+' PLAYER GAME</button><p>28 tiles · 7 dealt per player · Each remaining tile stays in the draw pile.</p><div id="dmSetupError" role="status"></div></div>'+
 '<div class="dm-saved"><h4>SAVED DOMINOES GAMES</h4>'+ (library().length?library().map(x=>'<button data-dm-load="'+esc(x.id)+'">'+esc(x.name)+' <small>'+new Date(x.at).toLocaleDateString()+'</small> →</button>').join(""):'<p>No saved games yet.</p>')+'</div></div>'
}
function setupWire(root,students,onStart,onLoad,rerender){
 if(!root)return;
 root.querySelectorAll("[data-dm-seat]").forEach(b=>b.onclick=()=>{let n=b.dataset.dmSeat;if(selectedNames.includes(n))selectedNames=selectedNames.filter(x=>x!==n);else if(selectedNames.length+(teacherIncluded?1:0)<4)selectedNames.push(n);rerender()});
 root.querySelectorAll("[data-dm-teacher-seat]").forEach(b=>b.onclick=()=>{teacherIncluded=!teacherIncluded;if(teacherIncluded&&selectedNames.length>3)selectedNames=selectedNames.slice(0,3);rerender()});
 const launch=root.querySelector("#dmStart");if(launch)launch.onclick=()=>{
  let people=[...selectedNames];
  if(teacherIncluded)people.push("Teacher");
  if(people.length<2){const connected=(students||[]).filter(Boolean);if(!connected.length){people=["Crew Alpha","Crew Beta"]}else if(connected.length===1&&!teacherIncluded){people=[connected[0],"Teacher"]}else{root.querySelector("#dmSetupError").textContent="Select at least two players or enable Teacher Plays.";return}}
  try{onStart(make(people,{teacherIncluded:people.includes("Teacher")}))}catch(e){root.querySelector("#dmSetupError").textContent=String(e?.message||e)}
 };
 root.querySelectorAll("[data-dm-load]").forEach(b=>b.onclick=()=>{const x=library().find(s=>s.id===b.dataset.dmLoad);if(x&&confirm("Resume "+x.name+"?"))onLoad(x.game)});
}
function teacherWire(root,g,rerender,onReload,onReselect,onRematch){
 if(!root)return;
 const redraw=()=>{selectedTile="";rerender()};
 root.querySelectorAll("[data-dm-select]").forEach(b=>b.onclick=()=>{selectedTile=b.dataset.dmSelect;rerender()});
 root.querySelectorAll("[data-dm-teacher]").forEach(b=>b.onclick=()=>{
  const act=b.dataset.dmTeacher,who=active(g);let result=null;
  if(act==="reveal"){revealHands=!revealHands;rerender();return}
  if(act==="reselect"){onReselect();return}
  if(act==="rematch"){if(confirm("Start a new Dominoes round with the same players?"))onRematch(make(g.players,{teacherIncluded:g.teacherIncluded}));return}
  if(act==="save"){const name=prompt("Save Dominoes game as:",g.name||"Dominoes · "+new Date().toLocaleDateString());if(name?.trim()){g.name=name.trim();saveGame(g,name.trim());rerender()}return}
  if(act==="load"){const list=library();if(!list.length){alert("No saved Dominoes games.");return}const i=Number(prompt("Load game number:\\n"+list.map((x,i)=>(i+1)+". "+x.name).join("\\n"),"1"))-1;if(list[i]&&confirm("Load "+list[i].name+"?"))onReload(list[i].game);return}
  if(act==="rotate"){doubleVertical=!doubleVertical;rerender();return}
  if(!["first","left","right","draw","pass"].includes(act))return;
  if(["first","left","right"].includes(act))result=apply(g,who,"play",selectedTile,act,doubleVertical);else result=apply(g,who,act);
  if(result?.error){alert(result.error);return}
  redraw();
 });
}
function studentSend(kind,id="",side="right",vertical=true){
 const s=selectedStudent(),name=s?.n||"",run=state.activityRun;if(!run||run.phase!=="running"||!name)return;
 const req={id:"dom_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),runToken:run.runToken,type:kind,tileId:id,side,vertical};
 if(typeof NETWORK_SYNC!=="undefined"&&NETWORK_SYNC){
  if(networkHydrated&&networkSocket&&networkSocket.readyState===WebSocket.OPEN){
   networkSocket.send(JSON.stringify({type:"dominoes_action",request:req,student_name:name,student_token:currentStudentIdentity()?.student_token||""}));return;
  }toast("Reconnecting to Mothership — your dominoes are safe.");return
 }
 const r=apply(run.dominoes,name,kind,id,side,vertical);if(r.error)toast(r.error);else render()
}
function studentWire(){document.querySelectorAll("[data-dm-rotate]").forEach(b=>b.onclick=()=>{const item=b.closest(".dm-hand-item");item?.classList.toggle("dm-double-vertical");b.textContent=item?.classList.contains("dm-double-vertical")?"⟳ VERTICAL":"⟳ HORIZONTAL"});document.querySelectorAll("[data-dm-play]").forEach(b=>b.onclick=()=>studentSend("play",b.dataset.dmPlay,b.dataset.dmSide,!!b.closest(".dm-double-vertical")));const draw=document.querySelector("#dmDraw"),pass=document.querySelector("#dmPass");if(draw)draw.onclick=()=>studentSend("draw");if(pass)pass.onclick=()=>studentSend("pass")}
function reset(){selectedTile="";revealHands=false;doubleVertical=false}
return {make,makeBag,pips,active,ends,canPlay,playable,apply,winner,snapshot,tileHTML,tableHTML,studentHTML,teacherHTML,setupHTML,setupWire,teacherWire,studentWire,reset,saveGame,library,LIB};
});
