/* Board-first Bingo authoring. The existing Bingo activity runner is unchanged. */
let bbsQuery='',bbsRecent=false;
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
    '<div class="bbs-library-grid">'+(assets.length?assets.map(a=>'<button type="button" data-bbs-image="'+esc(a.id)+
      '" data-bbs-name="'+esc(String(a.name||'').toLowerCase())+'" class="bbs-library-image'+(selected.has(a.id)?' checked':'')+
      '" aria-pressed="'+selected.has(a.id)+'"><img src="'+a.image+'" alt=""><span>'+esc(a.name)+'</span>'+
      (selected.has(a.id)?'<b class="bbs-image-check">✓</b>':'')+'</button>').join(''):
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
    '</h2><p>Upload to library → Check pictures → Create Board, or type directly on the physical grid.</p></div>'+
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
async function bbsImport(files){
  const list=Array.from(files||[]).filter(f=>String(f.type||'').startsWith('image/')).slice(0,48);
  if(!list.length)return;
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
    $$('[data-bbs-image]').forEach(b=>{b.hidden=!b.dataset.bbsName.includes(query)})
  };
  $$('[data-bbs-image]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.bbsImage,selection=bbsSelected(),set=new Set(selection);
    if(set.has(id))set.delete(id);
    else if(set.size>=bbsNeed())return toast('Already checked '+bbsNeed()+' pictures. Uncheck one to choose another.');
    else set.add(id);
    bingoDraft.selectedImages=[...set];bbsUpdateSelections()
  });
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
