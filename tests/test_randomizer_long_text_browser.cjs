const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  const page=await context.newPage(),projector=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(String(e)));projector.on("pageerror",e=>errors.push(String(e)));
  await page.goto(BASE+"/randomizer");
  await projector.goto(BASE+"/randomizer?display=1");
  const long="A thoughtful classroom suggestion that includes several words and lots of extra detail to discuss";
  await page.locator("#choices [data-text='0']").fill(long);
  await page.locator("#choices [data-text='0']").dispatchEvent("change");
  await page.locator("#choices [data-text='1']").fill(long);
  await page.locator("#choices [data-text='1']").dispatchEvent("change");
  await page.locator("#weighted").check();
  await page.locator("#animationSpeed").selectOption("quick");
  await page.locator('#styles [data-style="lottery"]').click();
  await page.locator("#spin").click();
  await page.waitForFunction(()=>document.querySelector("#stage").classList.contains("has-winner"),null,{timeout:7000});
  const result=await page.locator("#result").textContent();
  assert.ok(result.length>30);
  assert.equal(await page.locator("#result").getAttribute("data-length"),"extra");
  assert.equal(await page.locator("#lotteryShowpieceText").textContent(),"★");
  await projector.waitForFunction(x=>document.querySelector("#result").textContent===x,result,{timeout:4000});
  assert.equal(await projector.locator("#lotteryShowpieceText").textContent(),"★");
  const resultBox=await projector.locator("#result").boundingBox(),stage=await projector.locator("#stage").boundingBox();
  assert.ok(resultBox.x>=stage.x&&resultBox.x+resultBox.width<=stage.x+stage.width+2);
  assert.deepEqual(errors,[]);
  console.log("PASS full long choice preserved on winner plaque, illustrated lottery ball and Zoom");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
