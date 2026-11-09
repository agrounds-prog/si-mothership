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
      ['.mcb-hero','header_hero.png'],['.mcb-main.mcb-card','panel_main.png'],
      ['.mcb-board-tile','tile_numbered.png'],
      ['.mcb-modes button.active','mode_selected.png'],
      ['#mcbSaveLaunch','button_primary_green.png'],
      ['.mcb-upload-row button','button_secondary_cyan.png'],
      ['.mcb-image-tabs button.active','tab_chip.png'],
      ['#mcbClearSelection','button_secondary_red.png']]){
     const item=root.locator(selector).first();
     assert.ok(await item.count(),selector+' missing from MATCH');
     const css=await item.evaluate(el=>getComputedStyle(el).backgroundImage);
     assert.ok(css.includes(asset),selector+' did not get image '+asset+': '+css);
   }
   const images=[
     'header_hero.png','panel_main.png','panel_sidebar.png','panel_section.png',
     'tile_numbered.png','mode_selected.png','mode_idle.png','mode_purple.png',
     'button_primary_green.png','button_primary_blue.png','button_secondary_cyan.png',
     'button_secondary_red.png','button_disabled_slate.png','tab_chip.png',
     'stat_chip.png','saved_row.png','gallery_empty.png',
     'button_secondary_purple.png','button_secondary_navy.png','button_secondary_orange.png'
   ];
   for(const name of images){
     const response=await context.request.get(base+'/match-v2-art/'+name);
     assert.equal(response.status(),200,name+' not publicly served');
     assert.ok((await response.body()).length>5000,name+' not a genuine PNG image');
     assert.match(response.headers()['content-type']||'',/image\/png/,name+' wrong content type');
   }
   const widths=await root.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
   assert.ok(widths.scroll<=widths.client+20,'horizontal overflow '+JSON.stringify(widths));
   const disabled=root.locator('button:disabled').first();
   if(await disabled.count()){
     const disabledArt=await disabled.evaluate(el=>getComputedStyle(el).backgroundImage);
     assert.ok(disabledArt.includes('button_disabled_slate.png'),disabledArt);
   }
   const imagesResolved=await page.evaluate(async()=>{
     return Promise.all(['button_primary_green.png','tile_numbered.png','panel_main.png','mode_selected.png'].map(name=>new Promise(resolve=>{
       const image=new Image();image.onload=()=>resolve({name,ok:image.naturalWidth>0});
       image.onerror=()=>resolve({name,ok:false});image.src='/match-v2-art/'+name;
     })));
   });
   assert.ok(imagesResolved.every(item=>item.ok),'PNG assets failed browser decoding: '+JSON.stringify(imagesResolved));
   // Verify mode navigation remains interactive; artwork must not swallow clicks.
   await root.locator('[data-mcb-mode="pairs"]').click();
   assert.equal(await root.locator('[data-mcb-mode="pairs"]').getAttribute('aria-selected'),'true');
   await root.locator('[data-mcb-mode="images"]').click();
   assert.equal(await root.locator('[data-mcb-mode="images"]').getAttribute('aria-selected'),'true');
   assert.equal(errors.length,0,'JS errors: '+errors.join('|'));
   await root.screenshot({path:'/tmp/match-illustrated-v2/'+viewport.width+'-match-illustrated.png',animations:'disabled'});
   console.log('PASS MATCH uploaded PNG art and active controls in browser',viewport.width);
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
