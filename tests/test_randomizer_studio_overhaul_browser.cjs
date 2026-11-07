const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  for(const [width,height] of [[1366,768],[1580,900],[1100,780]]){
   const context=await browser.newContext({viewport:{width,height}});
   const page=await context.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   const response=await page.goto(BASE+"/randomizer",{waitUntil:"domcontentloaded"});
   assert.equal(response.status(),200);
   assert.equal(await page.locator("#studio .studio-group").count(),4,"Four studio groups expected");
   assert.deepEqual(await page.locator("#studio .studio-group-heading h3").allTextContents(),["SHOW SETUP","CHOICES & ODDS","SHOW EFFECTS","SAVED RANDOMIZERS"]);
   assert.equal(await page.locator("#studio #styles button").count(),4);
   assert.equal(await page.locator("#studio #choices .choice").count(),4);
   for(const id of ["title","bulk","addBulk","addChoice","choiceSearch","weighted","removeWinner","soundEnabled","celebrateEnabled","animationSpeed","resetPool","clearAll","savedName","save","delete","library","load"]){
    assert.equal(await page.locator("#"+id).count(),1,"Existing control must be preserved: "+id);
   }
   const boxes=await page.evaluate(()=>{
    const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
    return {stage:box("#stage"),console:box(".stage-console"),button:box("#spin"),result:box("#result"),studio:box("#studio"),header:box("#studio .studio-header"),viewport:innerHeight};
   });
   assert.ok(boxes.console.bottom<=height+5,JSON.stringify(boxes));
   assert.ok(boxes.button.bottom<=boxes.console.bottom+5);
   assert.ok(boxes.result.bottom<=boxes.console.top+5);
   assert.ok(boxes.header.bottom>boxes.studio.top);
   await page.locator("#studio #title").fill("Graphic Overhaul Test");
   await page.locator('#styles [data-style="lottery"]').click();
   assert.equal(await page.locator("#displayTitle").textContent(),"Graphic Overhaul Test");
   assert.equal(await page.locator("#stage").getAttribute("data-mode"),"lottery");
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log("PASS four studio groups, unchanged controls and integrated game-show controls at three desktop viewport sizes");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
