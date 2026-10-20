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

 // A lightweight, per-page observation ledger ensures incoming student ideas
 // get an entrance only once. Existing responses are seeded without a replay
 // after refresh, switching roles, reopening, or returning from Spotlight.
 let observedRun=null,seenResponseKeys=new Set(),newArrivalUntil=new Map();
 const arrivalFor=(run,entries)=>{
  const identity=String(run?.runToken||run?.orbitRound||run?.orbitConfig?.prompt||'orbit');
  if(identity!==observedRun){
   observedRun=identity;
   seenResponseKeys=new Set();
   newArrivalUntil=new Map();
   entries.forEach(([name,r])=>seenResponseKeys.add(JSON.stringify([name,r?.at,r?.text])));
   return newArrivalUntil;
  }
  const now=performance.now();
  entries.forEach(([name,r])=>{
   const key=JSON.stringify([name,r?.at,r?.text]);
   if(!seenResponseKeys.has(key)){
    seenResponseKeys.add(key);
    newArrivalUntil.set(key,now+1500);
   }
  });
  newArrivalUntil.forEach((until,key)=>{if(until<=now)newArrivalUntil.delete(key)});
  return newArrivalUntil;
 };
 const arriveClass=(arrivals,name,response)=>{
  const key=JSON.stringify([name,response?.at,response?.text]);
  return arrivals.has(key)?' orbit-new-arrival':'';
 };
 let lastSpotlight='',focusUntil=0;
 const originalIdeas=typeof window.orbitIdeasMarkup==='function'?window.orbitIdeasMarkup:null;
 const originalPublic=typeof window.orbitSharedMarkup==='function'?window.orbitSharedMarkup:null;

 // Phase 4C: translate the native teacher-defined categories into living
 // solar systems. All assignments, responses and identities remain native;
 // never mutate the teacher's cluster or submission records.
 function orbitSolarMarkup(run){
  const clusters=Array.isArray(run?.orbitClusters)?run.orbitClusters:[];
  const names=[...new Set(clusters.filter(x=>typeof x==='string'&&x.trim()))];
  const groups=new Map(names.map(x=>[x,[]]));
  const unclustered=[];
  const assignments=run?.orbitAssignments||{};
  Object.entries(run?.orbitResponses||{}).forEach(([name,response])=>{
   const assigned=assignments[name];
   const destination=groups.has(assigned)?groups.get(assigned):unclustered;
   destination.push({name,response});
  });
  if(unclustered.length){
   if(groups.has('Unclustered'))groups.get('Unclustered').push(...unclustered);
   else groups.set('Unclustered',unclustered);
  }
  const populated=[...groups].filter(([,ideas])=>ideas.length);
  // Seed an empty cluster round too: its very first incoming crew idea should
  // animate once, not be mistaken for a restored historical response.
  const arrivals=arrivalFor(run,Object.entries(run?.orbitResponses||{}));
  if(!populated.length)return '<div class="orbit-solar-empty" role="status">'+
   '<span aria-hidden="true">✧</span><strong>Awaiting ideas for the solar systems</strong>'+
   '<p>Student responses will appear in the teacher’s groups.</p></div>';
  const total=populated.reduce((sum,[,ideas])=>sum+ideas.length,0);
  const summary='<div class="orbit-solar-summary" aria-label="'+populated.length+
   ' solar systems and '+total+' ideas"><span aria-hidden="true">✦</span> '+
   populated.length+' SOLAR SYSTEM'+(populated.length===1?'':'S')+
   ' · '+total+' IDEA'+(total===1?'':'S')+'</div>';
  const systems=populated.map(([cluster,ideas],index)=>{
   const tone=tones[index%tones.length];
   const sorted=ideas; // submission order, never alphabetized or truncated
   return '<section class="orbit-solar-system orbit-tone-'+tone+
    '" role="listitem" aria-label="'+safe(cluster)+': '+ideas.length+' ideas">'+
    '<div class="orbit-solar-system-head"><div class="orbit-solar-sun">'+
     '<span class="orbit-solar-sun-symbol" aria-hidden="true"><span class="orbit-solar-sun-glyph">'+icons[index%icons.length]+'</span></span>'+
     '<div class="orbit-solar-sun-copy"><span class="orbit-solar-system-id">SYSTEM '+String(index+1).padStart(2,'0')+'</span>'+
     '<h4>'+safe(cluster)+'</h4>'+
     '<span>'+ideas.length+' PLANET'+(ideas.length===1?'':'S')+' IN ORBIT</span></div></div>'+
     '<div class="orbit-solar-track" aria-hidden="true">'+
      '<i class="orbit-solar-path orbit-solar-path-a"><b></b></i>'+
      '<i class="orbit-solar-path orbit-solar-path-b"><b></b></i>'+
      '<i class="orbit-solar-path orbit-solar-path-c"><b></b></i>'+
      '<em class="orbit-solar-center-star"></em></div></div>'+
    '<div class="orbit-solar-planets" role="list" aria-label="Ideas in '+safe(cluster)+'">'+
     sorted.map(({name,response},i)=>
      '<article class="orbit-solar-planet'+arriveClass(arrivals,name,response)+'" role="listitem" data-orbit-planet="'+(i+1)+'">'+
       '<span class="orbit-solar-moon" aria-hidden="true"><span class="orbit-solar-moon-glyph">'+icons[(index*3+i)%icons.length]+'</span></span>'+
       '<div class="orbit-solar-idea">'+(ideaLabel(name,run)?
        '<strong>'+safe(ideaLabel(name,run))+'</strong>':'')+
        '<p>'+safe(response?.text||'')+'</p></div></article>').join('')+
    '</div></section>';
  }).join('');
  return '<div class="orbit-cluster-wrap orbit-solar-systems" role="list" aria-label="Grouped crew ideas">'+
   summary+systems+'</div>';
 }
 const originalClusters=typeof window.orbitClusterMarkup==='function'?window.orbitClusterMarkup:null;
 if(originalClusters){
  window.orbitClusterMarkup=function(run,big){
   return orbitSolarMarkup(run);
  };
 }

 const noName=(run)=>Boolean(run?.orbitConfig?.anonymous&&!run?.orbitRevealCrew);
 function ideaLabel(name,run){return noName(run)?'':String(name||'')}
 function gallery(entries,run,arrivals){
  return '<div class="orbit-idea-gallery orbit-cosmic-gallery" role="list" aria-label="All crew ideas">'+
   entries.map(([name,r],i)=>'<article class="orbit-gallery-card orbit-tone-'+tones[i%tones.length]+arriveClass(arrivals,name,r)+'" role="listitem">'+
    '<span class="orbit-gallery-number" aria-hidden="true">'+icons[i%icons.length]+'</span>'+
    '<div class="orbit-gallery-copy">'+(ideaLabel(name,run)?
     '<strong class="orbit-gallery-author">'+safe(ideaLabel(name,run))+'</strong>':'')+
     '<p>'+safe(r?.text||'')+'</p></div></article>').join('')+'</div>';
 }
 function satellites(entries,run,arrivals){
  const total=entries.length,rows=Math.ceil(total/2);
  return '<div class="orbit-satellites" role="list" aria-label="Ideas orbiting the question">'+
   entries.map(([name,r],i)=>{
    const side=i%2,slot=Math.floor(i/2),y=((slot+.5)/rows*100).toFixed(2);
    return '<article class="orbit-satellite orbit-tone-'+tones[i%tones.length]+arriveClass(arrivals,name,r)+'" role="listitem"'+
     ' style="--orb-x:'+(side?'75.5':'1.2')+'%;--orb-y:'+y+'%;--orb-enter-x:'+(side?'-125':'125')+'%;">'+
     '<span class="orbit-sat-moon" aria-hidden="true"><span class="orbit-sat-icon">'+icons[i%icons.length]+'</span></span>'+
     '<div class="orbit-sat-content">'+(ideaLabel(name,run)?
       '<strong class="orbit-sat-author">'+safe(ideaLabel(name,run))+'</strong>':'')+
       '<span class="orbit-sat-text">'+safe(r?.text||'')+'</span></div></article>';
   }).join('')+'</div>';
 }
 if(originalIdeas){
  window.orbitIdeasMarkup=function(run,big){
   const entries=Object.entries(run?.orbitResponses||{});
   const arrivals=arrivalFor(run,entries);
   if(!entries.length)return originalIdeas(run,big);
   // The projector presents up to ten brief contributions as glowing planets.
   // Full-length text and larger classes use a scrollable, equally styled
   // gallery so no student's response is visually cut off or omitted.
   if(big&&entries.length<=10&&entries.every(([,r])=>String(r?.text||'').length<=(noName(run)?62:47)))
    return satellites(entries,run,arrivals);
   return gallery(entries,run,arrivals);
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
   // Spotlight remains the teacher's native selected response. The
   // broadcast frame is decoration only; it never changes the selected idea
   // or reveals a name while anonymous mode is active.
   if(run?.orbitSpotlight&&responses[run.orbitSpotlight]){
    const focusKey=String(run?.runToken||run?.orbitRound||'orbit')+'|'+String(run.orbitSpotlight);
    if(lastSpotlight!==focusKey){lastSpotlight=focusKey;focusUntil=performance.now()+1300}
    const opening=performance.now()<focusUntil?' orbit-focus-new':'';
    enhanced=enhanced.replace('<div class="orbit-spotlight">',
     '<div class="orbit-spotlight orbit-spotlight-broadcast'+opening+'">'+
     '<div class="orbit-focus-rings" aria-hidden="true"><i></i><i></i><i></i></div>'+
     '<div class="orbit-broadcast-heading" aria-hidden="true">✦ CREW IDEA SPOTLIGHT ✦</div>');
   }
   if(!run?.orbitSpotlight)lastSpotlight='';
   return enhanced;
  };
 }

 // ORBIT Phase 4G teacher mission deck. All controls are existing native
 // buttons/selects, moved after the native handlers are wired; classroom
 // state and projector privacy still belong to the original activity engine.
 let teacherFilter='all';
 const el=(tag,className,textContent)=>{
  const node=document.createElement(tag);node.className=className;
  if(textContent!=null)node.textContent=textContent;return node;
 };
 function polishTeacher(run,controller){
  const cards=controller.querySelectorAll(':scope > .orbit-control-card');
  if(cards.length<2)return;
  const [preview,command]=cards,grid=command.querySelector('.orbit-control-grid');
  const list=command.querySelector('.orbit-response-list');
  if(!grid||!list)return;
  controller.classList.add('si-orbit-teacher-deck');
  const responses=run.orbitResponses||{},assign=run.orbitAssignments||{};
  const clusterNames=[...new Set((run.orbitClusters||[]).filter(c=>typeof c==='string'&&c.trim()))];
  const mode=run.orbitSpotlight&&responses[run.orbitSpotlight]?'SPOTLIGHT':
   run.orbitCompare?'BEFORE / AFTER':run.orbitClusterView?'SOLAR SYSTEMS':'LIVE ORBIT';
  const privacy=run.orbitConfig?.anonymous&&!run.orbitRevealCrew?'NAMES HIDDEN ON PROJECTOR':
   'NAMES VISIBLE ON PROJECTOR';
  if(!preview.querySelector('.si-orbit-preview-heading')){
   const bar=el('div','si-orbit-preview-heading');
   bar.innerHTML='<span>✦ PROJECTOR PREVIEW</span><small>Matches the classroom display</small>';
   preview.prepend(bar);
  }
  if(!command.querySelector('.si-orbit-command-head')){
   const heading=el('div','si-orbit-command-head');
   heading.innerHTML='<span>MISSION CONTROL · LIVE</span><strong>Guide the conversation</strong>'+
    '<div class="si-orbit-broadcast-status"><b></b><span></span></div>';
   command.prepend(heading);
   const oldTitle=command.querySelector(':scope > h3');
   if(oldTitle)oldTitle.classList.add('si-orbit-native-heading');
  }
  const status=command.querySelector('.si-orbit-broadcast-status');
  if(status){
   const modeNode=status.querySelector('b'),privacyNode=status.querySelector('span');
   if(modeNode.textContent!==mode)modeNode.textContent=mode;
   if(privacyNode.textContent!==privacy)privacyNode.textContent=privacy;
   status.dataset.privacy=privacy.startsWith('NAMES HIDDEN')?'hidden':'visible';
  }
  if(!grid.dataset.siOrbitGrouped){
   grid.dataset.siOrbitGrouped='true';
   const makeGroup=(label,ids)=>{
    const group=el('section','si-orbit-action-group');
    const heading=el('div','si-orbit-action-heading',label);
    const controls=el('div','si-orbit-actions');
    group.append(heading,controls);
    ids.forEach(id=>{const button=grid.querySelector('#'+id);if(button)controls.append(button)});
    grid.append(group);
    return group;
   };
   makeGroup('01 · CLASSROOM DISPLAY',['orbitReturnViewBtn','orbitClusterViewBtn','orbitCrewBtn','orbitCompareBtn']);
   const lesson=makeGroup('02 · LESSON CONTROLS',['orbitPauseBtn','orbitNewClusterBtn',
    'orbitFollowUpBtn','orbitReOrbitBtn']);
   const newBtn=lesson.querySelector('#orbitNewClusterBtn');
   if(newBtn){
    const form=el('form','si-orbit-create-system');
    form.hidden=true;
    form.innerHTML='<label for="siOrbitNewCluster">New solar-system name</label>'+
     '<div class="si-orbit-create-fields"><input id="siOrbitNewCluster" maxlength="55" '+
     'autocomplete="off" placeholder="e.g., Kindness" required>'+
     '<button type="submit">Add system</button><button type="button" class="si-orbit-cancel-system">Cancel</button></div>'+
     '<p role="status" aria-live="polite"></p>';
    lesson.append(form);
    newBtn.onclick=()=>{
     form.hidden=!form.hidden;
     if(!form.hidden)form.querySelector('input').focus();
    };
    form.querySelector('.si-orbit-cancel-system').onclick=()=>{
     form.hidden=true;newBtn.focus();
    };
    form.onsubmit=event=>{
     event.preventDefault();
     const input=form.querySelector('input'),name=input.value.trim();
     const feedback=form.querySelector('p');
     if(!name){feedback.textContent='Enter a name for the solar system.';return}
     const current=state.activityRun;if(!current||current.activityId!=='orbit-game')return;
     current.orbitClusters=current.orbitClusters||[];
     if(current.orbitClusters.includes(name)){
      feedback.textContent='That solar system already exists.';input.focus();return;
     }
     current.orbitClusters.push(name);teacherFilter='all';
     render();if(typeof toast==='function')toast('Solar system created: '+name);
    };
   }
  }
  if(!command.querySelector('.si-orbit-ideas-tools')){
   const tools=el('div','si-orbit-ideas-tools');
   tools.innerHTML='<div class="si-orbit-ideas-heading"><div><span>CREW TRANSMISSIONS</span>'+
    '<h4>Sort the ideas</h4></div><b></b></div>'+
    '<div class="si-orbit-filter-bar" role="group" aria-label="Filter ideas by solar system"></div>'+
    '<p class="si-orbit-sorting-tip">Choose a solar system beside each idea. Use Spotlight to feature it on the projector.</p>';
   list.before(tools);
  }
  const tools=command.querySelector('.si-orbit-ideas-tools');
  const rows=[...list.querySelectorAll('.orbit-response-row')];
  const activeRows=rows.filter(row=>row.querySelector('[data-orbit-cluster]'));
  const waitingCount=rows.length-activeRows.length;
  const filterDefs=[
   {key:'all',text:'All ideas',count:rows.length},
   {key:'unassigned',text:'Unassigned',count:activeRows.filter(row=>{
    const select=row.querySelector('select');return !select?.value}).length}
  ].concat(clusterNames.map(name=>({key:'cluster:'+name,text:name,
   count:activeRows.filter(row=>row.querySelector('select')?.value===name).length})));
  if(!filterDefs.some(item=>item.key===teacherFilter))teacherFilter='all';
  const filterBar=tools.querySelector('.si-orbit-filter-bar');
  const filterStamp=filterDefs.map(x=>x.key+'\t'+x.text+'\t'+x.count).join('|');
  if(filterBar.dataset.stamp!==filterStamp){
   filterBar.dataset.stamp=filterStamp;filterBar.replaceChildren();
   filterDefs.forEach(item=>{
    const button=el('button','si-orbit-filter',item.text+' · '+item.count);
    button.type='button';button.dataset.orbitFilter=item.key;
    button.addEventListener('click',()=>{teacherFilter=item.key;polishTeacher(state.activityRun,controller)});
    filterBar.append(button);
   });
  }
  filterBar.querySelectorAll('button').forEach(button=>{
   const selected=button.dataset.orbitFilter===teacherFilter;
   if(button.getAttribute('aria-pressed')!==String(selected))
    button.setAttribute('aria-pressed',String(selected));
   button.classList.toggle('is-active',selected);
  });
  const counter=tools.querySelector('.si-orbit-ideas-heading b');
  const countLabel=activeRows.length+' received · '+waitingCount+' waiting';
  if(counter.textContent!==countLabel)counter.textContent=countLabel;
  rows.forEach(row=>{
   const select=row.querySelector('[data-orbit-cluster]');
   const name=select?.dataset.orbitCluster||'';
   const assigned=select?.value||'';
   const stateLabel=!select?'Awaiting response':assigned||'Not assigned yet';
   row.dataset.orbitSortState=!select?'waiting':assigned?'assigned':'unassigned';
   row.dataset.orbitSystem=assigned;
   if(select){
    select.setAttribute('aria-label','Assign '+name+' to a solar system');
    const spotlight=row.querySelector('[data-orbit-spotlight]');
    if(spotlight)spotlight.setAttribute('aria-label','Spotlight idea from '+name);
   }
   const copy=row.firstElementChild;
   if(copy){
    let tag=copy.querySelector('.si-orbit-idea-tag');
    if(!tag){tag=el('span','si-orbit-idea-tag');copy.append(tag)}
    if(tag.textContent!==stateLabel)tag.textContent=stateLabel;
   }
   const visible=teacherFilter==='all'||
    (teacherFilter==='unassigned'&&select&&!assigned)||
    (teacherFilter.startsWith('cluster:')&&assigned===teacherFilter.slice(8));
   row.hidden=!visible;
  });
  let empty=list.querySelector('.si-orbit-filter-empty');
  if(!empty){empty=el('div','si-orbit-filter-empty');empty.hidden=true;list.append(empty)}
  const visibleRows=rows.filter(row=>!row.hidden);
  empty.hidden=visibleRows.length>0;
  if(!visibleRows.length)empty.textContent=teacherFilter==='unassigned'?
   'All received ideas are assigned to solar systems.':'No ideas in this view yet.';
  controller.dataset.orbitBroadcast=mode.toLowerCase().replace(/[^a-z]+/g,'-');
 }

 // ORBIT Phase 4H student companion. This is a visual layout enhancement,
 // not a new transmission pathway. Native submitOrbitForStudent still owns
 // pause checks, one-response locking, teacher anonymity and classroom sync.
 let orbitStudentDraftIdentity='';
 const orbitStudentDrafts=new Map();
 function polishStudent(run){
  if(!document.body.classList.contains('role-student')||run?.phase!=='running')return;
  const prompt=document.querySelector('#studentContent .student-prompt.response-device');
  if(!prompt)return;
  const pupil=typeof selectedStudent==='function'?selectedStudent():null;
  if(!pupil?.n)return;
  const identity=String(run.runToken||run.orbitRound||run.orbitConfig?.prompt||'orbit');
  if(orbitStudentDraftIdentity!==identity){
   orbitStudentDraftIdentity=identity;orbitStudentDrafts.clear();
  }
  const draftKey=identity+'|'+pupil.n;
  const submitted=run.orbitResponses?.[pupil.n];
  prompt.classList.add('si-orbit-student');
  prompt.classList.toggle('si-orbit-student-sent',!!submitted);
  prompt.classList.toggle('si-orbit-student-paused',!!run.orbitPaused&&!submitted);
  let head=prompt.querySelector('.si-orbit-student-top');
  if(!head){
   head=document.createElement('div');head.className='si-orbit-student-top';
   const eyebrow=prompt.querySelector(':scope > .eyebrow');
   if(eyebrow){eyebrow.before(head);head.append(eyebrow)}
   const round=document.createElement('span');round.className='si-orbit-student-round';
   head.append(round);
  }
  const roundLabel='ROUND '+Math.max(1,Number(run.orbitRound||1));
  const round=head.querySelector('.si-orbit-student-round');
  if(round&&round.textContent!==roundLabel)round.textContent=roundLabel;
  const eyebrow=head.querySelector('.eyebrow');
  if(eyebrow&&eyebrow.textContent!=='ORBIT')eyebrow.textContent='ORBIT';
  const heading=prompt.querySelector(':scope > h2');
  if(submitted){
   orbitStudentDrafts.delete(draftKey);
   if(heading&&heading.textContent!=='Idea sent!')heading.textContent='Idea sent!';
   const confirm=prompt.querySelector('.orbit-transmitted');
   if(confirm){
    confirm.classList.add('si-orbit-student-confirm');
    const first=confirm.querySelector(':scope > b');
    if(first&&first.textContent!=='Your idea is on its way.')first.textContent='Your idea is on its way.';
    const msg=confirm.querySelector(':scope > p');
    if(msg&&msg.textContent!=='Watch it appear on the classroom screen.')
     msg.textContent='Watch it appear on the classroom screen.';
    let own=confirm.querySelector('.si-orbit-own-idea');
    if(!own){own=document.createElement('blockquote');own.className='si-orbit-own-idea';confirm.append(own)}
    if(own.textContent!==String(submitted.text||''))own.textContent=String(submitted.text||'');
   }
  }else{
   const entry=prompt.querySelector('.orbit-student-box');
   const textarea=entry?.querySelector('#orbitStudentText');
   if(!entry||!textarea)return;
   entry.classList.add('si-orbit-student-entry');
   textarea.setAttribute('aria-label','Your idea for the ORBIT question');
   textarea.setAttribute('aria-describedby','orbitCharCount');
   textarea.setAttribute('placeholder','Type your idea…');
   textarea.setAttribute('rows','4');
   textarea.setAttribute('enterkeyhint','enter'); // Enter remains a new line
   const restore=orbitStudentDrafts.get(draftKey);
   if(restore!=null&&!textarea.value){
    textarea.value=restore;
    if(typeof textarea.oninput==='function')textarea.oninput({target:textarea});
   }
   let helper=entry.querySelector('.si-orbit-entry-note');
   if(!helper){
    helper=document.createElement('p');helper.className='si-orbit-entry-note';
    entry.insertBefore(helper,textarea);
   }
   const instructions=run.orbitPaused?'Your teacher has paused sending. You can still write your idea.':
    'Share one idea with your class.';
   if(helper.textContent!==instructions)helper.textContent=instructions;
   let privacy=entry.querySelector('.si-orbit-student-privacy');
   if(!privacy){
    privacy=document.createElement('p');privacy.className='si-orbit-student-privacy';
    entry.append(privacy);
   }
   const privacyText=run.orbitConfig?.anonymous?
    'Your name is hidden on the classroom display.':
    'Your idea will appear on the classroom display.';
   if(privacy.textContent!==privacyText)privacy.textContent=privacyText;
   let note=prompt.querySelector(':scope > .prompt-caption, :scope > .submitted-banner');
   if(note)note.hidden=true; // same instructions now beside the text field
   // renderStudentControls is recreated on each native render. Move its
   // currently wired button; never add a second submit action or endpoint.
   const from=document.querySelector('#studentControls #sendOrbitBtn');
   if(from){
    entry.querySelector('#sendOrbitBtn')?.remove();
    from.type='button';
    from.classList.add('si-orbit-student-send');
    // Native control handler can otherwise remain attached to the old
    // button after a keyed DOM reconciliation or partial state redraw.
    if(typeof submitOrbitForStudent==='function')from.onclick=submitOrbitForStudent;
    entry.append(from);
   }
   const send=entry.querySelector('#sendOrbitBtn');
   const count=entry.querySelector('#orbitCharCount');
   const update=()=>{
    const current=entry.querySelector('#sendOrbitBtn');
    const value=textarea.value.slice(0,500);
    if(count){const label=value.length+' / 500';if(count.textContent!==label)count.textContent=label}
    orbitStudentDrafts.set(draftKey,value);
    if(!current)return;
    const disabled=!!run.orbitPaused||!value.trim();
    if(current.disabled!==disabled)current.disabled=disabled;
    const title=run.orbitPaused?'Sending paused':'Send my idea';
    if(current.dataset.orbitActionLabel!==title){
     current.dataset.orbitActionLabel=title;
     current.innerHTML='<span aria-hidden="true">'+(run.orbitPaused?'Ⅱ':'➜')+'</span> '+title;
    }
    current.setAttribute('aria-label',title);
   };
   if(!textarea.dataset.siOrbitWired){
    textarea.dataset.siOrbitWired='true';
    textarea.addEventListener('input',update);
    textarea.addEventListener('keydown',event=>{
     if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing){
      const button=entry.querySelector('#sendOrbitBtn');
      if(button&&!button.disabled){event.preventDefault();button.click()}
     }
    });
   }
   update();
  }
  const wrap=document.querySelector('#studentControls');
  // Native "transmission received" disabled indicator is redundant next
  // to the confirmation. The footer remains available in every other app.
  if(wrap?.dataset.app==='orbit')wrap.dataset.siOrbitStudentSimple='true';
 }
 function enhance(){
  if(document.body.classList.contains('role-shared')||document.body.classList.contains('role-student')){
   const r=typeof state!=='undefined'?state.activityRun:null;
   if(document.body.classList.contains('role-student')&&r?.activityId==='orbit-game')
    polishStudent(r);
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
   polishTeacher(r,controller);
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
