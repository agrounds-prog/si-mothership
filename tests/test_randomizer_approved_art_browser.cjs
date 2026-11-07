const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(BASE+"/randomizer",{waitUntil:"domcontentloaded"});
  const sceneStyles=await page.request.get(BASE+"/randomizer-v4.css?v=4");
  assert.equal(sceneStyles.status(),200,"The V4 scene override must be served by Railway");
  assert.match(await sceneStyles.text(),/Randomizer V4/);
  assert.equal(await page.locator("#stage").getAttribute("data-graphics"),"v4");
  assert.equal(await page.locator(".v4-stamp").textContent(),"GRAPHICS V4");
  assert.equal(await page.locator("link[href='/randomizer-v4.css?v=4']").count(),1);

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
   assert.equal(graphics,"v4");

  }
  await page.locator('#styles [data-style="cards"]').click();
  assert.equal(await page.locator("#cards .card").count(),4);
  assert.ok((await page.locator("#cards .card").first().evaluate(el=>getComputedStyle(el).backgroundImage)).includes("randomizer-concept/cards.png"));
  await page.locator('#styles [data-style="wheel"]').click();
  assert.match(await page.locator(".wheel-art-frame img").getAttribute("src"),/\.png\?v=3/);
  assert.deepEqual(errors,[]);
  console.log("PASS approved concept routes and real PNG component assets in all four Randomizer modes");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
