const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
const assets=["lottery_machine_shell.png","lottery_glass_overlay.png","lottery_ball_blank.png",
 "slot_machine_shell.png","slot_reel_window_overlay.png","wheel_housing.png",
 "mystery_card_back.png","mystery_card_face_blank.png","cards_stage_base.png","winner_plaque_blank.png"];
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  for(const viewport of [{width:1440,height:900},{width:1366,height:768}]){
   const context=await browser.newContext({viewport});
   const page=await context.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.goto(BASE+"/randomizer",{waitUntil:"domcontentloaded"});
   assert.equal(await page.locator("#stage").getAttribute("data-graphics"),"v9");
   assert.equal(await page.locator(".v4-stamp").textContent(),"GRAPHICS V9");
   assert.equal(await page.locator("link[href='/randomizer-textures-v9.css?v=9']").count(),1);
   const css=await page.request.get(BASE+"/randomizer-textures-v9.css?v=9");
   assert.equal(css.status(),200,"Textured stylesheet not delivered");
   assert.match(await css.text(),/independent textured image layers/);
   for(const name of assets){
    const response=await page.request.get(BASE+"/randomizer-textured/"+name+"?v=9");
    assert.equal(response.status(),200,"Missing uploaded V3 art: "+name);
    assert.match(response.headers()["content-type"]||"",/image\/png/);
    assert.ok((await response.body()).byteLength>20000,"Suspiciously small art file "+name);
   }
   const style=async selector=>page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundImage);
   const pseudo=async kind=>page.locator(".visual").evaluate((el,part)=>getComputedStyle(el,part).backgroundImage,kind);
   await page.locator('#styles [data-style="lottery"]').click();
   assert.match(await pseudo("::before"),/lottery_machine_shell.png/);
   assert.match(await pseudo("::after"),/lottery_glass_overlay.png/);
   assert.match(await style("#lottery .ball"),/lottery_ball_blank.png/);
   assert.equal(await page.locator("#lottery .ball").count(),4);
   const gl=await page.locator("#lottery").evaluate(el=>({backdrop:getComputedStyle(el).backdropFilter,
     background:getComputedStyle(el).backgroundImage}));
   assert.ok(!gl.backdrop.includes("blur"),"No large frosted globe should hide the artwork");
   await page.locator('#styles [data-style="slot"]').click();
   assert.match(await pseudo("::before"),/slot_machine_shell.png/);
   assert.match(await pseudo("::after"),/slot_reel_window_overlay.png/);
   assert.equal(await page.locator("#reel .reel-lane").count(),3);
   await page.locator('#styles [data-style="wheel"]').click();
   assert.match(await page.locator(".wheel-art-frame img").getAttribute("src"),/wheel_housing.png/);
   assert.ok(await page.locator("#wheel").isVisible());
   await page.locator('#styles [data-style="cards"]').click();
   assert.equal(await page.locator("#cards .card").count(),4);
   assert.match(await pseudo("::before"),/cards_stage_base.png/);
   assert.match(await style("#cards .card"),/mystery_card_back.png/);
   const layout=await page.evaluate(()=>{
    const arena=document.querySelector(".arena").getBoundingClientRect();
    const rects=[...document.querySelectorAll("#cards.cards-fan .card")].map(el=>el.getBoundingClientRect());
    return {offset:Math.abs((Math.min(...rects.map(r=>r.left))+Math.max(...rects.map(r=>r.right)))/2
      -(arena.left+arena.right)/2),width:arena.width};
   });
   assert.ok(layout.offset<layout.width*.12,"Card fan must be centered: "+JSON.stringify(layout));
   assert.match(await style("#result"),/winner_plaque_blank.png/);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log("PASS: all ten independent V3 PNGs, dynamic choices and textured four-mode scenes");
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
