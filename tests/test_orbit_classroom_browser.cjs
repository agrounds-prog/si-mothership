/* ORBIT Phase 1 · isolated classroom visual & gameplay regression.
   Never runs against Railway production or touches genuine student data. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error('Orbit browser tests are restricted to isolated localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const teacherContext=await browser.newContext({viewport:{width:1400,height:920}});
 const t=await teacherContext.newPage(),errors=[];
 t.on('pageerror',e=>errors.push('teacher '+String(e)));
 try{
  assert.equal((await teacherContext.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await t.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await t.waitForFunction(()=>window.SIOrbitPolish&&typeof orbitSharedMarkup==='function',null,{timeout:13000});
  await t.evaluate(()=>{state.screen='activities';state.activeApp='orbit';state.activityRun=null;render()});
  await t.locator('.orbit-setup').waitFor({timeout:13000});
  assert.equal(await t.locator('#orbitPrompt').count(),1);
  const script=await t.evaluate(()=>({
   stylesheet:[...document.styleSheets].some(x=>x.href?.includes('orbit-polish.css')),
   script:!!window.SIOrbitPolish,
   native:typeof launchOrbit==='function',
   persistedKey:typeof ORBIT_STORE==='string'}));
  assert.deepEqual(script,{stylesheet:true,script:true,native:true,persistedKey:true});
  await t.locator('#orbitPrompt').fill('How can we make everyone feel included in our classroom?');
  assert.match(await t.locator('.orbit-prompt-count').innerText(),/60\s*\/\s*500|[0-9]+ \/ 500/);
  await t.setViewportSize({width:490,height:830});
  const setupWidth=await t.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(setupWidth<=35,'responsive Orbit setup avoids horizontal overflow');
  await t.setViewportSize({width:1400,height:920});
  const frame=await t.evaluate(()=>{
   const names=Array.from({length:24},(_,i)=>'Student '+String(i+1).padStart(2,'0'));
   state.students=names.map(n=>({n,offline:false}));
   const responses={};
   names.forEach((n,i)=>responses[n]={text:'Idea '+String(i+1).padStart(2,'0')+': Invite others to join a team and listen carefully.',at:Date.now()});
   state.activityRun={activityId:'orbit-game',phase:'running',orbitConfig:{name:'Crew Ideas',prompt:'What makes a good friend?',anonymous:true},
    orbitResponses:responses,orbitRevealCrew:false,orbitPaused:false,orbitRound:1,
    orbitClusters:[],orbitAssignments:{},orbitCompare:false,orbitClusterView:false,orbitSpotlight:null};
   const html=orbitSharedMarkup(state.activityRun,true);
   const mount=document.createElement('div');mount.className='si-orbit-fixture';mount.innerHTML=html;
   document.body.append(mount);
   const stage=mount.querySelector('.orbit-space');
   const result={count:mount.querySelectorAll('.orbit-gallery-card').length,
    first:mount.querySelector('.orbit-gallery-card')?.textContent,
    last:mount.querySelector('.orbit-gallery-card:last-child')?.textContent,
    noNames:!mount.innerHTML.includes('Student 01'),
    noAbsolute:!mount.querySelector('.orbit-idea'),
    role:mount.querySelector('.orbit-idea-gallery')?.getAttribute('role'),
    galleryFlow:getComputedStyle(mount.querySelector('.orbit-idea-gallery')).display,
    stageFlow:getComputedStyle(stage).display};
   mount.remove();return result;
  });
  assert.equal(frame.count,24,'every idea displayed, not only the first 16');
  assert.match(frame.last,/Idea 24/);
  assert.equal(frame.noNames,true,'anonymous names remain private');
  assert.equal(frame.noAbsolute,true);
  assert.deepEqual([frame.role,frame.galleryFlow,frame.stageFlow],['list','grid','grid']);
  // Illustrated cosmic mode: ten response satellites around the actual
  // question, still derived from student responses and anonymity settings.
  const cosmic=await t.evaluate(()=>{
   const all=Object.entries(state.activityRun.orbitResponses);
   const run={...state.activityRun,orbitResponses:Object.fromEntries(all.slice(0,10))};
   const mount=document.createElement('div');
   mount.className='si-orbit-fixture';
   mount.innerHTML=orbitSharedMarkup(run,true);document.body.append(mount);
   const sat=[...mount.querySelectorAll('.orbit-satellite')],core=mount.querySelector('.orbit-core');
   const header=mount.querySelector('.orbit-cosmic-header');
   const info={satellites:sat.length,galaxies:mount.querySelectorAll('.orbit-idea-gallery').length,
    styles:sat.map(x=>x.className),prompt:core?.textContent?.trim(),
    wordmark:header?.querySelector('.orbit-cosmic-wordmark')?.textContent,
    hideNames:!mount.innerHTML.includes('Student 01'),
    lastIdea:mount.querySelector('.orbit-satellite:last-child')?.textContent,
    colors:getComputedStyle(sat[0]).getPropertyValue('--orb-strong').trim()};
   run.orbitRevealCrew=true;
   const named=document.createElement('div');named.innerHTML=orbitSharedMarkup(run,true);
   info.revealedNames=named.querySelector('.orbit-sat-author, .orbit-gallery-author')?.textContent;
   mount.remove();return info;
  });
  assert.equal(cosmic.satellites,10);
  assert.equal(cosmic.galaxies,0);
  assert.equal(cosmic.hideNames,true,'anonymous Orbit keeps identity off all satellites');
  assert.equal(cosmic.revealedNames,'Student 01',
   'revealed names remain present when lengthy responses use the spacious gallery');
  assert.match(cosmic.wordmark,/ORBIT/);
  assert.match(cosmic.prompt,/What makes a good friend/);
  assert.match(cosmic.lastIdea,/Idea 10/);
  assert.ok(cosmic.colors.length>0&&cosmic.styles.some(x=>x.includes('orbit-tone-cyan')));
  const verbose=await t.evaluate(()=>{
   const run={...state.activityRun,orbitResponses:{'Long Answer':{text:'Think about ways to include everyone. '.repeat(8)}}};
   const box=document.createElement('div');box.innerHTML=orbitSharedMarkup(run,true);
   return {satellites:box.querySelectorAll('.orbit-satellite').length,
    gallery:box.querySelectorAll('.orbit-gallery-card').length,
    fullText:box.querySelector('.orbit-gallery-copy p')?.textContent?.length};
  });
  assert.equal(verbose.satellites,0,'long response should not overflow a planet');
  assert.equal(verbose.gallery,1);
  assert.ok(verbose.fullText>160);
  // The redesigned waiting scene uses the same planet treatment before the
  // first response and reports real run phases without changing submissions.
  const cosmicStates=await t.evaluate(()=>{
   const base=state.activityRun;
   const markup=(responses,paused)=>orbitSharedMarkup({
    ...base,orbitResponses:responses,orbitPaused:paused,
    orbitSpotlight:null,orbitCompare:false,orbitClusterView:false
   },true);
   const view=html=>{
    const root=document.createElement('div');root.innerHTML=html;
    const surface=root.querySelector('.orbit-cosmic');
    return {phase:surface?.dataset.orbitPhase,
     text:surface?.querySelector('.orbit-cosmic-state')?.textContent,
     waiting:!!surface?.querySelector('.orbit-space[data-orbit-waiting]'),
     planet:!!surface?.querySelector('.orbit-space .orbit-core'),
     status:surface?.querySelector('.orbit-cosmic-tally')?.getAttribute('aria-label')};
   };
   const first=Object.fromEntries(Object.entries(base.orbitResponses).slice(0,1));
   return {empty:view(markup({},false)),
    collecting:view(markup(first,false)),
    paused:view(markup(first,true)),
    complete:view(markup(base.orbitResponses,false))};
  });
  assert.deepEqual([cosmicStates.empty.phase,cosmicStates.collecting.phase,
   cosmicStates.paused.phase,cosmicStates.complete.phase],
   ['waiting','collecting','paused','complete']);
  assert.equal(cosmicStates.empty.waiting,true);
  assert.equal(cosmicStates.empty.planet,true);
  assert.equal(cosmicStates.collecting.waiting,false);
  assert.match(cosmicStates.empty.text,/AWAITING CREW IDEAS/);
  assert.match(cosmicStates.paused.text,/TRANSMISSIONS PAUSED/);
  assert.match(cosmicStates.complete.text,/ALL CREW RESPONDED/);
  assert.match(cosmicStates.empty.status,/0 of 24/);
  // The teacher meter must be derived from native run state, never from a
  // synthetic tally that could diverge from the classroom session.
  await t.evaluate(()=>{
   const area=document.querySelector('#activityControllerPanel');
   area.innerHTML='<div class="orbit-controller"><div class="orbit-control-card"><div class="orbit-completion"></div></div></div>';
   SIOrbitPolish.enhance();
  });
  const meter=await t.evaluate(()=>{
   const box=document.querySelector('.si-orbit-participation'),bar=box.querySelector('[role=progressbar]');
   return {label:box.querySelector('strong').textContent,now:bar.getAttribute('aria-valuenow'),
    max:bar.getAttribute('aria-valuemax'),fill:bar.firstElementChild.style.width};
  });
  assert.deepEqual(meter,{label:'24 of 24 crew responses',now:'24',max:'24',fill:'100%'});
  // Phase 4G: actual native teacher controller, no production mutations.
  await t.evaluate(()=>{
   state.screen='activities';state.view='teacher';
   state.activities=state.activities||[];
   if(!state.activities.some(a=>a.id==='orbit-game'))
    state.activities.push({id:'orbit-game',type:'orbit',name:'Crew Ideas',prompt:'What makes a good friend?'});
   state.activityRun.orbitClusters=['Cooperate','Kindness'];
   state.activityRun.orbitAssignments={'Student 01':'Kindness'};
   state.activityRun.orbitClusterView=false;
   state.activityRun.orbitRevealCrew=false;
   state.activityRun.orbitSpotlight=null;
   state.activityRun.orbitCompare=false;
   renderActivityController();
   SIOrbitPolish.enhance();
  });
  const teacherDeck=await t.evaluate(()=>{
   const root=document.querySelector('#activityControllerPanel .si-orbit-teacher-deck');
   const sections=[...root.querySelectorAll('.si-orbit-action-heading')].map(n=>n.textContent);
   return {root:!!root,sections,
    preview:root.querySelector('.si-orbit-preview-heading')?.textContent,
    actions:root.querySelectorAll('.si-orbit-actions>button').length,
    list:root.querySelectorAll('.orbit-response-row').length,
    count:root.querySelector('.si-orbit-ideas-heading b')?.textContent,
    privacy:root.querySelector('.si-orbit-broadcast-status')?.dataset.privacy,
    hiddenNames:!root.querySelector('.orbit-public')?.textContent.includes('Student 01'),
    unassigned:root.querySelector('[data-orbit-filter="unassigned"]')?.textContent,
    linked:root.querySelector('[data-orbit-cluster="Student 01"]')?.value};
  });
  assert.equal(teacherDeck.root,true);
  assert.deepEqual(teacherDeck.sections,['01 · CLASSROOM DISPLAY','02 · LESSON CONTROLS']);
  assert.match(teacherDeck.preview,/PROJECTOR PREVIEW/);
  assert.equal(teacherDeck.actions,8,'all eight original teacher controls remain available');
  assert.equal(teacherDeck.list,24);
  assert.match(teacherDeck.count,/24 received/);
  assert.equal(teacherDeck.privacy,'hidden');
  assert.equal(teacherDeck.hiddenNames,true,'anonymous projector preview never reveals crew identity');
  assert.match(teacherDeck.unassigned,/23/);
  assert.equal(teacherDeck.linked,'Kindness');
  await t.locator('#activityControllerPanel [data-orbit-filter="unassigned"]').click();
  const filtered=await t.evaluate(()=>{
   const root=document.querySelector('#activityControllerPanel .si-orbit-teacher-deck');
   return {visible:[...root.querySelectorAll('.orbit-response-row')].filter(r=>!r.hidden).length,
    total:root.querySelectorAll('.orbit-response-row').length,
    privacy:state.activityRun.orbitRevealCrew,
    active:root.querySelector('[data-orbit-filter="unassigned"]')?.getAttribute('aria-pressed')};
  });
  assert.deepEqual(filtered,{visible:23,total:24,privacy:false,active:'true'},
   'teacher-only filters hide rows visually without deleting responses or revealing names');
  await t.locator('#activityControllerPanel [data-orbit-filter="all"]').click();
  await t.locator('#activityControllerPanel #orbitNewClusterBtn').click();
  await t.locator('#siOrbitNewCluster').fill('Teamwork');
  await t.locator('.si-orbit-create-system button[type="submit"]').click();
  await t.waitForFunction(()=>state.activityRun.orbitClusters.includes('Teamwork'));
  await t.waitForFunction(()=>!!document.querySelector('#activityControllerPanel [data-orbit-filter="cluster:Teamwork"]'));
  await t.locator('[data-orbit-cluster="Student 02"]').selectOption('Teamwork');
  await t.waitForFunction(()=>state.activityRun.orbitAssignments['Student 02']==='Teamwork');
  await t.locator('[data-orbit-filter="cluster:Teamwork"]').click();
  const assignedView=await t.evaluate(()=>{
   const root=document.querySelector('#activityControllerPanel .si-orbit-teacher-deck');
   const visible=[...root.querySelectorAll('.orbit-response-row')].filter(r=>!r.hidden);
   return {visible:visible.length,name:visible[0]?.querySelector('b')?.textContent,
    assigned:state.activityRun.orbitAssignments['Student 02'],
    all:Object.keys(state.activityRun.orbitResponses).length,
    system:visible[0]?.querySelector('.si-orbit-idea-tag')?.textContent};
  });
  assert.deepEqual(assignedView,{visible:1,name:'Student 02',assigned:'Teamwork',
   all:24,system:'Teamwork'},'assignment persists and filters follow the native selection');
  await t.locator('[data-orbit-filter="all"]').click();
  await t.locator('[data-orbit-spotlight="Student 02"]').click();
  await t.waitForFunction(()=>state.activityRun.orbitSpotlight==='Student 02');
  const teacherSpot=await t.evaluate(()=>({
   mode:document.querySelector('.si-orbit-broadcast-status b')?.textContent,
   private:!document.querySelector('#activityControllerPanel .orbit-public')?.textContent.includes('Student 02'),
   selected:state.activityRun.orbitSpotlight}));
  assert.deepEqual(teacherSpot,{mode:'SPOTLIGHT',private:true,selected:'Student 02'});
  await t.locator('#orbitReturnViewBtn').click();
  await t.waitForFunction(()=>state.activityRun.orbitSpotlight===null);
  await t.locator('#orbitClusterViewBtn').click();
  await t.waitForFunction(()=>state.activityRun.orbitClusterView===true);
  const groupPreview=await t.evaluate(()=>({
   mode:document.querySelector('.si-orbit-broadcast-status b')?.textContent,
   team:!![...document.querySelectorAll('#activityControllerPanel .orbit-solar-system h4')]
    .find(el=>el.textContent==='Teamwork'),
   private:!document.querySelector('#activityControllerPanel .orbit-public')?.textContent.includes('Student 02')}));
  assert.deepEqual(groupPreview,{mode:'SOLAR SYSTEMS',team:true,private:true},
   'teacher preview matches the projector grouping while preserving anonymity');
  await t.setViewportSize({width:490,height:830});
  const teacherNarrow=await t.evaluate(()=>{
   const root=document.querySelector('.si-orbit-teacher-deck');
   const right=root.querySelectorAll(':scope>.orbit-control-card')[1];
   return {columns:getComputedStyle(root).gridTemplateColumns.split(' ').length,
    rootOverflow:root.scrollWidth-root.clientWidth,
    rightOverflow:right.scrollWidth-right.clientWidth};
  });
  assert.equal(teacherNarrow.columns,1,'compact teacher screen stacks preview and controls');
  assert.ok(teacherNarrow.rootOverflow<=3&&teacherNarrow.rightOverflow<=3,
   'compact clustering controls have no horizontal overflow');
  await t.setViewportSize({width:1400,height:920});
  console.log('ORBIT Phase 4G teacher grouping, inline create, native assignments, Spotlight, anonymous previews and compact layout PASSED',
   JSON.stringify({teacherDeck,filtered,assignedView,teacherSpot,groupPreview,teacherNarrow}));
  // Phase 4H: exercise a real ORBIT student UI with native submission, not a
  // mock visual. Only the isolated localhost classroom fixture is modified.
  await t.setViewportSize({width:440,height:780});
  await t.evaluate(()=>{
   state.selectedStudent='Student 01';
   state.activityRun.orbitPaused=true;
   state.activityRun.orbitRevealCrew=false;
   delete state.activityRun.orbitResponses['Student 01'];
   document.body.classList.add('role-student');
   document.querySelector('#teacher')?.classList.remove('active');
   document.querySelector('#student')?.classList.add('active');
   renderPublic();SIOrbitPolish.enhance();
  });
  await t.locator('#studentContent .si-orbit-student').waitFor();
  const pausedStudent=await t.evaluate(()=>{
   const card=document.querySelector('#studentContent .si-orbit-student');
   const field=card.querySelector('#orbitStudentText');
   const send=card.querySelector('#sendOrbitBtn');
   const zone=document.querySelector('.student-control-zone');
   const main=document.querySelector('#studentContent');
   const rect=el=>el.getBoundingClientRect();
   return {title:card.querySelector('h2')?.textContent,
    marker:card.querySelector('.si-orbit-student-round')?.textContent,
    paused:card.classList.contains('si-orbit-student-paused'),
    prompt:card.querySelector('.si-orbit-entry-note')?.textContent,
    privacy:card.querySelector('.si-orbit-student-privacy')?.textContent,
    send:send?.textContent.trim(),disabled:send?.disabled,
    sendInCard:!!send,duplicate:document.querySelectorAll('#sendOrbitBtn').length,
    order:rect(send).top>=rect(field).bottom,
    gap:Math.round(rect(send).top-rect(field).bottom),
    height:Math.round(rect(card).height),
    zone:getComputedStyle(zone).display,
    deviceOverflow:document.querySelector('#student .device').scrollWidth-
      document.querySelector('#student .device').clientWidth,
    mainOverflow:main.scrollWidth-main.clientWidth,
    fieldLabel:field.getAttribute('aria-label')};
  });
  assert.match(pausedStudent.title,/What makes a good friend/);
  assert.equal(pausedStudent.marker,'ROUND 1');
  assert.equal(pausedStudent.paused,true);
  assert.match(pausedStudent.prompt,/paused/i);
  assert.match(pausedStudent.privacy,/name is hidden/i);
  assert.match(pausedStudent.send,/Sending paused/);
  assert.equal(pausedStudent.disabled,true);
  assert.equal(pausedStudent.sendInCard,true);
  assert.equal(pausedStudent.duplicate,1);
  assert.equal(pausedStudent.order,true);
  assert.ok(pausedStudent.gap>=0&&pausedStudent.gap<70);
  assert.ok(pausedStudent.height<620);
  assert.equal(pausedStudent.zone,'none');
  assert.equal(pausedStudent.fieldLabel,'Your idea for the ORBIT question');
  assert.ok(pausedStudent.deviceOverflow<=3&&pausedStudent.mainOverflow<=3,
   'the compact 440x780 response fits without sideways scroll');
  await t.locator('#orbitStudentText').fill('Invite someone new to join.');
  assert.match(await t.locator('#orbitCharCount').innerText(),/27\s*\/\s*500/);
  assert.equal(await t.locator('#sendOrbitBtn').isDisabled(),true,
   'the teacher pause cannot be bypassed with the relocated button');
  assert.equal(await t.evaluate(()=>!!state.activityRun.orbitResponses['Student 01']),false);
  await t.evaluate(()=>{
   // The native screen can be regenerated on incoming class updates.
   renderPublic();SIOrbitPolish.enhance();
  });
  assert.equal(await t.locator('#orbitStudentText').inputValue(),'Invite someone new to join.',
   'unsent ORBIT ideas are retained across classroom redraws');
  await t.evaluate(()=>{state.activityRun.orbitPaused=false;renderPublic();SIOrbitPolish.enhance()});
  assert.equal(await t.locator('#orbitStudentText').inputValue(),'Invite someone new to join.',
   'teacher resuming transmissions does not erase a student draft');
  assert.equal(await t.locator('#sendOrbitBtn').isEnabled(),true);
  const layout=await t.evaluate(()=>{
   const field=document.querySelector('#orbitStudentText').getBoundingClientRect();
   const button=document.querySelector('#sendOrbitBtn').getBoundingClientRect();
   return {field:Math.round(field.width),button:Math.round(button.width),
    buttonHeight:Math.round(button.height),below:button.top>=field.bottom};
  });
  assert.ok(layout.buttonHeight>=48&&layout.button>=layout.field-3&&layout.below);
  await t.locator('#sendOrbitBtn').click();
  await t.waitForFunction(()=>state.activityRun.orbitResponses['Student 01']?.text==='Invite someone new to join.');
  await t.waitForFunction(()=>document.querySelector('#studentContent .si-orbit-student-sent'));
  const sent=await t.evaluate(()=>{
   SIOrbitPolish.enhance();
   const card=document.querySelector('#studentContent .si-orbit-student-sent');
   return {title:card?.querySelector('h2')?.textContent,
    idea:card?.querySelector('.si-orbit-own-idea')?.textContent,
    status:card?.querySelector('.si-orbit-student-confirm b')?.textContent,
    buttonCount:card?.querySelectorAll('#sendOrbitBtn').length,
    zone:getComputedStyle(document.querySelector('.student-control-zone')).display,
    responses:Object.keys(state.activityRun.orbitResponses).length};
  });
  assert.deepEqual(sent,{title:'Idea sent!',idea:'Invite someone new to join.',
   status:'Your idea is on its way.',buttonCount:0,zone:'none',responses:24},
   'native one-response locking becomes a compact, accessible confirmation');
  await t.setViewportSize({width:390,height:740});
  const narrow=await t.evaluate(()=>{
   const device=document.querySelector('#student .device'),
    card=document.querySelector('#studentContent .si-orbit-student');
   return {deviceOverflow:device.scrollWidth-device.clientWidth,
    cardOverflow:card.scrollWidth-card.clientWidth,
    cardWidth:Math.round(card.getBoundingClientRect().width)};
  });
  assert.ok(narrow.deviceOverflow<=3&&narrow.cardOverflow<=3,
   'the sent confirmation stays inside the iPhone companion');
  // A teacher follow-up is a fresh run; an older student's draft must not
  // prefill the new prompt or allow duplicate submissions from the old round.
  await t.evaluate(()=>{
   state.activityRun.runToken='orbit-4h-follow-up-test';
   state.activityRun.orbitRound=2;
   state.activityRun.orbitConfig.prompt='What else could we try?';
   delete state.activityRun.orbitResponses['Student 01'];
   renderPublic();SIOrbitPolish.enhance();
  });
  assert.equal(await t.locator('#orbitStudentText').inputValue(),'');
  assert.equal(await t.locator('#sendOrbitBtn').isDisabled(),true);
  assert.equal(await t.locator('#studentContent .si-orbit-student-round').innerText(),'ROUND 2');
  await t.evaluate(()=>{
   document.body.classList.remove('role-student');
   document.querySelector('#student')?.classList.remove('active');
   document.querySelector('#teacher')?.classList.add('active');
   state.selectedStudent='';
   state.activityRun=null;
  });
  await t.setViewportSize({width:1400,height:920});
  console.log('ORBIT Phase 4H compact student layout, drafts, pause, native submit and follow-up PASSED',
   JSON.stringify({pausedStudent,layout,sent,narrow}));
  const sctx=await browser.newContext({viewport:{width:1180,height:760}});
  const shared=await sctx.newPage();
  shared.on('pageerror',e=>errors.push('shared '+String(e)));
  await shared.goto(BASE+'/?role=shared',{waitUntil:'domcontentloaded',timeout:40000});
  await shared.waitForFunction(()=>window.SIOrbitPolish&&typeof orbitSharedMarkup==='function');
  // Phase 4B: only genuinely new transmissions fly in. An existing
  // response restored in a different run must not replay its arrival.
  const orbitEntrances=await shared.evaluate(()=>{
   const run={runToken:'orbit-browser-arrival-test',phase:'running',
    orbitConfig:{prompt:'How can we help?',anonymous:true},
    orbitResponses:{},orbitPaused:false,orbitRevealCrew:false};
   orbitSharedMarkup(run,true); // Seed empty round.
   run.orbitResponses['Student One']={text:'Invite everyone',at:101};
   const first=document.createElement('div');
   first.innerHTML=orbitSharedMarkup(run,true);
   const incoming=first.querySelector('.orbit-new-arrival');
   const arrival={isSatellite:incoming?.classList.contains('orbit-satellite'),
    anonymous:!first.innerHTML.includes('Student One'),
    enterX:incoming?.style.getPropertyValue('--orb-enter-x').trim()};
   const restored={...run,runToken:'orbit-browser-restored-round'};
   const restoredMarkup=orbitSharedMarkup(restored,true);
   const spotlight={...restored,orbitSpotlight:'Student One'};
   const focus=document.createElement('div');
   focus.innerHTML=orbitSharedMarkup(spotlight,true);
   const panel=focus.querySelector('.orbit-spotlight-broadcast');
   return {arrival,restoredArrival:restoredMarkup.includes('orbit-new-arrival'),
    focus:!!panel,focusMotion:panel?.classList.contains('orbit-focus-new'),
    focusedText:panel?.querySelector('.quote')?.textContent,
    identityHidden:!focus.innerHTML.includes('Student One'),
    rings:panel?.querySelectorAll('.orbit-focus-rings i').length};
  });
  assert.equal(orbitEntrances.arrival.isSatellite,true,'new student idea enters as a satellite');
  assert.equal(orbitEntrances.arrival.anonymous,true);
  assert.equal(orbitEntrances.arrival.enterX,'125%');
  assert.equal(orbitEntrances.restoredArrival,false,'existing response never replays as a new idea');
  assert.equal(orbitEntrances.focus,true);
  assert.equal(orbitEntrances.focusMotion,true);
  assert.equal(orbitEntrances.identityHidden,true,'spotlight cannot reveal anonymous identity');
  assert.match(orbitEntrances.focusedText,/Invite everyone/);
  assert.equal(orbitEntrances.rings,3);
  await shared.evaluate(()=>{
   const people=Array.from({length:24},(_,i)=>'Student '+String(i+1).padStart(2,'0'));
   state.students=people.map(n=>({n,offline:false}));
   const orbitResponses={};
   people.forEach((n,i)=>orbitResponses[n]={text:'Idea '+String(i+1).padStart(2,'0')+' - Learn from the whole crew.',at:Date.now()});
   const run={activityId:'orbit-game',phase:'running',orbitConfig:{prompt:'How can we help one another?',anonymous:true},
    orbitResponses,orbitRevealCrew:false,orbitPaused:false};
   const mount=document.createElement('div');mount.id='siOrbitTestStage';
   mount.innerHTML=orbitSharedMarkup(run,true);
   document.querySelector('#shared').append(mount);
  });
  const ambience=await shared.evaluate(()=>{
   const mount=document.querySelector('#siOrbitTestStage');
   const sky=mount.querySelector('.orbit-cosmic-atmosphere');
   const comet=mount.querySelector('.orbit-shooting-star');
   return {constellations:sky?.querySelectorAll('.orbit-constellation-cluster').length,
    hidden:sky?.getAttribute('aria-hidden'),
    pointer:getComputedStyle(sky).pointerEvents,
    motion:getComputedStyle(comet).animationName};
  });
  assert.equal(ambience.constellations,2);
  assert.equal(ambience.hidden,'true');
  assert.equal(ambience.pointer,'none');
  assert.match(ambience.motion,/orbitDeepComet/);
  await shared.emulateMedia({reducedMotion:'reduce'});
  const reduced=await shared.evaluate(()=>{
   const sky=document.querySelector('#siOrbitTestStage');
   return {comet:getComputedStyle(sky.querySelector('.orbit-shooting-star')).animationName,
    stars:getComputedStyle(sky.querySelector('.orbit-cosmic'),'::before').animationName,
    cluster:getComputedStyle(sky.querySelector('.orbit-constellation-cluster')).animationName};
  });
  assert.deepEqual(reduced,{comet:'none',stars:'none',cluster:'none'});
  await shared.emulateMedia({reducedMotion:'no-preference'});
  const geometry=await shared.evaluate(()=>{
   const stage=document.querySelector('#siOrbitTestStage .orbit-space'),gallery=stage.querySelector('.orbit-idea-gallery'),
    first=gallery.querySelector('.orbit-gallery-card'),second=first.nextElementSibling;
   const a=first.getBoundingClientRect(),b=second.getBoundingClientRect();
   const r=gallery.getBoundingClientRect();
   return {stageW:stage.clientWidth,cardCount:gallery.children.length,
    gridCols:getComputedStyle(gallery).gridTemplateColumns.split(' ').length,
    scrollHeight:gallery.scrollHeight,clientHeight:gallery.clientHeight,
    cardOverlap:!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top),
    lastInDOM:gallery.lastElementChild.textContent.includes('Idea 24'),
    viewportOverflow:document.documentElement.scrollWidth-innerWidth,screenWidth:r.width};
  });
  assert.equal(geometry.cardCount,24);
  assert.equal(geometry.lastInDOM,true);
  assert.equal(geometry.cardOverlap,false,'gallery cards must not overlap');
  assert.ok(geometry.scrollHeight>geometry.clientHeight,'class of 24 should scroll inside stage');
  assert.ok(geometry.viewportOverflow<=3,'shared screen fits viewport');
  const scroll=await shared.evaluate(()=>{
   const gallery=document.querySelector('#siOrbitTestStage .orbit-idea-gallery');
   gallery.scrollTop=gallery.scrollHeight;
   return {top:gallery.scrollTop,
    final:gallery.lastElementChild.getBoundingClientRect().bottom<=gallery.getBoundingClientRect().bottom+4};
  });
  assert.ok(scroll.top>0&&scroll.final,'final crew ideas become visible after scrolling');
  // Phase 4C: the public renderer must use the teacher's categories as
  // genuine solar systems without losing a single submission or identity rule.
  await shared.evaluate(()=>{
   document.querySelector('#siOrbitTestStage')?.remove();
   const names=Array.from({length:24},(_,i)=>'Student '+String(i+1).padStart(2,'0'));
   const responses={},assignments={};
   names.forEach((name,i)=>{
    responses[name]={text:i===23?'<img src=x onerror=alert(1)> Final idea':
      'Planet '+String(i+1).padStart(2,'0')+' · '+('Include everyone and share our ideas. '.repeat(i===2?12:1)),at:i+1};
    assignments[name]=i<9?'Life Skills':i<18?'Science':i===23?'Invalid category':'Unclustered';
   });
   const run={activityId:'orbit-game',phase:'running',runToken:'orbit-phase4c-fixture',
    orbitConfig:{prompt:'How should we collaborate?',anonymous:true},orbitResponses:responses,
    orbitClusters:['Life Skills','Science','Unclustered'],orbitAssignments:assignments,
    orbitRevealCrew:false,orbitPaused:false,orbitClusterView:true,orbitCompare:false,orbitSpotlight:null};
   const fixture=document.createElement('div');fixture.id='siOrbitSolarStage';
   fixture.innerHTML=orbitSharedMarkup(run,true);
   document.querySelector('#shared').append(fixture);
   window.__orbitSolarFixture=run;
  });
  const solar=await shared.evaluate(()=>{
   const mount=document.querySelector('#siOrbitSolarStage');
   const systems=[...mount.querySelectorAll('.orbit-solar-system')];
   const planets=[...mount.querySelectorAll('.orbit-solar-planet')];
   const grouping=systems.map(s=>({name:s.querySelector('h4')?.textContent,
    ideas:s.querySelectorAll('.orbit-solar-planet').length}));
   const empty=document.createElement('div');
   empty.innerHTML=orbitClusterMarkup({...window.__orbitSolarFixture,orbitResponses:{}},true);
   const revealed=document.createElement('div');
   revealed.innerHTML=orbitClusterMarkup({...window.__orbitSolarFixture,orbitRevealCrew:true},true);
   const stage=mount.querySelector('.orbit-solar-systems');
   const last=planets.at(-1)?.querySelector('p')?.textContent;
   const app=mount.querySelector('.orbit-public.orbit-cosmic');
   return {grouping,planets:planets.length,wordmark:app?.querySelector('.orbit-cosmic-wordmark')?.textContent,
    summary:stage?.querySelector('.orbit-solar-summary')?.textContent,
    noNames:!stage?.textContent?.includes('Student 01'),
    revealed:revealed.querySelector('.orbit-solar-idea strong')?.textContent,
    escaped:mount.querySelectorAll('.orbit-solar-idea img').length===0,
    last,empty:!!empty.querySelector('.orbit-solar-empty'),
    grid:getComputedStyle(stage).display,
    firstCard:getComputedStyle(planets[0]).display,
    ownScroll:getComputedStyle(stage).overflowY,
    gradient:getComputedStyle(systems[0]).backgroundImage,
    overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.deepEqual(solar.grouping,[{name:'Life Skills',ideas:9},{name:'Science',ideas:9},
   {name:'Unclustered',ideas:6}],'native groups and unmatched responses remain intact');
  assert.equal(solar.planets,24,'all 24 submissions are present in their teacher group');
  assert.match(solar.wordmark,/ORBIT/);
  assert.match(solar.summary,/3 SOLAR SYSTEMS/);
  assert.equal(solar.noNames,true,'anonymous names are hidden in every solar system');
  assert.equal(solar.revealed,'Student 01','teacher reveal still exposes identities when enabled');
  assert.equal(solar.escaped,true,'idea text cannot inject image or script markup');
  assert.match(solar.last,/Final idea/);
  assert.equal(solar.empty,true,'empty clustered round has a waiting message');
  assert.equal(solar.grid,'grid');
  assert.equal(solar.firstCard,'flex');
  assert.equal(solar.ownScroll,'auto');
  assert.match(solar.gradient,/gradient/);
  assert.ok(solar.overflow<=3,'projector solar systems stay within viewport');
  // Phase 4D: solar artwork uses actual category order and hides its
  // orbital decoration from assistive technology; typography remains native.
  const planetarium=await shared.evaluate(()=>{
   const root=document.querySelector('#siOrbitSolarStage');
   const systems=[...root.querySelectorAll('.orbit-solar-system')];
   const first=systems[0],track=first.querySelector('.orbit-solar-track');
   const orbital=track.querySelector('.orbit-solar-path-a');
   const ringBox=orbital.getBoundingClientRect(),trackBox=track.getBoundingClientRect();
   const motion=getComputedStyle(orbital);
   const moon=first.querySelector('.orbit-solar-moon');
   const planet=getComputedStyle(moon).backgroundImage;
   const count=systems.reduce((n,sys)=>n+sys.querySelectorAll('.orbit-solar-planet').length,0);
   return {
    ids:systems.map(s=>s.querySelector('.orbit-solar-system-id')?.textContent),
    systems:systems.length,orbitalPaths:root.querySelectorAll('.orbit-solar-path').length,
    orbitalBodies:root.querySelectorAll('.orbit-solar-path b').length,
    solarCores:root.querySelectorAll('.orbit-solar-center-star').length,
    sunGlyphs:root.querySelectorAll('.orbit-solar-sun-glyph').length,
    decoratedHidden:track.getAttribute('aria-hidden'),
    moonGlyphs:root.querySelectorAll('.orbit-solar-moon-glyph').length,
    count,orbitMotion:motion.animationName,orbitSeconds:motion.animationDuration,
    orbitCentered:Math.abs((ringBox.left+ringBox.right)/2-(trackBox.left+trackBox.right)/2)<18&&
      Math.abs((ringBox.top+ringBox.bottom)/2-(trackBox.top+trackBox.bottom)/2)<18,
    surface:planet.includes('radial-gradient')
   };
  });
  assert.deepEqual(planetarium.ids,['SYSTEM 01','SYSTEM 02','SYSTEM 03']);
  assert.deepEqual([planetarium.systems,planetarium.orbitalPaths,
   planetarium.orbitalBodies,planetarium.solarCores,planetarium.sunGlyphs,
   planetarium.moonGlyphs,planetarium.count],[3,9,9,3,3,24,24]);
  assert.equal(planetarium.decoratedHidden,'true');
  assert.match(planetarium.orbitMotion,/orbit-solar-path-spin/);
  assert.equal(planetarium.orbitCentered,true,'animated orbital markers stay centered in system header');
  assert.equal(planetarium.surface,true,'mini planets use shaded planetary textures');
  const oneArrival=await shared.evaluate(()=>{
   const run={activityId:'orbit-game',phase:'running',runToken:'orbit-4d-new-signal',
    orbitConfig:{prompt:'What do we share?',anonymous:true},
    orbitResponses:{},orbitClusters:['Teamwork'],orbitAssignments:{},
    orbitClusterView:true,orbitRevealCrew:false,orbitSpotlight:null,orbitCompare:false};
   orbitClusterMarkup(run,true); // seeds the empty round without a replay
   run.orbitResponses['Pilot One']={text:'We listen carefully',at:1000};
   run.orbitAssignments['Pilot One']='Teamwork';
   const first=document.createElement('div');
   first.innerHTML=orbitClusterMarkup(run,true);
   const newPlanet=first.querySelector('.orbit-solar-planet.orbit-new-arrival');
   const firstNameHidden=!first.textContent.includes('Pilot One');
   const second=document.createElement('div');
   second.innerHTML=orbitClusterMarkup({...run,runToken:'orbit-4d-restored'},true);
   const original=first.querySelector('.orbit-solar-idea p')?.textContent;
   return {firstAnimated:!!newPlanet,firstNameHidden,original,
    restoredAnimated:!!second.querySelector('.orbit-solar-planet.orbit-new-arrival')};
  });
  assert.deepEqual(oneArrival,{firstAnimated:true,firstNameHidden:true,
   original:'We listen carefully',restoredAnimated:false},
   'new student planets enter once; restored responses never replay or expose names');
  await shared.setViewportSize({width:490,height:810});
  const mobileSolar=await shared.evaluate(()=>{
   const wrap=document.querySelector('#siOrbitSolarStage .orbit-solar-systems');
   return {columns:getComputedStyle(wrap).gridTemplateColumns.split(' ').length,
    width:wrap.clientWidth,overflow:wrap.scrollWidth-wrap.clientWidth,
    retained:wrap.querySelectorAll('.orbit-solar-planet').length};
  });
  assert.equal(mobileSolar.columns,1,'compact projector stacks its solar systems');
  assert.equal(mobileSolar.retained,24);
  assert.ok(mobileSolar.overflow<=3,'all compact solar planets fit without sideways scrolling');
  await shared.emulateMedia({reducedMotion:'reduce'});
  const noSolarMotion=await shared.evaluate(()=>getComputedStyle(
   document.querySelector('#siOrbitSolarStage .orbit-solar-system')).animationName);
  assert.equal(noSolarMotion,'none','solar arrival respects reduced-motion setting');
  await shared.emulateMedia({reducedMotion:'no-preference'});
  await shared.setViewportSize({width:1180,height:760});
  await shared.evaluate(()=>{document.querySelector('#siOrbitSolarStage')?.remove();delete window.__orbitSolarFixture});
  console.log('ORBIT Phase 4C solar systems, privacy, 24 planets and responsive layout PASSED',
   JSON.stringify({solar,mobileSolar}));
  await sctx.close();
  assert.deepEqual(errors,[],'no unexpected Orbit browser errors');
  console.log('ORBIT setup + 24 students + privacy + projector scroll + teacher status PASSED',
   JSON.stringify({frame,geometry,scroll}));
 }finally{
  await teacherContext.close();await browser.close();
 }
})().catch(err=>{console.error(err);process.exitCode=1});
