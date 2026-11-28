/* Isolated browser regression for Pixel Reveal collection and focus effects. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 try{
  assert.equal((await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>networkHydrated&&window.SIPixelCollection);
  await page.evaluate(()=>{state.activityRun=null;state.screen="classroom";state.activeApp="pixel";renderActivities()});
  await page.locator(".pixel-collection").waitFor();
  const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement("canvas");c.width=80;c.height=50;const x=c.getContext("2d");x.fillStyle="red";x.fillRect(0,0,40,50);x.fillStyle="blue";x.fillRect(40,0,40,50);return c.toDataURL().split(",")[1]}),"base64");
  await page.locator(".pixel-collection input[type=file]").setInputFiles([{name:"first.png",mimeType:"image/png",buffer:png},{name:"second.png",mimeType:"image/png",buffer:png}]);
  await page.waitForFunction(()=>state.pixelDraft.mysteryImages.length===3&&document.querySelectorAll(".pixel-collection-card").length===3);
  await page.locator("#pixelAnswer").fill("First");
  await page.locator(".pixel-collection-card").nth(2).click();
  await page.locator("#pixelAnswer").fill("Second");
  await page.locator(".pixel-collection-card").nth(1).click();
  assert.equal(await page.locator("#pixelAnswer").inputValue(),"First");
  await page.locator('[data-pixel-style="focus"]').click();
  await page.locator("#pixelDistortionStyle").waitFor();
  assert.equal(await page.locator("#pixelDistortionStyle option").count(),6);
  await page.locator("#pixelDistortionStyle").selectOption("random");
  await page.locator("#savePixelBtn").click();
  await page.waitForFunction(()=>loadSavedPixels().some(x=>x.mysteryImages?.length===3&&x.distortionStyle==="random"));
  await page.locator("#launchPixelBtn").click();
  await page.waitForFunction(()=>state.activityRun?.pixelConfig?.answer==="First");
  assert.ok(["mosaic","blur","glitch","shuffle","mixed"].includes(await page.evaluate(()=>state.activityRun.pixelConfig.distortionStyle)));
  await page.locator("#startActivityBtn").click();
  await page.locator(".pixel-live-collection").waitFor();
  await page.locator('[data-pixel-reveal="1"]').waitFor();
  assert.equal(await page.locator('[data-pixel-reveal="1"]').innerText(),"Reveal More");
  assert.equal(await page.locator('[data-pixel-reveal="3"]').isVisible(),false);
  await page.locator('[data-pixel-reveal="1"]').click();
  assert.equal(await page.evaluate(()=>state.activityRun.pixelFocusStage),1);
  await page.locator(".pixel-live-collection button").last().click();
  await page.waitForFunction(()=>state.activityRun.pixelConfig.answer==="Second"&&state.activityRun.pixelFocusStage===0);
  for(const effect of ["mosaic","blur","glitch","shuffle","mixed"]){
   await page.evaluate(effect=>{state.activityRun.pixelConfig.distortionStyle=effect;state.activityRun.pixelFocusStage=0;state.activityRun.pixelRevealAll=false;render()},effect);
   await page.waitForFunction(effect=>document.querySelector("[data-pixel-focus-canvas]")?.__pixelFocusKey?.endsWith("|"+effect+"|0"),effect);
   await page.locator("#pixelRevealAllBtn").click();
   await page.waitForFunction(()=>state.activityRun.pixelRevealAll&&document.querySelector("[data-pixel-focus-canvas]")?.__pixelFocusKey?.endsWith("|10"));
  }
  assert.deepEqual(errors,[]);
  console.log("Pixel Reveal collection and distortion regression passed");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
