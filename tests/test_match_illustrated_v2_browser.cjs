const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base=process.env.LOCAL_URL||'http://127.0.0.1:8877';
(async()=>{
 fs.mkdirSync('/tmp/match-illustrated-v2',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const viewport of [{width:1440,height:900},{width:1280,height:800}]){
   const context=await browser.newContext({viewport});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto(base+'/?role=teacher',{waitUntil:'domcontentloaded'});
   const login=await context.request.post(base+'/api/teacher/login',{data:{key:'5030',remember:true}});
   assert.equal(login.status(),200,'teacher test login');
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof openApp==='function'&&typeof state!=='undefined',{timeout:16000});
   await page.evaluate(()=>openApp('match'));
   await page.waitForFunction(()=>document.getElementById('activitiesPanel')?.classList.contains('si-mp-match-studio'),{timeout:12000});
   const root=page.locator('#activitiesPanel.si-mp-match-studio');
   for(const [selector,asset] of [
      ['.mcb-hero','header.svg'],['.mcb-card','panel.svg'],
      ['.mcb-board-tile','board_tile.svg'],
      ['.mcb-modes button.active','mode_active.svg'],
      ['#mcbSaveLaunch','button_green.svg'],
      ['.mcb-upload-row button','button_blue.svg']]){
     const item=root.locator(selector).first();
     assert.ok(await item.count(),selector+' missing from MATCH');
     const css=await item.evaluate(el=>getComputedStyle(el).backgroundImage);
     assert.ok(css.includes(asset),selector+' did not get image '+asset+': '+css);
   }
   const images=['header.svg','panel.svg','board_tile.svg','button_blue.svg','button_green.svg','mode_active.svg'];
   for(const name of images){
     const response=await context.request.get(base+'/match-v2-art/'+name);
     assert.equal(response.status(),200,name+' not publicly served');
     assert.ok((await response.text()).includes('<svg'),name+' not SVG art');
   }
   const widths=await root.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
   assert.ok(widths.scroll<=widths.client+20,'horizontal overflow '+JSON.stringify(widths));
   const disabled=root.locator('button:disabled').first();
   if(await disabled.count()){
     const disabledArt=await disabled.evaluate(el=>getComputedStyle(el).backgroundImage);
     assert.ok(disabledArt.includes('button_disabled.svg'),disabledArt);
   }
   assert.equal(errors.length,0,'JS errors: '+errors.join('|'));
   await root.screenshot({path:'/tmp/match-illustrated-v2/'+viewport.width+'-match-illustrated.png',animations:'disabled'});
   console.log('PASS MATCH SVG art in actual teacher controls',viewport.width);
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
