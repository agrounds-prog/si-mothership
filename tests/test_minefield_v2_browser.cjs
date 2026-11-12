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
  const diagnostic=await teacher.evaluate(()=>{
   const panel=document.querySelector('#activityControllerPanel');
   const board=document.querySelector('.minefield-controller-body .minefield-board');
   const tile=board?.querySelector('.minefield-cell');
   const css=tile&&getComputedStyle(tile);
   const ancestors=[];let e=panel;for(let i=0;i<6&&e;i++,e=e.parentElement){
    const r=e.getBoundingClientRect(),c=getComputedStyle(e);
    ancestors.push({tag:e.tagName,id:e.id,cls:String(e.className).slice(0,120),
      rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
      position:c.position,overflow:c.overflow,transform:c.transform});
   }
   const b=board?.getBoundingClientRect(),t=tile?.getBoundingClientRect();
   return {viewport:[innerWidth,innerHeight],ancestors,
     board:b&&[b.x,b.y,b.width,b.height],
     tile:t&&[t.x,t.y,t.width,t.height],
     tileCSS:css&&{display:css.display,opacity:css.opacity,visibility:css.visibility,
      backgroundImage:css.backgroundImage,backgroundColor:css.backgroundColor,
      color:css.color,zIndex:css.zIndex,fontSize:css.fontSize},
     tileCount:board?.querySelectorAll('.minefield-cell').length};
  });
  console.log('MINEFIELD_TEACHER_GEOMETRY',JSON.stringify(diagnostic));
  const pixelInfo=await projector.evaluate(async()=>{
   const uri='/assets/minefield-v2/tiles/tile_hidden.png';
   const img=new Image();img.src=uri;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
   const cx=canvas.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);
   const pixels=cx.getImageData(0,0,canvas.width,canvas.height).data;
   let opaque=0,nonTransparent=0,bright=0,maxAlpha=0;
   for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3];if(a>0)nonTransparent++;
      if(a>200)opaque++;if(a>0&&(pixels[i]+pixels[i+1]+pixels[i+2])>270)bright++;
      maxAlpha=Math.max(maxAlpha,a);}
   return {size:[canvas.width,canvas.height],count:pixels.length/4,
     nonTransparent,opaque,bright,maxAlpha,center:[...cx.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data]};
  });
  // Regression: decorative rail used to cover the entire board because its
  // opaque center painted at z=3 after all 36 tiles. Verify both actual views
  // put the rail behind the tiles, not merely that image URLs resolve.
  for(const [page,boardSelector] of [[teacher,'.minefield-controller-body .minefield-board'],
     [projector,'#sharedContent .minefield-board']]){
    const vis=await page.evaluate(selector=>{
     const board=document.querySelector(selector),tile=board?.querySelector('.minefield-cell.simple');
     const rail=board&&getComputedStyle(board,'::after'),cell=tile&&getComputedStyle(tile);
     const rect=tile?.getBoundingClientRect();
     return {railZ:rail?.zIndex,tileZ:cell?.zIndex,cellDisplay:cell?.display,
       tile:[rect?.width,rect?.height],background:cell?.backgroundImage};
    },boardSelector);
    assert.ok(Number(vis.railZ)<Number(vis.tileZ),'Frame must be painted behind the clickable squares: '+JSON.stringify(vis));
    assert.ok(vis.tile[0]>25&&vis.tile[1]>25,'Square should not collapse or disappear: '+JSON.stringify(vis));
    assert.match(vis.background,/tile_hidden\.png/);
  }
  // The floating teacher dock can be resized without forcing the Minefield
  // mission panel off the right edge of the dock.
  const compact=await teacher.evaluate(async()=>{
    const dock=document.querySelector('#siLiveControlDock');
    const body=document.querySelector('.minefield-controller-body');
    const checks=[];
    for(const width of [600,440]){
      dock.style.width=width+'px';
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const cols=getComputedStyle(body).gridTemplateColumns.split(' ').length;
      const parent=body.getBoundingClientRect();
      const board=body.querySelector('.minefield-board').getBoundingClientRect();
      const action=body.querySelector('.minefield-safety button')?.getBoundingClientRect();
      checks.push({width,cols,boardRight:board.right,bodyRight:parent.right,
        actionRight:action?.right,actionWidth:action?.width});
    }
    dock.style.width='';
    return checks;
  });
  for(const check of compact){
    assert.equal(check.cols,1,'Narrow teacher dock must stack Minefield controls: '+JSON.stringify(check));
    assert.ok(check.boardRight<=check.bodyRight+2,'Board clips beyond dock: '+JSON.stringify(check));
    assert.ok(check.actionWidth>=90&&check.actionRight<=check.bodyRight+2,
      'Mission action clipped or too small: '+JSON.stringify(check));
  }
  // Projector and secondary-screen mirror must use the same illustrated
  // score, narrator and risk legend — without affecting hidden-tile privacy.
  const mirrorStyles=await projector.evaluate(()=>{
    const original=document.querySelector('#sharedContent .minefield-public.mf-v2');
    const mirror=document.createElement('section');
    mirror.id='mirrorContent';
    mirror.style.cssText='position:absolute;top:-5000px;left:0;width:1200px';
    mirror.appendChild(original.cloneNode(true));
    document.body.appendChild(mirror);
    const selectors=['.mf-score-chip','.minefield-narrator','.minefield-simple-legend'];
    const found=selectors.map(selector=>{
      const source=original.querySelector(selector);
      const copy=mirror.querySelector(selector);
      if(!source||!copy)return {selector,missing:true};
      const a=getComputedStyle(source),b=getComputedStyle(copy);
      return {selector,sourceBg:a.backgroundImage,mirrorBg:b.backgroundImage,
        sourceColor:a.color,mirrorColor:b.color};
    });
    mirror.remove();
    return found;
  });
  for(const entry of mirrorStyles){
    assert.ok(!entry.missing,'Missing Minefield mirror surface: '+entry.selector);
    assert.equal(entry.mirrorBg,entry.sourceBg,'Mirror artwork differs: '+entry.selector);
    assert.equal(entry.mirrorColor,entry.sourceColor,'Mirror text contrast differs: '+entry.selector);
  }
  // The scanner must not display a hidden-sector value before any reveals.
  await projector.waitForSelector('#sharedContent .mf-reveal-intel',{timeout:10000});
  assert.equal(await projector.locator('#sharedContent .mf-reveal-intel[data-mf-sector]').count(),0);
  assert.equal(await projector.locator('#sharedContent .mf-last-safe').count(),0);
  assert.equal((await context.request.get(BASE+'/minefield-feedback.js')).status(),200);
  console.log('MINEFIELD_TILE_IMAGE_PIXELS',JSON.stringify(pixelInfo));
  assert.equal(await projector.locator('#sharedContent .minefield-cell').count(),36);
  assert.equal(await projector.locator('#sharedContent .mf-score-chip').count(),1);
  assert.match(await projector.locator('#sharedContent .mf-score-chip').innerText(),/CREW SCORE/);
  assert.match(await teacher.locator('.mf-controller-score').innerText(),/CREW SCORE/);
  const safeTiles=await projector.locator('#sharedContent .minefield-cell.unknown').count();
  assert.equal(safeTiles,36);
  // No hidden mine positions, point values, or risk-tier colors in the DOM.
  const hiddenClasses=await projector.locator('#sharedContent .minefield-cell.unknown').evaluateAll(nodes=>nodes.map(n=>n.className));
  assert.ok(hiddenClasses.every(c=>{const tokens=c.split(/\s+/);return !c.includes('mf-value-')&&!tokens.includes('mine')&&!tokens.includes('health');}),hiddenClasses.join('\n'));
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
  const sector=String.fromCharCode(65+outcome.position[1])+(outcome.position[0]+1);
  await projector.waitForFunction(({sector,points})=>{
    const intel=document.querySelector('#sharedContent .mf-reveal-intel');
    return intel?.dataset.mfSector===sector&&Number(intel.dataset.mfPoints)===points;
  },{sector,points:outcome.points},{timeout:10000});
  assert.equal(await projector.locator('#sharedContent .minefield-cell.mf-last-safe.revealed.empty').count(),1);
  assert.equal(await projector.locator('#sharedContent .minefield-cell.unknown.mf-last-safe').count(),0);
  assert.match(await projector.locator('#sharedContent .mf-intel-detail').innerText(),/adjacent to/);
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
