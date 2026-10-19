/* ORBIT classroom presentation polish.
   Pure rendering enhancements; original session, responses, names, and
   Mission Control actions remain authoritative in index.html. */
(()=>{
 'use strict';
 if(window.SIOrbitPolish)return;
 const safe=value=>String(value??'').replace(/[&<>"']/g,c=>
   ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const naturalCount=n=>Number(n||0).toLocaleString('en-US');
 // The classroom projector uses real response text and maintains the native
 // prompt, anonymous-name and turn state. No response is dropped at 16.
 const icons=['✦','♫','♥','✧','◎','★','✺','◆','❖','✿'];
 const tones=['violet','cyan','gold','pink','mint','blue','coral','indigo','teal','lime'];
 const originalIdeas=typeof window.orbitIdeasMarkup==='function'?window.orbitIdeasMarkup:null;
 const originalPublic=typeof window.orbitSharedMarkup==='function'?window.orbitSharedMarkup:null;
 const noName=(run)=>Boolean(run?.orbitConfig?.anonymous&&!run?.orbitRevealCrew);
 function ideaLabel(name,run){return noName(run)?'':String(name||'')}
 function gallery(entries,run){
  return '<div class="orbit-idea-gallery orbit-cosmic-gallery" role="list" aria-label="All crew ideas">'+
   entries.map(([name,r],i)=>'<article class="orbit-gallery-card orbit-tone-'+tones[i%tones.length]+'" role="listitem">'+
    '<span class="orbit-gallery-number" aria-hidden="true">'+icons[i%icons.length]+'</span>'+
    '<div class="orbit-gallery-copy">'+(ideaLabel(name,run)?
     '<strong class="orbit-gallery-author">'+safe(ideaLabel(name,run))+'</strong>':'')+
     '<p>'+safe(r?.text||'')+'</p></div></article>').join('')+'</div>';
 }
 function satellites(entries,run){
  const total=entries.length,rows=Math.ceil(total/2);
  return '<div class="orbit-satellites" role="list" aria-label="Ideas orbiting the question">'+
   entries.map(([name,r],i)=>{
    const side=i%2,slot=Math.floor(i/2),y=((slot+.5)/rows*100).toFixed(2);
    return '<article class="orbit-satellite orbit-tone-'+tones[i%tones.length]+'" role="listitem"'+
     ' style="--orb-x:'+(side?'75.5':'1.2')+'%;--orb-y:'+y+'%;">'+
     '<span class="orbit-sat-moon" aria-hidden="true"><span class="orbit-sat-icon">'+icons[i%icons.length]+'</span></span>'+
     '<div class="orbit-sat-content">'+(ideaLabel(name,run)?
       '<strong class="orbit-sat-author">'+safe(ideaLabel(name,run))+'</strong>':'')+
       '<span class="orbit-sat-text">'+safe(r?.text||'')+'</span></div></article>';
   }).join('')+'</div>';
 }
 if(originalIdeas){
  window.orbitIdeasMarkup=function(run,big){
   const entries=Object.entries(run?.orbitResponses||{});
   if(!entries.length)return originalIdeas(run,big);
   // The projector presents up to ten brief contributions as glowing planets.
   // Full-length text and larger classes use a scrollable, equally styled
   // gallery so no student's response is visually cut off or omitted.
   if(big&&entries.length<=10&&entries.every(([,r])=>String(r?.text||'').length<=(noName(run)?62:47)))
    return satellites(entries,run);
   return gallery(entries,run);
  };
 }
 if(originalPublic){
  window.orbitSharedMarkup=function(run,big){
   const html=originalPublic(run,big);
   if(typeof html!=='string'||!html.startsWith('<div class="orbit-public"'))return html;
   const cfg=run?.orbitConfig||{},responses=run?.orbitResponses||{};
   const active=typeof connectedStudents==='function'?connectedStudents():[];
   const count=active.filter(s=>responses[s.n]).length,total=active.length;
   const pct=total?Math.round(count/total*100):0;
   const phase=run?.orbitPaused?'paused':!count?'waiting':total&&count===total?'complete':'collecting';
   const phaseLabel={paused:'TRANSMISSIONS PAUSED',waiting:'AWAITING CREW IDEAS',complete:'ALL CREW RESPONDED',collecting:'LIVE · COLLECTING IDEAS'}[phase];
   const header='<header class="orbit-cosmic-header">'+
    '<div class="orbit-cosmic-brand"><span class="orbit-cosmic-wordmark"><span class="orbit-cosmic-logo" aria-hidden="true">◉</span>ORBIT</span>'+
    '<span class="orbit-cosmic-subtitle">ONE QUESTION · EVERY VOICE · SHARED THINKING</span></div>'+
    '<div class="orbit-cosmic-tally" aria-label="'+count+' of '+total+' crew responses transmitted">'+
    '<svg class="orbit-cosmic-crew" viewBox="0 0 56 36" aria-hidden="true" focusable="false">'+
    '<circle cx="28" cy="8" r="7"/><circle cx="10" cy="12" r="5"/><circle cx="46" cy="12" r="5"/>'+
    '<path d="M16 29c0-9 4-13 12-13s12 4 12 13v3H16zM1 29c0-7 3-10 9-10s7 2 7 4v9H1zM39 23c0-2 2-4 7-4 6 0 9 3 9 10v3H39z"/></svg>'+
    '<span class="orbit-cosmic-fraction"><b>'+count+' / '+total+'</b> TRANSMITTED</span>'+
    '<span class="orbit-cosmic-progress" aria-hidden="true"><i style="width:'+pct+'%"></i></span></div></header>';
   // Purely decorative deep-space layer. Never overlays actions and never
   // changes a classroom response, student identity, or session state.
   const atmosphere='<div class="orbit-cosmic-atmosphere" aria-hidden="true">'+
    '<svg class="orbit-constellations" viewBox="0 0 1200 680" preserveAspectRatio="xMidYMid slice" focusable="false">'+
    '<g class="orbit-constellation-cluster"><path d="M90 190L145 124L211 171L252 105L318 131"/>'+
    '<circle cx="90" cy="190" r="3"/><circle cx="145" cy="124" r="4"/><circle cx="211" cy="171" r="3"/>'+
    '<circle cx="252" cy="105" r="4"/><circle cx="318" cy="131" r="3"/></g>'+
    '<g class="orbit-constellation-cluster"><path d="M929 462L987 399L1056 425L1120 358"/>'+
    '<circle cx="929" cy="462" r="3"/><circle cx="987" cy="399" r="4"/>'+
    '<circle cx="1056" cy="425" r="3"/><circle cx="1120" cy="358" r="4"/></g></svg>'+
    '<i class="orbit-shooting-star"></i>'+
    '<i class="orbit-space-spark orbit-space-spark-a"></i>'+
    '<i class="orbit-space-spark orbit-space-spark-b"></i>'+
    '<i class="orbit-space-spark orbit-space-spark-c"></i></div>';
   let enhanced=html.replace('<div class="orbit-public"',
    '<div class="orbit-public orbit-cosmic" data-orbit-style="cosmic" data-orbit-phase="'+phase+'"').replace('data-orbit-phase="'+phase+'">',
    'data-orbit-phase="'+phase+'">'+atmosphere+header+'<span class="orbit-cosmic-state" role="status">'+phaseLabel+'</span>');
   // The first student response must not be required to make the classroom
   // projector look like ORBIT: the waiting question is also a cosmic planet.
   // Leave Spotlight / Clusters / Before vs After intact.
   if(!count&&!Object.keys(responses).length&&!run?.orbitSpotlight&&!run?.orbitClusterView&&!run?.orbitCompare){
    enhanced=enhanced.replace('<div class="orbit-space">',
     '<div class="orbit-space" data-orbit-waiting="true"><span class="orbit-wait-caption">◎ IDEAS WILL APPEAR AROUND THIS PLANET</span>');
   }
   return enhanced;
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
 // A reopened live ORBIT could have rendered before this deferred stylesheet
 // companion loaded. Repaint once to apply the new projector markup.
 if(typeof state!=='undefined'&&state.activityRun?.activityId==='orbit-game'&&typeof render==='function'){
  requestAnimationFrame(()=>render());
 }
 window.SIOrbitPolish={enhance};
})();
