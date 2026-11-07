const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const context=await browser.newContext({viewport:{width:1580,height:900}});
  const page=await context.newPage(),display=await context.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));display.on("pageerror",e=>errors.push(e.message));
  await page.goto(BASE+"/randomizer");
  await display.goto(BASE+"/randomizer?display=1");
  await page.locator('#styles [data-style="wheel"]').click();
  const studio=await page.locator("#studio").boundingBox();
  const stage=await page.locator("#stage").boundingBox();
  assert.ok(studio.width>=360,"Studio must have room for the illustrated choices");
  assert.ok(stage.width>studio.width,"Stage should dominate the desktop layout");
  assert.ok(await page.locator("#wheel").isVisible());
  await page.locator('#styles [data-style="slot"]').click();
  assert.equal(await page.locator("#reel .reel-lane").count(),3);
  await display.waitForFunction(()=>document.querySelectorAll("#reel .reel-lane").length===3);
  await page.locator("#spin").click();
  await page.waitForFunction(()=>document.querySelector("#stage").classList.contains("has-winner"),null,{timeout:8500});
  await display.waitForFunction(v=>document.querySelector("#result").textContent===v,await page.locator("#result").textContent(),{timeout:4000});
  assert.equal(await page.locator("#reel .reel-label").textContent(),(await page.locator("#result").textContent()).replace(/^✦\s*/,""));
  assert.equal(await page.locator(".winner-ribbon").isVisible(),true,"Slot winner should have the gold winner ribbon");
  assert.equal(await display.locator(".winner-ribbon").isVisible(),true,"Shared display should show winner ribbon");
  await page.locator('#styles [data-style="lottery"]').click();
  assert.equal(await page.locator("#lotteryShowpiece").isVisible(),false,"Winner ball must be hidden until lottery selection");
  await page.locator("#spin").click();
  await page.waitForFunction(()=>document.querySelector("#stage").classList.contains("has-winner"),null,{timeout:8500});
  assert.equal(await page.locator("#lotteryShowpiece").isVisible(),true);
  assert.equal(await page.locator("#lotteryShowpieceText").textContent(),(await page.locator("#result").textContent()).replace(/^✦\s*/,""));
  await display.waitForFunction(()=>!document.querySelector("#lotteryShowpiece").hidden,null,{timeout:3500});
  assert.equal(await display.locator("#lotteryShowpieceText").textContent(),await page.locator("#lotteryShowpieceText").textContent());

  // During the next lottery draw, preserve the actual ball elements while
  // selections update repeatedly in the separate Zoom window.
  await page.locator("#spin").click();
  await display.waitForFunction(()=>document.querySelector("#stage").classList.contains("is-spinning"),null,{timeout:3000});
  await display.evaluate(()=>{window.__lotteryFirstBall=document.querySelector("#lottery .ball")});
  await page.waitForTimeout(480);
  assert.equal(await display.evaluate(()=>window.__lotteryFirstBall===document.querySelector("#lottery .ball")),true,"Broadcasts must not reconstruct lottery balls");
  await page.waitForFunction(()=>document.querySelector("#stage").classList.contains("has-winner"),null,{timeout:8500});

  await page.locator('#styles [data-style="cards"]').click();
  assert.equal(await page.locator("#cards.cards-fan .card").count(),4);
  assert.equal(await display.locator("#cards.cards-fan .card").count(),4);
  assert.deepEqual(errors,[]);
  console.log("PASS Randomizer concept layout, 3 live slot reels, fan cards, and projected winner");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
