const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const context=await browser.newContext({viewport:{width:1366,height:850}});
  const teacher=await context.newPage(),projector=await context.newPage();
  const errors=[];
  teacher.on("pageerror",e=>errors.push(String(e)));
  projector.on("pageerror",e=>errors.push(String(e)));
  assert.equal((await teacher.goto(BASE+"/randomizer")).status(),200);
  assert.equal((await projector.goto(BASE+"/randomizer?display=1")).status(),200);
  await teacher.locator("#bulk").fill(Array.from({length:26},(_,i)=>"Discussion option "+String(i+1).padStart(2,"0")+" — full sentence").join("\n"));
  await teacher.locator("#addBulk").click();
  await teacher.locator("#weighted").check();
  assert.equal(await teacher.locator("#wheelLegend").getAttribute("hidden"),null);
  assert.equal(await teacher.locator("#wheelLegend .legend-item").count(),30);
  await projector.waitForFunction(()=>document.querySelectorAll("#wheelLegend .legend-item").length===30);
  assert.equal(await projector.locator("#wheelLegend").getAttribute("hidden"),null);
  assert.equal(await teacher.locator("#wheelLegend .legend-item").last().textContent(),await projector.locator("#wheelLegend .legend-item").last().textContent());
  const wheel=await projector.locator("#wheel").boundingBox();
  assert.ok(wheel.width>200&&wheel.height>200,JSON.stringify(wheel));
  await teacher.locator("#spin").click();
  await teacher.waitForFunction(()=>document.querySelector("#stage")?.classList.contains("has-winner"),null,{timeout:8500});
  const selected=await teacher.locator("#result").textContent();
  await projector.waitForFunction(expected=>document.querySelector("#result").textContent===expected,selected,{timeout:4000});
  assert.equal(await teacher.locator("#wheelLegend .legend-item.is-winner").count(),1);
  assert.equal(await projector.locator("#wheelLegend .legend-item.is-winner").count(),1);
  assert.deepEqual(errors,[]);
  console.log("PASS large weighted wheel numbers, full-choice legend and projector winner sync");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
