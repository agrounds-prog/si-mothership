/* MILLION Studio — teacher-only saved question game builder.
   Existing multiplayer engine remains the source of truth for live gameplay. */
(()=>{
'use strict';
if(window.MillionStudio)return;
const GAME_KEY='siMothership.millionGames.v1';
const DRAFT_KEY='siMothership.millionDraft.v1';
const KEYS=['A','B','C','D'];
const LABELS=['Poll the Crew','Reduce Signal 50/50','Mothership Clue','Try Again'];
const LIFE=['poll','reduce','clue','tryAgain'];
const LADDER=[100,200,300,500,1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,1000000];
const blank=()=>({prompt:'',choices:['','','',''],correct:'A',mothershipClue:'',explanation:''});
const fresh=()=>({name:'',count:15,questions:Array.from({length:15},blank),pilot:'',pilotMode:'rotate',risk:'practice',
 lifelines:{poll:2,reduce:1,clue:1,tryAgain:1}});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(x,min,max)=>Math.max(min,Math.min(max,Number(x)||min));
const id=()=>('million-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
const getJson=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||'null')||fallback}catch{return fallback}};
const normalize=o=>{
 const x=fresh();if(!o||typeof o!=='object')return x;
 x.name=String(o.name||'').slice(0,100);x.count=[5,10,15].includes(+o.count)?+o.count:15;
 x.questions=Array.from({length:15},(_,i)=>{
  const q=Array.isArray(o.questions)?o.questions[i]:null;
  return {prompt:String(q?.prompt||'').slice(0,260),
   choices:KEYS.map((_,j)=>String(Array.isArray(q?.choices)?q.choices[j]||'':'').slice(0,120)),
   correct:KEYS.includes(q?.correct)?q.correct:'A',
   mothershipClue:String(q?.mothershipClue||'').slice(0,240),
   explanation:String(q?.explanation||'').slice(0,320)};
 });
 x.pilot=String(o.pilot||'').slice(0,80);
 x.pilotMode=['rotate','individual','every'].includes(o.pilotMode)?o.pilotMode:'rotate';
 x.risk=['practice','friendly','classic'].includes(o.risk)?o.risk:'practice';
 LIFE.forEach(k=>x.lifelines[k]=clamp(o.lifelines?.[k]??x.lifelines[k],0,5));
 return x;
};
let draft=normalize(getJson(DRAFT_KEY,null));
let tab='create',selected=0,loadedId='',savePending=false,draftTimer=null;
const ready=q=>!!q.prompt.trim()&&q.choices.every(x=>!!x.trim())&&KEYS.includes(q.correct);
const readyCount=()=>draft.questions.slice(0,draft.count).filter(ready).length;
const questionNeeds=q=>{const needed=[];if(!q.prompt.trim())needed.push('question prompt');KEYS.forEach((k,i)=>{if(!q.choices[i].trim())needed.push('answer '+k)});return needed};
const questionNote=q=>{const needed=questionNeeds(q);return needed.length?'IN PROGRESS · Add '+needed.join(' · '):'READY FOR CLASS · All four answers included'};
const listGames=()=>{const items=getJson(GAME_KEY,[]);return Array.isArray(items)?items.filter(x=>x&&typeof x.id==='string').slice(0,80):[]};
const persistDraft=()=>{
 localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));
};
const queueDraft=()=>{clearTimeout(draftTimer);draftTimer=setTimeout(persistDraft,420)};
const syncEngine=()=>{
 if(typeof millionDraft==='undefined')return;
 millionDraft.pilot=draft.pilot;millionDraft.pilotMode=draft.pilotMode;millionDraft.risk=draft.risk;
 millionDraft.lifelines=JSON.parse(JSON.stringify(draft.lifelines));
};
const redraw=()=>{syncEngine();if(typeof renderActivities==='function')renderActivities()};
const money=n=>Number(n).toLocaleString('en-US')+' PTS';
const selectedQuestion=()=>draft.questions[selected];
const controls=()=>{
 let options='';
 if(typeof connectedStudents==='function')options=connectedStudents().map(s=>'<option value="'+esc(s.n)+'"'+(draft.pilot===s.n?' selected':'')+'>'+esc(s.n)+'</option>').join('');
 return '<section class="ms-settings"><div class="ms-block-head"><span>02 · GAME SETTINGS</span><small>Saved with your game</small></div>'+
 '<div class="ms-settings-grid"><label>Starting pilot<select id="msPilot"><option value="">First connected student</option>'+options+'</select></label>'+
 '<label>Pilot turns<select id="msPilotMode"><option value="rotate"'+(draft.pilotMode==='rotate'?' selected':'')+'>Rotate each question</option><option value="individual"'+(draft.pilotMode==='individual'?' selected':'')+'>Keep same pilot</option></select></label>'+
 '<label>Wrong answer rule<select id="msRisk"><option value="practice"'+(draft.risk==='practice'?' selected':'')+'>Practice · continue</option><option value="friendly"'+(draft.risk==='friendly'?' selected':'')+'>Friendly · stop</option><option value="classic"'+(draft.risk==='classic'?' selected':'')+'>Classic · checkpoint</option></select></label></div>'+
 '<div class="ms-life-grid">'+LIFE.map((k,i)=>'<label><span>'+LABELS[i]+'</span><input type="number" min="0" max="5" data-ms-life="'+k+'" value="'+Number(draft.lifelines[k])+'"></label>').join('')+'</div></section>';
};
const cardMarkup=()=>{
 const q=selectedQuestion(),current=selected+1;
 const completed=readyCount();
 const preview='<aside class="ms-preview"><div class="ms-block-head"><span>LIVE SLIDE PREVIEW</span><small>Teacher view only</small></div>'+
 '<div class="ms-preview-panel"><div class="ms-preview-top"><span>◆ MILLION</span><span>QUESTION '+String(current).padStart(2,'0')+' / '+draft.count+'</span></div>'+
 '<div class="ms-preview-prompt">'+esc(q.prompt||'Your question appears here')+'</div>'+
 '<div class="ms-preview-choices">'+q.choices.map((choice,i)=>'<div class="'+(q.correct===KEYS[i]?'answer':'')+'"><b>'+KEYS[i]+'</b> '+esc(choice||'Answer '+KEYS[i])+'</div>').join('')+'</div>'+
 '<small>Answer key is only visible in this editor and teacher controls.</small></div>'+
 '<div class="ms-progress-block"><span>'+completed+' of '+draft.count+' ready</span><div><i style="width:'+(completed/draft.count*100)+'%"></i></div></div>'+
 '<p class="ms-note">The '+draft.count+' question slides and point milestones are already built. Fill them in and save one complete game.</p></aside>';
 return '<div class="ms-workspace"><nav class="ms-slide-rail" aria-label="Question slides"><div class="ms-block-head"><span>QUESTION SLIDES</span><small>'+completed+'/'+draft.count+' READY</small></div>'+
 draft.questions.slice(0,draft.count).map((item,i)=>'<button type="button" class="ms-slide '+(i===selected?'active ':'')+(ready(item)?'done':'')+'" data-ms-slide="'+i+'" aria-current="'+(i===selected?'step':'false')+'"><span>Q'+String(i+1).padStart(2,'0')+'</span><span>'+money(ladder(draft.count)[i])+'</span><b>'+ (ready(item)?'✓':'○')+'</b></button>').join('')+
 '</nav><div class="ms-question-editor"><div class="ms-block-head"><span>01 · QUESTION '+String(current).padStart(2,'0')+'</span><small>'+money(ladder(draft.count)[selected])+' MILESTONE</small></div>'+
 '<div id="msQuestionCheck" class="ms-question-check" data-complete="'+ready(q)+'" role="status" aria-live="polite">'+esc(questionNote(q))+'</div>'+
 '<label>Question prompt<textarea id="msPrompt" maxlength="260" rows="3" placeholder="Type your question…">'+esc(q.prompt)+'</textarea></label>'+
 '<div class="ms-answer-grid">'+KEYS.map((k,i)=>'<label><span class="ms-answer-letter">'+k+'</span><input data-ms-answer="'+i+'" maxlength="120" value="'+esc(q.choices[i])+'" placeholder="Answer option '+k+'"></label>').join('')+'</div>'+
 '<label>Correct answer<select id="msCorrect">'+KEYS.map(k=>'<option value="'+k+'"'+(q.correct===k?' selected':'')+'>'+k+' — Answer '+k+'</option>').join('')+'</select></label>'+
 '<label>Mothership clue (optional)<input id="msClue" maxlength="240" value="'+esc(q.mothershipClue)+'" placeholder="A hint revealed by the Clue lifeline"></label>'+
 '<label>Answer explanation (optional)<textarea id="msExplanation" maxlength="320" rows="2" placeholder="Private teacher note">'+esc(q.explanation)+'</textarea></label>'+
 '<div class="ms-editor-actions"><button id="msPrev"'+(!selected?' disabled':'')+'>← Previous</button><button id="msNext"'+(selected===draft.count-1?' disabled':'')+'>Next Question →</button><button id="msNextIncomplete"'+(completed===draft.count?' disabled':'')+'>◎ Find Next Incomplete</button></div></div>'+preview+'</div>';
};
const libraryMarkup=()=>{
 const games=listGames();
 return '<div class="ms-library"><div class="ms-block-head"><span>SAVED GAME LIBRARY</span><small>'+games.length+' games</small></div>'+
 (games.length?'<div class="ms-saved-grid">'+games.map(game=>{
  const g=normalize(game.data);
  return '<article class="ms-saved-game"><span>◆ SAVED MISSION</span><h3>'+esc(g.name||'Untitled')+'</h3><p>'+g.count+' question slides · '+(g.risk==='classic'?'Classic risk':g.risk==='friendly'?'Friendly':'Practice')+'</p><small>'+esc(new Date(game.updatedAt||Date.now()).toLocaleDateString())+'</small><div><button data-ms-load="'+esc(game.id)+'">Edit / Load</button><button data-ms-delete="'+esc(game.id)+'">Delete</button></div></article>';
 }).join('')+'</div>':'<div class="ms-empty"><strong>No saved games yet</strong><p>Create a game with pre-labeled questions and save it here. Games remain after Reset Session.</p><button id="msLibraryStart">Create a Game →</button></div>')+'</div>';
};
function ladder(count){
 if(count===15)return LADDER.slice();
 const indexes=count===5?[0,3,7,11,14]:[0,1,2,3,4,6,8,10,12,14];
 return indexes.map(i=>LADDER[i]);
}
function questions(){
 const items=draft.questions.slice(0,draft.count);
 if(readyCount()!==draft.count){
  const first=items.findIndex(q=>!ready(q));
  selected=Math.max(0,first);tab='create';
  toast('Finish question '+(selected+1)+' before loading the game.');
  redraw();return [];
 }
 return items.map(q=>({prompt:q.prompt.trim(),choices:KEYS.map((key,i)=>({key,text:q.choices[i].trim()})),
  correct:q.correct,mothershipClue:q.mothershipClue.trim(),explanation:q.explanation.trim()}));
}
function markup(){
 if(document.body.classList.contains('role-student')||document.body.classList.contains('role-shared'))return '';
 selected=Math.min(selected,draft.count-1);
 return '<div class="ms-studio"><header class="ms-hero"><div><span class="ms-eyebrow">MOTHERSHIP · GAME SHOW STUDIO</span><h2>MILLION <em>STUDIO</em></h2><p>Pre-built question slides. One complete game. Ready whenever your crew is.</p></div><div class="ms-hero-mark"><strong>1,000,000</strong><span>FINAL MILESTONE</span></div></header>'+
 '<div class="ms-tabs"><button data-ms-tab="create" class="'+(tab==='create'?'active':'')+'">✦ Create Game</button><button data-ms-tab="library" class="'+(tab==='library'?'active':'')+'">▤ Game Library <span>'+listGames().length+'</span></button></div>'+
 (tab==='library'?libraryMarkup():'<div class="ms-game-meta"><label>GAME NAME<input id="msName" maxlength="100" placeholder="e.g. Social Skills Challenge" value="'+esc(draft.name)+'"></label><label>GAME LENGTH<select id="msCount">'+[5,10,15].map(n=>'<option value="'+n+'"'+(draft.count===n?' selected':'')+'>'+n+' Question Game</option>').join('')+'</select></label><div class="ms-draft-actions"><button id="msFresh">＋ New Blank Game</button><button id="msSample">Load Example</button></div></div>'+cardMarkup()+controls()+
 '<footer class="ms-footer"><div class="ms-save-state" id="msSaveStatus">'+(loadedId?'Editing saved game':'Unsaved game')+' · '+readyCount()+'/'+draft.count+' complete</div><div class="ms-footer-buttons"><button id="msSaveNew">Save as New</button><button class="ms-save-primary" id="msSaveGame"'+(savePending?' disabled':'')+'>'+ (loadedId?'Update Saved Game':'Save Complete Game')+'</button><button class="ms-launch" id="msLaunch">▶ LOAD GAME</button></div></footer>')+'</div>';
}
async function save(asNew){
 if(savePending)return;
 const prepared=questions();if(!prepared.length)return;
 if(!draft.name.trim()){toast('Name your game before saving');document.querySelector('#msName')?.focus();return}
 savePending=true;document.querySelector('#msSaveStatus').textContent='Saving to Mothership…';
 try{
  const list=listGames(),identity=(!asNew&&loadedId)||id(),stamp=Date.now();
  const entry={id:identity,updatedAt:stamp,data:normalize(draft)};
  const updated=[entry,...list.filter(g=>g.id!==identity)].slice(0,80);
  const value=JSON.stringify(updated);
  const resp=await fetch('/api/storage',{method:'POST',headers:{'Content-Type':'application/json'},
   credentials:'same-origin',body:JSON.stringify({key:GAME_KEY,value})});
  if(!resp.ok)throw new Error(resp.status===401?'Teacher sign-in required':'Server returned '+resp.status);
  localStorage.setItem(GAME_KEY,value);loadedId=identity;
  persistDraft();toast('MILLION game saved to your Game Library');redraw();
 }catch(err){const b=document.querySelector('#msSaveStatus');if(b)b.textContent='Save failed · '+String(err.message||err);toast('Could not save game: '+String(err.message||err))}
 finally{savePending=false}
}
function wire(){
 const root=document.querySelector('.ms-studio');if(!root)return;
 const on=(sel,event,cb)=>root.querySelector(sel)?.addEventListener(event,cb);
 root.querySelectorAll('[data-ms-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.msTab;redraw()});
 root.querySelectorAll('[data-ms-slide]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.msSlide);redraw()});
 on('#msName','input',e=>{draft.name=e.target.value;queueDraft()});
 on('#msCount','change',e=>{draft.count=Number(e.target.value);selected=Math.min(selected,draft.count-1);persistDraft();redraw()});
 on('#msPrompt','input',e=>{selectedQuestion().prompt=e.target.value;queueDraft();updateStatus()});
 root.querySelectorAll('[data-ms-answer]').forEach(el=>el.oninput=e=>{selectedQuestion().choices[Number(el.dataset.msAnswer)]=e.target.value;queueDraft();updateStatus()});
 on('#msCorrect','change',e=>{selectedQuestion().correct=e.target.value;queueDraft();updateStatus()});
 on('#msClue','input',e=>{selectedQuestion().mothershipClue=e.target.value;queueDraft()});
 on('#msExplanation','input',e=>{selectedQuestion().explanation=e.target.value;queueDraft()});
 on('#msPrev','click',()=>{selected--;redraw()});
 on('#msNext','click',()=>{selected++;redraw()});
 on('#msNextIncomplete','click',()=>{
  const missing=draft.questions.slice(0,draft.count).map((q,i)=>ready(q)?-1:i).filter(i=>i>=0);
  if(!missing.length)return;
  selected=missing.find(i=>i>selected)??missing[0];
  redraw();document.querySelector('#msPrompt')?.focus({preventScroll:true});
 });
 on('#msPilot','change',e=>{draft.pilot=e.target.value;syncEngine();queueDraft()});
 on('#msPilotMode','change',e=>{draft.pilotMode=e.target.value;syncEngine();queueDraft()});
 on('#msRisk','change',e=>{draft.risk=e.target.value;syncEngine();queueDraft()});
 root.querySelectorAll('[data-ms-life]').forEach(el=>el.oninput=e=>{draft.lifelines[el.dataset.msLife]=clamp(e.target.value,0,5);syncEngine();queueDraft()});
 on('#msSaveGame','click',()=>save(false));on('#msSaveNew','click',()=>save(true));
 on('#msLaunch','click',()=>{persistDraft();syncEngine();if(typeof launchMillion==='function')launchMillion()});
 on('#msFresh','click',()=>{if(readyCount()>0&&!confirm('Start a new blank game? Your last draft will be replaced; saved games remain.'))return;draft=fresh();loadedId='';selected=0;tab='create';persistDraft();redraw()});
 on('#msSample','click',()=>{
  if(readyCount()>0&&!confirm('Replace this draft with example questions?'))return;
  const parsed=typeof parseMillionQuestions==='function'?parseMillionQuestions(MILLION_SAMPLE_TEXT):[];
  draft=fresh();draft.name='Sample Mission';
  if(!parsed.length){toast('No examples available');return}
  for(let i=0;i<5;i++){const q=parsed[i%parsed.length];draft.questions[i]={prompt:q.prompt,choices:q.choices.map(c=>c.text),correct:q.correct,mothershipClue:q.mothershipClue||'',explanation:q.explanation||''}}
  draft.count=5;
  loadedId='';selected=0;persistDraft();redraw()
 });
 on('#msLibraryStart','click',()=>{tab='create';redraw()});
 root.querySelectorAll('[data-ms-load]').forEach(b=>b.onclick=()=>{
  const g=listGames().find(x=>x.id===b.dataset.msLoad);if(!g)return;
  draft=normalize(g.data);loadedId=g.id;selected=0;tab='create';persistDraft();redraw();toast('Game loaded · ready to edit or launch')
 });
 root.querySelectorAll('[data-ms-delete]').forEach(b=>b.onclick=async()=>{
  const g=listGames().find(x=>x.id===b.dataset.msDelete);if(!g||!confirm('Delete '+(g.data?.name||'this game')+' from the Game Library?'))return;
  try{
   const value=JSON.stringify(listGames().filter(x=>x.id!==g.id));
   const res=await fetch('/api/storage',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({key:GAME_KEY,value})});
   if(!res.ok)throw Error('Server rejected deletion');
   localStorage.setItem(GAME_KEY,value);if(loadedId===g.id)loadedId='';redraw()
  }catch(e){toast('Game could not be deleted: '+e.message)}
 });
}
function updateStatus(){
 const count=readyCount(),s=document.querySelector('.ms-save-state');if(s)s.textContent=(loadedId?'Editing saved game':'Unsaved game')+' · '+count+'/'+draft.count+' complete';
 const q=selectedQuestion(),preview=document.querySelector('.ms-preview-prompt');
 if(preview)preview.textContent=q.prompt||'Your question appears here';
 const check=document.querySelector('#msQuestionCheck');if(check){
  const note=questionNote(q);
  if(check.textContent!==note)check.textContent=note;
  check.dataset.complete=String(ready(q));
 }
 const jump=document.querySelector('#msNextIncomplete');
 if(jump)jump.disabled=count===draft.count;
 const railCount=document.querySelector('.ms-slide-rail .ms-block-head small');
 if(railCount)railCount.textContent=count+'/'+draft.count+' READY';
 document.querySelectorAll('.ms-preview-choices > div').forEach((node,i)=>{
  node.classList.toggle('answer',q.correct===KEYS[i]);node.textContent='';
  const b=document.createElement('b');b.textContent=KEYS[i];node.append(b,document.createTextNode(' '+(q.choices[i]||'Answer '+KEYS[i])));
 });
 const progress=document.querySelector('.ms-progress-block');if(progress){progress.querySelector('span').textContent=count+' of '+draft.count+' ready';progress.querySelector('i').style.width=(count/draft.count*100)+'%'}
 const active=document.querySelector('.ms-slide.active');if(active){active.classList.toggle('done',ready(q));active.lastElementChild.textContent=ready(q)?'✓':'○'}
}
/* Read-only turn cues: the native game owns every answer, lock and reveal. */
function millionTurnCue(){
 const role=new URLSearchParams(location.search).get('role');
 if(!['student','teacher'].includes(role))return;
 let host=null,watcher=null;
 function update(){
  const r=typeof state!=='undefined'&&!state.ended?state.activityRun:null;
  const parent=document.querySelector(role==='teacher'?'#activityControllerPanel':'#studentContent');
  const game=parent?.querySelector(role==='teacher'?'.million-teacher-grid':'.million-student');
  if(!r||r.activityId!=='million-game'||r.phase!=='running'||!game){
   parent?.querySelector('#msMillionTurnCue')?.remove();return;
  }
  const m=r.million||{},pilot=role==='teacher'||typeof selectedStudent==='function'&&m.pilot===selectedStudent()?.n;
  const selected=pilot?m.selectedAnswer:m.crewPredictions?.[selectedStudent()?.n]||'';
  let phase='choose',title='CHOOSE AN ANSWER',message=pilot?'Select A, B, C, or D before locking.':'Choose your private prediction.';
  if(selected){phase='selected';title=pilot?'ANSWER '+selected+' SELECTED':'PREDICTION '+selected+' SENT';message=pilot?'Review your selection, then lock it when ready.':'Your prediction is private.'}
  if(m.lockedAnswer){phase='locked';title='FINAL ANSWER LOCKED';message='Waiting for the teacher to reveal the answer.'}
  if(m.revealed){phase=m.result==='correct'?'correct':'wrong';title=m.result==='correct'?'POINTS EARNED':'ANSWER REVEALED';message=m.complete?'Million complete!':m.over?'Run complete.':'Review the answer. The teacher will start the next question.'}
  let cue=game.querySelector('#msMillionTurnCue');
  if(!cue){
   cue=document.createElement('div');cue.id='msMillionTurnCue';
   cue.className='ms-million-turn-cue';cue.setAttribute('role','status');
   cue.setAttribute('aria-live','polite');
   const h=document.createElement('strong'),d=document.createElement('span');
   cue.append(h,d);
   if(role==='student')game.querySelector('.million-student-choices')?.after(cue);
   if(!cue.isConnected)game.prepend(cue);
  }
  cue.dataset.phase=phase;
  cue.dataset.question=String((Number(m.questionIndex)||0)+1);
  if(cue.firstElementChild.textContent!==title)cue.firstElementChild.textContent=title;
  if(cue.lastElementChild.textContent!==message)cue.lastElementChild.textContent=message;
  if(role==='student')game.querySelectorAll('[data-million-choice]').forEach(button=>{
   const pressed=selected===button.dataset.millionChoice;
   if(button.getAttribute('aria-pressed')!==String(pressed))button.setAttribute('aria-pressed',String(pressed));
  });
 }
 function start(){
  const find=()=>{
   const next=document.querySelector(role==='teacher'?'#activityControllerPanel':'#studentContent');
   if(next&&next!==host){
    watcher?.disconnect();host=next;
    watcher=new MutationObserver(()=>requestAnimationFrame(update));
    watcher.observe(host,{childList:true,subtree:true});
   }
   update();
  };
  find();setInterval(find,1200);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
millionTurnCue();

/* One-shot stage cues live OUTSIDE the re-rendered projector markup.
   Only shared screen sees this: no teacher keys, save data or synchronized state changes. */
function installMillionStageCues(){
 if(new URLSearchParams(location.search).get('role')!=='shared')return;
 let lastKey='',cue=null,hideHandle=0,framePending=false;
 function ensureCue(){
  if(cue?.isConnected)return cue;
  cue=document.createElement('div');
  cue.id='msMillionStageCue';
  cue.className='ms-million-cue';
  cue.setAttribute('role','status');
  cue.setAttribute('aria-live','polite');
  cue.setAttribute('aria-atomic','true');
  cue.setAttribute('aria-hidden','true');
  document.body.appendChild(cue);
  return cue;
 }
 function clearCue(){
  if(cue){cue.classList.remove('visible');cue.setAttribute('aria-hidden','true')}
  window.clearTimeout(hideHandle);
 }
 function sync(){
  framePending=false;
  const run=typeof state==='undefined'?null:state.activityRun;
  const stage=document.querySelector('.million-public');
  if(!stage||!run||run.activityId!=='million-game'||run.phase!=='running'){
   clearCue();lastKey='';return
  }
  const m=run.million||{},cfg=run.millionConfig||{};
  const q=Math.max(0,Number(m.questionIndex)||0);
  const questionTotal=Array.isArray(cfg.questions)?cfg.questions.length:0;
  const finalQuestion=questionTotal>0&&q===questionTotal-1;
  const stageName=m.revealed?(m.complete?'complete':m.result==='correct'?'correct':'wrong'):(m.lockedAnswer?'locked':'question');
  const key=String(run.runToken||'')+':'+q+':'+stageName;
  if(lastKey===key)return;
  lastKey=key;
  const ladder=Array.isArray(cfg.ladder)?cfg.ladder:[];
  const prize=Number(ladder[Math.max(0,Math.min(ladder.length-1,Number(m.ladderLevel||0)-1))]||0);
  let headline='',detail='',duration=0;
  if(stageName==='question'){
   headline=finalQuestion?'THE FINAL QUESTION':'NEW QUESTION';
   detail=finalQuestion?'FINAL QUESTION · '+Number(ladder[q]||0).toLocaleString('en-US')+' POINTS AT STAKE':
    'QUESTION '+(q+1)+' OF '+(cfg.questions?.length||15);
   duration=finalQuestion?1850:950;
  }
  if(stageName==='locked'){headline='FINAL ANSWER LOCKED';detail='MISSION CONTROL · REVEAL PENDING';duration=1650}
  if(stageName==='correct'){headline='SIGNAL CONFIRMED';detail='POINTS EARNED: '+prize.toLocaleString('en-US')+' PTS';duration=2050}
  if(stageName==='wrong'){headline='SIGNAL LOST';detail=m.over?'RUN COMPLETE':'ANSWER REVEALED';duration=2000}
  if(stageName==='complete'){headline='MILLION COMPLETE';detail='FINAL SCORE: '+Number(ladder.at(-1)||1000000).toLocaleString('en-US')+' POINTS';duration=2800}
  const node=ensureCue();
  node.className='ms-million-cue '+stageName+(finalQuestion?' is-final-question':'');
  // A purely decorative one-shot stage crest; the already announced title,
  // prize and state still come exclusively from the native game run.
  const crest=document.createElement('div');
  crest.className='ms-million-cue-crest';
  crest.setAttribute('aria-hidden','true');
  crest.textContent=stageName==='complete'?'🏆':
    stageName==='correct'?'✦':stageName==='wrong'?'◇':
    stageName==='locked'?'◆':'✧';
  const sparkle=document.createElement('div');
  sparkle.className='ms-million-cue-sparkles';
  sparkle.setAttribute('aria-hidden','true');
  sparkle.textContent='✦   ✧   ✦   ✧   ✦';
  const title=document.createElement('strong');title.textContent=headline;
  const sub=document.createElement('span');sub.textContent=detail;
  // Purely presentational beats: no countdown, result delay, answer key, or
  // gameplay mutation. Cue classes follow public synchronized game state.
  const sequence=document.createElement('div');
  sequence.className='ms-million-cue-sequence';
  sequence.setAttribute('aria-hidden','true');
  for(let i=0;i<5;i++){
   const beat=document.createElement('i');
   sequence.appendChild(beat);
  }
  const footer=document.createElement('div');
  footer.className='ms-million-cue-footer';
  footer.setAttribute('aria-hidden','true');
  footer.textContent=stageName==='locked'?'THE ANSWER IS IN…':
   stageName==='correct'?'THE POINT LADDER ADVANCES':
   stageName==='wrong'?(m.over?'THIS RUN HAS ENDED':'REVIEW THE REVEAL'):
   stageName==='complete'?'THE GRAND FINALE':finalQuestion?'THE LAST QUESTION · MAKE IT COUNT':'THE STAGE IS YOURS';
  node.dataset.phase=stageName;
  node.replaceChildren(sparkle,crest,title,sub,sequence,footer);
  node.classList.remove('visible');
  // Browser presentation frames start a new visual cue only on a real game-state transition.
  void node.offsetWidth;
  node.classList.add('visible');node.setAttribute('aria-hidden','false');
  window.clearTimeout(hideHandle);
  hideHandle=window.setTimeout(clearCue,duration);
 }
 function queue(){
  if(framePending)return;
  framePending=true;
  window.requestAnimationFrame(sync);
 }
 if(document.body){
  new MutationObserver(queue).observe(document.body,{subtree:true,childList:true});
  window.setInterval(queue,340);
  queue();
 }
}
installMillionStageCues();

/* Phase 3H · decorative, state-driven lifeline spotlights. Never mutates
   gameplay, answer keys, inventory, checkpoints, or stored sessions. */
function installMillionLifelineCues(){
 if(new URLSearchParams(location.search).get('role')!=='shared')return;
 const labels={
  reduce:['50/50 ACTIVATED','TWO SIGNALS ELIMINATED','◈'],
  poll:['CREW POLL ACTIVATED','THE CREW HAS SPOKEN','◉'],
  clue:['MOTHERSHIP CLUE','A NEW HINT IS AVAILABLE','✧'],
  tryAgain:['SECOND CHANCE','ONE MORE OPPORTUNITY','↺']
 };
 let lastQuestion='',lastInventory=null,lastRemoved=0,shown=null,timeout=0,pending=false;
 function clear(){
  clearTimeout(timeout);
  if(shown){shown.classList.remove('is-visible');shown.setAttribute('aria-hidden','true')}
 }
 function show(kind){
  const data=labels[kind];
  if(!data)return;
  if(!shown?.isConnected){
   shown=document.createElement('div');
   shown.id='msMillionLifelineCue';shown.className='ms-million-lifeline-cue';
   shown.setAttribute('role','status');shown.setAttribute('aria-live','polite');
   shown.setAttribute('aria-atomic','true');shown.setAttribute('aria-hidden','true');
   document.body.append(shown);
  }
  shown.dataset.lifeline=kind;
  const ring=document.createElement('span');
  ring.className='ms-million-lifeline-ring';ring.setAttribute('aria-hidden','true');ring.textContent=data[2];
  const words=document.createElement('span');words.className='ms-million-lifeline-copy';
  const title=document.createElement('strong');title.textContent=data[0];
  const subtitle=document.createElement('small');subtitle.textContent=data[1];
  words.append(title,subtitle);
  const beats=document.createElement('span');beats.className='ms-million-lifeline-beats';
  beats.setAttribute('aria-hidden','true');
  for(let i=0;i<4;i++)beats.append(document.createElement('i'));
  shown.replaceChildren(ring,words,beats);
  shown.classList.remove('is-visible');void shown.offsetWidth;
  shown.classList.add('is-visible');shown.setAttribute('aria-hidden','false');
  clearTimeout(timeout);timeout=setTimeout(clear,1950);
 }
 function sync(){
  pending=false;
  const run=typeof state==='undefined'?null:state.activityRun;
  if(!run||run.activityId!=='million-game'||run.phase!=='running'||
    !document.querySelector('.million-public.big')){
   clear();lastQuestion='';lastInventory=null;lastRemoved=0;return;
  }
  const m=run.million||{},question=String(run.runToken||'')+':'+String(m.questionIndex||0);
  const inventory={};
  for(const key of Object.keys(labels))inventory[key]=Math.max(0,Number(m.inventory?.[key]||0));
  const removed=Array.isArray(m.eliminated)?m.eliminated.length:0;
  if(question!==lastQuestion){
   clear();lastQuestion=question;lastInventory=inventory;lastRemoved=removed;return;
  }
  if(lastInventory){
   let used=null;
   if(removed>=2&&lastRemoved<2)used='reduce';
   else for(const key of ['reduce','poll','clue','tryAgain']){
    if(inventory[key]<lastInventory[key]){used=key;break}
   }
   if(used)show(used);
  }
  lastInventory=inventory;lastRemoved=removed;
 }
 function queue(){if(pending)return;pending=true;requestAnimationFrame(sync)}
 function start(){
  if(!document.body)return;
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(queue,420);queue();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
}
installMillionLifelineCues();


/* Phase 3F · public show HUD. Pure read-only decorations derived from the
   synchronized game model. No state mutations, private answer keys or timers. */
function installMillionShowHUD(){
 const role=new URLSearchParams(location.search).get('role');
 if(!['shared','student'].includes(role))return;
 let queued=false,lastQuestionKey='',questionEntranceUntil=0;
 const money=value=>Math.max(0,Number(value)||0).toLocaleString('en-US')+' PTS';
 const setText=(element,value)=>{
  if(element&&element.textContent!==value)element.textContent=value;
 };
 const make=(cls,children)=>{
  const node=document.createElement('div');
  node.className=cls;
  for(const [tag,name] of children){
   const el=document.createElement(tag);
   el.className=name;
   node.appendChild(el);
  }
  return node;
 };
 function update(){
  queued=false;
  const run=typeof state!=='undefined'&&!state.ended?state.activityRun:null;
  if(!run||run.activityId!=='million-game'||run.phase!=='running'){
   lastQuestionKey='';questionEntranceUntil=0;return;
  }
  const m=run.million||{},cfg=run.millionConfig||{};
  const ladder=Array.isArray(cfg.ladder)?cfg.ladder:[];
  const total=Array.isArray(cfg.questions)?cfg.questions.length:0;
  if(!total||!ladder.length)return;
  const q=Math.max(0,Math.min(total-1,Number(m.questionIndex)||0));
  const earned=Math.max(0,Math.min(ladder.length,Number(m.ladderLevel)||0));
  const complete=!!(m.complete||m.over);
  const finalQuestion=!complete&&q===total-1;
  // Visual entrance is tied to the synchronized question number, never a
  // countdown or any gate on answering. It expires even without a rerender.
  const key=String(run.runToken||'')+':'+q;
  if(key!==lastQuestionKey){lastQuestionKey=key;questionEntranceUntil=Date.now()+850}
  const entering=Date.now()<questionEntranceUntil&&!complete;
  if(role==='shared'){
   const board=document.querySelector('.million-public.big');
   const stage=board?.querySelector('.million-stage');
   const prizeSide=board?.querySelector('.million-ladder');
   if(!stage||!prizeSide)return;
   const f=finalQuestion?'true':'false';
   if(board.dataset.msFinalQuestion!==f)board.dataset.msFinalQuestion=f;
   const entrance=entering?'true':'false';
   if(board.dataset.msEntering!==entrance)board.dataset.msEntering=entrance;
   const step=m.revealed?'revealed':m.lockedAnswer?'locked':'ready';
   if(board.dataset.msRevealStep!==step)board.dataset.msRevealStep=step;
   let band=stage.querySelector(':scope > .ms-million-question-band');
   if(!band){
    band=make('ms-million-question-band',[
     ['span','ms-million-question-number'],['strong','ms-million-question-prize']]);
    band.setAttribute('aria-label','MILLION question and points at stake');
    const question=stage.querySelector('h3');
    if(question)question.before(band);else stage.prepend(band);
   }
   setText(band.firstElementChild,'QUESTION '+String(q+1).padStart(2,'0')+' / '+String(total).padStart(2,'0'));
   setText(band.lastElementChild,complete?'ROUND COMPLETE':finalQuestion?
    '★ FINAL QUESTION · '+money(ladder[q]):'ON THE LINE · '+money(ladder[Math.min(q,ladder.length-1)]));
   band.classList.toggle('is-final',finalQuestion);
   let track=prizeSide.querySelector(':scope > .ms-million-ladder-progress');
   if(!track){
    track=make('ms-million-ladder-progress',[
     ['div','ms-million-progress-head'],['div','ms-million-progress-track']]);
    track.setAttribute('aria-label','MILLION point ladder progress');
    const [head,rail]=track.children;
    head.appendChild(document.createElement('span'));
    head.appendChild(document.createElement('strong'));
    const fill=document.createElement('i');fill.className='ms-million-progress-fill';rail.append(fill);
    prizeSide.append(track);
   }
   const [head,rail]=track.children;
   setText(head.firstElementChild,'POINT LADDER');
   setText(head.lastElementChild,earned+' / '+ladder.length+' SECURED');
   const percentage=(earned/ladder.length*100).toFixed(2)+'%';
   if(rail.firstElementChild.style.width!==percentage)rail.firstElementChild.style.width=percentage;
   if(track.dataset.msComplete!==(complete?'true':'false'))track.dataset.msComplete=complete?'true':'false';
  }else{
   const student=document.querySelector('#studentContent .million-student');
   if(!student)return;
   const entrance=entering?'true':'false';
   if(student.dataset.msEntering!==entrance)student.dataset.msEntering=entrance;
   const step=m.revealed?'revealed':m.lockedAnswer?'locked':'ready';
   if(student.dataset.msRevealStep!==step)student.dataset.msRevealStep=step;
   let ribbon=student.querySelector(':scope > .ms-million-student-ribbon');
   if(!ribbon){
    ribbon=make('ms-million-student-ribbon',[
     ['span','ms-million-student-question'],['strong','ms-million-student-stake'],['small','ms-million-student-lives']]);
    ribbon.setAttribute('aria-label','MILLION question, points and crew lifelines');
    const points=document.createElement('div');
    points.className='ms-million-student-points';
    points.setAttribute('aria-label','Point ladder progress');
    const copy=document.createElement('strong');copy.className='ms-million-student-points-label';
    const rail=document.createElement('span');rail.className='ms-million-student-points-track';
    rail.setAttribute('role','progressbar');
    rail.setAttribute('aria-label','Questions secured');
    rail.setAttribute('aria-valuemin','0');
    const fill=document.createElement('i');fill.className='ms-million-student-points-fill';
    rail.append(fill);points.append(copy,rail);ribbon.append(points);
    const heading=student.querySelector('h2');
    if(heading)heading.before(ribbon);else student.prepend(ribbon);
   }
   setText(ribbon.children[0],'QUESTION '+(q+1)+' / '+total);
   setText(ribbon.children[1],complete?'MILLION ROUND COMPLETE':finalQuestion?
    '★ FINAL QUESTION · '+money(ladder[q]):'PLAYING FOR '+money(ladder[Math.min(q,ladder.length-1)]));
   const available=Object.entries(m.inventory||{}).reduce((n,[key,value])=>
    ['poll','reduce','clue','tryAgain'].includes(key)?n+Math.max(0,Number(value)||0):n,0);
   setText(ribbon.children[2],available+' CREW LIFELINE'+(available===1?'':'S')+' LEFT');
   const points=ribbon.querySelector(':scope > .ms-million-student-points');
   if(points){
    setText(points.firstElementChild,earned+' / '+ladder.length+' POINT LEVELS SECURED');
    const track=points.querySelector('.ms-million-student-points-track');
    const fill=track?.firstElementChild;
    if(track){
     track.setAttribute('aria-valuemax',String(ladder.length));
     track.setAttribute('aria-valuenow',String(earned));
    }
    if(fill){
     const width=(earned/ladder.length*100).toFixed(2)+'%';
     if(fill.style.width!==width)fill.style.width=width;
    }
   }
   ribbon.classList.toggle('is-final',finalQuestion);
  }
 }
 function queue(){
  if(queued)return;queued=true;
  requestAnimationFrame(update);
 }
 function start(){
  if(!document.body)return;
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
  setInterval(queue,950);
  queue();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
}
installMillionShowHUD();


/* Phase 3B · read-only results stage. The native MILLION engine alone owns the
   ladder, checkpoints, outcome, current pilot and every saved classroom run.
   This view is recomputed from synced public results; never writes to state. */
function millionFinalResultsData(run){
 const m=run?.million||{},cfg=run?.millionConfig||{};
 if(run?.activityId!=='million-game'||run.phase!=='running'||(!m.complete&&!m.over))return null;
 const ladder=Array.isArray(cfg.ladder)?cfg.ladder:[];
 const level=Math.max(0,Math.min(ladder.length,Number(m.ladderLevel||0)||0));
 const amount=level?Math.max(0,Number(ladder[level-1])||0):0;
 const total=Math.max(0,Array.isArray(cfg.questions)?cfg.questions.length:0);
 const reached=Math.min(total,Math.max(0,Number(m.questionIndex||0)+1));
 return {
  complete:!!m.complete,amount,level,total,reached,
  pilot:String(m.pilot||'Command Seat').slice(0,90),
  checkpoint:cfg.risk==='classic'&&!!m.over,
  risk:cfg.risk||'practice'
 };
}
function millionFinalResultsMarkup(data,compact=false){
 const fmt=n=>Number(n).toLocaleString('en-US')+' POINTS';
 const milestone=data.checkpoint?'CHECKPOINT POINTS':data.complete?'FINAL POINTS':'POINTS EARNED';
 const title=data.complete?'MILLION COMPLETE':'MISSION RESULTS';
 const detail=data.complete?'The crew reached the final milestone.':
  data.checkpoint?(data.level===0?'Classic mode · no safe checkpoint was secured.':
   'Classic mode · returned to your last safe checkpoint.'):
  data.amount===0?'No points secured this round. The crew can try again.':
  'The crew finished this run. Review the points earned.';
 return '<section class="ms-million-final-results'+(data.complete?' is-champion':' is-finished')+
   (compact?' is-compact':'')+'" aria-label="MILLION final mission results">'+
  (data.complete?'<div class="ms-million-victory-corona" aria-hidden="true"><span>✦</span><span>★</span><span>✦</span><span>★</span><span>✦</span></div>':'')+
  '<header class="ms-million-final-header"><span class="ms-million-final-icon" aria-hidden="true">'+
   (data.complete?'🏆':'✦')+'</span><div><span class="ms-million-final-eyebrow">'+
   (data.complete?'CHAMPIONSHIP ACHIEVED':'RUN COMPLETE')+'</span>'+
   '<h3>'+title+'</h3></div></header>'+
  '<div class="ms-million-final-prize"><span>'+milestone+'</span><strong>'+
   fmt(data.amount)+'</strong></div>'+
  '<div class="ms-million-final-metrics">'+
   '<div><strong>'+data.level+' / '+data.total+'</strong><span>MILESTONES</span></div>'+
   '<div><strong>'+data.reached+' / '+data.total+'</strong><span>QUESTIONS REACHED</span></div>'+
   '</div>'+
  '<p class="ms-million-final-description">'+detail+'</p>'+
  '<p class="ms-million-final-pilot">✦ FINAL COMMAND SEAT · '+(typeof esc==='function'?esc(data.pilot):
   data.pilot.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])))+'</p>'+
  '</section>';
}
function installMillionFinalResults(){
 const role=new URLSearchParams(location.search).get('role');
 if(!['shared','teacher','student'].includes(role))return;
 let scheduled=false,lastHost=null,lastKey='';
 function renderFinal(){
  scheduled=false;
  const run=typeof state==='undefined'?null:state.activityRun;
  const data=millionFinalResultsData(run);
  const game=role==='shared'?(document.querySelector('.million-public.big .million-stage')||
   [...document.querySelectorAll('.million-public .million-stage')].find(el=>el.getClientRects().length)):
   role==='teacher'?document.querySelector('#activityControllerPanel .million-teacher-grid'):
   document.querySelector('#studentContent .million-student');
  if(!data||!game){
   if(lastHost?.isConnected)lastHost.querySelector('.ms-million-final-results')?.remove();
   lastHost=null;lastKey='';return;
  }
  const key=String(run?.runToken||'')+'|'+String(data.complete)+'|'+String(data.amount)+
   '|'+String(data.reached)+'|'+String(data.level)+'|'+String(data.total)+
   '|'+String(data.checkpoint)+'|'+String(data.risk)+'|'+data.pilot;
  if(game===lastHost&&lastKey===key&&game.querySelector('.ms-million-final-results'))return;
  game.querySelectorAll('.ms-million-final-results').forEach(el=>el.remove());
  const holder=document.createElement('div');
  holder.innerHTML=millionFinalResultsMarkup(data,role!=='shared');
  const card=holder.firstElementChild;
  if(role==='teacher'){
   game.prepend(card);
  }else if(role==='student'){
   game.append(card);
  }else{
   // Preserve the existing completion banner in DOM for old student/projector
   // integrations, while CSS puts the new final results in visual focus.
   game.append(card);
  }
  lastHost=game;lastKey=key;
 }
 function queue(){
  if(scheduled)return;scheduled=true;requestAnimationFrame(renderFinal);
 }
 function start(){
  if(document.body){
   new MutationObserver(queue).observe(document.body,{subtree:true,childList:true});
   setInterval(queue,950);queue();
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
}
installMillionFinalResults();

/* Phase 3G · points presentation compatibility. The native engine remains
   authoritative for ladder values, checkpoints, saves and class sync.
   User-written question text and answer choices are NEVER rewritten. */
function installMillionNativePoints(){
 const role=new URLSearchParams(location.search).get('role');
 if(!['shared','student','teacher'].includes(role))return;
 const moneyPattern=/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g;
 const protectedNodes='.million-stage h3,.million-choice,.million-teacher-choices,'+
  '.million-student-choice,.million-student-choices,.million-poll,'+
  '.million-pilot,textarea,input,select,.ms-million-final-results,'+
  '.ms-million-question-band,.ms-million-student-ribbon';
 let pending=false;
 function sync(){
  pending=false;
  const run=typeof state==='undefined'?null:state.activityRun;
  if(!run||run.activityId!=='million-game'||run.phase!=='running')return;
  const root=role==='shared'?document.querySelector('.million-public.big'):
   role==='student'?document.querySelector('#studentContent .million-student'):
   document.querySelector('#activityControllerPanel .million-teacher-grid');
  if(!root)return;
  const iter=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(iter.nextNode()){
   const t=iter.currentNode,original=t.nodeValue||'';
   moneyPattern.lastIndex=0;
   if(!moneyPattern.test(original))continue;
   const parent=t.parentElement;
   if(!parent||parent.closest(protectedNodes))continue;
   if(parent.closest('.million-ladder,.million-stakes,.million-message,'+
      '.million-complete,.million-lifelines,.million-teacher-status,'+
      '.million-student-status,.million-student-prize,.million-teacher-prize,'+
      '.million-teacher-progress,.million-student-progress'))nodes.push(t);
  }
  nodes.forEach(t=>{
   const updated=(t.nodeValue||'').replace(moneyPattern,(_,number)=>number+' PTS');
   if(updated!==t.nodeValue)t.nodeValue=updated;
  });
 }
 function queue(){if(pending)return;pending=true;requestAnimationFrame(sync)}
 function start(){
  if(!document.body)return;
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(queue,950);queue();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
}
installMillionNativePoints();

syncEngine();
window.MillionStudio={markup,wire,questions,ladder,checkpoints:n=>n===5?[3]:n===10?[5]:[5,10],
 currentName:()=>draft.name||'MILLION',inspection:()=>({count:draft.count,ready:readyCount(),saved:listGames().length,loadedId})};
if(typeof state!=='undefined'&&state.activeApp==='million'&&typeof renderActivities==='function')renderActivities();
})();