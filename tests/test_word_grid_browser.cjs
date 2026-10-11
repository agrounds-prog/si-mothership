/* WORD GRID Chromium integration — isolated local Mothership only. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const base=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.stack||e)));
 page.on("dialog",async d=>{if(d.type()==="prompt")await d.accept(/number of the saved game/i.test(d.message())?"1":"Word Grid Browser Test");else await d.accept()});
 try{
  const auth=await page.request.post(base+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(auth.status(),200,"isolated local test teacher login");
  let response=await page.goto(base+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.WordGrid&&typeof render==="function",{timeout:15000});
  assert.equal(await page.locator('script[src^="/word-grid.js"]').count(),1);
  assert.equal(await page.locator('link[href^="/word-grid.css"]').count(),1);
  // User-path regression: open the game from the actual Activities button
  // and Word Grid's library card, not by injecting the target state.
  await page.evaluate(()=>{state.activityRun=null;state.ended=false;state.screen="classroom";state.activeApp=null;render()});
  await page.locator('#teacherControlBar [data-control="activities"]').click();
  const wordCard=page.locator('#activitiesPanel .activity-catalog-grid .real-app-card').filter({
    has:page.locator('h3',{hasText:'WORD GRID'})
  });
  await wordCard.locator('[data-open-app]').first().click();
  await page.waitForSelector("#wgPlayers",{timeout:10000});
  assert.equal(await page.locator('#activitiesPanel #wgStart').isVisible(),true,
    'Word Grid opens through the actual Activity Library card');
  for(const width of [1440,768,430]){
    await page.setViewportSize({width,height:960});
    await page.waitForTimeout(160);
    const geometry=await page.evaluate(()=>{
      const modal=document.getElementById('activitiesPanel'),
        grid=document.getElementById('activityGrid'),setup=grid.querySelector('.wg-setup');
      const mr=modal.getBoundingClientRect(),gr=grid.getBoundingClientRect(),sr=setup.getBoundingClientRect();
      return {modalWidth:mr.width,gridWidth:gr.width,setupWidth:sr.width,
        rightOverhang:Math.round(sr.right-mr.right),
        gridOverflow:grid.scrollWidth-grid.clientWidth,
        columns:getComputedStyle(setup.querySelector('.wg-setup-columns')).gridTemplateColumns,
        modalVisible:!modal.classList.contains('hidden')};
    });
    console.log(JSON.stringify({test:"Word Grid Activities layout",width,...geometry}));
    assert.ok(geometry.modalVisible);
    assert.ok(geometry.setupWidth<=geometry.gridWidth+3,'Setup fits its Activity workspace');
    assert.ok(geometry.rightOverhang<=3,'Setup stays inside the Activities modal');
    assert.ok(geometry.gridOverflow<=3,'No horizontal Activities stretching');
    if(width<=768)assert.equal(geometry.columns.split(' ').filter(Boolean).length,1,
      'Single-column Word Grid setup on narrow displays');
  }
  await page.setViewportSize({width:1440,height:960});
  const defaults=await page.evaluate(()=>{
    const tmp=document.createElement('div');tmp.innerHTML=WordGrid.setupHTML(['Solo Student']);
    return tmp.querySelector('#wgPlayers').value;
  });
  assert.match(defaults,/Crew Alpha\nCrew Beta/,'one-student roster defaults to two playable teams');
  await page.locator("#wgPlayers").fill("Solo Student");
  await page.locator("#wgStart").click();
  assert.match(await page.locator("#wgSetupStatus").textContent(),/two to four/i,
    'invalid player count shows a visible correction');
  assert.equal(await page.evaluate(()=>!!state.activityRun),false);
  await page.locator("#wgPlayers").fill("Crew Alpha\nCrew Beta");
  await page.locator("#wgTeacherMode").selectOption("team-0");
  await page.locator("#wgStart").click();
  await page.waitForFunction(()=>!!state.activityRun?.wordGrid&&!!document.querySelector("#activityControllerPanel .wg-board"),{timeout:12000});
  assert.equal(await page.locator("#activityControllerPanel .wg-cell").count(),225);
  assert.equal(await page.locator("#mirrorContent .wg-cell").count(),225);
  assert.equal(await page.locator("#sharedContent .wg-cell").count(),225);
  const state1=await page.evaluate(()=>({players:state.activityRun.wordGrid.players.map(p=>p.name),live:state.activityRun.phase,
   root:activeActivity()?.type}));
  assert.deepEqual(state1.players,["Crew Alpha","Crew Beta"]);
  assert.equal(state1.root,"word-grid");assert.equal(state1.live,"running");
  assert.equal(await page.evaluate(()=>state.activityRun.wordGrid.teacherSeat),0,"Teacher joins team 1");
  // Test assignment controls on the real Mission Control game panel.
  await page.evaluate(()=>{
    const g=state.activityRun.wordGrid;
    WordGrid.assignStudent(g,"Alex",0);WordGrid.assignStudent(g,"Sam",1);render();
  });
  await page.locator('#activityControllerPanel [data-wg-assign="Alex"]').selectOption("1");
  assert.equal(await page.evaluate(()=>state.activityRun.wordGrid.assignments.Alex),1);
  await page.locator('#activityControllerPanel [data-wg-assign="Alex"]').selectOption("0");
  const hintTile=await page.evaluate(()=>state.activityRun.wordGrid.players[0].rack[0].id);
  await page.locator(`#activityControllerPanel [data-wg-tile="${hintTile}"]`).click();
  await page.locator(`#activityControllerPanel [data-wg-action="hint"]`).click();
  const hintState=await page.evaluate(()=>({
    teacherHint:!!state.activityRun.wordGrid.hint,
    activeStudent:WordGrid.studentHTML(state.activityRun.wordGrid,{n:"Alex"}).includes("wg-highlight"),
    otherStudent:WordGrid.studentHTML(state.activityRun.wordGrid,{n:"Sam"}).includes("wg-highlight"),
    publicHint:document.getElementById("sharedContent").innerHTML.includes("wg-highlight")
  }));
  assert.deepEqual(hintState,{teacherHint:true,activeStudent:true,otherStudent:false,publicHint:false});
  await page.locator('#activityControllerPanel [data-wg-action="hint"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun.wordGrid.hint),null);
  await page.evaluate(()=>{
   const W=window.WordGrid,g=state.activityRun.wordGrid;
   g.players[0].rack=[..."CATDOGS"].map((letter,i)=>({id:"fixture-"+i,letter,value:W.POINTS[letter],blank:false}));
   render();
  });
  for(const [letter,slot] of [["C",111],["A",112],["T",113]]){
   const id=await page.evaluate(l=>{
    return state.activityRun.wordGrid.players[0].rack.find(t=>t.letter===l)?.id;
   },letter);
   await page.locator('#activityControllerPanel [data-wg-tile="'+id+'"]').click();
   await page.locator('#activityControllerPanel [data-wg-cell="'+slot+'"]').click();
  }
  assert.match(await page.locator("#activityControllerPanel .wg-validation").textContent(),/CAT/);
  assert.match(await page.locator("#activityControllerPanel .wg-validation").textContent(),/10 POINTS/);
  await page.locator('#activityControllerPanel [data-wg-action="commit"]').click();
  const after=await page.evaluate(()=>({score:state.activityRun.wordGrid.players[0].score,
   turn:state.activityRun.wordGrid.turn,words:state.activityRun.wordGrid.lastMove.words.map(x=>x.text),
   publicBoard:document.querySelectorAll("#sharedContent .wg-cell.occupied").length}));
  assert.equal(after.score,10);assert.equal(after.turn,1);assert.deepEqual(after.words,["CAT"]);
  assert.equal(after.publicBoard,3);
  await page.locator('#activityControllerPanel [data-wg-action="save"]').click();
  const saved=await page.evaluate(()=>WordGrid.readLibrary());
  assert.ok(saved.some(x=>x.name==="Word Grid Browser Test"),"Game saved in teacher library");
  await page.locator('#activityControllerPanel [data-wg-action="undo"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun.wordGrid.board.filter(Boolean).length),0);
  assert.equal(await page.evaluate(()=>state.activityRun.wordGrid.turn),0);
  // Restore stored, already scored game to the current classroom.
  await page.locator('#activityControllerPanel [data-wg-action="load"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun.wordGrid.board.filter(Boolean).length),3);
  assert.equal(await page.evaluate(()=>state.activityRun.wordGrid.players[0].score),10);
  const projection=await page.evaluate(()=>WordGrid.studentHTML(state.activityRun.wordGrid));
  assert.match(projection,/wg-student/);
  assert.doesNotMatch(projection,/data-wg-action/);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.WordGrid,{timeout:12000});
  assert.ok(await page.evaluate(()=>WordGrid.readLibrary().some(x=>x.name==="Word Grid Browser Test")),"Teacher game survives app reload");
  assert.deepEqual(errors,[],"No runtime page errors");
  console.log(JSON.stringify({test:"Word Grid browser activity integration / rack / legal tile / score / shared / save / undo / restore",...after,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
