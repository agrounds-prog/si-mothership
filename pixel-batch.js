/* PIXEL REVEAL multi-image activity, v1.
   Enhances the existing single-image game without changing legacy drafts,
   native scoring, private guesses, or server persistence. */
(function(){
 'use strict';
 if(window.SIPixelBatch)return;
 const MAX_IMAGES=12,MAX_DATA_CHARS=190000;
 let busy=false,scheduled=false;
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
  syncAnswer(d);
  if(replace){d.images=[];d.answer='';d.acceptedAnswers=[]}
  let added=0,firstIndex=d.images.length;
  for(const file of selected){
   if(status)status.textContent='Preparing '+(added+1)+' of '+selected.length+' images…';
   try{
    const image=await imageFile(file);
    d.images.push({image,answer:'',acceptedAnswers:[]});
    added++;
   }catch(e){toast(String(e.message||e))}
  }
  if(!d.images.length)d.images=[{image:pixelDemoImage(),answer:'Giraffe',acceptedAnswers:['Giraffe']}];
  selectImage(d,Math.min(firstIndex,d.images.length-1),false);
  busy=false;
  renderActivities();
  toast(added+' image'+(added===1?'':'s')+' added to PIXEL REVEAL'+(raster.length>selected.length?' (12-image limit)':''));
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
  if(setup.querySelector('.pixel-batch-manager'))return;
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
    d.images.length+' mystery image'+(d.images.length===1?'':'s')+' ready. Each image has its own answer and guesses.</p>';
  preview.after(manager);
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
  if(!run||run.activityId!=='pixel-game')return;
  const images=run.pixelConfig?.images;
  if(!Array.isArray(images)||images.length<2)return;
  const side=document.querySelector('#activityControllerPanel .pixel-control-side');
  if(!side||side.querySelector('.pixel-batch-live'))return;
  const i=validIndex(run.pixelImageIndex,images.length);
  const panel=document.createElement('div');panel.className='pixel-batch-live';
  panel.innerHTML='<strong>IMAGE '+(i+1)+' OF '+images.length+'</strong>'+
   '<div class="pixel-batch-live-actions"><button data-pixel-round-prev '+(i===0?'disabled':'')+'>← Previous Image</button>'+
   '<button data-pixel-round-next '+(i===images.length-1?'disabled':'')+'>Next Image →</button></div>'+
   '<small>Each image keeps its own reveal progress, private guesses, and teacher corrections.</small>';
  const heading=side.querySelector('h3');
  if(heading)heading.after(panel);else side.prepend(panel);
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
 const originalShared=typeof pixelSharedMarkup==='function'?pixelSharedMarkup:null;
 if(originalShared){
  pixelSharedMarkup=function(run,big){
   const html=originalShared(run,big),images=run?.pixelConfig?.images;
   if(!Array.isArray(images)||images.length<2||typeof html!=='string')return html;
   const index=validIndex(run.pixelImageIndex,images.length);
   const badge='<span class="pixel-batch-round-badge">IMAGE '+(index+1)+' / '+images.length+'</span>';
   if(html.includes('<div class="pixel-public-head">'))
    return html.replace('<div class="pixel-public-head">','<div class="pixel-public-head">'+badge);
   if(html.includes('<div class="pixel-results">'))
    return html.replace('<div class="pixel-results">','<div class="pixel-results">'+badge);
   return html;
  };
 }
 function enhanceStudent(){
  const run=typeof state!=='undefined'?state.activityRun:null;
  if(!run||run.activityId!=='pixel-game')return;
  const images=run.pixelConfig?.images;
  if(!Array.isArray(images)||images.length<2)return;
  const prompt=document.querySelector('#studentContent .student-prompt .eyebrow');
  if(prompt&&!prompt.querySelector('.pixel-batch-student-round')){
   const span=document.createElement('span');span.className='pixel-batch-student-round';
   span.textContent=' · IMAGE '+(validIndex(run.pixelImageIndex,images.length)+1)+' / '+images.length;
   prompt.append(span);
  }
 }
 function enhance(){
  if(typeof state==='undefined')return;
  if(state.screen==='activities'&&state.activeApp==='pixel')enhanceSetup();
  enhanceController();
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
 document.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(!btn)return;
  if(btn.matches('[data-pixel-round-prev]'))return switchRound((state.activityRun.pixelImageIndex||0)-1);
  if(btn.matches('[data-pixel-round-next]'))return switchRound((state.activityRun.pixelImageIndex||0)+1);
  const d=state.activeApp==='pixel'?currentDraft():null;
  if(!d)return;
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
 window.SIPixelBatch={version:'1',upload,normalize,switchRound,snapshot,MAX_IMAGES};
})();
