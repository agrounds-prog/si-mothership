/* SI Mothership MATCH Set Studio v2. Content authoring only; game runtime remains unchanged. */
function matchBuilderMode(){return ['images','pairs','quick'].includes(matchDraft.editorMode)?matchDraft.editorMode:'images'}
function matchBuilderAssetIds(){return (matchDraft.selectedImages||[]).filter((id,i,ids)=>ids.indexOf(id)===i&&gameImageLibrary.some(a=>a.id===id)).slice(0,24)}
function matchBuilderImageCount(){return Math.max(4,Math.min(24,Number(matchDraft.imageCount||12)))}
function matchBuilderPairs(){
  const mode=matchBuilderMode();
  if(mode==='images')return pairsFromSelectedImages(matchBuilderAssetIds().slice(0,matchBuilderImageCount()));
  if(mode==='quick')return parsePairLines(matchDraft.quick||'').slice(0,24);
  return (matchDraft.manualPairs||[]).slice(0,24).filter(p=>
    p&&['a','b'].every(key=>{
      const side=p[key]||{};
      return side.type==='image'?(typeof side.value==='string'&&/^data:image\//.test(side.value)):
        (typeof side.value==='string'&&!!side.value.trim())
    })).map((p,i)=>({id:String(p.id||'manual_'+i),a:{...p.a},b:{...p.b}}));
}
function matchBuilderEsc(x){return esc(x)}
function matchBuilderNewPair(a=null,b=null){
  return {id:'manual_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),
    a:a||{type:'text',value:''},b:b||{type:'text',value:''}};
}
function matchBuilderPairImageOptions(side){
  const chosen=gameImageLibrary.find(a=>a.image===side.value);
  return '<option value=""'+(!chosen?' selected':'')+'>'+(side.value?'Saved picture (kept until changed)':'Choose a saved image')+'</option>'+
    gameImageLibrary.map(a=>'<option value="'+matchBuilderEsc(a.id)+'"'+(chosen?.id===a.id?' selected':'')+'>'+matchBuilderEsc(a.name)+'</option>').join('');
}
function matchBuilderSideMarkup(pair,index,key){
  const side=pair[key]||{type:'text',value:''},isImage=side.type==='image';
  return '<div class="mcb-side"><label>TILE '+key.toUpperCase()+
    '<select data-mcb-kind="'+index+':'+key+'"><option value="text"'+(!isImage?' selected':'')+'>Text</option>'+
    '<option value="image"'+(isImage?' selected':'')+'>Image</option></select></label>'+
    (isImage?'<div class="mcb-side-image">'+(side.value?contentMarkup(side):'<span class="mcb-image-placeholder">＋</span>')+'</div>'+
      '<label>Saved picture<select data-mcb-img="'+index+':'+key+'">'+matchBuilderPairImageOptions(side)+'</select></label>'+
      '<button type="button" class="mcb-side-upload" data-mcb-upload-side="'+index+':'+key+'">＋ Upload for Tile '+key.toUpperCase()+'</button>'+
      '<input type="file" accept="image/*" data-mcb-upload-file="'+index+':'+key+'" hidden>':
      '<label>Text on tile<input data-mcb-text="'+index+':'+key+'" value="'+matchBuilderEsc(side.value||'')+'" placeholder="Type word, answer, or description" maxlength="240"></label>')+
    '</div>';
}
function matchBuilderManualMarkup(){
  const pairs=matchDraft.manualPairs||[];
  return '<div class="mcb-section-head"><div><h3>PAIR BUILDER</h3><p>Design two sides of each match independently. Mix words, pictures, questions and answers.</p></div>'+
    '<button type="button" class="mcb-add" id="mcbAddPair"'+(pairs.length>=24?' disabled':'')+'>＋ Add Pair</button></div>'+
    '<div class="mcb-pair-list">'+pairs.map((p,i)=>'<div class="mcb-pair-row"><div class="mcb-pair-index">'+String(i+1).padStart(2,'0')+
    '<span>PAIR</span></div>'+matchBuilderSideMarkup(p,i,'a')+'<div class="mcb-pair-link">↔</div>'+
    matchBuilderSideMarkup(p,i,'b')+
    '<div class="mcb-pair-actions"><button type="button" data-mcb-copy="'+i+'"'+(pairs.length>=24?' disabled':'')+'>Duplicate</button>'+
    '<button type="button" data-mcb-remove="'+i+'">Remove</button></div></div>').join('')+
    '</div>'+(pairs.length?'':'<div class="mcb-empty">No pairs yet. Choose Add Pair, or build a picture set and duplicate it into pairs.</div>')+
    '<button type="button" id="mcbAddPairBottom"'+(pairs.length>=24?' disabled':'')+'>＋ Add Another Pair</button>';
}
function matchBuilderLibraryMarkup(){
  const tab=matchDraft.imageTab==='recent'?'recent':'saved';
  const selected=matchBuilderAssetIds(),set=new Set(selected);
  const ordered=gameImageLibrary.slice().sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  const assets=tab==='recent'?ordered.slice(0,20):ordered;
  const chosen=matchBuilderImageCount();
  return '<div class="mcb-section-head"><div><h3>IMAGE SET</h3><p>Choose pictures once. Each selected image becomes two identical memory tiles.</p></div>'+
    '<span class="mcb-counter">'+selected.length+' SELECTED</span></div>'+
    '<div class="mcb-upload-row"><button type="button" id="mcbUploadOne">＋ Add One Slide</button>'+
    '<button type="button" id="mcbUploadBatch">▦ Upload Multiple Slides</button>'+
    '<input id="mcbUploadFile" type="file" accept="image/*" multiple hidden></div>'+
    '<div class="mcb-image-toolbar"><div class="mcb-image-tabs"><button type="button" data-mcb-imagetab="saved"'+(tab==='saved'?' class="active"':'')+'>SAVED IMAGES</button>'+
    '<button type="button" data-mcb-imagetab="recent"'+(tab==='recent'?' class="active"':'')+'>RECENT</button></div>'+
    '<button type="button" id="mcbClearSelection">Clear Selection</button></div>'+
    '<div class="mcb-image-library">'+(assets.length?assets.map(a=>'<button type="button" class="mcb-image-card'+(set.has(a.id)?' selected':'')+
      '" data-mcb-asset="'+matchBuilderEsc(a.id)+'" aria-pressed="'+(set.has(a.id)?'true':'false')+'">'+
      '<img src="'+a.image+'" alt=""><b>'+matchBuilderEsc(a.name)+'</b>'+
      (set.has(a.id)?'<span class="mcb-check">✓</span>':'')+'</button>').join(''):
      '<div class="mcb-empty">No pictures yet. Add a slide or upload multiple images to start.</div>')+'</div>'+
    '<div class="mcb-image-build"><label>BOARD TARGET<select id="mcbImageCount">'+
    [4,6,8,10,12,16,20,24].map(n=>'<option value="'+n+'"'+(n===chosen?' selected':'')+'>'+n+' pairs · '+(n*2)+' cards</option>').join('')+
    '</select></label><button type="button" id="mcbMakePairs"'+(selected.length<chosen?' disabled':'')+'>CREATE '+chosen+' IDENTICAL PAIRS →</button></div>'+
    '<p class="mcb-tip">Fast path: upload '+chosen+' images → choose them → Create '+chosen+' identical pairs → Save & Launch. Existing pictures remain reusable.</p>';
}
function matchBuilderQuickMarkup(){
  return '<div class="mcb-section-head"><div><h3>QUICK TEXT</h3>'+
    '<p>Enter one pair per line: Tile A | Tile B. Text matches can also be identical.</p></div></div>'+
    '<textarea id="mcbQuickPairs" rows="10" spellcheck="false" placeholder="Dog | Dog&#10;7 × 8 | 56&#10;Evaporation | Liquid changes to gas">'+matchBuilderEsc(matchDraft.quick||'')+'</textarea>'+
    '<p class="mcb-tip">For pictures or mixed pairs, use Image Set or Pair Builder above.</p>';
}
function matchBuilderPreviewMarkup(){
  const pairs=matchBuilderPairs(),count=pairs.length,cols=count<=8?4:count<=10?5:count<=12?6:count<=16?8:8;
  const view=Math.min(48,Math.max(8,count*2)),examples=pairs.slice(0,4);
  const longText=pairs.some(p=>['a','b'].some(k=>p[k]?.type==='text'&&String(p[k].value||'').length>42));
  return '<div class="mcb-preview-heading"><h3>✦ GAME BOARD</h3><span>'+count+' PAIRS · '+(count*2)+' CARDS</span></div>'+
    '<div class="mcb-board" style="--mcb-cols:'+cols+'">'+Array.from({length:view},(_,i)=>
      '<span class="mcb-board-tile"><small>✦</small><b>'+(i+1)+'</b></span>').join('')+'</div>'+
    (longText?'<div class="mcb-warning">Long text may be difficult to read when presented through Zoom.</div>':'')+
    '<div class="mcb-preview-examples"><h4>PAIR CONTENT PREVIEW</h4>'+
    (examples.length?examples.map(p=>'<div class="mcb-example"><span>'+contentMarkup(p.a)+'</span><b>↔</b><span>'+
    contentMarkup(p.b)+'</span></div>').join(''):'<p>Choose images or enter pairs to preview your cards.</p>')+'</div>';
}
function matchBuilderSettingsMarkup(){
  const teams=matchLaunchSettings.mode==='teams';
  const crew=teams?Array.from({length:Number(matchLaunchSettings.teamCount||3)},(_,i)=>
    '<span>'+matchTeamMeta(i).icon+' '+matchBuilderEsc(matchTeamMeta(i).name)+'</span>').join(''):
    '<span>Individual rotation</span>';
  return '<div class="mcb-card mcb-settings"><div class="mcb-card-title"><h3>MISSION SETTINGS</h3><span>Each launch</span></div>'+
    '<div class="mcb-settings-grid"><label>MODE<select id="matchMode"><option value="teams"'+(teams?' selected':'')+'>Teams</option>'+
    '<option value="individual"'+(!teams?' selected':'')+'>Individual Rotation</option></select></label>'+
    '<label>TEAMS<select id="matchTeamCount"'+(!teams?' disabled':'')+'>'+
    [2,3,4].map(n=>'<option value="'+n+'"'+(Number(matchLaunchSettings.teamCount)===n?' selected':'')+'>'+n+' Teams</option>').join('')+'</select></label>'+
    '<label>TURN RULE<select id="matchTurnRule"><option value="one_each"'+(matchLaunchSettings.turnRule!=='match_go_again'?' selected':'')+'>One Turn Each</option>'+
    '<option value="match_go_again"'+(matchLaunchSettings.turnRule==='match_go_again'?' selected':'')+'>Match = Go Again</option></select></label>'+
    '<label>SCORING<select id="matchScoring"><option value="pairs"'+(matchLaunchSettings.scoring!=='no_score'?' selected':'')+'>Pairs</option>'+
    '<option value="no_score"'+(matchLaunchSettings.scoring==='no_score'?' selected':'')+'>No Score / Crew Memory</option></select></label></div>'+
    '<label class="mcb-checkline"><input type="checkbox" id="matchCrewConsult"'+(matchLaunchSettings.crewConsult?' checked':'')+'> Enable Crew Consult</label>'+
    '<div class="mcb-crew">'+crew+'</div></div>';
}
function matchBuilderSavedMarkup(){
  return '<div class="mcb-card mcb-saved"><h3>REUSABLE MATCH SETS</h3><div class="mcb-saved-list">'+
    (matchSets.length?matchSets.map(s=>'<div class="mcb-saved-set"><div><b>'+matchBuilderEsc(s.name)+'</b><small>'+
      (s.pairs?.length||0)+' pairs · '+((s.pairs?.length||0)*2)+' cards</small></div>'+
      '<button type="button" data-mcb-load="'+matchBuilderEsc(s.id)+'">Edit</button>'+
      '<button type="button" data-mcb-copyset="'+matchBuilderEsc(s.id)+'">Duplicate</button>'+
      '<button type="button" data-mcb-launch="'+matchBuilderEsc(s.id)+'">Launch</button>'+
      '<button type="button" data-mcb-delete="'+matchBuilderEsc(s.id)+'" aria-label="Delete '+matchBuilderEsc(s.name)+'">×</button></div>').join(''):
      '<div class="mcb-empty">Your saved MATCH sets appear here.</div>')+'</div></div>';
}
function matchBuilderMarkup(){
  const mode=matchBuilderMode(),count=matchBuilderPairs().length,images=matchBuilderAssetIds().length;
  return '<div class="mcb-shell"><div class="mcb-hero"><div class="mcb-hero-mark">✦</div>'+
    '<div class="mcb-hero-text"><small>MOTHERSHIP ARCADE · MATCH CREATOR</small><h2>'+matchBuilderEsc(matchDraft.name||'Create MATCH Game')+'</h2>'+
    '<p>LOAD IMAGES → BUILD PAIRS → FLIP → REMEMBER → MATCH</p></div>'+
    '<div class="mcb-hero-stats"><span><strong id="mcbPairCount">'+count+'</strong> PAIRS</span>'+
    '<span><strong id="mcbCardCount">'+(count*2)+'</strong> CARDS</span></div></div>'+
    '<div class="mcb-layout"><section class="mcb-main mcb-card">'+
    '<div class="mcb-name-row"><label>GAME SET NAME<input id="matchSetName" value="'+matchBuilderEsc(matchDraft.name||'')+'" placeholder="e.g. Kitchen Tools"></label>'+
    (matchDraft.editingSetId?'<span class="mcb-editing">EDITING SAVED SET</span>':'')+'</div>'+
    '<div class="mcb-modes" role="tablist" aria-label="MATCH creation methods">'+
    [['images','▧ IMAGE SET','Upload pictures and auto-pair'],['pairs','◫ PAIR BUILDER','Word↔Picture and custom pairs'],['quick','✎ QUICK TEXT','Paste or type pairs']].map(x=>
      '<button type="button" role="tab" aria-selected="'+(mode===x[0]?'true':'false')+'" class="'+(mode===x[0]?'active':'')+'" data-mcb-mode="'+x[0]+'"><b>'+x[1]+'</b><small>'+x[2]+'</small></button>').join('')+'</div>'+
    '<div class="mcb-editor">'+(mode==='images'?matchBuilderLibraryMarkup():mode==='pairs'?matchBuilderManualMarkup():matchBuilderQuickMarkup())+'</div>'+
    '<div class="mcb-main-actions"><button type="button" id="mcbSave">'+(matchDraft.editingSetId?'Save Changes':'Save Set')+'</button>'+
    '<button type="button" id="mcbSaveLaunch">▶ Save & Launch MATCH</button></div></section>'+
    '<aside class="mcb-sidebar"><div class="mcb-card mcb-preview" id="mcbPreview">'+matchBuilderPreviewMarkup()+'</div>'+
    matchBuilderSettingsMarkup()+matchBuilderSavedMarkup()+'</aside></div></div>';
}
function matchBuilderRefreshPreview(){
  const preview=document.querySelector('#mcbPreview');
  if(preview)preview.innerHTML=matchBuilderPreviewMarkup();
  const pairs=matchBuilderPairs(),count=pairs.length;
  const p=document.querySelector('#mcbPairCount'),c=document.querySelector('#mcbCardCount');
  if(p)p.textContent=count;if(c)c.textContent=count*2;
  const title=document.querySelector('.mcb-hero-text h2');
  if(title)title.textContent=matchDraft.name||'Create MATCH Game';
}
function matchBuilderSetMode(mode){
  if(!['images','pairs','quick'].includes(mode))return;
  matchDraft.editorMode=mode;
  if(mode==='pairs'&&!(matchDraft.manualPairs||[]).length)matchDraft.manualPairs=[matchBuilderNewPair()];
  renderActivities();
}
async function matchBuilderImportPictures(files){
  const sources=Array.from(files||[]).filter(f=>String(f.type||'').startsWith('image/')).slice(0,36);
  if(!sources.length)return;
  const created=[];
  for(const file of sources){
    try{created.push({id:newGameAssetId(),name:gameImageName(file),image:await normalizeGameImage(file),
      collection:'Custom',createdAt:Date.now()})}catch(e){}
  }
  if(!created.length)return toast('Unable to process those images.');
  const next=[...gameImageLibrary,...created];
  if(!persistGameStore(GAME_IMAGE_LIBRARY_STORE,next))return toast('Could not save new pictures.');
  gameImageLibrary=next;
  const chosen=matchBuilderAssetIds();
  matchDraft.selectedImages=[...new Set([...chosen,...created.map(x=>x.id)])].slice(0,24);
  renderActivities();
  toast(created.length+' picture'+(created.length===1?'':'s')+' imported. Choose a board target, then Create Pairs.');
}
function matchBuilderMakeIdenticalPairs(){
  const ids=matchBuilderAssetIds(),target=matchBuilderImageCount();
  if(ids.length<target)return toast('Choose '+(target-ids.length)+' more pictures first.');
  matchDraft.manualPairs=pairsFromSelectedImages(ids.slice(0,target));
  matchDraft.editorMode='pairs';matchDraft.editingSetId='';
  renderActivities();
  toast(target+' identical pairs created. Edit individual tiles or Save & Launch.');
}
function matchBuilderLoadSet(id){
  const set=matchSets.find(s=>s.id===id);
  if(!set)return toast('Saved MATCH set was not found.');
  matchDraft.name=set.name;matchDraft.editorMode='pairs';
  matchDraft.manualPairs=(set.pairs||[]).map(p=>({id:p.id||matchBuilderNewPair().id,a:{...p.a},b:{...p.b}}));
  matchDraft.editingSetId=set.id;matchDraft.selectedImages=[];matchDraft.quick='';
  renderActivities();toast('Editing '+set.name+' · changes are not saved until you press Save Changes.');
}
function matchBuilderDuplicateSet(id){
  const set=matchSets.find(s=>s.id===id);
  if(!set)return toast('Saved MATCH set not found.');
  const copy={...deepClone(set),id:'matchset_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),
    name:('Copy of '+set.name).slice(0,80),createdAt:Date.now()};
  const next=[copy,...matchSets];
  if(!persistGameStore(MATCH_SET_STORE,next))return toast('Could not duplicate this set.');
  matchSets=next;matchBuilderLoadSet(copy.id);
}
function matchBuilderWire(){
  const q=id=>document.querySelector(id),all=sel=>[...document.querySelectorAll(sel)];
  const name=q('#matchSetName');
  if(name)name.oninput=e=>{matchDraft.name=e.target.value;matchBuilderRefreshPreview()};
  all('[data-mcb-mode]').forEach(btn=>btn.onclick=()=>matchBuilderSetMode(btn.dataset.mcbMode));
  const quick=q('#mcbQuickPairs');if(quick)quick.oninput=e=>{matchDraft.quick=e.target.value;matchBuilderRefreshPreview()};
  const file=q('#mcbUploadFile'),one=q('#mcbUploadOne'),batch=q('#mcbUploadBatch');
  if(file){
    if(one)one.onclick=()=>{file.multiple=false;file.click()};
    if(batch)batch.onclick=()=>{file.multiple=true;file.click()};
    file.onchange=async e=>{const files=e.target.files;e.target.value='';await matchBuilderImportPictures(files)};
  }
  all('[data-mcb-imagetab]').forEach(btn=>btn.onclick=()=>{matchDraft.imageTab=btn.dataset.mcbImagetab;renderActivities()});
  all('[data-mcb-asset]').forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.mcbAsset,set=new Set(matchBuilderAssetIds());
    if(set.has(id))set.delete(id);else if(set.size>=24)return toast('MATCH supports up to 24 pairs.');
    else set.add(id);
    matchDraft.selectedImages=[...set];renderActivities();
  });
  const clear=q('#mcbClearSelection');if(clear)clear.onclick=()=>{matchDraft.selectedImages=[];renderActivities()};
  const size=q('#mcbImageCount');if(size)size.onchange=e=>{matchDraft.imageCount=Number(e.target.value);renderActivities()};
  const create=q('#mcbMakePairs');if(create)create.onclick=matchBuilderMakeIdenticalPairs;
  const add=()=>{const arr=matchDraft.manualPairs||[];if(arr.length>=24)return toast('Maximum 24 pairs per set.');arr.push(matchBuilderNewPair());matchDraft.manualPairs=arr;renderActivities()};
  for(const id of ['#mcbAddPair','#mcbAddPairBottom']){const el=q(id);if(el)el.onclick=add}
  all('[data-mcb-remove]').forEach(btn=>btn.onclick=()=>{
    const i=Number(btn.dataset.mcbRemove);matchDraft.manualPairs.splice(i,1);renderActivities()
  });
  all('[data-mcb-copy]').forEach(btn=>btn.onclick=()=>{
    const i=Number(btn.dataset.mcbCopy),src=matchDraft.manualPairs[i];if(!src)return;
    if(matchDraft.manualPairs.length>=24)return toast('Maximum 24 pairs.');
    matchDraft.manualPairs.splice(i+1,0,matchBuilderNewPair({...src.a},{...src.b}));renderActivities();
  });
  all('[data-mcb-kind]').forEach(select=>select.onchange=e=>{
    const [i,key]=select.dataset.mcbKind.split(':'),pair=matchDraft.manualPairs[Number(i)];
    if(!pair)return;
    pair[key]=e.target.value==='image'?{type:'image',value:'',label:''}:{type:'text',value:''};renderActivities()
  });
  all('[data-mcb-text]').forEach(input=>input.oninput=e=>{
    const [i,key]=input.dataset.mcbText.split(':'),pair=matchDraft.manualPairs[Number(i)];
    if(!pair)return;pair[key]={type:'text',value:e.target.value};matchBuilderRefreshPreview()
  });
  all('[data-mcb-img]').forEach(sel=>sel.onchange=e=>{
    const [i,key]=sel.dataset.mcbImg.split(':'),pair=matchDraft.manualPairs[Number(i)];
    const asset=gameImageLibrary.find(a=>a.id===e.target.value);
    if(!pair||!asset)return;
    pair[key]={type:'image',value:asset.image,label:asset.name};renderActivities()
  });
  all('[data-mcb-upload-side]').forEach(btn=>btn.onclick=()=>{
    const input=q('[data-mcb-upload-file="'+btn.dataset.mcbUploadSide+'"]');if(input)input.click()
  });
  all('[data-mcb-upload-file]').forEach(input=>input.onchange=async e=>{
    const [i,key]=input.dataset.mcbUploadFile.split(':'),file=e.target.files?.[0],pair=matchDraft.manualPairs[Number(i)];
    if(!file||!pair)return;
    let picture;try{picture=await normalizeGameImage(file)}catch(err){return toast('Picture could not be imported.')};
    const a={id:newGameAssetId(),name:gameImageName(file),image:picture,collection:'Custom',createdAt:Date.now()};
    if(!persistGameStore(GAME_IMAGE_LIBRARY_STORE,[...gameImageLibrary,a]))return toast('Could not save picture.');
    gameImageLibrary=[...gameImageLibrary,a];pair[key]={type:'image',value:a.image,label:a.name};renderActivities()
  });
  const mode=q('#matchMode'),teams=q('#matchTeamCount'),turn=q('#matchTurnRule'),score=q('#matchScoring'),consult=q('#matchCrewConsult');
  if(mode)mode.onchange=e=>{matchLaunchSettings.mode=e.target.value;renderActivities()};
  if(teams)teams.onchange=e=>{matchLaunchSettings.teamCount=Number(e.target.value);renderActivities()};
  if(turn)turn.onchange=e=>matchLaunchSettings.turnRule=e.target.value;
  if(score)score.onchange=e=>matchLaunchSettings.scoring=e.target.value;
  if(consult)consult.onchange=e=>matchLaunchSettings.crewConsult=e.target.checked;
  const save=q('#mcbSave'),launch=q('#mcbSaveLaunch');
  if(save)save.onclick=saveMatchDraft;
  if(launch)launch.onclick=()=>{const s=saveMatchDraft();if(s)launchMatchSet(s)};
  all('[data-mcb-load]').forEach(btn=>btn.onclick=()=>matchBuilderLoadSet(btn.dataset.mcbLoad));
  all('[data-mcb-copyset]').forEach(btn=>btn.onclick=()=>matchBuilderDuplicateSet(btn.dataset.mcbCopyset));
  all('[data-mcb-launch]').forEach(btn=>btn.onclick=()=>{const s=matchSets.find(x=>x.id===btn.dataset.mcbLaunch);if(s)launchMatchSet(s)});
  all('[data-mcb-delete]').forEach(btn=>btn.onclick=()=>{
    const s=matchSets.find(x=>x.id===btn.dataset.mcbDelete);
    if(!s||!confirm('Delete MATCH set "'+s.name+'"? This will not delete library pictures.'))return;
    const next=matchSets.filter(x=>x.id!==s.id);
    if(!persistGameStore(MATCH_SET_STORE,next))return;
    matchSets=next;if(matchDraft.editingSetId===s.id)matchDraft.editingSetId='';
    renderActivities()
  });
}
