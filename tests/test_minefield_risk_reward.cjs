/* Minefield Risk + Reward: deterministic 8-neighbor values, live scoring,
 * mode isolation, old save restoration, real asset wiring, hidden tile safety.
 * No production session or API is contacted. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const server=fs.readFileSync(path.join(root,'server.py'),'utf8');
const css=fs.readFileSync(path.join(root,'minefield-v2.css'),'utf8');
function extract(name){
  const start=html.indexOf('function '+name+'(');
  assert(start>=0,'Missing '+name);
  const end=html.indexOf('\nfunction ',start+10);
  assert(end>start,'Missing next function for '+name);
  return html.slice(start,end);
}
const names=['createMinefield','minefieldAdjacentMines','minefieldTilePoints',
 'minefieldCrewScore','minefieldClearProgress','minefieldSymbol',
 'minefieldBoardMarkup','resolveMinefieldMove'];
const students=[{n:'Navigator'},{n:'Partner'}];
const ctx={
  Math,console,
  minefieldConfig:length=>({key:length,size:length==='quick'?5:length==='epic'?7:6}),
  state:{activityRun:null},
  minefieldMode:run=>run.minefieldMode||'crew',
  minefieldTeamCount:()=>2,
  minefieldTeamStudents:()=>students,
  minefieldTeamName:i=>'Team '+(i+1),
  minefieldNavigator:()=>students[0],
  connectedStudents:()=>students,
  activeMinefield:(run,index=null)=>run.minefieldMode==='teams'
   ?run.mfTeams[index===null?run.activeTeam:index]
   :run.minefieldMode==='teacher'?(index==='class'?run.mfClass:run.mfTeacher):run.mf,
  ensureMinefield:run=>run.mf||run.mfTeams?.[0]||run.mfClass,
  minefieldTile:(run,r,c,mf)=>mf.board?.[r]?.[c],
  minefieldEvent:(run,description,kind)=>{
    run.latestNarration=description;
    (run.narrationLog ||= []).push({text:description,kind});
  },
  minefieldOverallStatus:run=>run.mf?.status||'playing',
  nextMinefieldTeam:run=>(run.activeTeam=(run.activeTeam+1)%2),
  minefieldCoord:(r,c)=>String.fromCharCode(65+c)+(r+1),
  mfCoord:(r,c)=>String.fromCharCode(65+c)+(r+1),
  render:()=>{},toast:()=>{},
  esc:s=>String(s).replaceAll('<','&lt;'),
};
vm.createContext(ctx);
vm.runInContext(names.map(extract).join('\n'),ctx);
function custom(count){
 const mf=ctx.createMinefield('quick'),n=mf.size;
 mf.board=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>({
   r,c,type:'clear',revealed:false,simple:true
 })));
 const offsets=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
 for(const [dr,dc] of offsets.slice(0,count))mf.board[2+dr][2+dc].type='mine';
 return mf;
}
for(let n=0;n<=8;n++){
 const mf=custom(n),tile=mf.board[2][2];
 assert.equal(ctx.minefieldAdjacentMines(mf,2,2),n);
 assert.equal(ctx.minefieldTilePoints(mf,tile),Math.min(5,n+1));
 assert.equal(ctx.minefieldTilePoints(mf,mf.board[2-1]?.[2-1]),0===n?1:0);
}
function reveal(mf,t,run={minefieldMode:'crew',mf,narrationLog:[]}){
 ctx.state.activityRun=run;
 mf.pending={r:t.r,c:t.c};
 ctx.resolveMinefieldMove(run.minefieldMode==='teacher'?{teacherMove:true}:{});
 return run;
}
const crew=custom(4),safe=crew.board[2][2];
const crewRun=reveal(crew,safe);
assert.equal(safe.revealed,true);
assert.equal(safe.points,5);
assert.equal(safe.near,4);
assert.equal(crew.score,5);
assert.equal(crew.lastReward,5);
assert.equal(crewRun.narrationLog.at(-1).kind,'reward');
assert.match(crewRun.latestNarration,/earned 5 points/);
assert.equal(crew.turn,2);
const boardMarkup=ctx.minefieldBoardMarkup(crewRun,{big:true});
assert.match(boardMarkup,/mf-value-5/);
assert.match(boardMarkup,/Sector C3 · 5 points · 4 adjacent mines/);
assert.equal((boardMarkup.match(/mf-value-/g)||[]).length,1,
 'Unrevealed tiles cannot expose their risk tier.');
assert.match(ctx.minefieldSymbol(safe,false),/mf-point-value/);
reveal(crew,safe,crewRun);
assert.equal(crew.score,5,'Re-selecting a revealed tile cannot award points twice.');
const other=crew.board.flat().find(t=>t.type==='clear'&&!t.revealed);
const value=ctx.minefieldTilePoints(crew,other);
reveal(crew,other,crewRun);
assert.equal(crew.score,5+value);
const persisted=JSON.parse(JSON.stringify(crew));
assert.equal(ctx.minefieldCrewScore(persisted),5+value,'Saved score survives JSON roundtrip');
delete persisted.score;
assert.equal(ctx.minefieldCrewScore(persisted),5+value,'Old saved games derive score from revealed tiles');
const third=persisted.board.flat().find(t=>t.type==='clear'&&!t.revealed);
const beforeLegacy=ctx.minefieldCrewScore(persisted);
reveal(persisted,third,{minefieldMode:'crew',mf:persisted,narrationLog:[]});
assert.equal(persisted.score,beforeLegacy+third.points,'New scoring builds on recovered legacy score');
// Mines and hearts change only health, never reward the crew.
const heart=crew.board.flat().find(t=>t.type==='clear'&&!t.revealed);
heart.type='repair';crew.hull=2;
const prior=crew.score;
reveal(crew,heart,crewRun);
assert.equal(crew.hull,3);assert.equal(crew.score,prior);
const mine=crew.board.flat().find(t=>t.type==='mine'&&!t.revealed);
reveal(crew,mine,crewRun);
assert.equal(crew.hull,2);assert.equal(crew.score,prior);
// Each team and teacher/class has a distinct score; no cross-board carryover.
const team0=custom(3),team1=custom(0);
const teams={minefieldMode:'teams',mfTeams:[team0,team1],activeTeam:0,narrationLog:[]};
reveal(team0,team0.board[2][2],teams);
assert.equal(team0.score,4);
assert.equal(team1.score,0);
assert.equal(teams.activeTeam,1);
const teacherMf=custom(2),classMf=custom(1);
const teacherRun={minefieldMode:'teacher',mfTeacher:teacherMf,mfClass:classMf,
 activeSide:'teacher',narrationLog:[]};
reveal(teacherMf,teacherMf.board[2][2],teacherRun);
assert.equal(teacherMf.score,3);
assert.equal(classMf.score,0);
assert.equal(teacherRun.activeSide,'class');
// The approved art is exposed under a scoped, allowlisted path; real labels
// are separate from the transparent artwork.
const mustExist=[
 ['tiles','tile_hidden.png'],['tiles','tile_safe_1pt.png'],
 ['tiles','tile_safe_2pt.png'],['tiles','tile_safe_3pt.png'],
 ['tiles','tile_safe_4pt.png'],['tiles','tile_safe_5pt.png'],
 ['tiles','tile_health_bonus.png'],['tiles','tile_mine.png'],
 ['frames','frame_board_outer.png'],['frames','panel_narrator.png'],
 ['backgrounds','background_mission_16x9.png'],
 ['backgrounds','background_teacher_16x9.png'],
 ['backgrounds','background_student_9x16.png'],
 ['banners','wordmark_minefield.png']
];
for(const [folder,file] of mustExist){
 assert(fs.existsSync(path.join(root,'assets','minefield-v2',folder,file)),folder+'/'+file);
 assert(css.includes('/assets/minefield-v2/'+folder+'/'+file),folder+'/'+file+' not wired into CSS');
}
assert(server.includes('"/assets/minefield-v2/{folder}/{name}", minefield_v2_graphic'));
assert(server.includes('"/minefield-v2.css", minefield_v2_stylesheet'));
assert(server.includes('/minefield-v2.css?v=2'));
assert.match(html,/mf-score-chip/);
assert.match(html,/Crew score /);
console.log('PASS: Minefield Risk + Reward mine adjacency, points, game modes, save/restore, and graphics');
