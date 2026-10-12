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
 let overlay=null,position=0,returnFocus=null;
 const permitted=()=>typeof state!=="undefined" && !!state.presentationEditor?.draft
   && !state.activityRun && typeof SESSION_ROLE!=="undefined" && SESSION_ROLE==="teacher";
 const slideCount=()=>state.presentationEditor?.draft.slides?.length||0;
 // Render using the same presentation markup as the actual projector. The
 // temporary activity exists for this one synchronous render ONLY.
 function projectorMarkup(index){
   const deck=state.presentationEditor.draft;
   const activitiesBefore=state.activities,runBefore=state.activityRun;
   const token=Symbol("private-si-plus-preview");
   try{
     state.activities=[...activitiesBefore,{...deck,id:token,type:"presentation"}];
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
   const deck=state.presentationEditor.draft;
   overlay.querySelector(".sipreview-title").textContent=deck.deckTitle||deck.name||"Untitled Presentation";
   overlay.querySelector(".sipreview-count").textContent="Slide "+(position+1)+" of "+slideCount();
   overlay.querySelector(".sipreview-slide-label").textContent=
     deck.slides[position].listTitle||deck.slides[position].title||"Slide "+(position+1);
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
   overlay.remove();overlay=null;returnFocus=null;
   document.body.classList.remove("sipreview-open");
   document.removeEventListener("keydown",onKeys,true);
   if(old?.isConnected)old.focus();
   else editor()?.querySelector("#siPlusPreviewBtn")?.focus();
 }
 function open(){
   if(!permitted()||!slideCount())return;
   if(overlay){update();return}
   returnFocus=document.activeElement;
   position=Math.min(Math.max(Number(state.editorSlide)||0,0),slideCount()-1);
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
   if(!permitted())return;
   const actions=editor()?.querySelector(".builder-top-actions");
   if(!actions||actions.querySelector("#siPlusPreviewBtn"))return;
   const button=document.createElement("button");
   button.type="button";button.id="siPlusPreviewBtn";
   button.textContent="▷ Preview";button.title="Review presentation without sending it to students";
   button.addEventListener("click",open);
   const organizer=actions.querySelector("#siOrgToggle");
   if(organizer)organizer.insertAdjacentElement("afterend",button);
   else actions.prepend(button);
 }
 function start(){
   const root=editor();
   if(!root)return;
   let pending=false;
   new MutationObserver(()=>{
     if(pending)return;
     pending=true;
     queueMicrotask(()=>{pending=false;mount()});
   }).observe(root,{childList:true,subtree:true});
   mount();
 }
 window.SIPlusPresentationPreview={open,close,get active(){return !!overlay;}};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();
