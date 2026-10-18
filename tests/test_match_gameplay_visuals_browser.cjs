/* Phase 3A MATCH visual integration: real teacher + separate projector.
   Runs only against an isolated localhost classroom. Existing game semantics
   stay owned by the native application; this checks visual readability. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8885';
if(!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE))
 throw Error('MATCH visual test must use isolated localhost');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const teacherCtx=await browser.newContext({viewport:{width:1440,height:900}});
 const sharedCtx=await browser.newContext({viewport:{width:1920,height:1080}});
 const teacher=await teacherCtx.newPage(),shared=await sharedCtx.newPage();
 const errors=[];for(const [name,page] of [['teacher',teacher],['shared',shared]])
  page.on('pageerror',e=>errors.push(name+': '+String(e.stack||e)));
 try{
  assert.equal((await teacherCtx.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await teacher.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await teacher.waitForFunction(()=>typeof renderActivities==='function'&&networkHydrated===true&&
   typeof matchBuilderWire==='function',null,{timeout:25000});
  await teacher.evaluate(()=>{
   state.screen='activities';state.activeApp='match';state.activityRun=null;
   state.assigningSlot=null;
   state.students=[{n:'Alex',offline:false},{n:'Blair',offline:false}];
   render();
  });
  await teacher.locator('.mcb-shell').waitFor();
  await teacher.locator('[data-mcb-mode="quick"]').click();
  await teacher.locator('#matchSetName').fill('Phase 3A MATCH Visual Layout');
  await teacher.locator('#mcbQuickPairs').fill([
   'Cat | Kitten','Dog | Puppy','Cow | Calf','Sheep | Lamb',
   'Horse | Foal','Duck | Duckling','Goat | Kid','Pig | Piglet'
  ].join('\n'));
  await teacher.waitForFunction(()=>document.querySelector('#mcbPairCount')?.textContent==='8');
  await teacher.locator('#matchMode').selectOption('individual');
  const sid=await teacher.evaluate(()=>window.__SI_SESSION_ID__);
  assert.ok(sid,'isolated classroom session identifier');
  await shared.goto(BASE+'/?role=shared&sid='+encodeURIComponent(sid),{waitUntil:'domcontentloaded',timeout:40000});
  await teacher.locator('#mcbSaveLaunch').click();
  await teacher.waitForFunction(()=>state.activityRun?.activityId==='match-game',null,{timeout:15000});
  await teacher.evaluate(()=>startOrResumeActivityRun());
  await teacher.waitForFunction(()=>state.activityRun?.phase==='running',null,{timeout:15000});
  await shared.waitForFunction(()=>document.querySelector('.ma-present .ma-grid')?.children.length===16,
   null,{timeout:18000});
  const teacherStyle=await teacher.evaluate(()=>{
   const panel=document.querySelector('#activityControllerPanel'),grid=panel?.querySelector('.match-control-grid');
   const buttons=[...grid.querySelectorAll('button')];
   const boxes=buttons.map(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height}});
   const card=panel.querySelector('.match-teacher-card');
   const row=panel.querySelector('.match-current-player');
   return {columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    actions:buttons.length,controls:boxes,
    scoreRows:panel.querySelectorAll('.match-teacher-score>div').length,
    background:getComputedStyle(card).backgroundImage,
    playerFont:parseFloat(getComputedStyle(row).fontSize),
    preview:!!document.querySelector('.ma-compact')};
  });
  assert.equal(teacherStyle.columns,2,'MATCH command deck has two readable button columns');
  assert.ok(teacherStyle.actions>=8&&teacherStyle.controls.every(x=>x.w>95&&x.h>=49),
   'Teacher actions readable and tappable: '+JSON.stringify(teacherStyle));
  assert.ok(teacherStyle.scoreRows>=2&&teacherStyle.playerFont>=20);
  assert.match(teacherStyle.background,/gradient/);
  const layouts=[];
  for(const [width,height] of [[1920,1080],[1366,768],[880,720],[700,500]]){
   await shared.setViewportSize({width,height});
   const g=await shared.evaluate(()=>{
    const root=document.querySelector('.ma-present'),board=root.querySelector('.ma-board-surround'),
      cards=[...root.querySelectorAll('.ma-tile')],wrap=root.querySelector('.ma-board-wrap');
    const br=board.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
    const rr=root.getBoundingClientRect();
    return {viewport:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,
      board:{x:br.left,right:br.right,w:br.width,top:br.top,bottom:br.bottom},
      wrap:{top:wr.top,bottom:wr.bottom},
      root:{w:rr.width,h:rr.height,top:rr.top},
      cards:cards.map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})),
      navigator:!!root.querySelector('.ma-turn-identity'),
      progress:!!root.querySelector('.ma-progress-track'),
      score:!!root.querySelector('.ma-scoreboard'),
      border:getComputedStyle(board).borderTopColor,
      status:getComputedStyle(root.querySelector('.ma-signal')).display};
   });
   layouts.push({size:width+'x'+height,...g});
   assert.ok(g.overflow<=6,'No projector horizontal scroll '+width+': '+JSON.stringify(g));
   assert.equal(g.cards.length,16);
   assert.ok(g.cards.every(x=>x.w>=32&&x.h>=25),'Projected tiles stay visible '+width+': '+JSON.stringify(g));
   assert.ok(g.board.x>=-4&&g.board.right<=width+4);
   assert.ok(g.navigator&&g.progress&&g.score);
  }
  assert.deepEqual(errors,[],'No JavaScript errors during teacher and projector play');
  console.log('MATCH Phase 3A teacher controls + projected 16-card board PASS',
   JSON.stringify({teacher:teacherStyle,projectors:layouts.map(({size,overflow,board,cards})=>
    ({size,overflow,board,cards:cards.length,minTile:Math.min(...cards.map(x=>x.w))}))}));
 }finally{await teacherCtx.close();await sharedCtx.close();await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1});
