/* SI+ video-only slides fill the 16:9 projector and teacher mirror.
 * Isolated classroom, no production saved deck changes. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route(/youtube\\.com|youtu\\.be|ytimg\\.com/,route=>route.abort());
 try{
  assert.equal((await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}})).status(),200);
  await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof activitySharedMarkup==='function'&&(!NETWORK_SYNC||networkHydrated),null,{timeout:20000});
  await page.evaluate(()=>{
   const slides=[
    {id:'video',type:'instruction',title:'Should be hidden',text:'Also hidden',youtube:'https://youtu.be/ce_h87keUz4',image:''},
    {id:'regular',type:'instruction',title:'Visible ordinary text',text:'Do not hide this',youtube:'',image:''},
    {id:'dual',type:'instruction',title:'Video takes stage',text:'Only player shows',youtube:'https://youtu.be/ce_h87keUz4',image:'https://example.com/img.png'}
   ];
   const id='si-plus-video-only-check';
   state.activities.push({id,type:'presentation',name:'YouTube Layout Regression',deckTitle:'YouTube Layout Regression',slides,userCreated:true});
   state.activityRun={activityId:id,phase:'running',slideIndex:0,runToken:'video-regression',responses:{}};
   state.screen='activity';
   document.querySelector('#teacher').classList.remove('active');
   document.querySelector('#shared').classList.add('active');
   document.body.classList.add('role-shared');
   renderPublic();
  });
  for(const [w,h] of [[1600,900],[1024,768],[390,780]]){
   await page.setViewportSize({width:w,height:h});
   const layout=await page.evaluate(()=>{
    const host=document.querySelector('#sharedContent');
    const stage=host.querySelector(':scope > .si-plus-slide-stage');
    const unit=stage?.querySelector('.si-plus-video-unit');
    const iframe=unit?.querySelector('iframe');
    const a=stage?.getBoundingClientRect(),b=iframe?.getBoundingClientRect();
    return {stage:a&&{x:a.x,y:a.y,w:a.width,h:a.height},
     video:b&&{x:b.x,y:b.y,w:b.width,h:b.height},
     iframe:!!iframe,html:stage?.outerHTML.slice(0,900),
     frameCount:stage?.querySelectorAll('iframe').length,
     hasSlideNumber:!!stage?.querySelector('.slide-count'),
     hasFallback:!!stage?.querySelector('.si-plus-video-fallback'),
     hasTitle:!!stage?.querySelector('h3'),
     src:iframe?.src||''};
   });
   assert.equal(layout.iframe,true,JSON.stringify(layout));
   assert.equal(layout.frameCount,1);
   assert.equal(layout.hasSlideNumber,false);
   assert.equal(layout.hasFallback,false);
   assert.equal(layout.hasTitle,false);
   assert.ok(layout.src.includes('/embed/ce_h87keUz4'));
   assert.ok(Math.abs(layout.stage.w-Math.min(w,h*16/9))<3,JSON.stringify(layout));
   for(const key of ['x','y','w','h'])assert.ok(Math.abs(layout.stage[key]-layout.video[key])<3,
     'video should fill centered slide stage: '+JSON.stringify(layout));
  }
  // A video on an instruction slide takes precedence over title/image,
  // but ordinary instruction slides retain their existing content.
  await page.evaluate(()=>{state.activityRun.slideIndex=2;renderPublic()});
  assert.equal(await page.locator('#sharedContent .si-plus-video-only-stage iframe').count(),1);
  assert.equal(await page.locator('#sharedContent .si-plus-video-only-stage img').count(),0);
  await page.evaluate(()=>{state.activityRun.slideIndex=1;renderPublic()});
  assert.equal(await page.locator('#sharedContent .si-plus-video-only-stage').count(),0);
  assert.match(await page.locator('#sharedContent .presentation-public').innerText(),/Visible ordinary text/);
  // The teacher's live mirror uses the same full-width player layout.
  await page.evaluate(()=>{
   state.activityRun.slideIndex=0;
   document.querySelector('#shared').classList.remove('active');
   document.querySelector('#teacher').classList.add('active');
   document.body.classList.remove('role-shared');
   render();
  });
  await page.waitForSelector('#mirrorContent .si-plus-video-only-stage iframe',{timeout:10000});
  const mirror=await page.evaluate(()=>{
   const stage=document.querySelector('#mirrorContent .si-plus-video-only-stage');
   const a=stage.getBoundingClientRect(),b=stage.querySelector('iframe').getBoundingClientRect();
   return {stage:{w:a.width,h:a.height},video:{w:b.width,h:b.height}};
  });
  assert.ok(mirror.stage.w>100&&Math.abs(mirror.stage.w-mirror.video.w)<3&&
    Math.abs(mirror.stage.h-mirror.video.h)<3,'teacher mirror should fill slide: '+JSON.stringify(mirror));
  assert.deepEqual(errors,[]);
  console.log('PASS: SI+ YouTube slides show only a centered full-size 16:9 player on projector and teacher mirror');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
