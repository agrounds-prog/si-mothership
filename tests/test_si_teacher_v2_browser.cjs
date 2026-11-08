const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 fs.mkdirSync('/tmp/si-teacher-v2-screens',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const viewport of [{width:1440,height:900},{width:1366,height:768}]){
   const page=await browser.newPage({viewport});
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof render==='function'&&typeof state!=='undefined',{timeout:14000});
   // Use server-issued teacher session; PIN keypad is deliberately read-only.
   const login=await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030',remember:true}});
   assert.equal(login.status(),200,'Teacher test login must succeed');
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!document.body.classList.contains('teacher-locked'));
   const check=async(label,id,art)=>{
    await page.waitForTimeout(1200);
    const info=await page.locator('#'+id).evaluate(el=>{
      const a=el.getBoundingClientRect(),st=getComputedStyle(el);
      return {active:!el.classList.contains('hidden'),classes:el.className,
       background:st.backgroundImage,box:{x:a.x,y:a.y,width:a.width,height:a.height},
       scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}
    });
    assert.equal(info.active,true,label+' hidden: '+JSON.stringify(info));
    assert.ok(info.background.includes(art),label+' missing uploaded image: '+JSON.stringify(info));
    assert.ok(info.box.width>440,label+' too narrow: '+JSON.stringify(info));
    assert.ok(info.box.height>150,label+' too short: '+JSON.stringify(info));
    assert.ok(info.scrollWidth<=info.clientWidth+40,label+' horizontal overflow: '+JSON.stringify(info));
    await page.locator('#'+id).screenshot({path:'/tmp/si-teacher-v2-screens/'+viewport.width+'-'+label+'.png',animations:'disabled'});
    console.log('PASS',viewport.width,label,JSON.stringify(info));
   };
   await page.evaluate(()=>{state.activeApp='si-plus';state.screen='activities';
    state.presentationEditor=null;state.presentationLibraryOpen=false;state.activityRun=null;render()});
   await check('home','activitiesPanel','si_home_primary_1600x900.webp');
   assert.equal(await page.locator('#siNewPresentation').count(),1);
   assert.equal(await page.locator('#siLoadPresentation').count(),1);
   const emblem=await page.locator('#activityGrid .act-icon').evaluate(el=>getComputedStyle(el).backgroundImage);
   assert.ok(emblem.includes('si_plus_emblem_512.png'),'Uploaded emblem not applied');
   await page.evaluate(()=>{state.presentationLibraryOpen=true;render()});
   await check('library','activitiesPanel','presentation_library_primary_1600x900.webp');
   assert.equal(await page.locator('#savedPresentationPicker').isVisible(),true);
   await page.evaluate(()=>{state.presentationLibraryOpen=false;openNewPresentation();render()});
   await check('builder','presentationBuilderPanel','presentation_builder_primary_1600x900.webp');
   assert.ok(await page.locator('.builder-layout').count()>0,'Builder layout missing');
   assert.ok(await page.locator('#presentationBuilderPanel .builder-top-actions button').count()>0,'Builder actions missing');
   await page.close();
  }
  console.log('PASS image-first SI+ scene screenshots: home, library, builder at two viewports');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
