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
 window.SIPlusPresentationPreview={open,openSaved,close,get active(){return !!overlay;}};
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
