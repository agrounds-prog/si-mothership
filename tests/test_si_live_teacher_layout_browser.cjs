const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 fs.mkdirSync('/tmp/si-live-polish',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:850,height:650}});
  await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded'});
  const login=await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030',remember:true}});
  assert.equal(login.status(),200);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof state!=='undefined'&&typeof render==='function');
  await page.evaluate(()=>{
    state.activeApp='si-plus';
    state.presentationEditor=null;
    state.presentationLibraryOpen=false;
    const deck={
      id:'si-live-layout-only',type:'presentation',name:'QA Navigation',
      deckTitle:'QA Navigation',slides:[{
        id:'qa-spotlight',type:'instruction',title:'Spotlight Test',
        listTitle:'Spotlight Test',text:'Testing teacher navigation',
        siSpotlight:{enabled:true,zones:[
          {id:'z1',x:.2,y:.2,width:.2,height:.2,effect:'outline',color:'red'},
          {id:'z2',x:.5,y:.5,width:.25,height:.2,effect:'dim',color:'blue'}
        ]}
      }]
    };
    state.activities.push(deck);
    state.activityRun={activityId:deck.id,phase:'running',runToken:'qa-layout-token',
      slideIndex:0,showResults:false,revealAnswer:false,responses:{}};
    state.screen='activity';render();
  });
  await page.waitForFunction(()=>!!document.querySelector('#siPlusActivityBreakLaunch')&&
    !!document.querySelector('#siPlusPollBridge')&&
    !!document.querySelector('#siPlusSpotlightLiveControls'),{timeout:13000});
  await page.waitForTimeout(1200);
  const layout=await page.evaluate(()=>{
    const panel=document.querySelector('#activityControllerPanel');
    const ids=['prevSlideBtn','nextSlideBtn','siPlusSlideJumpBlock','siPlusPollBridge',
      'siPlusSpotlightLiveControls','siPlusActivityBreakLaunch'];
    const blocks=Object.fromEntries(ids.map(id=>{
      const el=document.getElementById(id),rect=el?.getBoundingClientRect();
      return [id,rect?{x:rect.x,y:rect.y,w:rect.width,h:rect.height}:null];
    }));
    const safety=panel.querySelector('.controller-safety');
    const footer=safety?.getBoundingClientRect();
    const breakBtn=document.getElementById('siPlusActivityBreakLaunch');
    const spot=document.getElementById('siPlusSpotlightLiveControls');
    const b=breakBtn.getBoundingClientRect(),z=spot.getBoundingClientRect();
    const overlap=b.left<z.right&&b.right>z.left&&b.top<z.bottom&&b.bottom>z.top;
    return {blocks,overlap,buttonHeight:b.height,panelWidth:panel.clientWidth,
      panelScrollWidth:panel.scrollWidth,panelScrollHeight:panel.scrollHeight,
      footer:footer?{top:footer.top,bottom:footer.bottom,height:footer.height}:null,
      footerVisible:!!footer&&footer.top>=0&&footer.bottom<=window.innerHeight+2,
      finishVisible:!!document.querySelector('#returnClassBtn'),
      emergencyVisible:!!document.querySelector('#emergencyActivityBtn'),
      breakEnabled:!breakBtn.disabled,
      spotlightButtons:spot.querySelectorAll('button').length,
      bg:getComputedStyle(panel).backgroundImage};
  });
  console.log('SI+ compact live layout',JSON.stringify(layout));
  assert.equal(layout.overlap,false,'Activity break overlaps Spotlight controls');
  assert.ok(layout.buttonHeight>35&&layout.buttonHeight<85,'Activity-break launcher stretched');
  assert.ok(layout.panelScrollWidth<=layout.panelWidth+12,'Controller horizontal overflow');
  assert.ok(layout.spotlightButtons>=4,'Spotlight controls disappeared');
  assert.ok(layout.footerVisible,'Safety buttons not docked in compact teacher window: '+JSON.stringify(layout.footer));
  assert.ok(layout.finishVisible&&layout.emergencyVisible,'Safety actions missing');
  assert.ok(layout.bg.includes('ready_to_start_primary'),'Teacher art no longer mounted');
  await page.screenshot({path:'/tmp/si-live-polish/si-plus-live-850x650.png',animations:'disabled'});
  console.log('PASS SI+ live control compact layout and real interactive tools');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
