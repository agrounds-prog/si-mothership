const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(BASE+"/randomizer",{waitUntil:"domcontentloaded"});
  const sceneStyles=await page.request.get(BASE+"/randomizer-v4.css?v=6");
  assert.equal(sceneStyles.status(),200,"The V5 scene override must be served by Railway");
  assert.match(await sceneStyles.text(),/Randomizer V4/);
  assert.equal(await page.locator("#stage").getAttribute("data-graphics"),"v6");
  assert.equal(await page.locator(".v4-stamp").textContent(),"GRAPHICS V6");
  assert.equal(await page.locator("link[href='/randomizer-v4.css?v=6']").count(),1);

  for(const image of ["slot","lottery","cards","wheel"]){
   const r=await page.request.get(BASE+"/randomizer-concept/"+image+".png?v=3");
   assert.equal(r.status(),200,"Missing approved cinematic concept: "+image);
   assert.match(r.headers()["content-type"]||"",/image\/png/);
   assert.ok((await r.body()).byteLength>100000,"Unusually small cinematic art "+image);
  }
  for(const name of ["wheel_rim_overlay","wheel_pointer","slot_machine_chassis","lottery_machine_frame","lottery_ball_blank","mystery_card_back","mystery_card_face_blank","winner_plaque_blank","stage_pedestal_blank"]){
   const r=await page.request.get(BASE+"/randomizer-art/components/"+name+".png?v=3");
   assert.equal(r.status(),200,"Missing uploaded PNG asset: "+name);
  }
  for(const mode of ["slot","lottery","cards","wheel"]){
   await page.locator('#styles [data-style="'+mode+'"]').click();
   const selection=await page.locator("#stage").getAttribute("data-mode");
   assert.equal(selection,mode);
   const graphics=await page.locator("#stage").evaluate(node=>node.dataset.graphics);
   assert.equal(graphics,"v6");

  }
  await page.locator('#styles [data-style="cards"]').click();
  assert.equal(await page.locator("#cards .card").count(),4);
  assert.ok((await page.locator("#cards .card").first().evaluate(el=>getComputedStyle(el).backgroundImage)).includes("randomizer-concept/cards.png"));
  const alignment=await page.evaluate(()=>{
    const arena=document.querySelector(".arena").getBoundingClientRect();
    const cards=document.querySelector("#cards.cards-fan").getBoundingClientRect();
    const live=[...document.querySelectorAll("#cards.cards-fan .card")].map(x=>x.getBoundingClientRect());
    const left=Math.min(...live.map(x=>x.left)),right=Math.max(...live.map(x=>x.right));
    return {offset:Math.abs((left+right)/2-(arena.left+arena.right)/2),width:arena.width,cardsLeft:cards.left,arenaLeft:arena.left};
  });
  assert.ok(alignment.offset<alignment.width*.09,"Card fan must be visually centered: "+JSON.stringify(alignment));
  const cardsArt=await page.locator("#cards .card").first().evaluate(el=>getComputedStyle(el).backgroundImage);
  assert.ok(cardsArt.includes("/randomizer-concept/cards.png"),"V6 must use cinematic card artwork");
  await page.locator('#styles [data-style="lottery"]').click();
  const chamber=await page.locator("#lottery").evaluate(el=>({
   filter:getComputedStyle(el).backdropFilter,
   background:getComputedStyle(el).backgroundImage
  }));
  assert.ok(chamber.filter.includes("blur"),"Live Lottery ball region must obscure sample labels without a solid opaque globe");

  for(const [mode,part] of [["lottery","randomizer-concept/lottery.png"],["slot","randomizer-concept/slot.png"]]){
    await page.locator('#styles [data-style="'+mode+'"]').click();
    const background=await page.locator(".visual").evaluate(node=>getComputedStyle(node,"::before").backgroundImage);
    assert.ok(background.includes(part),"Use transparent cabinet without baked-in options: "+background);
  }
  await page.locator('#styles [data-style="wheel"]').click();
  assert.match(await page.locator(".wheel-art-frame img").getAttribute("src"),/\.png\?v=3/);
  assert.deepEqual(errors,[]);
  console.log("PASS approved concept routes and real PNG component assets in all four Randomizer modes");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
