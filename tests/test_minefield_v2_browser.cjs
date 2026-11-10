/* Isolated teacher + real projector Minefield v2 art and scoring browser check. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(BASE))
 throw Error('Minefield v2 browser regression must run against an isolated localhost server');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1600,height:1000}});
 const teacher=await context.newPage(),projector=await context.newPage(),errors=[];
 for(const page of [teacher,projector])page.on('pageerror',e=>errors.push(String(e)));
 try{
  const login=await context.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}});
  assert.equal(login.status(),200,'teacher login');
  await teacher.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
  await teacher.waitForFunction(()=>networkHydrated===true&&
    networkSocket?.readyState===WebSocket.OPEN&&typeof createMinefield==='function',
    null,{timeout:20000});
  const sid=await teacher.evaluate(()=>STUDENT_SESSION_ID);
  await teacher.evaluate(()=>{
   state.activityRun={activityId:'minefield-game',runToken:'minefield-illustrated-risk-check',
    phase:'running',minefieldMode:'crew',minefieldLength:'standard',mf:createMinefield('standard'),
    responses:{},latestNarration:'CREW READY: Earn up to 5 points next to mines.',narrationLog:[]};
   state.screen='activity';
   render();
  });
  await teacher.waitForSelector('#activityControllerPanel .minefield-controller-body.mf-v2');
  await projector.goto(BASE+'/?role=shared&sid='+encodeURIComponent(sid),{waitUntil:'domcontentloaded'});
  await projector.waitForSelector('#sharedContent .minefield-public.mf-v2',{timeout:20000});
  assert.equal(await projector.locator('#sharedContent .minefield-cell').count(),36);
  assert.equal(await projector.locator('#sharedContent .mf-score-chip').count(),1);
  assert.match(await projector.locator('#sharedContent .mf-score-chip').innerText(),/CREW SCORE/);
  assert.match(await teacher.locator('.mf-controller-score').innerText(),/CREW SCORE/);
  const safeTiles=await projector.locator('#sharedContent .minefield-cell.unknown').count();
  assert.equal(safeTiles,36);
  // No hidden mine positions, point values, or risk-tier colors in the DOM.
  const hiddenClasses=await projector.locator('#sharedContent .minefield-cell.unknown').evaluateAll(nodes=>nodes.map(n=>n.className));
  assert.ok(hiddenClasses.every(c=>!c.includes('mf-value-')&&!c.includes('mine')&&!c.includes('health')),hiddenClasses.join('\n'));
  const image=await projector.locator('#sharedContent .minefield-cell.unknown').first().evaluate(el=>getComputedStyle(el).backgroundImage);
  assert.match(image,/minefield-v2\/tiles\/tile_hidden\.png/);
  const bg=await projector.locator('#sharedContent .minefield-public.mf-v2').evaluate(el=>getComputedStyle(el).backgroundImage);
  assert.match(bg,/background_mission_16x9\.png/);
  for(const path of ['tiles/tile_safe_5pt.png','tiles/tile_mine.png','backgrounds/background_mission_16x9.png',
                      'frames/frame_board_outer.png']){
    const res=await context.request.get(BASE+'/assets/minefield-v2/'+path);
    assert.equal(res.status(),200,path);
    assert.match(res.headers()['content-type'],/image\/png/);
  }
  assert.equal((await context.request.get(BASE+'/assets/minefield-v2/tiles/not-a-tile.png')).status(),404);
  assert.equal((await context.request.get(BASE+'/minefield-v2.css')).status(),200);
  // Reveal a real safe square: the new artwork, score, narrator and all
  // clients must agree on the resulting point tier.
  const outcome=await teacher.evaluate(()=>{
   const mf=state.activityRun.mf,t=mf.board.flat().find(t=>t.type==='clear'&&!t.revealed);
   const points=minefieldTilePoints(mf,t);
   mf.pending={r:t.r,c:t.c};resolveMinefieldMove();
   return {points,score:mf.score,position:[t.r,t.c],turn:mf.turn};
  });
  assert.ok(outcome.points>=1&&outcome.points<=5);
  assert.equal(outcome.score,outcome.points);
  await projector.waitForFunction(points=>state.activityRun?.mf?.score===points,
    outcome.points,{timeout:12000});
  const projected=await projector.evaluate(()=>{
   const tile=document.querySelector('.minefield-cell.revealed.empty');
   const score=document.querySelector('#sharedContent .mf-score-chip');
   return {cls:tile?.className,text:tile?.textContent,score:score?.textContent||'',
     bg:tile?getComputedStyle(tile).backgroundImage:''};
  });
  assert.ok(projected.cls.includes('mf-value-'+outcome.points),JSON.stringify(projected));
  assert.match(projected.bg,new RegExp('tile_safe_'+outcome.points+'pt'));
  assert.ok(projected.text.includes(String(outcome.points)));
  assert.ok(projected.score.includes(String(outcome.score)));
  await teacher.waitForFunction(points=>document.querySelector('.mf-controller-score')?.textContent.includes(String(points)),outcome.points);
  for(const width of [1600,960,720,440]){
   await projector.setViewportSize({width,height:850});
   const geometry=await projector.evaluate(()=>{
    const board=document.querySelector('#sharedContent .minefield-board');
    const root=document.querySelector('#sharedContent .minefield-public.mf-v2');
    const b=board.getBoundingClientRect(),r=root.getBoundingClientRect();
    return {w:innerWidth,rootLeft:r.left,rootRight:r.right,
     boardWidth:b.width,boardLeft:b.left,boardRight:b.right};
   });
   assert.ok(geometry.rootRight<=width+12&&geometry.rootLeft>=-12,
     'Projector Minefield outer art overflows at '+width+': '+JSON.stringify(geometry));
   assert.ok(geometry.boardRight<=width+12&&geometry.boardLeft>=-12,
     'Board art overflows at '+width+': '+JSON.stringify(geometry));
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: Minefield illustrated graphics, live 1–5 point rewards, teacher/projector sync, and responsive widths');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
