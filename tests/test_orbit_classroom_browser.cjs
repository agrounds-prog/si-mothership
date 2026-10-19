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
