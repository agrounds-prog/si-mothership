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

  const artFiles=[
    "components/wheel_rim_overlay.svg","components/wheel_pointer.svg",
    "components/slot_machine_chassis.svg","components/lottery_machine_frame.svg",
    "components/mystery_card_back.svg","components/mystery_card_face_blank.svg",
    "components/winner_plaque_blank.svg","components/randomizer_app_icon.svg",
    "backgrounds/wheel_bridge_bg.webp","backgrounds/slot_bridge_bg.webp",
    "backgrounds/lottery_bridge_bg.webp","backgrounds/cards_bridge_bg.webp",
    "mode-thumbnails/wheel_mode_tile.webp","mode-thumbnails/slot_mode_tile.webp",
    "mode-thumbnails/lottery_mode_tile.webp","mode-thumbnails/cards_mode_tile.webp",
    "overlays/shared_display_hud.svg"
  ];
  for(const art of artFiles){
    const response=await page.request.get(BASE+"/randomizer-art/"+art);
    assert.equal(response.status(),200,"Missing art "+art);
    assert.ok((await response.body()).length>300,"Empty art "+art);
  }
  assert.equal(await page.locator("#wheelArtFrame img").count(),1);

  for(const style of ["wheel","slot","lottery","cards"]){
   await page.locator('#styles [data-style="'+style+'"]').click();
   assert.equal(await page.locator('#styles [data-style="'+style+'"]').getAttribute("class"),"active");
   assert.ok((await page.locator("#stage").evaluate(el=>getComputedStyle(el).backgroundImage)).includes(style+"_bridge_bg"));
  }
  await page.locator('#styles [data-style="wheel"]').click();
  await page.locator("#weighted").check();
  await page.locator('[data-weight="0"]').fill("5");
  await page.locator('[data-weight="0"]').dispatchEvent("change");
  await page.locator("#removeWinner").check();
  await page.locator("#title").fill("Class Decision Test");
  await page.locator("#savedName").fill("Randomizer Regression");
  await page.locator("#animationSpeed").selectOption("quick");
  await page.locator("#save").click();
  await page.waitForFunction(()=>document.querySelector("#storageStatus").textContent.includes("Railway teacher library"));
  const storage=(await (await page.request.get(BASE+"/api/storage")).json()).items["siMothership.randomizerSets.v1"];
  assert.ok(storage,"Randomizer presets must be persisted to Railway");
  const sets=JSON.parse(storage);
  assert.equal(sets["Randomizer Regression"].choices[0].weight,5);
  assert.equal(sets["Randomizer Regression"].speed,"quick");
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#library").selectOption("Randomizer Regression");
  await page.locator("#load").click();
  assert.equal(await page.locator("#title").inputValue(),"Class Decision Test");
  assert.equal(await page.locator("#weighted").isChecked(),true);
  assert.equal(await page.locator("#animationSpeed").inputValue(),"quick");
  const display=await context.newPage();
  await display.goto(BASE+"/randomizer?display=1",{waitUntil:"domcontentloaded"});
  assert.equal(await display.locator("#fullscreenBtn").isVisible(),true,"Zoom display needs fullscreen control");
  assert.equal(await page.locator("#fullscreenBtn").isVisible(),false,"Teacher view should not show projector fullscreen");
  await page.locator('#styles [data-style="slot"]').click();
  await page.waitForTimeout(300);
  assert.equal(await display.locator("#reel").isVisible(),true);
  await page.locator("#spin").click();
  await page.waitForFunction(()=>document.querySelector("#result").textContent.includes("✦ "),null,{timeout:8000});
  const chosen=await page.locator("#result").textContent();
  await page.waitForFunction(()=>document.querySelector("#result").textContent.includes("✦ "),null,{timeout:2500});
  assert.equal(await display.locator("#result").textContent(),chosen);
  assert.equal(await page.locator("#stage").evaluate(el=>el.classList.contains("has-winner")),true);
  assert.equal(await page.locator("#recent span").count(),1,"Recent winner should be visible");
  await display.waitForFunction(()=>document.querySelector("#recent span")?.textContent?.trim().length>0);
  assert.equal(await display.locator("#recent span").first().textContent(),await page.locator("#recent span").first().textContent());
  assert.equal(await display.locator("#stage").evaluate(el=>el.classList.contains("has-winner")),true);
  assert.equal(await page.locator("#choices .choice").count(),4,"Removing winner should preserve saved choices");
  assert.match(await page.locator("#status").textContent(),/3 available choices/);

  // Verify the other theatrical modes reveal the same selection on Zoom.
  for(const [mode,selector] of [["lottery","#lottery .ball.selected"],["cards","#cards .card.flipped"]]){
   await page.locator("#resetPool").click();
   await page.locator('#styles [data-style="'+mode+'"]').click();
   await page.locator("#spin").click();
   await page.waitForFunction(()=>document.querySelector("#stage").classList.contains("has-winner"),null,{timeout:8000});
   const result=await page.locator("#result").textContent();
   await display.waitForFunction(expected=>document.querySelector("#result").textContent===expected,result,{timeout:3000});
   assert.equal(await page.locator(selector).count(),1,mode+" should visually reveal one winning choice");
   assert.equal(await display.locator(selector).count(),1,mode+" must reveal the same visual in the projector");
   assert.equal(await display.locator("#result").textContent(),result);
  }
  await page.locator("#resetPool").click();
  await page.locator('#styles [data-style="wheel"]').click();
  assert.equal(await display.locator("#wheel").isVisible(),true);
  assert.ok((await display.locator("#wheel").boundingBox()).width>150);

  assert.deepEqual(exceptions,[]);
  console.log("PASS Randomizer saved sets, weighting, visual modes, selection and separate display");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
