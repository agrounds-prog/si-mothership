const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const base=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 fs.mkdirSync('/tmp/mp-v1-browser',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const viewport of [{width:1440,height:900},{width:1280,height:800}]){
   const ctx=await browser.newContext({viewport});
   const page=await ctx.newPage();
   const errs=[];page.on('pageerror',e=>errs.push(e.message));
   await page.goto(base+'/?role=teacher',{waitUntil:'domcontentloaded'});
   const response=await ctx.request.post(base+'/api/teacher/login',{data:{key:'5030',remember:true}});
   assert.equal(response.status(),200,'teacher authentication failed');
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof openApp==='function'&&typeof state!=='undefined',{timeout:16000});
   await page.evaluate(()=>openApp('match'));
   await page.waitForFunction(()=>document.getElementById('activitiesPanel')?.classList.contains('si-mp-match-studio'),{timeout:10000});
   const match=page.locator('#activitiesPanel');
   const matchBg=await match.evaluate(x=>getComputedStyle(x).backgroundImage);
   assert.ok(matchBg.includes('match_creator_background_1600x900.png'),matchBg);
   assert.ok(await page.locator('#activitiesPanel .mcb-shell').count(),'MATCH creator missing');
   await page.screenshot({path:'/tmp/mp-v1-browser/'+viewport.width+'-match-creator.png',animations:'disabled'});
   console.log('PASS',viewport.width,'MATCH creator with uploaded artwork');
   await page.evaluate(()=>openApp('pixel'));
   await page.waitForFunction(()=>document.getElementById('activitiesPanel')?.classList.contains('si-mp-pixel-studio'),{timeout:10000});
   const pixelBg=await match.evaluate(x=>getComputedStyle(x).backgroundImage);
   assert.ok(pixelBg.includes('pixel_reveal_studio_background_1600x900.png'),pixelBg);
   assert.ok(await page.locator('#activitiesPanel .pixel-setup').count(),'PIXEL studio missing');
   await page.screenshot({path:'/tmp/mp-v1-browser/'+viewport.width+'-pixel-studio.png',animations:'disabled'});
   console.log('PASS',viewport.width,'PIXEL studio with uploaded artwork');
   // Launch a demo round in the isolated browser session and verify the real ready panel.
   await page.evaluate(()=>{
     const d=ensurePixelDraft();
     if(!d.image)d.image=pixelDemoImage();
     d.answer=d.answer||'Giraffe';d.name=d.name||'QA Mystery';
     launchPixel();
   });
   await page.waitForFunction(()=>document.getElementById('activityControllerPanel')?.classList.contains('si-mp-pixel-live'),{timeout:10000});
   await page.waitForFunction(()=>document.getElementById('activityControllerPanel')?.classList.contains('si-mp-ready'),{timeout:10000});
   const pixelReady=await page.locator('#activityControllerPanel').evaluate(x=>getComputedStyle(x).backgroundImage);
   assert.ok(pixelReady.includes('pixel_reveal_ready_background_1600x900.png'),pixelReady);
   assert.ok(await page.locator('#startActivityBtn').count(),'PIXEL launch button missing');
   await page.screenshot({path:'/tmp/mp-v1-browser/'+viewport.width+'-pixel-ready.png',animations:'disabled'});
   console.log('PASS',viewport.width,'PIXEL ready screen with uploaded art');
   // MATCH teacher-only Zoom launch remains functional with a small isolated sample set.
   await page.evaluate(()=>{
     state.activityRun=null;
     openApp('match');
     matchLaunchSettings.mode='teacher';
     const pairs=Array.from({length:5},(_,i)=>({
       id:'qa-pair-'+i,a:{type:'text',text:'A'+i},b:{type:'text',text:'A'+i}
     }));
     launchMatchSet({id:'qa-match-art',name:'QA Teacher MATCH',pairs});
   });
   await page.waitForFunction(()=>document.getElementById('activityControllerPanel')?.classList.contains('si-mp-match-live'),{timeout:10000});
   const matchLiveBg=await page.locator('#activityControllerPanel').evaluate(x=>getComputedStyle(x).backgroundImage);
   assert.ok(matchLiveBg.includes('match_live_background_1600x900.png'),matchLiveBg);
   await page.screenshot({path:'/tmp/mp-v1-browser/'+viewport.width+'-match-live.png',animations:'disabled'});
   console.log('PASS',viewport.width,'MATCH teacher live control screen with uploaded art');
   // Separate teacher windows share origin, authentication, CSS and the same setup selectors.
   const popup=await ctx.newPage();
   await popup.goto(base+'/?role=teacher',{waitUntil:'domcontentloaded'});
   await popup.waitForFunction(()=>typeof openApp==='function',{timeout:16000});
   await popup.evaluate(()=>openApp('match'));
   await popup.waitForFunction(()=>document.getElementById('activitiesPanel')?.classList.contains('si-mp-match-studio'),{timeout:10000});
   assert.ok(await popup.locator('#activitiesPanel').evaluate(x=>getComputedStyle(x).backgroundImage.includes('match_creator_background')));
   console.log('PASS',viewport.width,'separate teacher window includes MATCH art');
   assert.equal(errs.length,0,'page errors: '+errs.join('; '));
   await ctx.close();
  }
  console.log('PASS all scoped teacher studio and separate-window checks');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
