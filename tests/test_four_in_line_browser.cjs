/* FOUR IN LINE — live Mission Control catalog / teacher / projector browser test */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const base=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e.stack||e)));
 page.on("dialog",d=>d.type()==="prompt"?d.accept("Four In Line Browser Test"):d.accept());
 try{
  const login=await page.request.post(base+"/api/teacher/login",{data:{key:"5030"}});
  assert.equal(login.status(),200);
  const response=await page.goto(base+"/?role=teacher",{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.FourLine&&!!window.__fourLineBridgeInstalled&&typeof render==="function",{timeout:12000});
  assert.equal(await page.locator('script[src^="/four-in-line.js"]').count(),1);
  assert.equal(await page.locator('link[href^="/four-in-line.css"]').count(),1);
  await page.evaluate(()=>{state.activityRun=null;state.ended=false;state.screen="classroom";state.activeApp=null;render()});
  await page.locator('#teacherControlBar [data-control="activities"]').click();
  const card=page.locator('#activitiesPanel .fil-library-card');
  assert.equal(await card.count(),1,"FOUR IN LINE appears in existing Activity Library");
  await card.locator('.fil-open').click();
  await page.waitForSelector("#filLaunch");
  assert.ok(await page.locator("#filSize").isVisible());
  await page.locator("#filMode").selectOption("teams");
  await page.locator("#filSize").selectOption("classic");
  await page.locator("#filOne").fill("Blue Crew");
  await page.locator("#filTwo").fill("Gold Crew");
  await page.locator("#filLaunch").click();
  await page.waitForFunction(()=>state.activityRun?.activityId==="four-in-line-game"&&!!document.querySelector("#activityControllerPanel .fil-board"));
  assert.equal(await page.locator("#activityControllerPanel .fil-cell").count(),42);
  assert.equal(await page.locator("#sharedContent .fil-cell").count(),42);
  assert.equal(await page.locator("#mirrorContent .fil-cell").count(),42);
  assert.equal(await page.locator("#sharedContent [data-fil-drop]").count(),0);
  for(const col of [0,1,0,1,0,1,0]){
   await page.locator('#activityControllerPanel [data-fil-drop="'+col+'"]').click();
  }
  const ended=await page.evaluate(()=>({g:state.activityRun.fourInLine,markup:document.querySelector("#sharedContent").innerHTML}));
  assert.equal(ended.g.status,"won");
  assert.equal(ended.g.winner,0);
  assert.equal(ended.g.winning.length,4);
  assert.match(ended.markup,/FOUR CONNECTED/);
  assert.equal(await page.locator("#sharedContent .fil-cell.win-line").count(),4);
  await page.locator('#activityControllerPanel [data-fil-action="undo"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun.fourInLine.status),"playing");
  await page.locator('#activityControllerPanel [data-fil-action="save"]').click();
  assert.equal(await page.evaluate(()=>FourLine.saved().some(x=>x.name==="Four In Line Browser Test")),true);
  for(const [width,height] of [[1280,720],[768,1024],[430,960]]){
    await page.setViewportSize({width,height});
    const geometry=await page.evaluate(()=>{
      const host=document.createElement("div");
      host.style.cssText="position:fixed;inset:0;overflow:auto;padding:8px;z-index:99999;background:#091729;box-sizing:border-box";
      host.innerHTML=FourLine.publicHTML(state.activityRun.fourInLine,true);document.body.appendChild(host);
      const panel=host.querySelector(".fil-public");
      const result={overflow:host.scrollWidth-host.clientWidth,
        panelWidth:Math.round(panel.getBoundingClientRect().width),
        columns:host.querySelectorAll(".fil-cell").length};
      host.remove();return result;
    });
    assert.ok(geometry.overflow<=5,JSON.stringify({width,...geometry}));
    assert.ok(geometry.panelWidth<=width,JSON.stringify({width,...geometry}));
    assert.equal(geometry.columns,42);
  }
  await page.setViewportSize({width:1440,height:960});
  await page.locator('#activityControllerPanel [data-fil-action="exit"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun),null);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.FourLine&&!!window.__fourLineBridgeInstalled,{timeout:15000});
  assert.equal(await page.evaluate(()=>FourLine.saved().some(x=>x.name==="Four In Line Browser Test")),true);
  assert.deepEqual(errors,[]);
  console.log("FOUR IN LINE browser gameplay, projector, responsive and saved games PASSED");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
