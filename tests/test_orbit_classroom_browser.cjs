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
   info.revealedNames=named.querySelector('.orbit-sat-author')?.textContent;
   mount.remove();return info;
  });
  assert.equal(cosmic.satellites,10);
  assert.equal(cosmic.galaxies,0);
  assert.equal(cosmic.hideNames,true,'anonymous Orbit keeps identity off all satellites');
  assert.equal(cosmic.revealedNames,'Student 01');
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
  await sctx.close();
  assert.deepEqual(errors,[],'no unexpected Orbit browser errors');
  console.log('ORBIT setup + 24 students + privacy + projector scroll + teacher status PASSED',
   JSON.stringify({frame,geometry,scroll}));
 }finally{
  await teacherContext.close();await browser.close();
 }
})().catch(err=>{console.error(err);process.exitCode=1});
