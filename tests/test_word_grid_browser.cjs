/* WORD GRID Chromium integration — isolated local Mothership only. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const base=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.stack||e)));
 page.on("dialog",async d=>{if(d.type()==="prompt")await d.accept("Word Grid Browser Test");else await d.accept()});
 try{
  const auth=await page.request.post(base+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(auth.status(),200,"isolated local test teacher login");
  let response=await page.goto(base+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.WordGrid&&typeof render==="function",{timeout:15000});
  assert.equal(await page.locator('script[src^="/word-grid.js"]').count(),1);
  assert.equal(await page.locator('link[href^="/word-grid.css"]').count(),1);
  await page.evaluate(()=>{state.activityRun=null;state.ended=false;state.screen="activities";state.activeApp="word-grid";render()});
  await page.waitForSelector("#wgPlayers",{timeout:10000});
  await page.locator("#wgPlayers").fill("Crew Alpha\nCrew Beta");
  await page.locator("#wgStart").click();
  await page.waitForFunction(()=>!!state.activityRun?.wordGrid&&!!document.querySelector("#activityControllerPanel .wg-board"),{timeout:12000});
  assert.equal(await page.locator("#activityControllerPanel .wg-cell").count(),225);
  assert.equal(await page.locator("#mirrorContent .wg-cell").count(),225);
  assert.equal(await page.locator("#sharedContent .wg-cell").count(),225);
  const state1=await page.evaluate(()=>({players:state.activityRun.wordGrid.players.map(p=>p.name),live:state.activityRun.phase,
   root:activeActivity()?.type}));
  assert.deepEqual(state1.players,["Crew Alpha","Crew Beta"]);
  assert.equal(state1.root,"word-grid");assert.equal(state1.live,"running");
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
