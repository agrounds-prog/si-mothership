/* SI+ v88 · non-destructive presentation media editor assistance.
 * Only augments the existing SI+ builder. All slide data still flows through
 * native slideYoutube.oninput, savePresentation, and Railway persistence. */
(()=>{"use strict";
 if(window.__siPlusMediaPolish88)return;window.__siPlusMediaPolish88=true;
 const ROOT="#presentationBuilderPanel";
 const feedback=(node,message,kind)=>{
  if(!node)return;
  node.textContent=message;node.dataset.state=kind||"info";
 };
 function mount(){
  const root=document.querySelector(ROOT);
  const input=root?.querySelector("#slideYoutube");
  const editor=input?.closest(".si-plus-video-editor");
  if(!editor)return;
  if(editor.querySelector(".si-plus-media-tools"))return;
  const tools=document.createElement("div");
  tools.className="si-plus-media-tools";
  tools.innerHTML='<div class="si-plus-media-actions"><button type="button" class="si-plus-media-paste" id="siPlusPasteVideo" title="Paste a YouTube video URL from clipboard">▣ Paste Link</button><button type="button" class="si-plus-media-clear" id="siPlusClearVideo" title="Remove the video link from this slide">× Clear Video</button></div><div id="siPlusVideoSupport" class="si-plus-media-feedback" role="status" aria-live="polite"></div>';
  input.insertAdjacentElement("afterend",tools);
  const status=tools.querySelector("#siPlusVideoSupport");
  const clear=tools.querySelector("#siPlusClearVideo");
  const paste=tools.querySelector("#siPlusPasteVideo");
  input.setAttribute("aria-describedby","siPlusVideoSupport");
  const update=()=>{
   const text=input.value.trim();
   let id=null;
   if(text){try{
    let uri=/^https?:\/\//i.test(text)?text:"https://"+text;
    const url=new URL(uri),host=url.hostname.replace(/^www\./,"");
    if(host==="youtu.be")id=url.pathname.split("/").filter(Boolean)[0]||null;
    else if(host==="youtube.com"||host==="m.youtube.com"||host==="music.youtube.com"||host==="youtube-nocookie.com")
      id=url.searchParams.get("v")||(url.pathname.match(/\/(?:shorts|embed|live)\/([^/?#]+)/)||[])[1]||null;
    if(id&&!/^[a-zA-Z0-9_-]{11}$/.test(id))id=null;
   }catch(e){}}
   if(!text)feedback(status,"Optional video · paste a YouTube watch, Shorts, or share link.","empty");
   else if(id)feedback(status,"✓ Video linked to this slide · 16:9 player appears during presentation.","valid");
   else feedback(status,"⚠ Link not recognized. Try a youtube.com/watch or youtu.be URL.","invalid");
   clear.disabled=!text;
  };
  input.addEventListener("input",update);
  clear.addEventListener("click",()=>{
   input.value="";
   input.dispatchEvent(new Event("input",{bubbles:true}));
   input.focus();
  });
  paste.addEventListener("click",async()=>{
   if(!navigator.clipboard?.readText){
    feedback(status,"Clipboard permission unavailable. Paste the link directly into the field.","invalid");
    input.focus();return;
   }
   try{
    const text=String(await navigator.clipboard.readText()||"").trim();
    if(!text){feedback(status,"Your clipboard is empty. Copy a YouTube link first.","invalid");return;}
    if(!document.contains(input))return;
    input.value=text;input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();
   }catch(e){
    feedback(status,"Clipboard blocked. Use Ctrl+V (or Paste) in the link field.","invalid");
    input.focus();
   }
  });
  update();
 }
 function start(){
  const root=document.querySelector(ROOT);
  if(!root)return;
  let scheduled=false;
  new MutationObserver(()=>{
   if(scheduled)return;
   scheduled=true;
   queueMicrotask(()=>{scheduled=false;mount()});
  }).observe(root,{subtree:true,childList:true});
  mount();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();


/* SI+ teacher-only draft preview v89.
   Never broadcasts, launches an activity, or persists the draft. */
(()=>{
 "use strict";
 if(window.SIPlusPresentationPreview)return;
 const editor=()=>document.querySelector("#presentationBuilderPanel");
 let overlay=null,position=0,returnFocus=null,savedDeck=null;
 const deck=()=>savedDeck||state.presentationEditor?.draft||null;
 const permitted=()=>typeof state!=="undefined"
   && typeof SESSION_ROLE!=="undefined" && SESSION_ROLE==="teacher"
   && state.screen==="activities" && !state.activityRun
   && ((savedDeck && state.activeApp==="si-plus" && state.presentationLibraryOpen)
       || !!state.presentationEditor?.draft);
 const slideCount=()=>deck()?.slides?.length||0;
 // Render using the same presentation markup as the actual projector. The
 // temporary activity exists for this one synchronous render ONLY.
 function projectorMarkup(index){
   const selected=deck();
   const activitiesBefore=state.activities,runBefore=state.activityRun;
   const token=Symbol("private-si-plus-preview");
   try{
     state.activities=[...activitiesBefore,{...selected,id:token,type:"presentation"}];
     state.activityRun={activityId:token,phase:"running",slideIndex:index,
       responses:{},showResults:false,revealAnswer:false};
     return activitySharedMarkup(true);
   }finally{
     state.activityRun=runBefore;
     state.activities=activitiesBefore;
   }
 }
 function update(){
   if(!overlay)return;
   if(!permitted()||!slideCount()){close();return}
   position=Math.max(0,Math.min(position,slideCount()-1));
   const selected=deck();
   overlay.querySelector(".sipreview-title").textContent=selected.deckTitle||selected.name||"Untitled Presentation";
   overlay.querySelector(".sipreview-count").textContent="Slide "+(position+1)+" of "+slideCount();
   overlay.querySelector(".sipreview-slide-label").textContent=
     selected.slides[position].listTitle||selected.slides[position].title||"Slide "+(position+1);
   overlay.querySelector(".sipreview-stage").innerHTML=projectorMarkup(position);
   overlay.querySelector('[data-sipreview="prev"]').disabled=position===0;
   overlay.querySelector('[data-sipreview="next"]').disabled=position===slideCount()-1;
 }
 function go(next){
   if(!overlay||!permitted())return;
   position=Math.max(0,Math.min(slideCount()-1,next));
   update();
 }
 function onKeys(e){
   if(!overlay)return;
   if(e.key==="Escape"){e.preventDefault();close();return}
   if(e.key==="ArrowRight"||e.key==="PageDown"){e.preventDefault();go(position+1);return}
   if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();go(position-1);return}
   if(e.key==="Home"){e.preventDefault();go(0);return}
   if(e.key==="End"){e.preventDefault();go(slideCount()-1);return}
   if(e.key!=="Tab")return;
   const controls=[...overlay.querySelectorAll("button:not(:disabled)")];
   if(!controls.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey && (document.activeElement===first||!overlay.contains(document.activeElement))){
     e.preventDefault();last.focus();
   }else if(!e.shiftKey && (document.activeElement===last||!overlay.contains(document.activeElement))){
     e.preventDefault();first.focus();
   }
 }
 function close(){
   if(!overlay)return;
   const old=returnFocus;
   overlay.remove();overlay=null;returnFocus=null;savedDeck=null;
   document.body.classList.remove("sipreview-open");
   document.removeEventListener("keydown",onKeys,true);
   if(old?.isConnected)old.focus();
   else editor()?.querySelector("#siPlusPreviewBtn")?.focus();
 }
 function open(){
   savedDeck=null;
   if(!permitted()||!slideCount())return;
   if(overlay){update();return}
   returnFocus=document.activeElement;
   position=Math.min(Math.max(Number(state.editorSlide)||0,0),slideCount()-1);
   showPreview();
 }
 function openAt(index){
   savedDeck=null;
   if(!permitted()||!slideCount())return;
   if(overlay){go(index);return}
   returnFocus=document.activeElement;
   position=Math.max(0,Math.min(slideCount()-1,Number(index)||0));
   showPreview();
 }
 function openSaved(id){
   if(typeof state==="undefined" || !state.presentationLibraryOpen
      || state.activeApp!=="si-plus" || state.activityRun)return;
   const chosen=state.activities.find(a=>a.type==="presentation"&&String(a.id)===String(id));
   if(!chosen || !Array.isArray(chosen.slides) || !chosen.slides.length)return;
   if(overlay)close();
   savedDeck=chosen;
   if(!permitted()){savedDeck=null;return}
   returnFocus=document.activeElement;
   position=0;
   showPreview();
 }
 function showPreview(){
   overlay=document.createElement("div");
   overlay.id="siPlusPreviewOverlay";
   overlay.className="sipreview-overlay";
   overlay.innerHTML=`<section class="sipreview-dialog" role="dialog" aria-modal="true" aria-label="SI+ Teacher Presentation Preview">
     <header class="sipreview-header">
       <div class="sipreview-heading"><span class="sipreview-eyebrow">SI+ · PRIVATE TEACHER PREVIEW</span>
         <h2 class="sipreview-title"></h2><p>Projector-style 16:9 · No students can see this preview</p></div>
       <button type="button" class="sipreview-close" data-sipreview="close" aria-label="Close presentation preview">× Close</button>
     </header>
     <main class="sipreview-viewport" aria-label="Slide preview"><div class="sipreview-stage"></div></main>
     <footer class="sipreview-toolbar">
       <button type="button" data-sipreview="prev">← Previous</button>
       <div class="sipreview-details"><strong class="sipreview-count" role="status" aria-live="polite"></strong>
         <small class="sipreview-slide-label"></small></div>
       <button type="button" data-sipreview="next">Next →</button>
     </footer>
     <div class="sipreview-tip">Arrow keys to navigate · Esc to close · Preview never saves or launches slides</div>
   </section>`;
   overlay.addEventListener("click",e=>{
     const action=e.target.closest("[data-sipreview]")?.dataset.sipreview;
     if(action==="close")close();
     else if(action==="prev")go(position-1);
     else if(action==="next")go(position+1);
   });
   document.body.appendChild(overlay);
   document.body.classList.add("sipreview-open");
   document.addEventListener("keydown",onKeys,true);
   update();
   overlay.querySelector(".sipreview-close").focus();
 }
 function mount(){
   if(overlay&&!permitted())close();
   if(typeof state==="undefined" || state.activeApp!=="si-plus" || state.activityRun)return;
   const actions=editor()?.querySelector(".builder-top-actions");
   if(actions && !actions.querySelector("#siPlusPreviewBtn") && state.presentationEditor?.draft){
     const button=document.createElement("button");
     button.type="button";button.id="siPlusPreviewBtn";
     button.textContent="◉ Preview Presentation";
     button.title="Private full-size slide preview. Does not launch or save.";
     button.setAttribute("aria-label","Preview presentation privately before presenting");
     button.addEventListener("click",open);
     const organizer=actions.querySelector("#siOrgToggle");
     if(organizer)organizer.insertAdjacentElement("afterend",button);
     else actions.prepend(button);
   }
   // Visible entry point on the actual SI+ home, not just inside the editor.
   const launchSaved=document.querySelector("#siLoadPresentation");
   if(launchSaved && !document.querySelector("#siPreviewLibraryBtn")){
     const button=document.createElement("button");
     button.type="button";button.id="siPreviewLibraryBtn";
     button.textContent="◉ Preview Saved Slides";
     button.title="Review any saved presentation without sending it to class";
     button.onclick=()=>launchSaved.click();
     launchSaved.insertAdjacentElement("afterend",button);
   }
   // Every saved presentation can be previewed without launching or editing.
   document.querySelectorAll("#savedPresentationPicker .saved-deck-actions").forEach(actions=>{
     const edit=actions.querySelector("[data-edit-saved]");
     const load=actions.querySelector("[data-load-saved]");
     if(!edit||actions.querySelector("[data-si-preview-saved]"))return;
     const button=document.createElement("button");
     button.type="button";button.className="si-plus-saved-preview";
     button.dataset.siPreviewSaved=edit.dataset.editSaved;
     button.textContent="◉ Preview";
     button.setAttribute("aria-label","Preview saved presentation without launching");
     button.onclick=()=>openSaved(button.dataset.siPreviewSaved);
     if(load)load.insertAdjacentElement("beforebegin",button);
     else actions.prepend(button);
   });
 }
 function start(){
   const roots=[editor(),document.querySelector("#activitiesPanel")].filter(Boolean);
   if(!roots.length)return;
   let pending=false;
   const observer=new MutationObserver(()=>{
     if(pending)return;
     pending=true;
     queueMicrotask(()=>{pending=false;mount()});
   });
   roots.forEach(root=>observer.observe(root,{childList:true,subtree:true}));
   mount();
 }
 window.SIPlusPresentationPreview={open,openAt,openSaved,close,get active(){return !!overlay;}};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();


/* SI+ v90 — recover unfinished slide edits after a teacher-tab refresh.
   This is a LOCAL safety copy in IndexedDB, not an automatic publish.
   Normal Save Presentation continues to commit to Railway unchanged. */
(()=>{
 "use strict";
 if(window.SIPlusDraftRecovery)return;
 const DB_NAME="siMothership.siPlusDrafts.v1",TABLE="backups",KEY="latest";
 const inTeacher=()=>typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE==="teacher";
 if(!inTeacher()||typeof indexedDB==="undefined")return;
 let database=null,backup=null,lastJson="",sawEditor=false,lastRecord=null;
 let chain=Promise.resolve(),timer=null,booted=false;
 function openDB(){
   if(database)return Promise.resolve(database);
   return new Promise((resolve,reject)=>{
     const req=indexedDB.open(DB_NAME,1);
     req.onupgradeneeded=()=>{
       if(!req.result.objectStoreNames.contains(TABLE))req.result.createObjectStore(TABLE);
     };
     req.onsuccess=()=>{database=req.result;resolve(database)};
     req.onerror=()=>reject(req.error||new Error("Draft storage unavailable"));
   });
 }
 async function storage(mode,op){
   const db=await openDB();
   return new Promise((resolve,reject)=>{
     const tx=db.transaction(TABLE,mode),store=tx.objectStore(TABLE);
     const req=op(store);
     let result;
     req.onsuccess=()=>{result=req.result};
     tx.oncomplete=()=>resolve(result);
     tx.onerror=()=>reject(tx.error||new Error("Draft storage failed"));
     tx.onabort=()=>reject(tx.error||new Error("Draft storage interrupted"));
   });
 }
 const findSaved=record=>{
   const saved=(typeof state!=="undefined"&&Array.isArray(state.activities))
     ? state.activities.find(a=>a.type==="presentation"&&
         String(a.id)===String(record?.draft?.id)):null;
   if(!saved||!record?.draft)return false;
   const title=s=>String(s?.deckTitle||s?.name||"").trim()||"Untitled Presentation";
   return title(saved)===title(record.draft)&&
     JSON.stringify(saved.slides)===JSON.stringify(record.draft.slides);
 };
 const edit=()=>typeof state!=="undefined"&&state.presentationEditor?.draft&&
   state.activeApp==="si-plus"&&!state.activityRun?state.presentationEditor:null;
 function paint(){
   if(!inTeacher()||typeof state==="undefined"||state.activityRun)return;
   const home=document.querySelector("#siLoadPresentation");
   const existing=document.querySelector("#siPlusRecoverDraft");
   if(home && backup && !edit() && !findSaved(backup)){
     if(!existing){
       const actions=home.parentElement;
       if(actions){
         const holder=document.createElement("div");
         holder.id="siPlusRecoverDraft";
         holder.className="si-plus-draft-recovery";
         holder.innerHTML='<button type="button" class="si-plus-draft-resume">↺ Recover Unsaved Draft</button>'
           +'<button type="button" class="si-plus-draft-discard" aria-label="Discard local unsaved draft">Discard</button>'
           +'<small class="si-plus-draft-caption"></small>';
         actions.insertAdjacentElement("afterend",holder);
         holder.querySelector(".si-plus-draft-resume").addEventListener("click",restore);
         holder.querySelector(".si-plus-draft-discard").addEventListener("click",discard);
       }
     }
     const cap=document.querySelector(".si-plus-draft-caption");
     const caption="Saved on this device · "+
       String(backup.draft.deckTitle||backup.draft.name||"Untitled Presentation");
     if(cap&&cap.textContent!==caption)cap.textContent=caption;
   }else existing?.remove();
   const box=document.querySelector("#presentationBuilderPanel");
   const saveStatus=box?.querySelector("#siPlusSaveStatus");
   if(saveStatus&&edit()){
     let local=box.querySelector("#siPlusLocalDraftStatus");
     if(!local){
       local=document.createElement("span");
       local.id="siPlusLocalDraftStatus";local.className="si-plus-local-draft-status";
       local.setAttribute("role","status");
       saveStatus.insertAdjacentElement("afterend",local);
     }
     const message=backup && lastJson===JSON.stringify(edit().draft)
       ?"✓ Local draft backup ready · Save Presentation to keep it in Railway"
       :"Draft changes are backed up on this device while you edit.";
     if(local.textContent!==message)local.textContent=message;
   }
 }
 function queue(op){
   chain=chain.catch(()=>{}).then(op);
   return chain;
 }
 async function poll(){
   if(!inTeacher()||typeof state==="undefined")return;
   const current=edit();
   if(current){
     sawEditor=true;
     let json;try{json=JSON.stringify(current.draft)}catch(e){return}
     if(json!==lastJson){
       lastJson=json;
       const record={draft:JSON.parse(json),originalId:current.originalId,
         editorSlide:Math.max(0,Number(state.editorSlide)||0),savedAt:Date.now()};
       lastRecord=record;
       await queue(async()=>{
         try{
           await storage("readwrite",s=>s.put(record,KEY));
           backup=record;
         }catch(e){backup=null;console.warn("SI+ draft backup unavailable",e)}
         paint();
       });
     }
   }else if(sawEditor){
     sawEditor=false;
     const previous=lastRecord;
     if(previous&&findSaved(previous)){
       await queue(async()=>{
         try{await storage("readwrite",s=>s.delete(KEY))}catch(e){}
         if(backup===previous)backup=null;
         lastRecord=null;lastJson="";
         paint();
       });
     }
   }
   paint();
 }
 async function flush(){
   clearTimeout(timer);
   await poll();
   await chain.catch(()=>{});
   return backup;
 }
 function soon(){
   clearTimeout(timer);
   timer=setTimeout(()=>{void poll()},300);
 }
 async function restore(){
   if(!backup||typeof openNewPresentation!=="function"||state.activityRun)return;
   const record=backup;
   openNewPresentation();
   state.presentationEditor={
     originalId:record.originalId??null,
     draft:JSON.parse(JSON.stringify(record.draft))
   };
   state.editorSlide=Math.max(0,Math.min(
     Number(record.editorSlide)||0,state.presentationEditor.draft.slides.length-1));
   state.activeApp="si-plus";state.presentationLibraryOpen=false;
   render();
   lastJson="";sawEditor=false;
   void poll();
   if(typeof toast==="function")toast("Recovered local SI+ draft · Save to Library when ready");
 }
 async function discard(){
   if(!backup)return;
   if(!confirm("Discard this locally recovered SI+ draft? Your saved presentations will remain untouched."))return;
   await queue(async()=>{
     await storage("readwrite",s=>s.delete(KEY));
     backup=null;lastRecord=null;lastJson="";
   }).catch(e=>console.warn("SI+ draft discard failed",e));
   paint();
 }
 function start(){
   if(booted)return;booted=true;
   openDB().then(()=>storage("readonly",s=>s.get(KEY))).then(record=>{
     if(record?.draft&&Array.isArray(record.draft.slides)&&record.draft.slides.length)
       backup=record;
     paint();
   }).catch(e=>console.warn("SI+ draft recovery unavailable",e));
   document.addEventListener("input",soon,true);
   document.addEventListener("change",soon,true);
   document.addEventListener("click",soon,true);
   document.addEventListener("visibilitychange",()=>{if(document.hidden)void poll()});
   const root=document.querySelector("#activitiesPanel");
   if(root){
     let queued=false;
     new MutationObserver(()=>{
       if(queued)return;queued=true;
       queueMicrotask(()=>{queued=false;paint()});
     }).observe(root,{childList:true,subtree:true});
   }
   setInterval(()=>{void poll()},1300);
 }
 window.SIPlusDraftRecovery={flush,get available(){return !!backup}};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();


/* SI+ v91: live-slide navigation + one-time slide transitions.
   Reads the existing presentation state; all actions use native changeSlide()
   so shared screens, responses and session persistence remain authoritative.
   Intentionally never touches video iframes or rewrites slide markup. */
(()=>{
 "use strict";
 if(window.SIPlusLiveNavigation)return;
 const teacher=()=>typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE==="teacher";
 const current=()=>{
   if(typeof state==="undefined"||!state.activityRun||
      state.activityRun.phase!=="running"||typeof activeActivity!=="function")return null;
   const deck=activeActivity();
   return deck?.type==="presentation"&&Array.isArray(deck.slides)&&deck.slides.length
      ?{deck,run:state.activityRun}:null;
 };
 const index=()=>Math.max(0,Number(current()?.run.slideIndex)||0);
 const slideName=(slide,i)=>String(slide.listTitle||slide.title||"Slide "+(i+1)).trim();
 const controls=()=>document.querySelector("#activityControllerPanel .presentation-controls")
    ?.querySelector("#prevSlideBtn")?.closest(".presentation-controls")||null;
 function mountNavigation(){
   if(!teacher())return;
   const active=current(),row=controls();
   if(!active||!row){
     document.querySelector("#siPlusSlideJumpBlock")?.remove();
     return;
   }
   const {deck}=active;
   let holder=row.querySelector("#siPlusSlideJumpBlock");
   if(!holder){
     holder=document.createElement("label");
     holder.id="siPlusSlideJumpBlock";
     holder.className="si-plus-slide-jump";
     holder.innerHTML='<span>GO TO SLIDE</span><select id="siPlusSlideJump" aria-label="Jump to slide"></select>';
     row.appendChild(holder);
     holder.querySelector("select").addEventListener("change",event=>{
       const live=current();if(!live||typeof changeSlide!=="function")return;
       const selected=Number(event.currentTarget.value);
       if(!Number.isInteger(selected)||selected<0||selected>=live.deck.slides.length)return;
       if(selected!==index())changeSlide(selected-index());
     });
   }
   const select=holder.querySelector("select");
   // Teacher's control panel is frequently reconstructed while students
   // respond. Avoid touching options unless this actual deck changed.
   const signature=deck.slides.map((s,i)=>i+":"+slideName(s,i)).join("|");
   if(select.dataset.deckId!==String(deck.id)||
      select.dataset.deckSignature!==signature){
     select.replaceChildren(...deck.slides.map((slide,i)=>{
       const option=document.createElement("option");
       option.value=String(i);
       option.textContent=(i+1)+" · "+slideName(slide,i);
       return option;
     }));
     select.dataset.deckId=String(deck.id);
     select.dataset.deckSignature=signature;
   }
   const selected=String(index());
   if(select.value!==selected)select.value=selected;
   select.disabled=deck.slides.length<2;
   const prev=row.querySelector("#prevSlideBtn");
   const next=row.querySelector("#nextSlideBtn");
   if(prev)prev.disabled=index()===0;
   if(next)next.disabled=index()===deck.slides.length-1;
   holder.title="Choose any slide without advancing through the whole deck";
 }
 function editable(target){
   return !!target?.closest?.(
     "input, textarea, select, button, [contenteditable], [role=dialog], .sipreview-overlay"
   );
 }
 function onKey(event){
   // Mothership mounts several dialogs as hidden DOM elements, so a
   // mere querySelector would disable presentation hotkeys permanently.
   const openModal=[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
     .some(el=>el.getClientRects().length>0&&
       getComputedStyle(el).visibility!=="hidden");
   if(!teacher()||event.defaultPrevented||event.isComposing||
     event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||editable(event.target)||
     document.querySelector("#siPlusPreviewOverlay")||openModal)return;
   const active=current();
   if(!active||typeof changeSlide!=="function")return;
   let target;
   switch(event.key){
    case "ArrowRight":case "PageDown":target=index()+1;break;
    case "ArrowLeft":case "PageUp":target=index()-1;break;
    case "Home":target=0;break;
    case "End":target=active.deck.slides.length-1;break;
    default:return;
   }
   target=Math.max(0,Math.min(active.deck.slides.length-1,target));
   if(target===index())return;
   event.preventDefault();
   changeSlide(target-index());
 }
 const seen=new WeakMap();
 function markActualSlideChanges(){
   if(typeof state==="undefined"||typeof activeActivity!=="function")return;
   const active=current();
   for(const id of ["sharedContent","mirrorContent"]){
     const host=document.getElementById(id);
     if(!host)continue;
     const stage=host.querySelector(".si-plus-slide-stage");
     if(!active||!stage){seen.delete(host);continue}
     const signature=String(active.run.runToken||active.run.activityId)
       +"|"+String(active.deck.id)+"|"+String(active.run.slideIndex||0);
     const previous=seen.get(host);
     if(previous===signature)continue;
     seen.set(host,signature);
     // No entrance animation for first render, restore, or a rejoin.
     // Only a genuine advance within the same live presentation fades in.
     if(previous && previous.split("|").slice(0,2).join("|")===
        signature.split("|").slice(0,2).join("|")){
       stage.classList.remove("si-plus-slide-enter");
       void stage.offsetWidth;
       stage.classList.add("si-plus-slide-enter");
     }
   }
 }
 function start(){
   const panel=document.querySelector("#activityControllerPanel");
   const hosts=["sharedContent","mirrorContent"].map(x=>document.getElementById(x)).filter(Boolean);
   let queued=false;
   function onMutations(){
     if(queued)return;
     queued=true;
     queueMicrotask(()=>{
       queued=false;mountNavigation();markActualSlideChanges();
     });
   }
   if(panel)new MutationObserver(onMutations).observe(panel,{childList:true,subtree:true});
   for(const host of hosts)new MutationObserver(onMutations).observe(host,{childList:true,subtree:true});
   if(teacher())document.addEventListener("keydown",onKey,false);
   mountNavigation();markActualSlideChanges();
 }
 window.SIPlusLiveNavigation={get active(){return !!current()},goto(i){
   const active=current(),n=Number(i);
   if(!teacher()||!active||!Number.isInteger(n)||n<0||n>=active.deck.slides.length)return false;
   if(n!==index())changeSlide(n-index());return true;
 }};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();


/* SI+ v92: in-lesson Quick Poll bridge.
   The dedicated Quick Poll overlay retains its own REST/SQLite records,
   and no SI+ activityRun/slide/response is copied, replaced or paused. */
(()=>{
 "use strict";
 if(window.SIPlusPollBridge)return;
 const teacher=()=>typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE==="teacher";
 const active=()=>{
   if(!teacher()||typeof state==="undefined"||!state.activityRun||
      state.activityRun.phase!=="running"||typeof activeActivity!=="function")return null;
   const deck=activeActivity(),run=state.activityRun;
   return deck?.type==="presentation"&&Array.isArray(deck.slides)?
     {deck,run,slide:deck.slides[Number(run.slideIndex)||0]}:null;
 };
 const poll=()=>window.SIQuickPoll||null;
 const status=()=>poll()?.teacherStatus?.()||{phase:"none",visible:false,voters:0};
 const context=()=>{
   const a=active();if(!a)return null;
   const slide=a.slide||{},choices=Array.isArray(slide.choices)?slide.choices:[];
   const validChoices=choices.filter(c=>String(c?.text||"").trim()).slice(0,6);
   const fromSlide=["question","poll"].includes(slide.type)&&validChoices.length>=2
     &&String(slide.title||"").trim()!=="";
   return {...a,fromSlide,validChoices};
 };
 function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
 function sync(){
   if(!teacher())return;
   const row=document.querySelector("#activityControllerPanel .presentation-controls");
   const info=context();
   let bridge=document.getElementById("siPlusPollBridge");
   if(!row||!info){
     bridge?.remove();return;
   }
   if(!bridge||bridge.parentElement!==row){
     bridge?.remove();
     bridge=document.createElement("div");
     bridge.id="siPlusPollBridge";
     bridge.className="si-plus-poll-bridge";
     bridge.innerHTML='<div class="si-plus-poll-intro"><strong>⚡ QUICK POLL · SI+</strong><small id="siPlusPollStatus" role="status"></small></div>'+
       '<div class="si-plus-poll-buttons"><button type="button" id="siPlusPollOpen"></button>'+
       '<button type="button" id="siPlusPollScreen" hidden></button></div>';
     row.appendChild(bridge);
     bridge.querySelector("#siPlusPollOpen").addEventListener("click",()=>{
       const now=context(),tool=poll();
       if(!now||!tool?.openFromSiPlus)return;
       const source=now.fromSlide?{
         question:String(now.slide.title||"").trim(),
         description:String(now.slide.text||"").trim(),
         // Never include a question slide's CORRECT answer flag.
         choices:now.validChoices.map(c=>({label:c.text,image:c.image||""}))
       }:null;
       tool.openFromSiPlus(source);
       sync();
     });
     bridge.querySelector("#siPlusPollScreen").addEventListener("click",async event=>{
       const tool=poll(),current=status();
       if(!tool?.setSharedVisible||current.phase==="none")return;
       // Event.currentTarget is cleared after dispatch. Keep the button
       // reference before awaiting the asynchronous poll API request.
       const button=event.currentTarget;
       button.disabled=true;
       try{
         const success=await tool.setSharedVisible(!current.visible);
         if(!success&&typeof toast==="function")
           toast("Could not change Quick Poll display. Open Poll Studio to retry.");
       }finally{button.disabled=false;sync()}
     });
   }
   const live=status(),pollActive=live.phase!=="none";
   const open=bridge.querySelector("#siPlusPollOpen");
   setText(open,live.phase==="open"?"⚡ Manage Live Poll":
     info.fromSlide?"⚡ Poll This Slide":"⚡ Open Quick Poll");
   open.title=live.phase==="open"?"Open Quick Poll Studio without replacing the current poll":
     info.fromSlide?"Prepare a poll from this slide's question and answer choices":
       "Open a new Quick Poll without leaving SI+";
   const screen=bridge.querySelector("#siPlusPollScreen");
   screen.hidden=!pollActive;
   if(pollActive){
     setText(screen,live.visible?"▣ Show SI+ Slide":"◉ Show Poll on Screen");
     screen.title=live.visible?
       "Hide the poll on the projector but keep voting open and preserve this slide":
       "Show the current poll on the shared screen without changing this slide";
   }
   const label=live.phase==="open"?"VOTING OPEN · "+live.voters+" votes":
     live.phase==="closed"?"POLL CLOSED":
     info.fromSlide?"Current slide ready to use as a poll":"Ask the class without changing slides";
   const display=pollActive?" · "+(live.visible?"POLL ON SCREEN":"SLIDE ON SCREEN"):"";
   setText(bridge.querySelector("#siPlusPollStatus"),label+display);
 }
 function start(){
   if(!teacher())return;
   const row=document.getElementById("activityControllerPanel");
   if(row){
     let scheduled=false;
     new MutationObserver(()=>{
       if(scheduled)return;scheduled=true;
       queueMicrotask(()=>{scheduled=false;sync()});
     }).observe(row,{childList:true,subtree:true});
   }
   window.addEventListener("si:quick-poll-status",sync);
   sync();
 }
 window.SIPlusPollBridge={get available(){return !!context()},refresh:sync};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();


/* SI+ v93 — temporary activity break.
   A SINGLE parked SI+ run is kept in the active classroom session snapshot
   (including response maps and reveal state). Launchers, student controls
   and all game setup/finish flows remain their existing implementations.
   No independent saved-presentation or game library records are written. */
(()=>{
 "use strict";
 if(window.SIPlusActivityBreak)return;
 const isTeacher=()=>typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE==="teacher";
 const key="siPlusActivityBreak";
 const session=()=>String(typeof STUDENT_SESSION_ID==="undefined"?"":STUDENT_SESSION_ID||"");
 const parked=()=>{
   if(!isTeacher()||typeof state==="undefined"||!state[key])return null;
   const v=state[key];
   if(!v.run||String(v.sessionId||"")!==session()||state.ended)return null;
   return v;
 };
 const presentation=()=>{
   if(!isTeacher()||typeof state==="undefined"||state.ended)return null;
   const run=state.activityRun,deck=typeof activeActivity==="function"?activeActivity():null;
   return run&&run.phase==="running"&&deck?.type==="presentation"&&
     Array.isArray(deck.slides)&&deck.slides.length?{run,deck}:null;
 };
 const availableApps=()=>typeof APP_REGISTRY!=="undefined"?
   APP_REGISTRY.filter(app=>!["si-plus","scientific-calculator"].includes(app.id)):[];
 let dialog=null,returnBar=null,returnBarCollapsed=false;
 const escText=v=>String(v||"");
 // All checkpoint details are read from the existing live/parked snapshot.
 // Never write slide data, grades, or response maps just to display context.
 const checkpoint=(run,deck)=>{
   const index=Math.max(0,Number(run?.slideIndex)||0);
   const slide=deck?.slides?.[index]||{};
   const title=String(slide.title||slide.listTitle||("Slide "+(index+1))).trim().slice(0,140);
   const answers=run?.responses?.[String(index)];
   return {index,title,total:deck?.slides?.length||0,
     submitted:answers&&typeof answers==="object"?Object.keys(answers).length:0};
 };
 const breakContext=()=>{
   const appId=String(state.activeApp||"");
   const app=availableApps().find(x=>String(x.id)===appId);
   const activeName=app?.name||((state.activityRun&&
     state.activities?.find(x=>String(x.id)===String(state.activityRun.activityId))?.name))||
     (state.screen==="activities"?"Activity Library":"Classroom");
   const poll=window.SIQuickPoll?.teacherStatus?.();
   const pollNote=poll?.visible?" · Quick Poll on shared screen":
     poll?.phase==="open"?" · Live poll (not projected)":"";
   return "Now: "+activeName+pollNote;
 };
 function ui(){
   if(!isTeacher())return;
   const active=presentation(),save=parked();
   const row=document.querySelector("#activityControllerPanel .presentation-controls");
   let launcher=document.getElementById("siPlusActivityBreakLaunch");
   if(active&&!save&&row){
     if(!launcher||launcher.parentElement!==row){
       launcher?.remove();
       launcher=document.createElement("button");
       launcher.type="button";launcher.id="siPlusActivityBreakLaunch";
       launcher.className="si-plus-activity-break-launch";
       launcher.textContent="↗ Open Another Activity";
       launcher.title="Park this presentation and return to the exact slide after another activity";
       launcher.addEventListener("click",open);
       row.appendChild(launcher);
     }
   }else launcher?.remove();
   if(save&&state.screen!=="brb"){
     if(!returnBar){
       returnBar=document.createElement("section");
       returnBar.id="siPlusActivityReturn";
       returnBar.className="si-plus-activity-return";
       returnBar.setAttribute("aria-label","Suspended SI+ presentation");
       returnBar.innerHTML='<div class="si-plus-activity-return-copy" id="siPlusParkedDetails">'+
         '<b>▣ SI+ PRESENTATION PARKED</b><span id="siPlusParkedSummary"></span>'+
         '<small id="siPlusParkedResponses"></small>'+
         '<small id="siPlusParkedContext" role="status" aria-live="polite"></small></div>'+
         '<button type="button" id="siPlusActivityResume">↩ Return to SI+</button>'+
         '<button type="button" id="siPlusActivityCollapse" aria-label="Minimize paused lesson controls" aria-controls="siPlusParkedDetails" aria-expanded="true" title="Minimize paused lesson controls">−</button>'+
         '<button type="button" id="siPlusActivityDiscard" aria-label="Discard parked presentation" title="Discard paused lesson place (saved deck remains)">×</button>';
       const collapse=returnBar.querySelector("#siPlusActivityCollapse");
       collapse.addEventListener("click",()=>{
         returnBarCollapsed=!returnBarCollapsed;
         returnBar.classList.toggle("is-collapsed",returnBarCollapsed);
         collapse.setAttribute("aria-expanded",String(!returnBarCollapsed));
         collapse.setAttribute("aria-label",returnBarCollapsed?"Expand paused lesson controls":"Minimize paused lesson controls");
         collapse.title=returnBarCollapsed?"Expand paused lesson controls":"Minimize paused lesson controls";
         collapse.textContent=returnBarCollapsed?"+":"−";
       });
       if(returnBarCollapsed){
         returnBar.classList.add("is-collapsed");collapse.setAttribute("aria-expanded","false");
         collapse.setAttribute("aria-label","Expand paused lesson controls");
         collapse.title="Expand paused lesson controls";collapse.textContent="+";
       }
       returnBar.querySelector("#siPlusActivityResume").addEventListener("click",()=>{
         if(state.activityRun&&!confirm(
           "End the current activity and return to the parked SI+ slide? Any unfinished game round will end."))return;
         resume();
       });
       returnBar.querySelector("#siPlusActivityDiscard").addEventListener("click",()=>{
         if(!confirm("Discard the saved SI+ place? This does not delete the presentation or its saved library."))return;
         discard();
       });
       document.body.appendChild(returnBar);
     }
     const name=escText(save.name||"Presentation");
     const deck=state.activities?.find(x=>String(x.id)===String(save.run.activityId));
     const slot=checkpoint(save.run,deck);
     const label=name+" · Slide "+(slot.index+1)+(slot.total?" of "+slot.total:"")+
       " · "+slot.title;
     const cap=returnBar.querySelector("#siPlusParkedSummary");
     if(cap&&cap.textContent!==label)cap.textContent=label;
     const answers=returnBar.querySelector("#siPlusParkedResponses");
     const count=slot.submitted+" student response"+(slot.submitted===1?"":"s")+" preserved";
     if(answers&&answers.textContent!==count)answers.textContent=count;
     const context=returnBar.querySelector("#siPlusParkedContext"),message=breakContext();
     if(context&&context.textContent!==message)context.textContent=message;
   }else if(returnBar){returnBar.remove();returnBar=null}
   if(dialog&&!dialog.hidden&&!active)close(false);
 }
 function buildDialog(){
   if(dialog)return;
   dialog=document.createElement("div");
   dialog.id="siPlusActivityBreakDialog";
   dialog.className="si-plus-activity-break-dialog";
   dialog.hidden=true;
   dialog.innerHTML='<section class="si-plus-activity-break-window" role="dialog" aria-modal="true"'+
     ' aria-label="Choose a classroom activity break">'+
     '<div class="si-plus-activity-break-head"><div>'+
     '<small>SI+ · LIVE PRESENTATION</small><h2>Take an Activity Break</h2>'+
     '<p>Your exact slide, responses and presentation settings will be ready when you return.</p>'+
     '</div><button type="button" class="si-plus-activity-break-close" data-break-close aria-label="Close">×</button></div>'+
     '<div class="si-plus-activity-break-guide">Choose a game to temporarily park this lesson, or run a Quick Poll without leaving the slide. Finishing a game returns to this lesson automatically.</div>'+
     '<div class="si-plus-lesson-checkpoint" aria-label="Current lesson checkpoint">'+
       '<div><small>RETURN CHECKPOINT</small><strong id="siPlusBreakLessonTitle"></strong>'+
       '<span id="siPlusBreakLessonMeta"></span></div>'+
       '<button type="button" id="siPlusBreakQuickPoll" data-break-poll>⚡ Poll This Slide</button>'+
     '</div>'+
     '<div class="si-plus-activity-break-grid" id="siPlusBreakChoices"></div>'+
     '<div class="si-plus-activity-break-footer">'+
     '<button type="button" class="si-plus-activity-break-all" data-break-app="library">▦ Browse Full Activity Library</button>'+
     '<button type="button" data-break-close>Cancel · Stay on Current Slide</button></div></section>';
   dialog.addEventListener("click",e=>{
     if(e.target===dialog||e.target.closest("[data-break-close]")){close();return}
     if(e.target.closest("[data-break-poll]")){pollThisSlide();return}
     const button=e.target.closest("[data-break-app]");
     if(button)begin(button.dataset.breakApp);
   });
   document.body.appendChild(dialog);
 }
 function open(){
   const current=presentation();
   if(!current||parked())return false;
   buildDialog();
   const point=checkpoint(current.run,current.deck);
   const title=dialog.querySelector("#siPlusBreakLessonTitle");
   if(title)title.textContent=current.deck.deckTitle||current.deck.name||"SI+ Lesson";
   const detail=dialog.querySelector("#siPlusBreakLessonMeta");
   if(detail)detail.textContent="Slide "+(point.index+1)+" of "+point.total+
      " · "+point.title+" · "+point.submitted+" student response"+
      (point.submitted===1?"":"s")+" kept";
   const pollButton=dialog.querySelector("#siPlusBreakQuickPoll");
   const slide=current.deck.slides[point.index]||{};
   const choices=Array.isArray(slide.choices)?slide.choices.filter(c=>String(c?.text||"").trim()):[];
   const prefill=["question","poll"].includes(slide.type)&&
      String(slide.title||"").trim()&&choices.length>=2;
   if(pollButton){
     pollButton.textContent=prefill?"⚡ Poll This Slide":"⚡ Open Quick Poll";
     pollButton.disabled=!document.querySelector("#siPlusPollOpen");
     pollButton.title="Keep the current slide and student responses while opening Quick Poll";
   }
   const grid=dialog.querySelector("#siPlusBreakChoices");
   grid.replaceChildren();
   for(const app of availableApps()){
     const button=document.createElement("button");
     button.type="button";button.className="si-plus-activity-break-choice";
     button.dataset.breakApp=app.id;
     const icon=document.createElement("span");
     icon.className="si-plus-activity-break-icon";
     if(typeof appIllustratedIconMarkup==="function")icon.innerHTML=appIllustratedIconMarkup(app.id);
     else icon.textContent=app.icon||"✦";
     const copy=document.createElement("span");
     const name=document.createElement("strong"),description=document.createElement("small");
     name.textContent=app.name;description.textContent=app.subtitle||"Classroom activity";
     copy.append(name,description);button.append(icon,copy);grid.appendChild(button);
   }
   dialog.hidden=false;
   dialog.querySelector("[data-break-close]")?.focus({preventScroll:true});
   return true;
 }
 function close(restoreFocus=true){
   if(!dialog)return;
   dialog.hidden=true;
   if(restoreFocus)document.getElementById("siPlusActivityBreakLaunch")?.focus({preventScroll:true});
 }
 // Reuse the EXISTING SI+ poll bridge. Unlike games, a poll must not park
 // or replace the presentation activityRun, and slide answer keys stay private.
 function pollThisSlide(){
   if(!presentation()||parked())return false;
   const native=document.querySelector("#siPlusPollOpen");
   if(!native||native.disabled)return false;
   close(false);
   native.click();
   return true;
 }
 function begin(appId){
   const current=presentation();
   if(!current||parked())return false;
   const app=appId==="library"?null:availableApps().find(x=>x.id===appId);
   if(appId!=="library"&&!app)return false;
   const oldRun=deepClone(current.run);
   state[key]={sessionId:session(),name:current.deck.deckTitle||current.deck.name||"Presentation",
     run:oldRun,parkedAt:Date.now()};
   close(false);
   // The app's existing setup performs the actual launch; the lesson remains
   // parked while the teacher chooses options, even if no game is started.
   state.activityRun=null;
   state.promptActive=false;
   state.presentationEditor=null;state.presentationLibraryOpen=false;
   state.assigningSlot=null;
   state.screen="activities";
   if(app)openApp(app.id);
   else{state.activeApp=null;render()}
   ui();
   if(typeof toast==="function")toast("SI+ slide saved for this session · Choose your activity");
   return true;
 }
 function resume(){
   const saved=parked();
   if(!saved||typeof state==="undefined")return false;
   const deck=state.activities.find(x=>String(x.id)===String(saved.run.activityId));
   if(!deck||deck.type!=="presentation"||!Array.isArray(deck.slides)||!deck.slides.length){
     if(typeof toast==="function")toast("Saved SI+ deck is unavailable. Return to its library to reload.");
     return false;
   }
   const run=deepClone(saved.run);
   run.slideIndex=Math.max(0,Math.min(deck.slides.length-1,Number(run.slideIndex)||0));
   // A fresh delivery token prevents stale game/slide submissions after a
   // break from altering the preserved presentation response map.
   run.runToken=typeof newActivityRunToken==="function"?newActivityRunToken():run.runToken;
   state[key]=null;
   state.activityRun=run;
   state.screen="activity";state.activeApp="si-plus";
   state.promptActive=false;state.assigningSlot=null;
   state.presentationEditor=null;state.presentationLibraryOpen=false;
   render();ui();
   const pollVisible=window.SIQuickPoll?.teacherStatus?.()?.visible===true;
   if(typeof toast==="function")toast("SI+ resumed at slide "+(run.slideIndex+1)+
     " · Responses restored"+(pollVisible?" · Quick Poll is still on the shared screen":""));
   return true;
 }
 function resumeAfterFinish(){
   const saved=parked();
   if(!saved)return false;
   // Only auto-return when another activity completes, not if the same
   // presentation was manually reloaded by a separate control.
   if(String(state.activityRun?.activityId)===String(saved.run.activityId))return false;
   return resume();
 }
 function discard(silent=false){
   if(typeof state==="undefined"||!state[key])return false;
   state[key]=null;close(false);ui();
   if(!silent){render();if(typeof toast==="function")toast("Parked SI+ place discarded · Saved decks unchanged")}
   return true;
 }
 function start(){
   if(!isTeacher())return;
   const panel=document.getElementById("activityControllerPanel");
   let pending=false;
   if(panel)new MutationObserver(()=>{
     if(pending)return;pending=true;
     queueMicrotask(()=>{pending=false;ui()});
   }).observe(panel,{childList:true,subtree:true});
   // Sync restore, library transitions, and custom game-exit paths may not
   // rebuild the controller. This light status check covers those cases.
   setInterval(ui,1250);
   document.addEventListener("keydown",e=>{
     if(e.key==="Escape"&&dialog&&!dialog.hidden){e.preventDefault();close()}
   },true);
   ui();
 }
 window.SIPlusActivityBreak={open,begin,resume,resumeAfterFinish,discard,pollThisSlide,
   get parked(){return !!parked()},get data(){return parked()}};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();

/* Phase 4P-D: organize SI+ slides in the teacher's existing thumbnail
   workspace. These controls reuse the native draft and image import paths.
   The saved presentation library is changed only by Save Presentation. */
(()=>{
 "use strict";
 if(window.SIPlusOrganizerParity)return;
 const isTeacher=()=>typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE==="teacher";
 function mount(){
   if(!isTeacher()||typeof state==="undefined"||!state.presentationEditor||typeof siPlusOrganizerMove!=='function')return;
   const root=document.querySelector("#presentationBuilderPanel .si-org");
   if(!root)return;
   const bar=root.querySelector(".si-org-bulk");
   if(bar&&!bar.querySelector("#siOrgBatchImages")){
     const label=document.createElement("label");
     label.className="si-org-import";
     label.textContent="＋ Add Images";
     const input=document.createElement("input");
     input.type="file";input.multiple=true;input.id="siOrgBatchImages";
     input.accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp";
     input.disabled=!!siPlusBatchImportBusy;
     label.appendChild(input);bar.appendChild(label);
     const at=document.createElement("label");
     at.className="si-org-import-position";at.textContent="Insert images";
     const picker=document.createElement("select");
     picker.id="siOrgInsertPosition";
     picker.setAttribute("aria-label","Choose where new image slides go");
     picker.appendChild(new Option("At end","end"));
     state.presentationEditor.draft.slides.forEach((slide,i)=>{
       const name=String(slide.listTitle||slide.title||"Slide").slice(0,50);
       picker.appendChild(new Option("Before "+(i+1)+" · "+name,String(i)));
     });
     at.appendChild(picker);bar.appendChild(at);
     const status=document.createElement("p");
     status.className="si-org-import-status";status.id="siOrgBatchStatus";
     status.setAttribute("role","status");status.setAttribute("aria-live","polite");
     root.querySelector(".si-org-header").appendChild(status);
   }
   // Organize selected slides as one ordered group; no persistent writes.
   if(bar&&typeof siPlusOrganizerSelection!=="undefined"){
     let group=bar.querySelector("#siOrgGroupMoves");
     if(!group){
       group=document.createElement("span");group.id="siOrgGroupMoves";
       group.className="si-org-group-moves";
       group.innerHTML='<button type="button" data-org-group="start">⇤ To Start</button>'+
         '<button type="button" data-org-group="end">To End ⇥</button>';
       bar.appendChild(group);
     }
     group.querySelectorAll("button").forEach(button=>{
       button.disabled=siPlusOrganizerSelection.size===0||!!siPlusBatchImportBusy;
       button.title="Move selected slides together without changing their order";
     });
   }
   const status=root.querySelector("#siOrgBatchStatus");
   if(status){
     const source=document.querySelector("#siPlusBatchStatus");
     const msg=source?.textContent||siPlusBatchImportStatus||
       "Choose an insertion position, then add images. Save Presentation when ready.";
     if(status.textContent!==msg)status.textContent=msg;
   }
   root.querySelectorAll(".si-org-card").forEach(card=>{
     const index=Number(card.dataset.orgDrag),actions=card.querySelector(".si-org-card-actions");
     const handle=card.querySelector(".si-org-card-top>b");
     if(handle){handle.classList.add("si-org-drag-handle");handle.title="Drag this slide to reorder";}
     if(!actions||actions.querySelector("[data-org-preview]"))return;
     const preview=document.createElement("button");
     preview.type="button";preview.className="si-org-preview-btn";
     preview.dataset.orgPreview=String(index);preview.textContent="◉ Preview";
     preview.setAttribute("aria-label","Preview slide "+(index+1)+" privately");
     actions.appendChild(preview);
     const label=document.createElement("label");
     label.className="si-org-position";label.textContent="Move to";
     const select=document.createElement("select");
     select.dataset.orgPosition=String(index);
     select.setAttribute("aria-label","Move slide "+(index+1)+" to position");
     state.presentationEditor.draft.slides.forEach((slide,i)=>{
       const option=document.createElement("option");
       option.value=String(i);option.textContent=String(i+1);
       option.selected=i===index;select.appendChild(option);
     });
     label.appendChild(select);actions.appendChild(label);
   });
 }
 function onChange(event){
   if(event.target?.id==="siOrgBatchImages"){
     const imgs=Array.from(event.target.files||[]);
     event.target.value="";
     if(imgs.length)void siPlusImportImageSlides(imgs,{
       insertAt:document.querySelector("#siOrgInsertPosition")?.value||"end"
     });
   }else if(event.target?.matches("[data-org-position]")){
     // Let the native select finish dispatching change before rebuilding its
     // card. Otherwise Chrome can re-enter with a shifted selected option.
     const from=Number(event.target.dataset.orgPosition),to=Number(event.target.value);
     queueMicrotask(()=>siPlusOrganizerMove(from,to));
   }
 }
 function moveGroup(place){
   if(!isTeacher()||siPlusBatchImportBusy||typeof siPlusOrganizerSelection==="undefined")return;
   const slides=state.presentationEditor?.draft?.slides;
   if(!Array.isArray(slides))return;
   const selected=new Set([...siPlusOrganizerSelection].filter(i=>Number.isInteger(i)&&i>=0&&i<slides.length));
   if(!selected.size||selected.size===slides.length)return;
   const current=slides[state.editorSlide],
      chosen=slides.filter((v,i)=>selected.has(i)),
      others=slides.filter((v,i)=>!selected.has(i));
   slides.splice(0,slides.length,...(place==="start"?chosen.concat(others):others.concat(chosen)));
   state.editorSlide=Math.max(0,slides.indexOf(current));
   siPlusOrganizerSelection.clear();
   renderPresentationBuilder();
   if(typeof toast==="function")toast(chosen.length+" slides moved in draft");
 }
 function onClick(event){
   if(!isTeacher())return;
   const group=event.target.closest?.("[data-org-group]");
   if(group){moveGroup(group.dataset.orgGroup);return}
   const button=event.target.closest?.("[data-org-preview]");
   if(button)window.SIPlusPresentationPreview?.openAt?.(Number(button.dataset.orgPreview));
 }
 function start(){
   document.addEventListener("change",onChange,true);
   document.addEventListener("click",onClick,true);
   // The presentation editor is a sibling of the Activity Library, not its child.
   const root=document.querySelector("#presentationBuilderPanel");
   if(root){
     let busy=false;
     new MutationObserver(()=>{
       if(busy)return;busy=true;
       queueMicrotask(()=>{busy=false;mount()});
     }).observe(root,{subtree:true,childList:true});
   }
   mount();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
 window.SIPlusOrganizerParity={mount};
})();

/* Phase 4R: controls for the active SI+ video on teacher mirror/projector.
   Video commands are temporary per-run state, not saved deck data. */
(()=>{
 "use strict";
 if(window.SIPlusVideoControls)return;
 const role=typeof SESSION_ROLE==="undefined"?"":SESSION_ROLE;
 const teacher=role==="teacher",seen=new WeakMap();
 function active(){
   if(typeof state==="undefined"||typeof activeActivity!=="function")return null;
   const run=state.activityRun,deck=activeActivity();
   if(!run||run.phase!=="running"||deck?.type!=="presentation")return null;
   const index=Number(run.slideIndex)||0,slide=deck.slides?.[index];
   const id=slide&&typeof ytId==="function"?ytId(slide.youtube):null;
   return id&&/^[a-zA-Z0-9_-]{11}$/.test(id)?
     {run,index,id,token:String(run.runToken||"")}:null;
 }
 function deliver(){
   const info=active(),cmd=info?.run.siPlusVideoControl;
   if(!info||!cmd||cmd.token!==info.token||cmd.index!==info.index||cmd.videoId!==info.id)return;
   const host=role==="shared"?"#sharedContent":teacher?"#mirrorContent":null;
   if(!host)return;
   const key=cmd.token+"|"+cmd.index+"|"+cmd.nonce;
   document.querySelectorAll(host+" .si-plus-video-frame iframe").forEach(frame=>{
     let url;
     try{url=new URL(frame.src)}catch(e){return}
     if(url.hostname!=="www.youtube-nocookie.com"||url.pathname!=="/embed/"+info.id||
         url.searchParams.get("enablejsapi")!=="1")return;
     if(!frame.dataset.siPlusVideoControlsWired){
       frame.dataset.siPlusVideoControlsWired="1";
       frame.addEventListener("load",()=>{seen.delete(frame);setTimeout(deliver,180)});
     }
     if(seen.get(frame)===key)return;
     function command(func,args=[]){
       frame.contentWindow?.postMessage(JSON.stringify({event:"command",func,args}),
         "https://www.youtube-nocookie.com");
     }
     try{
       if(cmd.action==="play")command("playVideo");
       if(cmd.action==="pause")command("pauseVideo");
       if(cmd.action==="restart"){command("seekTo",[0,true]);command("playVideo")}
       frame.__siPlusVideoLastCommand=cmd.action;
       seen.set(frame,key);
     }catch(e){console.warn("SI+ YouTube controls unavailable in this browser",e)}
   });
 }
 function send(action){
   if(!teacher||!["play","pause","restart"].includes(action))return false;
   const info=active();
   if(!info)return false;
   info.run.siPlusVideoControl={
     token:info.token,index:info.index,videoId:info.id,action,
     nonce:Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7)
   };
   if(typeof publishSyncedState==="function")publishSyncedState();
   deliver();sync();
   return true;
 }
 function sync(){
   if(!teacher)return;
   const row=document.querySelector("#activityControllerPanel .presentation-controls"),info=active();
   let box=document.getElementById("siPlusVideoControls");
   if(!row||!info){box?.remove();return}
   if(!box||box.parentElement!==row){
     box?.remove();box=document.createElement("div");
     box.id="siPlusVideoControls";box.className="si-plus-video-controls";
     box.innerHTML='<div class="si-plus-video-controls-label"><strong>▶ YOUTUBE · CLASSROOM VIDEO</strong>'+
       '<small>Play, pause, or restart this slide video on the shared screen. Browser video restrictions still apply.</small></div>'+
       '<div class="si-plus-video-controls-buttons">'+
       '<button type="button" data-si-video="play">▶ Play</button>'+
       '<button type="button" data-si-video="pause">Ⅱ Pause</button>'+
       '<button type="button" data-si-video="restart">↺ Restart</button></div>';
     box.addEventListener("click",e=>{
       const button=e.target.closest("[data-si-video]");
       if(button)send(button.dataset.siVideo);
     });
     row.appendChild(box);
   }
   const cmd=info.run.siPlusVideoControl;
   box.querySelectorAll("[data-si-video]").forEach(button=>
     button.setAttribute("aria-pressed",String(!!cmd&&cmd.token===info.token&&
       cmd.index===info.index&&cmd.videoId===info.id&&cmd.action===button.dataset.siVideo)));
 }
 function start(){
   if(!teacher&&role!=="shared")return;
   const panel=document.getElementById("activityControllerPanel");
   if(teacher&&panel){
     let queued=false;
     new MutationObserver(()=>{
       if(queued)return;queued=true;
       queueMicrotask(()=>{queued=false;sync();deliver()});
     }).observe(panel,{subtree:true,childList:true});
   }
   // Existing live iframe is never rebuilt for a remote command.
   setInterval(()=>{if(teacher)sync();deliver()},550);
   if(teacher)sync();
   deliver();
 }
 window.SIPlusVideoControls={send,refresh:sync,deliver,get available(){return !!active()}};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();


/* SI+ Spotlight Slide — additive integration, preserves legacy Spotlight.
 * Stored on each SI+ slide as siSpotlight={zones}. Native slide remains an
 * instruction slide for backward compatibility and unchanged image rendering.
 */
(()=>{"use strict";
 if(window.SIPlusSpotlightSlide)return;
 const NS="http://www.w3.org/2000/svg";
 const colors={black:"#ffffff",red:"#ef4444",green:"#22c55e",blue:"#3b82f6",yellow:"#facc15"};
 const teacher=()=>typeof SESSION_ROLE!=="undefined"&&SESSION_ROLE==="teacher";
 const editor=()=>teacher()&&typeof state!=="undefined"?state.presentationEditor:null;
 const activeSlide=()=>{const e=editor();return e?.draft?.slides?.[Math.max(0,Number(state.editorSlide)||0)]||null};
 const live=()=>{
  if(typeof state==="undefined"||typeof activeActivity!=="function")return null;
  const run=state.activityRun,deck=activeActivity();
  if(!run||run.phase!=="running"||deck?.type!=="presentation")return null;
  const index=Number(run.slideIndex)||0,slide=deck.slides?.[index];
  return slide?.siSpotlight?.enabled?{run,deck,slide,index}:null;
 };
 const uid=()=> "spot_"+Math.random().toString(36).slice(2,11);
 const data=slide=>slide?.siSpotlight?.enabled?slide.siSpotlight:null;
 const validImage=s=>typeof s==="string"&&/^(data:image\/|https?:\/\/|\/)/i.test(s);
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const clamp=(x,min,max)=>Math.min(max,Math.max(min,Number(x)||0));
 const highlight=(zones,visible)=>{
  const selected=zones.filter(z=>visible.includes(z.id));
  const dims=selected.filter(z=>z.effect==="dim");
  let html='<defs><filter id="siSpotGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>';
  if(dims.length)html+='<mask id="siSpotMask"><rect width="1000" height="562.5" fill="white"/>'+dims.map(z=>shape(z,{fill:"black"})).join("")+'</mask>';
  html+='</defs>';
  if(dims.length)html+='<rect width="1000" height="562.5" fill="#020a14" opacity=".65" mask="url(#siSpotMask)"/>';
  for(const z of selected){
   const c=colors[z.color]||colors.red;
   html+=shape(z,{fill:"none",stroke:c,"stroke-width":18,opacity:.8,filter:"url(#siSpotGlow)"});
   html+=shape(z,{fill:"none",stroke:c,"stroke-width":5,opacity:1});
  }
  return html;
 };
 function shape(z,attrs){
  const rect=z.shape==="rect";
  const el=rect?"rect":"ellipse";
  const v=rect?{x:z.x,y:z.y,width:z.w,height:z.h,rx:9}:{cx:z.x+z.w/2,cy:z.y+z.h/2,rx:z.w/2,ry:z.h/2};
  return "<"+el+" "+Object.entries({...v,...attrs}).map(([k,val])=>k+'="'+escape(val)+'"').join(" ")+"/>";
 }
 // Embed highlight markup in SI+'s actual slide output. This works in the
 // teacher mirror, the shared browser window and exported presentation HTML.
 // A body-level overlay alone cannot cross into the separate Zoom projector.
 function inlineSpotlightMarkup(markup){
  if(typeof markup!=="string"||!markup.includes("si-plus-viewport-image"))return markup;
  const info=live();if(!info)return markup;
  const imageMatch=markup.match(/<div class="si-plus-viewport-image"([^>]*)>([\s\S]*?)<\/div>/);
  if(!imageMatch)return markup;
  const zoneMarkup=highlight(info.slide.siSpotlight.zones||[],liveVisibility(info));
  const inner=imageMatch[2];
  const decorate='<svg class="si-plus-spotlight-inline" viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible">'+zoneMarkup+'</svg>';
  let attributes=imageMatch[1];
  if(/\bstyle="/.test(attributes))attributes=attributes.replace(/style="/,'style="position:relative;');
  else attributes+=' style="position:relative"';
  const replacement='<div class="si-plus-viewport-image"'+attributes+'>'+inner+decorate+'</div>';
  return markup.replace(imageMatch[0],replacement);
 }
 function installSharedMarkup(){
  if(typeof sharedMarkup!=="function"||sharedMarkup.__siSpotlightWrapped)return;
  const original=sharedMarkup;
  const wrapper=function(...args){return inlineSpotlightMarkup(original.apply(this,args))};
  wrapper.__siSpotlightWrapped=true;
  try{sharedMarkup=wrapper}
  catch(e){console.warn("Could not attach Spotlight to SI+ slide output",e)}
 }
 function fitOverlay(svg,img){
  const rect=img.getBoundingClientRect();
  const screen=img.ownerDocument.defaultView;
  if(!rect.width||!rect.height||!svg.isConnected){svg.style.display="none";return}
  svg.style.display="block";
  const nw=img.naturalWidth||16,nh=img.naturalHeight||9;
  let dw=rect.width,dh=rect.height;
  const fit=screen.getComputedStyle(img).objectFit;
  if(fit==="contain"||fit==="scale-down"){
   const scale=Math.min(rect.width/nw,rect.height/nh);
   dw=nw*scale;dh=nh*scale;
  }
  svg.style.left=(rect.left+(rect.width-dw)/2)+"px";
  svg.style.top=(rect.top+(rect.height-dh)/2)+"px";
  svg.style.width=dw+"px";svg.style.height=dh+"px";
 }
 const overlays=new Map();
 function clearOverlays(){
  for(const [key,rec] of overlays){rec.svg.remove();overlays.delete(key)}
 }
 function liveVisibility(info){
  const values=info.run.siSpotlightVisible;
  if(values&&values.slideId===info.slide.id&&Array.isArray(values.ids))return values.ids;
  return [];
 }
 function overlaySync(){
  const info=live();
  if(!info){clearOverlays();return}
  const ids=liveVisibility(info),zones=info.slide.siSpotlight.zones||[];
  const targets=[
   ["shared","#sharedContent .si-plus-viewport-image > img"],
   ["teacher","#mirrorContent .si-plus-viewport-image > img"],
   ["preview","#presentationPreviewOverlay .si-plus-viewport-image > img"]
  ];
  for(const [key,selector] of targets){
   const img=document.querySelector(selector),rec=overlays.get(key);
   if(img?.querySelector?.(".si-plus-spotlight-inline")||img?.parentElement?.querySelector?.(".si-plus-spotlight-inline")){
    if(rec){rec.svg.remove();overlays.delete(key)}
    continue;
   }
   if(!img||!img.isConnected){
    if(rec){rec.svg.remove();overlays.delete(key)}
    continue;
   }
   let current=rec;
   if(!rec||rec.img!==img){
    rec?.svg.remove();
    const svg=document.createElementNS(NS,"svg");
    svg.classList.add("si-plus-spotlight-overlay");
    svg.setAttribute("viewBox","0 0 1000 562.5");
    svg.setAttribute("preserveAspectRatio","none");
    document.body.append(svg);current={svg,img};overlays.set(key,current);
   }
   const markup=highlight(zones,ids);
   if(current.markup!==markup){current.svg.innerHTML=markup;current.markup=markup}
   fitOverlay(current.svg,img);
  }
 }
 function publish(){
  if(typeof publishSyncedState==="function")publishSyncedState();
  if(typeof render==="function")render();
 }
 function setVisibility(ids){
  const info=live();if(!info||!teacher())return;
  info.run.siSpotlightVisible={slideId:info.slide.id,ids};
  publish();
  controlSync();overlaySync();
 }
 function controlSync(){
  if(!teacher())return;
  const row=document.querySelector("#activityControllerPanel .presentation-controls");
  let panel=document.getElementById("siPlusSpotlightLiveControls");
  const info=live();
  if(!row||!info){panel?.remove();return}
  if(!panel||panel.parentElement!==row){
   panel?.remove();panel=document.createElement("section");
   panel.id="siPlusSpotlightLiveControls";panel.className="si-plus-spotlight-live";
   row.append(panel);
  }
  const visible=liveVisibility(info),zones=info.slide.siSpotlight.zones||[];
  const key=info.slide.id+"|"+JSON.stringify(visible)+"|"+JSON.stringify(zones);
  if(panel.dataset.key===key)return;
  panel.dataset.key=key;
  const heading=document.createElement("strong");heading.textContent="◎ SPOTLIGHT SLIDE";
  const buttonRow=document.createElement("div");buttonRow.className="si-plus-spotlight-actions";
  for(const [label,choice] of [["Reveal all","all"],["Hide all","none"]]){
   const btn=document.createElement("button");btn.type="button";btn.textContent=label;
   btn.onclick=()=>setVisibility(choice==="all"?zones.map(z=>z.id):[]);
   buttonRow.append(btn)
  }
  for(const z of zones){
   const btn=document.createElement("button");btn.type="button";
   const on=visible.includes(z.id);
   btn.textContent=(on?"✓ ":"◎ ")+(z.name||"Region");
   btn.style.setProperty("--zone-color",colors[z.color]||colors.red);
   btn.classList.add("si-plus-spotlight-target");btn.setAttribute("aria-pressed",String(on));
   btn.onclick=()=>setVisibility(on?visible.filter(x=>x!==z.id):[...visible,z.id]);
   buttonRow.append(btn);
  }
  panel.replaceChildren(heading,buttonRow);
 }
 // Interactive editor drawing is scoped to the current SI+ slide. It only
 // mutates that draft slide and does not overwrite the rest of the lesson.
 let dialog=null,mode="rect",selection="",drawing=null,zones=[];
 function fitEditorImage(){
  if(!dialog||dialog.hidden)return;
  const image=dialog.querySelector(".si-plus-spot-image");
  const svg=dialog.querySelector(".si-plus-spot-drawing");
  const stage=dialog.querySelector(".si-plus-spot-stage");
  if(!image||!svg||!stage)return;
  const sw=stage.clientWidth,sh=stage.clientHeight;
  const iw=image.naturalWidth,ih=image.naturalHeight;
  if(!sw||!sh||!iw||!ih)return;
  const scale=Math.min(sw/iw,sh/ih);
  const dw=iw*scale,dh=ih*scale;
  svg.style.left=(sw-dw)/2+"px";
  svg.style.top=(sh-dh)/2+"px";
  svg.style.width=dw+"px";
  svg.style.height=dh+"px";
 }
 function openEditor(){
  const slide=activeSlide();
  if(!slide){return}
  if(!validImage(slide.image)){if(typeof toast==="function")toast("Add an image to this SI+ slide before using Spotlight.");return}
  zones=JSON.parse(JSON.stringify(data(slide)?.zones||[]));selection="";mode="rect";
  if(!dialog)buildDialog();
  dialog.hidden=false;
  const image=dialog.querySelector(".si-plus-spot-image");image.src=slide.image;
  image.addEventListener("load",fitEditorImage,{once:true});
  requestAnimationFrame(fitEditorImage);
  updateEditor();dialog.querySelector(".si-plus-spot-close").focus();
 }
 function buildDialog(){
  dialog=document.createElement("div");dialog.id="siPlusSpotlightEditor";dialog.className="si-plus-spot-editor";dialog.hidden=true;
  dialog.innerHTML='<div class="si-plus-spot-dialog" role="dialog" aria-modal="true" aria-label="SI+ Spotlight slide editor">'+
   '<header><strong>◎ SPOTLIGHT SLIDE STUDIO</strong><button class="si-plus-spot-close" type="button">✕ Close</button></header>'+
   '<p>Draw circles or rectangles over the slide. Save to include these highlights in the SI+ presentation.</p>'+
   '<div class="si-plus-spot-layout"><div class="si-plus-spot-stage"><img class="si-plus-spot-image" alt="Spotlight slide image"><svg class="si-plus-spot-drawing" viewBox="0 0 1000 562.5" preserveAspectRatio="none"></svg></div>'+
   '<aside><div class="si-plus-spot-buttons"><button type="button" data-mode="rect">▱ Rectangle</button><button type="button" data-mode="circle">◯ Circle</button></div>'+
   '<label>Highlight name<input id="siPlusSpotName" maxlength="50" placeholder="What to highlight"></label>'+
   '<label>Effect<select id="siPlusSpotEffect"><option value="outline">Outline Glow</option><option value="dim">Dim Background</option></select></label>'+
   '<label>Color<select id="siPlusSpotColor"><option value="red">Red</option><option value="green">Green</option><option value="blue">Blue</option><option value="yellow">Yellow</option><option value="black">White</option></select></label>'+
   '<div class="si-plus-spot-list"></div><button type="button" class="si-plus-spot-delete">Delete Selected</button>'+
   '<button type="button" class="si-plus-spot-save">✓ Save Spotlight Slide</button><button type="button" class="si-plus-spot-remove">Remove Spotlight Mode</button></aside></div></div>';
  document.body.append(dialog);
  const svg=dialog.querySelector("svg");
  dialog.querySelector(".si-plus-spot-image").addEventListener("load",fitEditorImage);
  if(typeof ResizeObserver==="function")new ResizeObserver(fitEditorImage).observe(dialog.querySelector(".si-plus-spot-stage"));
  svg.addEventListener("pointerdown",e=>{
   if(e.target.dataset.zone){selection=e.target.dataset.zone;updateEditor();return}
   const bounds=svg.getBoundingClientRect();
   const x=clamp((e.clientX-bounds.left)/bounds.width*1000,0,1000);
   const y=clamp((e.clientY-bounds.top)/bounds.height*562.5,0,562.5);
   drawing={x,y,id:e.pointerId};svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointerup",e=>{
   if(!drawing)return;
   const box=svg.getBoundingClientRect();
   const endX=clamp((e.clientX-box.left)/box.width*1000,0,1000);
   const endY=clamp((e.clientY-box.top)/box.height*562.5,0,562.5);
   const x=Math.min(endX,drawing.x),y=Math.min(endY,drawing.y),w=Math.abs(endX-drawing.x),h=Math.abs(endY-drawing.y);
   drawing=null;
   if(w<10||h<10)return;
   const z={id:uid(),name:"Highlight "+(zones.length+1),shape:mode,x,y,w,h,color:"red",effect:"outline"};
   zones.push(z);selection=z.id;updateEditor()
  });
  svg.addEventListener("pointercancel",()=>{drawing=null});
  dialog.querySelector(".si-plus-spot-close").onclick=()=>{dialog.hidden=true};
  dialog.addEventListener("keydown",e=>{if(e.key==="Escape"){dialog.hidden=true;e.preventDefault()}});
  dialog.querySelectorAll("[data-mode]").forEach(btn=>btn.onclick=()=>{mode=btn.dataset.mode;updateEditor()});
  for(const [id,key] of [["siPlusSpotName","name"],["siPlusSpotEffect","effect"],["siPlusSpotColor","color"]]){
   dialog.querySelector("#"+id).addEventListener("change",e=>{
    const z=zones.find(z=>z.id===selection);if(z){z[key]=e.target.value;updateEditor()}
   })
  }
  dialog.querySelector(".si-plus-spot-delete").onclick=()=>{
   zones=zones.filter(z=>z.id!==selection);selection="";updateEditor()
  };
  dialog.querySelector(".si-plus-spot-save").onclick=()=>{
   const slide=activeSlide();if(!slide)return;
   slide.siSpotlight={enabled:true,zones:JSON.parse(JSON.stringify(zones))};
   slide.type="instruction";
   dialog.hidden=true;
   if(typeof render==="function")render();
   if(typeof toast==="function")toast("Spotlight slide saved in draft. Save Presentation to keep it.");
  };
  dialog.querySelector(".si-plus-spot-remove").onclick=()=>{
   const slide=activeSlide();if(!slide)return;
   if(!window.confirm("Remove Spotlight highlights from this slide?"))return;
   delete slide.siSpotlight;dialog.hidden=true;
   if(typeof render==="function")render();
  };
 }
 function updateEditor(){
  if(!dialog)return;
  dialog.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  const svg=dialog.querySelector("svg");
  svg.innerHTML=zones.map(z=>{
   const c=colors[z.color]||colors.red;
   const markup=shape(z,{fill:c,"fill-opacity":.1,stroke:c,"stroke-width":z.id===selection?8:5});
   return '<g data-zone="'+escape(z.id)+'">'+markup+'</g>';
  }).join("");
  // Set hit target on child shapes as well as its group.
  svg.querySelectorAll("g").forEach(g=>{g.querySelector("*").dataset.zone=g.dataset.zone});
  const list=dialog.querySelector(".si-plus-spot-list");list.replaceChildren();
  for(const z of zones){
   const b=document.createElement("button");b.type="button";b.textContent=z.name;
   b.classList.toggle("active",z.id===selection);b.onclick=()=>{selection=z.id;updateEditor()};
   list.append(b)
  }
  const chosen=zones.find(z=>z.id===selection);
  for(const [id,key] of [["siPlusSpotName","name"],["siPlusSpotEffect","effect"],["siPlusSpotColor","color"]]){
   const input=dialog.querySelector("#"+id);
   input.disabled=!chosen;input.value=chosen?chosen[key]:"";
  }
  dialog.querySelector(".si-plus-spot-delete").disabled=!chosen;
 }
 function slideTypeSync(){
  if(!teacher())return;
  const select=document.getElementById("siPlusSlideType"),slide=activeSlide();
  if(!select||!slide)return;
  if(!select.querySelector('option[value="spotlight"]')){
   const option=document.createElement("option");
   option.value="spotlight";option.textContent="◎ Spotlight";select.append(option);
  }
  if(!select.dataset.spotlightBound){
   select.dataset.spotlightBound="true";
   select.addEventListener("change",event=>{
    const current=activeSlide();if(!current)return;
    if(select.value==="spotlight"){
     event.stopImmediatePropagation();
     current.type="instruction";
     current.siSpotlight=current.siSpotlight?.enabled?current.siSpotlight:{enabled:true,zones:[]};
     if(typeof renderPresentationBuilder==="function")renderPresentationBuilder();
     else if(typeof render==="function")render();
     slideTypeSync();
     if(validImage(current.image))openEditor();
     else if(typeof toast==="function")toast("Upload an image, then select Edit Spotlight to add highlights.");
    }else if(current.siSpotlight?.enabled)delete current.siSpotlight;
   },true);
  }
  const desired=data(slide)?"spotlight":slide.type;
  if([...select.options].some(option=>option.value===desired)&&select.value!==desired)select.value=desired;
 }
 function editorSync(){
  if(!teacher())return;
  const root=document.querySelector("#presentationBuilderPanel"),slide=activeSlide();
  let button=document.getElementById("siPlusSpotlightEditButton");
  if(!root||!slide){
   button?.remove();return
  }
  if(!button||!root.contains(button)){
   button?.remove();button=document.createElement("button");button.type="button";
   button.id="siPlusSpotlightEditButton";button.className="si-plus-spotlight-edit-button";
   button.onclick=openEditor;
   const row=root.querySelector("#siPlusSlideType")?.parentElement;
   (row||root.querySelector("#slideTitle")?.parentElement||root).append(button);
  }
  const enabled=!!data(slide);
  button.style.display=enabled?"inline-flex":"none";
  button.textContent=enabled?"◎ Edit Spotlight Slide":"◎ Make Spotlight Slide";
  button.title=enabled?"Edit the spotlight highlights on this slide":"Use this slide image as an interactive Spotlight slide";
 }

/* A one-click single-image workflow for teachers who want Spotlight without
 * building a lesson. It still uses SI+'s normal draft/save system. */
function quickSpotlightLaunch(){
 if(!teacher()||editor()||typeof openNewPresentation!=="function")return;
 // Open the file picker before rebuilding SI+. Replacing the view during the
 // click can lose browser user activation and suppress the file chooser.
 const pick=document.createElement("input");
 pick.type="file";pick.accept="image/*";pick.style.display="none";
 document.body.append(pick);
 pick.addEventListener("change",()=>{
  const file=pick.files?.[0];pick.remove();
  if(!file)return;
  openNewPresentation();
  const draft=editor()?.draft;
  if(draft){draft.deckTitle="Quick Spotlight";draft.name="Quick Spotlight"}
  let attempt=0;
  const attach=setInterval(()=>{
   const upload=document.getElementById("siPlusBatchImages");
   if(!upload){if(++attempt>30){clearInterval(attach);return}return}
   clearInterval(attach);
   const transfer=new DataTransfer();transfer.items.add(file);
   const started=Date.now();
   upload.files=transfer.files;
   upload.dispatchEvent(new Event("change",{bubbles:true}));
   const wait=setInterval(()=>{
    const current=editor();
    if(!current||Date.now()-started>30000){clearInterval(wait);return}
    if(typeof siPlusBatchImportBusy!=="undefined"&&siPlusBatchImportBusy)return;
    const slides=current.draft?.slides||[];
    const i=slides.findIndex(s=>validImage(s.image));
    if(i<0)return;
    clearInterval(wait);
    state.editorSlide=i;
    if(typeof renderPresentationBuilder==="function")renderPresentationBuilder();
    openEditor();
   },180);
  },100);
 },{once:true});
 pick.click();
}
function quickSpotlightSync(){
 if(!teacher()||typeof state==="undefined")return;
 const visible=state.activeApp==="si-plus"&&!!state.presentationLibraryOpen
  &&!state.presentationEditor&&!state.activityRun&&state.screen==="activities";
 let button=document.getElementById("siPlusQuickSpotlight");
 if(!visible){button?.remove();return}
 if(!button){
  button=document.createElement("button");button.id="siPlusQuickSpotlight";
  button.type="button";button.className="si-plus-spotlight-quick-launch";
  button.textContent="◎ Quick Spotlight";
  button.title="Create a single Spotlight image slide in SI+";
  button.onclick=quickSpotlightLaunch;
  document.body.append(button);
 }
}
 function tick(){try{installSharedMarkup();quickSpotlightSync();slideTypeSync();editorSync();controlSync();overlaySync()}catch(e){console.warn("SI+ Spotlight integration",e)}}
 window.SIPlusSpotlightSlide={open:openEditor,refresh:tick,renderOverlay:highlight};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{setInterval(tick,350)},{once:true});
 else setInterval(tick,350);
})();