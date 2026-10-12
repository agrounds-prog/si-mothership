/* DOMINOES end-to-end Chromium smoke in isolated local Mothership. */
const assert=require("node:assert/strict"),{chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.stack||e)));
 page.on("dialog",async d=>{if(d.type()==="prompt")await d.accept("DOMINOES Classroom Test");else await d.accept()});
 try{
  const auth=await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(auth.status(),200);
  const response=await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.Dominoes&&typeof render==="function",{timeout:15000});
  assert.equal(await page.locator('script[src^="/dominoes.js"]').count(),1);
  assert.equal(await page.locator('link[href^="/dominoes.css"]').count(),1);
  await page.evaluate(()=>{state.activityRun=null;state.ended=false;state.screen="classroom";state.activeApp=null;render()});
  await page.locator('#teacherControlBar [data-control="activities"]').click();
  const card=page.locator('#activitiesPanel .activity-catalog-grid .real-app-card').filter({has:page.locator("h3",{hasText:"DOMINOES"})});
  await card.locator("[data-open-app]").first().click();
  await page.waitForSelector("#dmStart",{timeout:12000});
  for(const width of [1440,768,430]){
   await page.setViewportSize({width,height:960});await page.waitForTimeout(100);
   const bounds=await page.evaluate(()=>{
    const modal=document.getElementById("activitiesPanel"),grid=document.getElementById("activityGrid"),s=grid.querySelector(".dm-setup");
    const mr=modal.getBoundingClientRect(),sr=s.getBoundingClientRect();
    return {overflow:grid.scrollWidth-grid.clientWidth,width:sr.width,modal:mr.width,right:Math.round(sr.right-mr.right)};
   });
   console.log(JSON.stringify({test:"DOMINOES Activities layout",width,...bounds}));
   assert.ok(bounds.right<=4&&bounds.overflow<=4,"DOMINOES does not stretch Activities workspace");
  }
  await page.setViewportSize({width:1440,height:960});
  await page.locator("#dmStart").click();
  await page.waitForFunction(()=>!!state.activityRun?.dominoes&&!!document.querySelector("#activityControllerPanel .dm-teacher"),{timeout:12000});
  const initial=await page.evaluate(()=>({type:activeActivity()?.type,players:state.activityRun.dominoes.players,hand:state.activityRun.dominoes.hands[state.activityRun.dominoes.players[0]].length,tiles:state.activityRun.dominoes.chain.length,bag:state.activityRun.dominoes.bag.length}));
  assert.equal(initial.type,"dominoes");assert.equal(initial.players.length,2);
  assert.equal(initial.hand,7);assert.equal(initial.tiles,0);assert.equal(initial.bag,14);
  assert.ok(await page.locator("#sharedContent .dm-chain").count());
  // Use a deterministic double to verify orientation independent of the random deal.
  const first=await page.locator("#activityControllerPanel [data-dm-select]").first().getAttribute("data-dm-select");
  await page.evaluate(id=>{const g=state.activityRun.dominoes,t=g.hands[g.players[g.turn]].find(t=>t.id===id);t.b=t.a;render()},first);
  await page.locator('#activityControllerPanel [data-dm-select="'+first+'"]').click();
  assert.equal(await page.locator('#activityControllerPanel [data-dm-teacher="rotate"]').count(),1);
  await page.locator('#activityControllerPanel [data-dm-teacher="rotate"]').click();
  assert.equal(await page.locator('#activityControllerPanel .dm-teacher-pick.selected.dm-double-vertical').count(),1);
  assert.equal(await page.locator('#activityControllerPanel [data-dm-teacher="right"]').count(),0);
  assert.equal(await page.locator('#activityControllerPanel [data-dm-teacher="left"]').count(),0);
  await page.locator('#activityControllerPanel [data-dm-teacher="first"]').click();
  const played=await page.evaluate(()=>{
   const g=state.activityRun.dominoes;
   return {size:g.chain.length,turn:g.turn,last:g.lastPlay?.tileId,shared:document.querySelector("#sharedContent .dm-chain")?.textContent.length,
    showPrivate:document.querySelector("#sharedContent")?.innerHTML.includes("data-dm-play")};
  });
  assert.equal(played.size,1);assert.equal(played.turn,1);assert.equal(played.last,first);
  assert.equal(played.showPrivate,false);
  assert.equal(await page.evaluate(()=>state.activityRun.dominoes.chain[0].vertical),true);
  assert.equal(await page.locator("#sharedContent .dm-played-tile .dm-tile.double.vertical").count(),1);
  assert.equal(await page.locator('#activityControllerPanel [data-dm-teacher="first"]').count(),0);
  assert.equal(await page.locator('#activityControllerPanel [data-dm-teacher="left"]').count(),1);
  assert.equal(await page.locator('#activityControllerPanel [data-dm-teacher="right"]').count(),1);
  const views=await page.evaluate(()=>{
    const g=state.activityRun.dominoes;return {
      active:Dominoes.studentHTML(g,{n:g.players[g.turn]}).includes("data-dm-play"),
      spectator:Dominoes.studentHTML(g,{n:"Audience"}).includes("data-dm-play"),
      projected:Dominoes.tableHTML(g,true).includes("dm-player-list")
    }
  });
  assert.deepEqual(views,{active:true,spectator:false,projected:true});
  await page.locator('#activityControllerPanel [data-dm-teacher="save"]').click();
  assert.equal(await page.evaluate(()=>Dominoes.library().length>0),true);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.Dominoes,{timeout:12000});
  assert.equal(await page.evaluate(()=>Dominoes.library().length>0),true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({test:"DOMINOES actual Activity Library launch, board play, projected privacy and persistence",initial,played,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
