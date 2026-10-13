/* Isolated SI Scientific Calculator popup geometry test.
   Never mutates teacher data or production classrooms. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext();
 const page=await ctx.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 try{
   for(const [width,height] of [[340,650],[320,590],[370,700]]){
     await page.setViewportSize({width,height});
     const response=await page.goto(BASE+"/tools/scientific-calculator?popup=1",{waitUntil:"domcontentloaded",timeout:30000});
     assert.equal(response.status(),200);
     await page.waitForTimeout(700);
     console.log("CALCULATOR BOOT DEBUG "+JSON.stringify(await page.evaluate(()=>({
       bodyClass:document.body.className,
       popupClass:document.documentElement.className,
       calculatorCount:document.querySelectorAll(".si-model-calculator").length,
       keypadCount:document.querySelectorAll(".si-model-keypad").length,
       actionCount:document.querySelectorAll("[data-action]").length,
       mappedCount:document.querySelectorAll("[data-ref-row]").length,
       directMapped:document.querySelectorAll(".si-model-keypad > [data-ref-row]").length,
       allRows:[...document.querySelectorAll("[data-ref-row]")].map(x=>({row:x.dataset.refRow,col:x.dataset.refCol,label:x.textContent.trim().slice(0,12),action:x.dataset.action,tag:x.tagName,parent:x.parentElement?.className})).slice(0,45),
       keypadDirect:[...document.querySelector(".si-model-keypad")?.children||[]].map(x=>({tag:x.tagName,cls:x.className,row:x.dataset.refRow,col:x.dataset.refCol,label:x.textContent.trim().slice(0,10)})).slice(0,45),
       excerpt:document.body.innerText.slice(0,320)
     }))));
     await page.waitForFunction(()=>document.body.classList.contains("si-calculator-popup-mode") &&
       document.querySelector(".si-model-calculator") && document.querySelector(".si-model-keypad"),
       null,{timeout:15000});
     await page.waitForTimeout(550);
     const g=await page.evaluate(()=>{
       const el=document.querySelector(".si-model-calculator");
       const keypad=document.querySelector(".si-model-keypad");
       const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
       const keys=[...keypad.querySelectorAll(":scope > [data-ref-row]")].filter(k=>getComputedStyle(k).display!=="none");
       const other=[...document.body.children].filter(k=>k!==el && getComputedStyle(k).display!=="none" &&
         !["SCRIPT","STYLE"].includes(k.tagName)).map(k=>({tag:k.tagName,cls:k.className}));
       const rows=[...new Set(keys.map(k=>k.dataset.refRow))].sort();
       const positions=keys.map(k=>({row:Number(k.dataset.refRow),col:Number(k.dataset.refCol),action:k.dataset.action,
         text:k.textContent.trim().slice(0,24),r:rect(k)}));
       return {body:document.body.className,calc:rect(el),cols:getComputedStyle(keypad).gridTemplateColumns,
         tracks:getComputedStyle(keypad).gridTemplateRows,rows,positions,other,viewport:{width:innerWidth,height:innerHeight}};
     });
     assert.equal(g.other.length,0,"popup must hide Share / Help / Settings and other page chrome: "+JSON.stringify(g.other));
     assert.deepEqual(g.rows,["1","2","3","4","5","6","7"],"all seven keypad rows must exist");
     assert.equal(g.tracks.split(" ").length,7,"exactly seven explicit keypad tracks: "+g.tracks);
     assert.ok(g.calc.x>=-3 && g.calc.right<=width+3,"calculator must fit horizontally: "+JSON.stringify(g.calc));
     assert.ok(g.calc.y>=-3 && g.calc.bottom<=height+5,"calculator must fit vertically: "+JSON.stringify(g.calc));
     for(const k of g.positions){
       assert.ok(k.r.w>=10 && k.r.h>=9,"usable key: "+JSON.stringify(k));
       assert.ok(k.r.bottom<=height+5,"all keycaps must be visible: "+JSON.stringify(k));
     }
     for(let i=0;i<g.positions.length;i++){
       for(let j=i+1;j<g.positions.length;j++){
         const a=g.positions[i],b=g.positions[j];
         const overlapX=Math.min(a.r.right,b.r.right)-Math.max(a.r.x,b.r.x);
         const overlapY=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.y,b.r.y);
         assert.ok(overlapX<=2 || overlapY<=2,"overlapping calculator buttons: "+JSON.stringify({a,b}));
       }
     }
     console.log("SCIENTIFIC CALCULATOR POPUP ALIGNED "+JSON.stringify({width,height,rows:g.rows.length,
       keys:g.positions.length,calculator:g.calc,tracks:g.tracks}));
   }
   assert.deepEqual(errors,[]);
   console.log("SCIENTIFIC CALCULATOR seven-row keyboard and popup crop PASSED");
 }finally{await ctx.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
