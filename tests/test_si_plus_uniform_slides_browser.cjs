/* SI+ same-size presentation stage across mixed image dimensions and slide types.
 * Chromium runs against isolated classroom server; never touches live saved decks. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',err=>errors.push(String(err.stack||err)));
 await page.route(/youtube\.com|youtu\.be|ytimg\.com/,route=>route.abort());
 try{
  const login=await page.request.post(BASE+'/api/teacher/login',{data:{key:'5030'}});
  assert.equal(login.status(),200,'isolated test server teacher authentication');
  await page.goto(BASE+'/?role=teacher',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(()=>typeof siPlusSlideFrame==='function'&&(!NETWORK_SYNC||networkHydrated),null,{timeout:16000});
  const names=await page.evaluate(()=>{
   const specs=[[1600,900,'Widescreen'],[900,900,'Square'],[600,1200,'Portrait']];
   const images=specs.map(([w,h,label])=>{
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const x=canvas.getContext('2d');x.fillStyle='#164563';x.fillRect(0,0,w,h);
    x.fillStyle='white';x.font='bold 45px sans-serif';x.fillText(label,60,80);
    return canvas.toDataURL('image/png');
   });
   const slides=images.map((image,i)=>({
     type:'instruction',title:'',listTitle:specs[i][2],text:'',image,youtube:''
   }));
   const question=freshSlide('question');question.listTitle='Question with choices';
   question.title='What should we do next?';question.choices[0].text='Practice';
   const poll=freshSlide('poll');poll.listTitle='Poll';poll.title='How was today?';
   poll.choices[0].text='Good';
   const instruction=freshSlide('instruction');
   instruction.listTitle='Text slide';instruction.title='Welcome';instruction.text='Same size as every other slide.';
   const id='si-plus-uniform-stage-regression';
   state.activities.push({id,type:'presentation',name:'Fixed Stage Test',deckTitle:'Fixed Stage Test',
     slides:[...slides,question,poll,instruction],userCreated:true});
   state.activityRun={activityId:id,runToken:'stage-testing',phase:'running',slideIndex:0,
     showResults:false,revealAnswer:false,responses:{}};
   state.screen='activity';
   document.querySelector('#teacher').classList.remove('active');
   document.querySelector('#shared').classList.add('active');
   document.body.classList.add('role-shared');
   renderPublic();
   return state.activities.find(a=>a.id===id).slides.map(s=>s.listTitle);
  });
  const screenshots=[];
  for(const [width,height] of [[1920,1080],[1280,720],[1024,768],[390,780]]){
   await page.setViewportSize({width,height});
   const dims=[];
   for(let i=0;i<names.length;i++){
    await page.evaluate(i=>{state.activityRun.slideIndex=i;renderPublic()},i);
    await page.locator('#sharedContent .si-plus-slide-stage').waitFor({state:'visible'});
    const info=await page.evaluate(()=>{
      const root=document.querySelector('#sharedContent'),stage=root.querySelector('.si-plus-slide-stage');
      const stageBox=stage.getBoundingClientRect();
      const image=stage.querySelector('.si-plus-viewport-image > img');
      const imgBox=image?.getBoundingClientRect();
      return {
       stage:{w:stageBox.width,h:stageBox.height,x:stageBox.x,y:stageBox.y},
       visible:getComputedStyle(stage).display!=='none',
       image:!!image,
       imageBox:imgBox?{w:imgBox.width,h:imgBox.height}:null,
       objectFit:image?getComputedStyle(image).objectFit:null,
       overflowX:root.scrollWidth>root.clientWidth+3,
       slideType:state.activities.find(a=>a.id===state.activityRun.activityId).slides[state.activityRun.slideIndex].type
      };
    });
    assert.equal(info.visible,true);
    assert.ok(info.stage.w>0&&info.stage.h>0,'stage must be visible');
    assert.ok(Math.abs(info.stage.w/info.stage.h-16/9)<.015,'slide stage must remain 16:9');
    assert.ok(Math.abs(info.stage.w-Math.min(width,height*16/9))<3,
      'stage should take the largest possible 16:9 area');
    assert.ok(info.stage.x>=-2&&info.stage.y>=-2&&info.stage.x+info.stage.w<=width+2
      &&info.stage.y+info.stage.h<=height+2,'stage remains entirely on screen');
    assert.equal(info.overflowX,false,'projector should not overflow sideways');
    if(i<3){
      assert.equal(info.image,true);
      assert.equal(info.objectFit,'contain','do not stretch or crop uploaded pictures');
      assert.ok(Math.abs(info.imageBox.w-info.stage.w)<3);
      assert.ok(Math.abs(info.imageBox.h-info.stage.h)<3);
    }
    dims.push(info.stage);
   }
   const first=dims[0];
   assert.ok(dims.every(d=>Math.abs(d.w-first.w)<2&&Math.abs(d.h-first.h)<2),
     'ALL image, poll, question and instruction slides must occupy equal-size stages');
   screenshots.push({width,height,stage:first,slides:dims.length});
  }
  assert.deepEqual(errors,[],'no page runtime errors');
  console.log('SI+ UNIFORM SLIDE STAGE PASSED',JSON.stringify({screenshots,names,errors}));
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
