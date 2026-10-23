/* PIXEL REVEAL multi-image activity, v1.
   Enhances the existing single-image game without changing legacy drafts,
   native scoring, private guesses, or server persistence. */
(function(){
 'use strict';
 if(window.SIPixelBatch)return;
 const MAX_IMAGES=12,MAX_DATA_CHARS=190000;
 let busy=false,scheduled=false;
 let lastUploadDraft=null,lastUploadSummary=''; // survive organizer rerenders; never saved
 const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const copyAnswers=x=>Array.isArray(x)?x.slice():[];
 const validIndex=(n,length)=>Math.max(0,Math.min(length-1,Number.isFinite(Number(n))?Math.floor(Number(n)):0));
 function normalize(d){
  if(!d)return null;
  if(!Array.isArray(d.images)||!d.images.length){
   d.images=[{image:d.image||pixelDemoImage(),answer:d.answer||'',acceptedAnswers:copyAnswers(d.acceptedAnswers)}];
   d.imageIndex=0;
  }
  d.images=d.images.filter(x=>x&&typeof x.image==='string'&&x.image).slice(0,MAX_IMAGES);
  if(!d.images.length)d.images=[{image:pixelDemoImage(),answer:'Giraffe',acceptedAnswers:['Giraffe']}];
  d.imageIndex=validIndex(d.imageIndex,d.images.length);
  const current=d.images[d.imageIndex];
  if(typeof current.answer!=='string')current.answer='';
  if(!Array.isArray(current.acceptedAnswers))current.acceptedAnswers=current.answer?[current.answer]:[];
  d.image=current.image;d.answer=current.answer;d.acceptedAnswers=copyAnswers(current.acceptedAnswers);
  return d;
 }
 function currentDraft(){return normalize(ensurePixelDraft())}
 function syncAnswer(d){
  if(!d||!Array.isArray(d.images)||!d.images.length)return;
  const item=d.images[d.imageIndex];
  item.answer=d.answer||'';
  item.acceptedAnswers=copyAnswers(d.acceptedAnswers);
 }
 function selectImage(d,index,saveCurrent=true){
  if(saveCurrent)syncAnswer(d);d.imageIndex=validIndex(index,d.images.length);
  const item=d.images[d.imageIndex];
  d.image=item.image;d.answer=item.answer||'';d.acceptedAnswers=copyAnswers(item.acceptedAnswers);
 }
 function imageFile(file){
  return new Promise((resolve,reject)=>{
   if(!file||!file.type.startsWith('image/')||file.type==='image/svg+xml')
    return reject(Error('Choose PNG, JPG, WebP, GIF or another supported raster image.'));
   if(file.size>15*1024*1024)return reject(Error('Image exceeds the 15 MB upload limit.'));
   const url=URL.createObjectURL(file),img=new Image();
   img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not read '+file.name))};
   img.onload=()=>{
    URL.revokeObjectURL(url);
    try{
     if(!img.width||!img.height)throw Error('Image has no dimensions');
     const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
     let max=1100,quality=.8,encoded='';
     for(let attempt=0;attempt<9;attempt++){
      const ratio=Math.min(1,max/Math.max(img.width,img.height));
      canvas.width=Math.max(1,Math.round(img.width*ratio));
      canvas.height=Math.max(1,Math.round(img.height*ratio));
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      encoded=canvas.toDataURL('image/jpeg',quality);
      if(encoded.length<=MAX_DATA_CHARS)break;
      quality=Math.max(.49,quality-.065);max=Math.max(560,Math.floor(max*.88));
     }
     if(encoded.length>MAX_DATA_CHARS)throw Error('Image too detailed to save; try a smaller image.');
     resolve(encoded);
    }catch(e){reject(e)}
   };
   img.src=url;
  });
 }
 function isDefaultDemo(d){
  return d.images.length===1&&d.images[0].image===pixelDemoImage();
 }
 async function upload(files){
  if(busy)return;
  const all=Array.from(files||[]),raster=all.filter(f=>f&&f.type.startsWith('image/')&&f.type!=='image/svg+xml');
  if(!raster.length)return toast('Choose one or more PNG, JPG, or WebP images');
  const d=currentDraft(),replace=isDefaultDemo(d);
  const existing=replace?0:d.images.length;
  const selected=raster.slice(0,Math.max(0,MAX_IMAGES-existing));
  if(!selected.length)return toast('PIXEL REVEAL supports up to '+MAX_IMAGES+' images per activity');
  busy=true;
  const button=document.querySelector('#pixelImageFile'),status=document.querySelector('.pixel-batch-upload-status');
  if(button)button.disabled=true;
  if(status){status.setAttribute('aria-busy','true');status.textContent='Preparing '+selected.length+' image rounds…'}
  syncAnswer(d);
  if(replace){d.images=[];d.answer='';d.acceptedAnswers=[]}
  let added=0,failed=0,firstIndex=d.images.length;
  for(const [index,file] of selected.entries()){
   if(status)status.textContent='Uploading image '+(index+1)+' of '+selected.length+' · '+added+' ready';
   try{
    const image=await imageFile(file);
    d.images.push({image,answer:'',acceptedAnswers:[]});
    added++;
   }catch(e){failed++;toast(String(e.message||e))}
  }
  if(!d.images.length)d.images=[{image:pixelDemoImage(),answer:'Giraffe',acceptedAnswers:['Giraffe']}];
  selectImage(d,Math.min(firstIndex,d.images.length-1),false);
  busy=false;
  if(button)button.value=''; // selecting the same files again must still fire change
  const skipped=all.length-selected.length;
  const summary=added+' image'+(added===1?'':'s')+' added'+
   (failed?' · '+failed+' could not be processed':'')+
   (skipped?' · '+skipped+' skipped (12-image limit or unsupported file)':'')+
   ' · '+d.images.length+' of '+MAX_IMAGES+' rounds ready';
  lastUploadDraft=d;lastUploadSummary=summary;
  renderActivities();
  const ready=document.querySelector('.pixel-batch-upload-status');
  if(ready){ready.removeAttribute('aria-busy');ready.textContent=summary}
  toast(summary);
 }
 function reorder(d,index,delta){
  const target=index+delta;
  if(target<0||target>=d.images.length)return;
  syncAnswer(d);
  const moved=d.images.splice(index,1)[0];
  d.images.splice(target,0,moved);
  selectImage(d,target,false);
  renderActivities();
 }
 function remove(d,index){
  syncAnswer(d);
  if(d.images.length<=1){toast('Keep at least one image in the activity');return}
  d.images.splice(index,1);
  selectImage(d,Math.min(index,d.images.length-1),false);
  renderActivities();
 }

 // Phase 4M-C: improve the native PIXEL REVEAL library and Save/Launch
 // affordances without replacing server sync, browser storage, or handlers.
 function studioRounds(entry){
  return Array.isArray(entry?.images)&&entry.images.length?entry.images:[entry];
 }
 function studioSignature(entry){
  if(!entry)return '';
  const rounds=studioRounds(entry),selected=validIndex(entry.imageIndex||0,rounds.length);
  return JSON.stringify([
   String(entry.name||'').trim(),entry.revealStyle||'',entry.difficulty||'',
   entry.scoring||'',!!entry.allowUpdates,
   rounds.map((item,i)=>{
    const image=String(item.image||'');
    return [image.length,image.slice(0,80),image.slice(-80),
     i===selected?String(entry.answer||''):String(item.answer||''),
     i===selected?copyAnswers(entry.acceptedAnswers):copyAnswers(item.acceptedAnswers)];
   })
  ]);
 }
 function studioSavedMeta(saved){
  const rounds=studioRounds(saved),answered=rounds.filter(item=>String(item.answer||'').trim()).length;
  return {rounds,answered,
   description:rounds.length+' image'+(rounds.length===1?'':'s')+
    ' · '+answered+'/'+rounds.length+' answers set · '+
    (saved.revealStyle==='focus'?'Focus reveal':'Tile reveal')};
 }
 function decorateSavedRow(row,saved){
  if(!row||!saved||row.dataset.pixelStudioCard)return;
  row.dataset.pixelStudioCard='1';
  row.dataset.pixelStudioName=String(saved.name||'');
  row.classList.add('pixel-studio-saved-card');
  const meta=studioSavedMeta(saved);
  const thumb=document.createElement('div');
  thumb.className='pixel-studio-saved-thumb';
  const first=meta.rounds[0]?.image;
  if(typeof first==='string'&&/^(data:image\/(?:png|jpeg|webp|gif|bmp);base64,|\/)/i.test(first)){
   const img=document.createElement('img');
   img.src=first;img.alt='';img.loading='lazy';img.decoding='async';
   thumb.appendChild(img);
  }else thumb.textContent='▦';
  row.prepend(thumb);
  const info=row.children[1];
  if(info){
   const details=info.querySelector('small');
   if(details)details.textContent=meta.description;
   const tag=document.createElement('span');
   tag.className='pixel-studio-card-tag';
   tag.textContent=meta.answered===meta.rounds.length?'Answers ready':'Set remaining answers';
   info.appendChild(tag);
  }
  const edit=row.querySelector('[data-load-pixel], [data-pixel-studio-load]');
  if(edit){
   edit.textContent='Edit / Load';
   edit.setAttribute('aria-label','Edit or load '+String(saved.name||'saved activity'));
  }
  const remove=row.querySelector('[data-delete-pixel], [data-pixel-studio-delete]');
  if(remove){
   remove.textContent='Delete';
   remove.setAttribute('aria-label','Delete '+String(saved.name||'saved activity'));
   remove.setAttribute('title','Delete this saved activity from this browser');
  }
 }

 // Phase 4M-D: teacher-only readiness and saved-library discovery.
 // No changes to activity persistence, lobby launch, or the student view.
 let savedLibraryQuery='';
 function studioProgress(d){
  const rounds=studioRounds(d);
  const complete=rounds.map((item,i)=>Boolean(String(
   i===d.imageIndex?d.answer??item.answer:item.answer||''
  ).trim()));
  return {complete,answered:complete.filter(Boolean).length,total:rounds.length};
 }
 function updateStudioRoundStatus(setup,d){
  const manager=setup.querySelector('.pixel-batch-manager');
  if(!manager)return;
  const progress=studioProgress(d);
  let bar=manager.querySelector('.pixel-studio-round-progress');
  if(!bar){
   bar=document.createElement('div');bar.className='pixel-studio-round-progress';
   bar.innerHTML='<div class="pixel-studio-round-progress-line"><strong></strong>'+
    '<span class="pixel-studio-progress-meter" role="progressbar" aria-label="Image answers completed" aria-valuemin="0">'+
    '<i></i></span></div><button type="button" data-pixel-next-missing></button>';
   manager.querySelector('.pixel-batch-list')?.before(bar);
  }
  const count=bar.querySelector('strong');
  const summary=progress.answered+' of '+progress.total+' image answers ready';
  if(count.textContent!==summary)count.textContent=summary;
  const meter=bar.querySelector('[role="progressbar"]');
  meter.setAttribute('aria-valuenow',String(progress.answered));
  meter.setAttribute('aria-valuemax',String(progress.total));
  meter.querySelector('i').style.width=(100*progress.answered/progress.total)+'%';
  const current=validIndex(d.imageIndex,progress.total);
  const next=progress.complete.findIndex((ready,i)=>!ready&&i>current);
  const wrap=next<0?progress.complete.findIndex((ready,i)=>!ready&&i<current):next;
  const nextButton=bar.querySelector('[data-pixel-next-missing]');
  const target=next>=0?next:wrap;
  nextButton.disabled=target<0;
  nextButton.dataset.targetIndex=String(target);
  nextButton.textContent=target>=0?'→ Go to image '+(target+1)+' missing an answer':
   progress.answered===progress.total?'✓ All answers ready':'Finish this image answer';
  manager.querySelectorAll('.pixel-batch-item').forEach((row,i)=>{
   const ready=progress.complete[i];
   row.dataset.answerReady=ready?'yes':'no';
   const button=row.querySelector('.pixel-batch-pick');
   if(!button)return;
   let status=row.querySelector('.pixel-studio-round-status');
   if(!status){
    status=document.createElement('span');status.className='pixel-studio-round-status';
    button.appendChild(status);
   }
   const label=ready?'✓ Answer ready':'○ Needs answer';
   if(status.textContent!==label)status.textContent=label;
   button.setAttribute('aria-label','Edit image '+(i+1)+': '+(ready?'answer ready':'needs answer'));
  });
  const answer=setup.querySelector('#pixelAnswer');
  if(answer){
   let help=setup.querySelector('#pixel-studio-answer-help');
   if(!help){
    help=document.createElement('p');help.id='pixel-studio-answer-help';
    help.className='pixel-studio-answer-help';
    answer.after(help);
   }
   const words='Image '+(current+1)+' of '+progress.total+
    ' · Enter the main answer for this picture. Add alternate answers below, one per line.';
   if(help.textContent!==words)help.textContent=words;
   answer.setAttribute('aria-describedby','pixel-studio-answer-help');
  }
 }
 function applySavedLibraryQuery(setup){
  const list=setup.querySelector('.orbit-saved-list');
  if(!list)return;
  const query=savedLibraryQuery.trim().toLocaleLowerCase();
  let visible=0;
  const cards=[...list.querySelectorAll('.pixel-studio-saved-card')];
  for(const card of cards){
   const matches=(card.dataset.pixelStudioName||'').toLocaleLowerCase().includes(query);
   card.hidden=!matches;
   if(matches)visible++;
  }
  const older=list.querySelector('.pixel-studio-more');
  if(older){
   const anyOlder=[...older.querySelectorAll('.pixel-studio-saved-card')].some(card=>!card.hidden);
   older.hidden=!anyOlder;
   if(query&&anyOlder)older.open=true;
  }
  const count=setup.querySelector('.pixel-studio-search-count');
  if(count){
   const line=visible+' of '+cards.length+' saved activities'+(query?' match':'');
   if(count.textContent!==line)count.textContent=line;
  }
 }
 function enhanceSavedStudio(setup,d){
  const actions=setup.querySelector('.pixel-save-actions');
  if(!actions)return;
  let heading=setup.querySelector('.pixel-studio-finish');
  if(!heading){
   heading=document.createElement('section');
   heading.className='pixel-studio-finish';
   heading.innerHTML='<strong>READY TO SAVE OR LAUNCH?</strong>'+
    '<p>Save keeps this activity in this browser. Launch starts the classroom game.</p>'+
    '<div class="pixel-studio-save-state" role="status" aria-live="polite"></div>';
   actions.before(heading);
  }
  const save=actions.querySelector('#savePixelBtn');
  const launch=actions.querySelector('#launchPixelBtn');
  const preset=actions.querySelector('#savePixelPresetBtn');
  if(save)save.textContent=d.savedId?'▣ Save changes':'▣ Save activity';
  if(launch)launch.textContent='▶ Launch game';
  if(preset)preset.textContent='▤ Save preset';
  const stored=typeof loadSavedPixels==='function'?loadSavedPixels():[];
  const current=stored.find(item=>item.savedId&&item.savedId===d.savedId);
  const synced=!!current&&studioSignature(current)===studioSignature(d);
  const meta=studioSavedMeta(d);
  const status=heading.querySelector('.pixel-studio-save-state');
  const message=(synced?'✓ Saved in this browser':current?'● Changes not saved':'○ New unsaved activity')+
   (meta.answered<meta.rounds.length?' · '+(meta.rounds.length-meta.answered)+' image answer'+
    (meta.rounds.length-meta.answered===1?'':'s')+' missing':' · Answers ready');
  if(status.textContent!==message)status.textContent=message;
  status.dataset.saved=synced?'yes':'no';
  const nativeList=setup.querySelector('.orbit-saved-list');
  if(!nativeList)return;
  let libraryHead=setup.querySelector('.pixel-studio-library-head');
  if(!libraryHead){
   libraryHead=document.createElement('div');
   libraryHead.className='pixel-studio-library-head';
   nativeList.before(libraryHead);
   const nativeLabel=nativeList.previousElementSibling===libraryHead?
    libraryHead.previousElementSibling:null;
   if(nativeLabel?.classList.contains('vector-label'))nativeLabel.classList.add('pixel-studio-native-library-label');
  }
  libraryHead.textContent='SAVED ACTIVITIES · '+stored.length+' / 20';
  let search=setup.querySelector('#pixelStudioSearch');
  if(!search){
   const searchWrap=document.createElement('div');
   searchWrap.className='pixel-studio-search-wrap';
   const searchLabel=document.createElement('label');
   searchLabel.setAttribute('for','pixelStudioSearch');
   searchLabel.textContent='Find a saved mystery';
   search=document.createElement('input');
   search.type='search';search.id='pixelStudioSearch';
   search.setAttribute('autocomplete','off');
   search.setAttribute('placeholder','Search by activity name');
   search.setAttribute('aria-label','Find saved PIXEL REVEAL activities');
   const searchCount=document.createElement('span');
   searchCount.className='pixel-studio-search-count';
   searchCount.setAttribute('role','status');
   searchWrap.append(searchLabel,search,searchCount);
   libraryHead.after(searchWrap);
   search.value=savedLibraryQuery;
  }
  const nativeRows=[...nativeList.children].filter(node=>node.classList?.contains('orbit-saved-row'));
  nativeRows.forEach(row=>{
   const id=row.querySelector('[data-load-pixel]')?.getAttribute('data-load-pixel');
   decorateSavedRow(row,stored.find(item=>String(item.savedId)===id));
  });
  if(stored.length>nativeRows.length&&!nativeList.querySelector('.pixel-studio-more')){
   const more=document.createElement('details');
   more.className='pixel-studio-more';
   const summary=document.createElement('summary');
   summary.textContent='Show '+(stored.length-nativeRows.length)+' older saved activities';
   more.appendChild(summary);
   const older=document.createElement('div');
   older.className='pixel-studio-older-grid';
   for(const entry of stored.slice(nativeRows.length)){
    const row=document.createElement('div');
    row.className='orbit-saved-row';
    const info=document.createElement('div');
    const name=document.createElement('b');
    name.textContent=String(entry.name||'Untitled Pixel Reveal');
    const detail=document.createElement('small');
    info.append(name,detail);
    const controls=document.createElement('div');
    const edit=document.createElement('button');
    edit.type='button';edit.setAttribute('data-pixel-studio-load',String(entry.savedId));
    const remove=document.createElement('button');
    remove.type='button';remove.setAttribute('data-pixel-studio-delete',String(entry.savedId));
    controls.append(edit,remove);row.append(info,controls);
    decorateSavedRow(row,entry);
    older.appendChild(row);
   }
   more.appendChild(older);nativeList.appendChild(more);
  }
  applySavedLibraryQuery(setup);
 }
 function enhanceSetup(){
  const setup=document.querySelector('#activityGrid .pixel-setup');
  if(!setup||busy)return;
  const d=currentDraft();
  const file=setup.querySelector('#pixelImageFile');
  if(!file)return;
  file.multiple=true;
  file.accept='image/png,image/jpeg,image/webp,image/gif,image/bmp';
  file.onchange=e=>upload(e.target.files);
  const fileLabel=file.closest('label');
  if(fileLabel)fileLabel.childNodes.forEach(node=>{
   if(node.nodeType===Node.TEXT_NODE)node.textContent='＋ Upload Multiple Images';
  });
  const demo=setup.querySelector('#pixelDemoBtn');
  if(demo)demo.onclick=()=>{
   syncAnswer(d);
   d.images[d.imageIndex]={image:pixelDemoImage(),answer:'Giraffe',acceptedAnswers:['Giraffe','Girafe','🦒']};
   selectImage(d,d.imageIndex,false);renderActivities();
  };
  const answer=setup.querySelector('#pixelAnswer');
  if(answer&&!answer.dataset.pixelBatchWired){
   answer.dataset.pixelBatchWired='true';
   answer.addEventListener('input',()=>{
    const active=d.images[d.imageIndex],previous=active.answer||'';
    active.answer=d.answer||'';
    // Prevent the previous primary answer being silently accepted after an edit.
    active.acceptedAnswers=copyAnswers(d.acceptedAnswers).filter(v=>v!==previous||v===d.answer);
   });
  }
  const accepted=setup.querySelector('#pixelAcceptedAnswers');
  if(accepted&&!accepted.dataset.pixelBatchWired){
   accepted.dataset.pixelBatchWired='true';
   accepted.addEventListener('input',()=>{d.images[d.imageIndex].acceptedAnswers=copyAnswers(d.acceptedAnswers)});
  }
  enhanceSavedStudio(setup,d);
  if(setup.querySelector('.pixel-batch-manager')){
   updateStudioRoundStatus(setup,d);return;
  }
  const preview=setup.querySelector('.pixel-setup-preview');
  if(!preview)return;
  const manager=document.createElement('section');
  manager.className='pixel-batch-manager';
  manager.setAttribute('aria-label','Mystery image rounds');
  manager.innerHTML='<div class="pixel-batch-heading"><strong>IMAGE ROUNDS <span>'+d.images.length+' / '+MAX_IMAGES+'</span></strong>'+
   '<small>Select an image to set its answer. Upload several at once, then reveal them one by one.</small></div>'+
   '<div class="pixel-batch-list" role="list">'+d.images.map((item,i)=>
    '<div class="pixel-batch-item'+(i===d.imageIndex?' selected':'')+'" role="listitem">'+
    '<button type="button" class="pixel-batch-pick" data-pixel-batch-select="'+i+'" aria-pressed="'+(i===d.imageIndex)+'" title="Edit image '+(i+1)+'">'+
    '<img src="'+escapeHtml(item.image)+'" alt="Mystery '+(i+1)+' thumbnail"><span>IMAGE '+(i+1)+'</span></button>'+
    '<div class="pixel-batch-item-actions"><button type="button" data-pixel-batch-left="'+i+'" aria-label="Move image '+(i+1)+' earlier" '+(i===0?'disabled':'')+'>←</button>'+
    '<button type="button" data-pixel-batch-right="'+i+'" aria-label="Move image '+(i+1)+' later" '+(i===d.images.length-1?'disabled':'')+'>→</button>'+
    '<button type="button" data-pixel-batch-remove="'+i+'" aria-label="Remove image '+(i+1)+'" '+(d.images.length===1?'disabled':'')+'>×</button></div></div>').join('')+
    '</div><p class="pixel-batch-upload-status" role="status" aria-live="polite">'+
    (lastUploadDraft===d&&lastUploadSummary?escapeHtml(lastUploadSummary):
     d.images.length+' mystery image'+(d.images.length===1?'':'s')+' ready. Each image has its own answer and guesses.')+'</p>';
  preview.after(manager);
  // Teacher-only studio hierarchy: preserve native inputs and their handlers.
  const heading=setup.querySelector('.pixel-batch-heading');
  if(heading){
   heading.insertAdjacentHTML('afterbegin',
    '<div class="pixel-studio-kicker">PIXEL REVEAL · ACTIVITY BUILDER</div>'+
    '<div class="pixel-studio-intro">Organize image rounds, edit each answer, then save and launch.</div>');
  }
  // Visual workflow guide only. All upload/save/load/launch actions remain native.
  const guide=document.createElement('div');
  guide.className='pixel-studio-workflow';
  guide.setAttribute('aria-label','Activity setup steps');
  guide.innerHTML='<span><b>1</b> Upload images</span>'+
   '<span><b>2</b> Set answers</span>'+
   '<span><b>3</b> Save activity</span>'+
   '<span><b>4</b> Launch game</span>';
  manager.insertBefore(guide,manager.querySelector('.pixel-batch-list'));
  const count=heading?.querySelector('strong');
  if(count)count.setAttribute('aria-label',d.images.length+' of '+MAX_IMAGES+' image rounds');
  updateStudioRoundStatus(setup,d);
 }
 function snapshot(run){
  return {pixelGuesses:structuredClone(run.pixelGuesses||{}),
   pixelRevealed:[...(run.pixelRevealed||[])],
   pixelShowResults:!!run.pixelShowResults,
   pixelRevealAll:!!run.pixelRevealAll,
   pixelFocusStage:Number(run.pixelFocusStage||0)};
 }
 function switchRound(index){
  const run=typeof state!=='undefined'?state.activityRun:null;
  if(!run||run.activityId!=='pixel-game'||run.phase!=='running')return;
  const images=run.pixelConfig?.images;
  if(!Array.isArray(images)||images.length<2)return;
  const current=validIndex(run.pixelImageIndex,images.length),target=validIndex(index,images.length);
  if(current===target)return;
  if(!run.pixelRoundSnapshots||typeof run.pixelRoundSnapshots!=='object')run.pixelRoundSnapshots={};
  run.pixelRoundSnapshots[current]=snapshot(run);
  const next=run.pixelRoundSnapshots[target]||{
   pixelGuesses:{},pixelRevealed:[],pixelShowResults:false,pixelRevealAll:false,pixelFocusStage:0};
  run.pixelImageIndex=target;
  run.pixelConfig.image=images[target].image;
  run.pixelConfig.answer=images[target].answer||'';
  run.pixelConfig.acceptedAnswers=copyAnswers(images[target].acceptedAnswers);
  run.pixelGuesses=structuredClone(next.pixelGuesses);
  run.pixelRevealed=[...next.pixelRevealed];
  run.pixelShowResults=!!next.pixelShowResults;
  run.pixelRevealAll=!!next.pixelRevealAll;
  run.pixelFocusStage=Number(next.pixelFocusStage||0);
  render();
  toast('PIXEL REVEAL · image '+(target+1)+' of '+images.length);
 }
 function enhanceController(){
  const run=typeof state!=='undefined'?state.activityRun:null;
  if(!run||run.activityId!=='pixel-game'||run.phase!=='running')return;
  const grid=document.querySelector('#activityControllerPanel .pixel-controller-grid');
  if(!grid||grid.dataset.pixelTeacherEnhanced)return;
  const board=grid.querySelector('.pixel-control-board');
  const side=grid.querySelector('.pixel-control-side');
  if(!board||!side)return;
  grid.dataset.pixelTeacherEnhanced='true'; // stable per native render; do not duplicate on observer updates
  const images=run.pixelConfig?.images;
  const i=Array.isArray(images)&&images.length?validIndex(run.pixelImageIndex,images.length):0;
  const rounds=Array.isArray(images)&&images.length?images.length:1;
  const isFocus=(run.pixelConfig?.revealStyle||'tiles')==='focus';
  const total=isFocus?10:(typeof pixelTotal==='function'?pixelTotal(run):
   board.querySelectorAll('.pixel-cover').length);
  const remain=typeof pixelRemaining==='function'?pixelRemaining(run):Math.max(0,total-(run.pixelRevealed||[]).length);
  const completed=Math.max(0,total-remain),pct=total?Math.round(completed*100/total):100;
  const preview=document.createElement('div');
  preview.className='pixel-teacher-preview-head';
  preview.innerHTML='<span><i aria-hidden="true">✦</i> MISSION VISUAL</span>'+
   '<span>LIVE IMAGE '+(i+1)+' / '+rounds+'</span>';
  board.prepend(preview);
  const title=side.querySelector('h3');
  if(title)title.insertAdjacentHTML('beforebegin',
   '<div class="pixel-teacher-command-kicker"><span aria-hidden="true">◈</span> MISSION OPERATIONS</div>');
  if(title)title.insertAdjacentHTML('afterend',
   '<p class="pixel-teacher-command-help">Choose how much of the mystery to reveal to the crew.</p>');
  // Keep navigation fully delegated to the existing handlers; only its
  // visual presentation and position change.
  if(rounds>1){
   const panel=document.createElement('div');panel.className='pixel-batch-live';
   panel.innerHTML='<div class="pixel-teacher-round-heading"><strong>IMAGE '+(i+1)+' OF '+rounds+'</strong>'+
    '<span>ROUND NAVIGATION</span></div>'+
    '<div class="pixel-batch-live-actions"><button type="button" data-pixel-round-prev '+(i===0?'disabled':'')+'>← Previous Image</button>'+
    '<button type="button" data-pixel-round-next '+(i===rounds-1?'disabled':'')+'>Next Image →</button></div>'+
    '<small>Each image saves its own reveal progress and private guesses.</small>';
   if(title)title.after(panel);else side.prepend(panel);
  }
  const progress=document.createElement('div');
  progress.className='pixel-teacher-progress';
  progress.innerHTML='<div class="pixel-teacher-progress-top"><span>'+
   (isFocus?'IMAGE CLARITY':'SIGNAL REVEAL')+'</span><b>'+pct+'% <small>REVEALED</small></b></div>'+
   '<div class="pixel-teacher-progress-track" role="progressbar" aria-label="'+
   (isFocus?'Image clarity':'Image tiles revealed')+'" aria-valuemin="0" aria-valuemax="'+total+
   '" aria-valuenow="'+completed+'"><i style="width:'+pct+'%"></i></div>'+
   '<div class="pixel-teacher-progress-foot"><span>'+completed+' / '+total+' '+(isFocus?'STEPS':'TILES')+'</span>'+
   '<span>'+(remain?remain+' REMAINING':'SIGNAL ACQUIRED')+'</span></div>';
  const nav=side.querySelector('.pixel-batch-live');
  const help=side.querySelector('.pixel-teacher-command-help');
  if(nav)nav.after(progress);else if(help)help.after(progress);else side.prepend(progress);
  const guesses=side.querySelector('.pixel-private-guesses .eyebrow');
  if(guesses){
   const counter=document.createElement('span');
   counter.className='pixel-teacher-guess-count';
   counter.textContent=typeof pixelSubmittedCount==='function'?
    pixelSubmittedCount(run)+' LOCKED':'PRIVATE';
   guesses.after(counter);
  }
  const footer=side.querySelector('.board-global-actions');
  if(footer)footer.insertAdjacentHTML('afterbegin',
   '<span class="pixel-teacher-session-label">SESSION ACTIONS</span>');
 }
 // Save all current-round answers alongside the native saved draft.
 // The legacy save normalizes the primary accepted answer, but without this
 // synchronization the image entry could lag behind the saved root fields.
 const originalSave=typeof savePixelDraft==='function'?savePixelDraft:null;
 if(originalSave){
  savePixelDraft=function(){
   const d=currentDraft();
   const answer=String(d.answer||'').trim();
   if(answer&&!copyAnswers(d.acceptedAnswers).some(value=>
     pixelAnswerKey(value)===pixelAnswerKey(answer)))d.acceptedAnswers.unshift(answer);
   syncAnswer(d);
   originalSave();
  };
 }
 const originalLaunch=typeof launchPixel==='function'?launchPixel:null;
 if(originalLaunch){
  launchPixel=function(){
   const d=currentDraft();
   syncAnswer(d);
   selectImage(d,0);
   originalLaunch();
   const run=state.activityRun;
   if(run?.activityId==='pixel-game'){
    run.pixelImageIndex=0;
    run.pixelRoundSnapshots={};
    render();
   }
  };
 }
 // Phase 4E: presentation-only cinematic HUD. Never place answers, accepted
 // answers, teacher corrections, or guesses in the public signal overlay.
 const originalShared=typeof pixelSharedMarkup==='function'?pixelSharedMarkup:null;
 if(originalShared){
  pixelSharedMarkup=function(run,big){
   let html=originalShared(run,big);
   const images=run?.pixelConfig?.images;
   const rounds=Array.isArray(images)&&images.length?images.length:1;
   const index=validIndex(run?.pixelImageIndex,rounds);
   if(typeof html!=='string')return html;
   // Keep the original round badge for teacher previews and legacy markup.
   if(rounds>1){
    const badge='<span class="pixel-batch-round-badge">IMAGE '+(index+1)+' / '+rounds+'</span>';
    if(html.includes('<div class="pixel-public-head">'))
     html=html.replace('<div class="pixel-public-head">','<div class="pixel-public-head">'+badge);
    else if(html.includes('<div class="pixel-results">'))
     html=html.replace('<div class="pixel-results">','<div class="pixel-results">'+badge);
   }
   if(!big)return html; // the teacher preview retains its polished controls
   const focus=(run?.pixelConfig?.revealStyle||'tiles')==='focus';
   const total=focus?10:(typeof pixelTotal==='function'?pixelTotal(run):0);
   const remain=typeof pixelRemaining==='function'?pixelRemaining(run):0;
   const done=Math.max(0,total-remain),pct=total?Math.round(100*done/total):100;
   const finished=!!run.pixelRevealAll||remain===0;
   const resultView=!!run.pixelShowResults&&!!run.pixelRevealAll;
   const stageLabel='MYSTERY '+(index+1)+' OF '+rounds;
   const marks=Array.from({length:rounds},(_,n)=>
    '<span class="pixel-cinematic-round'+(n===index?' is-current':'')+
    '"'+(n===index?' aria-current="step"':'')+' aria-label="Image '+(n+1)+
    (n===index?', current':'')+'">'+(n+1)+'</span>').join('');
   const preface='<div class="pixel-cinematic-mission">'+
    '<span><i aria-hidden="true">✧</i> MOTHERSHIP · MYSTERY SIGNAL</span>'+
    '<strong>'+stageLabel+'</strong></div>';
   const meter='<div class="pixel-cinematic-hud">'+
    '<div class="pixel-cinematic-hud-top"><strong>'+
    (finished?'SIGNAL ACQUIRED':focus?'RESTORING IMAGE CLARITY':'DECODING THE HIDDEN IMAGE')+
    '</strong><span>'+pct+'% VISIBLE</span></div>'+
    '<div class="pixel-cinematic-track" role="progressbar" aria-label="'+
    (focus?'Image clarity':'Mystery image revealed')+'" aria-valuemin="0" aria-valuemax="'+
    total+'" aria-valuenow="'+done+'"><i style="width:'+pct+'%"></i></div>'+
    '<div class="pixel-cinematic-hud-bottom"><span>'+
    (finished?'ALL SECTIONS UNLOCKED':remain+' '+(focus?'CLARITY STEPS':'TILES')+' STILL HIDDEN')+
    '</span><div class="pixel-cinematic-rounds" role="group" aria-label="Image rounds">'+
    marks+'</div></div></div>';
   if(resultView){
    return html.replace('<div class="pixel-results">',
     '<div class="pixel-results pixel-cinematic-results">'+preface+meter);
   }
   html=html.replace('<div class="pixel-public">',
    '<div class="pixel-public pixel-cinematic-public">'+preface);
   html=html.replace('<div class="pixel-public-head">',
    meter+'<div class="pixel-public-head">');
   // Image-unlocked signal appears only after the teacher has revealed all.
   // It is not an answer reveal: answers stay behind the existing Results action.
   const signal=finished?
    '<div class="pixel-cinematic-acquired" aria-label="Mystery image unlocked">'+
     '<span aria-hidden="true">✦</span> SIGNAL ACQUIRED <span aria-hidden="true">✦</span></div>':'';
   html=html.replace('<div class="pixel-mystery-board">',
    '<div class="pixel-mystery-board pixel-cinematic-board">'+signal);
   html=html.replace('<div class="pixel-focus-board">',
    '<div class="pixel-focus-board pixel-cinematic-board">'+signal);
   return html;
  };
 }
 // Browser-local visual ledger: one-time animations, with no new server,
 // persistence, or classroom-state fields. Redraws cannot reset these timers.
 let cinematicRun='',cinematicLastRound=null;
 const cinematicSeen=new Map(),cinematicNewTiles=new Map();
 const cinematicRoundUntil=new Map(),cinematicFinalUntil=new Map(),
       cinematicFocusUntil=new Map(),cinematicFocusSeen=new Map();
 function enhanceCinematic(){
  const run=typeof state!=='undefined'?state.activityRun:null;
  if(!run||run.activityId!=='pixel-game'||run.phase!=='running')return;
  const stages=document.querySelectorAll('.pixel-cinematic-public,.pixel-cinematic-results');
  if(!stages.length)return;
  const identity=String(run.runToken||run.pixelConfig?.name||'pixel-game');
  if(identity!==cinematicRun){
   cinematicRun=identity;cinematicLastRound=null;cinematicSeen.clear();
   cinematicNewTiles.clear();cinematicRoundUntil.clear();cinematicFinalUntil.clear();
   cinematicFocusUntil.clear();cinematicFocusSeen.clear();
  }
  const rounds=run.pixelConfig?.images?.length||1;
  const i=validIndex(run.pixelImageIndex,rounds),key=identity+':'+i;
  const now=performance.now(),focus=(run.pixelConfig?.revealStyle||'tiles')==='focus';
  const revealed=new Set((run.pixelRevealed||[]).filter(n=>Number.isInteger(n)&&n>=0));
  const previously=cinematicSeen.get(key);
  const fully=!!run.pixelRevealAll;
  if(previously){
   const additions=[...revealed].filter(n=>!previously.has(n));
   const newUntil=cinematicNewTiles.get(key)||new Map();
   if(additions.length&&additions.length<=16&&!fully)
    additions.forEach((n,j)=>newUntil.set(n,now+900+j*24));
   cinematicNewTiles.set(key,newUntil);
   if(fully&&!previously.full)cinematicFinalUntil.set(key,now+2000);
  }else if(fully)cinematicFinalUntil.set(key,0); // restored, not a new celebration
  const focusStage=Math.max(0,Math.min(10,Number(run.pixelFocusStage||0)));
  if(cinematicFocusSeen.has(key)&&focusStage>cinematicFocusSeen.get(key))
   cinematicFocusUntil.set(key,now+650);
  cinematicFocusSeen.set(key,focusStage);
  cinematicSeen.set(key,Object.assign(revealed,{full:fully}));
  if(cinematicLastRound!==null&&cinematicLastRound!==key)
   cinematicRoundUntil.set(key,now+850);
  cinematicLastRound=key;
  const animTiles=cinematicNewTiles.get(key)||new Map();
  for(const [n,until] of animTiles)if(until<=now)animTiles.delete(n);
  for(const stage of stages){
   stage.classList.toggle('pixel-cinematic-arriving',(cinematicRoundUntil.get(key)||0)>now);
   stage.classList.toggle('pixel-cinematic-celebrating',(cinematicFinalUntil.get(key)||0)>now);
   stage.classList.toggle('pixel-cinematic-focus-up',(cinematicFocusUntil.get(key)||0)>now);
   const tiles=stage.querySelectorAll('.pixel-cover-grid .pixel-cover');
   tiles.forEach((tile,n)=>{
    if(animTiles.has(n)&&tile.classList.contains('revealed')){
     tile.classList.add('pixel-cinematic-dissolve');
     tile.style.setProperty('--pixel-dissolve-delay',Math.min(n%8,7)*20+'ms');
    }
   });
  }
 }

 function enhanceStudent(){
  if(!document.body?.classList.contains('role-student'))return;
  const run=typeof state!=='undefined'?state.activityRun:null;
  if(!run||run.activityId!=='pixel-game'||run.phase!=='running')return;
  const prompt=document.querySelector('#studentContent .student-prompt.response-device');
  if(!prompt)return;
  const student=typeof selectedStudent==='function'?selectedStudent():null;
  const guess=student&&run.pixelGuesses?.[student.n];
  const locked=!!guess&&!run.pixelConfig?.allowUpdates;
  const rounds=Array.isArray(run.pixelConfig?.images)&&run.pixelConfig.images.length?
   run.pixelConfig.images.length:1;
  const index=validIndex(run.pixelImageIndex,rounds);
  prompt.classList.add('pixel-student-simple');
  prompt.classList.toggle('pixel-student-locked',locked);
  if(!prompt.querySelector('.pixel-student-top')){
   const eyebrow=prompt.querySelector('.eyebrow');
   if(eyebrow){
    eyebrow.textContent='PIXEL REVEAL';
    const top=document.createElement('div');top.className='pixel-student-top';
    eyebrow.parentNode.insertBefore(top,eyebrow);
    top.appendChild(eyebrow);
    top.insertAdjacentHTML('beforeend',
     '<span class="pixel-student-round" aria-label="Image '+(index+1)+' of '+rounds+'">'+
     'IMAGE '+(index+1)+' / '+rounds+'</span>');
   }
  }
  const heading=prompt.querySelector('h2');
  if(heading)heading.textContent=locked?'Guess sent!':'What do you see?';
  const description=prompt.querySelector(':scope > p');
  if(description)description.textContent='Look at the class screen. Make your guess.';
  const lockedPanel=prompt.querySelector('.orbit-transmitted');
  if(lockedPanel){
   lockedPanel.classList.add('pixel-student-confirmation');
   const note=lockedPanel.querySelector('p');
   if(note)note.textContent='Only your teacher can see it.';
  }
  const entry=prompt.querySelector('.pixel-student-guess');
  const input=entry?.querySelector('#pixelGuessInput');
  if(entry&&input){
   const extra=entry.querySelector('small');
   if(extra)extra.textContent=guess?
    'Your guess is private. You can change it.':'Only your teacher can see your guess.';
   input.setAttribute('aria-label','Your mystery image guess');
   input.setAttribute('autocomplete','off');
   input.setAttribute('enterkeyhint','send');
   input.placeholder='Type your guess…';
   // The original native button owns the submit handler. Move it beside
   // the field rather than creating another submit path or changing scoring.
   const from=document.querySelector('#studentControls #sendPixelGuessBtn');
   if(from){
    // The native renderer queries by ID when attaching its click handler.
    // A previously moved button can be found before the replacement tray
    // button, so bind the current button to the very same native function.
    if(typeof submitPixelGuess==='function')from.onclick=submitPixelGuess;
    entry.querySelector('#sendPixelGuessBtn')?.remove();
    from.type='button';
    from.classList.add('pixel-student-send');
    from.innerHTML='<span aria-hidden="true">➜</span> '+
     (guess?'Update my guess':'Send my guess');
    entry.appendChild(from);
   }
   const button=entry.querySelector('#sendPixelGuessBtn');
   if(button){
    const update=()=>{
     // Native classroom redraws may replace the action while retaining the
     // original input node. Always update the current live button.
     const live=entry.querySelector('#sendPixelGuessBtn');
     if(live)live.disabled=!input.value.trim();
    };
    if(!input.dataset.pixelSimpleWired){
     input.dataset.pixelSimpleWired='1';
     input.addEventListener('input',update);
     input.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&!e.isComposing&&input.value.trim()){
       e.preventDefault();
       const send=entry.querySelector('#sendPixelGuessBtn');
       if(send&&!send.disabled)send.click();
      }
     });
    }
    update();
   }
  }
  document.body.classList.add('pixel-student-current');
 }
 function enhance(){
  if(typeof state==='undefined')return;
  if(state.screen==='activities'&&state.activeApp==='pixel')enhanceSetup();
  enhanceController();
  enhanceCinematic();
  if(document.body?.classList.contains('role-student'))enhanceStudent();
 }
 function schedule(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;enhance()});
 }
 // Capture edits immediately even when the native setup rerenders and the
 // per-field enhancement has not yet run its next animation frame.
 document.addEventListener('input',e=>{
  if(typeof state==='undefined'||state.activeApp!=='pixel')return;
  if(e.target.id!=='pixelAnswer'&&e.target.id!=='pixelAcceptedAnswers')return;
  const d=state.pixelDraft;
  if(!d||!Array.isArray(d.images)||!d.images.length)return;
  const item=d.images[validIndex(d.imageIndex,d.images.length)];
  if(e.target.id==='pixelAnswer'){
   const previous=item.answer||'';
   item.answer=d.answer=e.target.value;
   item.acceptedAnswers=copyAnswers(d.acceptedAnswers).filter(v=>v!==previous||v===d.answer);
  }else{
   item.acceptedAnswers=copyAnswers(d.acceptedAnswers);
  }
 });
 document.addEventListener('input',e=>{
  if(e.target.id==='pixelStudioSearch'){
   savedLibraryQuery=e.target.value;
   applySavedLibraryQuery(document.querySelector('#activityGrid .pixel-setup'));
   return;
  }
  if(!['pixelName','pixelAnswer','pixelAcceptedAnswers'].includes(e.target.id))return;
  // Native field handlers ran at target phase. Refresh status now so Save
  // never displays a stale state while the teacher is editing a field.
  const setup=document.querySelector('#activityGrid .pixel-setup');
  if(setup&&state.activeApp==='pixel'){
   const d=currentDraft();enhanceSavedStudio(setup,d);
   updateStudioRoundStatus(setup,d);
  }
  else schedule();
 });
 document.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(!btn)return;
  // Native save has already completed at the button before document bubbling.
  // Repaint only after a successful local-storage save so its library card appears.
  if(btn.id==='savePixelBtn'){
   if(state.screen==='activities'&&state.activeApp==='pixel'&&
      loadSavedPixels().some(entry=>entry.savedId&&entry.savedId===state.pixelDraft?.savedId))
    renderActivities();
   return;
  }
  if(btn.hasAttribute('data-pixel-studio-load')){
   const entry=loadSavedPixels().find(item=>String(item.savedId)===btn.getAttribute('data-pixel-studio-load'));
   if(entry){state.pixelDraft=structuredClone(entry);renderActivities();toast('Saved PIXEL REVEAL loaded')}
   return;
  }
  if(btn.hasAttribute('data-pixel-studio-delete')){
   deleteSavedPixel(btn.getAttribute('data-pixel-studio-delete'));
   return;
  }
  if(btn.matches('[data-pixel-round-prev]'))return switchRound((state.activityRun.pixelImageIndex||0)-1);
  if(btn.matches('[data-pixel-round-next]'))return switchRound((state.activityRun.pixelImageIndex||0)+1);
  const d=state.activeApp==='pixel'?currentDraft():null;
  if(!d)return;
  if(btn.matches('[data-pixel-next-missing]')){
   const target=Number(btn.dataset.targetIndex);
   if(!btn.disabled&&Number.isInteger(target)&&target>=0&&target<d.images.length){
    selectImage(d,target);renderActivities();
   }
   return;
  }
  for(const [attr,fn] of [
   ['data-pixel-batch-select',i=>{selectImage(d,i);renderActivities()}],
   ['data-pixel-batch-left',i=>reorder(d,i,-1)],
   ['data-pixel-batch-right',i=>reorder(d,i,1)],
   ['data-pixel-batch-remove',i=>remove(d,i)]
  ]){
   if(btn.hasAttribute(attr)){fn(Number(btn.getAttribute(attr)));return}
  }
 });
 function boot(){
  if(!document.body)return;
  new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
  schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
 window.SIPixelBatch={version:'4m-d',upload,normalize,switchRound,snapshot,enhanceCinematic,enhanceStudent,MAX_IMAGES};
})();
