const assert=require("node:assert/strict");
const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 try{
  const base=process.env.LOCAL_URL||"http://127.0.0.1:8877";
  assert.equal((await page.request.post(base+"/api/teacher/login",{data:{key:"5030"}})).status(),200);
  await page.goto(base+"/?role=teacher",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIPlusSpotlightSlide&&networkHydrated,null,{timeout:25000});
  await page.evaluate(()=>{state.activityRun=null;state.presentationEditor=null;state.activeApp="si-plus";state.presentationLibraryOpen=true;state.screen="activities";render()});
  const quick=page.locator("#siPlusQuickSpotlight");
  await quick.waitFor({state:"visible",timeout:12000});
  const img=await page.evaluate(()=>{let c=document.createElement("canvas");c.width=960;c.height=540;c.getContext("2d").fillRect(0,0,960,540);return c.toDataURL("image/png").split(",")[1]});
  const [picker]=await Promise.all([page.waitForEvent("filechooser"),quick.click()]);
  await picker.setFiles({name:"Quick Spotlight.png",mimeType:"image/png",buffer:Buffer.from(img,"base64")});
  await page.waitForSelector("#siPlusSpotlightEditor:not([hidden])",{timeout:20000});
  const result=await page.evaluate(()=>({name:state.presentationEditor?.draft?.deckTitle,count:state.presentationEditor?.draft?.slides?.length,image:!!state.presentationEditor?.draft?.slides?.[state.editorSlide]?.image}));
  assert.equal(result.name,"Quick Spotlight");assert.equal(result.count,1);assert.equal(result.image,true);
  console.log("PASS Quick Spotlight from SI+ library");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
