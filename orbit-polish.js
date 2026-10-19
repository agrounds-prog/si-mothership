/* ORBIT classroom presentation polish.
   Pure rendering enhancements; original session, responses, names, and
   Mission Control actions remain authoritative in index.html. */
(()=>{
 'use strict';
 if(window.SIOrbitPolish)return;
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>
   ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const naturalCount=n=>Number(n||0).toLocaleString('en-US');
 // The native orbit uses up to 16 absolutely positioned notes; beyond six,
 // cards collide with each other and the question. Keep every response in a
 // readable, scrollable galaxy instead of silently dropping later pupils.
 const original=typeof window.orbitIdeasMarkup==='function'?window.orbitIdeasMarkup:null;
 if(original){
  window.orbitIdeasMarkup=function(run,big){
   const submitted=run?.orbitResponses||{},entries=Object.entries(submitted);
   if(entries.length<=6)return original(run,big);
   const revealName=name=>{
    if(run?.orbitConfig?.anonymous&&!run?.orbitRevealCrew)return '';
    return String(name||'');
   };
   return '<div class="orbit-idea-gallery" role="list" aria-label="Crew responses">'+
    entries.map(([name,r],i)=>'<article class="orbit-gallery-card" role="listitem">'+
      '<span class="orbit-gallery-number" aria-hidden="true">'+String(i+1).padStart(2,'0')+'</span>'+
      '<div class="orbit-gallery-copy">'+(revealName(name)?
        '<strong class="orbit-gallery-author">'+safe(revealName(name))+'</strong>':'')+
        '<p>'+safe(r?.text||'')+'</p></div></article>').join('')+
    '</div>';
  };
 }
 function enhance(){
  if(document.body.classList.contains('role-shared')||document.body.classList.contains('role-student')){
   const r=typeof state!=='undefined'?state.activityRun:null;
   if(document.body.classList.contains('role-student')&&r?.activityId==='orbit-game'){
    const t=document.querySelector('#orbitStudentText');
    if(t){
     t.setAttribute('aria-label','Your idea for the ORBIT question');
     t.setAttribute('aria-describedby','orbitCharCount');
    }
   }
   return;
  }
  const setup=document.querySelector('#activityGrid .orbit-setup');
  if(setup){
   setup.dataset.orbitPolished='true';
   const ta=setup.querySelector('#orbitPrompt');
   const label=ta?.previousElementSibling;
   if(label&&label.tagName==='LABEL'&&!label.hasAttribute('for'))label.setAttribute('for','orbitPrompt');
   if(ta){
    let count=setup.querySelector('.orbit-prompt-count');
    if(!count){
     count=document.createElement('div');count.className='orbit-prompt-count';
     count.setAttribute('role','status');count.setAttribute('aria-live','polite');
     ta.after(count);
    }
    const msg=naturalCount(ta.value.length)+' / 500 characters · One open-ended classroom question';
    if(count.textContent!==msg)count.textContent=msg;
    if(ta.dataset.orbitCountWired!=='true'){
     ta.dataset.orbitCountWired='true';
     ta.addEventListener('input',()=>{const el=setup.querySelector('.orbit-prompt-count');
      if(el)el.textContent=naturalCount(ta.value.length)+' / 500 characters · One open-ended classroom question';});
    }
   }
  }
  const controller=document.querySelector('#activityControllerPanel .orbit-controller');
  const r=typeof state!=='undefined'?state.activityRun:null;
  if(controller&&r?.activityId==='orbit-game'){
   const tally=controller.querySelector('.orbit-completion');
   const crew=typeof connectedStudents==='function'?connectedStudents():[];
   const done=crew.filter(s=>r.orbitResponses?.[s.n]).length;
   let meter=controller.querySelector('.si-orbit-participation');
   if(!meter&&tally){
    meter=document.createElement('div');meter.className='si-orbit-participation';
    meter.innerHTML='<div class="si-orbit-participation-label"><strong></strong><span></span></div>'+
      '<div class="si-orbit-track" role="progressbar" aria-label="Crew transmissions" aria-valuemin="0"><i></i></div>';
    tally.after(meter);
   }
   if(meter){
    const total=crew.length,progress=total?Math.round(done/total*100):0;
    const header=meter.querySelector('strong'),status=meter.querySelector('span');
    const label=done+' of '+total+' crew responses';
    if(header.textContent!==label)header.textContent=label;
    const phase=r.orbitPaused?'TRANSMISSIONS PAUSED':done===total&&total?'EVERY VOICE RECEIVED':'COLLECTING IDEAS';
    if(status.textContent!==phase)status.textContent=phase;
    const track=meter.querySelector('.si-orbit-track');
    track.setAttribute('aria-valuemax',String(total));
    track.setAttribute('aria-valuenow',String(done));
    const fill=track.firstElementChild,width=progress+'%';
    if(fill.style.width!==width)fill.style.width=width;
    meter.dataset.phase=r.orbitPaused?'paused':done===total&&total?'complete':'live';
   }
  }
 }
 let pending=false;
 function queue(){
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;enhance()});
 }
 function boot(){
  if(!document.body)return;
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
  setInterval(queue,1100);queue();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
 window.SIOrbitPolish={enhance};
})();
