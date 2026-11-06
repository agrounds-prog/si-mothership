const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const teacher=await context.newPage(),display=await context.newPage();
  const errors=[];
  teacher.on("pageerror",e=>errors.push(String(e)));
  display.on("pageerror",e=>errors.push(String(e)));
  assert.equal((await teacher.goto(BASE+"/randomizer")).status(),200);
  assert.equal((await display.goto(BASE+"/randomizer?display=1")).status(),200);
  assert.equal(await teacher.locator("#soundEnabled").isChecked(),false);
  assert.equal(await teacher.locator("#celebrateEnabled").isChecked(),true);
  await teacher.locator("#spin").click();
  await teacher.waitForFunction(()=>document.querySelector("#stage")?.classList.contains("has-winner"),null,{timeout:9000});
  assert.ok(await teacher.locator("#celebration .spark").count()>=20);
  await display.waitForFunction(()=>document.querySelector("#celebration .spark")?.isConnected,null,{timeout:3000});
  assert.equal(await display.locator("#result").textContent(),await teacher.locator("#result").textContent());
  await teacher.locator("#celebrateEnabled").uncheck();
  assert.equal(await teacher.locator("#celebration .spark").count(),0);
  await teacher.locator("#spin").click();
  await teacher.waitForFunction(()=>document.querySelector("#stage")?.classList.contains("has-winner"),null,{timeout:9000});
  assert.equal(await teacher.locator("#celebration .spark").count(),0,"Celebrations must be optional");
  assert.equal(await display.locator("#celebration .spark").count(),0,"Shared effects must respect teacher preference");
  const quiet=await browser.newContext({reducedMotion:"reduce"});
  const quietPage=await quiet.newPage();
  await quietPage.goto(BASE+"/randomizer");
  await quietPage.locator("#spin").click();
  await quietPage.waitForFunction(()=>document.querySelector("#stage")?.classList.contains("has-winner"),null,{timeout:9000});
  assert.equal(await quietPage.locator("#celebration .spark").count(),0,"Reduced-motion users should not see celebration");
  assert.deepEqual(errors,[]);
  console.log("PASS Randomizer muted-by-default audio, optional synced confetti, reduced-motion preference");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
