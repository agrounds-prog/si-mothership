from pathlib import Path
import hashlib
p=Path('index.html');raw=p.read_bytes()
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
assert blob(raw)=='522072a7a227e0b26e0ad5b456b4b0ffb98d1524',f'Stale index.html {blob(raw)}'
assert 1300000<len(raw)<1560000
s=raw.decode('utf-8')
def once(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:140])
    s=s.replace(a,b,1)
def section(a,b,new):
    global s
    i=s.index(a)
    j=s.index(b,i)
    s=s[:i]+new+s[j:]

create = r"""function createMinefield(length){
  const cfg=minefieldConfig(length),n=cfg.size;
  const board=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>({
    r,c,type:'clear',revealed:false,simple:true
  })));
  const cells=board.flat();
  for(let i=cells.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [cells[i],cells[j]]=[cells[j],cells[i]];
  }
  const mines=cfg.key==='quick'?4:cfg.key==='epic'?10:7;
  const health=cfg.key==='quick'?2:cfg.key==='epic'?4:3;
  cells.slice(0,mines).forEach(t=>t.type='mine');
  cells.slice(mines,mines+health).forEach(t=>t.type='repair');
  return {
    rules:'clear-map-v2',simple:true,length:cfg.key,size:n,board,
    current:{r:-1,c:-1},hull:3,maxHull:5,shield:0,navigatorIndex:0,
    turn:1,pending:null,status:'playing',awaitingTeacherReveal:false,
    message:'Work together! Reveal safe squares, collect hearts, and avoid mines. Clear all safe squares to win.'
  };
}
"""
section('function createMinefield(length){','function initializeMinefieldRun(',create)
assert s.count("Choose any unrevealed sector and use the beacon signal.")==2
s=s.replace("Choose any unrevealed sector and use the beacon signal.","Work together: reveal every safe square before health reaches zero.",2)
once("run.mfClass.message='Class turn — the Navigator may choose any unrevealed sector.';","run.mfClass.message='Class turn — choose a closed square to reveal.';")
once("run.mfTeacher.message='Teacher turn will follow the class move.';","run.mfTeacher.message='Teacher turn will follow the class move.';")
# Fix two more turn messages when playing the advanced teacher-versus-class mode.
once("run.mfTeacher.message='Teacher turn — choose a sector using the revealed beacon clues.';","run.mfTeacher.message='Teacher turn — select a closed square.';")
once("run.mfClass.message='Class turn — the next Navigator may choose any unrevealed sector using the beacon clues.';","run.mfClass.message='Class turn — the next Navigator may choose a closed square.';")

helpers=r"""function minefieldClearProgress(mf){
  const tiles=mf?.board?.flat()||[];
  const safe=tiles.filter(t=>t.type!=='mine');
  return {cleared:safe.filter(t=>t.revealed).length,total:safe.length};
}
function minefieldQuickRulesMarkup(mf){
  if(!mf?.simple)return '<div class="minefield-signal-legend"><span><b>NUMBER</b> nearby mines</span><span><b>ARROW + #</b> beacon signal</span></div>';
  const progress=minefieldClearProgress(mf);
  const pct=progress.total?Math.round(100*progress.cleared/progress.total):0;
  return '<div class="minefield-signal-legend minefield-simple-legend">'+
    '<span>✓ <b>EMPTY</b> safe</span><span>♥ <b>HEALTH</b> +1</span><span>💣 <b>MINE</b> −1</span>'+
    '<span class="mf-progress-label">Cleared '+progress.cleared+' / '+progress.total+'</span>'+
    '<div class="minefield-simple-status" style="flex-basis:100%;width:100%"><div class="mf-progress-track">'+
    '<span class="mf-progress-fill" style="width:'+pct+'%"></span></div></div></div>';
}
"""
once('function minefieldSymbol(tile,current,showHidden=false){',helpers+"""function minefieldSymbol(tile,current,showHidden=false){
  if(tile.simple){
    if(!tile.revealed&&!showHidden)return '·';
    if(tile.type==='mine')return '💣';
    if(tile.type==='repair')return '♥';
    return '';
  }
""")
once('const current=mf.current.r===t.r&&mf.current.c===t.c,selected=',"const current=!mf.simple&&mf.current.r===t.r&&mf.current.c===t.c,selected=")
once("const cls=[current?'ship':'',t.revealed?'revealed':'unknown',", "const cls=[mf.simple?'simple':'',t.revealed&&mf.simple&&t.type==='clear'?'empty':'',t.revealed&&mf.simple&&t.type==='repair'?'health':'',current?'ship':'',t.revealed?'revealed':'unknown',")
once("function minefieldHullMarkup(mf){return `HULL", "function minefieldHullMarkup(mf){if(mf?.simple)return `HEALTH ${'♥'.repeat(Math.max(0,mf.hull))}${'♡'.repeat(Math.max(0,mf.maxHull-mf.hull))}`;return `HULL")
# Preserve existing games already under way. Rename original resolver and invoke it for legacy maps.
once("function resolveMinefieldMove(opts={}){","function resolveMinefieldMoveLegacy(opts={}){")
newResolver=r"""function resolveMinefieldMove(opts={}){
  const run=state.activityRun;if(!run)return;
  ensureMinefield(run);
  const mode=minefieldMode(run),side=mode==='teacher'?(run.activeSide||'class'):null;
  const teamIndex=mode==='teams'?Number(run.activeTeam||0):(mode==='teacher'?side:null);
  const mf=activeMinefield(run,teamIndex);
  if(!mf?.simple)return resolveMinefieldMoveLegacy(opts);
  if(mf.status!=='playing'||!mf.pending)return;
  if(mode==='teacher'&&side==='teacher'&&!opts.teacherMove)return;
  const {r,c}=mf.pending,t=minefieldTile(run,r,c,mf);
  if(!t||t.revealed||!Number.isInteger(r)||!Number.isInteger(c)){
    mf.pending=null;return;
  }
  const coord=mfCoord(r,c);
  const who=mode==='teacher'&&side==='teacher'?'Teacher':(minefieldNavigator(run,teamIndex)?.n||'Navigator');
  t.revealed=true;
  mf.current={r,c};mf.pending=null;mf.awaitingTeacherReveal=false;
  let kind='info',msg='';
  if(t.type==='mine'){
    mf.hull=Math.max(0,mf.hull-1);
    kind='mine';msg='💣 MINE! '+who+' chose '+coord+'. Health −1.';
  }else if(t.type==='repair'){
    const before=mf.hull;
    mf.hull=Math.min(mf.maxHull,mf.hull+1);
    kind='special';msg='♥ HEALTH FOUND at '+coord+'! '+(mf.hull>before?'Health +1.':'Health already full.');
  }else{
    msg='✓ SAFE! '+coord+' was empty.';
  }
  const progress=minefieldClearProgress(mf);
  if(mf.hull<=0){
    mf.status='lost';kind='mine';msg+=' No health left — mission over.';
  }else if(progress.total>0&&progress.cleared===progress.total){
    mf.status='won';kind='win';msg='🏆 MAP CLEARED! Every safe square was revealed. Mission complete!';
  }
  mf.message=msg;
  let narration=msg;
  if(mode==='teams'){
    if(mf.status==='won')run.teamWinner=teamIndex;
    if(minefieldOverallStatus(run)==='playing'){
      const members=minefieldTeamStudents(teamIndex,run);
      mf.navigatorIndex=(mf.navigatorIndex+1)%Math.max(1,members.length);mf.turn++;
      const nextTeam=nextMinefieldTeam(run),nextNav=minefieldNavigator(run,nextTeam);
      narration+=' Next: '+minefieldTeamName(nextTeam)+(nextNav?.n?' — '+nextNav.n:'')+'.';
    }
  }else if(mode==='teacher'){
    if(mf.status==='won')run.teacherVsWinner=side;
    else if(mf.status==='lost')run.teacherVsWinner=side==='teacher'?'class':'teacher';
    if(!run.teacherVsWinner){
      if(side==='class'){
        const members=connectedStudents();
        mf.navigatorIndex=(mf.navigatorIndex+1)%Math.max(1,members.length);mf.turn++;
        run.activeSide='teacher';
        run.mfTeacher.message='Teacher turn — select a closed square.';
        narration+=' Teacher turn.';
      }else{
        mf.turn++;run.activeSide='class';
        run.mfClass.message='Class turn — choose a closed square.';
        const nextNav=minefieldNavigator(run,'class');
        narration+=' Class turn'+(nextNav?.n?' — '+nextNav.n:'')+'.';
      }
    }
  }else if(mf.status==='playing'){
    mf.navigatorIndex=(mf.navigatorIndex+1)%Math.max(1,connectedStudents().length);
    mf.turn++;
    const nextNav=minefieldNavigator(run);
    narration+=' Next Navigator: '+(nextNav?.n||'crew member')+'.';
  }
  minefieldEvent(run,narration,kind);
  render();toast(msg);
}
"""
once("function resetMinefieldGame(){",newResolver+"function resetMinefieldGame(){")

# Current setup is the simple cooperative mission; keep other previously available modes.
setupStart=s.index('<p>Find the hidden Extraction Beacon before the hull is lost.')
setupEnd=s.index('<div class="minefield-modes">',setupStart)
s=s[:setupStart]+"""<p>Work together to clear the board! Take turns choosing a hidden square. Find safe spaces, collect health, and avoid mines. <b>Reveal every safe square before your health reaches zero.</b></p><div class="minefield-objective simple-objective"><b>THE WHOLE GAME IN THREE SYMBOLS</b><div>✓ <b>EMPTY</b> = safe square · <span class="mf-simple-icon">♥</span> <b>HEALTH</b> = +1 heart · <span class="mf-simple-icon">💣</span> <b>MINE</b> = −1 heart</div><div style="margin-top:8px">Students take turns as Navigator; the class works together to clear the map. Every new game starts with a covered board.</div></div>"""+s[setupEnd:]
once("subtitle.textContent='Reward game · Choose the play mode, game length, then load the mission.';", "subtitle.textContent='Work together to clear the map · Empty, health, or mine.';")
once("['crew','Crew Mode','One ship · one hull · students rotate as Navigator']", "['crew','Co-op Classroom','One shared map · take turns · clear every safe square']")
once("['teams','Teams','Split the Live Roster into two or three crews with separate fields']", "['teams','Team Challenge','Separate boards · teams alternate revealing squares']")
once("['teacher','Teacher vs Class','Class and teacher alternate turns on separate fields; first to extraction wins']", "['teacher','Teacher vs Class','Separate boards · first to clear all safe squares wins']")

# Screen legend appears once per active teacher-vs mode and once for normal teams/crew.
legend='<div class="minefield-signal-legend"><span><b>NUMBER</b> nearby mines</span><span><b>ARROW + #</b> beacon signal</span></div>'
assert s.count(legend)==3,s.count(legend)
legacy_pos=s.index(legend)
s=s[:legacy_pos+len(legend)]+s[legacy_pos+len(legend):].replace(legend,'${minefieldQuickRulesMarkup(mf)}',2)
# Retire old directions on student devices.
old='Use the revealed mine counts and beacon arrows, then tap any unrevealed square.'
assert s.count(old)==2,s.count(old)
s=s.replace(old,'Work with your crew: choose a hidden square. Safe = ✓, health = ♥, mine = 💣.')
# Change explanatory finish copy to match the new clear-map goal (legacy missions keep state).
once("The class reached extraction first or outlasted the teacher ship.","The class cleared the map first or outlasted the teacher ship.")
once("The teacher reached extraction first or the class ship lost its hull.","The teacher cleared the map first or the class ship lost its health.")
# All other remaining "reached extraction" phrases only refer to Minefield ending text.
s=s.replace(" reached extraction!", " cleared the map!")
# Add strong co-op victory styling (from style asset), without altering gameplay screens.
assert 'v94-minefield-coop' not in s
css=Path('.github/minefield-simple-v94.css').read_text()
head=s.index('</head>')
s=s[:head]+'<style id="v94-minefield-coop">'+css+'</style>'+s[head:]
p.write_text(s,encoding='utf-8')
assert p.stat().st_size<1590000
print('MINEFIELD_COOP_PATCH_OK',blob(raw),blob(p.read_bytes()),'bytes',p.stat().st_size)
