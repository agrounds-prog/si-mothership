const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
async function check(page,label){
 const data=await page.evaluate(()=>{
  const rect=id=>{const b=document.querySelector(id).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
  return {width:innerWidth,height:innerHeight,stage:rect("#stage"),marquee:rect(".stage-marquee"),arena:rect(".arena"),winner:rect("#result"),console:rect(".stage-console"),visual:rect(".arena .visual"),button:rect("#spin"),studio:rect("#studio")};
 });
 const fudge=5;
 assert.ok(data.arena.h>=165,label+" needs a usable visual arena "+JSON.stringify(data));
 assert.ok(data.marquee.bottom<=data.arena.y+fudge,label+" title must not overlap arena");
 assert.ok(data.arena.bottom<=data.winner.y+fudge,label+" wheel must not cover prize plaque");
 assert.ok(data.winner.bottom<=data.console.y+fudge,label+" prize plaque must not cover controls");
 assert.ok(data.console.bottom<=data.height+fudge,label+" controls must remain visible");
 assert.ok(data.button.y>=data.console.y-fudge&&data.button.bottom<=data.console.bottom+fudge,label+" button must stay within console");
 assert.ok(data.stage.w>data.studio.w,label+" stage should dominate the teacher view");
 return data;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  for(const [width,height] of [[1366,768],[1580,900],[1100,780]]){
   const context=await browser.newContext({viewport:{width,height}});
   const page=await context.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.goto(BASE+"/randomizer",{waitUntil:"domcontentloaded"});
   const box=await check(page,width+"×"+height);
   for(const mode of ["slot","lottery","cards","wheel"]){
    await page.locator('#styles [data-style="'+mode+'"]').click();
    const state=await check(page,mode+" "+width+"×"+height);
    assert.ok(state.visual.w>250,mode+" visual too narrow");
   }
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log("PASS stage geometry at 1366×768, 1580×900 and 1100×780 for all four modes");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
