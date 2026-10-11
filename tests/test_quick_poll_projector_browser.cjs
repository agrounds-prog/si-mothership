/* Quick Poll v4 projector visual and flicker regression; mock response fixture only.
   No calls to production and no mutations to live classroom session. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.LOCAL_URL||'http://127.0.0.1:8877';
const colors=['A','B','C','D','E','F'];
const make=(style,count=4,counts=[7,5,3,1],extra={})=>({
 id:'v4-demo-'+style,display:style,phase:'open',question:'Which classroom activity should we play next?',
 description:'Vote as a crew, then compare the results.',
 choices:Array.from({length:count},(_,i)=>({
  id:String(i+1),label:['Read a favorite story','Build something together',
   'Create music and art','Explore outer space','Team science lab','Play a new game'][i],
  image:''})),
 counts:Object.fromEntries(Array.from({length:count},(_,i)=>[String(i+1),counts[i]||0])),
 voters:Math.max(...counts,0),eligible:28,round:1,
 sharedVisible:true,multiple:false,visibility:'live',
 endAt:null,serverTime:Math.floor(Date.now()/1000),...extra,
});
const observerScript='document.getElementById("qpPublicOverlay")';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 let current=make('bars',4,[12,8,4,2]),errorEvents=[];
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>errorEvents.push(String(e.stack||e)));
 await page.route('**/api/quick-poll/state?*',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({active:true,poll:current})
 }));
 try{
  await page.goto(base+'/?role=shared',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(()=>document.querySelector('.qp-v4-projector .qp-v4-stage'),{timeout:15000});
  const readings=[];
  async function pollVisual(style,count,counts,expectedClass,opts={}){
   current=make(style,count,counts,{id:'visual-'+style+'-'+count+'-'+readings.length,...opts});
   await page.evaluate(()=>window.SIQuickPoll.refresh());
   await page.waitForFunction((cls)=>!!document.querySelector(cls),expectedClass,{timeout:10000});
   const stats=await page.evaluate((cls)=>{
    const root=document.querySelector('#qpPublicOverlay .qp-v4-projector');
    const stage=root?.querySelector(cls);
    const bounds=s=>{const r=s?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};
    const cards=[...stage.querySelectorAll('.qp-v4-bar-row,.qp-v4-legend-row,.qp-v4-versus-side,.qp-v4-choice-tile')];
    return {style:cls,width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,
      root:bounds(root),stage:bounds(stage),boxes:cards.map(bounds),
      choices:cards.length,renderedQuestion:root.querySelector('.qp-v4-question h1')?.textContent,
      hasHiddenCount:!!document.querySelector('.qp-secret'),
      bodyText:root.innerText?.slice(0,1600)};
   },expectedClass);
   assert.equal(stats.choices,style==='showdown'?2:count,'correct options: '+style);
   assert.ok(stats.stage.w>300 && stats.stage.h>120,'chart dimensions '+style);
   assert.ok(stats.pageWidth<=innerWidth+20,'horizontal overflow '+style+' '+stats.pageWidth);
   assert.ok(stats.boxes.every(b=>b.w>42&&b.h>30),'nonzero option boxes '+style);
   assert.match(stats.renderedQuestion,/Which classroom/);
   assert.equal(errorEvents.length,0,'JS page error '+errorEvents.join('|'));
   readings.push({style,count,screen:innerWidth+'x'+innerHeight,width:stats.stage.w,
     height:stats.stage.h,options:stats.choices});
   return stats;
  }
  let bars=await pollVisual('bars',4,[12,8,4,2],'.qp-v4-bars');
  assert.equal(await page.locator('.qp-v4-bar-fill').count(),4);
  const widths=await page.locator('.qp-v4-bar-fill').evaluateAll(nodes=>nodes.map(n=>n.style.width));
  assert.deepEqual(widths,['100%','67%','33%','17%']);
  assert.equal(await page.locator('.qp-v4-bar-row.is-leader').count(),1);
  const oldStage=await page.locator('.qp-v4-stage').evaluate(el=>{el.dataset.keepMe='yes';return el.dataset.keepMe;});
  assert.equal(oldStage,'yes');
  await page.evaluate(()=>window.SIQuickPoll.refresh());
  assert.equal(await page.locator('.qp-v4-stage').getAttribute('data-keep-me'),'yes',
   'no DOM reset or animation restart when shared counts unchanged');

  // Live updates must redraw only when results actually change.
  current.counts['2']=18;current.voters=18;
  await page.evaluate(()=>window.SIQuickPoll.refresh());
  assert.equal(await page.locator('.qp-v4-stage').getAttribute('data-keep-me'),null);
  assert.equal(await page.locator('.qp-v4-bar-row.is-leader').count(),1);

  await pollVisual('donut',4,[12,8,4,2],'.qp-v4-donut');
  assert.equal(await page.locator('.qp-v4-legend-row').count(),4);
  assert.match(await page.locator('.qp-v4-ring').getAttribute('style'),/conic-gradient/);
  await pollVisual('donut',4,[12,8,4,2],'.qp-v4-donut',{multiple:true});
  assert.match(await page.locator('.qp-v4-data-footer').textContent(),/share of students/);

  await pollVisual('showdown',2,[10,6],'.qp-v4-versus');
  assert.equal(await page.locator('.qp-v4-versus-medal').textContent(),'VS');
  assert.match(await page.locator('.qp-v4-vs-bottom').textContent(),/LEADS BY 4/);
  await pollVisual('showdown',2,[0,0],'.qp-v4-versus',{voters:0});
  assert.equal(await page.locator('.qp-v4-vs-empty').count(),1);
  assert.match(await page.locator('.qp-v4-vs-bottom').textContent(),/AWAITING FIRST VOTE/);

  await pollVisual('cards',2,[10,6],'.qp-v4-cards');
  await pollVisual('cards',6,[12,11,8,7,5,3],'.qp-v4-cards');
  assert.equal(await page.locator('.qp-v4-choice-tile').count(),6);

  // Projector / Zoom resolutions, including the crowded six-choice bar view.
  await page.setViewportSize({width:1366,height:768});
  await pollVisual('bars',6,[12,11,8,7,5,3],'.qp-v4-bars');
  await page.setViewportSize({width:1280,height:720});
  await pollVisual('donut',6,[12,11,8,7,5,3],'.qp-v4-donut');
  await pollVisual('showdown',2,[11,7],'.qp-v4-versus');
  await page.setViewportSize({width:768,height:900});
  await pollVisual('cards',6,[12,11,8,7,5,3],'.qp-v4-cards');
  await page.setViewportSize({width:390,height:844});
  await pollVisual('showdown',2,[11,7],'.qp-v4-versus');

  // Optional directions and long answer labels must wrap, not stretch the screen.
  current=make('bars',4,[8,5,3,0],{id:'long-labels',
   question:'What is one effective way to respectfully enter a conversation when someone else is speaking?',
   choices:[{id:'1',label:'Wait until there is an appropriate pause in the conversation and then ask politely',image:''},
    {id:'2',label:'Excuse me briefly and say why the question matters',image:''},
    {id:'3',label:'Call out an answer before anyone has finished talking',image:''},
    {id:'4',label:'Ignore everyone',image:''}]});
  await page.evaluate(()=>window.SIQuickPoll.refresh());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+20));

  // Concealed-results mode must NEVER reveal an answer count or graphic.
  current=make('donut',3,[2,5,1],{id:'concealed',counts:null,visibility:'reveal'});
  await page.evaluate(()=>window.SIQuickPoll.refresh());
  assert.equal(await page.locator('.qp-v4-secret').count(),1);
  assert.equal(await page.locator('.qp-v4-ring').count(),0);
  current=make('bars',3,[2,5,1],{id:'new-round',round:2,before:{1:5,2:1,3:2}});
  await page.evaluate(()=>window.SIQuickPoll.refresh());
  assert.equal(await page.locator('.qp-v4-comparison-item').count(),3);
  current.sharedVisible=false;
  await page.evaluate(()=>window.SIQuickPoll.refresh());
  assert.equal(await page.locator('#qpPublicOverlay').isVisible(),false,'shared hides on teacher command');
  current.sharedVisible=true;
  await page.evaluate(()=>window.SIQuickPoll.refresh());
  assert.equal(await page.locator('#qpPublicOverlay').isVisible(),true,'shared reappears correctly');

  // Teacher mirror uses the same display mode as the real projector.
  const teacherContext=await browser.newContext({viewport:{width:1440,height:900}});
  const teacher=await teacherContext.newPage();
  teacher.on('pageerror',e=>errorEvents.push('teacher '+String(e)));
  await teacher.route('**/api/quick-poll/state?*',route=>route.fulfill({
   status:200,contentType:'application/json',body:JSON.stringify({active:true,poll:current})
  }));
  await teacher.goto(base+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await teacher.waitForFunction(()=>!!document.querySelector('#qpMirrorPreview .qp-v4-mirror-bars'),{timeout:12000});
  assert.equal(await teacher.locator('#qpMirrorPreview .qp-mirror-bar').count(),3);
  await teacherContext.close();

  console.log(JSON.stringify({test:'Quick Poll premium projector charts / responsive / live update / sealed / mirror',
   cases:readings,errors:errorEvents}));
  assert.equal(errorEvents.length,0);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
