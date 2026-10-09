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
 const phaseLabel=dock.querySelector('.si-control-caption small');
 if(phaseLabel){const text=a.phase==='lobby'?'ACTIVITY LOADED · READY TO START':'MISSION CONTROL · LIVE';if(phaseLabel.textContent!==text)phaseLabel.textContent=text;}
}
function start(){
 if(typeof SESSION_ROLE==='undefined'||SESSION_ROLE!=='teacher')return;
 setInterval(tick,320);
 window.addEventListener('beforeunload',popClose);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();


/* Crew Survey Board Library v1 — teacher-only, reusable board authoring.
   Attaches to the existing Survey editor after the base script is loaded.
   Existing game run, student/teacher controls and saved Bingo/MATCH sets untouched. */
(()=>{
  if(typeof window==='undefined'||window.__siSurveyBoardLibraryInstalled)return;
  window.__siSurveyBoardLibraryInstalled=true;
  const KEY='siMothership.crewSurveyBoards.v1';
  let boards=[],editingId='',draftName='',busy=false,installed=false;
  let gameLength=1,roundIds=[];
  const byId=id=>document.getElementById(id);
  const safe=value=>typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const message=s=>{if(typeof toast==='function')toast(s)};
  function cleanBoard(record){
    if(!record||typeof record!=='object')return null;
    const answers=(Array.isArray(record.answers)?record.answers:[]).slice(0,8).map(x=>({
      text:String(x?.text||'').slice(0,70),
      value:Math.max(0,Math.min(999,Number(x?.value)||0))
    }));
    if(!answers.length)return null;
    while(answers.length<4)answers.push({text:'',value:0});
    return {
      id:String(record.id||'').slice(0,90),
      name:String(record.name||'Untitled Survey').trim().slice(0,90)||'Untitled Survey',
      prompt:String(record.prompt||'').slice(0,240),
      answers,scoring:record.scoring!==false,
      aacVocab:(Array.isArray(record.aacVocab)?record.aacVocab:[]).map(x=>String(x).trim().slice(0,30)).filter(Boolean).slice(0,10),
      createdAt:Number(record.createdAt)||Date.now(),
      updatedAt:Number(record.updatedAt)||Date.now()
    };
  }
  function load(){
    const list=typeof loadGameStore==='function'?loadGameStore(KEY,[]):[];
    boards=list.map(cleanBoard).filter(Boolean).filter(x=>x.id);
  }
  function editorActive(){
    return typeof state!=='undefined'&&typeof SESSION_ROLE!=='undefined'&&SESSION_ROLE==='teacher'&&
      state.activeApp==='crew-survey'&&!state.activityRun&&!!document.querySelector('.crew-survey-setup');
  }
  function snapshot(){
    if(typeof crewSurveyDraft==='undefined')return null;
    const d=crewSurveyDraft;
    return {
      prompt:String(d.prompt||'').slice(0,240),
      answers:(d.answers||[]).slice(0,8).map(x=>({text:String(x.text||'').slice(0,70),value:Math.max(0,Math.min(999,Number(x.value)||0))})),
      scoring:!!d.scoring,
      aacVocab:(d.aacVocab||[]).map(x=>String(x).trim().slice(0,30)).filter(Boolean).slice(0,10)
    };
  }
  function createId(){
    return 'survey_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
  }
  async function commit(next){
    if(busy)return false;
    busy=true;
    try{
      const value=JSON.stringify(next);
      const remote=typeof NETWORK_SYNC!=='undefined'&&NETWORK_SYNC&&SESSION_ROLE==='teacher';
      if(remote){
        let response;
        try{
          response=await fetch('/api/storage',{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({key:KEY,value})
          });
          if(!response.ok||!(await response.json())?.ok)throw Error('unconfirmed');
        }catch(_){message('Survey boards were not saved on the server. Please retry.');return false}
      }
      let localSaved=true;
      try{localStorage.setItem(KEY,value)}catch(_){localSaved=false}
      if(!localSaved&&!remote){message('Could not save survey board in browser storage.');return false}
      if(!localSaved&&remote)message('Saved on Mothership; local browser storage is full.');
      boards=next;
      return true;
    }finally{busy=false}
  }
  function openBoard(id){
    if(busy)return;
    const entry=boards.find(x=>x.id===id);
    if(!entry){message('Survey board not found.');return}
    editingId=entry.id;
    draftName=entry.name;
    crewSurveyDraft={
      prompt:entry.prompt,answers:entry.answers.map(x=>({...x})),
      scoring:entry.scoring,
      aacVocab:[...entry.aacVocab],aacStudents:[]
    };
    renderActivities();
    message('Loaded survey: '+entry.name);
  }
  function playBoard(id){
    openBoard(id);
    // Launch uses the existing teacher game rules and student count validation.
    if(typeof launchCrewSurvey==='function')launchCrewSurvey();
  }
  function blankBoard(){
    if(busy)return;
    editingId='';
    draftName='';
    crewSurveyDraft={
      prompt:'',answers:Array.from({length:4},()=>({text:'',value:0})),
      scoring:true,aacVocab:['Yes','No','Maybe','Other','Pass'],aacStudents:[]
    };
    renderActivities();
  }
  async function saveBoard(duplicate=false){
    if(busy)return;
    const current=snapshot();
    if(!current)return;
    const name=(byId('surveyBoardName')?.value||draftName||current.prompt||'Untitled Survey').trim().slice(0,90);
    if(!current.prompt.trim()){message('Enter a survey question before saving.');return}
    if(current.answers.filter(x=>x.text.trim()).length<1){message('Add an answer before saving.');return}
    const existing=!duplicate?boards.find(x=>x.id===editingId):null;
    const now=Date.now();
    const entry=cleanBoard({
      ...current,id:existing?.id||createId(),name,
      createdAt:existing?.createdAt||now,updatedAt:now
    });
    const next=[entry,...boards.filter(x=>x.id!==entry.id)];
    if(!(await commit(next)))return;
    editingId=entry.id;draftName=entry.name;
    renderActivities();
    message(existing?'Survey board updated':'Survey board saved');
  }
  async function deleteBoard(id){
    if(busy)return;
    const entry=boards.find(x=>x.id===id);
    if(!entry||!confirm('Delete saved survey board "'+entry.name+'"? This cannot be undone.'))return;
    if(!(await commit(boards.filter(x=>x.id!==id))))return;
    if(editingId===id)editingId='';
    roundIds=roundIds.map(x=>x===id?'':x);
    renderActivities();
    message('Deleted survey board '+entry.name);
  }

  /* Round 1 uses the board currently open in the editor. Later rounds load
     only opaque saved-board IDs into the class state: no future answer text
     is distributed to student or shared devices ahead of its face-off. */
  function roundsUI(){
    const options=boards.filter(b=>b.id!==editingId);
    const slots=Array.from({length:gameLength-1},(_,i)=>{
      const id=roundIds[i]||'';
      const usable=options.some(b=>b.id===id);
      return '<label class="survey-round-select">ROUND '+(i+2)+
        '<select data-survey-round="'+i+'"><option value="">Choose a saved board…</option>'+
        options.map(b=>'<option value="'+safe(b.id)+'" '+(b.id===id?'selected':'')+'>'+
        safe(b.name)+' · '+safe(b.prompt)+'</option>').join('')+'</select>'+
        (!usable&&id?'<span class="survey-round-warning">This board is missing; choose another.</span>':'')+
        '</label>';
    }).join('');
    return '<section class="survey-rounds-panel" aria-label="Survey game length and board order">'+
      '<div class="survey-rounds-heading"><div><span class="survey-library-eyebrow">GAME SETUP</span>'+
      '<h4>How many survey boards?</h4><p>Each board gets a new face-off. Crew scores carry through all rounds.</p></div>'+
      '<span class="survey-round-count">'+gameLength+' BOARD'+(gameLength===1?'':'S')+'</span></div>'+
      '<div class="survey-round-count-buttons">'+[1,3,5].map(n=>
        '<button type="button" data-survey-length="'+n+'" aria-pressed="'+(gameLength===n)+'" class="'+(gameLength===n?'selected':'')+'">'+
        n+' BOARD'+(n===1?'':'S')+'</button>').join('')+'</div>'+
      '<div class="survey-round-order"><div class="survey-round-first"><b>ROUND 1 · CURRENT BOARD</b><span>'+
      safe(draftName||crewSurveyDraft.prompt||'Board being edited above')+'</span></div>'+
      slots+'</div>'+
      (gameLength>1?'<p class="survey-round-note">Select '+(gameLength-1)+' different saved boards for the remaining rounds. Save any new boards first.</p>':
      '<p class="survey-round-note">Play a single board, with a new face-off whenever you replay.</p>')+
      '</section>';
  }
  function validRoundSequence(){
    if(gameLength===1)return [];
    const picked=roundIds.slice(0,gameLength-1);
    if(picked.length!==gameLength-1||picked.some(x=>!x)){
      message('Choose a saved board for each of the '+gameLength+' rounds.');return null;
    }
    if(new Set(picked).size!==picked.length||picked.includes(editingId)){
      message('Select a different board for each round.');return null;
    }
    for(const id of picked){
      const board=boards.find(x=>x.id===id);
      if(!board||!board.prompt.trim()||board.answers.filter(a=>a.text.trim()).length<4){
        message('One selected board is missing or needs at least four answers.');return null;
      }
    }
    return picked;
  }
  function roundRun(){
    const run=typeof state!=='undefined'?state.activityRun:null;
    return run?.activityId==='crew-survey-game'&&run.crewSurveyTotal?run:null;
  }
  function winnerLine(cs){
    const scores=cs.scores||[0,0];
    const blue=Number(scores[0]||0),red=Number(scores[1]||0);
    return blue===red?'TIE GAME':blue>red?'BLUE CREW WINS':'RED CREW WINS';
  }
  function advanceSurvey(original){
    const run=roundRun();
    if(!run)return original();
    const cs=run.crewSurvey,total=Number(run.crewSurveyTotal||1),index=Number(run.crewSurveyRoundIndex||0);
    if(index>=total-1){
      if(cs?.stage==='roundwon'){message('All '+total+' survey boards are complete. '+winnerLine(cs)+'.');return}
      if(!confirm('Replay this final board and reset its reveals and strikes?'))return;
      original();
      cs.message='Replay face-off · Board '+total+' of '+total+'.';
      render();return;
    }
    if(cs?.stage!=='roundwon'&&!confirm('Move to the next board without awarding this round? Current round points will not be added.'))return;
    const id=(run.crewSurveyPlaylistIds||[])[index]||'';
    const board=boards.find(x=>x.id===id);
    if(!board){message('Next survey board not found in the teacher library. Return to Survey setup to check saved boards.');return}
    const previous=run.crewSurveyConfig||{},members=cs?.teams||[[],[]],next=index+1;
    run.crewSurveyConfig={
      prompt:board.prompt,
      answers:board.answers.filter(a=>a.text.trim()).map((a,i)=>({id:i+1,text:a.text.trim(),value:Number(a.value||0)})),
      scoring:board.scoring,
      aacVocab:[...board.aacVocab],
      aacStudents:[...(previous.aacStudents||[])]
    };
    run.crewSurveyRoundIndex=next;
    original(); // existing reset keeps scores, teams and creates a fresh face-off
    const now=run.crewSurvey;
    if(now){
      now.activeIndexes=[next%Math.max(1,members[0]?.length||1),next%Math.max(1,members[1]?.length||1)];
      now.buzzer.eligible=[members[0]?.[now.activeIndexes[0]],members[1]?.[now.activeIndexes[1]]].filter(Boolean);
      now.message='Board '+(next+1)+' of '+total+' · New face-off. Arm the buzzers!';
    }
    render(); // synchronize fresh question and rotating contestants to students and shared screen
    message('Round '+(next+1)+' of '+total+': '+board.name);
  }
  function drawHostRounds(){
    const run=roundRun();if(!run||run.phase!=='running')return;
    const box=byId('activityControllerPanel'),cs=run.crewSurvey;
    if(!box||!cs)return;
    const n=Number(run.crewSurveyRoundIndex||0)+1,total=Number(run.crewSurveyTotal||1);
    const finished=n===total&&cs.stage==='roundwon';
    const head=box.querySelector('.activity-controller-head');
    if(head&&!box.querySelector('.survey-host-rounds')){
      const info=document.createElement('div');
      info.className='survey-host-rounds';
      info.innerHTML='<b>BOARD '+n+' / '+total+'</b><span>'+
        (finished?'GAME COMPLETE · '+safe(winnerLine(cs)):safe(run.crewSurveyConfig?.prompt||''))+
        '</span><strong>BLUE '+Number(cs.scores?.[0]||0)+' · RED '+Number(cs.scores?.[1]||0)+'</strong>';
      head.after(info);
    }
    const next=byId('crewSurveyNewRoundBtn');
    if(next){
      next.textContent=finished?'✓ Game Complete':n<total?'→ Next Board & Face-Off':'↻ Replay This Board';
      next.disabled=finished;
      next.title=finished?'Finish & Return when you are ready':n<total?'Advance to board '+(n+1)+' of '+total:'Replay this last board';
    }
  }
  function wrapGameplay(){
    if(typeof launchCrewSurvey!=='function'||typeof crewSurveyNewRound!=='function'||typeof renderActivityController!=='function')return;
    const origLaunch=launchCrewSurvey,origNewRound=crewSurveyNewRound,origControl=renderActivityController;
    const origAward=typeof crewSurveyAwardRound==='function'?crewSurveyAwardRound:null;
    if(origAward)crewSurveyAwardRound=function(...args){
      const run=roundRun();
      if(run?.crewSurvey?.stage==='roundwon'){
        message('That survey round has already been awarded. Move to the next board.');return;
      }
      return origAward.apply(this,args);
    };
    launchCrewSurvey=function(...args){
      const queue=validRoundSequence();
      if(queue===null)return;
      const previous=state.activityRun;
      const result=origLaunch.apply(this,args);
      const run=state.activityRun;
      if(run&&run!==previous&&run.activityId==='crew-survey-game'){
        run.crewSurveyTotal=gameLength;
        run.crewSurveyRoundIndex=0;
        run.crewSurveyPlaylistIds=queue;
        render();
      }
      return result;
    };
    crewSurveyNewRound=function(...args){return advanceSurvey(()=>origNewRound.apply(this,args))};
    renderActivityController=function(...args){const result=origControl.apply(this,args);drawHostRounds();return result};
    if(typeof crewSurveySharedMarkup==='function'){
      const origPublic=crewSurveySharedMarkup;
      crewSurveySharedMarkup=function(...args){
        const html=origPublic.apply(this,args),run=roundRun();
        if(!run||!html)return html;
        const cs=run.crewSurvey,n=Number(run.crewSurveyRoundIndex||0)+1,total=Number(run.crewSurveyTotal||1);
        const done=n===total&&cs?.stage==='roundwon';
        const banner='<div class="survey-shared-rounds"><b>ROUND '+n+' OF '+total+'</b>'+
          (done?'<strong>★ '+safe(winnerLine(cs))+' · FINAL SCORE ★</strong>':
            '<span>Next face-off begins on a new board</span>')+'</div>';
        return html.replace(/(<div class="crew-survey-public[^>]*>)/, '$1'+banner);
      };
    }
  }
  function draw(){
    if(!editorActive())return;
    const setup=document.querySelector('.crew-survey-setup');
    if(!setup||setup.querySelector('#surveyBoardLibrary'))return;
    const panel=document.createElement('section');
    panel.id='surveyBoardLibrary';
    panel.className='survey-board-library';
    panel.setAttribute('aria-label','Save and load Survey boards');
    const selected=boards.find(x=>x.id===editingId);
    panel.innerHTML='<div class="survey-library-top"><div>'+
      '<span class="survey-library-eyebrow">TEACHER BOARD LIBRARY</span>'+
      '<h4>Save & Reuse Survey Boards</h4>'+
      '<p>Keep your questions, hidden answers, point values, and AAC vocabulary for another class session.</p>'+
      '</div><span class="survey-library-count">'+boards.length+' SAVED</span></div>'+
      '<div class="survey-library-editor"><label for="surveyBoardName">BOARD NAME</label>'+
      '<input type="text" id="surveyBoardName" maxlength="90" placeholder="e.g. Things at School" value="'+safe(draftName)+'">'+
      '<div class="survey-library-actions">'+
      '<button type="button" id="surveySaveBoard" class="survey-save-primary">'+(selected?'✓ Update Saved Board':'💾 Save Board')+'</button>'+
      '<button type="button" id="surveySaveCopy">Duplicate / Save Copy</button>'+
      '<button type="button" id="surveyNewBoard">＋ New Blank Board</button>'+
      '</div></div>'+
      '<div class="survey-library-bottom"><h5>Saved Boards <small>Choose Load to edit, or Play to launch</small></h5>'+
      (boards.length?'<div class="survey-library-list">'+boards.map(b=>
        '<article class="survey-library-item'+(b.id===editingId?' selected':'')+'">'+
        '<div class="survey-library-item-text"><strong>'+safe(b.name)+'</strong>'+
        '<span>'+safe(b.prompt)+'</span>'+
        '<small>'+b.answers.filter(x=>x.text.trim()).length+' answers'+(b.scoring?' · scoring on':' · no scoring')+'</small></div>'+
        '<div class="survey-library-item-buttons">'+
        '<button type="button" data-survey-load="'+safe(b.id)+'">Load / Edit</button>'+
        '<button type="button" data-survey-play="'+safe(b.id)+'" class="survey-play">▶ Play</button>'+
        '<button type="button" data-survey-delete="'+safe(b.id)+'" class="survey-delete" aria-label="Delete '+safe(b.name)+'">×</button>'+
        '</div></article>').join('')+'</div>':
        '<p class="survey-library-empty">No saved boards yet. Enter a question and answers below, name your board, then press Save Board.</p>')+
      '</div>'+roundsUI();
    // Survey setup follows the teacher's creation flow: game length first,
    // then name/save the current board, then choose later round boards.
    // Moving the existing elements preserves their IDs and save/load handlers.
    const roundsPanel=panel.querySelector('.survey-rounds-panel');
    const lengthChoices=roundsPanel?.querySelector('.survey-round-count-buttons');
    const nameEditor=panel.querySelector('.survey-library-editor');
    const savedList=panel.querySelector('.survey-library-bottom');
    if(roundsPanel&&lengthChoices&&nameEditor&&savedList){
      lengthChoices.after(nameEditor);
      savedList.before(roundsPanel);
    }
    setup.querySelector('.game-show-setup-grid')?.before(panel);
    const nameField=byId('surveyBoardName');
    if(nameField)nameField.oninput=e=>draftName=e.target.value;
    const save=byId('surveySaveBoard'),copy=byId('surveySaveCopy'),blank=byId('surveyNewBoard');
    if(save)save.onclick=()=>saveBoard(false);
    if(copy)copy.onclick=()=>saveBoard(true);
    if(blank)blank.onclick=blankBoard;
    panel.querySelectorAll('[data-survey-load]').forEach(el=>el.onclick=()=>openBoard(el.dataset.surveyLoad));
    panel.querySelectorAll('[data-survey-play]').forEach(el=>el.onclick=()=>playBoard(el.dataset.surveyPlay));
    panel.querySelectorAll('[data-survey-delete]').forEach(el=>el.onclick=()=>deleteBoard(el.dataset.surveyDelete));
    panel.querySelectorAll('[data-survey-length]').forEach(el=>el.onclick=()=>{
      gameLength=Number(el.dataset.surveyLength);
      roundIds=roundIds.slice(0,gameLength-1);
      renderActivities();
    });
    panel.querySelectorAll('[data-survey-round]').forEach(el=>el.onchange=()=>{
      roundIds[Number(el.dataset.surveyRound)]=el.value;
      renderActivities();
    });
    const launch=byId('launchCrewSurveyBtn');
    if(launch)launch.onclick=launchCrewSurvey;
  }
  function install(){
    if(installed||typeof renderActivities!=='function'||typeof loadGameStore!=='function')return;
    if(typeof SESSION_ROLE==='undefined'||SESSION_ROLE!=='teacher')return;
    installed=true;load();wrapGameplay();
    const originalRender=renderActivities;
    renderActivities=function(...args){const result=originalRender.apply(this,args);draw();return result};
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
