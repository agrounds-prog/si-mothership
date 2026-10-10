/* Board-first Bingo authoring. The existing Bingo activity runner is unchanged. */
let bbsQuery='',bbsRecent=false,bbsLibraryBusy=false;
function bbsSize(){return Math.max(3,Math.min(6,Number(bingoDraft.size||4)))}
function bbsCenter(){let n=bbsSize();return bingoDraft.free&&n%2?Math.floor(n*n/2):-1}
function bbsNeed(){return bbsSize()**2-(bbsCenter()<0?0:1)}
function bbsSelected(){return [...new Set(bingoDraft.selectedImages||[])].filter(id=>gameImageLibrary.some(a=>a.id===id))}
function bbsFilled(){return Array.from({length:bbsSize()**2},(_,i)=>i).filter(i=>i!==bbsCenter()&&
  bingoDraft.numberedSlots?.[i]?.call&&(bingoDraft.numberedSlots[i].text||bingoDraft.numberedSlots[i].image)).length}
function bbsGrid(){
  const n=bbsSize(),center=bbsCenter(),slots=bingoDraft.numberedSlots||[],editing=Number(bingoDraft.editSlot??-1);
  return '<div class="bbs-grid" style="--cols:'+n+'">'+Array.from({length:n*n},(_,i)=>{
    const s=slots[i]||{},number='<small class="bbs-tile-num">'+(i+1)+'</small>';
    if(i===center)return '<div class="bbs-tile bbs-free">'+number+'<strong>★ FREE</strong></div>';
    if(i===editing)return '<div class="bbs-tile bbs-edit">'+number+
      '<label>TYPE SQUARE '+(i+1)+'<input id="bbsTypeText" maxlength="100" value="'+esc(s.text||s.call||'')+
      '" placeholder="Enter text" aria-label="Text for square '+(i+1)+'"></label>'+
      '<div><button type="button" id="bbsTypeSave">✓ Save</button><button type="button" id="bbsTypeCancel">Cancel</button></div></div>';
    const filled=!!(s.call&&(s.text||s.image));
    return '<button type="button" class="bbs-tile '+(filled?'bbs-filled':'bbs-empty')+'" data-bbs-tile="'+i+
      '" aria-label="Square '+(i+1)+': '+(filled?esc(s.call):'empty')+'; click to type">'+number+
      (s.image?'<img src="'+s.image+'" alt="'+esc(s.label||s.call||'Picture')+'">':
        filled?'<b>'+esc(s.text||s.call)+'</b>':'<span class="bbs-plus">＋<small>TYPE</small></span>')+'</button>';
  }).join('')+'</div>';
}
function bbsLibrary(){
  const selected=new Set(bbsSelected()),need=bbsNeed(),arr=gameImageLibrary.slice().sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  const assets=(bbsRecent?arr.slice(0,48):arr).filter(a=>String(a.name||'').toLowerCase().includes(bbsQuery.trim().toLowerCase()));
  return '<section class="bbs-panel bbs-library"><div class="bbs-head"><small>STEP 1 · PICTURE LIBRARY</small><h3>SELECT YOUR PICTURES</h3>'+
    '<p>Upload to the library, check exactly '+need+' pictures, then create the full board.</p></div>'+
    '<button type="button" id="bbsUpload" class="bbs-upload">＋ Upload Pictures to Library</button>'+
    '<input type="file" id="bbsUploadInput" accept="image/*" multiple hidden>'+
    '<div class="bbs-library-tools"><div><button type="button" data-bbs-tab="all"'+(!bbsRecent?' class="active"':'')+'>SAVED</button>'+
    '<button type="button" data-bbs-tab="recent"'+(bbsRecent?' class="active"':'')+'>RECENT</button></div>'+
    '<input id="bbsSearch" type="search" placeholder="Search '+gameImageLibrary.length+' pictures" value="'+esc(bbsQuery)+'"></div>'+
    '<div class="bbs-library-grid">'+(assets.length?assets.map(a=>'<div class="bbs-library-entry"><button type="button" data-bbs-image="'+esc(a.id)+
      '" data-bbs-name="'+esc(String(a.name||'').toLowerCase())+'" class="bbs-library-image'+(selected.has(a.id)?' checked':'')+
      '" aria-pressed="'+selected.has(a.id)+'"><img src="'+a.image+'" alt=""><span>'+esc(a.name)+'</span>'+
      (selected.has(a.id)?'<b class="bbs-image-check">✓</b>':'')+'</button>'+      '<button type="button" class="bbs-library-remove" data-bbs-remove="'+esc(a.id)+      '" aria-label="Delete '+esc(a.name)+' from the image library" title="Delete picture">×</button></div>').join(''):
      '<p class="bbs-hint">No images yet. Upload images to the library first.</p>')+'</div>'+
    '<div class="bbs-picked"><strong>'+selected.size+' / '+need+' CHECKED</strong>'+
    '<button type="button" id="bbsUncheck">Clear Checks</button></div>'+
    '<button type="button" class="bbs-create" id="bbsCreate"'+(selected.size!==need?' disabled':'')+
    '>▦ CREATE '+need+'-PICTURE BOARD</button><p id="bbsLibraryStatus" class="bbs-hint">'+
    (selected.size===need?'Ready to populate all '+need+' board squares.':
      'Check '+Math.max(0,need-selected.size)+' more picture'+(need-selected.size===1?'':'s')+' to create a board.')+
    '</p></section>';
}
/* Do not report server-backed saves as complete until Railway acknowledges them. */
async function bbsConfirmRemote(key,value){
  if(typeof NETWORK_SYNC==='undefined'||!NETWORK_SYNC||SESSION_ROLE!=='teacher')return true;
  try{
    const response=await fetch('/api/storage',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({key,value:JSON.stringify(value)})});
    if(!response.ok)return false;
    const data=await response.json();return data?.ok===true;
  }catch(error){return false}
}
async function bbsSaveBoard(launch=false){
  const set=saveBingoDraft();if(!set)return;
  const confirmed=await bbsConfirmRemote(BINGO_SET_STORE,bingoSets);
  if(!confirmed){toast('Server save could not be confirmed. Your board is still available here; retry Save before refreshing.');return}
  if(launch)launchBingoSet(set);
}
function bbsSavedBoards(){
  return '<section class="bbs-panel bbs-saved"><div class="bbs-head"><small>STEP 3 · REUSABLE BOARDS</small><h3>SAVED BINGO BOARDS</h3></div>'+
    '<div class="bbs-saved-list">'+(bingoSets.length?bingoSets.map(s=>{
      const sample=(s.items||[]).filter(x=>x?.card?.type==='image').slice(0,4);
      return '<div class="bbs-saved-board"><div class="bbs-saved-art">'+
        (sample.length?sample.map(item=>'<img src="'+item.card.value+'" alt="">').join(''):'<span>▦</span>')+
        '</div><div class="bbs-saved-info"><b>'+esc(s.name)+'</b><small>'+s.size+'×'+s.size+
        ' · '+(s.items?.length||0)+' items</small></div>'+
        '<div class="bbs-saved-actions"><button type="button" data-bbs-load="'+esc(s.id)+'">Load Board</button>'+
        '<button type="button" data-bbs-launch="'+esc(s.id)+'">▶ Launch</button>'+
        '<button type="button" class="bbs-remove" data-bbs-delete="'+esc(s.id)+'">×</button></div></div>';
    }).join(''):'<p class="bbs-hint">Saved boards appear here after you press Save Board.</p>')+'</div></section>';
}
function bbsMarkup(){
  const n=bbsSize(),need=bbsNeed(),filled=bbsFilled(),isEditing=!!bingoDraft.editingSetId;
  return '<div class="bbs-studio"><div class="bbs-hero"><div class="bbs-logo">▦</div>'+
    '<div class="bbs-title"><small>MOTHERSHIP ARCADE · BINGO BOARD STUDIO</small><h2 id="bbsTitle">'+esc(bingoDraft.name||'My Bingo Board')+
    '</h2></div>'+
    '<div class="bbs-progress"><strong>'+filled+'<em> / '+need+'</em></strong><span>FILLED SQUARES</span>'+
    '<div><i style="width:'+Math.round(100*filled/Math.max(1,need))+'%"></i></div></div></div>'+
    '<div class="bbs-layout"><main class="bbs-panel bbs-board-panel"><div class="bbs-name-row">'+
    '<label>BOARD NAME<input id="bbsName" maxlength="80" value="'+esc(bingoDraft.name||'')+'" placeholder="e.g. Kitchen Tools"></label>'+
    (isEditing?'<span class="bbs-loaded">EDITING SAVED BOARD</span>':'')+'</div>'+
    '<div class="bbs-options"><label>BOARD SIZE<select id="bbsSize">'+
    [3,4,5,6].map(x=>'<option value="'+x+'"'+(n===x?' selected':'')+'>'+x+' × '+x+' ('+(x*x)+' squares)</option>').join('')+'</select></label>'+
    '<label>WIN PATTERN<select id="bbsPattern">'+
    [['line','Line'],['corners','Four Corners'],['x','X'],['blackout','Blackout']].map(x=>
    '<option value="'+x[0]+'"'+(bingoDraft.pattern===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>'+
    '<label class="bbs-check"><input type="checkbox" id="bbsFree"'+(bingoDraft.free?' checked':'')+
    (n%2===0?' disabled':'')+'> Free center</label></div>'+
    '<div class="bbs-board-heading"><div><small>STEP 2 · YOUR PHYSICAL BOARD</small><h3>BUILD YOUR BINGO BOARD</h3>'+
    '<p>Click any square to type. Or select '+need+' library images and create the entire board at once.</p></div>'+
    '<button type="button" id="bbsNewBoard">＋ New Board</button></div>'+
    '<div class="bbs-board-frame">'+bbsGrid()+'</div>'+
    '<div class="bbs-under-board"><span>Student cards randomize when launched.</span>'+
    '<button type="button" id="bbsClearBoard">Clear Squares</button></div>'+
    '<div class="bbs-save"><button type="button" id="bbsSave">'+(isEditing?'Save Board Changes':'Save Board')+'</button>'+
    '<button type="button" id="bbsSaveLaunch">▶ Save & Launch Bingo</button></div></main>'+
    '<aside class="bbs-aside">'+bbsLibrary()+bbsSavedBoards()+'</aside></div></div>';
}
function bbsPopulate(){
  const ids=bbsSelected(),need=bbsNeed(),n=bbsSize(),center=bbsCenter();
  if(ids.length!==need)return toast('Check exactly '+need+' pictures first.');
  if(bbsFilled()&&!confirm('Replace the visible board squares with '+need+' selected pictures? Saved boards are unaffected.'))return;
  const next=[],assets=ids.map(id=>gameImageLibrary.find(a=>a.id===id));
  if(assets.some(a=>!a))return toast('An image is no longer in the library.');
  for(let i=0,j=0;i<n*n;i++){
    if(i===center)continue;
    const a=assets[j++];next[i]={slot:i+1,call:String(a.name||'Picture').slice(0,100),text:'',image:a.image,label:a.name};
  }
  bingoDraft.numberedSlots=next;bingoDraft.numberedMode=true;bingoDraft.editSlot=-1;
  renderActivities();toast(need+' library pictures placed on the Bingo board. Save Board when ready.');
}
function bbsSaveTile(){
  const i=Number(bingoDraft.editSlot??-1),field=document.querySelector('#bbsTypeText');
  if(!field||i<0||i>=bbsSize()**2||i===bbsCenter())return;
  const word=String(field.value||'').trim().slice(0,100);
  if(!word)return toast('Please type text for this square.');
  const next=[...(bingoDraft.numberedSlots||[])];
  next[i]={slot:i+1,call:word,text:word,image:'',label:''};
  bingoDraft.numberedSlots=next;bingoDraft.numberedMode=true;bingoDraft.editSlot=-1;
  renderActivities();
}
function bbsLoad(id){
  const set=bingoSets.find(s=>s.id===id);
  if(!set)return toast('That saved board is unavailable.');
  bingoDraft.editingSetId=set.id;
  loadBingoSetIntoBuilder(set);
  bingoDraft.editingSetId=set.id;bingoDraft.selectedImages=[];bbsQuery='';
}
/* Only the reusable picture library changes; existing boards keep their image copies. */
async function bbsRemoveLibraryImage(id){
  if(bbsLibraryBusy)return toast('Please wait for the library update.');
  const asset=gameImageLibrary.find(a=>a.id===id);
  if(!asset)return;
  const name=String(asset.name||'Picture');
  if(!confirm('Delete "'+name+'" from the shared image library? Saved Bingo and MATCH sets keep their copies. This cannot be undone.'))return;
  bbsLibraryBusy=true;
  const button=[...document.querySelectorAll('[data-bbs-remove]')].find(b=>b.dataset.bbsRemove===id);
  if(button)button.disabled=true;
  try{
    const next=gameImageLibrary.filter(a=>a.id!==id);
    if(!(await bbsConfirmRemote(GAME_IMAGE_LIBRARY_STORE,next)))
      return toast('Server could not confirm deletion. The picture is unchanged.');
    if(!persistGameStore(GAME_IMAGE_LIBRARY_STORE,next))
      return toast('Library could not be saved. Please retry.');
    gameImageLibrary=next;
    bingoDraft.selectedImages=bbsSelected();
    if(typeof matchDraft!=='undefined'&&Array.isArray(matchDraft.selectedImages))
      matchDraft.selectedImages=matchDraft.selectedImages.filter(x=>x!==id);
    button?.closest('.bbs-library-entry')?.remove();
    const search=document.querySelector('#bbsSearch');
    if(search)search.placeholder='Search '+next.length+' pictures';
    const grid=document.querySelector('.bbs-library-grid');
    if(grid&&!grid.querySelector('[data-bbs-image]'))
      grid.innerHTML='<p class="bbs-hint">No pictures in this view. Upload or change your search.</p>';
    bbsUpdateSelections();
    toast('Deleted "'+name+'" from the library. Saved sets and board tiles remain unchanged.');
  }finally{
    bbsLibraryBusy=false;
    if(button?.isConnected)button.disabled=false;
  }
}
async function bbsImport(files){
  const list=Array.from(files||[]).filter(f=>String(f.type||'').startsWith('image/')).slice(0,48);
  if(!list.length)return;
  if(bbsLibraryBusy)return toast('Please wait for the library update.');
  bbsLibraryBusy=true;
  try{
  const status=document.querySelector('#bbsLibraryStatus'),add=[];
  for(const [i,file] of list.entries()){
    if(status)status.textContent='Saving picture '+(i+1)+' of '+list.length+'…';
    try{add.push({id:newGameAssetId(),name:gameImageName(file),image:await normalizeGameImage(file),
      collection:'Custom',createdAt:Date.now()+i})}catch(err){}
  }
  if(!add.length)return toast('Those pictures could not be processed.');
  const updated=[...gameImageLibrary,...add];
  if(!persistGameStore(GAME_IMAGE_LIBRARY_STORE,updated))return toast('Picture library could not be saved.');
  gameImageLibrary=updated;bbsRecent=true;bbsQuery='';
  renderActivities();
  const confirmed=await bbsConfirmRemote(GAME_IMAGE_LIBRARY_STORE,updated);
  toast(confirmed?add.length+' pictures saved to library. Check the pictures you want to use.':
    'Pictures are available here, but server save could not be confirmed. Retry before refreshing.');
  }finally{bbsLibraryBusy=false}
}
function bbsUpdateSelections(){
  const selected=new Set(bbsSelected()),need=bbsNeed();
  document.querySelectorAll('[data-bbs-image]').forEach(button=>{
    const yes=selected.has(button.dataset.bbsImage);
    button.classList.toggle('checked',yes);button.setAttribute('aria-pressed',String(yes));
    const existing=button.querySelector('.bbs-image-check');
    if(yes&&!existing)button.insertAdjacentHTML('beforeend','<b class="bbs-image-check">✓</b>');
    if(!yes&&existing)existing.remove();
  });
  const count=document.querySelector('.bbs-picked strong');
  if(count)count.textContent=selected.size+' / '+need+' CHECKED';
  const clear=document.querySelector('#bbsUncheck');if(clear)clear.disabled=!selected.size;
  const create=document.querySelector('#bbsCreate');if(create)create.disabled=selected.size!==need;
  const status=document.querySelector('#bbsLibraryStatus');
  if(status)status.textContent=selected.size===need?'Ready to populate all '+need+' board squares.':
    'Check '+Math.max(0,need-selected.size)+' more picture'+(need-selected.size===1?'':'s')+' to create a board.';
}
function bbsWire(){
  const $=x=>document.querySelector(x),$$=x=>[...document.querySelectorAll(x)];
  const name=$('#bbsName');if(name)name.oninput=e=>{bingoDraft.name=e.target.value;const title=$('#bbsTitle');if(title)title.textContent=e.target.value||'My Bingo Board'};
  const size=$('#bbsSize');if(size)size.onchange=e=>{
    const n=Number(e.target.value),old=bbsSize();
    if(n<old&&(bingoDraft.numberedSlots||[]).slice(n*n,old*old).some(x=>x?.call)&&
      !confirm('A smaller board hides your existing squares beyond '+(n*n)+'. Continue?')){e.target.value=String(old);return}
    bingoDraft.size=n;bingoDraft.editSlot=-1;bingoDraft.selectedImages=[];
    if(n%2===0)bingoDraft.free=false;
    renderActivities()
  };
  const pattern=$('#bbsPattern');if(pattern)pattern.onchange=e=>bingoDraft.pattern=e.target.value;
  const free=$('#bbsFree');if(free)free.onchange=e=>{bingoDraft.free=e.target.checked;bingoDraft.editSlot=-1;bingoDraft.selectedImages=[];renderActivities()};
  $$('[data-bbs-tile]').forEach(b=>b.onclick=()=>{bingoDraft.editSlot=Number(b.dataset.bbsTile);renderActivities();document.querySelector('#bbsTypeText')?.focus()});
  const tileSave=$('#bbsTypeSave');if(tileSave)tileSave.onclick=bbsSaveTile;
  const tileCancel=$('#bbsTypeCancel');if(tileCancel)tileCancel.onclick=()=>{bingoDraft.editSlot=-1;renderActivities()};
  const tileInput=$('#bbsTypeText');if(tileInput)tileInput.onkeydown=e=>{
    if(e.key==='Enter'){e.preventDefault();bbsSaveTile()}
    if(e.key==='Escape'){e.preventDefault();bingoDraft.editSlot=-1;renderActivities()}
  };
  const newBoard=$('#bbsNewBoard');if(newBoard)newBoard.onclick=()=>{
    if(bbsFilled()&&!confirm('Start a new blank board? Unsaved changes will be cleared.'))return;
    bingoDraft={...bingoDraft,name:'',numberedMode:true,numberedSlots:[],editingSetId:'',
      selectedImages:[],editSlot:-1,cardExtras:[],quick:''};renderActivities()
  };
  const clearBoard=$('#bbsClearBoard');if(clearBoard)clearBoard.onclick=()=>{
    if(bbsFilled()&&!confirm('Clear all squares? Your saved boards remain available.'))return;
    bingoDraft.numberedSlots=[];bingoDraft.editSlot=-1;renderActivities()
  };
  const upload=$('#bbsUpload'),uploadInput=$('#bbsUploadInput');
  if(upload&&uploadInput){upload.onclick=()=>uploadInput.click();
    uploadInput.onchange=async e=>{const files=e.target.files;e.target.value='';await bbsImport(files)}}
  $$('[data-bbs-tab]').forEach(b=>b.onclick=()=>{bbsRecent=b.dataset.bbsTab==='recent';bbsQuery='';renderActivities()});
  const search=$('#bbsSearch');if(search)search.oninput=e=>{
    bbsQuery=e.target.value;const query=bbsQuery.trim().toLowerCase();
    $$('[data-bbs-image]').forEach(b=>{b.closest('.bbs-library-entry').hidden=!b.dataset.bbsName.includes(query)})
  };
  $$('[data-bbs-image]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.bbsImage,selection=bbsSelected(),set=new Set(selection);
    if(set.has(id))set.delete(id);
    else if(set.size>=bbsNeed())return toast('Already checked '+bbsNeed()+' pictures. Uncheck one to choose another.');
    else set.add(id);
    bingoDraft.selectedImages=[...set];bbsUpdateSelections()
  });
  $$('[data-bbs-remove]').forEach(b=>b.onclick=()=>bbsRemoveLibraryImage(b.dataset.bbsRemove));
  const clear=$('#bbsUncheck');if(clear)clear.onclick=()=>{bingoDraft.selectedImages=[];bbsUpdateSelections()};
  const create=$('#bbsCreate');if(create)create.onclick=bbsPopulate;
  const save=$('#bbsSave'),launch=$('#bbsSaveLaunch');if(save)save.onclick=()=>bbsSaveBoard(false);
  if(launch)launch.onclick=()=>bbsSaveBoard(true);
  $$('[data-bbs-load]').forEach(b=>b.onclick=()=>bbsLoad(b.dataset.bbsLoad));
  $$('[data-bbs-launch]').forEach(b=>b.onclick=()=>{const set=bingoSets.find(s=>s.id===b.dataset.bbsLaunch);if(set)launchBingoSet(set)});
  $$('[data-bbs-delete]').forEach(b=>b.onclick=()=>{
    const set=bingoSets.find(s=>s.id===b.dataset.bbsDelete);
    if(!set||!confirm('Delete saved Bingo board "'+set.name+'"? Pictures in your library remain.'))return;
    const next=bingoSets.filter(s=>s.id!==set.id);
    if(!persistGameStore(BINGO_SET_STORE,next))return;
    bingoSets=next;if(bingoDraft.editingSetId===set.id)bingoDraft.editingSetId='';
    renderActivities()
  });
}


/* Universal teacher controls: live floating dock + detachable browser window.
   Only relocates the existing activity-controller DOM, never duplicates game state. */
(()=>{
if(typeof window==='undefined'||window.__siGameDock)return;
window.__siGameDock=true;
let node=null,parent=null,next=null,dock=null,box=null,restore=null,heading=null,win=null,mirror=null,mirrorDoc=null,prevHTML='',key='',hidden=false,drag=null,queued=false;
const controls='button,a,[role="button"]',fields='input,select,textarea';
function active(){
 if(typeof SESSION_ROLE==='undefined'||SESSION_ROLE!=='teacher'||typeof state==='undefined')return null;
 const run=state.activityRun;
 return run&&(run.phase==='lobby'||run.phase==='running')&&!state.ended?run:null;
}
function caption(a){const x=typeof activeActivity==='function'?activeActivity():null;return String(x?.name||a.activityId||'Game').toUpperCase()}
function init(){
 if(dock)return true;
 node=document.getElementById('activityControllerPanel');
 const teacher=document.getElementById('teacher');
 if(!node||!teacher)return false;
 parent=node.parentNode;next=node.nextSibling;
 dock=document.createElement('aside');dock.id='siLiveControlDock';dock.className='si-live-control-dock';
 dock.setAttribute('aria-label','Live teacher game controls');
 dock.innerHTML='<div id="siControlDrag" class="si-control-titlebar"><span class="si-control-handle">⠿</span><div class="si-control-caption"><small>MISSION CONTROL · LIVE</small><b id="siControlName">GAME CONTROLS</b></div><div class="si-control-buttons"><button type="button" id="siControlPopout">↗ Separate Window</button><button type="button" id="siControlFold" title="Minimize">−</button><button type="button" id="siControlHide" title="Return controls to page">✕</button></div></div><div class="si-control-body" id="siControlBody"></div>';
 restore=document.createElement('button');restore.type='button';restore.className='si-control-restore';restore.textContent='🎮 Open Game Controls';
 teacher.appendChild(dock);teacher.appendChild(restore);
 box=dock.querySelector('#siControlBody');heading=dock.querySelector('#siControlName');
 dock.querySelector('#siControlFold').onclick=()=>{
   dock.classList.toggle('folded');
   dock.querySelector('#siControlFold').textContent=dock.classList.contains('folded')?'+':'−';
 };
 dock.querySelector('#siControlHide').onclick=()=>{hidden=true;putBack();dock.classList.add('off');restore.classList.add('on')};
 restore.onclick=()=>{
  hidden=false;
  if(win&&!win.closed){win.focus();return}
  float();restore.classList.remove('on');
 };
 dock.querySelector('#siControlPopout').onclick=detach;
 const bar=dock.querySelector('#siControlDrag');
 bar.tabIndex=0;
 bar.setAttribute('aria-label','Move Mission Control with arrow keys (hold Shift for faster movement) or drag with a pointer');
 function keepVisible(){
  if(!dock||dock.classList.contains('off')||dock.classList.contains('detached'))return;
  const r=dock.getBoundingClientRect();if(!r.width||!r.height)return;
  const x=Math.max(4,Math.min(Math.max(4,innerWidth-r.width-4),r.left));
  const y=Math.max(4,Math.min(Math.max(4,innerHeight-r.height-4),r.top));
  if(Math.abs(r.left-x)>1){dock.style.left=x+'px';dock.style.right='auto'}
  if(Math.abs(r.top-y)>1)dock.style.top=y+'px';
 }
 bar.addEventListener('keydown',e=>{
  if(e.target!==bar||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();const r=dock.getBoundingClientRect(),step=e.shiftKey?40:12;
  dock.style.left=(r.left+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))+'px';
  dock.style.top=(r.top+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0))+'px';
  dock.style.right='auto';keepVisible();
 });
 window.addEventListener('resize',keepVisible);
 bar.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button'))return;
  const r=dock.getBoundingClientRect();
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
  try{bar.setPointerCapture(e.pointerId)}catch(_){}
  e.preventDefault();
 });
 bar.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const maxX=Math.max(4,innerWidth-dock.offsetWidth-4),maxY=Math.max(4,innerHeight-54);
  dock.style.left=Math.max(4,Math.min(maxX,drag.left+e.clientX-drag.x))+'px';
  dock.style.top=Math.max(4,Math.min(maxY,drag.top+e.clientY-drag.y))+'px';
  dock.style.right='auto';
 });
 ['pointerup','pointercancel','lostpointercapture'].forEach(t=>bar.addEventListener(t,()=>drag=null));
 new MutationObserver(queueMirror).observe(node,{subtree:true,childList:true,attributes:true,characterData:true});
 return true;
}
function float(){
 if(!node||!box)return;
 if(node.parentNode!==box)box.appendChild(node);
 node.classList.remove('hidden');dock.classList.remove('off','detached');restore.classList.remove('on');
}
function putBack(){if(!node||!parent)return;if(node.parentNode!==parent){if(next&&next.parentNode===parent)parent.insertBefore(node,next);else parent.appendChild(node)}}
function popClose(){
 const old=win;win=null;mirror=null;mirrorDoc=null;prevHTML='';
 if(old&&!old.closed)try{old.close()}catch(_){}
}
function reset(){popClose();putBack();if(dock)dock.classList.add('off');if(restore)restore.classList.remove('on');key='';hidden=false}
function queueMirror(){
 if(queued||!win||win.closed)return;
 queued=true;setTimeout(()=>{queued=false;updateMirror()},70);
}
function updateMirror(force=false){
 if(!win||win.closed||!mirror||!node||!active())return;
 try{
  const html=node.innerHTML;
  if(force||html!==prevHTML){
   const scroll=mirror.scrollTop,originalFields=node.querySelectorAll(fields),focus=mirrorDoc.activeElement;
   const focusId=focus&&mirror.contains(focus)?Array.from(mirror.querySelectorAll(fields)).indexOf(focus):-1;
   mirror.innerHTML=html;prevHTML=html;
   const cloneFields=mirror.querySelectorAll(fields);
   cloneFields.forEach((a,i)=>{const b=originalFields[i];if(!b)return;a.value=b.value;if('checked' in a)a.checked=b.checked});
   const originalCanvases=node.querySelectorAll('canvas'),copied=mirror.querySelectorAll('canvas');
   copied.forEach((a,i)=>{try{const b=originalCanvases[i];a.width=b.width;a.height=b.height;a.getContext('2d')?.drawImage(b,0,0)}catch(_){}});
   mirror.scrollTop=scroll;
   if(focusId>=0)try{cloneFields[focusId]?.focus({preventScroll:true})}catch(_){}
  }
  const h=mirrorDoc.getElementById('siPopupName');if(h)h.textContent=caption(active());
 }catch(_){}
}
function proxyField(e){
 const a=e.target.closest?.(fields);if(!a||!mirror?.contains(a))return;
 const i=Array.from(mirror.querySelectorAll(fields)).indexOf(a),b=node.querySelectorAll(fields)[i];
 if(!b||b.disabled)return;
 b.value=a.value;if('checked' in b)b.checked=a.checked;
 try{b.dispatchEvent(new Event(e.type,{bubbles:true}))}catch(_){}
 queueMirror();
}
function proxyClick(e){
 const a=e.target.closest?.(controls);if(!a||!mirror?.contains(a))return;
 const i=Array.from(mirror.querySelectorAll(controls)).indexOf(a),b=node.querySelectorAll(controls)[i];
 if(!b||b.disabled)return;
 e.preventDefault();try{b.click()}catch(_){}queueMirror();
}
function detach(){
 if(!active())return;
 if(win&&!win.closed){win.focus();updateMirror(true);return}
 let popup=null;
 try{popup=window.open('about:blank','siMothershipLiveGameControls','popup=yes,width=1100,height=860,left=70,top=60,resizable=yes,scrollbars=yes')}catch(_){}
 if(!popup){if(typeof toast==='function')toast('Popup blocked. Allow popups for a separate controls window.');return}
 try{
  const styles=Array.from(document.head.querySelectorAll('style,link[rel="stylesheet"]')).map(n=>n.outerHTML).join('\n');
  popup.document.open();
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>SI Mothership · Game Controls</title>'+styles+
  '<style>html,body{margin:0!important;min-height:100%;background:#051323!important;color:#edf9ff!important;overflow-x:hidden!important}#teacher{display:block!important;padding:0 15px 18px!important;min-height:100vh!important}.si-popup-bar{position:sticky;top:0;z-index:90;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 15px;border-bottom:2px solid #54d4f8;background:#09243b;color:#fff;font:900 16px system-ui;box-shadow:0 5px 18px #0008}.si-popup-bar small{display:block;font:900 10px system-ui;color:#8ce9ff;letter-spacing:.1em}.si-popup-bar button{padding:10px 13px;background:#145377;color:#fff;border:1px solid #7bdcff;border-radius:9px;cursor:pointer;font:800 12px system-ui}#activityControllerPanel{display:block!important;width:100%!important;max-width:1400px!important;margin:14px auto 0!important;box-sizing:border-box!important}</style></head><body><section id="teacher" class="view active"><header class="si-popup-bar"><div><small>SI MOTHERSHIP · TEACHER ONLY</small><strong id="siPopupName">LIVE GAME CONTROLS</strong></div><button type="button" id="siPopupDock">↙ Dock Back</button></header><section id="activityControllerPanel" class="activity-controller main-card"></section></section></body></html>');
  popup.document.close();
  win=popup;mirrorDoc=popup.document;mirror=mirrorDoc.getElementById('activityControllerPanel');
  mirrorDoc.getElementById('siPopupDock').onclick=()=>{popClose();float()};
  mirror.addEventListener('click',proxyClick);
  mirror.addEventListener('input',proxyField);
  mirror.addEventListener('change',proxyField);
  popup.addEventListener('beforeunload',()=>{win=null;mirror=null;mirrorDoc=null;prevHTML='';if(active())float()});
  dock.classList.add('detached');restore.classList.add('on');restore.textContent='↗ Game Window Open';
  updateMirror(true);popup.focus();
 }catch(_){try{popup.close()}catch(_){}win=null;mirror=null;mirrorDoc=null;float();if(typeof toast==='function')toast('Unable to open separate controls window.')}
}
function tick(){
 const a=active();if(!a){if(key)reset();return}
 if(!init())return;
 dock.classList.toggle('prelaunch',a.phase==='lobby');
 const k=String(a.runToken||a.activityId)+'|'+String(a.activityId);
 if(k!==key){reset();key=k;hidden=false;heading.textContent=caption(a);dock.classList.remove('folded');float()}
 if(win&&win.closed){win=null;mirror=null;mirrorDoc=null;prevHTML='';float()}
 if(!hidden&&(!win||win.closed)&&node.parentNode!==box)float();
 if(heading.textContent!==caption(a))heading.textContent=caption(a);
 const paused=a.phase==='lobby'&&!!a.resumePending;
 dock.classList.toggle('is-paused',paused);
 const phaseLabel=dock.querySelector('.si-control-caption small');
 if(phaseLabel){const text=paused?'ACTIVITY PAUSED · PROGRESS SAVED':a.phase==='lobby'?'ACTIVITY LOADED · READY TO START':'MISSION CONTROL · LIVE';if(phaseLabel.textContent!==text)phaseLabel.textContent=text;}
 keepVisible();
}
function start(){
 if(typeof SESSION_ROLE==='undefined'||SESSION_ROLE!=='teacher')return;
 setInterval(tick,320);
 window.addEventListener('beforeunload',popClose);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();


/* CREW SURVEY STUDIO v2 — independent Board Library and Saved Game Library.
   Compatible with v1 saved boards. Saved games contain immutable copies
   of their ordered boards, keeping future answers teacher-private. */
(()=>{
  if(typeof window==='undefined'||window.__siSurveyBoardLibraryInstalled)return;
  window.__siSurveyBoardLibraryInstalled=true;
  const BOARD_KEY='siMothership.crewSurveyBoards.v1';
  const GAME_KEY='siMothership.crewSurveyGames.v1';
  const byId=id=>document.getElementById(id);
  const safe=v=>typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lastLaunchStatus='';
  const tell=v=>{
    lastLaunchStatus=String(v||'');
    const box=byId('surveyLaunchStatus');
    if(box){box.textContent=lastLaunchStatus;box.hidden=false;
      box.style.color=/could not|failed|error|assign|needs|different|before|first|at least|no board|missing|finish the current|not found/i.test(lastLaunchStatus)?'#ffd1c9':'#c1ffed'}
    if(typeof toast==='function')toast(lastLaunchStatus);
  };
  let boards=[],games=[],editingBoardId='',editingGameId='',boardName='',gameName='';
  let gameLength=1,roundIds=[''],roundCopies=[null],activeCopies=[],busy=false,installed=false;
  const id=kind=>kind+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
  const value=v=>String(v??'').trim();
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
  function cleanBoard(x){
    if(!x||typeof x!=='object')return null;
    const answers=(Array.isArray(x.answers)?x.answers:[]).slice(0,8).map(a=>({
      text:String(a?.text||'').trim().slice(0,70),value:clamp(a?.value,0,999)
    }));
    while(answers.length<4)answers.push({text:'',value:0});
    return {id:String(x.id||'').slice(0,100),name:value(x.name||x.prompt||'Untitled Board').slice(0,90),
      prompt:value(x.prompt).slice(0,240),answers,scoring:x.scoring!==false,
      aacVocab:(Array.isArray(x.aacVocab)?x.aacVocab:[]).map(a=>value(a).slice(0,30)).filter(Boolean).slice(0,10),
      createdAt:Number(x.createdAt)||Date.now(),updatedAt:Number(x.updatedAt)||Date.now()};
  }
  function freezeBoard(x){
    const b=cleanBoard(x);
    if(!b)return null;
    return {sourceBoardId:String(x.sourceBoardId||x.id||''),name:b.name,prompt:b.prompt,
      answers:b.answers.map(a=>({...a})),scoring:b.scoring,aacVocab:[...b.aacVocab]};
  }
  function cleanGame(x){
    if(!x||typeof x!=='object')return null;
    const length=Number(x.length||x.rounds?.length||1);
    if(![1,3,5].includes(length)||!Array.isArray(x.rounds)||x.rounds.length!==length)return null;
    const rounds=x.rounds.map(r=>{
      const b=freezeBoard(r);if(!b)return null;
      b.sourceBoardId=String(r.sourceBoardId||r.id||'');
      return b;
    });
    if(rounds.some(r=>!r))return null;
    return {id:String(x.id||'').slice(0,100),name:value(x.name||'Untitled Game').slice(0,90),
      length,rounds,createdAt:Number(x.createdAt)||Date.now(),updatedAt:Number(x.updatedAt)||Date.now()};
  }
  function readList(key,clean){
    const raw=typeof loadGameStore==='function'?loadGameStore(key,[]):[];
    return (Array.isArray(raw)?raw:[]).map(clean).filter(x=>x&&x.id);
  }
  function load(){boards=readList(BOARD_KEY,cleanBoard);games=readList(GAME_KEY,cleanGame)}
  async function persist(key,next,kind){
    if(busy)return false;busy=true;
    try{
      const serialized=JSON.stringify(next);
      const online=typeof NETWORK_SYNC!=='undefined'&&NETWORK_SYNC&&SESSION_ROLE==='teacher';
      if(online){
        try{
          const response=await fetch('/api/storage',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({key,value:serialized})});
          if(!response.ok||!(await response.json())?.ok)throw Error('storage rejected');
        }catch(_){tell('Could not confirm '+kind+' save on Mothership. Retry; nothing was changed.');return false}
      }
      let local=true;try{localStorage.setItem(key,serialized)}catch(_){local=false}
      if(!local&&!online){tell('Browser storage is full. '+kind+' was not saved.');return false}
      if(!local)tell(kind+' saved on Mothership; browser cache is full.');
      if(key===BOARD_KEY)boards=next;
      else games=next;
      return true;
    }finally{busy=false}
  }
  function draftBoard(){
    const d=crewSurveyDraft;
    return cleanBoard({id:editingBoardId,name:boardName||d.prompt,prompt:d.prompt,
      answers:d.answers,scoring:d.scoring,aacVocab:d.aacVocab});
  }
  function boardValid(b){
    return !!b&&!!b.prompt&&b.answers.filter(a=>a.text).length>=4;
  }
  function loadBoard(id){
    if(busy)return;
    const b=boards.find(x=>x.id===id);if(!b)return tell('Board not found');
    editingBoardId=b.id;boardName=b.name;
    crewSurveyDraft={prompt:b.prompt,answers:b.answers.map(a=>({...a})),
      scoring:b.scoring,aacVocab:[...b.aacVocab],aacStudents:[...(crewSurveyDraft.aacStudents||[])]};
    renderActivities();tell('Editing board: '+b.name);
  }
  function newBoard(){
    if(busy)return;
    editingBoardId='';boardName='';
    crewSurveyDraft={prompt:'',answers:Array.from({length:4},()=>({text:'',value:0})),
      scoring:true,aacVocab:['Yes','No','Maybe','Other','Pass'],
      aacStudents:[...(crewSurveyDraft.aacStudents||[])]};
    renderActivities();
  }
  async function saveBoard(copy=false){
    const draft=draftBoard();if(!boardValid(draft))return tell('Enter a question and at least four answers before saving a board.');
    if(!boardName.trim())return tell('Give this board a name before saving.');
    const previous=!copy?boards.find(x=>x.id===editingBoardId):null;
    const now=Date.now();
    const board=cleanBoard({...draft,name:boardName,id:previous?.id||id('surveyboard'),
      createdAt:previous?.createdAt||now,updatedAt:now});
    if(!(await persist(BOARD_KEY,[board,...boards.filter(b=>b.id!==board.id)],'Board')))return;
    editingBoardId=board.id;boardName=board.name;renderActivities();
    tell(previous?'Board updated in the library':'Board saved to the library');
  }
  async function deleteBoard(idToDelete){
    const b=boards.find(x=>x.id===idToDelete);
    if(!b||!confirm('Delete board "'+b.name+'" from the Board Library? Saved Games will keep their own copies.'))return;
    if(!(await persist(BOARD_KEY,boards.filter(x=>x.id!==idToDelete),'Board')))return;
    if(editingBoardId===idToDelete)editingBoardId='';
    renderActivities();tell('Board deleted. Existing saved games are unchanged.');
  }
  function setLength(n){
    if(![1,3,5].includes(Number(n))||busy)return;
    gameLength=Number(n);
    roundIds=Array.from({length:gameLength},(_,i)=>roundIds[i]||'');
    roundCopies=Array.from({length:gameLength},(_,i)=>roundCopies[i]||null);
    renderActivities();
  }
  function setRound(i,boardId){
    if(busy||i<0||i>=gameLength)return;
    roundIds[i]=boardId;roundCopies[i]=null;
    renderActivities();
  }
  function boardForRound(i){
    const chosen=roundCopies[i];
    if(chosen&&chosen.sourceBoardId===roundIds[i])return freezeBoard(chosen);
    return freezeBoard(boards.find(b=>b.id===roundIds[i]));
  }
  function compileRounds(){
    const rounds=Array.from({length:gameLength},(_,i)=>boardForRound(i));
    const missing=rounds.findIndex(b=>!b||!boardValid(b));
    if(missing!==-1){
      const current=rounds[missing];
      tell(!current?'Round '+(missing+1)+' has no saved board. Select one in Game Builder.':
        'Round '+(missing+1)+' needs a question and at least four nonblank answers.');
      return null;
    }
    const ids=rounds.map((b,i)=>b.sourceBoardId||'saved-round-'+i);
    if(new Set(ids).size!==ids.length){
      tell('Choose a different saved board for each round.');return null;
    }
    return rounds.map(b=>({...b,answers:b.answers.map(a=>({...a}))}));
  }
  function loadGame(idToLoad){
    if(busy)return false;
    const g=games.find(x=>x.id===idToLoad);if(!g){tell('Saved game not found');return false}
    editingGameId=g.id;gameName=g.name;gameLength=g.length;
    roundCopies=g.rounds.map(b=>freezeBoard(b));
    roundIds=g.rounds.map(b=>b.sourceBoardId||'');
    renderActivities();tell('Loaded game: '+g.name+' · '+g.length+' rounds');return true;
  }
  function newGame(){
    if(busy)return;editingGameId='';gameName='';gameLength=1;roundIds=[''];roundCopies=[null];renderActivities();
  }
  async function saveGame(copy=false){
    const name=value(byId('surveyGameName')?.value||gameName).slice(0,90);
    if(!name)return tell('Give your Survey game a name before saving.');
    const rounds=compileRounds();if(!rounds)return;
    const prior=!copy?games.find(x=>x.id===editingGameId):null;
    const now=Date.now(),g=cleanGame({id:prior?.id||id('surveygame'),name,length:gameLength,
      rounds,createdAt:prior?.createdAt||now,updatedAt:now});
    if(!g)return tell('Could not prepare this game');
    if(!(await persist(GAME_KEY,[g,...games.filter(x=>x.id!==g.id)],'Game')))return;
    editingGameId=g.id;gameName=g.name;roundIds=g.rounds.map(b=>b.sourceBoardId);
    roundCopies=g.rounds.map(b=>freezeBoard(b));
    renderActivities();tell(prior?'Saved game updated':'Game saved · '+g.length+' boards in order');
  }
  async function deleteGame(idToDelete){
    const g=games.find(x=>x.id===idToDelete);
    if(!g||!confirm('Delete saved game "'+g.name+'"? Your individual boards will be kept.'))return;
    if(!(await persist(GAME_KEY,games.filter(x=>x.id!==idToDelete),'Game')))return;
    if(editingGameId===idToDelete)editingGameId='';
    renderActivities();tell('Saved game deleted. Your boards remain available.');
  }
  function playGame(idToPlay){
    try{
      if(!loadGame(idToPlay))return false;
      return launchSelected();
    }catch(error){
      tell('Saved Game launch failed: '+String(error?.message||error));return false;
    }
  }
  function run(){const r=state.activityRun;return r?.activityId==='crew-survey-game'&&r.crewSurveyTotal?r:null}
  function replayBoards(){
    const r=run();if(!r)return null;
    const total=Number(r.crewSurveyTotal||1);
    if(activeCopies.length===total&&activeCopies.every(boardValid))return activeCopies.map(freezeBoard);
    const saved=games.find(g=>g.id===r.crewSurveyGameId);
    if(saved?.rounds.length===total&&saved.rounds.every(boardValid))return saved.rounds.map(freezeBoard);
    if(total!==1)return null;
    // An unsaved practice board can also be replayed after a page refresh.
    const cfg=r.crewSurveyConfig||{};
    const board=freezeBoard({
      id:'survey-replay-current',name:'Current Survey Board',prompt:cfg.prompt,
      answers:(cfg.answers||[]).map(a=>({text:a.text,value:a.value})),
      scoring:cfg.scoring,aacVocab:cfg.aacVocab||[]
    });
    return boardValid(board)?[board]:null;
  }
  function restartSurvey(){
    const chosen=replayBoards();
    if(!chosen){tell('Could not replay this game. Finish & Return, then reload it from Saved Games.');return false}
    if(!confirm('Play CREW SURVEY again from Round 1? Current scores and reveals will reset.'))return false;
    return launchPreparedSurvey(chosen,true);
  }
  function winner(cs){
    const a=Number(cs?.scores?.[0]||0),b=Number(cs?.scores?.[1]||0);
    return a===b?'TIE GAME':a>b?'BLUE CREW WINS':'RED CREW WINS';
  }
  function advance(original){
    const r=run();if(!r)return original();
    const cs=r.crewSurvey,total=Number(r.crewSurveyTotal),idx=Number(r.crewSurveyRoundIndex||0);
    if(idx>=total-1){
      if(cs?.stage==='roundwon'){tell('Game complete: '+winner(cs));return}
      if(!confirm('Replay the final survey board?'))return;
      original();cs.message='Replay faceoff · final board.';render();return;
    }
    if(cs?.stage!=='roundwon'&&!confirm('Advance without awarding this round?'))return;
    const nextIndex=idx+1;
    let next=activeCopies[nextIndex];
    if(!next&&r.crewSurveyGameId){
      const saved=games.find(g=>g.id===r.crewSurveyGameId);
      next=saved?.rounds?.[nextIndex];
    }
    if(!boardValid(next)){tell('The next saved game board is unavailable. Return to Survey setup.');return}
    const oldConfig=r.crewSurveyConfig||{},members=cs?.teams||[[],[]];
    r.crewSurveyConfig={
      prompt:next.prompt,
      answers:next.answers.filter(a=>a.text).map((a,i)=>({id:i+1,text:a.text,value:Number(a.value||0)})),
      scoring:next.scoring,aacVocab:[...next.aacVocab],
      aacStudents:[...(oldConfig.aacStudents||[])]
    };
    r.crewSurveyRoundIndex=nextIndex;
    original(); // established faceoff reset preserves crew scores and teams
    const fresh=r.crewSurvey;
    if(fresh){
      fresh.activeIndexes=[nextIndex%Math.max(1,members[0]?.length||1),nextIndex%Math.max(1,members[1]?.length||1)];
      fresh.buzzer.eligible=[members[0]?.[fresh.activeIndexes[0]],members[1]?.[fresh.activeIndexes[1]]].filter(Boolean);
      fresh.message='Board '+(nextIndex+1)+' of '+total+' · New faceoff! Arm the buzzers.';
    }
    render();tell('Round '+(nextIndex+1)+' of '+total+': '+next.name);
  }
  // Optional teacher-side sound cues. Off until a teacher explicitly enables
  // them; no autoplay on student devices or the separate Zoom shared view.
  let soundEnabled=false,audioContext=null;
  try{soundEnabled=localStorage.getItem('siMothership.crewSurveySound.v1')==='on'}catch(_){}
  function showSound(kind){
    if(!soundEnabled||SESSION_ROLE!=='teacher')return;
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)return;
      audioContext=audioContext||new Context();
      if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
      const sounds=kind==='strike'?[190,135]:kind==='award'?[523,659,880]:
        kind==='round'?[410,615]:kind==='arm'?[510,760]:[700,930];
      const now=audioContext.currentTime;
      sounds.forEach((frequency,i)=>{
        const begin=now+i*.155,duration=kind==='strike'?.18:.14;
        const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
        oscillator.type=kind==='strike'?'sawtooth':'sine';
        oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(.0001,begin);
        gain.gain.exponentialRampToValueAtTime(kind==='strike'?.045:.038,begin+.018);
        gain.gain.exponentialRampToValueAtTime(.0001,begin+duration);
        oscillator.connect(gain);gain.connect(audioContext.destination);
        oscillator.start(begin);oscillator.stop(begin+duration+.015);
      });
    }catch(_){}
  }
  function drawHost(){
    const r=run();if(!r||r.phase!=='running')return;
    const root=byId('activityControllerPanel'),cs=r.crewSurvey;
    if(!root||!cs)return;
    const idx=Number(r.crewSurveyRoundIndex||0)+1,total=Number(r.crewSurveyTotal);
    const finished=idx===total&&cs.stage==='roundwon';
    const head=root.querySelector('.activity-controller-head');
    if(head&&!root.querySelector('.survey-host-rounds')){
      const info=document.createElement('div');info.className='survey-host-rounds';
      info.innerHTML='<b>BOARD '+idx+' / '+total+'</b><span>'+
        (finished?'GAME COMPLETE · '+safe(winner(cs)):safe(r.crewSurveyConfig?.prompt||''))+
        '</span><strong>BLUE '+Number(cs.scores?.[0]||0)+' · RED '+Number(cs.scores?.[1]||0)+'</strong>';
      head.after(info);
    }

    // A single command deck mirrors existing teacher actions without touching
    // the game engine, saved content, or student permissions.
    if(!root.querySelector('.cs-teacher-show-controls')){
      const control=cs.controlTeam==null?null:Number(cs.controlTeam);
      const selected=control===0?'BLUE':control===1?'RED':'';
      const done=cs.stage==='roundwon',winnerName=String(cs.buzzer?.winner||'');
      const canStrike=!done&&cs.stage!=='steal'&&(control!==null||!!winnerName);
      const canNext=!done&&control!==null&&(cs.teams?.[control]||[]).length>0;
      const strip=document.createElement('section');
      strip.className='cs-teacher-show-controls';
      strip.setAttribute('aria-label','CREW SURVEY show controls');
      const roundDots=Array.from({length:total},(_,i)=>
        '<span class="'+(i===idx-1?'now':i<idx-1?'done':'')+'" aria-label="Board '+(i+1)+'">'+(i+1)+'</span>').join('');
      const stage=done?'ROUND COMPLETE':cs.stage==='steal'?'STEAL CHANCE':
        cs.stage==='faceoff'?(cs.buzzer?.armed?'BUZZERS ARMED':winnerName?'FIRST BUZZ':'FACE-OFF READY'):
        selected+' CREW IN CONTROL';
      const btn=(action,label,enabled=true,style='')=>'<button type="button" data-cs-quick="'+action+
        '" class="cs-quick '+style+'" '+(enabled?'':'disabled')+'>'+label+'</button>';
      strip.innerHTML='<div class="cs-teacher-show-head"><div><b>ϟ FACE-OFF COMMAND DECK</b>'+
        '<span>'+safe(stage)+(winnerName?' · '+safe(winnerName):'')+'</span></div>'+
        '<div class="cs-teacher-round-dots">'+roundDots+'</div></div>'+
        '<div class="cs-teacher-action-row">'+
        btn('arm','ϟ ARM BUZZERS',!done&&!cs.buzzer?.armed,'cs-quick-primary')+
        btn('reset','↻ RESET',!done)+
        btn('strike','✕ STRIKE',canStrike,'cs-quick-strike')+
        btn('player','→ NEXT PLAYER',canNext)+
        btn('award','★ AWARD '+(selected||'ROUND'),!done&&control!==null,'cs-quick-award')+
        btn('round',idx<total?'NEXT BOARD →':'↻ PLAY AGAIN',done,'cs-quick-primary')+
        btn('sound',soundEnabled?'♪ SOUND ON':'♫ SOUND OFF',true,'cs-quick-sound')+'</div>'+
        '<p class="cs-teacher-tip">'+(done?'Round awarded. '+(idx<total?'Move to the next faceoff.':'Final results are ready.'):
          cs.stage==='steal'?'Three strikes! The opposing crew gets the steal attempt.':
          cs.stage==='faceoff'?'Choose contestants below, arm buzzers, then reveal their answer.':
          'Reveal answers below; rotate players or assign a strike as needed.')+'</p>';
      const header=root.querySelector('.activity-controller-head');
      if(header)header.after(strip);else root.prepend(strip);
      strip.querySelectorAll('[data-cs-quick]').forEach(button=>button.onclick=()=>{
        const action=button.dataset.csQuick;
        if(action==='sound'){
          soundEnabled=!soundEnabled;
          try{localStorage.setItem('siMothership.crewSurveySound.v1',soundEnabled?'on':'off')}catch(_){}
          button.textContent=soundEnabled?'♪ SOUND ON':'♫ SOUND OFF';
          button.setAttribute('aria-pressed',String(soundEnabled));
          if(soundEnabled)showSound('arm');
          return;
        }
        if(action==='arm')crewSurveyArmBuzzers();
        else if(action==='reset')crewSurveyResetBuzzers();
        else if(action==='strike')crewSurveyStrike();
        else if(action==='player')crewSurveyNextPlayer();
        else if(action==='award'&&control!==null)crewSurveyAwardRound(control);
        else if(action==='round')done?(idx<total?crewSurveyNewRound():restartSurvey()):null;
      });
    }
    const next=byId('crewSurveyNewRoundBtn');
    if(next){next.textContent=finished?'✓ Game Complete':idx<total?'→ Next Board & Face-Off':'↻ Replay Board';
      next.disabled=finished;next.title=finished?'Play Again or Finish & Return':'Start a fresh faceoff';}
    const safety=root.querySelector('.controller-safety');
    if(safety&&!root.querySelector('#crewSurveyReplayBtn')){
      const again=document.createElement('button');
      again.id='crewSurveyReplayBtn';again.type='button';again.className='primary-action';
      again.textContent=finished?'↻ PLAY AGAIN':'↻ Restart This Game';
      again.title='Restart this 1-, 3-, or 5-board Survey game from Round 1';
      again.onclick=restartSurvey;safety.prepend(again);
    }
  }
  /* Create a fully initialized live Survey run before the first render and
     state broadcast, using one consistent path for teacher preview and students. */
  function launchPreparedSurvey(chosen,replayConfirmed=false){
    if(state.activityRun){
      if(state.activityRun.activityId!=='crew-survey-game'){
        tell('Finish the other activity before starting CREW SURVEY.');return false;
      }
      if(!replayConfirmed&&!confirm('Restart CREW SURVEY from Round 1? Current scores and reveals will reset.'))return false;
    }
    const first=chosen[0],students=connectedStudents(),teams=crewSurveyTeamsFromRoster();
    const answers=first.answers.filter(a=>a.text).map((a,i)=>({
      id:i+1,text:String(a.text).slice(0,70),value:Number(a.value||0)
    }));
    if(!first.prompt||answers.length<4){tell('The first board needs a question and at least four answers.');return false}
    const eligible=[teams[0]?.[0],teams[1]?.[0]].filter(Boolean);
    const snapshots=chosen.map(b=>freezeBoard(b));
    const next={
      activityId:'crew-survey-game',runToken:newActivityRunToken(),phase:'running',responses:{},
      crewSurveyConfig:{
        prompt:first.prompt.slice(0,240),answers,scoring:!!first.scoring,
        aacStudents:(crewSurveyDraft.aacStudents||[]).filter(n=>students.some(s=>s.n===n)),
        aacVocab:[...first.aacVocab]
      },
      crewSurvey:{
        stage:'faceoff',teams,scores:[0,0],strikes:[0,0],revealed:[],
        controlTeam:null,activeIndexes:[0,0],stealAvailable:false,roundPoints:0,
        buzzer:{armed:false,eligible,winner:null,lockedAt:null},
        privateResponses:{},lastResponse:null,
        message:students.length===0
          ?'Teacher preview ready. Reveal answers using Mission Control.'
          :students.length===1
            ?'One-student practice ready. Arm the buzzer or reveal answers from Mission Control.'
            :'Face-off ready. Assign contestants and arm the buzzers.'
      },
      crewSurveyTotal:chosen.length,crewSurveyRoundIndex:0,
      crewSurveyGameId:editingGameId||'',
      // Future boards remain in teacher-private memory; public state only has IDs.
      crewSurveyPlaylistIds:chosen.slice(1).map(b=>b.sourceBoardId)
    };
    const previous={run:state.activityRun,screen:state.screen,prompt:state.promptActive,assigning:state.assigningSlot,copies:activeCopies};
    activeCopies=snapshots;
    state.activityRun=next;
    state.screen='activity';state.promptActive=false;state.assigningSlot=null;
    try{
      recordActivityLaunch('crew-survey','CREW SURVEY');
      render();
    }catch(error){
      state.activityRun=previous.run;state.screen=previous.screen;
      state.promptActive=previous.prompt;state.assigningSlot=previous.assigning;
      activeCopies=previous.copies;
      try{render()}catch(_){}
      tell('CREW SURVEY could not render: '+String(error?.message||error));
      return false;
    }
    tell(students.length===0
      ?'CREW SURVEY is LIVE in teacher preview · no students connected'
      :students.length===1
        ?'CREW SURVEY is LIVE for one student · connect another for two-crew faceoffs'
        :'CREW SURVEY is LIVE · faceoff ready for students');
    return true;
  }
  function wrapGameplay(){
    if(typeof launchCrewSurvey!=='function'||typeof crewSurveyNewRound!=='function'||typeof renderActivityController!=='function')return;
    const originalRound=crewSurveyNewRound,originalControl=renderActivityController;
    const originalAward=typeof crewSurveyAwardRound==='function'?crewSurveyAwardRound:null;
    if(originalAward)crewSurveyAwardRound=function(...args){
      if(run()?.crewSurvey?.stage==='roundwon')return tell('This round was already awarded. Advance to the next board.');
      const result=originalAward.apply(this,args);
      if(run()?.crewSurvey?.stage==='roundwon')showSound('award');
      return result;
    };
    if(typeof crewSurveyReveal==='function'){
      const originalReveal=crewSurveyReveal;
      crewSurveyReveal=function(...args){
        const count=crewSurveyState()?.revealed?.length||0;
        const result=originalReveal.apply(this,args);
        if((crewSurveyState()?.revealed?.length||0)>count)showSound('reveal');
        return result;
      };
    }
    if(typeof crewSurveyStrike==='function'){
      const originalStrike=crewSurveyStrike;
      crewSurveyStrike=function(...args){
        const tally=(crewSurveyState()?.strikes||[]).reduce((a,b)=>a+Number(b||0),0);
        const result=originalStrike.apply(this,args);
        if((crewSurveyState()?.strikes||[]).reduce((a,b)=>a+Number(b||0),0)>tally)showSound('strike');
        return result;
      };
    }
    if(typeof crewSurveyArmBuzzers==='function'){
      const originalArm=crewSurveyArmBuzzers;
      crewSurveyArmBuzzers=function(...args){
        const wasArmed=!!crewSurveyState()?.buzzer?.armed;
        const result=originalArm.apply(this,args);
        if(!wasArmed&&crewSurveyState()?.buzzer?.armed)showSound('arm');
        return result;
      };
    }
    launchCrewSurvey=function(){
      if(state.activityRun?.activityId&&state.activityRun.activityId!=='crew-survey-game'){
        tell('Finish the other activity before starting CREW SURVEY.');return false;
      }
      // A teacher editing a single unsaved board can test it without having
      // to create a Board Library entry and a Saved Game first.
      if(gameLength===1&&!roundIds[0]&&!roundCopies[0]){
        const draft=draftBoard();
        if(boardValid(draft)){
          draft.id=draft.id||'teacher-preview';
          return launchPreparedSurvey([freezeBoard(draft)]);
        }
      }
      const chosen=compileRounds();
      return chosen?launchPreparedSurvey(chosen):false;
    };
    crewSurveyNewRound=function(...args){
      const before=run()?.crewSurveyRoundIndex;
      const result=advance(()=>originalRound.apply(this,args));
      if(run()&&run().crewSurveyRoundIndex!==before)showSound('round');
      return result;
    };
    renderActivityController=function(...args){const response=originalControl.apply(this,args);drawHost();return response};
    if(typeof crewSurveySharedMarkup==='function'){
      const originalShared=crewSurveySharedMarkup;
      crewSurveySharedMarkup=function(...args){
        const html=originalShared.apply(this,args),r=run();
        if(!r||!html)return html;
        const idx=Number(r.crewSurveyRoundIndex||0)+1,total=Number(r.crewSurveyTotal);
        const done=idx===total&&r.crewSurvey?.stage==='roundwon';
        const badge='<div class="survey-shared-rounds"><b>ROUND '+idx+' OF '+total+'</b>'+
          (done?'<strong>★ '+safe(winner(r.crewSurvey))+' · FINAL SCORE ★</strong>':'<span>New faceoff each round</span>')+'</div>';
        return html.replace(/(<div class="crew-survey-public[^>]*>)/,'$1'+badge);
      };
    }
  }
  function editorActive(){return SESSION_ROLE==='teacher'&&state.activeApp==='crew-survey'&&!state.activityRun&&
    !!document.querySelector('.crew-survey-setup');}
  function boardLibraryMarkup(){
    const board=boards.find(b=>b.id===editingBoardId);
    return '<section class="survey-board-library survey-studio-board" aria-label="Survey Board Library">'+
      '<div class="survey-library-top"><div><span class="survey-library-eyebrow">STEP 1 · BUILD AND SAVE INDIVIDUAL BOARDS</span>'+
      '<h4>Board Library</h4><p>Create a question with hidden answers below, then save it here. Boards can be reused in different games.</p>'+
      '</div><span class="survey-library-count">'+boards.length+' BOARDS</span></div>'+
      '<div class="survey-library-editor"><label for="surveyBoardName">BOARD NAME</label>'+
      '<input id="surveyBoardName" maxlength="90" placeholder="e.g. Kitchen Tools · Round 1" value="'+safe(boardName)+'">'+
      '<div class="survey-library-actions"><button id="surveySaveBoard" type="button" class="survey-save-primary">'+
      (board?'✓ Update Board':'💾 Save to Board Library')+'</button>'+
      '<button id="surveySaveCopy" type="button">Save Copy</button>'+
      '<button id="surveyNewBoard" type="button">＋ New Board</button></div></div>'+
      '<div class="survey-library-bottom"><h5>Saved Boards <small>Load a board to edit it, or assign it in Step 2 below.</small></h5>'+
      (boards.length?'<div class="survey-library-list">'+boards.map(b=>
        '<article class="survey-library-item'+(b.id===editingBoardId?' selected':'')+'">'+
        '<div class="survey-library-item-text"><strong>'+safe(b.name)+'</strong><span>'+safe(b.prompt)+'</span>'+
        '<small>'+b.answers.filter(a=>a.text).length+' answers</small></div>'+
        '<div class="survey-library-item-buttons"><button type="button" data-survey-load="'+safe(b.id)+'">Load / Edit</button>'+
        '<button type="button" data-survey-delete="'+safe(b.id)+'" class="survey-delete" aria-label="Delete '+safe(b.name)+'">×</button></div></article>').join('')+'</div>':
        '<p class="survey-library-empty">No boards saved yet. Create a question below and save it to begin.</p>')+
      '</div></section>';
  }
  function gameBuilderMarkup(){
    const selected=games.find(g=>g.id===editingGameId);
    const options=boards.map(b=>'<option value="'+safe(b.id)+'">'+safe(b.name)+' · '+safe(b.prompt)+'</option>').join('');
    const rows=Array.from({length:gameLength},(_,i)=>{
      const id=roundIds[i]||'',copy=roundCopies[i],found=boards.some(b=>b.id===id);
      const snapshot=!found&&copy?.sourceBoardId===id;
      const name=copy?.name||boards.find(b=>b.id===id)?.name||'';
      return '<label class="survey-round-select"><b>ROUND '+(i+1)+'</b>'+
        '<select data-survey-round="'+i+'"><option value="">— Choose a board —</option>'+
        (snapshot?'<option value="'+safe(id)+'" selected>'+safe(name)+' (Saved Game Copy)</option>':'')+
        boards.map(b=>'<option value="'+safe(b.id)+'" '+(b.id===id?'selected':'')+'>'+safe(b.name)+'</option>').join('')+'</select>'+
        '<span class="survey-round-description">'+(name?safe(copy?.prompt||boards.find(b=>b.id===id)?.prompt||''):'Choose a saved Board Library item')+'</span></label>';
    }).join('');
    return '<section class="survey-rounds-panel survey-studio-game" aria-label="Build and save Survey Games">'+
      '<div class="survey-rounds-heading"><div><span class="survey-library-eyebrow">STEP 2 · ASSEMBLE AND SAVE A GAME</span>'+
      '<h4>Game Builder</h4><p>Choose 1, 3, or 5 different saved boards. They play in this order, with a new faceoff and running crew scores.</p>'+
      '</div><span class="survey-round-count">'+gameLength+' ROUNDS</span></div>'+
      '<div class="survey-round-count-buttons">'+[1,3,5].map(n=>
        '<button type="button" data-survey-length="'+n+'" aria-pressed="'+(gameLength===n)+'" class="'+(gameLength===n?'selected':'')+'">'+n+' BOARD'+(n===1?'':'S')+'</button>').join('')+'</div>'+
      '<div class="survey-game-name"><label for="surveyGameName">GAME NAME</label>'+
      '<input id="surveyGameName" maxlength="90" placeholder="e.g. Friday Survey Showdown" value="'+safe(gameName)+'"></div>'+
      '<div class="survey-round-order">'+rows+'</div>'+
      '<p class="survey-round-note">Saved games keep their own copies of each selected board. Editing or deleting a library board later will not change an existing saved game.</p>'+
      '<div class="survey-game-actions">'+
      '<button id="surveySaveGame" type="button" class="survey-save-primary">'+(selected?'✓ Update Saved Game':'💾 Save Complete Game')+'</button>'+
      '<button id="surveyCopyGame" type="button">Save Game Copy</button>'+
      '<button id="surveyNewGame" type="button">＋ New Game</button>'+
      '<button id="surveyPlayDraft" type="button" title="Start one round from the board currently in the editor; this does not save a board or change the saved game.">▶ PLAY CURRENT BOARD</button>'+
      '<span id="surveyLaunchSlot"></span></div>'+
      '<p class="survey-round-note">Play Current Board runs one unsaved practice round using the question and answers in the editor. Launch Selected Game uses your selected saved boards in the chosen 1-, 3-, or 5-round order.</p>'+
      '<div id="surveyLaunchStatus" role="status" aria-live="polite" '+(lastLaunchStatus?'':'hidden')+' style="margin:9px 0;padding:10px 12px;border:1px solid #5485a1;border-radius:9px;background:#0a2840;color:#c1ffed;font-weight:750;">'+safe(lastLaunchStatus)+'</div>'+
      '<div class="survey-library-bottom survey-game-library"><h5>Saved Games <small>Load / Edit or play a complete game.</small></h5>'+
      (games.length?'<div class="survey-library-list">'+games.map(g=>
        '<article class="survey-library-item'+(g.id===editingGameId?' selected':'')+'">'+
        '<div class="survey-library-item-text"><strong>'+safe(g.name)+'</strong>'+
        '<span>'+g.length+' boards · '+g.rounds.map(b=>safe(b.name)).join(' → ')+'</span></div>'+
        '<div class="survey-library-item-buttons"><button type="button" data-survey-load-game="'+safe(g.id)+'">Load / Edit</button>'+
        '<button class="survey-play" type="button" data-survey-play-game="'+safe(g.id)+'">▶ Play</button>'+
        '<button class="survey-delete" type="button" data-survey-delete-game="'+safe(g.id)+'" aria-label="Delete saved game '+safe(g.name)+'">×</button></div></article>').join('')+'</div>':
        '<p class="survey-library-empty">No games saved yet. Assign a board to every round above, then Save Complete Game.</p>')+
      '</div></section>';
  }
  function draw(){
    if(!editorActive())return;
    const setup=document.querySelector('.crew-survey-setup');
    if(!setup||setup.querySelector('#surveyStudio'))return;
    const grid=setup.querySelector('.game-show-setup-grid');
    if(!grid)return;
    const studio=document.createElement('div');
    studio.id='surveyStudio';studio.className='survey-studio';
    studio.innerHTML=boardLibraryMarkup()+gameBuilderMarkup();
    grid.before(studio);
    const section=studio.querySelector('.survey-studio-board');
    if(section)section.querySelector('.survey-library-editor')?.after(grid);
    const launch=byId('launchCrewSurveyBtn'),slot=byId('surveyLaunchSlot');
    if(launch&&slot){slot.replaceWith(launch);launch.textContent='▶ LAUNCH SELECTED GAME';launch.title='Start the selected 1-, 3-, or 5-board Survey Game';}
    const n=byId('surveyBoardName'),gn=byId('surveyGameName');
    if(n)n.oninput=e=>boardName=e.target.value;
    if(gn)gn.oninput=e=>gameName=e.target.value;
    const wire=(name,fn)=>{const el=byId(name);if(el)el.onclick=fn};
    wire('surveySaveBoard',()=>saveBoard(false));wire('surveySaveCopy',()=>saveBoard(true));wire('surveyNewBoard',newBoard);
    wire('surveySaveGame',()=>saveGame(false));wire('surveyCopyGame',()=>saveGame(true));wire('surveyNewGame',newGame);
    wire('surveyPlayDraft',launchDraft);
    studio.querySelectorAll('[data-survey-load]').forEach(b=>b.onclick=()=>loadBoard(b.dataset.surveyLoad));
    studio.querySelectorAll('[data-survey-delete]').forEach(b=>b.onclick=()=>deleteBoard(b.dataset.surveyDelete));
    studio.querySelectorAll('[data-survey-length]').forEach(b=>b.onclick=()=>setLength(Number(b.dataset.surveyLength)));
    studio.querySelectorAll('[data-survey-round]').forEach(s=>s.onchange=()=>setRound(Number(s.dataset.surveyRound),s.value));
    studio.querySelectorAll('[data-survey-load-game]').forEach(b=>b.onclick=()=>loadGame(b.dataset.surveyLoadGame));
    studio.querySelectorAll('[data-survey-play-game]').forEach(b=>b.onclick=()=>playGame(b.dataset.surveyPlayGame));
    studio.querySelectorAll('[data-survey-delete-game]').forEach(b=>b.onclick=()=>deleteGame(b.dataset.surveyDeleteGame));
    if(launch)launch.onclick=launchSelected;
  }
  function launchDraft(){
    try{
      if(state.activityRun?.activityId&&state.activityRun.activityId!=='crew-survey-game'){
        tell('Finish the other activity before starting another Survey board.');return false;
      }
      const draft=draftBoard();
      if(!boardValid(draft)){
        tell('To play this board, enter a question and at least four answers in the editor below.');
        return false;
      }
      draft.id=draft.id||'teacher-preview';
      return launchPreparedSurvey([freezeBoard(draft)]);
    }catch(error){tell('Survey practice launch failed: '+String(error?.message||error));return false}
  }
  function launchSelected(){
    try{
      const result=launchCrewSurvey();
      if(!result||state.activityRun?.activityId!=='crew-survey-game'){
        if(!lastLaunchStatus)tell('Survey did not start. Select a saved board for every round.');
        return false;
      }
      return true;
    }catch(error){tell('CREW SURVEY launch error: '+String(error?.message||error));return false}
  }
  function captureLaunchClick(event){
    if(SESSION_ROLE!=='teacher'||state.activeApp!=='crew-survey')return;
    const target=event.target;
    if(!(target instanceof Element))return;
    const play=target.closest('[data-survey-play-game]');
    const launch=target.closest('#launchCrewSurveyBtn');
    const draft=target.closest('#surveyPlayDraft');
    if(!play&&!launch&&!draft)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try{
      if(play)playGame(play.dataset.surveyPlayGame);
      else if(draft)launchDraft();
      else launchSelected();
    }catch(error){tell('CREW SURVEY click failed: '+String(error?.message||error))}

  }
  function install(){
    if(installed||typeof renderActivities!=='function'||typeof loadGameStore!=='function')return;
    if(SESSION_ROLE!=='teacher')return;
    installed=true;load();wrapGameplay();
    document.addEventListener('click',captureLaunchClick,true);
    const prior=renderActivities;
    renderActivities=function(...args){const result=prior.apply(this,args);draw();return result};
    draw();
  }
  if(document.readyState==='complete')install();
  else window.addEventListener('load',install,{once:true});
})();


/* Read-only round counter in the separate Shared Screen view. The live
   run only carries opaque future board IDs, never upcoming answer text. */
(()=>{
  if(typeof window==='undefined'||window.__siSurveySharedRoundsInstalled)return;
  window.__siSurveySharedRoundsInstalled=true;
  function install(){
    if(typeof SESSION_ROLE==='undefined'||SESSION_ROLE!=='shared'||typeof crewSurveySharedMarkup!=='function')return;
    const original=crewSurveySharedMarkup;
    crewSurveySharedMarkup=function(...args){
      const html=original.apply(this,args),run=args[0]||state?.activityRun;
      if(!html||run?.activityId!=='crew-survey-game'||!run.crewSurveyTotal)return html;
      const num=Math.max(1,Math.min(5,Number(run.crewSurveyRoundIndex||0)+1));
      const total=Math.max(1,Math.min(5,Number(run.crewSurveyTotal||1)));
      const cs=run.crewSurvey||{},done=num===total&&cs.stage==='roundwon';
      const blue=Number(cs.scores?.[0]||0),red=Number(cs.scores?.[1]||0);
      const win=blue===red?'TIE GAME':blue>red?'BLUE CREW WINS':'RED CREW WINS';
      const banner='<div class="survey-shared-rounds"><b>ROUND '+num+' OF '+total+'</b>'+
        (done?'<strong>★ '+win+' · FINAL SCORE ★</strong>':
        '<span>Fresh face-off on each new board</span>')+'</div>';
      return html.replace(/(<div class="crew-survey-public[^>]*>)/,'$1'+banner);
    };
  }
  if(document.readyState==='complete')install();
  else window.addEventListener('load',install,{once:true});
})();


/* Crew Survey Showtime v1
   Keeps original Survey game state, answer authority and saved board/game format.
   Adds protected teacher faceoff actions, and display-only current-stage
   decorations and one-time reveal/strike effects. */
(()=>{
  if(typeof window==='undefined'||window.__siCrewSurveyShowtime)return;
  window.__siCrewSurveyShowtime=true;
  function start(){
    if(typeof crewSurveySharedMarkup!=='function'||typeof crewSurveyState!=='function')return;
    const escText=v=>typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    const role=typeof SESSION_ROLE!=='undefined'?SESSION_ROLE:'';
    const originalPublic=crewSurveySharedMarkup;

    // RenderPublic draws the teacher mirror and shared screen separately.
    // Track visual effects per viewport, so both receive each reveal/strike.
    const channels={normal:{stageKey:'',oldRevealed:null,oldStrikes:null},
      big:{stageKey:'',oldRevealed:null,oldStrikes:null}};
    crewSurveySharedMarkup=function(...args){
      const html=originalPublic.apply(this,args);
      const run=args[0]&&typeof args[0]==='object'?args[0]:state?.activityRun;
      if(!html||run?.activityId!=='crew-survey-game')return html;
      const cs=run.crewSurvey||{},round=Number(run.crewSurveyRoundIndex||0)+1;
      const total=Math.max(1,Number(run.crewSurveyTotal||1));
      const token=String(run.runToken||'')+'|'+round;
      const track=channels[args[1]?'big':'normal'];
      const freshRound=!!track.stageKey&&track.stageKey!==token;
      if(track.stageKey!==token){track.stageKey=token;track.oldRevealed=null;track.oldStrikes=null}
      const revealed=new Set(Array.isArray(cs.revealed)?cs.revealed.map(Number):[]);
      const freshReveals=track.oldRevealed===null?new Set():new Set([...revealed].filter(x=>!track.oldRevealed.has(x)));
      track.oldRevealed=revealed;
      const strikes=(Array.isArray(cs.strikes)?cs.strikes:[0,0]).map(x=>Math.max(0,Math.min(3,Number(x)||0)));
      const freshStrike=track.oldStrikes?strikes.some((x,i)=>x>track.oldStrikes[i]):false;
      track.oldStrikes=strikes;

      const stage=String(cs.stage||'faceoff').toLowerCase();
      const won=stage==='roundwon',buzzName=String(cs.buzzer?.winner||'');
      const buzzTeam=buzzName&&typeof crewSurveyTeamFor==='function'?crewSurveyTeamFor(buzzName,run):null;
      const controlTeam=cs.controlTeam==null?buzzTeam:Number(cs.controlTeam);
      const teamName=t=>t===0?'BLUE CREW':'RED CREW';
      const statusLabel=stage==='faceoff'?(buzzName?'FIRST BUZZ':'FACE-OFF'):
        stage==='steal'?'STEAL OPPORTUNITY':won?'ROUND COMPLETE':'BOARD IN PLAY';
      const cue=won?'ROUND POINTS AWARDED':stage==='steal'?'THREE STRIKES · STEAL AVAILABLE':
        stage==='faceoff'?(buzzName?'FIRST BUZZ · '+buzzName:cs.buzzer?.armed?'BUZZERS ARMED · FIRST SIGNAL WINS':'SELECT PLAYERS · ARM BUZZERS'):
        (controlTeam!==null?teamName(controlTeam)+' IN CONTROL':'BOARD IN PLAY')+' · FIND THE ANSWERS';
      const roster=Array.isArray(cs.teams)?cs.teams:[[],[]];
      const eligible=Array.isArray(cs.buzzer?.eligible)?cs.buzzer.eligible:[];
      const person=t=>{
        const selected=eligible.find(n=>(roster[t]||[]).includes(n));
        const name=stage==='faceoff'&&selected?selected:
          typeof crewSurveyActiveName==='function'?crewSurveyActiveName(t,run):roster[t]?.[0]||'';
        if(!name)return '<span class="cs-person-empty">Awaiting player</span>';
        const student=(state.students||[]).find(s=>s.n===name);
        return student&&typeof studentAvatarBadgeMarkup==='function'?
          studentAvatarBadgeMarkup(student):'<span class="cs-person-fallback">✦</span><span>'+esc(name)+'</span>';
      };
      const card=t=>'<div class="cs-faceoff-card '+(t===0?'blue':'red')+
        (controlTeam===t?' active':'')+'"><b>'+teamName(t)+'</b>'+
        '<div class="cs-faceoff-player">'+person(t)+'</div>'+
        '<small>'+(roster[t]?.length||0)+' CREW MEMBER'+((roster[t]?.length||0)===1?'':'S')+'</small></div>';
      const spotlight='<div class="cs-faceoff-spotlight">'+card(0)+
        '<div class="cs-faceoff-vs"><span>'+(won?'ROUND RESULT':stage==='faceoff'?'FACE-OFF':'CURRENT TURN')+
        '</span><strong>'+(stage==='faceoff'?'VS':won?'★':'▶')+'</strong>'+
        '<em>'+(buzzName?'BUZZ: '+esc(buzzName):cs.buzzer?.armed?'BUZZERS LIVE':'READY')+'</em></div>'+
        card(1)+'</div>';
      const cueMarkup='<div class="cs-show-cue" role="status"><span class="cs-cue-light"></span>'+esc(cue)+'</div>';
      const banner='<div class="cs-show-status" aria-label="Survey round status">'+
        '<span class="cs-show-stage">'+escText(statusLabel)+'</span>'+
        '<span class="cs-show-progress">BOARD '+round+' / '+total+'</span>'+
        '<span class="cs-show-progress">'+revealed.size+' / '+(run.crewSurveyConfig?.answers?.length||0)+' REVEALED</span></div>';
      let output=html.replace(/(<div class="crew-survey-public\b[^"]*)(")/,(_full,leading,quote)=>
        leading+' cs-showtime'+(freshRound?' cs-new-board':'')+'" data-cs-stage="'+stage+'"');
      // Append a stage/status rail only; the original game board remains authoritative.
      output=output.replace(/(<div class="crew-survey-stage-head">)/,banner+cueMarkup+spotlight+'$1');
      if(controlTeam!==null)output=output.replace('class="crew-survey-score '+(controlTeam===0?'blue':'red')+'"',
        'class="crew-survey-score '+(controlTeam===0?'blue':'red')+' cs-has-control"');
      let slot=-1;
      output=output.replace(/<div class="crew-survey-panel ([^"]*)">/g,(whole,cls)=>{
        slot++;
        return '<div class="crew-survey-panel '+cls+(freshReveals.has(slot)?' cs-new-reveal':'')+'">';
      });
      if(freshStrike){
        output=output.replace('class="crew-survey-footer"','class="crew-survey-footer cs-strike-alert"');
        const pos=output.lastIndexOf('</div>');
        if(pos>=0)output=output.slice(0,pos)+'<div class="cs-strike-flash" aria-hidden="true">✕</div>'+output.slice(pos);
      }
      if(freshRound){
        const pos=output.lastIndexOf('</div>');
        if(pos>=0)output=output.slice(0,pos)+'<div class="cs-round-intro" aria-hidden="true"><span>NEXT FACE-OFF</span><b>BOARD '+round+' / '+total+'</b></div>'+output.slice(pos);
      }
      if(stage==='roundwon'&&round===total){
        const left=Number(cs.scores?.[0]||0),right=Number(cs.scores?.[1]||0);
        const who=left===right?'IT\'S A TIE!':left>right?'BLUE CREW WINS!':'RED CREW WINS!';
        const finale='<div class="cs-show-finale" role="status"><span>★ FINAL ROUND COMPLETE ★</span>'+
          '<strong>'+escText(who)+'</strong><em>BLUE '+left+' · RED '+right+'</em></div>';
        const pos=output.lastIndexOf('</div>');
        if(pos>=0)output=output.slice(0,pos)+finale+output.slice(pos);
      }
      return output;
    };
    if(role==='teacher'){
      // A fourth X should not flip possession after steal is already available.
      if(typeof crewSurveyStrike==='function'){
        const priorStrike=crewSurveyStrike;
        crewSurveyStrike=function(...args){
          const cs=crewSurveyState();
          if(cs?.stage==='roundwon')return typeof toast==='function'?toast('Round awarded. Start the next board.'):undefined;
          if(cs?.stage==='steal'&&cs.stealAvailable)return typeof toast==='function'?toast('Steal opportunity is already active.'):undefined;
          return priorStrike.apply(this,args);
        };
      }
      if(typeof crewSurveyReveal==='function'){
        const priorReveal=crewSurveyReveal;
        crewSurveyReveal=function(...args){
          if(crewSurveyState()?.stage==='roundwon')return typeof toast==='function'?toast('Round already awarded. Advance to the next board.'):undefined;
          return priorReveal.apply(this,args);
        };
      }
      if(typeof crewSurveyArmBuzzers==='function'){
        const priorArm=crewSurveyArmBuzzers;
        crewSurveyArmBuzzers=function(...args){
          if(crewSurveyState()?.stage==='roundwon')return typeof toast==='function'?toast('Round complete. Advance to the next board.'):undefined;
          return priorArm.apply(this,args);
        };
      }
    }
  }
  if(document.readyState==='complete')start();
  else window.addEventListener('load',start,{once:true});
})();

/* MILLION SHOWTIME v2. Purely additive presentation and guarded teacher controls;
   game questions, crew predictions, locks, lifelines, and scoring retain their
   established state format and server authority. */
(()=>{
  if(typeof window==='undefined'||window.__siMillionShowtimeV2)return;
  window.__siMillionShowtimeV2=true;
  function install(){
    if(typeof millionSharedMarkup!=='function'||typeof millionStudentMarkup!=='function'||
       typeof renderActivityController!=='function'||typeof millionState!=='function')return;
    const escapeText=v=>typeof esc==='function'?esc(String(v??'')):String(v??'');
    const currency=v=>Math.max(0,Number(v||0)).toLocaleString();
    const earned=(run)=>{
      const m=run?.million||{},ladder=run?.millionConfig?.ladder||[];
      const level=Math.min(ladder.length,Math.max(0,Number(m.ladderLevel||0)));
      return level?Math.max(0,Number(ladder[level-1]||0)):0;
    };
    const stateLabel=m=>m.complete?'MISSION COMPLETE':m.over?'SIGNAL LOST':
      m.revealed?(m.result==='correct'?'SIGNAL CONFIRMED':'SIGNAL LOST'):
      m.lockedAnswer?'FINAL ANSWER LOCKED':m.pollOpen?'CREW POLL LIVE':'COMMAND SEAT LIVE';
    const originalShared=millionSharedMarkup,originalStudent=millionStudentMarkup;
    const originalHost=renderActivityController;
    const renderTracker={normal:{token:''},big:{token:''}};
    millionSharedMarkup=function(...args){
      const html=originalShared.apply(this,args),run=args[0]&&typeof args[0]==='object'?args[0]:state?.activityRun;
      if(!html||run?.activityId!=='million-game')return html;
      const m=run.million||{},cfg=run.millionConfig||{};
      const total=(cfg.questions||[]).length,index=Math.max(0,Number(m.questionIndex||0));
      const ladder=cfg.ladder||[],current=earned(run);
      const finished=!!m.complete,ended=finished||!!m.over;
      const status=stateLabel(m),track=renderTracker[args[1]?'big':'normal'];
      const marker=String(run.runToken||'')+'|'+index;
      const newQuestion=!!track.token&&track.token!==marker;
      track.token=marker;
      const completed=Math.min(total,index+(m.revealed?1:0));
      const progress=Array.from({length:total},(_,i)=>'<i class="'+(i===index?'current':i<index?'done':'')+
        '" aria-hidden="true"></i>').join('');
      const header='<section class="million-show-head" aria-label="Mission progress">'+
        '<div class="million-show-ident"><span class="million-show-emblem">◆</span><span><b>MISSION MILLION</b>'+
        '<small>QUESTION '+(index+1)+' / '+total+'</small></span></div>'+
        '<div class="million-show-status'+(ended?' finished':'')+'" role="status">'+escapeText(status)+'</div>'+
        '<div class="million-show-energy"><small>ENERGY EARNED</small><strong>'+currency(current)+'</strong></div>'+
        '</section><div class="million-show-progress" role="img" aria-label="'+completed+' of '+total+
        ' questions completed">'+progress+'</div>';
      let output=html.replace('class="million-public ','class="million-public million-showtime '+
        (newQuestion?'million-question-enter ':'')+'million-status-'+(finished?'complete':m.over?'lost':m.revealed?'revealed':m.lockedAnswer?'locked':'ready')+' ');
      output=output.replace('<main class="million-stage">','<main class="million-stage">'+header);
      const runEnd='<div class="million-show-end" role="status"><strong>'+
        (finished?'QUESTION SET COMPLETE':m.over?'RUN COMPLETE':'')+'</strong><span>'+
        currency(current)+' ENERGY EARNED</span></div>';
      if(finished){
        output=output.replace(/<div class="million-complete">[^<]*<\/div>/,
          '<div class="million-complete">'+(current>=Number(ladder[ladder.length-1]||Infinity)?
            '★ MILLION ENERGY MISSION COMPLETE ★':'★ ALL QUESTIONS COMPLETE · '+currency(current)+' ENERGY ★')+'</div>');
      }else if(m.over){
        output=output.replace('</main>',runEnd+'</main>');
      }
      // Present lock/reveal without exposing answer keys early. The original
      // markup is still the authority for which option may display as correct.
      if(m.lockedAnswer&&!m.revealed){
        output=output.replace('<div class="million-choices">',
          '<div class="million-show-lock">🔒 FINAL ANSWER LOCKED · AWAITING MISSION CONTROL</div><div class="million-choices">');
      }
      if(newQuestion){
        const overlay='<div class="million-show-new-question" aria-hidden="true"><span>NEXT SIGNAL</span>'+
          '<strong>QUESTION '+(index+1)+'</strong></div>';
        const pos=output.lastIndexOf('</div>');
        if(pos>=0)output=output.slice(0,pos)+overlay+output.slice(pos);
      }
      return output;
    };
    millionStudentMarkup=function(...args){
      let output=originalStudent.apply(this,args);
      const run=args[0]&&typeof args[0]==='object'?args[0]:state?.activityRun;
      if(!output||run?.activityId!=='million-game')return output;
      const m=run.million||{},total=run.millionConfig?.questions?.length||1;
      const i=Math.max(0,Number(m.questionIndex||0));
      output=output.replace('class="student-prompt million-student', 'class="student-prompt million-student million-student-showtime');
      if(m.complete){
        output=output.replace('1,000,000 Energy!',currency(earned(run))+' Energy!')
          .replace('The crew completed the mission ladder.',total===1?'The crew completed the question!':'The crew completed all '+total+' questions!');
      }
      const tag='<div class="million-student-progress" role="status"><span>QUESTION '+(i+1)+
        ' / '+total+'</span><span>'+escapeText(stateLabel(m))+'</span></div>';
      return output.replace('<span class="eyebrow">',tag+'<span class="eyebrow">');
    };
    let soundEnabled=false,audioContext=null;
    try{soundEnabled=localStorage.getItem('siMothership.millionSound.v1')==='on'}catch(_){}
    const cue=type=>{
      if(!soundEnabled||SESSION_ROLE!=='teacher')return;
      try{
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)return;
        audioContext=audioContext||new Audio();
        if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
        const frequencies=type==='miss'?[260,160]:type==='correct'?[520,660,880]:
          type==='next'?[420,600]:[540,810];
        const time=audioContext.currentTime;
        frequencies.forEach((freq,i)=>{
          const from=time+i*.16,osc=audioContext.createOscillator(),gain=audioContext.createGain();
          osc.type=type==='miss'?'triangle':'sine';osc.frequency.value=freq;
          gain.gain.setValueAtTime(.0001,from);
          gain.gain.exponentialRampToValueAtTime(.038,from+.02);
          gain.gain.exponentialRampToValueAtTime(.0001,from+.2);
          osc.connect(gain);gain.connect(audioContext.destination);osc.start(from);osc.stop(from+.22);
        });
      }catch(_){}
    };
    if(SESSION_ROLE==='teacher'){
      const originalResolve=millionResolve,originalNext=millionNextQuestion;
      const originalLifeline=millionUseLifeline;
      millionResolve=function(...args){
        const m=millionState();
        if(!m||m.revealed||m.over||m.complete)return;
        if(!m.lockedAnswer)return typeof toast==='function'?toast('Lock an answer before revealing.'):undefined;
        const result=originalResolve.apply(this,args);
        if(millionState()?.revealed)cue(millionState()?.result==='correct'?'correct':'miss');
        return result;
      };
      millionNextQuestion=function(...args){
        const m=millionState();
        if(!m)return;
        if(m.over)return typeof toast==='function'?toast('This run is over. Choose Play Again to restart.'):undefined;
        if(!m.revealed)return typeof toast==='function'?toast('Reveal the locked answer before advancing.'):undefined;
        const current=m.questionIndex;
        const result=originalNext.apply(this,args);
        if(millionState()?.questionIndex!==current)cue('next');
        return result;
      };
      millionUseLifeline=function(type,...args){
        const m=millionState();
        if(String(type)==='tryAgain'&&(m?.result==='correct'||m?.complete))
          return typeof toast==='function'?toast('Try Again cannot replay an already-correct answer.'):undefined;
        return originalLifeline.call(this,type,...args);
      };
    }
    function replayMillion(){
      const old=state.activityRun;
      if(SESSION_ROLE!=='teacher'||old?.activityId!=='million-game')return false;
      const cfg=old.millionConfig||{},m=old.million||{};
      if(!Array.isArray(cfg.questions)||!cfg.questions.length)return false;
      if(!confirm('Replay MILLION from Question 1? This will reset progress, lifelines and answers.'))return false;
      const crew=connectedStudents(),pilot=crew.some(s=>s.n===m.pilot)?m.pilot:crew[0]?.n||m.pilot||'';
      const inventory={poll:0,reduce:0,clue:0,tryAgain:0};
      Object.keys(inventory).forEach(k=>inventory[k]=Math.max(0,Number(cfg.lifelines?.[k]||0)));
      const fresh={
        activityId:'million-game',runToken:newActivityRunToken(),phase:'running',responses:{},
        millionConfig:typeof deepClone==='function'?deepClone(cfg):JSON.parse(JSON.stringify(cfg)),
        million:{
          questionIndex:0,pilot,pilotIndex:Math.max(0,crew.findIndex(s=>s.n===pilot)),
          ladderLevel:0,inventory,selectedAnswer:'',lockedAnswer:'',crewPredictions:{},
          eliminated:[],publicClue:'',pollOpen:false,pollVisible:false,revealed:false,
          result:'',over:false,complete:false,lastRequestId:'',
          message:'New MILLION run ready. Command Seat is open.'
        }
      };
      const previous=state.activityRun,screen=state.screen;
      state.activityRun=fresh;state.screen='activity';
      try{recordActivityLaunch('million','MILLION');render();}
      catch(e){state.activityRun=previous;state.screen=screen;try{render()}catch(_){};return false}
      cue('next');return true;
    }
    renderActivityController=function(...args){
      const result=originalHost.apply(this,args);
      const run=state.activityRun;
      if(SESSION_ROLE!=='teacher'||run?.activityId!=='million-game'||run.phase!=='running')return result;
      const root=document.getElementById('activityControllerPanel'),m=run.million||{},cfg=run.millionConfig||{};
      if(!root||root.querySelector('.million-show-command'))return result;
      const q=typeof millionQuestion==='function'?millionQuestion(run):cfg.questions?.[m.questionIndex];
      const final=!!m.complete||!!m.over,canReveal=!!m.lockedAnswer&&!m.revealed&&!final;
      const total=cfg.questions?.length||1,question=Math.max(0,Number(m.questionIndex||0))+1;
      const lock=String(m.lockedAnswer||'');
      const willCorrect=lock&&q?.correct===lock;
      const info=document.createElement('section');
      info.className='million-show-command';
      info.setAttribute('aria-label','MILLION Mission Control command deck');
      info.innerHTML='<div class="million-command-head"><div><b>◆ MILLION COMMAND DECK</b><span>'+
        escapeText(stateLabel(m))+' · QUESTION '+question+' / '+total+'</span></div>'+
        '<strong>'+currency(earned(run))+' <small>ENERGY</small></strong></div>'+
        '<div class="million-command-row">'+
        '<button type="button" class="million-command-reveal" data-million-show-action="reveal" '+
          (canReveal?'':'disabled')+'>◇ REVEAL LOCKED ANSWER</button>'+
        '<button type="button" data-million-show-action="next" '+(m.revealed&&!m.complete&&!m.over?'':'disabled')+
          '>NEXT QUESTION →</button>'+
        '<button type="button" data-million-show-action="replay">↻ PLAY AGAIN</button>'+
        '<button type="button" data-million-show-action="sound" aria-pressed="'+soundEnabled+'">'+
          (soundEnabled?'♪ SOUND ON':'♫ SOUND OFF')+'</button></div>'+
        '<p class="million-command-note">'+(final?'Run ended. Replay to reset or Finish & Return.':
          canReveal?'The locked answer is '+escapeText(lock)+'. Reveal checks the answer key automatically.':
          m.revealed?'Answer revealed. Advance when ready.':
          'Wait for the Command Seat student to select and lock an answer. Crew predictions remain private.')+'</p>';
      const h=root.querySelector('.activity-controller-head');
      if(h)h.after(info);else root.prepend(info);
      info.querySelectorAll('[data-million-show-action]').forEach(b=>b.onclick=()=>{
        const a=b.dataset.millionShowAction;
        if(a==='reveal'&&canReveal&&state.activityRun===run)
          millionResolve(Boolean(willCorrect));
        else if(a==='next'&&m.revealed&&!m.complete&&!m.over)millionNextQuestion();
        else if(a==='replay')replayMillion();
        else if(a==='sound'){
          soundEnabled=!soundEnabled;
          try{localStorage.setItem('siMothership.millionSound.v1',soundEnabled?'on':'off')}catch(_){}
          b.setAttribute('aria-pressed',String(soundEnabled));
          b.textContent=soundEnabled?'♪ SOUND ON':'♫ SOUND OFF';
          if(soundEnabled)cue('next');
        }
      });
      return result;
    };
  }
  if(document.readyState==='complete')install();
  else window.addEventListener('load',install,{once:true});
})();


/* SI MOTHERSHIP CLASSROOM COMMAND POLISH v1.
   Display-only teacher information / alert navigation. Preserves the original
   controls, events, permissions, state, and all game controllers. */
(()=>{
  if(typeof window==='undefined'||window.__siClassroomCommandPolish)return;
  window.__siClassroomCommandPolish=true;
  function install(){
    if(typeof renderControls!=='function'||typeof renderRight!=='function'||typeof renderPublic!=='function')return;
    const teacher=SESSION_ROLE==='teacher';
    const text=v=>typeof esc==='function'?esc(String(v??'')):String(v??'');
    function classroomPhaseLabel(run,ended){
      if(ended)return 'SESSION ENDED';
      if(!run)return 'CLASSROOM';
      if(run.phase==='lobby')return run.resumePending?'ACTIVITY PAUSED':'ACTIVITY LOADED';
      return 'ACTIVITY LIVE';
    }
    function liveStats(){
      const buzz=Array.isArray(state.buzz)?state.buzz.length:0;
      const ignored=new Set((state.helpDeletedIds||[]).map(String));
      const help=(state.helpMessages||[]).filter(m=>m&&!ignored.has(String(m.id))).length;
      const unread=(state.helpMessages||[]).filter(m=>m&&!ignored.has(String(m.id))&&!m.seen).length;
      const photos=Array.isArray(state.photos)?state.photos.length:0;
      const newPhotos=(state.photos||[]).filter(p=>p&&!p.seen).length;
      const hands=(state.alerts||[]).filter(a=>a&&a.type==='hand').length;
      return {buzz,help,photos,unread,newPhotos,hands,connected:typeof connectedStudents==='function'?connectedStudents().length:0};
    }
    const selectors={buzz:'buzzPanel',help:'helpInboxPanel',photo:'photoInboxPanel'};
    function visitInbox(kind){
      const panel=document.getElementById(selectors[kind]||'');
      if(!panel)return;
      if(typeof panel.scrollIntoView==='function'){
        const reduce=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        try{panel.scrollIntoView({behavior:reduce?'instant':'smooth',block:'center'})}
        catch(_){panel.scrollIntoView()}
      }
      panel.tabIndex=-1;
      try{panel.focus({preventScroll:true})}catch(_){}
      panel.classList.remove('si-inbox-focus');
      // Retrigger a visual cue even when the same inbox was selected earlier.
      void panel.offsetWidth;
      panel.classList.add('si-inbox-focus');
      if(panel.__siInboxFlash)clearTimeout(panel.__siInboxFlash);
      panel.__siInboxFlash=setTimeout(()=>panel.classList.remove('si-inbox-focus'),2100);
    }
    function wireAlertLinks(){
      if(!teacher)return;
      [['attentionBuzzChip','buzz'],['attentionHelpChip','help'],['attentionPhotoChip','photo']].forEach(([id,kind])=>{
        const chip=document.getElementById(id);
        if(!chip||chip.dataset.siAlertLink)return;
        chip.dataset.siAlertLink='true';
        chip.setAttribute('role','button');
        chip.setAttribute('tabindex','0');
        chip.addEventListener('click',()=>visitInbox(kind));
        chip.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();visitInbox(kind)}
        });
      });
      const summary=document.getElementById('attentionSummary');
      if(summary)summary.setAttribute('aria-label','Live classroom alerts. Choose Buzz, Help or Photos to open the corresponding inbox.');
      const launch=document.getElementById('launchSecondScreenBtn');
      if(launch)launch.title='Open the synchronized classroom display for Zoom or a second monitor';
    }
    function addToggleIndicator(button){
      if(!button.querySelector('.si-toggle-led')){
        const dot=document.createElement('span');
        dot.className='si-toggle-led';
        dot.setAttribute('aria-hidden','true');
        button.appendChild(dot);
      }
    }
    function setCounter(button,count){
      if(!button)return;
      let badge=button.querySelector('.si-mission-counter');
      if(count>0){
        if(!badge){
          badge=document.createElement('span');
          badge.className='si-mission-counter';
          badge.setAttribute('aria-hidden','true');
          button.appendChild(badge);
        }
        badge.textContent=count>99?'99+':String(count);
      }else if(badge)badge.remove();
    }
    function paintTeacher(){
      if(!teacher)return;
      const stats=liveStats(),bar=document.getElementById('teacherControlBar');
      if(!bar)return;
      wireAlertLinks();
      bar.classList.add('si-command-polish');
      const totalAlerts=stats.buzz+stats.help+stats.photos+stats.hands;
      bar.dataset.siAlerts=String(totalAlerts);
      bar.dataset.siPhase=classroomPhaseLabel(state.activityRun,!!state.ended).toLowerCase().replace(/[^a-z]+/g,'-');
      const copy=bar.querySelector('.mission-context-copy');
      if(copy){
        let line=copy.querySelector('.si-mission-readout');
        if(!line){
          line=document.createElement('div');
          line.className='si-mission-readout';
          line.setAttribute('role','status');
          line.setAttribute('aria-live','off');
          copy.appendChild(line);
        }
        const badgeText=classroomPhaseLabel(state.activityRun,!!state.ended);
        line.innerHTML='<span class="si-readout-mode">'+text(badgeText)+'</span>'+
          '<span>'+stats.connected+' connected</span>'+
          '<span class="'+(totalAlerts?'needs-attention':'')+'">'+
          (totalAlerts?[stats.hands?stats.hands+' hands':'',stats.buzz?stats.buzz+' buzz':'',stats.help?stats.help+' help':'',stats.photos?stats.photos+' photos':''].filter(Boolean).join(' · '):'All clear')+'</span>';
      }
      for(const key of ['hand','buzz','help','picture']){
        const btn=bar.querySelector('[data-toggle="'+key+'"]');
        if(!btn)continue;
        const enabled=!state.ended&&!!state[key+'Enabled'];
        const label={hand:'Raise Hand',buzz:'Buzz',help:'Ask for Help',picture:'Picture Prompt'}[key];
        const notices=key==='buzz'?stats.buzz:key==='help'?stats.help:key==='picture'?stats.photos:stats.hands;
        btn.dataset.siEnabled=enabled?'on':'off';
        btn.setAttribute('aria-pressed',String(enabled));
        btn.setAttribute('aria-label',label+' '+(enabled?'enabled':'paused')+
          (notices?' · '+notices+' active '+(notices===1?'request':'requests'):''));
        btn.title=label+': '+(enabled?'enabled':'paused')+(notices?' ('+notices+' active)':'');
        addToggleIndicator(btn);
        if(key==='buzz'||key==='help'||key==='picture')setCounter(btn,notices);
      }
      bar.querySelectorAll('[data-control],[data-send]').forEach(btn=>{
        const selected=btn.classList.contains('active');
        btn.setAttribute('aria-pressed',String(selected));
        btn.title=(btn.querySelector('b')?.textContent||'Classroom action').trim();
      });
      for(const [id,kind] of [['attentionBuzzChip','buzz'],['attentionHelpChip','help'],['attentionPhotoChip','photo']]){
        const el=document.getElementById(id);
        if(el)el.setAttribute('aria-label',kind.charAt(0).toUpperCase()+kind.slice(1)+
          ' inbox · '+stats[kind==='photo'?'photos':kind]+' active · open inbox');
      }
      const attention=document.getElementById('attentionSummary');
      if(attention){
        attention.classList.toggle('si-attention-live',stats.buzz+stats.help+stats.photos>0);
        attention.setAttribute('aria-live','off');
      }
      const quiet=stats.buzz+stats.help+stats.photos===0;
      const panels=[['buzzPanel',stats.buzz],['helpInboxPanel',stats.help],['photoInboxPanel',stats.photos]];
      panels.forEach(([id,count])=>{
        const panel=document.getElementById(id);
        if(panel)panel.dataset.siInboxCount=String(count);
      });
    }
    function paintStudent(){
      if(SESSION_ROLE!=='student')return;
      const controls=document.getElementById('studentControls');
      if(!controls)return;
      controls.querySelectorAll('button').forEach(btn=>{
        if(!btn.hasAttribute('aria-label')){
          const label=(btn.textContent||'').trim().replace(/\s+/g,' ');
          if(label)btn.setAttribute('aria-label',label);
        }
        btn.setAttribute('aria-disabled',String(!!btn.disabled));
        if(btn.hasAttribute('data-class-action'))btn.setAttribute('aria-pressed',String(btn.classList.contains('active')||btn.classList.contains('on')));
        else if(btn.classList.contains('active')||btn.classList.contains('on'))btn.setAttribute('aria-pressed','true');
      });
      const wrap=controls.closest('.student-control-zone');
      if(!wrap)return;
      let status=wrap.querySelector('#siStudentActionStatus');
      if(!status){
        status=document.createElement('div');status.id='siStudentActionStatus';
        status.className='si-student-action-status';status.setAttribute('role','status');
        status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
        controls.insertAdjacentElement('beforebegin',status);
      }
      const run=state.activityRun;
      const awaiting=typeof studentNeedsJoin==='function'&&studentNeedsJoin();
      const paused=run&&run.phase==='lobby'&&!!run.resumePending;
      const mode=state.ended?'ended':awaiting?'join':paused?'paused':run?.phase==='lobby'?'waiting':run?.phase==='running'?'live':state.screen==='brb'?'paused':state.screen==='lobby'?'waiting':'ready';
      const message=mode==='ended'?'Class session ended.':mode==='join'?'Join your class to activate controls.':
        mode==='paused'?'Paused — your progress is saved. Wait for your teacher to resume.':
        mode==='waiting'?'Waiting for your teacher to start the next activity.':
        mode==='live'?'Activity live — follow your game controls above.':
        'Classroom ready — choose a control when your teacher asks.';
      status.dataset.siMode=mode;
      if(status.textContent!==message)status.textContent=message;
    }
    if(teacher)wireAlertLinks();
    const formerControls=renderControls;
    renderControls=function(...args){
      const value=formerControls.apply(this,args);
      if(teacher)paintTeacher();
      return value;
    };
    const formerRight=renderRight;
    renderRight=function(...args){
      const value=formerRight.apply(this,args);
      if(teacher)paintTeacher();
      return value;
    };
    const formerPublic=renderPublic;
    renderPublic=function(...args){
      const value=formerPublic.apply(this,args);
      paintStudent();
      return value;
    };
    if(teacher){wireAlertLinks();paintTeacher()}
    else paintStudent();
  }
  if(document.readyState==='complete')install();
  else window.addEventListener('load',install,{once:true});
})();

/* Classroom Controls v1 — accessibility and reliable teacher feedback.
   Decorates existing controls only; never replaces their event handlers or
   modifies activity state, saved libraries, or student response semantics. */
(()=>{
  if(typeof window==='undefined'||window.__siClassControlPolishV1)return;
  window.__siClassControlPolishV1=true;
  function install(){
    if(typeof renderControls!=='function')return;
    const original=renderControls;
    const descriptions={
      lobby:'Send the class to the lobby',
      activities:'Open the activity library',
      agenda:'Open the class agenda',
      ready:'Start a ready check',
      emotion:'Open the emotion response prompt',
      understanding:'Open the understanding response prompt'
    };
    function decorate(){
      if(typeof SESSION_ROLE==='undefined'||SESSION_ROLE!=='teacher')return;
      const bar=document.getElementById('teacherControlBar');
      if(!bar)return;
      const activity=!!state.activityRun,ended=!!state.ended;
      bar.classList.toggle('mission-is-running',activity);
      bar.classList.toggle('mission-is-ended',ended);
      const pills=bar.querySelectorAll('[data-control],[data-send],[data-toggle]');
      pills.forEach(btn=>{
        const screen=btn.dataset.control||btn.dataset.send||'';
        const type=btn.dataset.toggle||'';
        if(screen){
          const active=!activity&&state.screen===screen;
          btn.setAttribute('aria-current',active?'page':'false');
          btn.setAttribute('aria-label',(descriptions[screen]||screen)+(active?' — currently shown':''));
          // Existing handlers block unsupported transitions during an activity.
          btn.title=activity&&screen!=='lobby'?'Return to Classroom to open '+screen:descriptions[screen]||screen;
        }
        if(type){
          const enabled=!!state[type+'Enabled'];
          btn.setAttribute('aria-pressed',String(enabled));
          btn.setAttribute('aria-label',(btn.querySelector('b')?.textContent||type)+
            ' — '+(enabled?'enabled for students':'paused for students'));
          btn.title=enabled?'Tap to pause this student response':'Tap to enable this student response';
        }
      });
      const emergency=bar.querySelector('#emergencyReturnBtn');
      if(emergency){
        emergency.setAttribute('aria-label','Emergency return to the classroom');
        emergency.title='Immediately return the class to the classroom';
      }
      const label=bar.querySelector('#teacherQuickStatus');
      if(label){
        label.setAttribute('role','status');
        label.setAttribute('aria-live','polite');
        label.setAttribute('aria-atomic','true');
      }
      const end=bar.querySelector('#endBtn');
      if(end){end.title='End this classroom session';end.setAttribute('aria-label','End session');}
    }
    renderControls=function(...args){
      const value=original.apply(this,args);
      try{decorate()}catch(e){console.warn('Mission Control visual feedback unavailable',e)}
      return value;
    };
    if(document.readyState==='complete')decorate();
  }
  if(document.readyState==='complete')install();
  else window.addEventListener('load',install,{once:true});
})();

/* Student connectivity truthfulness — transport-only UI, never game-state writes. */
(()=>{
 if(typeof window==='undefined'||window.__siStudentConnectionFeedbackV2)return;
 window.__siStudentConnectionFeedbackV2=true;
 function modeFromStudentStatus(stage,message){
  if(stage==='disconnected'||stage==='ended')return 'offline';
  if(stage==='paused')return 'paused';
  const msg=String(message||'').toLowerCase();
  if(/submitted|selected|received|accepted|verified|locked|you won|mission complete/.test(msg))return 'sent';
  if(/^waiting\b|^watch\b|^spectator\b|^face-off complete\b/.test(msg))return 'watch';
  if(/your turn|you have the controls|ready to send|choose your answer|choose an answer|send your survey answer|tap buzz|play along/.test(msg))return 'turn';
  if(stage==='waiting'||/waiting|watch|spectator|awaiting/.test(msg))return 'watch';
  return 'ready';
 }
 function networkHoldAction(btn,paused,key){
  // Remember the game's own disabled state, so reconnect never enables an
  // action that was already locked by turn rules, submission or a reveal.
  if(paused){
    if(btn.dataset[key]===undefined)btn.dataset[key]=btn.disabled?'disabled':'enabled';
    btn.disabled=true;
  }else if(btn.dataset[key]!==undefined){
    if(btn.dataset[key]==='enabled')btn.disabled=false;
    delete btn.dataset[key];
  }
  btn.setAttribute('aria-disabled',String(!!btn.disabled));
 }
 function studentNetworkUnavailable(){
  if(typeof SESSION_ROLE==='undefined'||SESSION_ROLE!=='student'||typeof state==='undefined')return false;
  if(typeof studentNeedsJoin!=='function'||studentNeedsJoin()||state.ended)return false;
  if(typeof NETWORK_SYNC==='undefined'||!NETWORK_SYNC)return false;
  return (typeof networkSessionReset!=='undefined'&&networkSessionReset)||
   typeof networkSocket==='undefined'||!networkSocket||networkSocket.readyState!==WebSocket.OPEN;
 }
 function paint(){
  if(typeof SESSION_ROLE==='undefined'||SESSION_ROLE!=='student'||typeof state==='undefined')return;
  const joined=typeof studentNeedsJoin==='function'&&!studentNeedsJoin();
  const online=!NETWORK_SYNC||(typeof networkSocket!=='undefined'&&networkSocket&&networkSocket.readyState===WebSocket.OPEN);
  const expired=typeof networkSessionReset!=='undefined'&&networkSessionReset;
  const mode=expired?'expired':online?'online':navigator.onLine===false?'offline':'reconnecting';
  const label=document.getElementById('studentConnectionLabel');
  const caption=!joined?'Join Class':mode==='online'?'Connected':mode==='expired'?'Session Expired':mode==='offline'?'Offline':'Reconnecting';
  if(label&&label.dataset.siConnection!==caption){
    label.dataset.siConnection=caption;
    label.innerHTML=(mode==='online'&&joined?'<span class="pulse"></span>':'<span aria-hidden="true">◌</span>')+' '+caption;
    label.setAttribute('role','status');label.setAttribute('aria-live','polite');
  }
  const status=document.getElementById('siStudentActionStatus');
  if(status&&joined&&!state.ended){
    const m=mode!=='online'?'disconnected':state.activityRun?.phase==='running'?'live':'other';
    const run=state.activityRun;
    let message=m==='disconnected'?(mode==='expired'?'Session expired — ask your teacher for a new link.':mode==='offline'?'Device offline — check your connection.':'Reconnecting — wait before sending another response.'):'';
    if(m==='live'&&typeof activeActivity==='function'){
      const app=activeActivity(),s=typeof selectedStudent==='function'?selectedStudent():null;
      if(app?.type==='match'&&s&&typeof matchState==='function'){
        const game=matchState(run),pilot=typeof matchActiveStudent==='function'?matchActiveStudent(run):null;
        message=game?.complete?'Match complete — nice work!':pilot?.n!==s.n?'Waiting for your turn — watch the shared board.':game?.locked||game?.teacherLocked||game?.pendingResolution?'Cards locked — wait for the reveal.':'Your turn — choose two cards.';
      }
      if(app?.type==='orbit'&&s&&typeof orbitResponse==='function')
        message=orbitResponse(s.n,run)?'Response received — thanks!':'Your response is ready to send.';
      if(app?.type==='starwheel'&&s&&typeof starwheelState==='function'){
        const wheel=starwheelState(run),pilot=typeof starwheelActivePilot==='function'?starwheelActivePilot(run):null;
        message=wheel?.solved?'Puzzle complete — great work!':pilot?.n!==s.n?'Waiting for your turn — watch the shared wheel.':wheel?.stage==='solve_pending'?'Answer submitted — awaiting teacher review.':'Your turn — use the Starwheel controls.';
      }
      if(app?.type==='sketch'&&s&&typeof sketchState==='function'){
        const sketch=sketchState(run),guess=sketch?.guesses?.[s.n];
        message=sketch?.reveal?'Round complete — nice work!':sketch?.artist===s.n?'Your turn — draw for the crew.':guess?.status==='accepted'?'Guess accepted — nice work!':guess?.status==='pending'?'Guess submitted — awaiting review.':'Watch the artist, then submit your guess.';
      }
      if(app?.type==='vector'&&s&&typeof vectorResponse==='function')
        message=vectorResponse(s.n,run)?.locked?'Vector submitted — waiting for teacher.':'Place your vector, then lock your answer.';
      if(app?.type==='bingo'&&s&&typeof bingoState==='function')
        message=bingoState(run)?.claimResults?.[s.n]?.valid?'BINGO verified — great work!':'Watch for calls and mark your own card.';
      if(app?.type==='crew-survey'&&s&&typeof crewSurveyState==='function'){
        const game=crewSurveyState(run),team=typeof crewSurveyTeamFor==='function'?crewSurveyTeamFor(s.n,run):null;
        const winner=game?.buzzer?.winner===s.n,faceoff=game?.stage==='faceoff';
        const eligible=(game?.buzzer?.eligible||[]).includes(s.n);
        const active=winner||((game?.stage==='play'||game?.stage==='steal')&&game?.controlTeam===team&&
          typeof crewSurveyActiveName==='function'&&crewSurveyActiveName(team,run)===s.n);
        const sent=typeof crewSurveyPrivateResponse==='function'&&crewSurveyPrivateResponse(s.n,run);
        message=sent?'Answer submitted privately — watch Mission Control.':
          faceoff&&eligible&&game?.buzzer?.armed&&!game?.buzzer?.winner?'Your turn — tap BUZZ!':
          active?'Your turn — send your survey answer.':
          faceoff&&game?.buzzer?.winner?'Face-off complete — watch the board.':
          'Watch the survey board and help your crew.';
      }
      if(app?.type==='million'&&s&&typeof millionState==='function'){
        const game=millionState(run),pilot=game?.pilot===s.n,guess=game?.crewPredictions?.[s.n];
        message=game?.complete?'Mission complete — the crew reached the top!':
          game?.over?'Run complete — wait for the next round.':
          game?.revealed?'Answer revealed — watch Mission Control.':
          pilot&&game?.lockedAnswer?'Final answer locked — awaiting reveal.':
          pilot&&game?.selectedAnswer?'Answer selected — lock it when ready.':
          pilot?'Your turn — select your answer.':
          guess?'Prediction selected — watch the command seat.':'Play along — choose an answer.';
      }
      if(app?.type==='cosmic-cards'&&s&&typeof cosmicActive==='function'){
        const game=cosmicActive(run),pilot=typeof cosmicPlayer==='function'?cosmicPlayer(run):null;
        message=game?.status==='won'?(game.winner===s.n?'You won the round!':'Round complete — watch the table.'):
          !game?.players?.includes(s.n)?'Spectator — watch the shared table.':
          pilot===s.n?'Your turn — play a highlighted card or draw.':
          'Waiting for your turn — watch the shared table.';
      }
      if(app?.type==='pixel'&&s&&typeof pixelGuess==='function')
        message=pixelGuess(s.n,run)?'Guess submitted — watch the reveal.':'Study the image, then send a private guess.';
      if(app?.type==='presentation'&&s&&typeof currentSlide==='function'&&typeof studentActivityResponse==='function'){
        const slide=currentSlide();
        if(slide&&['question','poll'].includes(slide.type))
          message=studentActivityResponse(s.n)?'Response selected — watch the presentation.':'Choose your answer below.';
      }
      if((app?.type==='binary'||app?.type==='exit')&&s&&typeof studentActivityResponse==='function')
        message=studentActivityResponse(s.n,0)?'Response selected — thank you!':'Choose an answer below.';
    }
    if(message){status.dataset.siMode=m;if(status.textContent!==message)status.textContent=message}
    else if(status.dataset.siMode==='disconnected'){
      const stage=run?.phase==='lobby'?(run.resumePending?'paused':'waiting'):run?.phase==='running'?'live':state.screen==='lobby'?'waiting':'ready';
      const recovered=stage==='paused'?'Paused — your progress is saved. Wait for your teacher to resume.':
        stage==='waiting'?'Waiting for your teacher to start the next activity.':
        stage==='live'?'Activity live — follow your game controls above.':
        'Classroom ready — choose a control when your teacher asks.';
      status.dataset.siMode=stage;status.textContent=recovered;
    }
  }
  // Reuse one compact identity strip; do not rerender buttons or interrupt game focus.
  const zone=document.querySelector('#student .student-control-zone');
  if(zone){
    let hud=document.getElementById('siStudentCrewHud');
    const student=joined&&typeof selectedStudent==='function'?selectedStudent():null;
    if(!student){if(hud)hud.remove()}
    else{
      if(!hud){
        hud=document.createElement('div');hud.id='siStudentCrewHud';hud.className='si-student-crew-hud';
        hud.setAttribute('aria-label','Your avatar and classroom status');
        const avatar=document.createElement('span');avatar.className='si-student-hud-avatar';avatar.setAttribute('aria-hidden','true');
        const identity=document.createElement('span');identity.className='si-student-hud-copy';
        const hint=document.createElement('small');hint.textContent='YOUR CREW ID';
        const name=document.createElement('strong');name.className='si-student-hud-name';
        identity.append(hint,name);
        const phase=document.createElement('span');phase.className='si-student-hud-phase';
        hud.append(avatar,identity,phase);
        const anchor=zone.querySelector('#studentControlLabel');
        if(anchor)zone.insertBefore(hud,anchor);else zone.prepend(hud);
      }
      const avatar=hud.querySelector('.si-student-hud-avatar');
      const asset=typeof avatarAsset==='function'?avatarAsset(student.avatarKey):null;
      const key=String(student.avatarKey||'default');
      if(avatar&&hud.dataset.siAvatarKey!==key){
        avatar.replaceChildren();avatar.style.setProperty('--si-avatar-color',asset?.color||student.c||'#5be8ff');
        if(asset&&(asset.source==='custom'||String(asset.key).startsWith('custom_'))&&asset.image){
          const image=document.createElement('img');image.src=asset.image;image.alt='';avatar.appendChild(image);
        }else avatar.textContent=asset?.glyph||'🚀';
        hud.dataset.siAvatarKey=key;
      }
      const name=hud.querySelector('.si-student-hud-name');
      if(name&&name.textContent!==student.n)name.textContent=student.n||'Student';
      const phase=hud.querySelector('.si-student-hud-phase');
      if(phase){
        const kind=modeFromStudentStatus(status?.dataset.siMode||'ready',status?.textContent||'');
        phase.dataset.siPhase=kind;
        const word=kind==='offline'?'OFFLINE':kind==='turn'?'YOUR TURN':kind==='sent'?'SENT':
          kind==='paused'?'PAUSED':kind==='watch'?'WATCH':'READY';
        if(phase.textContent!==word)phase.textContent=word;
      }
    }
  }
  const unavailable=studentNetworkUnavailable();
  document.querySelectorAll('#studentControls [data-class-action]').forEach(btn=>
    networkHoldAction(btn,unavailable,'siConnectionHold'));
  const gameActive=joined&&!state.ended&&state.activityRun?.phase==='running';
  const gamePanel=document.querySelector('#student .device-main');
  if(gamePanel){
    gamePanel.querySelectorAll('button').forEach(btn=>{
      if(btn.id==='studentCalculatorBackBtn')return;
      networkHoldAction(btn,unavailable&&gameActive,'siGameConnectionHold');
    });
    // Place the warning beside the game controls, not only in the footer.
    let warning=gamePanel.querySelector('#siStudentOfflineNotice');
    if(unavailable&&gameActive){
      if(!warning){
        warning=document.createElement('div');
        warning.id='siStudentOfflineNotice';warning.className='si-student-offline-notice';
        warning.setAttribute('role','status');warning.setAttribute('aria-live','polite');
        gamePanel.prepend(warning);
      }
      const note=mode==='expired'?'Session expired — ask your teacher for a new classroom link.':
        mode==='offline'?'You are offline. Game buttons are paused until the connection returns.':
        'Reconnecting… Game buttons are paused to prevent a missing response.';
      if(warning.textContent!==note)warning.textContent=note;
    }else if(warning)warning.remove();
  }
 }
 function init(){
  if(SESSION_ROLE!=='student')return;
  // Capture events immediately on disconnect, including the time between
  // socket loss and the next 1.2s visual refresh. Never block join or local
  // calculator navigation, only classroom and active-game submissions.
  const root=document.getElementById('student');
  if(root){
    root.addEventListener('click',event=>{
      if(!studentNetworkUnavailable())return;
      const target=event.target;
      const btn=target instanceof Element?target.closest('button'):null;
      if(!btn||btn.id==='studentCalculatorBackBtn')return;
      const classroom=!!btn.closest('#studentControls');
      const inGame=state.activityRun?.phase==='running'&&!!btn.closest('.device-main');
      if(classroom||inGame){
        event.preventDefault();event.stopImmediatePropagation();paint();
      }
    },true);
    root.addEventListener('submit',event=>{
      if(studentNetworkUnavailable()&&state.activityRun?.phase==='running'&&
         event.target instanceof Element&&event.target.closest('.device-main')){
        event.preventDefault();event.stopImmediatePropagation();paint();
      }
    },true);
  }
  const previous=renderPublic;
  renderPublic=function(...args){const result=previous.apply(this,args);paint();return result};
  paint();setInterval(paint,1200);
 }
 if(document.readyState==='complete')init();
 else window.addEventListener('load',init,{once:true});
})();
