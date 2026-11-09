/* Signal Sequence Activity Library thumbnail optical-size regression.
   No classroom session or game state is modified on the server. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 fs.mkdirSync('/tmp/signal-library-thumb',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=await page.request.post(base+'/api/teacher/login',{data:{key:'5030'}});
  assert.equal(login.status(),200);
  await page.goto(base+'/?role=teacher',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof render==='function'&&typeof state!=='undefined',{timeout:15000});
  for(const width of [1440,1280]){
   await page.setViewportSize({width,height:960});
   await page.evaluate(()=>{state.activeApp=null;state.screen='activities';render()});
   await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('#activitiesPanel .activity-catalog-grid .real-app-card')];
    return cards.some(c=>c.querySelector('h3')?.textContent.trim().toUpperCase()==='SIGNAL SEQUENCE'&&
      c.querySelector('svg.si-v90-graphic .si-signal-edge-pulses'));
   },{timeout:15000});
   const info=await page.evaluate(()=>{
     const cards=[...document.querySelectorAll('#activitiesPanel .activity-catalog-grid .real-app-card')];
     const byName=name=>cards.find(c=>c.querySelector('h3')?.textContent.trim().toUpperCase()===name);
     const signal=byName('SIGNAL SEQUENCE'),bingo=byName('BINGO');
     if(!signal||!bingo)return {missing:true};
     const a=signal.querySelector('.act-icon'),b=bingo.querySelector('.act-icon');
     const svg=a.querySelector('svg.si-v90-graphic');
     const bounds=el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height}};
     const pulses=svg.querySelector('.si-signal-edge-pulses').getBBox();
     return {signal:bounds(a),bingo:bounds(b),art:bounds(svg),
      pulseLeft:pulses.x,pulseRight:pulses.x+pulses.width,
      imageHasPulse:!!svg.querySelector('.si-signal-edge-pulses'),
      signalCta:!!signal.querySelector('.real-app-actions button:not(:disabled)'),
      bingoCta:!!bingo.querySelector('.real-app-actions button:not(:disabled)')};
   });
   assert.equal(info.missing,undefined,'Signal Sequence and Bingo must be visible');
   assert.ok(Math.abs(info.signal.width-info.bingo.width)<3,'Signal thumbnail width mismatch: '+JSON.stringify(info));
   assert.ok(Math.abs(info.signal.height-info.bingo.height)<3,'Signal thumbnail height mismatch: '+JSON.stringify(info));
   assert.ok(Math.abs(info.art.width-info.signal.width)<3,'Signal art must fill frame width');
   assert.ok(Math.abs(info.art.height-info.signal.height)<3,'Signal art must fill frame height');
   assert.ok(info.imageHasPulse&&info.pulseLeft<25&&info.pulseRight>215,'Signal image must fill width optically: '+JSON.stringify(info));
   assert.ok(info.signalCta&&info.bingoCta,'Original activity actions must remain interactive');
   await page.locator('#activitiesPanel .activity-catalog-grid .real-app-card').filter({has:page.locator('h3', {hasText:'SIGNAL SEQUENCE'})}).screenshot({path:'/tmp/signal-library-thumb/signal-sequence-'+width+'.png',animations:'disabled'});
   console.log('PASS Signal Sequence artwork standard-size and full-width',width,JSON.stringify(info));
  }
  assert.deepEqual(errors,[],'No page errors during visual QA');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
