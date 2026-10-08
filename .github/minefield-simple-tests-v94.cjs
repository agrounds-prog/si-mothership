const fs=require('fs'), assert=require('assert');
const s=fs.readFileSync('index.html','utf8');
function section(a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,'Missing source section: '+a);return s.slice(i,j)}
const build=section('function createMinefield(length){','function initializeMinefieldRun(');
const create=new Function('minefieldConfig','Math',build+';return createMinefield')(
  key=>({key:key||'standard',size:key==='quick'?5:key==='epic'?7:6}), Math);
for(const [size,difficulty,mines,health] of [[5,'quick',4,2],[6,'standard',7,3],[7,'epic',10,4]]){
  for(let j=0;j<15;j++){
    const mf=create(difficulty),ts=mf.board.flat();
    assert.equal(mf.size,size);assert.equal(ts.length,size*size);
    assert.equal(mf.rules,'clear-map-v2');
    assert.equal(mf.simple,true);
    assert(ts.every(t=>!t.revealed),'New board must start fully covered');
    assert.equal(ts.filter(t=>t.type==='mine').length,mines);
    assert.equal(ts.filter(t=>t.type==='repair').length,health);
    assert.equal(ts.filter(t=>t.type==='clear').length,size*size-mines-health);
    assert.equal(mf.hull,3);assert.equal(mf.maxHull,5);
    assert(ts.every(t=>t.simple),'Every tile uses new simplified rendering');
    assert(!ts.some(t=>t.type==='extraction'),'No old extraction beacon');
    assert(!ts.some(t=>t.signalArrow),'No directional clues');
  }
}
console.log('PASS quick, standard, epic boards contain only empty, health, mine; start hidden');
const symbols=section('function minefieldSymbol(tile,current,showHidden=false){','function minefieldBoardMarkup(');
const symbol=new Function('esc',symbols+';return minefieldSymbol')(x=>x);
assert.equal(symbol({simple:true,type:'clear',revealed:true},false),'');
assert.equal(symbol({simple:true,type:'repair',revealed:true},false),'♥');
assert.equal(symbol({simple:true,type:'mine',revealed:true},false),'💣');
assert.equal(symbol({simple:true,type:'mine',revealed:false},false),'·');
assert.equal(symbol({type:'mine',revealed:true},false),'✹');
console.log('PASS blank tile and health/mine markers, hidden mine privacy, legacy symbol');
const core=section('function resolveMinefieldMove(opts={}){','function resetMinefieldGame(){');
function fixture(run,silent=false){
  const people=[{n:'Student A'},{n:'Student B'}];
  const state={activityRun:run};
  const events=[];let renders=0;
  const get=new Function('state','ensureMinefield','minefieldMode','activeMinefield','minefieldTile','mfCoord',
    'minefieldNavigator','minefieldClearProgress','minefieldTeamStudents','nextMinefieldTeam','minefieldTeamName',
    'minefieldOverallStatus','connectedStudents','minefieldEvent','render','toast','resolveMinefieldMoveLegacy',
    core+';return resolveMinefieldMove');
  const fn=get(state,()=>run.mf,()=>run.minefieldMode||'crew',(r,teamIndex)=>{
      return r.minefieldMode==='teams'?r.mfTeams[Number(teamIndex??r.activeTeam||0)]:r.mf;
    },(run,r,c,mf)=>mf.board[r]?.[c],(r,c)=>String.fromCharCode(65+c)+(r+1),
    ()=>people[run.mf.navigatorIndex%people.length],(mf)=>{
      const safe=mf.board.flat().filter(t=>t.type!=='mine');
      return {cleared:safe.filter(t=>t.revealed).length,total:safe.length};
    },()=>people,()=>1,(i)=>i===0?'Blue Crew':'Red Crew',()=>run.mf.status,()=>people,
    (r,text,kind)=>events.push({text,kind}),()=>renders++,(msg)=>{},()=>{throw Error('Legacy called for new map')});
  return {fn,events,get renders(){return renders}};
}
let mf=create('quick');
let run={mf,minefieldMode:'crew'},h=fixture(run);
const tile=type=>mf.board.flat().find(t=>t.type===type&&!t.revealed);
let c=tile('clear');mf.pending={r:c.r,c:c.c};h.fn();assert.equal(c.revealed,true);
assert.equal(mf.hull,3);assert.equal(mf.status,'playing');assert(mf.message.includes('SAFE!'));
assert.equal(mf.turn,2);assert.equal(mf.navigatorIndex,1);
c=tile('repair');mf.pending={r:c.r,c:c.c};h.fn();assert.equal(mf.hull,4);
assert(mf.message.includes('HEALTH FOUND'));
c=tile('mine');mf.pending={r:c.r,c:c.c};h.fn();assert.equal(mf.hull,3);
assert(mf.message.includes('MINE!'));assert.equal(mf.status,'playing');
const previous=h.renders;mf.pending={r:c.r,c:c.c};h.fn();assert.equal(h.renders,previous,'Already revealed square is ignored');
console.log('PASS empty, +1 heart, mine -1 heart, navigator rotation, repeat-click prevention');
mf=create('quick');run={mf,minefieldMode:'crew'};h=fixture(run);
mf.hull=1;c=tile('mine');mf.pending={r:c.r,c:c.c};h.fn();
assert.equal(mf.hull,0);assert.equal(mf.status,'lost');assert(mf.message.includes('mission over'));
console.log('PASS hitting a mine with last heart ends game');
mf=create('quick');run={mf,minefieldMode:'crew'};h=fixture(run);
const safe=mf.board.flat().filter(t=>t.type!=='mine');
safe.slice(0,-1).forEach(t=>t.revealed=true);
c=safe.at(-1);mf.pending={r:c.r,c:c.c};h.fn();
assert.equal(mf.status,'won');assert(mf.message.includes('MAP CLEARED'));
assert(!mf.board.flat().filter(t=>t.type==='mine').some(t=>t.revealed));
console.log('PASS all non-mine squares cleared wins without revealing mines');
assert(!s.includes('Find the hidden Extraction Beacon before the hull is lost.'));
assert(!s.includes('Use the revealed mine counts and beacon arrows, then tap any unrevealed square.'));
assert(s.includes('minefieldQuickRulesMarkup(mf)'));
assert(s.includes('<style id="v94-minefield-coop">'));
console.log('PASS simple classroom-facing rules, progress and layout installed');
