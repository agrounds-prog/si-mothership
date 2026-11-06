/* Isolated Visual Randomizer smoke: protected Railway library, choices, and projector. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1440,height:920}});
 const page=await context.newPage();
 const exceptions=[];page.on("pageerror",e=>exceptions.push(String(e)));
 try{
  assert.equal((await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  const route=await page.goto(BASE+"/randomizer",{waitUntil:"domcontentloaded"});
  assert.equal(route.status(),200);
  await page.waitForSelector("#choices .choice");
  assert.equal(await page.locator("#choices .choice").count(),4);
  for(const style of ["wheel","slot","lottery","cards"]){
   await page.locator('#styles [data-style="'+style+'"]').click();
   assert.equal(await page.locator('#styles [data-style="'+style+'"]').getAttribute("class"),"active");
  }
  await page.locator('#styles [data-style="wheel"]').click();
  await page.locator("#weighted").check();
  await page.locator('[data-weight="0"]').fill("5");
  await page.locator('[data-weight="0"]').dispatchEvent("change");
  await page.locator("#removeWinner").check();
  await page.locator("#title").fill("Class Decision Test");
  await page.locator("#savedName").fill("Randomizer Regression");
  await page.locator("#save").click();
  await page.waitForFunction(()=>document.querySelector("#storageStatus").textContent.includes("Railway teacher library"));
  const storage=(await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.randomizerSets.v1"];
  assert.ok(storage,"Randomizer presets must be persisted to Railway");
  const sets=JSON.parse(storage);
  assert.equal(sets["Randomizer Regression"].choices[0].weight,5);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#library").selectOption("Randomizer Regression");
  await page.locator("#load").click();
  assert.equal(await page.locator("#title").inputValue(),"Class Decision Test");
  assert.equal(await page.locator("#weighted").isChecked(),true);
  const display=await context.newPage();
  await display.goto(BASE+"/randomizer?display=1",{waitUntil:"domcontentloaded"});
  await page.locator('#styles [data-style="slot"]').click();
  await page.waitForTimeout(300);
  assert.equal(await display.locator("#reel").isVisible(),true);
  await page.locator("#spin").click();
  await page.waitForFunction(()=>document.querySelector("#result").textContent.includes("✦ "),null,{timeout:8000});
  const chosen=await page.locator("#result").textContent();
  await page.waitForFunction(()=>document.querySelector("#result").textContent.includes("✦ "),null,{timeout:2500});
  assert.equal(await display.locator("#result").textContent(),chosen);
  assert.equal(await page.locator("#choices .choice").count(),4,"Removing winner should preserve saved choices");
  assert.match(await page.locator("#status").textContent(),/3 available choices/);
  assert.deepEqual(exceptions,[]);
  console.log("PASS Randomizer saved sets, weighting, visual modes, selection and separate display");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
