const assert=require("node:assert/strict");
const fs=require("node:fs");
const {chromium}=require("playwright");
const BASE=process.env.LOCAL_URL||"http://127.0.0.1:8877";
(async()=>{
 fs.mkdirSync("/tmp/aac-v4-screens",{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 const page=await context.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 try{
  assert.equal((await page.request.post(BASE+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(BASE+"/?role=teacher",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.__siV80ClassroomTools===true&&typeof render==="function",null,{timeout:25000});
  const registry=await page.evaluate(()=>APP_REGISTRY.filter(a=>["aac-plus","randomizer"].includes(a.id)));
  assert.deepEqual(registry.map(a=>a.id).sort(),["aac-plus","randomizer"]);
  assert.equal(await page.locator(".aac-plus-launch,.si-randomizer-launch").count(),0,"No special header shortcuts remain");
  const originals=await page.evaluate(()=>state.favoriteSlots.slice());
  await page.evaluate(()=>{state.screen="activities";state.activeApp=null;state.assigningSlot=null;render()});
  await page.waitForSelector('#activityGrid [data-open-app="randomizer"]',{state:"attached"});

  // Every formerly plain-symbol activity uses the same full-bleed illustrated
  // card surface; legacy illustrated games retain their approved artwork.
  const unfinished=["DOMINOES","WORD GRID","MINEFIELD","VECTOR","ORBIT",
   "MILLION","SPOTLIGHT","SCIENTIFIC CALCULATOR","AAC+","RANDOMIZER"];
  await page.waitForFunction(names=>{
   const cards=[...document.querySelectorAll("#activityGrid .real-app-card")];
   return names.every(name=>cards.some(card=>card.querySelector("h3")?.textContent?.trim()===name
    &&card.querySelector(".act-icon .si-v90-graphic")));
  },unfinished,{timeout:12000});
  const artGeometry=await page.evaluate(names=>{
   return names.map(name=>{
    const card=[...document.querySelectorAll("#activityGrid .real-app-card")].find(c=>c.querySelector("h3")?.textContent?.trim()===name);
    const slot=card.querySelector(".act-icon").getBoundingClientRect();
    const art=card.querySelector(".act-icon .si-v90-graphic").getBoundingClientRect();
    return {name,slotWidth:slot.width,artWidth:art.width,slotHeight:slot.height,artHeight:art.height};
   });
  },unfinished);
  for(const art of artGeometry){
   assert.ok(Math.abs(art.artWidth-art.slotWidth)<4,JSON.stringify(art));
   assert.ok(Math.abs(art.artHeight-art.slotHeight)<4,JSON.stringify(art));
  }

  assert.equal(await page.locator('#activityGrid [data-open-app="aac-plus"]').count(),1);
  await page.locator('[data-activity-category="tools"]:visible').first().click();
  assert.equal(await page.locator('#activityGrid [data-open-app="randomizer"]').isVisible(),true);
  assert.equal(await page.locator('#activityGrid [data-open-app="aac-plus"]').isVisible(),true);
  // AAC+ opens a reusable floating teacher Studio, leaving Mothership untouched.
  const aacPopupPromise=page.waitForEvent("popup");
  await page.locator('#activityGrid [data-open-app="aac-plus"]').click();
  const aacPopup=await aacPopupPromise;
  await aacPopup.waitForLoadState("domcontentloaded");
  assert.ok(new URL(aacPopup.url()).pathname.startsWith("/aac"),"AAC+ studio route");
  await aacPopup.waitForFunction(()=>!!document.querySelector("#newBoard")?.onclick);
  assert.equal(await aacPopup.evaluate(()=>window.name),"siMothershipAACPlusStudio");
  assert.equal(await aacPopup.locator("#aacCloseWindow").count(),1);
  await aacPopup.waitForFunction(()=>document.querySelector(".aac-studio-hero-art img")?.naturalWidth>0);
  assert.equal(await aacPopup.locator("#libraryScreen").isVisible(),true);
  assert.equal(await aacPopup.locator("body.aac-art-v3").count(),1);
  for(const asset of ["header.png","hero.png","create-button.png","search-blank.png","board-shell.png","edit-button.png","secondary-button.png","footer.png","hologram.png"]){
   const response=await aacPopup.request.get(BASE+"/aac-plus-art/"+asset);
   assert.equal(response.status(),200,"Illustration missing: "+asset);
   assert.ok((await response.body()).length>1000,"Illustration empty: "+asset);
  }

  const qaTiles=Array.from({length:16},(_,i)=>({label:i===0?"More":"",symbol:"",color:"#075aa0",audio:null,image:null}));
  const created=await aacPopup.request.post(BASE+"/api/aac/boards",{
   data:{title:"Illustrated Layout QA",layout:"4x4",tiles:qaTiles}
  });
  assert.equal(created.status(),201,"Create a 4x4 test board");
  await aacPopup.reload({waitUntil:"domcontentloaded"});
  const card=aacPopup.locator(".aac-board-card").filter({hasText:"Illustrated Layout QA"});
  await card.waitFor({state:"visible"});
  assert.equal(await card.locator(".aac-board-thumbnail>div").count(),16);
  await aacPopup.locator("#boardSearch").fill("Illustrated Layout QA");
  assert.equal(await card.isVisible(),true,"Illustrated search retains real filtering");
  await aacPopup.locator("#boardSearch").fill("");
  await card.getByRole("button",{name:"Edit"}).click();
  await aacPopup.waitForFunction("document.getElementById(\"boardTitle\").value === \"Illustrated Layout QA\"");
  assert.equal(await aacPopup.locator("body.aac-art-v4").count(),1);
  await aacPopup.screenshot({path:"/tmp/aac-v4-screens/editor.png",fullPage:true});
  await aacPopup.locator("#backLibrary").click();
  const sharedCard=aacPopup.locator(".aac-board-card").filter({hasText:"Illustrated Layout QA"});
  aacPopup.once("dialog",dialog=>dialog.accept());
  await sharedCard.getByRole("button",{name:"Share"}).click();
  await aacPopup.locator("#shareScreen").waitFor({state:"visible"});
  assert.equal(await aacPopup.locator(".aac-share-qr img").count(),1);
  await aacPopup.waitForFunction(()=>document.querySelector("#shareQr")?.naturalWidth>0);
  assert.ok((await aacPopup.locator("#shareLink").inputValue()).includes("/aac/s/"));
  await aacPopup.screenshot({path:"/tmp/aac-v4-screens/share.png",fullPage:true});
  const sharedPath=new URL(await aacPopup.locator("#shareLink").inputValue()).pathname;
  const anonymous=await browser.newContext({viewport:{width:440,height:780}});
  const studentPage=await anonymous.newPage();
  await studentPage.goto(BASE+sharedPath,{waitUntil:"domcontentloaded"});
  await studentPage.waitForFunction(()=>document.querySelector("#studentTitle")?.textContent==="Illustrated Layout QA");
  assert.equal(await studentPage.locator("body.aac-art-v4").count(),1);
  assert.equal(await studentPage.locator('#studentTiles[data-layout="4x4"] .aac-tile').count(),16);
  assert.equal(await studentPage.locator("#studentTiles .aac-tile:disabled").count(),15);
  assert.equal(await studentPage.locator("#studentTiles .aac-tile.aac-text-only").count(),1);
  assert.ok(await studentPage.locator("#studentTiles .aac-tile").first().isEnabled());
  assert.ok(await studentPage.evaluate(()=>getComputedStyle(document.querySelector(".aac-student-console")).backgroundImage.includes("student-console.svg")));
  assert.ok(await studentPage.evaluate(()=>getComputedStyle(document.querySelector(".aac-tile:not(.aac-blank)")).backgroundImage.includes("communication-tile.svg")));
  await studentPage.screenshot({path:"/tmp/aac-v4-screens/student-mobile.png",fullPage:true});
  await anonymous.close();
  await aacPopup.locator("#shareBack").click();
  await aacPopup.locator("#newBoard").click();
  assert.equal(await aacPopup.locator("#editorScreen").isVisible(),true);
  await aacPopup.locator("#backLibrary").click();
  assert.equal(await aacPopup.locator("#libraryScreen").isVisible(),true);
  const closePromise=aacPopup.waitForEvent("close");
  await aacPopup.locator("#aacCloseWindow").click();
  await closePromise;
  assert.equal(page.isClosed(),false,"Mothership must remain open after AAC+ closes");
  assert.ok(page.url().includes("role=teacher"),"Main teacher deck stays available");

  const popupPromise=page.waitForEvent("popup");
  await page.locator('#activityGrid [data-open-app="randomizer"]').click();
  const popup=await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  assert.ok(popup.url().includes("/randomizer"));
  await popup.close();
  assert.deepEqual(await page.evaluate(()=>state.favoriteSlots.slice()),originals,"Browsing apps does not change shortcuts");
  const slot=await page.evaluate(()=>state.favoriteSlots.findIndex(x=>!x));
  if(slot<0){
   await page.evaluate(()=>{state.favoriteSlots[8]=null;render()});
  }
  await page.locator('#activityGrid [data-add-app="randomizer"]').click();
  const current=await page.evaluate(()=>state.favoriteSlots.slice());
  assert.ok(current.includes("randomizer"),"Randomizer should be assignable to a home shortcut");
  await page.evaluate(()=>{state.screen="classroom";render()});
  const button=page.locator('#homeAppGrid .app-shortcut').filter({hasText:"RANDOMIZER"});
  assert.equal(await button.count(),1);
  const secondPopup=page.waitForEvent("popup");
  await button.click();
  const opened=await secondPopup;
  assert.ok(opened.url().includes("/randomizer"));
  await opened.close();
  assert.deepEqual(errors,[]);
  console.log("PASS AAC+ and Randomizer Activities catalog, Tools filter, launch and native home shortcuts");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
