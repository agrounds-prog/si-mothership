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
const money=n=>'$'+Number(n).toLocaleString();
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
 '<p class="ms-note">The '+draft.count+' question slides and money labels are already built. Fill them in and save one complete game.</p></aside>';
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
  const stageName=m.revealed?(m.complete?'complete':m.result==='correct'?'correct':'wrong'):(m.lockedAnswer?'locked':'question');
  const key=String(run.runToken||'')+':'+q+':'+stageName;
  if(lastKey===key)return;
  lastKey=key;
  const ladder=Array.isArray(cfg.ladder)?cfg.ladder:[];
  const prize=Number(ladder[Math.max(0,Math.min(ladder.length-1,Number(m.ladderLevel||0)-1))]||0);
  let headline='',detail='',duration=0;
  if(stageName==='question'){headline='NEW QUESTION';detail='QUESTION '+(q+1)+' OF '+(cfg.questions?.length||15);duration=950}
  if(stageName==='locked'){headline='FINAL ANSWER LOCKED';detail='MISSION CONTROL · REVEAL PENDING';duration=1350}
  if(stageName==='correct'){headline='SIGNAL CONFIRMED';detail='MILESTONE REACHED: '+String.fromCharCode(36)+prize.toLocaleString('en-US');duration=2050}
  if(stageName==='wrong'){headline='SIGNAL LOST';detail=m.over?'RUN COMPLETE':'ANSWER REVEALED';duration=2000}
  if(stageName==='complete'){headline='MILLION COMPLETE';detail='FINAL MILESTONE: '+String.fromCharCode(36)+Number(ladder.at(-1)||1000000).toLocaleString('en-US');duration=2800}
  const node=ensureCue();
  node.className='ms-million-cue '+stageName;
  const title=document.createElement('strong');title.textContent=headline;
  const sub=document.createElement('span');sub.textContent=detail;
  node.replaceChildren(title,sub);
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

syncEngine();
window.MillionStudio={markup,wire,questions,ladder,checkpoints:n=>n===5?[3]:n===10?[5]:[5,10],
 currentName:()=>draft.name||'MILLION',inspection:()=>({count:draft.count,ready:readyCount(),saved:listGames().length,loadedId})};
if(typeof state!=='undefined'&&state.activeApp==='million'&&typeof renderActivities==='function')renderActivities();
})();